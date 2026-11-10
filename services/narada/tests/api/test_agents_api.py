from tests.conftest import PLIVO_FLOW_ID, definition_body


async def _create(client, **overrides):
    body = {"name": "Candidate Screening", "vendor": "plivo", "assistantId": PLIVO_FLOW_ID}
    body.update(overrides)
    return await client.post("/api/v1/agents", json=body)


async def test_create_returns_agent_waiting_for_describe(client):
    resp = await _create(client)
    assert resp.status_code == 201
    data = resp.json()
    assert data["setup"] == {"connectDone": True, "describeDone": False, "nextStep": "describe"}
    assert data["definition"] is None
    assert data["promptVersion"] is None


async def test_create_rejects_bad_flow_id_on_the_field(client):
    resp = await _create(client, assistantId="flow-123")
    assert resp.status_code == 422
    assert resp.json()["errors"][0]["field"] == "assistantId"


async def test_create_rejects_unknown_vendor(client):
    resp = await _create(client, vendor="twilio")
    assert resp.status_code == 422


async def test_describe_makes_agent_ready_with_prompt_version_one(client):
    agent_id = (await _create(client)).json()["id"]
    resp = await client.put(f"/api/v1/agents/{agent_id}/definition", json=definition_body())
    assert resp.status_code == 200
    data = resp.json()
    assert data["setup"]["nextStep"] == "ready"
    assert data["promptVersion"] == 1
    assert data["answersCount"] == 1
    assert data["definition"]["answers"][0]["format"] == "amount_lpa"


async def test_editing_the_prompt_cuts_a_new_version(client):
    agent_id = (await _create(client)).json()["id"]
    url = f"/api/v1/agents/{agent_id}/definition"
    await client.put(url, json=definition_body())
    same = await client.put(url, json=definition_body(languages=["Telugu"]))
    assert same.json()["promptVersion"] == 1
    changed = await client.put(url, json=definition_body(prompt="A different prompt"))
    assert changed.json()["promptVersion"] == 2
    assert [v["version"] for v in changed.json()["promptVersions"]] == [1, 2]


async def test_describe_errors_point_at_fields(client):
    agent_id = (await _create(client)).json()["id"]
    body = definition_body(
        callInputs=[{"key": "current_ctc", "label": "CTC"}],
        answers=[
            {"key": "current_ctc", "question": "What is your CTC?", "format": "amount_lpa"},
        ],
    )
    resp = await client.put(f"/api/v1/agents/{agent_id}/definition", json=body)
    assert resp.status_code == 422
    assert resp.json()["errors"] == [
        {
            "field": "answers.0.key",
            "message": "'current_ctc' is already a call input. An answer is collected from "
            "the candidate; a call input is sent into the call",
        }
    ]


async def test_update_connection(client):
    agent_id = (await _create(client)).json()["id"]
    resp = await client.put(
        f"/api/v1/agents/{agent_id}/connection",
        json={"name": "Renamed", "vendor": "vapi", "assistantId": PLIVO_FLOW_ID.upper()},
    )
    assert resp.status_code == 200
    assert resp.json()["vendor"] == "vapi"
    assert resp.json()["assistantId"] == PLIVO_FLOW_ID


async def test_list_and_get(client):
    agent_id = (await _create(client)).json()["id"]
    listed = (await client.get("/api/v1/agents")).json()["agents"]
    assert [a["id"] for a in listed] == [agent_id]
    assert (await client.get(f"/api/v1/agents/{agent_id}")).json()["name"] == "Candidate Screening"


async def test_unknown_agent_is_404(client):
    resp = await client.get("/api/v1/agents/54b61663994926b449ebec6a")
    assert resp.status_code == 404
    assert resp.json() == {"detail": "agent_not_found"}


async def test_options_list_the_form_choices(client):
    data = (await client.get("/api/v1/agents/options")).json()
    assert data["vendors"] == ["plivo", "vapi"]
    assert "amount_lpa" in data["answerFormats"]
    assert "Telugu" in data["languages"]


async def test_pasting_a_prompt_creates_an_agent_ready_to_test(client):
    from main import app
    from tests.conftest import FakeLLM

    app.state.llm = FakeLLM(
        json={
            "agent_draft": {
                "name": "Screening Caller",
                "answers": [
                    {
                        "key": "notice_period",
                        "question": "Notice period?",
                        "format": "duration_days",
                        "required": True,
                        "choices": [],
                    }
                ],
                "rules": [{"kind": "must", "text": "Ask one question at a time"}],
                "callEnding": "Thank them and end the call.",
                "inputExamples": [{"key": "name", "example": "Rahul"}],
            }
        }
    )
    try:
        resp = await client.post(
            "/api/v1/agents/quick",
            json={
                "prompt": "Call {{name}} and ask their notice period.",
                "languages": ["English", "Kannada"],
            },
        )
        assert resp.status_code == 201
        agent = resp.json()
        assert (agent["name"], agent["vendor"], agent["setup"]["nextStep"]) == (
            "Screening Caller",
            "none",
            "ready",
        )
        assert agent["definition"]["callInputs"][0]["key"] == "name"
        assert agent["definition"]["languages"] == ["English", "Kannada"]
        situations = (await client.get(f"/api/v1/agents/{agent['id']}/situations")).json()[
            "situations"
        ]
        assert any(s["id"] == "switch-hinglish-kannada" for s in situations)
        empty = await client.post("/api/v1/agents/quick", json={"prompt": "  "})
        assert empty.status_code == 422 and empty.json()["errors"][0]["field"] == "prompt"
    finally:
        app.state.llm = None
    no_llm = await client.post("/api/v1/agents/quick", json={"prompt": "Hello"})
    assert no_llm.status_code == 503 and no_llm.json()["detail"] == "llm_not_configured"


async def test_a_failing_language_model_gives_a_clear_error_not_a_crash(client):
    from app.integrations.llm import LLMError
    from main import app

    class BrokenLLM:
        async def reply_json(self, *args, **kwargs):
            raise LLMError("The language model call failed: NotFoundError")

    app.state.llm = BrokenLLM()
    try:
        resp = await client.post("/api/v1/agents/quick", json={"prompt": "Call {{name}}."})
        assert resp.status_code == 502
        assert resp.json() == {
            "detail": "llm_failed",
            "message": "The language model call failed: NotFoundError",
        }
    finally:
        app.state.llm = None
