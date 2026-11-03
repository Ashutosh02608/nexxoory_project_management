-- =============================================================================
-- NEXXOORY DATABASE SCHEMA SPECIFICATION
-- Database Engine: Neon PostgreSQL (15+ / 16)
-- Migration: 001_initial_schema.sql
-- All primary keys: UUID v4
-- =============================================================================

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. USERS, AUTHENTICATION & SETTINGS
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'project_manager', 'team_member');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('Active', 'Inactive', 'Suspended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'team_member',
    designation VARCHAR(150) NOT NULL DEFAULT 'Team Contributor',
    department VARCHAR(100) NOT NULL DEFAULT 'Engineering',
    status user_status NOT NULL DEFAULT 'Active',
    avatar_url TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department);

-- User Settings (Dedicated separation of UI / Notification preferences)
CREATE TABLE IF NOT EXISTS user_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    theme VARCHAR(20) NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
    email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    task_assigned_alert BOOLEAN NOT NULL DEFAULT TRUE,
    milestone_deadline_alert BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Refresh tokens for JWT rotation
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    family UUID NOT NULL DEFAULT gen_random_uuid(),
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_ip VARCHAR(45) DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);

-- =============================================================================
-- 2. TEAMS & MEMBERSHIP
-- =============================================================================

CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    department VARCHAR(100) NOT NULL,
    leader_id UUID REFERENCES users(id) ON DELETE SET NULL,
    description TEXT,
    color VARCHAR(20) NOT NULL DEFAULT '#635BFF',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_teams_leader ON teams(leader_id);
CREATE INDEX IF NOT EXISTS idx_teams_dept ON teams(department);

-- Junction: Team Members (Many-to-Many between Users and Teams)
CREATE TABLE IF NOT EXISTS team_members (
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);

