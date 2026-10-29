-- 122 — Chat ↔ ClickUp Chat desligado (2026-10-29, docs/plano-sincronizacao-clickup.md item 6)
--
-- O chat continua entre as pessoas do time, mas nada mais vai para o ClickUp: o front não chama
-- /api/chat-sync (que responde 503) e a rodada diária não roda o chat. Sem desligar os triggers,
-- chat_outbox cresceria para sempre. DISABLE (e não DROP) para religar com ENABLE; os itens que
-- estavam na fila viram 'cancelado' para não subirem de uma vez se um dia religar.

alter table public.chat_messages disable trigger trg_chat_outbox_messages;
alter table public.chat_channels disable trigger trg_chat_outbox_channels;

update public.chat_outbox set status = 'cancelado' where status in ('pendente', 'erro');

-- Para religar:
--   alter table public.chat_messages enable trigger trg_chat_outbox_messages;
--   alter table public.chat_channels enable trigger trg_chat_outbox_channels;
