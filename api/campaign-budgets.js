// Edge function — lê o ORÇAMENTO DIÁRIO CONFIGURADO nas campanhas ativas de
// Meta E Google Ads para as contas pedidas (por nome, igual aparecem no dash).
//
// Usado pelo card "Pace" do Planejamento de Campanhas: o dash_insights só tem
// gasto REALIZADO; o quanto as campanhas estão configuradas pra gastar por dia
// só existe nas APIs das plataformas.
//   Meta   → CBO = daily_budget da campanha; ABO = soma dos daily_budget dos
//            conjuntos ativos. Token no servidor (META_TOKEN, com
//            META_TOKEN_CICAL/META_TOKENS_EXTRA opcionais pras outras BMs).
//   Google → campaign_budget.amount_micros das campanhas ENABLED, resolvendo
//            as contas por nome via customer_client no MCC. Credenciais:
//            GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID,
//            GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_REFRESH_TOKEN
//            (+ GOOGLE_ADS_LOGIN_CUSTOMER_ID, default MCC Revenue Lab).
//            Sem essas envs, devolve só Meta com googleConfigured=false.
export const config = { runtime: 'edge' }

const GRAPH = 'https://graph.facebook.com/v19.0'
const GADS_VERSION = process.env.GOOGLE_ADS_API_VERSION || 'v24'
const GADS = `https://googleads.googleapis.com/${GADS_VERSION}`
const DEFAULT_MCC = '2695121976' // [MCC] - Revenue Lab

function jsonErr(message, status) {
  return new Response(JSON.stringify({ error: { message } }), {
    status, headers: { 'content-type': 'application/json' },
  })
}

// Mesma normalização do normStr de src/lib/dashboardData.js (match por nome).
function normStr(s) {
  return (s || '').toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ')
}

// Dias de hoje até a data final (inclusive), pra estimar o diário de campanhas
// com lifetime budget. null quando não dá pra estimar.
function daysUntil(isoDatetime) {
  if (!isoDatetime) return null
  const end = new Date(isoDatetime)
  if (isNaN(end.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  const diff = Math.round((end.getTime() - today.getTime()) / 86400000) + 1
  return diff >= 1 ? diff : null
}

// ─── Meta ────────────────────────────────────────────────────────────────────

// Orçamento diário de uma entidade Meta (campanha ou conjunto), em CENTAVOS.
// Lifetime → estima pelo que resta / dias até o fim.
function metaDailyOf(entity, endTimeKey) {
  const daily = Number(entity.daily_budget || 0)
  if (daily > 0) return { daily: daily / 100, estimated: false }
  const lifetime = Number(entity.lifetime_budget || 0)
  if (lifetime > 0) {
    const remaining = Number(entity.budget_remaining ?? lifetime)
    const days = daysUntil(entity[endTimeKey])
    if (days) return { daily: remaining / 100 / days, estimated: true }
    return { daily: null, estimated: true } // lifetime sem data final — sem estimativa
  }
  return null // sem orçamento próprio
}

async function graphGet(path, params, token) {
  const qs = new URLSearchParams({ ...params, access_token: token })
  const r = await fetch(`${GRAPH}/${path}?${qs}`)
  const body = await r.json().catch(() => ({}))
  if (!r.ok || body.error) {
    throw new Error(body.error?.message || `Graph API HTTP ${r.status}`)
  }
  return body
}

// Todas as contas de anúncio que um token enxerga (pagina até 3x500).
async function metaAccountsOfToken(token) {
  const out = []
  let path = 'me/adaccounts'
  let params = { fields: 'name,account_id', limit: '500' }
  for (let page = 0; page < 3; page++) {
    const body = await graphGet(path, params, token)
    out.push(...(body.data || []))
    const next = body.paging?.next
    if (!next) break
    const u = new URL(next)
    path = u.pathname.replace(/^\/v[\d.]+\//, '')
    params = Object.fromEntries(u.searchParams)
    delete params.access_token
  }
  return out
}

async function pullMeta(names, tokens) {
  // Resolve nome → act_<id> (primeiro token que enxerga a conta vence).
  const resolved = new Map()
  for (const token of tokens) {
    let list = []
    try { list = await metaAccountsOfToken(token) } catch { continue }
    for (const a of list) {
      const key = normStr(a.name)
      if (!resolved.has(key)) resolved.set(key, { actId: `act_${a.account_id}`, token })
    }
  }

  const accounts = []
  for (const name of names) {
    const hit = resolved.get(normStr(name))
    if (!hit) continue

    const body = await graphGet(`${hit.actId}/campaigns`, {
      fields: 'name,effective_status,daily_budget,lifetime_budget,budget_remaining,stop_time,'
        + 'adsets.limit(100){name,effective_status,daily_budget,lifetime_budget,budget_remaining,end_time}',
      effective_status: '["ACTIVE"]',
      limit: '100',
    }, hit.token)

    const outCamps = []
    for (const c of body.data || []) {
      if (c.effective_status !== 'ACTIVE') continue
      const own = metaDailyOf(c, 'stop_time')
      if (own) {
        // CBO — orçamento no nível da campanha.
        outCamps.push({ id: c.id, name: c.name, budgetMode: 'CBO', daily: own.daily, estimated: own.estimated })
        continue
      }
      // ABO — soma dos conjuntos ativos.
      const adsets = (c.adsets?.data || []).filter((s) => s.effective_status === 'ACTIVE')
      let daily = 0
      let estimated = false
      let known = false
      for (const s of adsets) {
        const d = metaDailyOf(s, 'end_time')
        if (!d || d.daily == null) continue
        daily += d.daily
        known = true
        if (d.estimated) estimated = true
      }
      outCamps.push({ id: c.id, name: c.name, budgetMode: 'ABO', daily: known ? daily : null, estimated })
    }

    outCamps.sort((a, b) => (b.daily || 0) - (a.daily || 0))
    accounts.push({
      name, channel: 'meta', accountId: hit.actId,
      campaigns: outCamps,
      daily: outCamps.reduce((a, c) => a + (c.daily || 0), 0),
    })
  }
  return accounts
}

// ─── Google Ads ──────────────────────────────────────────────────────────────

async function gadsToken(env) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.clientId, client_secret: env.clientSecret,
      refresh_token: env.refreshToken, grant_type: 'refresh_token',
    }),
  })
  const body = await r.json().catch(() => ({}))
  if (!r.ok || !body.access_token) {
    throw new Error(body.error_description || body.error || `OAuth HTTP ${r.status}`)
  }
  return body.access_token
}

