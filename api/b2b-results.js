import { jsonCors, preflight, sb, msg } from './_http.js'
import { mergeResultados } from './_resultados_merge.js'
// Public Edge Function — validated only by client_share_token
// Mirror de b2c-results.js, mas opera na chave `b2b` do JSONB `resultados.data`.
export const config = { runtime: 'edge' }

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

const json = jsonCors

export default async function handler(req) {
  if (req.method === 'OPTIONS') return preflight()

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ error: msg(req, { pt: 'Servidor não configurado.', en: 'Server not configured.' }) }, 500)
  }

  // ── GET — carrega resultados b2b pelo token ──────────────────────────────
  if (req.method === 'GET') {
    const url   = new URL(req.url)
    const token = url.searchParams.get('token')
    if (!token) return json({ error: msg(req, { pt: 'Token inválido.', en: 'Invalid token.' }) }, 400)

    const { data: projects, status } = await sb(
      `/projects_v2?client_share_token=eq.${encodeURIComponent(token)}&select=id,company_name`
    )
    if (status !== 200 || !Array.isArray(projects) || !projects.length) {
      return json({ error: msg(req, { pt: 'Link inválido ou expirado.', en: 'Invalid or expired link.' }) }, 404)
    }

    const pid = projects[0].id

    const { data: resultadosRows } = await sb(
      `/resultados?project_id=eq.${pid}&select=data`
    )
    const resultados = Array.isArray(resultadosRows) && resultadosRows[0]
      ? resultadosRows[0].data
      : {}

    return json({
      companyName: projects[0].company_name,
      resultados,
    })
  }

  // ── PATCH — salva dados b2b ───────────────────────────────────────────────
  if (req.method === 'PATCH') {
    let body
    try { body = await req.json() } catch { return json({ error: msg(req, { pt: 'JSON inválido.', en: 'Invalid JSON.' }) }, 400) }

    const { token, b2bData } = body
    if (!token || !b2bData) return json({ error: msg(req, { pt: 'Dados incompletos.', en: 'Incomplete data.' }) }, 400)

    const { data: projects } = await sb(
      `/projects_v2?client_share_token=eq.${encodeURIComponent(token)}&select=id`
    )
    if (!Array.isArray(projects) || !projects.length) {
      return json({ error: msg(req, { pt: 'Token inválido.', en: 'Invalid token.' }) }, 404)
    }
    const pid = projects[0].id

    // Busca resultados atuais para merge
    const { data: existing } = await sb(`/resultados?project_id=eq.${pid}&select=data`)
    const current = (Array.isArray(existing) && existing[0]?.data) || {}

    // Merge somente o campo b2b
    const merged = {
      ...current,
      b2b: mergeResultados(current.b2b, b2bData.b2b),
    }

    // `on_conflict` é obrigatório: sem ele o PostgREST resolve o upsert pela PK
    // (id), que não vem no payload, e o INSERT bate na unique (project_id, period).
    const { status, data: res } = await sb('/resultados?on_conflict=project_id,period', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=representation',
      body:   JSON.stringify({ project_id: pid, period: '1900-01-01', data: merged }),
    })
    if (status >= 400) return json({ error: msg(req, { pt: 'Erro ao salvar.', en: 'Failed to save.' }), detail: res }, 500)

    return json({ success: true })
  }

  return json({ error: msg(req, { pt: 'Método não permitido.', en: 'Method not allowed.' }) }, 405)
}
