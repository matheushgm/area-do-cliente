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
