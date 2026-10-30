"""How an agent's definition is described to the scenario writer and the scorer."""

from __future__ import annotations

from app.domain.agents.models import AgentDefinition, AnswerFormat, RuleKind

# Spelled out for the LLM so "truth" values come back in the same unit the agent saves.
FORMAT_GUIDE = {
    AnswerFormat.TEXT: "free text",
    AnswerFormat.NUMBER: "a plain number, e.g. 4",
    AnswerFormat.AMOUNT_LPA: "annual amount in lakhs per annum as a number, e.g. 12.5",
    AnswerFormat.DURATION_DAYS: "a number of days, e.g. 30 (2 months = 60, immediate = 0)",
    AnswerFormat.DATE: "an ISO date, e.g. 2026-11-15",
    AnswerFormat.YES_NO: "yes or no",
    AnswerFormat.CHOICE: "exactly one of the listed choices",
}

# Long prompts are cut for the scorer and writer; the agent itself always gets the full one.
_PROMPT_EXCERPT_CHARS = 12_000


def describe_definition(definition: AgentDefinition) -> str:
    lines = ["Answers the agent must collect (key — question — saved format):"]
    for a in definition.answers:
        fmt = FORMAT_GUIDE[a.format]
        if a.format is AnswerFormat.CHOICE:
            fmt += f": {', '.join(a.choices)}"
        required = "required" if a.required else "optional"
        hint = f" (note: {a.hint})" if a.hint else ""
        lines.append(f"- {a.key} — {a.question} — {fmt}; {required}{hint}")
    if definition.call_inputs:
        lines.append("Call inputs sent into the call (key — meaning):")
        lines.extend(f"- {i.key} — {i.label}" for i in definition.call_inputs)
    if definition.rules:
        lines.append("Rules:")
        lines.extend(
            f"- {'MUST' if r.kind is RuleKind.MUST else 'MUST NEVER'}: {r.text}"
            for r in definition.rules
        )
    lines.append(f"Languages the agent supports: {', '.join(definition.languages)}")
    lines.append(
        f"When the candidate switches language, the agent should: {definition.language_switch}"
    )
    lines.append(f"A good call ends like this: {definition.call_ending}")
    lines.append("The agent's prompt (excerpt):")
    lines.append(definition.prompt[:_PROMPT_EXCERPT_CHARS])
    return "\n".join(lines)
