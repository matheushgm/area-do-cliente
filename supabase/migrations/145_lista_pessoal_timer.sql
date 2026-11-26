-- VertaTask (2026-11-26, pedido do Matheus): Lista pessoal e timer por tarefa.
--
-- 1) Lista pessoal: cada pessoa tem uma lista particular (tarefas_listas.dono_id), sem pasta e
--    sem ClickUp. Só o dono vê a lista, as tarefas dela (tarefas_itens.privada_de, preenchida
--    por trigger a partir da lista) e o que pende delas (comentários, histórico, relações,
--    seguidores). Nada dessas tarefas entra na fila do ClickUp (guarda em tarefas_outbox).
-- 2) Timer: tarefas_tempo guarda cada intervalo (início, fim) por pessoa e tarefa; um timer
--    rodando por pessoa (fim nulo). Leitura liberada ao time (dashboard de horas); cada um
--    grava só o próprio tempo.

-- ─── 1. Lista pessoal ────────────────────────────────────────────────────────

alter table public.tarefas_listas add column if not exists dono_id uuid references auth.users(id) on delete cascade;
create unique index if not exists tarefas_listas_pessoal_uidx on public.tarefas_listas (dono_id) where dono_id is not null;

alter table public.tarefas_itens add column if not exists privada_de uuid;
create index if not exists tarefas_itens_privada_idx on public.tarefas_itens (privada_de) where privada_de is not null;

-- privada_de sempre igual ao dono da lista (security definer: a RLS da lista esconde a lista de
-- outra pessoa, e é justamente isso que faz a gravação de outra pessoa numa lista pessoal falhar)
create or replace function public.tarefas_itens_privada()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.lista_id is distinct from old.lista_id or new.privada_de is distinct from old.privada_de then
    new.privada_de := (select l.dono_id from tarefas_listas l where l.id = new.lista_id);
  end if;
  return new;
end $$;

drop trigger if exists trg_tarefas_itens_privada on public.tarefas_itens;
create trigger trg_tarefas_itens_privada
  before insert or update on public.tarefas_itens
  for each row execute function public.tarefas_itens_privada();

drop policy if exists tarefas_listas_pessoal on public.tarefas_listas;
create policy tarefas_listas_pessoal on public.tarefas_listas as restrictive for all to authenticated
  using (dono_id is null or dono_id = (select auth.uid()))
  with check (dono_id is null or dono_id = (select auth.uid()));

drop policy if exists tarefas_itens_pessoal on public.tarefas_itens;
create policy tarefas_itens_pessoal on public.tarefas_itens as restrictive for all to authenticated
  using (privada_de is null or privada_de = (select auth.uid()))
  with check (privada_de is null or privada_de = (select auth.uid()));

-- tarefas das listas pessoais de OUTRAS pessoas (security definer: dentro da política a própria
-- RLS esconderia essas tarefas e o "not in" deixaria tudo passar). Conjunto avaliado uma vez por
-- consulta (como vt_listas_permitidas), não uma chamada por linha.
create or replace function public.tarefas_privadas_de_outros()
returns setof uuid language sql stable security definer set search_path = public as $$
  select t.id from tarefas_itens t where t.privada_de is not null and t.privada_de <> auth.uid()
$$;

drop policy if exists tarefas_comentarios_pessoal on public.tarefas_comentarios;
create policy tarefas_comentarios_pessoal on public.tarefas_comentarios as restrictive for all to authenticated
  using (tarefa_id not in (select public.tarefas_privadas_de_outros())) with check (tarefa_id not in (select public.tarefas_privadas_de_outros()));

drop policy if exists tarefas_atividade_pessoal on public.tarefas_atividade;
create policy tarefas_atividade_pessoal on public.tarefas_atividade as restrictive for all to authenticated
  using (tarefa_id not in (select public.tarefas_privadas_de_outros())) with check (tarefa_id not in (select public.tarefas_privadas_de_outros()));

drop policy if exists tarefas_seguidores_pessoal on public.tarefas_seguidores;
create policy tarefas_seguidores_pessoal on public.tarefas_seguidores as restrictive for all to authenticated
  using (tarefa_id not in (select public.tarefas_privadas_de_outros())) with check (tarefa_id not in (select public.tarefas_privadas_de_outros()));

