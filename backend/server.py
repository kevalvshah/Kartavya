"""
server.py — Kartavya API by Aekam Inc
Database: Supabase PostgreSQL via asyncpg
Auth: JWT (email + password), invite-only
Custom board columns per project (project_columns table)
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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

app = FastAPI(title="Kartavya API", description="Team task management by Aekam Inc")
api_router = APIRouter(prefix="/api")

# ── CORS — registered BEFORE routers ─────────────────────────────────────────
DEFAULT_ORIGINS = [
    "https://kartavya-aekam.vercel.app",
    "https://kartavya-kevalvshah03-6145s-projects.vercel.app",
    "https://kartavya-git-main-kevalvshah03-6145s-projects.vercel.app",
    "http://localhost:3000",
    "http://localhost:8080",
]
_extra = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
ALLOWED_ORIGINS = list(dict.fromkeys(DEFAULT_ORIGINS + _extra))

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helpers ───────────────────────────────────────────────────────────────────

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


async def get_visible_team_ids(pool: asyncpg.Pool, user_id: str, role: Optional[str] = None) -> List[str]:
    """Get visible team IDs based on role-based access control.
    
    - Admins (system-wide): See ALL projects
    - Clients: See ONLY assigned projects (from project_assignments)
    - Members/Owners: See assigned projects (from project_assignments)
    """
    # Check if user is system-wide admin
    user_row = await pool.fetchrow("SELECT role FROM users WHERE user_id=$1", user_id)
    if user_row and user_row.get("role") == "admin":
        # System admin sees ALL projects
        all_teams = await pool.fetch("SELECT team_id FROM teams")
        return [r["team_id"] for r in all_teams]
    
    # For all other users (client, member, owner), use project_assignments
    rows = await pool.fetch(
        "SELECT team_id FROM project_assignments WHERE user_id=$1", user_id
    )
    return [r["team_id"] for r in rows]


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


async def ensure_default_columns(pool, team_id: str):
    """Create 5 default columns for a new project if none exist yet."""
    existing = await pool.fetchval("SELECT COUNT(*) FROM project_columns WHERE team_id=$1", team_id)
    if existing == 0:
        defaults = [
            ("To Do",       "#0082c6", 0, False),
            ("In Progress", "#03a1b6", 1, False),
            ("In Review",   "#8b5cf6", 2, False),
            ("Approval",    "#f59e0b", 3, False),
            ("Done",        "#05b7aa", 4, True),
        ]
        for name, color, order, is_done in defaults:
            await pool.execute(
                "INSERT INTO project_columns (column_id,team_id,name,color,sort_order,is_done) VALUES ($1,$2,$3,$4,$5,$6)",
                f"col_{uuid.uuid4().hex[:12]}", team_id, name, color, order, is_done,
            )


# ── Models ────────────────────────────────────────────────────────────────────

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
    # Approval workflow fields
    approval_status: Optional[str] = None  # 'pending', 'approved', 'rejected', 'pending_client'
    approval_notes: Optional[str] = None
    approved_by: Optional[str] = None
    approval_requested_at: Optional[datetime] = None
    approval_decided_at: Optional[datetime] = None
    requires_approval: bool = False

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
    # "What needs my attention" — surfaced on the dashboard so the workflow is visible
    pending_owner_approval: int = 0   # tasks waiting for me (owner/admin) to approve
    pending_client_approval: int = 0  # tasks I (or my team) sent that the client hasn't reviewed
    awaiting_my_review: int = 0       # tasks where I'm the linked client and approval_status='pending_client'
    rejected_to_revise: int = 0       # tasks rejected, assigned to me, needing rework
    new_client_requests: int = 0      # client task-creation requests waiting for owner triage

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
    def col(key, default=None):
        # Works for asyncpg Record (supports `key in record`) and dict
        try:
            if key in r:
                return r[key]
        except (KeyError, TypeError):
            pass
        return default
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
        approval_status=col("approval_status"),
        approval_notes=col("approval_notes"),
        approved_by=col("approved_by"),
        approval_requested_at=col("approval_requested_at"),
        approval_decided_at=col("approval_decided_at"),
        requires_approval=bool(col("requires_approval", False)),
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@api_router.get("/")
async def root():
    return {"message": "Kartavya API", "by": "Aekam Inc", "status": "ok"}

@api_router.get("/auth/me")
async def me(user=Depends(require_user)):
    return {"user_id": user["user_id"], "email": user["email"], "name": user["name"],
            "role": user.get("role", "member"), "picture": user.get("avatar")}

@api_router.post("/auth/logout")
async def logout(): return {"ok": True}


# ── Project Columns (fully custom per project) ────────────────────────────────

@api_router.get("/projects/{team_id}/columns", response_model=List[ProjectColumnOut])
async def list_columns(team_id: str, pool=Depends(get_db), user=Depends(require_user)):
    mem = await pool.fetchrow(
        "SELECT 1 FROM project_assignments WHERE team_id=$1 AND user_id=$2",
        team_id, user["user_id"]
    )
    if not mem: raise HTTPException(status_code=403, detail="Not a project member")
    await ensure_default_columns(pool, team_id)
    rows = await pool.fetch(
        "SELECT * FROM project_columns WHERE team_id=$1 ORDER BY sort_order ASC", team_id
    )
    return [ProjectColumnOut(**dict(r)) for r in rows]


@api_router.post("/projects/{team_id}/columns", response_model=ProjectColumnOut)
async def create_column(team_id: str, payload: ProjectColumnCreate, pool=Depends(get_db), user=Depends(require_user)):
    mem = await pool.fetchrow(
        "SELECT role FROM project_assignments WHERE team_id=$1 AND user_id=$2",
        team_id, user["user_id"]
    )
    if not mem or mem["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Owner or admin required")
    max_order = await pool.fetchval(
        "SELECT COALESCE(MAX(sort_order), -1) FROM project_columns WHERE team_id=$1", team_id
    )
    column_id = f"col_{uuid.uuid4().hex[:12]}"
    row = await pool.fetchrow(
        "INSERT INTO project_columns (column_id,team_id,name,color,sort_order,is_done) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
        column_id, team_id, payload.name.strip(), payload.color, max_order + 1, payload.is_done,
    )
    return ProjectColumnOut(**dict(row))


@api_router.put("/projects/{team_id}/columns/{column_id}", response_model=ProjectColumnOut)
async def update_column(team_id: str, column_id: str, payload: ProjectColumnUpdate,
                        pool=Depends(get_db), user=Depends(require_user)):
    mem = await pool.fetchrow(
        "SELECT role FROM project_assignments WHERE team_id=$1 AND user_id=$2",
        team_id, user["user_id"]
    )
    if not mem or mem["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403)
    updates, vals = [], []
    if payload.name is not None:       updates.append(f"name=${len(vals)+1}");       vals.append(payload.name.strip())
    if payload.color is not None:      updates.append(f"color=${len(vals)+1}");      vals.append(payload.color)
    if payload.is_done is not None:    updates.append(f"is_done=${len(vals)+1}");    vals.append(payload.is_done)
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
    mem = await pool.fetchrow(
        "SELECT role FROM project_assignments WHERE team_id=$1 AND user_id=$2",
        team_id, user["user_id"]
    )
    if not mem or mem["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403)
    remaining = await pool.fetchval("SELECT COUNT(*) FROM project_columns WHERE team_id=$1", team_id)
    if remaining <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the last column — a board needs at least one column")
    # Move tasks to the first remaining column
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
    mem = await pool.fetchrow(
        "SELECT role FROM project_assignments WHERE team_id=$1 AND user_id=$2",
        team_id, user["user_id"]
    )
    if not mem or mem["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403)
    for idx, cid in enumerate(body.get("ordered_ids", [])):
        await pool.execute(
            "UPDATE project_columns SET sort_order=$1 WHERE column_id=$2 AND team_id=$3",
            idx, cid, team_id
        )
    return {"ok": True}


# ── Client portal ─────────────────────────────────────────────────────────────

@api_router.get("/client/tasks", response_model=List[TaskOut])
async def client_tasks(pool=Depends(get_db), user=Depends(require_user)):
    # Get all tasks from projects the client is assigned to
    rows = await pool.fetch(
        "SELECT t.* FROM tasks t JOIN project_assignments pa ON pa.team_id = t.team_id WHERE pa.user_id=$1 ORDER BY t.updated_at DESC",
        user["user_id"],
    )
    return [row_to_task(r) for r in rows]

@api_router.get("/client/projects")
async def client_projects(pool=Depends(get_db), user=Depends(require_user)):
    """Get projects assigned to client - shows same projects as team members see"""
    rows = await pool.fetch(
        """SELECT t.* FROM teams t 
           JOIN project_assignments pa ON pa.team_id = t.team_id 
           WHERE pa.user_id=$1 
           ORDER BY t.created_at DESC""",
        user["user_id"]
    )
    return [dict(r) for r in rows]

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


# ── Client Approval Workflow ──────────────────────────────────────────────────

@api_router.post("/client/tasks/request")
async def client_request_task(payload: TaskCreate, pool=Depends(get_db), user=Depends(require_user)):
    """Client creates task - requires owner/admin approval"""
    if not payload.team_id:
        raise HTTPException(status_code=400, detail="team_id required")
    
    assignment = await pool.fetchrow(
        "SELECT role FROM project_assignments WHERE team_id=$1 AND user_id=$2",
        payload.team_id, user["user_id"]
    )
    if not assignment or assignment["role"] != "client":
        raise HTTPException(status_code=403, detail="Clients only")
    
    approval_id = f"approval_{uuid.uuid4().hex[:12]}"
    await pool.execute(
        "INSERT INTO approvals (approval_id, team_id, requested_by, status, request_type, request_data) VALUES ($1, $2, $3, 'pending', 'create', $4)",
        approval_id, payload.team_id, user["user_id"], json.dumps(payload.model_dump())
    )
    return {"approval_id": approval_id, "status": "pending", "message": "Task submitted for approval"}


@api_router.get("/approvals/pending")
async def list_pending_approvals(pool=Depends(get_db), user=Depends(require_user)):
    """List pending approvals for owner/admin"""
    rows = await pool.fetch(
        """SELECT a.*, u.email as requested_by_email, u.name as requested_by_name
           FROM approvals a 
           JOIN users u ON u.user_id = a.requested_by
           WHERE a.status = 'pending'
           AND EXISTS (
             SELECT 1 FROM project_assignments 
             WHERE team_id = a.team_id AND user_id = $1 AND role IN ('owner', 'admin')
           )
           ORDER BY a.created_at DESC""",
        user["user_id"]
    )
    return [dict(r) for r in rows]


@api_router.post("/approvals/{approval_id}/review")
async def review_approval(approval_id: str, body: dict, pool=Depends(get_db), user=Depends(require_user)):
    """Approve/reject client task"""
    status = body.get("status")
    notes = body.get("notes", "")
    
    if status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="status must be 'approved' or 'rejected'")
    
    approval = await pool.fetchrow("SELECT * FROM approvals WHERE approval_id=$1", approval_id)
    if not approval:
        raise HTTPException(status_code=404)
    
    mem = await pool.fetchrow(
        "SELECT role FROM project_assignments WHERE team_id=$1 AND user_id=$2",
        approval["team_id"], user["user_id"]
    )
    if not mem or mem["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403)
    
    await pool.execute(
        "UPDATE approvals SET status=$1, reviewed_by=$2, reviewed_at=NOW(), review_notes=$3 WHERE approval_id=$4",
        status, user["user_id"], notes, approval_id
    )
    
    if status == "approved" and approval["request_type"] == "create":
        data = json.loads(approval["request_data"])
        task_id = f"task_{uuid.uuid4().hex[:12]}"
        col = await pool.fetchval(
            "SELECT column_id FROM project_columns WHERE team_id=$1 ORDER BY sort_order LIMIT 1",
            approval["team_id"]
        )
        await pool.execute(
            """INSERT INTO tasks (task_id, team_id, column_id, created_by_user_id, title, description, status, priority, approval_id)
               VALUES ($1, $2, $3, $4, $5, $6, 'todo', $7, $8)""",
            task_id, approval["team_id"], col, approval["requested_by"],
            data["title"], data.get("description"), data.get("priority", "medium"), approval_id
        )
    
    return {"ok": True, "status": status}


# ── Comments ──────────────────────────────────────────────────────────────────

async def _client_can_access_task(pool, user_id: str, task_id: str) -> bool:
    """A client can access a task if they're either explicitly linked (task_clients)
    or assigned to the project that owns the task (project_assignments)."""
    direct = await pool.fetchrow(
        "SELECT 1 FROM task_clients WHERE task_id=$1 AND user_id=$2", task_id, user_id
    )
    if direct:
        return True
    via_project = await pool.fetchrow(
        "SELECT 1 FROM tasks t JOIN project_assignments pa ON pa.team_id = t.team_id "
        "WHERE t.task_id=$1 AND pa.user_id=$2", task_id, user_id,
    )
    return bool(via_project)


@api_router.get("/tasks/{task_id}/comments", response_model=List[CommentOut])
async def list_comments(task_id: str, pool=Depends(get_db), user=Depends(require_user)):
    if user.get("role") == "client":
        if not await _client_can_access_task(pool, user["user_id"], task_id):
            raise HTTPException(status_code=403)
    rows = await pool.fetch(
        "SELECT c.comment_id,c.task_id,c.user_id,u.name AS user_name,c.body,c.created_at "
        "FROM task_comments c JOIN users u ON u.user_id=c.user_id WHERE c.task_id=$1 ORDER BY c.created_at ASC",
        task_id,
    )
    return [CommentOut(**dict(r)) for r in rows]

@api_router.post("/tasks/{task_id}/comments", response_model=CommentOut)
async def add_comment(task_id: str, body: CommentCreate, pool=Depends(get_db), user=Depends(require_user)):
    if user.get("role") == "client":
        if not await _client_can_access_task(pool, user["user_id"], task_id):
            raise HTTPException(status_code=403)
    comment_id = f"cmt_{uuid.uuid4().hex[:12]}"
    row = await pool.fetchrow(
        "INSERT INTO task_comments (comment_id,task_id,user_id,body) VALUES ($1,$2,$3,$4) RETURNING *",
        comment_id, task_id, user["user_id"], body.body,
    )
    # Notify everyone involved in the task except the commenter
    try:
        task = await pool.fetchrow("SELECT title, team_id, created_by_user_id, assignee_user_ids FROM tasks WHERE task_id=$1", task_id)
        if task:
            recipients = set()
            if task["created_by_user_id"] and task["created_by_user_id"] != user["user_id"]:
                recipients.add(task["created_by_user_id"])
            for uid in (task["assignee_user_ids"] or []):
                if uid != user["user_id"]:
                    recipients.add(uid)
            # also notify project clients
            client_rows = await pool.fetch("SELECT user_id FROM task_clients WHERE task_id=$1", task_id)
            for cr in client_rows:
                if cr["user_id"] != user["user_id"]:
                    recipients.add(cr["user_id"])
            preview = body.body[:140] + ("…" if len(body.body) > 140 else "")
            for rid in recipients:
                await create_notification(pool, rid, "comment", f"New comment on {task['title']}",
                                          f"{user['name']}: {preview}", task_id, task["team_id"], "/tasks")
    except Exception as e:
        logger.warning(f"Failed to fan-out comment notifications: {e}")
    return CommentOut(comment_id=row["comment_id"], task_id=row["task_id"], user_id=row["user_id"],
                      user_name=user["name"], body=row["body"], created_at=row["created_at"])


# ── Teams (Projects) ──────────────────────────────────────────────────────────

@api_router.get("/teams", response_model=List[TeamOut])
async def list_teams(pool=Depends(get_db), user=Depends(require_user)):
    team_ids = await get_visible_team_ids(pool, user["user_id"])
    if not team_ids: return []
    rows = await pool.fetch("SELECT * FROM teams WHERE team_id=ANY($1::text[]) ORDER BY updated_at DESC", team_ids)
    return [TeamOut(**dict(r)) for r in rows]

@api_router.post("/teams", response_model=TeamOut)
async def create_team(payload: TeamCreate, pool=Depends(get_db), user=Depends(require_user)):
    team_id = f"team_{uuid.uuid4().hex[:12]}"
    row = await pool.fetchrow(
        "INSERT INTO teams (team_id,name,created_by) VALUES ($1,$2,$3) RETURNING *",
        team_id, payload.name, user["user_id"]
    )
    # Add to team_members (legacy)
    await pool.execute(
        "INSERT INTO team_members (member_id,team_id,email,user_id,role,status) VALUES ($1,$2,$3,$4,'owner','active')",
        f"mem_{uuid.uuid4().hex[:12]}", team_id, user["email"], user["user_id"]
    )
    # Add to project_assignments (new role-based system)
    await pool.execute(
        "INSERT INTO project_assignments (assignment_id,team_id,user_id,role,assigned_by) VALUES ($1,$2,$3,'owner',$4)",
        f"assign_{uuid.uuid4().hex[:12]}", team_id, user["user_id"], user["user_id"]
    )
    # Always seed 5 default columns for every new project
    await ensure_default_columns(pool, team_id)
    return TeamOut(**dict(row))


@api_router.delete("/teams/{team_id}")
async def delete_team(team_id: str, pool=Depends(get_db), user=Depends(require_user)):
    """Delete a project. Allowed for the project's owner/admin or a system admin.
    Cascades through every related table explicitly so we don't depend on the
    schema's FK rules being uniformly ON DELETE CASCADE."""
    # Permission check: system admin can delete anything; otherwise must be project owner/admin
    if user.get("role") != "admin":
        mem = await pool.fetchrow(
            "SELECT role FROM project_assignments WHERE team_id=$1 AND user_id=$2",
            team_id, user["user_id"],
        )
        if not mem or mem["role"] not in ("owner", "admin"):
            raise HTTPException(status_code=403, detail="Only the project owner can delete it")

    team = await pool.fetchrow("SELECT team_id, name FROM teams WHERE team_id=$1", team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Project not found")

    # Wipe in dependency order. Use a transaction so partial failure doesn't leave orphans.
    async with pool.acquire() as conn:
        async with conn.transaction():
            # Children of tasks first
            await conn.execute(
                "DELETE FROM task_comments WHERE task_id IN (SELECT task_id FROM tasks WHERE team_id=$1)",
                team_id,
            )
            await conn.execute(
                "DELETE FROM task_clients WHERE task_id IN (SELECT task_id FROM tasks WHERE team_id=$1)",
                team_id,
            )
            # Approval records (defensive — table may or may not exist depending on migrations)
            try:
                await conn.execute(
                    "DELETE FROM approvals WHERE task_id IN (SELECT task_id FROM tasks WHERE team_id=$1) OR team_id=$1",
                    team_id,
                )
            except Exception:
                pass
            # Notifications attached to tasks in this team or to the team itself
            try:
                await conn.execute(
                    "DELETE FROM notifications WHERE team_id=$1 OR task_id IN (SELECT task_id FROM tasks WHERE team_id=$1)",
                    team_id,
                )
            except Exception:
                pass
            # Tasks themselves
            await conn.execute("DELETE FROM tasks WHERE team_id=$1", team_id)
            # Project structure
            await conn.execute("DELETE FROM project_columns WHERE team_id=$1", team_id)
            # Membership / assignments
            await conn.execute("DELETE FROM team_members WHERE team_id=$1", team_id)
            await conn.execute("DELETE FROM project_assignments WHERE team_id=$1", team_id)
            # Finally the team row
            await conn.execute("DELETE FROM teams WHERE team_id=$1", team_id)

    logger.info(f"Project deleted: {team['name']} ({team_id}) by {user['user_id']}")
    return {"ok": True, "deleted_team_id": team_id}


@api_router.get("/teams/{team_id}")
async def get_team(team_id: str, pool=Depends(get_db), user=Depends(require_user)):
    mem = await pool.fetchrow(
        "SELECT * FROM project_assignments WHERE team_id=$1 AND user_id=$2",
        team_id, user["user_id"]
    )
    if not mem: raise HTTPException(status_code=403, detail="Not a team member")
    team = await pool.fetchrow("SELECT * FROM teams WHERE team_id=$1", team_id)
    members = await pool.fetch("SELECT * FROM team_members WHERE team_id=$1 ORDER BY created_at ASC", team_id)
    return {"team": dict(team), "members": [dict(m) for m in members], "your_role": mem["role"]}

@api_router.post("/teams/{team_id}/members", response_model=TeamMemberOut)
async def add_team_member(team_id: str, payload: TeamMemberAdd, pool=Depends(get_db), user=Depends(require_user)):
    mem = await pool.fetchrow("SELECT role FROM project_assignments WHERE team_id=$1 AND user_id=$2", team_id, user["user_id"])
    if not mem or mem["role"] not in ("owner", "admin"): raise HTTPException(status_code=403)
    email = payload.email.strip().lower()
    existing_user = await pool.fetchrow("SELECT user_id FROM users WHERE email=$1", email)
    uid = existing_user["user_id"] if existing_user else None
    # Delete from both tables if exists
    await pool.execute("DELETE FROM team_members WHERE team_id=$1 AND email=$2", team_id, email)
    await pool.execute("DELETE FROM project_assignments WHERE team_id=$1 AND user_id=$2", team_id, uid) if uid else None
    # Add to team_members (legacy)
    row = await pool.fetchrow(
        "INSERT INTO team_members (member_id,team_id,email,user_id,role,status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
        f"mem_{uuid.uuid4().hex[:12]}", team_id, email, uid, payload.role, "active" if uid else "invited"
    )
    # Add to project_assignments (new) if user exists
    if uid:
        await pool.execute(
            "INSERT INTO project_assignments (assignment_id,team_id,user_id,role,assigned_by) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (team_id, user_id) DO UPDATE SET role=EXCLUDED.role",
            f"assign_{uuid.uuid4().hex[:12]}", team_id, uid, payload.role, user["user_id"]
        )
    else:
        # New user — issue an invite and email it. Map team-member role to invite role.
        invite_role = "client" if payload.role == "client" else "member"
        try:
            import secrets as _secrets
            from datetime import timedelta as _td
            # Invalidate previous pending invites for the same email
            await pool.execute(
                "UPDATE invites SET expires_at=NOW() WHERE email=$1 AND accepted_at IS NULL", email
            )
            token = _secrets.token_urlsafe(32)
            invite_id = f"inv_{uuid.uuid4().hex[:12]}"
            expires_at = now_utc() + _td(days=7)
            await pool.execute(
                "INSERT INTO invites (invite_id,email,role,token,invited_by,expires_at) VALUES ($1,$2,$3,$4,$5,$6)",
                invite_id, email, invite_role, token, user["user_id"], expires_at,
            )
            from email_service import send_team_invite_email
            team_row = await pool.fetchrow("SELECT name FROM teams WHERE team_id=$1", team_id)
            send_team_invite_email(
                to_email=email,
                team_name=(team_row["name"] if team_row else "Kartavya"),
                inviter_name=user.get("name") or user.get("email") or "your teammate",
                invite_token=token,
            )
        except Exception as e:
            logger.warning(f"Could not send team invite email to {email}: {e}")
    return TeamMemberOut(**dict(row))

@api_router.put("/teams/{team_id}/members/{member_id}", response_model=TeamMemberOut)
async def update_team_member(team_id: str, member_id: str, payload: TeamMemberUpdate,
                              pool=Depends(get_db), user=Depends(require_user)):
    mem = await pool.fetchrow("SELECT role FROM project_assignments WHERE team_id=$1 AND user_id=$2", team_id, user["user_id"])
    if not mem or mem["role"] not in ("owner", "admin"): raise HTTPException(status_code=403)
    updates, vals = [], []
    if payload.role:   updates.append(f"role=${len(vals)+1}");   vals.append(payload.role)
    if payload.status: updates.append(f"status=${len(vals)+1}"); vals.append(payload.status)
    updates.append(f"updated_at=${len(vals)+1}"); vals.append(now_utc())
    vals += [team_id, member_id]
    row = await pool.fetchrow(
        f"UPDATE team_members SET {', '.join(updates)} WHERE team_id=${len(vals)-1} AND member_id=${len(vals)} RETURNING *",
        *vals
    )
    if not row: raise HTTPException(status_code=404)
    # Also update project_assignments if role changed and user_id exists
    if payload.role and row["user_id"]:
        await pool.execute(
            "UPDATE project_assignments SET role=$1 WHERE team_id=$2 AND user_id=$3",
            payload.role, team_id, row["user_id"]
        )
    return TeamMemberOut(**dict(row))

@api_router.delete("/teams/{team_id}/members/{member_id}")
async def remove_team_member(team_id: str, member_id: str, pool=Depends(get_db), user=Depends(require_user)):
    mem = await pool.fetchrow("SELECT role FROM project_assignments WHERE team_id=$1 AND user_id=$2", team_id, user["user_id"])
    if not mem or mem["role"] not in ("owner", "admin"): raise HTTPException(status_code=403)
    # Get user_id before deleting
    member = await pool.fetchrow("SELECT user_id FROM team_members WHERE team_id=$1 AND member_id=$2", team_id, member_id)
    # Delete from team_members
    await pool.execute("DELETE FROM team_members WHERE team_id=$1 AND member_id=$2", team_id, member_id)
    # Delete from project_assignments if user_id exists
    if member and member["user_id"]:
        await pool.execute("DELETE FROM project_assignments WHERE team_id=$1 AND user_id=$2", team_id, member["user_id"])
    return {"ok": True}


# ── Categories ────────────────────────────────────────────────────────────────

@api_router.get("/categories", response_model=List[CategoryOut])
async def list_categories(pool=Depends(get_db), user=Depends(require_user)):
    rows = await pool.fetch("SELECT * FROM categories WHERE user_id=$1 ORDER BY updated_at DESC", user["user_id"])
    return [CategoryOut(**dict(r)) for r in rows]

@api_router.post("/categories", response_model=CategoryOut)
async def create_category(payload: CategoryCreate, pool=Depends(get_db), user=Depends(require_user)):
    row = await pool.fetchrow(
        "INSERT INTO categories (category_id,user_id,name,color) VALUES ($1,$2,$3,$4) RETURNING *",
        f"cat_{uuid.uuid4().hex[:12]}", user["user_id"], payload.name, payload.color
    )
    return CategoryOut(**dict(row))

@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str, pool=Depends(get_db), user=Depends(require_user)):
    await pool.execute("UPDATE tasks SET category_id=NULL,updated_at=NOW() WHERE user_id=$1 AND category_id=$2", user["user_id"], category_id)
    await pool.execute("DELETE FROM categories WHERE user_id=$1 AND category_id=$2", user["user_id"], category_id)
    return {"ok": True}


