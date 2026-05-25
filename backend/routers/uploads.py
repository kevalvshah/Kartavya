"""
uploads.py — /api/upload endpoint backed by Cloudflare R2.
Per-file limit: 5 MB. Per-task limit enforced on frontend (5 files max).
"""
import mimetypes
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from auth_router import require_user
from services.storage import upload_file

router = APIRouter(prefix="/api", tags=["uploads"])

MAX_BYTES = 5 * 1024 * 1024  # 5 MB per file

ALLOWED_TYPES = {
    # Images
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "image/heic", "image/heif",
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

# Extension-based fallback for formats with unreliable MIME detection (HEIC on mobile)
ALLOWED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif",
    ".pdf",
    ".doc", ".docx",
    ".xls", ".xlsx", ".csv",
    ".ppt", ".pptx",
    ".txt",
}


@router.post("/upload")
async def upload(file: UploadFile = File(...), user=Depends(require_user)):
    content = await file.read()

    if len(content) > MAX_BYTES:
        raise HTTPException(400, "File exceeds 5 MB limit")

    fname = (file.filename or "upload").lower()
    ext   = "." + fname.rsplit(".", 1)[-1] if "." in fname else ""
    mime  = file.content_type or mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream"

    # Accept if MIME matches OR extension matches (handles HEIC from iOS which may send application/octet-stream)
    if mime not in ALLOWED_TYPES and ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(415, "File type not allowed. Supported: images, PDF, Word, Excel, PowerPoint.")

    # Normalise HEIC mime when browser sends generic binary
    if ext in {".heic", ".heif"} and mime == "application/octet-stream":
        mime = f"image/{ext.lstrip('.')}"

    result = await upload_file(
        file_bytes=content,
        filename=file.filename or "upload",
        content_type=mime,
        user_id=user["user_id"],
    )
    return result
