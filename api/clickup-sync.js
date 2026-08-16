// Sync ClickUp → Supabase (tabela `clickup_tasks`).
//
// Dois modos:
//   • incremental (default) — usa `date_updated_gt` com o cursor guardado em
//     clickup_sync_state.last_synced_at. Normalmente 1–2 requisições ao ClickUp.
//     É a rede de segurança do webhook: cura evento perdido, webhook suspenso
//     por falha, ou janela de deploy.
//   • full — repuxa todas as tarefas ABERTAS e reconcilia: o que está aberto no
//     nosso cache mas não voltou do ClickUp foi fechado/movido/apagado fora do
//     webhook, então marcamos como concluído. ~6–8 requisições.
//
// Por que isso não estoura o rate limit: o endpoint GET /team/{id}/task devolve
// 100 tarefas por página JÁ COM assignees, status, datas e time_estimate. O
// snapshot manual de 08/08 estourou porque fazia um GET /task/{id} por tarefa
// (567 requisições) só para ler as horas — informação que já vinha na listagem.
//
// Quem pode chamar:
//   • Vercel Cron (header x-vercel-cron, ou Authorization: Bearer $CRON_SECRET)
//   • Usuário logado (JWT do Supabase) — botão "Atualizar agora" na página
//
// Ver CLAUDE.md › "Capacidade do Time — sync do ClickUp".
export const config = { runtime: 'edge' }

import {
  DEFAULT_TEAM, SUPABASE_URL, SERVICE_KEY,
  json, excludedSpaceIds, mapTask, clickupGet, RateLimitError,
  sb, sbSelectAll, upsertTasks, getSyncState, patchSyncState,
} from './_clickup.js'

const PAGE_SIZE = 100
// Teto de páginas por execução. 40 páginas = 4.000 tarefas, muito acima do
// volume real do workspace (~570 abertas) — existe só como freio de emergência
// contra loop infinito se a API mudar o contrato de paginação.
const MAX_PAGES = 40
// Piso de cota: abaixo disso paramos e devolvemos resultado parcial em vez de
// insistir e tomar 429. O incremental seguinte termina o serviço.
const RATE_FLOOR = 15
// Sobreposição do cursor incremental: reprocessa 2 min para trás para não
// perder tarefa atualizada durante a execução anterior. Upsert é idempotente.
const CURSOR_OVERLAP_MS = 2 * 60 * 1000
// Lock considerado órfão depois disso (execução morreu sem liberar).
const STALE_LOCK_MS = 5 * 60 * 1000

