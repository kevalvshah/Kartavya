"""
server.py — Kartavya API by Aekam Inc
Database: Supabase PostgreSQL via asyncpg
Auth: JWT (email + password), invite-only
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
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from starlette.middleware.cors import CORSMiddleware

from auth_router import require_user, require_admin
from auth_router import router as auth_router
from invite_router import router as invite_router
from db import close_pool, get_pool
from health import router as health_router

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

app = FastAPI(title="Kartavya API", description="Team task management by Aekam Inc")
api_router = APIRouter(prefix="/api")

# ── CORS — registered BEFORE routers ───────────────────────────────────
DEFAULT_ORIGINS = [
    "https://kartavya-aekam.vercel.app",
    "https://kartavya-kevalvshah03-6145s-projects.vercel.app",
    "https://kartavya-git-main-kevalvshah03-6145s-projects.vercel.app",
    "http://localhost:3000",
    "http://localhost:8080",
]
extra = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
ALLOWED_ORIGINS = list(dict.fromkeys(DEFAULT_ORIGINS + extra))

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helpers ────────────────────────────────────────────────────

def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def parse_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid datetime: {value}") from e
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


async def get_db() -> asyncpg.Pool:
    return await get_pool()


async def get_visible_team_ids(pool: asyncpg.Pool, user_id: str) -> List[str]:
    rows = await pool.fetch(
        "SELECT team_id FROM team_members WHERE user_id = $1 AND status = 'active'", user_id
    )
    return [r["team_id"] for r in rows]


async def normalize_orders(pool, scope_col, scope_val, status):
    rows = await pool.fetch(
        f"SELECT task_id FROM tasks WHERE {scope_col}=$1 AND status=$2 ORDER BY sort_order ASC, updated_at ASC",
        scope_val, status,
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


async def ensure_default_columns(pool, team_id: str):
    """Create default columns for a new project if none exist yet."""
    existing = await pool.fetchval("SELECT COUNT(*) FROM project_columns WHERE team_id=$1", team_id)
    if existing == 0:
        defaults = [
            ("To Do",       "#0082c6", 0, False),
            ("In Progress", "#03a1b6", 1, False),
            ("Done",        "#05b7aa", 2, True),
        ]
        for name, color, order, is_done in defaults:
            await pool.execute(
                "INSERT INTO project_columns (column_id,team_id,name,color,sort_order,is_done) VALUES ($1,$2,$3,$4,$5,$6)",
                f"col_{uuid.uuid4().hex[:12]}", team_id, name, color, order, is_done,
            )


# ── Models ────────────────────────────────────────────────────

class ProjectColumnCreate(BaseModel):
    name: str
    color: str = "#0082c6"
    is_done: bool = False

class ProjectColumnUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    is_done: Optional[bool] = None
    sort_order: Optional[int] = None

class ProjectColumnOut(BaseModel):
    column_id: str
    team_id: str
    name: str
    color: str
    sort_order: int
    is_done: bool
    created_at: datetime

class CategoryCreate(BaseModel):
    name: str
    color: str = "#0082c6"

class CategoryOut(BaseModel):
    category_id: str
    user_id: str
    name: str
    color: str
    created_at: datetime
    updated_at: datetime

class TeamCreate(BaseModel):
    name: str

class TeamOut(BaseModel):
    team_id: str
    name: str
    created_by: str
    created_at: datetime
    updated_at: datetime

class TeamMemberAdd(BaseModel):
    email: str
    role: str = "member"

class TeamMemberUpdate(BaseModel):
    role: Optional[str] = None
    status: Optional[str] = None

class TeamMemberOut(BaseModel):
    member_id: str
    team_id: str
    email: str
    user_id: Optional[str] = None
    role: str
    status: str
    created_at: datetime
    updated_at: datetime

class Attachment(BaseModel):
    name: str
    url: str

class Subtask(BaseModel):
    subtask_id: str = Field(default_factory=lambda: f"sub_{uuid.uuid4().hex[:12]}")
    title: str
    is_done: bool = False
    order: int = 0

class Recurrence(BaseModel):
    rule: str = "none"
    interval: int = 1

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    status: str = "todo"
    column_id: Optional[str] = None
    priority: str = "medium"
    category_id: Optional[str] = None
    tags: List[str] = []
    team_id: Optional[str] = None
    assignee_user_ids: List[str] = []
    assignee_emails: List[str] = []
    due_at: Optional[str] = None
    reminder_at: Optional[str] = None
    recurrence: Recurrence = Field(default_factory=Recurrence)
    estimated_minutes: Optional[int] = None
    attachments: List[Attachment] = []
    custom_fields: Dict[str, Any] = {}
    subtasks: List[Subtask] = []

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    column_id: Optional[str] = None
    priority: Optional[str] = None
    category_id: Optional[str] = None
    tags: Optional[List[str]] = None
    team_id: Optional[str] = None
    assignee_user_ids: Optional[List[str]] = None
    assignee_emails: Optional[List[str]] = None
    due_at: Optional[str] = None
    reminder_at: Optional[str] = None
    recurrence: Optional[Recurrence] = None
    estimated_minutes: Optional[int] = None
    attachments: Optional[List[Attachment]] = None
    custom_fields: Optional[Dict[str, Any]] = None
    subtasks: Optional[List[Subtask]] = None

class TaskOut(BaseModel):
    task_id: str
    user_id: Optional[str] = None
    team_id: Optional[str] = None
    column_id: Optional[str] = None
    created_by_user_id: str
    assigned_by_user_id: Optional[str] = None
    completed_by_user_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    status: str
    priority: str
    category_id: Optional[str] = None
    tags: List[str] = []
    assignee_user_ids: List[str] = []
    assignee_emails: List[str] = []
    due_at: Optional[datetime] = None
    reminder_at: Optional[datetime] = None
    reminder_sent_at: Optional[datetime] = None
    recurrence: Recurrence = Field(default_factory=Recurrence)
    estimated_minutes: Optional[int] = None
    attachments: List[Attachment] = []
    custom_fields: Dict[str, Any] = {}
    subtasks: List[Subtask] = []
    order: int = 0
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None

class TaskMoveIn(BaseModel):
    column_id: str
    order: int

class CommentCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=4000)

class CommentOut(BaseModel):
    comment_id: str
    task_id: str
    user_id: str
    user_name: str
    body: str
    created_at: datetime

class DashboardSummaryOut(BaseModel):
    todo: int
    in_progress: int
    done: int
    overdue: int
    due_24h: int

class PushSubscriptionIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    endpoint: str
    keys: Dict[str, str]

class NotificationOut(BaseModel):
    notification_id: str
    user_id: str
    team_id: Optional[str] = None
    type: str
    title: str
    message: str
    task_id: Optional[str] = None
    url: Optional[str] = None
    created_at: datetime
    read_at: Optional[datetime] = None

class MarkReadIn(BaseModel):
    notification_ids: List[str] = []
    mark_all: bool = False


def row_to_task(r) -> TaskOut:
    def parse_json(v, default):
        if isinstance(v, str): return json.loads(v)
        return v if v is not None else default
    return TaskOut(
        task_id=r["task_id"], user_id=r["user_id"], team_id=r["team_id"],
        column_id=r.get("column_id"),
        created_by_user_id=r["created_by_user_id"], assigned_by_user_id=r["assigned_by_user_id"],
        completed_by_user_id=r["completed_by_user_id"], title=r["title"], description=r["description"],
        status=r["status"], priority=r["priority"], category_id=r["category_id"],
        tags=list(r["tags"] or []), assignee_user_ids=list(r["assignee_user_ids"] or []),
        assignee_emails=list(r["assignee_emails"] or []),
        due_at=r["due_at"], reminder_at=r["reminder_at"], reminder_sent_at=r["reminder_sent_at"],
        recurrence=Recurrence(rule=r["recurrence_rule"] or "none", interval=r["recurrence_interval"] or 1),
        estimated_minutes=r["estimated_minutes"],
        attachments=[Attachment(**a) for a in parse_json(r["attachments"], [])],
        custom_fields=parse_json(r["custom_fields"], {}),
        subtasks=[Subtask(**s) for s in parse_json(r["subtasks"], [])],
        order=r["sort_order"] or 0, created_at=r["created_at"], updated_at=r["updated_at"],
        completed_at=r["completed_at"],
    )


# ── Routes ─────────────────────────────────────────────────────

@api_router.get("/")
async def root():
    return {"message": "Kartavya API", "by": "Aekam Inc", "status": "ok"}

@api_router.get("/auth/me")
async def me(user=Depends(require_user)):
    return {"user_id": user["user_id"], "email": user["email"], "name": user["name"],
            "role": user.get("role", "member"), "picture": user.get("avatar")}

@api_router.post("/auth/logout")
async def logout(): return {"ok": True}


# ── Project Columns ───────────────────────────────────────────

@api_router.get("/projects/{team_id}/columns", response_model=List[ProjectColumnOut])
async def list_columns(team_id: str, pool=Depends(get_db), user=Depends(require_user)):
    """Get all columns for a project. Creates defaults if none exist yet."""
    mem = await pool.fetchrow("SELECT 1 FROM team_members WHERE team_id=$1 AND user_id=$2 AND status='active'", team_id, user["user_id"])
    if not mem: raise HTTPException(status_code=403, detail="Not a project member")
    await ensure_default_columns(pool, team_id)
    rows = await pool.fetch("SELECT * FROM project_columns WHERE team_id=$1 ORDER BY sort_order ASC", team_id)
    return [ProjectColumnOut(**dict(r)) for r in rows]


@api_router.post("/projects/{team_id}/columns", response_model=ProjectColumnOut)
async def create_column(team_id: str, payload: ProjectColumnCreate, pool=Depends(get_db), user=Depends(require_user)):
    mem = await pool.fetchrow("SELECT role FROM team_members WHERE team_id=$1 AND user_id=$2 AND status='active'", team_id, user["user_id"])
    if not mem or mem["role"] not in ("owner", "admin"): raise HTTPException(status_code=403, detail="Owner or admin required")
    max_order = await pool.fetchval("SELECT COALESCE(MAX(sort_order),0) FROM project_columns WHERE team_id=$1", team_id)
    column_id = f"col_{uuid.uuid4().hex[:12]}"
    row = await pool.fetchrow(
        "INSERT INTO project_columns (column_id,team_id,name,color,sort_order,is_done) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
        column_id, team_id, payload.name, payload.color, max_order + 1, payload.is_done,
    )
    return ProjectColumnOut(**dict(row))


@api_router.put("/projects/{team_id}/columns/{column_id}", response_model=ProjectColumnOut)
async def update_column(team_id: str, column_id: str, payload: ProjectColumnUpdate, pool=Depends(get_db), user=Depends(require_user)):
    mem = await pool.fetchrow("SELECT role FROM team_members WHERE team_id=$1 AND user_id=$2 AND status='active'", team_id, user["user_id"])
    if not mem or mem["role"] not in ("owner", "admin"): raise HTTPException(status_code=403)
    updates, vals = [], []
    if payload.name is not None: updates.append(f"name=${len(vals)+1}"); vals.append(payload.name)
    if payload.color is not None: updates.append(f"color=${len(vals)+1}"); vals.append(payload.color)
    if payload.is_done is not None: updates.append(f"is_done=${len(vals)+1}"); vals.append(payload.is_done)
    if payload.sort_order is not None: updates.append(f"sort_order=${len(vals)+1}"); vals.append(payload.sort_order)
    if not updates: raise HTTPException(status_code=400, detail="Nothing to update")
    updates.append(f"updated_at=${len(vals)+1}"); vals.append(now_utc())
    vals += [team_id, column_id]
    row = await pool.fetchrow(
        f"UPDATE project_columns SET {', '.join(updates)} WHERE team_id=${len(vals)-1} AND column_id=${len(vals)} RETURNING *",
        *vals
    )
    if not row: raise HTTPException(status_code=404)
    return ProjectColumnOut(**dict(row))


@api_router.delete("/projects/{team_id}/columns/{column_id}")
async def delete_column(team_id: str, column_id: str, pool=Depends(get_db), user=Depends(require_user)):
    mem = await pool.fetchrow("SELECT role FROM team_members WHERE team_id=$1 AND user_id=$2 AND status='active'", team_id, user["user_id"])
    if not mem or mem["role"] not in ("owner", "admin"): raise HTTPException(status_code=403)
    # Count remaining columns
    remaining = await pool.fetchval("SELECT COUNT(*) FROM project_columns WHERE team_id=$1", team_id)
    if remaining <= 1: raise HTTPException(status_code=400, detail="Cannot delete the last column")
    # Move tasks in this column to the first remaining column
    first_col = await pool.fetchrow(
        "SELECT column_id FROM project_columns WHERE team_id=$1 AND column_id!=$2 ORDER BY sort_order ASC LIMIT 1",
        team_id, column_id
    )
    if first_col:
        await pool.execute("UPDATE tasks SET column_id=$1 WHERE column_id=$2", first_col["column_id"], column_id)
    await pool.execute("DELETE FROM project_columns WHERE team_id=$1 AND column_id=$2", team_id, column_id)
    return {"ok": True}


@api_router.post("/projects/{team_id}/columns/reorder")
async def reorder_columns(team_id: str, body: dict, pool=Depends(get_db), user=Depends(require_user)):
    """body: {ordered_ids: [column_id, ...]}"""
    mem = await pool.fetchrow("SELECT role FROM team_members WHERE team_id=$1 AND user_id=$2 AND status='active'", team_id, user["user_id"])
    if not mem or mem["role"] not in ("owner", "admin"): raise HTTPException(status_code=403)
    ordered_ids = body.get("ordered_ids", [])
    for idx, cid in enumerate(ordered_ids):
        await pool.execute("UPDATE project_columns SET sort_order=$1 WHERE column_id=$2 AND team_id=$3", idx, cid, team_id)
    return {"ok": True}


# ── Client portal ──────────────────────────────────────────

@api_router.get("/client/tasks", response_model=List[TaskOut])
async def client_tasks(pool=Depends(get_db), user=Depends(require_user)):
    rows = await pool.fetch(
        "SELECT t.* FROM tasks t JOIN task_clients tc ON tc.task_id=t.task_id WHERE tc.user_id=$1 ORDER BY t.updated_at DESC",
        user["user_id"],
    )
    return [row_to_task(r) for r in rows]

@api_router.post("/tasks/{task_id}/clients/{target_user_id}")
async def add_client_to_task(task_id: str, target_user_id: str, pool=Depends(get_db), user=Depends(require_admin)):
    await pool.execute(
        "INSERT INTO task_clients (id,task_id,user_id,invited_by) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING",
        f"tc_{uuid.uuid4().hex[:12]}", task_id, target_user_id, user["user_id"],
    )
    return {"ok": True}

@api_router.delete("/tasks/{task_id}/clients/{target_user_id}")
async def remove_client_from_task(task_id: str, target_user_id: str, pool=Depends(get_db), user=Depends(require_admin)):
    await pool.execute("DELETE FROM task_clients WHERE task_id=$1 AND user_id=$2", task_id, target_user_id)
    return {"ok": True}


# ── Comments ──────────────────────────────────────────────────

@api_router.get("/tasks/{task_id}/comments", response_model=List[CommentOut])
async def list_comments(task_id: str, pool=Depends(get_db), user=Depends(require_user)):
    if user.get("role") == "client":
        access = await pool.fetchrow("SELECT 1 FROM task_clients WHERE task_id=$1 AND user_id=$2", task_id, user["user_id"])
        if not access: raise HTTPException(status_code=403)
    rows = await pool.fetch(
        "SELECT c.comment_id,c.task_id,c.user_id,u.name AS user_name,c.body,c.created_at "
        "FROM task_comments c JOIN users u ON u.user_id=c.user_id WHERE c.task_id=$1 ORDER BY c.created_at ASC",
        task_id,
    )
    return [CommentOut(**dict(r)) for r in rows]

@api_router.post("/tasks/{task_id}/comments", response_model=CommentOut)
async def add_comment(task_id: str, body: CommentCreate, pool=Depends(get_db), user=Depends(require_user)):
    if user.get("role") == "client":
        access = await pool.fetchrow("SELECT 1 FROM task_clients WHERE task_id=$1 AND user_id=$2", task_id, user["user_id"])
        if not access: raise HTTPException(status_code=403)
    comment_id = f"cmt_{uuid.uuid4().hex[:12]}"
    row = await pool.fetchrow(
        "INSERT INTO task_comments (comment_id,task_id,user_id,body) VALUES ($1,$2,$3,$4) RETURNING *",
        comment_id, task_id, user["user_id"], body.body,
    )
    return CommentOut(comment_id=row["comment_id"], task_id=row["task_id"], user_id=row["user_id"],
                      user_name=user["name"], body=row["body"], created_at=row["created_at"])


# ── Teams ──────────────────────────────────────────────────────

@api_router.get("/teams", response_model=List[TeamOut])
async def list_teams(pool=Depends(get_db), user=Depends(require_user)):
    team_ids = await get_visible_team_ids(pool, user["user_id"])
    if not team_ids: return []
    rows = await pool.fetch("SELECT * FROM teams WHERE team_id=ANY($1::text[]) ORDER BY updated_at DESC", team_ids)
    return [TeamOut(**dict(r)) for r in rows]

@api_router.post("/teams", response_model=TeamOut)
async def create_team(payload: TeamCreate, pool=Depends(get_db), user=Depends(require_user)):
    team_id = f"team_{uuid.uuid4().hex[:12]}"
    row = await pool.fetchrow("INSERT INTO teams (team_id,name,created_by) VALUES ($1,$2,$3) RETURNING *", team_id, payload.name, user["user_id"])
    await pool.execute("INSERT INTO team_members (member_id,team_id,email,user_id,role,status) VALUES ($1,$2,$3,$4,'owner','active')",
        f"mem_{uuid.uuid4().hex[:12]}", team_id, user["email"], user["user_id"])
    await ensure_default_columns(pool, team_id)
    return TeamOut(**dict(row))

@api_router.get("/teams/{team_id}")
async def get_team(team_id: str, pool=Depends(get_db), user=Depends(require_user)):
    mem = await pool.fetchrow("SELECT * FROM team_members WHERE team_id=$1 AND user_id=$2 AND status='active'", team_id, user["user_id"])
    if not mem: raise HTTPException(status_code=403, detail="Not a team member")
    team = await pool.fetchrow("SELECT * FROM teams WHERE team_id=$1", team_id)
    members = await pool.fetch("SELECT * FROM team_members WHERE team_id=$1 ORDER BY created_at ASC", team_id)
    return {"team": dict(team), "members": [dict(m) for m in members], "your_role": mem["role"]}

@api_router.post("/teams/{team_id}/members", response_model=TeamMemberOut)
async def add_team_member(team_id: str, payload: TeamMemberAdd, pool=Depends(get_db), user=Depends(require_user)):
    mem = await pool.fetchrow("SELECT role FROM team_members WHERE team_id=$1 AND user_id=$2 AND status='active'", team_id, user["user_id"])
    if not mem or mem["role"] not in ("owner", "admin"): raise HTTPException(status_code=403)
    email = payload.email.strip().lower()
    existing_user = await pool.fetchrow("SELECT user_id FROM users WHERE email=$1", email)
    uid = existing_user["user_id"] if existing_user else None
    await pool.execute("DELETE FROM team_members WHERE team_id=$1 AND email=$2", team_id, email)
    row = await pool.fetchrow(
        "INSERT INTO team_members (member_id,team_id,email,user_id,role,status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
        f"mem_{uuid.uuid4().hex[:12]}", team_id, email, uid, payload.role, "active" if uid else "invited")
    return TeamMemberOut(**dict(row))

@api_router.put("/teams/{team_id}/members/{member_id}", response_model=TeamMemberOut)
async def update_team_member(team_id: str, member_id: str, payload: TeamMemberUpdate, pool=Depends(get_db), user=Depends(require_user)):
    mem = await pool.fetchrow("SELECT role FROM team_members WHERE team_id=$1 AND user_id=$2 AND status='active'", team_id, user["user_id"])
    if not mem or mem["role"] not in ("owner", "admin"): raise HTTPException(status_code=403)
    updates, vals = [], []
    if payload.role: updates.append(f"role=${len(vals)+1}"); vals.append(payload.role)
    if payload.status: updates.append(f"status=${len(vals)+1}"); vals.append(payload.status)
    updates.append(f"updated_at=${len(vals)+1}"); vals.append(now_utc())
    vals += [team_id, member_id]
    row = await pool.fetchrow(f"UPDATE team_members SET {', '.join(updates)} WHERE team_id=${len(vals)-1} AND member_id=${len(vals)} RETURNING *", *vals)
    if not row: raise HTTPException(status_code=404)
    return TeamMemberOut(**dict(row))

@api_router.delete("/teams/{team_id}/members/{member_id}")
async def remove_team_member(team_id: str, member_id: str, pool=Depends(get_db), user=Depends(require_user)):
    mem = await pool.fetchrow("SELECT role FROM team_members WHERE team_id=$1 AND user_id=$2 AND status='active'", team_id, user["user_id"])
    if not mem or mem["role"] not in ("owner", "admin"): raise HTTPException(status_code=403)
    await pool.execute("DELETE FROM team_members WHERE team_id=$1 AND member_id=$2", team_id, member_id)
    return {"ok": True}


# ── Categories ────────────────────────────────────────────────

@api_router.get("/categories", response_model=List[CategoryOut])
async def list_categories(pool=Depends(get_db), user=Depends(require_user)):
    rows = await pool.fetch("SELECT * FROM categories WHERE user_id=$1 ORDER BY updated_at DESC", user["user_id"])
    return [CategoryOut(**dict(r)) for r in rows]

@api_router.post("/categories", response_model=CategoryOut)
async def create_category(payload: CategoryCreate, pool=Depends(get_db), user=Depends(require_user)):
    row = await pool.fetchrow("INSERT INTO categories (category_id,user_id,name,color) VALUES ($1,$2,$3,$4) RETURNING *",
        f"cat_{uuid.uuid4().hex[:12]}", user["user_id"], payload.name, payload.color)
    return CategoryOut(**dict(row))

@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str, pool=Depends(get_db), user=Depends(require_user)):
    await pool.execute("UPDATE tasks SET category_id=NULL,updated_at=NOW() WHERE user_id=$1 AND category_id=$2", user["user_id"], category_id)
    await pool.execute("DELETE FROM categories WHERE user_id=$1 AND category_id=$2", user["user_id"], category_id)
    return {"ok": True}


# ── Tasks ────────────────────────────────────────────────────────

@api_router.get("/tasks", response_model=List[TaskOut])
async def list_tasks(status: Optional[str]=None, category_id: Optional[str]=None, q: Optional[str]=None,
                     team_id: Optional[str]=None, assigned_to_me: Optional[bool]=None,
                     pool=Depends(get_db), user=Depends(require_user)):
    team_ids = await get_visible_team_ids(pool, user["user_id"])
    conditions = ["(t.user_id=$1 OR t.team_id=ANY($2::text[]))"]
    vals: list = [user["user_id"], team_ids]
    if team_id: conditions.append(f"t.team_id=${len(vals)+1}"); vals.append(team_id)
    if status: conditions.append(f"t.status=${len(vals)+1}"); vals.append(status)
    if category_id: conditions.append(f"t.category_id=${len(vals)+1}"); vals.append(category_id)
    if q: conditions.append(f"t.title ILIKE ${len(vals)+1}"); vals.append(f"%{q}%")
    if assigned_to_me: conditions.append(f"${len(vals)+1}=ANY(t.assignee_user_ids)"); vals.append(user["user_id"])
    rows = await pool.fetch(
        f"SELECT * FROM tasks t WHERE {' AND '.join(conditions)} ORDER BY t.sort_order ASC", *vals
    )
    return [row_to_task(r) for r in rows]

@api_router.post("/tasks", response_model=TaskOut)
async def create_task(payload: TaskCreate, pool=Depends(get_db), user=Depends(require_user)):
    if payload.team_id:
        mem = await pool.fetchrow("SELECT 1 FROM team_members WHERE team_id=$1 AND user_id=$2 AND status='active'", payload.team_id, user["user_id"])
        if not mem: raise HTTPException(status_code=403)
        user_id_field, scope_col, scope_val = None, "team_id", payload.team_id
    else:
        user_id_field, scope_col, scope_val = user["user_id"], "user_id", user["user_id"]

    # Resolve column_id — if not provided, use the first column of the project
    column_id = payload.column_id
    if not column_id and payload.team_id:
        first_col = await pool.fetchrow(
            "SELECT column_id FROM project_columns WHERE team_id=$1 ORDER BY sort_order ASC LIMIT 1",
            payload.team_id
        )
        column_id = first_col["column_id"] if first_col else None

    # Derive status from column's is_done flag
    status = payload.status
    if column_id:
        col = await pool.fetchrow("SELECT is_done FROM project_columns WHERE column_id=$1", column_id)
        if col:
            status = "done" if col["is_done"] else ("todo" if payload.status == "todo" else payload.status)

    due_dt = parse_dt(payload.due_at)
    reminder_dt = parse_dt(payload.reminder_at) or (due_dt - timedelta(hours=2) if due_dt else None)
    max_row = await pool.fetchrow(f"SELECT MAX(sort_order) AS mo FROM tasks WHERE {scope_col}=$1 AND status=$2", scope_val, status)
    next_order = (max_row["mo"] or -1) + 1
    task_id = f"task_{uuid.uuid4().hex[:12]}"
    row = await pool.fetchrow("""
        INSERT INTO tasks (task_id,user_id,team_id,column_id,created_by_user_id,assigned_by_user_id,
            title,description,status,priority,category_id,tags,assignee_user_ids,assignee_emails,
            due_at,reminder_at,recurrence_rule,recurrence_interval,estimated_minutes,
            attachments,custom_fields,subtasks,sort_order)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::text[],$13::text[],$14::text[],
                $15,$16,$17,$18,$19,$20::jsonb,$21::jsonb,$22::jsonb,$23) RETURNING *""",
        task_id, user_id_field, payload.team_id, column_id, user["user_id"],
        user["user_id"] if (payload.assignee_user_ids or payload.assignee_emails) else None,
        payload.title, payload.description, status, payload.priority, payload.category_id,
        payload.tags or [], payload.assignee_user_ids or [],
        [e.strip().lower() for e in payload.assignee_emails if e.strip()],
        due_dt, reminder_dt, payload.recurrence.rule, payload.recurrence.interval,
        payload.estimated_minutes,
        json.dumps([a.model_dump() for a in payload.attachments or []]),
        json.dumps(payload.custom_fields or {}),
        json.dumps([s.model_dump() for s in payload.subtasks or []]),
        next_order)
    for uid in set(payload.assignee_user_ids or []):
        await create_notification(pool, uid, "assigned", "Task assigned", f"You were assigned: {payload.title}", task_id, payload.team_id, "/tasks")
    return row_to_task(row)

@api_router.put("/tasks/{task_id}", response_model=TaskOut)
async def update_task(task_id: str, payload: TaskUpdate, pool=Depends(get_db), user=Depends(require_user)):
    team_ids = await get_visible_team_ids(pool, user["user_id"])
    existing = await pool.fetchrow("SELECT * FROM tasks WHERE task_id=$1 AND (user_id=$2 OR team_id=ANY($3::text[]))", task_id, user["user_id"], team_ids)
    if not existing: raise HTTPException(status_code=404)
    data = payload.model_dump(exclude_unset=True)
    updates, vals = [], []
    for k in ["title","description","status","priority","category_id","estimated_minutes","column_id"]:
        if k in data: updates.append(f"{k}=${len(vals)+1}"); vals.append(data[k])
    for k in ["tags","assignee_user_ids","assignee_emails"]:
        if k in data: updates.append(f"{k}=${len(vals)+1}::text[]"); vals.append(data[k])
    for k in ["attachments","custom_fields","subtasks"]:
        if k in data and data[k] is not None:
            updates.append(f"{k}=${len(vals)+1}::jsonb")
            v = data[k]
            vals.append(json.dumps([i.model_dump() if hasattr(i,'model_dump') else i for i in v] if isinstance(v,list) else v))
    if "due_at" in data: updates.append(f"due_at=${len(vals)+1}"); vals.append(parse_dt(data["due_at"]))
    if "reminder_at" in data: updates.append(f"reminder_at=${len(vals)+1}"); vals.append(parse_dt(data["reminder_at"]))
    if "recurrence" in data and data["recurrence"]:
        rec = data["recurrence"]
        updates.append(f"recurrence_rule=${len(vals)+1}"); vals.append(rec.get("rule","none") if isinstance(rec,dict) else rec.rule)
        updates.append(f"recurrence_interval=${len(vals)+1}"); vals.append(rec.get("interval",1) if isinstance(rec,dict) else rec.interval)
    updates.append(f"updated_at=${len(vals)+1}"); vals.append(now_utc())
    vals.append(task_id)
    row = await pool.fetchrow(f"UPDATE tasks SET {', '.join(updates)} WHERE task_id=${len(vals)} RETURNING *", *vals)
    return row_to_task(row)

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, pool=Depends(get_db), user=Depends(require_user)):
    team_ids = await get_visible_team_ids(pool, user["user_id"])
    doc = await pool.fetchrow("SELECT * FROM tasks WHERE task_id=$1 AND (user_id=$2 OR team_id=ANY($3::text[]))", task_id, user["user_id"], team_ids)
    if not doc: raise HTTPException(status_code=404)
    await pool.execute("DELETE FROM tasks WHERE task_id=$1", task_id)
    return {"ok": True}

@api_router.patch("/tasks/{task_id}/toggle", response_model=TaskOut)
async def toggle_task(task_id: str, pool=Depends(get_db), user=Depends(require_user)):
    team_ids = await get_visible_team_ids(pool, user["user_id"])
    doc = await pool.fetchrow("SELECT * FROM tasks WHERE task_id=$1 AND (user_id=$2 OR team_id=ANY($3::text[]))", task_id, user["user_id"], team_ids)
    if not doc: raise HTTPException(status_code=404)
    old_status = doc["status"]
    new_status = "todo" if old_status == "done" else "done"
    scope_col = "team_id" if doc["team_id"] else "user_id"
    scope_val = doc["team_id"] or doc["user_id"]
    max_row = await pool.fetchrow(f"SELECT MAX(sort_order) AS mo FROM tasks WHERE {scope_col}=$1 AND status=$2", scope_val, new_status)
    row = await pool.fetchrow(
        "UPDATE tasks SET status=$1,completed_at=$2,completed_by_user_id=$3,sort_order=$4,updated_at=NOW() WHERE task_id=$5 RETURNING *",
        new_status, now_utc() if new_status=="done" else None,
        user["user_id"] if new_status=="done" else None, (max_row["mo"] or -1)+1, task_id)
    await normalize_orders(pool, scope_col, scope_val, old_status)
    await normalize_orders(pool, scope_col, scope_val, new_status)
    return row_to_task(row)

@api_router.patch("/tasks/{task_id}/move", response_model=TaskOut)
async def move_task(task_id: str, payload: TaskMoveIn, pool=Depends(get_db), user=Depends(require_user)):
    """Move a task to a different column (and update status accordingly)."""
    team_ids = await get_visible_team_ids(pool, user["user_id"])
    doc = await pool.fetchrow("SELECT * FROM tasks WHERE task_id=$1 AND (user_id=$2 OR team_id=ANY($3::text[]))", task_id, user["user_id"], team_ids)
    if not doc: raise HTTPException(status_code=404)
    # Derive status from the target column's is_done flag
    col = await pool.fetchrow("SELECT * FROM project_columns WHERE column_id=$1", payload.column_id)
    new_status = doc["status"]
    if col:
        if col["is_done"]:
            new_status = "done"
        elif doc["status"] == "done":
            new_status = "in_progress"
    row = await pool.fetchrow(
        "UPDATE tasks SET column_id=$1,status=$2,sort_order=$3,updated_at=NOW() WHERE task_id=$4 RETURNING *",
        payload.column_id, new_status, payload.order, task_id
    )
    return row_to_task(row)


# ── Notifications ──────────────────────────────────────────

@api_router.get("/notifications", response_model=List[NotificationOut])
async def list_notifications(unread_only: bool=False, pool=Depends(get_db), user=Depends(require_user)):
    sql = "SELECT * FROM notifications WHERE user_id=$1" + (" AND read_at IS NULL" if unread_only else "") + " ORDER BY created_at DESC LIMIT 200"
    return [NotificationOut(**dict(r)) for r in await pool.fetch(sql, user["user_id"])]

@api_router.post("/notifications/mark-read")
async def mark_read(payload: MarkReadIn, pool=Depends(get_db), user=Depends(require_user)):
    if payload.mark_all:
        await pool.execute("UPDATE notifications SET read_at=NOW() WHERE user_id=$1 AND read_at IS NULL", user["user_id"])
    elif payload.notification_ids:
        await pool.execute("UPDATE notifications SET read_at=NOW() WHERE user_id=$1 AND notification_id=ANY($2::text[])", user["user_id"], payload.notification_ids)
    return {"ok": True}

@api_router.post("/notifications/process")
async def process_notifications(pool=Depends(get_db), user=Depends(require_user)):
    team_ids = await get_visible_team_ids(pool, user["user_id"])
    rows = await pool.fetch(
        "SELECT * FROM tasks WHERE (user_id=$1 OR team_id=ANY($2::text[])) AND status!='done' AND reminder_at IS NOT NULL AND reminder_at<=$3 AND reminder_sent_at IS NULL",
        user["user_id"], team_ids, now_utc())
    for t in rows:
        recipients = set(t["assignee_user_ids"] or [])
        if not recipients and t["user_id"]: recipients.add(t["user_id"])
        for uid in recipients:
            await create_notification(pool, uid, "reminder", "Task reminder", f"Due soon: {t['title']}", t["task_id"], t["team_id"], "/tasks")
        await pool.execute("UPDATE tasks SET reminder_sent_at=NOW(),updated_at=NOW() WHERE task_id=$1", t["task_id"])
    return {"ok": True, "created": len(rows)}


# ── Dashboard ──────────────────────────────────────────────────

@api_router.get("/dashboard/summary", response_model=DashboardSummaryOut)
async def dashboard_summary(pool=Depends(get_db), user=Depends(require_user)):
    team_ids = await get_visible_team_ids(pool, user["user_id"])
    now = now_utc()
    base = "(user_id=$1 OR team_id=ANY($2::text[]))"
    todo        = await pool.fetchval(f"SELECT COUNT(*) FROM tasks WHERE {base} AND status='todo'", user["user_id"], team_ids)
    in_progress = await pool.fetchval(f"SELECT COUNT(*) FROM tasks WHERE {base} AND status='in_progress'", user["user_id"], team_ids)
    done        = await pool.fetchval(f"SELECT COUNT(*) FROM tasks WHERE {base} AND status='done'", user["user_id"], team_ids)
    overdue     = await pool.fetchval(f"SELECT COUNT(*) FROM tasks WHERE {base} AND status!='done' AND due_at<$3", user["user_id"], team_ids, now)
    due_24h     = await pool.fetchval(f"SELECT COUNT(*) FROM tasks WHERE {base} AND status!='done' AND due_at>=$3 AND due_at<$4", user["user_id"], team_ids, now, now+timedelta(hours=24))
    return DashboardSummaryOut(todo=todo, in_progress=in_progress, done=done, overdue=overdue, due_24h=due_24h)


@api_router.get("/push/vapid-public-key")
async def get_vapid_public_key(user=Depends(require_user)):
    return {"public_key": "not-configured"}

@api_router.post("/push/subscribe")
async def subscribe_push(payload: PushSubscriptionIn, user=Depends(require_user)):
    return {"ok": True}

@api_router.post("/push/unsubscribe")
async def unsubscribe_push(payload: PushSubscriptionIn, user=Depends(require_user)):
    return {"ok": True}


# ── App setup ─────────────────────────────────────────────────

app.include_router(auth_router)
app.include_router(invite_router)
app.include_router(health_router)
app.include_router(api_router)


@app.on_event("startup")
async def startup():
    dsn = os.environ.get("DATABASE_URL", "NOT SET")
    if "@" in dsn:
        parts = dsn.split("@")
        user_part = parts[0].split("://")[-1].split(":")[0]
        host_part = parts[1]
        logger.info(f"DATABASE_URL format: postgresql://{user_part}:***@{host_part}")
    else:
        logger.info(f"DATABASE_URL: {dsn}")
    logger.info(f"CORS allowed origins: {ALLOWED_ORIGINS}")
    logger.info("Kartavya API starting")


@app.on_event("shutdown")
async def shutdown():
    await close_pool()


def App():
    return app
