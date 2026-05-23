#!/usr/bin/env python3
"""
seed_india.py — Realistic Indian-context seed for Kartavya v2 smoke test.

Seeds:
  1 workspace  "Aekam Inc"
  5 users      admin (Keval), members (Aanya, Vikram), clients (Arjun, Priya)
  5 projects   Quarterly GST Filing, Diwali Campaign, Bengaluru Office Fit-out,
               Vendor Onboarding v2, Mumbai Client Review
  13 tasks     distributed across requested/todo/in_progress/in_review/done
  2 approvals  pending (1 task-request, 1 work approval)
  6 activity   events
  4 inbox      notifications

Usage:
  DATABASE_URL=postgresql://... python seed_india.py

Safe to re-run: all IDs are stable — uses ON CONFLICT DO NOTHING / DO UPDATE.

Edit the EMAIL_* constants below to real addresses before running.
"""
import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone

import asyncpg

DATABASE_URL = os.environ["DATABASE_URL"]

# ── Edit these before running ─────────────────────────────────────────────────
EMAIL_ADMIN  = os.environ.get("SEED_EMAIL_ADMIN",  "you+admin@yourdomain.com")
EMAIL_AANYA  = os.environ.get("SEED_EMAIL_AANYA",  "you+aanya@yourdomain.com")
EMAIL_VIKRAM = os.environ.get("SEED_EMAIL_VIKRAM",  "you+vikram@yourdomain.com")
EMAIL_ARJUN  = os.environ.get("SEED_EMAIL_ARJUN",  "you+arjun@yourdomain.com")
EMAIL_PRIYA  = os.environ.get("SEED_EMAIL_PRIYA",  "you+priya@yourdomain.com")

# ── Stable IDs ────────────────────────────────────────────────────────────────
WS_ID        = "ws_aekam_inc"
U_KEVAL      = "u_keval_shah"
U_AANYA      = "u_aanya_mehta"
U_VIKRAM     = "u_vikram_joshi"
U_ARJUN      = "u_arjun_tata"
U_PRIYA      = "u_priya_saraswati"

P_GST        = "proj_gst_filing"
P_DIWALI     = "proj_diwali_campaign"
P_BENGALURU  = "proj_blr_fitout"
P_VENDOR     = "proj_vendor_onboarding"
P_MUMBAI     = "proj_mumbai_review"

def ts(days=0, hours=0):
    return datetime.now(timezone.utc) + timedelta(days=days, hours=hours)

def uid(prefix):
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


PROJECTS = [
    (P_GST,       "Quarterly GST Filing",        "#0082c6", "GST reconciliation Q4 2025–26"),
    (P_DIWALI,    "Diwali Campaign",              "#f59e0b", "Marketing campaign for Diwali season"),
    (P_BENGALURU, "Bengaluru Office Fit-out",     "#8b5cf6", "Interior design + furniture for BLR office"),
    (P_VENDOR,    "Vendor Onboarding v2",         "#05b7aa", "Streamlined vendor KYC and portal access"),
    (P_MUMBAI,    "Mumbai Client Review",         "#03a1b6", "Quarterly review deck for Mumbai clients"),
]

COL_NAMES = [
    ("Requested",   "#ef4444", 0, False),
    ("To Do",       "#0082c6", 1, False),
    ("In Progress", "#03a1b6", 2, False),
    ("In Review",   "#8b5cf6", 3, False),
    ("Done",        "#05b7aa", 4, True),
]

