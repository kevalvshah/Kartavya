"""
Synthesize funny + scary notification sounds using only stdlib (wave + math).
Run: python scripts/gen_extra_sounds.py
Outputs to frontend/public/sounds/*.mp3 via ffmpeg (must be on PATH).
"""
import math
import wave
import struct
import os
import subprocess
import tempfile

SR = 44100
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "sounds")


def render(partials, duration, fade_in=0.01, fade_out=0.15, noise_amt=0.0, noise_decay=8.0):
    n = int(SR * duration)
    samples = [0.0] * n
    for i in range(n):
        t = i / SR
        v = 0.0
        for freq, amp, decay, pitch_drop in partials:
            f = max(1.0, freq - pitch_drop * t)
            v += amp * math.exp(-decay * t) * math.sin(2 * math.pi * f * t)
        if noise_amt:
            ns = (math.sin(i * 12.9898) * 43758.5453) % 1.0 * 2 - 1
            v += noise_amt * math.exp(-noise_decay * t) * ns
        samples[i] = v
    peak = max(1e-6, max(abs(s) for s in samples))
    samples = [s / peak for s in samples]
    fi, fo = int(SR * fade_in), int(SR * fade_out)
    for i in range(fi): samples[i] *= i / fi
    for i in range(fo): samples[n - 1 - i] *= i / fo
    return samples


def silence(dur):
    return [0.0] * int(SR * dur)


def concat(*parts):
    out = []
    for p in parts: out.extend(p)
    return out


def tone(freq, dur, amp=1.0, decay=0.0, fade_in=0.005, fade_out=0.05, waveform='sine'):
    n = int(SR * dur)
    samples = []
    for i in range(n):
        t = i / SR
        if waveform == 'sine':
            v = math.sin(2 * math.pi * freq * t)
        elif waveform == 'saw':
            v = 2 * ((freq * t) % 1.0) - 1
        elif waveform == 'square':
            v = 1.0 if math.sin(2 * math.pi * freq * t) >= 0 else -1.0
        elif waveform == 'triangle':
            v = 2 * abs(2 * ((freq * t) % 1.0) - 1) - 1
        else:
            v = math.sin(2 * math.pi * freq * t)
        env = math.exp(-decay * t)
        samples.append(amp * v * env)
    fi, fo = int(SR * fade_in), int(SR * fade_out)
    for i in range(min(fi, n)): samples[i] *= i / fi
    for i in range(min(fo, n)): samples[n - 1 - i] *= i / fo
    return samples


def noise_burst(dur, amp=1.0, decay=0.0, fade_out=0.1):
    n = int(SR * dur)
    samples = []
    for i in range(n):
        t = i / SR
        ns = (math.sin(i * 12.9898 + 1) * 43758.5453) % 1.0 * 2 - 1
        samples.append(amp * ns * math.exp(-decay * t))
    fo = int(SR * fade_out)
    for i in range(min(fo, n)): samples[n - 1 - i] *= i / fo
    return samples


def normalize(samples, gain=0.8):
    peak = max(1e-6, max(abs(s) for s in samples))
    return [s / peak * gain for s in samples]


def write_wav_tmp(samples, gain=0.7):
    fd, path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    with wave.open(path, "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        frames = b"".join(
            struct.pack("<h", int(max(-1.0, min(1.0, s * gain)) * 32767))
            for s in samples
        )
        wf.writeframes(frames)
    return path


