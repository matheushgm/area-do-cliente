// Client helper para chamar a Edge Function /api/slack.
// Fail-soft: erro nunca bloqueia o fluxo principal.
import { apiFetch } from './api'

/**
 * Notifica no Slack quando um novo cliente é cadastrado.
 * @param {object} payload  - dados do cliente para a mensagem
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function notifyNewClient(payload) {
  try {
    await apiFetch('/api/slack', { body: { action: 'notify_new_client', payload } })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e?.message || 'Erro inesperado.' }
  }
}
