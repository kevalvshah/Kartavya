"""email_service.py — Kartavya by Aekam Inc
Sends via AWS SES when configured; logs to console otherwise (dev/test mode).
Table-based layout — Outlook 2019+ / Gmail / Apple Mail / Gmail Android compatible.
"""
import logging
import os
import threading
from html import escape as _h

logger = logging.getLogger(__name__)

FROM_EMAIL   = os.environ.get("FROM_EMAIL",   "Kartavya <hello@kartavya.app>")
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


# ── Design tokens (baked hex — no CSS vars, no color-mix) ─────────────────────
_BG         = "#F6F3EC"
_SURFACE    = "#FCFAF5"
_RULE       = "#E2DCC9"
_RULE_SOFT  = "#EFE9D8"
_INK        = "#1A2230"
_INK2       = "#4A5468"
_INK3       = "#6E7B91"
_TEAL       = "#05b7aa"
_MID        = "#03a1b6"
_DEEP       = "#0082c6"
_OK_BG      = "#E8F5F3"
_OK_BORDER  = "#0A7A6E"
_WARN_BG    = "#FEF3E2"
_WARN_BORD  = "#B06A00"
_DANGER_BG  = "#F8E9E5"
_DANGER_BOR = "#C0392B"

_FONT_DISP  = '"Newsreader", Georgia, "Times New Roman", serif'
_FONT_UI    = 'Inter, -apple-system, "Helvetica Neue", Arial, sans-serif'
_FONT_HINDI = '"Tiro Devanagari Hindi", "Noto Serif Devanagari", "Newsreader", Georgia, serif'


def _preheader(text: str) -> str:
    return (f'<div style="display:none;font-size:1px;color:{_BG};line-height:1px;'
            f'max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">{_h(text)}</div>')


def _dark_mode_css() -> str:
    return """
<style type="text/css">
@media (prefers-color-scheme:dark){
  .em__envelope{background:#122035 !important;border-color:#1A2A45 !important;}
  .em__h1{color:#E6EEFC !important;}
  .em__lede,.em__body-text{color:#B0BDD4 !important;}
  .em__card{background:#0B1828 !important;border-color:#1A2A45 !important;}
}
@media screen and (max-width:480px){
  .em__cta-cell{display:block !important;width:100% !important;padding-bottom:10px !important;}
  .em__cta-btn{width:100% !important;display:block !important;}
}
</style>"""


