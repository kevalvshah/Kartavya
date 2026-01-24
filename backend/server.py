import os
import uuid
import json
import base64
import logging
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional
from datetime import datetime, timedelta, timezone

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Response, Request
from pydantic import BaseModel, Field, ConfigDict
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument

from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from py_vapid import Vapid
from pywebpush import webpush, WebPushException


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


async def normalize_orders(scope: Dict[str, Any], status: str) -> None:
    # scope is either personal: {"user_id": ...} or team: {"team_id": ...}
    query = dict(scope)
    query["status"] = status
    tasks = (
        await db.tasks.find(query, {"_id": 0})
        .sort([("order", 1), ("updated_at", 1)])
        .to_list(5000)
    )

    for idx, t in enumerate(tasks):
        if t.get("order") != idx:
            await db.tasks.update_one(
                {"task_id": t["task_id"]},
                {"$set": {"order": idx, "updated_at": now_utc()}},
            )


async def reminder_scheduler_loop() -> None:
    # Background scheduler to generate reminders even when the user isn't actively browsing.
    # Runs every 60 seconds.
    import asyncio

    while True:
        try:
            now = now_utc()
            tasks = await db.tasks.find(
                {
                    "status": {"$ne": "done"},
                    "reminder_at": {"$ne": None, "$lte": now},
                    "reminder_sent_at": None,
                },
                {"_id": 0},
            ).to_list(200)

            for t in tasks:
                recipients = set(t.get("assignee_user_ids", []))
                if t.get("assignee_emails"):
                    users = await db.users.find(
                        {"email": {"$in": t["assignee_emails"]}},
                        {"_id": 0},
                    ).to_list(2000)
                    recipients.update([u["user_id"] for u in users])

                if not recipients:
                    if t.get("user_id"):
                        recipients.add(t["user_id"])

                for uid in recipients:
                    await create_notification(
                        user_id=uid,
                        notif_type="reminder",
                        title="Task reminder",
                        message=f"Due soon: {t['title']}",
                        task_id=t["task_id"],
                        team_id=t.get("team_id"),
                        url="/tasks",
                    )
                    await send_web_push_to_user(
                        uid,
                        {"title": "TaskFlow", "body": f"Reminder: {t['title']}", "data": {"url": "/tasks"}},
                    )

                await db.tasks.update_one(
                    {"task_id": t["task_id"]},
                    {"$set": {"reminder_sent_at": now_utc(), "updated_at": now_utc()}},
                )

        except Exception as e:
            logger.warning("reminder scheduler error: %s", str(e))

        await asyncio.sleep(60)


async def is_team_admin(team_id: str, user: Dict[str, Any]) -> bool:
    mem = await db.team_members.find_one(
        {"team_id": team_id, "user_id": user["user_id"], "status": "active"}, {"_id": 0}
    )
    if not mem:
        return False
    return mem.get("role") in ("owner", "admin")


async def require_team_admin(team_id: str, user: Dict[str, Any]) -> None:
    if not await is_team_admin(team_id, user):
        raise HTTPException(status_code=403, detail="Team admin required")


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


async def ensure_vapid_keys() -> Dict[str, str]:
    doc = await db.app_settings.find_one({"key": "vapid"}, {"_id": 0})
    if doc and doc.get("public_key_b64") and doc.get("private_key_pem"):
        return {
            "public_key_b64": doc["public_key_b64"],
            "private_key_pem": doc["private_key_pem"],
            "subject": doc.get("subject", "mailto:admin@taskflow"),
        }

    v = Vapid()
    v.generate_keys()

    # Client needs base64url VAPID public key (UncompressedPoint)
    public_key_bytes = v.public_key.public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
    public_key_b64 = _b64url(public_key_bytes)

    # py-vapid can write PEM for private key; pywebpush accepts PEM.
    import tempfile

    with tempfile.TemporaryDirectory() as d:
        priv_path = os.path.join(d, "vapid_private.pem")
        v.save_key(priv_path)
        private_key_pem = Path(priv_path).read_text()

    subject = os.environ.get("VAPID_SUBJECT", "mailto:admin@taskflow")
    await db.app_settings.update_one(
        {"key": "vapid"},
        {
            "$set": {
                "key": "vapid",
                "public_key_b64": public_key_b64,
                "private_key_pem": private_key_pem,
                "subject": subject,
                "updated_at": now_utc(),
            },
            "$setOnInsert": {"created_at": now_utc()},
        },
        upsert=True,
    )
    return {"public_key_b64": public_key_b64, "private_key_pem": private_key_pem, "subject": subject}


