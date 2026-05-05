"""
automations.py — Automation rules CRUD + manual trigger
Triggers: task_created, status_changed, field_changed, assigned,
          due_date_approaching, task_overdue, comment_added, approval_status_changed
Actions: send_email, send_notification, set_field, change_status, assign_to, post_comment
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime, timezone

from auth_router import require_user
from db import get_pool

router = APIRouter(prefix="/api/automations", tags=["automations"])

VALID_TRIGGERS = {
    "task_created", "status_changed", "field_changed", "assigned",
    "due_date_approaching", "task_overdue", "comment_added", "approval_status_changed"
}
VALID_ACTIONS = {
    "send_email", "send_notification", "set_field",
    "change_status", "assign_to", "post_comment"
}


class AutomationCreate(BaseModel):
    team_id: str
    name: str
    trigger: dict   # {event: str, filters: [...]}
    actions: list   # [{type: str, config: {...}}]
    enabled: bool = True


class AutomationUpdate(BaseModel):
    name: Optional[str] = None
    trigger: Optional[dict] = None
    actions: Optional[list] = None
    enabled: Optional[bool] = None


@router.get("/team/{team_id}")
async def list_automations(team_id: str, pool=Depends(get_pool), user=Depends(require_user)):
    rows = await pool.fetch(
        "SELECT * FROM automations WHERE team_id=$1 ORDER BY created_at DESC",
        team_id
    )
    return [dict(r) for r in rows]


@router.post("/")
async def create_automation(body: AutomationCreate, pool=Depends(get_pool), user=Depends(require_user)):
    if body.trigger.get("event") not in VALID_TRIGGERS:
        raise HTTPException(400, f"trigger.event must be one of {VALID_TRIGGERS}")
    for action in body.actions:
        if action.get("type") not in VALID_ACTIONS:
            raise HTTPException(400, f"action.type must be one of {VALID_ACTIONS}")
    auto_id = f"auto_{uuid.uuid4().hex[:12]}"
    await pool.execute(
        "INSERT INTO automations (automation_id, team_id, name, trigger, actions, enabled, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        auto_id, body.team_id, body.name, body.trigger, body.actions, body.enabled, user["user_id"]
    )
    return {"automation_id": auto_id, **body.dict()}


@router.put("/{automation_id}")
async def update_automation(automation_id: str, body: AutomationUpdate, pool=Depends(get_pool), user=Depends(require_user)):
    updates, vals = [], []
    if body.name is not None:    updates.append(f"name=${len(vals)+2}");    vals.append(body.name)
    if body.trigger is not None: updates.append(f"trigger=${len(vals)+2}"); vals.append(body.trigger)
    if body.actions is not None: updates.append(f"actions=${len(vals)+2}"); vals.append(body.actions)
    if body.enabled is not None: updates.append(f"enabled=${len(vals)+2}"); vals.append(body.enabled)
    if updates:
        await pool.execute(f"UPDATE automations SET {', '.join(updates)} WHERE automation_id=$1", automation_id, *vals)
    return {"ok": True}


@router.delete("/{automation_id}")
async def delete_automation(automation_id: str, pool=Depends(get_pool), user=Depends(require_user)):
    await pool.execute("DELETE FROM automations WHERE automation_id=$1", automation_id)
    return {"ok": True}


@router.post("/{automation_id}/run")
async def run_automation_manually(automation_id: str, context: dict, pool=Depends(get_pool), user=Depends(require_user)):
    """Manually trigger an automation for testing."""
    automation = await pool.fetchrow("SELECT * FROM automations WHERE automation_id=$1", automation_id)
    if not automation:
        raise HTTPException(404, "Automation not found")
    from services.automation_engine import run_automation
    result = await run_automation(dict(automation), context, pool)
    await pool.execute(
        "UPDATE automations SET last_run_at=NOW(), run_count=run_count+1 WHERE automation_id=$1",
        automation_id
    )
    return {"ok": True, "result": result}
