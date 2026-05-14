-- Migration 037: fix da trigger log_contract_value_change
--
-- Bug: a trigger criada na migration 036 rodava como SECURITY INVOKER
-- (permissões do usuário autenticado). Como contract_value_history só tem
-- policy de SELECT e nenhuma de INSERT, o INSERT da trigger era bloqueado
-- pela RLS, causando rollback de TODO o UPDATE em projects_v2 — qualquer
-- alteração de contract_value voltava ao valor antigo após refresh.
--
-- Solução: SECURITY DEFINER faz a função rodar com privilégios do owner,
-- contornando a RLS. A tabela de histórico continua só-leitura para os
-- usuários — escrita exclusivamente via esta trigger. search_path fixo
-- também resolve o aviso 'function_search_path_mutable' do advisor.

CREATE OR REPLACE FUNCTION log_contract_value_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.contract_value IS DISTINCT FROM OLD.contract_value THEN
    INSERT INTO public.contract_value_history (project_id, old_value, new_value)
    VALUES (NEW.id, OLD.contract_value, NEW.contract_value);
  END IF;
  RETURN NEW;
END;
$$;
