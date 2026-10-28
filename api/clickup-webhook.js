// Serverless Function (Node, handler Web) — webhook ClickUp → VertaTask.
// POST /api/clickup-webhook   (chamado pelo ClickUp; registrado por scripts/registrar_webhook_clickup.mjs)
//
// Cada evento de tarefa (taskCreated, taskUpdated, taskStatusUpdated, taskMoved,
// taskDeleted, taskCommentPosted…) chega aqui em segundos. O corpo é assinado:
// X-Signature = HMAC-SHA256(corpo cru, secret do webhook) em hex, e o secret fica
// em CLICKUP_WEBHOOK_SECRET. Assinatura errada = 401 sem tocar em nada.
//
// A gravação é a de api/_tarefas_webhook_core.js (lê só a tarefa do evento e aplica
// as regras da rodada periódica). Erro ao processar responde 200 com ok:false: o
// ClickUp suspende webhook que falha muito, e a rodada de /api/tarefas-sync pega o
// que escapou. O último evento fica em tarefas_sync, linha 'clickup_webhook', e o rastro
// dos eventos em tarefas_sync_log (painel Sincronização).
import { createHmac, timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { processarEventoTarefa } from './_tarefas_webhook_core.js'
import { SPACES_PADRAO } from './_tarefas_sync_core.js'
import { registrarSyncLog, linhaWebhook } from './_tarefas_sync_log.js'

export const config = { maxDuration: 30 }

function envClean(name) {
  return String(process.env[name] || '').replace(/\\n/g, '').trim()
}

const resposta = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

export function assinaturaValida(corpo, assinatura, secret) {
  if (!assinatura || !secret) return false
  const esperada = Buffer.from(createHmac('sha256', secret).update(corpo).digest('hex'))
  const recebida = Buffer.from(String(assinatura).trim().toLowerCase())
  return esperada.length === recebida.length && timingSafeEqual(esperada, recebida)
}

export async function POST(request) {
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  const TOKEN = envClean('CLICKUP_API_TOKEN')
  const SECRET = envClean('CLICKUP_WEBHOOK_SECRET')
  if (!SUPABASE_URL || !SERVICE_KEY || !TOKEN || !SECRET) return resposta({ error: 'Servidor não configurado.' }, 500)

  const corpo = await request.text()
  if (!assinaturaValida(corpo, request.headers.get('x-signature'), SECRET)) return resposta({ error: 'Assinatura inválida.' }, 401)

  let ev
  try { ev = JSON.parse(corpo) } catch { return resposta({ error: 'Corpo inválido.' }, 400) }
  const webhookId = envClean('CLICKUP_WEBHOOK_ID')
  if (webhookId && ev.webhook_id && ev.webhook_id !== webhookId) return resposta({ ok: true, ignorado: 'outro webhook' })

  const spaces = (envClean('CLICKUP_SYNC_SPACE_IDS') || '').split(',').map((s) => s.trim()).filter(Boolean)
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const inicio = new Date().toISOString()
  let r
  try {
    r = await processarEventoTarefa({ sb, token: TOKEN, evento: ev.event, taskId: ev.task_id, spaces: spaces.length ? spaces : SPACES_PADRAO })
  } catch (e) {
    r = { acao: 'erro', erro: e.message }
  }
  const resumo = { evento: ev.event, task_id: ev.task_id || null, ...r }
  await sb.from('tarefas_sync').upsert({
    id: 'clickup_webhook', ultimo_inicio: inicio, ultimo_fim: new Date().toISOString(),
    ultimo_ok: r.acao !== 'erro', resumo, updated_at: new Date().toISOString(),
  })
  // rastro do evento que não virou escrita (o que virou, o trigger da tarefa já registrou)
  await registrarSyncLog(sb, [linhaWebhook(ev.event, ev.task_id, r)])
  return resposta({ ok: r.acao !== 'erro', ...resumo })
}
