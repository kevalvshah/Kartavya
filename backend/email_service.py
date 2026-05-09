"""email_service.py — Kartavya by Aekam Inc
Sends via AWS SES when configured; logs to console otherwise (dev/test mode).
All email functions now accept a task_id/task_url param for deep-linking.
"""
import logging
import os
import threading

logger = logging.getLogger(__name__)

FROM_EMAIL   = os.environ.get("FROM_EMAIL",   "noreply@kartavya.app")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://kartavya-aekam.vercel.app")

AWS_ACCESS_KEY_ID     = os.environ.get("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY")
AWS_REGION            = os.environ.get("AWS_REGION", "us-east-1")

ses_client = None
if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
    try:
        import boto3
        ses_client = boto3.client(
            "ses",
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
            region_name=AWS_REGION,
        )
        logger.info(f"✅ AWS SES configured (Region: {AWS_REGION})")
    except ImportError:
        logger.error("❌ boto3 not installed — pip install boto3")
    except Exception as e:
        logger.error(f"❌ AWS SES init failed: {e}")
else:
    logger.warning("⚠️  AWS SES not configured — emails logged to console only")


# ── Base template ──────────────────────────────────────────────────────────────
def _base(header_html: str, body_html: str) -> str:
    return f"""
    <html><body style="margin:0;padding:0;font-family:'Helvetica Neue',Arial,sans-serif;background:#f4f6fb;">
      <div style="max-width:620px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
        <div style="background:linear-gradient(135deg,#0082c6 0%,#05b7aa 100%);padding:28px 32px;">
          {header_html}
          <p style="color:rgba(255,255,255,.75);margin:6px 0 0;font-size:13px;">Kartavya — Task Management by Aekam Inc</p>
        </div>
        <div style="padding:32px;color:#374151;font-size:15px;line-height:1.7;">
          {body_html}
        </div>
        <div style="padding:16px 32px 24px;border-top:1px solid #e5e7eb;">
          <p style="color:#9ca3af;font-size:12px;margin:0;">You are receiving this because you are a member of a Kartavya workspace.</p>
        </div>
      </div>
    </body></html>
    """


def _btn(url: str, label: str, color: str = "#0082c6") -> str:
    return (f'<div style="text-align:center;margin:28px 0;">'
            f'<a href="{url}" style="background:{color};color:#fff;padding:13px 30px;'
            f'text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;'
            f'display:inline-block;">{label}</a></div>')


# ── Core send (threaded so it never blocks a request) ─────────────────────────
def send_email(to_email: str, subject: str, html_content: str) -> bool:
    def _send():
        if not ses_client:
            logger.info(f"[EMAIL-DEV] To:{to_email} | Subject:{subject}")
            return
        try:
            r = ses_client.send_email(
                Source=FROM_EMAIL,
                Destination={"ToAddresses": [to_email]},
                Message={
                    "Subject": {"Data": subject, "Charset": "UTF-8"},
                    "Body":    {"Html":  {"Data": html_content, "Charset": "UTF-8"}},
                },
            )
            logger.info(f"✅ Email sent → {to_email} [{r['MessageId']}]")
        except Exception as exc:
            logger.error(f"❌ Email failed → {to_email}: {exc}")

    threading.Thread(target=_send, daemon=True).start()
    return True


# ── 1. Invite email ────────────────────────────────────────────────────────────
def send_invite_email(to_email: str, inviter_name: str, role: str, invite_token: str):
    invite_url = f"{FRONTEND_URL}/accept-invite?token={invite_token}"
    role_label = role.capitalize()
    header = f'<h1 style="color:#fff;margin:0;font-size:22px;">🎉 You\'re invited to Kartavya</h1>'
    body   = f"""
        <p>Hi there,</p>
        <p><strong>{inviter_name}</strong> has invited you to join <strong>Kartavya</strong> as a <strong>{role_label}</strong>.</p>
        <p>Click the button below to accept your invitation and set up your account. The link expires in 7 days.</p>
        {_btn(invite_url, 'Accept Invitation', '#0082c6')}
        <p style="color:#6b7280;font-size:13px;">Or paste this URL: {invite_url}</p>
    """
    return send_email(to_email, f"You've been invited to Kartavya", _base(header, body))


