-- Migration 041: chat estilo Slack (canais + DMs + mensagens)

-- Canais (incluindo DMs)
CREATE TABLE IF NOT EXISTS chat_channels (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT,
  type        TEXT NOT NULL CHECK (type IN ('channel', 'dm')),
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Membros
CREATE TABLE IF NOT EXISTS chat_channel_members (
  channel_id   UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);

-- Mensagens
CREATE TABLE IF NOT EXISTS chat_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  content    TEXT NOT NULL,
  edited_at  TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_channel  ON chat_messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_members_user      ON chat_channel_members(user_id);

-- Helper: o usuário atual é membro do canal?
CREATE OR REPLACE FUNCTION is_channel_member(channel UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_channel_members
    WHERE channel_id = channel AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- RLS
ALTER TABLE chat_channels        ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages        ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_channels_select ON chat_channels FOR SELECT USING (is_channel_member(id));
CREATE POLICY chat_channels_insert ON chat_channels FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY chat_channels_update ON chat_channels FOR UPDATE USING (created_by = auth.uid());
CREATE POLICY chat_channels_delete ON chat_channels FOR DELETE USING (created_by = auth.uid());

CREATE POLICY chat_members_select ON chat_channel_members FOR SELECT USING (is_channel_member(channel_id));
CREATE POLICY chat_members_insert ON chat_channel_members FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY chat_members_update ON chat_channel_members FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY chat_members_delete ON chat_channel_members FOR DELETE USING (user_id = auth.uid() OR is_channel_member(channel_id));

CREATE POLICY chat_messages_select ON chat_messages FOR SELECT USING (is_channel_member(channel_id));
CREATE POLICY chat_messages_insert ON chat_messages FOR INSERT WITH CHECK (is_channel_member(channel_id) AND user_id = auth.uid());
CREATE POLICY chat_messages_update ON chat_messages FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY chat_messages_delete ON chat_messages FOR DELETE USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_channels;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_channel_members;

-- Seed: canal #geral com todos os profiles ativos
DO $$
DECLARE
  geral_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM chat_channels WHERE type = 'channel' AND name = 'geral') THEN
    INSERT INTO chat_channels (name, type) VALUES ('geral', 'channel') RETURNING id INTO geral_id;
    INSERT INTO chat_channel_members (channel_id, user_id)
    SELECT geral_id, id FROM profiles WHERE disabled = false;
  END IF;
END $$;
