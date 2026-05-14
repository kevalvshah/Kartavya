# frontend/src/hooks/

Custom React hooks. Each hook wraps a single API resource domain.
They are the only place where `api.get/post/put/delete` calls should
live — pages and components call hooks, not `api` directly, unless
the call is one-off and not worth a hook.

## Files

| File | Manages | Key exports | Backend endpoint |
|---|---|---|---|
| `useFields.js` | Custom field definitions for a project | `fieldDefs`, `createField(data)`, `deleteField(id)`, `updateFieldValue(taskId, fieldId, value)` | `GET/POST/DELETE /api/fields/:teamId`, `GET/PUT /api/fields/task/:taskId/values` |
| `useViews.js` | Saved board views for a project | `savedViews`, `saveView(config)`, `deleteView(id)` | `GET/POST/DELETE /api/views/:teamId` |
| `useActivity.js` | Activity event feed | `events`, `loading`, `refresh()` | `GET /api/activity?team_id=&limit=` |
| `useAutomations.js` | Automation rules | `automations`, `createAutomation(rule)`, `updateAutomation(id, patch)`, `deleteAutomation(id)` | `GET/POST/PUT/DELETE /api/automations/:teamId` |
| `useTimeEntries.js` | Time tracking entries | `entries`, `startTimer(taskId)`, `stopTimer(entryId)`, `addManual(data)`, `deleteEntry(id)` | `GET/POST/PATCH/DELETE /api/time` |

## Rules

- Hooks accept a resource ID (e.g. `teamId`) as their argument and
  return `{ data, loading, error, ...mutations }`.
- Hooks manage their own loading/error state — pages just consume it.
- Hooks do not navigate — if an auth error occurs, they set `error`
  and let the page or `Protected.jsx` handle the redirect.
- Hooks do not import from other hooks — if shared fetch logic is needed,
  extract it to `lib/api.js`.

## Cross-folder impact

| When you touch… | Also check… |
|---|---|
| `useFields.js` | `ProjectBoardPage.jsx` field-value fetch, `components/views/KanbanCard.jsx`, `backend/routers/fields.py` |
| `useViews.js` | `ProjectBoardPage.jsx` saved-view UI, `backend/routers/views.py` |
| `useActivity.js` | `ActivityFeedPage.jsx`, `components/ActivityList.jsx`, `backend/routers/activity.py` |
| `useAutomations.js` | `AutomationsPage.jsx`, `backend/routers/automations.py`, `backend/services/automation_engine.py` |
| `useTimeEntries.js` | `TimeReportPage.jsx`, `backend/routers/time_entries.py` |
| Adding a new hook | Add a row to this table; check if an existing hook overlaps |
