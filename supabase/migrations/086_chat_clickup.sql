-- Migration 086: chat no modelo do ClickUp Chat
-- Threads (respostas), canais públicos visíveis a todos, favoritos, reações,
-- vínculo com o cliente (projeto) e ids do ClickUp para importação/sincronização.

-- ── Canais ──────────────────────────────────────────────────────────────────
ALTER TABLE chat_channels
  ADD COLUMN IF NOT EXISTS clickup_channel_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS visibility        TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  ADD COLUMN IF NOT EXISTS description       TEXT,
  ADD COLUMN IF NOT EXISTS archived          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS project_id        UUID REFERENCES projects_v2(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_message_at   TIMESTAMPTZ;

-- DMs são sempre privadas
UPDATE chat_channels SET visibility = 'private' WHERE type = 'dm';

-- ── Membros: favoritos ──────────────────────────────────────────────────────
ALTER TABLE chat_channel_members
  ADD COLUMN IF NOT EXISTS favorite BOOLEAN NOT NULL DEFAULT false;

-- ── Mensagens: threads, reações, ids do ClickUp ─────────────────────────────
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS parent_id          UUID REFERENCES chat_messages(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS clickup_message_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS replies_count      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reply_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reactions          JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS attachments        JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_chat_messages_parent ON chat_messages(parent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_root ON chat_messages(channel_id, created_at DESC) WHERE parent_id IS NULL;

-- ── Helpers ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_channel_public(channel UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM chat_channels WHERE id = channel AND visibility = 'public' AND type = 'channel');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Contador de respostas / última resposta / última mensagem do canal
CREATE OR REPLACE FUNCTION fn_chat_message_counters()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.parent_id IS NOT NULL THEN
      UPDATE chat_messages
         SET replies_count = replies_count + 1,
             last_reply_at = GREATEST(COALESCE(last_reply_at, NEW.created_at), NEW.created_at)
       WHERE id = NEW.parent_id;
    END IF;
    UPDATE chat_channels
       SET last_message_at = GREATEST(COALESCE(last_message_at, NEW.created_at), NEW.created_at)
     WHERE id = NEW.channel_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.parent_id IS NOT NULL THEN
      UPDATE chat_messages
         SET replies_count = GREATEST(replies_count - 1, 0),
             last_reply_at = (SELECT max(created_at) FROM chat_messages WHERE parent_id = OLD.parent_id AND id <> OLD.id)
       WHERE id = OLD.parent_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_chat_message_counters ON chat_messages;
CREATE TRIGGER trg_chat_message_counters
  AFTER INSERT OR DELETE ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION fn_chat_message_counters();

-- Notificação de menção: não disparar para mensagens antigas (importação)
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
  IF NEW.created_at < now() - interval '1 hour' THEN
    RETURN NEW;
  END IF;

  SELECT name INTO sender_name FROM profiles WHERE id = NEW.user_id;
  SELECT name, type INTO channel_name, channel_type FROM chat_channels WHERE id = NEW.channel_id;

  link_url := '/chat?channel=' || NEW.channel_id::text
              || CASE WHEN NEW.parent_id IS NOT NULL THEN '&thread=' || NEW.parent_id::text ELSE '' END;

  IF channel_type = 'channel' THEN
    notif_title := COALESCE(sender_name, 'Alguém') || ' mencionou você em #' || COALESCE(channel_name, 'canal');
  ELSE
    notif_title := COALESCE(sender_name, 'Alguém') || ' mencionou você';
  END IF;

  FOREACH mentioned IN ARRAY NEW.mentioned_user_ids LOOP
    IF mentioned <> NEW.user_id THEN
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

-- Reações: qualquer membro alterna o próprio emoji numa mensagem
CREATE OR REPLACE FUNCTION chat_toggle_reaction(p_message UUID, p_emoji TEXT)
RETURNS JSONB AS $$
DECLARE
  cur JSONB;
  users JSONB;
  me TEXT := auth.uid()::text;
  ch UUID;
BEGIN
  SELECT reactions, channel_id INTO cur, ch FROM chat_messages WHERE id = p_message;
  IF cur IS NULL THEN RAISE EXCEPTION 'mensagem não encontrada'; END IF;
  IF NOT (is_channel_member(ch) OR is_channel_public(ch)) THEN RAISE EXCEPTION 'sem acesso'; END IF;
  users := COALESCE(cur -> p_emoji, '[]'::jsonb);
  IF users ? me THEN
    users := (SELECT COALESCE(jsonb_agg(u), '[]'::jsonb) FROM jsonb_array_elements(users) u WHERE u #>> '{}' <> me);
  ELSE
    users := users || to_jsonb(me);
  END IF;
  IF jsonb_array_length(users) = 0 THEN
    cur := cur - p_emoji;
  ELSE
    cur := jsonb_set(cur, ARRAY[p_emoji], users, true);
  END IF;
  UPDATE chat_messages SET reactions = cur WHERE id = p_message;
  RETURN cur;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── RLS: canais públicos são visíveis (e legíveis) por todo o time ──────────
DROP POLICY IF EXISTS chat_channels_select ON chat_channels;
CREATE POLICY chat_channels_select ON chat_channels FOR SELECT
  USING (is_channel_member(id) OR (visibility = 'public' AND type = 'channel' AND auth.role() = 'authenticated'));

DROP POLICY IF EXISTS chat_channels_update ON chat_channels;
CREATE POLICY chat_channels_update ON chat_channels FOR UPDATE
  USING (created_by = auth.uid() OR is_channel_member(id));

DROP POLICY IF EXISTS chat_members_select ON chat_channel_members;
CREATE POLICY chat_members_select ON chat_channel_members FOR SELECT
  USING (is_channel_member(channel_id) OR is_channel_public(channel_id));

DROP POLICY IF EXISTS chat_messages_select ON chat_messages;
CREATE POLICY chat_messages_select ON chat_messages FOR SELECT
  USING (is_channel_member(channel_id) OR is_channel_public(channel_id));

-- Realtime precisa da linha inteira nos UPDATE/DELETE (reações, contadores)
ALTER TABLE chat_messages REPLICA IDENTITY FULL;
