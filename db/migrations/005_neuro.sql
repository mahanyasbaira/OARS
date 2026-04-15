-- =============================================================================
-- OARS — Migration 005: Neuro analyses (TRIBE v2)
-- Run in Supabase SQL Editor after 004_reports.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS neuro_analyses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  extraction_id  UUID NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'running', 'complete', 'failed')),
  job_id         TEXT,                         -- brain-service job ID
  error          TEXT,
  results        JSONB,                        -- full prediction payload
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS neuro_analyses_project_id_idx   ON neuro_analyses(project_id);
CREATE INDEX IF NOT EXISTS neuro_analyses_extraction_id_idx ON neuro_analyses(extraction_id);
CREATE INDEX IF NOT EXISTS neuro_analyses_user_id_idx       ON neuro_analyses(user_id);

ALTER TABLE neuro_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "neuro_select_own" ON neuro_analyses
  FOR SELECT USING (
    user_id = (
      SELECT id FROM users
      WHERE clerk_id = current_setting('app.clerk_id', true)
    )
  );

CREATE POLICY "neuro_insert_own" ON neuro_analyses
  FOR INSERT WITH CHECK (
    user_id = (
      SELECT id FROM users
      WHERE clerk_id = current_setting('app.clerk_id', true)
    )
  );

CREATE POLICY "neuro_update_own" ON neuro_analyses
  FOR UPDATE USING (
    user_id = (
      SELECT id FROM users
      WHERE clerk_id = current_setting('app.clerk_id', true)
    )
  );
