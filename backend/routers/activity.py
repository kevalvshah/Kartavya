"""
activity.py — Activity feed read endpoints
"""
from fastapi import APIRouter, Depends, Query
from typing import Optional

from auth_router import require_user
from db import get_pool

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
    if actor_id:    filters.append(f"actor_id=${len(vals)+1}");    vals.append(actor_id)
    if event_type:  filters.append(f"type=${len(vals)+1}");        vals.append(event_type)
    where = " AND ".join(filters)
    rows = await pool.fetch(f"""
        SELECT ae.*,
               COALESCE(u.full_name, u.name, u.email) AS actor_name,
               t.title AS task_title
        FROM activity_events ae
        LEFT JOIN users u ON u.user_id = ae.actor_id
        LEFT JOIN tasks t ON t.task_id = ae.task_id
        WHERE {where}
        ORDER BY ae.created_at DESC
        LIMIT ${ len(vals)+1 } OFFSET ${ len(vals)+2 }
    """, *vals, limit, offset)
    return [dict(r) for r in rows]


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
    return [dict(r) for r in rows]
