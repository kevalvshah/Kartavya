"""
db.py — Supabase PostgreSQL connection pool for Kartavya
Lazy connection — does NOT connect at startup, connects on first request.
This prevents Railway crashes if DATABASE_URL is misconfigured.
"""
import json
import os
import asyncpg

_pool: asyncpg.Pool | None = None


def _json_encoder(value):
    return json.dumps(value)


def _json_decoder(value):
    return json.loads(value)


async def _init_conn(conn):
    await conn.set_type_codec(
        "jsonb", encoder=_json_encoder, decoder=_json_decoder, schema="pg_catalog", format="text"
    )
    await conn.set_type_codec(
        "json", encoder=_json_encoder, decoder=_json_decoder, schema="pg_catalog", format="text"
    )


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        dsn = os.environ.get("DATABASE_URL", "")
        if not dsn:
            raise RuntimeError("DATABASE_URL environment variable is not set")
        _pool = await asyncpg.create_pool(
            dsn=dsn,
            min_size=2,
            max_size=15,
            command_timeout=30,
            statement_cache_size=0,  # Required for PgBouncer transaction mode
            init=_init_conn,
        )
    return _pool


async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
