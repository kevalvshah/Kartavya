# Database Migrations

## Running Migrations

### Prerequisites
- Python 3.8+
- asyncpg installed (`pip install asyncpg`)
- DATABASE_URL environment variable set

### Execute Migration

```bash
# Set your database URL
export DATABASE_URL="postgresql://user:password@host:port/database"

# Run the migration
python backend/migrations/001_role_based_access.py
```

### Railway Deployment

If deploying on Railway:

```bash
# Railway automatically sets DATABASE_URL
# SSH into your Railway container or run locally with Railway's DB URL
railway run python backend/migrations/001_role_based_access.py
```

## Migration 001: Role-Based Access & Approval Workflow

**File:** `001_role_based_access.py`

**Changes:**
1. Creates `project_assignments` table for granular project access control
2. Adds approval workflow fields to `tasks` table
3. Migrates existing `team_members` to `project_assignments`
4. Creates `user_preferences` table for UI settings

**Safe to Re-run:** Yes - uses `IF NOT EXISTS` and `ON CONFLICT DO NOTHING`

## Rollback

To rollback this migration:

```sql
-- Drop new tables
DROP TABLE IF EXISTS user_preferences;
DROP TABLE IF EXISTS project_assignments;

-- Remove approval fields from tasks
ALTER TABLE tasks DROP COLUMN IF EXISTS requires_approval;
ALTER TABLE tasks DROP COLUMN IF EXISTS approval_status;
ALTER TABLE tasks DROP COLUMN IF EXISTS approved_by;
ALTER TABLE tasks DROP COLUMN IF EXISTS approval_notes;
ALTER TABLE tasks DROP COLUMN IF EXISTS approval_requested_at;
ALTER TABLE tasks DROP COLUMN IF EXISTS approval_decided_at;
```