# ── Tasks ─────────────────────────────────────────────────────────────────────

@api_router.get("/tasks", response_model=List[TaskOut])
async def list_tasks(status: Optional[str]=None, category_id: Optional[str]=None,
                     q: Optional[str]=None, team_id: Optional[str]=None,
                     assigned_to_me: Optional[bool]=None,
                     pool=Depends(get_db), user=Depends(require_user)):
    team_ids = await get_visible_team_ids(pool, user["user_id"])
    conditions = ["(t.user_id=$1 OR t.team_id=ANY($2::text[]))"]
    vals: list = [user["user_id"], team_ids]
    if team_id:        conditions.append(f"t.team_id=${len(vals)+1}");       vals.append(team_id)
    if status:         conditions.append(f"t.status=${len(vals)+1}");         vals.append(status)
    if category_id:    conditions.append(f"t.category_id=${len(vals)+1}");   vals.append(category_id)
    if q:              conditions.append(f"t.title ILIKE ${len(vals)+1}");    vals.append(f"%{q}%")
    if assigned_to_me: conditions.append(f"${len(vals)+1}=ANY(t.assignee_user_ids)"); vals.append(user["user_id"])
    rows = await pool.fetch(
        f"SELECT * FROM tasks t WHERE {' AND '.join(conditions)} ORDER BY t.sort_order ASC", *vals
    )
    return [row_to_task(r) for r in rows]


