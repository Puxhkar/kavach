"""FastAPI dependencies. Storage and the run executor are built once at startup and kept
on `app.state`."""

from typing import Annotated

from fastapi import Depends, Request

from app.persistence.repositories import AgentRepo
from app.services.agent_service import AgentService
from app.services.guard.guard_service import GuardService
from app.services.run_service import RunService
from app.shared.settings import settings


def get_agent_service(request: Request) -> AgentService:
    repo: AgentRepo = request.app.state.agent_repo
    return AgentService(repo, llm=getattr(request.app.state, "llm", None))


def get_run_service(request: Request) -> RunService:
    state = request.app.state
    return RunService(
        state.agent_repo,
        state.run_repo,
        state.run_executor,
        settings.MAX_CONVERSATIONS_PER_RUN,
        recordings=state.recording_store,
    )


def get_guard_service(request: Request) -> GuardService:
    return request.app.state.guard_service


AgentServiceDep = Annotated[AgentService, Depends(get_agent_service)]
GuardServiceDep = Annotated[GuardService, Depends(get_guard_service)]
RunServiceDep = Annotated[RunService, Depends(get_run_service)]
