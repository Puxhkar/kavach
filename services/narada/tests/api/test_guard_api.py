import base64
import io
import wave

import pytest

from app.integrations.speech import BYTES_PER_MS, pcm_to_wav
from app.persistence.recordings import LocalRecordingStore
from app.persistence.repositories.guard_repo import InMemoryGuardRepo
from app.services.guard.guard_service import GuardService
from tests.conftest import NOW, FakeSpeech

TRIAGE_SCAM = {
    "callerName": "Inspector Sharma",
    "organisation": "CBI",
    "purpose": "Says Aadhaar was used for a drugs parcel",
    "category": "other",
    "priority": "urgent",
    "scamRisk": 92,
    "redFlags": ["threatened arrest", "asked for bank details"],
    "callback": "Told after 6 PM",
    "summary": "Fake police call.",
    "action": "Ignore; don't call back",
}
TRIAGE_MOM = {
    **TRIAGE_SCAM,
    "callerName": "Mom",
    "organisation": "",
    "purpose": "Papa has fever",
    "category": "family",
    "priority": "normal",
    "scamRisk": 2,
    "redFlags": [],
    "action": "Call Mom back now",
}
DRILL = {
    "checks": [
        {"id": "no_otp", "passed": True, "detail": "Never gave the OTP"},
        {"id": "no_payment", "passed": True, "detail": "Refused to pay"},
        {"id": "no_app", "passed": True, "detail": "No app installed"},
        {"id": "no_details", "passed": True, "detail": "Shared nothing"},
        {"id": "questioned", "passed": True, "detail": "Asked for the officer's ID"},
        {"id": "ended", "passed": False, "detail": "Kept talking"},
    ],
    "tips": ["Hang up and call the official number.", "Police never ask for money on calls."],
    "familyMessage": "Mummy ne aaj fake police call ko pehchaan liya!",
}


class GuardLLM:
    """Scripts per role, picked from the system prompt; JSON by schema name."""

    def __init__(self, assistant=(), caller=(), scammer=(), json=None):
        self.scripts = {
            "assistant": list(assistant),
            "caller": list(caller),
            "scammer": list(scammer),
        }
        self.json = dict(json or {})
        self.seen: list[tuple[str, list[dict]]] = []

    async def reply(self, system, messages, max_tokens):
        self.seen.append((system, list(messages)))
        role = (
            "scammer"
            if "scam-awareness training" in system
            else "caller"
            if system.startswith("You are playing a phone caller")
            else "recipient"
            if "it is " in system and "calling on their behalf" in system
            else "assistant"
        )
        script = self.scripts.setdefault(role, [])
        return script.pop(0) if script else "Theek hai. [END_CALL]"

    async def reply_json(self, system, messages, schema_name, schema, max_tokens):
        self.seen.append((system, list(messages)))
        value = self.json[schema_name]
        return value.pop(0) if isinstance(value, list) else value


def _wav_of(text: str) -> bytes:
    """FakeSpeech "hears" the text bytes of whatever audio it gets."""
    audio = text.encode()
    chunk = 100 * BYTES_PER_MS
    return pcm_to_wav(audio + bytes(-len(audio) % chunk))


@pytest.fixture
def use_guard(client, tmp_path):
    from main import app

    def install(llm, speech=None):
        service = GuardService(
            InMemoryGuardRepo(),
            llm,
            speech if speech is not None else FakeSpeech(),
            LocalRecordingStore(tmp_path / "rec"),
            clock=lambda: NOW,
        )
        app.state.guard_service = service
        return service

    return install


async def test_profile_round_trips_and_reports_field_errors(client, use_guard):
    use_guard(GuardLLM())
    resp = await client.get("/api/v1/guard/profile")
    profile = resp.json()
    assert profile["ownerName"] == "Ganesh" and profile["language"] == "English"
    assert profile["listenLanguages"] == ["English", "Hindi", "Kannada", "Tamil"]
    assert "Hinglish" in profile["languages"] and "Hinglish" not in profile["listenOptions"]
    body = {
        "ownerName": "Asha",
        "availability": "after lunch",
        "language": "Kannada",
        "vipContacts": [{"name": "Appa", "relation": "father"}],
        "notes": "",
        "listenLanguages": ["Kannada", "English"],
    }
    assert (await client.put("/api/v1/guard/profile", json=body)).json()["ownerName"] == "Asha"
    bad = await client.put("/api/v1/guard/profile", json={**body, "availability": " "})
    assert bad.status_code == 422
    assert bad.json()["errors"][0]["field"] == "availability"