@api_router.post("/tasks", response_model=TaskOut)
async def create_task(payload: TaskCreate, pool=Depends(get_db), user=Depends(require_user)):
    if payload.team_id:
        mem = await pool.fetchrow("SELECT 1 FROM project_assignments WHERE team_id=$1 AND user_id=$2", payload.team_id, user["user_id"])
        if not mem: raise HTTPException(status_code=403)
        user_id_field, scope_col, scope_val = None, "team_id", payload.team_id
    else:
        user_id_field, scope_col, scope_val = user["user_id"], "user_id", user["user_id"]

    # Resolve column — if not provided, use the first column of the project
    column_id = payload.column_id
    if not column_id and payload.team_id:
        first_col = await pool.fetchrow(
            "SELECT column_id FROM project_columns WHERE team_id=$1 ORDER BY sort_order ASC LIMIT 1",
            payload.team_id
        )
        column_id = first_col["column_id"] if first_col else None

    # Derive status from column's is_done flag
    status = payload.status or "todo"
    if column_id:
        col = await pool.fetchrow("SELECT is_done FROM project_columns WHERE column_id=$1", column_id)
        if col and col["is_done"]:
            status = "done"

    due_dt = parse_dt(payload.due_at)
    reminder_dt = parse_dt(payload.reminder_at) or (due_dt - timedelta(hours=2) if due_dt else None)
    max_row = await pool.fetchrow(
        f"SELECT MAX(sort_order) AS mo FROM tasks WHERE {scope_col}=$1 AND column_id=$2",
        scope_val, column_id
    )
    next_order = (max_row["mo"] or -1) + 1
    task_id = f"task_{uuid.uuid4().hex[:12]}"
    row = await pool.fetchrow("""
        INSERT INTO tasks
          (task_id,user_id,team_id,column_id,created_by_user_id,assigned_by_user_id,
           title,description,status,priority,category_id,tags,assignee_user_ids,assignee_emails,
           due_at,reminder_at,recurrence_rule,recurrence_interval,estimated_minutes,
           attachments,custom_fields,subtasks,sort_order)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::text[],$13::text[],$14::text[],
                $15,$16,$17,$18,$19,$20::jsonb,$21::jsonb,$22::jsonb,$23)
        RETURNING *""",
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
        next_order
    )
    # Notify assignees (in-app + email)
    team_name = None
    if payload.team_id:
        team_row = await pool.fetchrow("SELECT name FROM teams WHERE team_id=$1", payload.team_id)
        team_name = team_row["name"] if team_row else None
    for uid in set(payload.assignee_user_ids or []):
        if uid == user["user_id"]:
            continue  # don't notify the creator about their own assignment
        await create_notification(pool, uid, "assigned", "Task assigned",
                                  f"You were assigned: {payload.title}", task_id, payload.team_id, "/tasks")
        try:
            from email_service import send_task_assignment_email
            assignee = await pool.fetchrow("SELECT email, name FROM users WHERE user_id=$1", uid)
            if assignee:
                send_task_assignment_email(assignee["email"], assignee["name"] or assignee["email"],
                                            payload.title, task_id, team_name)
        except Exception as e:
            logger.warning(f"Failed to send assignment email to {uid}: {e}")
    return row_to_task(row)


