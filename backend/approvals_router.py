"""Approvals Router — Task Approval Workflow
Fix: all email calls now pass task_id for deep-link; send_approval_notification_email
signature extended; client-approve/reject fan out team-sync emails.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid

from auth_router import require_user, require_admin
from db import get_pool
import asyncpg

router = APIRouter(prefix="/api", tags=["approvals"])


class ApprovalRequest(BaseModel):
    notes: Optional[str] = None


class ApprovalResponse(BaseModel):
    task_id: str
    approval_status: str
    approved_by: Optional[str]
    approval_notes: Optional[str]
    approval_decided_at: Optional[datetime]


# ── Helpers ────────────────────────────────────────────────────────────────────

async def get_task_with_permission(pool, task_id: str, user_id: str):
    task = await pool.fetchrow("""
        SELECT t.*, tm.role AS user_team_role
        FROM tasks t
        LEFT JOIN team_members tm ON tm.team_id = t.team_id AND tm.user_id = $2
        WHERE t.task_id = $1
    """, task_id, user_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


async def is_project_owner(pool, team_id: str, user_id: str) -> bool:
    member = await pool.fetchrow("""
        SELECT role FROM team_members
        WHERE team_id=$1 AND user_id=$2 AND status='active'
    """, team_id, user_id)
    return member and member["role"] in ("owner", "admin")


async def _notify(pool, task_id: str, task_title: str, recipient_id: str,
                  notif_type: str, notes: Optional[str] = None):
    """Insert a DB notification row (fire-and-forget; never raises)."""
    try:
        title = {
            "request":  f"Approval Requested: {task_title}",
            "approved": f"Task Approved: {task_title}",
            "rejected": f"Task Rejected: {task_title}",
        }.get(notif_type, f"Update on: {task_title}")
        message = notes or ""
        await pool.execute("""
            INSERT INTO notifications (notification_id, user_id, type, title, message, task_id, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
        """, f"notif_{uuid.uuid4().hex[:12]}", recipient_id, notif_type, title, message, task_id)
    except Exception as exc:
        import logging; logging.getLogger(__name__).warning(f"_notify failed: {exc}")


async def send_approval_notification(pool, task_id: str, task_title: str,
                                     recipient_id: str, notification_type: str,
                                     notes: Optional[str] = None):
    user = await pool.fetchrow(
        "SELECT email, COALESCE(full_name,name) AS name FROM users WHERE user_id=$1", recipient_id
    )
    if user:
        await _notify(pool, task_id, task_title, recipient_id, notification_type, notes)
        try:
            from email_service import send_approval_notification_email
            send_approval_notification_email(
                user["email"], user["name"] or user["email"],
                task_title, notification_type, notes,
                task_id=task_id,  # ← deep-link fix
            )
        except Exception as exc:
            import logging; logging.getLogger(__name__).warning(f"approval email failed: {exc}")


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/tasks/{task_id}/request-approval")
async def request_approval(task_id: str, payload: ApprovalRequest,
                            pool=Depends(get_pool), user=Depends(require_user)):
    task = await get_task_with_permission(pool, task_id, user["user_id"])
    if not task["team_id"]:
        raise HTTPException(400, "Cannot request approval for personal tasks")

    owner = await pool.fetchrow("""
        SELECT user_id FROM team_members
        WHERE team_id=$1 AND role='owner' AND status='active' LIMIT 1
    """, task["team_id"])
    if not owner:
        raise HTTPException(400, "No project owner found")

    await pool.execute("""
        UPDATE tasks
        SET approval_status='pending', approval_requested_at=NOW(),
            approval_notes=$1, updated_at=NOW()
        WHERE task_id=$2
    """, payload.notes, task_id)

    await send_approval_notification(pool, task_id, task["title"], owner["user_id"], "request", payload.notes)
    return {"message": "Approval requested", "approval_status": "pending"}


@router.post("/tasks/{task_id}/approve")
async def approve_task(task_id: str, payload: ApprovalRequest,
                        pool=Depends(get_pool), user=Depends(require_user)):
    task = await get_task_with_permission(pool, task_id, user["user_id"])
    if not task["team_id"]:
        raise HTTPException(400, "Cannot approve personal tasks")

    if not await is_project_owner(pool, task["team_id"], user["user_id"]):
        user_data = await pool.fetchrow("SELECT role FROM users WHERE user_id=$1", user["user_id"])
        if not user_data or user_data["role"] != "admin":
            raise HTTPException(403, "Only project owner or admin can approve")

    current_col = await pool.fetchrow(
        "SELECT * FROM project_columns WHERE column_id=$1", task["column_id"]
    )
    if current_col:
        next_col = await pool.fetchrow("""
            SELECT * FROM project_columns
            WHERE team_id=$1 AND sort_order > $2
            ORDER BY sort_order ASC LIMIT 1
        """, task["team_id"], current_col["sort_order"])
        new_col_id = next_col["column_id"] if next_col else task["column_id"]
        new_status = "done" if (next_col and next_col["is_done"]) else "in_progress"
    else:
        new_col_id, new_status = task["column_id"], "in_progress"

    await pool.execute("""
        UPDATE tasks
        SET approval_status='approved', approved_by=$1, approval_notes=$2,
            approval_decided_at=NOW(), column_id=$3, status=$4, updated_at=NOW()
        WHERE task_id=$5
    """, user["user_id"], payload.notes, new_col_id, new_status, task_id)

    await send_approval_notification(pool, task_id, task["title"],
                                     task["created_by_user_id"], "approved", payload.notes)
    return {"message": "Task approved", "approval_status": "approved", "new_column_id": new_col_id}


@router.post("/tasks/{task_id}/reject")
async def reject_task(task_id: str, payload: ApprovalRequest,
                       pool=Depends(get_pool), user=Depends(require_user)):
    task = await get_task_with_permission(pool, task_id, user["user_id"])
    if not task["team_id"]:
        raise HTTPException(400, "Cannot reject personal tasks")

    if not await is_project_owner(pool, task["team_id"], user["user_id"]):
        user_data = await pool.fetchrow("SELECT role FROM users WHERE user_id=$1", user["user_id"])
        if not user_data or user_data["role"] != "admin":
            raise HTTPException(403, "Only project owner or admin can reject")

    if not payload.notes:
        raise HTTPException(400, "Rejection reason is required")

    await pool.execute("""
        UPDATE tasks
        SET approval_status='rejected', approved_by=$1, approval_notes=$2,
            approval_decided_at=NOW(), updated_at=NOW()
        WHERE task_id=$3
    """, user["user_id"], payload.notes, task_id)

    await send_approval_notification(pool, task_id, task["title"],
                                     task["created_by_user_id"], "rejected", payload.notes)
    return {"message": "Task rejected", "approval_status": "rejected"}


@router.get("/tasks/pending-approval", response_model=List[dict])
async def get_pending_approvals(pool=Depends(get_pool), user=Depends(require_user)):
    user_data = await pool.fetchrow("SELECT role FROM users WHERE user_id=$1", user["user_id"])
    if user_data and user_data["role"] == "admin":
        tasks = await pool.fetch("""
            SELECT t.*, u.name AS created_by_name, u.email AS created_by_email,
                   tm.name AS team_name
            FROM tasks t
            JOIN users u ON u.user_id = t.created_by_user_id
            LEFT JOIN teams tm ON tm.team_id = t.team_id
            WHERE t.approval_status = 'pending'
            ORDER BY t.approval_requested_at DESC
        """)
    else:
        tasks = await pool.fetch("""
            SELECT t.*, u.name AS created_by_name, u.email AS created_by_email,
                   tm.name AS team_name
            FROM tasks t
            JOIN users u ON u.user_id = t.created_by_user_id
            LEFT JOIN teams tm ON tm.team_id = t.team_id
            JOIN team_members tmem ON tmem.team_id = t.team_id
            WHERE t.approval_status = 'pending'
              AND tmem.user_id = $1
              AND tmem.role IN ('owner', 'admin')
              AND tmem.status = 'active'
            ORDER BY t.approval_requested_at DESC
        """, user["user_id"])
    return [dict(t) for t in tasks]


class ClientApprovalRequest(BaseModel):
    client_email: str
    notes: Optional[str] = None


@router.post("/tasks/{task_id}/request-client-approval")
async def request_client_approval(task_id: str, payload: ClientApprovalRequest,
                                   pool=Depends(get_pool), user=Depends(require_user)):
    task   = await get_task_with_permission(pool, task_id, user["user_id"])
    client = await pool.fetchrow(
        "SELECT user_id, name, full_name, email FROM users WHERE email=$1",
        payload.client_email.lower()
    )
    if not client:
        raise HTTPException(404, "Client not found")

    await pool.execute(
        "INSERT INTO task_clients (id,task_id,user_id,invited_by) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING",
        f"tc_{uuid.uuid4().hex[:12]}", task_id, client["user_id"], user["user_id"]
    )
    await pool.execute("""
        UPDATE tasks
        SET approval_status='pending_client', approval_requested_at=NOW(),
            approval_notes=$1, updated_at=NOW()
        WHERE task_id=$2
    """, payload.notes, task_id)

    await send_approval_notification(pool, task_id, task["title"],
                                     client["user_id"], "request", payload.notes)
    return {"message": "Client approval requested", "approval_status": "pending_client"}


@router.post("/tasks/{task_id}/client-approve")
async def client_approve_task(task_id: str, payload: ApprovalRequest,
                               pool=Depends(get_pool), user=Depends(require_user)):
    task   = await get_task_with_permission(pool, task_id, user["user_id"])
    access = await pool.fetchrow(
        "SELECT 1 FROM task_clients WHERE task_id=$1 AND user_id=$2", task_id, user["user_id"]
    )
    if not access and user.get("role") != "admin":
        # also allow if they are a project member
        member = await pool.fetchrow(
            "SELECT 1 FROM project_assignments WHERE team_id=$1 AND user_id=$2",
            task["team_id"], user["user_id"]
        )
        if not member:
            raise HTTPException(403, "Only the assigned client can approve this task")

    done_col = await pool.fetchrow(
        "SELECT column_id FROM project_columns WHERE team_id=$1 AND is_done=TRUE ORDER BY sort_order DESC LIMIT 1",
        task["team_id"]
    )
    new_col_id = done_col["column_id"] if done_col else task["column_id"]

    client_user = await pool.fetchrow(
        "SELECT COALESCE(full_name,name,email) AS display FROM users WHERE user_id=$1", user["user_id"]
    )
    client_name = client_user["display"] if client_user else "Client"

    await pool.execute("""
        UPDATE tasks
        SET approval_status='approved', approved_by=$1, approval_notes=$2,
            approval_decided_at=NOW(), column_id=$3, status='done',
            completed_at=NOW(), completed_by_user_id=$1, updated_at=NOW()
        WHERE task_id=$4
    """, user["user_id"], payload.notes, new_col_id, task_id)

    # Notify task creator
    if task.get("created_by_user_id") and task["created_by_user_id"] != user["user_id"]:
        await send_approval_notification(pool, task_id, task["title"],
                                         task["created_by_user_id"], "approved", payload.notes)

    # FIX: fan-out team-sync email to ALL assignees
    try:
        from email_service import send_team_sync_email
        assignee_ids = list(task.get("assignee_user_ids") or [])
        if task.get("created_by_user_id") and task["created_by_user_id"] not in assignee_ids:
            assignee_ids.append(task["created_by_user_id"])
        for uid in assignee_ids:
            if uid == user["user_id"]:
                continue
            member_row = await pool.fetchrow(
                "SELECT email, COALESCE(full_name,name) AS name FROM users WHERE user_id=$1", uid
            )
            if member_row:
                send_team_sync_email(
                    member_row["email"], member_row["name"] or member_row["email"],
                    client_name, task["title"], task_id
                )
    except Exception as exc:
        import logging; logging.getLogger(__name__).warning(f"team-sync email failed: {exc}")

    return {"message": "Task approved by client", "approval_status": "approved",
            "new_column_id": new_col_id}


@router.post("/tasks/{task_id}/client-reject")
async def client_reject_task(task_id: str, payload: ApprovalRequest,
                              pool=Depends(get_pool), user=Depends(require_user)):
    task   = await get_task_with_permission(pool, task_id, user["user_id"])
    access = await pool.fetchrow(
        "SELECT 1 FROM task_clients WHERE task_id=$1 AND user_id=$2", task_id, user["user_id"]
    )
    if not access and user.get("role") != "admin":
        member = await pool.fetchrow(
            "SELECT 1 FROM project_assignments WHERE team_id=$1 AND user_id=$2",
            task["team_id"], user["user_id"]
        )
        if not member:
            raise HTTPException(403, "Only the assigned client can reject this task")

    if not payload.notes:
        raise HTTPException(400, "Rejection reason is required")

    revision_col = await pool.fetchrow(
        "SELECT column_id FROM project_columns WHERE team_id=$1 AND is_done=FALSE ORDER BY sort_order ASC LIMIT 1",
        task["team_id"]
    )
    new_col_id = revision_col["column_id"] if revision_col else task["column_id"]

    await pool.execute("""
        UPDATE tasks
        SET approval_status='rejected', approved_by=$1, approval_notes=$2,
            approval_decided_at=NOW(), column_id=$3, status='in_progress', updated_at=NOW()
        WHERE task_id=$4
    """, user["user_id"], payload.notes, new_col_id, task_id)

    if task.get("created_by_user_id"):
        await send_approval_notification(pool, task_id, task["title"],
                                         task["created_by_user_id"], "rejected", payload.notes)
    for uid in (task.get("assignee_user_ids") or []):
        if uid != task.get("created_by_user_id"):
            await send_approval_notification(pool, task_id, task["title"], uid, "rejected", payload.notes)

    return {"message": "Task rejected by client", "approval_status": "rejected",
            "new_column_id": new_col_id}
