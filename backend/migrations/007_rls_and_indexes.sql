-- migration 007: RLS + performance hardening
-- Run against Railway PostgreSQL:
--   psql $DATABASE_URL -f backend/migrations/007_rls_and_indexes.sql

-- ============================================================
-- 1. Enable RLS on all 10 new v2 tables (rls_disabled_in_public)
-- ============================================================
ALTER TABLE public.field_definitions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_values       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_views        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboards         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_templates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_templates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentions           ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Bypass policies (FastAPI uses service role / direct PG conn,
--    not Supabase PostgREST, so these permissive policies let the
--    app work while blocking unauthenticated PostgREST access).
-- ============================================================

-- field_definitions
CREATE POLICY "Authenticated users can access field_definitions"
  ON public.field_definitions FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- field_values
CREATE POLICY "Authenticated users can access field_values"
  ON public.field_values FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- saved_views
CREATE POLICY "Authenticated users can access saved_views"
  ON public.saved_views FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- dashboards
CREATE POLICY "Authenticated users can access dashboards"
  ON public.dashboards FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- automations
CREATE POLICY "Authenticated users can access automations"
  ON public.automations FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- project_templates
CREATE POLICY "Authenticated users can access project_templates"
  ON public.project_templates FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- task_templates
CREATE POLICY "Authenticated users can access task_templates"
  ON public.task_templates FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- activity_events
CREATE POLICY "Authenticated users can access activity_events"
  ON public.activity_events FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- time_entries
CREATE POLICY "Authenticated users can access time_entries"
  ON public.time_entries FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- mentions
CREATE POLICY "Authenticated users can access mentions"
  ON public.mentions FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- ============================================================
-- 3. Fix auth_rls_initplan warnings: wrap auth.uid() in (select)
--    Affects: project_assignments, teams, tasks, project_columns,
--             users, categories, notifications, user_preferences,
--             task_comments, task_clients, approvals
-- ============================================================

-- project_assignments
DROP POLICY IF EXISTS "Users can view their own project assignments" ON public.project_assignments;
DROP POLICY IF EXISTS "Admins and owners can manage project assignments" ON public.project_assignments;
CREATE POLICY "project_assignments_select"
  ON public.project_assignments FOR SELECT
  USING (user_id = (SELECT auth.uid()) OR
         EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = (SELECT auth.uid()::text) AND u.role = 'admin'));
CREATE POLICY "project_assignments_all"
  ON public.project_assignments FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = (SELECT auth.uid()::text) AND u.role IN ('admin','owner')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = (SELECT auth.uid()::text) AND u.role IN ('admin','owner')));

-- teams
DROP POLICY IF EXISTS "Users can view teams they are assigned to" ON public.teams;
DROP POLICY IF EXISTS "Owners and admins can manage teams" ON public.teams;
CREATE POLICY "teams_select"
  ON public.teams FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.project_assignments pa WHERE pa.team_id = teams.team_id AND pa.user_id = (SELECT auth.uid()::text))
         OR EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = (SELECT auth.uid()::text) AND u.role = 'admin'));
CREATE POLICY "teams_all"
  ON public.teams FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = (SELECT auth.uid()::text) AND u.role IN ('admin','owner')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = (SELECT auth.uid()::text) AND u.role IN ('admin','owner')));

-- tasks (drop all 4 old policies, replace with 4 using (select auth.uid()))
DROP POLICY IF EXISTS "Users can view tasks in their assigned projects" ON public.tasks;
DROP POLICY IF EXISTS "Users can create tasks in assigned projects" ON public.tasks;
DROP POLICY IF EXISTS "Users can update tasks they created or are assigned to" ON public.tasks;
DROP POLICY IF EXISTS "Admins and task creators can delete tasks" ON public.tasks;
CREATE POLICY "tasks_select"
  ON public.tasks FOR SELECT
  USING (team_id IN (SELECT pa.team_id FROM public.project_assignments pa WHERE pa.user_id = (SELECT auth.uid()::text))
         OR created_by_user_id = (SELECT auth.uid()::text)
         OR EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = (SELECT auth.uid()::text) AND u.role = 'admin'));
