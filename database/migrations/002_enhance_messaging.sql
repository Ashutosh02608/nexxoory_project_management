-- Migration: 002_enhance_messaging.sql
-- Add 'department' and 'announcements' to conversation_type enum
ALTER TYPE conversation_type ADD VALUE IF NOT EXISTS 'department';
ALTER TYPE conversation_type ADD VALUE IF NOT EXISTS 'announcements';

-- Add department and metadata columns to conversations
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS department VARCHAR(100) DEFAULT NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_read_only BOOLEAN NOT NULL DEFAULT FALSE;

-- Add reply, edit, delete, priority columns to messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS title VARCHAR(255) DEFAULT NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_announcement BOOLEAN NOT NULL DEFAULT FALSE;

-- Ensure pinned and muted support per participant
ALTER TABLE conversation_participants ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE conversation_participants ADD COLUMN IF NOT EXISTS is_muted BOOLEAN NOT NULL DEFAULT FALSE;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_conversations_dept ON conversations(department);
CREATE INDEX IF NOT EXISTS idx_messages_reply ON messages(reply_to_id);

