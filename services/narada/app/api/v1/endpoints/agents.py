from fastapi import APIRouter, status

from app.api.deps import AgentServiceDep, RunServiceDep
from app.api.v1.schemas.agents import (
    AgentDefinitionBody,
    AgentListResponse,
    AgentOptionsResponse,
    AgentResponse,
    AgentSummaryResponse,
    ConnectAgentRequest,
    QuickAgentRequest,
)
from app.api.v1.schemas.runs import SituationListResponse, SituationResponse
from app.domain.agents.models import SUPPORTED_LANGUAGES, AnswerFormat, LanguageSwitch, Vendor
from app.domain.testing.rules import MAX_REPEATS
from app.shared.settings import settings

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("/options", response_model=AgentOptionsResponse)
async def get_options() -> AgentOptionsResponse:
    return AgentOptionsResponse(
        vendors=[v for v in Vendor if v is not Vendor.NONE],
        answerFormats=list(AnswerFormat),
        languages=list(SUPPORTED_LANGUAGES),
        languageSwitch=list(LanguageSwitch),
    )


@router.get("", response_model=AgentListResponse)
async def list_agents(svc: AgentServiceDep) -> AgentListResponse:
    agents = await svc.list_agents()
    return AgentListResponse(agents=[AgentSummaryResponse.from_domain(a) for a in agents])


@router.post("", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(body: ConnectAgentRequest, svc: AgentServiceDep) -> AgentResponse:
    agent = await svc.create_agent(body.name, body.vendor, body.assistantId)
    return AgentResponse.from_domain(agent)


@router.post("/quick", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def quick_create_agent(body: QuickAgentRequest, svc: AgentServiceDep) -> AgentResponse:
    agent = await svc.quick_create(body.name, body.prompt, tuple(body.languages))
    return AgentResponse.from_domain(agent)


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(agent_id: str, svc: AgentServiceDep) -> AgentResponse:
    return AgentResponse.from_domain(await svc.get_agent(agent_id))


@router.put("/{agent_id}/connection", response_model=AgentResponse)
async def update_connection(
    agent_id: str, body: ConnectAgentRequest, svc: AgentServiceDep
) -> AgentResponse:
    agent = await svc.update_connection(agent_id, body.name, body.vendor, body.assistantId)
    return AgentResponse.from_domain(agent)


@router.put("/{agent_id}/definition", response_model=AgentResponse)
async def set_definition(
    agent_id: str, body: AgentDefinitionBody, svc: AgentServiceDep
) -> AgentResponse:
    agent = await svc.set_definition(agent_id, body.to_domain())
    return AgentResponse.from_domain(agent)


@router.get("/{agent_id}/situations", response_model=SituationListResponse)
async def list_situations(agent_id: str, svc: RunServiceDep) -> SituationListResponse:
    situations = await svc.list_situations(agent_id)
    return SituationListResponse(
        situations=[SituationResponse.from_domain(s) for s in situations],
        maxConversationsPerRun=settings.MAX_CONVERSATIONS_PER_RUN,
        maxRepeats=MAX_REPEATS,
        voiceAvailable=svc.voice_available,
    )
