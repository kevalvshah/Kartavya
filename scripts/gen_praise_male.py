"""
Regenerate praise clips (full length, no trim) with male neural voices.
"""
import sys, os, asyncio, subprocess
sys.stdout.reconfigure(encoding='utf-8')
import edge_tts

OUT_DIR  = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "sounds", "praise")
GU_VOICE = "gu-IN-NiranjanNeural"
HI_VOICE = "hi-IN-MadhurNeural"

CLIPS = [
    ("kya_baat",       GU_VOICE, "શું વાત! શું વાત! શું વાત!"),
    ("moje_moj",       GU_VOICE, "મોઝ મોઝ! મજા આવી ગઈ!"),
    ("wah_re_wah",     GU_VOICE, "વાહ રે વાહ! ક્યા બાત!"),
    ("haakan_kevu",    GU_VOICE, "હાકાન! કેવું પડે હો!"),
    ("shabash_bhai",   GU_VOICE, "શાબાશ ભાઈ! એકદમ ઝક્કાસ!"),
    ("aapde_champion", GU_VOICE, "આપણે તો ચેમ્પિયન છીએ!"),
    ("mast_kaam",      GU_VOICE, "મસ્ત કામ કીધું ભાઈ!"),
    ("fatafat_kaam",   GU_VOICE, "એકદમ ફટાફટ! ટૉપ ક્લાસ!"),
    ("jai_kaam_thayu", GU_VOICE, "જય શ્રી કૃષ્ણ! કામ થઈ ગ્યું!"),
    ("gujju_hero",     GU_VOICE, "ગુજ્જુ હીરો! ફાટી નીકળ્યો!"),
    ("hi_kya_baat",      HI_VOICE, "क्या बात! क्या बात! क्या बात!"),
    ("hi_wah_wah",       HI_VOICE, "वाह वाह! बहुत खूब!"),
    ("hi_shabash",       HI_VOICE, "शाबाश! एकदम जबरदस्त!"),
    ("hi_kamaal",        HI_VOICE, "कमाल कर दिया भाई!"),
    ("hi_bahut_badhiya", HI_VOICE, "बहुत बढ़िया! मज़ा आ गया!"),
    ("hi_champion",      HI_VOICE, "तुम तो चैंपियन हो यार!"),
    ("hi_jai_ho",        HI_VOICE, "जय हो! कर्तव्य पूरा हुआ!"),
    ("hi_ekdum_mast",    HI_VOICE, "एकदम मस्त काम किया!"),
    ("hi_mast_hai",      HI_VOICE, "मस्त है! बिल्कुल मस्त!"),
    ("hi_arey_waah",     HI_VOICE, "अरे वाह! क्या काम किया है!"),
]


async def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    print(f"Generating {len(CLIPS)} praise clips (full length)...")
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