# ── 2. Welcome email ───────────────────────────────────────────────────────────
def send_welcome_email(user_email: str, user_name: str):
    header = '<h1 style="color:#fff;margin:0;font-size:22px;">Welcome to Kartavya! 🎉</h1>'
    body   = f"""
        <p>Hi <strong>{user_name}</strong>,</p>
        <p>Your Kartavya account is ready. You can now collaborate on tasks, track time, and review approvals.</p>
        {_btn(f'{FRONTEND_URL}/dashboard', 'Go to Dashboard')}
    """
    return send_email(user_email, "Welcome to Kartavya!", _base(header, body))


# ── 3. Task assignment email ───────────────────────────────────────────────────
def send_task_assignment_email(user_email: str, user_name: str,
                               task_title: str, task_id: str, team_name: str = None):
    task_url = f"{FRONTEND_URL}/tasks/{task_id}"
    team_info = f" in <strong>{team_name}</strong>" if team_name else ""
    header = '<h1 style="color:#fff;margin:0;font-size:22px;">📌 New Task Assigned</h1>'
    body   = f"""
        <p>Hi <strong>{user_name}</strong>,</p>
        <p>You have been assigned a new task{team_info}:</p>
        <div style="background:#f0f9ff;border-left:4px solid #0082c6;padding:14px 18px;
                    border-radius:8px;margin:18px 0;">
          <strong style="font-size:16px;">{task_title}</strong>
        </div>
        {_btn(task_url, 'View Task')}
    """
    return send_email(user_email, f"New task assigned: {task_title}", _base(header, body))


# ── 4. Comment notification email ─────────────────────────────────────────────
def send_comment_email(user_email: str, user_name: str, actor_name: str,
                       task_title: str, task_id: str, comment_preview: str):
    task_url = f"{FRONTEND_URL}/tasks/{task_id}"
    header   = '<h1 style="color:#fff;margin:0;font-size:20px;">💬 New Comment</h1>'
    body     = f"""
        <p>Hi <strong>{user_name}</strong>,</p>
        <p><strong>{actor_name}</strong> commented on <strong>{task_title}</strong>:</p>
        <div style="background:#f9fafb;border-left:4px solid #8b5cf6;padding:14px 18px;
                    border-radius:8px;margin:18px 0;font-style:italic;">
          {comment_preview[:400]}
        </div>
        {_btn(task_url, 'View Comment', '#8b5cf6')}
    """
    return send_email(user_email, f"New comment on: {task_title}", _base(header, body))


# ── 5. @mention email ─────────────────────────────────────────────────────────
def send_mention_email(user_email: str, user_name: str, actor_name: str,
                       task_title: str, task_id: str, comment_body: str):
    task_url = f"{FRONTEND_URL}/tasks/{task_id}"
    header   = '<h1 style="color:#fff;margin:0;font-size:20px;">💬 You were mentioned</h1>'
    body     = f"""
        <p>Hi <strong>{user_name}</strong>,</p>
        <p><strong>{actor_name}</strong> mentioned you in <strong>{task_title}</strong>:</p>
        <div style="background:#f0f4ff;border-left:4px solid #6366f1;padding:14px 18px;
                    border-radius:8px;margin:18px 0;font-style:italic;">
          {comment_body[:300]}
        </div>
        {_btn(task_url, 'View Task', '#6366f1')}
    """
    return send_email(user_email, f"{actor_name} mentioned you", _base(header, body))


# ── 6. Approval request email ──────────────────────────────────────────────────
def send_approval_request_email(user_email: str, user_name: str, requester_name: str,
                                task_title: str, task_id: str, notes: str = None):
    task_url = f"{FRONTEND_URL}/tasks/{task_id}"
    notes_html = f'<p style="color:#6b7280;font-style:italic;">Note: {notes}</p>' if notes else ""
    header = '<h1 style="color:#fff;margin:0;font-size:20px;">⏳ Approval Required</h1>'
    body   = f"""
        <p>Hi <strong>{user_name}</strong>,</p>
        <p><strong>{requester_name}</strong> is requesting your approval on:</p>
        <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:14px 18px;
                    border-radius:8px;margin:18px 0;">
          <strong style="font-size:16px;">{task_title}</strong>
          {notes_html}
        </div>
        {_btn(task_url, 'Review & Approve', '#f59e0b')}
    """
    return send_email(user_email, f"Approval required: {task_title}", _base(header, body))


