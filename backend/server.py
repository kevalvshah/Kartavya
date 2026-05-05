"""
server.py — Kartavya API by Aekam Inc
Database: Supabase PostgreSQL via asyncpg
Auth: JWT (email + password), invite-only
Custom board columns per project (project_columns table)
"""

import asyncio
import base64
import json
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import asyncpg
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from starlette.middleware.cors import CORSMiddleware

from auth_router import require_user, require_admin
from auth_router import router as auth_router
from invite_router import router as invite_router
from approvals_router import router as approvals_router
from db import close_pool, get_pool
from health import router as health_router

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

app = FastAPI(title="Kartavya API", description="Team task management by Aekam Inc")
api_router = APIRouter(prefix="/api")

# ── CORS — registered BEFORE routers ─────────────────────────────────────────
DEFAULT_ORIGINS = [
    "https://kartavya-aekam.vercel.app",
    "https://kartavya-kevalvshah03-6145s-projects.vercel.app",
    "https://kartavya-git-main-kevalvshah03-6145s-projects.vercel.app",
    "http://localhost:3000",
    "http://localhost:8080",
]
_extra = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
ALLOWED_ORIGINS = list(dict.fromkeys(DEFAULT_ORIGINS + _extra))

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def parse_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid datetime: {value}") from e
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


async def get_db() -> asyncpg.Pool:
    return await get_pool()


async def get_visible_team_ids(pool: asyncpg.Pool, user_id: str, role: Optional[str] = None) -> List[str]:
    """Get visible team IDs based on role-based access control.
    
    - Admins (system-wide): See ALL projects
    - Clients: See ONLY assigned projects (from project_assignments)
    - Members/Owners: See assigned projects (from project_assignments)
    """
    # Check if user is system-wide admin
    user_row = await pool.fetchrow("SELECT role FROM users WHERE user_id=$1", user_id)
    if user_row and user_row.get("role") == "admin":
        # System admin sees ALL projects
        all_teams = await pool.fetch("SELECT team_id FROM teams")
        return [r["team_id"] for r in all_teams]
    
    # For all other users (client, member, owner), use project_assignments
    rows = await pool.fetch(
        "SELECT team_id FROM project_assignments WHERE user_id=$1", user_id
    )
    return [r["team_id"] for r in rows]