"""Chat-completion client. The only module that talks to the language model.

Services depend on the `LLMClient` protocol, so tests pass a scripted fake and never call
the network.
"""

from __future__ import annotations

import json
from typing import Any, Protocol

from openai import AsyncOpenAI, OpenAIError

from app.shared.settings import Settings

Message = dict[str, str]


class LLMError(Exception):
    """The model call failed or returned something unusable."""


class LLMClient(Protocol):
    async def reply(self, system: str, messages: list[Message], max_tokens: int) -> str: ...

    async def reply_json(
        self,
        system: str,
        messages: list[Message],
        schema_name: str,
        schema: dict[str, Any],
        max_tokens: int,
    ) -> dict[str, Any]: ...


class OpenAICompatibleLLM:
    """Any server that speaks the OpenAI chat-completions API: a local Ollama model (the
    default, free and offline), OpenAI, Gemini's OpenAI endpoint, Groq, and so on."""

    def __init__(self, settings: Settings) -> None:
        self._client = AsyncOpenAI(
            base_url=settings.LLM_BASE_URL,
            # Local servers ignore the key, but the client refuses an empty one.
            api_key=settings.LLM_API_KEY.get_secret_value() or "unused",
            timeout=settings.LLM_TIMEOUT_SECONDS,
            max_retries=2,
        )
        self._model = settings.LLM_MODEL
        # Ollama, Gemini and gpt-4.x read `max_tokens`; OpenAI's gpt-5 and o-series only
        # accept `max_completion_tokens`.
        self._max_tokens_param = settings.LLM_MAX_TOKENS_PARAM
        self._json_mode = settings.LLM_JSON_MODE
        self._reasoning_effort = settings.LLM_REASONING_EFFORT.strip()

    async def _complete(
        self, system: str, messages: list[Message], max_tokens: int, **params: Any
    ) -> str:
        if self._reasoning_effort:
            params["extra_body"] = {"reasoning_effort": self._reasoning_effort}
        try:
            resp = await self._client.chat.completions.create(
                model=self._model,
                messages=[{"role": "system", "content": system}, *messages],
                **{self._max_tokens_param: max_tokens},
                **params,
            )
        except OpenAIError as exc:
            raise LLMError(f"The language model call failed: {type(exc).__name__}") from exc
        choice = resp.choices[0]
        if choice.finish_reason == "content_filter":
            raise LLMError("The language model's content filter blocked the reply")
        return choice.message.content or ""

    async def reply(self, system: str, messages: list[Message], max_tokens: int) -> str:
        return (await self._complete(system, messages, max_tokens)).strip()

    async def reply_json(
        self,
        system: str,
        messages: list[Message],
        schema_name: str,
        schema: dict[str, Any],
        max_tokens: int,
    ) -> dict[str, Any]:
        if self._json_mode == "json_object":
            system = (
                f"{system}\n\nReply with only a JSON object (no prose, no code fences) that "
                f"matches this JSON schema:\n{json.dumps(schema)}"
            )
            response_format: dict[str, Any] = {"type": "json_object"}
        else:
            response_format = {
                "type": "json_schema",
                "json_schema": {"name": schema_name, "strict": True, "schema": schema},
            }
        text = await self._complete(system, messages, max_tokens, response_format=response_format)
        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            raise LLMError(f"{schema_name}: reply was not valid JSON") from exc
