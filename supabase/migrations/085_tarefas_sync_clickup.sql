-- Migration 085: sincronização incremental ClickUp → Tarefas (api/tarefas-sync.js)
--
-- clickup_updated_at guarda o date_updated do ClickUp na última sincronização;
-- clickup_sync_at, o momento em que a linha foi gravada pela sincronização.
-- Regra de conflito: se a linha foi editada na Área depois da última
-- sincronização (updated_at > clickup_sync_at) e o ClickUp está mais antigo que
-- essa edição, a Área vence; senão o lado mais recente vence.

alter table public.tarefas_itens add column if not exists clickup_updated_at timestamptz;
alter table public.tarefas_itens add column if not exists clickup_sync_at timestamptz;
update public.tarefas_itens set clickup_updated_at = updated_at, clickup_sync_at = updated_at
  where clickup_task_id is not null and clickup_updated_at is null;
alter table public.tarefas_comentarios add column if not exists clickup_updated_at timestamptz;

create table if not exists public.tarefas_sync (
  id            text primary key default 'clickup',
  ultimo_inicio timestamptz,
  ultimo_fim    timestamptz,
  ultimo_ok     boolean,
  resumo        jsonb not null default '{}'::jsonb,
  updated_at    timestamptz not null default now()
);
alter table public.tarefas_sync enable row level security;
drop policy if exists "tarefas_sync_team" on public.tarefas_sync;
create policy "tarefas_sync_team" on public.tarefas_sync for select to authenticated using (true);
insert into public.tarefas_sync (id, ultimo_inicio, ultimo_fim, ultimo_ok, resumo)
  values ('clickup', now(), now(), true, '{"origem":"importacao_inicial"}'::jsonb)
  on conflict (id) do nothing;

-- O trigger de updated_at não conta a escrita da própria sincronização:
-- quando clickup_sync_at muda, updated_at acompanha (assim
-- "updated_at > clickup_sync_at" significa edição feita na Área).
create or replace function public.tarefas_touch_updated_at()
returns trigger language plpgsql as $$
begin
  if tg_table_name = 'tarefas_itens' and new.clickup_sync_at is distinct from old.clickup_sync_at then
    new.updated_at = new.clickup_sync_at;
  else
    new.updated_at = now();
  end if;
  return new;
end $$;

alter table public.tarefas_itens disable trigger trg_tarefas_itens_touch;
update public.tarefas_itens set clickup_sync_at = updated_at where clickup_task_id is not null;
alter table public.tarefas_itens enable trigger trg_tarefas_itens_touch;
