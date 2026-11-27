-- 150 · dash_insights: orçamento da Meta sem ler o snapshot inteiro + tabela reescrita em ordem (2026-11-27)
--
-- Diagnóstico de 27/11 (depois do upgrade para Micro): o saldo de Disk IO voltou a 99%, mas a
-- máquina segue com ~400 MB em swap e houve 2 picos de statement timeout (07:50 e 10:57 SP), todos
-- leituras da dash_insights. Causa: os dados que as telas pedem estão espalhados pela tabela.
--   * meta_status: 7.720 linhas, 2,6 MB de dados em 5.209 páginas (41 MB lidos para entregar 2,6 MB);
--   * Meta dos últimos 20 dias: 16 mil linhas, 26 MB em 10.228 páginas (80 MB).
-- A home, a Central de Otimizações, a página do cliente (useDashboardData com `status: true`) e o
-- agente (scripts/otimizacoes_pendentes.mjs) liam o snapshot inteiro ~200 vezes por dia só para
-- tirar o orçamento de campanhas e conjuntos (orcamentosDoStatus).
--
-- 1) dash_orcamentos_meta(p_contas): só as linhas de campanha/conjunto com tipo de orçamento
--    (ABO/CBO) ou valor, com os 5 campos que orcamentosDoStatus lê, num jsonb só (sem o teto de 1000
--    linhas do PostgREST). security invoker: vale a RLS da dash_insights (o usuário só VertaTask
--    recebe vazio). Mudou orcamentosDoStatus (src/lib/playbookSugestoes.js), mude aqui.
-- 2) fillfactor 85 + CLUSTER pelo índice (channel, day, row_key): junta cada canal e cada dia. O
--    fillfactor deixa folga para o UPDATE do coletor ficar na mesma página (HOT: nenhuma coluna
--    indexada muda), então a ordem se mantém. O CLUSTER trava a tabela (ACCESS EXCLUSIVE) enquanto
--    reescreve; rodar fora do minuto 17 (coletor do GitHub Actions). Linha nova (dia novo) entra no
--    fim, já junta das outras do mesmo dia. Se a dispersão voltar, rodar o CLUSTER de novo.

create or replace function public.dash_orcamentos_meta(p_contas text[] default null)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'ID', data->>'ID',
           'Nível', data->>'Nível',
           'Orçamento', data->>'Orçamento',
           'Orçamento diário', data->>'Orçamento diário',
           'Orçamento total', data->>'Orçamento total'))), '[]'::jsonb)
    from public.dash_insights
   where channel = 'meta_status'
     and (p_contas is null or account = any(p_contas))
     and data->>'Nível' in ('campanha', 'conjunto')
     and coalesce(data->>'ID', '') <> ''
     and (coalesce(data->>'Orçamento', '') <> ''
          or coalesce(data->>'Orçamento diário', '') <> ''
          or coalesce(data->>'Orçamento total', '') <> '')
$$;

revoke all on function public.dash_orcamentos_meta(text[]) from public, anon;
grant execute on function public.dash_orcamentos_meta(text[]) to authenticated, service_role;

alter table public.dash_insights set (fillfactor = 85);

-- Rodado à mão em 27/11/2026, fora da transação da migration (trava a tabela):
--   set lock_timeout = '10s';
--   cluster public.dash_insights using dash_insights_channel_day_rowkey_idx;
--   analyze public.dash_insights;
