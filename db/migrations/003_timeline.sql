-- =============================================================================
-- OARS — Migration 003: Timeline Events and Contradictions
-- Run in Supabase SQL Editor after 002_extractions.sql
-- =============================================================================

-- =============================================================================
-- TIMELINE EVENTS
-- Merged, deduplicated events from the Temporal Aggregator agent
-- =============================================================================
CREATE TABLE IF NOT EXISTS timeline_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_id     UUID REFERENCES sources(id) ON DELETE SET NULL,
  description   TEXT NOT NULL,
  timestamp     TIMESTAMPTZ,           -- null if unknown / approximate
  approximate   BOOLEAN NOT NULL DEFAULT false,
  confidence    FLOAT NOT NULL DEFAULT 1.0,
  source_span   TEXT,                  -- verbatim quote from source
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS timeline_events_project_id_idx ON timeline_events(project_id);
CREATE INDEX IF NOT EXISTS timeline_events_timestamp_idx  ON timeline_events(timestamp);

-- =============================================================================
-- CONTRADICTIONS
-- Pairs of timeline events that conflict with each other
-- =============================================================================
CREATE TABLE IF NOT EXISTS contradictions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  event_a_id  UUID NOT NULL REFERENCES timeline_events(id) ON DELETE CASCADE,
  event_b_id  UUID NOT NULL REFERENCES timeline_events(id) ON DELETE CASCADE,
  description TEXT NOT NULL,           -- explanation of the conflict
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contradictions_project_id_idx ON contradictions(project_id);

-- =============================================================================
-- RLS
-- =============================================================================
ALTER TABLE timeline_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE contradictions   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timeline_events_select_own" ON timeline_events
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects
      WHERE user_id = (SELECT id FROM users WHERE clerk_id = current_setting('app.clerk_id', true))
    )
  );

CREATE POLICY "contradictions_select_own" ON contradictions
  FOR SELECT USING (
    project_id IN (
      SELECT id FROM projects
      WHERE user_id = (SELECT id FROM users WHERE clerk_id = current_setting('app.clerk_id', true))
    )
  );
