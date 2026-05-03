"""
auth_router.py — Kartavya by Aekam Inc
JWT email/password auth backed by Supabase PostgreSQL
"""
import hashlib
import hmac
import os
import uuid
from datetime import datetime, timedelta
from typing import Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field

from db import get_pool

router = APIRouter(prefix="/api/auth", tags=["auth"])
security = HTTPBearer(auto_error=False)

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
JWT_TTL_DAYS = 30


def _hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260_000).hex()


def _verify_password(password: str, salt: str, stored: str) -> bool:
    return hmac.compare_digest(_hash_password(password, salt), stored)


def _create_token(user_id: str) -> str:
    return jwt.encode(
        {"sub": user_id, "exp": datetime.utcnow() + timedelta(days=JWT_TTL_DAYS), "iat": datetime.utcnow()},
        JWT_SECRET, algorithm=JWT_ALGORITHM,
    )


def _decode_token(token: str) -> Optional[str]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])["sub"]
    except jwt.PyJWTError:
        return None


async def require_user(request: Request, credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    token = credentials.credentials if credentials else request.cookies.get("session_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = _decode_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    pool = await get_pool()
    user = await pool.fetchrow("SELECT * FROM users WHERE user_id=$1", user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return dict(user)


class RegisterBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class LoginBody(BaseModel):
    email: EmailStr
    password: str


def _safe_user(u: dict) -> dict:
    return {"id": u["user_id"], "user_id": u["user_id"], "name": u["name"], "email": u["email"], "avatar": u.get("avatar")}


@router.post("/register")
async def register(body: RegisterBody):
    pool = await get_pool()
    existing = await pool.fetchrow("SELECT 1 FROM users WHERE email=$1", body.email.lower())
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    salt = uuid.uuid4().hex
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    await pool.execute(
        "INSERT INTO users (user_id, name, email, password_hash, salt) VALUES ($1,$2,$3,$4,$5)",
        user_id, body.name, body.email.lower(), _hash_password(body.password, salt), salt,
    )
    # Activate any pending team invites
    await pool.execute(
        "UPDATE team_members SET user_id=$1, status='active', updated_at=NOW() WHERE email=$2 AND status='invited'",
        user_id, body.email.lower(),
    )
    user = await pool.fetchrow("SELECT * FROM users WHERE user_id=$1", user_id)
    return {"token": _create_token(user_id), "user": _safe_user(dict(user))}


@router.post("/login")
async def login(body: LoginBody):
    pool = await get_pool()
    user = await pool.fetchrow("SELECT * FROM users WHERE email=$1", body.email.lower())
    if not user or not _verify_password(body.password, user["salt"], user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"token": _create_token(user["user_id"]), "user": _safe_user(dict(user))}


@router.post("/logout")
async def logout():
    return {"ok": True}


@router.get("/me")
async def me(current_user: dict = Depends(require_user)):
    return _safe_user(current_user)
