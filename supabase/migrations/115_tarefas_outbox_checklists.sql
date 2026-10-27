-- 115 — Checklist editado no VertaTask vai para o ClickUp
--
-- O trigger da outbox (101, ajustado na 110) não olhava `checklists`: editar o checklist de
-- uma tarefa não enfileirava nada e o ClickUp nunca recebia. Agora a mudança entra como
-- campo 'checklists' do 'atualizar', e o push (api/_tarefas_push_core.js) aplica a diferença
-- no ClickUp. O resto da função é o mesmo da 110.

create or replace function public.tarefas_outbox_enfileira()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ator uuid := auth.uid();
  mudados text[] := '{}'; -- array_append: text[] || 'x' seria lido como literal de array
begin
  -- sem pessoa logada = sincronização / push / script: não enfileira
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
      if new.checklists      is distinct from old.checklists      then mudados := array_append(mudados, 'checklists'); end if;
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
