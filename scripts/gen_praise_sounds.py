"""
Gujarati praise/celebration voice clips for task-done events.
Run: python scripts/gen_praise_sounds.py
"""
import sys, os, subprocess, tempfile
sys.stdout.reconfigure(encoding='utf-8')
from gtts import gTTS

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "sounds", "praise")

PHRASES = [
    ("kya_baat",        "શું વાત! શું વાત! શું વાત!",           "Shu vaat! Shu vaat! Shu vaat!"),
    ("moje_moj",        "મોઝ મોઝ! મજા આવી ગઈ!",               "Moje moj! Maja aavi gai!"),
    ("wah_re_wah",      "વાહ રે વાહ! ક્યા બાત!",               "Wah re wah! Kya baat!"),
    ("haakan_kevu",     "હાકાન! કેવું પડે હો!",                 "Haakan! Kevu pade ho!"),
    ("shabash_bhai",    "શાબાશ ભાઈ! એકદમ ઝક્કાસ!",            "Shabash bhai! Ekdam jhakkas!"),
    ("aapde_champion",  "આપણે તો ચેમ્પિયન છીએ!",              "Aapde to champion chhiye!"),
    ("mast_kaam",       "મસ્ત કામ કીધું ભાઈ!",                 "Mast kaam kidhu bhai!"),
    ("fatafat_kaam",    "એકદમ ફટાફટ! ટૉપ ક્લાસ!",             "Ekdam fatafat! Top class!"),
    ("jai_kaam_thayu",  "જય શ્રી કૃષ્ણ! કામ થઈ ગ્યું!",       "Jai Shree Krishna! Kaam thai gayu!"),
    ("gujju_hero",      "ગુજ્જુ હીરો! ફાટી નીકળ્યો!",          "Gujju hero! Faati nikaLyo!"),
]


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    print("Generating praise sounds...")
    for name, text, label in PHRASES:
        tmp = tempfile.mktemp(suffix="_raw.mp3")
        out = os.path.join(OUT_DIR, name + ".mp3")
        try:
            gTTS(text=text, lang="gu", slow=False).save(tmp)
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
