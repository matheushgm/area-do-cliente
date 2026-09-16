-- Migration 084: módulo Tarefas (réplica do ClickUp dentro da Área do Cliente)
--
-- Hierarquia igual à do ClickUp: Pasta (uma por cliente) → Lista → Tarefa
-- (com subtarefas) → Comentários. As tarefas existentes do ClickUp são
-- importadas por scripts/importar_clickup_tarefas.mjs, que preenche os
-- campos clickup_* para permitir reimportar sem duplicar.

create table if not exists public.tarefas_pastas (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid references public.projects_v2(id) on delete set null,
  nome               text not null,
  clickup_folder_id  text unique,
  posicao            numeric not null default 0,
  arquivada          boolean not null default false,
  created_at         timestamptz not null default now()
);
create index if not exists idx_tarefas_pastas_project on public.tarefas_pastas(project_id);

create table if not exists public.tarefas_listas (
  id               uuid primary key default gen_random_uuid(),
  pasta_id         uuid references public.tarefas_pastas(id) on delete cascade, -- null = lista solta
  nome             text not null,
  descricao        text,
  clickup_list_id  text unique,
  -- [{ key, label, cor, tipo: 'open'|'custom'|'closed', ordem }]
  statuses         jsonb not null default '[]'::jsonb,
  posicao          numeric not null default 0,
  arquivada        boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_tarefas_listas_pasta on public.tarefas_listas(pasta_id);

create table if not exists public.tarefas_itens (
  id                 uuid primary key default gen_random_uuid(),
  lista_id           uuid not null references public.tarefas_listas(id) on delete cascade,
  parent_id          uuid references public.tarefas_itens(id) on delete cascade,
  clickup_task_id    text unique,
  clickup_url        text,
  titulo             text not null,
  descricao          text,                                   -- markdown
  status             text not null default 'a fazer',        -- key do status da lista
  status_tipo        text not null default 'open'
                     check (status_tipo in ('open', 'custom', 'closed')),
  prioridade         text check (prioridade in ('urgent', 'high', 'normal', 'low')),
  responsaveis       uuid[] not null default '{}',           -- profiles.id
  responsaveis_extra jsonb not null default '[]'::jsonb,     -- [{clickup_id, nome, iniciais, cor}] sem perfil
  data_inicio        timestamptz,
  data_vencimento    timestamptz,
  data_conclusao     timestamptz,
  estimativa_min     integer,
  tipo_tarefa        text,
  dificuldade        text,
  departamento       text[] not null default '{}',
  campos             jsonb not null default '{}'::jsonb,     -- demais campos personalizados
  tags               text[] not null default '{}',
  checklists         jsonb not null default '[]'::jsonb,     -- [{id, nome, itens:[{id, nome, feito}]}]
  anexos             jsonb not null default '[]'::jsonb,     -- [{path, name, type, size, url}]
  posicao            numeric not null default 0,
  arquivada          boolean not null default false,
  criado_por         uuid references public.profiles(id) on delete set null,
  criador_nome       text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists idx_tarefas_itens_lista   on public.tarefas_itens(lista_id);
create index if not exists idx_tarefas_itens_parent  on public.tarefas_itens(parent_id);
create index if not exists idx_tarefas_itens_status  on public.tarefas_itens(status_tipo);
create index if not exists idx_tarefas_itens_venc    on public.tarefas_itens(data_vencimento);
create index if not exists idx_tarefas_itens_resp    on public.tarefas_itens using gin (responsaveis);

create table if not exists public.tarefas_comentarios (
  id                   uuid primary key default gen_random_uuid(),
  tarefa_id            uuid not null references public.tarefas_itens(id) on delete cascade,
  autor_id             uuid references public.profiles(id) on delete set null,
  autor_nome           text,
  texto                text not null,
  clickup_comment_id   text unique,
  created_at           timestamptz not null default now()
);
create index if not exists idx_tarefas_comentarios_tarefa on public.tarefas_comentarios(tarefa_id, created_at);

-- updated_at automático
create or replace function public.tarefas_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_tarefas_itens_touch on public.tarefas_itens;
create trigger trg_tarefas_itens_touch before update on public.tarefas_itens
  for each row execute function public.tarefas_touch_updated_at();
drop trigger if exists trg_tarefas_listas_touch on public.tarefas_listas;
create trigger trg_tarefas_listas_touch before update on public.tarefas_listas
  for each row execute function public.tarefas_touch_updated_at();

-- RLS: ferramenta interna, todo o time logado lê e escreve.
alter table public.tarefas_pastas      enable row level security;
alter table public.tarefas_listas      enable row level security;
alter table public.tarefas_itens       enable row level security;
alter table public.tarefas_comentarios enable row level security;

drop policy if exists "tarefas_pastas_team" on public.tarefas_pastas;
create policy "tarefas_pastas_team" on public.tarefas_pastas
  for all to authenticated using (true) with check (true);
drop policy if exists "tarefas_listas_team" on public.tarefas_listas;
create policy "tarefas_listas_team" on public.tarefas_listas
  for all to authenticated using (true) with check (true);
drop policy if exists "tarefas_itens_team" on public.tarefas_itens;
create policy "tarefas_itens_team" on public.tarefas_itens
  for all to authenticated using (true) with check (true);
drop policy if exists "tarefas_comentarios_team" on public.tarefas_comentarios;
create policy "tarefas_comentarios_team" on public.tarefas_comentarios
  for all to authenticated using (true) with check (true);

-- Realtime: outra pessoa mexendo na mesma lista aparece na hora.
alter publication supabase_realtime add table public.tarefas_itens;
alter publication supabase_realtime add table public.tarefas_comentarios;
alter publication supabase_realtime add table public.tarefas_listas;
alter publication supabase_realtime add table public.tarefas_pastas;
