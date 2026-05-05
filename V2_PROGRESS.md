# Kartavya v2 — Daily Progress Log

## Day 1-2 ✅ — 2026-05-05

### What landed
- **Branch:** `v2-plan` created from `main`
- **DB migrations applied to Supabase (prod):**
  - `field_definitions` + `field_values` (custom fields)
  - `saved_views` + `dashboards`
  - `automations` + `project_templates` + `task_templates`
  - `activity_events` (full index set)
  - `time_entries` (full index set)
  - `mentions`
- Backend router scaffold: fields, views, automations, activity, dashboards, templates, time_entries
- Backend services: activity_logger, automation_engine, mentions, storage
- Design system tokens: Inter font, color tokens (light+dark), spacing, typography
- Frontend pages: AutomationsPage, ActivityFeedPage, TimeReportPage

---

## Day 3 ✅ — 2026-05-05

### What landed
- **server.py updated:** all 7 v2 routers mounted (`fields`, `views`, `automations`, `activity`, `dashboards`, `templates`, `time`). Activity logging + automation firing wired into `create_task` and `update_task`. `@mentions` fan-out wired into `add_comment`. `full_name` used in all display queries.
- **Custom field components (7):**
  - `StatusField` — coloured pill selector with configurable options
  - `PersonField` — searchable member picker with avatar
  - `DateField` — date input with relative display (Today / Tomorrow / X days ago) + overdue colouring
  - `NumberField` — numeric input with optional prefix/suffix (e.g. `$`, `hrs`)
  - `DropdownField` — single-select from config options
  - `TextField` — inline click-to-edit, single-line or multiline
  - `FilesField` — file list + upload button (calls `/api/upload`)
  - `FieldRenderer` — dispatcher, all field types routed here
- **TaskDrawer** — right-slide drawer replacing old modal:
  - Inline title editing (blur-to-save)
  - Priority select + due date
  - Description textarea (blur-to-save)
  - Custom fields grid (auto-save on change)
  - Comments thread with @mention hint
  - Activity tab — full per-task event log
  - Time tab — start/stop timer
  - Loading skeleton while fetching
- **KanbanCard v2** — compact dense card:
  - Priority colour dot
  - Due date with overdue warning
  - Assignee avatar stack (max 3 + overflow count)
  - Custom field chips (first 2 fields)
  - Approval pending badge (⏳)
- **useFields hook** — `useFieldDefs(teamId)` + `useFieldValues(taskId)` with create/update/delete helpers

### What's next (Day 4)
- `TableView.jsx` — sortable, filterable, groupable, column picker shows custom fields
- `KanbanView.jsx` — refactored to use new KanbanCard + TaskDrawer + drag-and-drop
- `CalendarView.jsx` — month grid with task dots and drag-to-reschedule
- Wire `ProjectBoardPage` to use all three views + saved views switcher

### Blockers
- None
