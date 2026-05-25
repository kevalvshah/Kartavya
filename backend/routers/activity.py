"""
activity.py — Activity feed read endpoints
BUG FIX: removed spaces inside f-string braces for LIMIT/OFFSET params
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
import json

from auth_router import require_user
from db import get_pool

logger = logging.getLogger(__name__)


def _normalize(rows):
    """Deserialize the 'data' JSONB field in each activity row from string to dict."""
    result = []
    for r in rows:
        row = dict(r)
        d = row.get("data")
        if isinstance(d, str):
            try:
                row["data"] = json.loads(d)
            except Exception:
                row["data"] = {}
        result.append(row)
    return result

router = APIRouter(prefix="/api/activity", tags=["activity"])


@router.get("/team/{team_id}")
async def team_activity(
    team_id: str,
    limit: int = Query(50, le=200),
    offset: int = 0,
    actor_id: Optional[str] = None,
    event_type: Optional[str] = None,
    pool=Depends(get_pool),
    user=Depends(require_user),
):
    """Return paginated activity events for a team, with optional actor and type filters."""
    # Enforce team visibility: admin sees all; others must be a member or assignee
    if user.get("role") != "admin":
        try:
            access = await pool.fetchrow(
                """
                SELECT 1 FROM team_members WHERE team_id=$1 AND user_id=$2 AND status='active'
                LIMIT 1
                """,
                team_id, user["user_id"],
            )
        except Exception as exc:
            logger.error("team_members check failed: %s", exc)
            access = None
        if not access:
            raise HTTPException(403, "Access denied")
    filters, vals = ["team_id=$1"], [team_id]
    if actor_id:   filters.append(f"actor_id=${len(vals)+1}"); vals.append(actor_id)
    if event_type: filters.append(f"type=${len(vals)+1}");     vals.append(event_type)
    where = " AND ".join(filters)
    limit_idx  = len(vals) + 1
    offset_idx = len(vals) + 2
    try:
        rows = await pool.fetch(f"""
            SELECT ae.*,
                   COALESCE(u.full_name, u.name, u.email) AS actor_name,
                   t.title AS task_title
            FROM activity_events ae
            LEFT JOIN users u ON u.user_id = ae.actor_id
            LEFT JOIN tasks t ON t.task_id = ae.task_id
            WHERE {where}
            ORDER BY ae.created_at DESC
            LIMIT ${limit_idx} OFFSET ${offset_idx}
        """, *vals, limit, offset)
        return _normalize(rows)
    except Exception as exc:
        # Gracefully return empty list if table doesn't exist yet (first deploy)
        if "activity_events" in str(exc) and "does not exist" in str(exc):
            logger.warning("activity_events table missing, returning empty: %s", exc)
            return []
        logger.error("Activity fetch failed for %s: %s", team_id, exc, exc_info=True)
        raise HTTPException(500, "Activity fetch error") from exc


@router.get("/task/{task_id}")
async def task_activity(
    task_id: str,
    limit: int = Query(100, le=500),
    pool=Depends(get_pool),
    user=Depends(require_user),
):
    """Return all activity events for a specific task, newest first."""
    # Enforce task visibility: caller must belong to the task's project
    if user.get("role") != "admin":
        task_team = await pool.fetchrow(
            "SELECT team_id FROM tasks WHERE task_id=$1", task_id
        )
        if not task_team:
            raise HTTPException(404, "Task not found")
        access = await pool.fetchrow(
            """
            SELECT 1 FROM team_members        WHERE team_id=$1 AND user_id=$2 AND status='active'
            UNION ALL
            SELECT 1 FROM project_assignments WHERE team_id=$1 AND user_id=$2
            LIMIT 1
            """,
            task_team["team_id"], user["user_id"],
        )
        if not access:
            raise HTTPException(403, "Access denied")
    rows = await pool.fetch("""
        SELECT ae.*,
               COALESCE(u.full_name, u.name, u.email) AS actor_name
        FROM activity_events ae
        LEFT JOIN users u ON u.user_id = ae.actor_id
        WHERE ae.task_id=$1
        ORDER BY ae.created_at DESC
        LIMIT $2
    """, task_id, limit)
    return _normalize(rows)
