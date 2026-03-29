-- =============================================================================
-- OARS — Migration 004: Reports
-- Run in Supabase SQL Editor after 003_timeline.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS reports (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  payload        JSONB NOT NULL,
  prompt_version TEXT NOT NULL,
  model          TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reports_project_id_idx ON reports(project_id);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_select_own" ON reports
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects
      WHERE user_id = (SELECT id FROM users WHERE clerk_id = current_setting('app.clerk_id', true))
    )
  );
