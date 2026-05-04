"""
seed_admin.py — Run once to create the first admin user.
Usage: python seed_admin.py
Set DATABASE_URL and JWT_SECRET env vars first (or have a .env file).
"""
import asyncio
import hashlib
import os
import uuid
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

ADMIN_EMAIL = os.environ.get("SEED_ADMIN_EMAIL", "admin@aekaminc.com")
ADMIN_PASSWORD = os.environ.get("SEED_ADMIN_PASSWORD", "Kartavya@Admin2026")
ADMIN_NAME = os.environ.get("SEED_ADMIN_NAME", "Keval Shah")


def _hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260_000).hex()


async def seed():
    import asyncpg
    dsn = os.environ["DATABASE_URL"]
    conn = await asyncpg.connect(dsn=dsn, statement_cache_size=0)
    try:
        existing = await conn.fetchrow("SELECT user_id FROM users WHERE email=$1", ADMIN_EMAIL)
        if existing:
            print(f"Admin already exists: {ADMIN_EMAIL}")
            # Ensure role is admin
            await conn.execute("UPDATE users SET role='admin' WHERE email=$1", ADMIN_EMAIL)
            print("Role set to admin.")
            return
        salt = uuid.uuid4().hex
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await conn.execute(
            "INSERT INTO users (user_id, name, email, password_hash, salt, role) VALUES ($1,$2,$3,$4,$5,'admin')",
            user_id, ADMIN_NAME, ADMIN_EMAIL, _hash_password(ADMIN_PASSWORD, salt), salt,
        )
        print(f"Admin created!")
        print(f"  Email:    {ADMIN_EMAIL}")
        print(f"  Password: {ADMIN_PASSWORD}")
        print(f"  user_id:  {user_id}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed())
