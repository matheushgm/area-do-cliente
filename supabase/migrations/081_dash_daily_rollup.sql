-- Migration 081: rollup diário do Dashboard de Tráfego (dash_daily)
--
-- Antes: a dashboard montava a LISTA de contas (status, diagnóstico de queda,
-- candidatas a escala, pace de verba, barra de resumo) lendo as linhas CRUAS de
-- dash_insights, que guarda um JSONB largo por anúncio/dia. Só o canal Meta são
-- ~55 mil linhas e 74 MB. Medido: ler isso custa ~37s de CPU no Postgres, não
-- importa como se pagina, porque o custo é por linha larga (detoast do jsonb).
-- A Edge Function da Vercel morre em 25s, e o papel `authenticated` tem
-- statement_timeout de 8s: daí o "HTTP 504" que a dashboard mostrava.
--
-- Agora: a lista roda sobre somas por conta/dia/campanha, ~24 mil linhas
-- estreitas que saem do índice em ~12ms. As linhas cruas continuam em
-- dash_insights e são lidas só quando alguém abre a página de um cliente,
-- filtradas por conta (/api/dash-data?channel=…&account=…).
--
-- Granularidade com CAMPANHA, e não só conta/dia, porque a visualização "Pace de
-- Verba" casa o nome da campanha do plano com o nome real (planCampaignSpend).
--
-- Colunas em `numeric` e não `double precision`: somar os mesmos valores em
-- ordem diferente muda o último bit do float, e um CPL que cai exatamente no
-- meio do arredondamento aparecia com um centavo de diferença entre o rollup e
-- as linhas cruas. Numeric soma exato.

-- ─── Conversão de número BR ──────────────────────────────────────────────────
-- Espelho EXATO do num() de src/lib/dashboardData.js: tira "R$" e "%"; se tem
-- vírgula E ponto, o ponto é separador de milhar; se tem só vírgula, ela é o
-- separador decimal. Sem `strict`, para que null vire 0 como no JS.
-- Verificado contra o num() nos 18 formatos presentes nos dados.
create or replace function public.br_num(t text) returns double precision
language plpgsql immutable as $$
declare s text;
begin
  s := btrim(replace(replace(coalesce(t, ''), 'R$', ''), '%', ''));
  if s = '' or s = '-' then return 0; end if;
  if position(',' in s) > 0 and position('.' in s) > 0 then
    s := replace(replace(s, '.', ''), ',', '.');
  elsif position(',' in s) > 0 then
    s := replace(s, ',', '.');
  end if;
  begin
    return s::double precision;
  exception when others then
    return 0;
  end;
end $$;

-- ─── Tabela do rollup ────────────────────────────────────────────────────────
create table if not exists public.dash_daily (
  channel     text not null,
  account     text not null,
  day         date not null,
  campaign    text not null default '',
  spend       numeric not null default 0,
  conv        numeric not null default 0,
  clicks      numeric not null default 0,
  impressions numeric not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (channel, account, day, campaign)
);

create index if not exists dash_daily_channel_day_idx on public.dash_daily (channel, day);

alter table public.dash_daily enable row level security;

drop policy if exists dash_daily_select_authenticated on public.dash_daily;
create policy dash_daily_select_authenticated on public.dash_daily
  for select to authenticated using (true);

-- ─── Recálculo a partir da fonte ─────────────────────────────────────────────
-- Chamada pelo sync (dashboard-api/store.py) logo depois de gravar as linhas
-- cruas, com a mesma janela que ele acabou de sincronizar. Recalcula a partir de
-- dash_insights em vez de somar no Python: assim o rollup nunca diverge da
-- fonte, e a regra de número BR mora num lugar só.
--
-- Apaga a janela antes de reinserir para que linha que sumiu da origem (anúncio
-- ou campanha removida) também suma do rollup.
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
           sum((case when br_num(d.data->>'Impressões na parte superior') <> 0
                          then br_num(d.data->>'Impressões na parte superior')
                     else br_num(d.data->>'Impressões') end)::numeric)
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

-- Só o sync (service_role) recalcula. O app apenas LÊ dash_daily, via RLS.
revoke all on function public.refresh_dash_daily(text, date, date) from public, anon, authenticated;
grant execute on function public.refresh_dash_daily(text, date, date) to service_role;

-- ─── Backfill do histórico ───────────────────────────────────────────────────
-- Em produção isto foi rodado em blocos de data (a tabela crua é grande e a
-- agregação sobre jsonb leva ~10s por canal). Conferido depois: 10.749 pares
-- conta/dia, zero divergência contra dash_insights em aritmética decimal exata.
select public.refresh_dash_daily('meta',   date '2000-01-01', current_date);
select public.refresh_dash_daily('google', date '2000-01-01', current_date);
