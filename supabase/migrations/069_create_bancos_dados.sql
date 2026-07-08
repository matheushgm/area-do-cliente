-- Migration 069: "Banco de dados" — planilhas de captação de leads.
-- Cada banco = uma "planilha" com campos personalizáveis (inclui dropdown) e um
-- token de ingestão (webhook). Inserts de lead chegam pelo endpoint público
-- /api/lead-capture (service role, ignora RLS); o time gerencia autenticado.
create table if not exists public.bancos_dados (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references projects_v2(id) on delete cascade,   -- opcional: a qual cliente pertence
  nome          text not null,
  descricao     text,
  campos        jsonb not null default '[]',   -- [{ key, label, type, options[] }]
  ingest_token  text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.bancos_dados_registros (
  id          uuid primary key default gen_random_uuid(),
  banco_id    uuid not null references public.bancos_dados(id) on delete cascade,
  dados       jsonb not null default '{}',      -- { [fieldKey]: valor } + payload cru extra
  origem      text not null default 'webhook',  -- webhook | manual
  created_at  timestamptz not null default now()
);

create index if not exists idx_bdr_banco on public.bancos_dados_registros (banco_id, created_at desc);

alter table public.bancos_dados enable row level security;
alter table public.bancos_dados_registros enable row level security;

-- Ferramenta interna do time: acesso total para autenticados.
-- (Inserts de lead vêm via service role no endpoint público, que ignora RLS.)
create policy "bancos_dados_all_authenticated"
  on public.bancos_dados for all
  to authenticated using (true) with check (true);

create policy "bancos_dados_registros_all_authenticated"
  on public.bancos_dados_registros for all
  to authenticated using (true) with check (true);
