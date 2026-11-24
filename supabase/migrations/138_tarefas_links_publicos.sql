-- Link público de uma lista (ou da pasta inteira de um cliente) do VertaTask, pedido do Matheus em
-- 24/11/2026: qualquer pessoa com o link vê as tarefas em andamento e as concluídas, sem login, na
-- página /lista/:token. A página lê pela API api/tarefas-publico.js (chave de serviço), que devolve
-- só título, status, responsáveis, datas e subtarefas (nada de descrição, comentários ou anexos).
-- Um link ativo por lista/pasta; desativar corta o acesso na hora e criar de novo gera outro token.

create table if not exists public.tarefas_links_publicos (
  id               uuid primary key default gen_random_uuid(),
  token            uuid not null unique default gen_random_uuid(),
  lista_id         uuid references public.tarefas_listas(id) on delete cascade,
  pasta_id         uuid references public.tarefas_pastas(id) on delete cascade,
  ativo            boolean not null default true,
  criado_por       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  desativado_em    timestamptz,
  acessos          integer not null default 0,
  ultimo_acesso_at timestamptz,
  constraint tarefas_links_publicos_alvo check ((lista_id is null) <> (pasta_id is null))
);

create unique index if not exists tarefas_links_publicos_lista_ativo on public.tarefas_links_publicos (lista_id) where ativo and lista_id is not null;
create unique index if not exists tarefas_links_publicos_pasta_ativo on public.tarefas_links_publicos (pasta_id) where ativo and pasta_id is not null;

alter table public.tarefas_links_publicos enable row level security;
drop policy if exists "tarefas_links_publicos_team" on public.tarefas_links_publicos;
create policy "tarefas_links_publicos_team" on public.tarefas_links_publicos
  for all to authenticated using (true) with check (true);

-- contador de acessos (chamado pela API com a chave de serviço)
create or replace function public.tarefas_link_publico_acesso(p_token uuid)
returns void language sql security definer set search_path = public as $$
  update public.tarefas_links_publicos set acessos = acessos + 1, ultimo_acesso_at = now() where token = p_token and ativo;
$$;
revoke all on function public.tarefas_link_publico_acesso(uuid) from public, anon, authenticated;
