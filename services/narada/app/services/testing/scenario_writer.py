"""Writes one concrete fake candidate for a situation: who they are, what they will say,
and the ground truth each answer should be saved as."""

from __future__ import annotations

import secrets
from typing import Any

from app.domain.agents.models import AgentDefinition
from app.domain.testing.models import Scenario, Situation
from app.domain.testing.rules import build_scenario
from app.integrations.llm import LLMClient
from app.services.testing.briefs import describe_definition

_SYSTEM = """You design realistic test candidates for an AI phone-screening agent used by \
Indian recruiters. Given the agent's setup and one situation to test, invent ONE candidate.

- Use a realistic Indian name and a believable profile for the role. Vary names, cities, \
companies, numbers and gender between candidates; the brief gives a variation number to \
help. `gender` must match the name (it picks the candidate's voice).
- For every answer key, give `spoken`: what the candidate actually says out loud (natural, \
can be messy: "around 80k a month", "2 months, but negotiable") and `truth`: the value the \
agent should save, in the stated format. They must agree with each other, and `spoken` \
must obey the situation (if the candidate must not state a total, `spoken` must not contain it).
- Give a value for every call input key (the candidate name for a name input).
- `behavior`: 2-4 sentences telling the candidate actor exactly how to play the situation.
- `expectedOutcome`: 1-2 sentences on what a correct agent does in this call.
- startLanguage must be one of the agent's languages; for a language situation use the \
language it names (the first one, for a switch)."""

_KV = {
    "type": "object",
    "additionalProperties": False,
    "required": ["key", "value"],
    "properties": {"key": {"type": "string"}, "value": {"type": "string"}},
}

SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "candidateName",
        "gender",
        "persona",
        "startLanguage",
        "callInputs",
        "answers",
        "behavior",
        "expectedOutcome",
    ],
    "properties": {
        "candidateName": {"type": "string"},
        "gender": {"type": "string", "enum": ["male", "female"]},
        "persona": {"type": "string"},
        "startLanguage": {"type": "string"},
        "callInputs": {"type": "array", "items": _KV},
        "answers": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["key", "spoken", "truth"],
                "properties": {
                    "key": {"type": "string"},
                    "spoken": {"type": "string"},
                    "truth": {"type": "string"},
                },
            },
        },
        "behavior": {"type": "string"},
        "expectedOutcome": {"type": "string"},
    },
}


async def write_scenario(
    llm: LLMClient, definition: AgentDefinition, situation: Situation
) -> Scenario:
    brief = (
        f"{describe_definition(definition)}\n\n"
        f"Situation to test: {situation.title}\n"
        f"How the candidate behaves: {situation.instructions}\n"
        f"What a good agent does: {situation.expectation}\n"
        f"Variation number: {secrets.randbelow(10_000)}"
    )
    data = await llm.reply_json(
        _SYSTEM, [{"role": "user", "content": brief}], "candidate_scenario", SCHEMA, 2000
    )
    return build_scenario(
        definition,
        candidate_name=data["candidateName"],
        persona=data["persona"],
        start_language=data["startLanguage"],
        call_inputs={kv["key"]: kv["value"] for kv in data["callInputs"]},
        answers={a["key"]: (a["spoken"], a["truth"]) for a in data["answers"]},
        behavior=data["behavior"],
        expected_outcome=data["expectedOutcome"],
        gender=data["gender"],
    )
