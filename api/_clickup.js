// Módulo compartilhado do sync ClickUp → Supabase.
// Prefixo `_` faz o Vercel ignorar este arquivo como função (é só biblioteca).
//
// Usado por api/clickup-sync.js (cron/manual) e api/clickup-webhook.js (push).
// Ver CLAUDE.md › "Capacidade do Time — sync do ClickUp".

const CLICKUP_BASE = 'https://api.clickup.com/api/v2'

export const DEFAULT_TEAM = '9009170774'
// Space "Templates": as tarefas dele são modelo, não trabalho real do time —
// entrariam na carga de todo mundo inflando o número. Configurável por env.
export const DEFAULT_EXCLUDED_SPACES = ['90090379335']

export const SUPABASE_URL = process.env.SUPABASE_URL
// A chave legada `service_role` (JWT) foi desativada em 2026-04-28 — a nova é a
// secret (`sb_secret_…`). Mesmo fallback usado em api/resultados-autofill.js.
export const SERVICE_KEY =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export function excludedSpaceIds() {
  const raw = process.env.CLICKUP_EXCLUDED_SPACE_IDS
  if (!raw) return DEFAULT_EXCLUDED_SPACES
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}

// ─── Normalização de status ──────────────────────────────────────────────────
// Os status reais do workspace trazem emoji e acento ('💡 backlog',
// 'em revisão'), então comparar string crua não funciona. Reduz a um slug:
// remove diacríticos, tudo que não é letra/espaço, e colapsa espaços.
function slug(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // diacríticos
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')           // emoji, pontuação, números
    .replace(/\s+/g, ' ')
    .trim()
}

const BUCKET_BY_SLUG = {
  'backlog': 'backlog',
  'a fazer': 'a_fazer',
  'to do': 'a_fazer',
  'todo': 'a_fazer',
  'aberto': 'a_fazer',
  'open': 'a_fazer',
  'em progresso': 'em_progresso',
  'in progress': 'em_progresso',
  'fazendo': 'em_progresso',
  'em revisao': 'em_revisao',
  'revisao': 'em_revisao',
  'in review': 'em_revisao',
}

/**
 * Mapeia (status, status_type) do ClickUp para o bucket usado pela UI.
 * O `type` nativo manda quando é closed/done — é ele que define se a tarefa
 * sai da carga, independente de como o status foi nomeado na lista.
 * @returns {{ bucket: string, closed: boolean }}
 */
export function normalizeBucket(status, statusType) {
  const type = String(statusType || '').toLowerCase()
  if (type === 'closed' || type === 'done') {
    return { bucket: 'concluido', closed: true }
  }
  return { bucket: BUCKET_BY_SLUG[slug(status)] || 'outro', closed: false }
}

// ClickUp devolve datas como string de epoch em ms (às vezes número, às vezes
// null, às vezes ''). Converte para ISO ou null.
function ts(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return null
  return new Date(n).toISOString()
}

function int(v) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Converte um objeto task da API do ClickUp na linha de `clickup_tasks`.
 * Aceita tanto o formato de GET /team/{id}/task quanto o de GET /task/{id}.
 */
export function mapTask(t, syncSource) {
  const statusObj = t?.status
  // GET /team/.../task devolve status como objeto {status, type}; algumas
  // respostas (e o MCP) achatam para string. Suporta os dois.
  const statusText = typeof statusObj === 'string' ? statusObj : statusObj?.status
  const statusType = typeof statusObj === 'string' ? t?.status_type : statusObj?.type

  const { bucket, closed } = normalizeBucket(statusText, statusType)

  const assignees = Array.isArray(t?.assignees)
    ? t.assignees.map(a => ({
        id: int(a?.id),
        username: a?.username || a?.email || null,
        email: a?.email || null,
        profilePicture: a?.profilePicture || null,
      })).filter(a => a.id !== null)
    : []

  return {
    task_id:          String(t?.id),
    name:             t?.name ?? null,
    url:              t?.url ?? (t?.id ? `https://app.clickup.com/t/${t.id}` : null),
    status:           statusText ?? null,
    status_type:      statusType ?? null,
    status_bucket:    bucket,
    closed,
    assignees,
    assignee_ids:     assignees.map(a => a.id),
    creator_id:       int(t?.creator?.id),
    due_date:         ts(t?.due_date),
    start_date:       ts(t?.start_date),
    date_created:     ts(t?.date_created),
    date_updated:     ts(t?.date_updated),
    date_closed:      ts(t?.date_closed),
    time_estimate_ms: int(t?.time_estimate),
    time_spent_ms:    int(t?.time_spent),
    priority:         t?.priority?.priority ?? (typeof t?.priority === 'string' ? t.priority : null),
    parent_id:        t?.parent ?? null,
    list_id:          t?.list?.id ? String(t.list.id) : null,
    list_name:        t?.list?.name ?? null,
    folder_id:        t?.folder?.id ? String(t.folder.id) : null,
    folder_name:      t?.folder?.name ?? null,
    space_id:         t?.space?.id ? String(t.space.id) : null,
    space_name:       t?.space?.name ?? null,
    tags:             Array.isArray(t?.tags) ? t.tags.map(tag => tag?.name).filter(Boolean) : [],
    archived:         !!t?.archived,
    deleted_at:       null,
    synced_at:        new Date().toISOString(),
    sync_source:      syncSource || null,
  }
}

