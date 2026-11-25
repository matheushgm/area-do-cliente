-- Migration 142: usuário que só acessa o VertaTask, e só dos clientes escolhidos.
--
-- Pedido do Matheus em 25/11/2026: às vezes o acesso vai para terceiros, que não podem
-- ver os outros clientes nem o resto da Área do Cliente.
--
-- Como funciona:
--   * a permissão é app_metadata.role = 'vertatask' (gravada pela api/admin-users.js;
--     o usuário não consegue mudar o app_metadata sozinho);
--   * os clientes liberados ficam em vertatask_acessos (um por linha). Tirar um cliente
--     corta o acesso na hora, sem esperar o token renovar;
--   * cada tabela do schema public com RLS ganha políticas RESTRICTIVE (vt_restrito_*):
--     para quem não é restrito elas valem sempre verdadeiro, para o restrito só deixam
--     passar o que é das pastas dos clientes dele. Restritiva soma (E) com as políticas
--     que já existem, então não abre nada para ninguém, só fecha para o restrito;
--   * tabela nova com RLS recebe as mesmas políticas pelo event trigger do fim do arquivo.
--     Para liberar uma tabela nova ao restrito, chame vt_aplicar_bloqueio com as regras dela.
--
-- Conferir (tem que voltar vazio):
--   select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
--    where n.nspname = 'public' and c.relkind in ('r','p') and c.relrowsecurity
--      and not exists (select 1 from pg_policies p where p.schemaname = 'public'
--                      and p.tablename = c.relname and p.policyname = 'vt_restrito_ler');

-- ─── Quem é restrito ─────────────────────────────────────────────────────────

create or replace function public.acesso_restrito()
returns boolean language sql stable set search_path = public as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'vertatask'
$$;

create table if not exists public.vertatask_acessos (
  user_id    uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects_v2(id) on delete cascade,
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, project_id)
);

alter table public.vertatask_acessos enable row level security;

drop policy if exists vertatask_acessos_admin on public.vertatask_acessos;
create policy vertatask_acessos_admin on public.vertatask_acessos for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists vertatask_acessos_proprio on public.vertatask_acessos;
create policy vertatask_acessos_proprio on public.vertatask_acessos for select to authenticated
  using (user_id = auth.uid());

-- ─── O que o restrito pode ver (security definer: não passa pela RLS de novo) ───

create or replace function public.vt_pastas_permitidas()
returns setof uuid language sql stable security definer set search_path = public as $$
  select p.id
    from tarefas_pastas p
    join vertatask_acessos a on a.project_id = p.project_id
   where a.user_id = auth.uid()
$$;

create or replace function public.vt_listas_permitidas()
returns setof uuid language sql stable security definer set search_path = public as $$
  select l.id from tarefas_listas l where l.pasta_id in (select public.vt_pastas_permitidas())
$$;

create or replace function public.vt_tarefa_permitida(p_tarefa uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from tarefas_itens t
     where t.id = p_tarefa and t.lista_id in (select public.vt_listas_permitidas())
  )
$$;

-- anexo do bucket task-attachments: o caminho começa pelo id da tarefa
create or replace function public.vt_anexo_permitido(p_nome text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from tarefas_itens t
     where t.id::text = split_part(p_nome, '/', 1)
       and t.lista_id in (select public.vt_listas_permitidas())
  )
$$;

-- ─── Políticas restritivas ──────────────────────────────────────────────────────
-- p_ler / p_escrever são expressões SQL do que o restrito pode; 'false' = nada.

create or replace function public.vt_aplicar_bloqueio(p_tabela regclass, p_ler text default 'false', p_escrever text default 'false')
returns void language plpgsql set search_path = public as $$
declare
  r constant text := '(select public.acesso_restrito())';
begin
  execute format('drop policy if exists vt_restrito_ler on %s', p_tabela);
  execute format('drop policy if exists vt_restrito_inserir on %s', p_tabela);
  execute format('drop policy if exists vt_restrito_alterar on %s', p_tabela);
  execute format('drop policy if exists vt_restrito_apagar on %s', p_tabela);
  execute format('create policy vt_restrito_ler on %s as restrictive for select to authenticated using (not %s or (%s))', p_tabela, r, p_ler);
  execute format('create policy vt_restrito_inserir on %s as restrictive for insert to authenticated with check (not %s or (%s))', p_tabela, r, p_escrever);
  execute format('create policy vt_restrito_alterar on %s as restrictive for update to authenticated using (not %s or (%s)) with check (not %s or (%s))', p_tabela, r, p_escrever, r, p_escrever);
  execute format('create policy vt_restrito_apagar on %s as restrictive for delete to authenticated using (not %s or (%s))', p_tabela, r, p_escrever);
end $$;

revoke all on function public.vt_aplicar_bloqueio(regclass, text, text) from public, anon, authenticated;

-- Backups sem RLS ficavam abertos a qualquer chave (anon inclusive). Só a chave de serviço lê.
alter table if exists public._bkp_nomus_titulos_20260815 enable row level security;
alter table if exists public.dash_insights_bkp_20260722 enable row level security;

-- Tudo fechado para o restrito...
do $$
declare t record;
begin
  for t in
    select c.oid::regclass as tabela
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relrowsecurity
  loop
    perform public.vt_aplicar_bloqueio(t.tabela);
  end loop;
end $$;

