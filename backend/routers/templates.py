"""
templates.py — Project and task templates (CRUD + apply)
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import uuid

from auth_router import require_user
from db import get_pool

router = APIRouter(prefix="/api/templates", tags=["templates"])

_TEMPLATE_NOT_FOUND = "Template not found"


class ProjectTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    config: dict  # {columns, fields, sample_tasks}


class TaskTemplateCreate(BaseModel):
    name: str
    team_id: Optional[str] = None
    config: dict  # {title_pattern, description, priority, default_assignees, ...}


@router.get("/projects")
async def list_project_templates(pool=Depends(get_pool), user=Depends(require_user)):
    """Return all available project templates."""
    rows = await pool.fetch("SELECT * FROM project_templates ORDER BY created_at DESC")
    return [dict(r) for r in rows]


@router.post("/projects")
async def create_project_template(body: ProjectTemplateCreate, pool=Depends(get_pool), user=Depends(require_user)):
    """Create a new project template."""
    tid = f"ptmpl_{uuid.uuid4().hex[:10]}"
    import json
    await pool.execute(
        "INSERT INTO project_templates (template_id, name, description, config, created_by) VALUES ($1,$2,$3,$4::jsonb,$5)",
        tid, body.name, body.description, json.dumps(body.config), user["user_id"]
    )
    row = await pool.fetchrow("SELECT * FROM project_templates WHERE template_id=$1", tid)
    return dict(row)


@router.delete("/projects/{template_id}")
async def delete_project_template(template_id: str, pool=Depends(get_pool), user=Depends(require_user)):
    """Delete a project template; only the creator or an admin may do so."""
    tmpl = await pool.fetchrow("SELECT created_by FROM project_templates WHERE template_id=$1", template_id)
    if not tmpl:
        raise HTTPException(404, _TEMPLATE_NOT_FOUND)
    if tmpl["created_by"] != user["user_id"] and user.get("role") != "admin":
        raise HTTPException(403, "Not authorised")
    await pool.execute("DELETE FROM project_templates WHERE template_id=$1", template_id)
    return {"ok": True}


@router.post("/projects/{template_id}/apply")
async def apply_project_template(
    template_id: str, team_id: str,
    pool=Depends(get_pool), user=Depends(require_user)
):
    """Create columns and sample tasks from template into existing team.

    Requires the caller to be an active member or owner of the target team,
    preventing template application into arbitrary third-party projects.
    """
    # Verify the caller belongs to the target team
    if user.get("role") != "admin":
        access = await pool.fetchrow(
            """
            SELECT 1 FROM team_members        WHERE team_id=$1 AND user_id=$2 AND status='active'
            UNION ALL
            SELECT 1 FROM project_assignments WHERE team_id=$1 AND user_id=$2
            LIMIT 1
            """,
            team_id, user["user_id"],
        )
        if not access:
            raise HTTPException(403, "You are not a member of this project")
    tmpl = await pool.fetchrow("SELECT config FROM project_templates WHERE template_id=$1", template_id)
    if not tmpl:
        raise HTTPException(404, _TEMPLATE_NOT_FOUND)
    import json
    cfg = tmpl["config"] if isinstance(tmpl["config"], dict) else json.loads(tmpl["config"])
    created = {"columns": 0, "fields": 0, "tasks": 0}

    for i, col in enumerate(cfg.get("columns", [])):
        col_id = f"col_{uuid.uuid4().hex[:10]}"
        await pool.execute(
            "INSERT INTO project_columns (column_id, team_id, name, color, sort_order, is_done) "
            "VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING",
            col_id, team_id, col["name"], col.get("color", "#0082c6"), i, col.get("is_done", False)
        )
        created["columns"] += 1

    for field_cfg in cfg.get("fields", []):
        fid = f"fld_{uuid.uuid4().hex[:10]}"
        await pool.execute(
            "INSERT INTO field_definitions (field_id, team_id, name, type, config, sort_order) "
            "VALUES ($1,$2,$3,$4,$5::jsonb,$6) ON CONFLICT DO NOTHING",
            fid, team_id, field_cfg["name"], field_cfg["type"],
            json.dumps(field_cfg.get("config", {})), 0
        )
        created["fields"] += 1

    for task_cfg in cfg.get("sample_tasks", []):
        task_id = f"task_{uuid.uuid4().hex[:10]}"
        await pool.execute(
            "INSERT INTO tasks (task_id, team_id, created_by_user_id, title, description, status, priority) "
            "VALUES ($1,$2,$3,$4,$5,'todo','medium')",
            task_id, team_id, user["user_id"],
            task_cfg["title"], task_cfg.get("description", "")
        )
        created["tasks"] += 1

    return {"ok": True, "created": created}


# ── Task templates ───────────────────────────────────────────────────────────────

@router.get("/tasks")
async def list_task_templates(team_id: Optional[str] = None, pool=Depends(get_pool), user=Depends(require_user)):
    """Return all task templates, optionally filtered to include team-specific ones."""
    if team_id:
        rows = await pool.fetch(
            "SELECT * FROM task_templates WHERE team_id=$1 OR team_id IS NULL ORDER BY created_at",
            team_id
        )
    else:
        rows = await pool.fetch("SELECT * FROM task_templates ORDER BY created_at")
    return [dict(r) for r in rows]


@router.post("/tasks")
async def create_task_template(body: TaskTemplateCreate, pool=Depends(get_pool), user=Depends(require_user)):
    """Create a new task template."""
    import json
    tid = f"ttmpl_{uuid.uuid4().hex[:10]}"
    await pool.execute(
        "INSERT INTO task_templates (template_id, team_id, name, config) VALUES ($1,$2,$3,$4::jsonb)",
        tid, body.team_id, body.name, json.dumps(body.config)
    )
    row = await pool.fetchrow("SELECT * FROM task_templates WHERE template_id=$1", tid)
    return dict(row)


@router.delete("/tasks/{template_id}")
async def delete_task_template(template_id: str, pool=Depends(get_pool), user=Depends(require_user)):
    """Delete a task template by ID."""
    tmpl = await pool.fetchrow("SELECT template_id FROM task_templates WHERE template_id=$1", template_id)
    if not tmpl:
        raise HTTPException(404, _TEMPLATE_NOT_FOUND)
    await pool.execute("DELETE FROM task_templates WHERE template_id=$1", template_id)
    return {"ok": True}