# ── 7. Approval decision email (approved / rejected) ──────────────────────────
def send_approval_decision_email(user_email: str, user_name: str, reviewer_name: str,
                                 task_title: str, task_id: str,
                                 decision: str, notes: str = None):
    task_url   = f"{FRONTEND_URL}/tasks/{task_id}"
    approved   = decision == "approved"
    color      = "#10b981" if approved else "#ef4444"
    icon       = "✅" if approved else "❌"
    verb       = "approved" if approved else "rejected"
    notes_html = f'<p style="color:#6b7280;">Reviewer note: <em>{notes}</em></p>' if notes else ""
    header = f'<h1 style="color:#fff;margin:0;font-size:20px;">{icon} Task {verb.capitalize()}</h1>'
    body   = f"""
        <p>Hi <strong>{user_name}</strong>,</p>
        <p><strong>{reviewer_name}</strong> has <strong style="color:{color};">{verb}</strong> your task:</p>
        <div style="background:#f9fafb;border-left:4px solid {color};padding:14px 18px;
                    border-radius:8px;margin:18px 0;">
          <strong style="font-size:16px;">{task_title}</strong>
          {notes_html}
        </div>
        {_btn(task_url, 'View Task', color)}
    """
    return send_email(user_email,
                      f"Task {verb}: {task_title}",
                      _base(header, body))


# ── 8. Task reminder ───────────────────────────────────────────────────────────
def send_task_reminder_email(user_email: str, user_name: str,
                             task_title: str, task_id: str, due_date: str):
    task_url = f"{FRONTEND_URL}/tasks/{task_id}"
    header   = '<h1 style="color:#fff;margin:0;font-size:20px;">⏰ Task Reminder</h1>'
    body     = f"""
        <p>Hi <strong>{user_name}</strong>,</p>
        <p>Your task is due soon:</p>
        <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:14px 18px;
                    border-radius:8px;margin:18px 0;">
          <strong>{task_title}</strong><br>
          <span style="color:#92400e;font-size:13px;">Due: {due_date}</span>
        </div>
        {_btn(task_url, 'View Task', '#f59e0b')}
    """
    return send_email(user_email, f"Reminder: {task_title}", _base(header, body))


# ── 9. Team-sync email (task approved by client → notify all assignees) ────────
def send_team_sync_email(user_email: str, user_name: str, client_name: str,
                         task_title: str, task_id: str):
    task_url = f"{FRONTEND_URL}/tasks/{task_id}"
    header   = '<h1 style="color:#fff;margin:0;font-size:20px;">🎉 Task Approved by Client</h1>'
    body     = f"""
        <p>Hi <strong>{user_name}</strong>,</p>
        <p>Great news! <strong>{client_name}</strong> has approved the task:</p>
        <div style="background:#f0fdf4;border-left:4px solid #10b981;padding:14px 18px;
                    border-radius:8px;margin:18px 0;">
          <strong style="font-size:16px;">{task_title}</strong>
        </div>
        <p>The task has been moved to <strong>Done</strong>.</p>
        {_btn(task_url, 'View Task', '#10b981')}
    """
    return send_email(user_email, f"Client approved: {task_title}", _base(header, body))


# ── Legacy alias (approvals_router.py uses this name) ─────────────────────────
def send_approval_notification_email(user_email: str, user_name: str, task_title: str,
                                     notification_type: str, notes: str = None,
                                     task_id: str = None):
    if notification_type == "request":
        return send_approval_request_email(
            user_email, user_name, "A team member", task_title, task_id or "", notes)
    else:
        return send_approval_decision_email(
            user_email, user_name, "The reviewer", task_title, task_id or "", notification_type, notes)


# ── Legacy alias used by invite_router.py ─────────────────────────────────────
def send_team_invite_email(to_email: str, team_name: str, inviter_name: str, invite_token: str):
    return send_invite_email(to_email, inviter_name, "member", invite_token)
