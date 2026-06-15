"""
uploads.py — /api/upload endpoint backed by Cloudflare R2.
Per-file limit: 50 MB for video, 5 MB for everything else.
"""
import mimetypes
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query

from auth_router import require_user
from services.storage import upload_file

router = APIRouter(prefix="/api", tags=["uploads"])

MAX_BYTES        = 5  * 1024 * 1024   # 5 MB  — images/docs
MAX_BYTES_VIDEO  = 50 * 1024 * 1024   # 50 MB — video

ALLOWED_TYPES = {
    # Images
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "image/heic", "image/heif",
    # Video
    "video/quicktime", "video/mp4", "video/webm", "video/x-msvideo",
    # Documents
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    # Excel
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
    # PowerPoint
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    # Text
    "text/plain",
}

VIDEO_EXTENSIONS = {".mov", ".mp4", ".webm", ".avi", ".mkv"}

ALLOWED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif",
    ".pdf",
    ".doc", ".docx",
    ".xls", ".xlsx", ".csv",
    ".ppt", ".pptx",
    ".txt",
} | VIDEO_EXTENSIONS


@router.post("/upload")
async def upload(
    file: UploadFile = File(...),
    team_id: Optional[str] = Query(None),
    user=Depends(require_user),
):
    content = await file.read()

    fname = (file.filename or "upload").lower()
    ext   = "." + fname.rsplit(".", 1)[-1] if "." in fname else ""
    mime  = file.content_type or mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream"

    is_video = ext in VIDEO_EXTENSIONS or mime.startswith("video/")
    limit    = MAX_BYTES_VIDEO if is_video else MAX_BYTES

    if len(content) > limit:
        label = "50 MB" if is_video else "5 MB"
        raise HTTPException(400, f"File exceeds {label} limit")

    if mime not in ALLOWED_TYPES and ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(415, "File type not allowed. Supported: images, video, PDF, Word, Excel, PowerPoint.")

    if ext in {".heic", ".heif"} and mime == "application/octet-stream":
        mime = f"image/{ext.lstrip('.')}"
    if ext in VIDEO_EXTENSIONS and mime == "application/octet-stream":
        mime = "video/quicktime" if ext == ".mov" else f"video/{ext.lstrip('.')}"

    folder = f"projects/{team_id}" if team_id else None
    result = await upload_file(
        file_bytes=content,
        filename=file.filename or "upload",
        content_type=mime,
        user_id=user["user_id"],
        folder=folder,
    )
    return result
