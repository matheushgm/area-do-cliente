-- Migration 139: menções em um lugar só (sino de menções da sidebar) + correções do chat.
--
-- 1. Comentário de tarefa ganha `mencionados uuid[]` (quem foi marcado com @). Vem do
--    composer do VertaTask e, nos comentários do ClickUp, dos blocos `tag` (mapComentario).
--    Trigger nova notifica cada marcado com `tarefa_mencao`; quem foi marcado não recebe
--    também o `tarefa_comentario` genérico de seguidor.
-- 2. Menção do chat: link direto para o VertaTask (sem passar pelo redirect /chat), com a
--    mensagem (`msg`) e a thread; canal privado só notifica quem é membro.
-- 3. Chat: o criador não conseguia criar DM nem canal privado (o INSERT ... RETURNING
--    batia na policy de leitura, porque ainda não era membro). E qualquer pessoa podia se
--    pôr como membro de DM/canal privado alheio; a inserção de membro agora exige ser
--    membro, criador do canal ou entrar sozinho num canal público.
-- 4. Menções do chat com mais de 14 dias nunca vistas viram lidas: não havia onde lê-las e
--    o sino abriria com centenas.

-- ── 1. Menções em comentários de tarefa ───────────────────────────────────────
alter table public.tarefas_comentarios
  add column if not exists mencionados uuid[] not null default '{}';

create or replace function public.tarefas_comentario_mencao_notifica()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  alvo uuid;
  t record;
  antigos uuid[] := case when tg_op = 'UPDATE' then coalesce(old.mencionados, '{}') else '{}' end;
begin
  if new.mencionados is null or cardinality(new.mencionados) = 0 then return new; end if;
  -- Importação/reconciliação de comentário antigo não notifica (o webhook e a rodada
  -- trazem comentário do ClickUp com a data de lá, por isso a janela é de 3 dias).
  if new.created_at < now() - interval '3 days' then return new; end if;

  select i.id, i.titulo, p.nome as pasta, p.project_id
    into t
    from public.tarefas_itens i
    left join public.tarefas_listas l on l.id = i.lista_id
    left join public.tarefas_pastas p on p.id = l.pasta_id
   where i.id = new.tarefa_id;
  if t.id is null then return new; end if;

  foreach alvo in array new.mencionados loop
    if alvo is distinct from new.autor_id
       and not (alvo = any(antigos))
       and exists (select 1 from public.profiles where id = alvo) then
      insert into public.notifications (user_id, type, title, body, link, data)
      values (
        alvo, 'tarefa_mencao',
        coalesce(new.autor_nome, 'Alguém') || ' mencionou você em um comentário',
        substring(new.texto from 1 for 280),
        '/tarefas?tarefa=' || new.tarefa_id::text,
        jsonb_build_object(
          'tarefa_id', new.tarefa_id, 'comentario_id', new.id, 'sender_id', new.autor_id,
          'sender_nome', new.autor_nome, 'tarefa_titulo', t.titulo, 'pasta', t.pasta,
          'project_id', t.project_id
        )
      );
    end if;
  end loop;
  return new;
end $$;

drop trigger if exists trg_tarefas_comentario_mencao on public.tarefas_comentarios;
create trigger trg_tarefas_comentario_mencao
  after insert or update of mencionados on public.tarefas_comentarios
  for each row execute function public.tarefas_comentario_mencao_notifica();

-- Seguidor que foi marcado já recebe a menção; não manda o "comentou" junto.
create or replace function public.tarefas_comentario_notifica()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  t record;
  alvo uuid;
begin
  select id, titulo, responsaveis, criado_por into t from public.tarefas_itens where id = new.tarefa_id;
  if t.id is null then return new; end if;
  if new.autor_id is not null then
    insert into public.tarefas_seguidores (tarefa_id, user_id) values (new.tarefa_id, new.autor_id) on conflict do nothing;
  end if;
  if new.autor_id is null then return new; end if;
  for alvo in
    select distinct u from (
      select user_id as u from public.tarefas_seguidores where tarefa_id = new.tarefa_id
      union select unnest(t.responsaveis)
    ) x where u is not null and u <> new.autor_id and not (u = any(coalesce(new.mencionados, '{}')))
  loop
    insert into public.notifications (user_id, type, title, body, link, data)
    values (alvo, 'tarefa_comentario', coalesce(new.autor_nome, 'Alguém') || ' comentou em uma tarefa', substring(new.texto from 1 for 200),
            '/tarefas?tarefa=' || new.tarefa_id::text, jsonb_build_object('tarefa_id', new.tarefa_id, 'comentario_id', new.id));
  end loop;
  return new;
end $$;

-- ── 2. Menção no chat ─────────────────────────────────────────────────────────
create or replace function public.fn_chat_mention_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  mencionado uuid;
  remetente text;
  canal record;
  link_url text;
  titulo text;
begin
  if new.mentioned_user_ids is null or cardinality(new.mentioned_user_ids) = 0 then return new; end if;
  if new.created_at < now() - interval '1 hour' then return new; end if;

  select name into remetente from profiles where id = new.user_id;
  select name, type, visibility into canal from chat_channels where id = new.channel_id;

  link_url := '/tarefas?aba=chat&channel=' || new.channel_id::text
              || case when new.parent_id is not null then '&thread=' || new.parent_id::text else '' end
              || '&msg=' || new.id::text;

  if canal.type = 'channel' then
    titulo := coalesce(remetente, 'Alguém') || ' mencionou você em #' || coalesce(canal.name, 'canal');
  else
    titulo := coalesce(remetente, 'Alguém') || ' mencionou você';
  end if;

  foreach mencionado in array new.mentioned_user_ids loop
    if mencionado is distinct from new.user_id
       and (canal.visibility = 'public' and canal.type = 'channel'
            or exists (select 1 from chat_channel_members where channel_id = new.channel_id and user_id = mencionado)) then
      insert into notifications (user_id, type, title, body, link, data)
      values (
        mencionado, 'mention', titulo, substring(new.content from 1 for 280), link_url,
        jsonb_build_object(
          'channel_id', new.channel_id, 'message_id', new.id, 'parent_id', new.parent_id,
          'sender_id', new.user_id, 'sender_nome', remetente,
          'canal_nome', canal.name, 'canal_tipo', canal.type
        )
      );
    end if;
  end loop;
  return new;
end $$;

-- Links antigos gravados como /chat?channel= seguem funcionando (RedirectChat).

-- ── 3. RLS do chat ────────────────────────────────────────────────────────────
drop policy if exists chat_channels_select on public.chat_channels;
create policy chat_channels_select on public.chat_channels for select using (
  is_channel_member(id)
  or created_by = auth.uid()
  or (visibility = 'public' and type = 'channel' and auth.role() = 'authenticated')
);

drop policy if exists chat_members_insert on public.chat_channel_members;
create policy chat_members_insert on public.chat_channel_members for insert with check (
  auth.role() = 'authenticated' and (
    (user_id = auth.uid() and is_channel_public(channel_id))
    or is_channel_member(channel_id)
    or exists (select 1 from public.chat_channels c where c.id = channel_id and c.created_by = auth.uid())
  )
);

-- ── 4. Limpeza das menções antigas nunca vistas ───────────────────────────────
update public.notifications
   set read_at = now()
 where type = 'mention' and read_at is null and created_at < now() - interval '14 days';

-- Leitura do sino: as menções de uma pessoa, das mais novas.
create index if not exists idx_notifications_user_tipo
  on public.notifications (user_id, type, created_at desc);
