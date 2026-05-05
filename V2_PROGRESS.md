# Kartavya v2 — Daily Progress Log

## Days 1-2 ✅ — 2026-05-05
- Branch `v2-plan` from `main`
- All 5 DB migrations applied: field_definitions, field_values, saved_views, dashboards, automations, project_templates, task_templates, activity_events, time_entries, mentions
- Backend router scaffold: fields, views, automations, activity, dashboards, templates, time_entries
- Backend services: activity_logger, automation_engine, mentions, storage
- Design system tokens: Inter font, full color token set (light+dark), spacing scale, typography
- Frontend pages: AutomationsPage, ActivityFeedPage, TimeReportPage

## Day 3 ✅ — 2026-05-05
- `server.py` updated: all 7 v2 routers mounted, activity logging + automation fire wired into create_task/update_task, @mentions into add_comment, full_name in all display queries
- Custom field components (7): StatusField, PersonField, DateField, NumberField, DropdownField, TextField, FilesField + FieldRenderer dispatcher
- TaskDrawer: right-slide, details/activity/time tabs, inline save, custom fields grid, comments, timer buttons
- KanbanCard v2: priority dot, due date, assignee avatars, field chips, approval badge
- useFields hook: useFieldDefs + useFieldValues with CRUD helpers

## Week 1 Complete ✅ — 2026-05-05

### Days 4-5

**KanbanView.jsx**
- Native HTML5 drag-and-drop (no deps)
- Column grouping, card ordering, drop zone hints
- TaskDrawer on card click, optimistic task updates

**TableView.jsx**
- Sort by title / priority / due date (click column header)
- Full-text filter input
- Group by: column | status | priority | none
- Custom field column picker (checkbox toggle per field)
- Overdue highlighting, approval badge, created_by_name display
- TaskDrawer on row click

**CalendarView.jsx**
- Month grid, prev/next navigation
- Tasks shown as priority-coloured dots on their due date
- Overflow count (+N more)
- Day click → new task, dot click → TaskDrawer

**ProjectBoardPage.jsx**
- View switcher pill: Kanban / Table / Calendar
- SavedViewsPicker: load saved views, save current view with name prompt
- FieldManager panel: list fields, add (name + type), delete
- NewTaskModal: title + column + priority
- Add Column button (kanban only)
- Lazy field value loading per task
- Loading skeleton

**Hooks (4)**
- `useViews` — saveView, updateView, deleteView
- `useActivity` — useTeamActivity + useTaskActivity
- `useTimeEntries` — start/stop timer, live elapsed counter, manual entry, delete
- `useAutomations` — create, toggle, remove

**index.css** — animations (fadeIn, slideInR, pulse), sr-only, focus rings

---

## Week 1 Demo checklist
- [ ] Open a project → see Kanban with cards
- [ ] Drag card between columns → persists on refresh
- [ ] Click card → TaskDrawer opens, edit title (blur-to-save)
- [ ] Add a custom field (Fields ▾ → type name → Add)
- [ ] Field appears on card and in drawer
- [ ] Switch to Table view → sort by priority, filter by text
- [ ] Group by column in table
- [ ] Switch to Calendar → tasks with due dates appear as dots
- [ ] Save current view → reappears in dropdown
- [ ] Create new task from + New Task button

---

## What's next (Week 2 — Day 6)
- Activity logger wired into assign + field_changed mutations
- Activity panel in TaskDrawer fully populated from API
- Project-level ActivityFeedPage with actor/type/date filters
- @mention autocomplete in comment textarea (typeahead on @)
