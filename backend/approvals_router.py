"""Approvals Router - Task Approval Workflow

Fixes:
- Approval emails now sent to ALL owners/admins with receives_approval_emails=TRUE
- Display names (full_name) used throughout, not emails
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


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class ApprovalRequest(BaseModel):
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def get_task_or_404(pool: asyncpg.Pool, task_id: str):
    task = await pool.fetchrow("SELECT * FROM tasks WHERE task_id = $1", task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


async def is_project_owner_or_admin(pool: asyncpg.Pool, team_id: str, user_id: str) -> bool:
    member = await pool.fetchrow("""
        SELECT role FROM team_members
        WHERE team_id = $1 AND user_id = $2 AND status = 'active'
    """, team_id, user_id)
    if member and member['role'] in ('owner', 'admin'):
        return True
    # fall back to global admin
    user = await pool.fetchrow("SELECT role FROM users WHERE user_id=$1", user_id)
    return bool(user and user['role'] == 'admin')


async def get_display_name(pool: asyncpg.Pool, user_id: str) -> str:
    """Return full_name if set, else name, else email."""
    u = await pool.fetchrow(
        "SELECT full_name, name, email FROM users WHERE user_id=$1", user_id
    )
    if not u:
        return "Unknown"
    return u.get("full_name") or u.get("name") or u.get("email", "Unknown")


async def notify_approval_owners(pool: asyncpg.Pool, task_id: str, task_title: str,
                                  team_id: str, requester_name: str, notes: Optional[str]):
    """
    Send approval-request email to every owner/admin in the team
    who has receives_approval_emails = TRUE.
    """
    from email_service import send_approval_request_email

    recipients = await pool.fetch("""
        SELECT u.user_id, u.email,
               COALESCE(u.full_name, u.name, u.email) AS display_name
        FROM team_members tm
        JOIN users u ON u.user_id = tm.user_id
        WHERE tm.team_id = $1
          AND tm.role IN ('owner', 'admin')
          AND tm.status = 'active'
          AND tm.receives_approval_emails = TRUE
    """, team_id)

    project = await pool.fetchrow("SELECT name FROM teams WHERE team_id=$1", team_id)
    project_name = project["name"] if project else "your project"

    for r in recipients:
        # in-app notification
        await pool.execute("""
            INSERT INTO notifications
              (notification_id, user_id, team_id, type, title, message, task_id, created_at)
            VALUES ($1,$2,$3,'approval_request',$4,$5,$6,NOW())
        """,
            f"notif_{uuid.uuid4().hex[:12]}",
            r["user_id"], team_id,
            f"Approval Required: {task_title}",
            f"{requester_name} has submitted '{task_title}' for approval.",
            task_id,
        )
        # email
        try:
            send_approval_request_email(
                to_email=r["email"],
                to_name=r["display_name"],
                task_id=task_id,
                task_title=task_title,
                requester_name=requester_name,
                project_name=project_name,
                notes=notes,
            )
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning(f"approval email failed to {r['email']}: {exc}")


async def notify_decision(pool: asyncpg.Pool, task_id: str, task_title: str,
                           recipient_id: str, approved: bool,
                           approver_name: str, notes: Optional[str], team_id: str):
    """Notify the task creator of approve/reject decision."""
    from email_service import send_approval_decision_email

    user = await pool.fetchrow(
        "SELECT email, COALESCE(full_name, name, email) AS display_name FROM users WHERE user_id=$1",
        recipient_id,
    )
    if not user:
        return

    status_text = "approved" if approved else "rejected"
    project = await pool.fetchrow("SELECT name FROM teams WHERE team_id=$1", team_id)
    project_name = project["name"] if project else "your project"

    # in-app notification
    await pool.execute("""
        INSERT INTO notifications
          (notification_id, user_id, team_id, type, title, message, task_id, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
    """,
        f"notif_{uuid.uuid4().hex[:12]}",
        recipient_id, team_id,
        f"task_{status_text}",
        f"Task {status_text}: {task_title}",
        f"{approver_name} has {status_text} your task '{task_title}'.",
        task_id,
    )

    try:
        send_approval_decision_email(
            to_email=user["email"],
            to_name=user["display_name"],
            task_title=task_title,
            approved=approved,
            approver_name=approver_name,
            project_name=project_name,
            notes=notes,
        )
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning(f"decision email failed to {user['email']}: {exc}")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/tasks/{task_id}/request-approval")
async def request_approval(
    task_id: str,
    payload: ApprovalRequest,
    pool=Depends(get_pool),
    user=Depends(require_user),
):
    """Move task into approval queue and email all eligible owners."""
    task = await get_task_or_404(pool, task_id)

    if not task['team_id']:
        raise HTTPException(status_code=400, detail="Personal tasks cannot be sent for approval")

    await pool.execute("""
        UPDATE tasks
        SET approval_status = 'pending',
            approval_requested_at = NOW(),
            approval_notes = $1,
            updated_at = NOW()
        WHERE task_id = $2
    """, payload.notes, task_id)

    requester_name = await get_display_name(pool, user['user_id'])
    await notify_approval_owners(
        pool, task_id, task['title'], task['team_id'], requester_name, payload.notes
    )

    return {"message": "Approval requested", "approval_status": "pending"}


@router.post("/tasks/{task_id}/approve")
async def approve_task(
    task_id: str,
    payload: ApprovalRequest,
    pool=Depends(get_pool),
    user=Depends(require_user),
):
    task = await get_task_or_404(pool, task_id)

    if not await is_project_owner_or_admin(pool, task['team_id'], user['user_id']):
        raise HTTPException(status_code=403, detail="Only project owner or admin can approve tasks")

    # Move to next column after 'Approval'
    current_col = await pool.fetchrow(
        "SELECT * FROM project_columns WHERE column_id=$1", task['column_id']
    )
    new_column_id = task['column_id']
    new_status    = 'in_progress'
    if current_col:
        next_col = await pool.fetchrow("""
            SELECT * FROM project_columns
            WHERE team_id=$1 AND sort_order > $2
            ORDER BY sort_order ASC LIMIT 1
        """, task['team_id'], current_col['sort_order'])
        if next_col:
            new_column_id = next_col['column_id']
            new_status = 'done' if next_col['is_done'] else 'in_progress'

    await pool.execute("""
        UPDATE tasks
        SET approval_status    = 'approved',
            approved_by        = $1,
            approval_notes     = $2,
            approval_decided_at = NOW(),
            column_id          = $3,
            status             = $4,
            updated_at         = NOW()
        WHERE task_id = $5
    """, user['user_id'], payload.notes, new_column_id, new_status, task_id)

    approver_name = await get_display_name(pool, user['user_id'])
    if task.get('created_by_user_id'):
        await notify_decision(
            pool, task_id, task['title'],
            task['created_by_user_id'], True, approver_name, payload.notes, task['team_id']
        )

    return {"message": "Task approved", "approval_status": "approved", "new_column_id": new_column_id}


@router.post("/tasks/{task_id}/reject")
async def reject_task(
    task_id: str,
    payload: ApprovalRequest,
    pool=Depends(get_pool),
    user=Depends(require_user),
):
    task = await get_task_or_404(pool, task_id)

    if not await is_project_owner_or_admin(pool, task['team_id'], user['user_id']):
        raise HTTPException(status_code=403, detail="Only project owner or admin can reject tasks")

    if not payload.notes:
        raise HTTPException(status_code=400, detail="Rejection reason is required")

    await pool.execute("""
        UPDATE tasks
        SET approval_status    = 'rejected',
            approved_by        = $1,
            approval_notes     = $2,
            approval_decided_at = NOW(),
            updated_at         = NOW()
        WHERE task_id = $3
    """, user['user_id'], payload.notes, task_id)

    approver_name = await get_display_name(pool, user['user_id'])
    if task.get('created_by_user_id'):
        await notify_decision(
            pool, task_id, task['title'],
            task['created_by_user_id'], False, approver_name, payload.notes, task['team_id']
        )

    return {"message": "Task rejected", "approval_status": "rejected"}


@router.get("/tasks/pending-approval", response_model=List[dict])
async def get_pending_approvals(
    pool=Depends(get_pool),
    user=Depends(require_user),
):
    user_data = await pool.fetchrow("SELECT role FROM users WHERE user_id=$1", user['user_id'])

    if user_data and user_data['role'] == 'admin':
        tasks = await pool.fetch("""
            SELECT t.*,
                   COALESCE(u.full_name, u.name, u.email) AS created_by_name,
                   u.email AS created_by_email,
                   tm.name AS team_name
            FROM tasks t
            JOIN users u ON u.user_id = t.created_by_user_id
            LEFT JOIN teams tm ON tm.team_id = t.team_id
            WHERE t.approval_status = 'pending'
            ORDER BY t.approval_requested_at DESC
        """)
    else:
        tasks = await pool.fetch("""
            SELECT t.*,
                   COALESCE(u.full_name, u.name, u.email) AS created_by_name,
                   u.email AS created_by_email,
                   tm.name AS team_name
            FROM tasks t
            JOIN users u ON u.user_id = t.created_by_user_id
            LEFT JOIN teams tm ON tm.team_id = t.team_id
            JOIN team_members tmem ON tmem.team_id = t.team_id
            WHERE t.approval_status = 'pending'
              AND tmem.user_id = $1
              AND tmem.role IN ('owner','admin')
              AND tmem.status = 'active'
            ORDER BY t.approval_requested_at DESC
        """, user['user_id'])

    return [dict(t) for t in tasks]


# ---------------------------------------------------------------------------
# Client approval endpoints (unchanged logic, display names fixed)
# ---------------------------------------------------------------------------

class ClientApprovalRequest(BaseModel):
    client_email: str
    notes: Optional[str] = None


@router.post("/tasks/{task_id}/request-client-approval")
async def request_client_approval(
    task_id: str,
    payload: ClientApprovalRequest,
    pool=Depends(get_pool),
    user=Depends(require_user),
):
    task   = await get_task_or_404(pool, task_id)
    client = await pool.fetchrow(
        "SELECT user_id, COALESCE(full_name,name,email) AS display_name, email FROM users WHERE email=$1",
        payload.client_email.lower()
    )
    if not client:
        raise HTTPException(status_code=404, detail="Client user not found")

    await pool.execute(
        "INSERT INTO task_clients (id,task_id,user_id,invited_by) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
        f"tc_{uuid.uuid4().hex[:12]}", task_id, client['user_id'], user['user_id']
    )
    await pool.execute("""
        UPDATE tasks
        SET approval_status='pending_client', approval_requested_at=NOW(),
            approval_notes=$1, updated_at=NOW()
        WHERE task_id=$2
    """, payload.notes, task_id)

    requester_name = await get_display_name(pool, user['user_id'])
    project = await pool.fetchrow("SELECT name FROM teams WHERE team_id=$1", task['team_id'])
    project_name = project["name"] if project else "your project"

    from email_service import send_approval_request_email
    try:
        send_approval_request_email(
            to_email=client['email'],
            to_name=client['display_name'],
            task_id=task_id,
            task_title=task['title'],
            requester_name=requester_name,
            project_name=project_name,
            notes=payload.notes,
        )
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning(f"client approval email failed: {exc}")

    return {"message": "Client approval requested", "approval_status": "pending_client"}
