"""Turns clean speech into what a weak mobile call sounds like.

The candidate's voice is band-limited to the telephone band (about 300–3400 Hz), sampled
down to 8 kHz and back, squeezed through 8-bit μ-law like a real phone codec, and mixed with
low street rumble plus hiss. Input and output are 16 kHz mono 16-bit PCM, so the result
drops straight into the recording and goes to speech recognition unchanged in format.

Pure Python on purpose: one turn is a few seconds of audio, and the noise is seeded so the
same conversation always sounds the same.
"""

from __future__ import annotations

import math
import random
from array import array

_RATE = 16_000
# One-pole filter coefficients for the telephone band edges.
_HIGH_PASS = math.exp(-2 * math.pi * 300 / _RATE)
_LOW_PASS = 1 - math.exp(-2 * math.pi * 3400 / _RATE)
_RUMBLE = math.exp(-2 * math.pi * 250 / _RATE)
_MU = 255.0
_FULL_SCALE = 32767.0


def _mu_law_round_trip(x: float) -> float:
    """Encode to 8-bit μ-law and back, which is what a phone codec does to every sample."""
    y = math.copysign(math.log1p(_MU * abs(x)) / math.log1p(_MU), x)
    y = round(y * 127) / 127
    return math.copysign((math.pow(1 + _MU, abs(y)) - 1) / _MU, y)


def _rms(samples: list[float]) -> float:
    return math.sqrt(sum(s * s for s in samples) / len(samples)) if samples else 0.0


def degrade(pcm: bytes, seed: int, snr_db: float = 6.0) -> bytes:
    if len(pcm) < 4:
        return pcm
    clean = array("h", pcm[: len(pcm) - len(pcm) % 2])
    voice = [s / _FULL_SCALE for s in clean]

    # Telephone band: cut the low end, cut the top with two low-pass stages so nothing above
    # the band aliases, then average sample pairs down to 8 kHz and interpolate back up.
    band: list[float] = []
    prev_in = prev_out = low1 = low2 = 0.0
    for x in voice:
        prev_out = _HIGH_PASS * (prev_out + x - prev_in)
        prev_in = x
        low1 += _LOW_PASS * (prev_out - low1)
        low2 += _LOW_PASS * (low1 - low2)
        band.append(low2)
    narrow = [(band[i] + band[i + 1]) / 2 for i in range(0, len(band) - 1, 2)]
    line: list[float] = []
    for i, s in enumerate(narrow):
        nxt = narrow[i + 1] if i + 1 < len(narrow) else s
        line += (s, (s + nxt) / 2)
    line += [line[-1]] * (len(voice) - len(line))

    # Street noise: low rumble plus a little hiss, scaled under the speech level.
    rng = random.Random(seed)
    noise: list[float] = []
    rumble = 0.0
    for _ in line:
        rumble = _RUMBLE * rumble + (1 - _RUMBLE) * rng.gauss(0, 1)
        noise.append(rumble * 6 + rng.gauss(0, 0.15))
    speech_level, noise_level = _rms(line), _rms(noise)
    gain = speech_level / (noise_level * 10 ** (snr_db / 20)) if noise_level else 0.0

    out = array("h")
    for s, n in zip(line, noise, strict=True):
        mixed = max(-1.0, min(1.0, s + n * gain))
        out.append(int(_mu_law_round_trip(mixed) * _FULL_SCALE))
    return out.tobytes()
