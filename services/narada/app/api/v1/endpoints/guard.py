import io
import wave
from typing import Annotated

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from app.api.deps import GuardServiceDep
from app.api.v1.schemas.guard import (
    CallerScenarioResponse,
    CallListResponse,
    CreateErrandRequest,
    DrillListResponse,
    DrillResponse,
    ErrandListResponse,
    ErrandResponse,
    LiveEndRequest,
    LiveEndResponse,
    LiveStartResponse,
    LiveTurnResponse,
    ProfileBody,
    ProfileResponse,
    ScenarioListResponse,
    ScreenedCallResponse,
    SimulateCallRequest,
    SimulateErrandRequest,
    SpokenLine,
    StartLiveRequest,
)
from app.integrations.speech import SAMPLE_RATE, SAMPLE_WIDTH
from app.services.guard.guard_service import SpokenReply

router = APIRouter(prefix="/guard", tags=["call guard"])

# About two minutes of 16 kHz speech; a push-to-talk turn is far shorter.
_MAX_TURN_BYTES = 4 * 1024 * 1024
_WAV = {200: {"content": {"audio/wav": {}}}}


def _read_turn_audio(data: bytes) -> bytes:
    """The browser sends 16 kHz mono 16-bit WAV; anything else is refused, not guessed."""
    try:
        with wave.open(io.BytesIO(data)) as w:
            ok = (
                w.getnchannels() == 1
                and w.getsampwidth() == SAMPLE_WIDTH
                and w.getframerate() == SAMPLE_RATE
            )
            pcm = w.readframes(w.getnframes())
    except (wave.Error, EOFError):
        ok, pcm = False, b""
    if not ok:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail="audio_invalid")
    return pcm


def _spoken(reply: SpokenReply) -> SpokenLine:
    return SpokenLine(text=reply.text, audioBase64=reply.audio_base64, language=reply.language)


@router.get("/profile", response_model=ProfileResponse)
async def get_profile(svc: GuardServiceDep) -> ProfileResponse:
    return ProfileResponse.from_domain(await svc.get_profile(), svc.languages, svc.listen_options)


@router.put("/profile", response_model=ProfileResponse)
async def save_profile(body: ProfileBody, svc: GuardServiceDep) -> ProfileResponse:
    profile = await svc.save_profile(body.to_domain())
    return ProfileResponse.from_domain(profile, svc.languages, svc.listen_options)


@router.get("/scenarios", response_model=ScenarioListResponse)
async def list_scenarios(svc: GuardServiceDep) -> ScenarioListResponse:
    callers, scams = svc.scenarios()
    return ScenarioListResponse(
        callers=[CallerScenarioResponse.from_domain(s) for s in callers],
        scams=[CallerScenarioResponse.from_domain(s) for s in scams],
        voiceAvailable=svc.voice_available,
    )


@router.post(
    "/calls/simulate", response_model=ScreenedCallResponse, status_code=status.HTTP_202_ACCEPTED
)
async def simulate_call(body: SimulateCallRequest, svc: GuardServiceDep) -> ScreenedCallResponse:
    return ScreenedCallResponse.from_domain(await svc.simulate(body.scenarioId))


@router.get("/calls", response_model=CallListResponse)
async def list_calls(svc: GuardServiceDep) -> CallListResponse:
    return CallListResponse(
        calls=[ScreenedCallResponse.from_domain(c) for c in await svc.list_calls()]
    )


@router.get("/calls/{call_id}", response_model=ScreenedCallResponse)
async def get_call(call_id: str, svc: GuardServiceDep) -> ScreenedCallResponse:
    return ScreenedCallResponse.from_domain(await svc.get_call(call_id))


@router.get("/calls/{call_id}/recording", response_class=FileResponse, responses=_WAV)
async def get_call_recording(call_id: str, svc: GuardServiceDep) -> FileResponse:
    return FileResponse(await svc.call_recording(call_id), media_type="audio/wav")


@router.get("/drills", response_model=DrillListResponse)
async def list_drills(svc: GuardServiceDep) -> DrillListResponse:
    return DrillListResponse(drills=[DrillResponse.from_domain(d) for d in await svc.list_drills()])


@router.get("/drills/{drill_id}", response_model=DrillResponse)
async def get_drill(drill_id: str, svc: GuardServiceDep) -> DrillResponse:
    return DrillResponse.from_domain(await svc.get_drill(drill_id))


@router.get("/drills/{drill_id}/recording", response_class=FileResponse, responses=_WAV)
async def get_drill_recording(drill_id: str, svc: GuardServiceDep) -> FileResponse:
    return FileResponse(await svc.drill_recording(drill_id), media_type="audio/wav")


@router.post("/live", response_model=LiveStartResponse)
async def start_live(body: StartLiveRequest, svc: GuardServiceDep) -> LiveStartResponse:
    call, reply, ended = await svc.start_live(
        body.kind, body.scamId, body.language, body.practicerName, body.errandId
    )
    return LiveStartResponse(liveId=call.id, kind=body.kind, reply=_spoken(reply), ended=ended)


@router.post("/live/{live_id}/turn", response_model=LiveTurnResponse)
async def live_turn(
    live_id: str, svc: GuardServiceDep, audio: Annotated[UploadFile, File()]
) -> LiveTurnResponse:
    data = await audio.read(_MAX_TURN_BYTES + 1)
    if len(data) > _MAX_TURN_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="audio_too_long")
    heard, heard_language, reply, ended = await svc.live_turn(live_id, _read_turn_audio(data))
    return LiveTurnResponse(
        heard=heard,
        heardLanguage=heard_language,
        reply=_spoken(reply) if reply else None,
        ended=ended,
    )


@router.post("/live/{live_id}/end", response_model=LiveEndResponse)
async def end_live(live_id: str, body: LiveEndRequest, svc: GuardServiceDep) -> LiveEndResponse:
    kind, record_id = await svc.end_live(live_id, body.hungUp)
    return LiveEndResponse(kind=kind, id=record_id)


@router.post("/errands", response_model=ErrandResponse, status_code=status.HTTP_201_CREATED)
async def create_errand(body: CreateErrandRequest, svc: GuardServiceDep) -> ErrandResponse:
    errand = await svc.create_errand(
        body.recipientName, body.recipientRole, body.task, body.deadline
    )
    return ErrandResponse.from_domain(errand)


@router.get("/errands", response_model=ErrandListResponse)
async def list_errands(svc: GuardServiceDep) -> ErrandListResponse:
    return ErrandListResponse(
        errands=[ErrandResponse.from_domain(e) for e in await svc.list_errands()]
    )


@router.get("/errands/{errand_id}", response_model=ErrandResponse)
async def get_errand(errand_id: str, svc: GuardServiceDep) -> ErrandResponse:
    return ErrandResponse.from_domain(await svc.get_errand(errand_id))


@router.post(
    "/errands/{errand_id}/simulate",
    response_model=ErrandResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def simulate_errand(
    errand_id: str, body: SimulateErrandRequest, svc: GuardServiceDep
) -> ErrandResponse:
    errand = await svc.simulate_errand(errand_id, body.language, body.behaviour)
    return ErrandResponse.from_domain(errand)


@router.get("/errands/{errand_id}/recording", response_class=FileResponse, responses=_WAV)
async def get_errand_recording(errand_id: str, svc: GuardServiceDep) -> FileResponse:
    return FileResponse(await svc.errand_recording(errand_id), media_type="audio/wav")
