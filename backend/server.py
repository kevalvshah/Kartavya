"""
server.py — Kartavya API v2 by Aekam Inc
Monolith routes stay; new v2 routers mounted at the bottom.
R2 upload router replaces the old base64 /api/upload endpoint.

Bug fixes (2026-05-14):
  FIX #4: get_visible_team_ids now UNIONs team_members so users who
          were invited and registered after the invite (no project_assignments
          row) can still see their teams.
  FIX #5: update_team_member guards the project_assignments role UPDATE
          with `if payload.role` to avoid writing NULL when only status
          is being changed.
"""

import asyncio
import base64
import json
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import asyncpg
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, UploadFile, File
from pydantic import BaseModel, ConfigDict, Field
from starlette.middleware.cors import CORSMiddleware

from auth_router import require_user, require_admin
from auth_router import router as auth_router
from invite_router import router as invite_router
from approvals_router import router as approvals_router
from db import close_pool, get_pool
from health import router as health_router

# ── v2 routers ────────────────────────────────────────────
from routers.fields      import router as fields_router
from routers.views       import router as views_router
from routers.automations import router as automations_router
from routers.activity    import router as activity_router
from routers.dashboards  import router as dashboards_router
from routers.templates   import router as templates_router
from routers.time_entries import router as time_router
from routers.uploads     import router as uploads_router   # R2-backed upload
from routers.reports     import router as reports_router
from services.gita       import get_verse_of_the_day

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# Per-request team_ids cache: keyed by user_id, cleared after each request via middleware.
_team_ids_request_cache: dict = {}

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

app = FastAPI(title="Kartavya API v2", description="Team task management by Aekam Inc")
api_router = APIRouter(prefix="/api")

# ── CORS ──────────────────────────────────────────
DEFAULT_ORIGINS = [
    "https://kartavya-aekam.vercel.app",
    "https://kartavya-kevalvshah03-6145s-projects.vercel.app",
    "https://kartavya-git-main-kevalvshah03-6145s-projects.vercel.app",
    "https://kartavya-git-v2-plan-kevalvshah03-6145s-projects.vercel.app",
    "http://localhost:3000",
    "http://localhost:8080",
]
_extra = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
ALLOWED_ORIGINS = list(dict.fromkeys(DEFAULT_ORIGINS + _extra))

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://kartavya.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def clear_request_cache(request, call_next):
    _team_ids_request_cache.clear()
    return await call_next(request)



# ── Helpers ───────────────────────────────────────────────────

def now_utc(): return datetime.now(timezone.utc)

def parse_dt(value):
    if not value: return None
    try:
        dt = datetime.fromisoformat(value)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid datetime: {value}") from e
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)

async def get_db(): return await get_pool()

async def get_visible_team_ids(pool, user_id, role=None, _user_dict=None):
    """Return team IDs visible to user_id.

    Caches result in _team_ids_request_cache for the duration of a request.
    FIX #4: UNIONs team_members so users invited before registering still see teams.
    """
    cached = _team_ids_request_cache.get(user_id)
    if cached is not None:
        return cached

    effective_role = role or (_user_dict and _user_dict.get("role"))
    if effective_role != "admin":
        user_row = await pool.fetchrow("SELECT role FROM users WHERE user_id=$1", user_id)
        effective_role = user_row.get("role") if user_row else None

    if effective_role == "admin":
        all_teams = await pool.fetch("SELECT team_id FROM teams")
        result = [r["team_id"] for r in all_teams]
    else:
        rows = await pool.fetch(
            """
            SELECT team_id FROM project_assignments WHERE user_id=$1
            UNION
            SELECT team_id FROM team_members WHERE user_id=$1 AND status='active'
            """,
            user_id,
        )
        result = [r["team_id"] for r in rows]

    _team_ids_request_cache[user_id] = result
    return result

async def is_project_member(pool, team_id: str, user: dict) -> dict | None:
    """Return membership record (or a synthetic one for admins) or None."""
    if user.get("role") in ("admin", "owner"):
        return {"role": "admin"}
    return await pool.fetchrow(
        "SELECT role FROM project_assignments WHERE team_id=$1 AND user_id=$2",
        team_id, user["user_id"]
    )

async def normalize_orders(pool, scope_col, scope_val, column_id):
    rows = await pool.fetch(
        f"SELECT task_id FROM tasks WHERE {scope_col}=$1 AND column_id=$2 ORDER BY sort_order ASC, updated_at ASC",
        scope_val, column_id,
    )
    for idx, row in enumerate(rows):
        await pool.execute(
            "UPDATE tasks SET sort_order=$1, updated_at=NOW() WHERE task_id=$2 AND sort_order!=$1",
            idx, row["task_id"],
        )

async def create_notification(pool, user_id, notif_type, title, message, task_id=None, team_id=None, url=None):
    await pool.execute(
        "INSERT INTO notifications (notification_id,user_id,team_id,type,title,message,task_id,url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        f"notif_{uuid.uuid4().hex[:12]}", user_id, team_id, notif_type, title, message, task_id, url,
    )

async def ensure_default_columns(pool, team_id):
    existing = await pool.fetchval("SELECT COUNT(*) FROM project_columns WHERE team_id=$1", team_id)
    if existing == 0:
        defaults = [
            ("To Do","#0082c6",0,False),("In Progress","#03a1b6",1,False),
            ("In Review","#8b5cf6",2,False),("Approval","#f59e0b",3,False),("Done","#05b7aa",4,True),
        ]
        for name,color,order,is_done in defaults:
            await pool.execute(
                "INSERT INTO project_columns (column_id,team_id,name,color,sort_order,is_done) VALUES ($1,$2,$3,$4,$5,$6)",
                f"col_{uuid.uuid4().hex[:12]}",team_id,name,color,order,is_done,
            )

async def client_can_access_task(pool, task_id, user_id):
    """Returns True if a client user can access this task."""
    row = await pool.fetchrow("SELECT team_id, created_by_user_id, assignee_user_ids FROM tasks WHERE task_id=$1", task_id)
    if not row: return False
    if row["created_by_user_id"] == user_id: return True
    if user_id in (row["assignee_user_ids"] or []): return True
    if row["team_id"]:
        pa = await pool.fetchrow("SELECT 1 FROM project_assignments WHERE team_id=$1 AND user_id=$2", row["team_id"], user_id)
        if pa: return True
    tc = await pool.fetchrow("SELECT 1 FROM task_clients WHERE task_id=$1 AND user_id=$2", task_id, user_id)
    return bool(tc)


# ── Models ─────────────────────────────────────────────
class ProjectColumnCreate(BaseModel):
    name:str; color:str="#0082c6"; is_done:bool=False
class ProjectColumnUpdate(BaseModel):
    name:Optional[str]=None; color:Optional[str]=None; is_done:Optional[bool]=None; sort_order:Optional[int]=None
class ProjectColumnOut(BaseModel):
    column_id:str; team_id:str; name:str; color:str; sort_order:int; is_done:bool; created_at:datetime
class CategoryCreate(BaseModel):
    name:str; color:str="#0082c6"
class CategoryOut(BaseModel):
    category_id:str; user_id:str; name:str; color:str; created_at:datetime; updated_at:datetime
class TeamCreate(BaseModel):
    name:str
class TeamOut(BaseModel):
    team_id:str; name:str; created_by:str; created_at:datetime; updated_at:datetime
class TeamMemberAdd(BaseModel):
    email:str; role:str="member"
class TeamMemberUpdate(BaseModel):
    role:Optional[str]=None; status:Optional[str]=None
class TeamMemberOut(BaseModel):
    member_id:str; team_id:str; email:str; user_id:Optional[str]=None; role:str; status:str; created_at:datetime; updated_at:datetime
class Attachment(BaseModel):
    name:str; url:str; key:Optional[str]=None
class Subtask(BaseModel):
    subtask_id:str=Field(default_factory=lambda:f"sub_{uuid.uuid4().hex[:12]}"); title:str; is_done:bool=False; order:int=0
class Recurrence(BaseModel):
    rule:str="none"; interval:int=1
class TaskCreate(BaseModel):
    title:str; description:Optional[str]=None; status:str="todo"; column_id:Optional[str]=None
    priority:str="medium"; category_id:Optional[str]=None; tags:List[str]=[]; team_id:Optional[str]=None
    assignee_user_ids:List[str]=[]; assignee_emails:List[str]=[]; due_at:Optional[str]=None
    reminder_at:Optional[str]=None; recurrence:Recurrence=Field(default_factory=Recurrence)
    estimated_minutes:Optional[int]=None; attachments:List[Attachment]=[]
    custom_fields:Dict[str,Any]={}; subtasks:List[Subtask]=[]
