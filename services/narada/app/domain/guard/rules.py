"""Decisions the model only advises on. The model reads the call; these rules decide the
priority and the drill score, so a confident-sounding model can't put a scam at the top
of the inbox or pass someone who read out their OTP."""

from __future__ import annotations

from dataclasses import dataclass, replace

from app.domain.errors import DomainValidationError, FieldError
from app.domain.guard.languages import CODES as LISTEN_CODES
from app.domain.guard.languages import MAX_LISTEN_LANGUAGES
from app.domain.guard.models import (
    PRIORITY_ORDER,
    CallCategory,
    DrillCheck,
    DrillVerdict,
    ErrandOutcome,
    ErrandReport,
    Priority,
    Profile,
    ScreenedCall,
    Triage,
    VipContact,
)


@dataclass(frozen=True)
class DrillCheckSpec:
    id: str
    name: str
    critical: bool


# What a drill is scored on. Critical ones are the moments money is lost.
DRILL_CHECKS: tuple[DrillCheckSpec, ...] = (
    DrillCheckSpec("no_otp", "Did not share an OTP, PIN or password", critical=True),
    DrillCheckSpec("no_payment", "Did not pay or agree to pay", critical=True),
    DrillCheckSpec("no_app", "Did not install an app or share the screen", critical=True),
    DrillCheckSpec("no_details", "Did not share Aadhaar, PAN, bank or card details", critical=True),
    DrillCheckSpec("questioned", "Questioned the caller or asked to verify", critical=False),
    DrillCheckSpec("ended", "Refused firmly or hung up", critical=False),
)

SCAM_RISK_BLOCK = 70
MAX_VIPS = 20
SUPPORTED_GUARD_LANGUAGES = (
    "English",
    "Hindi",
    "Hinglish",
    "Kannada",
    "Tamil",
    "Telugu",
    "Malayalam",
    "Marathi",
    "Bengali",
    "Gujarati",
)


def validate_profile(profile: Profile) -> Profile:
    errors: list[FieldError] = []
    owner = profile.owner_name.strip()
    if not owner:
        errors.append(FieldError("ownerName", "Enter your name"))
    elif len(owner) > 60:
        errors.append(FieldError("ownerName", "Keep the name under 60 characters"))
    if not profile.availability.strip():
        errors.append(FieldError("availability", "Say when callers can expect a call back"))
    elif len(profile.availability) > 200:
        errors.append(FieldError("availability", "Keep this under 200 characters"))
    listen = tuple(dict.fromkeys(profile.listen_languages))
    if not listen:
        errors.append(FieldError("listenLanguages", "Pick at least one language"))
    elif len(listen) > MAX_LISTEN_LANGUAGES:
        errors.append(FieldError("listenLanguages", f"Pick up to {MAX_LISTEN_LANGUAGES} languages"))
    elif any(name not in LISTEN_CODES for name in listen):
        errors.append(FieldError("listenLanguages", "Pick from the supported languages"))
    if profile.language not in listen:
        errors.append(
            FieldError("language", "The opening language must be one the assistant listens for")
        )
    if len(profile.notes) > 1000:
        errors.append(FieldError("notes", "Keep notes under 1000 characters"))
    if len(profile.vip_contacts) > MAX_VIPS:
        errors.append(FieldError("vipContacts", f"Up to {MAX_VIPS} VIP contacts"))
    vips: list[VipContact] = []
    for i, vip in enumerate(profile.vip_contacts):
        name = vip.name.strip()
        if not name:
            errors.append(FieldError(f"vipContacts.{i}.name", "Enter a name"))
        vips.append(VipContact(name=name, relation=vip.relation.strip()))
    if errors:
        raise DomainValidationError(errors)
    return Profile(
        owner_name=owner,
        availability=profile.availability.strip(),
        language=profile.language,
        vip_contacts=tuple(vips),
        notes=profile.notes.strip(),
        listen_languages=listen,
    )


