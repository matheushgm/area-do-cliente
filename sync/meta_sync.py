# -*- coding: utf-8 -*-
"""Coleta Meta Ads via Graph API e produz linhas no formato EXATO da planilha
Meta atual (nível anúncio / dia).

Cabeçalho replicado (ordem importa para o CSV):
  Nome da conta, Dia, Nome da campanha, Objetivo de Campanha, Status da Campanha,
  Conjunto de Anúncio, Status do Conjunto de Anúncio, Nome do Anúncio,
  Status do Aúncio, Valor investido, CPM, Cliques,
  Número de conversas iniciadas no Whatsapp, Custo por conversa iniciadas no Whatsapp,
  Impressões, Frequência, Número de vendas, Custo por venda, ROAS de vendas,
  Ctr link, Número de cliques no link, Destino do conjunto de anúncio,
  Link do anúncio, Leads, Custo por lead,
  Número de vezes que assistiram os 3 primeiros segundos,
  Número de vezes que o vídeo foi exibido,
  Número de vezes que assistiram 25/50/75/95/100% do vídeo,
  Tempo médio do vídeo em segundos
"""
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

import config
import fmt

META_HEADERS = [
    "Nome da conta", "Dia", "Nome da campanha", "Objetivo de Campanha",
    "Status da Campanha", "Conjunto de Anúncio", "Status do Conjunto de Anúncio",
    "Nome do Anúncio", "Status do Aúncio", "Valor investido", "CPM", "Cliques",
    "Número de conversas iniciadas no Whatsapp", "Custo por conversa iniciadas no Whatsapp",
    "Impressões", "Frequência", "Número de vendas", "Custo por venda", "ROAS de vendas",
    "Ctr link", "Número de cliques no link", "Destino do conjunto de anúncio",
    "Link do anúncio", "Leads", "Custo por lead",
    "Número de vezes que assistiram os 3 primeiros segundos",
    "Número de vezes que o vídeo foi exibido",
    "Número de vezes que assistiram 25% do vídeo",
    "Número de vezes que assistiram 50% do vídeo",
    "Número de vezes que assistiram 75% do vídeo",
    "Número de vezes que assistiram 95% do vídeo",
    "Número de vezes que assistiram 100% do vídeo",
    "Tempo médio do vídeo em segundos",
    # Novas (pra o dashboard bater com a coluna "Resultados" do gerenciador):
    # Resultados = resultado verdadeiro do objetivo (todos os tipos, por campanha).
    # Conversões = só conta se for tipo conversão (o resto é awareness/volume).
    "Resultados", "Tipo de resultado", "Conversões",
]

# action_types do Meta -> conceito da planilha.
# IMPORTANTE: NÃO somar tipos que se sobrepõem. A métrica unificada `lead` do
# Meta JÁ inclui formulário (lead_grouped) + site (fb_pixel_lead/onsite_web_lead);
# somá-los conta o mesmo lead 2-3×. Idem para `purchase`. Por isso usamos
# PRIORIDADE (primeiro tipo presente), não soma.
WA_CONV = "onsite_conversion.messaging_conversation_started_7d"
# Vendas: prioridade do tipo unificado.
PURCHASE_PRIORITY = ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"]


# ─── "Resultados" (= coluna Resultados do gerenciador) ───────────────────────
# O resultado de uma campanha é o EVENTO que ela otimiza (optimization_goal do
# conjunto + custom_event_type). Mapeamos goal -> action_type e contamos só ele,
# replicando 1:1 a coluna "Resultados" do Ads Manager.
RESULT_LABELS = {
    "onsite_conversion.lead_grouped": "Leads (formulário)",
    "offsite_conversion.fb_pixel_lead": "Leads no site",
    "offsite_conversion.fb_pixel_purchase": "Compras",
    "offsite_conversion.fb_pixel_complete_registration": "Cadastros",
    "offsite_conversion.fb_pixel_add_to_cart": "Adições ao carrinho",
    "offsite_conversion.fb_pixel_initiate_checkout": "Finalizações de compra iniciadas",
    "offsite_conversion.fb_pixel_view_content": "Visualizações de conteúdo",
    "offsite_conversion.fb_pixel_contact": "Contatos",
    "offsite_conversion.fb_pixel_custom": "Conversões personalizadas",
    "onsite_conversion.messaging_conversation_started_7d": "Conversas",
    "onsite_conversion.ig_profile_visit": "Visitas ao perfil",
    "link_click": "Cliques no link",
    "landing_page_view": "Visualizações da página de destino",
    "post_engagement": "Engajamento com a publicação",
    "lead": "Leads",
    "mobile_app_install": "Instalações do app",
    # Resultados que vêm de CAMPOS diretos do insight (não de `actions`):
    "field:reach": "Alcance",
    "field:impressions": "Impressões",
    "field:video_thruplay_watched_actions": "ThruPlays",
    "field:estimated_ad_recallers": "Lembrança do anúncio (estimada)",
}