async function gadsSearch(customerId, gaql, env, accessToken) {
  const r = await fetch(`${GADS}/customers/${customerId}/googleAds:search`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': env.developerToken,
      'login-customer-id': env.mcc,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ query: gaql }),
  })
  const body = await r.json().catch(() => ({}))
  if (!r.ok) {
    const msg = body.error?.details?.[0]?.errors?.[0]?.message || body.error?.message
    throw new Error(msg || `Google Ads HTTP ${r.status}`)
  }
  return body.results || []
}

async function pullGoogle(names, env) {
  const accessToken = await gadsToken(env)

  // Resolve nome → customer id via customer_client do MCC (inclui sub-MCCs).
  const rows = await gadsSearch(env.mcc,
    "SELECT customer_client.descriptive_name, customer_client.id, customer_client.manager "
    + "FROM customer_client WHERE customer_client.status = 'ENABLED'",
    env, accessToken)
  const resolved = new Map()
  for (const r of rows) {
    const c = r.customerClient
    if (c.manager) continue
    const key = normStr(c.descriptiveName)
    if (key && !resolved.has(key)) resolved.set(key, String(c.id))
  }

  const accounts = []
  for (const name of names) {
    const cid = resolved.get(normStr(name))
    if (!cid) continue

    // `status = ENABLED` é só o botão da campanha: campanha com data final no
    // passado continua ENABLED e some do "ativas" real. Quem manda é o
    // primary_status — só ELIGIBLE/LIMITED/LEARNING estão veiculando hoje.
    const camps = await gadsSearch(cid,
      'SELECT campaign.id, campaign.name, campaign.primary_status, campaign.end_date_time, '
      + 'campaign_budget.id, campaign_budget.amount_micros, campaign_budget.total_amount_micros, '
      + 'campaign_budget.period, campaign_budget.explicitly_shared '
      + "FROM campaign WHERE campaign.status = 'ENABLED' "
      + "AND campaign.primary_status IN ('ELIGIBLE','LIMITED','LEARNING')",
      env, accessToken)

    // Orçamento compartilhado aparece uma vez por campanha que o usa — conta o
    // valor só na primeira e marca as demais, senão o total dobra.
    const seenBudgets = new Set()
    const outCamps = camps.map((r) => {
      const c = r.campaign
      const b = r.campaignBudget || {}
      const shared = !!b.explicitlyShared
      const dup = shared && seenBudgets.has(b.id)
      if (shared) seenBudgets.add(b.id)

      let daily = null
      let estimated = false
      if (b.period === 'DAILY' && b.amountMicros) {
        daily = Number(b.amountMicros) / 1e6
      } else if (b.totalAmountMicros) {
        // Orçamento de período: estima pelo total / dias até a data final.
        const days = daysUntil(c.endDateTime)
        daily = days ? Number(b.totalAmountMicros) / 1e6 / days : null
        estimated = true
      }
      return {
        id: c.id, name: c.name,
        budgetMode: shared ? 'Compartilhado' : (b.period === 'DAILY' ? 'Diário' : 'Período'),
        // LIMITED = entregando, mas travada pelo orçamento (gasta o teto todo dia).
        limited: c.primaryStatus === 'LIMITED',
        daily: dup ? null : daily,
        estimated, shared, sharedDuplicate: dup,
      }
    })

    outCamps.sort((a, b) => (b.daily || 0) - (a.daily || 0))
    accounts.push({
      name, channel: 'google', accountId: cid,
      campaigns: outCamps,
      daily: outCamps.reduce((a, c) => a + (c.daily || 0), 0),
    })
  }
  return accounts
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req) {
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY
  const metaTokens = [
    process.env.META_TOKEN || process.env.META_ACCESS_TOKEN,
    process.env.META_TOKEN_CICAL,
    ...String(process.env.META_TOKENS_EXTRA || '').split(',').map((t) => t.trim()),
  ].filter(Boolean)

  const gadsEnv = {
    developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    clientId:       process.env.GOOGLE_ADS_CLIENT_ID,
    clientSecret:   process.env.GOOGLE_ADS_CLIENT_SECRET,
    refreshToken:   process.env.GOOGLE_ADS_REFRESH_TOKEN,
    mcc:            process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || DEFAULT_MCC,
  }
  const googleConfigured = !!(gadsEnv.developerToken && gadsEnv.clientId
    && gadsEnv.clientSecret && gadsEnv.refreshToken)

  if (!SUPABASE_URL || !SUPABASE_ANON) return jsonErr('Servidor não configurado.', 500)
  if (!metaTokens.length && !googleConfigured) {
    return jsonErr('Nenhuma credencial de anúncios configurada na Vercel.', 503)
  }

  // ── Autenticação (mesmo padrão de ad-preview/dash-data) ────────────────────
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return jsonErr('Não autorizado.', 401)
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON },
  })
  if (!authRes.ok) return jsonErr('Sessão inválida ou expirada.', 401)

  // ── Parâmetros ─────────────────────────────────────────────────────────────
  const url = new URL(req.url)
  const names = (url.searchParams.get('accounts') || '')
    .split('|').map((s) => s.trim()).filter(Boolean)
  if (!names.length) return jsonErr('Informe ?accounts=Nome1|Nome2.', 400)
  if (names.length > 10) return jsonErr('Máximo de 10 contas por chamada.', 400)

  // ── Meta e Google em paralelo; erro num canal não derruba o outro ──────────
  const warnings = []
  const [metaAccounts, googleAccounts] = await Promise.all([
    metaTokens.length
      ? pullMeta(names, metaTokens).catch((e) => { warnings.push(`Meta: ${e.message}`); return [] })
      : Promise.resolve([]),
    googleConfigured
      ? pullGoogle(names, gadsEnv).catch((e) => { warnings.push(`Google: ${e.message}`); return [] })
      : Promise.resolve([]),
  ])

  const accounts = [...metaAccounts, ...googleAccounts]
  const found = new Set(accounts.map((a) => normStr(a.name)))
  const missing = names.filter((n) => !found.has(normStr(n)))

  // Conta não encontrada só é "sem acesso" quando os DOIS canais foram
  // consultados com sucesso. Se o Google está sem credencial (ou algum canal
  // falhou), uma conta que só existe lá cai aqui sem que ninguém tenha perdido
  // acesso a nada — reportar como erro seria alarme falso.
  const fullySearched = metaTokens.length > 0 && googleConfigured && warnings.length === 0
  const unresolved = fullySearched ? missing : []
  const unchecked  = fullySearched ? [] : missing

  const metaDaily   = metaAccounts.reduce((a, ac) => a + ac.daily, 0)
  const googleDaily = googleAccounts.reduce((a, ac) => a + ac.daily, 0)

  return new Response(JSON.stringify({
    accounts,
    unresolved,
    unchecked,
    warnings,
    googleConfigured,
    daily: metaDaily + googleDaily,
    perChannel: { meta: metaDaily, google: googleDaily },
  }), {
    status: 200,
    // Orçamento configurado muda pouco ao longo do dia — 2 min de cache já
    // evita marteladas nas APIs sem mostrar dado velho.
    headers: { 'content-type': 'application/json', 'cache-control': 'private, max-age=120' },
  })
}
