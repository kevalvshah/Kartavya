"""
whatsapp_service.py — Meta Cloud API outbound messaging · वार्ता

Environment variables required (set in Railway):
  WHATSAPP_PHONE_NUMBER_ID   — from Meta Business Manager > WhatsApp > API Setup
  WHATSAPP_ACCESS_TOKEN      — System user permanent token (not page token)
  WHATSAPP_VERIFY_TOKEN      — Arbitrary secret for webhook verification (Phase 4)

Template names (submit all to Meta for approval before going live):
  kartavya_otp               — OTP verification
  kartavya_task_assigned     — Task assigned notification
  kartavya_approval_request  — Approval request with Approve/Reject buttons
  kartavya_task_approved     — Task approved notification
  kartavya_task_rejected     — Task rejected notification
  kartavya_mention           — @mention alert
"""
import hashlib
import hmac
import logging
import os
import secrets
import uuid
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

PHONE_NUMBER_ID  = os.environ.get("WHATSAPP_PHONE_NUMBER_ID", "")
ACCESS_TOKEN     = os.environ.get("WHATSAPP_ACCESS_TOKEN", "")
VERIFY_TOKEN     = os.environ.get("WHATSAPP_VERIFY_TOKEN", "kartavya_webhook_verify")
FRONTEND_URL     = os.environ.get("FRONTEND_URL", "https://kartavya-aekam.vercel.app")
API_VERSION      = "v20.0"

_configured = bool(PHONE_NUMBER_ID and ACCESS_TOKEN)

if _configured:
    logger.info("✅ WhatsApp (Meta Cloud API) configured — Phone ID: %s", PHONE_NUMBER_ID)
else:
    logger.warning("⚠️  WhatsApp not configured — set WHATSAPP_PHONE_NUMBER_ID + WHATSAPP_ACCESS_TOKEN in Railway")


# ── Core send ──────────────────────────────────────────────────────────────────

async def _send(payload: dict) -> Optional[str]:
    """POST to Meta Cloud API. Returns wamid on success, None on failure."""
    if not _configured:
        logger.info("[WA-DEV] Would send: %s", payload)
        return None  # Don't fake success — callers should treat None as not-sent
    url = f"https://graph.facebook.com/{API_VERSION}/{PHONE_NUMBER_ID}/messages"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(url,
                headers={"Authorization": f"Bearer {ACCESS_TOKEN}", "Content-Type": "application/json"},
                json=payload)
        if r.status_code == 200:
            wamid = r.json().get("messages", [{}])[0].get("id")
            logger.info("✅ WhatsApp sent → %s [%s]", payload.get("to"), wamid)
            return wamid
        else:
            logger.error("❌ WhatsApp API error %s: %s", r.status_code, r.text)
            return None
    except Exception as exc:
        logger.error("❌ WhatsApp send failed: %s", exc)
        return None


async def send_template(
    to_phone: str,
    template_name: str,
    body_params: list[str],
    buttons: Optional[list[dict]] = None,
    language: str = "en",
) -> Optional[str]:
    """Send a Meta-approved template message. Returns wamid or None."""
    components = []
    if body_params:
        components.append({
            "type": "body",
            "parameters": [{"type": "text", "text": str(p)} for p in body_params],
        })
    if buttons:
        for i, btn in enumerate(buttons):
            components.append({
                "type": "button",
                "sub_type": btn.get("sub_type", "quick_reply"),
                "index": str(i),
                "parameters": [{"type": "payload", "payload": btn["payload"]}],
            })
    payload = {
        "messaging_product": "whatsapp",
        "to": to_phone.lstrip("+"),
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": language},
            "components": components,
        },
    }
    return await _send(payload)


async def send_text(to_phone: str, body: str) -> Optional[str]:
    """Send a free-text message (only valid within a 24h customer-service window)."""
    return await _send({
        "messaging_product": "whatsapp",
        "to": to_phone.lstrip("+"),
        "type": "text",
        "text": {"body": body},
    })


# ── OTP ────────────────────────────────────────────────────────────────────────

_OTP_SECRET = os.environ.get("OTP_SECRET") or os.environ.get("JWT_SECRET")
if not _OTP_SECRET:
    logger.warning("⚠️  OTP_SECRET not set — WhatsApp OTP verification is disabled until a secret is configured")
    _OTP_SECRET = None

def _hash_otp(otp: str) -> str:
    """HMAC-SHA256 with server secret — prevents offline brute-force from leaked DB rows."""
    if not _OTP_SECRET:
        raise RuntimeError("OTP_SECRET is not configured — cannot hash OTP")
    return hmac.new(_OTP_SECRET.encode(), otp.encode(), hashlib.sha256).hexdigest()


def generate_otp() -> str:
    return str(secrets.randbelow(900000) + 100000)  # cryptographically secure


async def send_otp(phone: str, otp: str) -> Optional[str]:
    """Send OTP via kartavya_otp template. Param: {{1}} = OTP code."""
    return await send_template(phone, "kartavya_otp", [otp])


# ── Notification senders ───────────────────────────────────────────────────────

