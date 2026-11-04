import asyncio
import io
import wave

import httpx

from app.domain.testing.models import Speaker
from app.domain.testing.rules import build_scenario
from app.domain.testing.situations import situations_for
from app.integrations.speech import BYTES_PER_MS, GnaniSpeech
from app.services.testing.simulator import simulate
from app.services.testing.voice_line import (
    SILENCE_MS,
    TURN_GAP_MS,
    VoiceLine,
    candidate_voice,
    stt_language_codes,
)
from tests.conftest import FakeLLM, FakeSpeech, make_definition

DEFINITION = make_definition(prompt="Hi {{name}}. You screen candidates.")
SITUATION = next(s for s in situations_for(DEFINITION) if s.id == "silence")
SCENARIO = build_scenario(
    DEFINITION, "Rahul", "dev", "English", {"name": "Rahul"}, {"current_ctc": ("1L", "12")}, "", ""
)


def _line(speech: FakeSpeech) -> VoiceLine:
    return VoiceLine(
        speech, agent_voice="Shivani", candidate_voice="Devansh", language_codes="hi-IN,en-IN"
    )


async def test_the_agent_only_receives_what_speech_recognition_heard():
    speech = FakeSpeech(mishear={"11.5 lakh": "11 lakh"})
    llm = FakeLLM(
        agent=["What is your CTC?", "Got it, 11 lakh. Bye! [END_CALL]"],
        candidate=["It is 11.5 lakh."],
    )
    transcript, _ = await simulate(llm, DEFINITION, SCENARIO, SITUATION, 10, line=_line(speech))

    candidate = transcript[1]
    assert candidate.text == "It is 11.5 lakh."
    assert candidate.heard == "It is 11 lakh."
    _, agent_messages = llm.calls[-1]
    assert agent_messages[-1] == {"role": "user", "content": "It is 11 lakh."}
    assert transcript[0].heard is None  # agent turns are not transcribed
    assert speech.spoken[0] == ("Shivani", "What is your CTC?")
    assert speech.spoken[1] == ("Devansh", "It is 11.5 lakh.")


async def test_turns_are_laid_end_to_end_in_one_recording():
    speech = FakeSpeech()
    line = _line(speech)
    llm = FakeLLM(agent=["Hello?", "Are you there? [END_CALL]"], candidate=["(silence)"])
    transcript, _ = await simulate(llm, DEFINITION, SCENARIO, SITUATION, 10, line=line)

    first, silence, last = transcript
    assert first.start_ms == 0
    assert silence.silent and silence.heard is None
    assert silence.start_ms == first.end_ms + TURN_GAP_MS
    assert silence.end_ms - silence.start_ms == SILENCE_MS
    assert last.start_ms == silence.end_ms + TURN_GAP_MS
    assert line.duration_ms == last.end_ms

    with wave.open(io.BytesIO(line.wav())) as w:
        assert w.getframerate() == 16_000
        assert w.getnframes() * 2 == line.duration_ms * BYTES_PER_MS
    assert line.recording().candidate_voice == "Devansh"


async def test_nothing_heard_reaches_the_agent_as_silence():
    speech = FakeSpeech(mishear={"mm-hmm": ""})
    llm = FakeLLM(agent=["Still there?", "Bye [END_CALL]"], candidate=["mm-hmm"])
    transcript, _ = await simulate(llm, DEFINITION, SCENARIO, SITUATION, 10, line=_line(speech))
    assert transcript[1].heard == ""
    assert llm.calls[-1][1][-1] == {"role": "user", "content": "(silence)"}


async def test_markdown_is_not_read_out():
    speech = FakeSpeech()
    await _line(speech).agent_says("**Great**, thanks!")
    assert speech.spoken == [("Shivani", "Great, thanks!")]


async def test_chat_mode_turns_carry_no_audio_fields():
    llm = FakeLLM(agent=["Hi?", "Bye [END_CALL]"], candidate=["Hello"])
    transcript, _ = await simulate(llm, DEFINITION, SCENARIO, SITUATION, 10)
    assert all(t.heard is None and t.start_ms is None for t in transcript)
    assert transcript[1].speaker is Speaker.CANDIDATE


def test_candidate_voice_is_stable_and_never_the_agents():
    first = candidate_voice("female", "abc", "Shivani")
    assert candidate_voice("female", "abc", "Shivani") == first
    picked = {candidate_voice("female", str(i), "Shivani") for i in range(50)}
    assert "Shivani" not in picked and len(picked) > 1
    assert candidate_voice("", "abc", "Shivani") in {
        "Devansh",
        "Shubham",
        "Yashraj",
        "Avinash",
        "Prakash",
        "Harshad",
    }


def test_language_hints_follow_the_agents_languages():
    assert stt_language_codes(("English", "Hinglish")) == "en-IN,hi-IN"
    assert stt_language_codes(("Tamil",)) == "ta-IN"
    assert stt_language_codes(("Klingon",)) == "hi-IN,en-IN"
    many = ("English", "Hindi", "Tamil", "Telugu", "Kannada")
    assert len(stt_language_codes(many).split(",")) == 4


async def test_gnani_requests_wait_their_turn():
    in_flight = peak = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal in_flight, peak
        in_flight += 1
        peak = max(peak, in_flight)
        await asyncio.sleep(0.01)
        in_flight -= 1
        return httpx.Response(200, content=b"\x00\x00" * 160)

    speech = GnaniSpeech("test-key", max_parallel=1)
    speech._http = httpx.AsyncClient(
        base_url="https://api.vachana.ai", transport=httpx.MockTransport(handler)
    )
    await asyncio.gather(*(speech.synthesize("hi", "Shivani") for _ in range(4)))
    await speech.aclose()
    assert peak == 1


class _ListeningSpeech(FakeSpeech):
    """Keeps the audio handed to speech recognition instead of decoding it."""

    def __init__(self) -> None:
        super().__init__()
        self.transcribed: list[bytes] = []

    async def transcribe(self, pcm: bytes, language_codes: str) -> str:
        self.transcribed.append(pcm)
        return "heard something"


async def test_noisy_line_degrades_what_recognition_and_the_recording_get():
    speech = _ListeningSpeech()
    line = VoiceLine(
        speech,
        agent_voice="Shivani",
        candidate_voice="Devansh",
        language_codes="hi-IN,en-IN",
        noisy_line_seed=42,
    )
    clean = await speech.synthesize("My CTC is 12 lakh.", "Devansh")
    heard, start, end = await line.candidate_says("My CTC is 12 lakh.")
    assert heard == "heard something"
    assert speech.transcribed[0] != clean and len(speech.transcribed[0]) == len(clean)
    with wave.open(io.BytesIO(line.wav())) as w:
        assert w.readframes(w.getnframes()) == speech.transcribed[0]


async def test_clean_line_sends_the_audio_as_spoken():
    speech = _ListeningSpeech()
    clean = await speech.synthesize("Hello", "Devansh")
    await _line(speech).candidate_says("Hello")
    assert speech.transcribed == [clean]