def _base(preheader: str, kicker: str, headline: str, sanskrit: str,
          lede: str, body_rows: str, show_gita: bool = False) -> str:
    gita = ""
    if show_gita:
        gita = (f'<tr><td style="padding:20px 0 0;font-family:{_FONT_HINDI};'
                f'font-size:14px;color:{_INK3};font-style:italic;text-align:center;">'
                f'कर्मण्येवाधिकारस्ते मा फलेषु कदाचन — Bhagavad Gita 2.47'
                f'</td></tr>')

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Kartavya</title>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,500;1,400&family=Tiro+Devanagari+Hindi&display=swap" rel="stylesheet">
{_dark_mode_css()}
</head>
<body style="margin:0;padding:0;background:{_BG};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
{_preheader(preheader)}
<!--[if mso]><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center"><![endif]-->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{_BG};">
  <tr><td align="center" style="padding:32px 16px 40px;">
    <table class="em__envelope" width="600" cellpadding="0" cellspacing="0" border="0"
      style="background:{_SURFACE};border:1px solid {_RULE};border-radius:16px;
             box-shadow:0 30px 60px -40px rgba(10,20,40,.22);">
      <tr><td style="padding:32px 36px 0;">
        <!-- brand bar -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
          style="border-bottom:1px solid {_RULE_SOFT};padding-bottom:20px;margin-bottom:28px;">
          <tr>
            <td style="font-family:{_FONT_DISP};font-size:20px;font-weight:500;
                       color:{_INK};letter-spacing:0.005em;">Kartavya</td>
            <td style="font-family:{_FONT_HINDI};font-size:15px;color:{_MID};padding-left:10px;">कर्तव्य</td>
            <td align="right" style="font-family:{_FONT_UI};font-size:10px;
                letter-spacing:0.2em;text-transform:uppercase;color:{_INK3};font-weight:700;">
              by Aekam Inc</td>
          </tr>
        </table>
        <!-- kicker -->
        <p style="margin:0 0 12px;font-family:{_FONT_UI};font-size:11px;letter-spacing:0.22em;
                  text-transform:uppercase;color:{_TEAL};font-weight:700;">{kicker}</p>
        <!-- headline -->
        <h1 class="em__h1" style="margin:0 0 4px;font-family:{_FONT_DISP};font-size:34px;
                  font-weight:400;line-height:1.1;letter-spacing:-0.02em;color:{_INK};">{headline}</h1>
        <p style="margin:0 0 24px;font-family:{_FONT_HINDI};font-size:17px;color:{_TEAL};font-weight:400;">{sanskrit}</p>
        <!-- lede -->
        <p class="em__lede" style="margin:0 0 28px;font-family:{_FONT_UI};font-size:15px;
                  line-height:1.65;color:{_INK2};">{lede}</p>
      </td></tr>
      <!-- body rows -->
      {body_rows}
      <!-- gita / footer -->
      <tr><td style="padding:28px 36px 0;border-top:1px solid {_RULE_SOFT};">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          {gita}
          <tr><td style="padding:20px 0 0;font-family:{_FONT_UI};font-size:11.5px;
                         color:{_INK3};line-height:1.6;">
            You are receiving this because you are a member or invitee of a Kartavya workspace.
            If you did not expect this email, you can safely ignore it.
          </td></tr>
          <!-- bottom bar -->
          <tr><td style="padding:16px 0 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="font-family:{_FONT_UI};font-size:11px;color:{_INK3};">
                  Kartavya &mdash; <em>do what must be done.</em><br>
                  <span style="color:{_INK3};">Aekam Inc &middot; Ahmedabad, IN</span>
                </td>
                <td align="right" style="font-family:{_FONT_UI};font-size:11px;color:{_TEAL};white-space:nowrap;vertical-align:top;">
                  <a href="{FRONTEND_URL}/dashboard" style="color:{_TEAL};text-decoration:none;">Open app</a>
                  &nbsp;&middot;&nbsp;
                  <a href="{FRONTEND_URL}/settings/notifications" style="color:{_TEAL};text-decoration:none;">Settings</a>
                </td>
              </tr>
            </table>
          </td></tr>
          <tr><td style="padding:16px 0 32px;"></td></tr>
        </table>
      </td></tr>
    </table>
  </td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</body></html>"""


def _task_card(task_title: str, project: str = None, priority: str = None,
               due_date: str = None, note: str = None) -> str:
    rows = f"""<tr><td style="padding:14px 18px;font-family:{_FONT_DISP};
                  font-size:17px;font-weight:500;color:{_INK};line-height:1.3;">{_h(task_title)}</td></tr>"""
    if project or priority or due_date:
        meta_items = []
        if project:  meta_items.append(f'<b>Project:</b> {_h(project)}')
        if priority: meta_items.append(f'<b>Priority:</b> {_h(priority)}')
        if due_date: meta_items.append(f'<b>Due:</b> {_h(due_date)}')
        rows += (f'<tr><td style="padding:0 18px 14px;font-family:{_FONT_UI};'
                 f'font-size:13px;color:{_INK3};">' + ' &nbsp;·&nbsp; '.join(meta_items) + '</td></tr>')
    if note:
        rows += (f'<tr><td style="padding:0 18px 14px;font-family:{_FONT_UI};font-size:14px;'
                 f'color:{_INK2};font-style:italic;border-top:1px solid {_RULE_SOFT};">'
                 f'&ldquo;{_h(note)}&rdquo;</td></tr>')
    return (f'<tr><td style="padding:0 36px 28px;"><table class="em__card" width="100%" '
            f'cellpadding="0" cellspacing="0" border="0" style="background:{_BG};'
            f'border:1px solid {_RULE};border-radius:10px;overflow:hidden;">{rows}</table></td></tr>')


