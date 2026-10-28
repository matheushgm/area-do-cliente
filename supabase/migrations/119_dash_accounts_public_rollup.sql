-- Migration 119: dash_accounts_public lê o rollup em vez de dash_insights
--
-- A view lista os pares (canal, conta) com dado no dashboard: alimenta o seletor
-- "+ vincular conta" e diz em que canais cada conta do projeto tem dado (o viewer
-- embutido em Resultados de Tráfego). Sobre dash_insights ela percorria ~115 mil
-- linhas para devolver 169 pares: 3,3 s de CPU, duas vezes por abertura da seção
-- Tráfego, e o iframe esperava por ela (medido em 2026-10-28). O dash_daily tem os
-- mesmos pares (é derivado de dash_insights meta/google) em 41 mil linhas estreitas:
-- 18 ms. Única diferença: o rollup apara o nome da conta ("[NBS] Revenue " sem o
-- espaço final), e o front já apara.
--
-- Mesmas colunas, dono e opções da view anterior (security_invoker=false).

create or replace view public.dash_accounts_public
  with (security_invoker = false)
as
  select distinct channel, account
    from public.dash_daily
   where channel in ('meta', 'google')
     and account is not null;
