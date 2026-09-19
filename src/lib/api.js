// Chamadas autenticadas às funções /api/*: pega o JWT da sessão Supabase, manda
// como Bearer e devolve o JSON. Em erro HTTP lança Error com `.status`, `.code`
// (error.code da API, quando existe) e `.data` (corpo devolvido).
import { supabase } from './supabase'

export async function sessionToken() {
  const { data } = await supabase.auth.getSession()
  return data?.session?.access_token || null
}

export async function apiFetch(path, { method, body, headers = {}, signal } = {}) {
  const token = await sessionToken()
  if (!token) throw new Error('Sessão expirada. Faça login de novo.')
  const res = await fetch(path, {
    method: method || (body !== undefined ? 'POST' : 'GET'),
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch {
    throw new Error('A API não respondeu JSON (rode com `vercel dev`: `npm run dev` não serve as rotas /api).')
  }
  if (!res.ok) {
    const msg = data?.error?.message || (typeof data?.error === 'string' && data.error) || data?.detail
    const err = new Error(msg || `HTTP ${res.status}`)
    err.status = res.status
    err.code = data?.error?.code || null
    err.data = data
    throw err
  }
  return data
}
