import math
from array import array

from app.services.testing.phone_line import degrade


def _tone(hz: float, seconds: float = 0.5, level: float = 0.3) -> bytes:
    n = int(16_000 * seconds)
    return array(
        "h", (int(level * 32767 * math.sin(2 * math.pi * hz * i / 16_000)) for i in range(n))
    ).tobytes()


def _rms(pcm: bytes) -> float:
    samples = array("h", pcm)
    return math.sqrt(sum(s * s for s in samples) / len(samples))


def test_keeps_the_format_and_length():
    clean = _tone(1000)
    noisy = degrade(clean, seed=1)
    assert len(noisy) == len(clean)
    assert noisy != clean


def test_same_seed_sounds_the_same():
    clean = _tone(1000)
    assert degrade(clean, seed=7) == degrade(clean, seed=7)
    assert degrade(clean, seed=7) != degrade(clean, seed=8)


def test_cuts_what_a_phone_line_cannot_carry():
    # 6 kHz is above the telephone band; 1 kHz is inside it. Compare at no added noise.
    inside = _rms(degrade(_tone(1000), seed=1, snr_db=60))
    above = _rms(degrade(_tone(6000), seed=1, snr_db=60))
    assert above < inside / 3


def test_silence_stays_quiet_and_tiny_input_is_untouched():
    assert _rms(degrade(bytes(16_000), seed=1)) < 50
    assert degrade(b"\x01\x00", seed=1) == b"\x01\x00"