// ─── Fetch do ClickUp com consciência de rate limit ──────────────────────────
// O ClickUp devolve X-RateLimit-Remaining/-Reset em toda resposta. O limite é
// por token, por workspace: 100 req/min nos planos Free/Unlimited/Business,
// 1.000 no Business Plus, 10.000 no Enterprise. Como não dá pra saber o plano
// sem olhar o header, lemos o valor real a cada resposta em vez de assumir.

export class RateLimitError extends Error {
  constructor(resetSeconds) {
    super('ClickUp rate limit atingido')
    this.name = 'RateLimitError'
    this.resetSeconds = resetSeconds
  }
}

/**
 * GET na API do ClickUp. Devolve { data, remaining, reset }.
 * Lança RateLimitError em 429 para o chamador decidir parar (sem retry cego,
 * que só queimaria mais cota).
 */
export async function clickupGet(path, token) {
  const res = await fetch(`${CLICKUP_BASE}${path}`, {
    headers: { Authorization: token, 'Content-Type': 'application/json' },
  })

  const remaining = Number(res.headers.get('x-ratelimit-remaining'))
  const reset     = Number(res.headers.get('x-ratelimit-reset'))

  if (res.status === 429) throw new RateLimitError(Number.isFinite(reset) ? reset : null)

  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = null }

  if (!res.ok) {
    const err = new Error(`ClickUp GET ${path}: HTTP ${res.status} ${text.slice(0, 200)}`)
    err.status = res.status
    throw err
  }
  return {
    data,
    remaining: Number.isFinite(remaining) ? remaining : null,
    reset:     Number.isFinite(reset) ? reset : null,
  }
}

// ─── Supabase (service key) ──────────────────────────────────────────────────

export async function sb(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: opts.prefer || 'return=representation',
      ...(opts.headers || {}),
    },
  })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (res.status >= 400) {
    throw new Error(`Supabase ${path}: HTTP ${res.status} ${String(text).slice(0, 300)}`)
  }
  return data
}

/**
 * SELECT paginado. O PostgREST corta a resposta em 1.000 linhas por padrão
 * (`db-max-rows`), silenciosamente. Quem consome isso para decidir o que
 * "sumiu" precisa da lista COMPLETA — uma resposta truncada faria a
 * reconciliação marcar tarefas reais como concluídas.
 */
export async function sbSelectAll(path, pageSize = 1000) {
  const out = []
  for (let from = 0; ; from += pageSize) {
    const rows = await sb(path, {
      headers: { Range: `${from}-${from + pageSize - 1}`, 'Range-Unit': 'items' },
    })
    const batch = Array.isArray(rows) ? rows : []
    out.push(...batch)
    if (batch.length < pageSize) break
  }
  return out
}

/**
 * Upsert das tarefas em lotes. PostgREST resolve o conflito por PK com
 * `resolution=merge-duplicates`. Lotes de 200 mantêm o payload longe do
 * limite de corpo da Edge Function.
 */
export async function upsertTasks(rows) {
  const CHUNK = 200
  let written = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    await sb('/clickup_tasks?on_conflict=task_id', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: JSON.stringify(chunk),
    })
    written += chunk.length
  }
  return written
}

export async function getSyncState() {
  const rows = await sb('/clickup_sync_state?id=eq.workspace&select=*')
  return Array.isArray(rows) ? rows[0] || null : null
}

export async function patchSyncState(patch) {
  await sb('/clickup_sync_state?id=eq.workspace', {
    method: 'PATCH',
    prefer: 'return=minimal',
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  })
}
