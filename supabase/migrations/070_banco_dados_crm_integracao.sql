-- Migration 070: integração do "Banco de dados" com o CRM do cliente.
--
-- crm_config (em bancos_dados) guarda a configuração do encaminhamento:
--   {
--     "enabled": true,
--     "endpoint": "https://crm.exemplo.com/api/leads",
--     "method": "POST",
--     "headers": [{ "key": "Authorization", "value": "Bearer ..." }],
--     "bodyTemplate": "{\"name\":\"{{nome}}\",\"email\":\"{{email}}\"}",
--     "docsUrl": "...", "docsText": "...", "notas": "..."
--   }
-- Os placeholders {{chave}} referenciam as chaves de `campos` do banco.
alter table public.bancos_dados
  add column if not exists crm_config jsonb;

-- Observabilidade do encaminhamento, por lead.
alter table public.bancos_dados_registros
  add column if not exists crm_status text;   -- ok | erro | null (não enviado)

alter table public.bancos_dados_registros
  add column if not exists crm_response text; -- status + corpo da resposta (truncado)
