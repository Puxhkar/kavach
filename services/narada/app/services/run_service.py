"""Test-run use-cases: list the situations an agent can be tested on, start a run, read
results."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path

from app.domain.testing.models import Run, RunMode, Situation
from app.domain.testing.rules import interrupt_run, plan_run
from app.domain.testing.situations import situations_for
from app.persistence.recordings import RecordingStore
from app.persistence.repositories import AgentRepo, RunRepo
from app.services.testing.run_executor import RunExecutor
from app.shared.exceptions import NotFoundError, ServiceUnavailableError


def _utc_now() -> datetime:
    return datetime.now(UTC)


class RunService:
    def __init__(
        self,
        agents: AgentRepo,
        runs: RunRepo,
        executor: RunExecutor | None,
        max_conversations: int,
        clock: Callable[[], datetime] = _utc_now,
        recordings: RecordingStore | None = None,
    ) -> None:
        self._agents = agents
        self._runs = runs
        self._recordings = recordings
        self._executor = executor
        self._max_conversations = max_conversations
        self._clock = clock

    async def list_situations(self, agent_id: str) -> tuple[Situation, ...]:
        agent = await self._agents.get(agent_id)
        if agent is None:
            raise NotFoundError("agent_not_found")
        return situations_for(agent.definition)

    @property
    def voice_available(self) -> bool:
        return self._executor is not None and self._executor.voice_enabled

    async def start_run(
        self,
        agent_id: str,
        situation_ids: list[str],
        repeats: int,
        mode: RunMode = RunMode.CHAT,
    ) -> Run:
        if self._executor is None:
            raise ServiceUnavailableError("llm_not_configured")
        if mode is RunMode.VOICE and not self._executor.voice_enabled:
            raise ServiceUnavailableError("speech_not_configured")
        agent = await self._agents.get(agent_id)
        if agent is None:
            raise NotFoundError("agent_not_found")
        run = plan_run(agent, situation_ids, repeats, self._max_conversations, self._clock(), mode)
        saved = await self._runs.insert(run)
        self._executor.start(saved, agent)
        return saved

    async def list_runs(self, agent_id: str) -> list[Run]:
        return await self._runs.list_for_agent(agent_id)

    async def get_run(self, run_id: str) -> Run:
        run = await self._runs.get(run_id)
        if run is None:
            raise NotFoundError("run_not_found")
        return run

    async def recording_path(self, run_id: str, conversation_id: str) -> Path:
        run = await self.get_run(run_id)
        conversation = next((c for c in run.conversations if c.id == conversation_id), None)
        if conversation is None or conversation.recording is None or self._recordings is None:
            raise NotFoundError("recording_not_found")
        path = self._recordings.path(run_id, conversation.id)
        if path is None:
            raise NotFoundError("recording_not_found")
        return path

    async def recover_interrupted(self) -> int:
        """At startup: runs left queued/running by a previous process will never finish."""
        stale = await self._runs.list_unfinished()
        for run in stale:
            await self._runs.replace(interrupt_run(run, self._clock()))
        return len(stale)
