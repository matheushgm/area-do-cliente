-- Migration 076: ClickUp chat channel field
-- Guarda o ID do canal de chat criado automaticamente junto com a pasta/lista
-- do cliente no ClickUp (mesmo nome da pasta). Ver migration 033.

ALTER TABLE projects_v2 ADD COLUMN IF NOT EXISTS clickup_chat_channel_id TEXT;
