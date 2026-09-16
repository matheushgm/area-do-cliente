-- Migration 087: contagem de não lidas por canal para o usuário atual
-- (mensagens de outras pessoas depois do last_read_at da minha associação).
CREATE OR REPLACE FUNCTION chat_unread_counts()
RETURNS TABLE (channel_id UUID, unread BIGINT, mentions BIGINT) AS $$
  SELECT m.channel_id,
         count(*)                                                    AS unread,
         count(*) FILTER (WHERE auth.uid() = ANY(m.mentioned_user_ids)) AS mentions
    FROM chat_channel_members cm
    JOIN chat_messages m
      ON m.channel_id = cm.channel_id
     AND m.created_at > COALESCE(cm.last_read_at, 'epoch'::timestamptz)
     AND m.user_id IS DISTINCT FROM auth.uid()
   WHERE cm.user_id = auth.uid()
   GROUP BY m.channel_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;
