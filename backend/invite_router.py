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

from auth_router import require_admin
from db import get_pool

router = APIRouter(prefix="/api/admin", tags=["admin"])

FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://kartavya-aekam.vercel.app")


# ── Schemas ───────────────────────────────────────────────────────────────────

class InviteCreate(BaseModel):
    email: EmailStr
    role: str = "member"                       # account type: admin | member | client
    full_name: Optional[str] = None
    member_role: Optional[str] = None          # job title / position
    receives_approval_emails: bool = True      # client approval emails


class InviteOut(BaseModel):
    invite_id: str
    email: str
    role: str
    invite_link: str
    created_at: datetime
    expires_at: datetime
    accepted_at: Optional[datetime] = None
    full_name: Optional[str] = None
    member_role: Optional[str] = None
    receives_approval_emails: Optional[bool] = True
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


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    member_role: Optional[str] = None          # job title / position
    company_name: Optional[str] = None
    receives_approval_emails: Optional[bool] = None


# ── Users ─────────────────────────────────────────────────────────────────────

@router.get("/users", response_model=List[UserOut])
async def list_users(pool=Depends(get_pool), admin=Depends(require_admin)):
    rows = await pool.fetch(
        """SELECT user_id, email, name, full_name, role, position, company_name,
                  member_role, receives_approval_emails, avatar, provider, created_at
           FROM users ORDER BY created_at DESC"""
    )
    return [UserOut(**dict(r)) for r in rows]


@router.patch("/users/{user_id}", response_model=UserOut)
async def update_user(user_id: str, body: UserUpdate, pool=Depends(get_pool), admin=Depends(require_admin)):
    """Edit a user's profile fields. Email is immutable."""
    # Build dynamic SET clause for only provided fields
    fields, vals = [], []
    if body.full_name is not None:
        fields.append(f"full_name=${len(vals)+1}"); vals.append(body.full_name)
    if body.role is not None:
        if body.role not in ("admin", "member", "client"):
            raise HTTPException(status_code=400, detail="Invalid role")
        fields.append(f"role=${len(vals)+1}"); vals.append(body.role)
    if body.member_role is not None:
        fields.append(f"member_role=${len(vals)+1}"); vals.append(body.member_role)
    if body.company_name is not None:
        fields.append(f"company_name=${len(vals)+1}"); vals.append(body.company_name)
    if body.receives_approval_emails is not None:
        fields.append(f"receives_approval_emails=${len(vals)+1}"); vals.append(body.receives_approval_emails)

    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    vals.append(user_id)
    await pool.execute(
        f"UPDATE users SET {', '.join(fields)}, updated_at=NOW() WHERE user_id=${len(vals)}",
        *vals
    )
    row = await pool.fetchrow(
        """SELECT user_id, email, name, full_name, role, position, company_name,
                  member_role, receives_approval_emails, avatar, provider, created_at
           FROM users WHERE user_id=$1""", user_id
    )
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return UserOut(**dict(row))


@router.put("/users/{user_id}/role")
async def change_user_role(user_id: str, body: dict, pool=Depends(get_pool), admin=Depends(require_admin)):
    role = body.get("role")
    if role not in ("admin", "member", "client"):
        raise HTTPException(status_code=400, detail="Invalid role")
    await pool.execute("UPDATE users SET role=$1, updated_at=NOW() WHERE user_id=$2", role, user_id)
    return {"ok": True}


@router.delete("/users/{user_id}")
async def remove_user(user_id: str, pool=Depends(get_pool), admin=Depends(require_admin)):
    if user_id == admin["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot remove yourself")
    await pool.execute("DELETE FROM users WHERE user_id=$1", user_id)
    return {"ok": True}


# ── Invites ───────────────────────────────────────────────────────────────────

@router.post("/invites", response_model=InviteOut)
async def create_invite(body: InviteCreate, pool=Depends(get_pool), admin=Depends(require_admin)):
    if body.role not in ("admin", "member", "client"):
        raise HTTPException(status_code=400, detail="Role must be 'admin', 'member', or 'client'")

    existing = await pool.fetchrow("SELECT 1 FROM users WHERE email=$1", body.email.lower())
    if existing:
        raise HTTPException(status_code=409, detail="A user with this email already exists")

    # Expire old pending invites for same email
    await pool.execute(
        "UPDATE invites SET expires_at=NOW() WHERE email=$1 AND accepted_at IS NULL",
        body.email.lower(),
    )

    token      = secrets.token_urlsafe(32)
    invite_id  = f"inv_{uuid.uuid4().hex[:12]}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    await pool.execute(
        """INSERT INTO invites
               (invite_id, email, role, token, invited_by, expires_at,
                full_name, member_role, receives_approval_emails)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)""",
        invite_id, body.email.lower(), body.role, token, admin["user_id"], expires_at,
        body.full_name or None, body.member_role or None, body.receives_approval_emails,
    )

    invite_link = f"{FRONTEND_URL}/accept-invite?token={token}"

    try:
        from email_service import send_invite_email
        inviter_name   = admin.get("full_name") or admin.get("name") or admin.get("email", "An admin")
        workspace_name = admin.get("company_name") or "Kartavya"
        expires_label  = expires_at.strftime("%b %-d, %Y")
        send_invite_email(body.email.lower(), inviter_name, body.role, token,
                          workspace_name=workspace_name,
                          expires_label=expires_label,
                          recipient_name=body.full_name or "")
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
        full_name=body.full_name or None,
        member_role=body.member_role or None,
        receives_approval_emails=body.receives_approval_emails,
        invited_by_name=inviter_name,
    )


@router.get("/invites", response_model=List[InviteOut])
async def list_invites(pool=Depends(get_pool), admin=Depends(require_admin)):
    rows = await pool.fetch(
        """SELECT i.invite_id, i.email, i.role, i.token, i.created_at, i.expires_at,
                  i.accepted_at, i.full_name, i.member_role, i.receives_approval_emails,
                  COALESCE(u.full_name, u.name, u.email) AS invited_by_name
           FROM invites i
           LEFT JOIN users u ON u.user_id = i.invited_by
           ORDER BY i.created_at DESC LIMIT 100"""
    )
    return [
        InviteOut(
            invite_id=r["invite_id"],
            email=r["email"],
            role=r["role"],
            invite_link=f"{FRONTEND_URL}/accept-invite?token={r['token']}",
            created_at=r["created_at"],
            expires_at=r["expires_at"],
            accepted_at=r["accepted_at"],
            full_name=r["full_name"],
            member_role=r["member_role"],
            receives_approval_emails=r["receives_approval_emails"],
            invited_by_name=r["invited_by_name"],
        )
        for r in rows
    ]


@router.delete("/invites/{invite_id}")
async def revoke_invite(invite_id: str, pool=Depends(get_pool), admin=Depends(require_admin)):
    await pool.execute("DELETE FROM invites WHERE invite_id=$1", invite_id)
    return {"ok": True}