@api_router.get("/tasks/{task_id}", response_model=TaskOut)
async def get_task(task_id: str, pool=Depends(get_db), user=Depends(require_user)):
    """Fetch a single task. Visible to: project members, task creator, assignees, linked clients, system admin."""
    row = await pool.fetchrow("SELECT * FROM tasks WHERE task_id=$1", task_id)
    if not row:
        raise HTTPException(status_code=404)
    # Authorization
    if user.get("role") == "admin":
        return row_to_task(row)
    if row["created_by_user_id"] == user["user_id"]:
        return row_to_task(row)
    if user["user_id"] in (row["assignee_user_ids"] or []):
        return row_to_task(row)
    # Project member?
    if row["team_id"]:
        team_ids = await get_visible_team_ids(pool, user["user_id"])
        if row["team_id"] in team_ids:
            return row_to_task(row)
    # Linked client?
    client_link = await pool.fetchrow(
        "SELECT 1 FROM task_clients WHERE task_id=$1 AND user_id=$2", task_id, user["user_id"]
    )
    if client_link:
        return row_to_task(row)
    raise HTTPException(status_code=403, detail="Not authorized to view this task")


@api_router.put("/tasks/{task_id}", response_model=TaskOut)
async def update_task(task_id: str, payload: TaskUpdate, pool=Depends(get_db), user=Depends(require_user)):
    team_ids = await get_visible_team_ids(pool, user["user_id"])
    existing = await pool.fetchrow(
        "SELECT * FROM tasks WHERE task_id=$1 AND (user_id=$2 OR team_id=ANY($3::text[]))",
        task_id, user["user_id"], team_ids
    )
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
    if "due_at"      in data: updates.append(f"due_at=${len(vals)+1}");      vals.append(parse_dt(data["due_at"]))
    if "reminder_at" in data: updates.append(f"reminder_at=${len(vals)+1}"); vals.append(parse_dt(data["reminder_at"]))
    if "recurrence" in data and data["recurrence"]:
        rec = data["recurrence"]
        updates.append(f"recurrence_rule=${len(vals)+1}");     vals.append(rec.get("rule","none") if isinstance(rec,dict) else rec.rule)
        updates.append(f"recurrence_interval=${len(vals)+1}"); vals.append(rec.get("interval",1) if isinstance(rec,dict) else rec.interval)
    # If column changed, sync status
    if "column_id" in data and data["column_id"]:
        col = await pool.fetchrow("SELECT is_done FROM project_columns WHERE column_id=$1", data["column_id"])
        if col and col["is_done"] and "status" not in data:
            updates.append(f"status=${len(vals)+1}"); vals.append("done")
    updates.append(f"updated_at=${len(vals)+1}"); vals.append(now_utc())
    vals.append(task_id)
    row = await pool.fetchrow(
        f"UPDATE tasks SET {', '.join(updates)} WHERE task_id=${len(vals)} RETURNING *", *vals
    )
    return row_to_task(row)


