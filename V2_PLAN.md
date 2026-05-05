# Kartavya v2 — Build Plan

**Status:** approved 2026-05-05
**Owner:** Keval V Shah
**Working branch:** `v2-plan` on `kevalvshah/Kartavya` (will move to a `Kartavya-v2` repo once user creates it)
**Timeline:** 3 weeks (Day 1 starts the day after this file is committed)

This file is the source of truth for the rebuild. Any future Claude session — or any human contributor — can read this and pick up where we left off without re-litigating decisions.

---

## 1. What we're building

A Monday-leaning project + client collaboration app with Notion-quality polish. Keep the existing approval workflow (client request → owner approve → team works → optional client review → done). Add structure (custom fields, multiple views) and power features (automations, dashboards, activity feed, time tracking, templates, @mentions).

### In scope
- **Multiple views per project:** kanban, table, calendar
- **Custom fields:** status, person, date, number, dropdown, files, text
- **Automations:** trigger × condition × action engine, simple but real
- **Dashboards:** widget grid (count, chart, my-work, deadlines)
- **Activity feed:** every mutation logged, per-task and per-project views
- **@mentions** in comments → notification + email
- **Templates:** project templates, task templates
- **Time tracking:** start/stop timer, manual entry, totals
- **Design system:** typography, color, spacing tokens, full component library

### Explicitly out of scope
- ❌ **Gantt / timeline view** — too much complexity for the value
- ❌ **Cognito migration** — current JWT auth works, migration is days of disruption with no user-visible benefit
- ❌ **Push notifications** — VAPID stubs stay stubs until there's demand
- ❌ **S3 / R2 attachment migration** — deferred until storage decision is made (deadline: end of Week 2)
- ❌ **Mobile/Android app** — separate effort
- ❌ **Multi-step / branching automations** (like Zapier) — v2 supports single trigger → multiple actions, no if/else

### Storage decision (parking)
Attachments stay as base64-in-Postgres until the user picks between **S3**, **Cloudflare R2** (recommended — zero egress fees, S3-compatible API, free 10GB tier), or **Backblaze B2**. Code uses a thin `storage.py` interface so swapping is a one-file change. **Decision deadline: end of Week 2.**

---

## 2. UI quality bar

This is the most important commitment in the plan. Without it we end up where we were last week — generic, mismatched weights, random spacing.

### Typography
- **Body / UI font:** Inter (loaded from rsms.me CDN, OFL-licensed, free for commercial use)
- **Wordmark / logo only:** Harabara Mais — applied exclusively to the "KARTAVYA" wordmark in the top-left of `KWordmark`. Not used anywhere else in the app.
- **Weights used:** 400 (body), 500 (emphasis), 600 (headings), 700 (rare strong emphasis only)
- **Body sizes:** 12 / 13 / 14 / 16 / 18 / 20 / 24 / 32 / 40
- **Line heights:** 1.4 for prose, 1.2 for headings, 1 for buttons
- **Never used:** font-weight 800/900, italic for emphasis (use weight instead), uppercase for body text

### Color tokens (semantic, not hex-named)
Light + dark mode driven entirely by tokens:
```
bg-default, bg-subtle, bg-muted, bg-elevated, bg-overlay
border-default, border-subtle, border-strong
text-default, text-muted, text-subtle, text-disabled, text-on-accent
accent-default, accent-hover, accent-pressed
success, success-bg, warning, warning-bg, danger, danger-bg, info, info-bg
```
Concrete palette uses Kartavya teal `#1AB8B0` as the accent, neutral grays from Radix Colors `slate` scale.

### Spacing scale
4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 only. No 18, 22, 26.

### Density
- Tables, lists, kanban cards: dense (Notion-style)
- Forms, modals, dialogs: comfortable (Monday-style)
- Toggle available on table view (compact / default / relaxed)

### Component library (Radix UI primitives + Tailwind, shadcn/ui pattern)
Sized variants `sm / md / lg`, intent variants `primary / secondary / ghost / destructive`:
Button, IconButton, Input, Textarea, Select, Combobox (searchable), DatePicker, Modal, Drawer (right-slide for task editor), Popover, Tooltip, Badge, Avatar, AvatarGroup, Tabs, Toast, Skeleton, EmptyState, Card, Toolbar, Breadcrumb, ContextMenu, DropdownMenu, Checkbox, Radio, Switch, Slider, ProgressBar.

### Mobile
- Breakpoints: `sm 640 / md 768 / lg 1024 / xl 1280`
- Sidebar collapses to slide-in drawer below `lg`
- Tables become card-stacks below `md`
- Touch targets ≥ 44px

