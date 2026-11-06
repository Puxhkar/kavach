"""Call Guard: the assistant that answers calls, calls people on the owner's behalf, the AI
callers that try it out, browser calls with a real person on the line, and scam drills.

Languages: speech recognition listens for the owner's chosen languages (Gnani takes up to
four) and reports which one it heard. The assistant opens in the owner's opening language
and then follows the other person; on a call it makes, it first asks which language they
prefer.

One instance lives for the whole process (it owns the background tasks and the calls in
progress). Every call is saved after each turn, so the inbox can follow it live. When a
call ends it is saved as `triaging`, and the triage (or drill score) is written in the
background; a failure there marks only that call as `error`.
"""

from __future__ import annotations

import asyncio
import base64
import uuid
import zlib
from collections.abc import Callable, Coroutine
from dataclasses import dataclass, field, replace
from datetime import datetime
from pathlib import Path
from typing import Any, TypeVar

from app.domain.errors import DomainValidationError, FieldError
from app.domain.guard.languages import CODES as LISTEN_CODES
from app.domain.guard.languages import language_of_code, listen_codes, pick_language
from app.domain.guard.models import (
    CallCategory,
    CallerScenario,
    CallSource,
    CallStatus,
    Drill,
    DrillResult,
    Errand,
    ErrandOutcome,
    ErrandReport,
    GuardSpeaker,
    GuardTurn,
    LiveCall,
    Priority,
    Profile,
    RecipientBehaviour,
    ScreenedCall,
    Triage,
)
from app.domain.guard.rules import (
    SUPPORTED_GUARD_LANGUAGES,
    drill_checks,
    finalize_errand_report,
    finalize_triage,
    inbox_order,
    scam_signals,
    score_drill,
    silent_call_triage,
    validate_errand,
    validate_profile,
)
from app.domain.guard.scenarios import CALLERS, SCAMS, caller_by_id, scam_by_id
from app.integrations.llm import LLMClient, LLMError, Message
from app.integrations.speech import SpeechClient, SpeechError
from app.persistence.recordings import RecordingStore
from app.persistence.repositories.guard_repo import InMemoryGuardRepo
from app.services.guard import prompts
from app.services.testing.voice_line import VoiceLine, candidate_voice, stt_language_codes
from app.shared.exceptions import NotFoundError, ServiceUnavailableError
from app.shared.logger import get_logger

logger = get_logger("services.guard")

_Record = TypeVar("_Record", ScreenedCall, Drill, Errand)

# Recordings share the store with test runs; these hex "run ids" keep them apart.
CALLS_FOLDER = "ca11"
DRILLS_FOLDER = "d0"
ERRANDS_FOLDER = "e0"

_REPLY_TOKENS = 160
_MAX_AI_TURNS = 12
# Live calls nobody finishes are dropped after this many are open at once.
_MAX_OPEN_LIVE = 20


@dataclass(frozen=True)
class SpokenReply:
    text: str
    wav: bytes
    language: str

    @property
    def audio_base64(self) -> str:
        return base64.b64encode(self.wav).decode()


@dataclass
class _Live:
    call: LiveCall
    line: VoiceLine | None
    # The AI's instructions for the language it is speaking now.
    system_for: Callable[[str], str]
    # The language the AI speaks now.
    language: str
    listen: tuple[str, ...] = ()
    # Follow the language the other person speaks (not in drills: the scammer keeps one).
    follow: bool = False
    # An errand call has asked "which language?" and the next answer decides it.
    asking_language: bool = False
    history: list[Message] = field(default_factory=list)
    started_at: datetime | None = None


def _strip_end(text: str) -> tuple[str, bool]:
    if prompts.END_CALL in text:
        return text.replace(prompts.END_CALL, "").strip(), True
    return text.strip(), False


def _new_id() -> str:
    return uuid.uuid4().hex[:12]


