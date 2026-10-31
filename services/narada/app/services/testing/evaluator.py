"""Scores a finished chat-mode conversation against the agent's definition.

The judge reports per-answer and per-check findings; `score_conversation` turns those into
the verdict, so a lenient judge cannot pass a conversation with a failed check.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from app.domain.agents.models import AgentDefinition
from app.domain.testing.models import (
    AnswerResult,
    AnswerStatus,
    Check,
    CheckKind,
    Conversation,
    EndReason,
    Scenario,
    Situation,
    Speaker,
    Turn,
)
from app.domain.testing.rules import score_conversation
from app.integrations.llm import LLMClient
from app.services.testing.briefs import describe_definition

_SYSTEM = """You are a strict QA reviewer for an AI phone-screening agent. You get the \
agent's setup, the test situation, the candidate's true answers, and the transcript. \
Judge only what is in the transcript.

In voice tests a candidate line is followed by "heard:" — what the agent's speech \
recognition delivered. The agent only ever received the heard version, so judge its \
replies against that, but answers against the candidate's truth: a good agent confirms \
anything unclear (especially numbers) instead of guessing, and saving a misheard value \
is wrong.

answers: one entry per answer key in the setup.
- agentValue: the value the agent understood or confirmed, converted to the saved format; \
"" if it never got one.
- status: correct (matches truth after unit conversion), wrong (agent understood or \
confirmed a different value), not_collected (never asked or never got an answer), declined \
(candidate refused).
- acceptable: true if this status is what a good agent would end up with in THIS situation \
(e.g. not_collected is acceptable when the candidate asked for a callback or is the wrong \
person; declined is acceptable when the candidate refused; wrong is never acceptable).

checks: exactly one per item below, with a one-sentence detail quoting the transcript when \
it fails:
- kind "rule": one per rule in the setup, name = the rule text. A rule that never came up \
passes.
- kind "situation": name "Handled the situation", against what a good agent does.
- kind "ending": name "Ended the call properly", against how a good call ends.
- kind "language": name "Language behaviour", against the languages and switching setting.

summary: 1-2 plain sentences on what went wrong, or that the call went well."""

SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["answers", "checks", "summary"],
    "properties": {
        "answers": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["key", "agentValue", "status", "acceptable", "note"],
                "properties": {
                    "key": {"type": "string"},
                    "agentValue": {"type": "string"},
                    "status": {"type": "string", "enum": [s.value for s in AnswerStatus]},
                    "acceptable": {"type": "boolean"},
                    "note": {"type": "string"},
                },
            },
        },
        "checks": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["name", "kind", "passed", "detail"],
                "properties": {
                    "name": {"type": "string"},
                    "kind": {
                        "type": "string",
                        "enum": [k.value for k in CheckKind if k is not CheckKind.ANSWER],
                    },
                    "passed": {"type": "boolean"},
                    "detail": {"type": "string"},
                },
            },
        },
        "summary": {"type": "string"},
    },
}

_END_REASON_TEXT = {
    EndReason.AGENT_ENDED: "the agent ended the call",
    EndReason.CANDIDATE_HUNG_UP: "the candidate hung up",
    EndReason.TURN_LIMIT: "the test stopped at the turn limit; nobody ended the call",
}


def format_transcript(transcript: tuple[Turn, ...]) -> str:
    def line(turn: Turn) -> str:
        who = "AGENT" if turn.speaker is Speaker.AGENT else "CANDIDATE"
        text = f"{who}: {'(silence)' if turn.silent else turn.text}"
        if turn.heard is not None:
            text += f"\n  heard: {turn.heard or '(nothing)'}"
        return text

    return "\n".join(line(t) for t in transcript)


async def evaluate(
    llm: LLMClient,
    conversation: Conversation,
    definition: AgentDefinition,
    situation: Situation,
    scenario: Scenario,
    transcript: tuple[Turn, ...],
    end_reason: EndReason,
    now: datetime,
) -> Conversation:
    truths = "\n".join(f"- {a.key}: {a.truth} (said as: {a.spoken})" for a in scenario.answers)
    brief = (
        f"{describe_definition(definition)}\n\n"
        f"Situation: {situation.title}. What a good agent does: {situation.expectation}\n"
        f"Expected outcome for this candidate: {scenario.expected_outcome}\n"
        f"Candidate's true answers:\n{truths}\n\n"
        f"How the call ended: {_END_REASON_TEXT[end_reason]}\n"
        f"Transcript:\n{format_transcript(transcript)}"
    )
    data = await llm.reply_json(
        _SYSTEM, [{"role": "user", "content": brief}], "call_review", SCHEMA, 3000
    )
    answers = {
        a["key"]: AnswerResult(
            key=a["key"],
            expected="",
            agent_value=a["agentValue"],
            status=AnswerStatus(a["status"]),
            acceptable=a["acceptable"] and a["status"] != AnswerStatus.WRONG,
            note=a["note"],
        )
        for a in data["answers"]
    }
    checks = [
        Check(name=c["name"], kind=CheckKind(c["kind"]), passed=c["passed"], detail=c["detail"])
        for c in data["checks"]
    ]
    return score_conversation(
        conversation,
        definition,
        scenario,
        transcript,
        end_reason,
        answers,
        checks,
        data["summary"],
        now,
    )
