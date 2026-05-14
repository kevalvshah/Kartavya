#!/usr/bin/env python3
"""
seed.py — Full-flow seed for the 10x lifecycle test + Training Academy (100 tasks).

Lifecycle (10×):
  Admin creates project + team -> Member + Client added
  Client creates task -> Admin approves -> Member logs time (10x start/stop)
  -> Member comments (@mention Admin) -> Client reviews and approves
  -> Task moves to Done

Training Academy (`seed_training_100`):
  Re-seedable: deletes prior training team data, then creates 100 varied tasks
  (priorities, columns, attachments, owner vs client approval states, one running
  timer + many completed timers, custom fields + values). Dashboard widgets include
  this project for admin@kartavya.dev.

Usage:
  DATABASE_URL=postgresql://... python seed.py

Safe to re-run: lifecycle uses ON CONFLICT DO NOTHING on tasks; training team is
wiped and recreated each run for a clean 100-task dataset.
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

# Stable IDs for re-runnable training dataset
TRAINING_TEAM_ID = "seed_training_100"
TRAIN_TASK_PREFIX = "train_task_"

# Public dummy files (no auth) for attachment UI / download tests
DUMMY_ATTACHMENTS = [
    {"name": "Training-Brief.pdf", "url": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"},
    {"name": "Sample-Image.jpg", "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/320px-Cat03.jpg"},
    {"name": "Release-Notes.txt", "url": "https://raw.githubusercontent.com/github/gitignore/main/Python.gitignore"},
]


async def wipe_training_team(conn, team_id: str) -> None:
    """Remove training project and all dependent rows (idempotent)."""
    try:
        await conn.execute(
            """
            DELETE FROM mentions WHERE comment_id IN (
              SELECT c.comment_id FROM task_comments c
              INNER JOIN tasks t ON t.task_id = c.task_id WHERE t.team_id = $1
            )
            """,
            team_id,
        )
    except asyncpg.exceptions.UndefinedTableError:
        pass  # mentions table optional
    await conn.execute(
        "DELETE FROM task_comments WHERE task_id IN (SELECT task_id FROM tasks WHERE team_id=$1)",
        team_id,
    )
    await conn.execute(
        "DELETE FROM time_entries WHERE task_id IN (SELECT task_id FROM tasks WHERE team_id=$1)",
        team_id,
    )
    await conn.execute(
        "DELETE FROM field_values WHERE task_id IN (SELECT task_id FROM tasks WHERE team_id=$1)",
        team_id,
    )
    await conn.execute(
        "DELETE FROM task_clients WHERE task_id IN (SELECT task_id FROM tasks WHERE team_id=$1)",
        team_id,
    )
    await conn.execute("DELETE FROM activity_events WHERE team_id=$1", team_id)
    await conn.execute("DELETE FROM tasks WHERE team_id=$1", team_id)
    await conn.execute("DELETE FROM field_definitions WHERE team_id=$1", team_id)
    await conn.execute("DELETE FROM saved_views WHERE team_id=$1", team_id)
    await conn.execute("DELETE FROM automations WHERE team_id=$1", team_id)
    await conn.execute("DELETE FROM approvals WHERE team_id=$1", team_id)
    await conn.execute("DELETE FROM project_columns WHERE team_id=$1", team_id)
    await conn.execute("DELETE FROM project_assignments WHERE team_id=$1", team_id)
    await conn.execute("DELETE FROM team_members WHERE team_id=$1", team_id)
    await conn.execute("DELETE FROM teams WHERE team_id=$1", team_id)


def training_slot(i: int) -> tuple[str, str]:
    """Return (column_name, task_status) for task index 0..99."""
    if i < 22:
        return "To Do", "todo"
    if i < 44:
        return "In Progress", "in_progress"
    if i < 62:
        return "In Review", "in_review"
    if i < 72:
        return "Approval", "in_progress"
    return "Done", "done"


async def seed_training_academy(conn, admin_id: str, member_id: str, client_id: str) -> list[str]:
    """
    One project with 100 tasks: mixed priorities, attachments, approvals, timers,
    custom field values, comments. Dashboard widgets reference TRAINING_TEAM_ID.
    """
    print("\n=== Training & QA Academy (100 tasks) ===")
    await wipe_training_team(conn, TRAINING_TEAM_ID)

    await conn.execute(
        """
        INSERT INTO teams (team_id, name, created_by)
        VALUES ($1, 'Training & QA Academy (100 tasks)', $2)
        """,
        TRAINING_TEAM_ID,
        admin_id,
    )

    for u_id, role, email in [
        (admin_id, "owner", "admin@kartavya.dev"),
        (member_id, "member", "member@kartavya.dev"),
        (client_id, "client", "client@kartavya.dev"),
    ]:
        mem_id = uid("mem")
        await conn.execute(
            """
            INSERT INTO team_members (member_id, team_id, email, user_id, role, status)
            VALUES ($1,$2,$3,$4,$5,'active')
            """,
            mem_id,
            TRAINING_TEAM_ID,
            email,
            u_id,
            role,
        )
        await conn.execute(
            """
            INSERT INTO project_assignments (assignment_id, team_id, user_id, role, assigned_by)
            VALUES ($1,$2,$3,$4,$5)
            """,
            uid("assign"),
            TRAINING_TEAM_ID,
            u_id,
            role,
            admin_id,
        )

    col_map: dict[str, str] = {}
    for name, color, order, is_done in COL_NAMES:
        cid = uid("col")
        await conn.execute(
            """
            INSERT INTO project_columns (column_id, team_id, name, color, sort_order, is_done)
            VALUES ($1,$2,$3,$4,$5,$6)
            """,
            cid,
            TRAINING_TEAM_ID,
            name,
            color,
            order,
            is_done,
        )
        col_map[name] = cid

    # Custom fields (valid API types) for board / FieldRenderer tests
    fld_risk = "fld_train_risk"
    fld_hours = "fld_train_hours"
    fld_owner = "fld_train_owner"
    fld_due_custom = "fld_train_reviewdt"
    fld_docs = "fld_train_docs"
    fld_note = "fld_train_note"
    await conn.execute(
        """
        INSERT INTO field_definitions (field_id, team_id, name, type, config, sort_order)
        VALUES
          ($1, $7, 'Risk level', 'dropdown', $2::jsonb, 0),
          ($3, $7, 'Est. hours', 'number', '{}'::jsonb, 1),
          ($4, $7, 'Training owner', 'person', '{}'::jsonb, 2),
          ($5, $7, 'Review date', 'date', '{}'::jsonb, 3),
          ($6, $7, 'Linked docs', 'files', '{}'::jsonb, 4),
          ($8, $7, 'Playbook notes', 'text', '{}'::jsonb, 5)
        """,
        fld_risk,
        json.dumps({"options": ["Low", "Medium", "High", "Critical"]}),
        fld_hours,
        fld_owner,
        fld_due_custom,
        fld_docs,
        TRAINING_TEAM_ID,
        fld_note,
    )

    priorities = ["low", "medium", "high", "urgent"]
    task_ids: list[str] = []

    for i in range(100):
        task_id = f"{TRAIN_TASK_PREFIX}{i:03d}"
        col_name, status = training_slot(i)
        col_id = col_map[col_name]
        priority = priorities[i % 4]
        creator = client_id if i % 3 == 0 else (member_id if i % 3 == 1 else admin_id)
        creator_name = (
            "Client User" if creator == client_id else ("Member User" if creator == member_id else "Admin User")
        )

        # Assignees: member-heavy so "My work" widget is populated
        if i % 5 == 0:
            assignees = [member_id, admin_id]
        elif i % 5 == 1:
            assignees = [admin_id]
        elif i % 5 == 2:
            assignees = [member_id]
        else:
            assignees = [member_id]

        due = None
        if i % 4 != 0:
            due = now() + timedelta(days=(i % 20) - 5)

        tags = ["training", f"batch-{i // 25}"]
        attachments = "[]"
        if i % 3 == 0:
            attachments = json.dumps(
                [DUMMY_ATTACHMENTS[i % len(DUMMY_ATTACHMENTS)], DUMMY_ATTACHMENTS[(i + 1) % len(DUMMY_ATTACHMENTS)]]
            )

        await conn.execute(
            """
            INSERT INTO tasks (
                task_id, team_id, column_id,
                created_by_user_id, assigned_by_user_id, created_by_name,
                title, description, status, priority,
                assignee_user_ids, due_at, sort_order,
                tags, attachments, custom_fields, subtasks,
                recurrence_rule, recurrence_interval
            ) VALUES (
                $1, $2, $3,
                $4, $4, $5,
                $6, $7, $8, $9,
                $10::text[], $11, $12,
                $13::text[], $14::jsonb, '{}'::jsonb, '[]'::jsonb,
                'none', 1
            )
            """,
            task_id,
            TRAINING_TEAM_ID,
            col_id,
            creator,
            creator_name,
            f"[Training {i:03d}] {col_name} · {priority}",
            f"Seeded task #{i} for QA and demos. Column={col_name}, status={status}.",
            status,
            priority,
            assignees,
            due,
            i,
            tags,
            attachments,
        )

        # Owner approval queue (admin approves)
        if 0 <= i < 10:
            await conn.execute(
                """
                UPDATE tasks SET
                  requires_approval = TRUE,
                  approval_status = 'pending',
                  approval_requested_at = NOW() - ($1::int * interval '1 hour'),
                  approval_notes = 'Seed: awaiting owner approval',
                  updated_at = NOW()
                WHERE task_id = $2
                """,
                i,
                task_id,
            )
        # Client approval queue
        elif 10 <= i < 18:
            await conn.execute(
                """
                UPDATE tasks SET
                  requires_approval = TRUE,
                  approval_status = 'pending_client',
                  approval_requested_at = NOW() - ($1::int * interval '30 minutes'),
                  approval_notes = 'Seed: awaiting client sign-off',
                  updated_at = NOW()
                WHERE task_id = $2
                """,
                i - 10,
                task_id,
            )
        elif 62 <= i < 72:
            # Tasks physically in "Approval" column — client review queue
            await conn.execute(
                """
                UPDATE tasks SET
                  requires_approval = TRUE,
                  approval_status = 'pending_client',
                  approval_requested_at = NOW() - ($1::int * interval '20 minutes'),
                  approval_notes = 'Seed: Approval column — client sign-off demo',
                  updated_at = NOW()
                WHERE task_id = $2
                """,
                i - 62,
                task_id,
            )
        # Fully approved / completed narrative for Done-column tasks
        elif col_name == "Done":
            decider = client_id if i % 2 == 0 else admin_id
            await conn.execute(
                """
                UPDATE tasks SET
                  requires_approval = TRUE,
                  approval_status = 'approved',
                  approval_requested_at = NOW() - interval '3 days',
                  approval_decided_at = NOW() - interval '1 day',
                  approved_by = $1,
                  approval_notes = 'Seed: approved for training',
                  completed_at = COALESCE(completed_at, NOW() - interval '12 hours'),
                  completed_by_user_id = $1,
                  updated_at = NOW()
                WHERE task_id = $2
                """,
                decider,
                task_id,
            )

        await conn.execute(
            """
            INSERT INTO task_clients (id, task_id, user_id, invited_by)
            VALUES ($1, $2, $3, $4)
            """,
            uid("tc"),
            task_id,
            client_id,
            admin_id,
        )

        # One running timer (member) — matches /time-entries/active expectations
        if i == 0:
            await conn.execute(
                """
                INSERT INTO time_entries (entry_id, task_id, user_id, started_at, ended_at, minutes, description)
                VALUES ($1, $2, $3, NOW() - interval '42 minutes', NULL, NULL, 'SEED: timer running (stop in UI)')
                """,
                uid("te"),
                task_id,
                member_id,
            )
        else:
            n_logs = (i % 4) + 1
            for j in range(n_logs):
                mins = 5 + (i + j) % 40
                started = now() - timedelta(days=j + 1, hours=i % 8, minutes=mins + j * 2)
                ended = started + timedelta(minutes=mins)
                await conn.execute(
                    """
                    INSERT INTO time_entries
                    (entry_id, task_id, user_id, started_at, ended_at, minutes, description)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    """,
                    uid("te"),
                    task_id,
                    member_id,
                    started,
                    ended,
                    mins,
                    f"SEED: timer stopped · log {j + 1}/{n_logs}",
                )

        # Custom field values (JSONB)
        risk_val = json.dumps(["Low", "Medium", "High", "Critical"][i % 4])
        await conn.execute(
            "INSERT INTO field_values (task_id, field_id, value) VALUES ($1, $2, $3::jsonb) ON CONFLICT DO NOTHING",
            task_id,
            fld_risk,
            risk_val,
        )
        await conn.execute(
            "INSERT INTO field_values (task_id, field_id, value) VALUES ($1, $2, $3::jsonb) ON CONFLICT DO NOTHING",
            task_id,
            fld_hours,
            json.dumps(0.5 + (i % 12) * 0.25),
        )
        await conn.execute(
            "INSERT INTO field_values (task_id, field_id, value) VALUES ($1, $2, $3::jsonb) ON CONFLICT DO NOTHING",
            task_id,
            fld_owner,
            json.dumps(member_id if i % 2 == 0 else admin_id),
        )
        if i % 2 == 0:
            await conn.execute(
                "INSERT INTO field_values (task_id, field_id, value) VALUES ($1, $2, $3::jsonb) ON CONFLICT DO NOTHING",
                task_id,
                fld_due_custom,
                json.dumps((now() + timedelta(days=i % 14)).date().isoformat()),
            )
        if i % 4 == 0:
            await conn.execute(
                "INSERT INTO field_values (task_id, field_id, value) VALUES ($1, $2, $3::jsonb) ON CONFLICT DO NOTHING",
                task_id,
                fld_docs,
                json.dumps([DUMMY_ATTACHMENTS[0]]),
            )
        await conn.execute(
            "INSERT INTO field_values (task_id, field_id, value) VALUES ($1, $2, $3::jsonb) ON CONFLICT DO NOTHING",
            task_id,
            fld_note,
            json.dumps(f"Playbook step {(i % 8) + 1}: verify UI + API for training task {i}."),
        )

        if i % 6 == 0:
            await conn.execute(
                """
                INSERT INTO task_comments (comment_id, task_id, user_id, body)
                VALUES ($1, $2, $3, $4)
                """,
                uid("cmt"),
                task_id,
                member_id,
                f"@Admin User — Training task {i}: please review attachments and time logs.",
            )
        if i % 9 == 0:
            await conn.execute(
                """
                INSERT INTO task_comments (comment_id, task_id, user_id, body)
                VALUES ($1, $2, $3, $4)
                """,
                uid("cmt"),
                task_id,
                client_id,
                f"Client note on training #{i}: ready when you are.",
            )

        await conn.execute(
            """
            INSERT INTO activity_events (event_id, task_id, team_id, actor_id, type, data)
            VALUES ($1, $2, $3, $4, 'created', $5::jsonb)
            ON CONFLICT DO NOTHING
            """,
            uid("evt"),
            task_id,
            TRAINING_TEAM_ID,
            creator,
            json.dumps({"title": f"[Training {i:03d}]", "seed": True}),
        )

        task_ids.append(task_id)

    print(f"  training team: {TRAINING_TEAM_ID}")
    print(f"  tasks inserted: {len(task_ids)}")
    return task_ids


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

        # ── 5. Training Academy (100 tasks, full QA mix) ───────────────────────
        training_task_ids = await seed_training_academy(conn, admin_id, member_id, client_id)

        # ── 6. Dashboard widget config (lifecycle + training project) ────────
        dash_id  = "seed_lifecycle_dash"
        tr       = TRAINING_TEAM_ID
        widgets  = [
            {"id": "count_todo",   "type": "count",     "config": {"team_id": team_id, "status": "todo",        "label": "Lifecycle — To Do"}},
            {"id": "count_done",   "type": "count",     "config": {"team_id": team_id, "status": "done",        "label": "Lifecycle — Done"}},
            {"id": "count_prog",   "type": "count",     "config": {"team_id": team_id, "status": "in_progress",  "label": "Lifecycle — In Progress"}},
            {"id": "chart_main",   "type": "chart",     "config": {"team_id": team_id, "label": "Lifecycle — Status"}},
            {"id": "tr_chart",     "type": "chart",     "config": {"team_id": tr, "label": "Training — Status (100 tasks)"}},
            {"id": "tr_todo",      "type": "count",     "config": {"team_id": tr, "status": "todo", "label": "Training — To Do"}},
            {"id": "tr_progress",  "type": "count",     "config": {"team_id": tr, "status": "in_progress", "label": "Training — In Progress"}},
            {"id": "tr_review",    "type": "count",     "config": {"team_id": tr, "status": "in_review", "label": "Training — In Review"}},
            {"id": "tr_done",      "type": "count",     "config": {"team_id": tr, "status": "done", "label": "Training — Done"}},
            {"id": "my_work",      "type": "my_work",   "config": {}},
            {"id": "deadlines_lc", "type": "deadlines", "config": {"team_id": team_id, "label": "Lifecycle — Deadlines"}},
            {"id": "deadlines_tr", "type": "deadlines", "config": {"team_id": tr, "label": "Training — Deadlines"}},
            {"id": "time_report",  "type": "time",      "config": {"team_id": team_id}},
        ]
        await conn.execute("""
            INSERT INTO dashboards (dashboard_id, user_id, name, widgets)
            VALUES ($1,$2,'Lifecycle Dashboard',$3::jsonb)
            ON CONFLICT (dashboard_id) DO UPDATE SET widgets=$3::jsonb
        """, dash_id, admin_id, json.dumps(widgets))
        print(f"\n  dashboard seeded (lifecycle + training widgets)")

        # ── 7. Summary ─────────────────────────────────────────────────────────
        task_count   = await conn.fetchval(
            "SELECT COUNT(*) FROM tasks WHERE team_id=$1", team_id)
        train_tasks  = await conn.fetchval(
            "SELECT COUNT(*) FROM tasks WHERE team_id=$1", TRAINING_TEAM_ID)
        comment_count = await conn.fetchval(
            "SELECT COUNT(*) FROM task_comments WHERE task_id=ANY($1::text[])",
            all_task_ids)
        train_comments = await conn.fetchval(
            "SELECT COUNT(*) FROM task_comments WHERE task_id=ANY($1::text[])",
            training_task_ids,
        )
        time_count    = await conn.fetchval(
            "SELECT COUNT(*) FROM time_entries WHERE task_id=ANY($1::text[])",
            all_task_ids)
        train_time = await conn.fetchval(
            "SELECT COUNT(*) FROM time_entries WHERE task_id=ANY($1::text[])",
            training_task_ids,
        )
        activity_count = await conn.fetchval(
            "SELECT COUNT(*) FROM activity_events WHERE team_id=$1", team_id)
        train_activity = await conn.fetchval(
            "SELECT COUNT(*) FROM activity_events WHERE team_id=$1", TRAINING_TEAM_ID)

        print(f"""
✅ Seed complete!
   Lifecycle team : {team_id}
   Lifecycle tasks: {task_count}
   Training team  : {TRAINING_TEAM_ID}  ("Training & QA Academy (100 tasks)")
   Training tasks : {train_tasks}  (open timer on train_task_000 for member@kartavya.dev)

   Lifecycle comments: {comment_count}   | Training comments: {train_comments}
   Lifecycle time logs: {time_count}      | Training time logs: {train_time} (+ 1 running)
   Lifecycle activity : {activity_count}  | Training activity : {train_activity}

   Dashboard: open as admin@kartavya.dev — widgets include both projects (filter "All projects" or pick team).

Login credentials (password not set — use admin panel to reset):
   admin@kartavya.dev   (admin)
   member@kartavya.dev  (member)
   client@kartavya.dev  (client)
""")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed())
