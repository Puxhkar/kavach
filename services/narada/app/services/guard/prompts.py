"""Prompts and JSON schemas for Call Guard. Every spoken prompt asks for phone-length
replies: one or two short sentences, no markdown, because each line is read aloud."""

from __future__ import annotations

from typing import Any

from app.domain.guard.models import CallCategory, CallerScenario, Priority, Profile
from app.domain.guard.rules import DRILL_CHECKS
from app.domain.guard.scenarios import caller_brief

END_CALL = "[END_CALL]"
SILENCE = "(silence)"
CALL_CONNECTED = "(The call has connected. You speak first.)"

_PHONE_STYLE = (
    "This is a phone call: at most two short sentences per turn, no lists, no emojis, "
    "no markdown, no stage directions, and never a translation or note in brackets."
)


def reply_in(heard: str, language: str) -> str:
    """What the AI receives from the other side: their words plus which language to answer
    in. Without the note a model keeps answering in the language the call started in."""
    return f"{heard or SILENCE}\n[Reply only in {language}.]"


def language_rule(language: str) -> str:
    if language == "Hinglish":
        return (
            "Speak Hinglish: Hindi written in Latin letters, mixed with English words, the way "
            "people in Indian cities talk."
        )
    if language == "English":
        return "Speak simple Indian English."
    return (
        f"Speak {language}, written in {language} script. Keep words like OTP, bank, KYC, "
        "UPI and app in English."
    )


def _vip_line(profile: Profile) -> str:
    if not profile.vip_contacts:
        return ""
    people = ", ".join(
        f"{v.name} ({v.relation})" if v.relation else v.name for v in profile.vip_contacts
    )
    return (
        f"People {profile.owner_name} always wants to hear from: {people}. If one of them "
        f"says it is urgent, say you will alert {profile.owner_name} right away.\n"
    )


def assistant_system(profile: Profile, language: str) -> str:
    owner = profile.owner_name
    notes = f"Also know this: {profile.notes}\n" if profile.notes else ""
    return (
        f"You are the personal phone assistant of {owner}. {owner} is busy, so you answer "
        f"their calls.\n{language_rule(language)} {_PHONE_STYLE}\n"
        "Your job, in order:\n"
        f"1. Greet: say you are {owner}'s assistant and {owner} cannot take the call right "
        "now. Ask who is calling.\n"
        "2. Find out the caller's name, where they are calling from (company, or how they "
        "know " + owner + "), and what it is about. One question at a time, and never ask "
        "again for something the caller already told you.\n"
        f"3. Tell them {owner} is free {profile.availability} and will call back then.\n"
        "4. Thank them and end the call.\n"
        "Rules you never break:\n"
        f"- Never share or confirm {owner}'s phone numbers, address, bank or card details, "
        "OTPs, passwords, Aadhaar or PAN, or where they are right now.\n"
        "- Never agree to pay, transfer money, install an app, or keep the line open for "
        "'verification'.\n"
        "- Threats (arrest, account blocked, power cut, parcel with drugs), and demands for "
        "an OTP, money or secrecy are scam signs: stay calm, refuse politely, say "
        f"{owner} will check through official channels, and end the call.\n"
        f"- Promise nothing on {owner}'s behalf except the call back.\n"
        f"{_vip_line(profile)}{notes}"
        f"When you end the call, put {END_CALL} at the very end of your last message."
    )


def caller_system(scenario: CallerScenario, profile: Profile, language: str) -> str:
    return (
        f"You are playing a phone caller in a realistic call. You are calling "
        f"{profile.owner_name}'s phone, and their AI assistant answers.\n"
        f"Who you are and what you want: {caller_brief(scenario)}\n"
        f"{language_rule(language)} {_PHONE_STYLE} Stay in character and never say this is a "
        "simulation. Answer the assistant's questions the way this caller really would.\n"
        "When you are done (you got what you wanted, or you give up), say goodbye and put "
        f"{END_CALL} at the very end."
    )


def scammer_system(scam: CallerScenario, practicer: str, language: str) -> str:
    return (
        "This is a scam-awareness training exercise. "
        f"{practicer} agreed to practise against a scam phone call, and you play the "
        "scammer so they learn the warning signs. Nothing here is real.\n"
        f"Your role: {caller_brief(scam)}\n"
        "Use these tactics one or two at a time: sound official, create urgency, use fear "
        "(arrest, blocked account, power cut), demand secrecy, and ask for an OTP, bank or "
        "card details, a UPI payment, or installing an app.\n"
        f"{language_rule(language)} {_PHONE_STYLE} Stay in character and never say this is "
        "training.\n"
        f"If {practicer} firmly refuses twice, says they will check with the official "
        "number, or says they will report you: give up and end the call. If they hand over "
        "an OTP, payment or details: thank them and end the call.\n"
        f"Put {END_CALL} at the very end of your last message."
    )


