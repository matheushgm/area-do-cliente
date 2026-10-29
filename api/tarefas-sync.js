import { bearer, getUser } from './_http.js'
// Serverless Function (Node) — sincronização incremental ClickUp → VertaTask.
// GET/POST /api/tarefas-sync   (Authorization: Bearer <CRON_SECRET> ou JWT do usuário)
//   ?since=<ISO>     opcional: força o ponto de partida (padrão: último início - 15 min)
//   ?comentarios=0   opcional: pula a leitura de comentários
//   ?reconciliar=1   opcional: também confere o que sumiu do ClickUp (apagadas/fechadas)
//
// Desde 2026-10-29 (docs/plano-sincronizacao-clickup.md, itens 2 a 4):
//  * o ponto de partida (ultimo_inicio) só avança quando a rodada termina bem E leu a lista de
//    tarefas alteradas inteira; antes era gravado no começo, e uma rodada morta no meio deixava
//    um intervalo que o polling nunca mais varria;
//  * toda chamada ao ClickUp tem prazo (push 15 s + pull até 40 s cabem nos 60 s com folga);
//  * a rodada do botão/página é leve (sem comentários, anexos e arquivados, que o webhook ou o
//    cron trazem); a do cron confere a saúde do webhook e, aos domingos, reconcilia;
//  * quem disparou fica em resumo.por (id e nome), lido pelo painel Sincronização.
//
// A lógica vive em api/_tarefas_sync_core.js (compartilhada com
// scripts/sincronizar_clickup.mjs, que roda a versão completa sem limite de
// tempo). Aqui só: auth, env, ponto de partida e o registro em tarefas_sync.
// Roda pelo cron da Vercel (uma vez por dia, limite do plano Hobby), pelo
// botão "Sincronizar" da página /tarefas e automaticamente ao abrir a página
// quando o webhook está em silêncio (src/pages/Tarefas.jsx). Uma rodada por vez: a trava
// tarefas_sync_travar (migration 109) faz a segunda chamada responder
// { emAndamento: true } sem chamar o ClickUp. As mudanças do dia a dia chegam
// pelo webhook (api/clickup-webhook.js); esta rodada é a rede de segurança.
import { createClient } from '@supabase/supabase-js'
import { sincronizar, SPACES_PADRAO } from './_tarefas_sync_core.js'
import { empurrar } from './_tarefas_push_core.js'
import { registrarSyncLog, linhaRodada } from './_tarefas_sync_log.js'
import { conferirWebhook } from './_tarefas_webhook_saude.js'

export const config = { maxDuration: 60 }

const MARGEM_MS = 15 * 60 * 1000
const TRAVA_TTL_S = 90 // a função tem 60 s; passou disso, a rodada anterior morreu
const PUSH_MS = 15_000
const PULL_MAX_MS = 40_000
const FIM_MS = 52_000 // a partir daqui só gravações no Supabase (a função tem 60 s)

// domingo em São Paulo: a rodada do cron também reconcilia (o que sumiu do ClickUp)
const ehDomingo = (d = new Date()) => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' }).format(d) === 'Sun'

function envClean(name) {
  return String(process.env[name] || '').replace(/\\n/g, '').trim()
}

async function autorizar(req) {
  const token = bearer(req)
  const cron = envClean('CRON_SECRET')
  if (cron && token && token === cron) return { ok: true, via: 'cron' }
  const auth = await getUser(req)
  if (!auth.ok) return { ok: false }
  const u = auth.user || {}
  return { ok: true, via: 'user', por: { id: u.id || null, nome: u.user_metadata?.name || u.user_metadata?.full_name || u.email || null } }
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
  const inicioIso = new Date(inicio).toISOString()
  const doCron = auth.via === 'cron'

  const { data: estado } = await sb.from('tarefas_sync').select('*').eq('id', 'clickup').maybeSingle()
  let desde = qp('since') ? new Date(qp('since')) : (estado?.ultimo_inicio ? new Date(new Date(estado.ultimo_inicio).getTime() - MARGEM_MS) : new Date(Date.now() - 86400000))
  if (isNaN(desde.getTime())) desde = new Date(Date.now() - 86400000)
  // ultimo_inicio NÃO é gravado aqui: só no fim, se a rodada leu tudo (ver o cabeçalho)

  let resumo = { via: auth.via, ...(auth.por ? { por: auth.por } : {}) }
  try {
    // primeiro a mão de volta (o que foi escrito no VertaTask vai para o ClickUp),
    // depois a leitura; assim a leitura já enxerga o que acabou de subir
    let push = null
    try { push = await empurrar({ sb, token: TOKEN, orcamentoMs: PUSH_MS }) } catch (e) { push = { erro: e.message } }
    const webhook = doCron ? await conferirWebhook({ token: TOKEN, team: TEAM, webhookId: envClean('CLICKUP_WEBHOOK_ID'), prazo: inicio + PUSH_MS + 8_000 }) : null
    const eventos = []
    const leve = !doCron // botão / abertura da página: o webhook já traz comentários e anexos
    const r = await sincronizar({
      sb, token: TOKEN, team: TEAM, spaces: spaces.length ? spaces : SPACES_PADRAO, desde,
      comentarios: !leve && qp('comentarios') !== '0', maxAnexos: leve ? 0 : 40, arquivados: !leve,
      reconciliar: qp('reconciliar') === '1' || (doCron && ehDomingo()),
      orcamentoMs: Math.max(10_000, Math.min(PULL_MAX_MS, FIM_MS - (Date.now() - inicio))), eventos,
    })
    // o chat não sincroniza mais com o ClickUp (2026-10-29, plano item 6)
    resumo = { ...resumo, ...r, push, ...(webhook ? { webhook } : {}) }
    if (webhook?.aviso) resumo.avisos = [webhook.aviso, ...(resumo.avisos || [])]
    const fim = new Date().toISOString()
    // leitura incompleta (tempo ou páginas): mantém o ponto de partida anterior
    const avanca = !r.incompleto
    await sb.from('tarefas_sync').upsert({
      id: 'clickup', ultimo_inicio: avanca ? inicioIso : (estado?.ultimo_inicio || desde.toISOString()),
      ultimo_fim: fim, ultimo_ok: true, resumo, updated_at: fim,
    })
    // rastro para o painel Sincronização (e a limpeza dos 30 dias)
    await registrarSyncLog(sb, [...eventos.slice(0, 500), linhaRodada(resumo, { inicio: inicioIso, fim })])
    await sb.rpc('tarefas_sync_log_limpar', { p_dias: 30 }).then(() => null, () => null)
    return res.status(200).json({ ok: true, ...resumo })
  } catch (e) {
    resumo.erro = e.message
    // mantém o ultimo_inicio anterior para a próxima rodada cobrir o mesmo intervalo
    await sb.from('tarefas_sync').upsert({ id: 'clickup', ultimo_inicio: estado?.ultimo_inicio || desde.toISOString(), ultimo_fim: new Date().toISOString(), ultimo_ok: false, resumo, updated_at: new Date().toISOString() })
    await registrarSyncLog(sb, [linhaRodada(resumo, { ok: false, inicio: inicioIso, fim: new Date().toISOString() })])
    return res.status(500).json({ ok: false, error: e.message, ...resumo })
  }
}
