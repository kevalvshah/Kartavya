"""
Hindi praise voice clips for task-done events.
Run: python scripts/gen_praise_hindi.py
"""
import sys, os, subprocess, tempfile
sys.stdout.reconfigure(encoding='utf-8')
from gtts import gTTS

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "sounds", "praise")

PHRASES = [
    ("hi_kya_baat",         "क्या बात! क्या बात! क्या बात!",          "Kya baat kya baat kya baat!"),
    ("hi_wah_wah",          "वाह वाह! बहुत खूब!",                     "Wah wah! Bahut khoob!"),
    ("hi_shabash",          "शाबाश! एकदम जबरदस्त!",                   "Shabash! Ekdam zabardast!"),
    ("hi_kamaal",           "कमाल कर दिया भाई!",                      "Kamaal kar diya bhai!"),
    ("hi_bahut_badhiya",    "बहुत बढ़िया! मज़ा आ गया!",                "Bahut badhiya! Maza aa gaya!"),
    ("hi_champion",         "तुम तो चैंपियन हो यार!",                  "Tum to champion ho yaar!"),
    ("hi_jai_ho",           "जय हो! कर्तव्य पूरा हुआ!",               "Jai ho! Kartavya poora hua!"),
    ("hi_ekdum_mast",       "एकदम मस्त काम किया!",                    "Ekdum mast kaam kiya!"),
    ("hi_mast_hai",         "मस्त है! बिल्कुल मस्त!",                  "Mast hai! Bilkul mast!"),
    ("hi_arey_waah",        "अरे वाह! क्या काम किया है!",              "Arey waah! Kya kaam kiya hai!"),
]


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    print("Generating Hindi praise sounds...")
    for name, text, label in PHRASES:
        tmp = tempfile.mktemp(suffix="_raw.mp3")
        out = os.path.join(OUT_DIR, name + ".mp3")
        try:
            gTTS(text=text, lang="hi", slow=False).save(tmp)
            subprocess.run(
                ["ffmpeg", "-y", "-i", tmp,
                 "-t", "3.5",
                 "-af", "afade=t=out:st=3.2:d=0.3",
                 "-c:a", "libmp3lame", "-q:a", "4", out],
                capture_output=True
            )
            os.unlink(tmp)
            print(f"  {name}.mp3  — {label}")
        except Exception as e:
            print(f"  ERROR {name}: {e}")
    print("\nDone.")


if __name__ == "__main__":
    main()