def _cta_row(primary_url: str, primary_label: str, primary_color: str = _DEEP,
             ghost_url: str = None, ghost_label: str = None) -> str:
    ghost_cell = ""
    if ghost_url:
        ghost_cell = (f'<td class="em__cta-cell" align="center" style="padding:0 0 0 12px;">'
                      f'<a class="em__cta-btn" href="{ghost_url}" '
                      f'style="font-family:{_FONT_UI};font-size:14px;font-weight:600;'
                      f'color:{_INK2};text-decoration:none;border:1.5px solid {_RULE};'
                      f'border-radius:8px;padding:13px 22px;display:inline-block;'
                      f'background:{_SURFACE};min-width:140px;text-align:center;">'
                      f'{ghost_label}</a></td>')
    return (f'<tr><td style="padding:4px 36px 28px;"><table cellpadding="0" cellspacing="0" border="0">'
            f'<tr>'
            f'<td class="em__cta-cell" align="center">'
            f'<a class="em__cta-btn" href="{primary_url}" '
            f'style="font-family:{_FONT_UI};font-size:14px;font-weight:600;color:#ffffff;'
            f'text-decoration:none;background:{primary_color};border-radius:8px;'
            f'padding:13px 24px;display:inline-block;min-width:140px;text-align:center;">'
            f'{primary_label}</a></td>'
            f'{ghost_cell}'
            f'</tr></table></td></tr>')


def _body_text(text: str) -> str:
    return (f'<tr><td style="padding:0 36px 20px;font-family:{_FONT_UI};font-size:15px;'
            f'line-height:1.65;color:{_INK2};" class="em__body-text">{text}</td></tr>')


# ── Core send (threaded) ───────────────────────────────────────────────────────
def send_email(to_email: str, subject: str, html_content: str,
               reply_to: str = None) -> bool:
    def _send():
        if not ses_client:
            logger.info(f"[EMAIL-DEV] To:{to_email} | Subject:{subject}")
            return
        try:
            msg = {
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body":    {"Html":  {"Data": html_content, "Charset": "UTF-8"}},
            }
            kwargs = dict(
                Source=FROM_EMAIL,
                Destination={"ToAddresses": [to_email]},
                Message=msg,
            )
            if reply_to:
                kwargs["ReplyToAddresses"] = [reply_to]
            r = ses_client.send_email(**kwargs)
            logger.info(f"✅ Email sent → {to_email} [{r['MessageId']}]")
        except Exception as exc:
            logger.error(f"❌ Email failed → {to_email}: {exc}")

    threading.Thread(target=_send, daemon=True).start()
    return True