---

## 3. Architecture

### Backend file split
Today: 1 monolithic `server.py` (~1100 lines).
Target:
```
backend/
├── server.py                    # app setup, middleware, mount routers (~80 lines)
├── routers/
│   ├── auth.py
│   ├── teams.py
│   ├── projects.py
│   ├── tasks.py                 # CRUD + comments
│   ├── fields.py                # NEW: custom field defs + values
│   ├── views.py                 # NEW: saved views config
│   ├── automations.py           # NEW: rule CRUD + manual run
│   ├── activity.py              # NEW: feed read endpoints
│   ├── dashboards.py            # NEW: widget config + data queries
│   ├── templates.py             # NEW: project/task templates
│   ├── time_entries.py          # NEW: timer + manual entries
│   ├── approvals.py
│   ├── notifications.py         # + @mentions
│   └── upload.py                # storage-agnostic
├── services/
│   ├── email.py
│   ├── automation_engine.py     # NEW: evaluates rules on events
│   ├── activity_logger.py       # NEW: writes events on every mutation
│   ├── storage.py               # NEW: abstract interface (base64 now, S3/R2 later)
│   └── mentions.py              # NEW: parses @user, fans out notifications
└── migrations/
    ├── 002_custom_fields.sql
    ├── 003_views_and_dashboards.sql
    ├── 004_automations_and_templates.sql
    ├── 005_activity_and_time.sql
    └── 006_mentions.sql
```

### Frontend file split
Today: 1 monolithic `App.js` (~2500 lines). This is the actual reason changes are slow.
Target:
```
frontend/src/
├── App.jsx                              # routes + AppShell only (~150 lines)
├── pages/
│   ├── DashboardPage.jsx                # widget grid
│   ├── ProjectsPage.jsx
│   ├── ProjectBoardPage.jsx             # view-switcher: kanban/table/calendar
│   ├── TasksListPage.jsx
│   ├── ApprovalsPage.jsx
│   ├── ClientProjectsPage.jsx
│   ├── ClientProjectBoardPage.jsx
│   ├── AutomationsPage.jsx              # NEW
│   ├── TemplatesPage.jsx                # NEW
│   ├── ActivityFeedPage.jsx             # NEW (project-level)
│   └── TimeReportPage.jsx               # NEW
├── components/
│   ├── ui/                              # design system primitives
│   │   ├── Button.jsx, IconButton.jsx
│   │   ├── Input.jsx, Textarea.jsx, Select.jsx, Combobox.jsx, DatePicker.jsx
│   │   ├── Modal.jsx, Drawer.jsx, Popover.jsx, Tooltip.jsx, ContextMenu.jsx
│   │   ├── Badge.jsx, Avatar.jsx, AvatarGroup.jsx, Tabs.jsx
│   │   ├── Toast.jsx, Skeleton.jsx, EmptyState.jsx, Card.jsx, Toolbar.jsx
│   │   └── Checkbox.jsx, Radio.jsx, Switch.jsx
│   ├── views/                           # per-view rendering
│   │   ├── KanbanView.jsx
│   │   ├── TableView.jsx
│   │   └── CalendarView.jsx
│   ├── fields/                          # one component per field type
│   │   ├── StatusField.jsx, PersonField.jsx, DateField.jsx
│   │   ├── NumberField.jsx, DropdownField.jsx, FilesField.jsx, TextField.jsx
│   │   └── FieldRenderer.jsx            # dispatches by type
│   ├── widgets/                         # dashboard widgets
│   │   ├── CountWidget.jsx, ChartWidget.jsx
│   │   ├── MyWorkWidget.jsx, DeadlinesWidget.jsx
│   │   └── WidgetRenderer.jsx
│   ├── TaskDrawer.jsx                   # was TaskEditor modal — drawer for v2
│   ├── CommentsThread.jsx               # + @mentions
│   ├── ActivityList.jsx                 # NEW
│   ├── TimeTracker.jsx                  # NEW
│   ├── Sidebar.jsx, Topbar.jsx
│   └── KWordmark.jsx                    # uses Harabara Mais here, only here
├── hooks/
│   ├── useTasks.js, useFields.js, useViews.js
│   ├── useActivity.js, useAutomations.js
│   └── useTimeEntries.js
├── lib/
│   ├── api.js
│   ├── tokens.css                       # design system CSS vars
│   ├── tailwind-preset.js               # exports tokens to Tailwind
│   └── automation-rules.js
└── styles/
    ├── globals.css                      # Inter import + base styles
    └── harabara-wordmark.css            # Harabara Mais @font-face, scoped to .kartavya-wordmark only
```

