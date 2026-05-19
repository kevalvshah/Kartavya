-- migration 008: report_schedules
-- Run: psql $DATABASE_URL -f backend/migrations/008_reports.sql

CREATE TABLE IF NOT EXISTS public.report_schedules (
  schedule_id     TEXT PRIMARY KEY DEFAULT ('sched_' || substr(gen_random_uuid()::text, 1, 12)),
  team_id         TEXT NOT NULL REFERENCES public.teams(team_id) ON DELETE CASCADE,
  created_by      TEXT NOT NULL,
  frequency       TEXT NOT NULL CHECK (frequency IN ('daily','weekly','monthly')),
  file_formats    TEXT[] NOT NULL DEFAULT '{pdf}',
  recipients      TEXT[] NOT NULL DEFAULT '{}',
  day_of_week     SMALLINT,        -- 0=Sun…6=Sat (weekly schedules)
  day_of_month    SMALLINT,        -- 1–28 (monthly schedules)
  send_hour_utc   SMALLINT NOT NULL DEFAULT 2,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  last_sent_at    TIMESTAMPTZ,
  next_run_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: FastAPI uses service role so these are permissive guards for PostgREST
ALTER TABLE public.report_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report_schedules_select"
  ON public.report_schedules FOR SELECT
  USING (
    team_id IN (
      SELECT pa.team_id FROM public.project_assignments pa
      WHERE pa.user_id = (SELECT auth.uid()::text)
    )
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = (SELECT auth.uid()::text) AND u.role = 'admin'
    )
  );

CREATE POLICY "report_schedules_all"
  ON public.report_schedules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = (SELECT auth.uid()::text) AND u.role IN ('admin','owner')
    )
    OR team_id IN (
      SELECT pa.team_id FROM public.project_assignments pa
      WHERE pa.user_id = (SELECT auth.uid()::text) AND pa.role IN ('owner','admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = (SELECT auth.uid()::text) AND u.role IN ('admin','owner')
    )
    OR team_id IN (
      SELECT pa.team_id FROM public.project_assignments pa
      WHERE pa.user_id = (SELECT auth.uid()::text) AND pa.role IN ('owner','admin')
    )
  );

CREATE INDEX IF NOT EXISTS idx_report_schedules_team_id  ON public.report_schedules(team_id);
CREATE INDEX IF NOT EXISTS idx_report_schedules_next_run ON public.report_schedules(next_run_at) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_report_schedules_by       ON public.report_schedules(created_by);
