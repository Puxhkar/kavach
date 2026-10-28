from dataclasses import replace
from datetime import timedelta

import pytest

from app.domain.agents.models import Agent, AnswerField, AnswerFormat, CallInput, Vendor
from app.domain.agents.rules import (
    SetupStep,
    apply_definition,
    prompt_fingerprint,
    setup_progress,
    validate_connection,
    validate_definition,
)
from app.domain.errors import DomainValidationError
from tests.conftest import NOW, PLIVO_FLOW_ID, make_definition


def _fields(exc: pytest.ExceptionInfo[DomainValidationError]) -> set[str]:
    return {e.field for e in exc.value.errors}


def _agent(**overrides) -> Agent:
    base = dict(
        name="Candidate Screening",
        vendor=Vendor.PLIVO,
        assistant_id=PLIVO_FLOW_ID,
        created_at=NOW,
        updated_at=NOW,
        id="54b61663994926b449ebec6a",
    )
    base.update(overrides)
    return Agent(**base)


class TestConnection:
    def test_accepts_a_uuid(self):
        validate_connection("Screening", Vendor.PLIVO, PLIVO_FLOW_ID)

    def test_rejects_a_mispasted_id_with_vendor_specific_message(self):
        with pytest.raises(DomainValidationError) as exc:
            validate_connection("Screening", Vendor.VAPI, "not-a-uuid")
        assert exc.value.errors[0].field == "assistantId"
        assert "Vapi assistant ID" in exc.value.errors[0].message

    def test_rejects_blank_name(self):
        with pytest.raises(DomainValidationError) as exc:
            validate_connection("   ", Vendor.PLIVO, PLIVO_FLOW_ID)
        assert _fields(exc) == {"name"}


class TestDefinition:
    def test_valid_definition_passes(self):
        validate_definition(make_definition())

    def test_answer_key_that_is_also_a_call_input_is_rejected(self):
        definition = make_definition(
            call_inputs=(CallInput(key="current_ctc", label="CTC"),),
        )
        with pytest.raises(DomainValidationError) as exc:
            validate_definition(definition)
        assert _fields(exc) == {"answers.0.key"}
        assert "call input" in exc.value.errors[0].message

    def test_dotted_key_is_rejected(self):
        # Mongo would read a dotted key as a path into a nested document.
        definition = make_definition(
            answers=(
                AnswerField(key="ctc.fixed", question="Fixed?", format=AnswerFormat.AMOUNT_LPA),
            )
        )
        with pytest.raises(DomainValidationError) as exc:
            validate_definition(definition)
        assert _fields(exc) == {"answers.0.key"}

    def test_duplicate_answer_keys_are_rejected(self):
        ans = AnswerField(key="notice", question="Notice?", format=AnswerFormat.DURATION_DAYS)
        with pytest.raises(DomainValidationError) as exc:
            validate_definition(make_definition(answers=(ans, ans)))
        assert _fields(exc) == {"answers.1.key"}

    def test_choice_needs_two_options(self):
        ans = AnswerField(
            key="work_mode", question="Mode?", format=AnswerFormat.CHOICE, choices=("Remote",)
        )
        with pytest.raises(DomainValidationError) as exc:
            validate_definition(make_definition(answers=(ans,)))
        assert _fields(exc) == {"answers.0.choices"}

    def test_reports_every_problem_at_once(self):
        definition = make_definition(prompt="", answers=(), languages=("Klingon",), call_ending="")
        with pytest.raises(DomainValidationError) as exc:
            validate_definition(definition)
        assert _fields(exc) == {"prompt", "answers", "languages", "callEnding"}


class TestPromptVersions:
    def test_fingerprint_ignores_whitespace_only_edits(self):
        assert prompt_fingerprint("Ask one\nquestion.") == prompt_fingerprint("Ask  one question. ")

    def test_first_definition_cuts_version_one(self):
        agent = apply_definition(_agent(), make_definition(), NOW)
        assert [v.version for v in agent.prompt_versions] == [1]

    def test_same_prompt_does_not_cut_a_new_version(self):
        once = apply_definition(_agent(), make_definition(), NOW)
        twice = apply_definition(once, make_definition(languages=("Telugu",)), NOW)
        assert [v.version for v in twice.prompt_versions] == [1]

    def test_changed_prompt_cuts_next_version_and_keeps_history(self):
        v1 = apply_definition(_agent(), make_definition(), NOW)
        later = NOW + timedelta(hours=1)
        v2 = apply_definition(v1, make_definition(prompt="New prompt"), later)
        assert [v.version for v in v2.prompt_versions] == [1, 2]
        assert v2.prompt_versions[0].prompt == make_definition().prompt
        assert v2.updated_at == later

    def test_invalid_definition_does_not_touch_versions(self):
        with pytest.raises(DomainValidationError):
            apply_definition(_agent(), make_definition(answers=()), NOW)


class TestSetupProgress:
    def test_new_agent_needs_describe(self):
        assert setup_progress(_agent()).next_step is SetupStep.DESCRIBE

    def test_described_agent_is_ready(self):
        agent = apply_definition(_agent(), make_definition(), NOW)
        assert setup_progress(agent).next_step is SetupStep.READY

    def test_missing_assistant_id_sends_back_to_connect(self):
        assert setup_progress(replace(_agent(), assistant_id="")).next_step is SetupStep.CONNECT
