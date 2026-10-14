-- Migration 093: integração com o Microsoft Clarity (comportamento na LP).
--
-- A API de exportação do Clarity só devolve as últimas 24h a 3 dias e limita a
-- 10 chamadas por dia por projeto. Por isso uma rotina diária (/api/clarity,
-- cron da Vercel) grava uma foto por dia e dimensão aqui, e a Área do Cliente
-- lê só desta tabela.
--
-- clarity_conexoes guarda o token da API (segredo): RLS ligada e SEM policy,
-- então só a chave de serviço das funções /api/* lê. O front nunca vê o token.

create table if not exists public.clarity_conexoes (
  project_id      uuid primary key references public.projects_v2(id) on delete cascade,
  api_token       text not null,
  ativo           boolean not null default true,
  ultimo_sync     timestamptz,
  ultimo_erro     text,
  chamadas_dia    date,              -- dia (BRT) a que chamadas_hoje se refere
  chamadas_hoje   int not null default 0,
  created_at      timestamptz not null default now()
);

alter table public.clarity_conexoes enable row level security;

create table if not exists public.clarity_snapshots (
  project_id   uuid not null references public.projects_v2(id) on delete cascade,
  dia          date not null,        -- dia (BRT) da coleta; janela = últimas 24h até coletado_em
  dimensao     text not null,        -- 'url' | 'device' | 'origem' | 'campanha'
  dados        jsonb not null,       -- resposta crua do Clarity (lista de métricas)
  coletado_em  timestamptz not null default now(),
  primary key (project_id, dia, dimensao)
);

create index if not exists idx_clarity_snapshots_dia on public.clarity_snapshots(project_id, dia desc);

alter table public.clarity_snapshots enable row level security;

-- Métricas de comportamento: o time logado só lê (a escrita é da função, com a chave de serviço).
create policy "clarity_snapshots_team_read"
  on public.clarity_snapshots for select
  to authenticated using (true);
