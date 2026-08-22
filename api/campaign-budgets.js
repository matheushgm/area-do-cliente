// Edge function — lê o ORÇAMENTO DIÁRIO CONFIGURADO nas campanhas ativas do
// Meta para as contas pedidas (por nome, igual aparecem no dashboard).
//
// Usado pelo card "Pace" do Planejamento de Campanhas: o dash_insights só tem
// gasto REALIZADO; o quanto as campanhas estão configuradas pra gastar por dia
// (CBO = daily_budget da campanha; ABO = soma dos daily_budget dos conjuntos
// ativos) só existe na Graph API. Token vive SÓ no servidor (META_TOKEN, com
// META_TOKEN_CICAL/META_TOKENS_EXTRA opcionais pras outras BMs, mesmo esquema
// do dashboard-api).
export const config = { runtime: 'edge' }

const GRAPH = 'https://graph.facebook.com/v19.0'

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

function isActive(status) {
  return status === 'ACTIVE'
}

// Dias de hoje até a data final (inclusive), pra estimar o diário de campanhas
// com lifetime_budget. null quando não dá pra estimar.
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

// Orçamento diário de uma entidade (campanha ou conjunto). Meta devolve os
// valores em CENTAVOS. Lifetime → estima pelo que resta / dias até o fim.
function dailyOf(entity, endTimeKey) {
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
async function accountsOfToken(token) {
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

export default async function handler(req) {
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY
  const tokens = [
    process.env.META_TOKEN || process.env.META_ACCESS_TOKEN,
    process.env.META_TOKEN_CICAL,
    ...String(process.env.META_TOKENS_EXTRA || '').split(',').map((t) => t.trim()),
  ].filter(Boolean)

  if (!SUPABASE_URL || !SUPABASE_ANON) return jsonErr('Servidor não configurado.', 500)
  if (!tokens.length) return jsonErr('META_TOKEN não configurado na Vercel.', 503)

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

  // ── Resolve nome → act_<id> (primeiro token que enxerga a conta vence) ─────
  const resolved = new Map() // normName → { actId, token }
  for (const token of tokens) {
    let list = []
    try { list = await accountsOfToken(token) } catch { continue }
    for (const a of list) {
      const key = normStr(a.name)
      if (!resolved.has(key)) resolved.set(key, { actId: `act_${a.account_id}`, token })
    }
  }

  const accounts = []
  const unresolved = []

  for (const name of names) {
    const hit = resolved.get(normStr(name))
    if (!hit) { unresolved.push(name); continue }

    // Campanhas ativas + orçamentos (da campanha e dos conjuntos dela).
    let camps = []
    try {
      const body = await graphGet(`${hit.actId}/campaigns`, {
        fields: 'name,effective_status,daily_budget,lifetime_budget,budget_remaining,stop_time,'
          + 'adsets.limit(100){name,effective_status,daily_budget,lifetime_budget,budget_remaining,end_time}',
        effective_status: '["ACTIVE"]',
        limit: '100',
      }, hit.token)
      camps = body.data || []
    } catch (e) {
      return jsonErr(`Meta (${name}): ${e.message}`, 502)
    }

    const outCamps = []
    for (const c of camps) {
      if (!isActive(c.effective_status)) continue
      const own = dailyOf(c, 'stop_time')
      if (own) {
        // CBO — orçamento no nível da campanha.
        outCamps.push({
          id: c.id, name: c.name, budgetMode: 'CBO',
          daily: own.daily, estimated: own.estimated,
        })
        continue
      }
      // ABO — soma dos conjuntos ativos.
      const adsets = (c.adsets?.data || []).filter((s) => isActive(s.effective_status))
      let daily = 0
      let estimated = false
      let known = false
      for (const s of adsets) {
        const d = dailyOf(s, 'end_time')
        if (!d || d.daily == null) continue
        daily += d.daily
        known = true
        if (d.estimated) estimated = true
      }
      outCamps.push({
        id: c.id, name: c.name, budgetMode: 'ABO',
        daily: known ? daily : null, estimated,
        adsetCount: adsets.length,
      })
    }

    outCamps.sort((a, b) => (b.daily || 0) - (a.daily || 0))
    accounts.push({
      name,
      actId: hit.actId,
      campaigns: outCamps,
      daily: outCamps.reduce((a, c) => a + (c.daily || 0), 0),
    })
  }

  return new Response(JSON.stringify({
    accounts,
    unresolved,
    daily: accounts.reduce((a, ac) => a + ac.daily, 0),
  }), {
    status: 200,
    // Orçamento configurado muda pouco ao longo do dia — 2 min de cache já
    // evita marteladas na Graph API sem mostrar dado velho.
    headers: { 'content-type': 'application/json', 'cache-control': 'private, max-age=120' },
  })
}
