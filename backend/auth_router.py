"""
auth_router.py — Kartavya by Aekam Inc
Replaces Emergent Google OAuth with email/password + JWT.
"""
import os, uuid, hashlib, hmac
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field
import jwt

router = APIRouter(prefix="/api/auth", tags=["auth"])
security = HTTPBearer(auto_error=False)
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
JWT_TTL_DAYS = 30

def _hash_password(password, salt):
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260_000).hex()

def _verify_password(password, salt, stored):
    return hmac.compare_digest(_hash_password(password, salt), stored)

def _create_token(user_id):
    return jwt.encode({"sub": user_id, "exp": datetime.utcnow() + timedelta(days=JWT_TTL_DAYS), "iat": datetime.utcnow()}, JWT_SECRET, algorithm=JWT_ALGORITHM)

def _decode_token(token):
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])["sub"]
    except jwt.PyJWTError:
        return None

def get_db(request): return request.app.state.db

async def require_user(request: Request, credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    token = credentials.credentials if credentials else request.cookies.get("session_token")
    if not token: raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = _decode_token(token)
    if not user_id: raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = await get_db(request).users.find_one({"id": user_id})
    if not user: raise HTTPException(status_code=401, detail="User not found")
    return user

class RegisterBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)

class LoginBody(BaseModel):
    email: EmailStr
    password: str

def _safe_user(u):
    return {"id": u["id"], "name": u["name"], "email": u["email"], "avatar": u.get("avatar"), "provider": u.get("provider", "local")}

@router.post("/register")
async def register(body: RegisterBody, request: Request):
    db = get_db(request)
    if await db.users.find_one({"email": body.email.lower()}):
        raise HTTPException(status_code=409, detail="Email already registered")
    salt = uuid.uuid4().hex
    user_id = str(uuid.uuid4())
    now = datetime.utcnow()
    await db.users.insert_one({"_id": user_id, "id": user_id, "name": body.name, "email": body.email.lower(), "salt": salt, "password_hash": _hash_password(body.password, salt), "avatar": None, "provider": "local", "created_at": now, "updated_at": now})
    return {"token": _create_token(user_id), "user": _safe_user({"id": user_id, "name": body.name, "email": body.email.lower(), "avatar": None})}

@router.post("/login")
async def login(body: LoginBody, request: Request):
    db = get_db(request)
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not _verify_password(body.password, user["salt"], user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"token": _create_token(user["id"]), "user": _safe_user(user)}

@router.post("/logout")
async def logout(): return {"ok": True}

@router.get("/me")
async def me(current_user: dict = Depends(require_user)): return _safe_user(current_user)
