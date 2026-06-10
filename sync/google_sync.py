# -*- coding: utf-8 -*-
"""Coleta Google Ads via API oficial (lib google-ads) e produz linhas no formato
EXATO da planilha Google atual (nível campanha + grupo de palavras / dia).

Cabeçalho replicado:
  Campanha, Grupo de palavras, CLiques, Fonte de dados, Data, Gasto,
  Nome da conta, Conversões, Custo por conversão, CTR, Taxa de conversão,
  Impressões na parte superior, % de perda por orçamento,
  Perda de impressão na parte superior , cpc

Reusa ~/.config/google-ads/google-ads.yaml (mesmo OAuth do CLI de escrita)."""
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

import config
import fmt

# Client por thread — a lib google-ads não garante thread-safety de um client
# compartilhado; cada worker usa o seu (criado uma vez por thread).
_local = threading.local()


def _thread_client():
    cli = getattr(_local, "client", None)
    if cli is None:
        cli = _client()
        _local.client = cli
    return cli

GOOGLE_HEADERS = [
    "Campanha", "Grupo de palavras", "CLiques", "Fonte de dados", "Data", "Gasto",
    "Nome da conta", "Conversões", "Custo por conversão", "CTR", "Taxa de conversão",
    "Impressões na parte superior", "% de perda por orçamento",
    "Perda de impressão na parte superior ", "cpc",
]

# Termos de pesquisa (search_term_view) — granularidade TERMO/dia. Nomes de coluna
# reusam os de GOOGLE_HEADERS quando possível (CLiques, Conversões, Gasto, cpc, CTR…)
# para casar com CFG.google/num()/fmtDate() no viewer sem código novo.
GOOGLE_TERMS_HEADERS = [
    "Termo de pesquisa", "Campanha", "Grupo de palavras", "Fonte de dados", "Data",
    "Nome da conta", "Impressões", "CLiques", "Conversões",
    "Custo por conversão", "cpc", "CTR", "Gasto",
]


def _client():
    from google.ads.googleads.client import GoogleAdsClient
    client = GoogleAdsClient.load_from_storage(config.GOOGLE_YAML)
    client.login_customer_id = str(config.GOOGLE_MCC_ID)
    return client


def list_active_customers(client):
    """Lista as contas-cliente (não-MCC, ATIVAS) sob o MCC."""
    ga = client.get_service("GoogleAdsService")
    q = """
        SELECT customer_client.id, customer_client.descriptive_name,
               customer_client.manager, customer_client.status
        FROM customer_client
        WHERE customer_client.level <= 2
    """
    out = []
    seen = set()
    stream = ga.search_stream(customer_id=str(config.GOOGLE_MCC_ID), query=q)
    for batch in stream:
        for row in batch.results:
            cc = row.customer_client
            cid = str(cc.id)
            if cc.manager or cid in seen:
                continue
            # status 2 = ENABLED
            if cc.status.name != "ENABLED":
                continue
            seen.add(cid)
            out.append({"id": cid, "name": cc.descriptive_name or cid})
    return out


def _budget_lost_by_campaign_day(ga, cid, since, until):
    """% de perda por orçamento é métrica de CAMPANHA — busca à parte e indexa
    por (campanha, data) para juntar nas linhas de grupo."""
    q = f"""
        SELECT campaign.name, segments.date,
               metrics.search_budget_lost_impression_share
        FROM campaign
        WHERE segments.date BETWEEN '{since}' AND '{until}'
          AND metrics.impressions > 0
    """
    idx = {}
    try:
        stream = ga.search_stream(customer_id=cid, query=q)
        for batch in stream:
            for row in batch.results:
                idx[(row.campaign.name, row.segments.date)] = \
                    row.metrics.search_budget_lost_impression_share
    except Exception as e:
        print(f"    ⚠️  budget-share falhou ({cid}): {e}", file=sys.stderr)
    return idx


def fetch_customer(client, cust, since, until):
    ga = client.get_service("GoogleAdsService")
    cid, name = cust["id"], cust["name"]
    print(f"  • Google: {name} ({cid})", file=sys.stderr)

    budget_idx = _budget_lost_by_campaign_day(ga, cid, since, until)

    q = f"""
        SELECT customer.descriptive_name, campaign.name, ad_group.name,
               segments.date, metrics.clicks, metrics.cost_micros,
               metrics.conversions, metrics.cost_per_conversion, metrics.ctr,
               metrics.conversions_from_interactions_rate,
               metrics.top_impression_percentage,
               metrics.search_rank_lost_top_impression_share,
               metrics.average_cpc
        FROM ad_group
        WHERE segments.date BETWEEN '{since}' AND '{until}'
          AND metrics.impressions > 0
    """
    rows = []
    try:
        stream = ga.search_stream(customer_id=cid, query=q)
    except Exception as e:
        print(f"    ⚠️  {name}: {e}", file=sys.stderr)
        return rows

    for batch in stream:
        for row in batch.results:
            m = row.metrics
            camp = row.campaign.name
            date = row.segments.date
            conv = m.conversions
            cost = m.cost_micros / 1e6
            budget_lost = budget_idx.get((camp, date))
            rows.append({
                "Campanha": camp,
                "Grupo de palavras": row.ad_group.name,
                "CLiques": fmt.integer(m.clicks),
                "Fonte de dados": "google_ads",
                "Data": date,
                "Gasto": fmt.money(cost),
                "Nome da conta": row.customer.descriptive_name or name,
                "Conversões": fmt.dec(conv, 0) if conv == int(conv) else fmt.dec(conv),
                "Custo por conversão": fmt.money(m.cost_per_conversion / 1e6) if conv else "",
                "CTR": fmt.pct_from_ratio(m.ctr),
                "Taxa de conversão": fmt.pct_from_ratio(m.conversions_from_interactions_rate),
                "Impressões na parte superior": fmt.pct_from_ratio(m.top_impression_percentage),
                "% de perda por orçamento": fmt.pct_from_ratio(budget_lost) if budget_lost is not None else "",
                "Perda de impressão na parte superior ": fmt.pct_from_ratio(m.search_rank_lost_top_impression_share),
                "cpc": fmt.money(m.average_cpc / 1e6),
            })
    return rows


