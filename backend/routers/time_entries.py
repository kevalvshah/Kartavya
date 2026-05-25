"""
time_entries.py — Time tracking: start/stop timer + manual entries
Fix: activity_logger hooks added to start/stop so the Activity Feed
shows every timer event, as required by the 10x lifecycle test.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime, timezone

from auth_router import require_user
from db import get_pool

router = APIRouter(prefix="/api/time", tags=["time"])


class TimeEntryCreate(BaseModel):
    task_id: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    minutes: Optional[int] = None
    description: Optional[str] = None


@router.get("/task/{task_id}")
async def get_task_time(task_id: str, pool=Depends(get_pool), user=Depends(require_user)):
    rows = await pool.fetch(
        """
        SELECT te.*, COALESCE(u.full_name, u.name) AS user_name
        FROM time_entries te
        LEFT JOIN users u ON u.user_id = te.user_id
        WHERE te.task_id=$1
        ORDER BY te.started_at DESC
        """,
        task_id,
    )
    total = await pool.fetchval(
        "SELECT COALESCE(SUM(minutes),0) FROM time_entries WHERE task_id=$1", task_id
    )
    return {"entries": [dict(r) for r in rows], "total_minutes": total}


@router.post("/start")
async def start_timer(task_id: str, pool=Depends(get_pool), user=Depends(require_user)):
    """Start a running timer. Auto-stops any existing running timer first."""
    if user.get("role") == "client":
        raise HTTPException(403, "Clients cannot log time")
    # Stop existing running timer
    await pool.execute(
        """
        UPDATE time_entries
        SET ended_at=NOW(),
            minutes=GREATEST(1, EXTRACT(EPOCH FROM (NOW()-started_at))::int/60)
        WHERE user_id=$1 AND ended_at IS NULL
        """,
        user["user_id"],
    )
    entry_id = f"te_{uuid.uuid4().hex[:12]}"
    await pool.execute(
        "INSERT INTO time_entries (entry_id, task_id, user_id, started_at) VALUES ($1,$2,$3,NOW())",
        entry_id, task_id, user["user_id"],
    )

    # FIX: log to activity feed
    try:
        from services.activity_logger import log_event
        await log_event(pool, task_id=task_id, actor_id=user["user_id"],
                        event_type="timer_started", data={"entry_id": entry_id})
    except Exception:
        pass

    return {"entry_id": entry_id, "started_at": datetime.now(timezone.utc)}


@router.post("/stop")
async def stop_timer(pool=Depends(get_pool), user=Depends(require_user)):
    """Stop the currently running timer."""
    row = await pool.fetchrow(
        "SELECT entry_id, task_id, started_at FROM time_entries WHERE user_id=$1 AND ended_at IS NULL",
        user["user_id"],
    )
    if not row:
        raise HTTPException(404, "No running timer")

    mins = max(1, int((datetime.now(timezone.utc) - row["started_at"]).total_seconds() / 60))
    await pool.execute(
        "UPDATE time_entries SET ended_at=NOW(), minutes=$1 WHERE entry_id=$2",
        mins, row["entry_id"],
    )

    # FIX: log to activity feed
    try:
        from services.activity_logger import log_event
        await log_event(pool, task_id=row["task_id"], actor_id=user["user_id"],
                        event_type="timer_stopped", data={"entry_id": row["entry_id"], "minutes": mins})
    except Exception:
        pass

    return {"entry_id": row["entry_id"], "task_id": row["task_id"], "minutes": mins}


@router.post("/manual")
async def add_manual_entry(body: TimeEntryCreate, pool=Depends(get_pool), user=Depends(require_user)):
    if user.get("role") == "client":
        raise HTTPException(403, "Clients cannot log time")
    entry_id = f"te_{uuid.uuid4().hex[:12]}"
    mins = body.minutes
    if mins is None and body.ended_at:
        mins = max(1, int((body.ended_at - body.started_at).total_seconds() / 60))
    await pool.execute(
        """INSERT INTO time_entries
           (entry_id, task_id, user_id, started_at, ended_at, minutes, description)
           VALUES ($1,$2,$3,$4,$5,$6,$7)""",
        entry_id, body.task_id, user["user_id"],
        body.started_at, body.ended_at, mins, body.description,
    )
    try:
        from services.activity_logger import log_event
        await log_event(pool, task_id=body.task_id, actor_id=user["user_id"],
                        event_type="time_logged", data={"minutes": mins, "manual": True})
    except Exception:
        pass
    return {"entry_id": entry_id, "minutes": mins}


@router.delete("/{entry_id}")
async def delete_time_entry(entry_id: str, pool=Depends(get_pool), user=Depends(require_user)):
    await pool.execute(
        "DELETE FROM time_entries WHERE entry_id=$1 AND user_id=$2", entry_id, user["user_id"]
    )
    return {"ok": True}


@router.get("/report")
async def time_report(
    team_id: Optional[str] = None,
    user_id_filter: Optional[str] = None,
    pool=Depends(get_pool),
    user=Depends(require_user),
):
    """
    Admin sees all users; member/client see only their own entries unless
    they are a project owner and supply user_id_filter.
    """
    user_data = await pool.fetchrow("SELECT role FROM users WHERE user_id=$1", user["user_id"])
    is_admin  = user_data and user_data["role"] == "admin"

    filters, vals = ["te.ended_at IS NOT NULL"], []

    if team_id:
        filters.append(f"tk.team_id=${len(vals)+1}")
        vals.append(team_id)

    # Non-admins can only see their own entries unless they are a team owner
    if not is_admin:
        target_user = user_id_filter or user["user_id"]
        if user_id_filter and user_id_filter != user["user_id"]:
            # Verify caller is at least a project owner
            if team_id:
                owner = await pool.fetchrow(
                    "SELECT 1 FROM project_assignments WHERE team_id=$1 AND user_id=$2 AND role IN ('owner','admin')",
                    team_id, user["user_id"]
                )
                if not owner:
                    target_user = user["user_id"]  # silently fall back
            else:
                target_user = user["user_id"]
        filters.append(f"te.user_id=${len(vals)+1}")
        vals.append(target_user)

    where = " AND ".join(filters)
    rows = await pool.fetch(f"""
        SELECT te.entry_id, te.task_id, tk.title AS task_title,
               te.started_at, te.ended_at, te.minutes, te.description,
               COALESCE(u.full_name, u.name) AS user_name
        FROM   time_entries te
        JOIN   tasks tk ON tk.task_id = te.task_id
        LEFT JOIN users u ON u.user_id = te.user_id
        WHERE  {where}
        ORDER  BY te.started_at DESC
        LIMIT  500
    """, *vals)
    total = sum(r["minutes"] or 0 for r in rows)
    return {"entries": [dict(r) for r in rows], "total_minutes": total}
