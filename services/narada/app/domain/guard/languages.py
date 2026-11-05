"""Which language to speak with someone.

Gnani's speech recognition takes up to four candidate languages per request and reports
the one it detected. The assistant listens for the owner's chosen four, and either follows
what it hears (an incoming caller) or asks which language the person prefers (a call made
on the owner's behalf); a language the person names beats the one detected.
"""

from __future__ import annotations

MAX_LISTEN_LANGUAGES = 4

CODES: dict[str, str] = {
    "English": "en-IN",
    "Hindi": "hi-IN",
    "Kannada": "kn-IN",
    "Tamil": "ta-IN",
    "Telugu": "te-IN",
    "Malayalam": "ml-IN",
    "Marathi": "mr-IN",
    "Bengali": "bn-IN",
    "Gujarati": "gu-IN",
}
_BY_CODE = {code: name for name, code in CODES.items()}

# How people say the language's name, in English and in its own script.
_NAMES: dict[str, tuple[str, ...]] = {
    "English": ("english", "angrezi", "अंग्रेज़ी", "अंग्रेजी", "ಇಂಗ್ಲಿಷ್", "ஆங்கிலம்"),
    "Hindi": ("hindi", "हिंदी", "हिन्दी", "ಹಿಂದಿ", "இந்தி"),
    "Kannada": ("kannada", "ಕನ್ನಡ", "कन्नड़", "कन्नड"),
    "Tamil": ("tamil", "தமிழ்", "तमिल"),
    "Telugu": ("telugu", "తెలుగు", "तेलुगु"),
    "Malayalam": ("malayalam", "മലയാളം", "मलयालम"),
    "Marathi": ("marathi", "मराठी"),
    "Bengali": ("bengali", "bangla", "বাংলা", "बंगाली"),
    "Gujarati": ("gujarati", "ગુજરાતી", "गुजराती"),
}

DEFAULT_LISTEN = ("English", "Hindi", "Kannada", "Tamil")


def listen_codes(languages: tuple[str, ...]) -> str:
    codes = [CODES[name] for name in languages if name in CODES][:MAX_LISTEN_LANGUAGES]
    return ",".join(codes) or "en-IN,hi-IN"


def language_of_code(code: str | None) -> str | None:
    return _BY_CODE.get(code or "")


def named_language(text: str, allowed: tuple[str, ...]) -> str | None:
    """The language a person asked for by name ("Kannada please", "ಕನ್ನಡ"), if exactly one
    of the allowed languages is named. Two named ("Hindi or English is fine") is no choice."""
    lowered = text.lower()
    named = {name for name in allowed if any(word in lowered for word in _NAMES.get(name, (name,)))}
    return named.pop() if len(named) == 1 else None


def pick_language(
    heard: str,
    detected_code: str | None,
    allowed: tuple[str, ...],
    current: str,
    allow_named: bool = False,
) -> str:
    """Named beats detected (only when the person was just asked which language they
    want; otherwise "the Kannada file" would switch the call); detected beats keeping the
    current language."""
    named = named_language(heard, allowed) if allow_named else None
    if named:
        return named
    detected = language_of_code(detected_code)
    if detected and detected in allowed and heard.strip():
        return detected
    return current
