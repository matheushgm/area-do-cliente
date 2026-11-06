-- Migration 128: módulo Sprints do VertaTask (/tarefas?aba=sprints)
--
-- Modelo inspirado no Sprints do ClickUp (Plan → Confirm → Report → Spillover), com a diferença
-- de que aqui cada semana tem UMA sprint para CADA pessoa, como a reunião de sexta já funciona:
--   * tarefas_sprints        : a semana (Sprint 31, 09/11 a 15/11)
--   * tarefas_sprint_pessoas : a sprint de cada pessoa naquela semana (objetivo, capacidade,
--                              confirmação do compromisso, retro e o retrato do resultado)
--   * tarefas_sprint_itens   : as tarefas que a pessoa assumiu. A tabela é separada de
--                              tarefas_itens porque a mesma tarefa pode passar por várias sprints
--                              (transbordo) e o histórico de cada uma precisa ficar.
--
-- Nada aqui toca em tarefas_itens: nenhuma escrita destas tabelas entra na fila do ClickUp.
-- Status, responsável e estimativa continuam na própria tarefa e seguem pela outbox de sempre.

create table if not exists public.tarefas_sprints (
  id            uuid primary key default gen_random_uuid(),
  numero        integer not null unique,
  nome          text not null,
  inicio        date not null,
  fim           date not null check (fim >= inicio),
  concluida_em  timestamptz,
  concluida_por uuid references public.profiles(id) on delete set null,
  criado_por    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

create table if not exists public.tarefas_sprint_pessoas (
  id                 uuid primary key default gen_random_uuid(),
  sprint_id          uuid not null references public.tarefas_sprints(id) on delete cascade,
  pessoa_id          uuid not null references public.profiles(id) on delete cascade,
  objetivo           text,
  riscos             text,
  dias_disponiveis   numeric(3,1) not null default 5 check (dias_disponiveis >= 0),
  horas_dia          numeric(4,2) not null default 6 check (horas_dia >= 0),
  -- confirmar = "Confirm sprint" do ClickUp: trava o compromisso; o que entra depois é fora do plano
  confirmada_em      timestamptz,
  confirmada_por     uuid references public.profiles(id) on delete set null,
  retro_funcionou    text,
  retro_travou       text,
  retro_mudanca      text,
  -- retrato gravado ao concluir a sprint (velocidade e say-do não dependem mais das tarefas)
  compromisso_min    integer,
  compromisso_tarefas integer,
  entregue_min       integer,
  entregue_tarefas   integer,
  entregue_compromisso_min integer,
  fora_min           integer,
  transbordo_tarefas integer,
  created_at         timestamptz not null default now(),
  unique (sprint_id, pessoa_id)
);
create index if not exists idx_tarefas_sprint_pessoas_pessoa on public.tarefas_sprint_pessoas(pessoa_id);

create table if not exists public.tarefas_sprint_itens (
  id              uuid primary key default gen_random_uuid(),
  sprint_id       uuid not null references public.tarefas_sprints(id) on delete cascade,
  pessoa_id       uuid not null references public.profiles(id) on delete cascade,
  tarefa_id       uuid not null references public.tarefas_itens(id) on delete cascade,
  titulo          text,                       -- só para o histórico, caso a tarefa suma da carga
  origem          text not null default 'planejada' check (origem in ('planejada', 'transbordo')),
  fora_do_plano   boolean not null default false,
  min_compromisso integer,                    -- horas que valiam quando o compromisso foi travado
  adicionada_em   timestamptz not null default now(),
  adicionada_por  uuid references public.profiles(id) on delete set null,
  removida_em     timestamptz,                -- saiu depois de confirmada (fica no relatório)
  decisao         text check (decisao in ('proxima', 'backlog')),
  resultado       text check (resultado in ('concluida', 'transbordou', 'devolvida', 'antecipada')),
  posicao         double precision not null default extract(epoch from now()),
  unique (sprint_id, pessoa_id, tarefa_id)
);
create index if not exists idx_tarefas_sprint_itens_sprint on public.tarefas_sprint_itens(sprint_id);
create index if not exists idx_tarefas_sprint_itens_tarefa on public.tarefas_sprint_itens(tarefa_id);

alter table public.tarefas_sprints        enable row level security;
alter table public.tarefas_sprint_pessoas enable row level security;
alter table public.tarefas_sprint_itens   enable row level security;

drop policy if exists "tarefas_sprints_team" on public.tarefas_sprints;
create policy "tarefas_sprints_team" on public.tarefas_sprints
  for all to authenticated using (true) with check (true);
drop policy if exists "tarefas_sprint_pessoas_team" on public.tarefas_sprint_pessoas;
create policy "tarefas_sprint_pessoas_team" on public.tarefas_sprint_pessoas
  for all to authenticated using (true) with check (true);
drop policy if exists "tarefas_sprint_itens_team" on public.tarefas_sprint_itens;
create policy "tarefas_sprint_itens_team" on public.tarefas_sprint_itens
  for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table public.tarefas_sprints;
alter publication supabase_realtime add table public.tarefas_sprint_pessoas;
alter publication supabase_realtime add table public.tarefas_sprint_itens;

-- Confirma a sprint de uma pessoa: grava as horas de cada tarefa e trava o compromisso, tudo junto.
-- p_itens = [{ id, min }]
create or replace function public.tarefas_sprint_confirmar(p_pessoa uuid, p_itens jsonb)
returns void language plpgsql set search_path = public as $$
begin
  update public.tarefas_sprint_itens i
     set min_compromisso = x.min, fora_do_plano = false
    from jsonb_to_recordset(coalesce(p_itens, '[]'::jsonb)) as x(id uuid, min integer)
   where i.id = x.id and i.removida_em is null;
  update public.tarefas_sprint_pessoas
     set confirmada_em = now(), confirmada_por = auth.uid()
   where id = p_pessoa;
end $$;

-- Volta para o planejamento. A tela só oferece antes do início da sprint.
create or replace function public.tarefas_sprint_reabrir(p_pessoa uuid)
returns void language plpgsql set search_path = public as $$
declare v_sprint uuid; v_id uuid;
begin
  select sprint_id, pessoa_id into v_sprint, v_id from public.tarefas_sprint_pessoas where id = p_pessoa;
  delete from public.tarefas_sprint_itens where sprint_id = v_sprint and pessoa_id = v_id and removida_em is not null;
  update public.tarefas_sprint_itens set min_compromisso = null, fora_do_plano = false where sprint_id = v_sprint and pessoa_id = v_id;
  update public.tarefas_sprint_pessoas set confirmada_em = null, confirmada_por = null where id = p_pessoa;
end $$;

-- Conclui a sprint numa transação só. A conta é feita na tela (planoDeFechamento em
-- src/lib/sprints.js) e chega pronta:
--   p_resultados = [{ id, resultado }]
--   p_novos      = [{ sprint_id, pessoa_id, tarefa_id, titulo, fora_do_plano }] (transbordo)
--   p_pessoas    = [{ id, compromisso_min, compromisso_tarefas, entregue_min, entregue_tarefas,
--                     entregue_compromisso_min, fora_min, transbordo_tarefas }]
create or replace function public.tarefas_sprint_concluir(p_sprint uuid, p_resultados jsonb, p_novos jsonb, p_pessoas jsonb)
returns void language plpgsql set search_path = public as $$
begin
  if exists (select 1 from public.tarefas_sprints where id = p_sprint and concluida_em is not null) then
    raise exception 'Esta sprint já foi concluída.';
  end if;

  update public.tarefas_sprint_itens i
     set resultado = x.resultado
    from jsonb_to_recordset(coalesce(p_resultados, '[]'::jsonb)) as x(id uuid, resultado text)
   where i.id = x.id and i.sprint_id = p_sprint;

  insert into public.tarefas_sprint_itens (sprint_id, pessoa_id, tarefa_id, titulo, origem, fora_do_plano, adicionada_por)
  select x.sprint_id, x.pessoa_id, x.tarefa_id, x.titulo, 'transbordo', coalesce(x.fora_do_plano, false), auth.uid()
    from jsonb_to_recordset(coalesce(p_novos, '[]'::jsonb))
      as x(sprint_id uuid, pessoa_id uuid, tarefa_id uuid, titulo text, fora_do_plano boolean)
  on conflict (sprint_id, pessoa_id, tarefa_id) do update
    set origem = 'transbordo', removida_em = null;

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

grant execute on function public.tarefas_sprint_confirmar(uuid, jsonb) to authenticated;
grant execute on function public.tarefas_sprint_reabrir(uuid) to authenticated;
grant execute on function public.tarefas_sprint_concluir(uuid, jsonb, jsonb, jsonb) to authenticated;