class TaskUpdate(BaseModel):
    title:Optional[str]=None; description:Optional[str]=None; status:Optional[str]=None
    column_id:Optional[str]=None; priority:Optional[str]=None; category_id:Optional[str]=None
    tags:Optional[List[str]]=None; team_id:Optional[str]=None; assignee_user_ids:Optional[List[str]]=None
    assignee_emails:Optional[List[str]]=None; due_at:Optional[str]=None; reminder_at:Optional[str]=None
    recurrence:Optional[Recurrence]=None; estimated_minutes:Optional[int]=None
    attachments:Optional[List[Attachment]]=None; custom_fields:Optional[Dict[str,Any]]=None
    subtasks:Optional[List[Subtask]]=None; approval_status:Optional[str]=None
class TaskOut(BaseModel):
    task_id:str; user_id:Optional[str]=None; team_id:Optional[str]=None; column_id:Optional[str]=None
    created_by_user_id:str; assigned_by_user_id:Optional[str]=None; completed_by_user_id:Optional[str]=None
    title:str; description:Optional[str]=None; status:str; priority:str; category_id:Optional[str]=None
    tags:List[str]=[]; assignee_user_ids:List[str]=[]; assignee_emails:List[str]=[]
    due_at:Optional[datetime]=None; reminder_at:Optional[datetime]=None; reminder_sent_at:Optional[datetime]=None
    recurrence:Recurrence=Field(default_factory=Recurrence); estimated_minutes:Optional[int]=None
    attachments:List[Attachment]=[]; custom_fields:Dict[str,Any]={}; subtasks:List[Subtask]=[]
    order:int=0; created_at:datetime; updated_at:datetime; completed_at:Optional[datetime]=None
    approval_status:Optional[str]=None; approval_notes:Optional[str]=None; approved_by:Optional[str]=None
    approval_requested_at:Optional[datetime]=None; approval_decided_at:Optional[datetime]=None
    requires_approval:bool=False; created_by_name:Optional[str]=None
class TaskMoveIn(BaseModel):
    column_id:str; order:int
class CommentCreate(BaseModel):
    body:str=Field(...,min_length=1,max_length=4000)
class CommentOut(BaseModel):
    comment_id:str; task_id:str; user_id:str; user_name:str; body:str; created_at:datetime
class DashboardSummaryOut(BaseModel):
    todo:int; in_progress:int; done:int; overdue:int; due_24h:int
class PushSubscriptionIn(BaseModel):
    model_config=ConfigDict(extra="ignore"); endpoint:str; keys:Dict[str,str]
class NotificationOut(BaseModel):
    notification_id:str; user_id:str; team_id:Optional[str]=None; type:str; title:str; message:str
    task_id:Optional[str]=None; url:Optional[str]=None; created_at:datetime; read_at:Optional[datetime]=None
class MarkReadIn(BaseModel):
    notification_ids:List[str]=[]; mark_all:bool=False


def row_to_task(r) -> TaskOut:
    def pj(v,d):
        if isinstance(v,str): return json.loads(v)
        return v if v is not None else d
    def col(key,default=None):
        try:
            if key in r: return r[key]
        except (KeyError,TypeError): pass
        return default
    return TaskOut(
        task_id=r["task_id"],user_id=r["user_id"],team_id=r["team_id"],column_id=r.get("column_id"),
        created_by_user_id=r["created_by_user_id"],assigned_by_user_id=r["assigned_by_user_id"],
        completed_by_user_id=r["completed_by_user_id"],title=r["title"],description=r["description"],
        status=r["status"],priority=r["priority"],category_id=r["category_id"],
        tags=list(r["tags"] or []),assignee_user_ids=list(r["assignee_user_ids"] or []),
        assignee_emails=list(r["assignee_emails"] or []),
        due_at=r["due_at"],reminder_at=r["reminder_at"],reminder_sent_at=r["reminder_sent_at"],
        recurrence=Recurrence(rule=r["recurrence_rule"] or "none",interval=r["recurrence_interval"] or 1),
        estimated_minutes=r["estimated_minutes"],
        attachments=[Attachment(**a) for a in pj(r["attachments"],[])],
        custom_fields=pj(r["custom_fields"],{}),
        subtasks=[Subtask(**s) for s in pj(r["subtasks"],[])],
        order=r["sort_order"] or 0,created_at=r["created_at"],updated_at=r["updated_at"],
        completed_at=r["completed_at"],
        approval_status=col("approval_status"),approval_notes=col("approval_notes"),
        approved_by=col("approved_by"),approval_requested_at=col("approval_requested_at"),
        approval_decided_at=col("approval_decided_at"),requires_approval=bool(col("requires_approval",False)),
        created_by_name=col("created_by_name"),
    )


# ── Routes ─────────────────────────────────────────────

@api_router.get("/")
async def root(): return {"message":"Kartavya API v2","by":"Aekam Inc","status":"ok"}

@api_router.get("/auth/me")
async def me(user=Depends(require_user)):
    return {"user_id":user["user_id"],"email":user["email"],"name":user.get("full_name") or user["name"],
            "full_name":user.get("full_name") or user["name"],"role":user.get("role","member"),
            "position":user.get("position"),"company_name":user.get("company_name"),
            "member_role":user.get("member_role"),"picture":user.get("avatar"),
            "receives_approval_emails":user.get("receives_approval_emails",True)}

@api_router.post("/auth/logout")
async def logout(): return {"ok":True}


@api_router.get("/projects/{team_id}/columns",response_model=List[ProjectColumnOut])
async def list_columns(team_id:str,pool=Depends(get_db),user=Depends(require_user)):
    mem=await is_project_member(pool,team_id,user)
    if not mem: raise HTTPException(403,"Not a project member")
    await ensure_default_columns(pool,team_id)
    rows=await pool.fetch("SELECT * FROM project_columns WHERE team_id=$1 ORDER BY sort_order ASC",team_id)
    return [ProjectColumnOut(**dict(r)) for r in rows]

@api_router.post("/projects/{team_id}/columns",response_model=ProjectColumnOut)
async def create_column(team_id:str,payload:ProjectColumnCreate,pool=Depends(get_db),user=Depends(require_user)):
    mem=await is_project_member(pool,team_id,user)
    if not mem or mem["role"] not in ("owner","admin"): raise HTTPException(403,"Owner or admin required")
    max_order=await pool.fetchval("SELECT COALESCE(MAX(sort_order),-1) FROM project_columns WHERE team_id=$1",team_id)
    column_id=f"col_{uuid.uuid4().hex[:12]}"
    row=await pool.fetchrow("INSERT INTO project_columns (column_id,team_id,name,color,sort_order,is_done) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
        column_id,team_id,payload.name.strip(),payload.color,max_order+1,payload.is_done)
    return ProjectColumnOut(**dict(row))

@api_router.put("/projects/{team_id}/columns/{column_id}",response_model=ProjectColumnOut)
async def update_column(team_id:str,column_id:str,payload:ProjectColumnUpdate,pool=Depends(get_db),user=Depends(require_user)):
    mem=await is_project_member(pool,team_id,user)
    if not mem or mem["role"] not in ("owner","admin"): raise HTTPException(403)
    updates,vals=[],[]
    if payload.name is not None:       updates.append(f"name=${len(vals)+1}");       vals.append(payload.name.strip())
    if payload.color is not None:      updates.append(f"color=${len(vals)+1}");      vals.append(payload.color)
    if payload.is_done is not None:    updates.append(f"is_done=${len(vals)+1}");    vals.append(payload.is_done)
    if payload.sort_order is not None: updates.append(f"sort_order=${len(vals)+1}"); vals.append(payload.sort_order)
    if not updates: raise HTTPException(400,"Nothing to update")
    updates.append(f"updated_at=${len(vals)+1}"); vals.append(now_utc()); vals+=[team_id,column_id]
    row=await pool.fetchrow(f"UPDATE project_columns SET {', '.join(updates)} WHERE team_id=${len(vals)-1} AND column_id=${len(vals)} RETURNING *",*vals)
    if not row: raise HTTPException(404)
    return ProjectColumnOut(**dict(row))

