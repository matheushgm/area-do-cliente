-- 114 — Views padrão de "Minhas tarefas" por pessoa
--
-- Até a 113 cada visualização padrão (padrao_tipo) era uma linha por escopo, pública e
-- editável por todo o time; em "Minhas tarefas" isso fazia o ajuste de uma pessoa (agrupar,
-- filtros, colunas) mudar a tela de todo mundo. Agora, no escopo 'minhas', cada pessoa tem
-- as suas padrão: uma linha por (tipo, dono), privada, que só o dono lê e edita. Em 'pasta' e
-- 'todas' nada muda (uma linha por escopo, pública, qualquer pessoa ajusta).
-- As padrão de 'minhas' que já existiam ficam com quem as criou (dono_id), agora privadas.

-- padrão: privada em 'minhas', pública nos outros escopos
alter table public.tarefas_views drop constraint if exists tarefas_views_padrao_publica_check;
update public.tarefas_views set acesso = 'privada' where padrao_tipo is not null and escopo = 'minhas';
alter table public.tarefas_views add constraint tarefas_views_padrao_publica_check
  check (padrao_tipo is null or (escopo = 'minhas') = (acesso = 'privada'));

-- uma linha por padrão em cada escopo; em 'minhas', uma por pessoa
drop index if exists public.tarefas_views_padrao_uk;
create unique index tarefas_views_padrao_uk on public.tarefas_views
  (escopo, coalesce(pasta_id, '00000000-0000-0000-0000-000000000000'::uuid), padrao_tipo,
   (case when escopo = 'minhas' then dono_id else '00000000-0000-0000-0000-000000000000'::uuid end))
  where padrao_tipo is not null;

-- quem não é dono só ajusta as padrão compartilhadas (pasta e todas)
drop policy if exists "tarefas_views_update" on public.tarefas_views;
create policy "tarefas_views_update" on public.tarefas_views for update to authenticated
  using (dono_id = auth.uid() or (padrao_tipo is not null and escopo <> 'minhas'))
  with check (dono_id = auth.uid() or (padrao_tipo is not null and escopo <> 'minhas' and acesso = 'publica'));
