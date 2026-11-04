"""Speech client: text-to-speech and speech-to-text. The only module that talks to Gnani.

Audio crosses this boundary as raw 16 kHz mono 16-bit PCM, so callers can join clips into
one recording without decoding anything. Services depend on the `SpeechClient` protocol,
so tests pass a fake and never call the network.
"""

from __future__ import annotations

import asyncio
import io
import wave
from dataclasses import dataclass
from typing import Any, Protocol

import httpx

SAMPLE_RATE = 16_000
SAMPLE_WIDTH = 2
BYTES_PER_MS = SAMPLE_RATE * SAMPLE_WIDTH // 1000

_TTS_MODEL = "timbre-v3.0"
_STT_MODEL = "prisma-v3.0"
# Gnani's REST transcription accepts at most 30 s per request.
_STT_MAX_BYTES = 28 * 1000 * BYTES_PER_MS
_RETRY_STATUSES = frozenset({429, 500, 502, 503, 504})
_RETRY_DELAYS = (1.0, 3.0)


@dataclass(frozen=True)
class Heard:
    text: str
    # What Gnani detected among the language hints, e.g. "kn-IN"; None if it didn't say.
    language_code: str | None = None


class SpeechError(Exception):
    """The speech call failed or returned something unusable. The message is shown to the
    user, so it never contains the key."""


class SpeechClient(Protocol):
    async def synthesize(self, text: str, voice: str) -> bytes: ...

    async def transcribe(self, pcm: bytes, language_codes: str) -> str: ...

    async def listen(self, pcm: bytes, language_codes: str) -> Heard: ...

    async def aclose(self) -> None: ...


def pcm_to_wav(pcm: bytes) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(SAMPLE_WIDTH)
        w.setframerate(SAMPLE_RATE)
        w.writeframes(pcm)
    return buf.getvalue()


class GnaniSpeech:
    """Gnani Vachana: Timbre v3 voices (every voice speaks every supported language, so the
    language is detected from the text) and Prisma v3 transcription.

    Gnani caps how many requests an account may have in flight (1 on the starter plan; a
    second one gets 429 at once), so every call waits its turn here. Conversations running
    in parallel share the cap; their LLM calls still overlap.
    """

    def __init__(self, api_key: str, max_parallel: int = 1) -> None:
        self._http = httpx.AsyncClient(
            base_url="https://api.vachana.ai",
            headers={"X-API-Key-ID": api_key},
            timeout=httpx.Timeout(30.0, connect=10.0),
        )
        self._gate = asyncio.Semaphore(max_parallel)

    async def aclose(self) -> None:
        await self._http.aclose()

    async def _post(self, what: str, url: str, **kwargs: Any) -> httpx.Response:
        for attempt in range(len(_RETRY_DELAYS) + 1):
            try:
                async with self._gate:
                    resp = await self._http.post(url, **kwargs)
            except httpx.HTTPError as exc:
                if attempt == len(_RETRY_DELAYS):
                    raise SpeechError(f"Gnani {what} failed: {type(exc).__name__}") from exc
            else:
                if resp.status_code not in _RETRY_STATUSES or attempt == len(_RETRY_DELAYS):
                    break
            await asyncio.sleep(_RETRY_DELAYS[attempt])
        if resp.status_code == 429:
            raise SpeechError(
                f"Gnani {what} was rate limited (HTTP 429): the account allows fewer requests "
                "at a time than narada sent. Lower GNANI_MAX_PARALLEL_REQUESTS."
            )
        if resp.status_code != 200:
            raise SpeechError(f"Gnani {what} failed (HTTP {resp.status_code})")
        return resp

    async def synthesize(self, text: str, voice: str) -> bytes:
        resp = await self._post(
            "text-to-speech",
            "/api/v1/tts/inference",
            json={
                "text": text,
                "voice": voice,
                "model": _TTS_MODEL,
                "language": "auto",
                "audio_config": {
                    "sample_rate": SAMPLE_RATE,
                    "num_channels": 1,
                    "sample_width": SAMPLE_WIDTH,
                    "encoding": "pcm_s16le",
                    "container": "raw",
                },
            },
        )
        pcm = resp.content
        return pcm[: len(pcm) - len(pcm) % SAMPLE_WIDTH]

    async def transcribe(self, pcm: bytes, language_codes: str) -> str:
        return (await self.listen(pcm, language_codes)).text

    async def listen(self, pcm: bytes, language_codes: str) -> Heard:
        """Transcript plus the language Gnani detected among `language_codes` (at most 4)."""
        # Long turns go in slices; a word cut at a slice edge is a real ASR failure mode too.
        parts = []
        detected: str | None = None
        for start in range(0, len(pcm), _STT_MAX_BYTES):
            resp = await self._post(
                "speech-to-text",
                "/stt/v3",
                data={
                    "model": _STT_MODEL,
                    "language_code": language_codes,
                    # English words stay in Latin and numbers become digits, like the
                    # transcripts a voice agent's LLM usually receives.
                    "format": "transcribe",
                },
                files={
                    "audio_file": (
                        "turn.wav",
                        pcm_to_wav(pcm[start : start + _STT_MAX_BYTES]),
                        "audio/wav",
                    )
                },
            )
            try:
                body = resp.json()
                parts.append(str(body["transcript"]).strip())
            except (ValueError, KeyError) as exc:
                raise SpeechError("Gnani speech-to-text returned an unexpected reply") from exc
            if detected is None and parts[-1]:
                detected = body.get("detected_language_code") or None
        return Heard(" ".join(p for p in parts if p), detected)
