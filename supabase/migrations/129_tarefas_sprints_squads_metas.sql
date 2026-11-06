-- Migration 129: Sprints por squad, com metas explodidas em atividades.
--
-- Pedido do Matheus em 2026-11-06, no mesmo dia do módulo (128):
--   * cada squad tem a sua sprint na semana, com as pessoas escolhidas para aquela sprint
--     (uma pessoa pode estar nos dois squads; a capacidade dela é somada na tela);
--   * a sprint começa pelas metas (tarefas_sprint_metas);
--   * cada meta é explodida em atividades (tarefas_sprint_itens.meta_id) e o % sai delas.
--
-- O número da sprint deixa de ser único no geral e passa a ser único por squad: os dois squads
-- têm a sua Sprint 31 na mesma semana.

alter table public.tarefas_sprints
  add column if not exists squad_id uuid references public.squads(id) on delete set null;
alter table public.tarefas_sprints drop constraint if exists tarefas_sprints_numero_key;
create unique index if not exists uq_tarefas_sprints_squad_numero on public.tarefas_sprints(squad_id, numero);

create table if not exists public.tarefas_sprint_metas (
  id               uuid primary key default gen_random_uuid(),
  sprint_id        uuid not null references public.tarefas_sprints(id) on delete cascade,
  titulo           text not null,
  descricao        text,                -- como saber que a meta foi batida
  responsavel_id   uuid references public.profiles(id) on delete set null,
  pasta_id         uuid references public.tarefas_pastas(id) on delete set null, -- cliente, opcional
  posicao          double precision not null default extract(epoch from now()),
  decisao          text check (decisao in ('continua', 'encerra')),
  continua_de      uuid references public.tarefas_sprint_metas(id) on delete set null,
  -- retrato gravado ao concluir a sprint
  resultado_pct    integer,
  resultado_feitas integer,
  resultado_total  integer,
  criado_por       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);
create index if not exists idx_tarefas_sprint_metas_sprint on public.tarefas_sprint_metas(sprint_id);

alter table public.tarefas_sprint_itens
  add column if not exists meta_id uuid references public.tarefas_sprint_metas(id) on delete set null;
create index if not exists idx_tarefas_sprint_itens_meta on public.tarefas_sprint_itens(meta_id);

alter table public.tarefas_sprint_metas enable row level security;
drop policy if exists "tarefas_sprint_metas_team" on public.tarefas_sprint_metas;
create policy "tarefas_sprint_metas_team" on public.tarefas_sprint_metas
  for all to authenticated using (true) with check (true);
alter publication supabase_realtime add table public.tarefas_sprint_metas;

-- Concluir passa a gravar o retrato das metas e a levar para a próxima sprint as que continuam.
--   p_metas       = [{ id, resultado_pct, resultado_feitas, resultado_total }]
--   p_novas_metas = [{ id, sprint_id, titulo, descricao, responsavel_id, pasta_id, continua_de }]
--   p_novos ganha meta_id (a meta nova, quando a atividade transborda junto com ela)
drop function if exists public.tarefas_sprint_concluir(uuid, jsonb, jsonb, jsonb);
create or replace function public.tarefas_sprint_concluir(p_sprint uuid, p_resultados jsonb, p_novos jsonb, p_pessoas jsonb, p_metas jsonb, p_novas_metas jsonb)
returns void language plpgsql set search_path = public as $$
begin
  if exists (select 1 from public.tarefas_sprints where id = p_sprint and concluida_em is not null) then
    raise exception 'Esta sprint já foi concluída.';
  end if;

  update public.tarefas_sprint_itens i
     set resultado = x.resultado
    from jsonb_to_recordset(coalesce(p_resultados, '[]'::jsonb)) as x(id uuid, resultado text)
   where i.id = x.id and i.sprint_id = p_sprint;

  update public.tarefas_sprint_metas m
     set resultado_pct = x.resultado_pct, resultado_feitas = x.resultado_feitas, resultado_total = x.resultado_total
    from jsonb_to_recordset(coalesce(p_metas, '[]'::jsonb))
      as x(id uuid, resultado_pct integer, resultado_feitas integer, resultado_total integer)
   where m.id = x.id and m.sprint_id = p_sprint;

  insert into public.tarefas_sprint_metas (id, sprint_id, titulo, descricao, responsavel_id, pasta_id, continua_de, criado_por)
  select x.id, x.sprint_id, x.titulo, x.descricao, x.responsavel_id, x.pasta_id, x.continua_de, auth.uid()
    from jsonb_to_recordset(coalesce(p_novas_metas, '[]'::jsonb))
      as x(id uuid, sprint_id uuid, titulo text, descricao text, responsavel_id uuid, pasta_id uuid, continua_de uuid);

  insert into public.tarefas_sprint_itens (sprint_id, pessoa_id, tarefa_id, titulo, origem, fora_do_plano, meta_id, adicionada_por)
  select x.sprint_id, x.pessoa_id, x.tarefa_id, x.titulo, 'transbordo', coalesce(x.fora_do_plano, false), x.meta_id, auth.uid()
    from jsonb_to_recordset(coalesce(p_novos, '[]'::jsonb))
      as x(sprint_id uuid, pessoa_id uuid, tarefa_id uuid, titulo text, fora_do_plano boolean, meta_id uuid)
  on conflict (sprint_id, pessoa_id, tarefa_id) do update
    set origem = 'transbordo', removida_em = null, meta_id = coalesce(excluded.meta_id, tarefas_sprint_itens.meta_id);

  update public.tarefas_sprint_pessoas p
     set compromisso_min = x.compromisso_min, compromisso_tarefas = x.compromisso_tarefas,
         entregue_min = x.entregue_min, entregue_tarefas = x.entregue_tarefas,
         entregue_compromisso_min = x.entregue_compromisso_min,
         fora_min = x.fora_min, transbordo_tarefas = x.transbordo_tarefas
    from jsonb_to_recordset(coalesce(p_pessoas, '[]'::jsonb)) as x(
      id uuid, compromisso_min integer, compromisso_tarefas integer, entregue_min integer,
      entregue_tarefas integer, entregue_compromisso_min integer, fora_min integer, transbordo_tarefas integer)
   where p.id = x.id and p.sprint_id = p_sprint;

  update public.tarefas_sprints
     set concluida_em = now(), concluida_por = auth.uid()
   where id = p_sprint;
end $$;
grant execute on function public.tarefas_sprint_concluir(uuid, jsonb, jsonb, jsonb, jsonb, jsonb) to authenticated;