async def create_notification(
    user_id: str,
    notif_type: str,
    title: str,
    message: str,
    task_id: Optional[str] = None,
    team_id: Optional[str] = None,
    url: Optional[str] = None,
) -> Dict[str, Any]:
    doc = {
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "team_id": team_id,
        "type": notif_type,
        "title": title,
        "message": message,
        "task_id": task_id,
        "url": url,
        "created_at": now_utc(),
        "read_at": None,
    }
    await db.notifications.insert_one(doc)
    return doc


async def send_web_push_to_user(user_id: str, payload: Dict[str, Any]) -> None:
    keys = await ensure_vapid_keys()
    subs = await db.push_subscriptions.find({"user_id": user_id}, {"_id": 0}).to_list(50)
    if not subs:
        return

    vapid_claims = {"sub": keys["subject"]}

    for sub in subs:
        try:
            subscription_info = {
                "endpoint": sub["endpoint"],
                "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]},
            }
            webpush(
                subscription_info,
                data=json.dumps(payload),
                vapid_private_key=keys["private_key_pem"],
                vapid_claims=vapid_claims,
            )
        except WebPushException as e:
            logger.warning("WebPush failed: %s", str(e))
            if getattr(e, "response", None) is not None and e.response.status_code in (404, 410):
                await db.push_subscriptions.delete_one({"subscription_id": sub["subscription_id"]})


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


TeamRole = Literal["owner", "admin", "member"]
TeamStatus = Literal["active", "invited"]


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
    role: TeamRole = "member"


class TeamMemberUpdate(BaseModel):
    role: Optional[TeamRole] = None
    status: Optional[TeamStatus] = None


class TeamMemberOut(BaseModel):
    member_id: str
    team_id: str
    email: str
    user_id: Optional[str] = None
    role: TeamRole
    status: TeamStatus
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

    # Collaboration
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
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
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

    # task belongs to either personal user or a team
    user_id: Optional[str] = None
    team_id: Optional[str] = None

    created_by_user_id: str
    assigned_by_user_id: Optional[str] = None
    completed_by_user_id: Optional[str] = None

    title: str
    description: Optional[str] = None
    status: TaskStatus
    priority: TaskPriority
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
    status: TaskStatus
    order: int


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


# -----------------------------
# Routes
# -----------------------------


@api_router.get("/")
async def root():
    return {"message": "TaskFlow API"}


# ----- Auth -----