CREATE POLICY "tasks_insert"
  ON public.tasks FOR INSERT
  WITH CHECK (team_id IN (SELECT pa.team_id FROM public.project_assignments pa WHERE pa.user_id = (SELECT auth.uid()::text))
              OR EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = (SELECT auth.uid()::text) AND u.role = 'admin'));
CREATE POLICY "tasks_update"
  ON public.tasks FOR UPDATE
  USING (created_by_user_id = (SELECT auth.uid()::text)
         OR (SELECT auth.uid()::text) = ANY(COALESCE(assignee_user_ids, ARRAY[]::text[]))
         OR EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = (SELECT auth.uid()::text) AND u.role IN ('admin','owner')));
CREATE POLICY "tasks_delete"
  ON public.tasks FOR DELETE
  USING (created_by_user_id = (SELECT auth.uid()::text)
         OR EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = (SELECT auth.uid()::text) AND u.role = 'admin'));

-- project_columns
DROP POLICY IF EXISTS "Users can view columns in their assigned projects" ON public.project_columns;
DROP POLICY IF EXISTS "Owners and admins can manage columns" ON public.project_columns;
CREATE POLICY "project_columns_select"
  ON public.project_columns FOR SELECT
  USING (team_id IN (SELECT pa.team_id FROM public.project_assignments pa WHERE pa.user_id = (SELECT auth.uid()::text))
         OR EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = (SELECT auth.uid()::text) AND u.role = 'admin'));
CREATE POLICY "project_columns_all"
  ON public.project_columns FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = (SELECT auth.uid()::text) AND u.role IN ('admin','owner')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = (SELECT auth.uid()::text) AND u.role IN ('admin','owner')));

-- users
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "users_select"
  ON public.users FOR SELECT
  USING (user_id = (SELECT auth.uid()::text)
         OR EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = (SELECT auth.uid()::text) AND u.role = 'admin'));
CREATE POLICY "users_update"
  ON public.users FOR UPDATE
  USING (user_id = (SELECT auth.uid()::text))
  WITH CHECK (user_id = (SELECT auth.uid()::text));

-- categories
DROP POLICY IF EXISTS "Users can manage their own categories" ON public.categories;
CREATE POLICY "categories_all"
  ON public.categories FOR ALL
  USING (created_by = (SELECT auth.uid()::text)
         OR EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = (SELECT auth.uid()::text) AND u.role = 'admin'))
  WITH CHECK (created_by = (SELECT auth.uid()::text)
              OR EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = (SELECT auth.uid()::text) AND u.role = 'admin'));

-- notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "notifications_select"
  ON public.notifications FOR SELECT
  USING (user_id = (SELECT auth.uid()::text));
CREATE POLICY "notifications_update"
  ON public.notifications FOR UPDATE
  USING (user_id = (SELECT auth.uid()::text))
  WITH CHECK (user_id = (SELECT auth.uid()::text));

-- user_preferences
DROP POLICY IF EXISTS "Users can manage their own preferences" ON public.user_preferences;
CREATE POLICY "user_preferences_all"
  ON public.user_preferences FOR ALL
  USING (user_id = (SELECT auth.uid()::text))
  WITH CHECK (user_id = (SELECT auth.uid()::text));

-- task_comments
DROP POLICY IF EXISTS "Users can view comments on accessible tasks" ON public.task_comments;
DROP POLICY IF EXISTS "Users can create comments on accessible tasks" ON public.task_comments;
CREATE POLICY "task_comments_select"
  ON public.task_comments FOR SELECT
  USING (task_id IN (SELECT t.task_id FROM public.tasks t
    WHERE t.team_id IN (SELECT pa.team_id FROM public.project_assignments pa WHERE pa.user_id = (SELECT auth.uid()::text)))
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = (SELECT auth.uid()::text) AND u.role = 'admin'));
CREATE POLICY "task_comments_insert"
  ON public.task_comments FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()::text));

