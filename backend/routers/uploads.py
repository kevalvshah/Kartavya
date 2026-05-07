"""
uploads.py — /api/upload endpoint backed by Cloudflare R2.
60-day object expiry is enforced by the bucket lifecycle rule.
"""
import mimetypes
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from auth_router import require_user
from services.storage import upload_file

router = APIRouter(prefix="/api", tags=["uploads"])

MAX_BYTES = 10 * 1024 * 1024  # 10 MB hard limit

ALLOWED_TYPES = {
    "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain", "text/csv",
    "application/zip", "application/x-zip-compressed",
}


@router.post("/upload")
async def upload(file: UploadFile = File(...), user=Depends(require_user)):
    content = await file.read()

    if len(content) > MAX_BYTES:
        raise HTTPException(400, f"File exceeds {MAX_BYTES // (1024*1024)} MB limit")

    mime = file.content_type or mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream"
    if mime not in ALLOWED_TYPES:
        raise HTTPException(415, f"File type '{mime}' is not allowed")

    result = await upload_file(
        file_bytes=content,
        filename=file.filename or "upload",
        content_type=mime,
        user_id=user["user_id"],
    )
    return result
