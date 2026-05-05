"""
storage.py — Kartavya by Aekam Inc

Pluggable file storage abstraction. Two backends supported today:

    1. "inline" (default) — base64 data URL stored on the task row. No external
       service. Fine for MVP. Doesn't scale: every task fetch pulls the file bytes,
       Postgres TOAST gets stressed at ~10MB rows, backups bloat.

    2. "s3" — S3-compatible object storage. Works for AWS S3 OR Cloudflare R2 OR
       Backblaze B2 — they all speak the same API. Configured by env vars:

            STORAGE_BACKEND=s3
            STORAGE_BUCKET=kartavya-attachments
            STORAGE_ENDPOINT_URL=        (optional — set for R2/B2, omit for AWS S3)
            STORAGE_REGION=auto          (use "auto" for R2, "us-east-1" etc for AWS)
            STORAGE_ACCESS_KEY_ID=...
            STORAGE_SECRET_ACCESS_KEY=...
            STORAGE_PUBLIC_BASE_URL=     (optional public CDN/custom-domain prefix)

       If STORAGE_PUBLIC_BASE_URL is set, files are returned as
       {public_base}/{key}. Otherwise, signed download URLs valid for 7 days are
       returned per-fetch (call get_download_url(key)).

The backend is selected from env at process start. Switching from inline to s3
later does NOT migrate existing inline attachments — they keep working since
they're already self-contained data URLs. Only new uploads use the new backend.
"""

import base64
import logging
import mimetypes
import os
import uuid
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

MAX_SIZE = 5 * 1024 * 1024  # 5 MB

_BACKEND = os.environ.get("STORAGE_BACKEND", "inline").lower()
_BUCKET = os.environ.get("STORAGE_BUCKET")
_ENDPOINT = os.environ.get("STORAGE_ENDPOINT_URL") or None
_REGION = os.environ.get("STORAGE_REGION", "auto")
_AK = os.environ.get("STORAGE_ACCESS_KEY_ID")
_SK = os.environ.get("STORAGE_SECRET_ACCESS_KEY")
_PUBLIC_BASE = (os.environ.get("STORAGE_PUBLIC_BASE_URL") or "").rstrip("/")

_s3_client = None


def _get_s3():
    """Lazy boto3 client, only built when s3 backend is in use."""
    global _s3_client
    if _s3_client is not None:
        return _s3_client
    import boto3
    from botocore.config import Config
    cfg = Config(signature_version="s3v4", retries={"max_attempts": 3, "mode": "standard"})
    kwargs = {"region_name": _REGION, "config": cfg}
    if _ENDPOINT:
        kwargs["endpoint_url"] = _ENDPOINT
    if _AK and _SK:
        kwargs["aws_access_key_id"] = _AK
        kwargs["aws_secret_access_key"] = _SK
    _s3_client = boto3.client("s3", **kwargs)
    return _s3_client


def is_object_storage() -> bool:
    """True when uploads will go to S3/R2/B2 instead of inline base64."""
    return _BACKEND == "s3" and bool(_BUCKET)


async def store_upload(file_bytes: bytes, original_filename: str) -> dict:
    """Persist an uploaded file. Returns a dict shaped like the legacy contract:

        { "url": str, "name": str, "size": int, "key": Optional[str] }

    For "inline": url is a data: URL embedding the bytes.
    For "s3": url is either the public base + key (if configured) or a 7-day
              signed URL. Caller can later reissue signed URLs via
              get_download_url(key).
    """
    if len(file_bytes) > MAX_SIZE:
        raise ValueError(f"File exceeds 5MB limit ({len(file_bytes)} bytes)")

    ext = Path(original_filename or "").suffix
    safe_name = original_filename or "upload"
    key = f"attachments/{uuid.uuid4().hex[:12]}{ext}"
    mime = mimetypes.guess_type(safe_name)[0] or "application/octet-stream"

    if not is_object_storage():
        # Inline base64 data URL — works without any external service
        b64 = base64.b64encode(file_bytes).decode("utf-8")
        return {
            "url": f"data:{mime};base64,{b64}",
            "name": safe_name,
            "size": len(file_bytes),
            "key": None,
        }

    # Object storage path
    s3 = _get_s3()
    s3.put_object(
        Bucket=_BUCKET,
        Key=key,
        Body=file_bytes,
        ContentType=mime,
        ContentDisposition=f'inline; filename="{safe_name}"',
    )

    if _PUBLIC_BASE:
        url = f"{_PUBLIC_BASE}/{key}"
    else:
        # Issue an initial 7-day signed URL. Frontend can request a fresh one later.
        url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": _BUCKET, "Key": key},
            ExpiresIn=7 * 24 * 3600,
        )

    return {"url": url, "name": safe_name, "size": len(file_bytes), "key": key}


def get_download_url(key: str, expires_in: int = 7 * 24 * 3600) -> Optional[str]:
    """Reissue a signed download URL for an object-storage attachment.
    Returns None for inline attachments (their data URL never expires)."""
    if not is_object_storage() or not key:
        return None
    if _PUBLIC_BASE:
        return f"{_PUBLIC_BASE}/{key}"
    s3 = _get_s3()
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": _BUCKET, "Key": key},
        ExpiresIn=expires_in,
    )


def delete_object(key: Optional[str]) -> bool:
    """Best-effort delete of an attachment. Inline attachments are no-ops."""
    if not is_object_storage() or not key:
        return False
    try:
        _get_s3().delete_object(Bucket=_BUCKET, Key=key)
        return True
    except Exception as e:
        logger.warning(f"Could not delete object {key}: {e}")
        return False
