"""
db.py — Supabase/PostgreSQL async connection pool for Kartavya
Uses Supabase connection pooler (port 6543) for cross-region Railway connectivity
"""
import os
import asyncpg

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        dsn = os.environ["DATABASE_URL"]
        # Use Supabase pooler port 6543 instead of direct 5432
        dsn = dsn.replace(":5432/", ":6543/")
        # Ensure SSL is set
        if "sslmode" not in dsn:
            dsn += "?sslmode=require"
        _pool = await asyncpg.create_pool(
            dsn=dsn,
            min_size=1,
            max_size=10,
            command_timeout=30,
        )
    return _pool


async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
