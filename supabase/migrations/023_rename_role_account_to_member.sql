-- 023: Renomeia role 'account' para 'member'
--
-- O valor 'account' era pouco descritivo. 'member' comunica melhor
-- que o usuário é um membro do time com acesso padrão.
--
-- Atualiza app_metadata dos usuários existentes.
-- As RLS policies de accounts usam is_squad_member() e não checam
-- o valor do role diretamente — não precisam ser alteradas.

UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', 'member')
WHERE raw_app_meta_data->>'role' = 'account';
