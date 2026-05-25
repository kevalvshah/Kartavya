"""
auth_router.py — Kartavya by Aekam Inc
Invite-only auth. No public registration.
Roles: admin | member | client
"""
import hashlib
import hmac
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field

from db import get_pool

router = APIRouter(prefix="/api/auth", tags=["auth"])
security = HTTPBearer(auto_error=False)

JWT_SECRET = os.environ.get("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable must be set")
JWT_ALGORITHM = "HS256"
JWT_TTL_DAYS = 30


def _hash_password(password: str, salt: str) -> str:
    """Return the PBKDF2-SHA256 hex digest of password with the given salt."""
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260_000).hex()


def _verify_password(password: str, salt: str, stored: str) -> bool:
    """Return True if the password matches the stored hash using constant-time comparison."""
    return hmac.compare_digest(_hash_password(password, salt), stored)


def _create_token(user_id: str) -> str:
    """Create a signed JWT for the given user_id with a 30-day expiry."""
    return jwt.encode(
        {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=JWT_TTL_DAYS), "iat": datetime.now(timezone.utc)},
        JWT_SECRET, algorithm=JWT_ALGORITHM,
    )


def _decode_token(token: str) -> Optional[str]:
    """Decode a JWT and return the user_id subject, or None if invalid."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])["sub"]
    except jwt.PyJWTError:
        return None


async def require_user(request: Request, credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    """FastAPI dependency that validates the Bearer token and returns the user dict."""
    # Cache resolved user on the request state for this request's lifetime.
    # Avoids a DB round-trip when multiple dependencies call require_user
    # on the same request (e.g. require_admin → require_user).
    cached = getattr(request.state, "_auth_user", None)
    if cached is not None:
        return cached

    token = credentials.credentials if credentials else request.cookies.get("session_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = _decode_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    pool = await get_pool()
    user = await pool.fetchrow(
        "SELECT user_id,email,name,full_name,role,avatar,position,company_name,"
        "member_role,receives_approval_emails FROM users WHERE user_id=$1",
        user_id,
    )
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    result = dict(user)
    request.state._auth_user = result
    return result


async def require_admin(user=Depends(require_user)):
    """FastAPI dependency that raises 403 unless the user has the admin role."""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


class AcceptInviteBody(BaseModel):
    token: str
    name: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=8, max_length=128)


class LoginBody(BaseModel):
    email: EmailStr
    password: str


def _safe_user(u: dict) -> dict:
    """Return a public-safe subset of user fields for API responses."""
    return {
        "id": u["user_id"],
        "user_id": u["user_id"],
        "name": u["name"],
        "email": u["email"],
        "role": u.get("role", "member"),
        "avatar": u.get("avatar"),
    }


@router.post("/accept-invite")
async def accept_invite(body: AcceptInviteBody):
    """Called when a user clicks their invite link and sets their password."""
    pool = await get_pool()
    invite = await pool.fetchrow(
        "SELECT * FROM invites WHERE token=$1 AND accepted_at IS NULL AND expires_at > NOW()",
        body.token,
    )
    if not invite:
        raise HTTPException(status_code=400, detail="Invite link is invalid or has expired")

    existing = await pool.fetchrow("SELECT user_id FROM users WHERE email=$1", invite["email"])
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    salt = uuid.uuid4().hex
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    role = invite["role"]  # "member" or "client"

    await pool.execute(
        "INSERT INTO users (user_id, name, email, password_hash, salt, role) VALUES ($1,$2,$3,$4,$5,$6)",
        user_id, body.name, invite["email"], _hash_password(body.password, salt), salt, role,
    )
    await pool.execute(
        "UPDATE invites SET accepted_at=NOW() WHERE token=$1", body.token
    )
    # Activate any pending team invites for this email
    await pool.execute(
        "UPDATE team_members SET user_id=$1, status='active', updated_at=NOW() WHERE email=$2 AND status='invited'",
        user_id, invite["email"],
    )
    # Sync to project_assignments so the user can create/view tasks
    await pool.execute("""
        INSERT INTO project_assignments (assignment_id, team_id, user_id, role)
        SELECT 'pa_' || substr(md5(random()::text), 1, 12), team_id, $1,
               CASE WHEN role IN ('owner','admin','member','client') THEN role ELSE 'member' END
        FROM team_members
        WHERE user_id=$1 AND status='active'
        ON CONFLICT (team_id, user_id) DO NOTHING
    """, user_id)
    user = await pool.fetchrow("SELECT * FROM users WHERE user_id=$1", user_id)

    try:
        from email_service import send_welcome_email
        send_welcome_email(invite["email"], body.name)
    except Exception:
        pass

    return {"token": _create_token(user_id), "user": _safe_user(dict(user))}


@router.post("/login")
async def login(body: LoginBody):
    """Authenticate with email and password and return a JWT and user profile."""
    pool = await get_pool()
    user = await pool.fetchrow("SELECT * FROM users WHERE email=$1", body.email.lower())
    if not user or not _verify_password(body.password, user["salt"], user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"token": _create_token(user["user_id"]), "user": _safe_user(dict(user))}


@router.post("/logout")
async def logout():
    """Invalidate the session (client-side token deletion)."""
    return {"ok": True}


@router.get("/me")
async def me(current_user: dict = Depends(require_user)):
    """Return the authenticated user's public profile."""
    return _safe_user(current_user)
