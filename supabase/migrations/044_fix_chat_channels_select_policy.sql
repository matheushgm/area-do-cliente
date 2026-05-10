-- Migration 044: corrige RLS de chat_channels permitindo o criador ler
-- a row recém-criada antes de adicionar membros (necessário para
-- INSERT ... RETURNING via PostgREST).

DROP POLICY IF EXISTS chat_channels_select ON chat_channels;
CREATE POLICY chat_channels_select ON chat_channels
  FOR SELECT
  USING (is_channel_member(id) OR created_by = auth.uid());

DROP POLICY IF EXISTS chat_members_select ON chat_channel_members;
CREATE POLICY chat_members_select ON chat_channel_members
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR is_channel_member(channel_id)
    OR EXISTS (
      SELECT 1 FROM chat_channels c
      WHERE c.id = chat_channel_members.channel_id
        AND c.created_by = auth.uid()
    )
  );
