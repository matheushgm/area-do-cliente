// Helpers compartilhados das funções /api/* (arquivos com "_" não viram rota).
// Resposta JSON, CORS de endpoint público, validação do JWT do Supabase,
// PostgREST com a chave de serviço e HMAC dos links públicos.

export const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}
export const NO_STORE = { 'Cache-Control': 'no-store' }

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json', ...headers },
  })
}

// Endpoints públicos (chamados de landing pages / páginas sem login).
export function jsonCors(body, status = 200, headers = {}) {
  return json(body, status, { ...CORS, ...headers })
}

export function jsonErr(message, status = 400, extra) {
  return json({ error: { message, ...(extra || {}) } }, status)
}

export function preflight() {
  return new Response(null, { headers: CORS })
}

// Token do header Authorization (Request do edge ou req do Node).
export function bearer(req) {
  const h = typeof req.headers?.get === 'function' ? req.headers.get('authorization') : req.headers?.authorization
  return String(h || '').replace(/^Bearer\s+/i, '').trim()
}

// Valida o JWT do Supabase. Devolve { ok, jwt, user } ou { ok: false, message }.
export async function getUser(req, apikey = process.env.SUPABASE_ANON_KEY) {
  const jwt = bearer(req)
  if (!jwt) return { ok: false, message: 'Não autorizado.' }
  const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey },
  })
  if (!r.ok) return { ok: false, message: 'Sessão inválida ou expirada.' }
  return { ok: true, jwt, user: await r.json().catch(() => null) }
}

export function serviceKey() {
  return process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
}

// PostgREST com a chave de serviço (bypassa RLS — filtre sempre no path).
// `prefer` (padrão return=representation), `range` e `headers` extras.
export async function sb(path, opts = {}) {
  const { prefer = 'return=representation', range, headers, ...init } = opts
  const key = serviceKey()
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
      ...(range ? { Range: range, 'Range-Unit': 'items' } : {}),
      ...(headers || {}),
    },
  })
  const text = await res.text()
  let data = null
  try { data = JSON.parse(text) } catch { data = text }
  return { data, status: res.status, ok: res.ok }
}

// HMAC-SHA256(secret, msg) em hex (Web Crypto).
export async function hmacHex(secret, msg) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ─── Leitura paginada do PostgREST (Dashboard de Tráfego) ────────────────────
// O Supabase devolve no máximo 1000 linhas por resposta, peça o que pedir. Ler
// página a página em série custava ~300 ms de ida e volta por página (medido em
// 2026-10-28: rollup Meta de 29 mil linhas = 30 páginas = 11 s). Aqui as páginas
// saem em ondas paralelas e a leitura para na primeira página curta. `url` já traz
// filtros, select e order (o order precisa ser estável para o Range não repetir
// nem pular linhas). Cada página tenta 3 vezes: uma falha derruba a resposta toda.
export const PAGINA_PGRST = 1000
export async function lerPaginado(url, headers, { ondas = 8, max = 200000, rotulo = '' } = {}) {
  const pagina = async (offset) => {
    let ultimo
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      try {
        const r = await fetch(url, {
          headers: { ...headers, Range: `${offset}-${offset + PAGINA_PGRST - 1}`, 'Range-Unit': 'items' },
        })
        if (r.ok) return r.json()
        ultimo = new Error(`${rotulo}+${offset}: HTTP ${r.status}`)
      } catch (e) {
        ultimo = new Error(`${rotulo}+${offset}: ${e?.message || e}`)
      }
      await new Promise((res) => setTimeout(res, 250 * (tentativa + 1)))
    }
    throw ultimo
  }
  const out = []
  for (let offset = 0; ; offset += PAGINA_PGRST * ondas) {
    const onda = await Promise.all(Array.from({ length: ondas }, (_, i) => pagina(offset + i * PAGINA_PGRST)))
    let curta = false
    for (const lote of onda) {
      for (const row of lote) out.push(row)
      if (lote.length < PAGINA_PGRST) curta = true
    }
    if (curta || out.length > max) return out
  }
}

// Janela de dias das leituras do dashboard: `dias=N` (de hoje-N até hoje) ou
// `de=YYYY-MM-DD` / `ate=YYYY-MM-DD` (ate exclusivo), que o cache do navegador usa
// para buscar só o período mais antigo que ainda não tem. Devolve o trecho de
// filtro PostgREST sobre a coluna `day`.
export function filtroDias(url) {
  const iso = (d) => d.toISOString().slice(0, 10)
  const dia = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s : null)
  const diasRaw = parseInt(url.searchParams.get('dias') || '', 10)
  let de = dia(url.searchParams.get('de'))
  const ate = dia(url.searchParams.get('ate'))
  if (!de && Number.isFinite(diasRaw) && diasRaw > 0) {
    const d = new Date(); d.setUTCDate(d.getUTCDate() - Math.min(diasRaw, 3650)); de = iso(d)
  }
  return { de, ate, qs: (de ? `&day=gte.${de}` : '') + (ate ? `&day=lt.${ate}` : '') }
}
