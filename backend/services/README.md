# backend/services/

Shared business logic. Called by routers and sometimes by `server.py`.
Nothing in here should import from `routers/` — dependency goes one way:
routers → services, never the reverse.

## Files

| File | Responsibility | Imported by |
|---|---|---|
| `activity_logger.py` | Writes `activity_events` rows on every mutation. Exports `log_event()` and `log_assigned()` | `server.py` task routes, `routers/activity.py` |
| `automation_engine.py` | Evaluates automation rules on trigger events. Exports `fire_automations()` | `server.py` task create/update, `routers/automations.py` |
| `mentions.py` | Parses `@username` in comment bodies, creates `mentions` rows and fan-out notifications. Exports `process_mentions()` | `server.py` add_comment |
| `storage.py` | Abstract file storage interface. `upload_file()` / `delete_file()` / `get_url()`. Currently wraps Cloudflare R2 via boto3-compatible API. Swap provider here without touching routers. | `routers/uploads.py` |

> `backend/storage.py` (root level) is a legacy shim — do not add new
> usage to it. All new storage calls go through `services/storage.py`.

## Rules

- Services are **async** and accept a `pool` (asyncpg) as their first argument.
- Services must not raise HTTP exceptions — they raise plain Python exceptions
  or return `None`. The router decides what HTTP status to send.
- Services must not import from `server.py` directly. If they need a shared
  helper (e.g. `create_notification`), that helper should be extracted to
  `backend/utils.py` first.

## Cross-folder impact

| When you touch… | Also check… |
|---|---|
| `activity_logger.py` | Every router/server.py call site of `log_event` / `log_assigned`; `ActivityFeedPage.jsx`; `routers/activity.py` |
| `automation_engine.py` | `routers/automations.py` trigger list; `AutomationsPage.jsx` rule builder UI |
| `mentions.py` | `MentionTextarea.jsx`; `routers/` notification fan-out; `backend/migrations/006_mentions.sql` |
| `storage.py` | `routers/uploads.py`; `.env.example` R2 vars (`R2_BUCKET_NAME`, `R2_PUBLIC_URL`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`) |

## Adding a new service

1. Create `backend/services/your_service.py`
2. Export pure async functions — no FastAPI imports
3. Add it to the table above
4. Add cross-folder impact row if it touches the DB schema or frontend