@api_router.delete("/projects/{team_id}/columns/{column_id}")
async def delete_column(team_id:str,column_id:str,pool=Depends(get_db),user=Depends(require_user)):
    mem=await is_project_member(pool,team_id,user)
    if not mem or mem["role"] not in ("owner","admin"): raise HTTPException(403)
    remaining=await pool.fetchval("SELECT COUNT(*) FROM project_columns WHERE team_id=$1",team_id)
    if remaining<=1: raise HTTPException(400,"Cannot delete the last column")
    first_col=await pool.fetchrow("SELECT column_id FROM project_columns WHERE team_id=$1 AND column_id!=$2 ORDER BY sort_order ASC LIMIT 1",team_id,column_id)
    if first_col: await pool.execute("UPDATE tasks SET column_id=$1 WHERE column_id=$2",first_col["column_id"],column_id)
    await pool.execute("DELETE FROM project_columns WHERE team_id=$1 AND column_id=$2",team_id,column_id)
    return {"ok":True}

@api_router.post("/projects/{team_id}/columns/reorder")
async def reorder_columns(team_id:str,body:dict,pool=Depends(get_db),user=Depends(require_user)):
    mem=await is_project_member(pool,team_id,user)
    if not mem or mem["role"] not in ("owner","admin"): raise HTTPException(403)
    for idx,cid in enumerate(body.get("ordered_ids",[])):
        await pool.execute("UPDATE project_columns SET sort_order=$1 WHERE column_id=$2 AND team_id=$3",idx,cid,team_id)
    return {"ok":True}

# ── Client-scoped endpoints ──────────────────────────────────────────

@api_router.get("/client/tasks",response_model=List[TaskOut])
async def client_tasks(pool=Depends(get_db),user=Depends(require_user)):
    rows=await pool.fetch("""
        SELECT t.* FROM tasks t
        WHERE t.created_by_user_id=$1
           OR $1=ANY(t.assignee_user_ids)
           OR EXISTS(SELECT 1 FROM project_assignments pa WHERE pa.team_id=t.team_id AND pa.user_id=$1)
           OR EXISTS(SELECT 1 FROM task_clients tc WHERE tc.task_id=t.task_id AND tc.user_id=$1)
        ORDER BY t.updated_at DESC
    """, user["user_id"])
    return [row_to_task(r) for r in rows]

@api_router.get("/client/projects")
async def client_projects(pool=Depends(get_db),user=Depends(require_user)):
    rows=await pool.fetch("SELECT t.* FROM teams t JOIN project_assignments pa ON pa.team_id=t.team_id WHERE pa.user_id=$1 ORDER BY t.created_at DESC",user["user_id"])
    return [dict(r) for r in rows]

@api_router.get("/client/approvals")
async def client_approvals(pool=Depends(get_db), user=Depends(require_user)):
    uid = user["user_id"]
    approval_rows = await pool.fetch("""
        SELECT a.*,
               COALESCE(u.full_name, u.name, u.email) AS requested_by_name,
               u.email                                AS requested_by_email
        FROM   approvals a
        JOIN   users u ON u.user_id = a.requested_by
        WHERE  a.status = 'pending'
          AND  EXISTS (
                 SELECT 1 FROM project_assignments
                 WHERE  team_id = a.team_id AND user_id = $1
               )
        ORDER BY a.created_at DESC
    """, uid)
    task_rows = await pool.fetch("""
        SELECT
            CONCAT('task_approval::', t.task_id)              AS approval_id,
            t.task_id,
            t.title                                            AS task_title,
            t.approval_status,
            t.team_id,
            COALESCE(u.full_name, u.name, u.email)            AS requested_by_name,
            u.email                                           AS requested_by_email,
            t.approval_requested_at                           AS created_at,
            jsonb_build_object(
                'title',       t.title,
                'description', t.description
            )                                                  AS request_data
        FROM   tasks t
        JOIN   users u ON u.user_id = t.created_by_user_id
        WHERE  t.approval_status = 'pending_client'
          AND  (
               EXISTS (SELECT 1 FROM project_assignments WHERE team_id = t.team_id AND user_id = $1)
            OR EXISTS (SELECT 1 FROM task_clients WHERE task_id = t.task_id AND user_id = $1)
          )
        ORDER BY t.approval_requested_at DESC NULLS LAST
    """, uid)
    return [dict(r) for r in approval_rows] + [dict(r) for r in task_rows]

@api_router.post("/tasks/{task_id}/clients/{target_user_id}")
async def add_client_to_task(task_id:str,target_user_id:str,pool=Depends(get_db),user=Depends(require_admin)):
    await pool.execute("INSERT INTO task_clients (id,task_id,user_id,invited_by) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING",f"tc_{uuid.uuid4().hex[:12]}",task_id,target_user_id,user["user_id"])
    return {"ok":True}

@api_router.delete("/tasks/{task_id}/clients/{target_user_id}")
async def remove_client_from_task(task_id:str,target_user_id:str,pool=Depends(get_db),user=Depends(require_admin)):
    await pool.execute("DELETE FROM task_clients WHERE task_id=$1 AND user_id=$2",task_id,target_user_id)
    return {"ok":True}

@api_router.post("/client/tasks/request", response_model=TaskOut)
async def client_request_task(payload:TaskCreate,pool=Depends(get_db),user=Depends(require_user)):
    if not payload.team_id: raise HTTPException(400,"team_id required")
    assignment=await pool.fetchrow("SELECT role FROM project_assignments WHERE team_id=$1 AND user_id=$2",payload.team_id,user["user_id"])
    if not assignment: raise HTTPException(403,"Not a project member")
    # Create approval record first
    approval_id=f"approval_{uuid.uuid4().hex[:12]}"
    await pool.execute("INSERT INTO approvals (approval_id,team_id,requested_by,status,request_type,request_data) VALUES ($1,$2,$3,'pending','create',$4)",
        approval_id,payload.team_id,user["user_id"],json.dumps(payload.model_dump()))
    # Create actual task with status='requested' so it appears on the board
    first_col=await pool.fetchrow("SELECT column_id FROM project_columns WHERE team_id=$1 ORDER BY sort_order ASC LIMIT 1",payload.team_id)
    column_id=first_col["column_id"] if first_col else None
    max_row=await pool.fetchrow("SELECT MAX(sort_order) AS mo FROM tasks WHERE team_id=$1 AND column_id=$2",payload.team_id,column_id)
    next_order=(max_row["mo"] or -1)+1; task_id=f"task_{uuid.uuid4().hex[:12]}"
    actor_name=user.get("full_name") or user.get("name") or user.get("email","")
    row=await pool.fetchrow("""
        INSERT INTO tasks (task_id,team_id,column_id,created_by_user_id,created_by_name,
            title,description,status,priority,approval_id,attachments,custom_fields,subtasks,sort_order)
        VALUES ($1,$2,$3,$4,$5,$6,$7,'requested',$8,$9,'[]'::jsonb,'{}' ::jsonb,'[]'::jsonb,$10)
        RETURNING *""",
        task_id,payload.team_id,column_id,user["user_id"],actor_name,
        payload.title,payload.description,payload.priority or "medium",approval_id,next_order)
    # Link approval to task
    await pool.execute("UPDATE approvals SET request_data=$1 WHERE approval_id=$2",
        json.dumps({**payload.model_dump(),"task_id":task_id}),approval_id)
    return row_to_task(row)

# ── Approvals ───────────────────────────────────────────────────

@api_router.get("/approvals/pending")
async def list_pending_approvals(pool=Depends(get_db),user=Depends(require_user)):
    uid = user["user_id"]
    # Standard approvals table records (task creation requests)
    rows = await pool.fetch("""
        SELECT a.*, COALESCE(u.full_name,u.name,u.email) AS requester_name,
               u.email AS requested_by_email
        FROM approvals a JOIN users u ON u.user_id=a.requested_by WHERE a.status='pending'
        AND EXISTS(SELECT 1 FROM project_assignments WHERE team_id=a.team_id AND user_id=$1 AND role IN('owner','admin'))
        ORDER BY a.created_at DESC
    """, uid)
    # Task-level approvals (approval_status='pending')
    task_rows = await pool.fetch("""
        SELECT
            CONCAT('task_approval::', t.task_id) AS approval_id,
            t.task_id,
            t.title AS task_title,
            t.approval_notes AS notes,
            t.approval_requested_at AS created_at,
            t.team_id,
            t.priority,
            t.due_at AS task_due_at,
            COALESCE(u.full_name, u.name, u.email) AS requester_name,
            u.email AS requested_by_email,
            'task_completion' AS request_type,
            jsonb_build_object('title', t.title, 'description', t.description, 'priority', t.priority) AS request_data
        FROM tasks t
        JOIN users u ON u.user_id = t.created_by_user_id
        WHERE t.approval_status = 'pending'
        AND (
            EXISTS (SELECT 1 FROM project_assignments pa WHERE pa.team_id=t.team_id AND pa.user_id=$1 AND pa.role IN ('owner','admin'))
            OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id=t.team_id AND tm.user_id=$1 AND tm.role IN ('owner','admin') AND tm.status='active')
        )
        ORDER BY t.approval_requested_at DESC NULLS LAST
    """, uid)
    return [dict(r) for r in rows] + [dict(r) for r in task_rows]

