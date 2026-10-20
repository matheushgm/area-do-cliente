-- O trigger de updated_at só rodava em UPDATE: tarefa INSERIDA pela sincronização
-- ficava com updated_at = now() ≠ clickup_sync_at e, na rodada seguinte, era
-- tratada como "editada na Área" (pulada por conflito). Passa a rodar também
-- no INSERT: com clickup_sync_at preenchido, updated_at acompanha.
drop trigger if exists trg_tarefas_itens_touch on public.tarefas_itens;
create trigger trg_tarefas_itens_touch
  before insert or update on public.tarefas_itens
  for each row execute function public.tarefas_touch_updated_at();

-- Conserta as linhas já afetadas (só os dois lotes da sincronização de 14/10 e
-- 18/10/2026; nenhuma edição real da Área está nesse conjunto).
alter table public.tarefas_itens disable trigger trg_tarefas_itens_touch;
update public.tarefas_itens set updated_at = clickup_sync_at
  where clickup_task_id is not null and clickup_sync_at is not null
    and updated_at > clickup_sync_at + interval '1 second'
    and date_trunc('minute', updated_at) in (timestamptz '2026-10-14 19:14:00+00', timestamptz '2026-10-18 13:27:00+00');
alter table public.tarefas_itens enable trigger trg_tarefas_itens_touch;
