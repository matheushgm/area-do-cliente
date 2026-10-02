// Sessão do portal do cliente / parceiro (/portal/:projectId), compartilhada
// entre api/portal.js (que emite o token) e as APIs que aceitam o token do
// portal como alternativa ao client_share_token / login próprio
// (api/anuncios-aprovacao.js, api/criativos-public.js).
//
// Token: `<base64url(JSON{sid,pid,exp,hv})>.<hmac>`; `hv` são os últimos 16
// caracteres do password_hash da chave, então trocar a senha invalida tudo.
import { hmacHex, sb, serviceKey } from './_http.js'
import { sanitizePermissions } from '../src/lib/portalModules.js'

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function b64url(str) {
  return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export function fromB64url(s) {
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : ''
  return decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)))
}
export function safeEq(a, b) {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}
export function hashVersion(stored) { return String(stored || '').slice(-16) }
export function isExpired(s) { return !!(s.expires_at && new Date(s.expires_at) < new Date()) }

export async function signSession(secret, payload) {
  const body = b64url(JSON.stringify(payload))
  const sig  = await hmacHex(secret, `portal-session|${body}`)
  return `${body}.${sig}`
}

async function parseSession(secret, token) {
  const [body, sig] = String(token || '').split('.')
  if (!body || !sig) return null
  const calc = await hmacHex(secret, `portal-session|${body}`)
  if (!safeEq(calc, sig)) return null
  try {
    const p = JSON.parse(fromB64url(body))
    if (!p?.sid || !p?.pid || !p?.exp || p.exp < Date.now()) return null
    return p
  } catch { return null }
}

function bearerOf(req) {
  const h = typeof req.headers?.get === 'function' ? req.headers.get('authorization') : req.headers?.authorization
  return String(h || '').replace(/^Bearer\s+/i, '').trim()
}

// Lê o token do portal do header Authorization. Devolve
// { ok: true, projectId, share, permissions } ou { ok: false, status, message }.
// `projectId` (opcional) força que a sessão seja daquele projeto.
export async function readPortalSession(req, projectId) {
  const secret = serviceKey()
  const token = bearerOf(req)
  if (!token || !token.includes('.')) return { ok: false, status: 401, message: 'Sessão inválida.' }
  const sess = await parseSession(secret, token)
  if (!sess) return { ok: false, status: 401, message: 'Sessão inválida.' }
  if (projectId && sess.pid !== projectId) return { ok: false, status: 401, message: 'Sessão inválida.' }
  const { data: rows } = await sb(`/project_shares?id=eq.${encodeURIComponent(sess.sid)}&project_id=eq.${encodeURIComponent(sess.pid)}&select=*&limit=1`)
  const share = Array.isArray(rows) ? rows[0] : null
  if (!share || !share.enabled || isExpired(share) || hashVersion(share.password_hash) !== sess.hv) {
    return { ok: false, status: 401, message: 'Sessão expirada.' }
  }
  return { ok: true, projectId: sess.pid, share, permissions: sanitizePermissions(share.permissions) }
}

// Tem o header de sessão do portal? (para decidir entre portal e token público)
export function hasPortalBearer(req) {
  return bearerOf(req).includes('.')
}
