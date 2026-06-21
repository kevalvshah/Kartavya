"""Shared test helpers — imported by conftest.py and individual test modules."""

import hashlib
import os
from datetime import datetime, timezone

import jwt

JWT_SECRET = os.environ.get("JWT_SECRET", "test-secret-minimum-32-chars-long-xxxx")
JWT_ALGO = "HS256"

# Computed once per test session — PBKDF2 at 260k iterations takes ~1 s
TEST_PASSWORD = "TestPass123!"
TEST_SALT = "tst_salt_deadbeef01234"
TEST_PASS_HASH = hashlib.pbkdf2_hmac(
    "sha256", TEST_PASSWORD.encode(), TEST_SALT.encode(), 260_000
).hex()


def make_token(user_id: str) -> str:
    from datetime import timedelta
    return jwt.encode(
        {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=1)},
        JWT_SECRET,
        algorithm=JWT_ALGO,
    )


def make_task_row(**overrides) -> dict:
    """Minimal valid dict that row_to_task() accepts without raising."""
    now = datetime.now(timezone.utc)
    base = {
        "task_id": "task_test001",
        "user_id": "user_admin001",
        "team_id": "team_001",
        "column_id": "col_001",
        "created_by_user_id": "user_admin001",
        "assigned_by_user_id": None,
        "completed_by_user_id": None,
        "title": "Test Task",
        "description": None,
        "status": "todo",
        "priority": "medium",
        "category_id": None,
        "tags": [],
        "assignee_user_ids": [],
        "assignee_emails": [],
        "assignee_names": [],
        "due_at": None,
        "reminder_at": None,
        "reminder_sent_at": None,
        "recurrence_rule": "none",
        "recurrence_interval": 1,
        "estimated_minutes": None,
        "attachments": "[]",
        "custom_fields": "{}",
        "subtasks": "[]",
        "sort_order": 0,
        "created_at": now,
        "updated_at": now,
        "completed_at": None,
        "approval_status": None,
        "approval_notes": None,
        "approved_by": None,
        "approval_requested_at": None,
        "approval_decided_at": None,
        "requires_approval": False,
        "created_by_name": "Test Admin",
        "archived_at": None,
        "column_name": None,
        "column_color": None,
    }
    base.update(overrides)
    return base
