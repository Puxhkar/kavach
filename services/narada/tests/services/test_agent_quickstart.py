from app.domain.agents.models import AnswerFormat
from app.services.agent_quickstart import DEFAULT_LANGUAGES, build_definition, placeholders

PROMPT = (
    "You are Meera calling {{ name }} about the {{Job Role}} role. "
    "Ask current CTC and notice period. Never promise a job. {{name}}"
)


def test_placeholders_become_call_inputs_once_each():
    assert placeholders(PROMPT) == ["name", "job_role"]


def test_a_messy_draft_is_cleaned_to_the_setup_rules():
    draft = {
        "answers": [
            {
                "key": "Current CTC",
                "question": "What is your current CTC?",
                "format": "amount_lpa",
                "required": True,
                "choices": [],
            },
            {
                "key": "current_ctc",
                "question": "Again?",
                "format": "number",
                "required": True,
                "choices": [],
            },
            {
                "key": "name",
                "question": "Your name?",
                "format": "text",
                "required": True,
                "choices": [],
            },
            {
                "key": "mode",
                "question": "Office or remote?",
                "format": "choice",
                "required": False,
                "choices": ["Office"],
            },
            {"key": "blank", "question": "  ", "format": "text", "required": True, "choices": []},
        ],
        "rules": [{"kind": "must_not", "text": "Promise a job"}, {"kind": "maybe", "text": "Nope"}],
        "callEnding": "",
        "inputExamples": [{"key": "name", "example": "Rahul"}],
    }
    d = build_definition(PROMPT, ("Hinglish", "Klingon"), draft)
    assert [i.key for i in d.call_inputs] == ["name", "job_role"]
    assert d.call_inputs[0].example == "Rahul"
    # Duplicate key, a key that is a call input, and an empty question are dropped;
    # a "choice" with fewer than two choices becomes free text.
    assert [(a.key, a.format) for a in d.answers] == [
        ("current_ctc", AnswerFormat.AMOUNT_LPA),
        ("mode", AnswerFormat.TEXT),
    ]
    assert [r.text for r in d.rules] == ["Promise a job"]
    assert d.languages == ("Hinglish",)
    assert d.call_ending


def test_an_agent_that_collects_nothing_still_gets_a_testable_setup():
    d = build_definition(
        "Answer questions about store timings.",
        (),
        {"answers": [], "rules": [], "callEnding": "Say bye.", "inputExamples": []},
    )
    assert d.answers[0].key == "call_outcome" and d.languages == DEFAULT_LANGUAGES
