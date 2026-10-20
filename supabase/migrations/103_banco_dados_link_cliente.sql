-- Migration 103: link de visualização do "Banco de dados" para o cliente.
--
-- share_token: token do link público /leads/<token> (somente leitura, sem login).
--   null = link desligado. Gerar de novo troca o token e derruba o link antigo.
-- share_ocultos: chaves de `campos` que NÃO aparecem no link (ex.: ip, url).
-- A leitura pública passa por api/banco-dados-public.js (chave de serviço),
-- que devolve só os campos visíveis; a RLS das tabelas não muda.
alter table public.bancos_dados
  add column if not exists share_token text unique;

alter table public.bancos_dados
  add column if not exists share_ocultos text[] not null default '{}';
