from dataclasses import replace

import pytest

from app.domain.agents.models import Agent, AnswerField, AnswerFormat, LanguageSwitch, Vendor
from app.domain.agents.rules import apply_definition
from app.domain.errors import DomainValidationError
from app.domain.testing.models import (
    AnswerResult,
    AnswerStatus,
    Check,
    CheckKind,
    ConversationStatus,
    EndReason,
    RunMode,
    RunStatus,
    Speaker,
    Turn,
)
from app.domain.testing.rules import (
    build_scenario,
    interrupt_run,
    plan_run,
    render_prompt,
    score_conversation,
)
from app.domain.testing.situations import situations_for
from tests.conftest import NOW, PLIVO_FLOW_ID, make_definition


def _ready_agent(**definition_overrides) -> Agent:
    agent = Agent(
        id="54b61663994926b449ebec6a",
        name="Screening",
        vendor=Vendor.PLIVO,
        assistant_id=PLIVO_FLOW_ID,
        created_at=NOW,
        updated_at=NOW,
    )
    return apply_definition(agent, make_definition(**definition_overrides), NOW)


# ── Situations ───────────────────────────────────────────────────────────────


def test_no_situations_before_the_agent_is_described():
    assert situations_for(None) == ()


def test_salary_case_only_for_agents_that_collect_salary():
    with_salary = [s.id for s in situations_for(make_definition())]
    no_salary = make_definition(
        answers=(AnswerField(key="notice", question="Notice?", format=AnswerFormat.DURATION_DAYS),)
    )
    assert "ctc-monthly-variable" in with_salary
    assert "ctc-monthly-variable" not in [s.id for s in situations_for(no_salary)]


def test_language_cases_follow_the_agent_languages():
    definition = make_definition(
        languages=("English", "Telugu"), language_switch=LanguageSwitch.ASK
    )
    by_id = {s.id: s for s in situations_for(definition)}
    assert {"language-english", "language-telugu", "switch-hinglish-telugu"} <= by_id.keys()
    assert "switch-hinglish-english" not in by_id
    assert "ask which language" in by_id["switch-hinglish-telugu"].expectation


# ── Planning ─────────────────────────────────────────────────────────────────


def test_plan_makes_one_conversation_per_situation_and_repeat():
    run = plan_run(_ready_agent(), ["silence", "callback"], 2, 30, NOW)
    assert run.status is RunStatus.QUEUED
    assert run.prompt_version == 1
    assert [(c.situation_id, c.repeat) for c in run.conversations] == [
        ("silence", 1),
        ("silence", 2),
        ("callback", 1),
        ("callback", 2),
    ]
    assert len({c.id for c in run.conversations}) == 4


def test_plan_refuses_an_agent_without_a_definition():
    agent = replace(_ready_agent(), definition=None, prompt_versions=())
    with pytest.raises(DomainValidationError) as err:
        plan_run(agent, ["silence"], 1, 30, NOW)
    assert err.value.errors[0].field == "agentId"


def test_noisy_phone_line_needs_a_voice_run():
    with pytest.raises(DomainValidationError) as err:
        plan_run(_ready_agent(), ["noisy-line"], 1, 30, NOW)
    assert "needs a voice run" in str(err.value)
    run = plan_run(_ready_agent(), ["noisy-line"], 1, 30, NOW, RunMode.VOICE)
    assert [c.situation_id for c in run.conversations] == ["noisy-line"]


def test_plan_reports_unknown_situations_bad_repeats_and_spend_limit():
    with pytest.raises(DomainValidationError) as err:
        plan_run(_ready_agent(), ["silence", "nope"], 9, 30, NOW)
    fields = [e.field for e in err.value.errors]
    assert fields.count("situationIds") == 1
    assert "repeats" in fields

    with pytest.raises(DomainValidationError) as err:
        plan_run(_ready_agent(), ["silence", "callback", "declines"], 5, 10, NOW)
    assert "15 conversations planned; the limit per run is 10" in str(err.value)


# ── Scenario and prompt ──────────────────────────────────────────────────────


def test_render_prompt_fills_known_placeholders_only():
    text = "Hi {{name}}, about the {{ job_role }} role. {{typo}}"
    assert render_prompt(text, {"name": "Rahul", "job_role": "SDE"}) == (
        "Hi Rahul, about the SDE role. {{typo}}"
    )


def test_build_scenario_fills_gaps_from_the_definition():
    scenario = build_scenario(
        make_definition(),
        candidate_name="Asha Rao",
        persona="QA engineer",
        start_language="Klingon",
        call_inputs={"unknown": "x"},
        answers={},
        behavior="b",
        expected_outcome="e",
    )
    assert scenario.call_inputs == {"name": "Asha Rao"}
    assert [(a.key, a.truth) for a in scenario.answers] == [("current_ctc", "")]
    assert scenario.start_language == "English"


# ── Scoring ──────────────────────────────────────────────────────────────────


def _score(answers, checks, end_reason=EndReason.AGENT_ENDED):
    definition = make_definition()
    run = plan_run(_ready_agent(), ["silence"], 1, 30, NOW)
    scenario = build_scenario(
        definition, "Rahul", "", "English", {}, {"current_ctc": ("1L/month", "12")}, "", ""
    )
    transcript = (Turn(Speaker.AGENT, "Hi"), Turn(Speaker.CANDIDATE, "Hello"))
    return score_conversation(
        run.conversations[0],
        definition,
        scenario,
        transcript,
        end_reason,
        answers,
        checks,
        "s",
        NOW,
    )


def _answer(status=AnswerStatus.CORRECT, acceptable=True):
    return {"current_ctc": AnswerResult("current_ctc", "", "12", status, acceptable)}


def test_all_checks_passing_is_a_pass_and_truth_is_filled_in():
    result = _score(_answer(), [Check("Rule", CheckKind.RULE, True)])
    assert result.status is ConversationStatus.PASSED
    assert result.answers[0].expected == "12"
    assert [c.kind for c in result.checks] == [CheckKind.RULE, CheckKind.ANSWER]


def test_one_failed_check_fails_the_conversation():
    result = _score(_answer(), [Check("Rule", CheckKind.RULE, False, "Promised 20 LPA")])
    assert result.status is ConversationStatus.FAILED


def test_an_answer_the_judge_skipped_counts_as_not_collected():
    result = _score({}, [])
    assert result.status is ConversationStatus.FAILED
    assert result.answers[0].status is AnswerStatus.NOT_COLLECTED


def test_hitting_the_turn_limit_fails_the_call():
    result = _score(_answer(), [], end_reason=EndReason.TURN_LIMIT)
    assert result.status is ConversationStatus.FAILED
    assert result.checks[-1].name == "Call reached an end"


def test_interrupt_marks_unfinished_conversations_as_errors():
    run = plan_run(_ready_agent(), ["silence", "callback"], 1, 30, NOW)
    done = replace(run.conversations[0], status=ConversationStatus.PASSED)
    run = replace(run, status=RunStatus.RUNNING, conversations=(done, run.conversations[1]))
    stopped = interrupt_run(run, NOW)
    assert stopped.status is RunStatus.INTERRUPTED
    assert [c.status for c in stopped.conversations] == [
        ConversationStatus.PASSED,
        ConversationStatus.ERROR,
    ]
