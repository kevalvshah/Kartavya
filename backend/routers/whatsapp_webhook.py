"""
whatsapp_webhook.py — Meta WhatsApp Cloud API inbound · प्रतिक्रिया (Phase 4)

Handles:
  GET  /api/webhooks/whatsapp  — Meta challenge verification
  POST /api/webhooks/whatsapp  — Inbound messages (HMAC-SHA256 verified)

Routing logic:
  1. Button reply APPROVE_{task_id} → approve task, notify requester
  2. Button reply REJECT_{task_id}  → create session, ask for reason
  3. Text with context.id → if session pending: use as reject reason
                          → else: post as comment on task or message in channel
  4. Text with no context  → check pending session → use as reject reason
  5. Fallback              → reply "Please reply to a specific notification"
"""
import hashlib
import hmac
import json
import logging
import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import PlainTextResponse

from db import get_pool

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/webhooks", tags=["whatsapp-webhook"])

VERIFY_TOKEN = os.environ.get("WHATSAPP_VERIFY_TOKEN", "kartavya_webhook_verify")
APP_SECRET   = os.environ.get("WHATSAPP_APP_SECRET", "")  # Meta App Secret for HMAC


# ── GET — Meta webhook verification ───────────────────────────────────────────

@router.get("/whatsapp")
async def verify_webhook(request: Request):
    """Respond to Meta's hub challenge during webhook registration."""
    params = dict(request.query_params)
    mode      = params.get("hub.mode")
    token     = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")

    if mode == "subscribe" and token == VERIFY_TOKEN:
        logger.info("✅ WhatsApp webhook verified")
        return PlainTextResponse(content=challenge)

    logger.warning("❌ WhatsApp webhook verification failed — token mismatch")
    raise HTTPException(status_code=403, detail="Verification failed")


# ── POST — Inbound messages ────────────────────────────────────────────────────

@router.post("/whatsapp")
async def receive_webhook(request: Request, pool=Depends(get_pool)):
    """Receive and route inbound WhatsApp messages. Always returns 200 immediately."""
    raw_body = await request.body()

    # HMAC-SHA256 signature verification
    if APP_SECRET:
        sig_header = request.headers.get("X-Hub-Signature-256", "")
        expected = "sha256=" + hmac.new(APP_SECRET.encode(), raw_body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig_header, expected):
            logger.warning("WhatsApp webhook HMAC mismatch — rejecting")
            raise HTTPException(status_code=403, detail="Invalid signature")

    try:
        data = json.loads(raw_body)
        await _route(data, pool)
    except Exception as exc:
        logger.error("Webhook processing error: %s", exc, exc_info=True)

    # Meta requires 200 quickly — processing is async above
    return Response(status_code=200)


# ── Router ────────────────────────────────────────────────────────────────────

async def _route(data: dict, pool) -> None:
    """Parse Meta webhook payload and dispatch to the appropriate handler."""
    for entry in data.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})

            # Status updates (delivered / read) — just track, don't reply
            for status in value.get("statuses", []):
                await _handle_status(status, pool)

            # Inbound messages
            for msg in value.get("messages", []):
                try:
                    await _handle_message(msg, pool)
                except Exception as exc:
                    logger.error("Message handling error: %s", exc, exc_info=True)


async def _handle_status(status: dict, pool) -> None:
    """Update delivered_at / read_at in whatsapp_messages."""
    wamid  = status.get("id")
    stype  = status.get("status")  # 'sent' | 'delivered' | 'read'
    if not wamid or stype not in ("delivered", "read"):
        return
    col = "delivered_at" if stype == "delivered" else "read_at"
    try:
        await pool.execute(
            f"UPDATE whatsapp_messages SET {col}=NOW() WHERE wa_message_id=$1", wamid
        )
    except Exception:
        pass


