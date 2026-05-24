"""
mentions.py — Parse @mentions in comment body, fan out notifications + emails.
Bug fixed: was importing _base from email_service which didn't exist as a
public export; switched to send_mention_email helper.
"""
import re
import uuid

MENTION_RE = re.compile(r'@([\w.-]+)')


async def process_mentions(pool, comment_id: str, body: str, task_id: str, actor_id: str):
    handles = set(MENTION_RE.findall(body))
    if not handles:
        return

    task  = await pool.fetchrow("SELECT team_id, title FROM tasks WHERE task_id=$1", task_id)
    actor = await pool.fetchrow(
        "SELECT COALESCE(full_name,name,email) AS display FROM users WHERE user_id=$1", actor_id
    )
    actor_name = actor["display"] if actor else "Someone"

    for handle in handles:
        user = await pool.fetchrow(
            """
            SELECT user_id, email, COALESCE(full_name,name,email) AS display
            FROM users
            WHERE LOWER(email)=LOWER($1) OR LOWER(name)=LOWER($1) OR LOWER(full_name)=LOWER($1)
            """,
            handle,
        )
        if not user or user["user_id"] == actor_id:
            continue

        mention_id = f"ment_{uuid.uuid4().hex[:12]}"
        try:
            await pool.execute(
                "INSERT INTO mentions (mention_id, comment_id, mentioned_user_id) VALUES ($1,$2,$3)",
                mention_id, comment_id, user["user_id"],
            )
        except Exception:
            pass

        await pool.execute(
            """
            INSERT INTO notifications (notification_id, user_id, type, title, message, task_id)
            VALUES ($1,$2,'mention',$3,$4,$5)
            """,
            f"notif_{uuid.uuid4().hex[:12]}",
            user["user_id"],
            f"You were mentioned in {task['title'] if task else 'a task'}",
            f"{actor_name} mentioned you in a comment.",
            task_id,
        )

        try:
            from email_service import send_mention_email
            send_mention_email(
                user["email"],
                user["display"],
                actor_name,
                task["title"] if task else "a task",
                task_id,
                body,
            )
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning(f"mention email failed: {exc}")

        try:
            from services.push_service import send_push
            import asyncio
            asyncio.ensure_future(send_push(
                pool,
                recipient_id=user["user_id"],
                kind="mention",
                title=f"You were mentioned in {task['title'] if task else 'a task'}",
                body=f"{actor_name} mentioned you in a comment.",
                task_id=task_id,
                is_mine=True,
            ))
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning(f"mention push failed: {exc}")
