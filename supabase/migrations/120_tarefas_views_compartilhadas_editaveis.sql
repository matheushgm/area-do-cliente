-- 120 (era 116; renumerada, já aplicada no banco com o nome antigo) — Views salvas compartilhadas: qualquer pessoa do time edita
--
-- Até a 114 uma visualização salva (padrao_tipo nula) só podia ser editada pelo dono, mesmo
-- compartilhada (acesso = 'publica'): os outros mexiam só na tela e salvavam como nova. Agora,
-- compartilhada, qualquer pessoa ajusta nome, configuração e posição. Continuam só do dono:
-- mudar quem vê (acesso), excluir, e as colunas de identidade (dono, escopo, pasta, padrao_tipo).
-- Privadas seguem só do dono; as padrão seguem como na 113/114.

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
  -- salva de outra pessoa (só chega aqui se for compartilhada, pela policy): só nome e config
  -- auth.uid() nula = chave de serviço, que não passa por esta regra
  if old.padrao_tipo is null and auth.uid() is not null and old.dono_id is distinct from auth.uid() and (
       new.padrao_tipo is distinct from old.padrao_tipo
    or new.dono_id     is distinct from old.dono_id
    or new.escopo      is distinct from old.escopo
    or new.pasta_id    is distinct from old.pasta_id
    or new.acesso      is distinct from old.acesso
  ) then
    raise exception 'Visualização compartilhada: só quem criou muda quem vê' using errcode = '42501';
  end if;
  return new;
end $$;

drop policy if exists "tarefas_views_update" on public.tarefas_views;
create policy "tarefas_views_update" on public.tarefas_views for update to authenticated
  using (
    dono_id = auth.uid()
    or (padrao_tipo is not null and escopo <> 'minhas')
    or (padrao_tipo is null and acesso = 'publica')
  )
  with check (
    dono_id = auth.uid()
    or (padrao_tipo is not null and escopo <> 'minhas' and acesso = 'publica')
    or (padrao_tipo is null and acesso = 'publica')
  );
