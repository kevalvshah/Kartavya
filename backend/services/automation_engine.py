"""
automation_engine.py — Evaluates automation rules on events.

Usage:
    from services.automation_engine import fire_automations
    await fire_automations(pool, event_type="status_changed", context={"task": task_dict, "from": old_status, "to": new_status})
"""
import asyncio
import logging
from typing import Any

logger = logging.getLogger(__name__)


def _matches_filters(filters: list, context: dict) -> bool:
    """AND-only filter evaluation."""
    for f in filters:
        field = f.get("field")
        op    = f.get("op", "eq")
        want  = f.get("value")
        actual = context.get(field)
        if op == "eq"  and actual != want:  return False
        if op == "neq" and actual == want:  return False
        if op == "in"  and actual not in (want or []): return False
    return True


async def run_automation(automation: dict, context: dict, pool) -> dict:
    """Execute all actions of a single automation. Returns {action_results: [...]}."""
    results = []
    for action in automation.get("actions", []):
        action_type = action.get("type")
        cfg = action.get("config", {})
        try:
            if action_type == "send_email":
                from email_service import send_email
                send_email(cfg.get("to"), cfg.get("subject", "Kartavya notification"), cfg.get("html", ""))
                results.append({"action": action_type, "ok": True})

            elif action_type == "send_notification":
                import uuid
                for uid in (cfg.get("user_ids") or []):
                    await pool.execute(
                        "INSERT INTO notifications (notification_id, user_id, type, title, message, task_id) VALUES ($1,$2,$3,$4,$5,$6)",
                        f"notif_{uuid.uuid4().hex[:12]}", uid,
                        "automation", cfg.get("title", "Automation"),
                        cfg.get("message", ""), context.get("task", {}).get("task_id")
                    )
                results.append({"action": action_type, "ok": True})

            elif action_type == "set_field":
                task_id  = context.get("task", {}).get("task_id")
                field_id = cfg.get("field_id")
                value    = cfg.get("value")
                import json
                await pool.execute(
                    "INSERT INTO field_values (task_id, field_id, value) VALUES ($1,$2,$3::jsonb) ON CONFLICT (task_id,field_id) DO UPDATE SET value=EXCLUDED.value",
                    task_id, field_id, json.dumps(value)
                )
                results.append({"action": action_type, "ok": True})

            elif action_type == "change_status":
                task_id = context.get("task", {}).get("task_id")
                status  = cfg.get("status", "todo")
                await pool.execute("UPDATE tasks SET status=$1, updated_at=NOW() WHERE task_id=$2", status, task_id)
                results.append({"action": action_type, "ok": True})

            elif action_type == "assign_to":
                task_id  = context.get("task", {}).get("task_id")
                user_ids = cfg.get("user_ids", [])
                await pool.execute("UPDATE tasks SET assignee_user_ids=$1, updated_at=NOW() WHERE task_id=$2", user_ids, task_id)
                results.append({"action": action_type, "ok": True})

            elif action_type == "post_comment":
                import uuid
                task_id = context.get("task", {}).get("task_id")
                await pool.execute(
                    "INSERT INTO task_comments (comment_id, task_id, user_id, body) VALUES ($1,$2,'system',$3)",
                    f"cmt_{uuid.uuid4().hex[:12]}", task_id, cfg.get("body", "")
                )
                results.append({"action": action_type, "ok": True})

        except Exception as exc:
            logger.warning("automation action %s failed: %s", action_type, exc)
            results.append({"action": action_type, "ok": False, "error": str(exc)})

    return {"action_results": results}


async def fire_automations(pool, event_type: str, context: dict, _depth: int = 0):
    """
    Called from routers after mutations. Finds matching automations and runs them.
    Non-blocking: swallows all errors.
    _depth guards against infinite recursion when a change_status automation
    triggers another status_changed event (max 3 levels deep).
    """
    if _depth > 3:
        logger.warning("fire_automations: max recursion depth reached, aborting chain")
        return
    try:
        team_id = context.get("team_id") or context.get("task", {}).get("team_id")
        if not team_id:
            return
        automations = await pool.fetch(
            "SELECT * FROM automations WHERE team_id=$1 AND enabled=TRUE",
            team_id
        )
        for auto in automations:
            auto = dict(auto)
            trigger = auto.get("trigger", {})
            if trigger.get("event") != event_type:
                continue
            if not _matches_filters(trigger.get("filters", []), context):
                continue
            asyncio.create_task(run_automation(auto, context, pool))
            await pool.execute(
                "UPDATE automations SET last_run_at=NOW(), run_count=run_count+1 WHERE automation_id=$1",
                auto["automation_id"]
            )
    except Exception as exc:
        logger.warning("fire_automations swallowed: %s", exc)
