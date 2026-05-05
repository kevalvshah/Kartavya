"""
auth_router.py — Kartavya by Aekam Inc
When a user accepts an invite the full_name/position/company/member_role
from the invite row are copied into the new users row.
"""
import os
import re
import uuid
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr
import jwt

from db import get_pool

router = APIRouter(prefix="/api/auth", tags=["auth"])

SECRET_KEY = os.environ.get("SECRET_KEY", "change-me-in-production")
ALGORITHM = "HS256"
TOKEN_TTL_HOURS = 24 * 7   # 1 week


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt.encode(), 260_000
    ).hex()


def _make_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_TTL_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


async def require_user(request: Request, pool=Depends(get_pool)) -> dict:
    token = request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
    if not token:
        token = request.cookies.get("auth_token", "")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = await pool.fetchrow(
        "SELECT user_id, email, name, full_name, role, position, company_name, member_role, receives_approval_emails FROM users WHERE user_id=$1",
        payload["sub"],
    )
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return dict(user)


async def require_admin(request: Request, pool=Depends(get_pool)) -> dict:
    user = await require_user(request, pool)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class LoginBody(BaseModel):
    email: EmailStr
    password: str


class AcceptInviteBody(BaseModel):
    token: str
    password: str
    # Users can override / confirm profile fields on sign-up
    full_name: Optional[str] = None
    position: Optional[str] = None
    company_name: Optional[str] = None
    member_role: Optional[str] = None


class ChangePasswordBody(BaseModel):
    current_password: str
    new_password: str


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/login")
async def login(body: LoginBody, response: Response, pool=Depends(get_pool)):
    user = await pool.fetchrow(
        "SELECT * FROM users WHERE email=$1", body.email.lower()
    )
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    pw_hash = _hash_password(body.password, user["salt"])
    if pw_hash != user["password_hash"]:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = _make_token(user["user_id"], user["role"])
    response.set_cookie(
        "auth_token", token,
        httponly=True, samesite="lax", secure=True,
        max_age=TOKEN_TTL_HOURS * 3600,
    )
    return {
        "token": token,
        "user": {
            "user_id": user["user_id"],
            "email": user["email"],
            "name": user.get("full_name") or user["name"],
            "full_name": user.get("full_name") or user["name"],
            "role": user["role"],
            "position": user.get("position"),
            "company_name": user.get("company_name"),
            "member_role": user.get("member_role"),
            "receives_approval_emails": user.get("receives_approval_emails", True),
        },
    }


@router.post("/accept-invite")
async def accept_invite(
    body: AcceptInviteBody,
    response: Response,
    pool=Depends(get_pool),
):
    """Accept an invite and create the user account."""
    invite = await pool.fetchrow(
        "SELECT * FROM invites WHERE token=$1 AND accepted_at IS NULL AND expires_at > NOW()",
        body.token,
    )
    if not invite:
        raise HTTPException(status_code=400, detail="Invalid or expired invite link")

    email = invite["email"]
    role  = invite["role"]

    # Merge: invite defaults, overridden by anything the user typed on the sign-up form
    full_name    = body.full_name    or invite.get("full_name")    or email.split("@")[0].title()
    position     = body.position     or invite.get("position")
    company_name = body.company_name or invite.get("company_name")
    member_role  = body.member_role  or invite.get("member_role")
    receives_approval_emails = invite.get("receives_approval_emails", True)

    salt     = secrets.token_hex(16)
    pw_hash  = _hash_password(body.password, salt)
    user_id  = f"usr_{uuid.uuid4().hex[:12]}"

    try:
        await pool.execute(
            """
            INSERT INTO users
              (user_id, email, name, full_name, password_hash, salt, role,
               position, company_name, member_role, receives_approval_emails)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
            """,
            user_id, email, full_name, full_name, pw_hash, salt, role,
            position, company_name, member_role, receives_approval_emails,
        )
    except Exception:
        raise HTTPException(status_code=409, detail="Email already registered")

    # Mark invite accepted
    await pool.execute(
        "UPDATE invites SET accepted_at=NOW() WHERE token=$1", body.token
    )

    token_str = _make_token(user_id, role)
    response.set_cookie(
        "auth_token", token_str,
        httponly=True, samesite="lax", secure=True,
        max_age=TOKEN_TTL_HOURS * 3600,
    )
    return {
        "token": token_str,
        "user": {
            "user_id": user_id,
            "email": email,
            "name": full_name,
            "full_name": full_name,
            "role": role,
            "position": position,
            "company_name": company_name,
            "member_role": member_role,
            "receives_approval_emails": receives_approval_emails,
        },
    }


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("auth_token")
    return {"ok": True}


@router.get("/me")
async def me(user=Depends(require_user)):
    return user


@router.post("/change-password")
async def change_password(
    body: ChangePasswordBody,
    pool=Depends(get_pool),
    user=Depends(require_user),
):
    row = await pool.fetchrow(
        "SELECT password_hash, salt FROM users WHERE user_id=$1", user["user_id"]
    )
    if _hash_password(body.current_password, row["salt"]) != row["password_hash"]:
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    new_salt   = secrets.token_hex(16)
    new_hash   = _hash_password(body.new_password, new_salt)
    await pool.execute(
        "UPDATE users SET password_hash=$1, salt=$2, updated_at=NOW() WHERE user_id=$3",
        new_hash, new_salt, user["user_id"],
    )
    return {"ok": True}
