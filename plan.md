# Notion-Style Task Manager (MVP) – Plan

## Product scope (based on your choices)
- Multi-user app with **Emergent Google OAuth**
- Tasks support **both Categories + Priority**, due date **with time**, and a dashboard that shows tasks by status.
- Views: **List + Kanban**, plus **drag & drop** reordering/moving on the board.
- Extra fields: **notes/description, subtasks, tags, attachments (URL-based in MVP), reminders (datetime field in MVP), recurring (simple rule), estimated time, custom fields**.

---

## Architecture
- **Frontend:** React + React Router, Tailwind CSS (Notion-like layout + light/dark toggle)
- **Backend:** FastAPI
- **Database:** MongoDB (Motor async)
- **Auth:** Emergent Google OAuth
  - Frontend redirects to Emergent auth page with `redirect` set via `window.location.origin`.
  - Frontend receives `#session_id=...` in URL, exchanges with backend.
  - Backend fetches user data from Emergent endpoint, stores user + session, sets httpOnly cookie.

---

## Data model (MongoDB)

### users
- `user_id` (string, app-generated `user_<uuid>`)
- `email` (string, unique)
- `name` (string)
- `picture` (string | null)
- `created_at` (datetime, UTC)
- `updated_at` (datetime, UTC)

### user_sessions
- `session_token` (string, unique)
- `user_id` (string)
- `expires_at` (datetime, UTC)
- `created_at` (datetime, UTC)

### categories
- `category_id` (string, `cat_<uuid>`)
- `user_id` (string)
- `name` (string)
- `color` (string, hex)
- `created_at`, `updated_at`

### tasks
- `task_id` (string, `task_<uuid>`)
- `user_id` (string)
- `title` (string)
- `description` (string | null)
- `status` (string: `todo|in_progress|done`)
- `priority` (string: `low|medium|high|urgent`)
- `category_id` (string | null)
- `tags` (string[])
- `due_at` (datetime | null)
- `reminder_at` (datetime | null)
- `recurrence` (object)
  - `rule` (string: `none|daily|weekly|monthly`)
  - `interval` (int)
- `estimated_minutes` (int | null)
- `attachments` (array of `{name,url}`)
- `custom_fields` (object)
- `subtasks` (array of `{subtask_id,title,is_done,order}`)
- `order` (number) – ordering within a status column
- `created_at`, `updated_at`, `completed_at`

---

## Backend API

### Auth
- `POST /api/auth/session` – exchange `session_id` for cookie session
- `GET /api/auth/me` – verify cookie, return user
- `POST /api/auth/logout` – clear session cookie

### Categories
- `GET /api/categories`
- `POST /api/categories`
- `PUT /api/categories/{category_id}`
- `DELETE /api/categories/{category_id}`

### Tasks
- `GET /api/tasks` (filters: `status, category_id, q, due=overdue|today|week`)
- `POST /api/tasks`
- `GET /api/tasks/{task_id}`
- `PUT /api/tasks/{task_id}`
- `DELETE /api/tasks/{task_id}`
- `PATCH /api/tasks/{task_id}/move` (drag/drop: `status`, `order`)
- `PATCH /api/tasks/{task_id}/toggle` (mark done/undone)

### Dashboard
- `GET /api/dashboard/summary` – counts by status, overdue, due soon

---

## Frontend flows

### Routes
- `/login` – Google sign-in button
- `/dashboard` – summary + quick actions
- `/tasks` – list view with filters + create/edit drawer
- `/board` – kanban with drag & drop
- `/settings/categories` – manage categories

### Auth routing (critical)
- In router render, if URL hash contains `session_id=...` render `AuthCallback` immediately.
- `AuthCallback` calls `/api/auth/session`, then routes to `/dashboard`.
- Protected pages call `/api/auth/me` to verify server-side.

### UI
- Notion-style sidebar + topbar
- Light/dark toggle (stored in localStorage)

---

## Testing approach
- Backend: curl tests for `/api/auth/me`, `/api/tasks` CRUD with Authorization header and cookie.
- Frontend: Playwright flows
  - Login page renders
  - Protected route redirects to login when not authenticated
  - With seeded session cookie: dashboard loads, create/edit/delete task works
  - Kanban drag & drop moves task and persists
- Use `/app/auth_testing.md` playbook for session seeding.
