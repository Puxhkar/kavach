from fastapi import APIRouter, Query, status
from fastapi.responses import FileResponse

from app.api.deps import RunServiceDep
from app.api.v1.schemas.runs import (
    CreateRunRequest,
    RunListResponse,
    RunResponse,
    RunSummaryResponse,
)

router = APIRouter(prefix="/runs", tags=["runs"])


@router.post("", response_model=RunResponse, status_code=status.HTTP_202_ACCEPTED)
async def start_run(body: CreateRunRequest, svc: RunServiceDep) -> RunResponse:
    run = await svc.start_run(body.agentId, body.situationIds, body.repeats, body.mode)
    return RunResponse.from_domain(run)


@router.get("", response_model=RunListResponse)
async def list_runs(
    svc: RunServiceDep, agentId: str = Query(..., max_length=64)
) -> RunListResponse:
    runs = await svc.list_runs(agentId)
    return RunListResponse(runs=[RunSummaryResponse.from_domain(r) for r in runs])


@router.get("/{run_id}", response_model=RunResponse)
async def get_run(run_id: str, svc: RunServiceDep) -> RunResponse:
    return RunResponse.from_domain(await svc.get_run(run_id))


@router.get(
    "/{run_id}/conversations/{conversation_id}/recording",
    response_class=FileResponse,
    responses={200: {"content": {"audio/wav": {}}}},
)
async def get_recording(run_id: str, conversation_id: str, svc: RunServiceDep) -> FileResponse:
    path = await svc.recording_path(run_id, conversation_id)
    return FileResponse(path, media_type="audio/wav")
