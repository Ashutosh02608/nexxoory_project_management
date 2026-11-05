BEGIN;

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS assigned_user_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];

CREATE TABLE IF NOT EXISTS folder_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_key VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (folder_key, user_id)
);

CREATE INDEX IF NOT EXISTS idx_folder_permissions_user_folder
  ON folder_permissions(user_id, folder_key);
CREATE INDEX IF NOT EXISTS idx_documents_assigned_users
  ON documents USING GIN(assigned_user_ids);
CREATE INDEX IF NOT EXISTS idx_events_team_start
  ON calendar_events(team_id, start_date);
CREATE INDEX IF NOT EXISTS idx_events_department_start
  ON calendar_events(department, start_date);
CREATE INDEX IF NOT EXISTS idx_projects_team_manager
  ON projects(primary_team_id, manager_id);

COMMIT;
