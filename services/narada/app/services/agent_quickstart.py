"""Paste a prompt, get a testable agent: the shortcut past the two-step setup.

The model reads the prompt and drafts what the agent must collect, its rules and how a good
call ends. `{{placeholders}}` become the call inputs by pattern, not by guessing. The draft
is cleaned up to the same rules as a hand-written setup and validated before it is saved,
so a sloppy model reply can't produce an agent the tests choke on.
"""

from __future__ import annotations

import re
from typing import Any

from app.domain.agents.models import (
    SUPPORTED_LANGUAGES,
    AgentDefinition,
    AnswerField,
    AnswerFormat,
    CallInput,
    LanguageSwitch,
    Rule,
    RuleKind,
)
from app.domain.agents.rules import validate_definition
from app.integrations.llm import LLMClient

# `{{name}}`, `{{ job_role }}` and `{{Job Role}}` all count.
_PLACEHOLDER = re.compile(r"\{\{\s*([A-Za-z][A-Za-z0-9_ ]*?)\s*\}\}")
_MAX_ANSWERS = 8
_MAX_RULES = 6
DEFAULT_LANGUAGES = ("English", "Hindi")
_FALLBACK_ANSWER = AnswerField(
    key="call_outcome",
    question="What was the outcome of the call?",
    format=AnswerFormat.TEXT,
    required=False,
)
_FALLBACK_ENDING = "Thank the caller and end the call politely."

_SYSTEM = (
    "You read the system prompt of a phone voice agent and describe what it is supposed to "
    "do, so it can be tested.\n"
    "name: a short name for the agent (2-4 words).\n"
    "answers: each piece of information the agent must collect from the person it talks "
    "to, in order. key = snake_case; question = how the agent asks it; format = one of "
    "text, number, amount_lpa (salary in lakh per year), duration_days, date, yes_no, "
    "choice; choices only for choice. Leave answers empty if it collects nothing.\n"
    "rules: up to 6 short must / must_not rules the prompt states or clearly implies.\n"
    "callEnding: one sentence on how a good call ends.\n"
    "inputExamples: for each {{placeholder}} listed by the user, a realistic example value."
)

_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "name": {"type": "string"},
        "answers": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "key": {"type": "string"},
                    "question": {"type": "string"},
                    "format": {"type": "string", "enum": [f.value for f in AnswerFormat]},
                    "required": {"type": "boolean"},
                    "choices": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["key", "question", "format", "required", "choices"],
                "additionalProperties": False,
            },
        },
        "rules": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "kind": {"type": "string", "enum": [k.value for k in RuleKind]},
                    "text": {"type": "string"},
                },
                "required": ["kind", "text"],
                "additionalProperties": False,
            },
        },
        "callEnding": {"type": "string"},
        "inputExamples": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"key": {"type": "string"}, "example": {"type": "string"}},
                "required": ["key", "example"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["name", "answers", "rules", "callEnding", "inputExamples"],
    "additionalProperties": False,
}


def _snake(text: str) -> str:
    key = re.sub(r"[^a-z0-9]+", "_", text.strip().lower()).strip("_")[:64]
    return key if key and key[0].isalpha() else f"field_{key}"[:64].strip("_")


def placeholders(prompt: str) -> list[str]:
    """`{{name}}`-style keys in first-seen order, normalised to snake_case."""
    seen: dict[str, None] = {}
    for raw in _PLACEHOLDER.findall(prompt):
        seen.setdefault(_snake(raw), None)
    return list(seen)


def build_definition(
    prompt: str, languages: tuple[str, ...], draft: dict[str, Any]
) -> AgentDefinition:
    """The model's draft, cleaned to the setup rules: snake_case keys, no duplicates, no
    answer that is also a call input, choices only where they make sense."""
    examples = {
        _snake(str(e.get("key", ""))): str(e.get("example", ""))
        for e in draft.get("inputExamples", [])
    }
    inputs = tuple(
        CallInput(key=k, label=k.replace("_", " ").capitalize(), example=examples.get(k, "")[:100])
        for k in placeholders(prompt)
    )
    input_keys = {i.key for i in inputs}
    answers: list[AnswerField] = []
    for item in draft.get("answers", []):
        key, question = _snake(str(item.get("key", ""))), str(item.get("question", "")).strip()
        if not question or key in input_keys or any(a.key == key for a in answers):
            continue
        fmt = item.get("format")
        fmt = AnswerFormat(fmt) if fmt in AnswerFormat._value2member_map_ else AnswerFormat.TEXT
        choices = tuple(str(c).strip() for c in item.get("choices", []) if str(c).strip())
        if fmt is AnswerFormat.CHOICE and len(choices) < 2:
            fmt, choices = AnswerFormat.TEXT, ()
        if fmt is not AnswerFormat.CHOICE:
            choices = ()
        answers.append(
            AnswerField(
                key=key,
                question=question[:300],
                format=fmt,
                required=bool(item.get("required", True)),
                choices=choices,
            )
        )
        if len(answers) == _MAX_ANSWERS:
            break
    rules = tuple(
        Rule(text=str(r.get("text", "")).strip()[:300], kind=RuleKind(r["kind"]))
        for r in draft.get("rules", [])[:_MAX_RULES]
        if str(r.get("text", "")).strip() and r.get("kind") in RuleKind._value2member_map_
    )
    chosen = tuple(lang for lang in dict.fromkeys(languages) if lang in SUPPORTED_LANGUAGES)
    definition = AgentDefinition(
        prompt=prompt.strip(),
        call_inputs=inputs,
        answers=tuple(answers) or (_FALLBACK_ANSWER,),
        rules=rules,
        languages=chosen or DEFAULT_LANGUAGES,
        language_switch=LanguageSwitch.FOLLOW,
        call_ending=str(draft.get("callEnding", "")).strip()[:500] or _FALLBACK_ENDING,
    )
    validate_definition(definition)
    return definition


async def draft_from_prompt(
    llm: LLMClient, prompt: str, languages: tuple[str, ...]
) -> tuple[str, AgentDefinition]:
    keys = placeholders(prompt)
    user = f"Placeholders: {', '.join(keys) or 'none'}\n\nPrompt:\n{prompt.strip()}"
    draft = await llm.reply_json(
        _SYSTEM, [{"role": "user", "content": user}], "agent_draft", _SCHEMA, 1200
    )
    name = str(draft.get("name", "")).strip()[:60]
    return name, build_definition(prompt, languages, draft)
