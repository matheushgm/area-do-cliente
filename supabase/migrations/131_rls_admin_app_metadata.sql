-- 131: Policies de admin passam a ler o papel de app_metadata (todas as que faltavam)
--
-- Problema: user_metadata é editável pelo próprio usuário
-- (supabase.auth.updateUser({ data: { role: 'admin' } })). Com o token renovado,
-- qualquer pessoa logada passava nas policies abaixo como admin: lia e escrevia
-- todos os projetos, as tabelas filhas, os squads, o perfil de qualquer um
-- (inclusive role e disabled) e os arquivos dos buckets privados.
--
-- As migrations 021 e 022 fizeram essa troca no repositório, mas em 09/11/2026 o
-- banco ainda tinha as 21 policies abaixo lendo user_metadata (só
-- profiles_admin_insert estava certa). Esta migration refaz o que elas pretendiam
-- e cobre também as 4 policies de Storage, que foram criadas fora das migrations.
--
-- Comportamento igual ao de hoje para quem é admin de verdade: os 3 admins já
-- têm role = 'admin' em app_metadata (conferido em 09/11/2026) e ninguém tem
-- 'admin' só em user_metadata. Em FOR ALL sem WITH CHECK o Postgres já usava o
-- USING como checagem; aqui ele fica explícito. As policies de membro (squad) e
-- profiles_upsert / profiles_select não mudam.

-- ── projects_v2 e tabelas filhas ──────────────────────────────────────────────
do $$
declare
  t text;
  pol text;
begin
  foreach t in array array[
    'projects_v2', 'roi_calculators', 'personas', 'ofertas', 'campaign_plans',
    'resultados', 'criativos', 'google_ads', 'landing_pages', 'banco_midia',
    'estrategia', 'estrategia_v2', 'attachments'
  ] loop
    pol := t || '_admin';
    execute format('drop policy if exists %I on public.%I', pol, t);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      'using ((auth.jwt() -> ''app_metadata'' ->> ''role'') = ''admin'') '
      'with check ((auth.jwt() -> ''app_metadata'' ->> ''role'') = ''admin'')',
      pol, t);
  end loop;
end $$;

-- ── produtos ──────────────────────────────────────────────────────────────────
drop policy if exists produtos_admin_all on public.produtos;
create policy produtos_admin_all on public.produtos
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ── squads ────────────────────────────────────────────────────────────────────
drop policy if exists squads_write on public.squads;
create policy squads_write on public.squads
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ── profiles ──────────────────────────────────────────────────────────────────
-- profiles_upsert (cada um no próprio perfil) e profiles_select ficam como estão.
drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write on public.profiles
  for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists profiles_admin_insert on public.profiles;
create policy profiles_admin_insert on public.profiles
  for insert to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ── Storage: buckets privados ─────────────────────────────────────────────────
do $$
declare
  b text;
begin
  foreach b in array array['attachments', 'brand-logos', 'brand-media', 'project-docs'] loop
    execute format('drop policy if exists %I on storage.objects', b || ' admin');
    execute format(
      'create policy %I on storage.objects for all to authenticated '
      'using (bucket_id = %L and (auth.jwt() -> ''app_metadata'' ->> ''role'') = ''admin'') '
      'with check (bucket_id = %L and (auth.jwt() -> ''app_metadata'' ->> ''role'') = ''admin'')',
      b || ' admin', b, b);
  end loop;
end $$;

-- ── Trava: nenhuma policy pode continuar lendo user_metadata ─────────────────
do $$
declare
  restantes text;
begin
  select string_agg(schemaname || '.' || tablename || '.' || policyname, ', ')
    into restantes
    from pg_policies
   where coalesce(qual, '') ilike '%user_metadata%'
      or coalesce(with_check, '') ilike '%user_metadata%';
  if restantes is not null then
    raise exception 'Ainda há policies lendo user_metadata: %', restantes;
  end if;
end $$;
