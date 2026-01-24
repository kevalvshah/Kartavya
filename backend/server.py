import os
import uuid
import logging
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional
from datetime import datetime, timedelta, timezone

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Response, Request
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

mongo_url = os.environ.get("MONGO_URL")
if not mongo_url:
    raise RuntimeError("MONGO_URL missing")

client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get("DB_NAME", "test_database")]

app = FastAPI()
api_router = APIRouter(prefix="/api")


# -----------------------------
# Helpers
# -----------------------------

def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso_or_none(dt: Optional[datetime]) -> Optional[str]:
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


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


def get_session_token_from_request(request: Request) -> Optional[str]:
    # Primary: httpOnly cookie
    token = request.cookies.get("session_token")
    if token:
        return token

    # Fallback: Authorization header (Bearer)
    auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        return auth_header.split(" ", 1)[1].strip()

    return None


async def get_current_user(request: Request) -> Dict[str, Any]:
    token = get_session_token_from_request(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session_doc = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session_doc.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if not isinstance(expires_at, datetime) or expires_at < now_utc():
        await db.user_sessions.delete_one({"session_token": token})
        raise HTTPException(status_code=401, detail="Session expired")

    user_doc = await db.users.find_one({"user_id": session_doc["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")

    return user_doc


async def normalize_orders(user_id: str, status: str) -> None:
    tasks = (
        await db.tasks.find({"user_id": user_id, "status": status}, {"_id": 0})
        .sort([("order", 1), ("updated_at", 1)])
        .to_list(5000)
    )
    bulk_ops = []
    for idx, t in enumerate(tasks):
        if t.get("order") != idx:
            bulk_ops.append((t["task_id"], idx))

    for task_id, new_order in bulk_ops:
        await db.tasks.update_one(
            {"user_id": user_id, "task_id": task_id},
            {"$set": {"order": new_order, "updated_at": now_utc()}},
        )


# -----------------------------
# Models
# -----------------------------


class UserOut(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None


class AuthSessionIn(BaseModel):
    session_id: str


class CategoryCreate(BaseModel):
    name: str
    color: str = "#7C3AED"


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


class CategoryOut(BaseModel):
    category_id: str
    user_id: str
    name: str
    color: str
    created_at: datetime
    updated_at: datetime


TaskStatus = Literal["todo", "in_progress", "done"]
TaskPriority = Literal["low", "medium", "high", "urgent"]


class Attachment(BaseModel):
    name: str
    url: str


class Subtask(BaseModel):
    subtask_id: str = Field(default_factory=lambda: f"sub_{uuid.uuid4().hex[:12]}")
    title: str
    is_done: bool = False
    order: int = 0


class Recurrence(BaseModel):
    rule: Literal["none", "daily", "weekly", "monthly"] = "none"
    interval: int = 1


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    status: TaskStatus = "todo"
    priority: TaskPriority = "medium"
    category_id: Optional[str] = None
    tags: List[str] = []
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
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    category_id: Optional[str] = None
    tags: Optional[List[str]] = None
    due_at: Optional[str] = None
    reminder_at: Optional[str] = None
    recurrence: Optional[Recurrence] = None
    estimated_minutes: Optional[int] = None
    attachments: Optional[List[Attachment]] = None
    custom_fields: Optional[Dict[str, Any]] = None
    subtasks: Optional[List[Subtask]] = None


class TaskOut(BaseModel):
    task_id: str
    user_id: str
    title: str
    description: Optional[str] = None
    status: TaskStatus
    priority: TaskPriority
    category_id: Optional[str] = None
    tags: List[str] = []
    due_at: Optional[datetime] = None
    reminder_at: Optional[datetime] = None
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
    status: TaskStatus
    order: int


class DashboardSummaryOut(BaseModel):
    todo: int
    in_progress: int
    done: int
    overdue: int
    due_24h: int


# -----------------------------
# Routes
# -----------------------------


@api_router.get("/")
async def root():
    return {"message": "TaskFlow API"}


# ----- Auth -----


@api_router.post("/auth/session", response_model=UserOut)
async def create_session(payload: AuthSessionIn, response: Response):
    # Exchange session_id with Emergent OAuth session-data endpoint
    emergent_url = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
    r = requests.get(emergent_url, headers={"X-Session-ID": payload.session_id}, timeout=30)
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session_id")

    data = r.json()
    email = data.get("email")
    name = data.get("name") or email
    picture = data.get("picture")
    session_token = data.get("session_token")
    if not (email and session_token):
        raise HTTPException(status_code=500, detail="Auth provider error")

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"email": email},
            {"$set": {"name": name, "picture": picture, "updated_at": now_utc()}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one(
            {
                "user_id": user_id,
                "email": email,
                "name": name,
                "picture": picture,
                "created_at": now_utc(),
                "updated_at": now_utc(),
            }
        )

    expires_at = now_utc() + timedelta(days=7)
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.user_sessions.insert_one(
        {
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at,
            "created_at": now_utc(),
        }
    )

    # Cookie is httpOnly so frontend cannot read it.
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7 * 24 * 60 * 60,
        path="/",
    )

    return UserOut(user_id=user_id, email=email, name=name, picture=picture)


@api_router.get("/auth/me", response_model=UserOut)
async def me(user: Dict[str, Any] = Depends(get_current_user)):
    return UserOut(**user)


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = get_session_token_from_request(request)
    if token:
        await db.user_sessions.delete_one({"session_token": token})

    response.delete_cookie(key="session_token", path="/")
    return {"ok": True}


# ----- Categories -----


@api_router.get("/categories", response_model=List[CategoryOut])
async def list_categories(user: Dict[str, Any] = Depends(get_current_user)):
    cats = (
        await db.categories.find({"user_id": user["user_id"]}, {"_id": 0})
        .sort([("updated_at", -1)])
        .to_list(2000)
    )
    return [CategoryOut(**c) for c in cats]


@api_router.post("/categories", response_model=CategoryOut)
async def create_category(payload: CategoryCreate, user: Dict[str, Any] = Depends(get_current_user)):
    now = now_utc()
    doc = {
        "category_id": f"cat_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "name": payload.name,
        "color": payload.color,
        "created_at": now,
        "updated_at": now,
    }
    await db.categories.insert_one(doc)
    return CategoryOut(**doc)


@api_router.put("/categories/{category_id}", response_model=CategoryOut)
async def update_category(
    category_id: str, payload: CategoryUpdate, user: Dict[str, Any] = Depends(get_current_user)
):
    update: Dict[str, Any] = {k: v for k, v in payload.model_dump().items() if v is not None}
    update["updated_at"] = now_utc()
    res = await db.categories.find_one_and_update(
        {"user_id": user["user_id"], "category_id": category_id},
        {"$set": update},
        return_document=ReturnDocument.AFTER,
        projection={"_id": 0},
    )
    if not res:
        raise HTTPException(status_code=404, detail="Category not found")
    return CategoryOut(**res)


@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    await db.tasks.update_many(
        {"user_id": user["user_id"], "category_id": category_id},
        {"$set": {"category_id": None, "updated_at": now_utc()}},
    )
    res = await db.categories.delete_one({"user_id": user["user_id"], "category_id": category_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"ok": True}


# ----- Tasks -----


@api_router.get("/tasks", response_model=List[TaskOut])
async def list_tasks(
    request: Request,
    status: Optional[str] = None,
    category_id: Optional[str] = None,
    q: Optional[str] = None,
    due: Optional[str] = None,
    user: Dict[str, Any] = Depends(get_current_user),
):
    query: Dict[str, Any] = {"user_id": user["user_id"]}
    if status:
        query["status"] = status
    if category_id:
        query["category_id"] = category_id
    if q:
        query["title"] = {"$regex": q, "$options": "i"}

    now = now_utc()
    if due == "overdue":
        query["due_at"] = {"$lt": now}
        query["status"] = {"$ne": "done"}
    elif due == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + timedelta(days=1)
        query["due_at"] = {"$gte": start, "$lt": end}
    elif due == "week":
        end = now + timedelta(days=7)
        query["due_at"] = {"$gte": now, "$lt": end}

    tasks = (
        await db.tasks.find(query, {"_id": 0}).sort([("status", 1), ("order", 1)]).to_list(5000)
    )
    return [TaskOut(**t) for t in tasks]


@api_router.post("/tasks", response_model=TaskOut)
async def create_task(payload: TaskCreate, user: Dict[str, Any] = Depends(get_current_user)):
    user_id = user["user_id"]
    now = now_utc()

    # Determine order (append)
    max_doc = (
        await db.tasks.find({"user_id": user_id, "status": payload.status}, {"_id": 0, "order": 1})
        .sort([("order", -1)])
        .to_list(1)
    )
    next_order = int(max_doc[0]["order"] + 1) if max_doc else 0

    doc = {
        "task_id": f"task_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "title": payload.title,
        "description": payload.description,
        "status": payload.status,
        "priority": payload.priority,
        "category_id": payload.category_id,
        "tags": payload.tags or [],
        "due_at": parse_dt(payload.due_at),
        "reminder_at": parse_dt(payload.reminder_at),
        "recurrence": payload.recurrence.model_dump(),
        "estimated_minutes": payload.estimated_minutes,
        "attachments": [a.model_dump() for a in payload.attachments or []],
        "custom_fields": payload.custom_fields or {},
        "subtasks": [s.model_dump() for s in payload.subtasks or []],
        "order": next_order,
        "created_at": now,
        "updated_at": now,
        "completed_at": None,
    }
    await db.tasks.insert_one(doc)
    return TaskOut(**doc)


@api_router.get("/tasks/{task_id}", response_model=TaskOut)
async def get_task(task_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    doc = await db.tasks.find_one({"user_id": user["user_id"], "task_id": task_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Task not found")
    return TaskOut(**doc)


@api_router.put("/tasks/{task_id}", response_model=TaskOut)
async def update_task(task_id: str, payload: TaskUpdate, user: Dict[str, Any] = Depends(get_current_user)):
    update: Dict[str, Any] = {}
    data = payload.model_dump(exclude_unset=True)

    if "due_at" in data:
        update["due_at"] = parse_dt(data.get("due_at"))
        data.pop("due_at", None)
    if "reminder_at" in data:
        update["reminder_at"] = parse_dt(data.get("reminder_at"))
        data.pop("reminder_at", None)
    if "recurrence" in data and data["recurrence"] is not None:
        update["recurrence"] = data["recurrence"].model_dump()
        data.pop("recurrence", None)

    for k, v in data.items():
        update[k] = v

    update["updated_at"] = now_utc()

    existing = await db.tasks.find_one({"user_id": user["user_id"], "task_id": task_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Task not found")

    old_status = existing.get("status")
    new_status = update.get("status", old_status)

    # If status changes, move to end of new column
    if new_status != old_status:
        max_doc = (
            await db.tasks.find({"user_id": user["user_id"], "status": new_status}, {"_id": 0, "order": 1})
            .sort([("order", -1)])
            .to_list(1)
        )
        update["order"] = int(max_doc[0]["order"] + 1) if max_doc else 0

    res = await db.tasks.find_one_and_update(
        {"user_id": user["user_id"], "task_id": task_id},
        {"$set": update},
        return_document=ReturnDocument.AFTER,
        projection={"_id": 0},
    )

    if old_status != new_status:
        await normalize_orders(user["user_id"], old_status)
        await normalize_orders(user["user_id"], new_status)

    return TaskOut(**res)


@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    doc = await db.tasks.find_one({"user_id": user["user_id"], "task_id": task_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Task not found")
    await db.tasks.delete_one({"user_id": user["user_id"], "task_id": task_id})
    await normalize_orders(user["user_id"], doc["status"])
    return {"ok": True}


@api_router.patch("/tasks/{task_id}/toggle", response_model=TaskOut)
async def toggle_task(task_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    doc = await db.tasks.find_one({"user_id": user["user_id"], "task_id": task_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Task not found")

    if doc["status"] == "done":
        new_status: TaskStatus = "todo"
        completed_at = None
    else:
        new_status = "done"
        completed_at = now_utc()

    # Move to end of destination column
    max_doc = (
        await db.tasks.find({"user_id": user["user_id"], "status": new_status}, {"_id": 0, "order": 1})
        .sort([("order", -1)])
        .to_list(1)
    )
    new_order = int(max_doc[0]["order"] + 1) if max_doc else 0

    res = await db.tasks.find_one_and_update(
        {"user_id": user["user_id"], "task_id": task_id},
        {
            "$set": {
                "status": new_status,
                "completed_at": completed_at,
                "order": new_order,
                "updated_at": now_utc(),
            }
        },
        return_document=ReturnDocument.AFTER,
        projection={"_id": 0},
    )

    await normalize_orders(user["user_id"], doc["status"])
    await normalize_orders(user["user_id"], new_status)

    return TaskOut(**res)


@api_router.patch("/tasks/{task_id}/move", response_model=TaskOut)
async def move_task(task_id: str, payload: TaskMoveIn, user: Dict[str, Any] = Depends(get_current_user)):
    doc = await db.tasks.find_one({"user_id": user["user_id"], "task_id": task_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Task not found")

    old_status = doc["status"]
    new_status = payload.status

    res = await db.tasks.find_one_and_update(
        {"user_id": user["user_id"], "task_id": task_id},
        {"$set": {"status": new_status, "order": payload.order, "updated_at": now_utc()}},
        return_document=ReturnDocument.AFTER,
        projection={"_id": 0},
    )

    await normalize_orders(user["user_id"], old_status)
    await normalize_orders(user["user_id"], new_status)

    return TaskOut(**res)


# ----- Dashboard -----


@api_router.get("/dashboard/summary", response_model=DashboardSummaryOut)
async def dashboard_summary(user: Dict[str, Any] = Depends(get_current_user)):
    user_id = user["user_id"]
    now = now_utc()
    due_24h_end = now + timedelta(hours=24)

    def _count(q: Dict[str, Any]) -> int:
        # motor count_documents is async; wrapper below
        raise RuntimeError

    todo = await db.tasks.count_documents({"user_id": user_id, "status": "todo"})
    in_progress = await db.tasks.count_documents({"user_id": user_id, "status": "in_progress"})
    done = await db.tasks.count_documents({"user_id": user_id, "status": "done"})

    overdue = await db.tasks.count_documents(
        {"user_id": user_id, "status": {"$ne": "done"}, "due_at": {"$lt": now}}
    )
    due_24h = await db.tasks.count_documents(
        {"user_id": user_id, "status": {"$ne": "done"}, "due_at": {"$gte": now, "$lt": due_24h_end}}
    )

    return DashboardSummaryOut(
        todo=todo, in_progress=in_progress, done=done, overdue=overdue, due_24h=due_24h
    )


# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    # Best-effort indexes
    try:
        await db.users.create_index("email", unique=True)
    except Exception:
        pass
    try:
        await db.user_sessions.create_index("session_token", unique=True)
    except Exception:
        pass
    try:
        await db.categories.create_index([("user_id", 1), ("name", 1)])
    except Exception:
        pass
    try:
        await db.tasks.create_index([("user_id", 1), ("status", 1), ("order", 1)])
    except Exception:
        pass


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