def validate_errand(recipient_name: str, recipient_role: str, task: str, deadline: str) -> None:
    errors: list[FieldError] = []
    if not recipient_name.strip():
        errors.append(FieldError("recipientName", "Who should the assistant call?"))
    if not task.strip():
        errors.append(FieldError("task", "What should the assistant tell them?"))
    elif len(task) > 600:
        errors.append(FieldError("task", "Keep the message under 600 characters"))
    if len(deadline) > 100:
        errors.append(FieldError("deadline", "Keep the deadline under 100 characters"))
    if len(recipient_name) > 60 or len(recipient_role) > 60:
        errors.append(FieldError("recipientName", "Keep names under 60 characters"))
    if errors:
        raise DomainValidationError(errors)


def is_vip(caller_name: str, organisation: str, profile: Profile) -> bool:
    """A caller is a VIP when a VIP's name or relation appears in who they said they are.
    Matching is on whole words, so "Ma" does not match "Manoj"."""
    said = f" {caller_name} {organisation} ".lower()
    for vip in profile.vip_contacts:
        for word in (vip.name, vip.relation):
            word = word.strip().lower()
            if word and f" {word} " in said:
                return True
    return False


# Signals of the frauds most reported in India. Each is matched in what the caller said
# (as heard), in English and the scripts the assistant listens for. One signal alone is
# ordinary ("a parcel for you"); two different ones together are the scam pattern, and
# then the call is blocked whatever the model scored.
_SCAM_SIGNALS: tuple[tuple[str, tuple[str, ...]], ...] = (
    (
        "Claims to be police, CBI, customs or a regulator",
        (
            "cbi",
            "police",
            "cyber cell",
            "customs",
            "rbi",
            "income tax",
            "narcotics bureau",
            "पुलिस",
            "सीबीआई",
            "कस्टम",
            "ಪೊಲೀಸ್",
            "போலீஸ்",
        ),
    ),
    (
        "Says you are linked to a crime or an arrest",
        (
            "drugs",
            "fake passport",
            "money laundering",
            "arrest",
            "warrant",
            "ड्रग्स",
            "नकली पासपोर्ट",
            "गिरफ्तार",
            "अरेस्ट",
            "ಬಂಧನ",
            "கைது",
        ),
    ),
    (
        "Mentions a parcel or courier in your name",
        ("parcel", "courier", "पार्सल", "कूरियर", "ಪಾರ್ಸೆಲ್", "பார்சல்"),
    ),
    (
        "Asks for an OTP, PIN or password",
        ("otp", "pin number", "password", "cvv", "ओटीपी", "ಒಟಿಪಿ", "ஓடிபி"),
    ),
    (
        "Asks for money or a payment",
        ("upi", "transfer the money", "send money", "clearance fee", "पैसे भेज", "जुर्माना", "ट्रांसफर"),
    ),
    (
        "Asks to install an app or share the screen",
        ("anydesk", "teamviewer", "screen share", "apk", "install the app"),
    ),
    (
        "Threatens to block an account or cut a service",
        (
            "will be blocked",
            "account blocked",
            "power will be cut",
            "disconnected",
            "बंद हो जाएगा",
            "ब्लॉक",
            "बिजली कट",
        ),
    ),
    (
        "Asks you to keep it secret",
        ("don't tell", "do not tell", "keep this secret", "किसी को मत बताना"),
    ),
)
SCAM_SIGNALS_TO_BLOCK = 2


def scam_signals(caller_text: str) -> tuple[str, ...]:
    said = f" {caller_text.lower()} "
    return tuple(name for name, words in _SCAM_SIGNALS if any(w in said for w in words))