async def _handle_message(msg: dict, pool) -> None:
    """Route an inbound message to the correct action."""
    from_phone = msg.get("from")          # e.g. "919876543210"
    msg_id     = msg.get("id")            # wamid of this inbound message
    msg_type   = msg.get("type")          # text | button | interactive
    context_id = (msg.get("context") or {}).get("id")  # wamid of message being replied to

    if not from_phone:
        return

    # ── Record inbound message in whatsapp_messages ────────────────────────
    wa_user = await pool.fetchrow(
        "SELECT user_id FROM user_whatsapp WHERE phone=$1 OR phone=$2",
        "+" + from_phone, from_phone
    )
    user_id = wa_user["user_id"] if wa_user else None

    body_text = _extract_text(msg)
    payload   = _extract_button_payload(msg)  # e.g. "APPROVE_task_xxx"

    try:
        await pool.execute("""
            INSERT INTO whatsapp_messages
              (wa_message_id, user_id, direction, body, sent_at)
            VALUES ($1,$2,'inbound',$3,NOW())
            ON CONFLICT DO NOTHING
        """, msg_id, user_id, body_text or payload)
    except Exception:
        pass

    # ── 1. Button / quick-reply ────────────────────────────────────────────
    if payload:
        if payload.startswith("APPROVE_"):
            task_id = payload[len("APPROVE_"):]
            await _handle_approve(task_id, from_phone, user_id, pool)
            return

        if payload.startswith("REJECT_"):
            task_id = payload[len("REJECT_"):]
            await _handle_reject_init(task_id, from_phone, pool)
            return

    # ── 2. Pending reject session ──────────────────────────────────────────
    if body_text:
        session = await pool.fetchrow("""
            SELECT context_type, context_id FROM whatsapp_sessions
            WHERE phone=$1 AND expires_at > NOW()
            LIMIT 1
        """, "+" + from_phone)

        if session and session["context_type"] == "awaiting_reject_reason":
            task_id = session["context_id"]
            await _handle_reject_reason(task_id, from_phone, user_id, body_text, pool)
            await pool.execute(
                "DELETE FROM whatsapp_sessions WHERE phone=$1", "+" + from_phone
            )
            return

    # ── 3. Text reply with context (reply threading) ───────────────────────
    if body_text and context_id:
        await _handle_reply_threading(context_id, body_text, from_phone, user_id, pool)
        return

    # ── 4. Free-text with no context ──────────────────────────────────────
    if body_text:
        await _send_fallback(from_phone)
        return


# ── Action handlers ────────────────────────────────────────────────────────────

async def _handle_approve(task_id: str, from_phone: str, user_id: str | None, pool) -> None:
    """Approve a task from WhatsApp button tap."""
    task = await pool.fetchrow("SELECT * FROM tasks WHERE task_id=$1", task_id)
    if not task:
        await _send_text(from_phone, "❌ Task not found. It may have been deleted.")
        return

    if task["approval_status"] == "approved":
        await _send_text(from_phone, "✅ This task is already approved.")
        return

    if task["approval_status"] not in ("pending", "pending_client"):
        await _send_text(from_phone, f"This task is not awaiting approval (status: {task['approval_status']}).")
        return

    # Find the done column
    done_col = await pool.fetchrow(
        "SELECT column_id FROM project_columns WHERE team_id=$1 AND is_done=TRUE ORDER BY sort_order DESC LIMIT 1",
        task["team_id"]
    )
    new_col_id = done_col["column_id"] if done_col else task["column_id"]

    await pool.execute("""
        UPDATE tasks
        SET approval_status='approved', approved_by=$1, approval_notes='Approved via WhatsApp',
            approval_decided_at=NOW(), column_id=$2, status='done',
            completed_at=NOW(), completed_by_user_id=$1, updated_at=NOW()
        WHERE task_id=$3
    """, user_id or "whatsapp", new_col_id, task_id)

    # Notify task creator
    if task["created_by_user_id"] and task["created_by_user_id"] != user_id:
        try:
            approver_name = await _get_name(pool, user_id) if user_id else "Someone on WhatsApp"
            from services.whatsapp_service import send_approval_decision
            await send_approval_decision(
                pool, task["created_by_user_id"], task_id, task["title"],
                approver_name, "approved"
            )
            # In-app notification
            await pool.execute("""
                INSERT INTO notifications (notification_id, user_id, type, title, message, task_id, url)
                VALUES ($1,$2,'approved',$3,$4,$5,$6)
            """,
                f"notif_{uuid.uuid4().hex[:12]}",
                task["created_by_user_id"],
                f"Task approved: {task['title']}",
                "Approved via WhatsApp",
                task_id, "/tasks"
            )
        except Exception as exc:
            logger.warning("approve notify failed: %s", exc)

    await _send_text(from_phone, f"✅ *{task['title']}* has been approved and moved to Done. The team has been notified.")
    logger.info("WhatsApp approve: task %s by %s", task_id, from_phone)


