"""Business rules for test runs. Pure functions over the models — no I/O.

LLM output enters the domain only through `build_scenario` and `score_conversation`, which
check it against the agent's definition. A judge that forgets an answer, or a scenario that
skips a call input, is corrected here instead of trusted.
"""

from __future__ import annotations

import re
import uuid
from dataclasses import replace
from datetime import datetime

from app.domain.agents.models import Agent, AgentDefinition
from app.domain.errors import DomainValidationError, FieldError
from app.domain.testing.models import (
    FINISHED_CONVERSATION,
    AnswerResult,
    AnswerStatus,
    Check,
    CheckKind,
    Conversation,
    ConversationStatus,
    EndReason,
    Run,
    RunMode,
    RunStatus,
    Scenario,
    ScenarioAnswer,
    Situation,
    Turn,
)
from app.domain.testing.situations import situations_for

MAX_REPEATS = 5


def plan_run(
    agent: Agent,
    situation_ids: list[str],
    repeats: int,
    max_conversations: int,
    now: datetime,
    mode: RunMode = RunMode.CHAT,
) -> Run:
    """One queued conversation per selected situation × repeat, in catalog order."""
    errors: list[FieldError] = []
    if agent.definition is None or agent.current_prompt_version is None:
        raise DomainValidationError(
            [FieldError("agentId", "Describe the agent (prompt and answers) before testing it")]
        )
    catalog = situations_for(agent.definition)
    known = {s.id for s in catalog}
    unknown = [sid for sid in situation_ids if sid not in known]
    if not situation_ids:
        errors.append(FieldError("situationIds", "Pick at least one situation"))
    if unknown:
        errors.append(FieldError("situationIds", f"Unknown situation: {', '.join(unknown)}"))
    if not 1 <= repeats <= MAX_REPEATS:
        errors.append(FieldError("repeats", f"Repeat each case 1 to {MAX_REPEATS} times"))
    chosen = [s for s in catalog if s.id in set(situation_ids)]
    if mode is RunMode.CHAT and any(s.noisy_line for s in chosen):
        errors.append(FieldError("situationIds", "Noisy phone line needs a voice run"))
    total = len(chosen) * repeats
    if total > max_conversations:
        errors.append(
            FieldError(
                "situationIds",
                f"{total} conversations planned; the limit per run is {max_conversations}",
            )
        )
    if errors:
        raise DomainValidationError(errors)

    conversations = tuple(
        Conversation(
            id=uuid.uuid4().hex[:12],
            situation_id=s.id,
            situation_title=s.title,
            category=s.category,
            language=s.language,
            repeat=r,
        )
        for s in chosen
        for r in range(1, repeats + 1)
    )
    return Run(
        agent_id=agent.id or "",
        agent_name=agent.name,
        prompt_version=agent.current_prompt_version.version,
        mode=mode,
        status=RunStatus.QUEUED,
        created_at=now,
        conversations=conversations,
    )


def situation_by_id(definition: AgentDefinition, situation_id: str) -> Situation:
    for situation in situations_for(definition):
        if situation.id == situation_id:
            return situation
    raise KeyError(situation_id)


_GENDERS = frozenset({"male", "female"})

_PLACEHOLDER_RE = re.compile(r"\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}")


def render_prompt(prompt: str, call_inputs: dict[str, str]) -> str:
    """Fill `{{key}}` placeholders the way Vapi / Plivo would at dial time. Unknown
    placeholders are left as they are, so a typo in the prompt shows up in the transcript."""
    return _PLACEHOLDER_RE.sub(lambda m: call_inputs.get(m.group(1), m.group(0)), prompt)


def build_scenario(
    definition: AgentDefinition,
    candidate_name: str,
    persona: str,
    start_language: str,
    call_inputs: dict[str, str],
    answers: dict[str, tuple[str, str]],
    behavior: str,
    expected_outcome: str,
    gender: str = "",
) -> Scenario:
    """Keep only keys the agent defines and fill any the writer left out, so every call
    input has a value and every answer has a ground truth."""
    inputs = {}
    for item in definition.call_inputs:
        value = call_inputs.get(item.key, "").strip()
        if not value:
            value = candidate_name if item.key == "name" else (item.example or item.label)
        inputs[item.key] = value
    scenario_answers = tuple(
        ScenarioAnswer(key=a.key, spoken=spoken.strip(), truth=truth.strip())
        for a in definition.answers
        for spoken, truth in [answers.get(a.key, ("", ""))]
    )
    language = start_language if start_language in definition.languages else ""
    return Scenario(
        candidate_name=candidate_name.strip() or "Candidate",
        persona=persona.strip(),
        start_language=language or definition.languages[0],
        call_inputs=inputs,
        answers=scenario_answers,
        behavior=behavior.strip(),
        expected_outcome=expected_outcome.strip(),
        gender=gender if gender in _GENDERS else "",
    )


def score_conversation(
    conversation: Conversation,
    definition: AgentDefinition,
    scenario: Scenario,
    transcript: tuple[Turn, ...],
    end_reason: EndReason,
    judged_answers: dict[str, AnswerResult],
    judged_checks: list[Check],
    summary: str,
    now: datetime,
) -> Conversation:
    """Turn the judge's opinion into a verdict. The verdict is not the judge's call: it is
    `passed` only if every check passes, and every defined answer gets a check — a missing
    judgement counts as not collected."""
    truths = {a.key: a.truth for a in scenario.answers}
    answers: list[AnswerResult] = []
    for field in definition.answers:
        judged = judged_answers.get(field.key)
        if judged is None:
            judged = AnswerResult(
                key=field.key,
                expected=truths.get(field.key, ""),
                agent_value="",
                status=AnswerStatus.NOT_COLLECTED,
                acceptable=not field.required,
                note="The scorer did not report on this answer.",
            )
        answers.append(replace(judged, expected=truths.get(field.key, judged.expected)))

    checks = [
        *judged_checks,
        *(
            Check(
                name=f"Answer: {a.key}",
                kind=CheckKind.ANSWER,
                passed=a.acceptable,
                detail=a.note
                or f"{a.status.value}: expected {a.expected!r}, got {a.agent_value!r}",
            )
            for a in answers
        ),
    ]
    if end_reason is EndReason.TURN_LIMIT:
        checks.append(
            Check(
                name="Call reached an end",
                kind=CheckKind.ENDING,
                passed=False,
                detail="The conversation hit the turn limit without the agent ending the call.",
            )
        )
    passed = all(c.passed for c in checks)
    return replace(
        conversation,
        status=ConversationStatus.PASSED if passed else ConversationStatus.FAILED,
        scenario=scenario,
        transcript=transcript,
        end_reason=end_reason,
        answers=tuple(answers),
        checks=tuple(checks),
        summary=summary.strip(),
        finished_at=now,
    )


def interrupt_run(run: Run, now: datetime) -> Run:
    """A run the service stopped in the middle of: unfinished conversations become errors so
    nothing stays 'running' forever."""
    conversations = tuple(
        c
        if c.status in FINISHED_CONVERSATION
        else replace(
            c,
            status=ConversationStatus.ERROR,
            error="The service restarted before this conversation finished.",
            finished_at=now,
        )
        for c in run.conversations
    )
    return replace(run, status=RunStatus.INTERRUPTED, conversations=conversations, finished_at=now)