@api_router.get("/approvals/history")
async def approval_history(pool=Depends(get_db), user=Depends(require_user)):
    uid = user["user_id"]
    task_rows = await pool.fetch("""
        SELECT
            CONCAT('task_approval::', t.task_id) AS approval_id,
            t.task_id,
            t.title AS task_title,
            t.approval_status AS status,
            t.approval_notes AS notes,
            t.approval_decided_at AS updated_at,
            COALESCE(u.full_name, u.name, u.email) AS requester_name
        FROM tasks t
        JOIN users u ON u.user_id = t.created_by_user_id
        WHERE t.approval_status IN ('approved','rejected')
        AND t.approval_decided_at IS NOT NULL
        AND (
            EXISTS (SELECT 1 FROM project_assignments pa WHERE pa.team_id=t.team_id AND pa.user_id=$1 AND pa.role IN ('owner','admin'))
            OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id=t.team_id AND tm.user_id=$1 AND tm.role IN ('owner','admin') AND tm.status='active')
        )
        ORDER BY t.approval_decided_at DESC NULLS LAST
        LIMIT 50
    """, uid)
    return [dict(r) for r in task_rows]

@api_router.post("/approvals/{approval_id}/review")
async def review_approval(approval_id:str,body:dict,pool=Depends(get_db),user=Depends(require_user)):
    status=body.get("status"); notes=body.get("notes","")
    send_to_client = body.get("send_to_client", False)
    client_email   = body.get("client_email", "")
    if status not in ("approved","rejected"): raise HTTPException(400,"status must be approved or rejected")
    if approval_id.startswith("task_approval::"):
        task_id = approval_id.split("::", 1)[1]
        # Must be owner/admin of the project
        task = await pool.fetchrow("SELECT * FROM tasks WHERE task_id=$1", task_id)
        if not task: raise HTTPException(404, "Task not found")
        is_pa = await pool.fetchrow(
            "SELECT 1 FROM project_assignments WHERE team_id=$1 AND user_id=$2 AND role IN ('owner','admin')",
            task["team_id"], user["user_id"]
        )
        is_tm = await pool.fetchrow(
            "SELECT 1 FROM team_members WHERE team_id=$1 AND user_id=$2 AND role IN ('owner','admin') AND status='active'",
            task["team_id"], user["user_id"]
        )
        user_data = await pool.fetchrow("SELECT role FROM users WHERE user_id=$1", user["user_id"])
        is_admin = user_data and user_data["role"] == "admin"
        if not (is_pa or is_tm or is_admin):
            raise HTTPException(403, "Only project owner/admin can review task approvals")

        if status == "rejected":
            if not notes: raise HTTPException(400, "Rejection reason is required")
            await pool.execute(
                "UPDATE tasks SET approval_status='rejected', approved_by=$1, approval_notes=$2, approval_decided_at=NOW(), updated_at=NOW() WHERE task_id=$3",
                user["user_id"], notes, task_id
            )
            if task["created_by_user_id"] and task["created_by_user_id"] != user["user_id"]:
                await create_notification(pool, task["created_by_user_id"], "rejected",
                    f"Task rejected: {task['title']}", notes or "",
                    task_id, task["team_id"], "/tasks")
            return {"ok": True, "status": "rejected"}

        # Approved — send to client or move to done
        if send_to_client and client_email:
            client = await pool.fetchrow(
                "SELECT user_id, COALESCE(full_name,name) AS name FROM users WHERE LOWER(email)=$1",
                client_email.lower()
            )
            if not client: raise HTTPException(404, "Client user not found with that email")
            # Link client to task
            await pool.execute(
                "INSERT INTO task_clients (id,task_id,user_id,invited_by) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING",
                f"tc_{uuid.uuid4().hex[:12]}", task_id, client["user_id"], user["user_id"]
            )
            # Generate magic-link token
            import jwt as _jwt
            token = _jwt.encode(
                {"task_id": task_id, "client_user_id": client["user_id"], "type": "client_approval",
                 "exp": datetime.now(timezone.utc).timestamp() + 86400 * 7},
                os.environ["JWT_SECRET"], algorithm="HS256"
            )
            await pool.execute("""
                UPDATE tasks SET approval_status='pending_client', approval_requested_at=NOW(),
                    approval_notes=$1, updated_at=NOW() WHERE task_id=$2
            """, notes, task_id)
            # Send client approval email
            try:
                from email_service import send_approval_request_email
                approver_name = user.get("full_name") or user.get("name") or user.get("email", "Team")
                send_approval_request_email(
                    client_email, client["name"] or client_email,
                    approver_name, task["title"], task_id,
                    notes=notes, approve_token=token
                )
            except Exception as exc:
                import logging; logging.getLogger(__name__).warning(f"client approval email failed: {exc}")
            return {"ok": True, "status": "pending_client"}
        else:
            # Move to done column
            done_col = await pool.fetchrow(
                "SELECT column_id FROM project_columns WHERE team_id=$1 AND is_done=TRUE ORDER BY sort_order DESC LIMIT 1",
                task["team_id"]
            )
            new_col_id = done_col["column_id"] if done_col else task["column_id"]
            await pool.execute("""
                UPDATE tasks SET approval_status='approved', approved_by=$1, approval_notes=$2,
                    approval_decided_at=NOW(), column_id=$3, status='done',
                    completed_at=NOW(), completed_by_user_id=$1, updated_at=NOW()
                WHERE task_id=$4
            """, user["user_id"], notes, new_col_id, task_id)
            if task["created_by_user_id"] and task["created_by_user_id"] != user["user_id"]:
                await create_notification(pool, task["created_by_user_id"], "approved",
                    f"Task approved: {task['title']}", notes or "",
                    task_id, task["team_id"], "/tasks")
            return {"ok": True, "status": "approved", "new_column_id": new_col_id}
    approval=await pool.fetchrow("SELECT * FROM approvals WHERE approval_id=$1",approval_id)
    if not approval: raise HTTPException(404)
    mem=await pool.fetchrow("SELECT role FROM project_assignments WHERE team_id=$1 AND user_id=$2",approval["team_id"],user["user_id"])
    user_data=await pool.fetchrow("SELECT role FROM users WHERE user_id=$1",user["user_id"])
    is_owner_admin = mem and mem["role"] in ("owner","admin")
    is_system_admin = user_data and user_data["role"] == "admin"
    is_client_member = bool(mem)
    if not (is_owner_admin or is_system_admin or is_client_member):
        raise HTTPException(403, "Not authorised to review this approval")
    await pool.execute("UPDATE approvals SET status=$1,reviewed_by=$2,reviewed_at=NOW(),review_notes=$3 WHERE approval_id=$4",status,user["user_id"],notes,approval_id)
    if approval["request_type"]=="create":
        data=json.loads(approval["request_data"])
        existing_task_id=data.get("task_id")
        if status=="approved":
            if existing_task_id:
                # Task already exists with status='requested' — promote to 'todo'
                first_col=await pool.fetchrow("SELECT column_id FROM project_columns WHERE team_id=$1 ORDER BY sort_order LIMIT 1",approval["team_id"])
                col=first_col["column_id"] if first_col else None
                await pool.execute("UPDATE tasks SET status='todo',column_id=COALESCE($1,column_id),updated_at=NOW() WHERE task_id=$2",col,existing_task_id)
            else:
                # Legacy: no task yet — create it
                task_id=f"task_{uuid.uuid4().hex[:12]}"
                col=await pool.fetchval("SELECT column_id FROM project_columns WHERE team_id=$1 ORDER BY sort_order LIMIT 1",approval["team_id"])
                await pool.execute("INSERT INTO tasks (task_id,team_id,column_id,created_by_user_id,title,description,status,priority,approval_id) VALUES ($1,$2,$3,$4,$5,$6,'todo',$7,$8)",
                    task_id,approval["team_id"],col,approval["requested_by"],data["title"],data.get("description"),data.get("priority","medium"),approval_id)
        elif status=="rejected" and existing_task_id:
            # Remove the 'requested' task since it was declined
            await pool.execute("DELETE FROM tasks WHERE task_id=$1 AND status='requested'",existing_task_id)
    return {"ok":True,"status":status}