drop policy if exists tarefas_relacoes_pessoal on public.tarefas_relacoes;
create policy tarefas_relacoes_pessoal on public.tarefas_relacoes as restrictive for all to authenticated
  using (tarefa_id not in (select public.tarefas_privadas_de_outros()) and relacionada_id not in (select public.tarefas_privadas_de_outros()))
  with check (tarefa_id not in (select public.tarefas_privadas_de_outros()) and relacionada_id not in (select public.tarefas_privadas_de_outros()));

-- Tarefa da lista pessoal nunca vai para o ClickUp: a fila descarta o item na entrada (vale para
-- todos os gatilhos que enfileiram: tarefa, comentário, checklist, anexo, relação). Quando a
-- tarefa sai da lista pessoal para a lista de um cliente, privada_de fica nula e a criação passa.
create or replace function public.tarefas_outbox_sem_pessoal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tarefa_id is not null and exists (
    select 1 from tarefas_itens t where t.id = new.tarefa_id and t.privada_de is not null
  ) then
    return null;
  end if;
  return new;
end $$;

drop trigger if exists trg_tarefas_outbox_sem_pessoal on public.tarefas_outbox;
create trigger trg_tarefas_outbox_sem_pessoal
  before insert on public.tarefas_outbox
  for each row execute function public.tarefas_outbox_sem_pessoal();

-- ─── 2. Timer ────────────────────────────────────────────────────────────────

create table if not exists public.tarefas_tempo (
  id         uuid primary key default gen_random_uuid(),
  tarefa_id  uuid not null references public.tarefas_itens(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  inicio     timestamptz not null default now(),
  fim        timestamptz,
  segundos   integer generated always as (
               case when fim is null then null else greatest(0, floor(extract(epoch from (fim - inicio))))::integer end
             ) stored,
  origem     text not null default 'timer' check (origem in ('timer', 'manual')),
  nota       text,
  created_at timestamptz not null default now(),
  constraint tarefas_tempo_fim_depois check (fim is null or fim >= inicio)
);
create index if not exists tarefas_tempo_tarefa_idx on public.tarefas_tempo (tarefa_id);
create index if not exists tarefas_tempo_inicio_idx on public.tarefas_tempo (inicio desc);
create index if not exists tarefas_tempo_user_idx on public.tarefas_tempo (user_id, inicio desc);
-- um timer rodando por pessoa
create unique index if not exists tarefas_tempo_rodando_uidx on public.tarefas_tempo (user_id) where fim is null;

alter table public.tarefas_tempo enable row level security;
drop policy if exists tarefas_tempo_ler on public.tarefas_tempo;
create policy tarefas_tempo_ler on public.tarefas_tempo for select to authenticated using (true);
drop policy if exists tarefas_tempo_inserir on public.tarefas_tempo;
create policy tarefas_tempo_inserir on public.tarefas_tempo for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists tarefas_tempo_alterar on public.tarefas_tempo;
create policy tarefas_tempo_alterar on public.tarefas_tempo for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists tarefas_tempo_apagar on public.tarefas_tempo;
create policy tarefas_tempo_apagar on public.tarefas_tempo for delete to authenticated using (user_id = (select auth.uid()));
-- o event trigger vt_bloqueio_tabela_nova já fechou a tabela para o usuário só VertaTask (terceiro)

-- Iniciar: para o timer que estiver rodando e abre um novo nesta tarefa, numa transação só e com
-- o relógio do banco (o do navegador pode estar errado). Security invoker: a RLS vale.
create or replace function public.tarefas_timer_iniciar(p_tarefa uuid)
returns public.tarefas_tempo language plpgsql set search_path = public as $$
declare r public.tarefas_tempo;
begin
  if auth.uid() is null then raise exception 'sem usuário'; end if;
  if not exists (select 1 from tarefas_itens where id = p_tarefa) then raise exception 'tarefa não encontrada'; end if;
  update tarefas_tempo set fim = now() where user_id = auth.uid() and fim is null;
  insert into tarefas_tempo (tarefa_id, user_id, inicio, origem) values (p_tarefa, auth.uid(), now(), 'timer') returning * into r;
  return r;
end $$;

create or replace function public.tarefas_timer_parar()
returns setof public.tarefas_tempo language sql set search_path = public as $$
  update tarefas_tempo set fim = now() where user_id = auth.uid() and fim is null returning *
$$;

revoke all on function public.tarefas_timer_iniciar(uuid) from public, anon;
revoke all on function public.tarefas_timer_parar() from public, anon;
grant execute on function public.tarefas_timer_iniciar(uuid) to authenticated;
grant execute on function public.tarefas_timer_parar() to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.tarefas_tempo;
exception when duplicate_object then null; end $$;
