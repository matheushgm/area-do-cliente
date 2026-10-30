-- 126 — Relações entre tarefas (tarefas_relacoes) vão para o ClickUp (2026-10-30)
--
-- As relações do VertaTask (bloqueia / duplica / relacionada) existiam só aqui. Agora a
-- criação e a remoção feitas por pessoa logada entram na fila tarefas_outbox como
-- 'relacionar' / 'desrelacionar', e o push (api/_tarefas_push_core.js) escreve no ClickUp:
--   bloqueia A → B  = dependência: B depende de A (POST /task/B/dependency { depends_on: A })
--   relacionada     = link (POST /task/A/link/B)
--   duplica         = link também: o ClickUp não tem "duplicada de"; a direção se perde lá
-- O payload guarda o que o push precisa mesmo depois de a linha da relação sumir:
-- { relacao_id, tarefa_id, relacionada_id, tipo }.
--
-- A volta (webhook e rodada) grava as relações com a chave de serviço: auth.uid() nulo,
-- não enfileira (mesma regra do resto da fila).

alter table public.tarefas_outbox add column if not exists payload jsonb;
alter table public.tarefas_outbox drop constraint if exists tarefas_outbox_operacao_check;
alter table public.tarefas_outbox
  add constraint tarefas_outbox_operacao_check
  check (operacao in ('criar', 'atualizar', 'excluir', 'comentar', 'relacionar', 'desrelacionar'));
-- a volta consulta as relações com envio em aberto antes de mexer num par
create index if not exists tarefas_outbox_relacoes_idx on public.tarefas_outbox (id)
  where operacao in ('relacionar', 'desrelacionar') and status in ('pendente', 'processando', 'erro');

create or replace function public.tarefas_outbox_relacao()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ator uuid := auth.uid();
  n integer;
begin
  -- sem pessoa logada = sincronização / script: não enfileira
  if ator is null then return null; end if;

  if tg_op = 'INSERT' then
    insert into tarefas_outbox (tarefa_id, operacao, payload, ator_id)
    values (new.tarefa_id, 'relacionar',
            jsonb_build_object('relacao_id', new.id, 'tarefa_id', new.tarefa_id, 'relacionada_id', new.relacionada_id, 'tipo', new.tipo),
            ator);
    return null;
  end if;

  -- DELETE. Relação apagada junto com a tarefa (on delete cascade): a exclusão da tarefa no
  -- ClickUp leva a dependência junto, não há o que mandar.
  if not exists (select 1 from tarefas_itens where id = old.tarefa_id)
     or not exists (select 1 from tarefas_itens where id = old.relacionada_id) then
    update tarefas_outbox set status = 'cancelado', processed_at = now()
     where operacao = 'relacionar' and status = 'pendente' and payload->>'relacao_id' = old.id::text;
    return null;
  end if;
  -- criada e apagada antes de ir: só cancela o 'relacionar' (se já está em envio, manda desfazer)
  update tarefas_outbox set status = 'cancelado', processed_at = now()
   where operacao = 'relacionar' and status = 'pendente' and payload->>'relacao_id' = old.id::text;
  get diagnostics n = row_count;
  if n = 0 then
    insert into tarefas_outbox (tarefa_id, operacao, payload, ator_id)
    values (old.tarefa_id, 'desrelacionar',
            jsonb_build_object('relacao_id', old.id, 'tarefa_id', old.tarefa_id, 'relacionada_id', old.relacionada_id, 'tipo', old.tipo),
            ator);
  end if;
  return null;
end $$;

drop trigger if exists trg_tarefas_outbox_relacoes on public.tarefas_relacoes;
create trigger trg_tarefas_outbox_relacoes
  after insert or delete on public.tarefas_relacoes
  for each row execute function public.tarefas_outbox_relacao();