def fetch_terms_customer(client, cust, since, until):
    """Coleta TERMOS DE PESQUISA (search_term_view) — só os que tiveram CLIQUES
    (clicks > 0), focando em 'para onde o dinheiro foi' e cortando a cauda longa
    de termos sem clique. Granularidade: termo × grupo × dia."""
    ga = client.get_service("GoogleAdsService")
    cid, name = cust["id"], cust["name"]
    print(f"  • Google (termos): {name} ({cid})", file=sys.stderr)

    q = f"""
        SELECT customer.descriptive_name, campaign.name, ad_group.name,
               search_term_view.search_term, segments.date,
               metrics.impressions, metrics.clicks, metrics.cost_micros,
               metrics.conversions, metrics.cost_per_conversion,
               metrics.average_cpc, metrics.ctr
        FROM search_term_view
        WHERE segments.date BETWEEN '{since}' AND '{until}'
          AND metrics.clicks > 0
    """
    rows = []
    try:
        stream = ga.search_stream(customer_id=cid, query=q)
    except Exception as e:
        print(f"    ⚠️  termos {name}: {e}", file=sys.stderr)
        return rows

    for batch in stream:
        for row in batch.results:
            m = row.metrics
            conv = m.conversions
            rows.append({
                "Termo de pesquisa": row.search_term_view.search_term,
                "Campanha": row.campaign.name,
                "Grupo de palavras": row.ad_group.name,
                "Fonte de dados": "google_ads",
                "Data": row.segments.date,
                "Nome da conta": row.customer.descriptive_name or name,
                "Impressões": fmt.integer(m.impressions),
                "CLiques": fmt.integer(m.clicks),
                "Conversões": fmt.dec(conv, 0) if conv == int(conv) else fmt.dec(conv),
                "Custo por conversão": fmt.money(m.cost_per_conversion / 1e6) if conv else "",
                "cpc": fmt.money(m.average_cpc / 1e6),
                "CTR": fmt.pct_from_ratio(m.ctr),
                "Gasto": fmt.money(m.cost_micros / 1e6),
            })
    return rows


def fetch_terms_all(since, until, only_accounts=None):
    """Igual a fetch_all, mas coletando termos de pesquisa (fetch_terms_customer)."""
    customers = list_active_customers(_thread_client())
    if only_accounts:
        wanted = set(str(a) for a in only_accounts)
        customers = [c for c in customers if c["id"] in wanted or c["name"] in wanted]
    print(f"  Google (termos): {len(customers)} contas ativas (paralelo: {config.MAX_WORKERS} workers)", file=sys.stderr)

    def _job(cust):
        return fetch_terms_customer(_thread_client(), cust, since, until)

    all_rows = []
    with ThreadPoolExecutor(max_workers=config.MAX_WORKERS) as ex:
        futures = {ex.submit(_job, c): c for c in customers}
        for fut in as_completed(futures):
            cust = futures[fut]
            try:
                all_rows.extend(fut.result())
            except Exception as e:
                print(f"    ⚠️  termos falha em {cust['name']}: {e}", file=sys.stderr)
    return all_rows, [c["name"] for c in customers]


def fetch_all(since, until, only_accounts=None):
    customers = list_active_customers(_thread_client())
    if only_accounts:
        wanted = set(str(a) for a in only_accounts)
        customers = [c for c in customers if c["id"] in wanted or c["name"] in wanted]
    print(f"  Google: {len(customers)} contas ativas (paralelo: {config.MAX_WORKERS} workers)", file=sys.stderr)

    def _job(cust):
        return fetch_customer(_thread_client(), cust, since, until)

    all_rows = []
    with ThreadPoolExecutor(max_workers=config.MAX_WORKERS) as ex:
        futures = {ex.submit(_job, c): c for c in customers}
        for fut in as_completed(futures):
            cust = futures[fut]
            try:
                all_rows.extend(fut.result())
            except Exception as e:
                print(f"    ⚠️  falha em {cust['name']}: {e}", file=sys.stderr)
    return all_rows, [c["name"] for c in customers]
