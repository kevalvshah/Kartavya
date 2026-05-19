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
_BG_SOFT    = "#F0ECDF"
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

_FONT_DISP  = "'Newsreader', Georgia, 'Times New Roman', serif"
_FONT_UI    = "Inter, -apple-system, 'Helvetica Neue', Arial, sans-serif"
_FONT_HINDI = "'Tiro Devanagari Hindi', 'Noto Serif Devanagari', 'Newsreader', Georgia, serif"


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
      style="background:{_SURFACE};border:1px solid {_RULE};border-radius:18px;
             box-shadow:0 1px 0 rgba(20,30,50,.04),0 30px 60px -40px rgba(10,20,40,.25);">
      <tr><td style="padding:40px 36px 0;">
        <!-- brand bar -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
          style="border-bottom:1px solid {_RULE_SOFT};padding-bottom:24px;margin-bottom:28px;">
          <tr>
            <td style="font-family:{_FONT_DISP};font-size:22px;font-weight:500;
                       color:{_INK};letter-spacing:0.005em;">Kartavya</td>
            <td style="font-family:{_FONT_HINDI};font-size:16px;color:{_MID};padding-left:10px;">कर्तव्य</td>
            <td align="right" style="font-family:{_FONT_UI};font-size:10px;
                letter-spacing:0.2em;text-transform:uppercase;color:{_INK3};font-weight:700;">
              By Aekam Inc</td>
          </tr>
        </table>
        <!-- kicker -->
        <p style="margin:0 0 14px;font-family:{_FONT_UI};font-size:11px;letter-spacing:0.22em;
                  text-transform:uppercase;color:{_MID};font-weight:700;">{kicker}</p>
        <!-- headline -->
        <h1 class="em__h1" style="margin:0 0 6px;font-family:{_FONT_DISP};font-size:36px;
                  font-weight:400;line-height:1.1;letter-spacing:-0.02em;color:{_INK};">{headline}</h1>
        <p style="margin:0 0 24px;font-family:{_FONT_HINDI};font-size:18px;color:{_TEAL};font-weight:400;">{sanskrit}</p>
        {f'<!-- lede --><p class="em__lede" style="margin:0 0 24px;font-family:{_FONT_UI};font-size:16px;line-height:1.65;color:{_INK2};">{lede}</p>' if lede else ''}
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
                <td align="right" style="font-family:{_FONT_UI};font-size:11px;color:{_INK3};white-space:nowrap;vertical-align:top;">
                  <a href="{FRONTEND_URL}/dashboard" style="color:{_DEEP};text-decoration:none;">Open app</a>
                  &nbsp;&middot;&nbsp;
                  <a href="{FRONTEND_URL}/settings/notifications" style="color:{_DEEP};text-decoration:none;">Settings</a>
                  &nbsp;&middot;&nbsp;
                  <a href="{FRONTEND_URL}/settings/notifications" style="color:{_DEEP};text-decoration:none;">Unsubscribe</a>
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


_GRAD_PRIMARY = "linear-gradient(90deg,#0082c6,#03a1b6,#05b7aa)"
_GRAD_APPROVE = "linear-gradient(135deg,#0A7A6E,#13a895)"
_RULE_STRONG  = "#C8C0AA"

