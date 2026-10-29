-- 121 — Auditoria da sincronização VertaTask ⇄ ClickUp (2026-10-28)
--
-- Duas vezes (23/10, template + edição em massa; 28/10, 164 alterações que levaram 33 min
-- para chegar ao ClickUp) ninguém conseguia dizer o que tinha acontecido com as tarefas:
-- a ida (tarefas_outbox) não dizia quem pediu nem guardava os avisos do push, e da volta
-- (webhook e rodada periódica) só ficava o ÚLTIMO evento em tarefas_sync. Esta migration
-- guarda o rastro que o painel Sincronização (/tarefas?aba=sincronizacao) mostra:
--
--  * tarefas_outbox ganha ator_id (quem fez a escrita que entrou na fila), avisos (o que o
--    push avisou sobre o item: status que não existe na lista, mover de lista não replicado,
--    cópia absorvida…) e resolvido_por/resolvido_em (erro que alguém mandou de novo ou ignorou);
--  * tarefas_sync_log: o que chegou do ClickUp. Três origens:
--      'clickup' — trigger nesta tabela: toda escrita SEM pessoa logada (webhook, rodada,
--                  scripts, push) que mudou um campo da tarefa, com o antes e o depois;
--      'webhook' — o evento que NÃO virou escrita: ignorado (push em andamento, fora dos
--                  spaces), sem mudança (eco da nossa própria edição), pulado por conflito, erro;
--      'rodada'  — o resumo de cada rodada de /api/tarefas-sync e as tarefas puladas nela;
--  * RPCs para o time agir sobre um erro da fila: tentar de novo, ignorar, e forçar o envio
--    da tarefa inteira quando o ClickUp ficou diferente.

-- ── Fila: quem pediu, avisos e resolução ────────────────────────────────────
alter table public.tarefas_outbox add column if not exists ator_id uuid;
alter table public.tarefas_outbox add column if not exists avisos text[];
alter table public.tarefas_outbox add column if not exists resolvido_por uuid;
alter table public.tarefas_outbox add column if not exists resolvido_em timestamptz;
create index if not exists tarefas_outbox_created_idx on public.tarefas_outbox (created_at desc);
create index if not exists tarefas_outbox_tarefa_idx on public.tarefas_outbox (tarefa_id);
create index if not exists tarefas_outbox_erro_idx on public.tarefas_outbox (id) where status = 'erro';

-- Trigger da fila (mesma função da 115) gravando o autor.
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
      insert into tarefas_outbox (tarefa_id, operacao, ator_id) values (new.id, 'criar', ator);
    elsif tg_op = 'DELETE' then
      update tarefas_outbox set status = 'cancelado', processed_at = now()
        where tarefa_id = old.id and status = 'pendente';
      if old.clickup_task_id is not null then
        insert into tarefas_outbox (tarefa_id, operacao, clickup_task_id, ator_id) values (old.id, 'excluir', old.clickup_task_id, ator);
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

-- ── O que chegou do ClickUp ─────────────────────────────────────────────────
create table if not exists public.tarefas_sync_log (
  id              bigserial primary key,
  created_at      timestamptz not null default now(),
  origem          text not null check (origem in ('clickup', 'webhook', 'rodada')),
  evento          text,          -- taskUpdated, taskCreated… (webhook) ou 'rodada'
  acao            text not null, -- criada, atualizada, removida, ignorado, sem_mudanca, pulada_conflito, sem_pai, erro, resumo
  tarefa_id       uuid,
  clickup_task_id text,
  campos          text[],
  motivo          text,
  detalhe         jsonb
);
create index if not exists tarefas_sync_log_created_idx on public.tarefas_sync_log (created_at desc);
create index if not exists tarefas_sync_log_tarefa_idx on public.tarefas_sync_log (tarefa_id, created_at desc);
create index if not exists tarefas_sync_log_cu_idx on public.tarefas_sync_log (clickup_task_id) where clickup_task_id is not null;
alter table public.tarefas_sync_log enable row level security;
drop policy if exists "tarefas_sync_log_select" on public.tarefas_sync_log;
create policy "tarefas_sync_log_select" on public.tarefas_sync_log for select to authenticated using (true);
-- escrita só pelo servidor (chave de serviço) e pelo trigger abaixo

