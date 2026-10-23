-- 109 — Trava da sincronização ClickUp → VertaTask
--
-- /api/tarefas-sync pode ser chamado ao mesmo tempo pelo cron, pelo botão "ClickUp há X
-- min" e por cada navegador que abre o /tarefas com a última rodada antiga. Duas rodadas
-- em paralelo gastam o limite de 100 req/min do token em dobro e gravam as mesmas tarefas
-- juntas. A trava garante uma rodada por vez: quem chega com outra em andamento recebe
-- "já em andamento" sem chamar o ClickUp. Expira sozinha (ttl), para uma função que
-- morreu no meio (limite de 60 s da Vercel) não deixar a trava presa.
--
-- Também guarda o último evento recebido pelo webhook (linha 'clickup_webhook').

alter table public.tarefas_sync add column if not exists rodando_desde timestamptz;

create or replace function public.tarefas_sync_travar(p_id text, p_ttl_s integer default 120)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  ok boolean;
begin
  insert into public.tarefas_sync (id) values (p_id) on conflict (id) do nothing;
  update public.tarefas_sync
     set rodando_desde = now()
   where id = p_id
     and (rodando_desde is null or rodando_desde < now() - make_interval(secs => p_ttl_s))
  returning true into ok;
  return coalesce(ok, false);
end $$;

create or replace function public.tarefas_sync_soltar(p_id text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.tarefas_sync set rodando_desde = null where id = p_id;
$$;

-- só o servidor (chave de serviço) trava e solta
revoke all on function public.tarefas_sync_travar(text, integer) from public, anon, authenticated;
revoke all on function public.tarefas_sync_soltar(text) from public, anon, authenticated;
grant execute on function public.tarefas_sync_travar(text, integer) to service_role;
grant execute on function public.tarefas_sync_soltar(text) to service_role;
