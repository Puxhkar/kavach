"""FastAPI entrypoint for the narada service (voice-agent testing platform)."""

import time
from contextlib import asynccontextmanager
from datetime import UTC, datetime

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import v1_router
from app.domain.errors import DomainValidationError
from app.integrations.llm import LLMClient
from app.integrations.speech import SpeechClient
from app.persistence.recordings import LocalRecordingStore, RecordingStore
from app.persistence.repositories import (
    AgentRepo,
    InMemoryAgentRepo,
    InMemoryRunRepo,
    MongoAgentRepo,
    MongoRunRepo,
    RunRepo,
)
from app.persistence.repositories.guard_repo import InMemoryGuardRepo
from app.services.guard.guard_service import GuardService
from app.services.run_service import RunService
from app.services.testing.run_executor import RunExecutor
from app.shared.exceptions import NotFoundError, ServiceUnavailableError
from app.shared.logger import get_logger
from app.shared.settings import settings

logger = get_logger()


def build_llm() -> LLMClient | None:
    """None when no language model is configured: setup pages still work, anything that
    needs the model answers 503."""
    if not settings.llm_configured:
        logger.warning("LLM_BASE_URL / LLM_MODEL are not set: test runs are disabled")
        return None
    from app.integrations.llm import OpenAICompatibleLLM

    return OpenAICompatibleLLM(settings)


def build_speech() -> SpeechClient | None:
    """One client for the whole process, so Gnani's in-flight cap covers test runs and
    Call Guard together."""
    if not settings.speech_configured:
        logger.warning("GNANI_API_KEY is not set: voice runs and Call Guard voice are disabled")
        return None
    from app.integrations.speech import GnaniSpeech

    return GnaniSpeech(
        settings.GNANI_API_KEY.get_secret_value(),
        max_parallel=settings.GNANI_MAX_PARALLEL_REQUESTS,
    )


def build_executor(
    runs: RunRepo,
    recordings: RecordingStore,
    llm: LLMClient | None,
    speech: SpeechClient | None,
) -> RunExecutor | None:
    """None without a language model: agent setup still works, runs answer 503. Without
    speech only chat runs can start."""
    if llm is None:
        return None
    return RunExecutor(
        llm,
        runs,
        concurrency=settings.RUN_CONCURRENCY,
        max_agent_turns=settings.MAX_AGENT_TURNS,
        clock=lambda: datetime.now(UTC),
        speech=speech,
        recordings=recordings,
        agent_voice=settings.GNANI_AGENT_VOICE,
    )


async def _start(app: FastAPI, agents: AgentRepo, runs: RunRepo) -> None:
    app.state.agent_repo = agents
    app.state.run_repo = runs
    app.state.recording_store = LocalRecordingStore(settings.RECORDINGS_DIR)
    llm, speech = build_llm(), build_speech()
    app.state.llm = llm
    app.state.speech = speech
    app.state.run_executor = build_executor(runs, app.state.recording_store, llm, speech)
    app.state.guard_service = GuardService(
        InMemoryGuardRepo(),
        llm,
        speech,
        app.state.recording_store,
        clock=lambda: datetime.now(UTC),
        assistant_voice=settings.GNANI_AGENT_VOICE,
    )
    recovered = await RunService(agents, runs, None, 0).recover_interrupted()
    if recovered:
        logger.warning(
            "Marked %d unfinished run(s) from a previous process as interrupted", recovered
        )


async def _stop(app: FastAPI) -> None:
    await app.state.guard_service.shutdown()
    if app.state.run_executor is not None:
        # Also closes the shared speech client.
        await app.state.run_executor.shutdown()
    elif app.state.speech is not None:
        await app.state.speech.aclose()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.STORAGE_BACKEND == "memory":
        logger.warning("STORAGE_BACKEND=memory: data lives in this process and is lost on restart")
        await _start(app, InMemoryAgentRepo(), InMemoryRunRepo())
        try:
            yield
        finally:
            await _stop(app)
        return

    from app.persistence.mongo import close_mongo, connect_mongo

    db = await connect_mongo()
    await _start(app, MongoAgentRepo(db), MongoRunRepo(db))
    try:
        yield
    finally:
        await _stop(app)
        close_mongo()


def create_app() -> FastAPI:
    app = FastAPI(title=settings.APP_NAME, version=settings.APP_VERSION, lifespan=lifespan)

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        started = time.perf_counter()
        response = await call_next(request)
        if request.url.path != "/health":
            took_ms = (time.perf_counter() - started) * 1000
            logger.info(
                "%s %s -> %d (%.0f ms)",
                request.method,
                request.url.path,
                response.status_code,
                took_ms,
            )
        return response

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(NotFoundError)
    async def _not_found(_: Request, exc: NotFoundError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": exc.code})

    @app.exception_handler(ServiceUnavailableError)
    async def _unavailable(_: Request, exc: ServiceUnavailableError) -> JSONResponse:
        return JSONResponse(status_code=503, content={"detail": exc.code})

    @app.exception_handler(DomainValidationError)
    async def _invalid(_: Request, exc: DomainValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "detail": "validation_failed",
                "errors": [{"field": e.field, "message": e.message} for e in exc.errors],
            },
        )

    @app.exception_handler(RequestValidationError)
    async def _bad_request(_: Request, exc: RequestValidationError) -> JSONResponse:
        # Same shape as domain validation errors, so forms show both the same way.
        errors = [
            {
                "field": ".".join(str(p) for p in e["loc"] if p not in ("body", "query", "path")),
                "message": e["msg"],
            }
            for e in exc.errors()
        ]
        return JSONResponse(
            status_code=422, content={"detail": "validation_failed", "errors": errors}
        )

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {
            "status": "ok",
            "storage": settings.STORAGE_BACKEND,
            "llm": "configured" if settings.llm_configured else "missing",
            "speech": "configured" if settings.speech_configured else "missing",
        }

    app.include_router(v1_router, prefix="/api/v1")
    return app


app = create_app()