-- Escrita sem pessoa logada que mudou a tarefa: registra o antes e o depois de cada campo.
-- Descrição e checklists entram só como "mudou" (o texto inteiro não cabe no rastro).
create or replace function public.tarefas_sync_log_mudanca()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  mudados text[] := '{}';
  det jsonb := '{}';
  acao text := 'atualizada';
  corta constant int := 160;
begin
  if auth.uid() is not null then return null; end if; -- edição de pessoa: tarefas_atividade e a fila contam

  if tg_op = 'INSERT' then
    insert into tarefas_sync_log (origem, acao, tarefa_id, clickup_task_id, detalhe)
    values ('clickup', 'criada', new.id, new.clickup_task_id, jsonb_build_object('titulo', left(new.titulo, corta), 'status', new.status));
    return null;
  end if;

  if new.titulo is distinct from old.titulo then mudados := array_append(mudados, 'titulo'); det := det || jsonb_build_object('titulo', jsonb_build_object('de', left(old.titulo, corta), 'para', left(new.titulo, corta))); end if;
  if new.descricao is distinct from old.descricao then mudados := array_append(mudados, 'descricao'); end if;
  if new.status is distinct from old.status then mudados := array_append(mudados, 'status'); det := det || jsonb_build_object('status', jsonb_build_object('de', old.status, 'para', new.status)); end if;
  if new.prioridade is distinct from old.prioridade then mudados := array_append(mudados, 'prioridade'); det := det || jsonb_build_object('prioridade', jsonb_build_object('de', old.prioridade, 'para', new.prioridade)); end if;
  if new.responsaveis is distinct from old.responsaveis then mudados := array_append(mudados, 'responsaveis'); det := det || jsonb_build_object('responsaveis', jsonb_build_object('de', to_jsonb(old.responsaveis), 'para', to_jsonb(new.responsaveis))); end if;
  if new.data_inicio is distinct from old.data_inicio then mudados := array_append(mudados, 'data_inicio'); det := det || jsonb_build_object('data_inicio', jsonb_build_object('de', old.data_inicio, 'para', new.data_inicio)); end if;
  if new.data_vencimento is distinct from old.data_vencimento then mudados := array_append(mudados, 'data_vencimento'); det := det || jsonb_build_object('data_vencimento', jsonb_build_object('de', old.data_vencimento, 'para', new.data_vencimento)); end if;
  if new.estimativa_min is distinct from old.estimativa_min then mudados := array_append(mudados, 'estimativa_min'); det := det || jsonb_build_object('estimativa_min', jsonb_build_object('de', old.estimativa_min, 'para', new.estimativa_min)); end if;
  if new.tipo_tarefa is distinct from old.tipo_tarefa then mudados := array_append(mudados, 'tipo_tarefa'); det := det || jsonb_build_object('tipo_tarefa', jsonb_build_object('de', old.tipo_tarefa, 'para', new.tipo_tarefa)); end if;
  if new.dificuldade is distinct from old.dificuldade then mudados := array_append(mudados, 'dificuldade'); det := det || jsonb_build_object('dificuldade', jsonb_build_object('de', old.dificuldade, 'para', new.dificuldade)); end if;
  if new.departamento is distinct from old.departamento then mudados := array_append(mudados, 'departamento'); det := det || jsonb_build_object('departamento', jsonb_build_object('de', to_jsonb(old.departamento), 'para', to_jsonb(new.departamento))); end if;
  if new.tags is distinct from old.tags then mudados := array_append(mudados, 'tags'); det := det || jsonb_build_object('tags', jsonb_build_object('de', to_jsonb(old.tags), 'para', to_jsonb(new.tags))); end if;
  if new.checklists is distinct from old.checklists then mudados := array_append(mudados, 'checklists'); end if;
  if new.parent_id is distinct from old.parent_id then mudados := array_append(mudados, 'parent_id'); det := det || jsonb_build_object('parent_id', jsonb_build_object('de', old.parent_id, 'para', new.parent_id)); end if;
  if new.lista_id is distinct from old.lista_id then mudados := array_append(mudados, 'lista_id'); det := det || jsonb_build_object('lista_id', jsonb_build_object('de', old.lista_id, 'para', new.lista_id)); end if;
  if new.arquivada is distinct from old.arquivada then mudados := array_append(mudados, 'arquivada'); det := det || jsonb_build_object('arquivada', jsonb_build_object('de', old.arquivada, 'para', new.arquivada)); end if;
  if new.clickup_removida_at is not null and old.clickup_removida_at is null then acao := 'removida'; end if;
  if cardinality(mudados) = 0 and acao <> 'removida' then return null; end if;

  insert into tarefas_sync_log (origem, acao, tarefa_id, clickup_task_id, campos, detalhe)
  values ('clickup', acao, new.id, new.clickup_task_id, mudados, det);
  return null;
