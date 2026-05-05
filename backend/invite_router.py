"""
invite_router.py — Kartavya by Aekam Inc
Enhanced invite system: captures full_name, position, company, member_role,
and receives_approval_emails at invite time.
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


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class InviteCreate(BaseModel):
    email: EmailStr
    role: str = "member"  # "admin" | "member" | "client"

    # Shared
    full_name: str

    # Client-only
    position: Optional[str] = None
    company_name: Optional[str] = None
    receives_approval_emails: bool = True   # client approval toggle

    # Member-only
    member_role: Optional[str] = None       # e.g. "Developer", "Designer"


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    position: Optional[str] = None
    company_name: Optional[str] = None
    member_role: Optional[str] = None
    receives_approval_emails: Optional[bool] = None


class InviteOut(BaseModel):
    invite_id: str
    email: str
    role: str
    full_name: Optional[str]
    invite_link: str
    created_at: datetime
    expires_at: datetime
    accepted_at: Optional[datetime] = None


class UserOut(BaseModel):
    user_id: str
    name: str
    full_name: Optional[str]
    email: str
    role: str
    position: Optional[str]
    company_name: Optional[str]
    member_role: Optional[str]
    receives_approval_emails: bool
    created_at: datetime


# ---------------------------------------------------------------------------
# Routes — users
# ---------------------------------------------------------------------------

@router.get("/users", response_model=List[UserOut])
async def list_users(pool=Depends(get_pool), admin=Depends(require_admin)):
    rows = await pool.fetch("""
        SELECT user_id, name, full_name, email, role,
               position, company_name, member_role,
               receives_approval_emails, created_at
        FROM users
        ORDER BY created_at DESC
    """)
    return [UserOut(**dict(r)) for r in rows]


@router.put("/users/{user_id}/profile")
async def update_user_profile(
    user_id: str,
    body: UserProfileUpdate,
    pool=Depends(get_pool),
    admin=Depends(require_admin),
):
    """Admin can update any user's profile fields."""
    updates = {}
    if body.full_name is not None:
        updates["full_name"] = body.full_name
        updates["name"] = body.full_name   # keep name in sync
    if body.position is not None:
        updates["position"] = body.position
    if body.company_name is not None:
        updates["company_name"] = body.company_name
    if body.member_role is not None:
        updates["member_role"] = body.member_role
    if body.receives_approval_emails is not None:
        updates["receives_approval_emails"] = body.receives_approval_emails

    if not updates:
        return {"ok": True, "message": "Nothing to update"}

    updates["updated_at"] = datetime.now(timezone.utc)

    set_clauses = ", ".join(f"{k}=${i+2}" for i, k in enumerate(updates))
    values = [user_id] + list(updates.values())
    await pool.execute(
        f"UPDATE users SET {set_clauses} WHERE user_id=$1", *values
    )

    # Propagate to team_members + project_assignments
    if "full_name" in updates:
        await pool.execute(
            "UPDATE team_members SET full_name=$1 WHERE user_id=$2",
            updates["full_name"], user_id,
        )
        await pool.execute(
            "UPDATE project_assignments SET full_name=$1 WHERE user_id=$2",
            updates["full_name"], user_id,
        )
    if "receives_approval_emails" in updates:
        await pool.execute(
            "UPDATE team_members SET receives_approval_emails=$1 WHERE user_id=$2",
            updates["receives_approval_emails"], user_id,
        )
        await pool.execute(
            "UPDATE project_assignments SET receives_approval_emails=$1 WHERE user_id=$2",
            updates["receives_approval_emails"], user_id,
        )

    return {"ok": True}


# Self-service profile update (any logged-in user)
@router.put("/users/me/profile")
async def update_my_profile(
    body: UserProfileUpdate,
    pool=Depends(get_pool),
    user=Depends(require_user),
):
    """Any user can update their own profile."""
    updates = {}
    if body.full_name is not None:
        updates["full_name"] = body.full_name
        updates["name"] = body.full_name
    if body.position is not None:
        updates["position"] = body.position
    if body.company_name is not None:
        updates["company_name"] = body.company_name
    if body.member_role is not None:
        updates["member_role"] = body.member_role
    if body.receives_approval_emails is not None:
        updates["receives_approval_emails"] = body.receives_approval_emails

    if not updates:
        return {"ok": True}

    updates["updated_at"] = datetime.now(timezone.utc)
    set_clauses = ", ".join(f"{k}=${i+2}" for i, k in enumerate(updates))
    values = [user["user_id"]] + list(updates.values())
    await pool.execute(
        f"UPDATE users SET {set_clauses} WHERE user_id=$1", *values
    )

    if "full_name" in updates:
        await pool.execute(
            "UPDATE team_members SET full_name=$1 WHERE user_id=$2",
            updates["full_name"], user["user_id"],
        )
        await pool.execute(
            "UPDATE project_assignments SET full_name=$1 WHERE user_id=$2",
            updates["full_name"], user["user_id"],
        )
    if "receives_approval_emails" in updates:
        await pool.execute(
            "UPDATE team_members SET receives_approval_emails=$1 WHERE user_id=$2",
            updates["receives_approval_emails"], user["user_id"],
        )

    return {"ok": True}


