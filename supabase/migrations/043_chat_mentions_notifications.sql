-- Migration 043: menções no chat + sistema de notificações

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS mentioned_user_ids UUID[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT,
  body       TEXT,
  link       TEXT,
  data       JSONB NOT NULL DEFAULT '{}',
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_select ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY notifications_update ON notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY notifications_delete ON notifications FOR DELETE USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION fn_chat_mention_notify()
RETURNS TRIGGER AS $$
DECLARE
  mentioned UUID;
  sender_name TEXT;
  channel_name TEXT;
  channel_type TEXT;
  link_url TEXT;
  notif_title TEXT;
BEGIN
  IF NEW.mentioned_user_ids IS NULL OR array_length(NEW.mentioned_user_ids, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO sender_name FROM profiles WHERE id = NEW.user_id;
  SELECT name, type INTO channel_name, channel_type FROM chat_channels WHERE id = NEW.channel_id;

  link_url := '/chat?channel=' || NEW.channel_id::text;

  IF channel_type = 'channel' THEN
    notif_title := COALESCE(sender_name, 'Alguém') || ' mencionou você em #' || COALESCE(channel_name, 'canal');
  ELSE
    notif_title := COALESCE(sender_name, 'Alguém') || ' mencionou você';
  END IF;

  FOREACH mentioned IN ARRAY NEW.mentioned_user_ids LOOP
    IF mentioned <> NEW.user_id AND EXISTS (
      SELECT 1 FROM chat_channel_members WHERE channel_id = NEW.channel_id AND user_id = mentioned
    ) THEN
      INSERT INTO notifications (user_id, type, title, body, link, data)
      VALUES (
        mentioned,
        'mention',
        notif_title,
        substring(NEW.content from 1 for 200),
        link_url,
        jsonb_build_object('channel_id', NEW.channel_id, 'message_id', NEW.id, 'sender_id', NEW.user_id)
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_chat_mention_notify ON chat_messages;
CREATE TRIGGER trg_chat_mention_notify
  AFTER INSERT ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION fn_chat_mention_notify();

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
