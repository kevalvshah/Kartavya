-- migration 009: unique constraint on project_assignments(team_id, user_id)
-- Run: psql $DATABASE_URL -f backend/migrations/009_project_assignments_unique.sql
--
-- project_assignments was originally created (server.py bootstrap / 001_role_based_access.py
-- via CREATE TABLE IF NOT EXISTS) without this constraint actually landing in some
-- environments, even though 001_role_based_access.py's CREATE TABLE statement declares
-- UNIQUE(team_id, user_id) — if the table already existed when that migration ran,
-- "IF NOT EXISTS" silently skipped it. Several call sites (server.py, auth_router.py)
-- rely on `ON CONFLICT (team_id, user_id)` against this table, which throws at runtime
-- without the constraint in place.

-- Defensive dedup: keep the most recently assigned row per (team_id, user_id) in case
-- any environment accumulated duplicates while the constraint was missing.
DELETE FROM public.project_assignments pa
WHERE pa.assignment_id NOT IN (
  SELECT assignment_id FROM (
    SELECT assignment_id,
           ROW_NUMBER() OVER (
             PARTITION BY team_id, user_id
             ORDER BY assigned_at DESC NULLS LAST, assignment_id DESC
           ) AS rn
    FROM public.project_assignments
  ) ranked
  WHERE ranked.rn = 1
);

ALTER TABLE public.project_assignments
  ADD CONSTRAINT project_assignments_team_user_unique UNIQUE (team_id, user_id);
