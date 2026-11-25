-- Migration 144: achar um usuário do Auth pelo e-mail (só a chave de serviço).
--
-- A api/admin-users.js usa no "Criar usuário": quando o e-mail já tem cadastro sem permissão
-- (a pessoa entrou uma vez pelo Google e ficou sem papel, nem aparece na lista), o cadastro
-- é aproveitado em vez de devolver o 422 "email_exists" do Supabase.

create or replace function public.admin_usuario_por_email(p_email text)
returns table (id uuid, role text)
language sql stable security definer set search_path = public, auth as $$
  select u.id, u.raw_app_meta_data ->> 'role'
    from auth.users u
   where lower(u.email) = lower(trim(p_email))
   limit 1
$$;

revoke all on function public.admin_usuario_por_email(text) from public, anon, authenticated;
grant execute on function public.admin_usuario_por_email(text) to service_role;