def save(name, samples):
    samples = normalize(samples)
    tmp = write_wav_tmp(samples)
    out_path = os.path.join(OUT_DIR, name + ".mp3")
    subprocess.run(
        ["ffmpeg", "-y", "-i", tmp, "-c:a", "libmp3lame", "-q:a", "4", out_path],
        capture_output=True
    )
    os.unlink(tmp)
    print(f"  {name}.mp3")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    print("Generating sounds...")

    # ── FUNNY ────────────────────────────────────────────────────────────────

    # Sad trombone — wah-wah descending
    sad_trombone = concat(
        tone(466, 0.25, decay=1.5, waveform='saw'),
        tone(415, 0.25, decay=1.5, waveform='saw'),
        tone(370, 0.25, decay=1.5, waveform='saw'),
        tone(311, 0.75, decay=2.0, waveform='saw'),
    )
    save("sad_trombone", sad_trombone)

    # Windows XP error — iconic 4-chord sting (E4 G#4 D#4 A#4)
    def chord(freqs, dur, decay=4.0):
        n = int(SR * dur)
        out = [0.0] * n
        for f in freqs:
            s = tone(f, dur, amp=1/len(freqs), decay=decay)
            for i in range(n): out[i] += s[i]
        return out
    xp = concat(
        chord([329.63, 415.30], 0.18, decay=5),
        chord([261.63, 329.63, 415.30], 0.22, decay=5),
        chord([311.13, 369.99, 493.88], 0.22, decay=5),
        chord([233.08, 311.13, 369.99, 466.16], 0.55, decay=3),
    )
    save("windows_xp", xp)

    # Vine boom — sub-bass thud
    vine = render(
        [(55, 1.0, 8.0, 30.0), (80, 0.6, 12.0, 20.0), (110, 0.3, 20.0, 0.0)],
        duration=0.7, fade_in=0.002, fade_out=0.25,
    )
    save("vine_boom", vine)

    # Bruh — low descending grunt-like tone
    bruh = concat(
        tone(180, 0.12, waveform='saw', decay=2),
        tone(140, 0.55, waveform='saw', decay=3, fade_out=0.3),
    )
    # add subtle noise for voice-like texture
    nb = noise_burst(0.67, amp=0.08, decay=4)
    bruh_mix = [bruh[i] + nb[i] for i in range(len(bruh))]
    save("bruh", bruh_mix)

    # MLG airhorn — rising then sustained loud tone
    n_ah = int(SR * 1.5)
    airhorn = []
    for i in range(n_ah):
        t = i / SR
        # frequency sweeps from 300→800 Hz in first 0.3s, then sustains
        freq = min(800, 300 + 1666 * t) if t < 0.3 else 800
        env = 1.0 if t > 0.05 else t / 0.05
        # saw + harmonics for brassy quality
        v = (math.sin(2*math.pi*freq*t) +
             0.5*math.sin(2*math.pi*freq*2*t) +
             0.25*math.sin(2*math.pi*freq*3*t))
        airhorn.append(v * env)
    # fade out last 0.3s
    fo = int(SR * 0.3)
    for i in range(fo): airhorn[n_ah - 1 - i] *= i / fo
    save("mlg_airhorn", airhorn)

    # Crickets — high-freq chirping
    n_cr = int(SR * 1.8)
    crickets = []
    chirp_rate = 18.0  # chirps per second
    for i in range(n_cr):
        t = i / SR
        chirp_phase = (chirp_rate * t) % 1.0
        env = 1.0 if chirp_phase < 0.4 else 0.0  # chirp on/off
        v = math.sin(2 * math.pi * 4800 * t) * 0.7 + math.sin(2 * math.pi * 5100 * t) * 0.3
        crickets.append(v * env)
    fo = int(SR * 0.2)
    for i in range(fo): crickets[n_cr - 1 - i] *= i / fo
    save("crickets", crickets)

    # Price is Right losing horn — descending 4-note tuba
    price = concat(
        tone(233, 0.3, waveform='saw', decay=2),
        tone(196, 0.3, waveform='saw', decay=2),
        tone(174, 0.3, waveform='saw', decay=2),
        tone(155, 0.7, waveform='saw', decay=1.5, fade_out=0.3),
    )
    save("price_is_right", price)

    # Nyan cat melody snippet — Db major pentatonic riff
    nyan_notes = [554.37, 622.25, 698.46, 830.61, 932.33, 1046.50, 1174.66]
    nyan_seq = [0, 1, 3, 1, 3, 4, 2, 0]  # indexes
    nyan = []
    note_dur = 0.18
    for idx in nyan_seq:
        nyan.extend(tone(nyan_notes[idx], note_dur, decay=3, waveform='square', fade_in=0.01, fade_out=0.02))
    save("nyan_cat", nyan)

    # Among Us emergency meeting — alarm beep-beep-beep
    au_beep = concat(
        tone(880, 0.08, decay=1), silence(0.04),
        tone(880, 0.08, decay=1), silence(0.04),
        tone(880, 0.08, decay=1), silence(0.04),
        tone(1100, 0.35, decay=2),
    )
    save("among_us", au_beep)

    # Discord notification — two-tone descending ding
    discord = concat(
        tone(1396.91, 0.14, decay=6, fade_out=0.08),
        tone(1174.66, 0.55, decay=4, fade_out=0.25),
    )
    save("discord", discord)

    # ── SCARY ────────────────────────────────────────────────────────────────

    # Horror sting — rising violin screech
    n_hs = int(SR * 1.2)
    horror = []
    for i in range(n_hs):
        t = i / SR
        freq = 400 + 900 * (t / 1.2) ** 2  # accelerating upward sweep
        # harmonically rich: bowed string approximation
        v = (math.sin(2*math.pi*freq*t) +
             0.6*math.sin(2*math.pi*freq*2*t) +
             0.3*math.sin(2*math.pi*freq*3*t))
        # tremolo
        v *= 1 + 0.3 * math.sin(2 * math.pi * 14 * t)
        env = min(1.0, t / 0.05)
        horror.append(v * env)
    fo = int(SR * 0.15)
    for i in range(fo): horror[n_hs - 1 - i] *= i / fo
    save("horror_sting", horror)

    # Halloween organ — minor chord, dark
    halloween = concat(
        chord([110, 130.81, 164.81, 196.0], 1.6, decay=1.5),
    )
    save("halloween_organ", halloween)

    # Creaking door — slow pitch sweep with noise
    n_cd = int(SR * 1.5)
    creak = []
    for i in range(n_cd):
        t = i / SR
        # low rumble sweeping
        freq = 80 + 60 * math.sin(2 * math.pi * 0.8 * t)
        v = math.sin(2 * math.pi * freq * t) * 0.5
        ns = (math.sin(i * 7.9898) * 43758.5453) % 1.0 * 2 - 1
        v += 0.5 * ns * math.exp(-0.3 * t)
        creak.append(v)
    fo = int(SR * 0.2)
    for i in range(fo): creak[n_cd - 1 - i] *= i / fo
    save("creaking_door", creak)

    # Jump scare bass drop — silence then BOOM
    jumpscare = concat(
        silence(0.4),
        render(
            [(40, 1.0, 4.0, 0.0), (60, 0.6, 6.0, 0.0), (30, 0.4, 3.0, 0.0)],
            duration=1.2, fade_in=0.001, fade_out=0.4, noise_amt=0.3, noise_decay=5.0,
        )
    )
    save("jumpscare", jumpscare)

    # Heartbeat — lub-dub pattern x2
    def heartbeat_beat():
        lub = render([(60, 1.0, 20, 0), (80, 0.5, 25, 0)], 0.08, fade_in=0.002, fade_out=0.04)
        dub = render([(50, 0.7, 18, 0), (70, 0.4, 22, 0)], 0.07, fade_in=0.002, fade_out=0.035)
        return concat(lub, silence(0.07), dub)

    heartbeat = concat(heartbeat_beat(), silence(0.5), heartbeat_beat())
    save("heartbeat", heartbeat)

    # Thunder — noise burst with low rumble
    n_th = int(SR * 1.8)
    thunder = []
    for i in range(n_th):
        t = i / SR
        ns = (math.sin(i * 12.9898 + 3) * 43758.5453) % 1.0 * 2 - 1
        rumble = math.sin(2 * math.pi * 55 * t) + 0.5 * math.sin(2 * math.pi * 40 * t)
        crack_env = math.exp(-8 * t) if t < 0.15 else 0.0
        rumble_env = math.exp(-1.5 * t)
        thunder.append(ns * crack_env * 0.8 + rumble * rumble_env * 0.4)
    fo = int(SR * 0.3)
    for i in range(fo): thunder[n_th - 1 - i] *= i / fo
    save("thunder", thunder)

    # Clock tick then alarm blare
    def tick():
        return render([(2000, 1.0, 80, 0), (3000, 0.5, 120, 0)], 0.05, fade_in=0.001, fade_out=0.02)

    alarm = concat(
        tick(), silence(0.22),
        tick(), silence(0.22),
        tick(), silence(0.22),
        tone(1760, 0.7, waveform='square', decay=1, fade_out=0.2),
    )
    save("clock_alarm", alarm)

    # Demon whisper — low ominous rumble with high shimmer
    n_dm = int(SR * 1.6)
    demon = []
    for i in range(n_dm):
        t = i / SR
        low = math.sin(2 * math.pi * 55 * t) + 0.4 * math.sin(2 * math.pi * 82 * t)
        high = math.sin(2 * math.pi * 1800 * t) * 0.15
        ns = (math.sin(i * 12.9898) * 43758.5453) % 1.0 * 2 - 1
        env = min(1.0, t / 0.1) * math.exp(-0.6 * t)
        demon.append((low + high + ns * 0.1) * env)
    fo = int(SR * 0.3)
    for i in range(fo): demon[n_dm - 1 - i] *= i / fo
    save("demon_whisper", demon)

    # ── INDIAN FUNNY ─────────────────────────────────────────────────────────

    # Auto-rickshaw horn — "beep beep" nasal Indian horn
    def rickshaw_beep(freq=400, dur=0.25):
        n = int(SR * dur)
        out = []
        for i in range(n):
            t = i / SR
            # nasal honk: fundamental + strong 2nd harmonic
            v = (math.sin(2*math.pi*freq*t) +
                 0.8*math.sin(2*math.pi*freq*2*t) +
                 0.4*math.sin(2*math.pi*freq*3*t))
            env = 1.0
            out.append(v * env)
        fi = int(SR * 0.01)
        fo = int(SR * 0.04)
        for i in range(fi): out[i] *= i / fi
        for i in range(fo): out[n - 1 - i] *= i / fo
        return out

    rickshaw = concat(
        rickshaw_beep(380, 0.22), silence(0.08),
        rickshaw_beep(380, 0.22), silence(0.08),
        rickshaw_beep(350, 0.4),
    )
    save("rickshaw_horn", rickshaw)

    # Shehnai gone wrong — off-key warbling
    n_sh = int(SR * 1.5)
    shehnai = []
    for i in range(n_sh):
        t = i / SR
        # slightly detuned double reed wobble
        vibrato = 1 + 0.04 * math.sin(2 * math.pi * 6 * t)
        base = 349.23 * vibrato
        # sudden pitch jump at 0.6s (gone wrong moment)
        if t > 0.6:
            base = 277.18 * (1 + 0.07 * math.sin(2 * math.pi * 7 * t))
        v = (math.sin(2*math.pi*base*t) +
             0.6*math.sin(2*math.pi*base*2*t) +
             0.3*math.sin(2*math.pi*base*3*t))
        env = min(1.0, t / 0.05) * math.exp(-0.3 * t)
        shehnai.append(v * env)
    fo = int(SR * 0.2)
    for i in range(fo): shehnai[n_sh - 1 - i] *= i / fo
    save("shehnai_gone_wrong", shehnai)

    # Bollywood suspense sting — dramatic descending strings
    bw = concat(
        chord([523.25, 622.25, 739.99], 0.15, decay=8),
        silence(0.05),
        chord([415.30, 523.25, 622.25], 0.15, decay=8),
        silence(0.05),
        chord([311.13, 369.99, 466.16], 0.15, decay=8),
        silence(0.05),
        chord([233.08, 293.66, 349.23], 0.7, decay=4),
    )
    save("bollywood_suspense", bw)

    # Indian train horn — long rising blast
    n_tr = int(SR * 1.6)
    train_horn = []
    for i in range(n_tr):
        t = i / SR
        freq = 220 + 30 * math.sin(2 * math.pi * 0.5 * t)  # slight Doppler wobble
        v = (math.sin(2*math.pi*freq*t) +
             0.7*math.sin(2*math.pi*freq*1.5*t) +
             0.4*math.sin(2*math.pi*freq*2*t) +
             0.2*math.sin(2*math.pi*freq*3*t))
        env = min(1.0, t / 0.08) * (1.0 - max(0, (t - 1.2) / 0.4))
        train_horn.append(v * env)
    save("indian_train_horn", train_horn)

    print(f"\nDone — wrote sounds to {OUT_DIR}")


if __name__ == "__main__":
    main()
