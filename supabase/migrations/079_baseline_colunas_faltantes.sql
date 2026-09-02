-- Migration 079: sincroniza o histórico de migrations com o schema real
--
-- Estas 5 colunas existem em produção desde sempre, mas foram criadas direto no
-- banco — nenhuma migration as declara. Quem subisse o schema do zero (branch do
-- Supabase, ambiente novo, projeto de dev) ficava sem elas, e todos os módulos
-- públicos quebravam sem erro óbvio: client_share_token é o que autentica
-- /nps/:token, /campanhas/:token, /webinar/:token e os formulários do cliente.
--
-- Tipos conferidos contra a produção em 2026-09-02. No-op onde já existem.
--
-- Nota: client_share_token é TEXT, não UUID, embora o frontend sempre grave um
-- crypto.randomUUID(). Mantido TEXT de propósito — "corrigir" para UUID aqui
-- criaria divergência entre este arquivo e o banco real.

-- O UNIQUE em client_share_token reproduz o que a produção já tem
-- (índice projects_v2_client_share_token_key). Ele importa: o token é a única
-- credencial dos módulos públicos, e dois projetos com o mesmo token fariam um
-- cliente enxergar os dados do outro.
ALTER TABLE projects_v2
  ADD COLUMN IF NOT EXISTS client_share_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS crm_data           JSONB,
  ADD COLUMN IF NOT EXISTS dashboard_url      TEXT,
  ADD COLUMN IF NOT EXISTS promessa           JSONB,
  ADD COLUMN IF NOT EXISTS risk_level         TEXT;