def result_action_type(opt_goal, custom_event):
    """optimization_goal (+ custom_event_type) -> chave do 'resultado'. Pode ser
    um action_type (procurado em `actions`) ou 'field:X' (campo direto do insight)."""
    g = opt_goal
    # Resultados que são CAMPOS do insight (não ações):
    if g == "REACH":        return "field:reach"
    if g == "IMPRESSIONS":  return "field:impressions"
    if g == "THRUPLAY":     return "field:video_thruplay_watched_actions"
    if g == "AD_RECALL_LIFT": return "field:estimated_ad_recallers"
    # Formulário nativo:
    if g in ("LEAD_GENERATION", "QUALITY_LEAD", "QUALITY_CALL"):
        return "onsite_conversion.lead_grouped"
    # Conversas (mensagem):
    if g in ("CONVERSATIONS", "MESSAGING_PURCHASE_CONVERSION", "MESSAGING_APPOINTMENT_CONVERSION"):
        return "onsite_conversion.messaging_conversation_started_7d"
    # Visitas ao perfil (Meta nem sempre expõe na API — best effort):
    if g in ("PROFILE_VISIT", "VISIT_INSTAGRAM_PROFILE"):
        return "onsite_conversion.ig_profile_visit"
    # Engajamento (publicação/página):
    if g in ("POST_ENGAGEMENT", "PAGE_LIKES", "EVENT_RESPONSES", "PROFILE_AND_PAGE_ENGAGEMENT"):
        return "post_engagement"
    # Cliques / página de destino:
    if g == "LINK_CLICKS":        return "link_click"
    if g == "LANDING_PAGE_VIEWS": return "landing_page_view"
    if g == "APP_INSTALLS":       return "mobile_app_install"
    # Conversões no site (por evento):
    if g == "OFFSITE_CONVERSIONS":
        return {
            "LEAD": "offsite_conversion.fb_pixel_lead",
            "PURCHASE": "offsite_conversion.fb_pixel_purchase",
            "COMPLETE_REGISTRATION": "offsite_conversion.fb_pixel_complete_registration",
            "ADD_TO_CART": "offsite_conversion.fb_pixel_add_to_cart",
            "INITIATED_CHECKOUT": "offsite_conversion.fb_pixel_initiate_checkout",
            "CONTENT_VIEW": "offsite_conversion.fb_pixel_view_content",
            "CONTACT": "offsite_conversion.fb_pixel_contact",
            "OTHER": "offsite_conversion.fb_pixel_custom",
        }.get(custom_event, "offsite_conversion.fb_pixel_lead")
    return "lead"  # fallback p/ objetivos de lead atípicos


# Resultados que CONTAM como conversão no total da conta. O resto (impressões,
# alcance, thruplay, engajamento, cliques no link, LPV, visitas ao perfil) é
# awareness/volume — aparece por campanha, mas NÃO soma no total de conversões.
# Definido com o Matheus: conversão = lead, MQL, compra, conversa de WhatsApp,
# cadastro e contato. NÃO contam: cliques, impressões, alcance, thruplay,
# engajamento, visitas ao perfil, LPV, custom, add-to-cart, checkout, view-content.
CONVERSION_RESULT_TYPES = {
    "onsite_conversion.lead_grouped",                     # Leads (formulário)
    "offsite_conversion.fb_pixel_lead",                   # Leads no site
    "offsite_conversion.fb_pixel_purchase",               # Compras
    "offsite_conversion.fb_pixel_complete_registration",  # Cadastros
    "offsite_conversion.fb_pixel_contact",                # Contatos
    "onsite_conversion.messaging_conversation_started_7d",  # Conversas WhatsApp
    "lead",
    "mobile_app_install",
}

# Override de RESULTADO por conta: troca o result_type GENÉRICO por um ESPECÍFICO
# (lido do campo `conversions`) e marca como conversão. Ex.: Grupo AJ conta só a
# custom conversion "mql_aj" (offsite_conversion.fb_pixel_custom.mql_aj), e não o
# agregado de TODAS as custom (offsite_conversion.fb_pixel_custom).
# Prefixos de result_type: "field:X" = campo do insight; "conv:X" = action_type no
# campo `conversions` (custom conversions específicas); senão = action_type em `actions`.
ACCOUNT_RESULT_OVERRIDES = {
    "GRUPO AJ": {
        "offsite_conversion.fb_pixel_custom": {
            "rtype": "conv:offsite_conversion.fb_pixel_custom.mql_aj",
            "label": "MQL (mql_aj)",
        },
    },
}


