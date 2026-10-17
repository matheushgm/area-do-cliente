import { NO_STORE, jsonCors, preflight, sb } from './_http.js'
import { registrarIntake } from './_intake.js'
// Edge Function pública — PEDIDO DO CLIENTE para a fila de Intake do VertaTask.
// Sem login: o link /pedido/:token usa o client_share_token do projeto (o mesmo das
// outras páginas públicas).
//   GET  ?token=UUID                                → { empresa }
//   POST { token, titulo, descricao, contato }       → cria um pedido pendente no Intake
// Limite: 8 pedidos por hora por cliente, para o link aberto não virar spam.
export const config = { runtime: 'edge' }

const json = (body, status) => jsonCors(body, status, NO_STORE)
const str = (v, max = 400) => String(v == null ? '' : v).trim().slice(0, max)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function findProject(token) {
  if (!UUID_RE.test(token || '')) return null
  const { data, status } = await sb(`/projects_v2?client_share_token=eq.${encodeURIComponent(token)}&select=id,company_name`)
  if (status !== 200 || !Array.isArray(data) || !data.length) return null
  return data[0]
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return preflight()
  if (!process.env.SUPABASE_URL) return json({ error: 'Servidor não configurado.' }, 500)

  if (req.method === 'GET') {
    const project = await findProject(str(new URL(req.url).searchParams.get('token'), 60))
    if (!project) return json({ error: 'Link inválido ou expirado.' }, 404)
    return json({ empresa: project.company_name || '' }, 200)
  }

  if (req.method === 'POST') {
    let body
    try { body = await req.json() } catch { return json({ error: 'JSON inválido.' }, 400) }
    const project = await findProject(str(body?.token, 60))
    if (!project) return json({ error: 'Link inválido ou expirado.' }, 404)

    const titulo = str(body?.titulo, 200)
    const descricao = str(body?.descricao, 3000)
    const contato = str(body?.contato, 160)
    if (titulo.length < 4) return json({ error: 'Descreva o pedido em poucas palavras.' }, 400)

    const desde = new Date(Date.now() - 3600 * 1000).toISOString()
    const { data: recentes } = await sb(`/tarefas_intake?project_id=eq.${project.id}&origem=eq.${encodeURIComponent('Cliente (link)')}&created_at=gte.${encodeURIComponent(desde)}&select=id`)
    if (Array.isArray(recentes) && recentes.length >= 8) return json({ error: 'Muitos pedidos em pouco tempo. Tente de novo mais tarde.' }, 429)

    const ok = await registrarIntake({
      project_id: project.id, titulo, descricao, contato,
      origem: 'Cliente (link)',
      origem_ref: `link:${project.id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    })
    if (!ok) return json({ error: 'Não consegui registrar agora. Tente de novo.' }, 500)
    return json({ success: true }, 200)
  }

  return json({ error: 'Método não permitido.' }, 405)
}
