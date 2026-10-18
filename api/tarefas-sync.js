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
// quando a última rodada tem mais de 30 minutos.
import { createClient } from '@supabase/supabase-js'
import { sincronizar, SPACES_PADRAO } from './_tarefas_sync_core.js'
import { empurrar } from './_tarefas_push_core.js'

export const config = { maxDuration: 60 }

const MARGEM_MS = 15 * 60 * 1000

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
    const r = await sincronizar({
      sb, token: TOKEN, team: TEAM, spaces: spaces.length ? spaces : SPACES_PADRAO, desde,
      comentarios: qp('comentarios') !== '0', reconciliar: qp('reconciliar') === '1',
      orcamentoMs: 50_000,
    })
    resumo = { via: auth.via, ...r, push }
    await sb.from('tarefas_sync').upsert({ id: 'clickup', ultimo_inicio: new Date(inicio).toISOString(), ultimo_fim: new Date().toISOString(), ultimo_ok: true, resumo, updated_at: new Date().toISOString() })
    return res.status(200).json({ ok: true, ...resumo })
  } catch (e) {
    resumo.erro = e.message
    // mantém o ultimo_inicio anterior para a próxima rodada cobrir o mesmo intervalo
    await sb.from('tarefas_sync').upsert({ id: 'clickup', ultimo_inicio: estado?.ultimo_inicio || desde.toISOString(), ultimo_fim: new Date().toISOString(), ultimo_ok: false, resumo, updated_at: new Date().toISOString() })
    return res.status(500).json({ ok: false, error: e.message, ...resumo })
  }
}