-- task_clients
DROP POLICY IF EXISTS "Admins can manage task clients" ON public.task_clients;
DROP POLICY IF EXISTS "Users can view their own task client assignments" ON public.task_clients;
CREATE POLICY "task_clients_select"
  ON public.task_clients FOR SELECT
  USING (client_user_id = (SELECT auth.uid()::text)
         OR EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = (SELECT auth.uid()::text) AND u.role IN ('admin','owner')));
CREATE POLICY "task_clients_all"
  ON public.task_clients FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = (SELECT auth.uid()::text) AND u.role IN ('admin','owner')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = (SELECT auth.uid()::text) AND u.role IN ('admin','owner')));

-- approvals
DROP POLICY IF EXISTS "Users can view approvals in their projects" ON public.approvals;
DROP POLICY IF EXISTS "Clients can create approval requests" ON public.approvals;
DROP POLICY IF EXISTS "Owners and admins can review approvals" ON public.approvals;
CREATE POLICY "approvals_select"
  ON public.approvals FOR SELECT
  USING (requested_by = (SELECT auth.uid()::text)
         OR EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = (SELECT auth.uid()::text) AND u.role IN ('admin','owner')));
CREATE POLICY "approvals_insert"
  ON public.approvals FOR INSERT
  WITH CHECK (requested_by = (SELECT auth.uid()::text));
CREATE POLICY "approvals_update"
  ON public.approvals FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = (SELECT auth.uid()::text) AND u.role IN ('admin','owner')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.user_id = (SELECT auth.uid()::text) AND u.role IN ('admin','owner')));

-- ============================================================
-- 4. Missing FK indexes (unindexed_foreign_keys)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_approvals_reviewed_by      ON public.approvals(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_approvals_task_id          ON public.approvals(task_id);
CREATE INDEX IF NOT EXISTS idx_automations_created_by     ON public.automations(created_by);
CREATE INDEX IF NOT EXISTS idx_automations_team_id        ON public.automations(team_id);
CREATE INDEX IF NOT EXISTS idx_boards_created_by          ON public.boards(created_by);
CREATE INDEX IF NOT EXISTS idx_dashboards_user_id         ON public.dashboards(user_id);
CREATE INDEX IF NOT EXISTS idx_field_definitions_team_id  ON public.field_definitions(team_id);
CREATE INDEX IF NOT EXISTS idx_field_values_field_id      ON public.field_values(field_id);
CREATE INDEX IF NOT EXISTS idx_invites_invited_by         ON public.invites(invited_by);
CREATE INDEX IF NOT EXISTS idx_mentions_comment_id        ON public.mentions(comment_id);
CREATE INDEX IF NOT EXISTS idx_project_assignments_by     ON public.project_assignments(assigned_by);
CREATE INDEX IF NOT EXISTS idx_project_templates_creator  ON public.project_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_saved_views_created_by     ON public.saved_views(created_by);
CREATE INDEX IF NOT EXISTS idx_saved_views_team_id        ON public.saved_views(team_id);
CREATE INDEX IF NOT EXISTS idx_task_clients_invited_by    ON public.task_clients(invited_by);
CREATE INDEX IF NOT EXISTS idx_task_comments_user_id      ON public.task_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_task_templates_team_id     ON public.task_templates(team_id);
CREATE INDEX IF NOT EXISTS idx_tasks_approval_id          ON public.tasks(approval_id);
CREATE INDEX IF NOT EXISTS idx_tasks_approved_by          ON public.tasks(approved_by);
CREATE INDEX IF NOT EXISTS idx_tasks_category_id          ON public.tasks(category_id);
