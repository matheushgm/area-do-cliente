// Client helper para chamar a Edge Function /api/slack.
// Fail-soft: erro nunca bloqueia o fluxo principal.
import { supabase } from './supabase'

/**
 * Notifica no Slack quando um novo cliente é cadastrado.
 * @param {object} payload  - dados do cliente para a mensagem
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function notifyNewClient(payload) {
  if (!supabase) return { ok: false, error: 'Supabase não configurado.' }
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData?.session?.access_token
    if (!accessToken) return { ok: false, error: 'Sessão expirada.' }

    const res = await fetch('/api/slack', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        action: 'notify_new_client',
        payload,
      }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: data?.error?.message || `HTTP ${res.status}` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e?.message || 'Erro inesperado.' }
  }
}