# ── Comments ────────────────────────────────────────────────────

@api_router.get("/tasks/{task_id}/comments",response_model=List[CommentOut])
async def list_comments(task_id:str,pool=Depends(get_db),user=Depends(require_user)):
    if user.get("role")=="client":
        if not await client_can_access_task(pool, task_id, user["user_id"]):
            raise HTTPException(403, "Not authorised to view comments on this task")
    rows=await pool.fetch("SELECT c.comment_id,c.task_id,c.user_id,COALESCE(u.full_name,u.name) AS user_name,c.body,c.created_at FROM task_comments c JOIN users u ON u.user_id=c.user_id WHERE c.task_id=$1 ORDER BY c.created_at ASC",task_id)
    return [CommentOut(**dict(r)) for r in rows]

@api_router.post("/tasks/{task_id}/comments",response_model=CommentOut)
async def add_comment(task_id:str,body:CommentCreate,pool=Depends(get_db),user=Depends(require_user)):
    if user.get("role")=="client":
        if not await client_can_access_task(pool, task_id, user["user_id"]):
            raise HTTPException(403, "Not authorised to comment on this task")
    comment_id=f"cmt_{uuid.uuid4().hex[:12]}"
    row=await pool.fetchrow("INSERT INTO task_comments (comment_id,task_id,user_id,body) VALUES ($1,$2,$3,$4) RETURNING *",comment_id,task_id,user["user_id"],body.body)
    try:
        task=await pool.fetchrow("SELECT title,team_id,created_by_user_id,assignee_user_ids FROM tasks WHERE task_id=$1",task_id)
        if task:
            recipients=set()
            if task["created_by_user_id"] and task["created_by_user_id"]!=user["user_id"]: recipients.add(task["created_by_user_id"])
            for uid in (task["assignee_user_ids"] or []):
                if uid!=user["user_id"]: recipients.add(uid)
            cr=await pool.fetch("SELECT user_id FROM task_clients WHERE task_id=$1",task_id)
            for c in cr:
                if c["user_id"]!=user["user_id"]: recipients.add(c["user_id"])
            preview=body.body[:140]+("…" if len(body.body)>140 else "")
            actor_name=user.get("full_name") or user.get("name") or user.get("email","")
            for rid in recipients:
                await create_notification(pool,rid,"comment",f"New comment on {task['title']}",f"{actor_name}: {preview}",task_id,task["team_id"],"/tasks")
            from services.mentions import process_mentions
            await process_mentions(pool,comment_id,body.body,task_id,user["user_id"])
            from services.activity_logger import log_event
            await log_event(pool,task_id=task_id,actor_id=user["user_id"],event_type="commented",data={"preview":preview[:80]})
    except Exception as e:
        logger.warning(f"comment fan-out failed: {e}")
    actor_name=user.get("full_name") or user.get("name") or user.get("email","")
    return CommentOut(comment_id=row["comment_id"],task_id=row["task_id"],user_id=row["user_id"],user_name=actor_name,body=row["body"],created_at=row["created_at"])

# ── Teams ────────────────────────────────────────────────────────

@api_router.get("/teams",response_model=List[TeamOut])
async def list_teams(pool=Depends(get_db),user=Depends(require_user)):
    team_ids=await get_visible_team_ids(pool,user["user_id"])
    if not team_ids: return []
    rows=await pool.fetch("SELECT * FROM teams WHERE team_id=ANY($1::text[]) ORDER BY updated_at DESC",team_ids)
    return [TeamOut(**dict(r)) for r in rows]

@api_router.post("/teams",response_model=TeamOut)
async def create_team(payload:TeamCreate,pool=Depends(get_db),user=Depends(require_user)):
    team_id=f"team_{uuid.uuid4().hex[:12]}"
    row=await pool.fetchrow("INSERT INTO teams (team_id,name,created_by) VALUES ($1,$2,$3) RETURNING *",team_id,payload.name,user["user_id"])
    await pool.execute("INSERT INTO team_members (member_id,team_id,email,user_id,role,status) VALUES ($1,$2,$3,$4,'owner','active')",f"mem_{uuid.uuid4().hex[:12]}",team_id,user["email"],user["user_id"])
    await pool.execute("INSERT INTO project_assignments (assignment_id,team_id,user_id,role,assigned_by) VALUES ($1,$2,$3,'owner',$4)",f"assign_{uuid.uuid4().hex[:12]}",team_id,user["user_id"],user["user_id"])
    await ensure_default_columns(pool,team_id)
    return TeamOut(**dict(row))

@api_router.get("/users")
async def list_users(pool=Depends(get_db),user=Depends(require_user)):
    """Return all registered users — for admin member picker."""
    if user.get("role") not in ("admin","owner"):
        raise HTTPException(403,"Admins only")
    rows=await pool.fetch(
        "SELECT user_id,COALESCE(full_name,name,email) AS display_name,email,role,company_name FROM users ORDER BY display_name ASC"
    )
    return [dict(r) for r in rows]

@api_router.get("/teams/{team_id}")
async def get_team(team_id:str,pool=Depends(get_db),user=Depends(require_user)):
    # Check project_assignments first, fall back to team_members
    mem=await pool.fetchrow("SELECT role FROM project_assignments WHERE team_id=$1 AND user_id=$2",team_id,user["user_id"])
    if not mem:
        tm=await pool.fetchrow("SELECT role FROM team_members WHERE team_id=$1 AND user_id=$2 AND status='active'",team_id,user["user_id"])
        if not tm: raise HTTPException(403,"Not a team member")
        mem=tm
    team=await pool.fetchrow("SELECT * FROM teams WHERE team_id=$1",team_id)
    members=await pool.fetch("""
        SELECT tm.*,COALESCE(u.full_name,u.name,u.email) AS display_name,
               u.position,u.company_name,u.member_role,u.receives_approval_emails
        FROM team_members tm LEFT JOIN users u ON u.user_id=tm.user_id
        WHERE tm.team_id=$1 ORDER BY tm.created_at ASC""",team_id)
    return {"team":dict(team),"members":[dict(m) for m in members],"your_role":mem["role"]}

@api_router.get("/teams/{team_id}/clients")
async def list_team_clients(team_id:str,pool=Depends(get_db),user=Depends(require_user)):
    """Returns users with role='client' in the team — for the send-to-client dropdown."""
    mem=await is_project_member(pool,team_id,user)
    if not mem: raise HTTPException(403,"Not a team member")
    rows=await pool.fetch("""
        SELECT tm.user_id, COALESCE(u.full_name,u.name,u.email) AS display_name, u.email
        FROM team_members tm
        LEFT JOIN users u ON u.user_id=tm.user_id
        WHERE tm.team_id=$1 AND tm.status='active' AND tm.user_id IS NOT NULL
          AND tm.role='client'
        ORDER BY display_name ASC
    """,team_id)
    return [dict(r) for r in rows]

@api_router.get("/teams/{team_id}/members")
async def list_team_members(team_id:str,pool=Depends(get_db),user=Depends(require_user)):
    """Returns member list for @mention autocomplete. Accessible to all project members incl. clients."""
    mem=await is_project_member(pool,team_id,user)
    if not mem: raise HTTPException(403,"Not a team member")
    rows=await pool.fetch("""
        SELECT tm.user_id, COALESCE(u.full_name,u.name,u.email) AS display_name, u.email
        FROM team_members tm
        LEFT JOIN users u ON u.user_id=tm.user_id
        WHERE tm.team_id=$1 AND tm.status='active' AND tm.user_id IS NOT NULL
        ORDER BY display_name ASC
    """,team_id)
    return [dict(r) for r in rows]

