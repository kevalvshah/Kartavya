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
async def remove_user(user_id: str, reassign_to: Optional[str] = None, pool=Depends(get_pool), admin=Depends(require_admin)):
    if user_id == admin["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot remove yourself")
    if reassign_to == user_id:
        raise HTTPException(status_code=400, detail="Cannot reassign to the same user")
    if reassign_to:
        target = await pool.fetchrow("SELECT user_id FROM users WHERE user_id=$1", reassign_to)
        if not target:
            raise HTTPException(status_code=404, detail="Reassign target user not found")

    r = reassign_to  # shorthand

    async with pool.acquire() as conn:
        async with conn.transaction():
          try:

            # ── Memberships (cannot transfer — remove) ────────────────────────
            for stmt, args in [
                ("DELETE FROM team_members        WHERE user_id=$1", (user_id,)),
                ("DELETE FROM project_assignments WHERE user_id=$1", (user_id,)),
                ("DELETE FROM task_clients        WHERE user_id=$1", (user_id,)),
            ]:
                try:
                    await conn.execute(stmt, *args)
                except Exception:
                    pass

            # ── Activity events ───────────────────────────────────────────────
            try:
                if r:
                    await conn.execute("UPDATE activity_events SET actor_id=$1 WHERE actor_id=$2", r, user_id)
                else:
                    await conn.execute("DELETE FROM activity_events WHERE actor_id=$1", user_id)
            except Exception:
                pass

            # ── Time entries ──────────────────────────────────────────────────
            try:
                if r:
                    await conn.execute("UPDATE time_entries SET user_id=$1 WHERE user_id=$2", r, user_id)
                else:
                    await conn.execute("DELETE FROM time_entries WHERE user_id=$1", user_id)
            except Exception:
                pass

            # ── Comments (try both table names) ───────────────────────────────
            for tbl, col in [("task_comments", "user_id"), ("comments", "author_id")]:
                try:
                    if r:
                        await conn.execute(f"UPDATE {tbl} SET {col}=$1 WHERE {col}=$2", r, user_id)
                    else:
                        await conn.execute(f"DELETE FROM {tbl} WHERE {col}=$1", user_id)
                except Exception:
                    pass

            # ── Tasks: created_by_user_id ─────────────────────────────────────
            try:
                if r:
                    await conn.execute(
                        "UPDATE tasks SET created_by_user_id=$1 WHERE created_by_user_id=$2", r, user_id
                    )
                else:
                    task_teams = await conn.fetch(
                        "SELECT DISTINCT team_id FROM tasks WHERE created_by_user_id=$1", user_id
                    )
                    for tt in task_teams:
                        tid = tt["team_id"]
                        fallback = await conn.fetchval("""
                            SELECT user_id FROM project_assignments
                            WHERE team_id=$1 AND role IN ('owner','admin') AND user_id != $2
                            ORDER BY CASE role WHEN 'owner' THEN 0 ELSE 1 END LIMIT 1
                        """, tid, user_id)
                        await conn.execute(
                            "UPDATE tasks SET created_by_user_id=$1 WHERE created_by_user_id=$2 AND team_id=$3",
                            fallback, user_id, tid
                        )
            except Exception:
                pass

            # ── Tasks: user_id column (FK) ────────────────────────────────────
            try:
                if r:
                    await conn.execute("UPDATE tasks SET user_id=$1 WHERE user_id=$2", r, user_id)
                else:
                    await conn.execute("UPDATE tasks SET user_id=NULL WHERE user_id=$1", user_id)
            except Exception:
                pass

            # ── Tasks: assigned_by_user_id ────────────────────────────────────
            try:
                if r:
                    await conn.execute("UPDATE tasks SET assigned_by_user_id=$1 WHERE assigned_by_user_id=$2", r, user_id)
                else:
                    await conn.execute("UPDATE tasks SET assigned_by_user_id=NULL WHERE assigned_by_user_id=$1", user_id)
            except Exception:
                pass

            # ── Tasks: assignee_user_ids[] ────────────────────────────────────
            try:
                if r:
                    # Swap user_id → reassign_to, skip if already assigned
                    await conn.execute("""
                        UPDATE tasks
                        SET assignee_user_ids = array_append(array_remove(assignee_user_ids,$1), $2)
                        WHERE $1=ANY(assignee_user_ids) AND NOT ($2=ANY(assignee_user_ids))
                    """, user_id, r)
                # Always clean up any remaining references
                await conn.execute(
                    "UPDATE tasks SET assignee_user_ids=array_remove(assignee_user_ids,$1) WHERE $1=ANY(assignee_user_ids)",
                    user_id
                )
            except Exception:
                pass

            # ── Task assignees junction table (if exists) ─────────────────────
            try:
                if r:
                    await conn.execute(
                        "UPDATE task_assignees SET user_id=$1 WHERE user_id=$2", r, user_id
                    )
                else:
                    await conn.execute("DELETE FROM task_assignees WHERE user_id=$1", user_id)
            except Exception:
                pass

            # ── Approvals ─────────────────────────────────────────────────────
            try:
                if r:
                    await conn.execute("UPDATE approvals SET requested_by=$1 WHERE requested_by=$2", r, user_id)
                    await conn.execute("UPDATE approvals SET approved_by=$1   WHERE approved_by=$2",  r, user_id)
                else:
                    await conn.execute("UPDATE approvals SET requested_by=NULL WHERE requested_by=$1", user_id)
                    await conn.execute("UPDATE approvals SET approved_by=NULL   WHERE approved_by=$1",  user_id)
            except Exception:
                pass

            # ── Report schedules ──────────────────────────────────────────────
            try:
                if r:
                    await conn.execute("UPDATE report_schedules SET created_by=$1 WHERE created_by=$2", r, user_id)
                else:
                    await conn.execute("DELETE FROM report_schedules WHERE created_by=$1", user_id)
            except Exception:
                pass

            # ── Automations ───────────────────────────────────────────────────
            try:
                if r:
                    await conn.execute("UPDATE automations SET created_by=$1 WHERE created_by=$2", r, user_id)
                else:
                    await conn.execute("DELETE FROM automations WHERE created_by=$1", user_id)
            except Exception:
                pass

            # ── Invites invited_by ────────────────────────────────────────────
            try:
                if r:
                    await conn.execute("UPDATE invites SET invited_by=$1 WHERE invited_by=$2", r, user_id)
                else:
                    await conn.execute("UPDATE invites SET invited_by=NULL WHERE invited_by=$1", user_id)
            except Exception:
                pass

            # ── Remove the user's own invite record ───────────────────────────
            try:
                await conn.execute(
                    "DELETE FROM invites WHERE email=(SELECT email FROM users WHERE user_id=$1)", user_id
                )
            except Exception:
                pass

            # ── Sessions / tokens (cannot transfer — always delete) ───────────
            for tbl in ("refresh_tokens", "sessions"):
                try:
                    await conn.execute(f"DELETE FROM {tbl} WHERE user_id=$1", user_id)
                except Exception:
                    pass

            # ── Finally delete the user ───────────────────────────────────────
            await conn.execute("DELETE FROM users WHERE user_id=$1", user_id)

          except Exception as exc:
            import logging
            logging.getLogger(__name__).error(f"remove_user {user_id} failed: {exc}")
            raise HTTPException(status_code=500, detail=str(exc))

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
        inviter_role   = (admin.get("role") or "admin").capitalize()
        workspace_name = admin.get("company_name")
        if not workspace_name:
            row = await pool.fetchrow(
                "SELECT company_name FROM users WHERE company_name IS NOT NULL LIMIT 1"
            )
            workspace_name = (row["company_name"] if row else None) or "Kartavya"
        expires_label  = expires_at.strftime("%b %-d, %Y")
        send_invite_email(body.email.lower(), inviter_name, body.role, token,
                          workspace_name=workspace_name,
                          expires_label=expires_label,
                          recipient_name=body.full_name or "",
                          inviter_role=inviter_role)
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