@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, pool=Depends(get_db), user=Depends(require_user)):
    team_ids = await get_visible_team_ids(pool, user["user_id"])
    doc = await pool.fetchrow(
        "SELECT * FROM tasks WHERE task_id=$1 AND (user_id=$2 OR team_id=ANY($3::text[]))",
        task_id, user["user_id"], team_ids
    )
    if not doc: raise HTTPException(status_code=404)
    await pool.execute("DELETE FROM tasks WHERE task_id=$1", task_id)
    return {"ok": True}


@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...), user=Depends(require_user)):
    """Upload an attachment (max 5MB). Backend is pluggable: inline base64 by
    default, S3/R2/B2 if STORAGE_BACKEND=s3 is configured."""
    contents = await file.read()
    try:
        from storage import store_upload
        result = await store_upload(contents, file.filename or "upload")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    logger.info(f"Upload: {result['name']} ({result['size']} bytes) by {user['user_id']} key={result.get('key')}")
    return result


@api_router.get("/attachments/sign")
async def sign_attachment(key: str, user=Depends(require_user)):
    """Reissue a fresh signed download URL for an object-storage attachment.
    Inline attachments don't need this — their data URL is self-contained."""
    from storage import get_download_url
    url = get_download_url(key)
    if not url:
        raise HTTPException(status_code=404, detail="Object storage not configured or invalid key")
    return {"url": url, "key": key}