async def _handle_reject_init(task_id: str, from_phone: str, pool) -> None:
    """Start the reject flow — ask for reason."""
    task = await pool.fetchrow("SELECT title, approval_status FROM tasks WHERE task_id=$1", task_id)
    if not task:
        await _send_text(from_phone, "❌ Task not found.")
        return

    if task["approval_status"] == "rejected":
        await _send_text(from_phone, "This task has already been rejected.")
        return

    # Save session
    await pool.execute("""
        INSERT INTO whatsapp_sessions (phone, state, context_type, context_id, expires_at)
        VALUES ($1, 'awaiting_reject_reason', 'awaiting_reject_reason', $2, NOW() + INTERVAL '10 minutes')
        ON CONFLICT (phone) DO UPDATE
          SET state='awaiting_reject_reason', context_type='awaiting_reject_reason',
              context_id=$2, expires_at=NOW() + INTERVAL '10 minutes'
    """, "+" + from_phone, task_id)

    await _send_text(from_phone, f"To reject *{task['title']}*, please reply with your reason. (Reply within 10 minutes.)")


async def _handle_reject_reason(task_id: str, from_phone: str, user_id: str | None, reason: str, pool) -> None:
    """Complete the reject flow with the provided reason."""
    task = await pool.fetchrow("SELECT * FROM tasks WHERE task_id=$1", task_id)
    if not task:
        await _send_text(from_phone, "❌ Task not found — could not reject.")
        return

    await pool.execute("""
        UPDATE tasks
        SET approval_status='rejected', approved_by=$1, approval_notes=$2,
            approval_decided_at=NOW(), updated_at=NOW()
        WHERE task_id=$3
    """, user_id or "whatsapp", reason, task_id)

    # Notify task creator
    if task["created_by_user_id"] and task["created_by_user_id"] != user_id:
        try:
            rejector_name = await _get_name(pool, user_id) if user_id else "Someone on WhatsApp"
            from services.whatsapp_service import send_approval_decision
            await send_approval_decision(
                pool, task["created_by_user_id"], task_id, task["title"],
                rejector_name, "rejected", reason
            )
            await pool.execute("""
                INSERT INTO notifications (notification_id, user_id, type, title, message, task_id, url)
                VALUES ($1,$2,'rejected',$3,$4,$5,$6)
            """,
                f"notif_{uuid.uuid4().hex[:12]}",
                task["created_by_user_id"],
                f"Task rejected: {task['title']}",
                reason,
                task_id, "/tasks"
            )
        except Exception as exc:
            logger.warning("reject notify failed: %s", exc)

    await _send_text(from_phone, f"✕ *{task['title']}* has been rejected. The requester has been notified with your reason.")
    logger.info("WhatsApp reject: task %s reason=%s", task_id, reason[:50])


