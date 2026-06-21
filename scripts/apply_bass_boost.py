"""
Apply bass boost + slight pitch-down to all voice/sound MP3s.
Run: python scripts/apply_bass_boost.py
"""
import os, subprocess, tempfile, glob

SOUNDS_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "sounds")

# ffmpeg filter: pitch down 10% (deeper voice) + heavy bass boost
FILTER = "asetrate=44100*0.88,aresample=44100,bass=g=12:f=120:w=0.5"

def process(path):
    tmp = os.path.join(os.path.dirname(path), "_tmp_bass.mp3")
    r = subprocess.run(
        ["ffmpeg", "-y", "-i", path,
         "-af", FILTER,
         "-c:a", "libmp3lame", "-q:a", "3", tmp],
        capture_output=True
    )
    if r.returncode == 0:
        os.replace(tmp, path)
        print(f"  OK  {os.path.relpath(path, SOUNDS_DIR)}")
    else:
        if os.path.exists(tmp): os.unlink(tmp)
        print(f"  ERR {os.path.relpath(path, SOUNDS_DIR)}: {r.stderr[-200:].decode(errors='ignore')}")

def main():
    # All MP3s in sounds/ and sounds/praise/
    files = (
        glob.glob(os.path.join(SOUNDS_DIR, "*.mp3")) +
        glob.glob(os.path.join(SOUNDS_DIR, "praise", "*.mp3"))
    )
    # Skip purely synthesized non-voice sounds that don't need pitch shift
    skip = {
        "garba_dhol.mp3", "dandiya_sticks.mp3", "thali_ding.mp3", "kem_cho.mp3",
        "fafda_crunch.mp3", "sad_trombone.mp3", "windows_xp.mp3", "vine_boom.mp3",
        "bruh.mp3", "mlg_airhorn.mp3", "crickets.mp3", "price_is_right.mp3",
        "nyan_cat.mp3", "among_us.mp3", "discord.mp3", "horror_sting.mp3",
        "halloween_organ.mp3", "creaking_door.mp3", "jumpscare.mp3", "heartbeat.mp3",
        "thunder.mp3", "clock_alarm.mp3", "demon_whisper.mp3",
        "rickshaw_horn.mp3", "shehnai_gone_wrong.mp3", "bollywood_suspense.mp3",
        "indian_train_horn.mp3",
    }
    files = [f for f in files if os.path.basename(f) not in skip]
    print(f"Processing {len(files)} voice/instrument files...")
    for f in sorted(files):
        process(f)
    print("\nDone.")

if __name__ == "__main__":
    main()