async function isAuthorized(req) {
  const cronSecret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization') || ''

  // Vercel Cron
  if (cronSecret && auth === `Bearer ${cronSecret}`) return { ok: true, via: 'cron' }
  if (!cronSecret && req.headers.get('x-vercel-cron')) return { ok: true, via: 'cron' }

  // Usuário logado
  const jwt = auth.replace(/^Bearer\s+/i, '').trim()
  if (jwt && SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${jwt}`, apikey: process.env.SUPABASE_ANON_KEY },
    })
    if (res.ok) return { ok: true, via: 'user' }
  }
  return { ok: false }
}

/**
 * Pagina GET /team/{id}/task acumulando as tarefas.
 * @returns {{ tasks: any[], pages: number, complete: boolean, remaining: number|null }}
 *   `complete` = percorreu até a última página sem parar por cota/teto. Só com
 *   ele true a reconciliação do full sync pode rodar com segurança.
 */
async function fetchTasks(teamId, token, params) {
  const tasks = []
  let pages = 0
  let complete = false
  let remaining = null

  for (let page = 0; page < MAX_PAGES; page++) {
    const qs = new URLSearchParams({ ...params, page: String(page) })
    const { data, remaining: rem } = await clickupGet(`/team/${teamId}/task?${qs}`, token)
    pages++
    if (rem !== null) remaining = rem

    const batch = Array.isArray(data?.tasks) ? data.tasks : []
    tasks.push(...batch)

    // O ClickUp sinaliza fim via last_page; nem toda resposta traz o campo,
    // então também paramos quando a página vem incompleta.
    if (data?.last_page === true || batch.length < PAGE_SIZE) { complete = true; break }
    if (remaining !== null && remaining < RATE_FLOOR) break
  }
  return { tasks, pages, complete, remaining }
}

export default async function handler(req) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405)
  }
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: 'Supabase não configurado.' }, 500)

  const token = process.env.CLICKUP_API_TOKEN
  if (!token) return json({ error: 'CLICKUP_API_TOKEN não configurado.' }, 500)

  const auth = await isAuthorized(req)
  if (!auth.ok) return json({ error: 'Não autorizado.' }, 401)

  const url    = new URL(req.url)
  const mode   = url.searchParams.get('mode') === 'full' ? 'full' : 'incremental'
  const teamId = process.env.CLICKUP_TEAM_ID || DEFAULT_TEAM
  const excluded = new Set(excludedSpaceIds())
  const startedAt = Date.now()

  // ─── Lock ──────────────────────────────────────────────────────────────────
  const state = await getSyncState()
  if (state?.running) {
    const since = state.running_since ? new Date(state.running_since).getTime() : 0
    if (Date.now() - since < STALE_LOCK_MS) {
      return json({ skipped: true, reason: 'sync já em execução' }, 409)
    }
  }
  await patchSyncState({ running: true, running_since: new Date().toISOString() })

  try {
    // Cursor do incremental. Sem cursor prévio (primeira execução), cai para
    // full — não adianta pedir delta sem ponto de partida.
    const cursor = state?.last_synced_at ? new Date(state.last_synced_at).getTime() : null
    const effectiveMode = mode === 'incremental' && !cursor ? 'full' : mode

    const params = {
      subtasks: 'true',
      order_by: 'updated',
      reverse: 'true',
    }
    if (effectiveMode === 'full') {
      // Só as abertas: é o recorte que a UI usa e mantém o payload pequeno.
      params.include_closed = 'false'
    } else {
      // No incremental precisamos das fechadas também — é assim que ficamos
      // sabendo que uma tarefa saiu da carga.
      params.include_closed = 'true'
      params.date_updated_gt = String(Math.max(0, cursor - CURSOR_OVERLAP_MS))
    }

    const { tasks, pages, complete, remaining } = await fetchTasks(teamId, token, params)

    const kept = tasks.filter(t => !excluded.has(String(t?.space?.id ?? '')))
    const rows = kept.map(t => mapTask(t, `sync_${effectiveMode}`))
    const written = rows.length ? await upsertTasks(rows) : 0

    // ─── Reconciliação (só no full completo) ────────────────────────────────
    // Se a paginação parou no meio (cota/teto), pular: marcar como concluído
    // tudo que "não voltou" apagaria a carga real do time.
    let reconciled = 0
    if (effectiveMode === 'full' && complete) {
      const seen = new Set(rows.map(r => r.task_id))
      // Paginado de propósito: uma leitura truncada aqui marcaria como
      // concluída toda tarefa além da 1.000ª.
      const openRows = await sbSelectAll('/clickup_tasks?closed=eq.false&deleted_at=is.null&select=task_id')
      const missing = openRows.map(r => r.task_id).filter(id => !seen.has(id))
      if (missing.length) {
        const CHUNK = 100
        for (let i = 0; i < missing.length; i += CHUNK) {
          const ids = missing.slice(i, i + CHUNK)
          await sb(`/clickup_tasks?task_id=in.(${ids.map(encodeURIComponent).join(',')})`, {
            method: 'PATCH',
            prefer: 'return=minimal',
            body: JSON.stringify({
              closed: true,
              status_bucket: 'concluido',
              synced_at: new Date().toISOString(),
              sync_source: 'sync_full_reconcile',
            }),
          })
        }
        reconciled = missing.length
      }
    }

    // Só avança o cursor quando a varredura foi completa — senão o próximo
    // incremental pularia justamente o que ficou de fora.
    const result = {
      mode: effectiveMode,
      requested_mode: mode,
      pages,
      complete,
      fetched: tasks.length,
      skipped_excluded_space: tasks.length - kept.length,
      written,
      reconciled,
      rate_remaining: remaining,
      duration_ms: Date.now() - startedAt,
    }

    await patchSyncState({
      running: false,
      running_since: null,
      last_error: null,
      last_result: result,
      ...(complete ? { last_synced_at: new Date(startedAt).toISOString() } : {}),
      ...(complete && effectiveMode === 'full' ? { last_full_sync_at: new Date().toISOString() } : {}),
    })

    return json({ ok: true, ...result })
  } catch (e) {
    const isRate = e instanceof RateLimitError
    await patchSyncState({
      running: false,
      running_since: null,
      last_error: `${e?.name || 'Error'}: ${e?.message || 'erro desconhecido'}`,
    })
    return json({
      error: e?.message || 'Erro no sync do ClickUp',
      rate_limited: isRate,
      reset_at: isRate ? e.resetSeconds : undefined,
    }, isRate ? 429 : 502)
  }
}
