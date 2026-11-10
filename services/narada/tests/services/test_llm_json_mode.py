from types import SimpleNamespace

from app.integrations.llm import OpenAICompatibleLLM
from app.shared.settings import Settings


def _llm(mode: str):
    llm = OpenAICompatibleLLM(
        Settings(LLM_BASE_URL="https://llm.invalid/v1", LLM_MODEL="m", LLM_JSON_MODE=mode)
    )
    sent: dict = {}

    async def create(**kwargs):
        sent.update(kwargs)
        message = SimpleNamespace(content='{"ok": true}')
        return SimpleNamespace(choices=[SimpleNamespace(message=message, finish_reason="stop")])

    llm._client.chat.completions.create = create
    return llm, sent


SCHEMA = {"type": "object", "properties": {"ok": {"type": "boolean"}}, "required": ["ok"]}


async def test_json_object_mode_puts_the_schema_in_the_instructions():
    llm, sent = _llm("json_object")
    assert await llm.reply_json("Judge it.", [], "verdict", SCHEMA, 50) == {"ok": True}
    assert sent["response_format"] == {"type": "json_object"}
    system = sent["messages"][0]["content"]
    assert system.startswith("Judge it.") and '"required": ["ok"]' in system


async def test_json_schema_mode_sends_a_strict_schema():
    llm, sent = _llm("json_schema")
    await llm.reply_json("Judge it.", [], "verdict", SCHEMA, 50)
    assert sent["response_format"]["json_schema"]["strict"] is True
    assert sent["messages"][0]["content"] == "Judge it."


def test_cors_origins_accept_bare_host_names():
    s = Settings(CORS_ORIGINS="kavach-web.onrender.com, http://localhost:3001/")
    assert s.cors_origins == ["https://kavach-web.onrender.com", "http://localhost:3001"]


async def test_reasoning_effort_is_sent_only_when_set():
    llm, sent = _llm("json_object")
    await llm.reply("Hi", [], 20)
    assert "extra_body" not in sent
    llm = OpenAICompatibleLLM(
        Settings(LLM_BASE_URL="https://llm.invalid/v1", LLM_MODEL="m", LLM_REASONING_EFFORT="low")
    )
    seen: dict = {}

    async def create(**kwargs):
        seen.update(kwargs)
        message = SimpleNamespace(content="ok")
        return SimpleNamespace(choices=[SimpleNamespace(message=message, finish_reason="stop")])

    llm._client.chat.completions.create = create
    await llm.reply("Hi", [], 20)
    assert seen["extra_body"] == {"reasoning_effort": "low"}


async def test_a_reply_missing_a_required_field_is_asked_for_again():
    llm = OpenAICompatibleLLM(
        Settings(LLM_BASE_URL="https://llm.invalid/v1", LLM_MODEL="m", LLM_JSON_MODE="json_object")
    )
    replies = iter(['{"name": "x"}', '{"name": "x", "ok": true}'])
    asked: list = []

    async def create(**kwargs):
        asked.append(kwargs["messages"])
        message = SimpleNamespace(content=next(replies))
        return SimpleNamespace(choices=[SimpleNamespace(message=message, finish_reason="stop")])

    llm._client.chat.completions.create = create
    schema = {"type": "object", "required": ["name", "ok"]}
    assert await llm.reply_json("Judge.", [], "verdict", schema, 50) == {"name": "x", "ok": True}
    assert "missing: ok" in asked[1][-1]["content"]


async def test_a_reply_that_stays_incomplete_is_a_clear_error():
    import pytest

    from app.integrations.llm import LLMError

    llm, _ = _llm("json_object")

    async def create(**kwargs):
        message = SimpleNamespace(content="not json")
        return SimpleNamespace(choices=[SimpleNamespace(message=message, finish_reason="stop")])

    llm._client.chat.completions.create = create
    with pytest.raises(LLMError, match="incomplete"):
        await llm.reply_json("Judge.", [], "verdict", SCHEMA, 50)
