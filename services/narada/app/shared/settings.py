"""Runtime configuration for the narada service."""

from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(populate_by_name=True, extra="ignore", env_file=".env")

    APP_NAME: str = Field(default="Kavach Service")
    APP_VERSION: str = Field(default="0.1.0")
    ENVIRONMENT: str = Field(default="local")

    STORAGE_BACKEND: Literal["mongo", "memory"] = Field(default="mongo")
    MONGODB_CONNECTION_URL: str = Field(default="mongodb://localhost:27017")
    DB_NAME: str = Field(default="narada")

    CORS_ORIGINS: str = Field(default="http://localhost:3000")

    # The language model writes each test candidate, plays both sides of the conversation
    # and scores it. Any OpenAI-compatible server works; the default is a local Ollama.
    LLM_BASE_URL: str = Field(default="http://localhost:11434/v1")
    LLM_API_KEY: SecretStr = Field(default=SecretStr(""))
    LLM_MODEL: str = Field(default="gemma3:12b")
    LLM_MAX_TOKENS_PARAM: Literal["max_tokens", "max_completion_tokens"] = Field(
        default="max_tokens"
    )
    LLM_TIMEOUT_SECONDS: float = Field(default=120.0, gt=0)
    # How structured replies are requested. "json_schema" (strict) suits Ollama and OpenAI;
    # "json_object" puts the schema in the instructions instead, for hosts like Groq whose
    # models don't all accept a strict schema.
    LLM_JSON_MODE: Literal["json_schema", "json_object"] = Field(default="json_schema")
    # For "thinking" models (e.g. Groq's openai/gpt-oss-120b): how long they may think
    # before answering. "low" keeps phone replies fast; empty sends nothing.
    LLM_REASONING_EFFORT: str = Field(default="")
    # Retries on rate limits and server errors (the client waits as the host's Retry-After
    # says). Raise it on free tiers with a tokens-per-minute cap, like Groq's.
    LLM_MAX_RETRIES: int = Field(default=2, ge=0, le=10)

    # Gnani speaks both sides of a voice-mode test and transcribes the candidate.
    GNANI_API_KEY: SecretStr = Field(default=SecretStr(""))
    GNANI_AGENT_VOICE: str = Field(default="Shivani")
    # Requests the Gnani account allows in flight at once (starter plan: 1).
    GNANI_MAX_PARALLEL_REQUESTS: int = Field(default=1, ge=1)
    # Voice-mode recordings, one WAV per conversation. Relative paths are from the service
    # directory.
    RECORDINGS_DIR: str = Field(default="var/recordings")

    # Spend limits. Each conversation is ~2 LLM calls per turn plus one scenario and one score.
    MAX_CONVERSATIONS_PER_RUN: int = Field(default=30, ge=1)
    MAX_AGENT_TURNS: int = Field(default=20, ge=2)
    RUN_CONCURRENCY: int = Field(default=3, ge=1)

    @property
    def llm_configured(self) -> bool:
        return bool(self.LLM_BASE_URL and self.LLM_MODEL)

    @property
    def speech_configured(self) -> bool:
        return bool(self.GNANI_API_KEY.get_secret_value())

    @property
    def cors_origins(self) -> list[str]:
        # Hosts like Render pass a bare host name ("web.onrender.com"); browsers send a scheme.
        origins = [o.strip().rstrip("/") for o in self.CORS_ORIGINS.split(",") if o.strip()]
        return [o if o.startswith(("http://", "https://")) else f"https://{o}" for o in origins]


settings = Settings()
