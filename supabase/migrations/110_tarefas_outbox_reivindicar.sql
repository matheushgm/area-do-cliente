-- 110 — Outbox VertaTask → ClickUp: reivindicação atômica dos itens (2026-10-26)
--
-- Bug: /api/tarefas-push não marcava os itens que estava processando. Cada escrita no
-- front agenda um push, a Vercel roda as invocações em paralelo, e dois pushes liam os
-- mesmos itens 'pendente' e criavam a mesma tarefa duas vezes no ClickUp (23/10: 21 itens
-- "criar" viraram 26 tarefas). Agora o push chama tarefas_outbox_reivindicar(), que passa
-- os itens para 'processando' com FOR UPDATE SKIP LOCKED: cada item é de uma rodada só.
-- Rodada que morreu no meio (limite de 60 s da Vercel) é devolvida à fila pelo ttl.
--
-- O trigger também passa a considerar 'processando' ao decidir se já há um "criar" na
-- fila para a tarefa sem clickup_task_id, senão a edição durante a criação enfileirava
-- um segundo "criar".

alter table public.tarefas_outbox drop constraint if exists tarefas_outbox_status_check;
alter table public.tarefas_outbox
  add constraint tarefas_outbox_status_check check (status in ('pendente', 'processando', 'ok', 'erro', 'cancelado'));
alter table public.tarefas_outbox add column if not exists reivindicado_em timestamptz;
create index if not exists tarefas_outbox_processando_idx on public.tarefas_outbox (reivindicado_em) where status = 'processando';
-- o webhook consulta a fila pelo id do ClickUp para casar o evento com a tarefa em criação
create index if not exists tarefas_outbox_clickup_task_id_idx on public.tarefas_outbox (clickup_task_id) where clickup_task_id is not null;

create or replace function public.tarefas_outbox_reivindicar(p_limite integer default 40, p_ttl_s integer default 300)
returns setof public.tarefas_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  -- rodada anterior que não terminou: devolve os itens dela à fila
  update tarefas_outbox
     set status = 'pendente', reivindicado_em = null
   where status = 'processando'
     and reivindicado_em < now() - make_interval(secs => p_ttl_s);

  return query
    with alvo as (
      select id from tarefas_outbox
       where status = 'pendente'
       order by id
       limit p_limite
       for update skip locked
    )
    update tarefas_outbox o
       set status = 'processando', reivindicado_em = now()
      from alvo
     where o.id = alvo.id
    returning o.*;
end $$;

revoke all on function public.tarefas_outbox_reivindicar(integer, integer) from public, anon, authenticated;
grant execute on function public.tarefas_outbox_reivindicar(integer, integer) to service_role;

-- Trigger (mesma função da 101, só a checagem do "criar" já na fila mudou)
create or replace function public.tarefas_outbox_enfileira()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ator uuid := auth.uid();
  mudados text[] := '{}';
begin
  if ator is null then return null; end if;

  if tg_table_name = 'tarefas_itens' then
    if tg_op = 'INSERT' then
      insert into tarefas_outbox (tarefa_id, operacao) values (new.id, 'criar');
    elsif tg_op = 'DELETE' then
      update tarefas_outbox set status = 'cancelado', processed_at = now()
        where tarefa_id = old.id and status = 'pendente';
      if old.clickup_task_id is not null then
        insert into tarefas_outbox (tarefa_id, operacao, clickup_task_id) values (old.id, 'excluir', old.clickup_task_id);
      end if;
    else
      if new.titulo          is distinct from old.titulo          then mudados := array_append(mudados, 'titulo'); end if;
      if new.descricao       is distinct from old.descricao       then mudados := array_append(mudados, 'descricao'); end if;
      if new.status          is distinct from old.status          then mudados := array_append(mudados, 'status'); end if;
      if new.prioridade      is distinct from old.prioridade      then mudados := array_append(mudados, 'prioridade'); end if;
      if new.responsaveis    is distinct from old.responsaveis    then mudados := array_append(mudados, 'responsaveis'); end if;
      if new.data_inicio     is distinct from old.data_inicio     then mudados := array_append(mudados, 'data_inicio'); end if;
      if new.data_vencimento is distinct from old.data_vencimento then mudados := array_append(mudados, 'data_vencimento'); end if;
      if new.estimativa_min  is distinct from old.estimativa_min  then mudados := array_append(mudados, 'estimativa_min'); end if;
      if new.tipo_tarefa     is distinct from old.tipo_tarefa     then mudados := array_append(mudados, 'tipo_tarefa'); end if;
      if new.dificuldade     is distinct from old.dificuldade     then mudados := array_append(mudados, 'dificuldade'); end if;
      if new.departamento    is distinct from old.departamento    then mudados := array_append(mudados, 'departamento'); end if;
      if new.tags            is distinct from old.tags            then mudados := array_append(mudados, 'tags'); end if;
      if new.parent_id       is distinct from old.parent_id       then mudados := array_append(mudados, 'parent_id'); end if;
      if new.lista_id        is distinct from old.lista_id        then mudados := array_append(mudados, 'lista_id'); end if;
      if new.arquivada       is distinct from old.arquivada       then mudados := array_append(mudados, 'arquivada'); end if;
      if cardinality(mudados) = 0 then return null; end if;
      if new.clickup_task_id is null then
        -- ainda não existe no ClickUp: a criação pendente (ou em andamento) leva o estado inteiro
        if not exists (select 1 from tarefas_outbox where tarefa_id = new.id and status in ('pendente', 'processando') and operacao = 'criar') then
          insert into tarefas_outbox (tarefa_id, operacao) values (new.id, 'criar');
        end if;
      else
        insert into tarefas_outbox (tarefa_id, operacao, clickup_task_id, campos) values (new.id, 'atualizar', new.clickup_task_id, mudados);
      end if;
    end if;
  elsif tg_table_name = 'tarefas_comentarios' then
    if new.clickup_comment_id is null then
      insert into tarefas_outbox (tarefa_id, comentario_id, operacao) values (new.tarefa_id, new.id, 'comentar');
    end if;
  end if;
  return null;
end $$;
