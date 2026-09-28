-- 090: Portal do cliente / parceiro — chaves de acesso por projeto
--
-- Cada linha de project_shares é uma "chave" de compartilhamento de UM projeto:
-- rótulo (ex.: "Parceiro X", "Cliente"), senha (hash keyed com o segredo do
-- servidor — ver api/portal.js), módulos liberados e permissão por módulo
-- (`permissions` = { "<modulo>": "view" | "edit" }; módulo ausente = sem acesso).
--
-- O portal (/portal/:projectId) NÃO usa Supabase Auth: o visitante digita a
-- senha, api/portal.js confere o hash e emite um token de sessão assinado.
-- Por isso a tabela fica com RLS ligada e SEM policies: só a chave de serviço
-- (api/portal.js) lê e escreve. A gestão pelo time também passa pela API, que
-- confere se o usuário é admin ou membro do squad do projeto.

CREATE TABLE IF NOT EXISTS project_shares (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID NOT NULL REFERENCES projects_v2(id) ON DELETE CASCADE,
  label          TEXT NOT NULL,
  password_hash  TEXT NOT NULL,
  enabled        BOOLEAN NOT NULL DEFAULT true,
  permissions    JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at     TIMESTAMPTZ,
  last_access_at TIMESTAMPTZ,
  access_count   INTEGER NOT NULL DEFAULT 0,
  created_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_shares_project_id ON project_shares(project_id);

DROP TRIGGER IF EXISTS trg_project_shares_updated_at ON project_shares;
CREATE TRIGGER trg_project_shares_updated_at
  BEFORE UPDATE ON project_shares
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE project_shares ENABLE ROW LEVEL SECURITY;
-- Sem policies de propósito: acesso exclusivo pela chave de serviço.

-- Tentativas de senha (limite de força bruta por projeto + IP).
-- api/portal.js conta as falhas dos últimos 15 min e bloqueia a partir de 8.
CREATE TABLE IF NOT EXISTS portal_login_attempts (
  id         BIGSERIAL PRIMARY KEY,
  project_id UUID NOT NULL,
  ip         TEXT NOT NULL,
  ok         BOOLEAN NOT NULL DEFAULT false,
  at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_login_attempts_lookup
  ON portal_login_attempts(project_id, ip, at DESC);

ALTER TABLE portal_login_attempts ENABLE ROW LEVEL SECURITY;
-- Sem policies de propósito: acesso exclusivo pela chave de serviço.