@router.put("/users/{user_id}/role")
async def change_user_role(
    user_id: str, body: dict,
    pool=Depends(get_pool), admin=Depends(require_admin),
):
    role = body.get("role")
    if role not in ("admin", "member", "client"):
        raise HTTPException(status_code=400, detail="Invalid role")
    await pool.execute("UPDATE users SET role=$1 WHERE user_id=$2", role, user_id)
    return {"ok": True}


@router.delete("/users/{user_id}")
async def remove_user(
    user_id: str,
    pool=Depends(get_pool), admin=Depends(require_admin),
):
    if user_id == admin["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot remove yourself")
    await pool.execute("DELETE FROM users WHERE user_id=$1", user_id)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Routes — invites
# ---------------------------------------------------------------------------

@router.post("/invites", response_model=InviteOut)
async def create_invite(
    body: InviteCreate,
    pool=Depends(get_pool),
    admin=Depends(require_admin),
):
    if body.role not in ("admin", "member", "client"):
        raise HTTPException(status_code=400, detail="Role must be 'admin', 'member', or 'client'")

    existing = await pool.fetchrow("SELECT 1 FROM users WHERE email=$1", body.email.lower())
    if existing:
        raise HTTPException(status_code=409, detail="A user with this email already exists")

    # Expire previous pending invites
    await pool.execute(
        "UPDATE invites SET expires_at=NOW() WHERE email=$1 AND accepted_at IS NULL",
        body.email.lower(),
    )

    token = secrets.token_urlsafe(32)
    invite_id = f"inv_{uuid.uuid4().hex[:12]}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    await pool.execute(
        """
        INSERT INTO invites
          (invite_id, email, role, token, invited_by, expires_at,
           full_name, position, company_name, member_role, receives_approval_emails)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        """,
        invite_id,
        body.email.lower(),
        body.role,
        token,
        admin["user_id"],
        expires_at,
        body.full_name,
        body.position if body.role == "client" else None,
        body.company_name if body.role == "client" else None,
        body.member_role if body.role == "member" else None,
        body.receives_approval_emails if body.role == "client" else False,
    )

    invite_link = f"{FRONTEND_URL}/accept-invite?token={token}"

    # Fire invite email — best-effort
    try:
        from email_service import send_team_invite_email
        team_label = "Kartavya" if body.role != "client" else "Kartavya (Client portal)"
        send_team_invite_email(
            to_email=body.email.lower(),
            to_name=body.full_name,
            team_name=team_label,
            inviter_name=admin.get("full_name") or admin.get("name") or admin.get("email") or "your administrator",
            invite_token=token,
            role=body.role,
        )
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"invite email failed for {body.email}: {e}")

    return InviteOut(
        invite_id=invite_id,
        email=body.email.lower(),
        role=body.role,
        full_name=body.full_name,
        invite_link=invite_link,
        created_at=datetime.now(timezone.utc),
        expires_at=expires_at,
        accepted_at=None,
    )


@router.get("/invites", response_model=List[InviteOut])
async def list_invites(pool=Depends(get_pool), admin=Depends(require_admin)):
    rows = await pool.fetch(
        "SELECT * FROM invites ORDER BY created_at DESC LIMIT 100"
    )
    return [
        InviteOut(
            invite_id=r["invite_id"],
            email=r["email"],
            role=r["role"],
            full_name=r.get("full_name"),
            invite_link=f"{FRONTEND_URL}/accept-invite?token={r['token']}",
            created_at=r["created_at"],
            expires_at=r["expires_at"],
            accepted_at=r["accepted_at"],
        )
        for r in rows
    ]


@router.delete("/invites/{invite_id}")
async def revoke_invite(
    invite_id: str,
    pool=Depends(get_pool), admin=Depends(require_admin),
):
    await pool.execute("UPDATE invites SET expires_at=NOW() WHERE invite_id=$1", invite_id)
    return {"ok": True}
