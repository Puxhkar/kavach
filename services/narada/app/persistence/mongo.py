"""Mongo connection lifecycle. The only module that creates a Mongo client."""

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.shared.logger import get_logger
from app.shared.settings import settings

logger = get_logger("persistence.mongo")

_client: AsyncIOMotorClient | None = None


async def connect_mongo() -> AsyncIOMotorDatabase:
    global _client
    _client = AsyncIOMotorClient(settings.MONGODB_CONNECTION_URL, serverSelectionTimeoutMS=5000)
    # Fail at startup, not on the first user click.
    await _client.admin.command("ping")
    logger.info("Mongo connected: db=%s", settings.DB_NAME)
    return _client[settings.DB_NAME]


def close_mongo() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None
