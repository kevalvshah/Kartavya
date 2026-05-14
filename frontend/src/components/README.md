# frontend/src/components/

Shared UI components. Subdivided by concern.

## Sub-folders

| Folder | What lives there |
|---|---|
| `layout/` | App shell, sidebar, topbar, auth guards — structural chrome |
| `views/` | Kanban, Table, Calendar board views rendered inside `ProjectBoardPage` |
| `ui/` | Design-system primitives: button, badge, input, modal, select, toast |
| `fields/` | Custom field renderers — one component per field type |
| *(root)* | Feature-level components used across multiple pages |

## Root-level files

| File | Purpose | Used by |
|---|---|---|
| `TaskDrawer.jsx` | Right-side drawer for full task editing (v2 replacement for modal) | `ProjectBoardPage`, `TasksListPage` |
| `TaskEditor.jsx` | Compact inline task creation form | `ProjectBoardPage` (new-task-in-column flow) |
| `ActivityList.jsx` | Renders a list of `activity_events` rows | `ActivityFeedPage`, `TaskDrawer` |
| `MentionTextarea.jsx` | Textarea with `@username` autocomplete | `TaskDrawer` comments thread |
| `NotificationsModal.js` | Notification bell dropdown | `AppShell` |
| `Sidebar.js` | Legacy sidebar (superseded by `layout/Sidebar.jsx` — delete when confirmed unused) |
| `Topbar.js` | Legacy topbar (superseded by `layout/Topbar.jsx` — delete when confirmed unused) |

## layout/ files

| File | Purpose |
|---|---|
| `AppShell.jsx` | Main layout grid, sidebar + topbar, notification poll, outlet context (`teamId`, `teams`) |
| `Sidebar.jsx` | Nav links. Must stay in sync with `App.js` route tree |
| `Topbar.jsx` | Top bar with notification bell (desktop) |
| `Protected.jsx` | Auth guard — redirects to `/login` if no session |
| `AuthShell.jsx` | Layout wrapper for login/register pages |

## views/ files

| File | Purpose | Props |
|---|---|---|
| `KanbanView.jsx` | Drag-and-drop column board | `columns`, `tasks`, `fieldDefs`, `fieldValueMap`, `teamMembers`, `onTasksChange`, `onColumnChange` |
| `KanbanCard.jsx` | Individual card within KanbanView | `task`, `fieldDefs`, `fieldValueMap` |
| `TableView.jsx` | Sortable/filterable table | `tasks`, `columns`, `fieldDefs`, `fieldValueMap`, `teamMembers`, `onTasksChange` |
| `CalendarView.jsx` | Month calendar, tasks by due date | `tasks`, `onTaskClick` |

## ui/ files (design system primitives)

All `.js` files — rename to `.jsx` when next touched.

| File | Exports |
|---|---|
| `button.js` | `Button` |
| `badge.js` | `Badge` |
| `input.js` | `Input` |
| `modal.js` | `Modal` |
| `select.js` | `Select` |
| `toast.js` | `ToastProvider`, `useToast` |

## Cross-folder impact

| When you touch… | Also check… |
|---|---|
| `layout/AppShell.jsx` | `App.js` `teamId` wrapper components, `pages/` that use `useOutletContext` |
| `layout/Sidebar.jsx` | `App.js` route tree — nav links must match routes |
| `layout/Protected.jsx` | `lib/auth.js` session check logic |
| `views/KanbanView.jsx` | `views/KanbanCard.jsx`, `ProjectBoardPage.jsx` `onColumnChange` handler |
| `views/TableView.jsx` | `ProjectBoardPage.jsx` props passed down |
| `views/CalendarView.jsx` | `ProjectBoardPage.jsx` `onTaskClick` handler |
| `ui/toast.js` | `App.js` `ToastProvider` wrapper |
| `TaskDrawer.jsx` | `backend/server.py` task PATCH + comments endpoints, `ActivityList.jsx` |
| `MentionTextarea.jsx` | `backend/services/mentions.py`, `backend/migrations/006_mentions.sql` |
| Any `ui/` primitive | All pages and components that import it — visual regression risk |
