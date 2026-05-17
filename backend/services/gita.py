"""
services/gita.py — Bhagavad Gita verse-of-the-day.

Rotates through 7 curated "duty" verses from chapters 2, 3, 4, 6, 18.
Fetches Sanskrit + transliteration + Hindi/English gloss from
vedicscriptures.github.io (free, no auth). Caches one verse per
calendar day so every user sees the same opening shloka.
Falls back to hardcoded 2.47 on any network error.
"""

import asyncio
import datetime
import httpx

# 7 curated verses (chapter, verse) — duty / karma-yoga / equanimity theme
ROTATION = [
    (2, 47),   # "You have a right to perform your duties…" — the canonical shloka
    (3, 19),   # "Therefore, without attachment, perform the duty…"
    (4, 18),   # "Who sees inaction in action and action in inaction…"
    (6, 5),    # "Elevate yourself through the power of your mind…"
    (18, 46),  # "By worshipping Him through the performance of one's duty…"
    (2, 50),   # "A person in the divine consciousness…equanimity is yoga"
    (3, 16),   # "One who does not follow the cycle of duty lives in vain"
]

FALLBACK = {
    "chapter": 2,
    "verse": 47,
    "ref": "BG 2.47",
    "sanskrit": "कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।\nमा कर्मफलहेतुर्भूर्मा ते सङ्गोऽस्त्वकर्मणि॥",
    "transliteration": "karmaṇy-evādhikāras te mā phaleṣhu kadāchana\nmā karma-phala-hetur bhūr mā te saṅgo 'stv akarmaṇi",
    "hindi": "कर्म करने में ही तेरा अधिकार है, फलों में कभी नहीं।",
    "english": "You have a right to perform your prescribed duties, but you are not entitled to the fruits of those actions.",
}

_cache: dict = {}  # date_iso -> verse dict


def _today_iso() -> str:
    return datetime.date.today().isoformat()


def _pick_rotation() -> tuple[int, int]:
    """Pick today's (chapter, verse) deterministically by day-of-year."""
    day = datetime.date.today().timetuple().tm_yday
    return ROTATION[day % len(ROTATION)]


async def _fetch_verse(chapter: int, verse: int) -> dict:
    url = f"https://vedicscriptures.github.io/slok/{chapter}/{verse}/"
    async with httpx.AsyncClient(timeout=5.0) as client:
        r = await client.get(url)
        r.raise_for_status()
        data = r.json()

    # vedicscriptures schema: slok, transliteration, tej (hindi), siva (english)
    return {
        "chapter": chapter,
        "verse": verse,
        "ref": f"BG {chapter}.{verse}",
        "sanskrit": data.get("slok", FALLBACK["sanskrit"]),
        "transliteration": data.get("transliteration", FALLBACK["transliteration"]),
        "hindi": (data.get("tej", {}) or {}).get("ht", FALLBACK["hindi"]),
        "english": (data.get("siva", {}) or {}).get("et", FALLBACK["english"]),
    }


async def get_verse_of_the_day() -> dict:
    """Return today's verse, fetching from API and caching per calendar day."""
    today = _today_iso()
    if today in _cache:
        return _cache[today]

    chapter, verse = _pick_rotation()
    try:
        result = await _fetch_verse(chapter, verse)
    except Exception:
        result = FALLBACK.copy()

    # Evict stale cache entries (keep only today)
    _cache.clear()
    _cache[today] = result
    return result
