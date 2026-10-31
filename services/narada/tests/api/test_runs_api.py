from app.domain.testing.models import ConversationStatus
from tests.conftest import (
    PLIVO_FLOW_ID,
    FakeLLM,
    FakeSpeech,
    definition_body,
    make_executor,
    review_json,
    scenario_json,
)


async def _ready_agent(client) -> str:
    created = await client.post(
        "/api/v1/agents",
        json={"name": "Screening", "vendor": "plivo", "assistantId": PLIVO_FLOW_ID},
    )
    agent_id = created.json()["id"]
    await client.put(f"/api/v1/agents/{agent_id}/definition", json=definition_body())
    return agent_id


def _use_llm(client, llm):
    state = client._transport.app.state
    state.run_executor = make_executor(llm, state.run_repo)
    return state.run_executor


async def test_situations_are_listed_for_a_described_agent(client):
    agent_id = await _ready_agent(client)
    data = (await client.get(f"/api/v1/agents/{agent_id}/situations")).json()
    ids = [s["id"] for s in data["situations"]]
    assert ids[:2] == ["ctc-monthly-variable", "silence"]
    assert "language-hinglish" in ids
    assert data["maxConversationsPerRun"] == 30


async def test_run_without_llm_is_503(client):
    agent_id = await _ready_agent(client)
    resp = await client.post(
        "/api/v1/runs", json={"agentId": agent_id, "situationIds": ["silence"]}
    )
    assert resp.status_code == 503
    assert resp.json() == {"detail": "llm_not_configured"}


async def test_run_plays_scores_and_reports_each_conversation(client):
    agent_id = await _ready_agent(client)
    llm = FakeLLM(
        agent=["Hi Rahul, your CTC?", "Thanks! [END_CALL]"] * 2,
        candidate=["1 lakh a month."] * 2,
        json={"candidate_scenario": scenario_json(), "call_review": review_json()},
    )
    executor = _use_llm(client, llm)

    resp = await client.post(
        "/api/v1/runs",
        json={"agentId": agent_id, "situationIds": ["silence", "callback"], "repeats": 1},
    )
    assert resp.status_code == 202
    run_id = resp.json()["id"]
    assert resp.json()["counts"]["pending"] == 2

    await executor.wait_idle()
    run = (await client.get(f"/api/v1/runs/{run_id}")).json()
    assert run["status"] == "completed"
    assert run["counts"] == {"total": 2, "passed": 2, "failed": 0, "errored": 0, "pending": 0}
    convo = run["conversations"][0]
    assert convo["status"] == ConversationStatus.PASSED
    assert convo["scenario"]["candidateName"] == "Rahul Verma"
    assert convo["transcript"][0] == {
        "speaker": "agent",
        "text": "Hi Rahul, your CTC?",
        "silent": False,
        "heard": None,
        "startMs": None,
        "endMs": None,
    }
    assert convo["answers"][0]["expected"] == "12"

    listed = (await client.get("/api/v1/runs", params={"agentId": agent_id})).json()["runs"]
    assert [r["id"] for r in listed] == [run_id]


async def test_a_broken_conversation_is_an_error_not_a_crash(client):
    agent_id = await _ready_agent(client)
    executor = _use_llm(client, FakeLLM(json={}))  # no scenario → KeyError inside the run
    run_id = (
        await client.post("/api/v1/runs", json={"agentId": agent_id, "situationIds": ["silence"]})
    ).json()["id"]
    await executor.wait_idle()
    run = (await client.get(f"/api/v1/runs/{run_id}")).json()
    assert run["status"] == "completed"
    assert run["conversations"][0]["status"] == "error"
    assert run["conversations"][0]["error"] == "Unexpected error in the test"


async def test_run_validation_errors_point_at_fields(client):
    agent_id = await _ready_agent(client)
    _use_llm(client, FakeLLM())
    resp = await client.post(
        "/api/v1/runs", json={"agentId": agent_id, "situationIds": [], "repeats": 1}
    )
    assert resp.status_code == 422
    assert resp.json()["errors"][0]["field"] == "situationIds"


async def test_unknown_run_is_404(client):
    resp = await client.get("/api/v1/runs/54b61663994926b449ebec6a")
    assert resp.status_code == 404
    assert resp.json() == {"detail": "run_not_found"}


