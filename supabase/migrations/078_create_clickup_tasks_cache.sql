-- Migration 078: cache local das tarefas do ClickUp (módulo Capacidade do Time)
--
-- Espelha as tarefas do workspace num formato achatado, para que a UI leia
-- daqui e NUNCA do ClickUp direto. Isso desacopla o custo de requisição do
-- número de usuários: 1 pessoa ou 20 abrindo a página custam zero chamadas
-- ao ClickUp. Quem escreve é sempre o servidor (service key), via:
--   • api/clickup-webhook.js — push do ClickUp em tempo real (delta por task)
--   • api/clickup-sync.js    — sync incremental/full de reconciliação
--
-- Ver CLAUDE.md › "Capacidade do Time — sync do ClickUp".

CREATE TABLE IF NOT EXISTS clickup_tasks (
  task_id           TEXT PRIMARY KEY,
  name              TEXT,
  url               TEXT,

  -- Status: guardamos o texto cru do ClickUp, o `type` nativo (open/custom/
  -- closed/done) e o bucket normalizado usado pela UI. A normalização é feita
  -- no servidor (normalizeBucket em api/_clickup.js) porque os nomes reais
  -- trazem emoji e acento ('💡 backlog', 'em revisão').
  status            TEXT,
  status_type       TEXT,
  status_bucket     TEXT,   -- backlog | a_fazer | em_progresso | em_revisao | concluido | outro
  closed            BOOLEAN NOT NULL DEFAULT FALSE,

  -- Assignees: JSONB preserva {id, username} para render; o array de BIGINT
  -- existe só para indexar (GIN) e filtrar por pessoa sem varrer o JSONB.
  assignees         JSONB   NOT NULL DEFAULT '[]'::JSONB,
  assignee_ids      BIGINT[] NOT NULL DEFAULT '{}',
  creator_id        BIGINT,

  due_date          TIMESTAMPTZ,
  start_date        TIMESTAMPTZ,
  date_created      TIMESTAMPTZ,
  date_updated      TIMESTAMPTZ,
  date_closed       TIMESTAMPTZ,

  -- Em milissegundos, como o ClickUp devolve. Nullable de propósito: a maioria
  -- das tasks não tem estimativa preenchida, e inventar 0 falsearia a carga.
  time_estimate_ms  BIGINT,
  time_spent_ms     BIGINT,

  priority          TEXT,
  parent_id         TEXT,

  list_id           TEXT,
  list_name         TEXT,
  folder_id         TEXT,
  folder_name       TEXT,
  space_id          TEXT,
  space_name        TEXT,

  tags              TEXT[] NOT NULL DEFAULT '{}',
  archived          BOOLEAN NOT NULL DEFAULT FALSE,

  -- Soft delete: o webhook taskDeleted marca aqui em vez de apagar a linha,
  -- para que um evento fora de ordem não ressuscite a task silenciosamente.
  deleted_at        TIMESTAMPTZ,

  synced_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- 'webhook' | 'sync_full' | 'sync_incremental' — só para diagnóstico.
  sync_source       TEXT
);

-- Consulta dominante da UI: tarefas abertas por pessoa. O índice parcial cobre
-- exatamente esse recorte e fica pequeno mesmo com histórico acumulado.
CREATE INDEX IF NOT EXISTS clickup_tasks_open_assignees_idx
  ON clickup_tasks USING GIN (assignee_ids)
  WHERE closed = FALSE AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS clickup_tasks_due_date_idx
  ON clickup_tasks (due_date)
  WHERE closed = FALSE AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS clickup_tasks_date_updated_idx
  ON clickup_tasks (date_updated DESC);

CREATE INDEX IF NOT EXISTS clickup_tasks_space_idx
  ON clickup_tasks (space_id);

-- ─── Estado do sync ──────────────────────────────────────────────────────────
-- Linha única (id='workspace'). Guarda o cursor do incremental e serve de lock
-- para impedir dois syncs concorrentes queimarem cota do ClickUp em paralelo.
CREATE TABLE IF NOT EXISTS clickup_sync_state (
  id                TEXT PRIMARY KEY,
  last_synced_at    TIMESTAMPTZ,   -- cursor: date_updated_gt do próximo incremental
  last_full_sync_at TIMESTAMPTZ,
  running           BOOLEAN NOT NULL DEFAULT FALSE,
  running_since     TIMESTAMPTZ,
  last_error        TEXT,
  last_result       JSONB,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO clickup_sync_state (id) VALUES ('workspace')
  ON CONFLICT (id) DO NOTHING;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Leitura para qualquer autenticado (a página é interna, todo o time usa).
-- Escrita: nenhuma policy — só a service key (que bypassa RLS) escreve, ou
-- seja, apenas as Edge Functions. Isso substitui o dashboard.html estático,
-- que era servido em public/ sem autenticação nenhuma.
ALTER TABLE clickup_tasks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE clickup_sync_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clickup_tasks_select ON clickup_tasks;
CREATE POLICY clickup_tasks_select ON clickup_tasks
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS clickup_sync_state_select ON clickup_sync_state;
CREATE POLICY clickup_sync_state_select ON clickup_sync_state
  FOR SELECT TO authenticated USING (TRUE);

-- Realtime: o front assina mudanças em clickup_tasks para refletir na hora o
-- que o webhook gravar, sem polling.
ALTER PUBLICATION supabase_realtime ADD TABLE clickup_tasks;
