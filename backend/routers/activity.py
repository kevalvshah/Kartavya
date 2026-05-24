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
        logger.error(f"Activity fetch failed for {team_id}: {exc}", exc_info=True)
        raise HTTPException(500, f"Activity error: {exc}") from exc


@router.get("/task/{task_id}")
async def task_activity(
    task_id: str,
    limit: int = Query(100, le=500),
    pool=Depends(get_pool),
    user=Depends(require_user),
):
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
