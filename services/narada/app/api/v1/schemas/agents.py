"""Request/response shapes for agent setup. camelCase on the wire."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.domain.agents.models import (
    Agent,
    AgentDefinition,
    AnswerField,
    AnswerFormat,
    CallInput,
    LanguageSwitch,
    Rule,
    RuleKind,
    Vendor,
)
from app.domain.agents.rules import setup_progress


class ConnectAgentRequest(BaseModel):
    """Step 1. Used for both create and edit."""

    name: str = Field(..., max_length=120)
    vendor: Vendor
    assistantId: str = Field(..., max_length=100, description="Plivo flow ID or Vapi assistant ID")


class CallInputBody(BaseModel):
    key: str = Field(..., max_length=64)
    label: str = Field(..., max_length=120)
    example: str = Field(default="", max_length=500)
    required: bool = True


class AnswerFieldBody(BaseModel):
    key: str = Field(..., max_length=64)
    question: str = Field(..., max_length=500)
    format: AnswerFormat
    required: bool = True
    choices: list[str] = Field(default_factory=list, max_length=20)
    hint: str = Field(default="", max_length=300)


class RuleBody(BaseModel):
    text: str = Field(..., max_length=500)
    kind: RuleKind


class AgentDefinitionBody(BaseModel):
    """Step 2."""

    prompt: str
    callInputs: list[CallInputBody] = Field(default_factory=list, max_length=30)
    answers: list[AnswerFieldBody] = Field(default_factory=list, max_length=30)
    rules: list[RuleBody] = Field(default_factory=list, max_length=50)
    languages: list[str] = Field(default_factory=list, max_length=10)
    languageSwitch: LanguageSwitch = LanguageSwitch.FOLLOW
    callEnding: str = Field(default="", max_length=1000)

    def to_domain(self) -> AgentDefinition:
        return AgentDefinition(
            prompt=self.prompt,
            call_inputs=tuple(
                CallInput(
                    key=i.key.strip(), label=i.label.strip(), example=i.example, required=i.required
                )
                for i in self.callInputs
            ),
            answers=tuple(
                AnswerField(
                    key=a.key.strip(),
                    question=a.question.strip(),
                    format=a.format,
                    required=a.required,
                    choices=tuple(c.strip() for c in a.choices if c.strip()),
                    hint=a.hint.strip(),
                )
                for a in self.answers
            ),
            rules=tuple(Rule(text=r.text.strip(), kind=r.kind) for r in self.rules),
            languages=tuple(dict.fromkeys(self.languages)),
            language_switch=self.languageSwitch,
            call_ending=self.callEnding.strip(),
        )

    @classmethod
    def from_domain(cls, d: AgentDefinition) -> AgentDefinitionBody:
        return cls(
            prompt=d.prompt,
            callInputs=[
                CallInputBody(key=i.key, label=i.label, example=i.example, required=i.required)
                for i in d.call_inputs
            ],
            answers=[
                AnswerFieldBody(
                    key=a.key,
                    question=a.question,
                    format=a.format,
                    required=a.required,
                    choices=list(a.choices),
                    hint=a.hint,
                )
                for a in d.answers
            ],
            rules=[RuleBody(text=r.text, kind=r.kind) for r in d.rules],
            languages=list(d.languages),
            languageSwitch=d.language_switch,
            callEnding=d.call_ending,
        )


class SetupProgressResponse(BaseModel):
    connectDone: bool
    describeDone: bool
    nextStep: Literal["connect", "describe", "ready"]


class PromptVersionResponse(BaseModel):
    version: int
    fingerprint: str
    createdAt: datetime


class AgentSummaryResponse(BaseModel):
    id: str
    name: str
    vendor: Vendor
    assistantId: str
    promptVersion: int | None
    answersCount: int
    setup: SetupProgressResponse
    updatedAt: datetime

    @classmethod
    def from_domain(cls, agent: Agent) -> AgentSummaryResponse:
        progress = setup_progress(agent)
        current = agent.current_prompt_version
        return cls(
            id=agent.id or "",
            name=agent.name,
            vendor=agent.vendor,
            assistantId=agent.assistant_id,
            promptVersion=current.version if current else None,
            answersCount=len(agent.definition.answers) if agent.definition else 0,
            setup=SetupProgressResponse(
                connectDone=progress.connect_done,
                describeDone=progress.describe_done,
                nextStep=progress.next_step.value,
            ),
            updatedAt=agent.updated_at,
        )


class AgentResponse(AgentSummaryResponse):
    definition: AgentDefinitionBody | None
    promptVersions: list[PromptVersionResponse]
    createdAt: datetime

    @classmethod
    def from_domain(cls, agent: Agent) -> AgentResponse:
        summary = AgentSummaryResponse.from_domain(agent)
        return cls(
            **summary.model_dump(),
            definition=(
                AgentDefinitionBody.from_domain(agent.definition) if agent.definition else None
            ),
            promptVersions=[
                PromptVersionResponse(
                    version=v.version, fingerprint=v.fingerprint, createdAt=v.created_at
                )
                for v in agent.prompt_versions
            ],
            createdAt=agent.created_at,
        )


class AgentListResponse(BaseModel):
    agents: list[AgentSummaryResponse]


class AgentOptionsResponse(BaseModel):
    """Choices the setup form offers, so the frontend never hard-codes them."""

    vendors: list[Vendor]
    answerFormats: list[AnswerFormat]
    languages: list[str]
    languageSwitch: list[LanguageSwitch]


class QuickAgentRequest(BaseModel):
    """The one-step shortcut: a prompt is enough; name and languages are optional."""

    name: str = Field("", max_length=100)
    prompt: str = Field(..., max_length=60_000)
    languages: list[str] = Field(default_factory=list, max_length=10)
