-- Migration 094: VertaTask (evolução do módulo Tarefas)
--
-- Acrescenta ao módulo /tarefas três conceitos inspirados no Plane:
--   * Cycles  (tarefas_ciclos):  sprints com início e fim, com burndown
--   * Modules (tarefas_modulos): agrupam tarefas de uma mesma entrega
--   * Intake  (tarefas_intake):  fila de pedidos que ainda não viraram tarefa
-- A tarefa ganha ciclo_id e modulo_id. Nada do que existe é alterado: a
-- sincronização com o ClickUp não escreve nas colunas novas.

create table if not exists public.tarefas_ciclos (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  inicio      date not null,
  fim         date not null check (fim >= inicio),
  arquivado   boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.tarefas_modulos (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  descricao   text,
  project_id  uuid references public.projects_v2(id) on delete set null,  -- cliente, opcional
  arquivado   boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_tarefas_modulos_project on public.tarefas_modulos(project_id);

alter table public.tarefas_itens
  add column if not exists ciclo_id  uuid references public.tarefas_ciclos(id)  on delete set null,
  add column if not exists modulo_id uuid references public.tarefas_modulos(id) on delete set null;
create index if not exists idx_tarefas_itens_ciclo  on public.tarefas_itens(ciclo_id)  where ciclo_id  is not null;
create index if not exists idx_tarefas_itens_modulo on public.tarefas_itens(modulo_id) where modulo_id is not null;

create table if not exists public.tarefas_intake (
  id             uuid primary key default gen_random_uuid(),
  titulo         text not null,
  descricao      text,
  origem         text not null default 'Manual',   -- ex.: Aprovação de anúncios, Central de Otimizações, Cliente, Manual
  origem_ref     text unique,                      -- chave de idempotência de quem alimenta a fila (opcional)
  project_id     uuid references public.projects_v2(id) on delete set null,
  prioridade     text check (prioridade in ('urgent', 'high', 'normal', 'low')),
  status         text not null default 'pendente' check (status in ('pendente', 'aceito', 'recusado')),
  tarefa_id      uuid references public.tarefas_itens(id) on delete set null,
  motivo_recusa  text,
  payload        jsonb not null default '{}'::jsonb,
  criado_por     uuid references public.profiles(id) on delete set null,
  decidido_por   uuid references public.profiles(id) on delete set null,
  decidido_em    timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists idx_tarefas_intake_status on public.tarefas_intake(status, created_at desc);

-- RLS: ferramenta interna, todo o time logado lê e escreve (igual às demais tabelas tarefas_*).
alter table public.tarefas_ciclos  enable row level security;
alter table public.tarefas_modulos enable row level security;
alter table public.tarefas_intake  enable row level security;

drop policy if exists "tarefas_ciclos_team" on public.tarefas_ciclos;
create policy "tarefas_ciclos_team" on public.tarefas_ciclos
  for all to authenticated using (true) with check (true);
drop policy if exists "tarefas_modulos_team" on public.tarefas_modulos;
create policy "tarefas_modulos_team" on public.tarefas_modulos
  for all to authenticated using (true) with check (true);
drop policy if exists "tarefas_intake_team" on public.tarefas_intake;
create policy "tarefas_intake_team" on public.tarefas_intake
  for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table public.tarefas_ciclos;
alter publication supabase_realtime add table public.tarefas_modulos;
alter publication supabase_realtime add table public.tarefas_intake;