def finalize_triage(model: Triage, profile: Profile, signals: tuple[str, ...] = ()) -> Triage:
    """The model's reading, with the inbox rules applied on top. `signals` are the scam
    signals found in what the caller said; enough of them block the call on their own."""
    risk = max(0, min(100, model.scam_risk))
    if len(signals) >= SCAM_SIGNALS_TO_BLOCK:
        risk = max(risk, 85)
    category, priority = model.category, model.priority
    vip = is_vip(model.caller_name, model.organisation, profile)
    if risk >= SCAM_RISK_BLOCK:
        # A likely scam is blocked, even a "VIP" (scammers impersonate family).
        category, priority, vip = CallCategory.SCAM, Priority.BLOCKED, False
    else:
        # Below the bar the risk number wins over the label: a model that says "scam" at
        # 20% has no evidence, so the call stays visible.
        if category is CallCategory.SCAM:
            category = CallCategory.OTHER
        if priority is Priority.BLOCKED:
            priority = Priority.LOW
        if vip and PRIORITY_ORDER.index(priority) > PRIORITY_ORDER.index(Priority.HIGH):
            priority = Priority.HIGH
        if category is CallCategory.SALES:
            priority = Priority.LOW
    return Triage(
        caller_name=model.caller_name.strip() or "Unknown caller",
        organisation=model.organisation.strip(),
        purpose=model.purpose.strip(),
        category=category,
        priority=priority,
        scam_risk=risk,
        # The rules' signals stand in only when the model listed none, to keep the list short.
        red_flags=tuple(f.strip() for f in (model.red_flags or signals) if f.strip()),
        callback=model.callback.strip(),
        summary=model.summary.strip(),
        action=model.action.strip(),
        vip=vip,
    )


def finalize_errand_report(report: ErrandReport) -> ErrandReport:
    """A "no" that comes with an offer ("not today, tomorrow morning") is something for the
    owner to answer, not a refusal."""
    if report.outcome is ErrandOutcome.DECLINED and report.commitment.strip():
        return replace(report, outcome=ErrandOutcome.NEEDS_FOLLOW_UP)
    return report


def silent_call_triage(callback: str) -> Triage:
    """The caller never said a word: nothing for a model to judge. Robocalls and scam
    "probe" calls often look like this, so it goes in low, not blocked."""
    return Triage(
        caller_name="Silent caller",
        organisation="",
        purpose="Said nothing",
        category=CallCategory.OTHER,
        priority=Priority.LOW,
        scam_risk=0,
        red_flags=(),
        callback=callback,
        summary="The caller stayed silent and the call ended without a word from them.",
        action="Ignore unless they call again.",
    )


def inbox_order(calls: list[ScreenedCall]) -> list[ScreenedCall]:
    """Unfinished calls first (they are happening now), then by priority, newest first."""

    def key(call: ScreenedCall) -> tuple[int, int, float]:
        if call.triage is None:
            return (0, 0, -call.created_at.timestamp())
        rank = PRIORITY_ORDER.index(call.triage.priority)
        return (1, rank, -call.created_at.timestamp())

    return sorted(calls, key=key)


def drill_checks(judged: dict[str, tuple[bool, str]], hung_up: bool) -> tuple[DrillCheck, ...]:
    """Every check in a fixed order. One the model skipped counts as failed; pressing
    hang up passes "ended" whatever the model thought."""
    checks = []
    for spec in DRILL_CHECKS:
        passed, detail = judged.get(spec.id, (False, "Not assessed"))
        if spec.id == "ended" and hung_up:
            passed, detail = True, "Hung up on the caller."
        checks.append(DrillCheck(spec.name, passed, detail.strip(), spec.critical))
    return tuple(checks)


def score_drill(checks: tuple[DrillCheck, ...]) -> tuple[int, DrillVerdict]:
    if not checks:
        return 0, DrillVerdict.AT_RISK
    score = round(100 * sum(c.passed for c in checks) / len(checks))
    if any(c.critical and not c.passed for c in checks):
        return min(score, 40), DrillVerdict.SCAMMED
    if score < 80:
        return score, DrillVerdict.AT_RISK
    return score, DrillVerdict.SAFE