async def send_approval_request(
    pool,
    recipient_id: str,
    task_id: str,
    task_title: str,
    requester_name: str,
    notes: str = "",
) -> None:
    """
    Send approval_request template with Approve/Reject quick-reply buttons.

    Template: kartavya_approval_request
    Body params: {{1}}=task_title, {{2}}=requester_name, {{3}}=notes_or_dash
    Buttons:
      [0] quick_reply "Approve"  payload: APPROVE_{task_id}
      [1] quick_reply "Reject"   payload: REJECT_{task_id}
    """
    wa = await pool.fetchrow(
        "SELECT phone, notify_approvals, opted_out_at FROM user_whatsapp WHERE user_id=$1 AND verified_at IS NOT NULL",
        recipient_id
    )
    if not wa or not wa["notify_approvals"] or wa["opted_out_at"]:
        return
    wamid = await send_template(
        wa["phone"],
        "kartavya_approval_request",
        [task_title, requester_name, notes or "—"],
        buttons=[
            {"payload": f"APPROVE_{task_id}"},
            {"payload": f"REJECT_{task_id}"},
        ],
    )
    if wamid:
        await _track(pool, wamid, recipient_id, "outbound", "approval", task_id, "kartavya_approval_request")


async def send_approval_decision(
    pool,
    recipient_id: str,
    task_id: str,
    task_title: str,
    reviewer_name: str,
    decision: str,         # "approved" | "rejected"
    reason: str = "",
) -> None:
    """
    Send task_approved or task_rejected template.

    kartavya_task_approved params: {{1}}=first_name, {{2}}=task_title, {{3}}=reviewer_name
    kartavya_task_rejected params: {{1}}=first_name, {{2}}=task_title, {{3}}=reviewer_name, {{4}}=reason
    """
    wa = await pool.fetchrow(
        "SELECT phone, notify_approvals, opted_out_at FROM user_whatsapp WHERE user_id=$1 AND verified_at IS NOT NULL",
        recipient_id
    )
    if not wa or not wa["notify_approvals"] or wa["opted_out_at"]:
        return
    user = await pool.fetchrow(
        "SELECT COALESCE(full_name, name, email) AS name FROM users WHERE user_id=$1", recipient_id
    )
    name_str = user["name"] if user else "there"; first = name_str.split()[0] if name_str and name_str.strip() else "there"
    template = "kartavya_task_approved" if decision == "approved" else "kartavya_task_rejected"
    params = [first, task_title, reviewer_name] + ([reason or "No reason given"] if decision == "rejected" else [])
    wamid = await send_template(wa["phone"], template, params)
    if wamid:
        await _track(pool, wamid, recipient_id, "outbound", "approval", task_id, template)


async def send_task_assigned(
    pool,
    recipient_id: str,
    task_id: str,
    task_title: str,
    assigner_name: str,
    due_date: str = "",
) -> None:
    """
    kartavya_task_assigned params: {{1}}=first_name, {{2}}=task_title, {{3}}=due_or_dash
    """
    wa = await pool.fetchrow(
        "SELECT phone, notify_assignments, opted_out_at FROM user_whatsapp WHERE user_id=$1 AND verified_at IS NOT NULL",
        recipient_id
    )
    if not wa or not wa["notify_assignments"] or wa["opted_out_at"]:
        return
    user = await pool.fetchrow(
        "SELECT COALESCE(full_name, name, email) AS name FROM users WHERE user_id=$1", recipient_id
    )
    name_str = user["name"] if user else "there"; first = name_str.split()[0] if name_str and name_str.strip() else "there"
    wamid = await send_template(
        wa["phone"], "kartavya_task_assigned",
        [first, task_title, due_date or "—"]
    )
    if wamid:
        await _track(pool, wamid, recipient_id, "outbound", "task_comment", task_id, "kartavya_task_assigned")


async def send_mention_alert(
    pool,
    recipient_id: str,
    actor_name: str,
    context_name: str,    # channel name or task title
    snippet: str,
    context_id: str,
) -> None:
    """
    kartavya_mention params: {{1}}=first_name, {{2}}=actor_name, {{3}}=context, {{4}}=snippet
    """
    wa = await pool.fetchrow(
        "SELECT phone, notify_mentions, opted_out_at FROM user_whatsapp WHERE user_id=$1 AND verified_at IS NOT NULL",
        recipient_id
    )
    if not wa or not wa["notify_mentions"] or wa["opted_out_at"]:
        return
    user = await pool.fetchrow(
        "SELECT COALESCE(full_name, name, email) AS name FROM users WHERE user_id=$1", recipient_id
    )
    name_str = user["name"] if user else "there"; first = name_str.split()[0] if name_str and name_str.strip() else "there"
    wamid = await send_template(
        wa["phone"], "kartavya_mention",
        [first, actor_name, context_name, snippet[:100]]
    )
    if wamid:
        await _track(pool, wamid, recipient_id, "outbound", "mention", context_id, "kartavya_mention")


# ── Tracking helper ────────────────────────────────────────────────────────────

async def _track(pool, wamid: str, user_id: str, direction: str,
                 context_type: str, context_id: str, template_name: str) -> None:
    try:
        await pool.execute("""
            INSERT INTO whatsapp_messages
              (wa_message_id, user_id, direction, context_type, context_id, template_name)
            VALUES ($1,$2,$3,$4,$5,$6)
            ON CONFLICT DO NOTHING
        """, wamid, user_id, direction, context_type, context_id, template_name)
    except Exception as exc:
        logger.warning("wa track failed: %s", exc)
