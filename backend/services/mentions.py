"""
mentions.py — Parse @mentions in comment body, fan out notifications + emails.
"""
import re
import uuid

MENTION_RE = re.compile(r'@([\w.-]+)')


async def process_mentions(pool, comment_id: str, body: str, task_id: str, actor_id: str):
    """
    1. Find all @handle patterns.
    2. Resolve handles to user_ids.
    3. Insert mention rows.
    4. Insert notifications.
    5. Send emails.
    """
    handles = set(MENTION_RE.findall(body))
    if not handles:
        return

    task = await pool.fetchrow("SELECT team_id, title FROM tasks WHERE task_id=$1", task_id)
    team  = await pool.fetchrow("SELECT name FROM teams WHERE team_id=$1", task["team_id"]) if task else None
    actor = await pool.fetchrow("SELECT COALESCE(full_name,name,email) AS display FROM users WHERE user_id=$1", actor_id)
    actor_name = actor["display"] if actor else "Someone"

    for handle in handles:
        user = await pool.fetchrow(
            "SELECT user_id, email, COALESCE(full_name,name,email) AS display FROM users WHERE LOWER(email)=LOWER($1) OR LOWER(name)=LOWER($1)",
            handle
        )
        if not user or user["user_id"] == actor_id:
            continue

        mention_id = f"ment_{uuid.uuid4().hex[:12]}"
        try:
            await pool.execute(
                "INSERT INTO mentions (mention_id, comment_id, mentioned_user_id) VALUES ($1,$2,$3)",
                mention_id, comment_id, user["user_id"]
            )
        except Exception:
            pass  # duplicate

        await pool.execute(
            "INSERT INTO notifications (notification_id, user_id, type, title, message, task_id) VALUES ($1,$2,'mention',$3,$4,$5)",
            f"notif_{uuid.uuid4().hex[:12]}",
            user["user_id"],
            f"You were mentioned in {task['title'] if task else 'a task'}",
            f"{actor_name} mentioned you in a comment.",
            task_id,
        )

        try:
            from email_service import send_email, _base, FRONTEND_URL
            header = '<h1 style="color:#fff;margin:0;font-size:20px">&#128172; You were mentioned</h1>'
            body_html = f"""
                <p>Hi <strong>{user['display']}</strong>,</p>
                <p><strong>{actor_name}</strong> mentioned you in <strong>{task['title'] if task else 'a task'}</strong>
                   {f'({team["name"]})' if team else ''}.</p>
                <div style="background:#f0f4ff;border-left:4px solid #0082c6;padding:14px 18px;border-radius:8px;margin:18px 0;font-style:italic">
                  {body[:300]}
                </div>
                <div style="text-align:center;margin:24px 0">
                  <a href="{FRONTEND_URL}/tasks/{task_id}" style="background:#0082c6;color:#fff;padding:12px 26px;text-decoration:none;border-radius:8px;font-weight:600">View Task</a>
                </div>
            """
            send_email(user["email"], f"{actor_name} mentioned you", _base(header, body_html))
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning(f"mention email failed: {exc}")
