"""
Generate English slang / cheer-up voice clips using edge-tts male voice.
Run: python scripts/gen_english_slang.py
"""
import sys, os, asyncio
sys.stdout.reconfigure(encoding='utf-8')
import edge_tts

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "sounds")
EN_VOICE = "en-US-GuyNeural"

# (filename, text, max_dur_s)
CLIPS = [
    ("en_bruh",            "Bruuuh...",                                   2.0),
    ("en_cmon_man",        "Come on man!",                                2.0),
    ("en_oh_my_god",       "Oh my Goood!",                                2.0),
    ("en_are_you_serious", "Are you serious right now?",                  2.5),
    ("en_no_way",          "No waaaay!",                                  2.0),
    ("en_lets_gooo",       "Let's gooo!",                                 2.0),
    ("en_sheesh",          "Sheeeesh!",                                   2.0),
    ("en_not_bad",         "Not bad, not bad at all!",                    2.5),
    ("en_you_got_this",    "You got this bro, keep going!",               2.5),
    ("en_absolute_legend", "Absolute legend!",                            2.0),
    ("en_keep_grinding",   "Keep grinding, don't stop now!",              2.5),
    ("en_w_move",          "That is a W move, no cap!",                   2.5),
    ("en_task_or_nap",     "Task or nap? Task wins, let's go!",           3.0),
]


async def gen(name, text, max_dur):
    out = os.path.join(OUT_DIR, name + ".mp3")
    try:
        comm = edge_tts.Communicate(text, EN_VOICE, rate="+5%", volume="+10%")
        await comm.save(out)
        print(f"  OK  {name}")
    except Exception as e:
        print(f"  ERR {name}: {e}")


async def main():
    print(f"Generating {len(CLIPS)} English slang clips...")
    for name, text, dur in CLIPS:
        await gen(name, text, dur)
    print("\nDone.")


if __name__ == "__main__":
    asyncio.run(main())
