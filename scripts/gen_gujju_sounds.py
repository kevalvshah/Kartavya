"""
Gujarati funny notification sounds — synthesized with stdlib only.
Run: python scripts/gen_gujju_sounds.py
"""
import math, wave, struct, os, subprocess, tempfile

SR = 44100
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "sounds")


def silence(dur): return [0.0] * int(SR * dur)

def concat(*parts):
    out = []
    for p in parts: out.extend(p)
    return out

def tone(freq, dur, amp=1.0, decay=0.0, fade_in=0.005, fade_out=0.05, waveform='sine'):
    n = int(SR * dur)
    samples = []
    for i in range(n):
        t = i / SR
        if waveform == 'saw':   v = 2 * ((freq * t) % 1.0) - 1
        elif waveform == 'square': v = 1.0 if math.sin(2*math.pi*freq*t) >= 0 else -1.0
        else:                   v = math.sin(2 * math.pi * freq * t)
        samples.append(amp * v * math.exp(-decay * t))
    fi, fo = int(SR * fade_in), int(SR * fade_out)
    for i in range(min(fi, n)): samples[i] *= i / fi
    for i in range(min(fo, n)): samples[n-1-i] *= i / fo
    return samples

def noise_hit(dur, amp=1.0, decay=30.0):
    n = int(SR * dur)
    out = []
    for i in range(n):
        t = i / SR
        ns = (math.sin(i * 12.9898 + 5) * 43758.5453) % 1.0 * 2 - 1
        out.append(amp * ns * math.exp(-decay * t))
    fo = int(SR * 0.02)
    for i in range(min(fo, n)): out[n-1-i] *= i / fo
    return out

def normalize(s, gain=0.85):
    peak = max(1e-6, max(abs(x) for x in s))
    return [x / peak * gain for x in s]

def save(name, samples):
    samples = normalize(samples)
    fd, tmp = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    with wave.open(tmp, "w") as wf:
        wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(SR)
        wf.writeframes(b"".join(
            struct.pack("<h", int(max(-1.0, min(1.0, s)) * 32767)) for s in samples))
    out = os.path.join(OUT_DIR, name + ".mp3")
    subprocess.run(["ffmpeg", "-y", "-i", tmp, "-c:a", "libmp3lame", "-q:a", "4", out], capture_output=True)
    os.unlink(tmp)
    print(f"  {name}.mp3")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    print("Generating Gujju sounds...")

    # 1. Garba dhol — dha-dhin dha-dhin pattern (fast festive beat)
    def dhol_hit(low=True):
        freq = 90 if low else 160
        n = int(SR * 0.12)
        out = []
        for i in range(n):
            t = i / SR
            body = math.sin(2*math.pi*freq*t) + 0.4*math.sin(2*math.pi*freq*2*t)
            ns = (math.sin(i*12.9898+2)*43758.5453)%1.0*2-1
            env = math.exp(-25*t)
            out.append((body*0.7 + ns*0.3) * env)
        fo = int(SR*0.03)
        for i in range(fo): out[n-1-i] *= i/fo
        return out

    garba = concat(
        dhol_hit(True), silence(0.05),
        dhol_hit(False), silence(0.03),
        dhol_hit(True), silence(0.05),
        dhol_hit(False), silence(0.03),
        dhol_hit(True), silence(0.03),
        dhol_hit(True), silence(0.05),
        dhol_hit(False), silence(0.18),
    )
    save("garba_dhol", garba)

    # 2. Dandiya sticks — two sharp wooden clacks
    def dandiya_clack():
        n = int(SR * 0.08)
        out = []
        for i in range(n):
            t = i / SR
            # sharp wooden click: inharmonic high partials
            v = (math.sin(2*math.pi*1200*t)*math.exp(-80*t) +
                 math.sin(2*math.pi*2400*t)*0.5*math.exp(-120*t) +
                 math.sin(2*math.pi*800*t)*0.3*math.exp(-60*t))
            ns = (math.sin(i*17.9898)*43758.5453)%1.0*2-1
            out.append(v*0.7 + ns*0.15*math.exp(-100*t))
        fo = int(SR*0.015)
        for i in range(fo): out[n-1-i] *= i/fo
        return out

    dandiya = concat(
        dandiya_clack(), silence(0.18),
        dandiya_clack(), silence(0.18),
        dandiya_clack(), silence(0.10),
        dandiya_clack(), silence(0.28),
    )
    save("dandiya_sticks", dandiya)

    # 3. Thali ding — metal plate ring (like hitting a steel thali)
    n_th = int(SR * 1.6)
    thali = []
    for i in range(n_th):
        t = i / SR
        # inharmonic steel partials, long ring
        v = (math.sin(2*math.pi*900*t)*math.exp(-1.2*t) +
             math.sin(2*math.pi*2300*t)*0.5*math.exp(-2.0*t) +
             math.sin(2*math.pi*3800*t)*0.25*math.exp(-3.5*t) +
             math.sin(2*math.pi*5200*t)*0.12*math.exp(-5.0*t))
        fi_env = min(1.0, t/0.003)
        thali.append(v * fi_env)
    fo = int(SR*0.3)
    for i in range(fo): thali[n_th-1-i] *= i/fo
    save("thali_ding", thali)

    # 4. "Kem cho" melody — tonal 3-note phrase (K-em cho = 3 syllables, ascending-down)
    kemcho = concat(
        tone(392.00, 0.18, decay=4, fade_out=0.04),   # G4  "Kem"
        tone(493.88, 0.14, decay=5, fade_out=0.03),   # B4  "-"
        tone(440.00, 0.55, decay=2.5, fade_out=0.2),  # A4  "cho" (held)
    )
    save("kem_cho", kemcho)

    # 5. Fafda crunch — crunchy noise burst (eating snack)
    n_ff = int(SR * 0.5)
    fafda = []
    for i in range(n_ff):
        t = i / SR
        # multiple random-ish crunch bursts
        burst = sum(
            (math.sin(i * (12.9898 + k*3.7) + k) * 43758.5453) % 1.0 * 2 - 1
            for k in range(6)
        ) / 6
        # amplitude envelope: several quick crunch peaks
        env = (math.exp(-40*(t-0.02)**2) * 1.0 +
               math.exp(-60*(t-0.15)**2) * 0.8 +
               math.exp(-50*(t-0.30)**2) * 0.6 +
               math.exp(-70*(t-0.42)**2) * 0.5)
        fafda.append(burst * env)
    save("fafda_crunch", fafda)

    print(f"\nDone.")

if __name__ == "__main__":
    main()
