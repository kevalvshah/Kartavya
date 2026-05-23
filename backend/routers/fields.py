"""
fields.py — Custom field definitions and values
GET/POST/PUT/DELETE field_definitions per team
GET/PUT field_values per task
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Any
import uuid
from datetime import datetime, timezone

from auth_router import require_user, require_admin
from db import get_pool

router = APIRouter(prefix="/api/fields", tags=["fields"])

FIELD_TYPES = {
    "text", "textarea", "number", "date",
    "select", "dropdown",          # dropdown is alias for select
    "checkbox",
    "url",
    "person",
    "files",
    "status",
}


class FieldDefCreate(BaseModel):
    team_id: str
    name: str
    type: str
    config: dict = {}
    sort_order: int = 0


class FieldDefUpdate(BaseModel):
    name: Optional[str] = None
    config: Optional[dict] = None
    sort_order: Optional[int] = None


class FieldValueSet(BaseModel):
    field_id: str
    value: Any


import json as _json

def _norm_field(r):
    row = dict(r)
    cfg = row.get("config")
    if isinstance(cfg, str):
        try: row["config"] = _json.loads(cfg)
        except Exception: row["config"] = {}
    elif cfg is None:
        row["config"] = {}
    return row


@router.get("/team/{team_id}")
async def list_field_definitions(team_id: str, pool=Depends(get_pool), user=Depends(require_user)):
    rows = await pool.fetch(
        "SELECT * FROM field_definitions WHERE team_id=$1 ORDER BY sort_order, created_at",
        team_id
    )
    return [_norm_field(r) for r in rows]


@router.post("/")
async def create_field_definition(body: FieldDefCreate, pool=Depends(get_pool), user=Depends(require_user)):
    import json
    if body.type not in FIELD_TYPES:
        raise HTTPException(400, f"type must be one of {FIELD_TYPES}")
    field_id = f"fld_{uuid.uuid4().hex[:12]}"
    await pool.execute(
        "INSERT INTO field_definitions (field_id, team_id, name, type, config, sort_order) VALUES ($1,$2,$3,$4,$5::jsonb,$6)",
        field_id, body.team_id, body.name, body.type, json.dumps(body.config), body.sort_order
    )
    return {"field_id": field_id, **body.dict()}


@router.put("/{field_id}")
async def update_field_definition(field_id: str, body: FieldDefUpdate, pool=Depends(get_pool), user=Depends(require_user)):
    import json
    updates, vals = [], []
    if body.name is not None:       updates.append(f"name=${len(vals)+2}");              vals.append(body.name)
    if body.config is not None:     updates.append(f"config=${len(vals)+2}::jsonb");     vals.append(json.dumps(body.config))
    if body.sort_order is not None: updates.append(f"sort_order=${len(vals)+2}");        vals.append(body.sort_order)
    if not updates:
        return {"ok": True}
    await pool.execute(f"UPDATE field_definitions SET {', '.join(updates)} WHERE field_id=$1", field_id, *vals)
    return {"ok": True}


@router.delete("/{field_id}")
async def delete_field_definition(field_id: str, pool=Depends(get_pool), user=Depends(require_user)):
    await pool.execute("DELETE FROM field_definitions WHERE field_id=$1", field_id)
    return {"ok": True}


@router.get("/task/{task_id}/values")
async def get_task_field_values(task_id: str, pool=Depends(get_pool), user=Depends(require_user)):
    rows = await pool.fetch(
        "SELECT fv.field_id, fv.value, fd.name, fd.type, fd.config FROM field_values fv JOIN field_definitions fd ON fd.field_id=fv.field_id WHERE fv.task_id=$1",
        task_id
    )
    return [dict(r) for r in rows]


@router.put("/task/{task_id}/values")
async def set_task_field_values(task_id: str, body: list[FieldValueSet], pool=Depends(get_pool), user=Depends(require_user)):
    import json
    for fv in body:
        val = json.dumps(fv.value)
        await pool.execute(
            "INSERT INTO field_values (task_id, field_id, value) VALUES ($1,$2,$3::jsonb) ON CONFLICT (task_id, field_id) DO UPDATE SET value=EXCLUDED.value",
            task_id, fv.field_id, val
        )
    # Log activity
    from services.activity_logger import log_event
    await log_event(pool, task_id=task_id, actor_id=user["user_id"], event_type="field_changed", data={"fields": [fv.field_id for fv in body]})
    return {"ok": True}
