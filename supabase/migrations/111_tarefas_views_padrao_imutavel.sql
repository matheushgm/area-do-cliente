-- 111 — Views padrão: o que qualquer pessoa pode mudar
--
-- A 110 deixou qualquer pessoa do time editar as visualizações padrão (padrao_tipo), mas a
-- política de UPDATE não restringia QUAIS colunas: quem não é dono podia trocar dono_id para
-- si, mover a view de pasta/escopo ou zerar padrao_tipo e transformá-la numa view comum dele.
-- Nas padrão só nome, config e posicao mudam; o resto fica como foi criado. (acesso já é
-- garantido pelo check tarefas_views_padrao_publica_check.)

create or replace function public.tarefas_views_padrao_imutavel()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.padrao_tipo is not null and (
       new.padrao_tipo is distinct from old.padrao_tipo
    or new.dono_id     is distinct from old.dono_id
    or new.escopo      is distinct from old.escopo
    or new.pasta_id    is distinct from old.pasta_id
  ) then
    raise exception 'Visualização padrão: só nome e configuração podem mudar' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists trg_tarefas_views_padrao_imutavel on public.tarefas_views;
create trigger trg_tarefas_views_padrao_imutavel before update on public.tarefas_views
  for each row execute function public.tarefas_views_padrao_imutavel();

-- quem não é dono só pode deixar a linha como padrão pública
drop policy if exists "tarefas_views_update" on public.tarefas_views;
create policy "tarefas_views_update" on public.tarefas_views for update to authenticated
  using (dono_id = auth.uid() or padrao_tipo is not null)
  with check (dono_id = auth.uid() or (padrao_tipo is not null and acesso = 'publica'));
