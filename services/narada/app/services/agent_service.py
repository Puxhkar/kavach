"""Agent setup use-cases: create (step 1), reconnect (step 1 edit), describe (step 2), and the
one-step shortcut that drafts all of it from a pasted prompt."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import replace
from datetime import UTC, datetime

from app.domain.agents.models import Agent, AgentDefinition, Vendor
from app.domain.agents.rules import MAX_PROMPT_CHARS, apply_definition, validate_connection
from app.domain.errors import DomainValidationError, FieldError
from app.integrations.llm import LLMClient
from app.persistence.repositories import AgentRepo
from app.services.agent_quickstart import draft_from_prompt
from app.shared.exceptions import NotFoundError, ServiceUnavailableError


def _utc_now() -> datetime:
    return datetime.now(UTC)


class AgentService:
    def __init__(
        self,
        repo: AgentRepo,
        clock: Callable[[], datetime] = _utc_now,
        llm: LLMClient | None = None,
    ) -> None:
        self._repo = repo
        self._clock = clock
        self._llm = llm

    async def list_agents(self) -> list[Agent]:
        return await self._repo.list_all()

    async def get_agent(self, agent_id: str) -> Agent:
        agent = await self._repo.get(agent_id)
        if agent is None:
            raise NotFoundError("agent_not_found")
        return agent

    async def create_agent(self, name: str, vendor: Vendor, assistant_id: str) -> Agent:
        validate_connection(name, vendor, assistant_id)
        now = self._clock()
        agent = Agent(
            name=name.strip(),
            vendor=vendor,
            assistant_id=assistant_id.strip().lower(),
            created_at=now,
            updated_at=now,
        )
        return await self._repo.insert(agent)

    async def update_connection(
        self, agent_id: str, name: str, vendor: Vendor, assistant_id: str
    ) -> Agent:
        validate_connection(name, vendor, assistant_id)
        agent = await self.get_agent(agent_id)
        updated = replace(
            agent,
            name=name.strip(),
            vendor=vendor,
            assistant_id=assistant_id.strip().lower(),
            updated_at=self._clock(),
        )
        await self._repo.replace(updated)
        return updated

    async def quick_create(self, name: str, prompt: str, languages: tuple[str, ...]) -> Agent:
        """Paste a prompt, get an agent that is ready to test (not connected to a vendor)."""
        if not prompt.strip():
            raise DomainValidationError([FieldError("prompt", "Paste the agent's prompt")])
        if len(prompt) > MAX_PROMPT_CHARS:
            raise DomainValidationError(
                [FieldError("prompt", f"Prompt is longer than {MAX_PROMPT_CHARS} characters")]
            )
        if self._llm is None:
            raise ServiceUnavailableError("llm_not_configured")
        drafted_name, definition = await draft_from_prompt(self._llm, prompt, languages)
        now = self._clock()
        agent = await self._repo.insert(
            Agent(
                name=name.strip()[:60] or drafted_name or "My voice agent",
                vendor=Vendor.NONE,
                assistant_id="",
                created_at=now,
                updated_at=now,
            )
        )
        described = apply_definition(agent, definition, self._clock())
        await self._repo.replace(described)
        return described

    async def set_definition(self, agent_id: str, definition: AgentDefinition) -> Agent:
        agent = await self.get_agent(agent_id)
        updated = apply_definition(agent, definition, self._clock())
        await self._repo.replace(updated)
        return updated
