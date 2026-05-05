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
- **Backend router split:** `backend/routers/` scaffold created — auth, teams, tasks, fields, views, automations, activity, dashboards, templates, time_entries, notifications, upload
- **Backend services split:** `backend/services/` — email, activity_logger, automation_engine, mentions, storage
- **Design system tokens:** `frontend/src/lib/tokens.css` — Inter font, full color token set (light+dark), spacing scale, typography scale
- **Frontend scaffold:** `frontend/src/` pages/ components/ui/ components/views/ components/fields/ components/widgets/ hooks/ structure created
- **Main entry:** `frontend/src/App.jsx` — thin shell, routes only (~150 lines)

### What's next (Day 3)
- Custom field CRUD endpoints in `backend/routers/fields.py`
- Field components: StatusField, PersonField, DateField, NumberField, DropdownField, TextField, FilesField
- FieldRenderer dispatcher
- Wire custom fields into TaskDrawer

### Blockers
- None

---