def transcript_text(lines: list[tuple[str, str]]) -> str:
    return "\n".join(f"{who}: {text}" for who, text in lines)


def triage_system(profile: Profile) -> str:
    owner = profile.owner_name
    vips = (
        ", ".join(f"{v.name} ({v.relation})" for v in profile.vip_contacts)
        if profile.vip_contacts
        else "none"
    )
    return (
        f"You review a phone call that {owner}'s AI assistant answered for them, and write "
        f"the entry for {owner}'s call inbox. Caller lines are what speech recognition "
        "heard, so small spelling slips are normal.\n"
        "priority: urgent = a family emergency or anything that cannot wait a few hours; "
        "high = important and time-bound (work, a bank about the owner's own pending "
        "request, a VIP); normal = genuine but can wait; low = sales, offers, surveys; "
        "blocked = scam.\n"
        "scamRisk 0-100 = how likely this is fraud. Strong signs: threats of arrest, "
        "blocking or disconnection; asking for an OTP, PIN or password; payment by UPI or "
        "gift card to 'verify'; screen-sharing or remote apps; secrecy ('don't tell "
        "family'); claiming to be police, CBI, RBI, customs or bank KYC; pressure to act "
        "within minutes. Police, CBI or customs saying a parcel or ID in the owner's name is "
        "linked to drugs or a crime is the 'digital arrest' scam even before they ask for "
        "money. A caller who only asks for a call back and wants nothing secret is low "
        "risk.\n"
        f"organisation: the caller's company, or their relation to {owner} (e.g. 'mother', "
        "'friend') when they are family or a friend.\n"
        "redFlags: short phrases describing what the caller did that was suspicious; empty "
        "when there were none.\n"
        "callback: what the assistant told the caller about when they will hear back.\n"
        f"summary: one or two sentences for {owner}. action: one short instruction for "
        f"{owner}, e.g. 'Call Mom back now', 'Ignore, don't call back', 'Upload the salary "
        "slip in the bank app'.\n"
        f"VIP contacts: {vips}. Write every field in English."
    )


TRIAGE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "callerName": {"type": "string"},
        "organisation": {"type": "string"},
        "purpose": {"type": "string"},
        "category": {"type": "string", "enum": [c.value for c in CallCategory]},
        "priority": {"type": "string", "enum": [p.value for p in Priority]},
        "scamRisk": {"type": "integer"},
        "redFlags": {"type": "array", "items": {"type": "string"}},
        "callback": {"type": "string"},
        "summary": {"type": "string"},
        "action": {"type": "string"},
    },
    "required": [
        "callerName",
        "organisation",
        "purpose",
        "category",
        "priority",
        "scamRisk",
        "redFlags",
        "callback",
        "summary",
        "action",
    ],
    "additionalProperties": False,
}


_FAMILY_EXAMPLE = (
    " (Hindi in Latin letters mixed with English, e.g. 'Aaj Mummy ne fake bank call ko "
    "turant pehchaan liya!')"
)


def drill_system(scam: CallerScenario, practicer: str, language: str, hung_up: bool) -> str:
    checks = "\n".join(f"- {c.id}: {c.name}" for c in DRILL_CHECKS)
    ending = (
        f"{practicer} pressed hang up themselves."
        if hung_up
        else f"{practicer} did not press hang up."
    )
    return (
        f"You coach people to spot phone scams. {practicer} just practised against a fake "
        f"'{scam.title}' scam call (the scammer was an AI; nothing was real). Lines from "
        f"{practicer} are what speech recognition heard. {ending}\n"
        f"Judge each check from what {practicer} actually said:\n{checks}\n"
        "For each check give passed (true/false) and a one-sentence detail quoting what "
        "happened. A check about sharing or paying passes when they never did it.\n"
        f"tips: two or three short, kind, practical tips for {practicer}, in English.\n"
        "familyMessage: a short, warm message for the family WhatsApp group about how "
        f"{practicer} did and one thing to remember. Write it in {language}"
        f"{_FAMILY_EXAMPLE if language == 'Hinglish' else ''}, not in English unless the "
        "language is English. No score numbers."
    )


DRILL_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "checks": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string", "enum": [c.id for c in DRILL_CHECKS]},
                    "passed": {"type": "boolean"},
                    "detail": {"type": "string"},
                },
                "required": ["id", "passed", "detail"],
                "additionalProperties": False,
            },
        },
        "tips": {"type": "array", "items": {"type": "string"}},
        "familyMessage": {"type": "string"},
    },
    "required": ["checks", "tips", "familyMessage"],
    "additionalProperties": False,
}