async def test_a_simulated_scam_call_is_blocked_with_red_flags_and_a_recording(client, use_guard):
    llm = GuardLLM(
        assistant=[
            "Namaste, main Ganesh ki assistant. Kaun bol raha hai?",
            "Ganesh 6 baje ke baad call karenge. [END_CALL]",
        ],
        caller=["Main CBI se Inspector Sharma. Unke Aadhaar pe drugs ka parcel hai."],
        json={"call_triage": TRIAGE_SCAM},
    )
    service = use_guard(llm)
    resp = await client.post("/api/v1/guard/calls/simulate", json={"scenarioId": "digital-arrest"})
    assert resp.status_code == 202 and resp.json()["status"] == "running"
    await service.wait_idle()

    call = (await client.get(f"/api/v1/guard/calls/{resp.json()['id']}")).json()
    assert call["status"] == "done"
    assert [t["speaker"] for t in call["transcript"]] == ["ai", "person", "ai"]
    assert call["transcript"][1]["heard"].startswith("Main CBI")
    triage = call["triage"]
    assert (triage["category"], triage["priority"]) == ("scam", "blocked")
    assert triage["redFlags"] == ["threatened arrest", "asked for bank details"]
    assert call["hasRecording"]
    rec = await client.get(f"/api/v1/guard/calls/{call['id']}/recording")
    assert rec.status_code == 200 and rec.content[:4] == b"RIFF"
    # The assistant was told who it works for and when the owner is free.
    assert "Ganesh" in llm.seen[0][0] and "after 6 PM today" in llm.seen[0][0]


async def test_inbox_lists_family_before_a_blocked_scam(client, use_guard):
    service = use_guard(
        GuardLLM(
            assistant=["Hello?", "Okay. [END_CALL]", "Hello?", "Okay. [END_CALL]"],
            caller=["Main CBI se bol raha hoon.", "Beta, main Mummy bol rahi hoon."],
            json={"call_triage": [TRIAGE_SCAM, TRIAGE_MOM]},
        )
    )
    await client.post("/api/v1/guard/calls/simulate", json={"scenarioId": "digital-arrest"})
    await service.wait_idle()
    await client.post("/api/v1/guard/calls/simulate", json={"scenarioId": "family-urgent"})
    await service.wait_idle()
    calls = (await client.get("/api/v1/guard/calls")).json()["calls"]
    assert [c["triage"]["priority"] for c in calls] == ["high", "blocked"]
    assert calls[0]["triage"]["vip"] is True


async def test_unknown_scenario_and_missing_llm(client, use_guard):
    use_guard(GuardLLM())
    resp = await client.post("/api/v1/guard/calls/simulate", json={"scenarioId": "nope"})
    assert resp.status_code == 404 and resp.json()["detail"] == "scenario_not_found"
    use_guard(None)
    resp = await client.post("/api/v1/guard/calls/simulate", json={"scenarioId": "kyc-otp"})
    assert resp.status_code == 503 and resp.json()["detail"] == "llm_not_configured"


async def test_a_live_call_hears_the_person_and_lands_in_the_inbox(client, use_guard):
    llm = GuardLLM(
        assistant=[
            "Hello, Ganesh ki assistant bol rahi hoon. Aap kaun?",
            "Theek hai Neha ji, Ganesh 6 baje ke baad call karenge. [END_CALL]",
        ],
        json={"call_triage": {**TRIAGE_MOM, "callerName": "Neha", "category": "work"}},
    )
    service = use_guard(llm)
    start = await client.post("/api/v1/guard/live", json={"kind": "screener"})
    body = start.json()
    assert body["reply"]["text"].startswith("Hello") and body["ended"] is False
    with wave.open(io.BytesIO(base64.b64decode(body["reply"]["audioBase64"]))) as w:
        assert w.getframerate() == 16_000 and w.getnframes() > 0

    turn = await client.post(
        f"/api/v1/guard/live/{body['liveId']}/turn",
        files={"audio": ("turn.wav", _wav_of("Main Neha, TalentBridge se."), "audio/wav")},
    )
    assert turn.json()["heard"] == "Main Neha, TalentBridge se."
    assert turn.json()["ended"] is True
    # The assistant got exactly what was heard, and which language to answer in.
    assert llm.seen[-1][1][-1] == {
        "role": "user",
        "content": "Main Neha, TalentBridge se.\n[Reply only in English.]",
    }

    end = await client.post(f"/api/v1/guard/live/{body['liveId']}/end", json={"hungUp": False})
    assert end.json()["kind"] == "screener"
    await service.wait_idle()
    call = (await client.get(f"/api/v1/guard/calls/{end.json()['id']}")).json()
    assert (call["source"], call["status"]) == ("live", "done")
    assert (call["triage"]["callerName"], call["triage"]["category"]) == ("Neha", "work")
    again = await client.post(f"/api/v1/guard/live/{body['liveId']}/end", json={})
    assert again.status_code == 404 and again.json()["detail"] == "live_not_found"


