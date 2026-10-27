"""Business rules for agent setup. Pure functions over the models — no I/O."""

from __future__ import annotations

import hashlib
import re
import uuid
from dataclasses import dataclass, replace
from datetime import datetime
from enum import StrEnum

from app.domain.agents.models import (
    SUPPORTED_LANGUAGES,
    Agent,
    AgentDefinition,
    AnswerFormat,
    PromptVersion,
    Vendor,
)
from app.domain.errors import DomainValidationError, FieldError

# Keys become the vendor's call variables (`{{variables}}`) and Mongo field names, so they
# stay snake_case ASCII. Dots are banned outright: Mongo reads a dotted field name as a
# path into a nested document, so a write to `ctc.fixed` lands somewhere else.
_KEY_RE = re.compile(r"^[a-z][a-z0-9_]{0,63}$")
_KEY_HINT = "Use lowercase letters, digits and underscores, starting with a letter"

MAX_PROMPT_CHARS = 50_000


class SetupStep(StrEnum):
    CONNECT = "connect"
    DESCRIBE = "describe"
    READY = "ready"


@dataclass(frozen=True)
class SetupProgress:
    connect_done: bool
    describe_done: bool

    @property
    def next_step(self) -> SetupStep:
        if not self.connect_done:
            return SetupStep.CONNECT
        if not self.describe_done:
            return SetupStep.DESCRIBE
        return SetupStep.READY


def setup_progress(agent: Agent) -> SetupProgress:
    return SetupProgress(
        connect_done=bool(agent.name and (agent.assistant_id or agent.vendor is Vendor.NONE)),
        describe_done=agent.definition is not None,
    )


def validate_connection(name: str, vendor: Vendor, assistant_id: str) -> None:
    """Both Plivo flow ids and Vapi assistant ids are UUIDs. Catching a mis-paste here is
    cheaper than discovering it as a failed dispatch on the first test call."""
    errors: list[FieldError] = []
    if not name.strip():
        errors.append(FieldError("name", "Give the agent a name"))
    if vendor is Vendor.NONE:
        if errors:
            raise DomainValidationError(errors)
        return
    try:
        uuid.UUID(assistant_id.strip())
    except ValueError:
        label = "Plivo flow ID" if vendor is Vendor.PLIVO else "Vapi assistant ID"
        errors.append(FieldError("assistantId", f"{label} must look like 8-4-4-4-12 hex"))
    if errors:
        raise DomainValidationError(errors)


def validate_definition(definition: AgentDefinition) -> None:
    errors: list[FieldError] = []

    if not definition.prompt.strip():
        errors.append(FieldError("prompt", "Paste the agent's prompt"))
    elif len(definition.prompt) > MAX_PROMPT_CHARS:
        errors.append(FieldError("prompt", f"Prompt is longer than {MAX_PROMPT_CHARS} characters"))

    input_keys: dict[str, int] = {}
    for i, item in enumerate(definition.call_inputs):
        if not _KEY_RE.fullmatch(item.key):
            errors.append(FieldError(f"callInputs.{i}.key", _KEY_HINT))
        elif item.key in input_keys:
            errors.append(FieldError(f"callInputs.{i}.key", f"'{item.key}' is listed twice"))
        input_keys.setdefault(item.key, i)
        if not item.label.strip():
            errors.append(FieldError(f"callInputs.{i}.label", "Add a label"))

    if not definition.answers:
        errors.append(FieldError("answers", "Add at least one answer the agent must collect"))
    answer_keys: set[str] = set()
    for i, ans in enumerate(definition.answers):
        if not _KEY_RE.fullmatch(ans.key):
            errors.append(FieldError(f"answers.{i}.key", _KEY_HINT))
        elif ans.key in answer_keys:
            errors.append(FieldError(f"answers.{i}.key", f"'{ans.key}' is listed twice"))
        elif ans.key in input_keys:
            # The one rule that keeps "what we send in" and "what we get out" apart.
            errors.append(
                FieldError(
                    f"answers.{i}.key",
                    f"'{ans.key}' is already a call input. An answer is collected from "
                    "the candidate; a call input is sent into the call",
                )
            )
        answer_keys.add(ans.key)
        if not ans.question.strip():
            errors.append(FieldError(f"answers.{i}.question", "Add the question the agent asks"))
        if ans.format is AnswerFormat.CHOICE and len(ans.choices) < 2:
            errors.append(FieldError(f"answers.{i}.choices", "Add at least two choices"))

    for i, rule in enumerate(definition.rules):
        if not rule.text.strip():
            errors.append(FieldError(f"rules.{i}.text", "Write the rule or remove it"))

    if not definition.languages:
        errors.append(FieldError("languages", "Pick at least one language"))
    for lang in definition.languages:
        if lang not in SUPPORTED_LANGUAGES:
            errors.append(FieldError("languages", f"'{lang}' is not a supported language"))

    if not definition.call_ending.strip():
        errors.append(FieldError("callEnding", "Describe how a good call should end"))

    if errors:
        raise DomainValidationError(errors)


def prompt_fingerprint(prompt: str) -> str:
    """Stable id for a prompt's content. Whitespace-only edits keep the fingerprint, so
    re-pasting the same prompt does not cut a new version."""
    normalized = " ".join(prompt.split())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:12]


def apply_definition(agent: Agent, definition: AgentDefinition, now: datetime) -> Agent:
    """Validate and attach a definition. A changed prompt cuts a new prompt version;
    earlier versions are never rewritten, so past test runs stay attributable."""
    validate_definition(definition)
    fingerprint = prompt_fingerprint(definition.prompt)
    versions = agent.prompt_versions
    current = agent.current_prompt_version
    if current is None or current.fingerprint != fingerprint:
        versions = (
            *versions,
            PromptVersion(
                version=(current.version + 1) if current else 1,
                fingerprint=fingerprint,
                prompt=definition.prompt,
                created_at=now,
            ),
        )
    return replace(agent, definition=definition, prompt_versions=versions, updated_at=now)
