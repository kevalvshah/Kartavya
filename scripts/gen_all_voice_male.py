"""
Regenerate all Gujju + Hindi voice clips using Microsoft Edge TTS male voices.
  Gujarati male: gu-IN-NiranjanNeural
  Hindi male:    hi-IN-MadhurNeural
Run: python scripts/gen_all_voice_male.py
"""
import sys, os, asyncio, subprocess, tempfile
sys.stdout.reconfigure(encoding='utf-8')
import edge_tts

OUT_DIR   = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "sounds")
GU_VOICE  = "gu-IN-NiranjanNeural"
HI_VOICE  = "hi-IN-MadhurNeural"

# (filename, voice, text, max_duration_s)
ALL_CLIPS = [
    # ── Gujju Voice ──────────────────────────────────────────────────────────
    ("kem_cho_voice", GU_VOICE, "કેમ છો?",                          2.0),
    ("kaam_karo",     GU_VOICE, "કામ કરો!",                          2.0),
    ("are_patav_aa",  GU_VOICE, "અરે, પટાવ આ, મારા વાળા!",           3.0),
    ("jaldi_karo",    GU_VOICE, "જલ્દી કરો ભાઈ!",                    2.0),
    ("shu_karo_cho",  GU_VOICE, "શું કરો છો આખો દિવસ?",              3.0),
    ("dhyan_rakho",   GU_VOICE, "ધ્યાન રાખો, task pending છે!",      3.0),
    ("aavre_bhai",    GU_VOICE, "આવ્રે ભાઈ, કામ બાકી છે!",           3.0),
    ("hu_thayu",      GU_VOICE, "હું થયું? હજી pending!",             2.5),

    # ── Gujju Movie Dialogues ────────────────────────────────────────────────
    ("pushpa_jhukse_nahi",  GU_VOICE, "ઝૂકશે નહીં સાલા!",                       2.5),
    ("pushpa_main_pushpa",  GU_VOICE, "હું ફૂલ નહીં, આગ છું!",                  2.5),
    ("kgf_aa_kgf_che",      GU_VOICE, "આ KGF છે!",                               2.0),
    ("kgf_maro_naam",       GU_VOICE, "મારા નામ થી દુનિયા ડરે છે!",              3.0),
    ("sholay_ketla_maanas", GU_VOICE, "કેટલા માણસ હતા?",                         2.0),
    ("sholay_tera_kaliya",  GU_VOICE, "તારું શું થાશે, કાળિયા?",                  2.5),
    ("sholay_mogambo",      GU_VOICE, "મોગામ્બો ખુશ થયો!",                        2.0),
    ("don_pakadvu_mushkel", GU_VOICE, "ડૉન ને પકડવો અઘરો નહીં, અશક્ય છે!",      3.5),
    ("bahubali_kyun_mara",  GU_VOICE, "કટ્ટપ્પાએ બાહુબલી ને કેમ માર્યો?",         3.0),
    ("stree_kal_aavje",     GU_VOICE, "ઓ સ્ત્રી, કાલે આવજે!",                    2.0),
    ("singham_aata_majhi",  GU_VOICE, "હવે મારી સટકી!",                          2.0),
    ("3idiots_all_is_well", GU_VOICE, "ઓલ ઇઝ વેલ! ઓલ ઇઝ વેલ!",                 2.5),
    ("3idiots_balatkar",    GU_VOICE, "જ્ઞાન ની ઉપાસના કરો, સફળતા પાછળ ભાગો નહીં!", 3.5),
    ("ddlj_ja_jee_le",      GU_VOICE, "જા, જઈને જીવી લે, સિમ્રન!",               2.5),
    ("golmaal_dhamaal",     GU_VOICE, "ધમાલ મસ્તી, ગુજ્જુ સ્ટાઇલ!",              2.5),
    ("task_baaki",          GU_VOICE, "ભાઈ, task pending છે, ફિલ્મ પછી જો!",     3.0),

    # ── Gujju Praise ─────────────────────────────────────────────────────────
    ("praise/kya_baat",        GU_VOICE, "શું વાત! શું વાત! શું વાત!",        3.0),
    ("praise/moje_moj",        GU_VOICE, "મોઝ મોઝ! મજા આવી ગઈ!",             3.0),
    ("praise/wah_re_wah",      GU_VOICE, "વાહ રે વાહ! ક્યા બાત!",             2.5),
    ("praise/haakan_kevu",     GU_VOICE, "હાકાન! કેવું પડે હો!",              2.5),
    ("praise/shabash_bhai",    GU_VOICE, "શાબાશ ભાઈ! એકદમ ઝક્કાસ!",          2.5),
    ("praise/aapde_champion",  GU_VOICE, "આપણે તો ચેમ્પિયન છીએ!",            2.5),
    ("praise/mast_kaam",       GU_VOICE, "મસ્ત કામ કીધું ભાઈ!",              2.5),
    ("praise/fatafat_kaam",    GU_VOICE, "એકદમ ફટાફટ! ટૉપ ક્લાસ!",           2.5),
    ("praise/jai_kaam_thayu",  GU_VOICE, "જય શ્રી કૃષ્ણ! કામ થઈ ગ્યું!",    3.0),
    ("praise/gujju_hero",      GU_VOICE, "ગુજ્જુ હીરો! ફાટી નીકળ્યો!",       2.5),

    # ── Hindi Voice ──────────────────────────────────────────────────────────
    ("hi_kaise_ho",        HI_VOICE, "कैसे हो?",                                    2.0),
    ("hi_kaam_karo",       HI_VOICE, "काम करो!",                                    2.0),
    ("hi_are_sun_bhai",    HI_VOICE, "अरे सुन भाई, इधर आ मेरे वाले!",              3.0),
    ("hi_jaldi_karo",      HI_VOICE, "जल्दी करो भाई!",                              2.0),
    ("hi_kya_karte_ho",    HI_VOICE, "क्या करते हो पूरा दिन?",                     3.0),
    ("hi_dhyan_raho",      HI_VOICE, "ध्यान रहो, task pending है!",                 3.0),
    ("hi_aao_bhai",        HI_VOICE, "आओ भाई, काम बाकी है!",                       2.5),
    ("hi_kya_hua_pending", HI_VOICE, "क्या हुआ? अभी भी pending है!",               2.5),

    # ── Hindi Movie Dialogues ────────────────────────────────────────────────
    ("hi_pushpa_jhukenge_nahi", HI_VOICE, "झुकेंगे नहीं साले!",                          2.5),
    ("hi_pushpa_phool_nahi",    HI_VOICE, "मैं फूल नहीं, आग हूँ!",                      2.5),
    ("hi_kgf_yeh_kgf",          HI_VOICE, "यह KGF है!",                                  2.0),
    ("hi_kgf_naam_se_darr",     HI_VOICE, "मेरे नाम से डर लगता है दुनिया को!",           3.0),
    ("hi_sholay_kitne_aadmi",   HI_VOICE, "कितने आदमी थे?",                              2.0),
    ("hi_sholay_tera_kaliya",   HI_VOICE, "तेरा क्या होगा, कालिया?",                     2.5),
    ("hi_sholay_mogambo",       HI_VOICE, "मोगैंबो खुश हुआ!",                            2.0),
    ("hi_don_pakadna",          HI_VOICE, "डॉन को पकड़ना मुश्किल ही नहीं, नामुमकिन है!", 3.5),
    ("hi_bahubali_kyun_mara",   HI_VOICE, "कटप्पा ने बाहुबली को क्यों मारा?",            3.0),
    ("hi_stree_kal_aana",       HI_VOICE, "ओ स्त्री, कल आना!",                           2.0),
    ("hi_singham_satakli",      HI_VOICE, "आता माझी सटकली!",                             2.0),
    ("hi_3idiots_all_well",     HI_VOICE, "All is well! All is well!",                    2.5),
    ("hi_3idiots_gyaan",        HI_VOICE, "ज्ञान की पूजा करो, सफलता के पीछे मत भागो!", 3.5),
    ("hi_ddlj_ja_jeele",        HI_VOICE, "जा, जी ले अपनी ज़िंदगी, सिम्रन!",            3.0),
    ("hi_golmaal_dhamaal",      HI_VOICE, "धमाल मस्ती, हिंदुस्तानी स्टाइल!",            2.5),
    ("hi_task_pending",         HI_VOICE, "भाई, task pending है, फिल्म बाद में देख!",    3.0),

    # ── Hindi Praise ─────────────────────────────────────────────────────────
    ("praise/hi_kya_baat",       HI_VOICE, "क्या बात! क्या बात! क्या बात!",      3.0),
    ("praise/hi_wah_wah",        HI_VOICE, "वाह वाह! बहुत खूब!",                 2.5),
    ("praise/hi_shabash",        HI_VOICE, "शाबाश! एकदम जबरदस्त!",               2.5),
    ("praise/hi_kamaal",         HI_VOICE, "कमाल कर दिया भाई!",                  2.5),
    ("praise/hi_bahut_badhiya",  HI_VOICE, "बहुत बढ़िया! मज़ा आ गया!",            2.5),
    ("praise/hi_champion",       HI_VOICE, "तुम तो चैंपियन हो यार!",              2.5),
    ("praise/hi_jai_ho",         HI_VOICE, "जय हो! कर्तव्य पूरा हुआ!",           2.5),
    ("praise/hi_ekdum_mast",     HI_VOICE, "एकदम मस्त काम किया!",                2.5),
    ("praise/hi_mast_hai",       HI_VOICE, "मस्त है! बिल्कुल मस्त!",              2.0),
    ("praise/hi_arey_waah",      HI_VOICE, "अरे वाह! क्या काम किया है!",          2.5),
]


async def generate_one(name, voice, text, max_dur):
    out_path = os.path.join(OUT_DIR, name + ".mp3")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    tmp = out_path + ".tmp.mp3"
    try:
        comm = edge_tts.Communicate(text, voice, rate="-5%", volume="+10%")
        await comm.save(tmp)
        fade_start = max(0, max_dur - 0.3)
        subprocess.run(
            ["ffmpeg", "-y", "-i", tmp,
             "-t", str(max_dur),
             "-af", f"afade=t=out:st={fade_start}:d=0.3",
             "-c:a", "libmp3lame", "-q:a", "3", out_path],
            capture_output=True
        )
        os.unlink(tmp)
        print(f"  OK  {name}")
    except Exception as e:
        if os.path.exists(tmp): os.unlink(tmp)
        print(f"  ERR {name}: {e}")


async def main():
    print(f"Generating {len(ALL_CLIPS)} clips with male voices...")
    for name, voice, text, dur in ALL_CLIPS:
        await generate_one(name, voice, text, dur)
    print("\nDone.")


if __name__ == "__main__":
    asyncio.run(main())
