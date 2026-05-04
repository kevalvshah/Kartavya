-- ============================================================
-- Kartavya — Invite System Migration
-- Run this in Supabase SQL Editor (Project > SQL Editor)
-- ============================================================

-- 1. Add role column to users (admin | member | client)
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';

-- 2. Create invites table
CREATE TABLE IF NOT EXISTS invites (
    invite_id   TEXT PRIMARY KEY,
    email       TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'member',
    token       TEXT NOT NULL UNIQUE,
    invited_by  TEXT REFERENCES users(user_id) ON DELETE SET NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create task_comments table
CREATE TABLE IF NOT EXISTS task_comments (
    comment_id  TEXT PRIMARY KEY,
    task_id     TEXT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
    user_id     TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    body        TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create task_clients table (which tasks a client can see)
CREATE TABLE IF NOT EXISTS task_clients (
    id          TEXT PRIMARY KEY,
    task_id     TEXT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
    user_id     TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    invited_by  TEXT REFERENCES users(user_id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(task_id, user_id)
);

-- 5. Seed the first admin user (change email/password as needed)
-- After running the migration, ALSO run: python seed_admin.py
-- OR insert directly here:
-- INSERT INTO users (user_id, name, email, password_hash, salt, role)
-- VALUES ('user_admin001', 'Keval Shah', 'admin@aekaminc.com', '<hash>', '<salt>', 'admin')
-- ON CONFLICT DO NOTHING;
