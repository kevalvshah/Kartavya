"""Database Migration: Role-Based Access Control & Approval Workflow"""

import asyncpg
import os
import sys
from datetime import datetime, timezone
import uuid

async def run_migration():
    """Run database migration for role-based access and approval workflow"""
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("❌ DATABASE_URL environment variable not set")
        sys.exit(1)
    
    conn = await asyncpg.connect(db_url)
    
    try:
        print("🔄 Starting migration: Role-Based Access & Approval Workflow...")
        print()
        
        # 1. Create project_assignments table
        print("📋 Creating project_assignments table...")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS project_assignments (
                assignment_id VARCHAR(255) PRIMARY KEY,
                team_id VARCHAR(255) NOT NULL REFERENCES teams(team_id) ON DELETE CASCADE,
                user_id VARCHAR(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'client')),
                assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                assigned_by VARCHAR(255) REFERENCES users(user_id),
                UNIQUE(team_id, user_id)
            )
        """)
        print("   ✅ project_assignments table created")
        
        # Create indexes
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_project_assignments_user ON project_assignments(user_id)
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_project_assignments_team ON project_assignments(team_id)
        """)
        print("   ✅ Indexes created on project_assignments")
        print()
        
        # 2. Add approval workflow fields to tasks
        print("📋 Adding approval workflow fields to tasks table...")
        
        approval_fields = [
            ("requires_approval", "BOOLEAN DEFAULT FALSE"),
            ("approval_status", "VARCHAR(50)"),  # pending, approved, rejected
            ("approved_by", "VARCHAR(255) REFERENCES users(user_id)"),
            ("approval_notes", "TEXT"),
            ("approval_requested_at", "TIMESTAMP WITH TIME ZONE"),
            ("approval_decided_at", "TIMESTAMP WITH TIME ZONE")
        ]
        
        for field_name, field_type in approval_fields:
            try:
                await conn.execute(f"ALTER TABLE tasks ADD COLUMN IF NOT EXISTS {field_name} {field_type}")
                print(f"   ✅ Added column: {field_name}")
            except Exception as e:
                if "already exists" in str(e).lower():
                    print(f"   ⚠️  Column {field_name} already exists, skipping")
                else:
                    raise
        
        # Create index for approval status
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_tasks_approval_status 
            ON tasks(approval_status) WHERE approval_status IS NOT NULL
        """)
        print("   ✅ Index created on approval_status")
        print()
        
        # 3. Migrate existing team_members to project_assignments
        print("📋 Migrating existing team members to project_assignments...")
        migrated = await conn.fetch("""
            INSERT INTO project_assignments (assignment_id, team_id, user_id, role, assigned_by)
            SELECT 
                CONCAT('assign_', MD5(RANDOM()::TEXT || team_id || user_id), SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 12)),
                team_id,
                user_id,
                CASE 
                    WHEN role = 'owner' THEN 'owner'
                    WHEN role = 'admin' THEN 'admin'
                    ELSE 'member'
                END,
                'system'
            FROM team_members
            WHERE user_id IS NOT NULL AND status = 'active'
            ON CONFLICT (team_id, user_id) DO NOTHING
            RETURNING assignment_id
        """)
        print(f"   ✅ Migrated {len(migrated)} team memberships to project_assignments")
        print()
        
        # 4. Create user_preferences table for pagination settings
        print("📋 Creating user_preferences table...")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS user_preferences (
                user_id VARCHAR(255) PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
                pagination_default INT DEFAULT 25 CHECK (pagination_default IN (25, 50, 100)),
                sidebar_collapsed BOOLEAN DEFAULT FALSE,
                theme VARCHAR(20) DEFAULT 'light',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)
        print("   ✅ user_preferences table created")
        print()
        
        print("🎉 Migration completed successfully!")
        print()
        print("Summary:")
        print("  ✅ project_assignments table created")
        print("  ✅ Approval workflow fields added to tasks")
        print(f"  ✅ {len(migrated)} existing memberships migrated")
        print("  ✅ user_preferences table created")
        print()
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        await conn.close()

if __name__ == "__main__":
    import asyncio
    print("="*80)
    print("Database Migration: Role-Based Access Control & Approval Workflow")
    print("Kartavaya by Aekam Inc")
    print("="*80)
    print()
    asyncio.run(run_migration())
