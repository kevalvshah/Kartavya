"""
Hindi equivalents of all Gujju voice + movie dialogue sounds.
Run: python scripts/gen_hindi_sounds.py
"""
import sys, os, subprocess, tempfile
sys.stdout.reconfigure(encoding='utf-8')
from gtts import gTTS

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "sounds")

SOUNDS = [
    # ── Gujju Voice → Hindi equivalents ──────────────────────────────────────
    ("hi_kaise_ho",            "hi", "कैसे हो?",                                    "Kaise ho?"),
    ("hi_kaam_karo",           "hi", "काम करो!",                                    "Kaam karo!"),
    ("hi_are_sun_bhai",        "hi", "अरे सुन भाई, इधर आ मेरे वाले!",              "Are sun bhai, idhar aa mere wale!"),
    ("hi_jaldi_karo",          "hi", "जल्दी करो भाई!",                              "Jaldi karo bhai!"),
    ("hi_kya_karte_ho",        "hi", "क्या करते हो पूरा दिन?",                     "Kya karte ho poora din?"),
    ("hi_dhyan_raho",          "hi", "ध्यान रहो, task pending है!",                 "Dhyan raho, task pending hai!"),
    ("hi_aao_bhai",            "hi", "आओ भाई, काम बाकी है!",                       "Aao bhai, kaam baaki hai!"),
    ("hi_kya_hua_pending",     "hi", "क्या हुआ? अभी भी pending है!",               "Kya hua? Abhi bhi pending hai!"),

    # ── Movie dialogues → Hindi (original language) ───────────────────────────
    ("hi_pushpa_jhukenge_nahi","hi", "झुकेंगे नहीं साले!",                          "Jhukenge nahi sale!"),
    ("hi_pushpa_phool_nahi",   "hi", "मैं फूल नहीं, आग हूँ!",                      "Main phool nahi, aag hoon!"),
    ("hi_kgf_yeh_kgf",        "hi", "यह KGF है!",                                  "Yeh KGF hai!"),
    ("hi_kgf_naam_se_darr",   "hi", "मेरे नाम से डर लगता है दुनिया को!",           "Mere naam se darr lagta hai duniya ko!"),
    ("hi_sholay_kitne_aadmi",  "hi", "कितने आदमी थे?",                              "Kitne aadmi the?"),
    ("hi_sholay_tera_kaliya",  "hi", "तेरा क्या होगा, कालिया?",                     "Tera kya hoga, Kaliya?"),
    ("hi_sholay_mogambo",      "hi", "मोगैंबो खुश हुआ!",                            "Mogambo khush hua!"),
    ("hi_don_pakadna",         "hi", "डॉन को पकड़ना मुश्किल ही नहीं, नामुमकिन है!", "Don ko pakadna mushkil hi nahi, namumkin hai!"),
    ("hi_bahubali_kyun_mara",  "hi", "कटप्पा ने बाहुबली को क्यों मारा?",            "Kattappa ne Bahubali ko kyun maara?"),
    ("hi_stree_kal_aana",      "hi", "ओ स्त्री, कल आना!",                           "O Stree, kal aana!"),
    ("hi_singham_satakli",     "hi", "आता माझी सटकली!",                             "Aata majhi satakli!"),
    ("hi_3idiots_all_well",    "hi", "All is well! All is well!",                    "All is well!"),
    ("hi_3idiots_gyaan",       "hi", "ज्ञान की पूजा करो, सफलता के पीछे मत भागो!", "Gyaan ki pooja karo, safalta ke peeche mat bhaago!"),
    ("hi_ddlj_ja_jeele",       "hi", "जा, जी ले अपनी ज़िंदगी, सिम्रन!",            "Ja, ji le apni zindagi, Simran!"),
    ("hi_golmaal_dhamaal",     "hi", "धमाल मस्ती, हिंदुस्तानी स्टाइल!",            "Dhamaal masti, Hindustani style!"),
    ("hi_task_pending",        "hi", "भाई, task pending है, फिल्म बाद में देख!",    "Bhai, task pending hai, film baad mein dekh!"),
]


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    print("Generating Hindi sounds...")
    for name, lang, text, label in SOUNDS:
        tmp = tempfile.mktemp(suffix="_raw.mp3")
        out = os.path.join(OUT_DIR, name + ".mp3")
        try:
            gTTS(text=text, lang=lang, slow=False).save(tmp)
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