-- =============================================================================
-- 3. PROJECTS & PORTFOLIO
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE project_priority AS ENUM ('Low', 'Medium', 'High', 'Urgent');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE project_status AS ENUM ('Planning', 'In Progress', 'In Review', 'Completed', 'Overdue');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
    primary_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    priority project_priority NOT NULL DEFAULT 'Medium',
    status project_status NOT NULL DEFAULT 'Planning',
    start_date DATE NOT NULL,
    due_date DATE NOT NULL,
    progress INT NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    budget NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (budget >= 0),
    spent NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (spent >= 0),
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_projects_manager ON projects(manager_id);
CREATE INDEX IF NOT EXISTS idx_projects_primary_team ON projects(primary_team_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_priority ON projects(priority);
CREATE INDEX IF NOT EXISTS idx_projects_due_date ON projects(due_date);

-- Junction: Project Teams (Multi-team allocation support)
CREATE TABLE IF NOT EXISTS project_teams (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (project_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_project_teams_team ON project_teams(team_id);

-- =============================================================================
-- 4. TASKS, SUBTASKS & COMMENTS
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE task_priority AS ENUM ('Low', 'Medium', 'High', 'Urgent');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE task_status AS ENUM ('Backlog', 'To Do', 'In Progress', 'In Review', 'Blocked', 'Completed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    priority task_priority NOT NULL DEFAULT 'Medium',
    status task_status NOT NULL DEFAULT 'To Do',
    start_date DATE DEFAULT NULL,
    due_date DATE NOT NULL,
    progress INT NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    labels TEXT[] DEFAULT ARRAY[]::TEXT[],
    kanban_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_team ON tasks(team_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_kanban ON tasks(project_id, status, kanban_order);

-- Subtasks Checklist
CREATE TABLE IF NOT EXISTS subtasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subtasks_task ON subtasks(task_id);

-- Task Comments Feed
CREATE TABLE IF NOT EXISTS task_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_created ON task_comments(created_at);

-- =============================================================================
-- 5. DOCUMENTS & IN-DATABASE BYTEA STORAGE
-- =============================================================================

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    folder VARCHAR(100) NOT NULL DEFAULT 'Engineering Specs',
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 15728640), -- Max 15MB
    mime_type VARCHAR(100) NOT NULL DEFAULT 'application/octet-stream',
    file_data BYTEA NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Strict BYTEA payload validation: size_bytes must equal octet_length of file_data
    CONSTRAINT chk_documents_bytea_size CHECK (size_bytes = octet_length(file_data))
);

CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_author ON documents(author_id);
CREATE INDEX IF NOT EXISTS idx_documents_folder ON documents(folder);
-- Separate metadata index: Never load BYTEA column on list queries
CREATE INDEX IF NOT EXISTS idx_documents_listing ON documents(id, name, folder, size_bytes, mime_type, project_id, author_id, updated_at);

-- =============================================================================
-- 6. CALENDAR & MILESTONES
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE calendar_event_type AS ENUM ('meeting', 'milestone', 'deadline');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    type calendar_event_type NOT NULL DEFAULT 'meeting',
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    location VARCHAR(255) DEFAULT 'Virtual',
    creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_events_start_date ON calendar_events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_project ON calendar_events(project_id);

-- Calendar Event Attendees (Many-to-Many)
CREATE TABLE IF NOT EXISTS calendar_event_attendees (
    event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_attendees_user ON calendar_event_attendees(user_id);

-- =============================================================================
-- 7. MESSAGING & CHAT
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE conversation_type AS ENUM ('project', 'team', 'direct');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    type conversation_type NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    last_message TEXT DEFAULT NULL,
    last_message_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(type);
CREATE INDEX IF NOT EXISTS idx_conversations_project ON conversations(project_id);
CREATE INDEX IF NOT EXISTS idx_conversations_team ON conversations(team_id);

CREATE TABLE IF NOT EXISTS conversation_participants (
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_participants_user ON conversation_participants(user_id);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages(conversation_id, created_at ASC);

-- Normalized Emoji Reactions
CREATE TABLE IF NOT EXISTS message_reactions (
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_reactions_message ON message_reactions(message_id);

-- =============================================================================
-- 8. NOTIFICATIONS & ANNOUNCEMENTS
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM ('task', 'project', 'deadline', 'announcement', 'mention');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type notification_type NOT NULL DEFAULT 'task',
    link VARCHAR(255) DEFAULT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    tag VARCHAR(50) NOT NULL DEFAULT 'General',
    target_department VARCHAR(100) DEFAULT NULL, -- NULL indicates company-wide
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    published_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_announcements_published ON announcements(published_date DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_department ON announcements(target_department);

-- User Read Tracking for Announcements
CREATE TABLE IF NOT EXISTS announcement_reads (
    announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (announcement_id, user_id)
);

-- =============================================================================
-- 9. AUDIT & ACTIVITY LOGS
-- =============================================================================

CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);

-- =============================================================================
-- 10. SEED OWNERSHIP REGISTRY
-- Tracks records created or managed by development seed datasets.
-- Protects user-created records from accidental deletion or modification.
-- =============================================================================

CREATE TABLE IF NOT EXISTS seed_ownership_registry (
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255) NOT NULL, -- UUID or composite key string (e.g., 'team_id:user_id')
    registered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_seed_registry_type ON seed_ownership_registry(entity_type);

-- =============================================================================
-- 11. AUTOMATED TIMESTAMP & SYNCHRONIZATION TRIGGERS
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Table- and schema-specific trigger existence checks
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE trigger_schema = CURRENT_SCHEMA() AND event_object_table = 'users' AND trigger_name = 'trg_users_updated_at'
    ) THEN
        CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE trigger_schema = CURRENT_SCHEMA() AND event_object_table = 'user_settings' AND trigger_name = 'trg_user_settings_updated_at'
    ) THEN
        CREATE TRIGGER trg_user_settings_updated_at BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE trigger_schema = CURRENT_SCHEMA() AND event_object_table = 'teams' AND trigger_name = 'trg_teams_updated_at'
    ) THEN
        CREATE TRIGGER trg_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE trigger_schema = CURRENT_SCHEMA() AND event_object_table = 'projects' AND trigger_name = 'trg_projects_updated_at'
    ) THEN
        CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE trigger_schema = CURRENT_SCHEMA() AND event_object_table = 'tasks' AND trigger_name = 'trg_tasks_updated_at'
    ) THEN
        CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE trigger_schema = CURRENT_SCHEMA() AND event_object_table = 'subtasks' AND trigger_name = 'trg_subtasks_updated_at'
    ) THEN
        CREATE TRIGGER trg_subtasks_updated_at BEFORE UPDATE ON subtasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE trigger_schema = CURRENT_SCHEMA() AND event_object_table = 'documents' AND trigger_name = 'trg_documents_updated_at'
    ) THEN
        CREATE TRIGGER trg_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE trigger_schema = CURRENT_SCHEMA() AND event_object_table = 'calendar_events' AND trigger_name = 'trg_calendar_events_updated_at'
    ) THEN
        CREATE TRIGGER trg_calendar_events_updated_at BEFORE UPDATE ON calendar_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Automated trigger to create user_settings row upon user insertion
CREATE OR REPLACE FUNCTION create_default_user_settings()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_settings (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE trigger_schema = CURRENT_SCHEMA() AND event_object_table = 'users' AND trigger_name = 'trg_users_create_settings'
    ) THEN
        CREATE TRIGGER trg_users_create_settings AFTER INSERT ON users FOR EACH ROW EXECUTE FUNCTION create_default_user_settings();
    END IF;
END $$;

-- Automated synchronization semantics between primary_team_id and project_teams:
-- Additive guarantee: Setting or updating primary_team_id on a project guarantees the primary team
-- exists in project_teams without ever deleting or mutating any legitimate additional team assignments.
CREATE OR REPLACE FUNCTION sync_project_primary_team()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.primary_team_id IS NOT NULL THEN
        INSERT INTO project_teams (project_id, team_id)
        VALUES (NEW.id, NEW.primary_team_id)
        ON CONFLICT (project_id, team_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE trigger_schema = CURRENT_SCHEMA() AND event_object_table = 'projects' AND trigger_name = 'trg_projects_sync_primary_team'
    ) THEN
        CREATE TRIGGER trg_projects_sync_primary_team AFTER INSERT OR UPDATE OF primary_team_id ON projects FOR EACH ROW EXECUTE FUNCTION sync_project_primary_team();
    END IF;
END $$;