@api_router.post("/teams/{team_id}/members",response_model=TeamMemberOut)
async def add_team_member(team_id:str,payload:TeamMemberAdd,pool=Depends(get_db),user=Depends(require_user)):
    mem=await pool.fetchrow("SELECT role FROM project_assignments WHERE team_id=$1 AND user_id=$2",team_id,user["user_id"])
    if not mem or mem["role"] not in ("owner","admin"): raise HTTPException(403)
    email=payload.email.strip().lower()
    existing_user=await pool.fetchrow("SELECT user_id FROM users WHERE email=$1",email)
    uid=existing_user["user_id"] if existing_user else None
    await pool.execute("DELETE FROM team_members WHERE team_id=$1 AND email=$2",team_id,email)
    if uid: await pool.execute("DELETE FROM project_assignments WHERE team_id=$1 AND user_id=$2",team_id,uid)
    row=await pool.fetchrow("INSERT INTO team_members (member_id,team_id,email,user_id,role,status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
        f"mem_{uuid.uuid4().hex[:12]}",team_id,email,uid,payload.role,"active" if uid else "invited")
    if uid: await pool.execute("INSERT INTO project_assignments (assignment_id,team_id,user_id,role,assigned_by) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (team_id,user_id) DO UPDATE SET role=EXCLUDED.role",
        f"assign_{uuid.uuid4().hex[:12]}",team_id,uid,payload.role,user["user_id"])
    return TeamMemberOut(**dict(row))

@api_router.put("/teams/{team_id}/members/{member_id}",response_model=TeamMemberOut)
async def update_team_member(team_id:str,member_id:str,payload:TeamMemberUpdate,pool=Depends(get_db),user=Depends(require_user)):
    mem=await pool.fetchrow("SELECT role FROM project_assignments WHERE team_id=$1 AND user_id=$2",team_id,user["user_id"])
    if not mem or mem["role"] not in ("owner","admin"): raise HTTPException(403)
    updates,vals=[],[]
    if payload.role:   updates.append(f"role=${len(vals)+1}");   vals.append(payload.role)
    if payload.status: updates.append(f"status=${len(vals)+1}"); vals.append(payload.status)
    updates.append(f"updated_at=${len(vals)+1}"); vals.append(now_utc()); vals+=[team_id,member_id]
    row=await pool.fetchrow(f"UPDATE team_members SET {', '.join(updates)} WHERE team_id=${len(vals)-1} AND member_id=${len(vals)} RETURNING *",*vals)
    if not row: raise HTTPException(404)
    # FIX #5: only sync project_assignments role when a role was actually provided.
    # Without this guard a status-only PATCH would write None/NULL into role.
    if payload.role and row["user_id"]:
        await pool.execute("UPDATE project_assignments SET role=$1 WHERE team_id=$2 AND user_id=$3",payload.role,team_id,row["user_id"])
    return TeamMemberOut(**dict(row))

@api_router.delete("/teams/{team_id}/members/{member_id}")
async def remove_team_member(team_id:str,member_id:str,pool=Depends(get_db),user=Depends(require_user)):
    mem=await pool.fetchrow("SELECT role FROM project_assignments WHERE team_id=$1 AND user_id=$2",team_id,user["user_id"])
    if not mem or mem["role"] not in ("owner","admin"): raise HTTPException(403)
    member=await pool.fetchrow("SELECT user_id FROM team_members WHERE team_id=$1 AND member_id=$2",team_id,member_id)
    await pool.execute("DELETE FROM team_members WHERE team_id=$1 AND member_id=$2",team_id,member_id)
    if member and member["user_id"]: await pool.execute("DELETE FROM project_assignments WHERE team_id=$1 AND user_id=$2",team_id,member["user_id"])
    return {"ok":True}

# ── Categories ───────────────────────────────────────────────────

@api_router.get("/categories",response_model=List[CategoryOut])
async def list_categories(pool=Depends(get_db),user=Depends(require_user)):
    return [CategoryOut(**dict(r)) for r in await pool.fetch("SELECT * FROM categories WHERE user_id=$1 ORDER BY updated_at DESC",user["user_id"])]

@api_router.post("/categories",response_model=CategoryOut)
async def create_category(payload:CategoryCreate,pool=Depends(get_db),user=Depends(require_user)):
    row=await pool.fetchrow("INSERT INTO categories (category_id,user_id,name,color) VALUES ($1,$2,$3,$4) RETURNING *",f"cat_{uuid.uuid4().hex[:12]}",user["user_id"],payload.name,payload.color)
    return CategoryOut(**dict(row))

@api_router.delete("/categories/{category_id}")
async def delete_category(category_id:str,pool=Depends(get_db),user=Depends(require_user)):
    await pool.execute("UPDATE tasks SET category_id=NULL,updated_at=NOW() WHERE user_id=$1 AND category_id=$2",user["user_id"],category_id)
    await pool.execute("DELETE FROM categories WHERE user_id=$1 AND category_id=$2",user["user_id"],category_id)
    return {"ok":True}

# ── Tasks ────────────────────────────────────────────────────────

@api_router.get("/tasks",response_model=List[TaskOut])
async def list_tasks(status:Optional[str]=None,category_id:Optional[str]=None,q:Optional[str]=None,
                     team_id:Optional[str]=None,assigned_to_me:Optional[bool]=None,
                     pool=Depends(get_db),user=Depends(require_user)):
    team_ids=await get_visible_team_ids(pool,user["user_id"],_user_dict=user)
    conditions=["(t.user_id=$1 OR t.team_id=ANY($2::text[])"
                " OR t.created_by_user_id=$1"
                " OR EXISTS(SELECT 1 FROM task_clients tc WHERE tc.task_id=t.task_id AND tc.user_id=$1))"]
    vals=[user["user_id"],team_ids]
    if team_id:        conditions.append(f"t.team_id=${len(vals)+1}");       vals.append(team_id)
    if status:         conditions.append(f"t.status=${len(vals)+1}");         vals.append(status)
    if category_id:    conditions.append(f"t.category_id=${len(vals)+1}");   vals.append(category_id)
    if q:              conditions.append(f"t.title ILIKE ${len(vals)+1}");    vals.append(f"%{q}%")
    if assigned_to_me: conditions.append(f"${len(vals)+1}=ANY(t.assignee_user_ids)"); vals.append(user["user_id"])
    rows=await pool.fetch(f"SELECT t.*,COALESCE(u.full_name,u.name,u.email) AS created_by_name FROM tasks t LEFT JOIN users u ON u.user_id=t.created_by_user_id WHERE {' AND '.join(conditions)} ORDER BY t.sort_order ASC",*vals)
    return [row_to_task(r) for r in rows]


@api_router.post("/tasks",response_model=TaskOut)
async def create_task(payload:TaskCreate,pool=Depends(get_db),user=Depends(require_user)):
    if payload.team_id:
        mem=await is_project_member(pool,payload.team_id,user)
        if not mem: raise HTTPException(403)
        user_id_field,scope_col,scope_val=None,"team_id",payload.team_id
    else:
        user_id_field,scope_col,scope_val=user["user_id"],"user_id",user["user_id"]
    column_id=payload.column_id
    if not column_id and payload.team_id:
        first_col=await pool.fetchrow("SELECT column_id FROM project_columns WHERE team_id=$1 ORDER BY sort_order ASC LIMIT 1",payload.team_id)
        column_id=first_col["column_id"] if first_col else None
    status=payload.status or "todo"
    if column_id:
        col=await pool.fetchrow("SELECT is_done FROM project_columns WHERE column_id=$1",column_id)
        if col and col["is_done"]: status="done"
    due_dt=parse_dt(payload.due_at)
    reminder_dt=parse_dt(payload.reminder_at) or (due_dt-timedelta(hours=2) if due_dt else None)
    max_row=await pool.fetchrow(f"SELECT MAX(sort_order) AS mo FROM tasks WHERE {scope_col}=$1 AND column_id=$2",scope_val,column_id)
    next_order=(max_row["mo"] or -1)+1; task_id=f"task_{uuid.uuid4().hex[:12]}"
    actor_name=user.get("full_name") or user.get("name") or user.get("email","")
    row=await pool.fetchrow("""
        INSERT INTO tasks (task_id,user_id,team_id,column_id,created_by_user_id,assigned_by_user_id,
           created_by_name,title,description,status,priority,category_id,tags,assignee_user_ids,assignee_emails,
           due_at,reminder_at,recurrence_rule,recurrence_interval,estimated_minutes,attachments,custom_fields,subtasks,sort_order)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::text[],$14::text[],$15::text[],
                $16,$17,$18,$19,$20,$21::jsonb,$22::jsonb,$23::jsonb,$24)
        RETURNING *""",
        task_id,user_id_field,payload.team_id,column_id,user["user_id"],
        user["user_id"] if (payload.assignee_user_ids or payload.assignee_emails) else None,
        actor_name,payload.title,payload.description,status,payload.priority,payload.category_id,
        payload.tags or [],payload.assignee_user_ids or [],
        [e.strip().lower() for e in payload.assignee_emails if e.strip()],
        due_dt,reminder_dt,payload.recurrence.rule,payload.recurrence.interval,payload.estimated_minutes,
        json.dumps([a.model_dump() for a in payload.attachments or []]),
        json.dumps(payload.custom_fields or {}),json.dumps([s.model_dump() for s in payload.subtasks or []]),next_order)
    team_name=None
    if payload.team_id:
        tr=await pool.fetchrow("SELECT name FROM teams WHERE team_id=$1",payload.team_id)
        team_name=tr["name"] if tr else None
    for uid in set(payload.assignee_user_ids or []):
        if uid==user["user_id"]: continue
        await create_notification(pool,uid,"assigned","Task assigned",f"You were assigned: {payload.title}",task_id,payload.team_id,"/tasks")
        try:
            from email_service import send_task_assignment_email
            assignee=await pool.fetchrow("SELECT email,COALESCE(full_name,name) AS name FROM users WHERE user_id=$1",uid)
            if assignee: send_task_assignment_email(assignee["email"],assignee["name"] or assignee["email"],payload.title,task_id,team_name)
        except Exception as e:
            logger.warning(f"assignment email failed: {e}")
    from services.activity_logger import log_event
    await log_event(pool,task_id=task_id,team_id=payload.team_id,actor_id=user["user_id"],event_type="created",data={"title":payload.title})
    from services.automation_engine import fire_automations
    asyncio.create_task(fire_automations(pool,"task_created",{"task":{"task_id":task_id,"team_id":payload.team_id},"team_id":payload.team_id}))
    return row_to_task(row)


