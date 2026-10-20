-- Classificação comercial do cliente, perguntada no cadastro e no cartão do perfil.
--   plan_type:    'programa' | 'plano'
--   billing_mode: 'pre_pago' | 'pos_pago'
alter table public.projects_v2
  add column if not exists plan_type    text check (plan_type    in ('programa', 'plano')),
  add column if not exists billing_mode text check (billing_mode in ('pre_pago', 'pos_pago'));
