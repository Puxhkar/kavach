"""Storage for Call Guard: the owner's profile, screened calls, errands and scam drills.

In memory for now: a restart clears the inbox. Records are frozen dataclasses, so a reader
never sees one half-updated.
"""

from __future__ import annotations

from app.domain.guard.models import Drill, Errand, Profile, ScreenedCall, VipContact

DEFAULT_PROFILE = Profile(
    owner_name="Ganesh",
    availability="after 6 PM today",
    language="English",
    vip_contacts=(VipContact("Mom", "mother"), VipContact("Papa", "father")),
    listen_languages=("English", "Hindi", "Kannada", "Tamil"),
)


class InMemoryGuardRepo:
    def __init__(self, profile: Profile = DEFAULT_PROFILE) -> None:
        self._profile = profile
        self._calls: dict[str, ScreenedCall] = {}
        self._drills: dict[str, Drill] = {}
        self._errands: dict[str, Errand] = {}

    async def get_profile(self) -> Profile:
        return self._profile

    async def save_profile(self, profile: Profile) -> Profile:
        self._profile = profile
        return profile

    async def save_call(self, call: ScreenedCall) -> None:
        self._calls[call.id] = call

    async def get_call(self, call_id: str) -> ScreenedCall | None:
        return self._calls.get(call_id)

    async def list_calls(self) -> list[ScreenedCall]:
        return list(self._calls.values())

    async def save_drill(self, drill: Drill) -> None:
        self._drills[drill.id] = drill

    async def get_drill(self, drill_id: str) -> Drill | None:
        return self._drills.get(drill_id)

    async def list_drills(self) -> list[Drill]:
        return sorted(self._drills.values(), key=lambda d: d.created_at, reverse=True)

    async def save_errand(self, errand: Errand) -> None:
        self._errands[errand.id] = errand

    async def get_errand(self, errand_id: str) -> Errand | None:
        return self._errands.get(errand_id)

    async def list_errands(self) -> list[Errand]:
        return sorted(self._errands.values(), key=lambda e: e.created_at, reverse=True)
