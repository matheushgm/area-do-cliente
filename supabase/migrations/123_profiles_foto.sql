-- 123 — Foto das pessoas (2026-10-29)
--
-- `profiles.avatar` guarda as iniciais ("MM") e continua sendo o reserva. `foto_url` é a foto
-- do ClickUp (`profilePicture` dos membros do workspace), cruzada por `clickup_user_id` e
-- regravada pela rodada diária de /api/tarefas-sync (api/_clickup_fotos.js). Nula = a pessoa
-- não tem foto no ClickUp ou não tem ClickUp: os avatares mostram as iniciais.

alter table public.profiles add column if not exists foto_url text;
