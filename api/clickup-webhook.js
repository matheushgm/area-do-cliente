// Webhook do ClickUp → atualiza uma tarefa no cache `clickup_tasks`.
//
// É este endpoint que dá o "tempo real": o ClickUp EMPURRA a mudança assim que
// ela acontece, então o custo de requisição do nosso lado é zero para detectar
// que algo mudou (gastamos 1 GET /task/{id} apenas para buscar o objeto novo).
// Comparado a polling de 1 em 1 minuto, a diferença é 1 requisição por evento
// real contra 1.440 requisições por dia sem nada ter mudado.
//
// Registro do webhook (uma vez, ver CLAUDE.md):
//   POST /api/v2/team/{team_id}/webhook
//   { "endpoint": "https://<dominio>/api/clickup-webhook", "events": [...] }
// A resposta traz um `secret` — guardar em CLICKUP_WEBHOOK_SECRET na Vercel.
//
// Segurança: todo payload vem assinado em X-Signature (HMAC-SHA256 hex do corpo
// cru com esse secret). Sem assinatura válida o endpoint recusa — caso
// contrário qualquer um na internet poderia injetar tarefas no dashboard.
export const config = { runtime: 'edge' }

import {
  SUPABASE_URL, SERVICE_KEY,
  json, excludedSpaceIds, mapTask, clickupGet, sb, upsertTasks,
} from './_clickup.js'

// Eventos que alteram algo que a Capacidade do Time exibe.
const HANDLED = new Set([
  'taskCreated',
  'taskUpdated',
  'taskStatusUpdated',
  'taskAssigneeUpdated',
  'taskDueDateUpdated',
  'taskTimeEstimateUpdated',
  'taskMoved',
  'taskPriorityUpdated',
  'taskTagUpdated',
  'taskDeleted',
])

function hex(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

// Comparação em tempo constante: um `===` vazaria, pelo tempo de resposta,
// quantos caracteres do prefixo o atacante acertou.
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function validSignature(rawBody, signature, secret) {
  if (!signature || !secret) return false
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  return safeEqual(hex(mac), signature.trim().toLowerCase())
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: 'Supabase não configurado.' }, 500)

  const secret = process.env.CLICKUP_WEBHOOK_SECRET
  if (!secret) return json({ error: 'CLICKUP_WEBHOOK_SECRET não configurado.' }, 500)

  // O corpo cru precisa ser lido como texto ANTES do parse — o HMAC é sobre os
  // bytes exatos que o ClickUp enviou, e re-serializar o JSON mudaria o digest.
  const rawBody = await req.text()
  const signature = req.headers.get('x-signature')
  if (!(await validSignature(rawBody, signature, secret))) {
    return json({ error: 'Assinatura inválida.' }, 401)
  }

  let payload
  try { payload = JSON.parse(rawBody) } catch { return json({ error: 'Body inválido.' }, 400) }

  const event  = payload?.event
  const taskId = payload?.task_id
  if (!event || !HANDLED.has(event)) return json({ ok: true, ignored: event || null })
  if (!taskId) return json({ ok: true, ignored: 'sem task_id' })

  try {
    if (event === 'taskDeleted') {
      // Soft delete: manter a linha evita que um taskUpdated fora de ordem
      // ressuscite a tarefa. O full sync limpa o que sobrar.
      await sb(`/clickup_tasks?task_id=eq.${encodeURIComponent(taskId)}`, {
        method: 'PATCH',
        prefer: 'return=minimal',
        body: JSON.stringify({
          deleted_at: new Date().toISOString(),
          closed: true,
          synced_at: new Date().toISOString(),
          sync_source: 'webhook',
        }),
      })
      return json({ ok: true, event, task_id: taskId, action: 'deleted' })
    }

    const token = process.env.CLICKUP_API_TOKEN
    if (!token) return json({ error: 'CLICKUP_API_TOKEN não configurado.' }, 500)

    // Única requisição ao ClickUp neste caminho.
    const { data: task } = await clickupGet(
      `/task/${encodeURIComponent(taskId)}?include_subtasks=false`,
      token
    )
    if (!task?.id) return json({ ok: true, event, task_id: taskId, action: 'nao_encontrada' })

    if (excludedSpaceIds().includes(String(task?.space?.id ?? ''))) {
      return json({ ok: true, event, task_id: taskId, action: 'space_excluido' })
    }

    await upsertTasks([mapTask(task, 'webhook')])
    return json({ ok: true, event, task_id: taskId, action: 'upsert' })
  } catch (e) {
    // Responde 200 de propósito: o ClickUp suspende o webhook após falhas
    // consecutivas, e perder o canal de tempo real é pior do que perder um
    // evento — o sync incremental repara essa tarefa na passagem seguinte.
    console.error('[clickup-webhook]', event, taskId, e?.message)
    return json({ ok: false, event, task_id: taskId, error: e?.message, healed_by: 'incremental sync' })
  }
}