async def test_a_turn_that_is_not_16k_mono_wav_is_refused(client, use_guard):
    use_guard(GuardLLM(assistant=["Hello?"]))
    live_id = (await client.post("/api/v1/guard/live", json={"kind": "screener"})).json()["liveId"]
    for audio in (b"not audio", _stereo_wav()):
        resp = await client.post(
            f"/api/v1/guard/live/{live_id}/turn", files={"audio": ("t.wav", audio, "audio/wav")}
        )
        assert resp.status_code == 422 and resp.json()["detail"] == "audio_invalid"


def _stereo_wav() -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(16_000)
        w.writeframes(bytes(3200))
    return buf.getvalue()


async def test_a_scam_drill_is_scored_and_hanging_up_counts(client, use_guard):
    llm = GuardLLM(
        scammer=["Main CBI se bol raha hoon, aapka Aadhaar drugs case mein hai.", "Aap pachtaoge."],
        json={"drill_score": DRILL},
    )
    service = use_guard(llm)
    start = await client.post(
        "/api/v1/guard/live",
        json={"kind": "drill", "scamId": "digital-arrest", "practicerName": "Mummy"},
    )
    live_id = start.json()["liveId"]
    assert "Mummy" in llm.seen[0][0]
    await client.post(
        f"/api/v1/guard/live/{live_id}/turn",
        files={"audio": ("t.wav", _wav_of("Aapka ID number kya hai?"), "audio/wav")},
    )
    end = await client.post(f"/api/v1/guard/live/{live_id}/end", json={"hungUp": True})
    assert end.json()["kind"] == "drill"
    await service.wait_idle()

    drill = (await client.get(f"/api/v1/guard/drills/{end.json()['id']}")).json()
    assert drill["status"] == "done" and drill["hungUp"] is True
    result = drill["result"]
    assert (result["score"], result["verdict"]) == (100, "safe")
    assert result["checks"][-1]["detail"] == "Hung up on the caller."
    assert result["familyMessage"].startswith("Mummy")
    assert (await client.get("/api/v1/guard/drills")).json()["drills"][0]["id"] == drill["id"]
    rec = await client.get(f"/api/v1/guard/drills/{drill['id']}/recording")
    assert rec.status_code == 200


async def test_a_drill_needs_a_known_scam_and_live_calls_need_speech(client, use_guard):
    use_guard(GuardLLM())
    resp = await client.post(
        "/api/v1/guard/live", json={"kind": "drill", "scamId": "family-urgent"}
    )
    assert resp.status_code == 404
    from main import app

    app.state.guard_service = GuardService(
        InMemoryGuardRepo(), GuardLLM(), None, None, clock=lambda: NOW
    )
    resp = await client.post("/api/v1/guard/live", json={"kind": "screener"})
    assert resp.status_code == 503 and resp.json()["detail"] == "speech_not_configured"


async def test_a_caller_who_says_nothing_is_low_priority_without_asking_the_model(
    client, use_guard
):
    llm = GuardLLM(assistant=["Hello, kaun bol raha hai?"])
    service = use_guard(llm)
    live_id = (await client.post("/api/v1/guard/live", json={"kind": "screener"})).json()["liveId"]
    end = await client.post(f"/api/v1/guard/live/{live_id}/end", json={"hungUp": True})
    await service.wait_idle()
    call = (await client.get(f"/api/v1/guard/calls/{end.json()['id']}")).json()
    assert (call["triage"]["callerName"], call["triage"]["priority"]) == ("Silent caller", "low")
    assert not llm.json  # no triage request was made


async def test_a_malformed_body_uses_the_same_error_shape(client, use_guard):
    use_guard(GuardLLM())
    resp = await client.put(
        "/api/v1/guard/profile",
        json={
            "ownerName": "x" * 200,
            "availability": "6 PM",
            "language": "Hindi",
            "listenLanguages": ["Hindi"],
        },
    )
    assert resp.status_code == 422 and resp.json()["detail"] == "validation_failed"
    assert resp.json()["errors"][0]["field"] == "ownerName"


