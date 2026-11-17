-- 136: data de conclusão sempre preenchida em tarefa concluída.
--
-- Tarefa criada já num status de concluída ficava com data_conclusao vazia: só o
-- mudarStatus do front calculava a data, e o ClickUp devolve date_done/date_closed
-- vazios para tarefa que nasce fechada (a sincronização gravava null por cima).
-- A regra passa a valer no banco, para todo caminho (tela, edição em massa,
-- template, sincronização, scripts).

create or replace function public.tarefas_itens_data_conclusao()
returns trigger
language plpgsql
as $$
begin
  if new.status_tipo = 'closed' then
    if new.data_conclusao is null then
      new.data_conclusao := coalesce(
        -- já estava concluída: a sincronização mandando vazio não apaga a data
        case when tg_op = 'UPDATE' and old.status_tipo = 'closed' then old.data_conclusao end,
        new.data_fechamento,
        -- escrita sem pessoa (sincronização, scripts): a última edição no ClickUp
        case when auth.uid() is null then new.clickup_updated_at end,
        now()
      );
    end if;
  else
    new.data_conclusao := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tarefas_itens_data_conclusao on public.tarefas_itens;
create trigger trg_tarefas_itens_data_conclusao
  before insert or update of status_tipo, data_conclusao on public.tarefas_itens
  for each row execute function public.tarefas_itens_data_conclusao();

-- Tarefas que já ficaram sem data (24 em 17/11/2026, todas criadas concluídas no
-- ClickUp ou aqui): a conclusão é a última edição no ClickUp, colada na criação.
update public.tarefas_itens
   set data_conclusao = coalesce(data_fechamento, clickup_updated_at, created_at)
 where status_tipo = 'closed' and data_conclusao is null;
