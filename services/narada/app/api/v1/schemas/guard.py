"""Request/response shapes for Call Guard. camelCase on the wire."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.domain.guard.models import (
    CallCategory,
    CallerScenario,
    CallSource,
    CallStatus,
    Drill,
    DrillVerdict,
    Errand,
    ErrandOutcome,
    GuardSpeaker,
    GuardTurn,
    Priority,
    Profile,
    RecipientBehaviour,
    ScreenedCall,
    Triage,
    VipContact,
)


class VipContactBody(BaseModel):
    name: str = Field(..., max_length=60)
    relation: str = Field("", max_length=60)


class ProfileBody(BaseModel):
    ownerName: str = Field(..., max_length=100)
    availability: str = Field(..., max_length=300)
    language: str = Field(..., max_length=30)
    vipContacts: list[VipContactBody] = Field(default_factory=list, max_length=50)
    notes: str = Field("", max_length=2000)
    # Languages people may speak to the assistant (up to four); `language` is the one it
    # opens calls in and must be among them.
    listenLanguages: list[str] = Field(..., max_length=10)

    def to_domain(self) -> Profile:
        return Profile(
            owner_name=self.ownerName,
            availability=self.availability,
            language=self.language,
            vip_contacts=tuple(VipContact(v.name, v.relation) for v in self.vipContacts),
            notes=self.notes,
            listen_languages=tuple(self.listenLanguages),
        )


class ProfileResponse(ProfileBody):
    # Choices for a scam drill's language (includes Hinglish).
    languages: list[str]
    # Choices for listenLanguages, each one a language speech recognition can detect.
    listenOptions: list[str]

    @classmethod
    def from_domain(
        cls, p: Profile, languages: tuple[str, ...], listen_options: tuple[str, ...]
    ) -> ProfileResponse:
        return cls(
            ownerName=p.owner_name,
            availability=p.availability,
            language=p.language,
            vipContacts=[VipContactBody(name=v.name, relation=v.relation) for v in p.vip_contacts],
            notes=p.notes,
            listenLanguages=list(p.listen_languages),
            languages=list(languages),
            listenOptions=list(listen_options),
        )


class CallerScenarioResponse(BaseModel):
    id: str
    title: str
    description: str
    expected: CallCategory
    scam: bool
    noisyLine: bool
    # The language this AI caller speaks.
    language: str

    @classmethod
    def from_domain(cls, s: CallerScenario) -> CallerScenarioResponse:
        return cls(
            id=s.id,
            title=s.title,
            description=s.description,
            expected=s.expected,
            scam=s.scam,
            noisyLine=s.noisy_line,
            language=s.language,
        )


class ScenarioListResponse(BaseModel):
    callers: list[CallerScenarioResponse]
    scams: list[CallerScenarioResponse]
    voiceAvailable: bool


class GuardTurnResponse(BaseModel):
    speaker: GuardSpeaker
    text: str
    heard: str | None
    startMs: int | None
    endMs: int | None
    # AI lines: the language spoken. Person lines: the language speech recognition detected.
    language: str | None

    @classmethod
    def from_domain(cls, t: GuardTurn) -> GuardTurnResponse:
        return cls(
            speaker=t.speaker,
            text=t.text,
            heard=t.heard,
            startMs=t.start_ms,
            endMs=t.end_ms,
            language=t.language,
        )


class TriageResponse(BaseModel):
    callerName: str
    organisation: str
    purpose: str
    category: CallCategory
    priority: Priority
    scamRisk: int
    redFlags: list[str]
    callback: str
    summary: str
    action: str
    vip: bool

    @classmethod
    def from_domain(cls, t: Triage) -> TriageResponse:
        return cls(
            callerName=t.caller_name,
            organisation=t.organisation,
            purpose=t.purpose,
            category=t.category,
            priority=t.priority,
            scamRisk=t.scam_risk,
            redFlags=list(t.red_flags),
            callback=t.callback,
            summary=t.summary,
            action=t.action,
            vip=t.vip,
        )


class ScreenedCallResponse(BaseModel):
    id: str
    source: CallSource
    status: CallStatus
    createdAt: datetime
    language: str
    scenarioId: str | None
    scenarioTitle: str
    transcript: list[GuardTurnResponse]
    triage: TriageResponse | None
    durationMs: int
    hasRecording: bool
    error: str

    @classmethod
    def from_domain(cls, c: ScreenedCall) -> ScreenedCallResponse:
        return cls(
            id=c.id,
            source=c.source,
            status=c.status,
            createdAt=c.created_at,
            language=c.language,
            scenarioId=c.scenario_id,
            scenarioTitle=c.scenario_title,
            transcript=[GuardTurnResponse.from_domain(t) for t in c.transcript],
            triage=TriageResponse.from_domain(c.triage) if c.triage else None,
            durationMs=c.duration_ms,
            hasRecording=c.has_recording,
            error=c.error,
        )


class CallListResponse(BaseModel):
    calls: list[ScreenedCallResponse]


class SimulateCallRequest(BaseModel):
    scenarioId: str = Field(..., max_length=64)


class DrillCheckResponse(BaseModel):
    name: str
    passed: bool
    detail: str
    critical: bool


class DrillResultResponse(BaseModel):
    score: int
    verdict: DrillVerdict
    checks: list[DrillCheckResponse]
    tips: list[str]
    familyMessage: str


class DrillResponse(BaseModel):
    id: str
    scamId: str
    scamTitle: str
    practicerName: str
    language: str
    status: CallStatus
    createdAt: datetime
    transcript: list[GuardTurnResponse]
    result: DrillResultResponse | None
    durationMs: int
    hasRecording: bool
    hungUp: bool
    error: str

    @classmethod
    def from_domain(cls, d: Drill) -> DrillResponse:
        result = None
        if d.result is not None:
            result = DrillResultResponse(
                score=d.result.score,
                verdict=d.result.verdict,
                checks=[
                    DrillCheckResponse(
                        name=c.name, passed=c.passed, detail=c.detail, critical=c.critical
                    )
                    for c in d.result.checks
                ],
                tips=list(d.result.tips),
                familyMessage=d.result.family_message,
            )
        return cls(
            id=d.id,
            scamId=d.scam_id,
            scamTitle=d.scam_title,
            practicerName=d.practicer_name,
            language=d.language,
            status=d.status,
            createdAt=d.created_at,
            transcript=[GuardTurnResponse.from_domain(t) for t in d.transcript],
            result=result,
            durationMs=d.duration_ms,
            hasRecording=d.has_recording,
            hungUp=d.hung_up,
            error=d.error,
        )


class DrillListResponse(BaseModel):
    drills: list[DrillResponse]


LiveKind = Literal["screener", "drill", "errand"]


class StartLiveRequest(BaseModel):
    # "screener": you play a caller and the assistant answers.
    # "drill": an AI scammer calls you and you practise.
    # "errand": the assistant calls you on the owner's behalf (errandId says about what).
    kind: LiveKind
    scamId: str | None = Field(None, max_length=64)
    errandId: str | None = Field(None, max_length=64)
    language: str | None = Field(None, max_length=30)
    practicerName: str = Field("", max_length=60)


class SpokenLine(BaseModel):
    text: str
    # 16 kHz mono WAV, base64. Played as soon as it arrives.
    audioBase64: str
    # The language the AI spoke this line in.
    language: str


class LiveStartResponse(BaseModel):
    liveId: str
    kind: LiveKind
    reply: SpokenLine
    ended: bool


class LiveTurnResponse(BaseModel):
    heard: str
    # The language speech recognition detected in what the person said.
    heardLanguage: str | None
    reply: SpokenLine | None
    ended: bool


class LiveEndRequest(BaseModel):
    # True when the person pressed "hang up" (in a drill, that counts in their favour).
    hungUp: bool = False


class LiveEndResponse(BaseModel):
    kind: LiveKind
    # The ScreenedCall (screener), Drill (drill) or Errand (errand) id.
    id: str


class CreateErrandRequest(BaseModel):
    recipientName: str = Field(..., max_length=100)
    recipientRole: str = Field("", max_length=100)
    task: str = Field(..., max_length=1000)
    deadline: str = Field("", max_length=200)


class SimulateErrandRequest(BaseModel):
    # The language the AI recipient prefers.
    language: str = Field(..., max_length=30)
    behaviour: RecipientBehaviour = RecipientBehaviour.AGREES


class ErrandReportResponse(BaseModel):
    outcome: ErrandOutcome
    commitment: str
    concerns: list[str]
    summary: str
    nextStep: str


class ErrandResponse(BaseModel):
    id: str
    recipientName: str
    recipientRole: str
    task: str
    deadline: str
    status: CallStatus
    createdAt: datetime
    source: CallSource | None
    language: str | None
    transcript: list[GuardTurnResponse]
    report: ErrandReportResponse | None
    durationMs: int
    hasRecording: bool
    error: str

    @classmethod
    def from_domain(cls, e: Errand) -> ErrandResponse:
        report = None
        if e.report is not None:
            report = ErrandReportResponse(
                outcome=e.report.outcome,
                commitment=e.report.commitment,
                concerns=list(e.report.concerns),
                summary=e.report.summary,
                nextStep=e.report.next_step,
            )
        return cls(
            id=e.id,
            recipientName=e.recipient_name,
            recipientRole=e.recipient_role,
            task=e.task,
            deadline=e.deadline,
            status=e.status,
            createdAt=e.created_at,
            source=e.source,
            language=e.language,
            transcript=[GuardTurnResponse.from_domain(t) for t in e.transcript],
            report=report,
            durationMs=e.duration_ms,
            hasRecording=e.has_recording,
            error=e.error,
        )


class ErrandListResponse(BaseModel):
    errands: list[ErrandResponse]