TASKS = [
    # (id, project, title, col_idx, priority, assignee_id, due_days, description)
    (uid("t"), P_GST,       "Collect GSTIN for all vendors",       1, "high",   U_AANYA,  3,  "Gather GSTIN details from all active vendors before filing deadline."),
    (uid("t"), P_GST,       "Reconcile GSTR-2A vs purchase ledger",2, "urgent", U_VIKRAM, 1,  "Match input tax credit with purchase ledger — flag discrepancies."),
    (uid("t"), P_GST,       "File GSTR-3B for Q4",                 4, "high",   U_KEVAL,  -2, "Final filing — marked done after CA verification."),

    (uid("t"), P_DIWALI,    "Finalise campaign creatives",         2, "high",   U_AANYA,  5,  "Banner + social media assets for Diwali offer launch."),
    (uid("t"), P_DIWALI,    "Review copy for regional languages",  3, "medium", U_VIKRAM, 4,  "Hindi + Tamil + Kannada copy review with native speakers."),
    (uid("t"), P_DIWALI,    "Client approval on campaign brief",   0, "high",   U_ARJUN,  2,  "Arjun (Tata Steel) to approve the brief before production begins."),

    (uid("t"), P_BENGALURU, "Shortlist interior design firms",     1, "medium", U_AANYA,  10, "Get 3 quotes from Bengaluru-based firms."),
    (uid("t"), P_BENGALURU, "Site measurement visit",              4, "low",    U_VIKRAM, -5, "Completed — floor plan submitted."),

    (uid("t"), P_VENDOR,    "Build vendor self-service portal",    2, "high",   U_VIKRAM, 7,  "React + FastAPI portal for vendor document upload."),
    (uid("t"), P_VENDOR,    "KYC verification integration",        3, "urgent", U_AANYA,  3,  "Integrate with CERSAI / Bureau for live KYC checks."),

    (uid("t"), P_MUMBAI,    "Draft Q4 review deck",                1, "high",   U_AANYA,  4,  "Slides covering revenue, milestones, and roadmap."),
    (uid("t"), P_MUMBAI,    "Approval: present deck to client",    0, "medium", U_PRIYA,  3,  "Priya (Saraswati Co.) to sign off before presenting."),
    (uid("t"), P_MUMBAI,    "Send final deck PDF",                 4, "low",    U_VIKRAM, -1, "Done — PDF sent to all stakeholders."),
]


