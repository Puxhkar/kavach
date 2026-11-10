from datetime import timedelta

import pytest

from app.domain.errors import DomainValidationError
from app.domain.guard.languages import listen_codes, named_language, pick_language
from app.domain.guard.models import (
    CallCategory,
    CallSource,
    CallStatus,
    DrillVerdict,
    ErrandOutcome,
    ErrandReport,
    Priority,
    Profile,
    ScreenedCall,
    Triage,
    VipContact,
)
from app.domain.guard.rules import (
    drill_checks,
    finalize_errand_report,
    finalize_triage,
    inbox_order,
    is_vip,
    scam_signals,
    score_drill,
    validate_profile,
)
from tests.conftest import NOW

PROFILE = Profile(
    owner_name="Ganesh",
    availability="after 6 PM",
    language="Hinglish",
    vip_contacts=(VipContact("Mom", "mother"), VipContact("Neha", "")),
)


def _triage(**overrides) -> Triage:
    data = dict(
        caller_name="Sunita",
        organisation="",
        purpose="Call back",
        category=CallCategory.PERSONAL,
        priority=Priority.NORMAL,
        scam_risk=5,
        red_flags=(),
        callback="after 6 PM",
        summary="s",
        action="a",
    )
    data.update(overrides)
    return Triage(**data)


def test_a_scam_is_blocked_even_when_it_claims_to_be_family():
    t = finalize_triage(
        _triage(caller_name="Mom", scam_risk=85, red_flags=(" asked for OTP ", "")), PROFILE
    )
    assert (t.category, t.priority, t.vip) == (CallCategory.SCAM, Priority.BLOCKED, False)
    assert t.red_flags == ("asked for OTP",)


def test_a_scam_label_without_the_risk_to_back_it_is_not_blocked():
    t = finalize_triage(_triage(category=CallCategory.SCAM, scam_risk=20), PROFILE)
    assert (t.category, t.priority) == (CallCategory.OTHER, Priority.NORMAL)


def test_a_vip_is_at_least_high_and_sales_never_jump_the_queue():
    vip = finalize_triage(_triage(caller_name="Mom", priority=Priority.LOW), PROFILE)
    assert (vip.priority, vip.vip) == (Priority.HIGH, True)
    for asked in (Priority.URGENT, Priority.NORMAL):
        sales = finalize_triage(_triage(category=CallCategory.SALES, priority=asked), PROFILE)
        assert sales.priority is Priority.LOW
    unblocked = finalize_triage(_triage(priority=Priority.BLOCKED, scam_risk=10), PROFILE)
    assert unblocked.priority is Priority.LOW


def test_vip_matching_is_on_whole_words():
    assert is_vip("Neha", "TalentBridge", PROFILE)
    assert is_vip("Sunita", "his mother", PROFILE)
    assert not is_vip("Momin", "", PROFILE)


def test_inbox_puts_live_calls_first_then_priority_then_newest():
    def call(i, priority, minutes):
        return ScreenedCall(
            id=str(i),
            source=CallSource.SIMULATED,
            status=CallStatus.DONE if priority else CallStatus.RUNNING,
            created_at=NOW + timedelta(minutes=minutes),
            language="Hinglish",
            triage=_triage(priority=priority) if priority else None,
        )

    calls = [
        call(1, Priority.LOW, 5),
        call(2, Priority.URGENT, 1),
        call(3, None, 0),
        call(4, Priority.BLOCKED, 9),
        call(5, Priority.URGENT, 3),
    ]
    assert [c.id for c in inbox_order(calls)] == ["3", "5", "2", "1", "4"]


def test_sharing_an_otp_means_scammed_whatever_else_went_well():
    judged = {
        "shared_otp": (True, "Read out the OTP"),
        "paid": (False, ""),
        "installed_app": (False, ""),
        "shared_details": (False, ""),
        "questioned": (True, ""),
    }
    checks = drill_checks(judged, hung_up=True)
    assert [c.passed for c in checks] == [False, True, True, True, True, True]
    assert checks[-1].detail == "Hung up on the caller."
    assert score_drill(checks) == (40, DrillVerdict.SCAMMED)


