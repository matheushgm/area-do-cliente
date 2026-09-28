// Portal do cliente / parceiro (/portal/:projectId) — helpers do front.
// A lista de módulos e permissões é compartilhada com api/portal.js.
import { apiFetch } from './api'

export { PORTAL_MODULES, PERMISSION_LEVELS, PERMISSION_LABELS } from './portalModules.js'

const SESSION_PREFIX = 'portal.session.'

// ── Gestão (time logado) ─────────────────────────────────────────────────────
export function listShares(projectId) {
  return apiFetch(`/api/portal?action=list&projectId=${encodeURIComponent(projectId)}`)
}
export function saveShare(payload) {
  return apiFetch('/api/portal', { body: { action: 'save', ...payload } })
}
export function deleteShare(projectId, id) {
  return apiFetch('/api/portal', { body: { action: 'delete', projectId, id } })
}

// Senha legível para copiar e enviar (sem caracteres ambíguos).
export function generatePassword(len = 10) {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('')
}

export function portalUrl(projectId) {
  return `${window.location.origin}/portal/${encodeURIComponent(projectId)}`
}

// ── Sessão do visitante (sem login Supabase) ─────────────────────────────────
export function getPortalSession(projectId) {
  try { return sessionStorage.getItem(SESSION_PREFIX + projectId) || null } catch { return null }
}
export function setPortalSession(projectId, token) {
  try {
    if (token) sessionStorage.setItem(SESSION_PREFIX + projectId, token)
    else sessionStorage.removeItem(SESSION_PREFIX + projectId)
  } catch { /* storage indisponível */ }
}

async function portalFetch(path, { body, token } = {}) {
  const res = await fetch(path, {
    method: body !== undefined ? 'POST' : 'GET',
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = null }
  if (!res.ok) {
    const err = new Error(data?.error?.message || `HTTP ${res.status}`)
    err.status = res.status
    err.code = data?.error?.code || null
    throw err
  }
  return data
}

export function portalLogin(projectId, password) {
  return portalFetch('/api/portal', { body: { action: 'login', projectId, password } })
}
export function portalData(projectId, token) {
  return portalFetch(`/api/portal?action=data&projectId=${encodeURIComponent(projectId)}`, { token })
}
export function portalFileUrl(projectId, token, bucket, path) {
  return portalFetch(`/api/portal?action=file&projectId=${encodeURIComponent(projectId)}&bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`, { token })
}
