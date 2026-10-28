import { bearer, getUser } from './_http.js'
// Serverless Function (Node) — sincronização incremental ClickUp → VertaTask.
// GET/POST /api/tarefas-sync   (Authorization: Bearer <CRON_SECRET> ou JWT do usuário)
//   ?since=<ISO>     opcional: força o ponto de partida (padrão: último início - 15 min)
//   ?comentarios=0   opcional: pula a leitura de comentários
//   ?reconciliar=1   opcional: também confere o que sumiu do ClickUp (apagadas/fechadas)
//
// A lógica vive em api/_tarefas_sync_core.js (compartilhada com
// scripts/sincronizar_clickup.mjs, que roda a versão completa sem limite de
// tempo). Aqui só: auth, env, ponto de partida e o registro em tarefas_sync.
// Roda pelo cron da Vercel (uma vez por dia, limite do plano Hobby), pelo
// botão "Sincronizar" da página /tarefas e automaticamente ao abrir a página
// quando a última rodada tem mais de 30 minutos. Uma rodada por vez: a trava
// tarefas_sync_travar (migration 109) faz a segunda chamada responder
// { emAndamento: true } sem chamar o ClickUp. As mudanças do dia a dia chegam
// pelo webhook (api/clickup-webhook.js); esta rodada é a rede de segurança.
import { createClient } from '@supabase/supabase-js'
import { sincronizar, SPACES_PADRAO } from './_tarefas_sync_core.js'
import { empurrar } from './_tarefas_push_core.js'
import { sincronizarChat } from './_chat_sync_core.js'
import { registrarSyncLog, linhaRodada } from './_tarefas_sync_log.js'

export const config = { maxDuration: 60 }

const MARGEM_MS = 15 * 60 * 1000
const TRAVA_TTL_S = 90 // a função tem 60 s; passou disso, a rodada anterior morreu

function envClean(name) {
  return String(process.env[name] || '').replace(/\\n/g, '').trim()
}

async function autorizar(req) {
  const token = bearer(req)
  const cron = envClean('CRON_SECRET')
  if (cron && token && token === cron) return { ok: true, via: 'cron' }
  const auth = await getUser(req)
  return auth.ok ? { ok: true, via: 'user' } : { ok: false }
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  const TOKEN = envClean('CLICKUP_API_TOKEN')
  const TEAM = envClean('CLICKUP_TEAM_ID') || '9009170774'
  const spaces = (envClean('CLICKUP_SYNC_SPACE_IDS') || '').split(',').map((s) => s.trim()).filter(Boolean)
  if (!SUPABASE_URL || !SERVICE_KEY || !TOKEN) return res.status(500).json({ error: 'Servidor não configurado.' })

  const auth = await autorizar(req)
  if (!auth.ok) return res.status(401).json({ error: 'Não autorizado.' })

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const { data: travou, error: errTrava } = await sb.rpc('tarefas_sync_travar', { p_id: 'clickup', p_ttl_s: TRAVA_TTL_S })
  if (errTrava) return res.status(500).json({ ok: false, error: `trava: ${errTrava.message}` })
  if (!travou) return res.status(200).json({ ok: true, emAndamento: true, via: auth.via })
  try {
    return await rodada(req, res, sb, { auth, TOKEN, TEAM, spaces })
  } finally {
    await sb.rpc('tarefas_sync_soltar', { p_id: 'clickup' })
  }
}

async function rodada(req, res, sb, { auth, TOKEN, TEAM, spaces }) {
  const body = req.method === 'POST' ? (req.body || {}) : {}
  const qp = (k) => body[k] ?? req.query?.[k]
  const inicio = Date.now()

  const { data: estado } = await sb.from('tarefas_sync').select('*').eq('id', 'clickup').maybeSingle()
  let desde = qp('since') ? new Date(qp('since')) : (estado?.ultimo_inicio ? new Date(new Date(estado.ultimo_inicio).getTime() - MARGEM_MS) : new Date(Date.now() - 86400000))
  if (isNaN(desde.getTime())) desde = new Date(Date.now() - 86400000)
  await sb.from('tarefas_sync').upsert({ id: 'clickup', ultimo_inicio: new Date(inicio).toISOString(), updated_at: new Date().toISOString() })

  let resumo = { via: auth.via }
  try {
    // primeiro a mão de volta (o que foi escrito no VertaTask vai para o ClickUp),
    // depois a leitura; assim a leitura já enxerga o que acabou de subir
    let push = null
    try { push = await empurrar({ sb, token: TOKEN, orcamentoMs: 15_000 }) } catch (e) { push = { erro: e.message } }
    const eventos = []
    const r = await sincronizar({
      sb, token: TOKEN, team: TEAM, spaces: spaces.length ? spaces : SPACES_PADRAO, desde,
      comentarios: qp('comentarios') !== '0', reconciliar: qp('reconciliar') === '1',
      orcamentoMs: 50_000, eventos,
    })
    // chat (push + pull) na mesma rodada diária, com o tempo que sobrar
    let chat = null
    try { chat = await sincronizarChat({ sb, token: TOKEN, team: TEAM, orcamentoMs: Math.max(5_000, 55_000 - (Date.now() - inicio)) }) } catch (e) { chat = { erro: e.message } }
    resumo = { via: auth.via, ...r, push, chat }
    const fim = new Date().toISOString()
    await sb.from('tarefas_sync').upsert({ id: 'clickup', ultimo_inicio: new Date(inicio).toISOString(), ultimo_fim: fim, ultimo_ok: true, resumo, updated_at: fim })
    // rastro para o painel Sincronização (e a limpeza dos 30 dias)
    await registrarSyncLog(sb, [...eventos.slice(0, 500), linhaRodada(resumo, { inicio: new Date(inicio).toISOString(), fim })])
    await sb.rpc('tarefas_sync_log_limpar', { p_dias: 30 }).then(() => null, () => null)
    return res.status(200).json({ ok: true, ...resumo })
  } catch (e) {
    resumo.erro = e.message
    // mantém o ultimo_inicio anterior para a próxima rodada cobrir o mesmo intervalo
    await sb.from('tarefas_sync').upsert({ id: 'clickup', ultimo_inicio: estado?.ultimo_inicio || desde.toISOString(), ultimo_fim: new Date().toISOString(), ultimo_ok: false, resumo, updated_at: new Date().toISOString() })
    await registrarSyncLog(sb, [linhaRodada(resumo, { ok: false, inicio: new Date(inicio).toISOString(), fim: new Date().toISOString() })])
    return res.status(500).json({ ok: false, error: e.message, ...resumo })
  }
}
