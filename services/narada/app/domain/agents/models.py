"""The agent under test: which vendor agent we call, and what it is supposed to do.

Pure data — stdlib only. Setup is two steps in the product:

1. Connect   → `Agent.name`, `vendor`, `assistant_id`
2. Describe  → `Agent.definition`

`call_inputs` and `answers` are deliberately separate lists. Inputs flow INTO the call
(values we fill per test, e.g. the candidate's name); answers flow OUT of it (what the
agent must get from the candidate and save, e.g. current CTC). Mixing the two was the
main source of confusion in the first prototype.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum


class Vendor(StrEnum):
    """Voice-agent platforms an agent under test can run on."""

    PLIVO = "plivo"
    VAPI = "vapi"
    # Not connected to a vendor: tests run against the pasted prompt only.
    NONE = "none"


class AnswerFormat(StrEnum):
    """How a collected answer must be saved. Evaluation compares through this format, so
    "1 lakh per month" and "12" can both be checked against a ground truth of 12 LPA."""

    TEXT = "text"
    NUMBER = "number"
    AMOUNT_LPA = "amount_lpa"
    DURATION_DAYS = "duration_days"
    DATE = "date"
    YES_NO = "yes_no"
    CHOICE = "choice"


class RuleKind(StrEnum):
    MUST = "must"
    MUST_NOT = "must_not"


class LanguageSwitch(StrEnum):
    """What the agent should do when the candidate changes language mid-call."""

    FOLLOW = "follow"
    ASK = "ask"
    STAY = "stay"


SUPPORTED_LANGUAGES: tuple[str, ...] = (
    "English",
    "Hindi",
    "Hinglish",
    "Telugu",
    "Tamil",
    "Kannada",
    "Malayalam",
    "Marathi",
    "Bengali",
    "Gujarati",
)


@dataclass(frozen=True)
class CallInput:
    """A value sent into the call for each test, e.g. `name` or `job_role`."""

    key: str
    label: str
    example: str = ""
    required: bool = True


@dataclass(frozen=True)
class AnswerField:
    """Something the agent must collect from the candidate and save."""

    key: str
    question: str
    format: AnswerFormat
    required: bool = True
    choices: tuple[str, ...] = ()
    hint: str = ""


@dataclass(frozen=True)
class Rule:
    text: str
    kind: RuleKind


@dataclass(frozen=True)
class AgentDefinition:
    prompt: str
    call_inputs: tuple[CallInput, ...]
    answers: tuple[AnswerField, ...]
    rules: tuple[Rule, ...]
    languages: tuple[str, ...]
    language_switch: LanguageSwitch
    call_ending: str


@dataclass(frozen=True)
class PromptVersion:
    """A prompt as it was when a version was cut. Kept so two versions can be compared
    and every test run can say exactly which prompt it ran against."""

    version: int
    fingerprint: str
    prompt: str
    created_at: datetime


@dataclass(frozen=True)
class Agent:
    name: str
    vendor: Vendor
    assistant_id: str
    created_at: datetime
    updated_at: datetime
    id: str | None = None
    definition: AgentDefinition | None = None
    prompt_versions: tuple[PromptVersion, ...] = field(default_factory=tuple)

    @property
    def current_prompt_version(self) -> PromptVersion | None:
        return self.prompt_versions[-1] if self.prompt_versions else None