# ── 1. Invite email ────────────────────────────────────────────────────────────
def send_invite_email(to_email: str, inviter_name: str, role: str,
                      invite_token: str, workspace_name: str = "Kartavya",
                      expires_label: str = "7 days", recipient_name: str = ""):
    invite_url     = f"{FRONTEND_URL}/accept-invite?token={invite_token}"
    workspace_url  = f"{FRONTEND_URL}/dashboard"
    role_label     = _h(role.capitalize())
    inviter_first  = _h(inviter_name.split()[0] if inviter_name else "Someone")
    recip_first    = _h(recipient_name.split()[0] if recipient_name else "")
    greeting       = f'Hi <strong>{recip_first}</strong>, ' if recip_first else ''
    preheader      = f"{inviter_name} invited you to {workspace_name} on Kartavya — accept within {expires_label}."

    info_table = (
        f'<tr><td style="padding:0 36px 28px;">'
        f'<table width="100%" cellpadding="0" cellspacing="0" border="0" class="em__card"'
        f' style="background:{_BG};border:1px solid {_RULE};border-radius:10px;overflow:hidden;">'
        f'<tr>'
        f'<td style="padding:14px 18px 14px 18px;font-family:{_FONT_UI};font-size:12px;'
        f'letter-spacing:0.12em;text-transform:uppercase;color:{_INK3};font-weight:700;'
        f'border-bottom:1px solid {_RULE_SOFT};width:38%;">WORKSPACE</td>'
        f'<td style="padding:14px 18px;font-family:{_FONT_UI};font-size:14px;color:{_INK};'
        f'border-bottom:1px solid {_RULE_SOFT};">{_h(workspace_name)}</td>'
        f'</tr>'
        f'<tr>'
        f'<td style="padding:14px 18px;font-family:{_FONT_UI};font-size:12px;'
        f'letter-spacing:0.12em;text-transform:uppercase;color:{_INK3};font-weight:700;'
        f'border-bottom:1px solid {_RULE_SOFT};">INVITED BY</td>'
        f'<td style="padding:14px 18px;font-family:{_FONT_UI};font-size:14px;color:{_INK};'
        f'border-bottom:1px solid {_RULE_SOFT};">{_h(inviter_name)}</td>'
        f'</tr>'
        f'<tr>'
        f'<td style="padding:14px 18px;font-family:{_FONT_UI};font-size:12px;'
        f'letter-spacing:0.12em;text-transform:uppercase;color:{_INK3};font-weight:700;'
        f'border-bottom:1px solid {_RULE_SOFT};">YOUR ROLE</td>'
        f'<td style="padding:14px 18px;font-family:{_FONT_UI};font-size:14px;color:{_INK};'
        f'border-bottom:1px solid {_RULE_SOFT};">{role_label}</td>'
        f'</tr>'
        f'<tr>'
        f'<td style="padding:14px 18px;font-family:{_FONT_UI};font-size:12px;'
        f'letter-spacing:0.12em;text-transform:uppercase;color:{_INK3};font-weight:700;">EXPIRES</td>'
        f'<td style="padding:14px 18px;font-family:{_FONT_UI};font-size:14px;color:{_INK};">'
        f'{_h(expires_label)}</td>'
        f'</tr>'
        f'</table></td></tr>'
    )

    body = (
        _body_text(f'{greeting}<strong>{_h(inviter_name)}</strong> has invited you to collaborate '
                   f'on <strong>{_h(workspace_name)}</strong> using Kartavya. '
                   f'Accept below to get started.')
        + info_table
        + _cta_row(invite_url, "Accept invite", _TEAL, workspace_url, "View workspace")
        + _body_text(f'<span style="font-size:12px;color:{_INK3};">The invite link expires in '
                     f'{_h(expires_label)}. If you weren\'t expecting this email, you can safely ignore it.</span>')
    )
    return send_email(
        to_email,
        f"{inviter_name} invited you to {workspace_name} on Kartavya",
        _base(preheader, "YOU'RE INVITED · आपका स्वागत है",
              f"{inviter_first} invited you to {_h(workspace_name)} Workspace.",
              "आपका स्वागत है", "", body),
        reply_to=None,
    )


# ── 2. Welcome email ───────────────────────────────────────────────────────────
def send_welcome_email(user_email: str, user_name: str,
                       workspace_name: str = "Kartavya"):
    first_name = _h(user_name.split()[0] if user_name else "there")
    preheader  = f"Your Kartavya account is ready. Tasks, timelines, approvals — all in one place."
    body = (
        _body_text(f'Hi <strong>{first_name}</strong>, your account is ready. '
                   f'You can now collaborate on tasks, track time, and review approvals '
                   f'inside <strong>{_h(workspace_name)}</strong>.')
        + _cta_row(f"{FRONTEND_URL}/dashboard", "Open Kartavya", _TEAL)
    )
    return send_email(
        user_email,
        f"Welcome to Kartavya",
        _base(preheader, "WELCOME · स्वागत", f"Welcome, {first_name}", "कर्तव्य का आरंभ",
              "Your workspace is ready.", body, show_gita=True),
    )