@api_router.post("/auth/session", response_model=UserOut)
async def create_session(payload: AuthSessionIn, response: Response):
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

    # Activate team invites by email
    await db.team_members.update_many(
        {"email": email, "status": "invited"},
        {"$set": {"user_id": user_id, "status": "active", "updated_at": now_utc()}},
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


# ----- Push (Web) -----


@api_router.get("/push/vapid-public-key")
async def get_vapid_public_key(user: Dict[str, Any] = Depends(get_current_user)):
    keys = await ensure_vapid_keys()
    return {"public_key": keys["public_key_b64"]}


@api_router.post("/push/subscribe")
async def subscribe_push(payload: PushSubscriptionIn, request: Request, user: Dict[str, Any] = Depends(get_current_user)):
    if not payload.keys or "p256dh" not in payload.keys or "auth" not in payload.keys:
        raise HTTPException(status_code=400, detail="Invalid subscription")

    ua = request.headers.get("user-agent", "")
    doc = {
        "subscription_id": f"sub_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "endpoint": payload.endpoint,
        "p256dh": payload.keys.get("p256dh"),
        "auth": payload.keys.get("auth"),
        "user_agent": ua,
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }

    # Deduplicate by endpoint
    await db.push_subscriptions.delete_many({"user_id": user["user_id"], "endpoint": payload.endpoint})
    await db.push_subscriptions.insert_one(doc)

    return {"ok": True}


@api_router.post("/push/unsubscribe")
async def unsubscribe_push(payload: PushSubscriptionIn, user: Dict[str, Any] = Depends(get_current_user)):
    await db.push_subscriptions.delete_many({"user_id": user["user_id"], "endpoint": payload.endpoint})
    return {"ok": True}


# ----- Teams -----


@api_router.post("/teams", response_model=TeamOut)
async def create_team(payload: TeamCreate, user: Dict[str, Any] = Depends(get_current_user)):
    now = now_utc()
    team = {
        "team_id": f"team_{uuid.uuid4().hex[:12]}",
        "name": payload.name,
        "created_by": user["user_id"],
        "created_at": now,
        "updated_at": now,
    }
    await db.teams.insert_one(team)

    # Owner membership
    member = {
        "member_id": f"mem_{uuid.uuid4().hex[:12]}",
        "team_id": team["team_id"],
        "email": user["email"],
        "user_id": user["user_id"],
        "role": "owner",
        "status": "active",
        "created_at": now,
        "updated_at": now,
    }
    await db.team_members.insert_one(member)

    return TeamOut(**team)


@api_router.get("/teams", response_model=List[TeamOut])
async def list_teams(user: Dict[str, Any] = Depends(get_current_user)):
    memberships = await db.team_members.find({"user_id": user["user_id"], "status": "active"}, {"_id": 0}).to_list(2000)
    team_ids = [m["team_id"] for m in memberships]
    teams = await db.teams.find({"team_id": {"$in": team_ids}}, {"_id": 0}).sort([("updated_at", -1)]).to_list(2000)
    return [TeamOut(**t) for t in teams]


@api_router.get("/teams/{team_id}")
async def get_team(team_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    mem = await db.team_members.find_one({"team_id": team_id, "user_id": user["user_id"], "status": "active"}, {"_id": 0})
    if not mem:
        raise HTTPException(status_code=403, detail="Not a team member")

    team = await db.teams.find_one({"team_id": team_id}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    members = await db.team_members.find({"team_id": team_id}, {"_id": 0}).sort([("created_at", 1)]).to_list(2000)
    return {
        "team": team,
        "members": members,
        "your_role": mem.get("role"),
    }


@api_router.post("/teams/{team_id}/members", response_model=TeamMemberOut)
async def add_team_member(team_id: str, payload: TeamMemberAdd, user: Dict[str, Any] = Depends(get_current_user)):
    await require_team_admin(team_id, user)
    now = now_utc()
    email = payload.email.strip().lower()

    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    member_doc = {
        "member_id": f"mem_{uuid.uuid4().hex[:12]}",
        "team_id": team_id,
        "email": email,
        "user_id": existing_user.get("user_id") if existing_user else None,
        "role": payload.role,
        "status": "active" if existing_user else "invited",
        "created_at": now,
        "updated_at": now,
    }

    await db.team_members.delete_many({"team_id": team_id, "email": email})
    await db.team_members.insert_one(member_doc)

    # In-app notification if user exists
    if existing_user:
        await create_notification(
            user_id=existing_user["user_id"],
            notif_type="team_invite",
            title="Added to team",
            message=f"You were added to team: {team_id}",
            team_id=team_id,
            url="/teams",
        )
        await send_web_push_to_user(existing_user["user_id"], {"title": "TaskFlow", "body": "You were added to a team", "data": {"url": "/teams"}})

    return TeamMemberOut(**member_doc)


@api_router.put("/teams/{team_id}/members/{member_id}", response_model=TeamMemberOut)
async def update_team_member(
    team_id: str, member_id: str, payload: TeamMemberUpdate, user: Dict[str, Any] = Depends(get_current_user)
):
    await require_team_admin(team_id, user)

    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    update["updated_at"] = now_utc()

    res = await db.team_members.find_one_and_update(
        {"team_id": team_id, "member_id": member_id},
        {"$set": update},
        projection={"_id": 0},
        return_document=ReturnDocument.AFTER,
    )
    if not res:
        raise HTTPException(status_code=404, detail="Member not found")
    return TeamMemberOut(**res)


@api_router.delete("/teams/{team_id}/members/{member_id}")
async def remove_team_member(team_id: str, member_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    await require_team_admin(team_id, user)
    res = await db.team_members.delete_one({"team_id": team_id, "member_id": member_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Member not found")
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


def _scope_query_for_task(user: Dict[str, Any], task: Dict[str, Any]) -> Dict[str, Any]:
    if task.get("team_id"):
        return {"team_id": task["team_id"]}
    return {"user_id": task.get("user_id") or user["user_id"]}


async def _visible_tasks_query(user: Dict[str, Any]) -> Dict[str, Any]:
    team_ids = await db.team_members.distinct(
        "team_id", {"user_id": user["user_id"], "status": "active"}
    )
    return {"$or": [{"user_id": user["user_id"]}, {"team_id": {"$in": team_ids}}]}


@api_router.get("/tasks", response_model=List[TaskOut])
async def list_tasks(
    request: Request,
    status: Optional[str] = None,
    category_id: Optional[str] = None,
    q: Optional[str] = None,
    due: Optional[str] = None,
    team_id: Optional[str] = None,
    assigned_to_me: Optional[bool] = None,
    user: Dict[str, Any] = Depends(get_current_user),
):
    base = await _visible_tasks_query(user)
    query: Dict[str, Any] = base

    if team_id:
        query = {"$and": [base, {"team_id": team_id}]}

    and_filters: List[Dict[str, Any]] = []

    if status:
        and_filters.append({"status": status})
    if category_id:
        and_filters.append({"category_id": category_id})
    if q:
        and_filters.append({"title": {"$regex": q, "$options": "i"}})
    if assigned_to_me:
        and_filters.append({"assignee_user_ids": user["user_id"]})

    now = now_utc()
    if due == "overdue":
        and_filters.append({"due_at": {"$lt": now}})
        and_filters.append({"status": {"$ne": "done"}})
    elif due == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + timedelta(days=1)
        and_filters.append({"due_at": {"$gte": start, "$lt": end}})
    elif due == "week":
        end = now + timedelta(days=7)
        and_filters.append({"due_at": {"$gte": now, "$lt": end}})

    if and_filters:
        query = {"$and": [query] + and_filters}

    tasks = await db.tasks.find(query, {"_id": 0}).sort([("status", 1), ("order", 1)]).to_list(5000)
    return [TaskOut(**t) for t in tasks]


@api_router.post("/tasks", response_model=TaskOut)
async def create_task(payload: TaskCreate, user: Dict[str, Any] = Depends(get_current_user)):
    now = now_utc()

    # Determine ownership scope
    if payload.team_id:
        mem = await db.team_members.find_one(
            {"team_id": payload.team_id, "user_id": user["user_id"], "status": "active"}, {"_id": 0}
        )
        if not mem:
            raise HTTPException(status_code=403, detail="Not a team member")
        scope = {"team_id": payload.team_id}
        user_id_field = None
    else:
        scope = {"user_id": user["user_id"]}
        user_id_field = user["user_id"]

    # Default reminder: 2 hours before due
    due_dt = parse_dt(payload.due_at)
    reminder_dt = parse_dt(payload.reminder_at)
    if due_dt and reminder_dt is None:
        reminder_dt = due_dt - timedelta(hours=2)

    max_doc = (
        await db.tasks.find({**scope, "status": payload.status}, {"_id": 0, "order": 1})
        .sort([("order", -1)])
        .to_list(1)
    )
    next_order = int(max_doc[0]["order"] + 1) if max_doc else 0

    doc = {
        "task_id": f"task_{uuid.uuid4().hex[:12]}",
        "user_id": user_id_field,
        "team_id": payload.team_id,
        "created_by_user_id": user["user_id"],
        "assigned_by_user_id": user["user_id"] if (payload.assignee_user_ids or payload.assignee_emails) else None,
        "completed_by_user_id": None,
        "title": payload.title,
        "description": payload.description,
        "status": payload.status,
        "priority": payload.priority,
        "category_id": payload.category_id,
        "tags": payload.tags or [],
        "assignee_user_ids": payload.assignee_user_ids or [],
        "assignee_emails": [e.strip().lower() for e in (payload.assignee_emails or []) if e.strip()],
        "due_at": due_dt,
        "reminder_at": reminder_dt,
        "reminder_sent_at": None,
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

    # Create assignment notifications
    assigned_user_ids = set(doc["assignee_user_ids"])
    if doc["assignee_emails"]:
        users = await db.users.find({"email": {"$in": doc["assignee_emails"]}}, {"_id": 0}).to_list(2000)
        assigned_user_ids.update([u["user_id"] for u in users])

    for uid in assigned_user_ids:
        await create_notification(
            user_id=uid,
            notif_type="assigned",
            title="Task assigned",
            message=f"You were assigned: {doc['title']}",
            task_id=doc["task_id"],
            team_id=doc.get("team_id"),
            url="/tasks",
        )
        await send_web_push_to_user(
            uid,
            {"title": "TaskFlow", "body": f"Assigned: {doc['title']}", "data": {"url": "/tasks"}},
        )

    return TaskOut(**doc)


@api_router.get("/tasks/{task_id}", response_model=TaskOut)
async def get_task(task_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    base = await _visible_tasks_query(user)
    doc = await db.tasks.find_one({"$and": [base, {"task_id": task_id}]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Task not found")
    return TaskOut(**doc)


@api_router.put("/tasks/{task_id}", response_model=TaskOut)
async def update_task(task_id: str, payload: TaskUpdate, user: Dict[str, Any] = Depends(get_current_user)):
    base = await _visible_tasks_query(user)
    existing = await db.tasks.find_one({"$and": [base, {"task_id": task_id}]}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Task not found")

    # Team tasks: only admins can change assignments
    if existing.get("team_id") and (payload.assignee_user_ids is not None or payload.assignee_emails is not None):
        await require_team_admin(existing["team_id"], user)

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

    # Normalize assignee emails
    if "assignee_emails" in data and data["assignee_emails"] is not None:
        update["assignee_emails"] = [e.strip().lower() for e in data["assignee_emails"] if e.strip()]
        data.pop("assignee_emails", None)

    for k, v in data.items():
        update[k] = v

    update["updated_at"] = now_utc()

    old_status = existing.get("status")
    new_status = update.get("status", old_status)

    # If status changes, move to end of new column
    scope = {"team_id": existing["team_id"]} if existing.get("team_id") else {"user_id": existing.get("user_id")}
    if new_status != old_status:
        max_doc = (
            await db.tasks.find({**scope, "status": new_status}, {"_id": 0, "order": 1})
            .sort([("order", -1)])
            .to_list(1)
        )
        update["order"] = int(max_doc[0]["order"] + 1) if max_doc else 0

    # If assignment changed, set assigned_by
    assignment_changed = False
    if "assignee_user_ids" in update or "assignee_emails" in update:
        assignment_changed = True
        update["assigned_by_user_id"] = user["user_id"]

    res = await db.tasks.find_one_and_update(
        {"task_id": task_id},
        {"$set": update},
        return_document=ReturnDocument.AFTER,
        projection={"_id": 0},
    )

    if old_status != new_status:
        await normalize_orders(scope, old_status)
        await normalize_orders(scope, new_status)

    # Notify assignees on assignment change
    if assignment_changed:
        new_assignees = set(res.get("assignee_user_ids", []))
        if res.get("assignee_emails"):
            users = await db.users.find({"email": {"$in": res["assignee_emails"]}}, {"_id": 0}).to_list(2000)
            new_assignees.update([u["user_id"] for u in users])
        for uid in new_assignees:
            await create_notification(
                user_id=uid,
                notif_type="assigned",
                title="Task assigned",
                message=f"You were assigned: {res['title']}",
                task_id=res["task_id"],
                team_id=res.get("team_id"),
                url="/tasks",
            )
            await send_web_push_to_user(uid, {"title": "TaskFlow", "body": f"Assigned: {res['title']}", "data": {"url": "/tasks"}})

    return TaskOut(**res)


@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    base = await _visible_tasks_query(user)
    doc = await db.tasks.find_one({"$and": [base, {"task_id": task_id}]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Task not found")
    await db.tasks.delete_one({"task_id": task_id})

    scope = {"team_id": doc["team_id"]} if doc.get("team_id") else {"user_id": doc.get("user_id")}
    await normalize_orders(scope, doc["status"])

    return {"ok": True}


@api_router.patch("/tasks/{task_id}/toggle", response_model=TaskOut)
async def toggle_task(task_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    base = await _visible_tasks_query(user)
    doc = await db.tasks.find_one({"$and": [base, {"task_id": task_id}]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Task not found")

    if doc["status"] == "done":
        new_status: TaskStatus = "todo"
        completed_at = None
        completed_by = None
    else:
        new_status = "done"
        completed_at = now_utc()
        completed_by = user["user_id"]

    scope = {"team_id": doc["team_id"]} if doc.get("team_id") else {"user_id": doc.get("user_id")}
    max_doc = (
        await db.tasks.find({**scope, "status": new_status}, {"_id": 0, "order": 1})
        .sort([("order", -1)])
        .to_list(1)
    )
    new_order = int(max_doc[0]["order"] + 1) if max_doc else 0

    res = await db.tasks.find_one_and_update(
        {"task_id": task_id},
        {
            "$set": {
                "status": new_status,
                "completed_at": completed_at,
                "completed_by_user_id": completed_by,
                "order": new_order,
                "updated_at": now_utc(),
            }
        },
        return_document=ReturnDocument.AFTER,
        projection={"_id": 0},
    )

    await normalize_orders(scope, doc["status"])
    await normalize_orders(scope, new_status)

    # Completion notifications
    if new_status == "done":
        recipients = set(res.get("assignee_user_ids", []))
        if res.get("assignee_emails"):
            users = await db.users.find({"email": {"$in": res["assignee_emails"]}}, {"_id": 0}).to_list(2000)
            recipients.update([u["user_id"] for u in users])
        # notify assigner/manager too
        if res.get("assigned_by_user_id"):
            recipients.add(res["assigned_by_user_id"])

        for uid in recipients:
            await create_notification(
                user_id=uid,
                notif_type="completed",
                title="Task completed",
                message=f"Completed: {res['title']}",
                task_id=res["task_id"],
                team_id=res.get("team_id"),
                url="/tasks",
            )
            await send_web_push_to_user(uid, {"title": "TaskFlow", "body": f"Completed: {res['title']}", "data": {"url": "/tasks"}})

    return TaskOut(**res)


@api_router.patch("/tasks/{task_id}/move", response_model=TaskOut)
async def move_task(task_id: str, payload: TaskMoveIn, user: Dict[str, Any] = Depends(get_current_user)):
    base = await _visible_tasks_query(user)
    doc = await db.tasks.find_one({"$and": [base, {"task_id": task_id}]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Task not found")

    old_status = doc["status"]
    new_status = payload.status

    res = await db.tasks.find_one_and_update(
        {"task_id": task_id},
        {"$set": {"status": new_status, "order": payload.order, "updated_at": now_utc()}},
        return_document=ReturnDocument.AFTER,
        projection={"_id": 0},
    )

    scope = {"team_id": doc["team_id"]} if doc.get("team_id") else {"user_id": doc.get("user_id")}
    await normalize_orders(scope, old_status)
    await normalize_orders(scope, new_status)

    return TaskOut(**res)


# ----- Notifications -----


@api_router.get("/notifications", response_model=List[NotificationOut])
async def list_notifications(unread_only: bool = False, user: Dict[str, Any] = Depends(get_current_user)):
    query: Dict[str, Any] = {"user_id": user["user_id"]}
    if unread_only:
        query["read_at"] = None
    items = await db.notifications.find(query, {"_id": 0}).sort([("created_at", -1)]).to_list(200)
    return [NotificationOut(**n) for n in items]


@api_router.post("/notifications/mark-read")
async def mark_read(payload: MarkReadIn, user: Dict[str, Any] = Depends(get_current_user)):
    if payload.mark_all:
        await db.notifications.update_many(
            {"user_id": user["user_id"], "read_at": None},
            {"$set": {"read_at": now_utc()}},
        )
        return {"ok": True}

    if not payload.notification_ids:
        return {"ok": True}

    await db.notifications.update_many(
        {"user_id": user["user_id"], "notification_id": {"$in": payload.notification_ids}},
        {"$set": {"read_at": now_utc()}},
    )
    return {"ok": True}


@api_router.post("/notifications/process")
async def process_notifications(user: Dict[str, Any] = Depends(get_current_user)):
    # Create reminder notifications for tasks where reminder time has passed and not sent.
    # This endpoint is safe to call frequently (frontend polls when app is open).
    base = await _visible_tasks_query(user)
    now = now_utc()

    tasks = await db.tasks.find(
        {
            "$and": [
                base,
                {"status": {"$ne": "done"}},
                {"reminder_at": {"$ne": None, "$lte": now}},
                {"reminder_sent_at": None},
            ]
        },
        {"_id": 0},
    ).to_list(100)

    created = 0
    for t in tasks:
        recipients = set(t.get("assignee_user_ids", []))
        if t.get("assignee_emails"):
            users = await db.users.find({"email": {"$in": t["assignee_emails"]}}, {"_id": 0}).to_list(2000)
            recipients.update([u["user_id"] for u in users])

        if not recipients:
            # fallback: notify task owner
            if t.get("user_id"):
                recipients.add(t["user_id"])

        for uid in recipients:
            await create_notification(
                user_id=uid,
                notif_type="reminder",
                title="Task reminder",
                message=f"Due soon: {t['title']}",
                task_id=t["task_id"],
                team_id=t.get("team_id"),
                url="/tasks",
            )
            await send_web_push_to_user(uid, {"title": "TaskFlow", "body": f"Reminder: {t['title']}", "data": {"url": "/tasks"}})
            created += 1

        await db.tasks.update_one(
            {"task_id": t["task_id"]},
            {"$set": {"reminder_sent_at": now_utc(), "updated_at": now_utc()}},
        )

    return {"ok": True, "created": created}


# ----- Dashboard -----


@api_router.get("/dashboard/summary", response_model=DashboardSummaryOut)
async def dashboard_summary(user: Dict[str, Any] = Depends(get_current_user)):
    base = await _visible_tasks_query(user)
    now = now_utc()
    due_24h_end = now + timedelta(hours=24)

    todo = await db.tasks.count_documents({"$and": [base, {"status": "todo"}]})
    in_progress = await db.tasks.count_documents({"$and": [base, {"status": "in_progress"}]})
    done = await db.tasks.count_documents({"$and": [base, {"status": "done"}]})

    overdue = await db.tasks.count_documents(
        {"$and": [base, {"status": {"$ne": "done"}}, {"due_at": {"$lt": now}}]}
    )
    due_24h = await db.tasks.count_documents(
        {"$and": [base, {"status": {"$ne": "done"}}, {"due_at": {"$gte": now, "$lt": due_24h_end}}]}
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
        await db.tasks.create_index([("team_id", 1), ("status", 1), ("order", 1)])
        await db.tasks.create_index([("reminder_at", 1), ("reminder_sent_at", 1)])
    except Exception:
        pass
    try:
        await db.teams.create_index("team_id", unique=True)
        await db.team_members.create_index([("team_id", 1), ("email", 1)], unique=True)
        await db.team_members.create_index([("user_id", 1), ("status", 1)])
    except Exception:
        pass
    try:
        await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    except Exception:
        pass
    try:
        await db.push_subscriptions.create_index([("user_id", 1), ("endpoint", 1)], unique=True)
    except Exception:
        pass

    # Start background reminder scheduler
    import asyncio

    if not getattr(app.state, "reminder_task", None):
        app.state.reminder_task = asyncio.create_task(reminder_scheduler_loop())



@app.on_event("shutdown")
async def shutdown_db_client():
    # Stop scheduler
    task = getattr(app.state, "reminder_task", None)
    if task:
        task.cancel()

    client.close()
