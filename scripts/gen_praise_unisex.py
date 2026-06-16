"""
Generate female Gujju/Hindi praise clips + English praise (male+female).
Run: python scripts/gen_praise_unisex.py
"""
import sys, os, asyncio
sys.stdout.reconfigure(encoding='utf-8')
import edge_tts

OUT_DIR  = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "sounds", "praise")
GU_F     = "gu-IN-DhwaniNeural"
HI_F     = "hi-IN-SwaraNeural"
EN_M     = "en-US-GuyNeural"
EN_F     = "en-US-JennyNeural"

CLIPS = [
    # ── Gujju female ─────────────────────────────────────────────────────────
    ("f_kya_baat",        GU_F, "શું વાત! શું વાત! શું વાત!"),
    ("f_moje_moj",        GU_F, "મોઝ મોઝ! મજા આવી ગઈ!"),
    ("f_wah_re_wah",      GU_F, "વાહ રે વાહ! ક્યા બાત!"),
    ("f_shabash_bhai",    GU_F, "શાબાશ ભાઈ! એકદમ ઝક્કાસ!"),
    ("f_aapde_champion",  GU_F, "આપણે તો ચેમ્પિયન છીએ!"),
    ("f_mast_kaam",       GU_F, "મસ્ત કામ કીધું ભાઈ!"),
    ("f_fatafat_kaam",    GU_F, "એકદમ ફટાફટ! ટૉપ ક્લાસ!"),
    ("f_gujju_hero",      GU_F, "ગુજ્જુ હીરો! ફાટી નીકળ્યો!"),

    # ── Hindi female ──────────────────────────────────────────────────────────
    ("f_hi_kya_baat",       HI_F, "क्या बात! क्या बात! क्या बात!"),
    ("f_hi_wah_wah",        HI_F, "वाह वाह! बहुत खूब!"),
    ("f_hi_shabash",        HI_F, "शाबाश! एकदम जबरदस्त!"),
    ("f_hi_bahut_badhiya",  HI_F, "बहुत बढ़िया! मज़ा आ गया!"),
    ("f_hi_champion",       HI_F, "तुम तो चैंपियन हो यार!"),
    ("f_hi_ekdum_mast",     HI_F, "एकदम मस्त काम किया!"),
    ("f_hi_jai_ho",         HI_F, "जय हो! कर्तव्य पूरा हुआ!"),
    ("f_hi_arey_waah",      HI_F, "अरे वाह! क्या काम किया है!"),

    # ── English male ──────────────────────────────────────────────────────────
    ("en_crushed_it",       EN_M, "You absolutely crushed it!"),
    ("en_legendary",        EN_M, "Legendary! Pure legend!"),
    ("en_nailed_it",        EN_M, "Nailed it! That's the one!"),
    ("en_you_beast",        EN_M, "You absolute beast, let's go!"),

    # ── English female ────────────────────────────────────────────────────────
    ("en_f_on_fire",        EN_F, "You are on fire today!"),
    ("en_f_amazing_work",   EN_F, "Amazing work, keep it up!"),
    ("en_f_killing_it",     EN_F, "You are killing it!"),
    ("en_f_proud_of_you",   EN_F, "So proud of you, well done!"),
]


async def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    print(f"Generating {len(CLIPS)} praise clips...")
    for name, voice, text in CLIPS:
        out = os.path.join(OUT_DIR, name + ".mp3")
        try:
            comm = edge_tts.Communicate(text, voice, rate="-5%", volume="+10%")
            await comm.save(out)
            print(f"  OK  {name}")
        except Exception as e:
            print(f"  ERR {name}: {e}")
    print("\nDone.")


if __name__ == "__main__":
    asyncio.run(main())
