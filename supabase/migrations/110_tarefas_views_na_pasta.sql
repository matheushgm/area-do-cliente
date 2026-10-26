-- 110 — Views do VertaTask dentro da pasta do cliente
--
-- As views deixam de ser atalhos soltos na coluna da esquerda e viram abas ao lado de
-- Lista/Quadro/Calendário/Planilha/Gantt, no escopo onde foram criadas:
--   escopo 'pasta'  → pasta_id do cliente (vale para a pasta e para as listas dela)
--   escopo 'minhas' → tela "Minhas tarefas"
--   escopo 'todas'  → tela "Todas as tarefas"
-- As 5 visualizações padrão de cada escopo também são linhas (padrao_tipo), criadas na
-- primeira vez que alguém salva uma delas: qualquer pessoa do time edita, ninguém exclui,
-- e são sempre públicas. As demais seguem as regras de antes (só o dono edita e exclui).
-- config = { tipo, agrupar, subtarefas, responsaveis[], concluidas, filtros: { op, grupos } }
-- (formato em src/lib/viewsTarefas.js). A tabela estava vazia, nada a converter.

alter table public.tarefas_views
  add column if not exists escopo      text not null default 'todas',
  add column if not exists pasta_id    uuid references public.tarefas_pastas(id) on delete cascade,
  add column if not exists padrao_tipo text,
  add column if not exists posicao     numeric not null default 0;

alter table public.tarefas_views drop constraint if exists tarefas_views_escopo_check;
alter table public.tarefas_views add constraint tarefas_views_escopo_check
  check (escopo in ('pasta', 'minhas', 'todas'));
alter table public.tarefas_views drop constraint if exists tarefas_views_escopo_pasta_check;
alter table public.tarefas_views add constraint tarefas_views_escopo_pasta_check
  check ((escopo = 'pasta') = (pasta_id is not null));
alter table public.tarefas_views drop constraint if exists tarefas_views_padrao_tipo_check;
alter table public.tarefas_views add constraint tarefas_views_padrao_tipo_check
  check (padrao_tipo is null or padrao_tipo in ('lista', 'quadro', 'calendario', 'planilha', 'gantt'));
alter table public.tarefas_views drop constraint if exists tarefas_views_padrao_publica_check;
alter table public.tarefas_views add constraint tarefas_views_padrao_publica_check
  check (padrao_tipo is null or acesso = 'publica');

-- uma linha por visualização padrão em cada escopo
create unique index if not exists tarefas_views_padrao_uk on public.tarefas_views
  (escopo, coalesce(pasta_id, '00000000-0000-0000-0000-000000000000'::uuid), padrao_tipo)
  where padrao_tipo is not null;
create index if not exists tarefas_views_pasta_idx on public.tarefas_views (pasta_id) where pasta_id is not null;

-- padrão: qualquer pessoa do time edita; ninguém exclui. Salvas: só o dono.
drop policy if exists "tarefas_views_update" on public.tarefas_views;
create policy "tarefas_views_update" on public.tarefas_views for update to authenticated
  using (dono_id = auth.uid() or padrao_tipo is not null)
  with check (dono_id = auth.uid() or padrao_tipo is not null);
drop policy if exists "tarefas_views_delete" on public.tarefas_views;
create policy "tarefas_views_delete" on public.tarefas_views for delete to authenticated
  using (dono_id = auth.uid() and padrao_tipo is null);
