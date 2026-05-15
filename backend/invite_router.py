"""
invite_router.py — Kartavya by Aekam Inc
Admin-only invite system. No public registration.
"""
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from auth_router import require_admin, require_user
from db import get_pool

router = APIRouter(prefix="/api/admin", tags=["admin"])

FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://kartavya-aekam.vercel.app")


class InviteCreate(BaseModel):
    email: EmailStr
    role: str = "member"  # "admin" | "member" | "client"
    name: Optional[str] = None


class InviteOut(BaseModel):
    invite_id: str
    email: str
    role: str
    invite_link: str
    created_at: datetime
    expires_at: datetime
    accepted_at: Optional[datetime] = None
    full_name: Optional[str] = None
    invited_by_name: Optional[str] = None


class UserOut(BaseModel):
    user_id: str
    email: str
    name: Optional[str] = None
    full_name: Optional[str] = None
    role: str
    position: Optional[str] = None
    company_name: Optional[str] = None
    member_role: Optional[str] = None
    receives_approval_emails: Optional[bool] = True
    avatar: Optional[str] = None
    provider: Optional[str] = None
    created_at: datetime


class UserRoleUpdate(BaseModel):
    role: str


@router.get("/users", response_model=List[UserOut])
async def list_users(pool=Depends(get_pool), admin=Depends(require_admin)):
    rows = await pool.fetch(
        """SELECT user_id, email, name, full_name, role, position, company_name,
                  member_role, receives_approval_emails, avatar, provider, created_at
           FROM users ORDER BY created_at DESC"""
    )
    return [UserOut(**dict(r)) for r in rows]


@router.post("/invites", response_model=InviteOut)
async def create_invite(body: InviteCreate, pool=Depends(get_pool), admin=Depends(require_admin)):
    if body.role not in ("admin", "member", "client"):
        raise HTTPException(status_code=400, detail="Role must be 'admin', 'member', or 'client'")

    existing = await pool.fetchrow("SELECT 1 FROM users WHERE email=$1", body.email.lower())
    if existing:
        raise HTTPException(status_code=409, detail="A user with this email already exists")

    # Expire (soft-delete) old pending invites for same email
    await pool.execute(
        "UPDATE invites SET expires_at=NOW() WHERE email=$1 AND accepted_at IS NULL",
        body.email.lower(),
    )

    token      = secrets.token_urlsafe(32)
    invite_id  = f"inv_{uuid.uuid4().hex[:12]}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    await pool.execute(
        """INSERT INTO invites (invite_id, email, role, token, invited_by, expires_at, full_name)
           VALUES ($1,$2,$3,$4,$5,$6,$7)""",
        invite_id, body.email.lower(), body.role, token, admin["user_id"], expires_at,
        body.name or None,
    )

    invite_link = f"{FRONTEND_URL}/accept-invite?token={token}"

    try:
        from email_service import send_invite_email
        inviter_name = admin.get("full_name") or admin.get("name") or admin.get("email", "An admin")
        send_invite_email(body.email.lower(), inviter_name, body.role, token)
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning(f"invite email failed: {exc}")

    inviter_name = admin.get("full_name") or admin.get("name") or admin.get("email")

    return InviteOut(
        invite_id=invite_id,
        email=body.email.lower(),
        role=body.role,
        invite_link=invite_link,
        created_at=datetime.now(timezone.utc),
        expires_at=expires_at,
        accepted_at=None,
        full_name=body.name or None,
        invited_by_name=inviter_name,
    )


@router.get("/invites", response_model=List[InviteOut])
async def list_invites(pool=Depends(get_pool), admin=Depends(require_admin)):
    rows = await pool.fetch(
        """SELECT i.invite_id, i.email, i.role, i.token, i.created_at, i.expires_at,
                  i.accepted_at, i.full_name,
                  COALESCE(u.full_name, u.name, u.email) AS invited_by_name
           FROM invites i
           LEFT JOIN users u ON u.user_id = i.invited_by
           ORDER BY i.created_at DESC LIMIT 100"""
    )
    result = []
    for r in rows:
        result.append(InviteOut(
            invite_id=r["invite_id"],
            email=r["email"],
            role=r["role"],
            invite_link=f"{FRONTEND_URL}/accept-invite?token={r['token']}",
            created_at=r["created_at"],
            expires_at=r["expires_at"],
            accepted_at=r["accepted_at"],
            full_name=r["full_name"],
            invited_by_name=r["invited_by_name"],
        ))
    return result


@router.delete("/invites/{invite_id}")
async def revoke_invite(invite_id: str, pool=Depends(get_pool), admin=Depends(require_admin)):
    # Hard delete so the invite disappears immediately from the list
    await pool.execute("DELETE FROM invites WHERE invite_id=$1", invite_id)
    return {"ok": True}


@router.put("/users/{user_id}/role")
async def change_user_role(user_id: str, body: dict, pool=Depends(get_pool), admin=Depends(require_admin)):
    role = body.get("role")
    if role not in ("admin", "member", "client"):
        raise HTTPException(status_code=400, detail="Invalid role")
    await pool.execute("UPDATE users SET role=$1 WHERE user_id=$2", role, user_id)
    return {"ok": True}


@router.delete("/users/{user_id}")
async def remove_user(user_id: str, pool=Depends(get_pool), admin=Depends(require_admin)):
    if user_id == admin["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot remove yourself")
    await pool.execute("DELETE FROM users WHERE user_id=$1", user_id)
    return {"ok": True}
