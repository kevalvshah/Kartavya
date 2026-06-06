"""
messaging.py — In-app messaging · संवाद
Channels (project, general, dm) + messages + reactions + read tracking.
"""
import json
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth_router import require_user
from db import get_pool

router = APIRouter(prefix="/api", tags=["messaging"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class ChannelCreate(BaseModel):
    type: str = "project"          # project | general | dm
    name: Optional[str] = None
    project_id: Optional[str] = None
    member_ids: List[str] = []


class MessageCreate(BaseModel):
    body: str
    parent_id: Optional[str] = None
    metadata: Optional[dict] = None


class ReactionToggle(BaseModel):
    emoji: str


class MessageEdit(BaseModel):
    body: str


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _assert_channel_member(pool, channel_id: str, user_id: str, user_role: str):
    if user_role == "admin":
        return
    row = await pool.fetchrow(
        "SELECT 1 FROM channel_members WHERE channel_id=$1 AND user_id=$2",
        channel_id, user_id
    )
    if not row:
        raise HTTPException(403, "Not a member of this channel")


async def _fmt_message(row: dict, reactions: list, reply_count: int) -> dict:
    return {
        "message_id":  row["message_id"],
        "channel_id":  row["channel_id"],
        "sender_id":   row["sender_id"],
        "sender_name": row.get("sender_name") or "Unknown",
        "sender_avatar": row.get("sender_avatar"),
        "body":        row["body"] if not row.get("deleted_at") else None,
        "deleted":     bool(row.get("deleted_at")),
        "parent_id":   row.get("parent_id"),
        "source":      row.get("source", "web"),
        "metadata":    row.get("metadata") or {},
        "edited_at":   row.get("edited_at"),
        "created_at":  row["created_at"],
        "reactions":   reactions,
        "reply_count": reply_count,
    }


# ── Channels ───────────────────────────────────────────────────────────────────

@router.get("/channels")
async def list_channels(pool=Depends(get_pool), user=Depends(require_user)):
    """Return all channels the user belongs to with unread counts."""
    uid = user["user_id"]
    rows = await pool.fetch("""
        SELECT
            c.channel_id, c.type, c.name, c.project_id, c.org_id, c.created_at,
            cm.last_read_at,
            (
                SELECT COUNT(*) FROM messages m
                WHERE m.channel_id = c.channel_id
                  AND m.created_at > COALESCE(cm.last_read_at, '1970-01-01')
                  AND m.deleted_at IS NULL
                  AND m.sender_id != $1
            ) AS unread_count,
            (
                SELECT m2.body FROM messages m2
                WHERE m2.channel_id = c.channel_id AND m2.deleted_at IS NULL
                ORDER BY m2.created_at DESC LIMIT 1
            ) AS last_message,
            (
                SELECT m2.created_at FROM messages m2
                WHERE m2.channel_id = c.channel_id AND m2.deleted_at IS NULL
                ORDER BY m2.created_at DESC LIMIT 1
            ) AS last_message_at,
            t.name AS project_name
        FROM channels c
        JOIN channel_members cm ON cm.channel_id = c.channel_id AND cm.user_id = $1
        LEFT JOIN teams t ON t.team_id = c.project_id
        WHERE c.archived_at IS NULL
        ORDER BY COALESCE(
            (SELECT MAX(m3.created_at) FROM messages m3 WHERE m3.channel_id = c.channel_id),
            c.created_at
        ) DESC
    """, uid)
    return [dict(r) for r in rows]


@router.post("/channels")
async def create_channel(body: ChannelCreate, pool=Depends(get_pool), user=Depends(require_user)):
    """Create a channel or start a DM."""
    if body.type not in ("project", "general", "dm"):
        raise HTTPException(400, "type must be project, general, or dm")

    # For DMs: find or create
    if body.type == "dm":
        if len(body.member_ids) != 1:
            raise HTTPException(400, "DM requires exactly one other member_id")
        other_id = body.member_ids[0]
        existing = await pool.fetchrow("""
            SELECT c.channel_id FROM channels c
            JOIN channel_members a ON a.channel_id = c.channel_id AND a.user_id = $1
            JOIN channel_members b ON b.channel_id = c.channel_id AND b.user_id = $2
            WHERE c.type = 'dm'
            LIMIT 1
        """, user["user_id"], other_id)
        if existing:
            return {"channel_id": existing["channel_id"], "existing": True}

    if not body.project_id:
        raise HTTPException(400, "project_id (org_id) required for non-DM channels")

    channel_id = f"ch_{uuid.uuid4().hex[:12]}"
    await pool.execute("""
        INSERT INTO channels (channel_id, org_id, type, project_id, name, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
    """, channel_id,
        body.project_id,
        body.type,
        body.project_id if body.type == "project" else None,
        body.name,
        user["user_id"])

    # Add creator + members
    member_ids = list({user["user_id"], *body.member_ids})
    for mid in member_ids:
        await pool.execute(
            "INSERT INTO channel_members (channel_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
            channel_id, mid
        )

    row = await pool.fetchrow("SELECT * FROM channels WHERE channel_id=$1", channel_id)
    return dict(row)


@router.get("/channels/{channel_id}/messages")
async def get_messages(
    channel_id: str,
    before: Optional[str] = None,
    limit: int = 50,
    pool=Depends(get_pool),
    user=Depends(require_user),
):
    """Return paginated messages for a channel (cursor = before timestamp)."""
    await _assert_channel_member(pool, channel_id, user["user_id"], user.get("role", ""))

    params = [channel_id]
    cursor_clause = ""
    if before:
        params.append(before)
        cursor_clause = f"AND m.created_at < ${len(params)}"

    params.append(min(limit, 100))
    rows = await pool.fetch(f"""
        SELECT m.*,
               COALESCE(u.full_name, u.name, u.email) AS sender_name,
               u.avatar AS sender_avatar
        FROM messages m
        LEFT JOIN users u ON u.user_id = m.sender_id
        WHERE m.channel_id = $1 AND m.parent_id IS NULL {cursor_clause}
        ORDER BY m.created_at DESC
        LIMIT ${len(params)}
    """, *params)

    # Fetch reactions and reply counts in bulk
    msg_ids = [r["message_id"] for r in rows]
    reactions_map: dict = {mid: [] for mid in msg_ids}
    reply_counts: dict  = {mid: 0  for mid in msg_ids}

    if msg_ids:
        rxn_rows = await pool.fetch("""
            SELECT mr.message_id, mr.emoji, mr.user_id,
                   COALESCE(u.full_name, u.name, u.email) AS user_name
            FROM message_reactions mr
            JOIN users u ON u.user_id = mr.user_id
            WHERE mr.message_id = ANY($1::text[])
        """, msg_ids)
        for r in rxn_rows:
            reactions_map[r["message_id"]].append({
                "emoji": r["emoji"], "user_id": r["user_id"], "user_name": r["user_name"]
            })

        rc_rows = await pool.fetch("""
            SELECT parent_id, COUNT(*) AS cnt
            FROM messages
            WHERE parent_id = ANY($1::text[]) AND deleted_at IS NULL
            GROUP BY parent_id
        """, msg_ids)
        for r in rc_rows:
            reply_counts[r["parent_id"]] = r["cnt"]

    result = []
    for r in reversed(rows):
        mid = r["message_id"]
        result.append(await _fmt_message(dict(r), reactions_map[mid], reply_counts[mid]))
    return result


@router.get("/channels/{channel_id}/messages/{message_id}/replies")
async def get_replies(
    channel_id: str, message_id: str,
    pool=Depends(get_pool), user=Depends(require_user)
):
    """Return thread replies for a message."""
    await _assert_channel_member(pool, channel_id, user["user_id"], user.get("role", ""))
    rows = await pool.fetch("""
        SELECT m.*, COALESCE(u.full_name, u.name, u.email) AS sender_name, u.avatar AS sender_avatar
        FROM messages m
        LEFT JOIN users u ON u.user_id = m.sender_id
        WHERE m.parent_id = $1 AND m.deleted_at IS NULL
        ORDER BY m.created_at ASC
    """, message_id)
    result = []
    for r in rows:
        result.append(await _fmt_message(dict(r), [], 0))
    return result


@router.post("/channels/{channel_id}/messages")
async def send_message(
    channel_id: str, body: MessageCreate,
    pool=Depends(get_pool), user=Depends(require_user)
):
    """Send a message to a channel."""
    await _assert_channel_member(pool, channel_id, user["user_id"], user.get("role", ""))
    if not body.body.strip():
        raise HTTPException(400, "Message body cannot be empty")

    msg_id = f"msg_{uuid.uuid4().hex[:12]}"
    meta_json = json.dumps(body.metadata or {})
    row = await pool.fetchrow("""
        INSERT INTO messages (message_id, channel_id, sender_id, body, parent_id, source, metadata)
        VALUES ($1, $2, $3, $4, $5, 'web', $6::jsonb)
        RETURNING *
    """, msg_id, channel_id, user["user_id"], body.body.strip(), body.parent_id, meta_json)

    # Update last_read_at for sender
    await pool.execute(
        "UPDATE channel_members SET last_read_at=NOW() WHERE channel_id=$1 AND user_id=$2",
        channel_id, user["user_id"]
    )

    # @mention detection → in-app notifications
    import re
    channel = await pool.fetchrow("SELECT org_id FROM channels WHERE channel_id=$1", channel_id)
    handles = set(re.findall(r'@([\w.\-]+)', body.body))
    if handles and channel:
        for handle in handles:
            mentioned = await pool.fetchrow("""
                SELECT user_id FROM users
                WHERE (LOWER(email)=LOWER($1) OR LOWER(name)=LOWER($1) OR LOWER(full_name)=LOWER($1))
                  AND user_id != $2
            """, handle, user["user_id"])
            if mentioned:
                try:
                    await pool.execute("""
                        INSERT INTO notifications
                          (notification_id, user_id, type, title, message, url)
                        VALUES ($1,$2,'mention',$3,$4,$5)
                    """,
                        f"notif_{uuid.uuid4().hex[:12]}",
                        mentioned["user_id"],
                        f"You were mentioned in a message",
                        f"{user.get('name','Someone')} mentioned you: {body.body[:80]}",
                        f"/messages/{channel_id}"
                    )
                    # Push notification
                    import asyncio as _asyncio
                    from services.push_service import send_push
                    _asyncio.ensure_future(send_push(
                        pool,
                        recipient_id=mentioned["user_id"],
                        kind="mention",
                        title="You were mentioned",
                        body=f"{user.get('name','Someone')}: {body.body[:80]}",
                        task_id=None,
                        is_mine=True,
                    ))
                except Exception:
                    pass

    sender_name = user.get("full_name") or user.get("name") or user.get("email", "")
    return await _fmt_message(
        {**dict(row), "sender_name": sender_name, "sender_avatar": user.get("avatar")},
        [], 0
    )


@router.patch("/messages/{message_id}")
async def edit_message(
    message_id: str, body: MessageEdit,
    pool=Depends(get_pool), user=Depends(require_user)
):
    """Edit your own message."""
    msg = await pool.fetchrow("SELECT * FROM messages WHERE message_id=$1", message_id)
    if not msg:
        raise HTTPException(404, "Message not found")
    if msg["sender_id"] != user["user_id"] and user.get("role") != "admin":
        raise HTTPException(403, "Can only edit your own messages")
    if msg.get("deleted_at"):
        raise HTTPException(400, "Cannot edit a deleted message")
    await pool.execute(
        "UPDATE messages SET body=$1, edited_at=NOW() WHERE message_id=$2",
        body.body.strip(), message_id
    )
    return {"ok": True}


@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: str,
    pool=Depends(get_pool), user=Depends(require_user)
):
    """Soft-delete a message."""
    msg = await pool.fetchrow("SELECT * FROM messages WHERE message_id=$1", message_id)
    if not msg:
        raise HTTPException(404, "Message not found")
    if msg["sender_id"] != user["user_id"] and user.get("role") != "admin":
        raise HTTPException(403, "Can only delete your own messages")
    await pool.execute(
        "UPDATE messages SET deleted_at=NOW(), body='' WHERE message_id=$1", message_id
    )
    return {"ok": True}


@router.post("/messages/{message_id}/reactions")
async def toggle_reaction(
    message_id: str, body: ReactionToggle,
    pool=Depends(get_pool), user=Depends(require_user)
):
    """Toggle an emoji reaction on a message."""
    existing = await pool.fetchrow(
        "SELECT 1 FROM message_reactions WHERE message_id=$1 AND user_id=$2 AND emoji=$3",
        message_id, user["user_id"], body.emoji
    )
    if existing:
        await pool.execute(
            "DELETE FROM message_reactions WHERE message_id=$1 AND user_id=$2 AND emoji=$3",
            message_id, user["user_id"], body.emoji
        )
        return {"action": "removed"}
    else:
        await pool.execute(
            "INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
            message_id, user["user_id"], body.emoji
        )
        return {"action": "added"}


@router.patch("/channels/{channel_id}/read")
async def mark_read(
    channel_id: str,
    pool=Depends(get_pool), user=Depends(require_user)
):
    """Mark all messages in channel as read for this user."""
    await pool.execute(
        "UPDATE channel_members SET last_read_at=NOW() WHERE channel_id=$1 AND user_id=$2",
        channel_id, user["user_id"]
    )
    return {"ok": True}


@router.get("/messages/unread-count")
async def total_unread(pool=Depends(get_pool), user=Depends(require_user)):
    """Return total unread message count across all the user's channels."""
    uid = user["user_id"]
    row = await pool.fetchrow("""
        SELECT COUNT(*) AS total FROM messages m
        JOIN channel_members cm ON cm.channel_id = m.channel_id AND cm.user_id = $1
        WHERE m.created_at > COALESCE(cm.last_read_at, '1970-01-01')
          AND m.deleted_at IS NULL
          AND m.sender_id != $1
    """, uid)
    return {"count": int(row["total"]) if row else 0}


@router.get("/messages/unfurl")
async def unfurl(url: str, pool=Depends(get_pool), user=Depends(require_user)):
    """Return task card data if URL is a Kartavya task link, else OG metadata."""
    import re
    task_match = re.search(r'/tasks?/([a-zA-Z0-9_-]+)', url)
    if task_match:
        task_id = task_match.group(1)
        task = await pool.fetchrow("""
            SELECT task_id, title, status, priority, due_at,
                   COALESCE(u.full_name, u.name) AS assignee_name
            FROM tasks t
            LEFT JOIN users u ON u.user_id = ANY(t.assignee_user_ids)
            WHERE t.task_id = $1
        """, task_id)
        if task:
            return {"type": "task", "task_id": task["task_id"], "title": task["title"],
                    "status": task["status"], "priority": task["priority"],
                    "due_at": task["due_at"], "assignee_name": task["assignee_name"]}
    return {"type": "link", "url": url}


@router.get("/channels/{channel_id}/members")
async def channel_members(
    channel_id: str,
    pool=Depends(get_pool), user=Depends(require_user)
):
    """List members of a channel."""
    rows = await pool.fetch("""
        SELECT u.user_id, COALESCE(u.full_name, u.name, u.email) AS name,
               u.avatar, u.member_role, cm.joined_at
        FROM channel_members cm
        JOIN users u ON u.user_id = cm.user_id
        WHERE cm.channel_id = $1
        ORDER BY cm.joined_at
    """, channel_id)
    return [dict(r) for r in rows]