def _use_voice(client, llm, speech):
    state = client._transport.app.state
    state.run_executor = make_executor(llm, state.run_repo, speech, state.recording_store)
    return state.run_executor


async def test_voice_run_without_gnani_is_503(client):
    agent_id = await _ready_agent(client)
    _use_llm(client, FakeLLM())
    situations = (await client.get(f"/api/v1/agents/{agent_id}/situations")).json()
    assert situations["voiceAvailable"] is False
    resp = await client.post(
        "/api/v1/runs", json={"agentId": agent_id, "situationIds": ["silence"], "mode": "voice"}
    )
    assert resp.status_code == 503
    assert resp.json() == {"detail": "speech_not_configured"}


async def test_voice_run_keeps_a_recording_and_what_the_agent_heard(client):
    agent_id = await _ready_agent(client)
    llm = FakeLLM(
        agent=["Hi Rahul, your CTC?", "Thanks! [END_CALL]"],
        candidate=["1 lakh a month."],
        json={"candidate_scenario": scenario_json(), "call_review": review_json()},
    )
    speech = FakeSpeech(mishear={"1 lakh": "one luck"})
    executor = _use_voice(client, llm, speech)
    assert (await client.get(f"/api/v1/agents/{agent_id}/situations")).json()["voiceAvailable"]

    run_id = (
        await client.post(
            "/api/v1/runs",
            json={"agentId": agent_id, "situationIds": ["silence"], "mode": "voice"},
        )
    ).json()["id"]
    await executor.wait_idle()

    run = (await client.get(f"/api/v1/runs/{run_id}")).json()
    assert run["mode"] == "voice"
    convo = run["conversations"][0]
    assert convo["status"] == "passed"
    assert convo["transcript"][1]["heard"] == "one luck a month."
    assert convo["transcript"][1]["startMs"] > convo["transcript"][0]["endMs"]
    assert convo["recording"]["agentVoice"] == "Shivani"
    assert convo["recording"]["durationMs"] == convo["transcript"][-1]["endMs"]
    review_brief = llm.calls[-1][1][0]["content"]
    assert "heard: one luck a month." in review_brief

    audio = await client.get(f"/api/v1/runs/{run_id}/conversations/{convo['id']}/recording")
    assert audio.status_code == 200
    assert audio.headers["content-type"] == "audio/wav"
    assert audio.content[:4] == b"RIFF"


async def test_speech_failure_keeps_the_partial_call(client):
    agent_id = await _ready_agent(client)
    llm = FakeLLM(
        agent=["Hi Rahul, your CTC?", "And notice period?", "Bye [END_CALL]"],
        candidate=["1 lakh a month.", "Two months."],
        json={"candidate_scenario": scenario_json(), "call_review": review_json()},
    )
    executor = _use_voice(client, llm, FakeSpeech(fail_after=2))
    run_id = (
        await client.post(
            "/api/v1/runs",
            json={"agentId": agent_id, "situationIds": ["silence"], "mode": "voice"},
        )
    ).json()["id"]
    await executor.wait_idle()

    convo = (await client.get(f"/api/v1/runs/{run_id}")).json()["conversations"][0]
    assert convo["status"] == "error"
    assert convo["error"] == "Gnani text-to-speech failed (HTTP 503)"
    assert [t["text"] for t in convo["transcript"]] == ["Hi Rahul, your CTC?", "1 lakh a month."]
    assert convo["recording"] is not None
    audio = await client.get(f"/api/v1/runs/{run_id}/conversations/{convo['id']}/recording")
    assert audio.status_code == 200


async def test_chat_runs_have_no_recording(client):
    agent_id = await _ready_agent(client)
    llm = FakeLLM(json={"candidate_scenario": scenario_json(), "call_review": review_json()})
    executor = _use_llm(client, llm)
    run_id = (
        await client.post("/api/v1/runs", json={"agentId": agent_id, "situationIds": ["silence"]})
    ).json()["id"]
    await executor.wait_idle()
    convo = (await client.get(f"/api/v1/runs/{run_id}")).json()["conversations"][0]
    assert convo["recording"] is None
    resp = await client.get(f"/api/v1/runs/{run_id}/conversations/{convo['id']}/recording")
    assert resp.status_code == 404
    assert resp.json() == {"detail": "recording_not_found"}