@api_router.get("/tasks/{task_id}",response_model=TaskOut)
async def get_task(task_id:str,pool=Depends(get_db),user=Depends(require_user)):
    row=await pool.fetchrow("SELECT t.*,COALESCE(u.full_name,u.name,u.email) AS created_by_name FROM tasks t LEFT JOIN users u ON u.user_id=t.created_by_user_id WHERE t.task_id=$1",task_id)
    if not row: raise HTTPException(404)
    if user.get("role")=="admin": return row_to_task(row)
    if row["created_by_user_id"]==user["user_id"]: return row_to_task(row)
    if user["user_id"] in (row["assignee_user_ids"] or []): return row_to_task(row)
    if row["team_id"]:
        team_ids=await get_visible_team_ids(pool,user["user_id"],_user_dict=user)
        if row["team_id"] in team_ids: return row_to_task(row)
    client_link=await pool.fetchrow("SELECT 1 FROM task_clients WHERE task_id=$1 AND user_id=$2",task_id,user["user_id"])
    if client_link: return row_to_task(row)
    raise HTTPException(403,"Not authorized")


@api_router.put("/tasks/{task_id}",response_model=TaskOut)
async def update_task(task_id:str,payload:TaskUpdate,pool=Depends(get_db),user=Depends(require_user)):
    team_ids=await get_visible_team_ids(pool,user["user_id"],_user_dict=user)
    existing=await pool.fetchrow(
        "SELECT * FROM tasks WHERE task_id=$1 AND (user_id=$2 OR team_id=ANY($3::text[]) OR created_by_user_id=$2)",
        task_id,user["user_id"],team_ids
    )
    if not existing:
        if await client_can_access_task(pool, task_id, user["user_id"]):
            existing = await pool.fetchrow("SELECT * FROM tasks WHERE task_id=$1", task_id)
        if not existing: raise HTTPException(404)
    data=payload.model_dump(exclude_unset=True); updates,vals=[],[]
    old_status=existing["status"]; old_assignees=list(existing.get("assignee_user_ids") or [])
    for k in ["title","description","status","priority","category_id","estimated_minutes","column_id","approval_status"]:
        if k in data: updates.append(f"{k}=${len(vals)+1}"); vals.append(data[k])
    if "approval_status" in data and data["approval_status"] in ("approved","rejected"):
        updates.append(f"approved_by=${len(vals)+1}"); vals.append(user["user_id"])
        updates.append(f"approval_decided_at=${len(vals)+1}"); vals.append(now_utc())
    for k in ["tags","assignee_user_ids","assignee_emails"]:
        if k in data: updates.append(f"{k}=${len(vals)+1}::text[]"); vals.append(data[k])
    for k in ["attachments","custom_fields","subtasks"]:
        if k in data and data[k] is not None:
            updates.append(f"{k}=${len(vals)+1}::jsonb")
            v=data[k]; vals.append(json.dumps([i.model_dump() if hasattr(i,'model_dump') else i for i in v] if isinstance(v,list) else v))
    if "due_at" in data:      updates.append(f"due_at=${len(vals)+1}");      vals.append(parse_dt(data["due_at"]))
    if "reminder_at" in data: updates.append(f"reminder_at=${len(vals)+1}"); vals.append(parse_dt(data["reminder_at"]))
    if "recurrence" in data and data["recurrence"]:
        rec=data["recurrence"]
        updates.append(f"recurrence_rule=${len(vals)+1}");     vals.append(rec.get("rule","none") if isinstance(rec,dict) else rec.rule)
        updates.append(f"recurrence_interval=${len(vals)+1}"); vals.append(rec.get("interval",1) if isinstance(rec,dict) else rec.interval)
    if "column_id" in data and data["column_id"]:
        col=await pool.fetchrow("SELECT is_done FROM project_columns WHERE column_id=$1",data["column_id"])
        if col and col["is_done"] and "status" not in data: updates.append(f"status=${len(vals)+1}"); vals.append("done")
    if not updates: return row_to_task(existing)
    updates.append(f"updated_at=${len(vals)+1}"); vals.append(now_utc()); vals.append(task_id)
    row=await pool.fetchrow(f"UPDATE tasks SET {', '.join(updates)} WHERE task_id=${len(vals)} RETURNING *",*vals)
    new_status=row["status"]; new_assignees=list(row.get("assignee_user_ids") or [])
    from services.activity_logger import log_event, log_assigned
    if old_status!=new_status:
        await log_event(pool,task_id=task_id,actor_id=user["user_id"],event_type="status_changed",data={"from":old_status,"to":new_status})
        from services.automation_engine import fire_automations
        asyncio.create_task(fire_automations(pool,"status_changed",{"task":{"task_id":task_id,"team_id":existing["team_id"]},"team_id":existing["team_id"],"from":old_status,"to":new_status}))
    if "assignee_user_ids" in data:
        added=[u for u in new_assignees if u not in old_assignees]
        removed=[u for u in old_assignees if u not in new_assignees]
        if added or removed:
            await log_assigned(pool,task_id=task_id,actor_id=user["user_id"],added=added,removed=removed)
    return row_to_task(row)


@api_router.patch("/tasks/{task_id}",response_model=TaskOut)
async def patch_task(task_id:str,payload:TaskUpdate,pool=Depends(get_db),user=Depends(require_user)):
    """PATCH alias used by the client 'Mark as Reviewed' CTA."""
    return await update_task(task_id, payload, pool, user)


@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id:str,pool=Depends(get_db),user=Depends(require_user)):
    team_ids=await get_visible_team_ids(pool,user["user_id"],_user_dict=user)
    doc=await pool.fetchrow(
        "SELECT * FROM tasks WHERE task_id=$1 AND (user_id=$2 OR team_id=ANY($3::text[]) OR created_by_user_id=$2)",
        task_id,user["user_id"],team_ids
    )
    if not doc: raise HTTPException(404)
    await pool.execute("DELETE FROM tasks WHERE task_id=$1",task_id)
    return {"ok":True}

@api_router.patch("/tasks/{task_id}/toggle",response_model=TaskOut)
async def toggle_task(task_id:str,pool=Depends(get_db),user=Depends(require_user)):
    team_ids=await get_visible_team_ids(pool,user["user_id"],_user_dict=user)
    doc=await pool.fetchrow("SELECT * FROM tasks WHERE task_id=$1 AND (user_id=$2 OR team_id=ANY($3::text[]))",task_id,user["user_id"],team_ids)
    if not doc: raise HTTPException(404)
    new_status="todo" if doc["status"]=="done" else "done"
    row=await pool.fetchrow("UPDATE tasks SET status=$1,completed_at=$2,completed_by_user_id=$3,updated_at=NOW() WHERE task_id=$4 RETURNING *",
        new_status,now_utc() if new_status=="done" else None,user["user_id"] if new_status=="done" else None,task_id)
    return row_to_task(row)

