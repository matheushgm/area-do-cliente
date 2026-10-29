// Saúde do webhook ClickUp → VertaTask (docs/plano-sincronizacao-clickup.md, item 3). O ClickUp
// suspende o webhook que falha repetidamente (timeout em rajada conta como falha) e nada avisava:
// as mudanças de lá só chegavam pela rodada diária. A rodada do cron gasta 1 chamada para ler o
// webhook e, se ele não estiver 'active', reativa com PUT (mais 1). O resultado vai para
// tarefas_sync.resumo.webhook e aparece no botão "ClickUp há X min" e no painel Sincronização.

const CLICKUP_BASE = 'https://api.clickup.com/api/v2'

/** { ok, status, falhas, reativado, aviso } — nunca lança (é só um aviso para a rodada). */
export async function conferirWebhook({ token, team, webhookId = '', prazo = Infinity, fetchFn = fetch }) {
  const cu = async (method, path, body) => {
    if (Date.now() > prazo) throw new Error('sem tempo')
    const res = await fetchFn(`${CLICKUP_BASE}${path}`, {
      method, headers: { Authorization: token, 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) throw new Error(json?.err || `ClickUp ${method} ${path}: ${res.status}`)
    return json
  }
  try {
    const { webhooks = [] } = await cu('GET', `/team/${team}/webhook`)
    const w = webhookId ? webhooks.find((x) => String(x.id) === String(webhookId)) : webhooks.find((x) => /\/api\/clickup-webhook/.test(x.endpoint || ''))
    if (!w) return { ok: false, status: 'ausente', aviso: 'Webhook do ClickUp não encontrado: as mudanças de lá só chegam pela rodada. Registre de novo com scripts/registrar_webhook_clickup.mjs.' }
    const status = w.health?.status || 'active'
    const falhas = w.health?.fail_count ?? 0
    if (status === 'active') return { ok: true, status, falhas, id: String(w.id) }
    try {
      await cu('PUT', `/webhook/${w.id}`, { endpoint: w.endpoint, events: w.events, status: 'active' })
      return { ok: true, status, falhas, id: String(w.id), reativado: true, aviso: `O webhook do ClickUp estava "${status}" (${falhas} falhas) e foi reativado.` }
    } catch (e) {
      return { ok: false, status, falhas, id: String(w.id), aviso: `O webhook do ClickUp está "${status}" e não consegui reativar (${e.message}). Mudanças feitas lá só chegam pela rodada.` }
    }
  } catch (e) {
    return { ok: false, status: 'desconhecido', aviso: `Não consegui conferir o webhook do ClickUp: ${e.message}` }
  }
}
