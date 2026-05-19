-- Migration 050: assinaturas internas na ata (Account Manager + Gestor de Tráfego)
--
-- Junto com client_signature (já existente), forma o trio que valida a ata.
-- Shape: { account_manager: { name, signedAt, userId }, trafego: { name, signedAt, userId } }
ALTER TABLE meeting_minutes
  ADD COLUMN IF NOT EXISTS internal_signatures JSONB NOT NULL DEFAULT '{}'::jsonb;