@api_router.patch("/tasks/{task_id}/toggle", response_model=TaskOut)
async def toggle_task(task_id: str, pool=Depends(get_db), user=Depends(require_user)):
    team_ids = await get_visible_team_ids(pool, user["user_id"])
    doc = await pool.fetchrow(
        "SELECT * FROM tasks WHERE task_id=$1 AND (user_id=$2 OR team_id=ANY($3::text[]))",
        task_id, user["user_id"], team_ids
    )
    if not doc: raise HTTPException(status_code=404)
    old_status = doc["status"]
    new_status = "todo" if old_status == "done" else "done"
    row = await pool.fetchrow(
        "UPDATE tasks SET status=$1,completed_at=$2,completed_by_user_id=$3,updated_at=NOW() WHERE task_id=$4 RETURNING *",
        new_status,
        now_utc() if new_status == "done" else None,
        user["user_id"] if new_status == "done" else None,
        task_id
    )
    return row_to_task(row)


@api_router.patch("/tasks/{task_id}/move", response_model=TaskOut)
async def move_task(task_id: str, payload: TaskMoveIn, pool=Depends(get_db), user=Depends(require_user)):
    """Move a task to a different column. Status is derived from the column's is_done flag."""
    team_ids = await get_visible_team_ids(pool, user["user_id"])
    doc = await pool.fetchrow(
        "SELECT * FROM tasks WHERE task_id=$1 AND (user_id=$2 OR team_id=ANY($3::text[]))",
        task_id, user["user_id"], team_ids
    )
    if not doc: raise HTTPException(status_code=404)
    col = await pool.fetchrow("SELECT * FROM project_columns WHERE column_id=$1", payload.column_id)
    new_status = "done" if (col and col["is_done"]) else ("in_progress" if doc["status"] == "done" else doc["status"])
    completed_at = now_utc() if new_status == "done" else None
    completed_by = user["user_id"] if new_status == "done" else None
    row = await pool.fetchrow(
        "UPDATE tasks SET column_id=$1,status=$2,sort_order=$3,completed_at=$4,completed_by_user_id=$5,updated_at=NOW() WHERE task_id=$6 RETURNING *",
        payload.column_id, new_status, payload.order, completed_at, completed_by, task_id
    )
    return row_to_task(row)


