-- 108 — Remove os Modules do VertaTask e o payload legado dos templates
--
-- Modules (094/095) saíram: toda tarefa de um cliente fica na pasta/lista dele, e
-- o agrupamento de entregas virou o construtor de templates (107).
--
-- ⚠️ Aplicar só DEPOIS do deploy do front sem Modules: o front anterior lê
-- tarefas_modulos ao abrir /tarefas e quebra sem a tabela.

-- histórico: o trigger deixa de olhar modulo_id (a coluna vai embora logo abaixo)
create or replace function public.tarefas_log_atividade()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ator uuid := auth.uid();
  nome text;
  novo uuid;
begin
  if ator is null then return new; end if;
  select p.name into nome from public.profiles p where p.id = ator;

  if tg_op = 'INSERT' then
    insert into public.tarefas_atividade (tarefa_id, ator_id, ator_nome, campo, valor_novo)
    values (new.id, ator, nome, 'criada', new.titulo);
    return new;
  end if;

  if new.titulo is distinct from old.titulo then
    insert into public.tarefas_atividade (tarefa_id, ator_id, ator_nome, campo, valor_antigo, valor_novo) values (new.id, ator, nome, 'titulo', old.titulo, new.titulo);
  end if;
  if new.status is distinct from old.status then
    insert into public.tarefas_atividade (tarefa_id, ator_id, ator_nome, campo, valor_antigo, valor_novo) values (new.id, ator, nome, 'status', old.status, new.status);
  end if;
  if new.prioridade is distinct from old.prioridade then
    insert into public.tarefas_atividade (tarefa_id, ator_id, ator_nome, campo, valor_antigo, valor_novo) values (new.id, ator, nome, 'prioridade', old.prioridade, new.prioridade);
  end if;
  if new.data_inicio is distinct from old.data_inicio then
    insert into public.tarefas_atividade (tarefa_id, ator_id, ator_nome, campo, valor_antigo, valor_novo) values (new.id, ator, nome, 'data_inicio', old.data_inicio::text, new.data_inicio::text);
  end if;
  if new.data_vencimento is distinct from old.data_vencimento then
    insert into public.tarefas_atividade (tarefa_id, ator_id, ator_nome, campo, valor_antigo, valor_novo) values (new.id, ator, nome, 'data_vencimento', old.data_vencimento::text, new.data_vencimento::text);
  end if;
  if new.estimativa_min is distinct from old.estimativa_min then
    insert into public.tarefas_atividade (tarefa_id, ator_id, ator_nome, campo, valor_antigo, valor_novo) values (new.id, ator, nome, 'estimativa_min', old.estimativa_min::text, new.estimativa_min::text);
  end if;
  if new.ciclo_id is distinct from old.ciclo_id then
    insert into public.tarefas_atividade (tarefa_id, ator_id, ator_nome, campo, valor_antigo, valor_novo) values (new.id, ator, nome, 'ciclo', old.ciclo_id::text, new.ciclo_id::text);
  end if;
  if new.responsaveis is distinct from old.responsaveis then
    insert into public.tarefas_atividade (tarefa_id, ator_id, ator_nome, campo, valor_antigo, valor_novo)
    values (new.id, ator, nome, 'responsaveis', array_to_string(old.responsaveis, ','), array_to_string(new.responsaveis, ','));
    -- quem entrou como responsável passa a seguir a tarefa e é avisado
    for novo in select unnest(new.responsaveis) except select unnest(old.responsaveis) loop
      insert into public.tarefas_seguidores (tarefa_id, user_id) values (new.id, novo) on conflict do nothing;
      if novo <> ator then
        insert into public.notifications (user_id, type, title, body, link, data)
        values (novo, 'tarefa_atribuida', coalesce(nome, 'Alguém') || ' atribuiu uma tarefa a você', new.titulo, '/tarefas?tarefa=' || new.id::text,
                jsonb_build_object('tarefa_id', new.id, 'ator_id', ator));
      end if;
    end loop;
  end if;
  if new.etiquetas is distinct from old.etiquetas then
    insert into public.tarefas_atividade (tarefa_id, ator_id, ator_nome, campo, valor_antigo, valor_novo)
    values (new.id, ator, nome, 'etiquetas', array_to_string(old.etiquetas, ','), array_to_string(new.etiquetas, ','));
  end if;
  return new;
end $$;

delete from public.tarefas_atividade where campo = 'modulo';

drop index if exists public.idx_tarefas_itens_modulo;
drop index if exists public.idx_tarefas_paginas_modulo;
alter table public.tarefas_itens   drop column if exists modulo_id;
alter table public.tarefas_paginas drop column if exists modulo_id;
drop table if exists public.tarefas_modulos;   -- sai da publicação realtime junto

-- templates: o formato antigo já foi convertido para `itens` na 107
alter table public.tarefas_modelos drop column if exists payload;
