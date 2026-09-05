"""`is_project_member` said "you administer it" about projects that do not exist.

── THE DEFECT ─────────────────────────────────────────────────────────────────

    org_row = await pool.fetchrow("SELECT org_id FROM teams WHERE team_id=$1", team_id)
    org_id = org_row["org_id"] if org_row else None
    if await is_org_admin(user["user_id"], str(org_id) if org_id else None):
        return {"role": "admin"}

Two different facts collapsed into one `None`:

    org_row is None            the team does not exist
    org_row["org_id"] is None  the team exists and has no org

Both then reached `is_org_admin(user, None)` — the UNSCOPED call, whose own
docstring says it "preserves the previous global behaviour" — so ANY org admin
was told they administer ANY string in the path.

── HOW IT SURFACED ────────────────────────────────────────────────────────────

The frontend put the JavaScript value `undefined` into a URL and asked for
`GET /api/projects/undefined/columns`. That passed the membership gate, reached
`ensure_default_columns`, and INSERTed with
`(SELECT org_id FROM teams WHERE team_id=$2)` — NULL, for a team that is not
there — dying on `CHECK (org_id IS NOT NULL)`. Sentry PYTHON-FASTAPI-1H, 8
events, `GET /api/projects/undefined/columns` right there in the message.

⚠ THE 500 IS THE SMALL HALF, and it is the half that got noticed only because
it was loud. Ten routes are gated on this helper and five of them test
`mem["role"] in ("owner","admin")` — create, update, delete and reorder columns,
and the project brand kit. Every one of them was answering the authorisation
question about a project that does not exist.

── WHAT THIS FILE PINS ────────────────────────────────────────────────────────

That a missing team row is refused, and — as importantly — the three things the
fix must NOT change: a real membership row still wins, an org admin still
administers a team that DOES exist, and the null-org fall-through the helper's
docstring deliberately defends is untouched.
"""
from unittest.mock import AsyncMock, MagicMock

import pytest

import server


def pool_with(assignment_row, team_row):
    """A pool answering the two queries `is_project_member` makes, in order."""
    pool = MagicMock()
    pool.fetchrow = AsyncMock(side_effect=[assignment_row, team_row])
    return pool


ADMIN = {"user_id": "user_admin", "role": "admin"}


class TestAMissingTeamIsRefused:
    @pytest.mark.anyio
    @pytest.mark.parametrize("team_id", ["undefined", "null", "", "team_does_not_exist"])
    async def test_an_org_admin_gets_nothing_for_a_team_that_does_not_exist(
            self, monkeypatch, team_id):
        """⚠ THE REGRESSION. `undefined` is the value that actually arrived."""
        async def _yes(user_id, org_id=None):
            return True          # a real org admin, globally
        monkeypatch.setattr("middleware.roles.is_org_admin", _yes)

        # no assignment row, and no team row — the team is not there
        mem = await server.is_project_member(pool_with(None, None), team_id, ADMIN)
        assert mem is None, (
            f"is_project_member said {mem!r} about team {team_id!r}, which does "
            f"not exist — ten routes are gated on this answer and five of them "
            f"grant write access on it"
        )

    @pytest.mark.anyio
    async def test_the_org_admin_question_is_never_even_asked(self, monkeypatch):
        """Refused BEFORE `is_org_admin`, not after.

        Asking first and discarding the answer would work today and would break
        the moment somebody reorders the branches — and the unscoped call is the
        one that answers True for everybody.
        """
        asked = []

        async def _spy(user_id, org_id=None):
            asked.append(org_id)
            return True
        monkeypatch.setattr("middleware.roles.is_org_admin", _spy)

        await server.is_project_member(pool_with(None, None), "undefined", ADMIN)
        assert not asked, (
            "is_org_admin was consulted about a team that does not exist; the "
            "unscoped call answers True for any org admin"
        )


class TestWhatMustNotChange:
    @pytest.mark.anyio
    async def test_a_real_membership_row_still_wins(self, monkeypatch):
        """Read before the admin question, and returned as it stands — that is
        what lets a caller tell a Tier-3 client from an owner."""
        async def _no(user_id, org_id=None):
            return False
        monkeypatch.setattr("middleware.roles.is_org_admin", _no)

        mem = await server.is_project_member(
            pool_with({"role": "client"}, None), "team_001", ADMIN)
        assert mem == {"role": "client"}, (
            "the real role was collapsed or lost; an admin escape hatch must not "
            "overwrite it"
        )

    @pytest.mark.anyio
    async def test_an_org_admin_still_administers_a_team_that_exists(self, monkeypatch):
        async def _yes(user_id, org_id=None):
            return True
        monkeypatch.setattr("middleware.roles.is_org_admin", _yes)

        mem = await server.is_project_member(
            pool_with(None, {"org_id": "org_1"}), "team_001", ADMIN)
        assert mem == {"role": "admin"}, (
            "the fix took away access org admins legitimately have"
        )

    @pytest.mark.anyio
    async def test_a_team_with_no_org_still_falls_through_unscoped(self, monkeypatch):
        """⚠ DELIBERATELY UNCHANGED.

        The helper's docstring defends this for teams that exist with no org,
        and `get_visible_team_ids` relies on the same shape. Measured
        2026-09-05: 41 teams, ZERO with a null org — so this branch is
        unreachable today and the docstring's "2 of the 29 live teams" is stale.
        Narrowing it is a separate decision from refusing a missing row, and
        this test exists so that decision is made deliberately rather than
        absorbed into this one.
        """
        seen = []

        async def _yes(user_id, org_id=None):
            seen.append(org_id)
            return True
        monkeypatch.setattr("middleware.roles.is_org_admin", _yes)

        mem = await server.is_project_member(
            pool_with(None, {"org_id": None}), "team_no_org", ADMIN)
        assert mem == {"role": "admin"}
        assert seen == [None], "the null-org team no longer reaches the unscoped call"