# ── Notifications ─────────────────────────────────────────────────────────────

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
        user["user_id"], team_ids, now_utc()
    )
    for t in rows:
        recipients = set(t["assignee_user_ids"] or [])
        if not recipients and t["user_id"]: recipients.add(t["user_id"])
        for uid in recipients:
            await create_notification(pool, uid, "reminder", "Task reminder",
                                      f"Due soon: {t['title']}", t["task_id"], t["team_id"], "/tasks")
            # Email reminder — best-effort
            try:
                from email_service import send_task_reminder_email
                u = await pool.fetchrow("SELECT email, name FROM users WHERE user_id=$1", uid)
                if u:
                    due_label = t["due_at"].strftime("%b %d, %Y at %I:%M %p UTC") if t["due_at"] else "soon"
                    send_task_reminder_email(
                        u["email"], u["name"] or u["email"],
                        t["title"], t["task_id"], due_label,
                    )
            except Exception as e:
                logger.warning(f"Reminder email failed for user {uid} task {t['task_id']}: {e}")
        await pool.execute("UPDATE tasks SET reminder_sent_at=NOW(),updated_at=NOW() WHERE task_id=$1", t["task_id"])
    return {"ok": True, "created": len(rows)}


# ── Dashboard ─────────────────────────────────────────────────────────────────

