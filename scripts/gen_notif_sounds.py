"""Synthesize 5 short notification sounds, each stylized after an Indian
classical instrument timbre, using only stdlib (wave + math — no audio
samples, no licensing concerns). These are procedural approximations for
a UI notification cue, not realistic instrument recordings.

Run: python scripts/gen_notif_sounds.py
Outputs to frontend/public/sounds/*.wav
"""
import math
import wave
import struct
import os

SR = 44100
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "sounds")


def render(partials, duration, fade_in=0.01, fade_out=0.15, noise_amt=0.0, noise_decay=8.0):
    """partials: list of (freq_hz, amplitude, decay_rate, pitch_drop_hz_per_s)."""
    n = int(SR * duration)
    samples = [0.0] * n
    for i in range(n):
        t = i / SR
        v = 0.0
        for freq, amp, decay, pitch_drop in partials:
            f = max(1.0, freq - pitch_drop * t)
            v += amp * math.exp(-decay * t) * math.sin(2 * math.pi * f * t)
        if noise_amt:
            # cheap deterministic pseudo-noise (no random import needed for reproducibility)
            ns = (math.sin(i * 12.9898) * 43758.5453) % 1.0 * 2 - 1
            v += noise_amt * math.exp(-noise_decay * t) * ns
        samples[i] = v
    # normalize
    peak = max(1e-6, max(abs(s) for s in samples))
    samples = [s / peak for s in samples]
    # fade in/out to avoid clicks
    fi = int(SR * fade_in)
    fo = int(SR * fade_out)
    for i in range(fi):
        samples[i] *= i / fi
    for i in range(fo):
        idx = n - 1 - i
        samples[idx] *= i / fo
    return samples


def write_wav(path, samples, gain=0.7):
    with wave.open(path, "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        frames = b"".join(struct.pack("<h", int(max(-1.0, min(1.0, s * gain)) * 32767)) for s in samples)
        wf.writeframes(frames)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    # Each sound runs ~2s longer than the original cut — decay rates are
    # scaled down proportionally so the tail actually rings out audibly
    # over the extra length instead of just trailing into silence.
    EXTRA = 2.0

    # 1. Tabla — low percussive thump ("na" bol): fast decay, slight pitch drop
    tabla_dur = 0.4 + EXTRA
    k = 0.4 / tabla_dur
    tabla = render(
        partials=[(180, 1.0, 14.0 * k, 60.0), (110, 0.6, 10.0 * k, 20.0), (340, 0.25, 30.0 * k, 0.0)],
        duration=tabla_dur, fade_in=0.002, fade_out=1.0,
    )
    write_wav(os.path.join(OUT_DIR, "tabla.wav"), tabla)

    # 2. Bansuri (flute) — sustained tone with vibrato + breath noise
    bansuri_dur = 0.7 + EXTRA
    decay = 1.2 * (0.7 / bansuri_dur)
    n = int(SR * bansuri_dur)
    bansuri = [0.0] * n
    for i in range(n):
        t = i / SR
        vibrato = 1 + 0.01 * math.sin(2 * math.pi * 5.5 * t)
        f = 523.25 * vibrato  # C5
        env = min(1.0, t / 0.08) * math.exp(-decay * t)
        v = math.sin(2 * math.pi * f * t) + 0.25 * math.sin(2 * math.pi * f * 2 * t)
        ns = (math.sin(i * 12.9898) * 43758.5453) % 1.0 * 2 - 1
        v += 0.05 * ns
        bansuri[i] = v * env
    peak = max(1e-6, max(abs(s) for s in bansuri))
    bansuri = [s / peak for s in bansuri]
    write_wav(os.path.join(OUT_DIR, "bansuri.wav"), bansuri)

    # 3. Sitar — plucked string: fundamental + decaying harmonics (jhankar buzz), slight meend
    sitar_dur = 0.8 + EXTRA
    k = 0.8 / sitar_dur
    sitar = render(
        partials=[
            (329.63, 1.0, 4.0 * k, 8.0),   # E4 fundamental, slow decay
            (659.26, 0.5, 7.0 * k, 4.0),   # 2nd harmonic, faster decay
            (989.0,  0.35, 10.0 * k, 2.0), # 3rd harmonic
            (1318.5, 0.2, 14.0 * k, 0.0),  # 4th harmonic (buzz/jhankar)
        ],
        duration=sitar_dur, fade_in=0.003, fade_out=1.2,
    )
    write_wav(os.path.join(OUT_DIR, "sitar.wav"), sitar)

    # 4. Tanpura — sustained drone with rich harmonics + slow tremolo (jvari)
    tanpura_dur = 0.9 + EXTRA
    decay = 0.9 * (0.9 / tanpura_dur)
    n = int(SR * tanpura_dur)
    tanpura = [0.0] * n
    base = 110.0  # low Sa
    for i in range(n):
        t = i / SR
        tremolo = 1 + 0.08 * math.sin(2 * math.pi * 7.0 * t)
        env = min(1.0, t / 0.05) * math.exp(-decay * t)
        v = (
            1.0 * math.sin(2 * math.pi * base * t)
            + 0.5 * math.sin(2 * math.pi * base * 2 * t)
            + 0.3 * math.sin(2 * math.pi * base * 3 * t)
            + 0.15 * math.sin(2 * math.pi * base * 4.05 * t)  # slight detune = jvari shimmer
        )
        tanpura[i] = v * env * tremolo
    peak = max(1e-6, max(abs(s) for s in tanpura))
    tanpura = [s / peak for s in tanpura]
    write_wav(os.path.join(OUT_DIR, "tanpura.wav"), tanpura)

    # 5. Temple bell (ghanta) — inharmonic partials, long bright decay
    ghanta_dur = 1.1 + EXTRA
    k = 1.1 / ghanta_dur
    ghanta = render(
        partials=[
            (440.0, 1.0, 2.2 * k, 0.0),
            (440.0 * 2.4, 0.5, 3.0 * k, 0.0),
            (440.0 * 3.1, 0.35, 3.6 * k, 0.0),
            (440.0 * 4.6, 0.2, 4.5 * k, 0.0),
        ],
        duration=ghanta_dur, fade_in=0.002, fade_out=1.4,
    )
    write_wav(os.path.join(OUT_DIR, "ghanta.wav"), ghanta)

    print("Wrote 5 sounds to", OUT_DIR)


if __name__ == "__main__":
    main()
