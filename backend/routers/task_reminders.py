"""task_reminders.py — custom due-date reminder dispatch.

Endpoints:
  POST /api/task-reminders/dispatch — cron endpoint (Railway cron should call this every 5 min)

Reminders themselves are created/edited via /api/tasks (create) and
PUT /api/tasks/{task_id}/reminders (server.py) — this router only fires the
ones that are due.

Operational note: this needs a real external scheduler. Add a Railway Cron
Schedule (Project → + New → Cron Schedule) running every 5 minutes with:
    curl -X POST "$BACKEND_URL/api/task-reminders/dispatch?request_secret=$TASK_REMINDER_DISPATCH_SECRET"
Set TASK_REMINDER_DISPATCH_SECRET to a random 32+ char value in both the
backend service and the cron service's env vars. Without this cron, due
reminders sit unsent — the in-app polling loop only catches the legacy
single `tasks.reminder_at` field, not the new task_reminders table.
"""
import logging
import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query

from auth_router import require_admin
from db import get_pool
from utils import now_utc, log_safe as _log_safe
from services.web_push_service import send_web_push
from services.expo_push_service import send_expo_push

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/task-reminders", tags=["task-reminders"])

DISPATCH_SECRET = os.environ.get("TASK_REMINDER_DISPATCH_SECRET", "")
if not DISPATCH_SECRET:
    logger.warning(
        "TASK_REMINDER_DISPATCH_SECRET is not set — dispatch endpoint is protected by admin auth only. "
        "Set this env var in production to add a second layer of protection."
    )


@router.post("/dispatch")
async def dispatch_reminders(
    request_secret: str = Query(""),
    pool = Depends(get_pool),
    _caller = Depends(require_admin),
):
    """Called every few minutes by an external cron. Sends all due task reminders."""
    if DISPATCH_SECRET and request_secret != DISPATCH_SECRET:
        raise HTTPException(403, "Invalid dispatch secret")

    now = now_utc()
    due = await pool.fetch("""
        SELECT tr.reminder_id, tr.task_id, tr.channel_inapp, tr.channel_push, tr.channel_email,
               t.title, t.team_id, t.user_id, t.assignee_user_ids, t.due_at
        FROM task_reminders tr
        JOIN tasks t ON t.task_id = tr.task_id
        WHERE tr.sent_at IS NULL AND tr.fire_at <= $1
          AND t.status != 'done' AND t.archived_at IS NULL
    """, now)

    sent, errors = 0, []
    for r in due:
        try:
            recipients = set(r["assignee_user_ids"] or [])
            if not recipients and r["user_id"]:
                recipients.add(r["user_id"])
            message = f"Due soon: {r['title']}"
            for uid in recipients:
                if r["channel_inapp"] or r["channel_push"]:
                    await pool.execute(
                        "INSERT INTO notifications (notification_id,user_id,team_id,type,title,message,task_id,url) "
                        "VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
                        f"notif_{uuid.uuid4().hex[:12]}", uid, r["team_id"], "reminder",
                        "Task reminder", message, r["task_id"], "/tasks",
                    )
                    if r["channel_push"]:
                        await send_web_push(pool, user_id=uid, title="Task reminder", body=message, url="/tasks")
                        await send_expo_push(pool, user_id=uid, title="Task reminder", body=message, url="/tasks", task_id=r["task_id"])
                if r["channel_email"]:
                    try:
                        from email_service import send_task_reminder_email
                        recipient = await pool.fetchrow("SELECT email,COALESCE(full_name,name) AS name FROM users WHERE user_id=$1", uid)
                        if recipient and recipient["email"]:
                            due_str = r["due_at"].strftime("%b %d, %Y %H:%M UTC") if r["due_at"] else ""
                            send_task_reminder_email(recipient["email"], recipient["name"] or recipient["email"], r["title"], r["task_id"], due_str)
                    except Exception as e:
                        logger.warning("reminder email failed for %s: %s", _log_safe(r["task_id"]), _log_safe(e))
            await pool.execute("UPDATE task_reminders SET sent_at=$1 WHERE reminder_id=$2", now, r["reminder_id"])
            sent += 1
        except Exception as exc:
            logger.error("Reminder dispatch failed for %s: %s", _log_safe(r["reminder_id"]), _log_safe(exc), exc_info=True)
            errors.append(str(r["reminder_id"]))

    return {"ok": True, "dispatched": sent, "errors": errors}
