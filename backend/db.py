"""
db.py — Supabase/PostgreSQL async connection pool for Kartavya
"""
import os
import asyncpg

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        dsn = os.environ["DATABASE_URL"]
        # Supabase requires SSL
        if "sslmode" not in dsn:
            dsn += "?sslmode=require"
        _pool = await asyncpg.create_pool(
            dsn=dsn,
            min_size=1,
            max_size=10,
            command_timeout=30,
            ssl="require",
        )
    return _pool


async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
