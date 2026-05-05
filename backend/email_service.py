"""
email_service.py — AWS SES email service for Kartavya
Added: send_approval_request_email, send_approval_decision_email (with full names)
"""

import logging
import os

logger = logging.getLogger(__name__)

FROM_EMAIL   = os.environ.get("FROM_EMAIL", "noreply@kartavya.app")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://kartavya-aekam.vercel.app")

AWS_ACCESS_KEY_ID     = os.environ.get("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY")
AWS_REGION            = os.environ.get("AWS_REGION", "us-east-1")

ses_client = None
if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
    try:
        import boto3
        ses_client = boto3.client(
            'ses',
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
            region_name=AWS_REGION,
        )
        logger.info(f"✅ AWS SES ready (region={AWS_REGION})")
    except ImportError:
        logger.error("❌ boto3 not installed")
    except Exception as e:
        logger.error(f"❌ SES init failed: {e}")
else:
    logger.warning("⚠️  AWS SES not configured — emails disabled")


# ---------------------------------------------------------------------------
# Core send
# ---------------------------------------------------------------------------

def send_email(to_email: str, subject: str, html_content: str) -> bool:
    if not ses_client:
        logger.warning(f"[DRY RUN] Would send '{subject}' to {to_email}")
        return False
    try:
        resp = ses_client.send_email(
            Source=FROM_EMAIL,
            Destination={'ToAddresses': [to_email]},
            Message={
                'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                'Body':    {'Html': {'Data': html_content, 'Charset': 'UTF-8'}},
            },
        )
        logger.info(f"✅ Sent '{subject}' to {to_email}: {resp['MessageId']}")
        return True
    except Exception as e:
        logger.error(f"❌ SES send failed to {to_email}: {e}")
        return False


# ---------------------------------------------------------------------------
# Templates
# ---------------------------------------------------------------------------

BRAND = "linear-gradient(135deg,#0082c6 0%,#05b7aa 100%)"


def _base(header_html: str, body_html: str) -> str:
    return f"""
    <!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>body{{margin:0;padding:20px;background:#f0f4ff;font-family:'Segoe UI',Arial,sans-serif;color:#1e293b}}</style>
    </head><body>
    <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,.1)">
      <div style="background:{BRAND};padding:28px 24px;text-align:center">{header_html}</div>
      <div style="padding:28px 24px">{body_html}</div>
      <div style="background:#f8faff;padding:16px 24px;text-align:center;border-top:1px solid #e2e8f0">
        <p style="color:#64748b;font-size:12px;margin:0">Kartavya Task Management &bull; Aekam Inc</p>
      </div>
    </div></body></html>
    """


def send_approval_request_email(
    to_email: str,
    to_name: str,
    task_id: str,
    task_title: str,
    requester_name: str,
    project_name: str,
    notes: str = None,
):
    """Email sent to owner/admin when someone requests approval."""
    subject = f"\u23f3 Approval Required: {task_title}"
    approve_url = f"{FRONTEND_URL}/tasks/{task_id}/approve"
    reject_url  = f"{FRONTEND_URL}/tasks/{task_id}/reject"
    dash_url    = f"{FRONTEND_URL}/approvals"

    notes_html = (
        f'<p style="color:#78350f;font-style:italic;margin:12px 0 0">Note: {notes}</p>'
        if notes else ""
    )

    header = '<h1 style="color:#fff;margin:0;font-size:22px">&#x23F3; New Approval Request</h1>'
    body   = f"""
        <p>Hi <strong>{to_name}</strong>,</p>
        <p><strong>{requester_name}</strong> has submitted a task for your approval in <strong>{project_name}</strong>:</p>
        <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:16px 20px;border-radius:8px;margin:20px 0">
          <h3 style="margin:0 0 6px;color:#78350f">{task_title}</h3>
          <p style="margin:0;font-size:13px;color:#92400e">Project: {project_name} &bull; Requested by: {requester_name}</p>
          {notes_html}
        </div>
        <div style="text-align:center;margin:28px 0">
          <a href="{approve_url}" style="background:#10b981;color:#fff;padding:13px 28px;text-decoration:none;border-radius:8px;font-weight:600;margin:4px;display:inline-block">&#x2713; Approve</a>
          <a href="{reject_url}"  style="background:#ef4444;color:#fff;padding:13px 28px;text-decoration:none;border-radius:8px;font-weight:600;margin:4px;display:inline-block">&#x2717; Reject</a>
        </div>
        <p style="text-align:center"><a href="{dash_url}" style="color:#0082c6;font-size:14px">View all pending approvals &rarr;</a></p>
    """
    return send_email(to_email, subject, _base(header, body))