def is_conversion(rtype):
    return rtype in CONVERSION_RESULT_TYPES


def _result_value(r, rtype, actions, conversions=None):
    """Valor do 'resultado' — campo direto (field:X), custom específica (conv:X em
    `conversions`), ou action_type em `actions`."""
    if not rtype:
        return 0
    if rtype.startswith("field:"):
        v = r.get(rtype[6:])
        if isinstance(v, list):
            return _first_val(v) or 0
        try:
            return float(v) if v not in (None, "") else 0
        except (TypeError, ValueError):
            return 0
    if rtype.startswith("conv:"):
        return _action_val(conversions, rtype[5:]) or 0
    return _action_val(actions, rtype) or 0

INSIGHTS_FIELDS = ",".join([
    "account_name", "campaign_id", "campaign_name", "objective",
    "adset_id", "adset_name", "ad_id", "ad_name",
    "spend", "cpm", "clicks", "impressions", "reach", "frequency", "ctr",
    "inline_link_clicks", "inline_link_click_ctr",
    "actions", "conversions", "cost_per_action_type", "purchase_roas",
    "video_thruplay_watched_actions", "estimated_ad_recallers",
    "video_play_actions", "video_p25_watched_actions", "video_p50_watched_actions",
    "video_p75_watched_actions", "video_p95_watched_actions",
    "video_p100_watched_actions", "video_avg_time_watched_actions",
])


# Códigos Meta transitórios -> vale a pena re-tentar:
#   1/2  = "Service temporarily unavailable" / erro desconhecido transitório
#   4/17/32/613/80004 = rate limit / throttle
RETRYABLE_CODES = {1, 2, 4, 17, 32, 341, 613, 80004}


def _get(url, params, tries=6):
    """GET com retry/backoff p/ rate limit e erros transitórios (Service temp. unavailable)."""
    for attempt in range(tries):
        try:
            r = requests.get(url, params=params, timeout=120)
        except requests.RequestException as e:
            wait = 5 * (attempt + 1)
            print(f"    ⏳ rede ({e}), aguardando {wait}s...", file=sys.stderr)
            time.sleep(wait)
            continue
        if r.status_code == 200:
            return r.json()
        try:
            err = r.json().get("error", {})
        except Exception:
            err = {}
        code = err.get("code")
        # transitório / throttle -> espera e tenta de novo (backoff crescente)
        if code in RETRYABLE_CODES or r.status_code in (429, 500, 503):
            wait = 5 * (attempt + 1)
            print(f"    ⏳ transitório (code {code}: {err.get('message','')[:40]}), aguardando {wait}s...", file=sys.stderr)
            time.sleep(wait)
            continue
        # permissão negada / conta sem acesso -> devolve erro sem quebrar tudo
        return {"error": err or {"message": r.text[:200], "code": r.status_code}}
    return {"error": {"message": "max retries", "code": "retry"}}


def list_active_accounts():
    """Descobre todas as contas Meta ATIVAS (account_status == 1) visíveis ao token."""
    url = f"{config.META_BASE_URL}/me/adaccounts"
    params = {"access_token": config.META_TOKEN,
              "fields": "account_id,name,account_status", "limit": 200}
    accounts = []
    while url:
        data = _get(url, params)
        if "error" in data:
            print(f"  ⚠️  erro listando contas: {data['error'].get('message')}", file=sys.stderr)
            break
        for a in data.get("data", []):
            if a.get("account_status") == 1:  # 1 = ACTIVE
                accounts.append({"id": a["account_id"], "name": a.get("name", a["account_id"])})
        nxt = data.get("paging", {}).get("next")
        url, params = (nxt, None) if nxt else (None, None)
    return accounts


def _action_val(actions, types):
    """Soma os valores das action_types pedidas (aceita string única ou lista).
    Use APENAS para tipos que NÃO se sobrepõem (ex.: WhatsApp)."""
    if not actions:
        return None
    if isinstance(types, str):
        types = [types]
    total, found = 0.0, False
    for a in actions:
        if a.get("action_type") in types:
            total += float(a.get("value", 0) or 0)
            found = True
    return total if found else None


