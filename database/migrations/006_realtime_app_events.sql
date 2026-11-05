-- Migration: 006_realtime_app_events.sql
-- Persistent database-backed event journal for cross-user real-time synchronization.

CREATE TABLE IF NOT EXISTS app_events (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(64) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id VARCHAR(128) NOT NULL,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  audience_type VARCHAR(32) NOT NULL DEFAULT 'global', -- 'global', 'user', 'conversation', 'project', 'team'
  audience_id VARCHAR(128) DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_app_events_id ON app_events(id);
CREATE INDEX IF NOT EXISTS idx_app_events_audience ON app_events(audience_type, audience_id, id);
CREATE INDEX IF NOT EXISTS idx_app_events_created ON app_events(created_at);