def send_approval_decision_email(
    to_email: str,
    to_name: str,
    task_title: str,
    approved: bool,
    approver_name: str,
    project_name: str,
    notes: str = None,
):
    """Email sent to task creator when owner approves or rejects."""
    if approved:
        subject   = f"\u2705 Approved: {task_title}"
        color     = "#10b981"
        icon      = "\u2705"
        status    = "APPROVED"
        msg       = "Your task has been approved and moved to the next stage."
    else:
        subject   = f"\u274c Rejected: {task_title}"
        color     = "#ef4444"
        icon      = "\u274c"
        status    = "REJECTED"
        msg       = "Your task has been rejected. Please review the notes below."

    notes_html = (
        f'<div style="margin-top:14px;padding-top:14px;border-top:1px solid {color}">'
        f'<strong>Notes from {approver_name}:</strong>'
        f'<p style="font-style:italic;color:#475569;margin:6px 0 0">{notes}</p></div>'
    ) if notes else ""

    header = f'<h1 style="color:#fff;margin:0;font-size:22px">{icon} Task {status}</h1>'
    body   = f"""
        <p>Hi <strong>{to_name}</strong>,</p>
        <p>{msg}</p>
        <div style="background:#f0fdf4;border-left:4px solid {color};padding:16px 20px;border-radius:8px;margin:20px 0">
          <h3 style="margin:0 0 8px;color:#1e293b">{task_title}</h3>
          <p style="margin:0;font-size:13px;color:#475569">
            Project: {project_name} &bull; Decision by: <strong>{approver_name}</strong>
          </p>
          {notes_html}
        </div>
        <div style="text-align:center;margin:28px 0">
          <a href="{FRONTEND_URL}" style="background:#0082c6;color:#fff;padding:13px 28px;text-decoration:none;border-radius:8px;font-weight:600">View Dashboard</a>
        </div>
    """
    return send_email(to_email, subject, _base(header, body))


def send_team_invite_email(
    to_email: str,
    to_name: str,
    team_name: str,
    inviter_name: str,
    invite_token: str,
    role: str = "member",
):
    invite_url = f"{FRONTEND_URL}/accept-invite?token={invite_token}"
    subject    = f"You've been invited to join {team_name} on Kartavya"
    role_label = "Client" if role == "client" else ("Administrator" if role == "admin" else "Team Member")

    header = '<h1 style="color:#fff;margin:0;font-size:22px">&#x1F389; You\'re Invited!</h1>'
    body   = f"""
        <p>Hi <strong>{to_name}</strong>,</p>
        <p><strong>{inviter_name}</strong> has invited you to join <strong>{team_name}</strong>
           as a <strong>{role_label}</strong>.</p>
        <div style="text-align:center;margin:32px 0">
          <a href="{invite_url}" style="background:#0082c6;color:#fff;padding:16px 36px;text-decoration:none;border-radius:8px;font-weight:700;font-size:16px">Accept Invitation</a>
        </div>
        <p style="color:#64748b;font-size:13px">This link expires in 7 days.</p>
    """
    return send_email(to_email, subject, _base(header, body))


def send_approval_notification_email(
    user_email: str,
    user_name: str,
    task_title: str,
    notification_type: str,
    notes: str = None,
):
    """Legacy wrapper kept for compatibility."""
    if notification_type == 'request':
        return send_approval_request_email(
            to_email=user_email, to_name=user_name,
            task_id="", task_title=task_title,
            requester_name=user_name, project_name="", notes=notes,
        )
    approved = notification_type == 'approved'
    return send_approval_decision_email(
        to_email=user_email, to_name=user_name,
        task_title=task_title, approved=approved,
        approver_name="", project_name="", notes=notes,
    )


def send_task_assignment_email(
    user_email: str, user_name: str,
    task_title: str, task_id: str, team_name: str = None,
):
    subject   = f"New Task Assigned: {task_title}"
    team_info = f" in <strong>{team_name}</strong>" if team_name else ""
    header    = '<h1 style="color:#fff;margin:0;font-size:22px">&#x1F4CB; New Task Assigned</h1>'
    body      = f"""
        <p>Hi <strong>{user_name}</strong>,</p>
        <p>You have been assigned a new task{team_info}:</p>
        <div style="background:#f0f4ff;border-left:4px solid #0082c6;padding:16px 20px;border-radius:8px;margin:20px 0">
          <h3 style="margin:0;color:#0082c6">{task_title}</h3>
        </div>
        <div style="text-align:center;margin:28px 0">
          <a href="{FRONTEND_URL}/tasks" style="background:#0082c6;color:#fff;padding:13px 28px;text-decoration:none;border-radius:8px;font-weight:600">View Task</a>
        </div>
    """
    return send_email(user_email, subject, _base(header, body))


def send_welcome_email(user_email: str, user_name: str):
    subject = "Welcome to Kartavya!"
    header  = '<h1 style="color:#fff;margin:0;font-size:22px">&#x1F389; Welcome to Kartavya!</h1>'
    body    = f"""
        <p>Hi <strong>{user_name}</strong>,</p>
        <p>Welcome to Kartavya &mdash; your task management platform by Aekam Inc.</p>
        <div style="text-align:center;margin:32px 0">
          <a href="{FRONTEND_URL}" style="background:#0082c6;color:#fff;padding:16px 36px;text-decoration:none;border-radius:8px;font-weight:700">Get Started</a>
        </div>
    """
    return send_email(user_email, subject, _base(header, body))


def send_task_reminder_email(
    user_email: str, user_name: str,
    task_title: str, task_id: str, due_date: str,
):
    subject = f"Reminder: {task_title}"
    header  = '<h1 style="color:#fff;margin:0;font-size:22px">&#x23F0; Task Reminder</h1>'
    body    = f"""
        <p>Hi <strong>{user_name}</strong>,</p>
        <p>This is a reminder for an upcoming task:</p>
        <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:16px 20px;border-radius:8px;margin:20px 0">
          <h3 style="margin:0;color:#78350f">{task_title}</h3>
          <p style="margin:8px 0 0;color:#92400e">Due: {due_date}</p>
        </div>
        <div style="text-align:center;margin:28px 0">
          <a href="{FRONTEND_URL}/tasks" style="background:#f59e0b;color:#fff;padding:13px 28px;text-decoration:none;border-radius:8px;font-weight:600">View Task</a>
        </div>
    """
    return send_email(user_email, subject, _base(header, body))
