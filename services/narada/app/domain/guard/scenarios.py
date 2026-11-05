"""Who might call. Scam scripts follow the frauds most reported in India (fake police /
"digital arrest", KYC-OTP, electricity cut-off, parcel with drugs). All names and numbers
the AI uses are invented.

Ids are stable: the frontend and stored calls refer to them.
"""

from __future__ import annotations

from app.domain.guard.models import CallCategory, CallerScenario

_NO_REAL_DATA = (
    " Never use a real phone number, account number, Aadhaar or PAN; make up obviously "
    "fake ones if you need to. Never name a real bank, company or person: use made-up "
    "names such as 'Sunrise Bank' or 'SwiftShip Couriers'."
)

SCAMS: tuple[CallerScenario, ...] = (
    CallerScenario(
        id="digital-arrest",
        title="Fake police: 'digital arrest'",
        description="Claims to be a CBI / cyber-crime officer; says your Aadhaar was used for "
        "money laundering and you must stay on the call and pay to 'verify'.",
        brief="You pretend to be Inspector Rajesh Sharma from CBI cyber cell. Say a parcel "
        "with drugs and fake passports was booked on their Aadhaar. Threaten 'digital arrest' "
        "and say they must not tell family. Demand they transfer money to an 'RBI "
        "verification account' or share bank details to clear their name.",
        expected=CallCategory.SCAM,
        scam=True,
        language="Hindi",
    ),
    CallerScenario(
        id="kyc-otp",
        title="Bank KYC: 'share the OTP'",
        description="Says the bank account will be blocked today unless KYC is updated, then "
        "asks for the OTP sent to the phone.",
        brief="You pretend to be from the bank's KYC department. Say their account will be "
        "blocked by 6 PM because KYC expired. Say you are sending an OTP to 'verify' and ask "
        "them to read it out. Push hard on urgency.",
        expected=CallCategory.SCAM,
        scam=True,
        language="English",
    ),
    CallerScenario(
        id="electricity-cutoff",
        title="Electricity cut-off tonight",
        description="Says the bill is unpaid and power will be cut at 9:30 PM unless they "
        "install an app and pay a small amount.",
        brief="You pretend to be from the electricity board. Say last month's bill was not "
        "updated and power will be cut at 9:30 PM tonight. Ask them to install a 'support "
        "app' (a screen-sharing app) and pay Rs 10 to update the record.",
        expected=CallCategory.SCAM,
        scam=True,
        language="Kannada",
    ),
    CallerScenario(
        id="courier-customs",
        title="Courier stuck at customs",
        description="Says a parcel in their name is held at customs and asks for a "
        "'clearance fee' by UPI.",
        brief="You pretend to be from an international courier company. Say a parcel in their "
        "name is held at Mumbai customs and needs a clearance fee of Rs 2,450 by UPI today, "
        "or police will be informed.",
        expected=CallCategory.SCAM,
        scam=True,
        language="Tamil",
    ),
)

_GENUINE: tuple[CallerScenario, ...] = (
    CallerScenario(
        id="family-urgent",
        title="Mom: urgent",
        description="Mother calling; father is unwell and she needs the owner to call back "
        "as soon as possible.",
        brief="You are the owner's mother, Sunita. You are worried: their father has a high "
        "fever and you want them to call back as soon as possible. You do not know who the "
        "assistant is at first.",
        expected=CallCategory.FAMILY,
        language="Hindi",
    ),
    CallerScenario(
        id="recruiter",
        title="Recruiter: interview slot",
        description="HR from a company wants to schedule a second-round interview this week.",
        brief="You are Pushkar from TalentBridge hiring. You want to schedule the owner's "
        "second-round interview for a backend role this week and need a time that works.",
        expected=CallCategory.WORK,
        language="English",
    ),
    CallerScenario(
        id="real-bank",
        title="Bank: genuine loan follow-up",
        description="Relationship manager about pending home-loan documents. Never asks for "
        "an OTP or PIN.",
        brief="You are Arjun, the owner's relationship manager at their bank. Two documents "
        "for their home-loan application are pending (salary slip and address proof). You "
        "only want them to upload them in the bank's app or visit the branch. Never ask for "
        "an OTP, PIN or password.",
        expected=CallCategory.BANK,
        language="English",
    ),
    CallerScenario(
        id="delivery",
        title="Delivery at the gate",
        description="Delivery partner can't find the address; calling from a busy road.",
        brief="You are Ravi, a delivery partner on a two-wheeler. You have a parcel for the "
        "owner and cannot find the building. You want a landmark or someone to collect it.",
        expected=CallCategory.DELIVERY,
        noisy_line=True,
        language="Kannada",
    ),
    CallerScenario(
        id="credit-card-sales",
        title="Sales: credit card offer",
        description="Telecaller pushing a 'lifetime free' credit card.",
        brief="You are a telecaller from a card sales agency offering a 'lifetime free' "
        "credit card with airport lounge access. You want to book a time for a document "
        "pickup. You are polite but persistent.",
        expected=CallCategory.SALES,
        language="Tamil",
    ),
)

CALLERS: tuple[CallerScenario, ...] = (*SCAMS, *_GENUINE)


def caller_by_id(scenario_id: str) -> CallerScenario:
    for scenario in CALLERS:
        if scenario.id == scenario_id:
            return scenario
    raise KeyError(scenario_id)


def scam_by_id(scam_id: str) -> CallerScenario:
    for scenario in SCAMS:
        if scenario.id == scam_id:
            return scenario
    raise KeyError(scam_id)


def caller_brief(scenario: CallerScenario) -> str:
    return scenario.brief + _NO_REAL_DATA
