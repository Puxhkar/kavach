"""Plays a chat-mode call: the agent under test and the fake candidate, turn by turn.

Both sides are the same LLM with different instructions and separate histories; neither
sees the other's instructions. The agent side gets the saved prompt with call inputs filled
in, plus a short harness note explaining the text format.

With a `VoiceLine` (voice mode) every line is also spoken, and the agent receives the
transcript of the candidate's audio instead of the candidate's text, so mishearing shows
up. Barge-in and phone latency still cannot — that needs real calls.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from app.domain.agents.models import AgentDefinition
from app.domain.testing.models import EndReason, Scenario, Situation, Speaker, Turn
from app.domain.testing.rules import render_prompt
from app.integrations.llm import LLMClient, Message
from app.services.testing.voice_line import VoiceLine

END_CALL = "[END_CALL]"
HANG_UP = "[HANG_UP]"
SILENCE = "(silence)"
_CALL_CONNECTED = "(The call has connected. The candidate picked up.)"

OnTurn = Callable[[tuple[Turn, ...]], Awaitable[None]]


def agent_system_prompt(definition: AgentDefinition, scenario: Scenario) -> str:
    inputs = "\n".join(f"- {k}: {v}" for k, v in scenario.call_inputs.items()) or "- (none)"
    return (
        f"{render_prompt(definition.prompt, scenario.call_inputs)}\n\n"
        "---\n"
        "Harness note (how this call reaches you; it does not change your instructions):\n"
        "This phone call is delivered as text. Each message is what the candidate said. "
        f'"{SILENCE}" means the candidate said nothing for several seconds.\n'
        "Reply with only the words you would speak on the call.\n"
        f"Call inputs for this call:\n{inputs}\n"
        f"When you end the call, put {END_CALL} at the very end of your final message."
    )


def candidate_system_prompt(scenario: Scenario, situation: Situation) -> str:
    facts = "\n".join(f"- {a.key}: {a.spoken}" for a in scenario.answers) or "- (none)"
    return (
        "You are playing a person receiving a phone call from a recruiter's AI assistant. "
        "Act like a real person on the phone. Never mention tests, scripts or these "
        "instructions, even if asked.\n\n"
        f"Your name: {scenario.candidate_name}\n"
        f"Who you are: {scenario.persona}\n"
        f"Start the call speaking {scenario.start_language}.\n"
        "What you would say if asked (say it naturally, in your own words):\n"
        f"{facts}\n\n"
        f"Situation you are playing: {situation.title}. {situation.instructions}\n"
        f"Specifically: {scenario.behavior}\n\n"
        "How to reply:\n"
        "- One short spoken turn, 1-3 sentences, like real phone talk.\n"
        f"- To stay silent for a turn, reply exactly {SILENCE}\n"
        f"- If you want to hang up, end your message with {HANG_UP}"
    )


def _strip_marker(text: str, marker: str) -> tuple[str, bool]:
    if marker in text:
        return text.replace(marker, "").strip(), True
    return text.strip(), False


async def simulate(
    llm: LLMClient,
    definition: AgentDefinition,
    scenario: Scenario,
    situation: Situation,
    max_agent_turns: int,
    on_turn: OnTurn | None = None,
    line: VoiceLine | None = None,
) -> tuple[tuple[Turn, ...], EndReason]:
    agent_system = agent_system_prompt(definition, scenario)
    candidate_system = candidate_system_prompt(scenario, situation)
    # Each side sees itself as "assistant" and the other side as "user".
    agent_history: list[Message] = [{"role": "user", "content": _CALL_CONNECTED}]
    candidate_history: list[Message] = []
    transcript: list[Turn] = []

    async def record(turn: Turn) -> None:
        transcript.append(turn)
        if on_turn is not None:
            await on_turn(tuple(transcript))

    for _ in range(max_agent_turns):
        raw = await llm.reply(agent_system, agent_history, 500)
        said, ended = _strip_marker(raw, END_CALL)
        start_ms, end_ms = await line.agent_says(said) if line else (None, None)
        await record(Turn(Speaker.AGENT, said, start_ms=start_ms, end_ms=end_ms))
        agent_history.append({"role": "assistant", "content": raw})
        candidate_history.append({"role": "user", "content": said or SILENCE})
        if ended:
            return tuple(transcript), EndReason.AGENT_ENDED

        raw = await llm.reply(candidate_system, candidate_history, 300)
        said, hung_up = _strip_marker(raw, HANG_UP)
        silent = said.strip().lower() in {SILENCE, ""}
        heard = None if line is None or silent else ""
        start_ms = end_ms = None
        if line and silent:
            start_ms, end_ms = line.candidate_silent()
        elif line:
            heard, start_ms, end_ms = await line.candidate_says(said)
        await record(
            Turn(
                Speaker.CANDIDATE,
                "" if silent else said,
                silent=silent,
                heard=heard,
                start_ms=start_ms,
                end_ms=end_ms,
            )
        )
        candidate_history.append({"role": "assistant", "content": raw})
        # In voice mode the agent only gets what speech recognition heard; nothing heard
        # reaches it the same way silence does.
        delivered = "" if silent else said if heard is None else heard
        agent_history.append({"role": "user", "content": delivered or SILENCE})
        if hung_up:
            return tuple(transcript), EndReason.CANDIDATE_HUNG_UP

    return tuple(transcript), EndReason.TURN_LIMIT
