"""Storage for agents under test (collection `narada_agents`).

Documents are camelCase on disk, matching the API; `to_doc` / `from_doc` are
the single place that translates to the snake_case domain models. Both repositories go
through them, so the in-memory one used by tests exercises the real mapping.
"""

from __future__ import annotations

import copy
from typing import Any, Protocol

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.domain.agents.models import (
    Agent,
    AgentDefinition,
    AnswerField,
    AnswerFormat,
    CallInput,
    LanguageSwitch,
    PromptVersion,
    Rule,
    RuleKind,
    Vendor,
)
from app.persistence.repositories.common import as_utc, object_id

COLLECTION = "narada_agents"


class AgentRepo(Protocol):
    async def insert(self, agent: Agent) -> Agent: ...

    async def get(self, agent_id: str) -> Agent | None: ...

    async def list_all(self) -> list[Agent]: ...

    async def replace(self, agent: Agent) -> None: ...


# ── Mapping ──────────────────────────────────────────────────────────────────


def _definition_to_doc(d: AgentDefinition) -> dict[str, Any]:
    return {
        "prompt": d.prompt,
        "callInputs": [
            {"key": i.key, "label": i.label, "example": i.example, "required": i.required}
            for i in d.call_inputs
        ],
        "answers": [
            {
                "key": a.key,
                "question": a.question,
                "format": a.format.value,
                "required": a.required,
                "choices": list(a.choices),
                "hint": a.hint,
            }
            for a in d.answers
        ],
        "rules": [{"text": r.text, "kind": r.kind.value} for r in d.rules],
        "languages": list(d.languages),
        "languageSwitch": d.language_switch.value,
        "callEnding": d.call_ending,
    }


def _definition_from_doc(doc: dict[str, Any]) -> AgentDefinition:
    return AgentDefinition(
        prompt=doc["prompt"],
        call_inputs=tuple(
            CallInput(
                key=i["key"],
                label=i["label"],
                example=i.get("example", ""),
                required=i.get("required", True),
            )
            for i in doc.get("callInputs", [])
        ),
        answers=tuple(
            AnswerField(
                key=a["key"],
                question=a["question"],
                format=AnswerFormat(a["format"]),
                required=a.get("required", True),
                choices=tuple(a.get("choices", [])),
                hint=a.get("hint", ""),
            )
            for a in doc.get("answers", [])
        ),
        rules=tuple(Rule(text=r["text"], kind=RuleKind(r["kind"])) for r in doc.get("rules", [])),
        languages=tuple(doc.get("languages", [])),
        language_switch=LanguageSwitch(doc.get("languageSwitch", LanguageSwitch.FOLLOW)),
        call_ending=doc.get("callEnding", ""),
    )


def to_doc(agent: Agent) -> dict[str, Any]:
    doc: dict[str, Any] = {
        "name": agent.name,
        "vendor": agent.vendor.value,
        "assistantId": agent.assistant_id,
        "definition": _definition_to_doc(agent.definition) if agent.definition else None,
        "promptVersions": [
            {
                "version": v.version,
                "fingerprint": v.fingerprint,
                "prompt": v.prompt,
                "createdAt": v.created_at,
            }
            for v in agent.prompt_versions
        ],
        "createdAt": agent.created_at,
        "updatedAt": agent.updated_at,
    }
    if agent.id is not None:
        doc["_id"] = ObjectId(agent.id)
    return doc


def from_doc(doc: dict[str, Any]) -> Agent:
    definition = doc.get("definition")
    return Agent(
        id=str(doc["_id"]),
        name=doc["name"],
        vendor=Vendor(doc["vendor"]),
        assistant_id=doc["assistantId"],
        definition=_definition_from_doc(definition) if definition else None,
        prompt_versions=tuple(
            PromptVersion(
                version=v["version"],
                fingerprint=v["fingerprint"],
                prompt=v["prompt"],
                created_at=as_utc(v["createdAt"]),
            )
            for v in doc.get("promptVersions", [])
        ),
        created_at=as_utc(doc["createdAt"]),
        updated_at=as_utc(doc["updatedAt"]),
    )


# ── Implementations ──────────────────────────────────────────────────────────


class MongoAgentRepo:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._col = db[COLLECTION]

    async def insert(self, agent: Agent) -> Agent:
        doc = to_doc(agent)
        result = await self._col.insert_one(doc)
        doc["_id"] = result.inserted_id
        return from_doc(doc)

    async def get(self, agent_id: str) -> Agent | None:
        oid = object_id(agent_id)
        if oid is None:
            return None
        doc = await self._col.find_one({"_id": oid})
        return from_doc(doc) if doc else None

    async def list_all(self) -> list[Agent]:
        cursor = self._col.find({}).sort("updatedAt", -1)
        return [from_doc(doc) async for doc in cursor]

    async def replace(self, agent: Agent) -> None:
        if agent.id is None:
            raise ValueError("cannot replace an agent without an id")
        await self._col.replace_one({"_id": ObjectId(agent.id)}, to_doc(agent))


class InMemoryAgentRepo:
    """Process-local store for tests and for running without Mongo. Holds documents,
    not models, so reads go through the same mapping as Mongo."""

    def __init__(self) -> None:
        self._docs: dict[str, dict[str, Any]] = {}

    async def insert(self, agent: Agent) -> Agent:
        doc = to_doc(agent)
        doc["_id"] = ObjectId()
        self._docs[str(doc["_id"])] = copy.deepcopy(doc)
        return from_doc(doc)

    async def get(self, agent_id: str) -> Agent | None:
        doc = self._docs.get(agent_id)
        return from_doc(copy.deepcopy(doc)) if doc else None

    async def list_all(self) -> list[Agent]:
        docs = sorted(self._docs.values(), key=lambda d: d["updatedAt"], reverse=True)
        return [from_doc(copy.deepcopy(d)) for d in docs]

    async def replace(self, agent: Agent) -> None:
        if agent.id is None or agent.id not in self._docs:
            raise ValueError("cannot replace an agent that was never inserted")
        self._docs[agent.id] = to_doc(agent)
