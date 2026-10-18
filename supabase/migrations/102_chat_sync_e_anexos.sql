-- Chat: sincronização de mão dupla com o ClickUp Chat + anexos (2026-10-18).
--  * chat_sync: estado da última rodada (igual a tarefas_sync).
--  * chat_outbox: fila de saída preenchida por trigger a cada mensagem/canal
--    criado ou mensagem apagada por pessoa logada; api/_chat_sync_core.js
--    esvazia escrevendo no ClickUp. Escritas da sincronização (chave de
--    serviço, auth.uid() nulo) não entram.
--  * bucket chat-attachments (privado, todo o time) e a permissão do bucket
--    task-attachments para as tarefas do VertaTask (a policy antiga olhava a
--    tabela legada `tasks`, e só admin conseguia anexar).
create table if not exists public.chat_sync (
  id            text primary key,
  ultimo_inicio timestamptz,
  ultimo_fim    timestamptz,
  ultimo_ok     boolean,
  resumo        jsonb,
  updated_at    timestamptz not null default now()
);
alter table public.chat_sync enable row level security;
drop policy if exists "chat_sync_select" on public.chat_sync;
create policy "chat_sync_select" on public.chat_sync for select to authenticated using (true);

create table if not exists public.chat_outbox (
  id                 bigserial primary key,
  message_id         uuid,
  channel_id         uuid,
  operacao           text not null check (operacao in ('enviar', 'excluir', 'canal')),
  clickup_message_id text,
  status             text not null default 'pendente' check (status in ('pendente', 'ok', 'erro', 'cancelado')),
  tentativas         int not null default 0,
  erro               text,
  created_at         timestamptz not null default now(),
  processed_at       timestamptz
);
create index if not exists chat_outbox_pendentes_idx on public.chat_outbox (status, id) where status = 'pendente';
alter table public.chat_outbox enable row level security;
drop policy if exists "chat_outbox_select" on public.chat_outbox;
create policy "chat_outbox_select" on public.chat_outbox for select to authenticated using (true);

create or replace function public.chat_outbox_enfileira()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return null; end if;
  if tg_table_name = 'chat_messages' then
    if tg_op = 'INSERT' then
      if new.clickup_message_id is null then
        insert into chat_outbox (message_id, channel_id, operacao) values (new.id, new.channel_id, 'enviar');
      end if;
    elsif tg_op = 'DELETE' then
      update chat_outbox set status = 'cancelado', processed_at = now() where message_id = old.id and status = 'pendente';
      if old.clickup_message_id is not null then
        insert into chat_outbox (message_id, channel_id, operacao, clickup_message_id) values (old.id, old.channel_id, 'excluir', old.clickup_message_id);
      end if;
    end if;
  elsif tg_table_name = 'chat_channels' then
    if tg_op = 'INSERT' and new.clickup_channel_id is null and new.type = 'channel' then
      insert into chat_outbox (channel_id, operacao) values (new.id, 'canal');
    end if;
  end if;
  return null;
end $$;

drop trigger if exists trg_chat_outbox_messages on public.chat_messages;
create trigger trg_chat_outbox_messages after insert or delete on public.chat_messages
  for each row execute function public.chat_outbox_enfileira();
drop trigger if exists trg_chat_outbox_channels on public.chat_channels;
create trigger trg_chat_outbox_channels after insert on public.chat_channels
  for each row execute function public.chat_outbox_enfileira();

-- Mensagem só com anexo: o texto pode ficar vazio.
alter table public.chat_messages alter column content set default '';

-- Anexos do chat
insert into storage.buckets (id, name, public) values ('chat-attachments', 'chat-attachments', false)
  on conflict (id) do nothing;
drop policy if exists "chat_attachments_team" on storage.objects;
create policy "chat_attachments_team" on storage.objects for all to authenticated
  using (bucket_id = 'chat-attachments') with check (bucket_id = 'chat-attachments');

-- Anexos das tarefas do VertaTask: pasta = id da tarefa em tarefas_itens
drop policy if exists "task_attachments_vertatask" on storage.objects;
create policy "task_attachments_vertatask" on storage.objects for all to authenticated
  using (bucket_id = 'task-attachments' and exists (select 1 from public.tarefas_itens t where t.id::text = (storage.foldername(name))[1]))
  with check (bucket_id = 'task-attachments' and exists (select 1 from public.tarefas_itens t where t.id::text = (storage.foldername(name))[1]));