async def _handle_reply_threading(context_wamid: str, text: str, from_phone: str, user_id: str | None, pool) -> None:
    """Route a text reply to the correct task comment or channel message."""
    origin = await pool.fetchrow(
        "SELECT context_type, context_id, user_id AS sender_id FROM whatsapp_messages WHERE wa_message_id=$1",
        context_wamid
    )
    if not origin:
        await _send_fallback(from_phone)
        return

    ctx_type = origin["context_type"]
    ctx_id   = origin["context_id"]

    # ── Post as task comment ──────────────────────────────────────────────
    if ctx_type in ("approval", "task_comment") and ctx_id:
        if not user_id:
            await _send_text(from_phone, "Your number isn't linked to a Kartavya account. Ask your admin to invite you.")
            return
        cmt_id = f"cmt_{uuid.uuid4().hex[:12]}"
        try:
            await pool.execute("""
                INSERT INTO task_comments (comment_id, task_id, user_id, body)
                VALUES ($1, $2, $3, $4)
            """, cmt_id, ctx_id, user_id, f"[WhatsApp] {text}")

            # Fan-out in-app notifications to task participants
            task = await pool.fetchrow("SELECT title, team_id, created_by_user_id, assignee_user_ids FROM tasks WHERE task_id=$1", ctx_id)
            if task:
                recipients = set()
                if task["created_by_user_id"] and task["created_by_user_id"] != user_id:
                    recipients.add(task["created_by_user_id"])
                for uid in (task["assignee_user_ids"] or []):
                    if uid != user_id:
                        recipients.add(uid)
                sender_name = await _get_name(pool, user_id)
                for rid in recipients:
                    await pool.execute("""
                        INSERT INTO notifications (notification_id, user_id, type, title, message, task_id, url)
                        VALUES ($1,$2,'comment',$3,$4,$5,'/tasks')
                    """,
                        f"notif_{uuid.uuid4().hex[:12]}", rid,
                        f"Comment on {task['title']}",
                        f"{sender_name} (WhatsApp): {text[:100]}",
                        ctx_id
                    )
            await _send_text(from_phone, "✓ Your reply has been added as a comment on the task.")
        except Exception as exc:
            logger.error("wa comment insert failed: %s", exc)
            await _send_text(from_phone, "Sorry, could not post your comment. Please try again.")
        return

    # ── Post as channel message ────────────────────────────────────────────
    if ctx_type == "mention" and ctx_id:
        if not user_id:
            await _send_text(from_phone, "Your number isn't linked to a Kartavya account.")
            return
        msg_id = f"msg_{uuid.uuid4().hex[:12]}"
        try:
            await pool.execute("""
                INSERT INTO messages (message_id, channel_id, sender_id, body, source)
                VALUES ($1, $2, $3, $4, 'whatsapp')
            """, msg_id, ctx_id, user_id, text)
            await _send_text(from_phone, "✓ Your message has been posted in the channel.")
        except Exception as exc:
            logger.error("wa channel message insert failed: %s", exc)
        return

    await _send_fallback(from_phone)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _extract_text(msg: dict) -> str | None:
    if msg.get("type") == "text":
        return (msg.get("text") or {}).get("body")
    return None


def _extract_button_payload(msg: dict) -> str | None:
    # Quick-reply button payload
    if msg.get("type") == "button":
        return (msg.get("button") or {}).get("payload")
    # Interactive button reply
    if msg.get("type") == "interactive":
        ir = (msg.get("interactive") or {})
        if ir.get("type") == "button_reply":
            return (ir.get("button_reply") or {}).get("id")
    return None


async def _get_name(pool, user_id: str) -> str:
    row = await pool.fetchrow(
        "SELECT COALESCE(full_name, name, email) AS name FROM users WHERE user_id=$1", user_id
    )
    return row["name"] if row else "Team member"


async def _send_text(phone: str, text: str) -> None:
    """Send a free-text reply (within 24h session window opened by their inbound message)."""
    try:
        from services.whatsapp_service import send_text
        await send_text("+" + phone, text)
    except Exception as exc:
        logger.warning("wa reply failed: %s", exc)


async def _send_fallback(phone: str) -> None:
    await _send_text(
        phone,
        "👋 Hi! To add a comment or reply, please use the Kartavya notification message you received. "
        "Direct messages to this number are not monitored."
    )
