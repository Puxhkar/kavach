"""The audio side of a voice-mode conversation.

Every line is spoken with Gnani; the candidate's audio is transcribed back, and that
transcript — not what the candidate meant to say — is what the agent receives. All clips
are laid end to end into one recording, and each turn remembers where it sits in it.

This is still the agent's prompt on our LLM, not the deployed agent on a phone line, so
barge-in and real network latency do not show up here; mishearing does.
"""

from __future__ import annotations

import asyncio
import re
import zlib

from app.domain.testing.models import Recording
from app.integrations.speech import BYTES_PER_MS, SpeechClient, pcm_to_wav
from app.services.testing.phone_line import degrade

# Pause between two turns, and how long a "(silence)" turn lasts in the recording.
TURN_GAP_MS = 500
SILENCE_MS = 4000

# Timbre v3 voices; each speaks every supported language.
CANDIDATE_VOICES = {
    "male": ("Devansh", "Shubham", "Yashraj", "Avinash", "Prakash", "Harshad"),
    "female": ("Kalpana", "Chetana", "Lakshmi", "Tarika", "Vasudha", "Riyaa", "Shivani"),
}

# Agent languages → Prisma v3 language hints. Hinglish is Hindi and English together.
_STT_CODES = {
    "english": ("en-IN",),
    "hindi": ("hi-IN",),
    "hinglish": ("hi-IN", "en-IN"),
    "tamil": ("ta-IN",),
    "telugu": ("te-IN",),
    "kannada": ("kn-IN",),
    "malayalam": ("ml-IN",),
    "marathi": ("mr-IN",),
    "bengali": ("bn-IN",),
    "gujarati": ("gu-IN",),
    "punjabi": ("pa-IN",),
}
_MAX_STT_CODES = 4

# Markdown an LLM sometimes adds; a voice would read the symbols out.
_UNSPOKEN_RE = re.compile(r"[*_#`]+")


def candidate_voice(gender: str, seed: str, agent_voice: str) -> str:
    """Stable per conversation, never the agent's own voice."""
    pool = [v for v in CANDIDATE_VOICES.get(gender, CANDIDATE_VOICES["male"]) if v != agent_voice]
    return pool[zlib.crc32(seed.encode()) % len(pool)]


def stt_language_codes(languages: tuple[str, ...]) -> str:
    codes: list[str] = []
    for language in languages:
        for code in _STT_CODES.get(language.lower(), ()):
            if code not in codes:
                codes.append(code)
    return ",".join(codes[:_MAX_STT_CODES]) or "hi-IN,en-IN"


class VoiceLine:
    def __init__(
        self,
        speech: SpeechClient,
        *,
        agent_voice: str,
        candidate_voice: str,
        language_codes: str,
        noisy_line_seed: int | None = None,
    ) -> None:
        self._speech = speech
        # Set for the noisy-line situation: the candidate's audio is degraded before it is
        # transcribed, and the recording keeps the degraded version.
        self._noisy_line_seed = noisy_line_seed
        self._agent_voice = agent_voice
        self._candidate_voice = candidate_voice
        self._language_codes = language_codes
        self._pcm = bytearray()
        # What speech recognition detected in the other side's last turn, e.g. "kn-IN".
        self.last_language_code: str | None = None

    @property
    def language_codes(self) -> str:
        return self._language_codes

    @language_codes.setter
    def language_codes(self, codes: str) -> None:
        self._language_codes = codes

    @property
    def duration_ms(self) -> int:
        return len(self._pcm) // BYTES_PER_MS

    def _append(self, pcm: bytes) -> tuple[int, int]:
        if self._pcm:
            self._pcm.extend(bytes(TURN_GAP_MS * BYTES_PER_MS))
        start = self.duration_ms
        self._pcm.extend(pcm)
        return start, self.duration_ms

    async def agent_says(self, text: str) -> tuple[int, int]:
        spoken = _UNSPOKEN_RE.sub("", text).strip()
        pcm = await self._speech.synthesize(spoken, self._agent_voice) if spoken else b""
        return self._append(pcm)

    async def candidate_says(self, text: str) -> tuple[str, int, int]:
        """Returns what the agent's speech recognition heard, and the turn's position."""
        pcm = await self._speech.synthesize(text, self._candidate_voice)
        return await self.candidate_audio(pcm)

    async def candidate_audio(self, pcm: bytes) -> tuple[str, int, int]:
        """The other side's turn as audio: a synthesized line, or a person's recording."""
        if self._noisy_line_seed is not None:
            seed = self._noisy_line_seed + self.duration_ms
            pcm = await asyncio.to_thread(degrade, pcm, seed)
        heard = await self._speech.listen(pcm, self._language_codes)
        self.last_language_code = heard.language_code
        start, end = self._append(pcm)
        return heard.text, start, end

    def candidate_silent(self) -> tuple[int, int]:
        return self._append(bytes(SILENCE_MS * BYTES_PER_MS))

    def recording(self) -> Recording:
        return Recording(
            agent_voice=self._agent_voice,
            candidate_voice=self._candidate_voice,
            duration_ms=self.duration_ms,
        )

    def wav(self) -> bytes:
        return pcm_to_wav(bytes(self._pcm))

    def clip_wav(self, start_ms: int, end_ms: int) -> bytes:
        """One turn of the recording, e.g. to play the agent's line back in a browser."""
        return pcm_to_wav(bytes(self._pcm[start_ms * BYTES_PER_MS : end_ms * BYTES_PER_MS]))