def _pick(items, types):
    """Valor do PRIMEIRO action_type presente (por prioridade), SEM somar — evita
    contar o mesmo evento sob aliases sobrepostos. `items` = actions ou
    cost_per_action_type."""
    if not items:
        return None
    by = {a.get("action_type"): a.get("value") for a in items}
    for t in types:
        if t in by:
            try:
                return float(by[t] or 0)
            except (TypeError, ValueError):
                return None
    return None


def _leads(actions):
    """Leads contados UMA vez = métrica unificada `lead` do Meta (já inclui
    formulário + site). Fallback p/ contas sem `lead`: form (lead_grouped) + site
    (fb_pixel_lead), que não se sobrepõem entre si."""
    v = _pick(actions, ["lead"])
    if v is not None:
        return v
    form = _action_val(actions, "onsite_conversion.lead_grouped") or 0
    site = _action_val(actions, "offsite_conversion.fb_pixel_lead") or 0
    return form + site


def _first_val(lst):
    """Pega o primeiro value de uma lista [{value: ...}] (video_*, purchase_roas)."""
    if not lst:
        return None
    try:
        return float(lst[0].get("value", 0) or 0)
    except Exception:
        return None


def fetch_statuses(ad_ids):
    """Mapa ad_id -> {status, adset_status, campaign_status, destination}.
    Busca em LOTE via `?ids=` (até 50 por chamada) apenas os anúncios que
    aparecem no período — em vez de paginar todos os anúncios da conta.
    O endpoint de insights NÃO retorna effective_status, por isso a chamada extra."""
    out = {}
    ids = list(ad_ids)
    for i in range(0, len(ids), 50):
        chunk = ids[i:i + 50]
        data = _get(f"{config.META_BASE_URL}/", {
            "access_token": config.META_TOKEN,
            "ids": ",".join(chunk),
            "fields": "effective_status,"
                      "adset{effective_status,destination_type,optimization_goal,promoted_object{custom_event_type}},"
                      "campaign{effective_status,objective}",
        })
        if "error" in data:
            continue
        for ad_id, ad in data.items():
            if not isinstance(ad, dict):
                continue
            adset = ad.get("adset", {}) or {}
            camp = ad.get("campaign", {}) or {}
            cet = (adset.get("promoted_object") or {}).get("custom_event_type")
            rtype = result_action_type(adset.get("optimization_goal"), cet)
            out[ad_id] = {
                "ad_status": ad.get("effective_status", ""),
                "adset_status": adset.get("effective_status", ""),
                "campaign_status": camp.get("effective_status", ""),
                "destination": adset.get("destination_type", ""),
                "result_type": rtype,
                "result_label": RESULT_LABELS.get(rtype, rtype),
            }
    return out


