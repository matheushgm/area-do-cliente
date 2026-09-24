-- Migration 089: libera o canal `saldo` em dash_insights
--
-- Snapshot do saldo ATUAL de cada conta de anúncio (Meta + Google), coletado
-- pelo repo dashboard-api (saldo_sync.py) junto do sync de hora em hora. Uma
-- linha por conta/canal, sem dia — mesma forma do canal `meta_status`.
-- Alimenta a coluna "Saldo" da lista de contas da dashboard, no lugar da antiga
-- "Tend. 3d".
--
-- Sem este ALTER o CHECK de `channel` rejeita cada linha com 23514 e o sync
-- grava ZERO. E como o SupabaseSink trata falha de upsert como aviso (para uma
-- falha de rede num canal não derrubar os outros), o workflow terminaria "com
-- sucesso" sem ter gravado nada — foi exatamente o que aconteceu com os canais
-- google_ads/google_pages na migration 082.
alter table public.dash_insights drop constraint if exists dash_insights_channel_check;

alter table public.dash_insights add constraint dash_insights_channel_check
  check (channel = any (array[
    'meta'::text, 'google'::text, 'google_terms'::text, 'meta_status'::text,
    'google_ads'::text, 'google_pages'::text, 'saldo'::text
  ]));
