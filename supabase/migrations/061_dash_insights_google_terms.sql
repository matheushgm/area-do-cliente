-- Termos de pesquisa do Google Ads no Dashboard de Tráfego (versão API).
--
-- A tabela public.dash_insights guarda as linhas coletadas por canal. Hoje o
-- CHECK só permite channel IN ('meta','google'). Os termos de pesquisa
-- (search_term_view) são uma granularidade própria e são gravados num canal
-- separado, 'google_terms', para NÃO contaminar as agregações de conta/campanha
-- do canal 'google' (que somam todas as linhas da conta).
--
-- Sem este ALTER, o upsert de 'google_terms' é rejeitado pelo CHECK (HTTP 400)
-- e o SupabaseSink apenas loga o erro — os dados sumiriam silenciosamente.
--
-- A RLS de dash_insights (SELECT para authenticated) não distingue canal, então
-- o novo canal herda a mesma política — nenhuma policy nova é necessária.

ALTER TABLE public.dash_insights DROP CONSTRAINT dash_insights_channel_check;

ALTER TABLE public.dash_insights ADD CONSTRAINT dash_insights_channel_check
  CHECK (channel = ANY (ARRAY['meta'::text, 'google'::text, 'google_terms'::text]));
