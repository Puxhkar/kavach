"""Storage for test runs (collection `narada_runs`).

A run embeds its conversations: a run is at most a few dozen short chats, and the results
page always reads them together. Conversations finish concurrently, so each one is written
on its own (`save_conversation`) instead of rewriting the whole run, which would let two
finishing conversations overwrite each other.
"""

from __future__ import annotations

import copy
from datetime import datetime
from typing import Any, Protocol

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.domain.testing.models import (
    AnswerResult,
    AnswerStatus,
    Check,
    CheckKind,
    Conversation,
    ConversationStatus,
    EndReason,
    Recording,
    Run,
    RunMode,
    RunStatus,
    Scenario,
    ScenarioAnswer,
    Speaker,
    Turn,
)
from app.persistence.repositories.common import as_utc, object_id

COLLECTION = "narada_runs"

_UNFINISHED = [RunStatus.QUEUED.value, RunStatus.RUNNING.value]


class RunRepo(Protocol):
    async def insert(self, run: Run) -> Run: ...

    async def get(self, run_id: str) -> Run | None: ...

    async def list_for_agent(self, agent_id: str, limit: int = 50) -> list[Run]: ...

    async def list_unfinished(self) -> list[Run]: ...

    async def replace(self, run: Run) -> None: ...

    async def save_conversation(self, run_id: str, conversation: Conversation) -> None: ...

    async def set_status(
        self,
        run_id: str,
        status: RunStatus,
        *,
        started_at: datetime | None = None,
        finished_at: datetime | None = None,
    ) -> None: ...


# ── Mapping ──────────────────────────────────────────────────────────────────


def _opt_utc(value: datetime | None) -> datetime | None:
    return as_utc(value) if value else None


def _scenario_to_doc(s: Scenario) -> dict[str, Any]:
    return {
        "candidateName": s.candidate_name,
        "persona": s.persona,
        "startLanguage": s.start_language,
        "callInputs": dict(s.call_inputs),
        "answers": [{"key": a.key, "spoken": a.spoken, "truth": a.truth} for a in s.answers],
        "behavior": s.behavior,
        "expectedOutcome": s.expected_outcome,
        "gender": s.gender,
    }


def _scenario_from_doc(doc: dict[str, Any]) -> Scenario:
    return Scenario(
        candidate_name=doc["candidateName"],
        persona=doc.get("persona", ""),
        start_language=doc.get("startLanguage", ""),
        call_inputs=dict(doc.get("callInputs", {})),
        answers=tuple(
            ScenarioAnswer(key=a["key"], spoken=a["spoken"], truth=a["truth"])
            for a in doc.get("answers", [])
        ),
        behavior=doc.get("behavior", ""),
        expected_outcome=doc.get("expectedOutcome", ""),
        gender=doc.get("gender", ""),
    )


def _turn_to_doc(t: Turn) -> dict[str, Any]:
    return {
        "speaker": t.speaker.value,
        "text": t.text,
        "silent": t.silent,
        "heard": t.heard,
        "startMs": t.start_ms,
        "endMs": t.end_ms,
    }


def _turn_from_doc(doc: dict[str, Any]) -> Turn:
    return Turn(
        speaker=Speaker(doc["speaker"]),
        text=doc["text"],
        silent=doc.get("silent", False),
        heard=doc.get("heard"),
        start_ms=doc.get("startMs"),
        end_ms=doc.get("endMs"),
    )


def _recording_to_doc(r: Recording) -> dict[str, Any]:
    return {
        "agentVoice": r.agent_voice,
        "candidateVoice": r.candidate_voice,
        "durationMs": r.duration_ms,
    }


def _recording_from_doc(doc: dict[str, Any]) -> Recording:
    return Recording(
        agent_voice=doc["agentVoice"],
        candidate_voice=doc["candidateVoice"],
        duration_ms=doc["durationMs"],
    )


def conversation_to_doc(c: Conversation) -> dict[str, Any]:
    return {
        "id": c.id,
        "situationId": c.situation_id,
        "situationTitle": c.situation_title,
        "category": c.category,
        "language": c.language,
        "repeat": c.repeat,
        "status": c.status.value,
        "scenario": _scenario_to_doc(c.scenario) if c.scenario else None,
        "transcript": [_turn_to_doc(t) for t in c.transcript],
        "endReason": c.end_reason.value if c.end_reason else None,
        "answers": [
            {
                "key": a.key,
                "expected": a.expected,
                "agentValue": a.agent_value,
                "status": a.status.value,
                "acceptable": a.acceptable,
                "note": a.note,
            }
            for a in c.answers
        ],
        "checks": [
            {"name": k.name, "kind": k.kind.value, "passed": k.passed, "detail": k.detail}
            for k in c.checks
        ],
        "summary": c.summary,
        "error": c.error,
        "recording": _recording_to_doc(c.recording) if c.recording else None,
        "startedAt": c.started_at,
        "finishedAt": c.finished_at,
    }


def conversation_from_doc(doc: dict[str, Any]) -> Conversation:
    scenario = doc.get("scenario")
    end_reason = doc.get("endReason")
    recording = doc.get("recording")
    return Conversation(
        id=doc["id"],
        situation_id=doc["situationId"],
        situation_title=doc["situationTitle"],
        category=doc.get("category", ""),
        language=doc.get("language"),
        repeat=doc.get("repeat", 1),
        status=ConversationStatus(doc["status"]),
        scenario=_scenario_from_doc(scenario) if scenario else None,
        transcript=tuple(_turn_from_doc(t) for t in doc.get("transcript", [])),
        end_reason=EndReason(end_reason) if end_reason else None,
        answers=tuple(
            AnswerResult(
                key=a["key"],
                expected=a.get("expected", ""),
                agent_value=a.get("agentValue", ""),
                status=AnswerStatus(a["status"]),
                acceptable=a["acceptable"],
                note=a.get("note", ""),
            )
            for a in doc.get("answers", [])
        ),
        checks=tuple(
            Check(name=k["name"], kind=CheckKind(k["kind"]), passed=k["passed"], detail=k["detail"])
            for k in doc.get("checks", [])
        ),
        summary=doc.get("summary", ""),
        error=doc.get("error", ""),
        recording=_recording_from_doc(recording) if recording else None,
        started_at=_opt_utc(doc.get("startedAt")),
        finished_at=_opt_utc(doc.get("finishedAt")),
    )


