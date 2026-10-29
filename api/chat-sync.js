import { bearer, getUser } from './_http.js'
// Serverless Function (Node) — Chat ↔ ClickUp Chat.
// GET/POST /api/chat-sync   (Authorization: Bearer <CRON_SECRET> ou JWT)
//   ?push=0 | ?pull=0   opcional: só um dos sentidos
//   ?since=<ISO>        opcional: ponto de partida do pull
//   ?completo=1         opcional: relê todos os canais (histórico inteiro)
//
// DESLIGADO desde 2026-10-29 (docs/plano-sincronizacao-clickup.md, item 6): o chat ficou só no
// VertaTask e este endpoint responde 503 sem chamar o ClickUp. O resto do handler e
// api/_chat_sync_core.js ficam para religar (CHAT_SYNC_DESLIGADO = false).
import { createClient } from '@supabase/supabase-js'
import { sincronizarChat } from './_chat_sync_core.js'

export const config = { maxDuration: 60 }
const envClean = (n) => String(process.env[n] || '').replace(/\\n/g, '').trim()
const CHAT_SYNC_DESLIGADO = true

export default async function handler(req, res) {
  if (CHAT_SYNC_DESLIGADO) return res.status(503).json({ ok: false, error: 'Sincronização do chat desativada.' })
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  const TOKEN = envClean('CLICKUP_API_TOKEN')
  const TEAM = envClean('CLICKUP_TEAM_ID') || '9009170774'
  if (!SUPABASE_URL || !SERVICE_KEY || !TOKEN) return res.status(500).json({ error: 'Servidor não configurado.' })
  const t = bearer(req)
  const cron = envClean('CRON_SECRET')
  if (!(cron && t && t === cron)) { const a = await getUser(req); if (!a.ok) return res.status(401).json({ error: 'Não autorizado.' }) }
  const body = req.method === 'POST' ? (req.body || {}) : {}
  const qp = (k) => body[k] ?? req.query?.[k]
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  try {
    const r = await sincronizarChat({ sb, token: TOKEN, team: TEAM, since: qp('since') || null, completo: qp('completo') === '1', pull: qp('pull') !== '0', push: qp('push') !== '0', orcamentoMs: 50_000 })
    return res.status(200).json({ ok: true, ...r })
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message })
  }
}
