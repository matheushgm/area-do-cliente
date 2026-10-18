-- Espelho mais fiel do ClickUp no VertaTask (2026-10-18).
--  * pastas e listas sabem de qual space do ClickUp vieram (a sincronização
--    passa a cobrir mais de um space: Clientes, Operações, PROMPTS);
--  * listas guardam as datas de início/vencimento que o ClickUp tem na lista;
--  * tarefas guardam a data de fechamento (date_closed, distinta de date_done),
--    se o vencimento/início tem hora definida (no ClickUp, data sem hora fica
--    às 04:00 do fuso do workspace) e quando a tarefa sumiu do ClickUp
--    (apagada lá → arquivada aqui, com o carimbo em clickup_removida_at).
-- Trigger compartilhado por tarefas_itens e tarefas_listas: o acesso a
-- new.clickup_sync_at só pode acontecer na tabela que tem a coluna
-- (o AND do PL/pgSQL não garante curto-circuito → "record new has no field",
-- que quebrava qualquer UPDATE em tarefas_listas).
create or replace function public.tarefas_touch_updated_at()
returns trigger language plpgsql as $$
begin
  if tg_table_name = 'tarefas_itens' then
    if new.clickup_sync_at is distinct from old.clickup_sync_at then
      new.updated_at = new.clickup_sync_at;
    else
      new.updated_at = now();
    end if;
  else
    new.updated_at = now();
  end if;
  return new;
end $$;

alter table public.tarefas_pastas
  add column if not exists clickup_space_id text,
  add column if not exists espaco text;

alter table public.tarefas_listas
  add column if not exists clickup_space_id text,
  add column if not exists data_inicio timestamptz,
  add column if not exists data_vencimento timestamptz;

alter table public.tarefas_itens
  add column if not exists data_fechamento timestamptz,
  add column if not exists vencimento_com_hora boolean not null default false,
  add column if not exists inicio_com_hora boolean not null default false,
  add column if not exists clickup_removida_at timestamptz;

-- Tudo que já estava importado veio do space Clientes.
update public.tarefas_pastas set espaco = 'Clientes', clickup_space_id = '90090377342'
  where clickup_folder_id is not null and espaco is null;
update public.tarefas_listas set clickup_space_id = '90090377342'
  where clickup_list_id is not null and clickup_space_id is null;

create index if not exists tarefas_itens_clickup_task_id_idx on public.tarefas_itens (clickup_task_id);