@api_router.patch("/tasks/{task_id}/move",response_model=TaskOut)
async def move_task(task_id:str,payload:TaskMoveIn,pool=Depends(get_db),user=Depends(require_user)):
    team_ids=await get_visible_team_ids(pool,user["user_id"],_user_dict=user)
    doc=await pool.fetchrow("SELECT * FROM tasks WHERE task_id=$1 AND (user_id=$2 OR team_id=ANY($3::text[]))",task_id,user["user_id"],team_ids)
    if not doc: raise HTTPException(404)
    col=await pool.fetchrow("SELECT * FROM project_columns WHERE column_id=$1",payload.column_id)
    if col and col["is_done"]:
        new_status="done"
    elif col:
        col_name=(col["name"] or "").lower()
        if "progress" in col_name or "review" in col_name or "approval" in col_name or "doing" in col_name:
            new_status="in_progress"
        elif "todo" in col_name or "to do" in col_name or "backlog" in col_name or "open" in col_name:
            new_status="todo"
        else:
            new_status="in_progress" if doc["status"]=="todo" else doc["status"]
    else:
        new_status=doc["status"]
    completed_at=now_utc() if new_status=="done" else None
    completed_by=user["user_id"] if new_status=="done" else None
    row=await pool.fetchrow("UPDATE tasks SET column_id=$1,status=$2,sort_order=$3,completed_at=$4,completed_by_user_id=$5,updated_at=NOW() WHERE task_id=$6 RETURNING *",
        payload.column_id,new_status,payload.order,completed_at,completed_by,task_id)
    if doc["status"]!=new_status:
        from services.activity_logger import log_event
        await log_event(pool,task_id=task_id,actor_id=user["user_id"],event_type="status_changed",data={"from":doc["status"],"to":new_status})
    return row_to_task(row)

# ── Notifications ─────────────────────────────────────────────────

@api_router.get("/notifications",response_model=List[NotificationOut])
async def list_notifications(unread_only:bool=False,pool=Depends(get_db),user=Depends(require_user)):
    sql="SELECT * FROM notifications WHERE user_id=$1"+(" AND read_at IS NULL" if unread_only else "")+" ORDER BY created_at DESC LIMIT 200"
    return [NotificationOut(**dict(r)) for r in await pool.fetch(sql,user["user_id"])]

@api_router.post("/notifications/mark-read")
async def mark_read(payload:MarkReadIn,pool=Depends(get_db),user=Depends(require_user)):
    if payload.mark_all: await pool.execute("UPDATE notifications SET read_at=NOW() WHERE user_id=$1 AND read_at IS NULL",user["user_id"])
    elif payload.notification_ids: await pool.execute("UPDATE notifications SET read_at=NOW() WHERE user_id=$1 AND notification_id=ANY($2::text[])",user["user_id"],payload.notification_ids)
    return {"ok":True}

@api_router.post("/notifications/process")
async def process_notifications(pool=Depends(get_db),user=Depends(require_user)):
    team_ids=await get_visible_team_ids(pool,user["user_id"])
    rows=await pool.fetch("SELECT * FROM tasks WHERE (user_id=$1 OR team_id=ANY($2::text[])) AND status!='done' AND reminder_at IS NOT NULL AND reminder_at<=$3 AND reminder_sent_at IS NULL",user["user_id"],team_ids,now_utc())
    for t in rows:
        recipients=set(t["assignee_user_ids"] or [])
        if not recipients and t["user_id"]: recipients.add(t["user_id"])
        for uid in recipients:
            await create_notification(pool,uid,"reminder","Task reminder",f"Due soon: {t['title']}",t["task_id"],t["team_id"],"/tasks")
        await pool.execute("UPDATE tasks SET reminder_sent_at=NOW(),updated_at=NOW() WHERE task_id=$1",t["task_id"])
    return {"ok":True,"created":len(rows)}

@api_router.get("/dashboard/summary",response_model=DashboardSummaryOut)
async def dashboard_summary(pool=Depends(get_db),user=Depends(require_user)):
    team_ids=await get_visible_team_ids(pool,user["user_id"],_user_dict=user); now=now_utc()
    base="(user_id=$1 OR team_id=ANY($2::text[]))"
    todo=await pool.fetchval(f"SELECT COUNT(*) FROM tasks WHERE {base} AND status='todo'",user["user_id"],team_ids)
    in_progress=await pool.fetchval(f"SELECT COUNT(*) FROM tasks WHERE {base} AND status='in_progress'",user["user_id"],team_ids)
    done=await pool.fetchval(f"SELECT COUNT(*) FROM tasks WHERE {base} AND status='done'",user["user_id"],team_ids)
    overdue=await pool.fetchval(f"SELECT COUNT(*) FROM tasks WHERE {base} AND status!='done' AND due_at<$3",user["user_id"],team_ids,now)
    due_24h=await pool.fetchval(f"SELECT COUNT(*) FROM tasks WHERE {base} AND status!='done' AND due_at>=$3 AND due_at<$4",user["user_id"],team_ids,now,now+timedelta(hours=24))
    return DashboardSummaryOut(todo=todo,in_progress=in_progress,done=done,overdue=overdue,due_24h=due_24h)

@api_router.get("/notifications/poll")
async def poll_notifications(pool=Depends(get_db),user=Depends(require_user)):
    """Single endpoint replacing the two-request (process + fetch) polling cycle.
    Processes due reminders and returns unread count in one round-trip."""
    team_ids=await get_visible_team_ids(pool,user["user_id"],_user_dict=user)
    # Process reminders
    rows=await pool.fetch(
        "SELECT * FROM tasks WHERE (user_id=$1 OR team_id=ANY($2::text[])) AND status!='done'"
        " AND reminder_at IS NOT NULL AND reminder_at<=$3 AND reminder_sent_at IS NULL",
        user["user_id"],team_ids,now_utc()
    )
    for t in rows:
        recipients=set(t["assignee_user_ids"] or [])
        if not recipients and t["user_id"]: recipients.add(t["user_id"])
        for uid in recipients:
            await create_notification(pool,uid,"reminder","Task reminder",f"Due soon: {t['title']}",t["task_id"],t["team_id"],"/tasks")
        await pool.execute("UPDATE tasks SET reminder_sent_at=NOW(),updated_at=NOW() WHERE task_id=$1",t["task_id"])
    # Return unread count
    unread=await pool.fetchval(
        "SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND read_at IS NULL",
        user["user_id"]
    )
    return {"unread": unread or 0}

@api_router.get("/push/vapid-public-key")
async def get_vapid_public_key(user=Depends(require_user)): return {"public_key":"not-configured"}
@api_router.post("/push/subscribe")
async def subscribe_push(payload:PushSubscriptionIn,user=Depends(require_user)): return {"ok":True}
@api_router.post("/push/unsubscribe")
async def unsubscribe_push(payload:PushSubscriptionIn,user=Depends(require_user)): return {"ok":True}


# ── App assembly ────────────────────────────────────────────────────

app.include_router(auth_router)
app.include_router(invite_router)
app.include_router(approvals_router)
app.include_router(health_router)
app.include_router(api_router)

# v2 routers
app.include_router(fields_router)
app.include_router(views_router)
app.include_router(automations_router)
app.include_router(activity_router)
app.include_router(dashboards_router)
app.include_router(templates_router)
app.include_router(time_router)
app.include_router(uploads_router)   # R2-backed file upload (replaces old base64 /api/upload)
app.include_router(reports_router)


# ── Verse of the day (public) ────────────────────────────────────────────────
@app.get("/api/verse-of-the-day")
async def verse_of_the_day():
    """Return today's Bhagavad Gita verse — same verse for all users all day."""
    return await get_verse_of_the_day()


@app.on_event("startup")
async def startup():
    dsn=os.environ.get("DATABASE_URL","NOT SET")
    if "@" in dsn:
        parts=dsn.split("@"); user_part=parts[0].split("://")[-1].split(":")[0]; host_part=parts[1]
        logger.info(f"DATABASE_URL: postgresql://{user_part}:***@{host_part}")
    else:
        logger.info(f"DATABASE_URL: {dsn}")
    r2_bucket = os.environ.get("R2_BUCKET_NAME", "NOT SET")
    logger.info(f"R2_BUCKET: {r2_bucket} | R2_PUBLIC_URL: {os.environ.get('R2_PUBLIC_URL','<presigned>')}")
    logger.info(f"CORS origins: {ALLOWED_ORIGINS}")
    logger.info("Kartavya API v2 ready — custom fields, automations, activity, time tracking, R2 uploads")

@app.on_event("shutdown")
async def shutdown(): await close_pool()

def App(): return app
