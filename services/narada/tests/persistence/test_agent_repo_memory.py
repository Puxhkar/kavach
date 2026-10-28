from dataclasses import replace
from datetime import timedelta

from app.domain.agents.models import Agent, Vendor
from app.domain.agents.rules import apply_definition
from app.persistence.repositories.agent_repo import InMemoryAgentRepo, from_doc, to_doc
from tests.conftest import NOW, PLIVO_FLOW_ID, make_definition


def _agent() -> Agent:
    return Agent(
        name="Joining Check-in",
        vendor=Vendor.PLIVO,
        assistant_id=PLIVO_FLOW_ID,
        created_at=NOW,
        updated_at=NOW,
    )


async def test_insert_assigns_an_id():
    repo = InMemoryAgentRepo()
    saved = await repo.insert(_agent())
    assert saved.id and len(saved.id) == 24


async def test_full_agent_round_trips_through_the_document_mapping():
    repo = InMemoryAgentRepo()
    saved = await repo.insert(_agent())
    described = apply_definition(saved, make_definition(), NOW)
    await repo.replace(described)
    assert await repo.get(saved.id) == described


def test_documents_are_camel_case_like_the_api():
    doc = to_doc(
        apply_definition(replace(_agent(), id="54b61663994926b449ebec6a"), make_definition(), NOW)
    )
    assert {"assistantId", "promptVersions", "createdAt", "updatedAt"} <= doc.keys()
    assert {"callInputs", "languageSwitch", "callEnding"} <= doc["definition"].keys()
    assert from_doc(doc).definition == make_definition()


async def test_list_is_most_recently_updated_first():
    repo = InMemoryAgentRepo()
    older = await repo.insert(_agent())
    newer = await repo.insert(replace(_agent(), name="ER", updated_at=NOW + timedelta(minutes=5)))
    assert [a.id for a in await repo.list_all()] == [newer.id, older.id]


async def test_unknown_or_malformed_id_reads_as_missing():
    repo = InMemoryAgentRepo()
    assert await repo.get("54b61663994926b449ebec6a") is None
    assert await repo.get("nope") is None
