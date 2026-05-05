"""
email_service.py - Email service using AWS SES ONLY
"""

import logging
import os

logger = logging.getLogger(__name__)

FROM_EMAIL = os.environ.get("FROM_EMAIL", "noreply@kartavya.app")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://kartavya-aekam.vercel.app")

# AWS SES Configuration (REQUIRED)
AWS_ACCESS_KEY_ID = os.environ.get("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY")
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")

# Initialize AWS SES client
ses_client = None
if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
    try:
        import boto3
        ses_client = boto3.client(
            'ses',
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
            region_name=AWS_REGION
        )
        logger.info(f"✅ AWS SES configured successfully (Region: {AWS_REGION})")
    except ImportError:
        logger.error("❌ boto3 not installed! Run: pip install boto3")
    except Exception as e:
        logger.error(f"❌ AWS SES initialization failed: {str(e)}")
else:
    logger.warning("⚠️  AWS SES not configured - emails will not be sent")


def send_email(to_email: str, subject: str, html_content: str) -> bool:
    """
    Send email using AWS SES
    """
    if not ses_client:
        logger.warning(f"AWS SES not configured. Would send to {to_email}: {subject}")
        return False
    
    try:
        response = ses_client.send_email(
            Source=FROM_EMAIL,
            Destination={'ToAddresses': [to_email]},
            Message={
                'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                'Body': {'Html': {'Data': html_content, 'Charset': 'UTF-8'}}
            }
        )
        logger.info(f"✅ Email sent to {to_email}: {response['MessageId']}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to send email to {to_email}: {str(e)}")
        return False


def send_approval_notification_email(user_email: str, user_name: str, task_title: str, 
                                     notification_type: str, notes: str = None):
    """
    Send approval workflow notification emails
    
    notification_type: 'request', 'approved', 'rejected'
    """
    
    if notification_type == 'request':
        subject = f"Approval Required: {task_title}"
        color = "#f59e0b"  # Orange
        icon = "⏳"
        action_text = "Review & Approve"
        message = f"<p>A task requires your approval:</p>"
        if notes:
            message += f'<p style="color: #6b7280; font-style: italic;">"{notes}"</p>'
        
    elif notification_type == 'approved':
        subject = f"✅ Task Approved: {task_title}"
        color = "#10b981"  # Green
        icon = "✅"
        action_text = "View Task"
        message = f"<p>Great news! Your task has been approved and moved forward.</p>"
        if notes:
            message += f'<p style="color: #6b7280; font-style: italic;">Approver note: "{notes}"</p>'
        
    else:  # rejected
        subject = f"❌ Task Rejected: {task_title}"
        color = "#ef4444"  # Red
        icon = "❌"
        action_text = "View Task"
        message = f"<p>Your task has been rejected and requires revisions.</p>"
        if notes:
            message += f'<p style="color: #dc2626; font-weight: 500;">Reason: {notes}</p>'
    
    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: {color}; margin-bottom: 20px;">{icon} {subject}</h2>
          <p>Hi {user_name},</p>
          {message}
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid {color};">
            <h3 style="margin-top: 0; color: #1f2937;">{task_title}</h3>
          </div>
          <p>
            <a href="{FRONTEND_URL}/tasks" 
               style="background: {color}; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;
                      font-weight: 500;">
              {action_text}
            </a>
          </p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px;">
            This is an automated email from Kartavya Task Management System by Aekam Inc.
          </p>
        </div>
      </body>
    </html>
    """
    
    return send_email(user_email, subject, html_content)


def send_task_assignment_email(user_email: str, user_name: str, task_title: str, task_id: str, team_name: str = None):
    """
    Send task assignment notification
    """
    subject = f"New Task Assigned: {task_title}"
    
    team_info = f" in {team_name}" if team_name else ""
    
    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #6366f1; margin-bottom: 20px;">New Task Assigned</h2>
          <p>Hi {user_name},</p>
          <p>You have been assigned a new task{team_info}:</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1f2937;">{task_title}</h3>
            <p style="color: #6b7280; font-size: 14px; margin: 5px 0;">Task ID: {task_id}</p>
          </div>
          <p>
            <a href="{FRONTEND_URL}/tasks" 
               style="background: #6366f1; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;
                      font-weight: 500;">
              View Task
            </a>
          </p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px;">
            This is an automated email from Kartavya Task Management System by Aekam Inc.
          </p>
        </div>
      </body>
    </html>
    """
    
    return send_email(user_email, subject, html_content)


def send_team_invite_email(to_email: str, team_name: str, inviter_name: str, invite_token: str):
    """
    Send team invitation email
    """
    invite_url = f"{FRONTEND_URL}/accept-invite?token={invite_token}"
    
    subject = f"You've been invited to join {team_name}"
    
    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #6366f1; margin-bottom: 20px;">Team Invitation</h2>
          <p>Hello,</p>
          <p>{inviter_name} has invited you to join the team <strong>{team_name}</strong> on Kartavya.</p>
          <p style="margin: 30px 0;">
            <a href="{invite_url}" 
               style="background: #6366f1; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;
                      font-weight: 500;">
              Accept Invitation
            </a>
          </p>
          <p style="color: #6b7280; margin-top: 20px; font-size: 14px;">
            This invitation will expire in 7 days.
          </p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px;">
            This is an automated email from Kartavya Task Management System by Aekam Inc.
          </p>
        </div>
      </body>
    </html>
    """
    
    return send_email(to_email, subject, html_content)


def send_task_reminder_email(user_email: str, user_name: str, task_title: str, task_id: str, due_date: str):
    """
    Send task reminder email
    """
    subject = f"Task Reminder: {task_title}"
    
    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #f59e0b; margin-bottom: 20px;">⏰ Task Reminder</h2>
          <p>Hi {user_name},</p>
          <p>This is a reminder for your upcoming task:</p>
          <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h3 style="margin-top: 0; color: #92400e;">{task_title}</h3>
            <p style="color: #78350f; font-size: 14px; margin: 5px 0;">Due: {due_date}</p>
          </div>
          <p>
            <a href="{FRONTEND_URL}/tasks" 
               style="background: #f59e0b; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;
                      font-weight: 500;">
              View Task
            </a>
          </p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px;">
            This is an automated email from Kartavya Task Management System by Aekam Inc.
          </p>
        </div>
      </body>
    </html>
    """
    
    return send_email(user_email, subject, html_content)


def send_welcome_email(user_email: str, user_name: str):
    """
    Send welcome email to new users
    """
    subject = "Welcome to Kartavya!"
    
    html_content = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #6366f1; margin-bottom: 20px;">Welcome to Kartavya! 🎉</h2>
          <p>Hi {user_name},</p>
          <p>Welcome to Kartavya - your new task management platform by Aekam Inc!</p>
          <p>Here's what you can do:</p>
          <ul style="color: #4b5563; line-height: 1.8;">
            <li>Create and manage tasks with custom workflows</li>
            <li>Collaborate with team members</li>
            <li>Track progress with visual boards</li>
            <li>Get reminders for upcoming deadlines</li>
          </ul>
          <p style="margin: 30px 0;">
            <a href="{FRONTEND_URL}/dashboard" 
               style="background: #6366f1; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 6px; display: inline-block;
                      font-weight: 500;">
              Get Started
            </a>
          </p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px;">
            This is an automated email from Kartavya Task Management System by Aekam Inc.
          </p>
        </div>
      </body>
    </html>
    """
    
    return send_email(user_email, subject, html_content)
