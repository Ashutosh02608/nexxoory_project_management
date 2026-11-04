-- Incremental messaging sync and query-performance indexes.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Keep updated_at current for direct SQL updates as well as API mutations.
CREATE OR REPLACE FUNCTION set_message_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_messages_updated_at ON messages;
CREATE TRIGGER trg_messages_updated_at
BEFORE UPDATE ON messages
FOR EACH ROW EXECUTE FUNCTION set_message_updated_at();

CREATE INDEX IF NOT EXISTS idx_messages_conversation_updated
  ON messages (conversation_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_desc
  ON messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_conversation
  ON conversation_participants (user_id, conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at
  ON conversations (last_message_at DESC NULLS LAST);
