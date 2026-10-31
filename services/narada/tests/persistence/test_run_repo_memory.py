from dataclasses import replace

from app.domain.agents.models import Agent, Vendor
from app.domain.agents.rules import apply_definition
from app.domain.testing.models import (
    ConversationStatus,
    Recording,
    RunMode,
    RunStatus,
    Speaker,
    Turn,
)
from app.domain.testing.rules import plan_run
from app.persistence.repositories import InMemoryRunRepo
from tests.conftest import NOW, PLIVO_FLOW_ID, make_definition


def _run():
    agent = Agent(
        id="54b61663994926b449ebec6a",
        name="Screening",
        vendor=Vendor.PLIVO,
        assistant_id=PLIVO_FLOW_ID,
        created_at=NOW,
        updated_at=NOW,
    )
    return plan_run(
        apply_definition(agent, make_definition(), NOW), ["silence", "callback"], 1, 30, NOW
    )


async def test_round_trip_and_per_conversation_saves():
    repo = InMemoryRunRepo()
    saved = await repo.insert(_run())
    first = replace(
        saved.conversations[0],
        status=ConversationStatus.RUNNING,
        transcript=(Turn(Speaker.AGENT, "Hi"),),
    )
    await repo.save_conversation(saved.id, first)
    await repo.set_status(saved.id, RunStatus.RUNNING, started_at=NOW)

    loaded = await repo.get(saved.id)
    assert loaded.status is RunStatus.RUNNING
    assert loaded.started_at == NOW
    assert loaded.conversations[0] == first
    assert loaded.conversations[1] == saved.conversations[1]
    assert [r.id for r in await repo.list_unfinished()] == [saved.id]
    assert [r.id for r in await repo.list_for_agent("54b61663994926b449ebec6a")] == [saved.id]
    assert await repo.list_for_agent("someone-else") == []


async def test_voice_fields_round_trip():
    repo = InMemoryRunRepo()
    saved = await repo.insert(replace(_run(), mode=RunMode.VOICE))
    voiced = replace(
        saved.conversations[0],
        transcript=(
            Turn(Speaker.AGENT, "CTC?", start_ms=0, end_ms=900),
            Turn(Speaker.CANDIDATE, "11.5 lakh", heard="11 lakh", start_ms=1400, end_ms=2600),
        ),
        recording=Recording(agent_voice="Shivani", candidate_voice="Devansh", duration_ms=2600),
    )
    await repo.save_conversation(saved.id, voiced)
    loaded = await repo.get(saved.id)
    assert loaded.mode is RunMode.VOICE
    assert loaded.conversations[0] == voiced
