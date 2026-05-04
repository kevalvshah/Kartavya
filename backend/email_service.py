"""
email_service.py - Email service using SendGrid
"""

import logging
import os
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

logger = logging.getLogger(__name__)

SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY")
FROM_EMAIL = os.environ.get("FROM_EMAIL", "noreply@kartavya.app")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://kartavya-aekam.vercel.app")


def send_email(to_email: str, subject: str, html_content: str) -> bool:
    """
    Send email using SendGrid
    """
    if not SENDGRID_API_KEY:
        logger.warning(f"SendGrid not configured. Would send email to {to_email}: {subject}")
        return False
    
    try:
        message = Mail(
            from_email=FROM_EMAIL,
            to_emails=to_email,
            subject=subject,
            html_content=html_content
        )
        
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)
        
        logger.info(f"Email sent to {to_email}: Status {response.status_code}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        return False


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
