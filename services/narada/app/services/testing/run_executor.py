"""Runs a test run in the background: conversations in parallel, up to a limit.

Each conversation is written → simulated → scored, and saved after every step (and after
every turn), so the results page can follow it live. A failure in one conversation marks
only that conversation as `error`; the rest of the run carries on.

Voice runs also keep a recording per conversation. It is saved once the call ends — even
when scoring then fails, or the call broke halfway — so there is always something to
listen to.
"""

from __future__ import annotations

import asyncio
import zlib
from collections.abc import Callable
from dataclasses import replace
from datetime import datetime

from app.domain.agents.models import Agent, AgentDefinition
from app.domain.testing.models import (
    Conversation,
    ConversationStatus,
    Run,
    RunMode,
    RunStatus,
    Turn,
)
from app.domain.testing.rules import situation_by_id
from app.integrations.llm import LLMClient, LLMError
from app.integrations.speech import SpeechClient, SpeechError
from app.persistence.recordings import RecordingStore
from app.persistence.repositories import RunRepo
from app.services.testing.evaluator import evaluate
from app.services.testing.scenario_writer import write_scenario
from app.services.testing.simulator import simulate
from app.services.testing.voice_line import VoiceLine, candidate_voice, stt_language_codes
from app.shared.logger import get_logger

logger = get_logger("services.run_executor")


class RunExecutor:
    def __init__(
        self,
        llm: LLMClient,
        runs: RunRepo,
        *,
        concurrency: int,
        max_agent_turns: int,
        clock: Callable[[], datetime],
        speech: SpeechClient | None = None,
        recordings: RecordingStore | None = None,
        agent_voice: str = "Shivani",
    ) -> None:
        self._llm = llm
        self._runs = runs
        self._speech = speech
        self._recordings = recordings
        self._agent_voice = agent_voice
        self._concurrency = concurrency
        self._max_agent_turns = max_agent_turns
        self._clock = clock
        self._tasks: set[asyncio.Task[None]] = set()

    @property
    def voice_enabled(self) -> bool:
        return self._speech is not None and self._recordings is not None

    def start(self, run: Run, agent: Agent) -> None:
        if run.id is None or agent.definition is None:
            raise ValueError("start needs a saved run and a described agent")
        if run.mode is RunMode.VOICE and not self.voice_enabled:
            raise ValueError("voice runs need a speech client and a recording store")
        # The agent is captured now: editing the prompt mid-run must not change what the
        # rest of the run tests against.
        task = asyncio.create_task(
            self._execute(run.id, run.mode, run.conversations, agent.definition)
        )
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def wait_idle(self) -> None:
        """For tests: wait until every started run has finished."""
        while self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)

    async def shutdown(self) -> None:
        for task in self._tasks:
            task.cancel()
        await self.wait_idle()
        if self._speech is not None:
            await self._speech.aclose()

    async def _execute(
        self,
        run_id: str,
        mode: RunMode,
        conversations: tuple[Conversation, ...],
        definition: AgentDefinition,
    ) -> None:
        await self._runs.set_status(run_id, RunStatus.RUNNING, started_at=self._clock())
        gate = asyncio.Semaphore(self._concurrency)

        async def one(conversation: Conversation) -> None:
            async with gate:
                await self._run_conversation(run_id, mode, conversation, definition)

        await asyncio.gather(*(one(c) for c in conversations))
        await self._runs.set_status(run_id, RunStatus.COMPLETED, finished_at=self._clock())
        logger.info("run %s completed (%d conversations)", run_id, len(conversations))

    def _voice_line(
        self, conversation: Conversation, definition: AgentDefinition, noisy_line: bool
    ) -> VoiceLine:
        if self._speech is None or conversation.scenario is None:
            raise ValueError("a voice line needs speech and a written scenario")
        return VoiceLine(
            self._speech,
            agent_voice=self._agent_voice,
            candidate_voice=candidate_voice(
                conversation.scenario.gender, conversation.id, self._agent_voice
            ),
            language_codes=stt_language_codes(definition.languages),
            noisy_line_seed=zlib.crc32(conversation.id.encode()) if noisy_line else None,
        )

    async def _save_recording(
        self, run_id: str, conversation: Conversation, line: VoiceLine | None
    ) -> Conversation:
        if line is None or self._recordings is None or line.duration_ms == 0:
            return conversation
        await asyncio.to_thread(self._recordings.save, run_id, conversation.id, line.wav())
        return replace(conversation, recording=line.recording())

    async def _run_conversation(
        self, run_id: str, mode: RunMode, conversation: Conversation, definition: AgentDefinition
    ) -> None:
        current = replace(conversation, status=ConversationStatus.RUNNING, started_at=self._clock())
        await self._runs.save_conversation(run_id, current)
        line: VoiceLine | None = None
        try:
            situation = situation_by_id(definition, conversation.situation_id)
            scenario = await write_scenario(self._llm, definition, situation)
            current = replace(current, scenario=scenario)
            await self._runs.save_conversation(run_id, current)
            if mode is RunMode.VOICE:
                line = self._voice_line(current, definition, situation.noisy_line)

            async def on_turn(transcript: tuple[Turn, ...]) -> None:
                # Kept in `current`, so a call that breaks halfway keeps what was said.
                nonlocal current
                current = replace(current, transcript=transcript)
                await self._runs.save_conversation(run_id, current)

            transcript, end_reason = await simulate(
                self._llm, definition, scenario, situation, self._max_agent_turns, on_turn, line
            )
            current = replace(current, transcript=transcript, end_reason=end_reason)
            current = await self._save_recording(run_id, current, line)
            await self._runs.save_conversation(run_id, current)
            line = None  # saved; a scoring failure below must not save it again
            current = await evaluate(
                self._llm,
                current,
                definition,
                situation,
                scenario,
                transcript,
                end_reason,
                self._clock(),
            )
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            # LLM and speech error messages are written to be shown; anything else is a bug,
            # so the user sees a generic line and the details go to the log.
            shown = isinstance(exc, LLMError | SpeechError)
            message = str(exc) if shown else "Unexpected error in the test"
            logger.exception("conversation %s in run %s failed", conversation.id, run_id)
            try:
                current = await self._save_recording(run_id, current, line)
            except Exception:
                logger.exception("could not save the partial recording of %s", conversation.id)
            current = replace(
                current, status=ConversationStatus.ERROR, error=message, finished_at=self._clock()
            )
        await self._runs.save_conversation(run_id, current)
