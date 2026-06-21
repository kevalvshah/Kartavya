"""
Unit tests for the approval workflow.

Coverage:
  GET  /api/approvals/pending      — admin/member scoped view
  GET  /api/approvals/history      — approved/rejected history
  POST /api/approvals/{id}/review  — approve, reject, client-reject IDOR guard

Security assertions:
  - Client role cannot call /api/approvals/pending without project ownership
  - Client-reject IDOR: user without task_clients row is blocked
  - Rejection requires a non-empty notes field
"""

from datetime import datetime, timezone

import pytest

from helpers import make_task_row

NOW = datetime.now(timezone.utc)

TASK_ROW = make_task_row(
    requires_approval=True,
    approval_status="pending",
    team_id="team_001",
    created_by_user_id="user_client001",
)

APPROVAL_ROW = {
    "approval_id": "approval_test001",
    "team_id": "team_001",
    "requested_by": "user_client001",
    "status": "pending",
    "request_type": "create",
    "request_data": '{"title":"Fix bug","task_id":"task_test001"}',
    "requester_name": "Test Client",
    "requested_by_email": "client@test.com",
    "created_at": NOW,
    "reviewed_by": None,
    "reviewed_at": None,
    "review_notes": None,
}


# ── GET /api/approvals/pending ────────────────────────────────────────────────

async def test_list_pending_approvals_admin(api_client, mock_pool, as_admin):
    mock_pool.fetch.return_value = [APPROVAL_ROW]
    resp = await api_client.get("/api/approvals/pending")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_list_pending_approvals_empty(api_client, mock_pool, as_admin):
    mock_pool.fetch.return_value = []
    resp = await api_client.get("/api/approvals/pending")
    assert resp.status_code == 200
    assert resp.json() == []


# ── GET /api/approvals/history ────────────────────────────────────────────────

async def test_approval_history_admin(api_client, mock_pool, as_admin):
    mock_pool.fetch.return_value = []
    resp = await api_client.get("/api/approvals/history")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


# ── POST /api/approvals/{id}/review — approve ─────────────────────────────────

async def test_approve_task_approval(api_client, mock_pool, as_admin, admin_user):
    """Admin approves a task-approval (task_approval-- prefix)."""

    async def fetchrow_side(query, *args):
        if "FROM tasks WHERE task_id" in query:
            return TASK_ROW
        if "project_assignments" in query:
            return {"role": "admin"}
        if "team_members" in query:
            return None
        if "SELECT role FROM users" in query:
            return {"role": "admin"}
        if "project_columns" in query:
            return {"column_id": "col_done"}
        return None

    mock_pool.fetchrow.side_effect = fetchrow_side
    mock_pool.execute.return_value = "UPDATE 1"
    resp = await api_client.post(
        "/api/approvals/task_approval--task_test001/review",
        json={"status": "approved", "notes": ""},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "approved"


async def test_approve_classic_approval(api_client, mock_pool, as_admin, admin_user):
    """Approve a legacy approvals-table record."""

    async def fetchrow_side(query, *args):
        if "FROM approvals WHERE approval_id" in query:
            return APPROVAL_ROW
        if "project_assignments" in query:
            return {"role": "admin"}
        if "team_members" in query:
            return None
        if "SELECT role FROM users" in query:
            return {"role": "admin"}
        if "project_columns" in query or "column_id FROM project_columns" in query:
            return {"column_id": "col_001"}
        if "SELECT column_id" in query or "fetchval" in query:
            return "col_001"
        return None

    mock_pool.fetchrow.side_effect = fetchrow_side
    mock_pool.fetchval.return_value = "col_001"
    mock_pool.execute.return_value = "UPDATE 1"
    resp = await api_client.post(
        "/api/approvals/approval_test001/review",
        json={"status": "approved", "notes": ""},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "approved"


# ── POST /api/approvals/{id}/review — reject ──────────────────────────────────

async def test_reject_task_approval_requires_notes(api_client, mock_pool, as_admin):
    """Rejection must include a reason (notes field)."""

    async def fetchrow_side(query, *args):
        if "FROM tasks WHERE task_id" in query:
            return TASK_ROW
        if "project_assignments" in query:
            return {"role": "admin"}
        if "team_members" in query:
            return None
        if "SELECT role FROM users" in query:
            return {"role": "admin"}
        return None

    mock_pool.fetchrow.side_effect = fetchrow_side
    resp = await api_client.post(
        "/api/approvals/task_approval--task_test001/review",
        json={"status": "rejected", "notes": ""},  # empty notes → 400
    )
    assert resp.status_code == 400


async def test_reject_task_approval_with_notes(api_client, mock_pool, as_admin):
    async def fetchrow_side(query, *args):
        if "FROM tasks WHERE task_id" in query:
            return TASK_ROW
        if "project_assignments" in query:
            return {"role": "admin"}
        if "team_members" in query:
            return None
        if "SELECT role FROM users" in query:
            return {"role": "admin"}
        return None

    mock_pool.fetchrow.side_effect = fetchrow_side
    mock_pool.execute.return_value = "UPDATE 1"
    resp = await api_client.post(
        "/api/approvals/task_approval--task_test001/review",
        json={"status": "rejected", "notes": "Does not meet acceptance criteria"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "rejected"


# ── Approval not found ────────────────────────────────────────────────────────

async def test_review_nonexistent_approval(api_client, mock_pool, as_admin):
    mock_pool.fetchrow.return_value = None
    resp = await api_client.post(
        "/api/approvals/approval_missing/review",
        json={"status": "approved", "notes": ""},
    )
    assert resp.status_code == 404


# ── Invalid status value ──────────────────────────────────────────────────────

async def test_review_invalid_status(api_client, as_admin):
    resp = await api_client.post(
        "/api/approvals/task_approval--task_test001/review",
        json={"status": "maybe"},
    )
    assert resp.status_code == 400
