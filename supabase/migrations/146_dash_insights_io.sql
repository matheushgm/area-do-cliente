-- 146 · dash_insights: menos escrita e menos leitura de disco (2026-11-26)
--
-- Aviso do Supabase em 26/11/2026: o projeto esgotou o orçamento de Disk IO (instância
-- Micro, 1 GB) e o banco passou a dar statement timeout a partir das 8h. Medido no
-- pg_stat_statements (desde 10/03/2026):
--   * o coletor (`dashboard-api`, de hora em hora) faz upsert `merge-duplicates` dos
--     últimos 8 dias: 28 milhões de UPDATE em 346 mil linhas (~80 por linha) e 71 GB de
--     WAL, quase tudo regravando a linha igual;
--   * as leituras fatiadas por dia (`day` gte/lt + order=row_key) ordenavam o jsonb em
--     arquivo temporário (work_mem de 2 MB) a cada página: 1,6 TB de temp no total.
--
-- Aplicar em produção em TRÊS execuções separadas no SQL Editor (o CREATE INDEX
-- CONCURRENTLY não roda dentro de transação nem junto de outros comandos):
--   1) a parte 1;   2) só o CREATE INDEX CONCURRENTLY;   3) a parte 3.

-- ── Parte 1 · gatilho que descarta o UPDATE quando a linha chega igual ──────────────
-- Com ON CONFLICT DO UPDATE, um BEFORE UPDATE que devolve NULL pula a escrita (sem
-- nova versão da linha, sem WAL, sem mexer nos índices). O coletor usa return=minimal
-- e conta o lote pelo status HTTP, então não percebe diferença. O `updated_at` da
-- tabela já não era atualizado pelo upsert (ver CLAUDE.md), nada depende dele.
-- Desfazer: drop trigger trg_dash_insights_pula_igual on public.dash_insights;
create or replace function public.dash_insights_pula_igual()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  return null;
end;
$$;

drop trigger if exists trg_dash_insights_pula_igual on public.dash_insights;
create trigger trg_dash_insights_pula_igual
  before update on public.dash_insights
  for each row
  when (
    old.data is not distinct from new.data
    and old.day is not distinct from new.day
    and old.account is not distinct from new.account
  )
  execute function public.dash_insights_pula_igual();

-- ── Parte 2 · índice para a fatia por dia sair na ordem, sem ordenar em disco ───────
-- O /api/dash-data pede order=day.asc,row_key.asc nas fatias.
create index concurrently if not exists dash_insights_channel_day_rowkey_idx
  on public.dash_insights (channel, day, row_key);

-- ── Parte 3 · índices que são prefixo de outro (só custavam escrita) ────────────────
--   (channel, day)     → coberto por (channel, day, row_key)
--   (channel, account) → coberto por (channel, account, day) e (channel, account, row_key)
drop index if exists public.dash_insights_channel_day_idx;
drop index if exists public.dash_insights_channel_account_idx;
