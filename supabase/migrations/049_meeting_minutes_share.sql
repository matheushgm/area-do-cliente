-- Migration 049: link compartilhável de ata de reunião com assinatura do cliente
--
-- share_token             — UUID único; presença habilita o link público
-- client_acknowledgements — { [sectionId]: true, ["action:" + actionId]: true }
-- client_signature        — { name, signedAt, userAgent? }
ALTER TABLE meeting_minutes
  ADD COLUMN IF NOT EXISTS share_token UUID UNIQUE,
  ADD COLUMN IF NOT EXISTS client_acknowledgements JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS client_signature JSONB;
