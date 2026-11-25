-- Migration 140: nome de quem escreveu a mensagem quando ela veio do ClickUp de alguém sem
-- perfil na Área (ex-colaborador, cliente convidado). Sem isso a mensagem aparecia como
-- "Usuário". Preenchido por puxar() (api/_chat_sync_core.js) a partir dos membros do workspace.
alter table public.chat_messages add column if not exists autor_nome text;