async def test_the_assistant_greets_in_english_then_follows_the_callers_language(client, use_guard):
    llm = GuardLLM(assistant=["Hello, Ganesh's assistant here. Who is calling?", "ಸರಿ, ಧನ್ಯವಾದ."])
    use_guard(llm)
    start = (await client.post("/api/v1/guard/live", json={"kind": "screener"})).json()
    assert start["reply"]["language"] == "English"
    turn = await client.post(
        f"/api/v1/guard/live/{start['liveId']}/turn",
        files={"audio": ("t.wav", _wav_of("ನಮಸ್ಕಾರ, ನಾನು ರವಿ."), "audio/wav")},
    )
    body = turn.json()
    assert (body["heardLanguage"], body["reply"]["language"]) == ("Kannada", "Kannada")
    # The second reply was written under Kannada instructions.
    assert "Speak Kannada" in llm.seen[-1][0]


async def test_an_errand_asks_the_language_then_delivers_the_message_in_it(client, use_guard):
    llm = GuardLLM(
        assistant=["ಸರಿ, ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡುತ್ತೇನೆ. ಗಣೇಶ್ ಹೇಳಿದ್ದಾರೆ: ವರದಿಯನ್ನು ಇಂದು ಕಳುಹಿಸಿ."],
        json={
            "errand_report": {
                "outcome": "agreed",
                "commitment": "will send it by 5 PM",
                "concerns": [],
                "summary": "Neha will send the report by 5 PM.",
                "nextStep": "Check your email at 5 PM.",
            }
        },
    )
    service = use_guard(llm)
    created = await client.post(
        "/api/v1/guard/errands",
        json={
            "recipientName": "Neha",
            "recipientRole": "team member",
            "task": "Send the quarterly report",
            "deadline": "today EOD",
        },
    )
    assert created.status_code == 201 and created.json()["status"] == "pending"
    errand_id = created.json()["id"]

    start = await client.post("/api/v1/guard/live", json={"kind": "errand", "errandId": errand_id})
    opener = start.json()["reply"]
    assert "Neha" in opener["text"] and "Which language" in opener["text"]
    assert opener["language"] == "English"
    # Asked in English, answered with the language's name in English: that decides it.
    turn = await client.post(
        f"/api/v1/guard/live/{start.json()['liveId']}/turn",
        files={"audio": ("t.wav", _wav_of("Kannada please"), "audio/wav")},
    )
    assert turn.json()["reply"]["language"] == "Kannada"
    system = llm.seen[-1][0]
    assert "Send the quarterly report" in system and "today EOD" in system
    end = await client.post(f"/api/v1/guard/live/{start.json()['liveId']}/end", json={})
    assert end.json() == {"kind": "errand", "id": errand_id}
    await service.wait_idle()

    errand = (await client.get(f"/api/v1/guard/errands/{errand_id}")).json()
    assert (errand["status"], errand["source"], errand["language"]) == ("done", "live", "Kannada")
    assert errand["report"]["outcome"] == "agreed"
    assert [t["language"] for t in errand["transcript"]] == ["English", "English", "Kannada"]
    assert errand["hasRecording"]


async def test_a_simulated_recipient_answers_in_their_language(client, use_guard):
    llm = GuardLLM(
        assistant=["சரி, தமிழில் பேசுகிறேன். அறிக்கையை இன்று அனுப்புங்கள். [END_CALL]"],
        json={
            "errand_report": {
                "outcome": "needs_follow_up",
                "commitment": "",
                "concerns": ["needs one more day"],
                "summary": "s",
                "nextStep": "n",
            }
        },
    )
    llm.scripts["recipient"] = ["தமிழ் தான் வசதி."]
    service = use_guard(llm)
    errand_id = (
        await client.post(
            "/api/v1/guard/errands", json={"recipientName": "Neha", "task": "Send the report"}
        )
    ).json()["id"]
    resp = await client.post(
        f"/api/v1/guard/errands/{errand_id}/simulate",
        json={"language": "Tamil", "behaviour": "needs_time"},
    )
    assert resp.status_code == 202
    await service.wait_idle()
    errand = (await client.get(f"/api/v1/guard/errands/{errand_id}")).json()
    assert (errand["language"], errand["report"]["outcome"]) == ("Tamil", "needs_follow_up")
    assert errand["transcript"][1]["language"] == "Tamil"
    bad = await client.post(
        f"/api/v1/guard/errands/{errand_id}/simulate", json={"language": "Telugu"}
    )
    assert bad.status_code == 422


async def test_an_errand_needs_someone_and_something_to_say(client, use_guard):
    use_guard(GuardLLM())
    resp = await client.post("/api/v1/guard/errands", json={"recipientName": " ", "task": ""})
    assert {e["field"] for e in resp.json()["errors"]} == {"recipientName", "task"}
    missing = await client.get("/api/v1/guard/errands/nope")
    assert missing.status_code == 404 and missing.json()["detail"] == "errand_not_found"
