"""
Trending movie dialogues in Gujarati voice via gTTS.
Run: python scripts/gen_movie_dialogues.py
"""
import sys, os, subprocess, tempfile
sys.stdout.reconfigure(encoding='utf-8')
from gtts import gTTS

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "sounds")

# (filename, gujarati_text, label_for_code)
DIALOGUES = [
    # Pushpa
    ("pushpa_jhukse_nahi",   "ઝૂકશે નહીં સાલા!",                          "Jhukse nahi sala!"),
    ("pushpa_main_pushpa",   "હું ફૂલ નહીં, આગ છું!",                       "Hu phool nahi, aag chhu!"),

    # KGF
    ("kgf_aa_kgf_che",       "આ KGF છે!",                                  "Aa KGF che!"),
    ("kgf_maro_naam",        "મારા નામ થી દુનિયા ડરે છે!",                  "Mara naam thi duniya dare che!"),

    # Sholay
    ("sholay_ketla_maanas",  "કેટલા માણસ હતા?",                            "Ketla maanas hata?"),
    ("sholay_tera_kaliya",   "તારું શું થાશે, કાળિયા?",                     "Taru shu thaase Kaliya?"),
    ("sholay_mogambo",       "મોગામ્બો ખુશ થયો!",                           "Mogambo khush thayo!"),

    # Don
    ("don_pakadvu_mushkel",  "ડૉન ને પકડવો અઘરો નહીં, અશક્ય છે!",          "Don ne pakadvu aghru nahi, ashakya che!"),

    # Baahubali
    ("bahubali_kyun_mara",   "કટ્ટપ્પાએ બાહુબલી ને કેમ માર્યો?",            "Kattappa e Bahubali ne kem maaryo?"),

    # Stree
    ("stree_kal_aavje",      "ઓ સ્ત્રી, કાલે આવજે!",                       "O Stree, kaale aavje!"),

    # Singham
    ("singham_aata_majhi",   "હવે મારી સટકી!",                             "Have mari satki!"),

    # 3 Idiots
    ("3idiots_all_is_well",  "ઓલ ઇઝ વેલ! ઓલ ઇઝ વેલ!",                   "All is well! All is well!"),
    ("3idiots_balatkar",     "જ્ઞાાન ની ઉપાસના કરો, સફળતા પાછળ ભાગો નહીં!", "Gyaan ni upasna karo, safalta pachhal bhago nahi!"),

    # DDLJ
    ("ddlj_ja_jee_le",       "જા, જઈને જીવી લે, સિમ્રન!",                  "Ja, jaine jeevi le, Simran!"),

    # Golmaal / fun
    ("golmaal_dhamaal",      "ધમાલ મસ્તી, ગુજ્જુ સ્ટાઇલ!",                "Dhamaal masti, Gujju style!"),
    ("task_baaki",           "ભાઈ, task pending છે, ફિલ્મ પછી જો!",         "Bhai, task pending che, film pachi jo!"),
]


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    print("Generating movie dialogues in Gujarati voice...")
    for name, text, label in DIALOGUES:
        tmp = tempfile.mktemp(suffix="_raw.mp3")
        out = os.path.join(OUT_DIR, name + ".mp3")
        try:
            gTTS(text=text, lang="gu", slow=False).save(tmp)
            subprocess.run(
                ["ffmpeg", "-y", "-i", tmp,
                 "-t", "3.0",
                 "-af", "afade=t=out:st=2.7:d=0.3",
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
