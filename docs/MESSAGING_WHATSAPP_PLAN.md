# Messaging + WhatsApp Integration Plan
### Kartavaya · संवाद (Samvāda)

**Status:** Draft — Approved for Development  
**Owner:** Keval V Shah · Aekam Inc  
**Authored:** 2026-05-26  
**Scope:** Two features — in-app Slack-like messaging and WhatsApp integration for notifications, comments, and approvals

---

## Table of Contents

1. [Vision](#1-vision)
2. [Feature 1 — In-App Messaging](#2-feature-1--in-app-messaging-संवाद)
3. [Feature 2 — WhatsApp Integration](#3-feature-2--whatsapp-integration-वार्ता)
4. [Shared Data Model](#4-shared-data-model)
5. [Backend Architecture](#5-backend-architecture)
6. [Frontend Architecture](#6-frontend-architecture)
7. [UI Patterns + Design Conventions](#7-ui-patterns--design-conventions)
8. [Phased Delivery Plan](#8-phased-delivery-plan)
9. [Risk Register](#9-risk-register)
10. [Out of Scope](#10-out-of-scope)
11. [Effort Estimate](#11-effort-estimate)

---

## 1. Vision

Indian professional services teams — CA firms, consultancies, agencies — do not separate work and communication. They run approvals on WhatsApp, share files in groups, and lose context between apps. Kartavaya should be the single place where work *and* conversation live together.

**Feature 1 — Messaging (संवाद):** A Slack-inspired messaging layer embedded inside Kartavaya. Project channels auto-exist. DMs work. Messages are threaded. Files attach. Task links unfurl. Realtime throughout.

**Feature 2 — WhatsApp (वार्ता):** WhatsApp becomes a notification and reply surface. Team members receive approval requests on WhatsApp with one-tap Approve/Reject buttons. Replies to any notification land as comments inside Kartavaya. Users never have to open the app to stay in the loop.

**Key principle:** Both features share a single `messages` table. WhatsApp is a delivery channel, not a separate system.

---

## 2. Feature 1 — In-App Messaging · संवाद

### 2.1 Channel Types

| Type | Auto-created | Members | Access |
|---|---|---|---|
| `#project-{name}` | Yes — on project creation | All project members | Project members only |
| `#general` | Yes — on org creation | All org members | Everyone |
| `#announcements` | Yes — on org creation | All org members | Admin post only |
| Direct Message | On first conversation | 2 users | Private |

### 2.2 Core Interactions

**Messaging**
- Send text with `@mention` autocomplete (dropdown shows team members)
- Thread replies — one level deep, like Slack (not nested infinitely)
- Emoji reactions — minimum set: 👍 ✅ 👀 ❤️ 😂
- Edit and soft-delete own messages
- Pin messages in a channel (admin/owner only)

**Files**
- Attach files via button or drag-and-drop into composer
- Uploaded to Cloudflare R2 (reuse existing `backend/services/storage.py`)
- Max size: 25 MB per file
- Images show inline previews
- Non-image files show a filename chip with download icon

**Link Unfurling**
- Paste any Kartavaya task URL → renders a compact task card: title, status chip, assignee avatar, due date
- Paste Figma, Loom, or Google Drive URLs → branded chip with icon
- OG metadata fetch for all other URLs → title + description preview

### 2.3 Sidebar Panel vs Full View

Two rendering modes, one component:

**Sidebar Panel** — shown on `/projects/:projectId`
- Triggered by a chat icon button in the project board header (right side)
- Slides in as a 320px right panel — board shifts left
- Shows only the project's channel
- Unread badge on the toggle button when there are unread messages

**Full View** — `/messages` route
- Left rail: channel list grouped into Channels · चैनल and Direct Messages · संदेश
- Unread dots on channel names
- Main area: full message thread with infinite scroll (load older messages on scroll up)
- Right rail (collapsible): channel info, member list, pinned messages

### 2.4 Notifications

| Event | Push | In-App Badge | WhatsApp (Phase 3+) |
|---|---|---|---|
| @mention | ✅ Always | ✅ | ✅ |
| New DM | ✅ Always | ✅ | ✅ |
| New message in subscribed channel | ❌ | ✅ | ❌ |
| Thread reply on your message | ✅ | ✅ | ❌ |

Reuses existing `send_push()` with `kind="mention"` and `kind="comment"`.

---

## 3. Feature 2 — WhatsApp Integration · वार्ता

### 3.1 Scope — Phase 1

**Outbound (Kartavaya → WhatsApp)**
- Task assigned to you
- Approval requested (with Approve/Reject buttons)
- Task approved
- Task rejected
- @mention in a channel

**Inbound (WhatsApp → Kartavaya)**
- Reply to any notification → posted as a comment on the linked task or message in the linked channel
- Tap **Approve** button → approval recorded, fan-out fires
- Tap **Reject** button → bot asks for reason, next reply used as rejection notes

### 3.2 Provider

**Recommended: Interakt or Wati (BSP)** for initial launch — faster setup, dashboard UI for template management, no webhook infra to self-host initially.

**Migration path:** Once volume exceeds 1,000 conversations/month, migrate to Meta Cloud API directly to eliminate per-message fees.

### 3.3 Approval Flow via WhatsApp — Full Sequence

```
1.  Team member submits task for approval (existing flow, no change)
2.  send_approval_notification() fires (existing — push + email)
3.  NEW: send_whatsapp_approval_request(approver_phone, task)
    ↓
    WhatsApp Template Message:
    ┌─────────────────────────────────────────┐
    │ 📋 Approval Required — Kartavaya         │
    │                                         │
    │ Task: {task_title}                      │
    │ Requested by: {requester_name}          │
    │ Notes: {notes}                          │
    │                                         │
    │ [✅ Approve]  [❌ Reject]               │
    └─────────────────────────────────────────┘
4a. Approver taps [✅ Approve]
    → Webhook receives button payload
    → Backend calls existing approve_task() internally
    → Fan-out: push + email + WhatsApp confirmation sent

4b. Approver taps [❌ Reject]
    → Bot replies: "Please reply with your rejection reason."
    → Next inbound message = rejection notes
    → Backend calls existing reject_task() with those notes
    → Fan-out fires
```

### 3.4 WhatsApp Message Templates

Templates require Meta pre-approval (1–3 business days). Submit all at project start.

| Template Name | Trigger | Body Variables |
|---|---|---|
| `task_assigned` | Task assigned to user | `task_title`, `assignee_name`, `due_date` |
| `approval_request` | Request approval | `task_title`, `requester_name`, `notes` |
| `task_approved` | Task approved | `task_title`, `approver_name` |
| `task_rejected` | Task rejected | `task_title`, `reason` |
| `mention_alert` | @mentioned in channel | `channel_name`, `sender_name`, `snippet` |
| `dm_received` | New DM | `sender_name`, `snippet` |

### 3.5 Opt-In Flow

Meta requires explicit opt-in before sending outbound messages.

**Location:** Profile Settings page → "WhatsApp Notifications" section

**Flow:**
1. User enters phone number (E.164 format, +91 prefix for India auto-filled)
2. Bot sends a one-time OTP to that number via WhatsApp
3. User enters OTP in the settings page to verify
4. On success: `user_whatsapp` row inserted with `opted_in_at`
5. Per-notification-type toggles (same granularity as existing push prefs)

### 3.6 Inbound Reply Threading

When Kartavaya sends a WhatsApp message, it stores the Meta message ID in `whatsapp_messages.wa_message_id` along with `context_type` (task_comment / approval / channel_message) and `context_id`.

When an inbound reply arrives:
- `message.context.id` matches a stored `wa_message_id`
- Lookup → get `context_type` + `context_id`
- Route accordingly: insert into `messages` table with `source='whatsapp'`
- Message appears in Kartavaya with a WhatsApp badge icon

If no context (user texts the bot number directly):
- Bot replies: "Please reply to a specific notification to add a comment."

---

## 4. Shared Data Model

### 4.1 New Tables

```sql
-- ── Channels ───────────────────────────────────────────────────────────────────

CREATE TABLE channels (
  channel_id   TEXT PRIMARY KEY DEFAULT 'ch_' || gen_random_uuid()::text,
  org_id       TEXT NOT NULL REFERENCES teams(team_id),
  type         TEXT NOT NULL CHECK (type IN ('project','general','announcement','dm')),
  project_id   TEXT REFERENCES teams(team_id),  -- null for non-project channels
  name         TEXT,                             -- null for DMs
  created_by   TEXT REFERENCES users(user_id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  archived_at  TIMESTAMPTZ
);

-- ── Channel Members ────────────────────────────────────────────────────────────

CREATE TABLE channel_members (
  channel_id    TEXT REFERENCES channels(channel_id) ON DELETE CASCADE,
  user_id       TEXT REFERENCES users(user_id) ON DELETE CASCADE,
  joined_at     TIMESTAMPTZ DEFAULT NOW(),
  last_read_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (channel_id, user_id)
);

-- ── Messages ───────────────────────────────────────────────────────────────────

CREATE TABLE messages (
  message_id       TEXT PRIMARY KEY DEFAULT 'msg_' || gen_random_uuid()::text,
  channel_id       TEXT NOT NULL REFERENCES channels(channel_id) ON DELETE CASCADE,
  sender_id        TEXT REFERENCES users(user_id),  -- null if source='whatsapp'
  body             TEXT NOT NULL,
  parent_id        TEXT REFERENCES messages(message_id),  -- null = top-level
  source           TEXT DEFAULT 'web' CHECK (source IN ('web','mobile','whatsapp','email')),
  whatsapp_msg_id  TEXT,        -- Meta message ID for dedup + reply threading
  metadata         JSONB DEFAULT '{}',  -- link unfurl data, OG metadata
  edited_at        TIMESTAMPTZ,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_channel_created
  ON messages(channel_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX idx_messages_parent
  ON messages(parent_id) WHERE parent_id IS NOT NULL;

-- ── Attachments ────────────────────────────────────────────────────────────────

CREATE TABLE message_attachments (
  attachment_id  TEXT PRIMARY KEY DEFAULT 'att_' || gen_random_uuid()::text,
  message_id     TEXT NOT NULL REFERENCES messages(message_id) ON DELETE CASCADE,
  r2_key         TEXT NOT NULL,
  filename       TEXT NOT NULL,
  mime_type      TEXT,
  size_bytes     BIGINT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Reactions ──────────────────────────────────────────────────────────────────

CREATE TABLE message_reactions (
  message_id  TEXT REFERENCES messages(message_id) ON DELETE CASCADE,
  user_id     TEXT REFERENCES users(user_id) ON DELETE CASCADE,
  emoji       TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id, emoji)
);

-- ── WhatsApp User Links ────────────────────────────────────────────────────────

CREATE TABLE user_whatsapp (
  user_id      TEXT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  phone        TEXT NOT NULL UNIQUE,  -- E.164 e.g. +919876543210
  verified_at  TIMESTAMPTZ,
  opted_in_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opted_out_at TIMESTAMPTZ           -- null = active
);

-- ── WhatsApp Message Tracking ──────────────────────────────────────────────────

CREATE TABLE whatsapp_messages (
  wa_message_id  TEXT PRIMARY KEY,   -- Meta's wamid
  user_id        TEXT REFERENCES users(user_id),
  direction      TEXT CHECK (direction IN ('outbound','inbound')),
  context_type   TEXT,               -- 'task_comment' | 'approval' | 'channel_message'
  context_id     TEXT,               -- task_id or message_id or channel_id
  body           TEXT,
  sent_at        TIMESTAMPTZ DEFAULT NOW(),
  delivered_at   TIMESTAMPTZ,
  read_at        TIMESTAMPTZ
);
```

### 4.2 Supabase Realtime

Enable Realtime on the `messages` table. Subscribe per `channel_id`:

```js
supabase
  .channel(`messages:${channelId}`)
  .on('postgres_changes', {
    event: 'INSERT', schema: 'public',
    table: 'messages',
    filter: `channel_id=eq.${channelId}`
  }, payload => setMessages(prev => [...prev, payload.new]))
  .subscribe()
```

Same pattern as existing `useRealtimeTasks` hook.

---

## 5. Backend Architecture

### 5.1 New Files

```
backend/
  routers/
    messaging.py          ← all messaging endpoints
    whatsapp_webhook.py   ← Meta webhook receiver + verification
  services/
    whatsapp_service.py   ← send_whatsapp(), send_whatsapp_text(), template helpers
```

### 5.2 Messaging Router — Endpoint Reference

```
GET    /api/channels
       → List user's channels with unread counts

POST   /api/channels
       → Create a channel or start a DM
       Body: { type, name?, project_id?, member_ids? }

GET    /api/channels/{channel_id}/messages
       → Paginated history, cursor-based, 50/page
       Params: before (cursor timestamp)

POST   /api/channels/{channel_id}/messages
       → Send a message
       Body: { body, parent_id?, attachment_ids? }
       Side-effects: @mention detection → send_push(kind="mention")

PATCH  /api/messages/{message_id}
       → Edit message body (own messages only, sets edited_at)

DELETE /api/messages/{message_id}
       → Soft delete (sets deleted_at, body replaced with "Message deleted")

POST   /api/messages/{message_id}/replies
       → Thread reply (alias for POST messages with parent_id set)

POST   /api/messages/{message_id}/reactions
       → Toggle reaction (add if not exists, remove if exists)
       Body: { emoji }

PATCH  /api/channels/{channel_id}/read
       → Update last_read_at = NOW() for current user

GET    /api/messages/unfurl?url=
       → Fetch OG metadata / task card data for link preview
```

### 5.3 WhatsApp Webhook Router

```
GET  /api/webhooks/whatsapp
     → Meta webhook verification (hub.mode, hub.challenge, hub.verify_token)

POST /api/webhooks/whatsapp
     → Receive inbound messages and status updates
     1. Verify HMAC-SHA256 signature (X-Hub-Signature-256 header)
     2. Parse entry[].changes[].value.messages[]
     3. Look up user by phone in user_whatsapp
     4. If message.context.id → reply threading (see §3.6)
     5. If button reply ("Approve"/"Reject") → route to approval handlers
     6. Always respond 200 immediately (process async)
```

### 5.4 Integration with Existing approval_router.py

Add at the end of `send_approval_notification()` — zero disruption to existing flow:

```python
# In approvals_router.py → send_approval_notification()
try:
    from services.whatsapp_service import send_whatsapp_approval_notification
    asyncio.ensure_future(
        send_whatsapp_approval_notification(
            pool, recipient_id, task_id, task_title, notification_type, notes
        )
    )
except Exception as exc:
    logger.warning("WhatsApp notification failed: %s", exc)
```

Same fire-and-forget pattern already used for push notifications.

### 5.5 Auto-Channel Creation

Hook into project creation (wherever a new `team` row is inserted). After insert:

```python
await pool.execute("""
    INSERT INTO channels (channel_id, org_id, type, project_id, name, created_by)
    VALUES ($1, $2, 'project', $2, $3, $4)
""", f"ch_{uuid.uuid4().hex[:12]}", team_id, team_name, created_by)

# Add all current team members
await pool.execute("""
    INSERT INTO channel_members (channel_id, user_id)
    SELECT $1, user_id FROM team_members WHERE team_id=$2 AND status='active'
""", channel_id, team_id)
```

---

## 6. Frontend Architecture

### 6.1 New Files

```
frontend/src/
  pages/
    MessagesPage.jsx              ← /messages route

  components/messaging/
    MessagingPanel.jsx            ← shared container
                                    Props: { channelId, mode: 'sidebar'|'full' }
    ChannelList.jsx               ← left rail (full mode only)
    MessageThread.jsx             ← scrollable message list, virtualized
    MessageItem.jsx               ← single message + reactions + thread toggle
    MessageComposer.jsx           ← input + file attach + @mention autocomplete
    ThreadDrawer.jsx              ← right-slide drawer for thread replies
    LinkUnfurl.jsx                ← task card / URL OG preview
    AttachmentChip.jsx            ← file attachment display (inline image / download chip)
    ReactionBar.jsx               ← emoji reaction row + add reaction button

  hooks/
    useMessages.js                ← Supabase Realtime subscription per channel
    useChannels.js                ← channel list + unread counts, polling fallback
```

### 6.2 Route Addition (App.js)

```jsx
// Add alongside existing routes, inside CONTEXT_ROUTES:
{ path: '/messages',    element: <MessagesPage /> },
{ path: '/messages/:channelId', element: <MessagesPage /> },
```

### 6.3 Sidebar Integration (ProjectBoardPage.jsx)

```jsx
// In project board header right slot:
<button className="k-iconbtn" onClick={() => setSidebarOpen(o => !o)}>
  <ChatIcon />
  {unreadCount > 0 && <span className="k-badge">{unreadCount}</span>}
</button>

// Board + sidebar layout:
<div className={`k-twocol ${sidebarOpen ? 'k-twocol--with-sidebar' : ''}`}>
  <KanbanView ... />
  {sidebarOpen && (
    <aside className="k-messaging-sidebar">
      <MessagingPanel channelId={projectChannelId} mode="sidebar" />
    </aside>
  )}
</div>
```

### 6.4 Nav Badge (AppShell)

`NAV_FULL` already supports `badge: 'unread'` (architecture_patterns.md). Wire total unread message count from `useChannels` to the Messages nav item — same mechanism as inbox count.

---

## 7. UI Patterns + Design Conventions

All new components follow the existing Kartavaya `k-*` design system.

### 7.1 Layout Classes Used

| Component | Classes |
|---|---|
| MessagesPage | `k-screen`, `k-twocol` |
| Channel list panel | `k-card`, `k-sidebar__section` |
| Message thread | `k-card`, `k-card__body` |
| Composer | `k-input`, `k-btn--primary`, `k-btn--ghost k-btn--sm` |
| Thread drawer | `k-drawer`, `k-drawer__head`, `k-drawer__body` |
| Attachment chip | `k-badge` variant |
| Nav item | `k-sidebar__item` with `badge: 'unread'` |

### 7.2 Tokens Used

```css
/* Message bubble — own message */
background: var(--k-primary);
color: white;
border-radius: var(--r-lg);

/* Message bubble — other */
background: var(--bg-soft);
color: var(--ink);
border-radius: var(--r-lg);

/* Unread dot */
background: var(--k-primary);

/* WhatsApp badge on message */
background: #25D366;   /* WhatsApp green — only place non-token color is acceptable */
color: white;

/* Timestamp / sender label */
color: var(--ink-3);
font-size: 11px;

/* Thread reply area */
border-left: 2px solid var(--rule-soft);
padding-left: var(--sp-3);
```

### 7.3 Bilingual Labels

All section headers follow the English + Sanskrit/Hindi pattern per Kartavaya convention:

| English | Sanskrit/Hindi |
|---|---|
| Messages | संवाद (Samvāda) |
| Channels | चैनल |
| Direct Messages | संदेश (Sandesh) |
| Threads | धागा (Dhāgā) |
| Pinned | पिन किया |
| WhatsApp Notifications | वार्ता (Vārtā) |
| Attachments | संलग्न (Sanlagn) |

### 7.4 `source` Badge

Messages posted via WhatsApp show a small badge on the message item:

```jsx
{message.source === 'whatsapp' && (
  <span className="k-badge k-badge--whatsapp" title="Sent via WhatsApp">
    <WhatsAppIcon size={10} /> WhatsApp
  </span>
)}
```

This is the only time the WhatsApp green (#25D366) appears in the UI.

### 7.5 PageHeader for MessagesPage

```jsx
<PageHeader
  kicker="COMMUNICATION"
  title="Messages"
  sanskrit="संवाद"
  lede="Channels, threads, and direct messages for your team."
  right={<button className="k-btn k-btn--primary k-btn--sm">New Message</button>}
/>
```

---

## 8. Phased Delivery Plan

### Phase 1 — Core Messaging Foundation · आधार
**Duration: 2–3 weeks**

| # | Task | Owner |
|---|---|---|
| 1.1 | DB migration — all messaging tables | Backend |
| 1.2 | Auto-create project channels on team creation | Backend |
| 1.3 | `backend/routers/messaging.py` — all endpoints | Backend |
| 1.4 | @mention detection → `send_push(kind="mention")` | Backend |
| 1.5 | `useMessages` Realtime hook | Frontend |
| 1.6 | `useChannels` hook with unread counts | Frontend |
| 1.7 | `MessageThread` + `MessageItem` + `MessageComposer` | Frontend |
| 1.8 | `MessagesPage` + `/messages` route in App.js | Frontend |
| 1.9 | `ChannelList` left rail | Frontend |
| 1.10 | Nav badge wired to unread count | Frontend |

**Done criteria:** Team members can send messages in a project channel, see them update in realtime, and receive push notifications on @mentions.

---

### Phase 2 — Sidebar + Files + Threads · विस्तार
**Duration: 1 week**

| # | Task |
|---|---|
| 2.1 | Sidebar panel in `ProjectBoardPage` — toggle + `k-twocol` resize |
| 2.2 | `ThreadDrawer` — thread replies |
| 2.3 | Emoji reactions + `ReactionBar` |
| 2.4 | File attachments via R2 — reuse `uploads.py`, `AttachmentChip` |
| 2.5 | Task link unfurl — `/api/messages/unfurl`, `LinkUnfurl` component |
| 2.6 | Message edit + soft delete |
| 2.7 | `PATCH /api/channels/{id}/read` → unread count clears on open |

**Done criteria:** From a project board, open the sidebar chat, attach a file, reply in a thread. Unread badge clears on open.

---

### Phase 3 — WhatsApp Outbound · सूचना
**Duration: 1–2 weeks**

| # | Task |
|---|---|
| 3.1 | Choose provider: Interakt / Wati BSP |
| 3.2 | `backend/services/whatsapp_service.py` — send + template helpers |
| 3.3 | Submit all 6 Meta templates for approval *(do this Day 1 of Phase 3)* |
| 3.4 | `user_whatsapp` table + OTP opt-in flow |
| 3.5 | Profile Settings → WhatsApp Notifications section |
| 3.6 | Wire into `send_approval_notification()` (fire-and-forget) |
| 3.7 | Wire into `fan_out_push()` for mentions and DMs |
| 3.8 | `whatsapp_messages` table for outbound tracking |

**Done criteria:** An approval request arrives on the approver's WhatsApp number. Opt-in/opt-out works in settings.

---

### Phase 4 — WhatsApp Inbound + Approvals · प्रतिक्रिया
**Duration: 2 weeks**

| # | Task |
|---|---|
| 4.1 | `backend/routers/whatsapp_webhook.py` — receiver + HMAC verification |
| 4.2 | Reply threading — inbound reply routed to task/channel via `wa_message_id` lookup |
| 4.3 | Approval button flow — Approve button → `approve_task()` |
| 4.4 | Reject button → session state → collect reason → `reject_task()` |
| 4.5 | WhatsApp source badge on messages posted via WhatsApp |
| 4.6 | Graceful fallback for uncontexted inbound messages |

**Done criteria:** Approver receives WhatsApp message, taps Approve → task moves to approved in Kartavaya. Reply to task notification → comment appears in task channel with WhatsApp badge.

---

### Phase 5 — Google Workspace + Polish · परिष्कार
**Duration: 2 weeks**

| # | Task |
|---|---|
| 5.1 | Google Drive file picker in `MessageComposer` |
| 5.2 | Google Meet link generation (button in channel header → Meet link in message) |
| 5.3 | Link unfurl for Figma, Loom, GitHub, Google Docs |
| 5.4 | Per-notification-type WhatsApp toggles in settings |
| 5.5 | Channel search (filter by name in left rail) |
| 5.6 | Message search within a channel (`ILIKE` query, no full-text index needed at this scale) |
| 5.7 | Notification preferences for WhatsApp in existing `notification_prefs` table |

---

## 9. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Meta template approval delayed (1–3 days) | Medium | Blocks Phase 3 go-live | Submit all templates Day 1 of Phase 3; proceed with other tasks in parallel |
| WhatsApp 24h session window for free-text replies | High | Users can't text bot freely | Outbound templates bypass this window; inbound replies always fall within 24h since user replies to our message |
| Supabase Realtime connection scaling | Low | Messages lag under load | Messages piggybacks on existing Realtime usage; review connection limits before launch |
| R2 storage cost for large files | Low | Unexpected bills | 25MB file cap enforced in `MessageComposer`; R2 free tier is 10GB — monitor in Cloudflare dashboard |
| WhatsApp reject flow requires 2 messages (button + reason) | Medium | UX friction | Implemented in Phase 4 via `whatsapp_sessions` table — no Redis dependency |
| Interakt/Wati BSP pricing at scale | Medium | Cost | Migration path to Meta Cloud API direct already planned; trigger at 1,000 conversations/month |

---

## 10. Out of Scope

These are explicitly not being built:

- ❌ Slack integration or Slack workspace sync
- ❌ WhatsApp group creation or management
- ❌ Voice or video calling (use Google Meet links instead)
- ❌ Scheduled or broadcast messages via WhatsApp
- ❌ WhatsApp bot commands to create tasks or navigate the app (Phase 2 candidate)
- ❌ Read receipts per-user in project channels (only DMs get this)
- ❌ Message translation (bilingual UI is a CSS concern, not a translation feature)
- ❌ Microsoft Teams integration (low priority; add to Phase 5+ if demand exists)

---

## 11. Effort Estimate

| Phase | Backend | Frontend | Total |
|---|---|---|---|
| 1 — Core Messaging | 4 days | 5 days | ~2 weeks |
| 2 — Sidebar + Files | 1 day | 4 days | ~1 week |
| 3 — WhatsApp Outbound | 3 days | 1 day | ~1 week |
| 4 — WhatsApp Inbound | 4 days | 1 day | ~1.5 weeks |
| 5 — Polish + Google Workspace | 2 days | 4 days | ~1.5 weeks |
| **Total** | **14 days** | **15 days** | **~7 weeks** |

*Assumes one backend and one frontend developer working in parallel.*

---

*Document source of truth: `docs/MESSAGING_WHATSAPP_PLAN.md`*  
*Next action: Begin Phase 1 DB migration → `backend/routers/messaging.py`*
