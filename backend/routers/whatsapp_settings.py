"""
whatsapp_settings.py — WhatsApp opt-in / OTP verification / notification prefs
Routes mounted at /api/whatsapp/...
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth_router import require_user
from db import get_pool
from services.whatsapp_service import generate_otp, send_otp, _hash_otp

router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])


class OptInBody(BaseModel):
    phone: str          # E.164 e.g. +919876543210


class VerifyBody(BaseModel):
    otp: str


class PrefsBody(BaseModel):
    notify_approvals:   Optional[bool] = None
    notify_mentions:    Optional[bool] = None
    notify_assignments: Optional[bool] = None
    notify_dms:         Optional[bool] = None


def _normalise_phone(phone: str) -> str:
    phone = phone.strip().replace(" ", "").replace("-", "")
    if not phone.startswith("+"):
        phone = "+" + phone
    if len(phone) < 8:
        raise HTTPException(400, "Invalid phone number")
    return phone


@router.get("/settings")
async def get_settings(pool=Depends(get_pool), user=Depends(require_user)):
    """Return the user's WhatsApp opt-in status and notification preferences."""
    row = await pool.fetchrow("SELECT * FROM user_whatsapp WHERE user_id=$1", user["user_id"])
    if not row:
        return {"opted_in": False, "verified": False}
    return {
        "opted_in":            True,
        "verified":            bool(row["verified_at"]),
        "opted_out":           bool(row["opted_out_at"]),
        "phone":               row["phone"],
        "notify_approvals":    row["notify_approvals"],
        "notify_mentions":     row["notify_mentions"],
        "notify_assignments":  row["notify_assignments"],
        "notify_dms":          row["notify_dms"],
    }


@router.post("/opt-in")
async def opt_in(body: OptInBody, pool=Depends(get_pool), user=Depends(require_user)):
    """Save phone number and send OTP via WhatsApp."""
    phone = _normalise_phone(body.phone)

    # Check phone not already taken by another user
    existing = await pool.fetchrow(
        "SELECT user_id FROM user_whatsapp WHERE phone=$1 AND user_id != $2", phone, user["user_id"]
    )
    if existing:
        raise HTTPException(409, "This phone number is already linked to another account")

    otp = generate_otp()
    otp_hash = _hash_otp(otp)
    expires = datetime.now(timezone.utc) + timedelta(minutes=10)

    await pool.execute("""
        INSERT INTO user_whatsapp (user_id, phone, otp, otp_expires_at, opted_out_at)
        VALUES ($1, $2, $3, $4, NULL)
        ON CONFLICT (user_id) DO UPDATE
          SET phone=$2, otp=$3, otp_expires_at=$4, opted_out_at=NULL, verified_at=NULL
    """, user["user_id"], phone, otp_hash, expires)

    wamid = await send_otp(phone, otp)
    if not wamid and not __import__("os").environ.get("WHATSAPP_PHONE_NUMBER_ID"):
        # Dev mode — return OTP in response for testing
        return {"ok": True, "dev_otp": otp, "message": "OTP sent (dev mode — check logs)"}

    return {"ok": True, "message": "OTP sent to your WhatsApp number. Valid for 10 minutes."}


@router.post("/verify")
async def verify(body: VerifyBody, pool=Depends(get_pool), user=Depends(require_user)):
    """Verify the OTP and activate WhatsApp notifications."""
    row = await pool.fetchrow(
        "SELECT otp, otp_expires_at FROM user_whatsapp WHERE user_id=$1", user["user_id"]
    )
    if not row or not row["otp"]:
        raise HTTPException(400, "No pending verification. Please send your phone number first.")

    if datetime.now(timezone.utc) > row["otp_expires_at"].replace(tzinfo=timezone.utc):
        raise HTTPException(400, "OTP has expired. Please request a new one.")

    if _hash_otp(body.otp.strip()) != row["otp"]:
        raise HTTPException(400, "Incorrect OTP. Please try again.")

    await pool.execute("""
        UPDATE user_whatsapp
        SET verified_at=NOW(), otp=NULL, otp_expires_at=NULL, opted_in_at=NOW()
        WHERE user_id=$1
    """, user["user_id"])

    return {"ok": True, "message": "WhatsApp verified! Notifications are now active."}


@router.patch("/settings")
async def update_prefs(body: PrefsBody, pool=Depends(get_pool), user=Depends(require_user)):
    """Update per-notification-type toggles."""
    row = await pool.fetchrow("SELECT user_id FROM user_whatsapp WHERE user_id=$1", user["user_id"])
    if not row:
        raise HTTPException(404, "No WhatsApp opt-in found")

    updates, vals = [], []
    if body.notify_approvals   is not None: updates.append(f"notify_approvals=${len(vals)+1}");   vals.append(body.notify_approvals)
    if body.notify_mentions    is not None: updates.append(f"notify_mentions=${len(vals)+1}");    vals.append(body.notify_mentions)
    if body.notify_assignments is not None: updates.append(f"notify_assignments=${len(vals)+1}"); vals.append(body.notify_assignments)
    if body.notify_dms         is not None: updates.append(f"notify_dms=${len(vals)+1}");         vals.append(body.notify_dms)

    if updates:
        vals.append(user["user_id"])
        await pool.execute(
            f"UPDATE user_whatsapp SET {', '.join(updates)} WHERE user_id=${len(vals)}", *vals
        )
    return {"ok": True}


@router.delete("/opt-out")
async def opt_out(pool=Depends(get_pool), user=Depends(require_user)):
    """Opt out — stops all WhatsApp notifications."""
    await pool.execute(
        "UPDATE user_whatsapp SET opted_out_at=NOW() WHERE user_id=$1", user["user_id"]
    )
    return {"ok": True, "message": "WhatsApp notifications disabled."}


@router.post("/resend-otp")
async def resend_otp(pool=Depends(get_pool), user=Depends(require_user)):
    """Resend OTP to the stored phone number."""
    row = await pool.fetchrow("SELECT phone FROM user_whatsapp WHERE user_id=$1", user["user_id"])
    if not row:
        raise HTTPException(404, "No phone number found. Please opt in first.")

    otp = generate_otp()
    otp_hash = _hash_otp(otp)
    expires = datetime.now(timezone.utc) + timedelta(minutes=10)

    await pool.execute(
        "UPDATE user_whatsapp SET otp=$1, otp_expires_at=$2 WHERE user_id=$3",
        otp_hash, expires, user["user_id"]
    )
    await send_otp(row["phone"], otp)
    return {"ok": True, "message": "OTP resent."}
