# Cursor branch: training seed & board task modal

**Branch:** `cursor/training-seed-and-board-task-modal`  
**Commit (initial feature):** `e10ec45` — *Add Training Academy seed (100 tasks) and project board new-task modal.*

## 1. Project board — new task modal

**Problem:** On the project board (`/projects/:projectId`), **+ Add task** used `window.prompt` instead of the shared task modal, so there was no real “new task” UI.

**Changes:**

- `frontend/src/pages/ProjectBoardPage.jsx` — Opens **`TaskEditor`** when a column fires `new_task`; passes **`defaultTeamId`** (current project), **`defaultColumnId`** (that column), and **`lockToProject`** so the project picker is hidden on the board.
- `frontend/src/components/TaskEditor.jsx` — New optional props:
  - **`defaultColumnId`** — On create, sent as **`column_id`** in `POST /tasks` so tasks land in the correct kanban column.
  - **`lockToProject`** — Hides the project field and saves with **`defaultTeamId`** as `team_id`.
  - Form **resets when the modal opens** (`open` included in the effect dependencies).

## 2. Backend — Training & QA Academy seed

**File:** `backend/seed.py`

**New project:** `seed_training_100` — team name **“Training & QA Academy (100 tasks)”**.

**Re-runnable:** `wipe_training_team()` deletes the training team and dependents (comments, time entries, field values, task_clients, activity, tasks, field definitions, saved_views, automations, approvals, columns, assignments, members, team). Mentions cleanup is wrapped in `asyncpg.exceptions.UndefinedTableError` if that table is missing.

**100 tasks (`train_task_000` … `train_task_099`):**

- Spread across columns **To Do**, **In Progress**, **In Review**, **Approval**, **Done** with matching **`status`** (`todo`, `in_progress`, `in_review`, `done`).
- **Priorities:** `low` / `medium` / `high` / `urgent` (rotating).
- **Creators:** mix of admin, member, and client.
- **Assignees:** varied so **My work** dashboard widget has data.
- **Attachments:** every third task gets dummy **PDF / image / text** URLs (public, for UI tests).
- **Owner approval:** tasks `000`–`009` — `approval_status = 'pending'`, `requires_approval = true`.
- **Client approval:** tasks `010`–`017` and **`062`–`071`** (Approval column) — `approval_status = 'pending_client'`.
- **Done column:** approved + completed metadata where applicable.
- **`task_clients`:** client linked on all training tasks.
- **Timers:** **`train_task_000`** has one **open** time entry (`ended_at` NULL) for **member** (“timer on”); other tasks get **closed** entries (“timer off”).
- **Custom fields:** definitions for `dropdown`, `number`, `person`, `date`, `files`, `text` plus **`field_values`** per task where relevant.
- **Comments:** subset with member @mention and client notes.
- **Activity:** `created` events with `ON CONFLICT DO NOTHING` (aligned with lifecycle seed).

**Dashboard (admin):** `seed_lifecycle_dash` widgets extended so **lifecycle** and **training** projects both appear (extra count/chart/deadlines widgets keyed to `seed_training_100`).

## 3. How to run the seed

Requires Postgres (e.g. **Supabase**): set **`DATABASE_URL`** to your connection string, then from repo root:

```bash
cd backend
DATABASE_URL="postgresql://..." python seed.py
```

Use a role that can satisfy your **RLS** policies if applicable (often the **service role** URI for scripts).

## 4. Login hints (seed users)

Seed upserts demo users (password hash is placeholder — reset via admin if needed):

- `admin@Kartavaya.dev`
- `member@Kartavaya.dev`
- `client@Kartavaya.dev`