---

## 4. Data model — new tables

```sql
-- 002_custom_fields.sql
CREATE TABLE field_definitions (
  field_id      TEXT PRIMARY KEY,
  team_id       TEXT NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL,        -- status|person|date|number|dropdown|files|text
  config        JSONB DEFAULT '{}',   -- per-type config (dropdown options, number format, etc)
  sort_order    INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE field_values (
  task_id       TEXT REFERENCES tasks(task_id) ON DELETE CASCADE,
  field_id      TEXT REFERENCES field_definitions(field_id) ON DELETE CASCADE,
  value         JSONB,
  PRIMARY KEY (task_id, field_id)
);
CREATE INDEX field_values_task_idx ON field_values(task_id);

-- 003_views_and_dashboards.sql
CREATE TABLE saved_views (
  view_id       TEXT PRIMARY KEY,
  team_id       TEXT REFERENCES teams(team_id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL,        -- kanban|table|calendar
  config        JSONB DEFAULT '{}',   -- filters, sort, group, visible columns
  created_by    TEXT REFERENCES users(user_id),
  is_default    BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE dashboards (
  dashboard_id  TEXT PRIMARY KEY,
  user_id       TEXT REFERENCES users(user_id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  widgets       JSONB DEFAULT '[]',   -- [{type, config, position: {x,y,w,h}}]
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 004_automations_and_templates.sql
CREATE TABLE automations (
  automation_id TEXT PRIMARY KEY,
  team_id       TEXT REFERENCES teams(team_id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  trigger       JSONB NOT NULL,       -- {event: 'status_changed', filters: [...]}
  actions       JSONB NOT NULL,       -- [{type: 'send_email', config: {...}}]
  enabled       BOOLEAN DEFAULT TRUE,
  created_by    TEXT REFERENCES users(user_id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_run_at   TIMESTAMPTZ,
  run_count     INT DEFAULT 0
);
CREATE TABLE project_templates (
  template_id   TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT,
  config        JSONB NOT NULL,       -- {columns, fields, sample_tasks}
  created_by    TEXT REFERENCES users(user_id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE task_templates (
  template_id   TEXT PRIMARY KEY,
  team_id       TEXT REFERENCES teams(team_id) ON DELETE CASCADE,  -- nullable = global
  name          TEXT NOT NULL,
  config        JSONB NOT NULL,       -- {title_pattern, description, default_assignees, ...}
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 005_activity_and_time.sql
CREATE TABLE activity_events (
  event_id      TEXT PRIMARY KEY,
  task_id       TEXT REFERENCES tasks(task_id) ON DELETE CASCADE,
  team_id       TEXT REFERENCES teams(team_id) ON DELETE CASCADE,
  actor_id      TEXT REFERENCES users(user_id),
  type          TEXT NOT NULL,        -- created|status_changed|assigned|commented|field_changed|approved|rejected|...
  data          JSONB,                -- {from: ..., to: ...}
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX activity_team_idx ON activity_events(team_id, created_at DESC);
CREATE INDEX activity_task_idx ON activity_events(task_id, created_at DESC);
CREATE INDEX activity_actor_idx ON activity_events(actor_id, created_at DESC);

CREATE TABLE time_entries (
  entry_id      TEXT PRIMARY KEY,
  task_id       TEXT REFERENCES tasks(task_id) ON DELETE CASCADE,
  user_id       TEXT REFERENCES users(user_id),
  started_at    TIMESTAMPTZ NOT NULL,
  ended_at      TIMESTAMPTZ,
  minutes       INT,                  -- denormalized for fast sums
  description   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX time_entries_task_idx ON time_entries(task_id);
CREATE INDEX time_entries_user_idx ON time_entries(user_id, started_at DESC);

-- 006_mentions.sql
CREATE TABLE mentions (
  mention_id        TEXT PRIMARY KEY,
  comment_id        TEXT REFERENCES task_comments(comment_id) ON DELETE CASCADE,
  mentioned_user_id TEXT REFERENCES users(user_id),
  notified_at       TIMESTAMPTZ,
  read_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX mentions_user_idx ON mentions(mentioned_user_id, read_at);
```

---

## 5. Automations spec

**Triggers (v2 set):**
- `task_created`
- `status_changed` (with from/to filter)
- `field_changed` (specific field, with from/to filter)
- `assigned` (user or any)
- `due_date_approaching` (X hours before)
- `task_overdue`
- `comment_added`
- `approval_status_changed`