@api_router.get("/dashboard/summary", response_model=DashboardSummaryOut)
async def dashboard_summary(pool=Depends(get_db), user=Depends(require_user)):
    team_ids = await get_visible_team_ids(pool, user["user_id"])
    now = now_utc()
    base = "(user_id=$1 OR team_id=ANY($2::text[]))"
    todo        = await pool.fetchval(f"SELECT COUNT(*) FROM tasks WHERE {base} AND status='todo'",        user["user_id"], team_ids)
    in_progress = await pool.fetchval(f"SELECT COUNT(*) FROM tasks WHERE {base} AND status='in_progress'", user["user_id"], team_ids)
    done        = await pool.fetchval(f"SELECT COUNT(*) FROM tasks WHERE {base} AND status='done'",        user["user_id"], team_ids)
    overdue     = await pool.fetchval(f"SELECT COUNT(*) FROM tasks WHERE {base} AND status!='done' AND due_at<$3",                       user["user_id"], team_ids, now)
    due_24h     = await pool.fetchval(f"SELECT COUNT(*) FROM tasks WHERE {base} AND status!='done' AND due_at>=$3 AND due_at<$4",        user["user_id"], team_ids, now, now+timedelta(hours=24))

    # "What needs my attention" rollups
    role = user.get("role")
    is_admin = role == "admin"

    # Tasks waiting for owner approval — visible to project owners/admins on those projects
    if is_admin:
        pending_owner = await pool.fetchval(
            "SELECT COUNT(*) FROM tasks WHERE approval_status='pending'"
        )
        new_client_reqs = await pool.fetchval(
            "SELECT COUNT(*) FROM approvals WHERE status='pending'"
        ) or 0
    else:
        # only on projects where the user is owner
        owner_team_ids = await pool.fetch(
            "SELECT team_id FROM project_assignments WHERE user_id=$1 AND role IN ('owner','admin')",
            user["user_id"],
        )
        otids = [r["team_id"] for r in owner_team_ids]
        if otids:
            pending_owner = await pool.fetchval(
                "SELECT COUNT(*) FROM tasks WHERE approval_status='pending' AND team_id=ANY($1::text[])",
                otids,
            )
            new_client_reqs = await pool.fetchval(
                "SELECT COUNT(*) FROM approvals WHERE status='pending' AND team_id=ANY($1::text[])",
                otids,
            ) or 0
        else:
            pending_owner = 0
            new_client_reqs = 0

    # Tasks I sent for client approval that are still waiting
    pending_client = await pool.fetchval(
        f"SELECT COUNT(*) FROM tasks WHERE {base} AND approval_status='pending_client'",
        user["user_id"], team_ids,
    )

    # Tasks where I'm the linked client and need to review
    awaiting_my_review = 0
    if role == "client":
        awaiting_my_review = await pool.fetchval(
            "SELECT COUNT(DISTINCT t.task_id) FROM tasks t "
            "LEFT JOIN task_clients tc ON tc.task_id = t.task_id AND tc.user_id = $1 "
            "LEFT JOIN project_assignments pa ON pa.team_id = t.team_id AND pa.user_id = $1 "
            "WHERE t.approval_status='pending_client' AND (tc.user_id IS NOT NULL OR pa.user_id IS NOT NULL)",
            user["user_id"],
        ) or 0

    # Rejected tasks I'm assigned to (need rework)
    rejected_to_revise = await pool.fetchval(
        f"SELECT COUNT(*) FROM tasks WHERE approval_status='rejected' AND $1 = ANY(assignee_user_ids)",
        user["user_id"],
    ) or 0

    return DashboardSummaryOut(
        todo=todo, in_progress=in_progress, done=done, overdue=overdue, due_24h=due_24h,
        pending_owner_approval=pending_owner or 0,
        pending_client_approval=pending_client or 0,
        awaiting_my_review=awaiting_my_review,
        rejected_to_revise=rejected_to_revise,
        new_client_requests=new_client_reqs,
    )


@api_router.get("/push/vapid-public-key")
async def get_vapid_public_key(user=Depends(require_user)):
    return {"public_key": "not-configured"}

@api_router.post("/push/subscribe")
async def subscribe_push(payload: PushSubscriptionIn, user=Depends(require_user)):
    return {"ok": True}

@api_router.post("/push/unsubscribe")
async def unsubscribe_push(payload: PushSubscriptionIn, user=Depends(require_user)):
    return {"ok": True}


# ── App setup ─────────────────────────────────────────────────────────────────

app.include_router(auth_router)
app.include_router(invite_router)
app.include_router(approvals_router)
app.include_router(health_router)
app.include_router(api_router)


@app.on_event("startup")
async def startup():
    dsn = os.environ.get("DATABASE_URL", "NOT SET")
    if "@" in dsn:
        parts = dsn.split("@")
        user_part = parts[0].split("://")[-1].split(":")[0]
        host_part = parts[1]
        logger.info(f"DATABASE_URL: postgresql://{user_part}:***@{host_part}")
    else:
        logger.info(f"DATABASE_URL: {dsn}")
    logger.info(f"CORS origins: {ALLOWED_ORIGINS}")
    logger.info("Kartavya API ready — custom columns enabled")


@app.on_event("shutdown")
async def shutdown():
    await close_pool()


def App():
    return app
