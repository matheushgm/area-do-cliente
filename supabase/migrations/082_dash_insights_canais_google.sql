-- Migration 082: libera os canais google_ads e google_pages em dash_insights
--
-- O CHECK de `channel` listava só os quatro canais originais (meta, google,
-- google_terms, meta_status). Quando o sync passou a coletar o nível de anúncio
-- (`google_ads`) e as páginas de destino (`google_pages`), o Postgres rejeitou
-- linha a linha com 23514 e o backfill gravou ZERO.
--
-- E passou despercebido: o SupabaseSink trata falha de upsert como aviso, de
-- propósito, para uma falha de rede num canal não derrubar o sync dos outros.
-- Com isso o workflow terminou "com sucesso" sem ter gravado nada. O sink agora
-- também imprime quantas linhas NÃO entraram, para esse caso não se disfarçar de
-- sucesso de novo.
alter table public.dash_insights drop constraint if exists dash_insights_channel_check;

alter table public.dash_insights add constraint dash_insights_channel_check
  check (channel = any (array[
    'meta'::text, 'google'::text, 'google_terms'::text, 'meta_status'::text,
    'google_ads'::text, 'google_pages'::text
  ]));
