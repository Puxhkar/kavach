"""Mapping helpers shared by the repositories."""

from datetime import UTC, datetime

from bson import ObjectId


def as_utc(value: datetime) -> datetime:
    # Mongo returns BSON dates as naive UTC.
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def object_id(value: str) -> ObjectId | None:
    """Ids come from URLs; anything that is not an ObjectId simply matches nothing."""
    return ObjectId(value) if ObjectId.is_valid(value) else None
