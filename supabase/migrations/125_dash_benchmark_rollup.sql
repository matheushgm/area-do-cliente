-- 125 — Benchmark do Dashboard de Tráfego lê o rollup (dash_daily).
--
-- A dash_benchmark (106) somava as linhas cruas de dash_insights, lendo de 9 a 11
-- campos do JSONB por linha, e cada `data->>'campo'` descomprime a linha inteira de
-- novo. Medido em 2026-10-30 pelo PostgREST: 7 dias = 5,5 s, 15/30/60/90 dias =
-- HTTP 500 (statement_timeout de 8 s). A aba abre em 30 dias, então quase nunca
-- carregava.
--
-- Agora:
--   1. dash_daily ganha leads, msgs (conversas no WhatsApp), mql e lpv (visualizações
--      da página de destino), só do Meta, que é o que faltava ao benchmark;
--   2. refresh_dash_daily extrai os campos com jsonb_to_record (um detoast por linha):
--      a janela de 8 dias do Meta caiu de 2,3 s para 0,3 s, já com os campos novos.
--      A regra de cada coluna é a mesma da 081/088;
--   3. dash_benchmark soma o rollup, com o mesmo filtro de campanhas de topo.
--      Diferença de propósito: Google usa as impressões e os cliques do rollup
--      (regra da 088, a mesma do dashboard), não o "Impressões" cru.
--   4. Recalcula o rollup do histórico inteiro para preencher as colunas novas.

alter table public.dash_daily
  add column if not exists leads numeric not null default 0,
  add column if not exists msgs  numeric not null default 0,
  add column if not exists mql   numeric not null default 0,
  add column if not exists lpv   numeric not null default 0;

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
           sum(br_num(r."Conversões")::numeric),
           sum(br_num(r."Número de cliques no link")::numeric),
           sum(br_num(r."Impressões")::numeric),
           sum(br_num(r."Leads")::numeric),
           sum(br_num(r."Número de conversas iniciadas no Whatsapp")::numeric),
           sum(br_num(r."MQL")::numeric),
           sum(br_num(r."Visualizações da página de destino")::numeric)
      from public.dash_insights d
      cross join lateral jsonb_to_record(d.data) as r(
        "Nome da conta" text, "Nome da campanha" text, "Valor investido" text, "Conversões" text,
        "Número de cliques no link" text, "Impressões" text, "Leads" text,
        "Número de conversas iniciadas no Whatsapp" text, "MQL" text,
        "Visualizações da página de destino" text)
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

-- Mesmo formato da 106: { "meta": [ {account, spend, impr, clicks, conv, leads, msgs, mql, lpv} ],
--                         "google": [ {account, spend, impr, clicks, conv} ] }
create or replace function public.dash_benchmark(p_days int default 30)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select dd.*,
           translate(upper(dd.campaign),
                     'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'AAAAAEEEEIIIIOOOOOUUUUC') as camp
    from public.dash_daily dd
    where dd.channel in ('meta', 'google')
      and dd.day between current_date - greatest(least(coalesce(p_days, 30), 365), 1) and current_date - 1
  ), fil as (
    select * from base
    where not (
      camp !~ '(^|[^A-Z])(MEIO|MOF)([^A-Z]|$)'
      and camp !~ '(^|[^A-Z])(FUNDO|BOFU|BOF)([^A-Z]|$)'
      and camp ~ '(^|[^A-Z])(TOPO|TOFU|TOF|RECONHECIMENTO|BRANDING)([^A-Z]|$)'
    )
  ), meta as (
    select account, sum(spend) spend, sum(impressions) impr, sum(clicks) clicks, sum(conv) conv,
           sum(leads) leads, sum(msgs) msgs, sum(mql) mql, sum(lpv) lpv
    from fil where channel = 'meta' group by account
  ), goo as (
    select account, sum(spend) spend, sum(impressions) impr, sum(clicks) clicks, sum(conv) conv
    from fil where channel = 'google' group by account
  )
  select jsonb_build_object(
    'meta', coalesce((select jsonb_agg(to_jsonb(m) order by m.spend desc) from meta m where m.spend > 0), '[]'::jsonb),
    'google', coalesce((select jsonb_agg(to_jsonb(g) order by g.spend desc) from goo g where g.spend > 0), '[]'::jsonb)
  );
$$;

revoke all on function public.dash_benchmark(int) from public;
grant execute on function public.dash_benchmark(int) to authenticated, service_role;

-- Preenche leads/msgs/mql/lpv no histórico inteiro (e reescreve o resto com a mesma regra).
select public.refresh_dash_daily('meta',   (select min(day) from public.dash_insights where channel = 'meta'),   current_date);
select public.refresh_dash_daily('google', (select min(day) from public.dash_insights where channel = 'google'), current_date);