def errand_opener(profile: Profile, recipient: str) -> str:
    """Fixed, in the opening language: who is calling, then the language question."""
    owner = profile.owner_name
    options = ", ".join(profile.listen_languages[:-1])
    options = (
        f"{options} or {profile.listen_languages[-1]}"
        if len(profile.listen_languages) > 1
        else profile.listen_languages[0]
    )
    return (
        f"Hello, am I speaking with {recipient}? I'm {owner}'s AI assistant, calling on "
        f"{owner}'s behalf. Which language are you most comfortable in: {options}?"
    )


def errand_system(profile: Profile, errand, language: str) -> str:
    owner = profile.owner_name
    who = (
        f"{errand.recipient_name} ({errand.recipient_role})"
        if errand.recipient_role
        else (errand.recipient_name)
    )
    deadline = f" Deadline: {errand.deadline}." if errand.deadline else ""
    return (
        f"You are {owner}'s AI assistant, on a phone call you made on {owner}'s behalf to "
        f'{who}. {owner} asked you to tell them: "{errand.task}".{deadline}\n'
        f"{language_rule(language)} {_PHONE_STYLE}\n"
        "Steps:\n"
        f"1. You already asked which language they prefer. Say in one short line that you "
        f"will continue in {language}, then deliver {owner}'s message clearly, with the "
        "deadline.\n"
        "2. Ask whether they can do it by then.\n"
        "3. If they have a question, need more time or set a condition, repeat it back so "
        f"they know you got it, and say you will tell {owner}. Never invent an answer or "
        f"agree to anything on {owner}'s behalf.\n"
        "4. Thank them and end the call.\n"
        f"Never share {owner}'s private details. If this is the wrong person, apologise and "
        f"end the call.\nWhen you end the call, put {END_CALL} at the very end of your last "
        "message."
    )


_BEHAVIOURS = {
    "agrees": "You agree to do it by the deadline and say roughly when you will finish.",
    "needs_time": (
        "You cannot finish by the deadline because you are waiting on something from "
        "someone else. Explain that and ask for one more day."
    ),
    "asks_question": (
        "Before agreeing, ask one clarifying question about the task (for example which "
        "version, format or where to send it). Then agree."
    ),
}


def recipient_system(profile: Profile, errand, language: str, behaviour: str) -> str:
    role = f", {errand.recipient_role}" if errand.recipient_role else ""
    return (
        f"You are playing {errand.recipient_name}{role}, in a realistic phone call. Your "
        f"phone rings: it is {profile.owner_name}'s AI assistant calling on their behalf.\n"
        f"When asked which language you are comfortable in, answer in {language} and say "
        f"its name. After that, speak only {language}. {language_rule(language)}\n"
        f"{_BEHAVIOURS[behaviour]}\n{_PHONE_STYLE} Never say this is a simulation. When the "
        f"call is wrapping up, say goodbye and put {END_CALL} at the very end."
    )


def errand_report_system(profile: Profile, errand) -> str:
    return (
        f"{profile.owner_name}'s AI assistant called {errand.recipient_name} to tell them: "
        f'"{errand.task}" (deadline: {errand.deadline or "none given"}). Read the call and '
        f"report back to {profile.owner_name}. Lines from {errand.recipient_name} are what "
        "speech recognition heard, possibly in another language.\n"
        "outcome: agreed = they said they will do it as asked; needs_follow_up = they "
        "answered but something is open (more time, a question, a condition); declined = "
        "they said no; not_reached = wrong person or they never really answered.\n"
        "commitment: what they committed to, e.g. 'will send it by 5 PM'; empty if nothing.\n"
        "concerns: short phrases for anything open; empty if none.\n"
        f"summary: one or two sentences for {profile.owner_name}. nextStep: one short "
        f"instruction written to {profile.owner_name} as 'you', e.g. 'Reply to "
        f"{errand.recipient_name}: is tomorrow 10 AM OK?'. Write every field in English."
    )


ERRAND_REPORT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "outcome": {
            "type": "string",
            "enum": ["agreed", "needs_follow_up", "declined", "not_reached"],
        },
        "commitment": {"type": "string"},
        "concerns": {"type": "array", "items": {"type": "string"}},
        "summary": {"type": "string"},
        "nextStep": {"type": "string"},
    },
    "required": ["outcome", "commitment", "concerns", "summary", "nextStep"],
    "additionalProperties": False,
}
