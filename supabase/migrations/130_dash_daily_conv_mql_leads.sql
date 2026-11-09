-- 130 — Conversões da lista do Dashboard de Tráfego iguais às do perfil da conta.
--
-- GoVendas (e o Grupo AJ nas campanhas antigas de MQL) tem override de resultado no
-- coletor: nas campanhas que otimizam pela custom genérica, "Conversões" da linha é o
-- MQL (mql_go / mql_aj) e o lead fica em "Leads". O perfil da conta (aggMetrics →
-- convGen no viewer) conta o LEAD dessas linhas como conversão e mostra o MQL à parte;
-- a lista lia o conv do rollup = "Conversões" cru = só o MQL. Como o mql_go não
-- dispara desde 20/10/2026, a GoVendas aparecia com 0 na tela inicial (ex.: 7 dias até
-- 09/11: 0 na lista, 9 no perfil).
--
-- Agora, no Meta:
--   conv = Leads nas linhas com "Tipo de resultado" de MQL, "Conversões" no resto;
--   mql  = coluna "MQL" + "Conversões" dessas linhas (o MQL não some do rollup).
-- Só GoVendas (24/04/2026 em diante) e Grupo AJ (11/05 a 25/06/2026) têm essas linhas.
-- Google não muda.

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
    insert into public.dash_daily (channel, account, day, campaign, spend, conv, clicks, impressions, leads, msgs, mql, lpv)
    select 'meta', btrim(r."Nome da conta"), d.day, coalesce(r."Nome da campanha", ''),
           sum(br_num(r."Valor investido")::numeric),
           -- linha cujo resultado é o MQL do override (GoVendas = mql_go, Grupo AJ = mql_aj):
           -- a conversão da lista é o lead da linha, como no perfil (convGen do viewer)
           sum((case when coalesce(r."Tipo de resultado", '') ~* 'mql'
                     then br_num(r."Leads") else br_num(r."Conversões") end)::numeric),
           sum(br_num(r."Número de cliques no link")::numeric),
           sum(br_num(r."Impressões")::numeric),
           sum(br_num(r."Leads")::numeric),
           sum(br_num(r."Número de conversas iniciadas no Whatsapp")::numeric),
           -- MQL = coluna secundária + o resultado das linhas de override (o que saiu do conv)
           sum((br_num(r."MQL") + case when coalesce(r."Tipo de resultado", '') ~* 'mql'
                                       then br_num(r."Conversões") else 0 end)::numeric),
           sum(br_num(r."Visualizações da página de destino")::numeric)
      from public.dash_insights d
      cross join lateral jsonb_to_record(d.data) as r(
        "Nome da conta" text, "Nome da campanha" text, "Valor investido" text, "Conversões" text,
        "Número de cliques no link" text, "Impressões" text, "Leads" text,
        "Número de conversas iniciadas no Whatsapp" text, "MQL" text,
        "Visualizações da página de destino" text, "Tipo de resultado" text)
     where d.channel = 'meta' and d.day between p_since and p_until
       and btrim(coalesce(r."Nome da conta", '')) <> ''
     group by 1, 2, 3, 4
    on conflict (channel, account, day, campaign) do update
       set spend = excluded.spend, conv = excluded.conv, clicks = excluded.clicks,
           impressions = excluded.impressions, leads = excluded.leads, msgs = excluded.msgs,
           mql = excluded.mql, lpv = excluded.lpv, updated_at = now();
  else
    insert into public.dash_daily (channel, account, day, campaign, spend, conv, clicks, impressions)
    select 'google', btrim(r."Nome da conta"), d.day, coalesce(r."Campanha", ''),
           sum(br_num(r."Gasto")::numeric),
           sum(br_num(r."Conversões")::numeric),
           -- mesmo fallback do num(r['CLiques']) || num(r['Cliques']), por LINHA
           sum((case when br_num(r."CLiques") <> 0 then br_num(r."CLiques")
                     else br_num(r."Cliques") end)::numeric),
           -- ordem da 088: contagem real; senão cliques ÷ CTR (layout antigo); a
           -- "parte superior" só sem "%", porque com "%" ela é taxa, não volume
           sum((case
                  when br_num(r."Impressões") <> 0
                    then br_num(r."Impressões")
                  when br_num(r."CTR") > 0
                    then round((case when br_num(r."CLiques") <> 0
                                       then br_num(r."CLiques")
                                     else br_num(r."Cliques") end)::numeric
                               / (br_num(r."CTR")::numeric / 100))
                  when coalesce(r."Impressões na parte superior", '') <> ''
                       and position('%' in r."Impressões na parte superior") = 0
                    then br_num(r."Impressões na parte superior")
                  else 0
                end)::numeric)
      from public.dash_insights d
      cross join lateral jsonb_to_record(d.data) as r(
        "Nome da conta" text, "Campanha" text, "Gasto" text, "Conversões" text,
        "CLiques" text, "Cliques" text, "Impressões" text, "CTR" text,
        "Impressões na parte superior" text)
     where d.channel = 'google' and d.day between p_since and p_until
       and btrim(coalesce(r."Nome da conta", '')) <> ''
     group by 1, 2, 3, 4
    on conflict (channel, account, day, campaign) do update
       set spend = excluded.spend, conv = excluded.conv, clicks = excluded.clicks,
           impressions = excluded.impressions, updated_at = now();
  end if;

  get diagnostics n = row_count;
  return n;
end $$;

-- Recalcula a faixa que tem linhas de MQL, mês a mês (a janela inteira de uma vez já
-- estourou o statement_timeout do rollup).
do $$
declare m date := date '2026-04-01';
begin
  while m <= current_date loop
    perform public.refresh_dash_daily('meta', m, least((m + interval '1 month' - interval '1 day')::date, current_date));
    m := (m + interval '1 month')::date;
  end loop;
end $$;
