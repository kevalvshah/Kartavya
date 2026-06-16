"""
Generate extra English praise clips: OG, GOAT, champion.
Run: python scripts/gen_praise_extra.py
"""
import sys, os, asyncio
sys.stdout.reconfigure(encoding='utf-8')
import edge_tts

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "sounds", "praise")
EN_M    = "en-US-GuyNeural"
EN_F    = "en-US-JennyNeural"

CLIPS = [
    ("en_you_the_og",     EN_M, "You are the OG, no one does it like you!"),
    ("en_the_goat",       EN_M, "You are the GOAT, greatest of all time!"),
    ("en_yeh_champion",   EN_M, "Yeah champion, that's what I'm talking about!"),
    ("en_f_you_the_og",   EN_F, "You are the OG, no one does it like you!"),
    ("en_f_the_goat",     EN_F, "You are the GOAT, greatest of all time!"),
    ("en_f_yeh_champion", EN_F, "Yeah champion, that's what I'm talking about!"),
]


async def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    print(f"Generating {len(CLIPS)} clips...")
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
