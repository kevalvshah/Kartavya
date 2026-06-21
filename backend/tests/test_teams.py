"""
Unit tests for team / project endpoints in server.py.

Coverage:
  GET  /api/teams          — admin sees all, member sees own, empty list
  POST /api/teams          — admin creates, member blocked
  GET  /api/teams/{id}     — detail + member list
  DELETE /api/teams/{id}   — soft-delete (admin only)
  GET  /api/teams/bin      — deleted teams list (admin only)
  POST /api/teams/{id}/members — add member to team
"""

from datetime import datetime, timezone

import pytest

NOW = datetime.now(timezone.utc)

TEAM_ROW = {
    "team_id": "team_001",
    "name": "Test Project",
    "created_by": "user_admin001",
    "created_at": NOW,
    "updated_at": NOW,
    "deleted_at": None,
    "task_count": 0,
    "done_count": 0,
    "color": None,
}


# ── GET /api/teams ────────────────────────────────────────────────────────────

async def test_list_teams_admin_sees_all(api_client, mock_pool, as_admin):
    """Admin should get all teams, including those they weren't explicitly added to."""
    async def fetch_side(query, *args):
        if "team_id FROM teams" in query:
            return [{"team_id": "team_001"}, {"team_id": "team_002"}]
        if "FROM teams" in query:
            return [TEAM_ROW]
        return []

    mock_pool.fetch.side_effect = fetch_side
    resp = await api_client.get("/api/teams")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_list_teams_empty_for_user_with_no_teams(api_client, mock_pool, as_member):
    async def fetch_side(query, *args):
        if "role FROM users" in query or "SQL_USER_ROLE" in query:
            return [{"role": "member"}]
        # project_assignments + team_members UNION returns nothing
        return []

    mock_pool.fetchrow.return_value = {"role": "member"}
    mock_pool.fetch.side_effect = fetch_side
    resp = await api_client.get("/api/teams")
    assert resp.status_code == 200
    assert resp.json() == []


# ── POST /api/teams ───────────────────────────────────────────────────────────

async def test_create_team_as_admin(api_client, mock_pool, as_admin):
    async def fetchrow_side(query, *args):
        if "INSERT INTO teams" in query:
            return TEAM_ROW
        # _ensure_default_owner lookups → return None so it bails early
        return None

    mock_pool.fetchrow.side_effect = fetchrow_side
    mock_pool.fetchval.return_value = 0  # ensure_default_columns check
    mock_pool.execute.return_value = "INSERT 1"
    resp = await api_client.post("/api/teams", json={"name": "New Project"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == TEAM_ROW["name"]


async def test_create_team_any_member_can_create(api_client, mock_pool, as_member):
    """POST /api/teams only requires authentication, not admin — any member can create."""
    async def fetchrow_side(query, *args):
        if "INSERT INTO teams" in query:
            return TEAM_ROW
        return None

    mock_pool.fetchrow.side_effect = fetchrow_side
    mock_pool.fetchval.return_value = 0
    mock_pool.execute.return_value = "INSERT 1"
    resp = await api_client.post("/api/teams", json={"name": "Member Project"})
    assert resp.status_code == 200


# ── GET /api/teams/{team_id} ──────────────────────────────────────────────────

async def test_get_team_detail(api_client, mock_pool, as_admin):
    async def fetchrow_side(query, *args):
        if "project_assignments" in query:
            return {"role": "admin"}
        if "team_members" in query and "SELECT role" in query:
            return None
        if "FROM teams WHERE team_id" in query:
            return TEAM_ROW
        return None

    mock_pool.fetchrow.side_effect = fetchrow_side
    mock_pool.fetch.return_value = []  # members list
    resp = await api_client.get("/api/teams/team_001")
    assert resp.status_code == 200
    data = resp.json()
    assert "team" in data or "team_id" in data


async def test_get_team_not_found(api_client, mock_pool, as_admin):
    """When project_assignments and team_members both miss → 403 (not a member)."""
    mock_pool.fetchrow.return_value = None
    resp = await api_client.get("/api/teams/team_missing")
    # endpoint returns 403 "Not a team member" when no membership found
    assert resp.status_code == 403


# ── DELETE /api/teams/{team_id} ───────────────────────────────────────────────

async def test_delete_team_admin(api_client, mock_pool, as_admin):
    mock_pool.fetchrow.return_value = TEAM_ROW
    resp = await api_client.delete("/api/teams/team_001")
    assert resp.status_code == 200


async def test_delete_team_member_blocked(api_client, mock_pool, as_member):
    resp = await api_client.delete("/api/teams/team_001")
    assert resp.status_code == 403


# ── GET /api/teams/bin ────────────────────────────────────────────────────────

async def test_deleted_teams_bin_admin(api_client, mock_pool, as_admin):
    mock_pool.fetch.return_value = []
    resp = await api_client.get("/api/teams/bin")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_deleted_teams_bin_member_blocked(api_client, as_member):
    resp = await api_client.get("/api/teams/bin")
    assert resp.status_code == 403


# ── POST /api/teams/{team_id}/members ─────────────────────────────────────────

async def test_add_member_to_team(api_client, mock_pool, as_admin):
    member_row = {
        "member_id": "mem_newxxx",
        "team_id": "team_001",
        "email": "newmember@test.com",
        "user_id": None,
        "role": "member",
        "status": "invited",
        "created_at": NOW,
        "updated_at": NOW,
    }

    async def fetchrow_side(query, *args):
        if "SELECT role FROM project_assignments" in query:
            return {"role": "admin"}
        if "FROM users WHERE email" in query:
            return None  # new user, not yet registered
        if "INSERT INTO team_members" in query:
            return member_row
        return None

    mock_pool.fetchrow.side_effect = fetchrow_side
    mock_pool.execute.return_value = "DELETE 0"
    resp = await api_client.post(
        "/api/teams/team_001/members",
        json={"email": "newmember@test.com", "role": "member"},
    )
    assert resp.status_code == 200


async def test_add_member_non_admin_blocked(api_client, mock_pool, as_member):
    async def fetchrow_side(query, *args):
        if "project_assignments" in query:
            return {"role": "member"}  # not owner/admin
        return None

    mock_pool.fetchrow.side_effect = fetchrow_side
    resp = await api_client.post(
        "/api/teams/team_001/members",
        json={"email": "someone@test.com", "role": "member"},
    )
    assert resp.status_code == 403