def _cta_row(primary_url: str, primary_label: str, primary_style: str = "primary",
             ghost_url: str = None, ghost_label: str = None) -> str:
    if primary_style == "approve":
        btn_bg     = _GRAD_APPROVE
        btn_shadow = "0 4px 14px -4px rgba(10,122,110,.5)"
    else:
        btn_bg     = _GRAD_PRIMARY
        btn_shadow = "0 4px 14px -4px rgba(0,130,198,.5),0 1px 0 rgba(255,255,255,.15) inset"

    if primary_style == "approve":
        btn_bg_color = "#0A7A6E"
    else:
        btn_bg_color = "#05b7aa"

    ghost_cell = ""
    if ghost_url:
        ghost_cell = (f'<td class="em__cta-cell" align="center" style="padding:0 0 0 12px;">'
                      f'<table cellpadding="0" cellspacing="0" border="0">'
                      f'<tr><td style="border:1px solid {_RULE_STRONG};border-radius:8px;">'
                      f'<a class="em__cta-btn" href="{ghost_url}" '
                      f'style="font-family:{_FONT_UI};font-size:14px;font-weight:600;'
                      f'color:{_INK};text-decoration:none;'
                      f'padding:13px 22px;display:inline-block;'
                      f'min-width:140px;text-align:center;letter-spacing:0.005em;">'
                      f'{ghost_label}</a></td></tr></table></td>')
    return (f'<tr><td style="padding:4px 36px 20px;"><table cellpadding="0" cellspacing="0" border="0">'
            f'<tr>'
            f'<td class="em__cta-cell" align="center">'
            f'<table cellpadding="0" cellspacing="0" border="0">'
            f'<tr><td style="background-color:{btn_bg_color};background:{btn_bg};'
            f'border-radius:8px;box-shadow:{btn_shadow};">'
            f'<a class="em__cta-btn" href="{primary_url}" '
            f'style="font-family:{_FONT_UI};font-size:14px;font-weight:600;color:#ffffff;'
            f'text-decoration:none;'
            f'padding:13px 22px;display:block;min-width:140px;text-align:center;'
            f'letter-spacing:0.005em;">'
            f'{primary_label}</a></td></tr></table>'
            f'</td>'
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
def _info_card(rows: list[tuple[str, str]], hindi_sub: dict[str, str] = None) -> str:
    """Render an editorial card with dashed-separator rows matching the email design.
    rows: list of (label, value) tuples.
    hindi_sub: optional dict of label -> hindi subtitle shown below the value.
    """
    hindi_sub = hindi_sub or {}

    n = len(rows)
    def _row(i, label, value):
        is_first = (i == 0)
        is_last  = (i == n - 1)
        pt = "0"   if is_first else "8px"
        pb = "0"   if is_last  else "8px"
        border = "" if is_last else f"border-bottom:1px dashed {_RULE};"
        sub = ""
        if label in hindi_sub:
            sub = (f'<br><span style="font-family:{_FONT_HINDI};'
                   f'font-size:13px;color:{_INK3};margin-top:2px;">{_h(hindi_sub[label])}</span>')
        return (
            f'<tr>'
            f'<td style="padding:{pt} 0 {pb};font-family:{_FONT_UI};font-size:10.5px;'
            f'letter-spacing:0.16em;text-transform:uppercase;color:{_INK3};font-weight:700;'
            f'vertical-align:top;{border}white-space:nowrap;">{label}</td>'
            f'<td style="padding:{pt} 0 {pb};font-family:{_FONT_UI};font-size:14px;color:{_INK};'
            f'font-weight:500;text-align:right;vertical-align:top;{border}">{_h(value)}{sub}</td>'
            f'</tr>'
        )

    inner = "".join(_row(i, lbl, val) for i, (lbl, val) in enumerate(rows))
    return (
        f'<tr><td style="padding:0 36px 24px;">'
        f'<table width="100%" cellpadding="0" cellspacing="0" border="0"'
        f' style="background:{_BG_SOFT};border:1px solid {_RULE};border-radius:12px;">'
        f'<tr><td style="padding:18px 20px;">'
        f'<table width="100%" cellpadding="0" cellspacing="0" border="0">'
        f'{inner}'
        f'</table>'
        f'</td></tr>'
        f'</table></td></tr>'
    )


def send_invite_email(to_email: str, inviter_name: str, role: str,
                      invite_token: str, workspace_name: str = "Kartavya",
                      expires_label: str = "7 days", recipient_name: str = "",
                      workspace_hindi: str = "मुख्य कार्यस्थल",
                      inviter_role: str = "Admin"):
    invite_url    = f"{FRONTEND_URL}/accept-invite?token={invite_token}"
    workspace_url = f"{FRONTEND_URL}/dashboard"
    role_label    = role.capitalize()
    inviter_first    = inviter_name.split()[0] if inviter_name else "Someone"
    workspace_short  = workspace_name.split()[0] if workspace_name else workspace_name
    recip_first      = recipient_name.split()[0] if recipient_name else ""
    greeting         = f'Hi <strong>{_h(recip_first)}</strong>, ' if recip_first else ''
    preheader        = f"{inviter_name} invited you to {workspace_name} on Kartavya — accept within {expires_label}."

    card = _info_card(
        [
            ("WORKSPACE",  workspace_name),
            ("INVITED BY", f"{inviter_name} · {inviter_role}"),
            ("YOUR ROLE",  role_label),
            ("EXPIRES",    expires_label),
        ],
        hindi_sub={"WORKSPACE": workspace_hindi},
    )

    body = (
        _body_text(f'{greeting}<strong>{_h(inviter_name)}</strong> has invited you to collaborate '
                   f'on <strong>Kartavya</strong> — the task workspace where '
                   f'{_h(workspace_name)}\'s team plans projects, files GST returns, and ships client work.')
        + card
        + _cta_row(invite_url, "Accept invite", "primary", workspace_url, "View workspace")
        + _body_text(f'<span style="font-size:12.5px;color:{_INK3};">The invite link expires in '
                     f'7 days. If you weren\'t expecting this email, you can safely ignore it.</span>')
    )
    return send_email(
        to_email,
        f"{inviter_name} invited you to {workspace_name} on Kartavya",
        _base(preheader, "YOU'RE INVITED",
              f"{_h(inviter_first)} invited you to {_h(workspace_short)} Workspace.",
              "आपका स्वागत है", "", body),
        reply_to=None,
    )


# ── 2. Welcome email ───────────────────────────────────────────────────────────
def send_welcome_email(user_email: str, user_name: str,
                       workspace_name: str = "Kartavya"):
    first_name = _h(user_name.split()[0] if user_name else "there")
    preheader  = f"Your Kartavya account is live. Here's the shortest path to doing what must be done."

    def _step(num_hi, title, body_text):
        return (
            f'<tr><td style="padding:14px 0;border-bottom:1px dashed {_RULE};">'
            f'<table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>'
            f'<td style="width:36px;vertical-align:top;padding-right:14px;">'
            f'<div style="width:28px;height:28px;border-radius:50%;background:{_BG_SOFT};'
            f'border:1px solid {_RULE};text-align:center;line-height:28px;'
            f'font-family:{_FONT_DISP};font-size:16px;color:{_INK};">{num_hi}</div></td>'
            f'<td style="vertical-align:top;">'
            f'<div style="font-family:{_FONT_UI};font-size:14.5px;font-weight:600;color:{_INK};margin-bottom:2px;">{title}</div>'
            f'<div style="font-family:{_FONT_UI};font-size:13.5px;color:{_INK3};line-height:1.55;">{body_text}</div>'
            f'</td></tr></table></td></tr>'
        )

    steps = (
        f'<tr><td style="padding:0 36px 28px;">'
        f'<table width="100%" cellpadding="0" cellspacing="0" border="0">'
        + _step("१", "Open today's dashboard",
                "See what's due, what's overdue, and what your team is working on right now.")
        + _step("२", "Browse projects",
                "See every active engagement — internal work, client deliverables, deadlines, and progress at a glance.")
        + _step("३", "Create your first task",
                'Hit the "+ New task" button in the top bar. Assign it, set a priority, add a due date.')
        + _step("४", "Enable notifications",
                "Get pinged for mentions, assignments, and approvals. Configure in Settings → Notifications.")
        + f'</table></td></tr>'
    )

    gita_block = (
        f'<tr><td style="padding:0 36px 24px;">'
        f'<div style="border-left:2px solid {_TEAL};padding:6px 0 6px 16px;">'
        f'<span style="font-family:{_FONT_HINDI};font-size:16px;color:{_INK2};">'
        f'कर्तव्ये अधिकारस्ते मा फलेषु कदाचन।</span>'
        f'<span style="display:block;font-family:{_FONT_DISP};font-style:italic;'
        f'font-size:12px;color:{_INK3};margin-top:6px;">'
        f'Bhagavad Gita 2.47 — do your duty; don\'t fixate on the fruit.</span>'
        f'</div></td></tr>'
    )

    body = (
        _body_text(f'Hi <strong>{first_name}</strong>, your account is live. '
                   f'Here\'s the shortest path to doing <em style="font-family:{_FONT_DISP};'
                   f'font-style:italic;color:{_DEEP};">what must be done</em> on day one.')
        + steps
        + _cta_row(f"{FRONTEND_URL}/dashboard", "Open Kartavya", "primary",
                   f"{FRONTEND_URL}/dashboard", "Read the quickstart")
        + gita_block
    )
    return send_email(
        user_email,
        f"Welcome to Kartavya",
        _base(preheader, "WELCOME ABOARD", f"Glad to have you, {first_name}.",
              "कर्तव्य में आपका स्वागत है", "", body),
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
    card_rows = [("TITLE", task_title)]
    if project:  card_rows.append(("PROJECT", project))
    if priority: card_rows.append(("PRIORITY", priority))
    if due_date: card_rows.append(("NEEDED BY", due_date))
    card = _info_card(card_rows)
    note_html = ""
    if notes:
        note_html = _body_text(
            f'<span style="font-size:14.5px;line-height:1.6;color:{_INK2};">'
            f'<strong>Note from {_h(requester_name.split()[0])}:</strong> '
            f'&ldquo;{_h(notes)}&rdquo;</span>'
        )
    body = (
        _body_text(f'Hi <strong>{first_name}</strong>, '
                   f'<strong>{_h(requester_name)}</strong> has submitted a new request that needs your approval.')
        + card
        + note_html
        + _cta_row(approve_url, "Approve &amp; queue", "approve",
                   reject_url, "Decline with reason")
        + _body_text(f'<span style="font-size:12.5px;color:{_INK3};">Approving moves this task to '
                     f'<strong>To do</strong> and notifies the assignees. {_h(requester_name.split()[0])} gets an email either way.</span>')
    )
    return send_email(
        user_email,
        f"Approval needed: {task_title}",
        _base(preheader, "APPROVAL NEEDED", f"{_h(requester_name)} requested a new task.",
              "अनुमोदन हेतु अनुरोध", "", body),
    )


# ── 4. Request approved (to client/requester) ─────────────────────────────────
def send_request_approved_email(user_email: str, user_name: str,
                                reviewer_name: str, task_title: str,
                                task_id: str, assignees: str = None,
                                due_date: str = None):
    task_url   = f"{FRONTEND_URL}/client/projects"
    first_name = _h(user_name.split()[0] if user_name else "there")
    preheader  = f"Your request was approved by {reviewer_name}. The team is on it."
    card_rows = [("TASK", task_title)]
    if assignees: card_rows.append(("ASSIGNED TO", assignees))
    if due_date:  card_rows.append(("TARGET DATE", due_date))
    card_rows.append(("STATUS", "To do"))
    card = _info_card(card_rows)
    body = (
        _body_text(f'Hi <strong>{first_name}</strong> — '
                   f'<strong>{_h(reviewer_name)}</strong> approved your request. The team has '
                   f'picked it up and you\'ll see status updates in the Kartavya portal.')
        + card
        + _body_text(f'<span style="font-size:14.5px;color:{_INK2};">'
                     f'<strong>What happens next:</strong> work starts within one business day. '
                     f'You\'ll get another email when it\'s marked complete and ready for your review.</span>')
        + _cta_row(task_url, "View task", "primary", f"{FRONTEND_URL}/client/projects", "Open portal")
    )
    return send_email(
        user_email,
        f"Your request was approved: {task_title}",
        _base(preheader, "REQUEST APPROVED", "Your request is in the queue.",
              "अनुमोदन प्राप्त हुआ", "", body),
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
    card_rows = [
        ("TASK", task_title),
        ("COMPLETED BY", completer_name),
        ("STATUS", "Done"),
    ]
    if time_spent: card_rows.append(("TIME SPENT", time_spent))
    card = _info_card(card_rows)
    note_html = ""
    if completer_note:
        note_html = _body_text(
            f'<span style="font-size:14.5px;line-height:1.6;color:{_INK2};">'
            f'<strong>{_h(completer_name.split()[0])}\'s note:</strong> '
            f'&ldquo;{_h(completer_note)}&rdquo;</span>'
        )
    attach_html = ""
    if attachments:
        file_list = ", ".join(
            f'<code style="font-family:{_FONT_UI};font-size:12px;background:{_BG_SOFT};'
            f'padding:1px 5px;border-radius:4px;border:1px solid {_RULE};">{_h(str(a))}</code>'
            for a in attachments
        )
        attach_html = _body_text(
            f'<span style="font-size:12.5px;color:{_INK3};">Two files attached to the task: {file_list}. Open the task to download.</span>')
    body = (
        _body_text(f'Hi <strong>{_h(first_name)}</strong>, '
                   f'<strong>{_h(completer_name)}</strong> just marked your task complete. '
                   f'Please take a look when you have a moment and approve, or send it back with notes.')
        + card
        + note_html
        + attach_html
        + _cta_row(approve_url, "Approve &amp; close", "approve",
                   reject_url, "Send back with notes")
    )
    return send_email(
        user_email,
        f"Done: {task_title}",
        _base(preheader, "WORK COMPLETED", "Done — ready for your review.",
              "कार्य सम्पन्न", "", body),
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
        + _cta_row(task_url, "View Task", "primary")
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
        + _cta_row(task_url, "View Comment", "primary")
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
        + _cta_row(task_url, "View Task", "primary")
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
        + _cta_row(task_url, "View Task", "primary")
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
        + _cta_row(task_url, "View Task", "approve")
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
        + _cta_row(task_url, "View Task", "approve" if approved else "primary")
    )
    return send_email(
        user_email,
        f"Task {verb}: {task_title}",
        _base(preheader, f"TASK {verb.upper()} · {'स्वीकृत' if approved else 'अस्वीकृत'}",
              f"Task {verb}", "समीक्षा परिणाम",
              f"Your task has been reviewed.", body),
    )


# ── Report delivery email (MIME raw with attachments) ─────────────────────────
def send_report_email(
    to_email: str,
    team_name: str,
    frequency: str,
    period_from: str,
    period_to: str,
    data_summary: dict = None,
    total_minutes: int = 0,
    pdf_bytes: bytes = None,
    excel_bytes: bytes = None,
):
    import email as _email_lib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text      import MIMEText
    from email.mime.base      import MIMEBase
    from email              import encoders

    data_summary = data_summary or {}
    total_h = f"{total_minutes // 60}h {total_minutes % 60}m" if total_minutes else "0h"
    freq_cap = frequency.capitalize()

    # Build attachment filenames
    safe_name = team_name.lower().replace(" ", "-")
    pdf_fname   = f"kartavya-{safe_name}-{period_from}-{period_to}.pdf"
    excel_fname = f"kartavya-{safe_name}-{period_from}-{period_to}.xlsx"

    preheader = f"{freq_cap} report for {team_name} — {period_from} to {period_to}."

    stats_rows = (
        f'<tr><td style="padding:10px 16px;font-family:{_FONT_UI};font-size:12px;letter-spacing:0.12em;'
        f'text-transform:uppercase;color:{_INK3};font-weight:700;border-bottom:1px solid {_RULE_SOFT};width:38%;">TOTAL TIME</td>'
        f'<td style="padding:10px 16px;font-family:{_FONT_UI};font-size:14px;color:{_INK};border-bottom:1px solid {_RULE_SOFT};">{total_h}</td></tr>'
        f'<tr><td style="padding:10px 16px;font-family:{_FONT_UI};font-size:12px;letter-spacing:0.12em;'
        f'text-transform:uppercase;color:{_INK3};font-weight:700;border-bottom:1px solid {_RULE_SOFT};">DONE</td>'
        f'<td style="padding:10px 16px;font-family:{_FONT_UI};font-size:14px;color:{_TEAL};font-weight:600;border-bottom:1px solid {_RULE_SOFT};">{data_summary.get("done",0)} tasks</td></tr>'
        f'<tr><td style="padding:10px 16px;font-family:{_FONT_UI};font-size:12px;letter-spacing:0.12em;'
        f'text-transform:uppercase;color:{_INK3};font-weight:700;border-bottom:1px solid {_RULE_SOFT};">IN PROGRESS</td>'
        f'<td style="padding:10px 16px;font-family:{_FONT_UI};font-size:14px;color:{_INK};border-bottom:1px solid {_RULE_SOFT};">{data_summary.get("in_progress",0)} tasks</td></tr>'
        f'<tr><td style="padding:10px 16px;font-family:{_FONT_UI};font-size:12px;letter-spacing:0.12em;'
        f'text-transform:uppercase;color:{_INK3};font-weight:700;">OVERDUE</td>'
        f'<td style="padding:10px 16px;font-family:{_FONT_UI};font-size:14px;color:#dc2626;">{data_summary.get("overdue",0)} tasks</td></tr>'
    )
    stats_table = (
        f'<tr><td style="padding:0 36px 28px;">'
        f'<table class="em__card" width="100%" cellpadding="0" cellspacing="0" border="0"'
        f' style="background:{_BG};border:1px solid {_RULE};border-radius:10px;overflow:hidden;">'
        f'{stats_rows}</table></td></tr>'
    )

    attach_note = ""
    fmts = []
    if pdf_bytes:   fmts.append("PDF")
    if excel_bytes: fmts.append("Excel")
    if fmts:
        attach_note = _body_text(
            f'<span style="font-size:13px;color:{_INK3};">Attached: {", ".join(fmts)} report(s) for {_h(period_from)} – {_h(period_to)}.</span>'
        )

    body = (
        _body_text(f'Your <strong>{freq_cap} project report</strong> for '
                   f'<strong>{_h(team_name)}</strong> is ready. '
                   f'Here\'s a snapshot of the period <strong>{_h(period_from)}</strong> to <strong>{_h(period_to)}</strong>.')
        + stats_table
        + attach_note
    )
    html_body = _base(
        preheader,
        f"{freq_cap.upper()} REPORT · प्रतिवेदन",
        f"{team_name} Report",
        "कार्य प्रतिवेदन",
        f"{freq_cap} summary for your project.",
        body,
        show_gita=True,
    )

    def _send():
        if not ses_client:
            logger.info(f"[EMAIL-DEV] Report → {to_email} | {team_name} | {period_from}–{period_to}")
            return
        try:
            msg = MIMEMultipart("mixed")
            msg["Subject"] = f"{freq_cap} Report: {team_name} ({period_from} to {period_to})"
            msg["From"]    = FROM_EMAIL
            msg["To"]      = to_email

            alt = MIMEMultipart("alternative")
            alt.attach(MIMEText(html_body, "html", "utf-8"))
            msg.attach(alt)

            if pdf_bytes:
                part = MIMEBase("application", "pdf")
                part.set_payload(pdf_bytes)
                encoders.encode_base64(part)
                part.add_header("Content-Disposition", "attachment", filename=pdf_fname)
                msg.attach(part)

            if excel_bytes:
                part = MIMEBase(
                    "application",
                    "vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
                part.set_payload(excel_bytes)
                encoders.encode_base64(part)
                part.add_header("Content-Disposition", "attachment", filename=excel_fname)
                msg.attach(part)

            ses_client.send_raw_email(
                Source=FROM_EMAIL,
                Destinations=[to_email],
                RawMessage={"Data": msg.as_bytes()},
            )
            logger.info(f"✅ Report email sent → {to_email}")
        except Exception as exc:
            logger.error(f"❌ Report email failed → {to_email}: {exc}")

    threading.Thread(target=_send, daemon=True).start()
    return True


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
