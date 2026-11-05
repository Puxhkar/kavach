"""Call Guard: a personal call assistant that answers when the owner is busy, finds out who
is calling and why, spots scams, and ranks the calls; calls people on the owner's behalf in
the language they prefer; plus scam drills, where an AI scammer calls someone so they can
practise saying no.

Plain dataclasses, no I/O.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum


class CallCategory(StrEnum):
    SCAM = "scam"
    FAMILY = "family"
    WORK = "work"
    BANK = "bank"
    DELIVERY = "delivery"
    SALES = "sales"
    PERSONAL = "personal"
    OTHER = "other"


class Priority(StrEnum):
    """Inbox order, most important first. Scams are blocked, never just "low"."""

    URGENT = "urgent"
    HIGH = "high"
    NORMAL = "normal"
    LOW = "low"
    BLOCKED = "blocked"


PRIORITY_ORDER = tuple(Priority)


class CallSource(StrEnum):
    # An AI caller played the other side (to try the assistant, or for a demo).
    SIMULATED = "simulated"
    # A person spoke through the browser microphone.
    LIVE = "live"


class CallStatus(StrEnum):
    # An errand written down but not called yet.
    PENDING = "pending"
    RUNNING = "running"
    # The call ended; the assistant is writing the triage.
    TRIAGING = "triaging"
    DONE = "done"
    ERROR = "error"


class GuardSpeaker(StrEnum):
    # The AI side: the owner's assistant on a screened call, the scammer in a drill.
    AI = "ai"
    # The other side: the caller on a screened call, the person practising in a drill.
    PERSON = "person"


class DrillVerdict(StrEnum):
    SAFE = "safe"
    AT_RISK = "at_risk"
    SCAMMED = "scammed"


@dataclass(frozen=True)
class VipContact:
    name: str
    relation: str


@dataclass(frozen=True)
class Profile:
    """Whose phone the assistant answers, and what it may tell callers."""

    owner_name: str
    # Spoken to callers as-is, e.g. "after 6 PM today".
    availability: str
    # The language the assistant opens a call in, before it knows the other person's.
    language: str
    vip_contacts: tuple[VipContact, ...] = ()
    # Anything else the assistant should know, e.g. "expecting a call from the landlord".
    notes: str = ""
    # Languages people may speak to the assistant (speech recognition listens for these,
    # at most four); it follows whichever one it hears.
    listen_languages: tuple[str, ...] = ("English", "Hindi", "Kannada", "Tamil")


@dataclass(frozen=True)
class CallerScenario:
    """Someone who might call. `brief` goes to the AI caller (or, in a drill, the AI
    scammer); `expected` is what a correct triage looks like, for the demo and tests."""

    id: str
    title: str
    description: str
    brief: str
    expected: CallCategory
    scam: bool = False
    # The caller is on a bad line (street, two-wheeler): their audio is degraded.
    noisy_line: bool = False
    # The language the AI caller speaks; the assistant has to notice and follow it.
    language: str = "English"


@dataclass(frozen=True)
class GuardTurn:
    speaker: GuardSpeaker
    text: str
    # PERSON turns: what speech recognition heard (the only version the AI received).
    heard: str | None = None
    start_ms: int | None = None
    end_ms: int | None = None
    # AI turns: the language it spoke. PERSON turns: the language speech recognition
    # detected, if it said.
    language: str | None = None


@dataclass(frozen=True)
class Triage:
    caller_name: str
    organisation: str
    purpose: str
    category: CallCategory
    priority: Priority
    # 0 (clearly genuine) to 100 (clearly a scam).
    scam_risk: int
    red_flags: tuple[str, ...]
    # What the assistant told the caller about a call back, in the caller's words.
    callback: str
    summary: str
    # One line for the owner: what to do about this call.
    action: str
    vip: bool = False


@dataclass(frozen=True)
class ScreenedCall:
    id: str
    source: CallSource
    status: CallStatus
    created_at: datetime
    language: str
    scenario_id: str | None = None
    scenario_title: str = ""
    transcript: tuple[GuardTurn, ...] = ()
    triage: Triage | None = None
    duration_ms: int = 0
    has_recording: bool = False
    error: str = ""


@dataclass(frozen=True)
class DrillCheck:
    name: str
    passed: bool
    detail: str
    # Failing a critical check means the scam worked (OTP, money, remote access).
    critical: bool = False


@dataclass(frozen=True)
class DrillResult:
    score: int
    verdict: DrillVerdict
    checks: tuple[DrillCheck, ...]
    tips: tuple[str, ...]
    # Ready to paste into the family WhatsApp group.
    family_message: str


@dataclass(frozen=True)
class Drill:
    id: str
    scam_id: str
    scam_title: str
    practicer_name: str
    language: str
    status: CallStatus
    created_at: datetime
    transcript: tuple[GuardTurn, ...] = ()
    result: DrillResult | None = None
    duration_ms: int = 0
    has_recording: bool = False
    # The person hung up themselves (a good sign), rather than the scammer giving up.
    hung_up: bool = False
    error: str = ""


class ErrandOutcome(StrEnum):
    AGREED = "agreed"
    # They answered but something is open: more time, a question, a condition.
    NEEDS_FOLLOW_UP = "needs_follow_up"
    DECLINED = "declined"
    NOT_REACHED = "not_reached"


class RecipientBehaviour(StrEnum):
    """How a simulated recipient reacts, to try the assistant on the cases that matter."""

    AGREES = "agrees"
    NEEDS_TIME = "needs_time"
    ASKS_QUESTION = "asks_question"


@dataclass(frozen=True)
class ErrandReport:
    outcome: ErrandOutcome
    # What they committed to, in their words, e.g. "will send it by 5 PM".
    commitment: str
    concerns: tuple[str, ...]
    summary: str
    next_step: str


@dataclass(frozen=True)
class Errand:
    """A call the assistant makes on the owner's behalf: tell someone something, get their
    answer, report back."""

    id: str
    recipient_name: str
    # Who they are to the owner, e.g. "team member", "landlord".
    recipient_role: str
    task: str
    deadline: str
    status: CallStatus
    created_at: datetime
    source: CallSource | None = None
    # The language the call settled on after asking.
    language: str | None = None
    transcript: tuple[GuardTurn, ...] = ()
    report: ErrandReport | None = None
    duration_ms: int = 0
    has_recording: bool = False
    error: str = ""


@dataclass
class LiveCall:
    """A browser call in progress. Kept in memory only; it becomes a ScreenedCall, a Drill
    or an Errand's call when it ends."""

    id: str
    kind: str  # "screener" | "drill" | "errand"
    language: str
    scenario: CallerScenario | None
    practicer_name: str
    turns: list[GuardTurn] = field(default_factory=list)
    ended: bool = False
    errand_id: str | None = None
