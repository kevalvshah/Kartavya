"""
whatsapp_templates.py — WhatsApp message template management.
Mounted at /api/whatsapp/templates

Stores template definitions in `whatsapp_template_defs` (created on first use).
System templates are returned as read-only entries; custom ones are editable.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth_router import require_user, require_admin
from db import get_pool

router = APIRouter(prefix="/api/whatsapp/templates", tags=["whatsapp-templates"])

_SCHEMA_CREATED = False


async def _ensure_schema(pool):
    global _SCHEMA_CREATED
    if _SCHEMA_CREATED:
        return
    await pool.execute("""
        CREATE TABLE IF NOT EXISTS whatsapp_template_defs (
            template_id   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            name          TEXT NOT NULL,
            template_key  TEXT NOT NULL UNIQUE,
            category      TEXT NOT NULL DEFAULT 'UTILITY',
            language      TEXT NOT NULL DEFAULT 'en',
            header_text   TEXT,
            body_text     TEXT NOT NULL,
            footer_text   TEXT,
            buttons       JSONB NOT NULL DEFAULT '[]',
            params        JSONB NOT NULL DEFAULT '[]',
            is_system     BOOLEAN NOT NULL DEFAULT FALSE,
            status        TEXT NOT NULL DEFAULT 'APPROVED',
            created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    # Seed system templates (upsert — idempotent)
    for t in _SYSTEM_TEMPLATES:
        await pool.execute("""
            INSERT INTO whatsapp_template_defs
              (template_id, name, template_key, category, language, header_text,
               body_text, footer_text, buttons, params, is_system, status)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE,'APPROVED')
            ON CONFLICT (template_key) DO NOTHING
        """,
            t["template_id"], t["name"], t["template_key"], t["category"],
            t.get("language", "en"), t.get("header_text"),
            t["body_text"], t.get("footer_text"),
            __import__("json").dumps(t.get("buttons", [])),
            __import__("json").dumps(t.get("params", [])),
        )
    _SCHEMA_CREATED = True


# ── System template seed data ─────────────────────────────────────────────────

_SYSTEM_TEMPLATES = [
    {
        "template_id": "sys-otp",
        "name": "OTP Verification",
        "template_key": "kartavya_otp",
        "category": "AUTHENTICATION",
        "language": "en",
        "header_text": None,
        "body_text": "Your *Kartavya* verification code is:\n\n*{{1}}*\n\nThis code is valid for 10 minutes. Do not share it with anyone.",
        "footer_text": "Kartavya by Aekam Inc",
        "buttons": [],
        "params": [{"key": "1", "label": "OTP Code", "example": "482917"}],
    },
    {
        "template_id": "sys-task-assigned",
        "name": "Task Assigned",
        "template_key": "kartavya_task_assigned",
        "category": "UTILITY",
        "language": "en",
        "header_text": "📋 New task for you",
        "body_text": "Hi *{{1}}*, you've been assigned a new task:\n\n*{{2}}*\n\nDue date: {{3}}\n\nOpen Kartavya to view details and get started.",
        "footer_text": "Kartavya · कार्तव्य",
        "buttons": [],
        "params": [
            {"key": "1", "label": "First name",  "example": "Priya"},
            {"key": "2", "label": "Task title",  "example": "Design homepage mockup"},
            {"key": "3", "label": "Due date",    "example": "15 Jun 2026"},
        ],
    },
    {
        "template_id": "sys-approval-request",
        "name": "Approval Request",
        "template_key": "kartavya_approval_request",
        "category": "UTILITY",
        "language": "en",
        "header_text": "✅ Approval needed",
        "body_text": "A task is waiting for your approval:\n\n*{{1}}*\n\nRequested by: {{2}}\nNotes: _{{3}}_\n\nPlease review and respond.",
        "footer_text": "Kartavya · कार्तव्य",
        "buttons": [
            {"type": "QUICK_REPLY", "text": "Approve ✅", "payload": "APPROVE_{{task_id}}"},
            {"type": "QUICK_REPLY", "text": "Reject ❌",  "payload": "REJECT_{{task_id}}"},
        ],
        "params": [
            {"key": "1", "label": "Task title",      "example": "Q2 Brand Campaign"},
            {"key": "2", "label": "Requester name",  "example": "Keval Shah"},
            {"key": "3", "label": "Notes",           "example": "Please check brand guidelines"},
        ],
    },
    {
        "template_id": "sys-task-approved",
        "name": "Task Approved",
        "template_key": "kartavya_task_approved",
        "category": "UTILITY",
        "language": "en",
        "header_text": "🎉 Task approved!",
        "body_text": "Great news, *{{1}}*!\n\nYour task *{{2}}* has been approved by {{3}} ✅\n\nKeep up the great work!",
        "footer_text": "Kartavya · कार्तव्य",
        "buttons": [],
        "params": [
            {"key": "1", "label": "First name",    "example": "Priya"},
            {"key": "2", "label": "Task title",    "example": "Q2 Brand Campaign"},
            {"key": "3", "label": "Reviewer name", "example": "Keval Shah"},
        ],
    },
    {
        "template_id": "sys-task-rejected",
        "name": "Task Rejected",
        "template_key": "kartavya_task_rejected",
        "category": "UTILITY",
        "language": "en",
        "header_text": "📝 Revision requested",
        "body_text": "Hi *{{1}}*, your task *{{2}}* needs revision.\n\nReviewed by: {{3}}\nReason: _{{4}}_\n\nPlease update the task and resubmit.",
        "footer_text": "Kartavya · कार्तव्य",
        "buttons": [],
        "params": [
            {"key": "1", "label": "First name",    "example": "Priya"},
            {"key": "2", "label": "Task title",    "example": "Q2 Brand Campaign"},
            {"key": "3", "label": "Reviewer name", "example": "Keval Shah"},
            {"key": "4", "label": "Reason",        "example": "Logo needs to be updated"},
        ],
    },
    {
        "template_id": "sys-mention",
        "name": "Mention Alert",
        "template_key": "kartavya_mention",
        "category": "UTILITY",
        "language": "en",
        "header_text": "💬 You were mentioned",
        "body_text": "Hi *{{1}}*, {{2}} mentioned you in *{{3}}*:\n\n_\"{{4}}\"_\n\nOpen Kartavya to reply.",
        "footer_text": "Kartavya · कार्तव्य",
        "buttons": [],
        "params": [
            {"key": "1", "label": "First name",   "example": "Priya"},
            {"key": "2", "label": "Actor name",   "example": "Keval Shah"},
            {"key": "3", "label": "Context",      "example": "#general"},
            {"key": "4", "label": "Message snip", "example": "Can you review this by EOD?"},
        ],
    },
]


# ── Schemas ───────────────────────────────────────────────────────────────────

class TemplateButton(BaseModel):
    type:    str          # QUICK_REPLY | URL | PHONE_NUMBER
    text:    str
    payload: Optional[str] = None
    url:     Optional[str] = None
    phone:   Optional[str] = None

class TemplateParam(BaseModel):
    key:     str
    label:   str
    example: str = ""

class CreateTemplateBody(BaseModel):
    name:         str
    template_key: str
    category:     str = "UTILITY"
    language:     str = "en"
    header_text:  Optional[str] = None
    body_text:    str
    footer_text:  Optional[str] = None
    buttons:      List[TemplateButton] = []
    params:       List[TemplateParam]  = []

class UpdateTemplateBody(BaseModel):
    name:         Optional[str] = None
    category:     Optional[str] = None
    language:     Optional[str] = None
    header_text:  Optional[str] = None
    body_text:    Optional[str] = None
    footer_text:  Optional[str] = None
    buttons:      Optional[List[TemplateButton]] = None
    params:       Optional[List[TemplateParam]]  = None
    status:       Optional[str] = None

class TestSendBody(BaseModel):
    phone:       str
    param_values: List[str] = []


# ── Endpoints ─────────────────────────────────────────────────────────────────

def _row_to_dict(row) -> dict:
    import json
    d = dict(row)
    if isinstance(d.get("buttons"), str):
        d["buttons"] = json.loads(d["buttons"])
    if isinstance(d.get("params"), str):
        d["params"] = json.loads(d["params"])
    return d


@router.get("")
async def list_templates(pool=Depends(get_pool), user=Depends(require_user)):
    await _ensure_schema(pool)
    rows = await pool.fetch("SELECT * FROM whatsapp_template_defs ORDER BY is_system DESC, created_at ASC")
    return [_row_to_dict(r) for r in rows]


@router.post("")
async def create_template(body: CreateTemplateBody, pool=Depends(get_pool), user=Depends(require_admin)):
    await _ensure_schema(pool)
    import json
    tid = str(uuid.uuid4())
    row = await pool.fetchrow("""
        INSERT INTO whatsapp_template_defs
          (template_id, name, template_key, category, language,
           header_text, body_text, footer_text, buttons, params, is_system, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,FALSE,'PENDING')
        RETURNING *
    """, tid, body.name, body.template_key, body.category, body.language,
        body.header_text, body.body_text, body.footer_text,
        json.dumps([b.model_dump() for b in body.buttons]),
        json.dumps([p.model_dump() for p in body.params]),
    )
    return _row_to_dict(row)


@router.patch("/{template_id}")
async def update_template(template_id: str, body: UpdateTemplateBody,
                           pool=Depends(get_pool), user=Depends(require_admin)):
    await _ensure_schema(pool)
    import json
    row = await pool.fetchrow(
        "SELECT is_system FROM whatsapp_template_defs WHERE template_id=$1", template_id
    )
    if not row:
        raise HTTPException(404, "Template not found")

    updates, vals = [], []
    def add(col, val):
        updates.append(f"{col}=${len(vals)+1}")
        vals.append(val)

    if body.name        is not None: add("name",        body.name)
    if body.category    is not None: add("category",    body.category)
    if body.language    is not None: add("language",    body.language)
    if body.header_text is not None: add("header_text", body.header_text)
    if body.body_text   is not None: add("body_text",   body.body_text)
    if body.footer_text is not None: add("footer_text", body.footer_text)
    if body.status      is not None: add("status",      body.status)
    if body.buttons     is not None: add("buttons",     json.dumps([b.model_dump() for b in body.buttons]))
    if body.params      is not None: add("params",      json.dumps([p.model_dump() for p in body.params]))

    if updates:
        updates.append(f"updated_at=${len(vals)+1}")
        vals.append(datetime.now(timezone.utc))
        vals.append(template_id)
        updated = await pool.fetchrow(
            f"UPDATE whatsapp_template_defs SET {', '.join(updates)} WHERE template_id=${len(vals)} RETURNING *",
            *vals
        )
        return _row_to_dict(updated)
    return _row_to_dict(await pool.fetchrow("SELECT * FROM whatsapp_template_defs WHERE template_id=$1", template_id))


@router.delete("/{template_id}")
async def delete_template(template_id: str, pool=Depends(get_pool), user=Depends(require_admin)):
    await _ensure_schema(pool)
    row = await pool.fetchrow(
        "SELECT is_system FROM whatsapp_template_defs WHERE template_id=$1", template_id
    )
    if not row:
        raise HTTPException(404, "Template not found")
    if row["is_system"]:
        raise HTTPException(400, "System templates cannot be deleted")
    await pool.execute("DELETE FROM whatsapp_template_defs WHERE template_id=$1", template_id)
    return {"ok": True}


@router.post("/{template_id}/test-send")
async def test_send(template_id: str, body: TestSendBody,
                    pool=Depends(get_pool), user=Depends(require_admin)):
    await _ensure_schema(pool)
    row = await pool.fetchrow(
        "SELECT * FROM whatsapp_template_defs WHERE template_id=$1", template_id
    )
    if not row:
        raise HTTPException(404, "Template not found")
    tmpl = _row_to_dict(row)
    from services.whatsapp_service import send_template
    wamid = await send_template(
        body.phone,
        tmpl["template_key"],
        body.param_values,
        buttons=None,
    )
    return {"ok": True, "wamid": wamid, "dev_mode": wamid is None}
