-- Migration 088: corrige as IMPRESSÕES do Google no rollup (dash_daily)
--
-- Bug: o ramo `google` de refresh_dash_daily (migration 081) preferia a coluna
-- "Impressões na parte superior", que NÃO é contagem de impressão: é a TAXA de
-- impressões no topo, gravada com "%" (ex.: "100,00%"). O br_num tira o "%" e o
-- que entrava em dash_daily.impressions era o percentual. Efeitos medidos em
-- 22/09/2026:
--   • Torna Energia 16/09: 100 impressões gravadas no lugar de 668 (CTR exibido
--     8,00% em vez de 1,20%);
--   • conta com mais de uma linha no dia somava percentuais (Bio Cosméticos
--     Distribuidora: 311 no lugar de 1.265);
--   • nos 3 dias anteriores à correção, 128 de 214 linhas campanha/dia do canal
--     Google estavam com impressão errada.
-- Gasto, cliques e conversões nunca foram afetados, então CPL/CPA e investimento
-- do dashboard sempre estiveram certos. O estrago era no CTR do canal Google.
--
-- Conferido em todo o histórico de dash_insights (10/05/2026 → 22/09/2026):
-- "Impressões na parte superior" vem com "%" em 8.782 linhas e SEM "%" em zero.
-- Nunca foi contagem, em layout nenhum.
--
-- Nova ordem de leitura (espelha o googleImpr() de src/lib/dashboardData.js):
--   1. "Impressões", a contagem real;
--   2. linhas do layout antigo (10/05 a 19/08/2026), que não têm essa coluna:
--      reconstrói por cliques ÷ CTR, que é exato a menos do arredondamento do
--      próprio CTR. Sem isso o CTR histórico do Google viraria 0%;
--   3. "parte superior" só se vier SEM "%", para nunca mais confundir taxa com
--      volume caso um layout futuro traga a contagem ali.

create or replace function public.refresh_dash_daily(
  p_channel text,
  p_since   date,
  p_until   date
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  if p_channel not in ('meta', 'google') then
    return 0;   -- meta_status e google_terms não entram no rollup
  end if;

  delete from public.dash_daily
   where channel = p_channel and day >= p_since and day <= p_until;

  if p_channel = 'meta' then
    insert into public.dash_daily (channel, account, day, campaign, spend, conv, clicks, impressions)
    select 'meta', btrim(d.data->>'Nome da conta'), d.day, coalesce(d.data->>'Nome da campanha', ''),
           sum(br_num(d.data->>'Valor investido')::numeric),
           sum(br_num(d.data->>'Conversões')::numeric),
           sum(br_num(d.data->>'Número de cliques no link')::numeric),
           sum(br_num(d.data->>'Impressões')::numeric)
      from public.dash_insights d
     where d.channel = 'meta' and d.day between p_since and p_until
       and btrim(coalesce(d.data->>'Nome da conta','')) <> ''
     group by 1,2,3,4
    on conflict (channel, account, day, campaign) do update
       set spend = excluded.spend, conv = excluded.conv, clicks = excluded.clicks,
           impressions = excluded.impressions, updated_at = now();
  else
    insert into public.dash_daily (channel, account, day, campaign, spend, conv, clicks, impressions)
    select 'google', btrim(d.data->>'Nome da conta'), d.day, coalesce(d.data->>'Campanha', ''),
           sum(br_num(d.data->>'Gasto')::numeric),
           sum(br_num(d.data->>'Conversões')::numeric),
           -- mesmo fallback do num(r['CLiques']) || num(r['Cliques']), por LINHA
           sum((case when br_num(d.data->>'CLiques') <> 0 then br_num(d.data->>'CLiques')
                     else br_num(d.data->>'Cliques') end)::numeric),
           -- impressões por LINHA, na ordem explicada no cabeçalho
           sum((case
                  when br_num(d.data->>'Impressões') <> 0
                    then br_num(d.data->>'Impressões')
                  when br_num(d.data->>'CTR') > 0
                    then round((case when br_num(d.data->>'CLiques') <> 0
                                       then br_num(d.data->>'CLiques')
                                     else br_num(d.data->>'Cliques') end)::numeric
                               / (br_num(d.data->>'CTR')::numeric / 100))
                  when coalesce(d.data->>'Impressões na parte superior','') <> ''
                       and position('%' in (d.data->>'Impressões na parte superior')) = 0
                    then br_num(d.data->>'Impressões na parte superior')
                  else 0
                end)::numeric)
      from public.dash_insights d
     where d.channel = 'google' and d.day between p_since and p_until
       and btrim(coalesce(d.data->>'Nome da conta','')) <> ''
     group by 1,2,3,4
    on conflict (channel, account, day, campaign) do update
       set spend = excluded.spend, conv = excluded.conv, clicks = excluded.clicks,
           impressions = excluded.impressions, updated_at = now();
  end if;

  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.refresh_dash_daily(text, date, date) from public, anon, authenticated;
grant execute on function public.refresh_dash_daily(text, date, date) to service_role;

-- Reprocessa o histórico inteiro do Google com a regra nova. O Meta não muda.
select public.refresh_dash_daily('google', date '2000-01-01', current_date);