def to_doc(run: Run) -> dict[str, Any]:
    doc: dict[str, Any] = {
        "agentId": run.agent_id,
        "agentName": run.agent_name,
        "promptVersion": run.prompt_version,
        "mode": run.mode.value,
        "status": run.status.value,
        "conversations": [conversation_to_doc(c) for c in run.conversations],
        "createdAt": run.created_at,
        "startedAt": run.started_at,
        "finishedAt": run.finished_at,
    }
    if run.id is not None:
        doc["_id"] = ObjectId(run.id)
    return doc


def from_doc(doc: dict[str, Any]) -> Run:
    return Run(
        id=str(doc["_id"]),
        agent_id=doc["agentId"],
        agent_name=doc.get("agentName", ""),
        prompt_version=doc["promptVersion"],
        mode=RunMode(doc["mode"]),
        status=RunStatus(doc["status"]),
        conversations=tuple(conversation_from_doc(c) for c in doc.get("conversations", [])),
        created_at=as_utc(doc["createdAt"]),
        started_at=_opt_utc(doc.get("startedAt")),
        finished_at=_opt_utc(doc.get("finishedAt")),
    )


def _status_fields(
    status: RunStatus, started_at: datetime | None, finished_at: datetime | None
) -> dict[str, Any]:
    fields: dict[str, Any] = {"status": status.value}
    if started_at is not None:
        fields["startedAt"] = started_at
    if finished_at is not None:
        fields["finishedAt"] = finished_at
    return fields


# ── Implementations ──────────────────────────────────────────────────────────


class MongoRunRepo:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._col = db[COLLECTION]

    async def insert(self, run: Run) -> Run:
        doc = to_doc(run)
        result = await self._col.insert_one(doc)
        doc["_id"] = result.inserted_id
        return from_doc(doc)

    async def get(self, run_id: str) -> Run | None:
        oid = object_id(run_id)
        if oid is None:
            return None
        doc = await self._col.find_one({"_id": oid})
        return from_doc(doc) if doc else None

    async def list_for_agent(self, agent_id: str, limit: int = 50) -> list[Run]:
        cursor = self._col.find({"agentId": agent_id}).sort("createdAt", -1).limit(limit)
        return [from_doc(doc) async for doc in cursor]

    async def list_unfinished(self) -> list[Run]:
        cursor = self._col.find({"status": {"$in": _UNFINISHED}})
        return [from_doc(doc) async for doc in cursor]

    async def replace(self, run: Run) -> None:
        if run.id is None:
            raise ValueError("cannot replace a run without an id")
        await self._col.replace_one({"_id": ObjectId(run.id)}, to_doc(run))

    async def save_conversation(self, run_id: str, conversation: Conversation) -> None:
        await self._col.update_one(
            {"_id": ObjectId(run_id), "conversations.id": conversation.id},
            {"$set": {"conversations.$": conversation_to_doc(conversation)}},
        )

    async def set_status(
        self,
        run_id: str,
        status: RunStatus,
        *,
        started_at: datetime | None = None,
        finished_at: datetime | None = None,
    ) -> None:
        await self._col.update_one(
            {"_id": ObjectId(run_id)}, {"$set": _status_fields(status, started_at, finished_at)}
        )


class InMemoryRunRepo:
    """Process-local store for tests and for running without Mongo. Holds documents, so
    reads go through the same mapping as Mongo."""

    def __init__(self) -> None:
        self._docs: dict[str, dict[str, Any]] = {}

    async def insert(self, run: Run) -> Run:
        doc = to_doc(run)
        doc["_id"] = ObjectId()
        self._docs[str(doc["_id"])] = copy.deepcopy(doc)
        return from_doc(doc)

    async def get(self, run_id: str) -> Run | None:
        doc = self._docs.get(run_id)
        return from_doc(copy.deepcopy(doc)) if doc else None

    async def list_for_agent(self, agent_id: str, limit: int = 50) -> list[Run]:
        docs = [d for d in self._docs.values() if d["agentId"] == agent_id]
        docs.sort(key=lambda d: d["createdAt"], reverse=True)
        return [from_doc(copy.deepcopy(d)) for d in docs[:limit]]

    async def list_unfinished(self) -> list[Run]:
        return [
            from_doc(copy.deepcopy(d)) for d in self._docs.values() if d["status"] in _UNFINISHED
        ]

    async def replace(self, run: Run) -> None:
        if run.id is None or run.id not in self._docs:
            raise ValueError("cannot replace a run that was never inserted")
        self._docs[run.id] = to_doc(run)

    async def save_conversation(self, run_id: str, conversation: Conversation) -> None:
        conversations = self._docs[run_id]["conversations"]
        for i, existing in enumerate(conversations):
            if existing["id"] == conversation.id:
                conversations[i] = conversation_to_doc(conversation)
                return

    async def set_status(
        self,
        run_id: str,
        status: RunStatus,
        *,
        started_at: datetime | None = None,
        finished_at: datetime | None = None,
    ) -> None:
        self._docs[run_id].update(_status_fields(status, started_at, finished_at))