def fetch_account(act, since, until):
    """Retorna lista de dicts (linhas) no formato da planilha para uma conta."""
    act_id, name = act["id"], act["name"]
    print(f"  • Meta: {name} ({act_id})", file=sys.stderr)

    # 1) Insights primeiro — acumula linhas cruas e coleta os ad_id do período.
    url = f"{config.META_BASE_URL}/act_{act_id}/insights"
    params = {
        "access_token": config.META_TOKEN,
        "level": "ad",
        "time_increment": 1,
        "time_range": f'{{"since":"{since}","until":"{until}"}}',
        "fields": INSIGHTS_FIELDS,
        "limit": 500,
    }
    raw = []
    while url:
        data = _get(url, params)
        if "error" in data:
            print(f"    ⚠️  {data['error'].get('message')}", file=sys.stderr)
            break
        raw.extend(data.get("data", []))
        nxt = data.get("paging", {}).get("next")
        url, params = (nxt, None) if nxt else (None, None)

    # 2) Status em lote só dos anúncios que apareceram (em vez de paginar a conta).
    entity = fetch_statuses({r["ad_id"] for r in raw if r.get("ad_id")})

    # 3) Monta as linhas no formato da planilha.
    rows = []
    for r in raw:
        ent = entity.get(r.get("ad_id", ""), {})
        actions = r.get("actions")
        cpa = r.get("cost_per_action_type")
        acct = r.get("account_name", name)
        rtype = ent.get("result_type", "lead")
        rlabel = ent.get("result_label", rtype)
        forced_conv = False
        # override por conta (ex.: Grupo AJ → custom específica mql_aj)
        ov = ACCOUNT_RESULT_OVERRIDES.get(acct, {}).get(rtype)
        if ov:
            rtype, rlabel, forced_conv = ov["rtype"], ov["label"], True
        resval = _result_value(r, rtype, actions, r.get("conversions"))
        rows.append({
            "Nome da conta": r.get("account_name", name),
            "Dia": r.get("date_start", ""),
            "Nome da campanha": r.get("campaign_name", ""),
            "Objetivo de Campanha": r.get("objective", ""),
            "Status da Campanha": ent.get("campaign_status", ""),
            "Conjunto de Anúncio": r.get("adset_name", ""),
            "Status do Conjunto de Anúncio": ent.get("adset_status", ""),
            "Nome do Anúncio": r.get("ad_name", ""),
            "Status do Aúncio": ent.get("ad_status", ""),
            "Valor investido": fmt.money(r.get("spend")),
            "CPM": fmt.money(r.get("cpm")),
            "Cliques": fmt.integer(r.get("clicks")),
            "Número de conversas iniciadas no Whatsapp": fmt.integer(_action_val(actions, WA_CONV) or 0),
            "Custo por conversa iniciadas no Whatsapp": fmt.money(_action_val(cpa, WA_CONV)),
            "Impressões": fmt.integer(r.get("impressions")),
            "Frequência": fmt.dec(r.get("frequency")),
            "Número de vendas": fmt.integer(_pick(actions, PURCHASE_PRIORITY) or 0),
            "Custo por venda": fmt.money(_pick(cpa, PURCHASE_PRIORITY)),
            "ROAS de vendas": fmt.dec(_first_val(r.get("purchase_roas"))),
            "Ctr link": fmt.pct(r.get("inline_link_click_ctr")),
            "Número de cliques no link": fmt.integer(r.get("inline_link_clicks")),
            "Destino do conjunto de anúncio": ent.get("destination", ""),
            "Link do anúncio": "",  # preview por anúncio é 1 call/ad — desligado por padrão (ver README)
            "Leads": fmt.integer(_leads(actions) or 0),
            "Custo por lead": fmt.money(_pick(cpa, ["lead"])),
            "Número de vezes que assistiram os 3 primeiros segundos": fmt.integer(_action_val(actions, "video_view") or 0),
            "Número de vezes que o vídeo foi exibido": fmt.integer(_first_val(r.get("video_play_actions"))),
            "Número de vezes que assistiram 25% do vídeo": fmt.integer(_first_val(r.get("video_p25_watched_actions"))),
            "Número de vezes que assistiram 50% do vídeo": fmt.integer(_first_val(r.get("video_p50_watched_actions"))),
            "Número de vezes que assistiram 75% do vídeo": fmt.integer(_first_val(r.get("video_p75_watched_actions"))),
            "Número de vezes que assistiram 95% do vídeo": fmt.integer(_first_val(r.get("video_p95_watched_actions"))),
            "Número de vezes que assistiram 100% do vídeo": fmt.integer(_first_val(r.get("video_p100_watched_actions"))),
            "Tempo médio do vídeo em segundos": fmt.integer(_first_val(r.get("video_avg_time_watched_actions"))),
            # "Resultados" = evento de otimização do conjunto (= coluna do gerenciador).
            "Resultados": fmt.integer(resval),
            "Tipo de resultado": rlabel,
            # "Conversões" = Resultados só quando o objetivo é de conversão (senão 0).
            # forced_conv = override por conta (ex.: Grupo AJ conta a custom mql_aj).
            "Conversões": fmt.integer(resval if (forced_conv or is_conversion(rtype)) else 0),
            # ad_id (único) — entra na chave de upsert p/ NÃO colapsar anúncios
            # distintos com o mesmo nome (senão perde conversões). Não vai pro CSV
            # (não está em META_HEADERS); fica só no jsonb do Supabase.
            "ad_id": r.get("ad_id", ""),
        })
    return rows


def fetch_all(since, until, only_accounts=None):
    accounts = list_active_accounts()
    if only_accounts:
        wanted = set(str(a) for a in only_accounts)
        accounts = [a for a in accounts if a["id"] in wanted or a["name"] in wanted]
    print(f"  Meta: {len(accounts)} contas ativas (paralelo: {config.MAX_WORKERS} workers)", file=sys.stderr)

    all_rows = []
    with ThreadPoolExecutor(max_workers=config.MAX_WORKERS) as ex:
        futures = {ex.submit(fetch_account, act, since, until): act for act in accounts}
        for fut in as_completed(futures):
            act = futures[fut]
            try:
                all_rows.extend(fut.result())
            except Exception as e:
                print(f"    ⚠️  falha em {act['name']}: {e}", file=sys.stderr)
    return all_rows, [a["name"] for a in accounts]
