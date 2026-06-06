"""Migration: add password_reset_token / password_reset_expires to users table."""
import asyncpg
import os
import sys


async def run_migration():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("❌ DATABASE_URL not set"); sys.exit(1)

    conn = await asyncpg.connect(db_url)
    try:
        await conn.execute("""
            ALTER TABLE users
              ADD COLUMN IF NOT EXISTS password_reset_token TEXT,
              ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMPTZ
        """)
        print("✅ password_reset columns added to users")
    finally:
        await conn.close()


if __name__ == "__main__":
    import asyncio
    asyncio.run(run_migration())
