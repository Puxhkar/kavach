"""Shared fixtures. Tests never touch Mongo: storage is the in-memory repository, which
round-trips through the same document mapping the Mongo repository uses."""

import os
import sys
from datetime import UTC, datetime

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("STORAGE_BACKEND", "memory")

from httpx import ASGITransport, AsyncClient

from app.domain.agents.models import (
    AgentDefinition,
    AnswerField,
    AnswerFormat,
    CallInput,
    LanguageSwitch,
    Rule,
    RuleKind,
)
from app.integrations.speech import BYTES_PER_MS, Heard, SpeechError
from app.persistence.recordings import LocalRecordingStore
from app.persistence.repositories import InMemoryAgentRepo, InMemoryRunRepo
from app.services.testing.run_executor import RunExecutor

PLIVO_FLOW_ID = "c9218bfd-65f7-4bc9-ac00-cfaaf3107394"
NOW = datetime(2026, 10, 26, 12, 0, tzinfo=UTC)


def make_definition(**overrides) -> AgentDefinition:
    base = dict(
        prompt="You are a recruiting assistant. Ask one question at a time.",
        call_inputs=(CallInput(key="name", label="Candidate name", example="Rahul"),),
        answers=(
            AnswerField(
                key="current_ctc",
                question="What is your current CTC?",
                format=AnswerFormat.AMOUNT_LPA,
            ),
        ),
        rules=(Rule(text="Never promise a salary", kind=RuleKind.MUST_NOT),),
        languages=("English", "Hinglish"),
        language_switch=LanguageSwitch.FOLLOW,
        call_ending="Thank the candidate and end the call after the last question.",
    )
    base.update(overrides)
    return AgentDefinition(**base)


def definition_body(**overrides) -> dict:
    body = {
        "prompt": "You are a recruiting assistant. Ask one question at a time.",
        "callInputs": [{"key": "name", "label": "Candidate name", "example": "Rahul"}],
        "answers": [
            {"key": "current_ctc", "question": "What is your current CTC?", "format": "amount_lpa"}
        ],
        "rules": [{"text": "Never promise a salary", "kind": "must_not"}],
        "languages": ["English", "Hinglish"],
        "languageSwitch": "follow",
        "callEnding": "Thank the candidate and end the call.",
    }
    body.update(overrides)
    return body


class FakeLLM:
    """Scripted stand-in for the language model. Agent and candidate replies are popped from
    their scripts in order; JSON replies are looked up by schema name."""

    def __init__(
        self,
        agent: list[str] | None = None,
        candidate: list[str] | None = None,
        json: dict[str, dict] | None = None,
    ) -> None:
        self.agent = list(agent or ["Hello, am I speaking with Rahul? [END_CALL]"])
        self.candidate = list(candidate or [])
        self.json = json or {}
        self.calls: list[tuple[str, list[dict]]] = []

    async def reply(self, system: str, messages: list[dict], max_tokens: int) -> str:
        self.calls.append((system, list(messages)))
        script = self.candidate if system.startswith("You are playing a person") else self.agent
        return script.pop(0) if script else "..."

    async def reply_json(self, system, messages, schema_name, schema, max_tokens) -> dict:
        self.calls.append((system, list(messages)))
        return self.json[schema_name]


_SCRIPTS = {
    "kn-IN": ("\u0c80", "\u0cff"),
    "ta-IN": ("\u0b80", "\u0bff"),
    "te-IN": ("\u0c00", "\u0c7f"),
    "hi-IN": ("\u0900", "\u097f"),
}


class FakeSpeech:
    """Stand-in for Gnani. The "audio" is the UTF-8 text padded with zeros to whole
    100 ms, so transcribing gives the text back — through `mishear` when a phrase is in it."""

    def __init__(self, mishear: dict[str, str] | None = None, fail_after: int | None = None):
        self.mishear = mishear or {}
        self.fail_after = fail_after
        self.spoken: list[tuple[str, str]] = []
        self.closed = False

    async def synthesize(self, text: str, voice: str) -> bytes:
        if self.fail_after is not None and len(self.spoken) >= self.fail_after:
            raise SpeechError("Gnani text-to-speech failed (HTTP 503)")
        self.spoken.append((voice, text))
        audio = text.encode()
        chunk = 100 * BYTES_PER_MS
        return audio + bytes(-len(audio) % chunk)

    async def transcribe(self, pcm: bytes, language_codes: str) -> str:
        text = pcm.rstrip(b"\x00").decode().strip()
        for said, heard in self.mishear.items():
            text = text.replace(said, heard)
        return text

    async def listen(self, pcm: bytes, language_codes: str) -> Heard:
        text = await self.transcribe(pcm, language_codes)
        # Detect by script, like Gnani does among the hinted languages.
        for code, (low, high) in _SCRIPTS.items():
            if code in language_codes and any(low <= ch <= high for ch in text):
                return Heard(text, code)
        return Heard(text, "en-IN" if text and "en-IN" in language_codes else None)

    async def aclose(self) -> None:
        self.closed = True


def scenario_json(**overrides) -> dict:
    data = {
        "candidateName": "Rahul Verma",
        "gender": "male",
        "persona": "Backend developer, 4 years",
        "startLanguage": "English",
        "callInputs": [{"key": "name", "value": "Rahul"}],
        "answers": [{"key": "current_ctc", "spoken": "about 1 lakh a month", "truth": "12"}],
        "behavior": "Give the monthly figure first.",
        "expectedOutcome": "Agent saves 12 LPA.",
    }
    data.update(overrides)
    return data


def review_json(passed: bool = True, **overrides) -> dict:
    data = {
        "answers": [
            {
                "key": "current_ctc",
                "agentValue": "12" if passed else "1",
                "status": "correct" if passed else "wrong",
                "acceptable": passed,
                "note": "",
            }
        ],
        "checks": [
            {"name": "Never promise a salary", "kind": "rule", "passed": True, "detail": ""},
            {"name": "Handled the situation", "kind": "situation", "passed": True, "detail": ""},
        ],
        "summary": "Went well." if passed else "Saved the monthly figure as annual.",
    }
    data.update(overrides)
    return data


def make_executor(llm, runs, speech=None, recordings=None) -> RunExecutor:
    return RunExecutor(
        llm,
        runs,
        concurrency=2,
        max_agent_turns=6,
        clock=lambda: NOW,
        speech=speech,
        recordings=recordings,
    )


@pytest.fixture
async def client(tmp_path):
    from main import app

    app.state.agent_repo = InMemoryAgentRepo()
    app.state.run_repo = InMemoryRunRepo()
    app.state.recording_store = LocalRecordingStore(tmp_path / "recordings")
    app.state.run_executor = None
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
