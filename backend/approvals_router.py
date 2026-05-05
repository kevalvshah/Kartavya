"""Approvals Router - Task Approval Workflow"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid

from auth_router import require_user, require_admin
from db import get_pool
import asyncpg

router = APIRouter(prefix="/api", tags=["approvals"])

# Models
class ApprovalRequest(BaseModel):
    notes: Optional[str] = None

class ApprovalResponse(BaseModel):
    task_id: str
    approval_status: str
    approved_by: Optional[str]
    approval_notes: Optional[str]
    approval_decided_at: Optional[datetime]

# Helper Functions
async def get_task_with_permission(pool: asyncpg.Pool, task_id: str, user_id: str):
    """Get task and verify user has permission to view it"""
    task = await pool.fetchrow("""
        SELECT t.*, tm.role as user_team_role
        FROM tasks t
        LEFT JOIN team_members tm ON tm.team_id = t.team_id AND tm.user_id = $2
        WHERE t.task_id = $1
    """, task_id, user_id)
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return task

async def is_project_owner(pool: asyncpg.Pool, team_id: str, user_id: str) -> bool:
    """Check if user is project owner or admin"""
    member = await pool.fetchrow("""
        SELECT role FROM team_members 
        WHERE team_id = $1 AND user_id = $2 AND status = 'active'
    """, team_id, user_id)
    
    return member and member['role'] in ('owner', 'admin')

async def send_approval_notification(pool: asyncpg.Pool, task_id: str, task_title: str, 
                                    recipient_id: str, notification_type: str, notes: Optional[str] = None):
    """Send approval notification"""
    from email_service import send_approval_notification_email
    
    # Get recipient email
    user = await pool.fetchrow("SELECT email, name FROM users WHERE user_id = $1", recipient_id)
    if user:
        if notification_type == 'request':
            title = f"Approval Requested: {task_title}"
            message = f"A task requires your approval."
        elif notification_type == 'approved':
            title = f"Task Approved: {task_title}"
            message = f"Your task has been approved."
        else:  # rejected
            title = f"Task Rejected: {task_title}"
            message = f"Your task was rejected. Reason: {notes or 'No reason provided'}"
        
        # Create notification in DB
        await pool.execute("""
            INSERT INTO notifications (notification_id, user_id, type, title, message, task_id, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
        """, f"notif_{uuid.uuid4().hex[:12]}", recipient_id, notification_type, title, message, task_id)
        
        # Send email (async, don't await)
        try:
            send_approval_notification_email(user['email'], user['name'], task_title, notification_type, notes)
        except Exception as e:
            print(f"Failed to send email: {e}")

# Endpoints

@router.post("/tasks/{task_id}/request-approval")
async def request_approval(task_id: str, payload: ApprovalRequest, 
                          pool=Depends(get_pool), user=Depends(require_user)):
    """Request approval from project owner (called when moving to 'Approval' column)"""
    
    task = await get_task_with_permission(pool, task_id, user['user_id'])
    
    if not task['team_id']:
        raise HTTPException(status_code=400, detail="Cannot request approval for personal tasks")
    
    # Get project owner
    owner = await pool.fetchrow("""
        SELECT user_id FROM team_members 
        WHERE team_id = $1 AND role = 'owner' AND status = 'active'
        LIMIT 1
    """, task['team_id'])
    
    if not owner:
        raise HTTPException(status_code=400, detail="No project owner found")
    
    # Update task
    await pool.execute("""
        UPDATE tasks 
        SET approval_status = 'pending',
            approval_requested_at = NOW(),
            approval_notes = $1,
            updated_at = NOW()
        WHERE task_id = $2
    """, payload.notes, task_id)
    
    # Send notification to owner
    await send_approval_notification(pool, task_id, task['title'], owner['user_id'], 'request', payload.notes)
    
    return {"message": "Approval requested", "approval_status": "pending"}


@router.post("/tasks/{task_id}/approve")
async def approve_task(task_id: str, payload: ApprovalRequest,
                      pool=Depends(get_pool), user=Depends(require_user)):
    """Approve a task (owner/admin only)"""
    
    task = await get_task_with_permission(pool, task_id, user['user_id'])
    
    if not task['team_id']:
        raise HTTPException(status_code=400, detail="Cannot approve personal tasks")
    
    # Check if user is owner/admin
    if not await is_project_owner(pool, task['team_id'], user['user_id']):
        # Check if user is system admin
        user_data = await pool.fetchrow("SELECT role FROM users WHERE user_id = $1", user['user_id'])
        if not user_data or user_data['role'] != 'admin':
            raise HTTPException(status_code=403, detail="Only project owner or admin can approve tasks")
    
    # Find next column (move from "Approval" to next column)
    current_column = await pool.fetchrow("""
        SELECT * FROM project_columns WHERE column_id = $1
    """, task['column_id'])
    
    if current_column:
        # Get next column by sort_order
        next_column = await pool.fetchrow("""
            SELECT * FROM project_columns 
            WHERE team_id = $1 AND sort_order > $2 
            ORDER BY sort_order ASC 
            LIMIT 1
        """, task['team_id'], current_column['sort_order'])
        
        new_column_id = next_column['column_id'] if next_column else task['column_id']
        new_status = 'done' if (next_column and next_column['is_done']) else 'in_progress'
    else:
        new_column_id = task['column_id']
        new_status = 'in_progress'
    
    # Update task
    await pool.execute("""
        UPDATE tasks 
        SET approval_status = 'approved',
            approved_by = $1,
            approval_notes = $2,
            approval_decided_at = NOW(),
            column_id = $3,
            status = $4,
            updated_at = NOW()
        WHERE task_id = $5
    """, user['user_id'], payload.notes, new_column_id, new_status, task_id)
    
    # Send notification to task creator
    await send_approval_notification(pool, task_id, task['title'], 
                                     task['created_by_user_id'], 'approved', payload.notes)
    
    return {"message": "Task approved", "approval_status": "approved", "new_column_id": new_column_id}


@router.post("/tasks/{task_id}/reject")
async def reject_task(task_id: str, payload: ApprovalRequest,
                     pool=Depends(get_pool), user=Depends(require_user)):
    """Reject a task (owner/admin only)"""
    
    task = await get_task_with_permission(pool, task_id, user['user_id'])
    
    if not task['team_id']:
        raise HTTPException(status_code=400, detail="Cannot reject personal tasks")
    
    # Check if user is owner/admin
    if not await is_project_owner(pool, task['team_id'], user['user_id']):
        user_data = await pool.fetchrow("SELECT role FROM users WHERE user_id = $1", user['user_id'])
        if not user_data or user_data['role'] != 'admin':
            raise HTTPException(status_code=403, detail="Only project owner or admin can reject tasks")
    
    if not payload.notes:
        raise HTTPException(status_code=400, detail="Rejection reason is required")
    
    # Update task - keep in same column but mark as rejected
    await pool.execute("""
        UPDATE tasks 
        SET approval_status = 'rejected',
            approved_by = $1,
            approval_notes = $2,
            approval_decided_at = NOW(),
            updated_at = NOW()
        WHERE task_id = $3
    """, user['user_id'], payload.notes, task_id)
    
    # Send notification to task creator
    await send_approval_notification(pool, task_id, task['title'], 
                                     task['created_by_user_id'], 'rejected', payload.notes)
    
    return {"message": "Task rejected", "approval_status": "rejected"}


@router.get("/tasks/pending-approval", response_model=List[dict])
async def get_pending_approvals(pool=Depends(get_pool), user=Depends(require_user)):
    """Get all tasks pending approval for current user (owner/admin only)"""
    
    # Get user's role
    user_data = await pool.fetchrow("SELECT role FROM users WHERE user_id = $1", user['user_id'])
    
    if user_data and user_data['role'] == 'admin':
        # System admins see all pending approvals
        tasks = await pool.fetch("""
            SELECT t.*, u.name as created_by_name, u.email as created_by_email,
                   tm.name as team_name
            FROM tasks t
            JOIN users u ON u.user_id = t.created_by_user_id
            LEFT JOIN teams tm ON tm.team_id = t.team_id
            WHERE t.approval_status = 'pending'
            ORDER BY t.approval_requested_at DESC
        """)
    else:
        # Project owners see pending approvals for their projects
        tasks = await pool.fetch("""
            SELECT t.*, u.name as created_by_name, u.email as created_by_email,
                   tm.name as team_name
            FROM tasks t
            JOIN users u ON u.user_id = t.created_by_user_id
            LEFT JOIN teams tm ON tm.team_id = t.team_id
            JOIN team_members tmem ON tmem.team_id = t.team_id
            WHERE t.approval_status = 'pending'
              AND tmem.user_id = $1
              AND tmem.role IN ('owner', 'admin')
              AND tmem.status = 'active'
            ORDER BY t.approval_requested_at DESC
        """, user['user_id'])
    
    return [dict(task) for task in tasks]


@router.post("/tasks/{task_id}/request-client-approval")
async def request_client_approval(task_id: str, client_email: str, payload: ApprovalRequest,
                                  pool=Depends(get_pool), user=Depends(require_user)):
    """Request approval from client (owner/member only)"""
    
    task = await get_task_with_permission(pool, task_id, user['user_id'])
    
    # Get client user_id from email
    client = await pool.fetchrow("SELECT user_id, name FROM users WHERE email = $1", client_email.lower())
    
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Update task
    await pool.execute("""
        UPDATE tasks 
        SET approval_status = 'pending_client',
            approval_requested_at = NOW(),
            approval_notes = $1,
            updated_at = NOW()
        WHERE task_id = $2
    """, payload.notes, task_id)
    
    # Send notification to client
    await send_approval_notification(pool, task_id, task['title'], client['user_id'], 'request', payload.notes)
    
    return {"message": "Client approval requested", "approval_status": "pending_client"}