# ── 3. Approval request email (to admin/owners) ────────────────────────────────
def send_approval_request_email(user_email: str, user_name: str,
                                requester_name: str, task_title: str,
                                task_id: str, notes: str = None,
                                project: str = None, priority: str = None,
                                due_date: str = None, approve_token: str = None):
    approve_url = (f"{FRONTEND_URL}/approve?token={approve_token}"
                   if approve_token else f"{FRONTEND_URL}/approvals")
    reject_url  = (f"{FRONTEND_URL}/approve?token={approve_token}&action=reject"
                   if approve_token else approve_url)
    first_name  = _h(user_name.split()[0] if user_name else "there")
    preheader   = f"{requester_name} needs your sign-off on: {task_title}"
    body = (
        _body_text(f'Hi <strong>{first_name}</strong>, '
                   f'<strong>{_h(requester_name)}</strong> has submitted a new request that needs your approval.')
        + _task_card(task_title, project=project, priority=priority, due_date=due_date, note=notes)
        + _cta_row(approve_url, "Approve &amp; Queue", _OK_BORDER,
                   reject_url, "Decline")
    )
    return send_email(
        user_email,
        f"Approval needed: {task_title}",
        _base(preheader, "APPROVAL NEEDED · अनुमोदन", f"{requester_name} needs your sign-off",
              "समीक्षा करें", "A new request is waiting for your review.", body),
    )


# ── 4. Request approved (to client/requester) ─────────────────────────────────
def send_request_approved_email(user_email: str, user_name: str,
                                reviewer_name: str, task_title: str,
                                task_id: str, assignees: str = None,
                                due_date: str = None):
    task_url   = f"{FRONTEND_URL}/client/projects"
    first_name = _h(user_name.split()[0] if user_name else "there")
    preheader  = f"Your request was approved by {reviewer_name}. The team is on it."
    detail = ""
    if assignees: detail += f"<br><b>Assigned to:</b> {_h(assignees)}"
    if due_date:  detail += f"<br><b>Target date:</b> {_h(due_date)}"
    body = (
        _body_text(f'Hi <strong>{first_name}</strong>, great news — '
                   f'<strong>{_h(reviewer_name)}</strong> has approved your request '
                   f'and the team will begin work shortly.')
        + _task_card(task_title, due_date=due_date)
        + (_body_text(f'<span style="font-size:13px;color:{_INK3};">{detail}</span>')
           if detail else "")
        + _cta_row(task_url, "View in Portal", _TEAL)
    )
    return send_email(
        user_email,
        f"Your request was approved: {task_title}",
        _base(preheader, "REQUEST APPROVED · स्वीकृत", "Your request was approved",
              "अनुमोदित", "The team will begin work on your task.", body),
    )


# ── 5. Task done (to client/requester) ────────────────────────────────────────
def send_task_done_email(user_email: str, user_name: str,
                         completer_name: str, task_title: str,
                         task_id: str, time_spent: str = None,
                         completer_note: str = None,
                         attachments: list = None,
                         approve_token: str = None):
    approve_url  = (f"{FRONTEND_URL}/approve?token={approve_token}"
                    if approve_token else f"{FRONTEND_URL}/client/projects")
    reject_url   = (f"{FRONTEND_URL}/approve?token={approve_token}&action=reject"
                    if approve_token else approve_url)
    first_name   = user_name.split()[0] if user_name else "there"
    preheader    = f"{completer_name} has completed: {task_title}. Ready for your review."
    attach_html  = ""
    if attachments:
        items = "".join(f'<li style="padding:2px 0;">{_h(str(a))}</li>' for a in attachments)
        attach_html = _body_text(
            f'<strong>Attachments:</strong><ul style="margin:6px 0 0;padding-left:18px;">{items}</ul>')
    meta_txt = f"Completed by <strong>{_h(completer_name)}</strong>"
    if time_spent: meta_txt += f" &nbsp;·&nbsp; <strong>{_h(time_spent)}</strong>"
    body = (
        _body_text(f'Hi <strong>{_h(first_name)}</strong>, '
                   f'<strong>{_h(completer_name)}</strong> has completed the following task '
                   f'and it is ready for your review.')
        + _task_card(task_title, note=completer_note)
        + _body_text(f'<span style="font-size:13px;color:{_INK3};">{meta_txt}</span>')
        + attach_html
        + _cta_row(approve_url, "Approve &amp; Close", _OK_BORDER,
                   reject_url, "Send back with notes")
    )
    return send_email(
        user_email,
        f"Done: {task_title}",
        _base(preheader, "TASK COMPLETE · पूर्ण", "Your task is done",
              "समाप्त", "Ready for your approval and sign-off.", body),
    )


