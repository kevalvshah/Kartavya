#!/usr/bin/env python3
"""
seed.py — Full-flow seed for the 10x lifecycle test.
Runs the complete task lifecycle once for each of 10 iterations:
  Admin creates project + team -> Member + Client added
  Client creates task -> Admin approves -> Member logs time (10x start/stop)
  -> Member comments (@mention Admin) -> Client reviews and approves
  -> Task moves to Done

Usage:
  DATABASE_URL=postgresql://... python seed.py

Safe to re-run (ON CONFLICT DO NOTHING everywhere except time entries
which are appended).
"""
import asyncio
import os
import uuid
import random
import json
from datetime import datetime, timedelta, timezone

import asyncpg

DATABASE_URL = os.environ["DATABASE_URL"]

def uid(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"

def now() -> datetime:
    return datetime.now(timezone.utc)

COL_NAMES = [
    ("To Do",       "#0082c6", 0, False),
    ("In Progress", "#03a1b6", 1, False),
    ("In Review",   "#8b5cf6", 2, False),
    ("Approval",    "#f59e0b", 3, False),
    ("Done",        "#05b7aa", 4, True),
]


async def seed():
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        print("\n=== Kartavya full-flow seed (10x lifecycle) ===")

        # ── 1. Core users ──────────────────────────────────────────────────────
        admin_id  = "seed_admin_001"
        member_id = "seed_member_001"
        client_id = "seed_client_001"

        users = [
            (admin_id,  "admin@kartavya.dev",  "Admin User",  "admin"),
            (member_id, "member@kartavya.dev", "Member User", "member"),
            (client_id, "client@kartavya.dev", "Client User", "client"),
        ]
        for u_id, email, name, role in users:
            await conn.execute("""
                INSERT INTO users (user_id, email, name, full_name, role, password_hash)
                VALUES ($1,$2,$3,$3,$4,$5)
                ON CONFLICT (user_id) DO UPDATE SET role=$4
            """, u_id, email, name, role,
                "$2b$12$placeholder_hash_for_seed_data_only")
        print(f"  users: 3 upserted (admin / member / client)")

        # ── 2. Project + team ──────────────────────────────────────────────────
        team_id = "seed_lifecycle_team"
        await conn.execute("""
            INSERT INTO teams (team_id, name, created_by)
            VALUES ($1, 'Lifecycle Test Project', $2)
            ON CONFLICT (team_id) DO NOTHING
        """, team_id, admin_id)

        for u_id, role in [(admin_id, "owner"), (member_id, "member"), (client_id, "client")]:
            mem_id = uid("mem")
            email  = {admin_id: "admin@kartavya.dev",
                      member_id: "member@kartavya.dev",
                      client_id: "client@kartavya.dev"}[u_id]
            await conn.execute("""
                INSERT INTO team_members (member_id, team_id, email, user_id, role, status)
                VALUES ($1,$2,$3,$4,$5,'active')
                ON CONFLICT DO NOTHING
            """, mem_id, team_id, email, u_id, role)
            await conn.execute("""
                INSERT INTO project_assignments (assignment_id, team_id, user_id, role, assigned_by)
                VALUES ($1,$2,$3,$4,$5)
                ON CONFLICT (team_id, user_id) DO UPDATE SET role=$4
            """, uid("assign"), team_id, u_id, role, admin_id)
        print(f"  team + 3 members seeded")

        # ── 3. Columns ─────────────────────────────────────────────────────────
        col_map = {}  # name -> column_id
        existing_cols = await conn.fetch(
            "SELECT column_id, name FROM project_columns WHERE team_id=$1", team_id
        )
        for row in existing_cols:
            col_map[row["name"]] = row["column_id"]

        for name, color, order, is_done in COL_NAMES:
            if name not in col_map:
                cid = uid("col")
                await conn.execute("""
                    INSERT INTO project_columns (column_id, team_id, name, color, sort_order, is_done)
                    VALUES ($1,$2,$3,$4,$5,$6)
                    ON CONFLICT DO NOTHING
                """, cid, team_id, name, color, order, is_done)
                col_map[name] = cid
        print(f"  columns: {len(col_map)} ready")

        col_todo     = col_map["To Do"]
        col_progress = col_map["In Progress"]
        col_done     = col_map["Done"]

        # ── 4. 10x lifecycle ───────────────────────────────────────────────────
        all_task_ids = []
        for iteration in range(1, 11):
            print(f"\n  --- Iteration {iteration}/10 ---")

            # Phase 2.1: Client creates task
            task_id = uid("task")
            title   = f"Lifecycle Task #{iteration} — {now().strftime('%H:%M:%S')}"
            await conn.execute("""
                INSERT INTO tasks (
                    task_id, team_id, column_id,
                    created_by_user_id, assigned_by_user_id, created_by_name,
                    title, description, status, priority,
                    assignee_user_ids, due_at, sort_order,
                    tags, attachments, custom_fields, subtasks,
                    recurrence_rule, recurrence_interval
                ) VALUES (
                    $1,$2,$3,
                    $4,$4,$5,
                    $6,$7,'todo','medium',
                    $8::text[], $9, $10,
                    '{"seed"}'::text[], '[]'::jsonb, '{}'::jsonb, '[]'::jsonb,
                    'none', 1
                )
                ON CONFLICT (task_id) DO NOTHING
            """,
                task_id, team_id, col_todo,
                client_id, "Client User",
                title, f"Seed task for lifecycle iteration {iteration}.",
                [member_id], now() + timedelta(days=7), iteration)

            # Log created event
            await conn.execute("""
                INSERT INTO activity_events (event_id, task_id, team_id, actor_id, type, data)
                VALUES ($1,$2,$3,$4,'created',$5::jsonb)
                ON CONFLICT DO NOTHING
            """, uid("evt"), task_id, team_id, client_id, json.dumps({"title": title}))

            # Add client to task_clients so they can comment/approve
            await conn.execute("""
                INSERT INTO task_clients (id, task_id, user_id, invited_by)
                VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING
            """, uid("tc"), task_id, client_id, admin_id)

            print(f"    ✅ Task created by client: {task_id}")

            # Phase 2.2: Admin approves -> move to To Do
            await conn.execute("""
                UPDATE tasks
                SET approval_status='approved', approved_by=$1,
                    approval_decided_at=NOW(), column_id=$2, status='todo', updated_at=NOW()
                WHERE task_id=$3
            """, admin_id, col_todo, task_id)

            await conn.execute("""
                INSERT INTO activity_events (event_id, task_id, team_id, actor_id, type, data)
                VALUES ($1,$2,$3,$4,'approval_granted',$5::jsonb)
                ON CONFLICT DO NOTHING
            """, uid("evt"), task_id, team_id, admin_id,
                json.dumps({"status": "approved", "by": "admin"}))
            print(f"    ✅ Admin approved")

            # Phase 2.3: Member starts timer -> moves to In Progress -> adds comment
            await conn.execute("""
                UPDATE tasks SET column_id=$1, status='in_progress', updated_at=NOW()
                WHERE task_id=$2
            """, col_progress, task_id)

            # 10x timer start/stop
            for t in range(1, 11):
                entry_id = uid("te")
                mins     = random.randint(3, 15)
                started  = now() - timedelta(minutes=mins + random.randint(0, 5))
                ended    = started + timedelta(minutes=mins)
                await conn.execute("""
                    INSERT INTO time_entries
                    (entry_id, task_id, user_id, started_at, ended_at, minutes, description)
                    VALUES ($1,$2,$3,$4,$5,$6,$7)
                    ON CONFLICT DO NOTHING
                """, entry_id, task_id, member_id, started, ended, mins,
                    f"Timer run {t} of 10 (iteration {iteration})")

                # log both events
                for etype, edata in [
                    ("timer_started", {"entry_id": entry_id}),
                    ("timer_stopped", {"entry_id": entry_id, "minutes": mins}),
                ]:
                    await conn.execute("""
                        INSERT INTO activity_events
                        (event_id, task_id, team_id, actor_id, type, data)
                        VALUES ($1,$2,$3,$4,$5,$6::jsonb)
                        ON CONFLICT DO NOTHING
                    """, uid("evt"), task_id, team_id, member_id,
                        etype, json.dumps(edata))

            print(f"    ✅ Timer: 10 start/stop cycles logged")

            # Member adds comment (@mention admin)
            cmt_id = uid("cmt")
            await conn.execute("""
                INSERT INTO task_comments (comment_id, task_id, user_id, body)
                VALUES ($1,$2,$3,$4)
                ON CONFLICT DO NOTHING
            """, cmt_id, task_id, member_id,
                f"@Admin User — work complete for iteration {iteration}. Ready for review.")

            await conn.execute("""
                INSERT INTO activity_events (event_id, task_id, team_id, actor_id, type, data)
                VALUES ($1,$2,$3,$4,'commented',$5::jsonb)
                ON CONFLICT DO NOTHING
            """, uid("evt"), task_id, team_id, member_id,
                json.dumps({"preview": "work complete — ready for review"}))
            print(f"    ✅ Member commented with @mention")

            # Phase 2.4: Client adds a comment
            cmt2_id = uid("cmt")
            await conn.execute("""
                INSERT INTO task_comments (comment_id, task_id, user_id, body)
                VALUES ($1,$2,$3,$4)
                ON CONFLICT DO NOTHING
            """, cmt2_id, task_id, client_id,
                f"Client feedback for iteration {iteration}: looks great!")

            await conn.execute("""
                INSERT INTO activity_events (event_id, task_id, team_id, actor_id, type, data)
                VALUES ($1,$2,$3,$4,'commented',$5::jsonb)
                ON CONFLICT DO NOTHING
            """, uid("evt"), task_id, team_id, client_id,
                json.dumps({"preview": "Client feedback: looks great"}))
            print(f"    ✅ Client commented")

            # Phase 2.5 + 2.6: Client approves -> Done
            await conn.execute("""
                UPDATE tasks
                SET approval_status='approved', approved_by=$1,
                    approval_decided_at=NOW(), column_id=$2,
                    status='done', completed_at=NOW(), completed_by_user_id=$1,
                    updated_at=NOW()
                WHERE task_id=$3
            """, client_id, col_done, task_id)

            await conn.execute("""
                INSERT INTO activity_events (event_id, task_id, team_id, actor_id, type, data)
                VALUES ($1,$2,$3,$4,'client_approved',$5::jsonb)
                ON CONFLICT DO NOTHING
            """, uid("evt"), task_id, team_id, client_id,
                json.dumps({"column": "Done", "status": "done"}))
            print(f"    ✅ Client approved -> Done")

            all_task_ids.append(task_id)

        # ── 5. Dashboard widget config ─────────────────────────────────────────
        dash_id  = "seed_lifecycle_dash"
        widgets  = [
            {"id": "count_todo",   "type": "count",     "config": {"team_id": team_id, "status": "todo",        "label": "To Do"}},
            {"id": "count_done",   "type": "count",     "config": {"team_id": team_id, "status": "done",        "label": "Done"}},
            {"id": "count_prog",   "type": "count",     "config": {"team_id": team_id, "status": "in_progress",  "label": "In Progress"}},
            {"id": "chart_main",   "type": "chart",     "config": {"team_id": team_id}},
            {"id": "my_work",      "type": "my_work",   "config": {}},
            {"id": "deadlines",    "type": "deadlines", "config": {"team_id": team_id}},
            {"id": "time_report",  "type": "time",      "config": {"team_id": team_id}},
        ]
        await conn.execute("""
            INSERT INTO dashboards (dashboard_id, user_id, name, widgets)
            VALUES ($1,$2,'Lifecycle Dashboard',$3::jsonb)
            ON CONFLICT (dashboard_id) DO UPDATE SET widgets=$3::jsonb
        """, dash_id, admin_id, json.dumps(widgets))
        print(f"\n  dashboard seeded")

        # ── 6. Summary ─────────────────────────────────────────────────────────
        task_count   = await conn.fetchval(
            "SELECT COUNT(*) FROM tasks WHERE team_id=$1", team_id)
        comment_count = await conn.fetchval(
            "SELECT COUNT(*) FROM task_comments WHERE task_id=ANY($1::text[])",
            all_task_ids)
        time_count    = await conn.fetchval(
            "SELECT COUNT(*) FROM time_entries WHERE task_id=ANY($1::text[])",
            all_task_ids)
        activity_count = await conn.fetchval(
            "SELECT COUNT(*) FROM activity_events WHERE team_id=$1", team_id)

        print(f"""
✅ Lifecycle seed complete!
   Team           : {team_id}
   Tasks          : {task_count} (10 lifecycle + any prior)
   Comments       : {comment_count}
   Time entries   : {time_count}  (10 tasks × 10 timer cycles = 100)
   Activity events: {activity_count}

Login credentials (password not set — use admin panel to reset):
   admin@kartavya.dev   (admin)
   member@kartavya.dev  (member)
   client@kartavya.dev  (client)
""")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed())