**Actions (v2 set):**
- `send_email` (to: assignees | creator | client | specific email)
- `send_notification` (in-app to specific users)
- `set_field` (set a field on the same task)
- `change_status` (move to a column)
- `assign_to` (set assignees)
- `post_comment` (auto-comment on the task)

**Conditions:** AND-only filters on the trigger payload (no nested OR/NOT in v2).
**Execution:** synchronous on event for fast triggers (status change, comment); APScheduler cron for time-based (overdue, due-approaching).

---

## 6. Week-by-week schedule

### Week 1 — Foundation, design system, custom fields, table view
- **Day 1 (Mon):** Backend file split. No feature changes. Verify all existing endpoints still work with curl smoke test.
- **Day 2 (Tue):** Frontend file split + design system tokens (Inter, color tokens, spacing scale, base components: Button, Input, Modal, Drawer, Card). Existing pages still render with old data.
- **Day 3 (Wed):** Migration 002 + custom field CRUD endpoints + field components (Status, Person, Date, Number, Dropdown, Text, Files).
- **Day 4 (Thu):** Custom field display on kanban cards + edit in TaskDrawer.
- **Day 5 (Fri):** Table view (sortable, filterable, grouped). Saved views CRUD (migration 003).
- **Demo Friday:** Custom fields + table view working end-to-end. UI looks like a real product.

### Week 2 — Activity feed, @mentions, automations, dashboards
- **Day 6 (Mon):** Activity logger service + events emitted on every mutation. Activity panel inside TaskDrawer.
- **Day 7 (Tue):** Project-level activity feed page. Filters by actor, type, date.
- **Day 8 (Wed):** @mentions in comments — parser, autocomplete UI, fan-out to notifications + emails.
- **Day 9 (Thu):** Automation engine + UI for creating rules. 8 triggers × 6 actions × AND filters.
- **Day 10 (Fri):** Dashboards — widget framework + 4 widgets (Count, Chart, MyWork, Deadlines). Drag-to-reorder grid.
- **Demo Friday:** Power features end-to-end. **Storage decision required by EOD.**

### Week 3 — Calendar, templates, time tracking, polish
- **Day 11 (Mon):** Calendar view (using `react-big-calendar`) with drag-to-reschedule.
- **Day 12 (Tue):** Project templates — save current project as template, create new project from template.
- **Day 13 (Wed):** Task templates — quick-create from template inside any project.
- **Day 14 (Thu):** Time tracking — start/stop timer on task, manual entry, totals on dashboard widget. Time report page.
- **Day 15 (Fri):** Bug fixes, mobile polish, attachment storage migration to chosen provider, full QA pass.
- **Demo Friday:** v2 complete. Merge to main.

---

## 7. Risk log (revisit weekly)

1. **3 weeks is aggressive for this scope at high UI quality.** If foundation work in Week 1 reveals it needs 4 weeks, that gets flagged on Day 3, not Day 21.
2. **Automations engine grows complex fast.** v2 stays deliberately simple (no if/else, no multi-step). Push back if scope creeps.
3. **The file split in Days 1–2 is the most important work.** No new features land until Wed of Week 1. This is correct sequencing, not slow progress.
4. **Existing `Kartavya` repo on `main` stays running.** All v2 work happens on a branch. Production isn't disrupted until final merge.
5. **Storage decision blocks Week 3 attachment migration.** Hard deadline: end of Week 2.
6. **Harabara Mais licensing.** Confirmed scoped to wordmark only (display use, the use case the font was designed for). If commercial use of the font itself becomes an issue, fallback to a custom-styled Inter wordmark.

---

## 8. Daily check-in protocol

To prevent another "you wasted my afternoon" loop:
- **End of every working day:** I push a commit to the v2 branch + a one-paragraph summary in chat: what landed, what blocked, what's next.
- **Within 1 hour of hitting a blocker:** I tell you, don't grind silently.
- **Friday of every week:** working demo of that week's milestones. Screenshot or video link in chat.
- **Schedule slip:** flagged as soon as known, not at end of sprint.

---

## 9. How to resume this plan in a future session

If you (or any other Claude) opens this repo fresh and sees this file:

1. Read this file end-to-end.
2. Run `git log --oneline v2-plan` to see what's been committed.
3. Run `git diff main..v2-plan -- '**.py' '**.jsx' '**.js'` to see what changed.
4. Look for a `V2_PROGRESS.md` file at repo root — that's the daily checkpoint log (created on Day 1).
5. Read the latest entry, find "next up", continue from there.

This way no shared state lives in chat memory. The repo is the source of truth.
