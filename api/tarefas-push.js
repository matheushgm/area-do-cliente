import { bearer, getUser } from './_http.js'
// Serverless Function (Node) — mão de volta VertaTask → ClickUp.
// GET/POST /api/tarefas-push   (Authorization: Bearer <CRON_SECRET> ou JWT)
// Esvazia a fila tarefas_outbox (ver api/_tarefas_push_core.js). O front chama
// com debounce logo depois de cada escrita; o cron diário de tarefas-sync
// também empurra antes de puxar, como rede de segurança.
import { createClient } from '@supabase/supabase-js'
import { empurrar } from './_tarefas_push_core.js'

export const config = { maxDuration: 60 }

const envClean = (n) => String(process.env[n] || '').replace(/\\n/g, '').trim()

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  const TOKEN = envClean('CLICKUP_API_TOKEN')
  if (!SUPABASE_URL || !SERVICE_KEY || !TOKEN) return res.status(500).json({ error: 'Servidor não configurado.' })
  const t = bearer(req)
  const cron = envClean('CRON_SECRET')
  if (!(cron && t && t === cron)) { const a = await getUser(req); if (!a.ok) return res.status(401).json({ error: 'Não autorizado.' }) }
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  try {
    const r = await empurrar({ sb, token: TOKEN, orcamentoMs: 50_000 })
    return res.status(200).json({ ok: true, ...r })
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message })
  }
}