end $$;

drop trigger if exists trg_tarefas_sync_log_itens on public.tarefas_itens;
create trigger trg_tarefas_sync_log_itens
  after insert or update on public.tarefas_itens
  for each row execute function public.tarefas_sync_log_mudanca();

-- Rastro de 30 dias (chamado pela rodada de /api/tarefas-sync).
create or replace function public.tarefas_sync_log_limpar(p_dias integer default 30)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from tarefas_sync_log where created_at < now() - make_interval(days => p_dias);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.tarefas_sync_log_limpar(integer) from public, anon, authenticated;
grant execute on function public.tarefas_sync_log_limpar(integer) to service_role;

-- ── Ações do painel sobre a fila ────────────────────────────────────────────
-- Tentar de novo: item com erro volta à fila do zero (o push lê o estado ATUAL da tarefa).
create or replace function public.tarefas_outbox_reenviar(p_ids bigint[])
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.uid() is null then raise exception 'precisa estar logado'; end if;
  update tarefas_outbox
     set status = 'pendente', tentativas = 0, erro = null, processed_at = null, reivindicado_em = null,
         resolvido_por = auth.uid(), resolvido_em = now()
   where id = any(p_ids) and status = 'erro';
  get diagnostics n = row_count;
  return n;
end $$;

-- Ignorar: o erro sai da lista de problemas (fica no histórico como "ignorado").
create or replace function public.tarefas_outbox_ignorar(p_ids bigint[])
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.uid() is null then raise exception 'precisa estar logado'; end if;
  update tarefas_outbox
     set status = 'cancelado', resolvido_por = auth.uid(), resolvido_em = now()
   where id = any(p_ids) and status = 'erro';
  get diagnostics n = row_count;
  return n;
end $$;

-- Forçar envio: põe na fila a tarefa INTEIRA (todos os campos), para quando o ClickUp ficou
-- diferente do VertaTask. Sem vínculo com o ClickUp, vira um "criar" (se ainda não houver).
create or replace function public.tarefas_outbox_forcar(p_tarefa uuid)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  t tarefas_itens%rowtype;
  novo bigint;
begin
  if auth.uid() is null then raise exception 'precisa estar logado'; end if;
  select * into t from tarefas_itens where id = p_tarefa;
  if not found then raise exception 'tarefa não encontrada'; end if;
  if t.clickup_task_id is null then
    select id into novo from tarefas_outbox where tarefa_id = p_tarefa and operacao = 'criar' and status in ('pendente', 'processando') limit 1;
    if novo is null then
      insert into tarefas_outbox (tarefa_id, operacao, ator_id) values (p_tarefa, 'criar', auth.uid()) returning id into novo;
    end if;
  else
    insert into tarefas_outbox (tarefa_id, operacao, clickup_task_id, campos, ator_id)
    values (p_tarefa, 'atualizar', t.clickup_task_id,
            array['titulo', 'descricao', 'status', 'prioridade', 'responsaveis', 'data_inicio', 'data_vencimento', 'estimativa_min',
                  'tipo_tarefa', 'dificuldade', 'departamento', 'tags', 'checklists', 'parent_id', 'arquivada'],
            auth.uid())
    returning id into novo;
  end if;
  return novo;
end $$;

revoke all on function public.tarefas_outbox_reenviar(bigint[]) from public, anon;
revoke all on function public.tarefas_outbox_ignorar(bigint[]) from public, anon;
revoke all on function public.tarefas_outbox_forcar(uuid) from public, anon;
grant execute on function public.tarefas_outbox_reenviar(bigint[]) to authenticated;
grant execute on function public.tarefas_outbox_ignorar(bigint[]) to authenticated;
grant execute on function public.tarefas_outbox_forcar(uuid) to authenticated;