def test_a_skipped_check_fails_and_a_clean_drill_is_safe():
    safe = {c: (False, "ok") for c in ("shared_otp", "paid", "installed_app", "shared_details")}
    checks = drill_checks({**safe, "questioned": (True, "ok")}, hung_up=False)
    assert checks[-1].passed is False  # "refused" was never judged and they didn't hang up
    assert score_drill(checks) == (83, DrillVerdict.SAFE)
    assert score_drill(drill_checks({}, hung_up=False))[1] is DrillVerdict.SCAMMED


def test_profile_is_trimmed_and_checked():
    clean = validate_profile(
        Profile(
            " Ganesh ",
            " after 6 ",
            "English",
            (VipContact(" Mom ", " mother "),),
            listen_languages=("English", "Kannada", "English"),
        )
    )
    assert (clean.owner_name, clean.availability, clean.vip_contacts[0].name) == (
        "Ganesh",
        "after 6",
        "Mom",
    )
    assert clean.listen_languages == ("English", "Kannada")
    with pytest.raises(DomainValidationError) as err:
        validate_profile(
            Profile("", "", "Klingon", (VipContact(" ", ""),), listen_languages=("Hindi",))
        )
    assert {e.field for e in err.value.errors} == {
        "ownerName",
        "availability",
        "language",
        "vipContacts.0.name",
    }


def test_the_assistant_listens_for_one_to_four_known_languages():
    five = ("English", "Hindi", "Kannada", "Tamil", "Telugu")
    for listen in ((), five, ("English", "Hinglish")):
        with pytest.raises(DomainValidationError) as err:
            validate_profile(Profile("P", "6 PM", "English", listen_languages=listen))
        assert "listenLanguages" in {e.field for e in err.value.errors}


ALLOWED = ("English", "Hindi", "Kannada", "Tamil")


def test_a_language_named_in_answer_to_the_question_wins():
    assert named_language("Kannada please", ALLOWED) == "Kannada"
    assert named_language("ನನಗೆ ಕನ್ನಡ ಆರಾಮ", ALLOWED) == "Kannada"
    assert named_language("Hindi or English, both fine", ALLOWED) is None
    assert named_language("Telugu", ALLOWED) is None
    assert pick_language("Tamil", "en-IN", ALLOWED, "English", allow_named=True) == "Tamil"


def test_otherwise_the_detected_language_is_followed():
    # A casual mention mid-call does not switch the language; what was heard does.
    assert pick_language("the Kannada file is ready", "en-IN", ALLOWED, "Hindi") == "English"
    assert pick_language("வணக்கம்", "ta-IN", ALLOWED, "English") == "Tamil"
    # Silence, or a language the assistant isn't listening for, keeps the current one.
    assert pick_language("", "ta-IN", ALLOWED, "Hindi") == "Hindi"
    assert pick_language("namaskara", "te-IN", ALLOWED, "Hindi") == "Hindi"
    assert listen_codes(("English", "Kannada", "Hinglish")) == "en-IN,kn-IN"


def test_a_no_with_an_offer_needs_follow_up_and_a_plain_no_is_declined():
    offer = ErrandReport(ErrandOutcome.DECLINED, "tomorrow morning", (), "s", "n")
    assert finalize_errand_report(offer).outcome is ErrandOutcome.NEEDS_FOLLOW_UP
    plain = ErrandReport(ErrandOutcome.DECLINED, " ", (), "s", "n")
    assert finalize_errand_report(plain).outcome is ErrandOutcome.DECLINED


def test_two_scam_signals_block_a_call_the_model_rated_safe():
    heard = "मैं Inspector राजेश शर्मा CBI cyber cell से, आपके नाम पर एक parcel है जिसमें ड्रग्स हैं"
    signals = scam_signals(heard)
    assert len(signals) == 3
    t = finalize_triage(
        _triage(category=CallCategory.WORK, priority=Priority.URGENT, scam_risk=20),
        PROFILE,
        signals,
    )
    assert (t.priority, t.category, t.scam_risk) == (Priority.BLOCKED, CallCategory.SCAM, 85)
    assert "Mentions a parcel or courier in your name" in t.red_flags


def test_one_ordinary_signal_does_not_block():
    signals = scam_signals(
        "Hi, I'm Ravi from SwiftShip, I have a parcel and can't find the building"
    )
    assert signals == ("Mentions a parcel or courier in your name",)
    t = finalize_triage(
        _triage(category=CallCategory.DELIVERY, priority=Priority.NORMAL), PROFILE, signals
    )
    assert t.priority is Priority.NORMAL
    assert scam_signals("Your home loan documents are pending, please upload them in the app") == ()
