"""MongoRunRepo against a real Mongo. Skipped unless NARADA_TEST_MONGO_URL is set; uses a
throwaway database that is dropped afterwards."""

import os
import uuid
from dataclasses import replace

import pytest
from motor.motor_asyncio import AsyncIOMotorClient

from app.domain.testing.models import ConversationStatus, RunStatus, Speaker, Turn
from app.domain.testing.rules import interrupt_run
from app.persistence.repositories import MongoRunRepo
from tests.conftest import NOW
from tests.persistence.test_run_repo_memory import _run

MONGO_URL = os.getenv("NARADA_TEST_MONGO_URL")
pytestmark = pytest.mark.skipif(not MONGO_URL, reason="NARADA_TEST_MONGO_URL not set")


@pytest.fixture
async def repo():
    client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=3000)
    db_name = f"narada_test_{uuid.uuid4().hex[:8]}"
    try:
        yield MongoRunRepo(client[db_name])
    finally:
        await client.drop_database(db_name)
        client.close()


async def test_conversation_saves_do_not_overwrite_each_other(repo):
    saved = await repo.insert(_run())
    a = replace(saved.conversations[0], status=ConversationStatus.PASSED)
    b = replace(saved.conversations[1], transcript=(Turn(Speaker.AGENT, "Hi"),))
    await repo.save_conversation(saved.id, a)
    await repo.save_conversation(saved.id, b)
    await repo.set_status(saved.id, RunStatus.RUNNING, started_at=NOW)

    loaded = await repo.get(saved.id)
    assert loaded.conversations == (a, b)
    assert loaded.started_at == NOW


async def test_unfinished_runs_can_be_interrupted(repo):
    saved = await repo.insert(_run())
    assert [r.id for r in await repo.list_unfinished()] == [saved.id]
    await repo.replace(interrupt_run(saved, NOW))
    assert await repo.list_unfinished() == []
    assert (await repo.get(saved.id)).status is RunStatus.INTERRUPTED
