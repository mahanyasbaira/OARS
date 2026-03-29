-- =============================================================================
-- OARS — Migration 002: Extractions and Agent Runs
-- Run in Supabase SQL Editor after 001_initial_schema.sql
-- =============================================================================

-- =============================================================================
-- EXTRACTIONS
-- Structured output from an agent run against a source
-- =============================================================================
CREATE TABLE IF NOT EXISTS extractions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id      UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  project_id     UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  modality       source_modality NOT NULL,
  payload        JSONB NOT NULL,           -- full typed ExtractionPayload
  confidence     FLOAT,
  prompt_version TEXT NOT NULL,
  model          TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS extractions_source_id_idx  ON extractions(source_id);
CREATE INDEX IF NOT EXISTS extractions_project_id_idx ON extractions(project_id);

-- =============================================================================
-- AGENT RUNS
-- Individual agent execution log (one per source per attempt)
-- =============================================================================
CREATE TYPE agent_run_status AS ENUM ('started', 'completed', 'failed');

CREATE TABLE IF NOT EXISTS agent_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  source_id    UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  agent_type   TEXT NOT NULL,              -- 'text' | 'audio' | 'vision'
  status       agent_run_status NOT NULL DEFAULT 'started',
  error        TEXT,
  duration_ms  INT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_runs_job_id_idx    ON agent_runs(job_id);
CREATE INDEX IF NOT EXISTS agent_runs_source_id_idx ON agent_runs(source_id);

-- =============================================================================
-- RLS
-- =============================================================================
ALTER TABLE extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "extractions_select_own" ON extractions
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects
      WHERE user_id = (SELECT id FROM users WHERE clerk_id = current_setting('app.clerk_id', true))
    )
  );

CREATE POLICY "agent_runs_select_own" ON agent_runs
  FOR SELECT USING (
    source_id IN (
      SELECT s.id FROM sources s
      JOIN projects p ON p.id = s.project_id
      WHERE p.user_id = (SELECT id FROM users WHERE clerk_id = current_setting('app.clerk_id', true))
    )
  );
