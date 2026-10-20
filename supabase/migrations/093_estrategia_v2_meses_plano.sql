-- Migration 093: estrategia_v2.meses_plano
-- "Vitórias & Metas por Mês" (EstrategiaV2Module) ficava só no estado local/localStorage:
-- o upsert em AppContext não enviava o campo e a tabela não tinha coluna, então o texto
-- sumia ao recarregar do Supabase. Formato: [{ "vitorias": "...", "metas": "..." } x3].

ALTER TABLE estrategia_v2
  ADD COLUMN IF NOT EXISTS meses_plano JSONB;