# ── Legacy / additional send functions ────────────────────────────────────────
def send_task_assignment_email(user_email: str, user_name: str,
                               task_title: str, task_id: str, team_name: str = None):
    task_url   = f"{FRONTEND_URL}/tasks/{task_id}"
    first_name = _h(user_name.split()[0] if user_name else "there")
    preheader  = f"New task assigned to you: {task_title}"
    team_info  = f" in <strong>{_h(team_name)}</strong>" if team_name else ""
    body = (
        _body_text(f'Hi <strong>{first_name}</strong>, you have been assigned a new task{team_info}.')
        + _task_card(task_title)
        + _cta_row(task_url, "View Task", _DEEP)
    )
    return send_email(
        user_email,
        f"New task assigned: {task_title}",
        _base(preheader, "NEW TASK · कार्य", "New task assigned", "नया कार्य",
              "A task has been assigned to you.", body),
    )


def send_comment_email(user_email: str, user_name: str, actor_name: str,
                       task_title: str, task_id: str, comment_preview: str):
    task_url   = f"{FRONTEND_URL}/tasks/{task_id}"
    first_name = _h(user_name.split()[0] if user_name else "there")
    preheader  = f"{actor_name} commented on {task_title}"
    preview    = _h(comment_preview[:400]) if comment_preview else ""
    body = (
        _body_text(f'Hi <strong>{first_name}</strong>, '
                   f'<strong>{_h(actor_name)}</strong> commented on <strong>{_h(task_title)}</strong>:')
        + (f'<tr><td style="padding:0 36px 24px;"><table width="100%" cellpadding="0" cellspacing="0" border="0"'
           f' style="background:{_BG};border-left:3px solid {_RULE};border-radius:0 8px 8px 0;">'
           f'<tr><td style="padding:14px 18px;font-family:{_FONT_UI};font-size:14px;'
           f'color:{_INK2};font-style:italic;line-height:1.6;">{preview}</td></tr></table></td></tr>')
        + _cta_row(task_url, "View Comment", _DEEP)
    )
    return send_email(
        user_email,
        f"New comment on: {task_title}",
        _base(preheader, "COMMENT · टिप्पणी", "New comment", "टिप्पणी",
              f"{actor_name} left a comment.", body),
    )


def send_mention_email(user_email: str, user_name: str, actor_name: str,
                       task_title: str, task_id: str, comment_body: str):
    task_url   = f"{FRONTEND_URL}/tasks/{task_id}"
    first_name = _h(user_name.split()[0] if user_name else "there")
    preheader  = f"{actor_name} mentioned you in {task_title}"
    preview    = _h(comment_body[:300]) if comment_body else ""
    body = (
        _body_text(f'Hi <strong>{first_name}</strong>, '
                   f'<strong>{_h(actor_name)}</strong> mentioned you in <strong>{_h(task_title)}</strong>:')
        + (f'<tr><td style="padding:0 36px 24px;"><table width="100%" cellpadding="0" cellspacing="0" border="0"'
           f' style="background:{_BG};border-left:3px solid {_TEAL};border-radius:0 8px 8px 0;">'
           f'<tr><td style="padding:14px 18px;font-family:{_FONT_UI};font-size:14px;'
           f'color:{_INK2};font-style:italic;line-height:1.6;">{preview}</td></tr></table></td></tr>')
        + _cta_row(task_url, "View Task", _TEAL)
    )
    return send_email(
        user_email,
        f"{actor_name} mentioned you",
        _base(preheader, "MENTION · उल्लेख", "You were mentioned", "उल्लेख",
              f"{actor_name} referenced you in a comment.", body),
    )