class GuardService:
    def __init__(
        self,
        repo: InMemoryGuardRepo,
        llm: LLMClient | None,
        speech: SpeechClient | None,
        recordings: RecordingStore | None,
        clock: Callable[[], datetime],
        assistant_voice: str = "Shivani",
    ) -> None:
        self._repo = repo
        self._llm = llm
        self._speech = speech
        self._recordings = recordings
        self._clock = clock
        self._assistant_voice = assistant_voice
        self._live: dict[str, _Live] = {}
        self._tasks: set[asyncio.Task[None]] = set()

    # ── profile and catalog ──────────────────────────────────────────────────────────

    @property
    def voice_available(self) -> bool:
        return self._speech is not None and self._recordings is not None

    @property
    def languages(self) -> tuple[str, ...]:
        return SUPPORTED_GUARD_LANGUAGES

    @property
    def listen_options(self) -> tuple[str, ...]:
        return tuple(LISTEN_CODES)

    def scenarios(self) -> tuple[tuple[CallerScenario, ...], tuple[CallerScenario, ...]]:
        return CALLERS, SCAMS

    async def get_profile(self) -> Profile:
        return await self._repo.get_profile()

    async def save_profile(self, profile: Profile) -> Profile:
        return await self._repo.save_profile(validate_profile(profile))

    # ── inbox ────────────────────────────────────────────────────────────────────────

    async def list_calls(self) -> list[ScreenedCall]:
        return inbox_order(await self._repo.list_calls())

    async def get_call(self, call_id: str) -> ScreenedCall:
        call = await self._repo.get_call(call_id)
        if call is None:
            raise NotFoundError("call_not_found")
        return call

    async def call_recording(self, call_id: str) -> Path:
        call = await self.get_call(call_id)
        return self._recording_path(CALLS_FOLDER, call.id, call.has_recording)

    async def list_drills(self) -> list[Drill]:
        return await self._repo.list_drills()

    async def get_drill(self, drill_id: str) -> Drill:
        drill = await self._repo.get_drill(drill_id)
        if drill is None:
            raise NotFoundError("drill_not_found")
        return drill

    async def drill_recording(self, drill_id: str) -> Path:
        drill = await self.get_drill(drill_id)
        return self._recording_path(DRILLS_FOLDER, drill.id, drill.has_recording)

    def _recording_path(self, folder: str, record_id: str, has_recording: bool) -> Path:
        path = (
            self._recordings.path(folder, record_id)
            if has_recording and self._recordings is not None
            else None
        )
        if path is None:
            raise NotFoundError("recording_not_found")
        return path

    # ── simulated calls: an AI caller rings the assistant ───────────────────────────

    async def simulate(self, scenario_id: str) -> ScreenedCall:
        llm = self._require_llm()
        try:
            scenario = caller_by_id(scenario_id)
        except KeyError:
            raise NotFoundError("scenario_not_found") from None
        profile = await self._repo.get_profile()
        call = ScreenedCall(
            id=_new_id(),
            source=CallSource.SIMULATED,
            status=CallStatus.RUNNING,
            created_at=self._clock(),
            language=profile.language,
            scenario_id=scenario.id,
            scenario_title=scenario.title,
        )
        await self._repo.save_call(call)
        self._spawn(self._run_simulation(llm, call, scenario, profile))
        return call

    async def _run_simulation(
        self, llm: LLMClient, call: ScreenedCall, scenario: CallerScenario, profile: Profile
    ) -> None:
        listen = profile.listen_languages
        line = self._voice_line(call.id, listen_codes(listen), scenario.noisy_line)
        # The caller speaks their own language; the assistant has to notice and follow.
        caller_language = scenario.language if scenario.language in listen else profile.language
        language = profile.language
        caller_system = prompts.caller_system(scenario, profile, caller_language)
        assistant_history: list[Message] = [{"role": "user", "content": prompts.CALL_CONNECTED}]
        caller_history: list[Message] = []
        turns: list[GuardTurn] = []
        try:
            for _ in range(_MAX_AI_TURNS):
                said, ended = _strip_end(
                    await llm.reply(
                        prompts.assistant_system(profile, language),
                        assistant_history,
                        _REPLY_TOKENS,
                    )
                )
                turns.append(await self._ai_turn(line, said, language))
                assistant_history.append({"role": "assistant", "content": said})
                caller_history.append({"role": "user", "content": said})
                call = replace(call, transcript=tuple(turns))
                await self._repo.save_call(call)
                if ended:
                    break
                said, ended = _strip_end(
                    await llm.reply(caller_system, caller_history, _REPLY_TOKENS)
                )
                turn = await self._person_turn_from_text(line, said)
                turns.append(turn)
                if line is not None:
                    language = pick_language(
                        turn.heard or "", line.last_language_code, listen, language
                    )
                caller_history.append({"role": "assistant", "content": said})
                assistant_history.append(
                    {"role": "user", "content": prompts.reply_in(turn.heard or said, language)}
                )
                call = replace(call, transcript=tuple(turns))
                await self._repo.save_call(call)
                if ended:
                    break
            call = await self._close_call(call, line)
            await self._triage(llm, call, profile)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            await self._fail_call(call, exc, line)

    # ── errands: the assistant calls someone on the owner's behalf ───────────────────

    async def create_errand(
        self, recipient_name: str, recipient_role: str, task: str, deadline: str
    ) -> Errand:
        validate_errand(recipient_name, recipient_role, task, deadline)
        errand = Errand(
            id=_new_id(),
            recipient_name=recipient_name.strip(),
            recipient_role=recipient_role.strip(),
            task=task.strip(),
            deadline=deadline.strip(),
            status=CallStatus.PENDING,
            created_at=self._clock(),
        )
        await self._repo.save_errand(errand)
        return errand

    async def list_errands(self) -> list[Errand]:
        return await self._repo.list_errands()

    async def get_errand(self, errand_id: str) -> Errand:
        errand = await self._repo.get_errand(errand_id)
        if errand is None:
            raise NotFoundError("errand_not_found")
        return errand

    async def errand_recording(self, errand_id: str) -> Path:
        errand = await self.get_errand(errand_id)
        return self._recording_path(ERRANDS_FOLDER, errand.id, errand.has_recording)

    @staticmethod
    def _ensure_errand_idle(errand: Errand) -> None:
        if errand.status in (CallStatus.RUNNING, CallStatus.TRIAGING):
            raise DomainValidationError(
                [FieldError("errandId", "This call is already in progress")]
            )

    async def simulate_errand(
        self, errand_id: str, language: str, behaviour: RecipientBehaviour
    ) -> Errand:
        """An AI plays the recipient, who prefers `language`, to try the call out."""
        llm = self._require_llm()
        errand = await self.get_errand(errand_id)
        self._ensure_errand_idle(errand)
        profile = await self._repo.get_profile()
        if language not in profile.listen_languages:
            raise DomainValidationError(
                [FieldError("language", "Pick one of the languages the assistant listens for")]
            )
        errand = replace(
            errand,
            status=CallStatus.RUNNING,
            source=CallSource.SIMULATED,
            transcript=(),
            report=None,
            language=None,
            error="",
        )
        await self._repo.save_errand(errand)
        self._spawn(self._run_errand_simulation(llm, errand, profile, language, behaviour))
        return errand

    async def _run_errand_simulation(
        self,
        llm: LLMClient,
        errand: Errand,
        profile: Profile,
        recipient_language: str,
        behaviour: RecipientBehaviour,
    ) -> None:
        listen = profile.listen_languages
        line = self._voice_line(errand.id, listen_codes(listen))
        recipient_system = prompts.recipient_system(
            profile, errand, recipient_language, behaviour.value
        )
        language = profile.language
        assistant_history: list[Message] = [{"role": "user", "content": prompts.CALL_CONNECTED}]
        recipient_history: list[Message] = []
        turns: list[GuardTurn] = []
        asking = True
        said, ended_by_assistant = prompts.errand_opener(profile, errand.recipient_name), False
        try:
            for _ in range(_MAX_AI_TURNS):
                turns.append(await self._ai_turn(line, said, language))
                assistant_history.append({"role": "assistant", "content": said})
                recipient_history.append({"role": "user", "content": said})
                errand = replace(errand, transcript=tuple(turns), language=language)
                await self._repo.save_errand(errand)
                if ended_by_assistant:
                    break
                reply, recipient_ended = _strip_end(
                    await llm.reply(recipient_system, recipient_history, _REPLY_TOKENS)
                )
                turn = await self._person_turn_from_text(line, reply)
                turns.append(turn)
                heard = turn.heard if turn.heard is not None else reply
                language = pick_language(
                    heard,
                    line.last_language_code if line else None,
                    listen,
                    language,
                    allow_named=asking,
                )
                asking = asking and not heard
                recipient_history.append({"role": "assistant", "content": reply})
                assistant_history.append(
                    {"role": "user", "content": prompts.reply_in(heard, language)}
                )
                errand = replace(errand, transcript=tuple(turns), language=language)
                await self._repo.save_errand(errand)
                if recipient_ended:
                    break
                said, ended_by_assistant = _strip_end(
                    await llm.reply(
                        prompts.errand_system(profile, errand, language),
                        assistant_history,
                        _REPLY_TOKENS,
                    )
                )
            await self._finish_errand(llm, errand, profile, line)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            await self._fail_errand(errand, exc, line)

    async def _finish_errand(
        self, llm: LLMClient, errand: Errand, profile: Profile, line: VoiceLine | None
    ) -> None:
        try:
            errand = await self._save_recording(ERRANDS_FOLDER, errand, line)
            errand = replace(errand, status=CallStatus.TRIAGING)
            await self._repo.save_errand(errand)
            if not any(t.speaker is GuardSpeaker.PERSON and t.text for t in errand.transcript):
                report = ErrandReport(
                    ErrandOutcome.NOT_REACHED,
                    "",
                    (),
                    f"{errand.recipient_name} didn't say anything on the call.",
                    f"Try {errand.recipient_name} again later.",
                )
            else:
                lines = [
                    (
                        "Assistant" if t.speaker is GuardSpeaker.AI else errand.recipient_name,
                        t.heard or t.text,
                    )
                    for t in errand.transcript
                ]
                data = await llm.reply_json(
                    prompts.errand_report_system(profile, errand),
                    [{"role": "user", "content": prompts.transcript_text(lines)}],
                    "errand_report",
                    prompts.ERRAND_REPORT_SCHEMA,
                    600,
                )
                report = finalize_errand_report(
                    ErrandReport(
                        outcome=ErrandOutcome(data["outcome"]),
                        commitment=str(data["commitment"]).strip(),
                        concerns=tuple(str(c).strip() for c in data["concerns"] if str(c).strip()),
                        summary=str(data["summary"]).strip(),
                        next_step=str(data["nextStep"]).strip(),
                    )
                )
            await self._repo.save_errand(replace(errand, report=report, status=CallStatus.DONE))
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            await self._fail_errand(errand, exc, None)

    async def _fail_errand(self, errand: Errand, exc: Exception, line: VoiceLine | None) -> None:
        logger.exception("errand %s failed", errand.id)
        try:
            errand = await self._save_recording(ERRANDS_FOLDER, errand, line)
        except Exception:
            logger.exception("could not save the partial recording of %s", errand.id)
        await self._repo.save_errand(
            replace(errand, status=CallStatus.ERROR, error=_shown_error(exc))
        )

    # ── live calls: a person on the browser microphone ───────────────────────────────

    async def start_live(
        self,
        kind: str,
        scam_id: str | None,
        language: str | None,
        practicer: str,
        errand_id: str | None = None,
    ) -> tuple[LiveCall, SpokenReply, bool]:
        llm = self._require_llm()
        if not self.voice_available:
            raise ServiceUnavailableError("speech_not_configured")
        profile = await self._repo.get_profile()
        practicer = practicer.strip()[:60] or "You"
        call_id = _new_id()
        if kind == "drill":
            try:
                scam = scam_by_id(scam_id or "")
            except KeyError:
                raise NotFoundError("scenario_not_found") from None
            language = language if language in SUPPORTED_GUARD_LANGUAGES else "Hinglish"
            live = _Live(
                call=LiveCall(call_id, kind, language, scam, practicer),
                line=self._voice_line(call_id, stt_language_codes((language,)), ai_voice="caller"),
                system_for=lambda lang: prompts.scammer_system(scam, practicer, lang),
                language=language,
            )
        elif kind == "errand":
            errand = await self.get_errand(errand_id or "")
            self._ensure_errand_idle(errand)
            listen = profile.listen_languages
            live = _Live(
                call=LiveCall(call_id, kind, profile.language, None, "", errand_id=errand.id),
                line=self._voice_line(call_id, listen_codes(listen)),
                system_for=lambda lang: prompts.errand_system(profile, errand, lang),
                language=profile.language,
                listen=listen,
                follow=True,
                asking_language=True,
            )
            await self._repo.save_errand(
                replace(
                    errand,
                    status=CallStatus.RUNNING,
                    source=CallSource.LIVE,
                    transcript=(),
                    report=None,
                    error="",
                )
            )
        else:
            listen = profile.listen_languages
            live = _Live(
                call=LiveCall(call_id, kind, profile.language, None, practicer),
                line=self._voice_line(call_id, listen_codes(listen)),
                system_for=lambda lang: prompts.assistant_system(profile, lang),
                language=profile.language,
                listen=listen,
                follow=True,
            )
        live.started_at = self._clock()
        live.history.append({"role": "user", "content": prompts.CALL_CONNECTED})
        if len(self._live) >= _MAX_OPEN_LIVE:
            self._live.pop(next(iter(self._live)))
        self._live[call_id] = live
        if kind == "errand":
            reply = await self._ai_says(live, prompts.errand_opener(profile, errand.recipient_name))
            return live.call, reply, False
        reply, ended = await self._ai_speaks(llm, live)
        return live.call, reply, ended

    async def live_turn(
        self, live_id: str, pcm: bytes
    ) -> tuple[str, str | None, SpokenReply | None, bool]:
        """What was heard, the language detected in it, the AI's reply, and whether the
        call is over."""
        llm = self._require_llm()
        live = self._open_live(live_id)
        if live.call.ended:
            return "", None, None, True
        assert live.line is not None
        heard, start, end = await live.line.candidate_audio(pcm)
        heard = heard.strip()
        detected = language_of_code(live.line.last_language_code) if heard else None
        live.call.turns.append(
            GuardTurn(
                GuardSpeaker.PERSON,
                heard,
                heard=heard,
                start_ms=start,
                end_ms=end,
                language=detected,
            )
        )
        if live.follow:
            live.language = pick_language(
                heard,
                live.line.last_language_code,
                live.listen,
                live.language,
                allow_named=live.asking_language,
            )
            if heard:
                live.asking_language = False
        content = prompts.reply_in(heard, live.language) if live.follow else heard
        live.history.append({"role": "user", "content": content or prompts.SILENCE})
        reply, ended = await self._ai_speaks(llm, live)
        return heard, detected, reply, ended

    async def end_live(self, live_id: str, hung_up: bool) -> tuple[str, str]:
        llm = self._require_llm()
        live = self._live.pop(live_id, None)
        if live is None:
            raise NotFoundError("live_not_found")
        live.call.ended = True
        profile = await self._repo.get_profile()
        created = live.started_at or self._clock()
        turns = tuple(live.call.turns)
        if live.call.kind == "errand" and live.call.errand_id is not None:
            errand = await self.get_errand(live.call.errand_id)
            errand = replace(errand, transcript=turns, language=live.language)
            self._spawn(self._finish_errand(llm, errand, profile, live.line))
            return "errand", errand.id
        if live.call.kind == "drill" and live.call.scenario is not None:
            drill = Drill(
                id=live.call.id,
                scam_id=live.call.scenario.id,
                scam_title=live.call.scenario.title,
                practicer_name=live.call.practicer_name,
                language=live.call.language,
                status=CallStatus.TRIAGING,
                created_at=created,
                transcript=turns,
                hung_up=hung_up,
            )
            drill = await self._save_recording(DRILLS_FOLDER, drill, live.line)
            await self._repo.save_drill(drill)
            self._spawn(self._score_drill(llm, drill, live.call.scenario))
            return "drill", drill.id
        call = ScreenedCall(
            id=live.call.id,
            source=CallSource.LIVE,
            status=CallStatus.RUNNING,
            created_at=created,
            language=live.call.language,
            transcript=turns,
        )
        call = await self._close_call(call, live.line)
        self._spawn(self._triage(llm, call, profile))
        return "screener", call.id

    def _open_live(self, live_id: str) -> _Live:
        live = self._live.get(live_id)
        if live is None:
            raise NotFoundError("live_not_found")
        return live

    async def _ai_speaks(self, llm: LLMClient, live: _Live) -> tuple[SpokenReply, bool]:
        raw = await llm.reply(live.system_for(live.language), live.history, _REPLY_TOKENS)
        said, ended = _strip_end(raw)
        reply = await self._ai_says(live, said)
        live.call.ended = ended
        return reply, ended

    async def _ai_says(self, live: _Live, said: str) -> SpokenReply:
        assert live.line is not None
        turn = await self._ai_turn(live.line, said, live.language)
        live.call.turns.append(turn)
        live.history.append({"role": "assistant", "content": said})
        wav = live.line.clip_wav(turn.start_ms or 0, turn.end_ms or 0)
        return SpokenReply(said, wav, live.language)

    # ── shared pieces ────────────────────────────────────────────────────────────────

    def _voice_line(
        self,
        record_id: str,
        codes: str,
        noisy: bool = False,
        ai_voice: str = "assistant",
        other_gender: str | None = None,
    ) -> VoiceLine | None:
        """`codes` are the languages speech recognition listens for (at most four)."""
        if self._speech is None:
            return None
        gender = other_gender or ("female" if zlib.crc32(record_id.encode()) % 2 else "male")
        # In a drill the AI is the scammer: give it a caller's voice, not the assistant's.
        voice = (
            candidate_voice("male", record_id, self._assistant_voice)
            if ai_voice == "caller"
            else self._assistant_voice
        )
        return VoiceLine(
            self._speech,
            agent_voice=voice,
            candidate_voice=candidate_voice(gender, record_id, voice),
            language_codes=codes,
            noisy_line_seed=zlib.crc32(record_id.encode()) if noisy else None,
        )

    async def _ai_turn(self, line: VoiceLine | None, said: str, language: str) -> GuardTurn:
        if line is None:
            return GuardTurn(GuardSpeaker.AI, said, language=language)
        start, end = await line.agent_says(said)
        return GuardTurn(GuardSpeaker.AI, said, start_ms=start, end_ms=end, language=language)

    async def _person_turn_from_text(self, line: VoiceLine | None, said: str) -> GuardTurn:
        if line is None:
            return GuardTurn(GuardSpeaker.PERSON, said)
        if not said:
            start, end = line.candidate_silent()
            return GuardTurn(GuardSpeaker.PERSON, "", heard="", start_ms=start, end_ms=end)
        heard, start, end = await line.candidate_says(said)
        return GuardTurn(
            GuardSpeaker.PERSON,
            said,
            heard=heard,
            start_ms=start,
            end_ms=end,
            language=language_of_code(line.last_language_code),
        )

    async def _save_recording(
        self, folder: str, record: _Record, line: VoiceLine | None
    ) -> _Record:
        if line is None or self._recordings is None or line.duration_ms == 0:
            return record
        await asyncio.to_thread(self._recordings.save, folder, record.id, line.wav())
        return replace(record, has_recording=True, duration_ms=line.duration_ms)

    async def _close_call(self, call: ScreenedCall, line: VoiceLine | None) -> ScreenedCall:
        call = await self._save_recording(CALLS_FOLDER, call, line)
        call = replace(call, status=CallStatus.TRIAGING)
        await self._repo.save_call(call)
        return call

    async def _triage(self, llm: LLMClient, call: ScreenedCall, profile: Profile) -> None:
        try:
            if not any(t.speaker is GuardSpeaker.PERSON and t.text for t in call.transcript):
                triage = silent_call_triage(f"Told {profile.availability}")
                await self._repo.save_call(replace(call, triage=triage, status=CallStatus.DONE))
                return
            lines = [
                ("Assistant" if t.speaker is GuardSpeaker.AI else "Caller", t.heard or t.text)
                for t in call.transcript
            ]
            data = await llm.reply_json(
                prompts.triage_system(profile),
                [{"role": "user", "content": prompts.transcript_text(lines) or "(no words)"}],
                "call_triage",
                prompts.TRIAGE_SCHEMA,
                700,
            )
            triage = finalize_triage(
                Triage(
                    caller_name=str(data["callerName"]),
                    organisation=str(data["organisation"]),
                    purpose=str(data["purpose"]),
                    category=CallCategory(data["category"]),
                    priority=Priority(data["priority"]),
                    scam_risk=int(data["scamRisk"]),
                    red_flags=tuple(str(f) for f in data["redFlags"]),
                    callback=str(data["callback"]),
                    summary=str(data["summary"]),
                    action=str(data["action"]),
                ),
                profile,
                scam_signals(
                    " ".join(
                        t.heard or t.text
                        for t in call.transcript
                        if t.speaker is GuardSpeaker.PERSON
                    )
                ),
            )
            await self._repo.save_call(replace(call, triage=triage, status=CallStatus.DONE))
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            await self._fail_call(call, exc, None)

    async def _score_drill(self, llm: LLMClient, drill: Drill, scam: CallerScenario) -> None:
        try:
            lines = [
                ("Scammer" if t.speaker is GuardSpeaker.AI else drill.practicer_name, t.text)
                for t in drill.transcript
            ]
            data = await llm.reply_json(
                prompts.drill_system(scam, drill.practicer_name, drill.language, drill.hung_up),
                [{"role": "user", "content": prompts.transcript_text(lines) or "(no words)"}],
                "drill_score",
                prompts.DRILL_SCHEMA,
                900,
            )
            judged = {str(c["id"]): (bool(c["passed"]), str(c["detail"])) for c in data["checks"]}
            checks = drill_checks(judged, drill.hung_up)
            score, verdict = score_drill(checks)
            result = DrillResult(
                score=score,
                verdict=verdict,
                checks=checks,
                tips=tuple(str(t) for t in data["tips"] if str(t).strip())[:3],
                family_message=str(data["familyMessage"]).strip(),
            )
            await self._repo.save_drill(replace(drill, result=result, status=CallStatus.DONE))
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.exception("scoring drill %s failed", drill.id)
            await self._repo.save_drill(
                replace(drill, status=CallStatus.ERROR, error=_shown_error(exc))
            )

    async def _fail_call(self, call: ScreenedCall, exc: Exception, line: VoiceLine | None) -> None:
        logger.exception("call %s failed", call.id)
        try:
            call = await self._save_recording(CALLS_FOLDER, call, line)
        except Exception:
            logger.exception("could not save the partial recording of %s", call.id)
        await self._repo.save_call(replace(call, status=CallStatus.ERROR, error=_shown_error(exc)))

    def _require_llm(self) -> LLMClient:
        if self._llm is None:
            raise ServiceUnavailableError("llm_not_configured")
        return self._llm

    def _spawn(self, coro: Coroutine[Any, Any, None]) -> None:
        task = asyncio.create_task(coro)
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def wait_idle(self) -> None:
        """For tests: wait until every background call and score has finished."""
        while self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)

    async def shutdown(self) -> None:
        for task in self._tasks:
            task.cancel()
        await self.wait_idle()


def _shown_error(exc: Exception) -> str:
    # LLM and speech messages are written to be shown; anything else is a bug.
    return str(exc) if isinstance(exc, LLMError | SpeechError) else "Unexpected error in the call"