async def run():
    conn = await asyncpg.connect(DATABASE_URL)

    print("⏳ Seeding users…")
    users = [
        (U_KEVAL,  "Keval Shah",      EMAIL_ADMIN,  "admin",  WS_ID),
        (U_AANYA,  "Aanya Mehta",     EMAIL_AANYA,  "member", WS_ID),
        (U_VIKRAM, "Vikram Joshi",    EMAIL_VIKRAM, "member", WS_ID),
        (U_ARJUN,  "Arjun Kapoor",    EMAIL_ARJUN,  "client", WS_ID),
        (U_PRIYA,  "Priya Sharma",    EMAIL_PRIYA,  "client", WS_ID),
    ]
    for uid_, name, email, role, ws in users:
        await conn.execute("""
            INSERT INTO users (user_id, full_name, email, role, workspace_id, created_at)
            VALUES ($1,$2,$3,$4,$5,$6)
            ON CONFLICT (user_id) DO UPDATE SET full_name=EXCLUDED.full_name, email=EXCLUDED.email
        """, uid_, name, email, role, ws, ts(-30))
    print(f"  ✓ {len(users)} users")

    print("⏳ Seeding teams (projects)…")
    for pid, name, color, desc in PROJECTS:
        await conn.execute("""
            INSERT INTO teams (team_id, name, description, color, workspace_id, created_at)
            VALUES ($1,$2,$3,$4,$5,$6)
            ON CONFLICT (team_id) DO UPDATE SET name=EXCLUDED.name
        """, pid, name, desc, color, WS_ID, ts(-20))

        # columns
        for col_name, col_color, col_pos, is_done in COL_NAMES:
            col_id = f"col_{pid}_{col_pos}"
            await conn.execute("""
                INSERT INTO columns (column_id, team_id, name, color, position, is_done)
                VALUES ($1,$2,$3,$4,$5,$6)
                ON CONFLICT (column_id) DO NOTHING
            """, col_id, pid, col_name, col_color, col_pos, is_done)

        # memberships
        for uid_, _, _, role, _ in users:
            member_role = "owner" if uid_ == U_KEVAL else role
            await conn.execute("""
                INSERT INTO team_members (team_id, user_id, role, joined_at)
                VALUES ($1,$2,$3,$4)
                ON CONFLICT (team_id, user_id) DO NOTHING
            """, pid, uid_, member_role, ts(-20))
    print(f"  ✓ {len(PROJECTS)} projects + columns + memberships")

    print("⏳ Seeding tasks…")
    for tid, pid, title, col_idx, priority, assignee, due_days, desc in TASKS:
        col_id = f"col_{pid}_{col_idx}"
        status_map = {0: "requested", 1: "todo", 2: "in_progress", 3: "in_review", 4: "done"}
        status = status_map[col_idx]
        await conn.execute("""
            INSERT INTO tasks (task_id, team_id, column_id, title, description,
                               priority, status, assignee_id, created_by, due_at, created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
            ON CONFLICT (task_id) DO NOTHING
        """, tid, pid, col_id, title, desc, priority, status,
             assignee, U_KEVAL, ts(due_days), ts(-15))
    print(f"  ✓ {len(TASKS)} tasks")

    # Collect requested-task IDs for approvals
    req_tasks = [(tid, pid, title) for tid, pid, title, col_idx, *_ in TASKS if col_idx == 0]

    print("⏳ Seeding approvals…")
    for i, (tid, pid, title) in enumerate(req_tasks[:2]):
        appr_id = f"appr_india_{i}"
        kind    = "task_request" if i == 0 else "work_approval"
        req_id  = U_ARJUN if i == 0 else U_VIKRAM
        await conn.execute("""
            INSERT INTO approvals (approval_id, task_id, team_id, requested_by,
                                   approver_id, status, kind, created_at)
            VALUES ($1,$2,$3,$4,$5,'pending',$6,$7)
            ON CONFLICT (approval_id) DO NOTHING
        """, appr_id, tid, pid, req_id, U_KEVAL, kind, ts(-2))
    print("  ✓ 2 approvals")

    print("⏳ Seeding activity events…")
    activity_rows = [
        (uid("act"), U_KEVAL,  "task_created",   None,   "Created 'Collect GSTIN for all vendors'", ts(-14)),
        (uid("act"), U_AANYA,  "task_assigned",  None,   "Assigned to Aanya Mehta",                 ts(-13)),
        (uid("act"), U_VIKRAM, "task_moved",     None,   "Moved to In Progress",                    ts(-7)),
        (uid("act"), U_ARJUN,  "approval_req",   None,   "Client approval requested for Diwali deck",ts(-3)),
        (uid("act"), U_KEVAL,  "comment_added",  None,   "Keval commented: 'Please review by EOD'", ts(-1)),
        (uid("act"), U_VIKRAM, "task_done",      None,   "Vikram marked 'Send final deck PDF' done", ts(-1, -2)),
    ]
    for act_id, actor, kind, task_id, body, created in activity_rows:
        await conn.execute("""
            INSERT INTO activity (activity_id, actor_id, kind, task_id, body, workspace_id, created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            ON CONFLICT (activity_id) DO NOTHING
        """, act_id, actor, kind, task_id, body, WS_ID, created)
    print("  ✓ 6 activity events")

    print("⏳ Seeding inbox notifications…")
    notif_rows = [
        (uid("n"), U_KEVAL, "mention",   "Vikram mentioned you in 'KYC verification integration'",      ts(-1)),
        (uid("n"), U_AANYA, "assign",    "You were assigned to 'Draft Q4 review deck'",                 ts(-2)),
        (uid("n"), U_KEVAL, "approval",  "Arjun submitted an approval request for the Diwali campaign", ts(-3)),
        (uid("n"), U_ARJUN, "task_done", "Vikram completed 'Send final deck PDF' — awaiting your sign-off", ts(-1, -3)),
    ]
    for nid, user_id, kind, body, created in notif_rows:
        await conn.execute("""
            INSERT INTO notifications (notification_id, user_id, kind, body, is_read, created_at)
            VALUES ($1,$2,$3,$4,false,$5)
            ON CONFLICT (notification_id) DO NOTHING
        """, nid, user_id, kind, body, created)
    print("  ✓ 4 inbox notifications")

    await conn.close()
    print("\n✅ Indian-context seed complete.")
    print(f"   Admin:  {EMAIL_ADMIN}")
    print(f"   Aanya:  {EMAIL_AANYA}")
    print(f"   Vikram: {EMAIL_VIKRAM}")
    print(f"   Arjun:  {EMAIL_ARJUN}")
    print(f"   Priya:  {EMAIL_PRIYA}")


if __name__ == "__main__":
    asyncio.run(run())