def send_task_reminder_email(user_email: str, user_name: str,
                             task_title: str, task_id: str, due_date: str):
    task_url   = f"{FRONTEND_URL}/tasks/{task_id}"
    first_name = _h(user_name.split()[0] if user_name else "there")
    preheader  = f"Reminder: {task_title} is due {due_date}"
    body = (
        _body_text(f'Hi <strong>{first_name}</strong>, your task is due soon:')
        + _task_card(task_title, due_date=due_date)
        + _cta_row(task_url, "View Task", _WARN_BORD)
    )
    return send_email(
        user_email,
        f"Reminder: {task_title}",
        _base(preheader, "REMINDER · स्मरण", "Task due soon", "समयसीमा",
              "Don't let this slip.", body),
    )


def send_team_sync_email(user_email: str, user_name: str, client_name: str,
                         task_title: str, task_id: str):
    task_url   = f"{FRONTEND_URL}/tasks/{task_id}"
    first_name = _h(user_name.split()[0] if user_name else "there")
    preheader  = f"{client_name} approved the task: {task_title}"
    body = (
        _body_text(f'Hi <strong>{first_name}</strong>, '
                   f'<strong>{_h(client_name)}</strong> has approved the task. '
                   f'It has been moved to Done.')
        + _task_card(task_title)
        + _cta_row(task_url, "View Task", _OK_BORDER)
    )
    return send_email(
        user_email,
        f"Client approved: {task_title}",
        _base(preheader, "APPROVED · स्वीकृत", "Client approved", "अनुमोदित",
              f"{client_name} has signed off.", body),
    )


# ── Approval decision (approve/reject by reviewer) ────────────────────────────
def send_approval_decision_email(user_email: str, user_name: str, reviewer_name: str,
                                 task_title: str, task_id: str,
                                 decision: str, notes: str = None):
    task_url   = f"{FRONTEND_URL}/tasks/{task_id}"
    approved   = decision == "approved"
    verb       = "approved" if approved else "rejected"
    color      = _OK_BORDER if approved else _DANGER_BOR
    first_name = _h(user_name.split()[0] if user_name else "there")
    preheader  = f"Task {verb}: {task_title} — {reviewer_name}"
    body = (
        _body_text(f'Hi <strong>{first_name}</strong>, '
                   f'<strong>{_h(reviewer_name)}</strong> has <strong>{verb}</strong> your task:')
        + _task_card(task_title, note=notes)
        + _cta_row(task_url, "View Task", color)
    )
    return send_email(
        user_email,
        f"Task {verb}: {task_title}",
        _base(preheader, f"TASK {verb.upper()} · {'स्वीकृत' if approved else 'अस्वीकृत'}",
              f"Task {verb}", "समीक्षा परिणाम",
              f"Your task has been reviewed.", body),
    )


# ── Legacy aliases ─────────────────────────────────────────────────────────────
def send_approval_notification_email(user_email: str, user_name: str, task_title: str,
                                     notification_type: str, notes: str = None,
                                     task_id: str = None):
    if notification_type == "request":
        return send_approval_request_email(
            user_email, user_name, "A team member", task_title, task_id or "", notes)
    else:
        return send_approval_decision_email(
            user_email, user_name, "The reviewer", task_title, task_id or "", notification_type, notes)


def send_team_invite_email(to_email: str, team_name: str, inviter_name: str, invite_token: str):
    return send_invite_email(to_email, inviter_name, "member", invite_token,
                             workspace_name=team_name)