-- ...menos o que o VertaTask precisa, só dos clientes dele.
select public.vt_aplicar_bloqueio('public.tarefas_pastas',
  'id in (select public.vt_pastas_permitidas())');
select public.vt_aplicar_bloqueio('public.tarefas_listas',
  'pasta_id in (select public.vt_pastas_permitidas())');
select public.vt_aplicar_bloqueio('public.tarefas_itens',
  'lista_id in (select public.vt_listas_permitidas())',
  'lista_id in (select public.vt_listas_permitidas())');
select public.vt_aplicar_bloqueio('public.tarefas_comentarios',
  'public.vt_tarefa_permitida(tarefa_id)', 'public.vt_tarefa_permitida(tarefa_id)');
select public.vt_aplicar_bloqueio('public.tarefas_relacoes',
  'public.vt_tarefa_permitida(tarefa_id) or public.vt_tarefa_permitida(relacionada_id)',
  'public.vt_tarefa_permitida(tarefa_id) and public.vt_tarefa_permitida(relacionada_id)');
select public.vt_aplicar_bloqueio('public.tarefas_atividade',
  'public.vt_tarefa_permitida(tarefa_id)');
select public.vt_aplicar_bloqueio('public.tarefas_seguidores',
  'public.vt_tarefa_permitida(tarefa_id)', 'public.vt_tarefa_permitida(tarefa_id)');
select public.vt_aplicar_bloqueio('public.tarefas_outbox',
  'tarefa_id is not null and public.vt_tarefa_permitida(tarefa_id)');
select public.vt_aplicar_bloqueio('public.tarefas_views',
  'pasta_id is null or pasta_id in (select public.vt_pastas_permitidas())',
  'dono_id = auth.uid() or pasta_id in (select public.vt_pastas_permitidas())');
select public.vt_aplicar_bloqueio('public.tarefas_etiquetas', 'true');
select public.vt_aplicar_bloqueio('public.tarefas_sync', 'true');
select public.vt_aplicar_bloqueio('public.notifications', 'user_id = auth.uid()', 'user_id = auth.uid()');
select public.vt_aplicar_bloqueio('public.profiles', 'true', 'id = auth.uid()');
select public.vt_aplicar_bloqueio('public.vertatask_acessos', 'user_id = auth.uid()');

-- Storage: só os anexos das tarefas liberadas.
drop policy if exists vt_restrito_storage on storage.objects;
create policy vt_restrito_storage on storage.objects as restrictive for all to authenticated
  using (not (select public.acesso_restrito()) or (bucket_id = 'task-attachments' and public.vt_anexo_permitido(name)))
  with check (not (select public.acesso_restrito()) or (bucket_id = 'task-attachments' and public.vt_anexo_permitido(name)));

-- ─── Funções security definer que o time chama com o próprio token ───────────────
-- Elas não passam pela RLS, então recusam o restrito por conta própria.
-- ⚠ Quem recriar uma delas numa migration nova precisa manter a checagem.

do $$
declare
  f record;
  def text;
  novo text;
begin
  for f in
    select p.oid, p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('chat_toggle_reaction', 'seed_nps_marcos_padrao', 'tarefas_outbox_forcar',
                         'tarefas_outbox_ignorar', 'tarefas_outbox_reenviar')
  loop
    def := pg_get_functiondef(f.oid);
    continue when def like '%acesso_restrito%';
    novo := regexp_replace(def, '\m(begin)\M',
      E'\\1\n  if public.acesso_restrito() then raise exception ''acesso restrito ao VertaTask'' using errcode = ''42501''; end if;', 'i');
    if novo = def then raise exception 'migration 142: não achei o begin de %', f.proname; end if;
    execute novo;
  end loop;

  for f in
    select p.oid, p.proname,
           case p.proname when 'dash_benchmark' then 'where dd.channel in (''meta'', ''google'')'
                          else 'where di.channel in (''meta'', ''google'')' end as trecho
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('dash_benchmark', 'dash_totals_by_project')
  loop
    def := pg_get_functiondef(f.oid);
    continue when def like '%acesso_restrito%';
    novo := replace(def, f.trecho, replace(f.trecho, 'where ', 'where not public.acesso_restrito() and '));
    if novo = def then raise exception 'migration 142: não achei o filtro de %', f.proname; end if;
    execute novo;
  end loop;
end $$;

-- ─── Tabela nova com RLS já nasce fechada para o restrito ──────────────────────

create or replace function public.vt_bloqueio_tabela_nova()
returns event_trigger language plpgsql security definer set search_path = public as $$
declare
  c record;
begin
  for c in select * from pg_event_trigger_ddl_commands() loop
    begin
      if c.object_type = 'table' and c.schema_name = 'public'
         and exists (select 1 from pg_class where oid = c.objid and relrowsecurity)
         and not exists (select 1 from pg_policy where polrelid = c.objid and polname = 'vt_restrito_ler') then
        perform public.vt_aplicar_bloqueio(c.objid::regclass);
      end if;
    exception when others then
      -- nunca derrubar a migration de outra pessoa por causa disso
      raise warning 'vt_bloqueio_tabela_nova: % (%)', sqlerrm, c.object_identity;
    end;
  end loop;
end $$;

drop event trigger if exists vt_bloqueio_tabela_nova;
create event trigger vt_bloqueio_tabela_nova on ddl_command_end
  when tag in ('CREATE TABLE', 'ALTER TABLE')
  execute function public.vt_bloqueio_tabela_nova();
