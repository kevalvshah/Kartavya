"""
activity_logger.py — Write activity events on every mutation.
Call log_event() from any router after a successful DB write.
"""
import uuid
from typing import Optional


async def log_event(
    pool,
    *,
    task_id: Optional[str] = None,
    team_id: Optional[str] = None,
    actor_id: str,
    event_type: str,
    data: dict = None,
):
    """
    Persist an activity event. team_id is resolved from the task if not provided.
    Silently swallows errors — logging must never crash the main request.
    """
    try:
        resolved_team_id = team_id
        if not resolved_team_id and task_id:
            row = await pool.fetchrow("SELECT team_id FROM tasks WHERE task_id=$1", task_id)
            if row:
                resolved_team_id = row["team_id"]

        event_id = f"evt_{uuid.uuid4().hex[:14]}"
        await pool.execute(
            """
            INSERT INTO activity_events (event_id, task_id, team_id, actor_id, type, data)
            VALUES ($1, $2, $3, $4, $5, $6)
            """,
            event_id,
            task_id,
            resolved_team_id,
            actor_id,
            event_type,
            data or {},
        )
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning(f"activity_logger swallowed error: {exc}")
