"""MongoAgentRepo against a real Mongo. Skipped unless NARADA_TEST_MONGO_URL is set.

Each run uses a throwaway database (narada_test_<random>) and drops it afterwards, so it
never touches the `narada` database the app uses.
"""

import os
import uuid
from dataclasses import replace
from datetime import timedelta

import pytest
from motor.motor_asyncio import AsyncIOMotorClient

from app.domain.agents.models import Agent, Vendor
from app.domain.agents.rules import apply_definition
from app.persistence.repositories.agent_repo import COLLECTION, MongoAgentRepo
from tests.conftest import NOW, PLIVO_FLOW_ID, make_definition

MONGO_URL = os.getenv("NARADA_TEST_MONGO_URL")
pytestmark = pytest.mark.skipif(not MONGO_URL, reason="NARADA_TEST_MONGO_URL not set")


@pytest.fixture
async def repo():
    client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=3000)
    db_name = f"narada_test_{uuid.uuid4().hex[:8]}"
    try:
        yield MongoAgentRepo(client[db_name]), client[db_name]
    finally:
        await client.drop_database(db_name)
        client.close()


def _agent() -> Agent:
    return Agent(
        name="Screening",
        vendor=Vendor.PLIVO,
        assistant_id=PLIVO_FLOW_ID,
        created_at=NOW,
        updated_at=NOW,
    )


async def test_round_trip_keeps_definition_and_versions(repo):
    agents, _ = repo
    saved = await agents.insert(_agent())
    v1 = apply_definition(saved, make_definition(), NOW)
    v2 = apply_definition(v1, make_definition(prompt="Second prompt"), NOW + timedelta(minutes=1))
    await agents.replace(v2)

    loaded = await agents.get(saved.id)
    assert loaded == v2
    assert [v.version for v in loaded.prompt_versions] == [1, 2]


async def test_stored_document_is_camel_case_with_real_dates(repo):
    agents, db = repo
    saved = await agents.insert(apply_definition(_agent(), make_definition(), NOW))
    doc = await db[COLLECTION].find_one({})
    assert str(doc["_id"]) == saved.id
    assert {"assistantId", "promptVersions", "createdAt"} <= doc.keys()
    assert doc["definition"]["languageSwitch"] == "follow"
    assert doc["createdAt"].replace(tzinfo=None) == NOW.replace(tzinfo=None)


async def test_list_orders_by_last_update(repo):
    agents, _ = repo
    older = await agents.insert(_agent())
    newer = await agents.insert(
        replace(_agent(), name="Newer", updated_at=NOW + timedelta(hours=1))
    )
    assert [a.id for a in await agents.list_all()] == [newer.id, older.id]


async def test_unknown_and_malformed_ids_read_as_missing(repo):
    agents, _ = repo
    assert await agents.get("54b61663994926b449ebec6a") is None
    assert await agents.get("not-an-id") is None
