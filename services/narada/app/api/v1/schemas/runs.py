"""Request/response shapes for situations and test runs. camelCase on the wire."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.domain.testing.models import (
    AnswerStatus,
    CheckKind,
    Conversation,
    ConversationStatus,
    EndReason,
    Recording,
    Run,
    RunMode,
    RunStatus,
    Scenario,
    Situation,
    Speaker,
)


class SituationResponse(BaseModel):
    id: str
    title: str
    description: str
    category: str
    language: str | None
    voiceOnly: bool

    @classmethod
    def from_domain(cls, s: Situation) -> SituationResponse:
        return cls(
            id=s.id,
            title=s.title,
            description=s.description,
            category=s.category,
            language=s.language,
            voiceOnly=s.noisy_line,
        )


class SituationListResponse(BaseModel):
    situations: list[SituationResponse]
    maxConversationsPerRun: int
    maxRepeats: int
    # Voice mode needs the Gnani key; without it only chat runs can start.
    voiceAvailable: bool


class CreateRunRequest(BaseModel):
    agentId: str = Field(..., max_length=64)
    situationIds: list[str] = Field(..., max_length=100)
    repeats: int = 1
    mode: RunMode = RunMode.CHAT


class TurnResponse(BaseModel):
    speaker: Speaker
    text: str
    silent: bool
    heard: str | None
    startMs: int | None
    endMs: int | None


class RecordingResponse(BaseModel):
    agentVoice: str
    candidateVoice: str
    durationMs: int

    @classmethod
    def from_domain(cls, r: Recording) -> RecordingResponse:
        return cls(
            agentVoice=r.agent_voice, candidateVoice=r.candidate_voice, durationMs=r.duration_ms
        )


class ScenarioAnswerResponse(BaseModel):
    key: str
    spoken: str
    truth: str


class ScenarioResponse(BaseModel):
    candidateName: str
    persona: str
    startLanguage: str
    callInputs: dict[str, str]
    answers: list[ScenarioAnswerResponse]
    behavior: str
    expectedOutcome: str
    gender: str

    @classmethod
    def from_domain(cls, s: Scenario) -> ScenarioResponse:
        return cls(
            candidateName=s.candidate_name,
            persona=s.persona,
            startLanguage=s.start_language,
            callInputs=dict(s.call_inputs),
            answers=[
                ScenarioAnswerResponse(key=a.key, spoken=a.spoken, truth=a.truth) for a in s.answers
            ],
            behavior=s.behavior,
            expectedOutcome=s.expected_outcome,
            gender=s.gender,
        )


class AnswerResultResponse(BaseModel):
    key: str
    expected: str
    agentValue: str
    status: AnswerStatus
    acceptable: bool
    note: str


class CheckResponse(BaseModel):
    name: str
    kind: CheckKind
    passed: bool
    detail: str


class ConversationResponse(BaseModel):
    id: str
    situationId: str
    situationTitle: str
    category: str
    language: str | None
    repeat: int
    status: ConversationStatus
    scenario: ScenarioResponse | None
    transcript: list[TurnResponse]
    endReason: EndReason | None
    answers: list[AnswerResultResponse]
    checks: list[CheckResponse]
    summary: str
    error: str
    recording: RecordingResponse | None
    startedAt: datetime | None
    finishedAt: datetime | None

    @classmethod
    def from_domain(cls, c: Conversation) -> ConversationResponse:
        return cls(
            id=c.id,
            situationId=c.situation_id,
            situationTitle=c.situation_title,
            category=c.category,
            language=c.language,
            repeat=c.repeat,
            status=c.status,
            scenario=ScenarioResponse.from_domain(c.scenario) if c.scenario else None,
            transcript=[
                TurnResponse(
                    speaker=t.speaker,
                    text=t.text,
                    silent=t.silent,
                    heard=t.heard,
                    startMs=t.start_ms,
                    endMs=t.end_ms,
                )
                for t in c.transcript
            ],
            endReason=c.end_reason,
            answers=[
                AnswerResultResponse(
                    key=a.key,
                    expected=a.expected,
                    agentValue=a.agent_value,
                    status=a.status,
                    acceptable=a.acceptable,
                    note=a.note,
                )
                for a in c.answers
            ],
            checks=[
                CheckResponse(name=k.name, kind=k.kind, passed=k.passed, detail=k.detail)
                for k in c.checks
            ],
            summary=c.summary,
            error=c.error,
            recording=RecordingResponse.from_domain(c.recording) if c.recording else None,
            startedAt=c.started_at,
            finishedAt=c.finished_at,
        )


class RunCountsResponse(BaseModel):
    total: int
    passed: int
    failed: int
    errored: int
    pending: int


class RunSummaryResponse(BaseModel):
    id: str
    agentId: str
    agentName: str
    promptVersion: int
    mode: RunMode
    status: RunStatus
    counts: RunCountsResponse
    createdAt: datetime
    startedAt: datetime | None
    finishedAt: datetime | None

    @classmethod
    def from_domain(cls, run: Run) -> RunSummaryResponse:
        counts = run.counts
        return cls(
            id=run.id or "",
            agentId=run.agent_id,
            agentName=run.agent_name,
            promptVersion=run.prompt_version,
            mode=run.mode,
            status=run.status,
            counts=RunCountsResponse(
                total=counts.total,
                passed=counts.passed,
                failed=counts.failed,
                errored=counts.errored,
                pending=counts.pending,
            ),
            createdAt=run.created_at,
            startedAt=run.started_at,
            finishedAt=run.finished_at,
        )


class RunResponse(RunSummaryResponse):
    conversations: list[ConversationResponse]

    @classmethod
    def from_domain(cls, run: Run) -> RunResponse:
        return cls(
            **RunSummaryResponse.from_domain(run).model_dump(),
            conversations=[ConversationResponse.from_domain(c) for c in run.conversations],
        )


class RunListResponse(BaseModel):
    runs: list[RunSummaryResponse]
