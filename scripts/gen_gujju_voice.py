"""
Generate Gujarati voice notification sounds using gTTS.
Run: python scripts/gen_gujju_voice.py
"""
import sys, os, subprocess, tempfile
sys.stdout.reconfigure(encoding='utf-8')
from gtts import gTTS

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "sounds")

PHRASES = [
    ("kem_cho_voice",       "કેમ છો?",                          "Kem cho?"),
    ("kaam_karo",           "કામ કરો!",                          "Kaam karo!"),
    ("are_patav_aa",        "અરે, પટાવ આ, મારા વાળા!",           "Are patav aa mara vala!"),
    ("jaldi_karo",          "જલ્દી કરો ભાઈ!",                    "Jaldi karo bhai!"),
    ("shu_karo_cho",        "શું કરો છો આખો દિવસ?",              "Shu karo cho aakho divas?"),
    ("dhyan_rakho",         "ધ્યાન રાખો, task pending છે!",      "Dhyan rakho, task pending che!"),
    ("aavre_bhai",          "આવ્રે ભાઈ, કામ બાકી છે!",           "Aavre bhai, kaam baaki che!"),
    ("hu_thayu",            "હું થયું? હજી pending!",             "Hu thayu? Haji pending!"),
]

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    ffmpeg = "ffmpeg"
    env_path = os.environ.get("PATH", "")

    print("Generating Gujju voice clips...")
    for name, gujarati_text, _ in PHRASES:
        tmp_mp3 = tempfile.mktemp(suffix="_raw.mp3")
        out_path = os.path.join(OUT_DIR, name + ".mp3")
        try:
            tts = gTTS(text=gujarati_text, lang="gu", slow=False)
            tts.save(tmp_mp3)
            # trim to max 2s with fade-out
            subprocess.run(
                [ffmpeg, "-y", "-i", tmp_mp3,
                 "-t", "2.0",
                 "-af", "afade=t=out:st=1.7:d=0.3",
                 "-c:a", "libmp3lame", "-q:a", "4",
                 out_path],
                capture_output=True
            )
            os.unlink(tmp_mp3)
            print(f"  {name}.mp3  ({gujarati_text})")
        except Exception as e:
            print(f"  ERROR {name}: {e}")

    print("\nDone.")

if __name__ == "__main__":
    main()
