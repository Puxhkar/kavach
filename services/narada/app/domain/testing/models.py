"""A test run: which candidate situations were played against an agent, and how each went.

Pure data — stdlib only.

One run holds many conversations (situation × repeat). Each conversation moves through:

    queued → running → passed | failed | error

`scenario` is the concrete fake candidate written for that conversation (name, facts, what
they will say). `truth` on each scenario answer is the ground truth the score is checked
against, in the format the agent must save it in.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum


class RunMode(StrEnum):
    CHAT = "chat"
    # Chat plus speech: every line is spoken, the candidate's audio is transcribed before
    # the agent sees it, and the call is kept as a recording.
    VOICE = "voice"


class RunStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    # The service stopped before the run finished.
    INTERRUPTED = "interrupted"


class ConversationStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    PASSED = "passed"
    FAILED = "failed"
    # The test itself broke (LLM error, timeout), so the agent was not judged.
    ERROR = "error"


FINISHED_CONVERSATION = frozenset(
    {ConversationStatus.PASSED, ConversationStatus.FAILED, ConversationStatus.ERROR}
)


class Speaker(StrEnum):
    AGENT = "agent"
    CANDIDATE = "candidate"


class EndReason(StrEnum):
    AGENT_ENDED = "agent_ended"
    CANDIDATE_HUNG_UP = "candidate_hung_up"
    TURN_LIMIT = "turn_limit"


class AnswerStatus(StrEnum):
    CORRECT = "correct"
    WRONG = "wrong"
    NOT_COLLECTED = "not_collected"
    DECLINED = "declined"


class CheckKind(StrEnum):
    RULE = "rule"
    ANSWER = "answer"
    SITUATION = "situation"
    ENDING = "ending"
    LANGUAGE = "language"


@dataclass(frozen=True)
class Situation:
    """A way the candidate behaves. `instructions` go to the fake candidate; `expectation`
    goes to the scorer and says what a good agent does about it."""

    id: str
    title: str
    description: str
    category: str
    instructions: str
    expectation: str
    language: str | None = None
    # Voice runs only: the candidate's audio goes through a noisy phone line before the
    # agent's speech recognition hears it.
    noisy_line: bool = False


@dataclass(frozen=True)
class Turn:
    speaker: Speaker
    text: str
    # The candidate said nothing for a while (sent to the agent as "(silence)").
    silent: bool = False
    # Voice mode, candidate turns: what speech recognition made of `text` — the only
    # version the agent received.
    heard: str | None = None
    # Voice mode: where this turn sits in the conversation's recording.
    start_ms: int | None = None
    end_ms: int | None = None


@dataclass(frozen=True)
class ScenarioAnswer:
    key: str
    # What the candidate says out loud, e.g. "around 80k a month plus some variable".
    spoken: str
    # The value the agent should end up with, in the answer's format, e.g. "11.6".
    truth: str


@dataclass(frozen=True)
class Scenario:
    candidate_name: str
    persona: str
    start_language: str
    call_inputs: dict[str, str]
    answers: tuple[ScenarioAnswer, ...]
    behavior: str
    expected_outcome: str
    # "male" / "female" — picks the candidate's voice in voice mode.
    gender: str = ""


@dataclass(frozen=True)
class AnswerResult:
    key: str
    expected: str
    agent_value: str
    status: AnswerStatus
    # Whether this status is right for the situation, e.g. "not_collected" is fine when the
    # candidate asked to be called back.
    acceptable: bool
    note: str = ""


@dataclass(frozen=True)
class Check:
    name: str
    kind: CheckKind
    passed: bool
    detail: str = ""


@dataclass(frozen=True)
class Recording:
    """The audio of a voice-mode conversation, stored next to the run (not in it)."""

    agent_voice: str
    candidate_voice: str
    duration_ms: int


@dataclass(frozen=True)
class Conversation:
    id: str
    situation_id: str
    situation_title: str
    category: str
    repeat: int
    language: str | None = None
    status: ConversationStatus = ConversationStatus.QUEUED
    scenario: Scenario | None = None
    transcript: tuple[Turn, ...] = ()
    end_reason: EndReason | None = None
    answers: tuple[AnswerResult, ...] = ()
    checks: tuple[Check, ...] = ()
    summary: str = ""
    error: str = ""
    recording: Recording | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None


@dataclass(frozen=True)
class RunCounts:
    total: int
    passed: int
    failed: int
    errored: int

    @property
    def pending(self) -> int:
        return self.total - self.passed - self.failed - self.errored


@dataclass(frozen=True)
class Run:
    agent_id: str
    agent_name: str
    prompt_version: int
    mode: RunMode
    status: RunStatus
    created_at: datetime
    conversations: tuple[Conversation, ...] = field(default_factory=tuple)
    id: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None

    @property
    def counts(self) -> RunCounts:
        statuses = [c.status for c in self.conversations]
        return RunCounts(
            total=len(statuses),
            passed=statuses.count(ConversationStatus.PASSED),
            failed=statuses.count(ConversationStatus.FAILED),
            errored=statuses.count(ConversationStatus.ERROR),
        )
