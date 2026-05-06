#!/usr/bin/env python3
"""
seed.py — Insert 50 dummy records per major table for Playwright testing.

Usage:
  DATABASE_URL=postgresql://... python seed.py

Safe to run multiple times — uses ON CONFLICT DO NOTHING everywhere.
Creates:
  - 5 users  (seed_user_001 … 005)
  - 2 teams  (seed_team_001, seed_team_002)
  - team_members + project_assignments for each user/team
  - 5 columns per team  (To Do, In Progress, In Review, Approval, Done)
  - 50 tasks spread across both teams
  - 50 comments (one per task)
  - 50 activity_events
  - 10 automations (5 per team)
  - 2 dashboards
  - 10 time_entries
"""
import asyncio
import os
import uuid
import random
from datetime import datetime, timedelta, timezone

import asyncpg

DATABASE_URL = os.environ["DATABASE_URL"]

def uid(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"

def now() -> datetime:
    return datetime.now(timezone.utc)

TITLES = [
    "Design landing page hero section",
    "Implement user authentication flow",
    "Set up CI/CD pipeline on Railway",
    "Write API documentation",
    "Fix mobile responsive layout bugs",
    "Integrate Stripe payment gateway",
    "Build admin dashboard",
    "Create email notification templates",
    "Optimise database queries",
    "Add dark mode support",
    "Review Q3 campaign brief",
    "Update brand guidelines",
    "Record product demo video",
    "Conduct user interviews (5 sessions)",
    "Analyse heatmap data from Hotjar",
    "Set up Cloudflare R2 bucket",
    "Write changelog for v2 release",
    "QA test checkout flow on iOS",
    "Deploy staging environment",
    "Migrate legacy data to Postgres",
    "Build kanban drag-and-drop",
    "Add @mention autocomplete",
    "Implement file upload to R2",
    "Create Playwright test suite",
    "Write seed data script",
    "Configure Vercel preview deployments",
    "Fix ESLint warnings in App.js",
    "Add activity feed pagination",
    "Build automation rule engine",
    "Create dashboard widget grid",
    "Design system token refresh",
    "Accessibility audit (WCAG 2.1 AA)",
    "Security pen-test remediation",
    "Rate limiting on API endpoints",
    "Add CSV export for time reports",
    "Implement subtask progress bar",
    "Set up error monitoring (Sentry)",
    "Cache team members in Redis",
    "Build role-based access control",
    "Localisation — French translations",
    "Performance audit (Lighthouse)",
    "Migrate to React Router v7",
    "Replace base64 uploads with R2",
    "Build invite-only onboarding flow",
    "Create client portal board view",
    "Add real-time notifications (WS)",
    "Write unit tests for activity_logger",
    "Refactor automation_engine service",
    "Update CORS policy for staging",
    "Final pre-launch checklist",
]

DESCS = [
    "Needs to be done before Friday stand-up.",
    "Blocked on design approval — ping Priya.",
    "See Notion doc for full requirements.",
    "Important for the Q2 OKR milestone.",
    "Low-hanging fruit — good for a new joiner.",
    None, None, None,  # some tasks have no description
]

PRIORITIES = ["low", "medium", "high", "urgent"]
STATUSES   = ["todo", "in_progress", "in_review", "done"]
COL_NAMES  = [("To Do", "#0082c6", False), ("In Progress", "#03a1b6", False),
               ("In Review", "#8b5cf6", False), ("Approval", "#f59e0b", False),
               ("Done", "#05b7aa", True)]


async def seed():
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        print("\n=== Kartavya seed.py ===")

        # ── 1. Users ──────────────────────────────────────────────────────────
        user_ids = []
        for i in range(1, 6):
            uid_val = f"seed_user_{i:03d}"
            email   = f"seed{i:03d}@kartavya.dev"
            name    = ["Priya Sharma", "Keval Shah", "Lena Müller", "James Okafor", "Sofia Reyes"][i - 1]
            await conn.execute("""
                INSERT INTO users (user_id, email, name, full_name, role, password_hash)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (user_id) DO NOTHING
            """, uid_val, email, name, name,
                "admin" if i == 1 else "member",
                "$2b$12$placeholder_hash_for_seed_data_only")
            user_ids.append(uid_val)
        print(f"  users: {len(user_ids)} seeded")

        # ── 2. Teams ──────────────────────────────────────────────────────────
        team_ids = []
        for i, tname in enumerate(["Kartavya Core", "Client Projects"], 1):
            tid = f"seed_team_{i:03d}"
            await conn.execute("""
                INSERT INTO teams (team_id, name, created_by)
                VALUES ($1, $2, $3)
                ON CONFLICT (team_id) DO NOTHING
            """, tid, tname, user_ids[0])
            team_ids.append(tid)
        print(f"  teams: {len(team_ids)} seeded")

        # ── 3. Team members + assignments ─────────────────────────────────────
        for tid in team_ids:
            for i, uid_val in enumerate(user_ids):
                role = "owner" if i == 0 else "member"
                mem_id = uid("mem")
                email  = f"seed{i+1:03d}@kartavya.dev"
                await conn.execute("""
                    INSERT INTO team_members (member_id, team_id, email, user_id, role, status)
                    VALUES ($1, $2, $3, $4, $5, 'active')
                    ON CONFLICT DO NOTHING
                """, mem_id, tid, email, uid_val, role)
                assign_id = uid("assign")
                await conn.execute("""
                    INSERT INTO project_assignments (assignment_id, team_id, user_id, role, assigned_by)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (team_id, user_id) DO NOTHING
                """, assign_id, tid, uid_val, role, user_ids[0])
        print("  team_members + project_assignments: seeded")

        # ── 4. Columns (5 per team) ───────────────────────────────────────────
        col_ids = {}  # team_id -> [col_id, ...]
        for tid in team_ids:
            col_ids[tid] = []
            for order, (cname, color, is_done) in enumerate(COL_NAMES):
                cid = uid("col")
                await conn.execute("""
                    INSERT INTO project_columns (column_id, team_id, name, color, sort_order, is_done)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT DO NOTHING
                """, cid, tid, cname, color, order, is_done)
                col_ids[tid].append(cid)
        print("  columns: seeded")

        # ── 5. Tasks (50 total) ───────────────────────────────────────────────
        task_ids = []
        for i, title in enumerate(TITLES):
            tid = team_ids[i % 2]
            cols = col_ids[tid]
            col_idx = i % len(cols)
            col = cols[col_idx]
            status = STATUSES[col_idx % len(STATUSES)]
            priority = PRIORITIES[i % len(PRIORITIES)]
            desc = DESCS[i % len(DESCS)]
            assignees = [user_ids[i % len(user_ids)]]
            due = now() + timedelta(days=random.randint(-5, 30))
            task_id = uid("task")
            await conn.execute("""
                INSERT INTO tasks (
                    task_id, team_id, column_id, created_by_user_id, assigned_by_user_id,
                    created_by_name, title, description, status, priority,
                    assignee_user_ids, due_at, sort_order,
                    tags, attachments, custom_fields, subtasks,
                    recurrence_rule, recurrence_interval
                ) VALUES (
                    $1, $2, $3, $4, $4,
                    $5, $6, $7, $8, $9,
                    $10::text[], $11, $12,
                    $13::text[], '[]'::jsonb, '{}'::jsonb, '[]'::jsonb,
                    'none', 1
                )
                ON CONFLICT (task_id) DO NOTHING
            """,
                task_id, tid, col, user_ids[0],
                "Priya Sharma", title, desc, status, priority,
                assignees, due, i,
                ["v2", "seed"] if i % 3 == 0 else ["seed"])
            task_ids.append(task_id)
        print(f"  tasks: {len(task_ids)} seeded")

        # ── 6. Comments (1 per task = 50) ─────────────────────────────────────
        for i, task_id in enumerate(task_ids):
            cmt_id = uid("cmt")
            author = user_ids[(i + 1) % len(user_ids)]
            bodies = [
                "Looks good — merging after review.",
                "Blocked on design. Pinging @priya.",
                "Done. Deployed to staging.",
                "Can we move this to next sprint?",
                "Updated the Notion doc with context.",
            ]
            await conn.execute("""
                INSERT INTO task_comments (comment_id, task_id, user_id, body)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT DO NOTHING
            """, cmt_id, task_id, author, bodies[i % len(bodies)])
        print("  comments: 50 seeded")

        # ── 7. Activity events (50) ───────────────────────────────────────────
        import json
        for i, task_id in enumerate(task_ids):
            evt_id = uid("evt")
            etype = ["created", "status_changed", "commented", "assigned", "field_changed"][i % 5]
            data = {}
            if etype == "status_changed":
                data = {"from": "todo", "to": "in_progress"}
            elif etype == "assigned":
                data = {"added": [user_ids[i % len(user_ids)]], "removed": []}
            tid = team_ids[i % 2]
            await conn.execute("""
                INSERT INTO activity_events (event_id, task_id, team_id, actor_id, type, data)
                VALUES ($1, $2, $3, $4, $5, $6::jsonb)
                ON CONFLICT DO NOTHING
            """, evt_id, task_id, tid, user_ids[0], etype, json.dumps(data))
        print("  activity_events: 50 seeded")

        # ── 8. Automations (5 per team = 10) ──────────────────────────────────
        import json as _json
        auto_rules = [
            ("Notify on done",     "status_changed",   "send_notification", {"message": "Task moved to Done"}),
            ("Assign on create",   "task_created",     "assign_to",         {"user_id": user_ids[0]}),
            ("Email on overdue",   "task_overdue",     "send_email",        {"message": "Task is overdue"}),
            ("Comment on approve", "approval_status_changed", "post_comment", {"message": "Approved!"}),
            ("Set field on done",  "status_changed",   "set_field",         {"field": "priority", "value": "low"}),
        ]
        for tid in team_ids:
            for name, trigger_evt, action_type, action_cfg in auto_rules:
                auto_id = uid("auto")
                await conn.execute("""
                    INSERT INTO automations (
                        automation_id, team_id, name, trigger, actions, enabled, run_count
                    ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, true, $6)
                    ON CONFLICT DO NOTHING
                """,
                    auto_id, tid, f"{name} ({tid[-3:]})",
                    _json.dumps({"event": trigger_evt, "filters": []}),
                    _json.dumps([{"type": action_type, "config": action_cfg}]),
                    random.randint(0, 42))
        print("  automations: 10 seeded")

        # ── 9. Dashboards (1 per user for first 2 users) ──────────────────────
        for uid_val in user_ids[:2]:
            dash_id = uid("dash")
            widgets = [
                {"id": "count_todo",   "type": "count",     "config": {"team_id": team_ids[0], "status": "todo",  "label": "To Do"}},
                {"id": "count_done",   "type": "count",     "config": {"team_id": team_ids[0], "status": "done",  "label": "Done"}},
                {"id": "chart_main",   "type": "chart",     "config": {"team_id": team_ids[0]}},
                {"id": "my_work_main", "type": "my_work",   "config": {}},
                {"id": "deadlines_1",  "type": "deadlines", "config": {"team_id": team_ids[0]}},
            ]
            await conn.execute("""
                INSERT INTO dashboards (dashboard_id, user_id, name, widgets)
                VALUES ($1, $2, $3, $4::jsonb)
                ON CONFLICT DO NOTHING
            """, dash_id, uid_val, "My Dashboard", _json.dumps(widgets))
        print("  dashboards: 2 seeded")

        # ── 10. Time entries (10) ─────────────────────────────────────────────
        for i in range(10):
            entry_id = uid("te")
            task_id  = task_ids[i]
            mins = random.randint(15, 240)
            started = now() - timedelta(minutes=mins + random.randint(0, 60))
            ended   = started + timedelta(minutes=mins)
            await conn.execute("""
                INSERT INTO time_entries (
                    entry_id, task_id, user_id, started_at, ended_at, minutes, description
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT DO NOTHING
            """,
                entry_id, task_id, user_ids[i % len(user_ids)],
                started, ended, mins,
                f"Seed time entry {i+1}")
        print("  time_entries: 10 seeded")

        print("\n✅ Seed complete!")
        print(f"   Users : {', '.join(user_ids)}")
        print(f"   Teams : {', '.join(team_ids)}")
        print(f"   Tasks : {len(task_ids)}")
        print("\nLogin credentials (all share same hash — set real passwords via admin panel):")
        for i in range(1, 6):
            print(f"   seed{i:03d}@kartavya.dev  (role: {'admin' if i==1 else 'member'})")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed())
