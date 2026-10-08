-- Migration 092: central de Otimizações (sugestões do playbook de todos os
-- clientes numa tela só, com aceitar / recusar).
--
-- A tabela projeto_sugestoes passa a ser o histórico de decisões que uma
-- automação vai ler pra executar a otimização no Meta/Google:
--   * status 'recusada' (além de aceita/descartada): o gestor disse não e
--     registrou o motivo; não volta a aparecer.
--   * canal / conta / entidade copiados do payload pra consulta direta por SQL.
--   * execucao_status: 'pendente' quando aceita (fila da automação),
--     'executada' / 'erro' quando o robô agir, com log em execucao_log.

alter table public.projeto_sugestoes
  drop constraint if exists projeto_sugestoes_status_check;
alter table public.projeto_sugestoes
  add constraint projeto_sugestoes_status_check
  check (status in ('aceita', 'descartada', 'recusada'));

alter table public.projeto_sugestoes
  add column if not exists motivo           text,
  add column if not exists canal            text check (canal in ('meta', 'google')),
  add column if not exists conta            text,
  add column if not exists campanha         text,
  add column if not exists conjunto         text,
  add column if not exists anuncio          text,
  add column if not exists ad_id            text,
  add column if not exists acao             text,
  add column if not exists decidida_em      timestamptz not null default now(),
  add column if not exists decidida_por     text,
  add column if not exists execucao_status  text check (execucao_status in ('pendente', 'executada', 'erro', 'cancelada')),
  add column if not exists executada_em     timestamptz,
  add column if not exists execucao_log     jsonb;

create index if not exists idx_projeto_sugestoes_fila
  on public.projeto_sugestoes(execucao_status, decidida_em desc)
  where execucao_status = 'pendente';

create index if not exists idx_projeto_sugestoes_decidida
  on public.projeto_sugestoes(decidida_em desc);
