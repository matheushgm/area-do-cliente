-- 127 — Anexo enviado pelo VertaTask vai para o ClickUp, que passa a ser a fonte dos arquivos (2026-11-04)
--
-- O arquivo entra no bucket task-attachments só de passagem: a escrita de pessoa logada que traz em
-- `anexos` um `path` novo enfileira 'anexar' com o path no payload; o push manda o arquivo ao ClickUp,
-- troca a entrada local pela do ClickUp e apaga a cópia do Storage. Tirar uma entrada local da lista
-- (envio cancelado) não enfileira nada: o push vê que o path sumiu e encerra o item. Excluir anexo
-- que já está no ClickUp só pode ser feito lá: a API não tem esse endpoint.

alter table public.tarefas_outbox drop constraint if exists tarefas_outbox_operacao_check;
alter table public.tarefas_outbox
  add constraint tarefas_outbox_operacao_check
  check (operacao in ('criar', 'atualizar', 'excluir', 'comentar', 'relacionar', 'desrelacionar', 'anexar'));

-- Trigger da fila (mesma função da 121) enfileirando os anexos novos.
create or replace function public.tarefas_outbox_enfileira()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ator uuid := auth.uid();
  mudados text[] := '{}'; -- array_append: text[] || 'x' seria lido como literal de array
  novo jsonb;
begin
  -- sem pessoa logada = sincronização / push / script: não enfileira
  if ator is null then return null; end if;

  if tg_table_name = 'tarefas_itens' then
    if tg_op = 'INSERT' then
      insert into tarefas_outbox (tarefa_id, operacao, ator_id) values (new.id, 'criar', ator);
    elsif tg_op = 'DELETE' then
      update tarefas_outbox set status = 'cancelado', processed_at = now()
        where tarefa_id = old.id and status = 'pendente';
      if old.clickup_task_id is not null then
        insert into tarefas_outbox (tarefa_id, operacao, clickup_task_id, ator_id) values (old.id, 'excluir', old.clickup_task_id, ator);
      end if;
    else
      if new.anexos is distinct from old.anexos then
        for novo in
          select e from jsonb_array_elements(coalesce(new.anexos, '[]'::jsonb)) e
           where e ? 'path' and e->>'source' is distinct from 'clickup'
             and not exists (select 1 from jsonb_array_elements(coalesce(old.anexos, '[]'::jsonb)) o where o->>'path' = e->>'path')
        loop
          insert into tarefas_outbox (tarefa_id, operacao, clickup_task_id, payload, ator_id)
          values (new.id, 'anexar', new.clickup_task_id, jsonb_build_object('path', novo->>'path', 'name', novo->>'name'), ator);
        end loop;
      end if;
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
      if new.checklists      is distinct from old.checklists      then mudados := array_append(mudados, 'checklists'); end if;
      if new.parent_id       is distinct from old.parent_id       then mudados := array_append(mudados, 'parent_id'); end if;
      if new.lista_id        is distinct from old.lista_id        then mudados := array_append(mudados, 'lista_id'); end if;
      if new.arquivada       is distinct from old.arquivada       then mudados := array_append(mudados, 'arquivada'); end if;
      if cardinality(mudados) = 0 then return null; end if;
      if new.clickup_task_id is null then
        -- ainda não existe no ClickUp: a criação pendente (ou em andamento) leva o estado inteiro
        if not exists (select 1 from tarefas_outbox where tarefa_id = new.id and status in ('pendente', 'processando') and operacao = 'criar') then
          insert into tarefas_outbox (tarefa_id, operacao, ator_id) values (new.id, 'criar', ator);
        end if;
      else
        insert into tarefas_outbox (tarefa_id, operacao, clickup_task_id, campos, ator_id) values (new.id, 'atualizar', new.clickup_task_id, mudados, ator);
      end if;
    end if;
  elsif tg_table_name = 'tarefas_comentarios' then
    if new.clickup_comment_id is null then
      insert into tarefas_outbox (tarefa_id, comentario_id, operacao, ator_id) values (new.tarefa_id, new.id, 'comentar', ator);
    end if;
  end if;
  return null;
end $$;
