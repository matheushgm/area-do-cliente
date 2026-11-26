import { jsonCors, preflight, sb, msg } from './_http.js'
// Edge Function pública pra Matriz de Objeção preenchível pelo cliente.
// Validação SÓ pelo client_share_token (sem JWT). GET (carregar) + PATCH (salvar).
export const config = { runtime: 'edge' }

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

const json = jsonCors

export default async function handler(req) {
  if (req.method === 'OPTIONS') return preflight()

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ error: msg(req, { pt: 'Servidor não configurado.', en: 'Server not configured.' }) }, 500)
  }

  // ── GET — carrega a matriz pelo token ────────────────────────────────────
  if (req.method === 'GET') {
    const url   = new URL(req.url)
    const token = url.searchParams.get('token')
    if (!token) return json({ error: msg(req, { pt: 'Token inválido.', en: 'Invalid token.' }) }, 400)

    const { data: projects, status } = await sb(
      `/projects_v2?client_share_token=eq.${encodeURIComponent(token)}&select=company_name,matriz_objecao`
    )
    if (status !== 200 || !Array.isArray(projects) || !projects.length) {
      return json({ error: msg(req, { pt: 'Link inválido ou expirado.', en: 'This link is invalid or has expired.' }) }, 404)
    }
    return json({
      companyName: projects[0].company_name || '',
      matriz:      projects[0].matriz_objecao || { rows: [] },
    })
  }

  // ── PATCH — salva a matriz ────────────────────────────────────────────────
  if (req.method === 'PATCH') {
    let body
    try { body = await req.json() } catch { return json({ error: msg(req, { pt: 'JSON inválido.', en: 'Invalid JSON.' }) }, 400) }

    const { token, matriz } = body
    if (!token || !matriz) return json({ error: msg(req, { pt: 'Dados incompletos.', en: 'Incomplete data.' }) }, 400)

    const { data: projects } = await sb(
      `/projects_v2?client_share_token=eq.${encodeURIComponent(token)}&select=id`
    )
    if (!Array.isArray(projects) || !projects.length) {
      return json({ error: msg(req, { pt: 'Token inválido.', en: 'Invalid token.' }) }, 404)
    }
    const pid = projects[0].id

    // Sanitiza: só aceita { rows: [{ id, tipo, antecipar, causa, resposta }] }
    const rows = Array.isArray(matriz.rows) ? matriz.rows.slice(0, 200).map((r) => ({
      id:        String(r.id || ''),
      tipo:      String(r.tipo || '').slice(0, 2000),
      antecipar: String(r.antecipar || '').slice(0, 2000),
      causa:     String(r.causa || '').slice(0, 2000),
      resposta:  String(r.resposta || '').slice(0, 2000),
    })) : []

    const { status, data } = await sb(
      `/projects_v2?id=eq.${encodeURIComponent(pid)}`,
      { method: 'PATCH', body: JSON.stringify({ matriz_objecao: { rows } }) }
    )
    if (status >= 400) return json({ error: msg(req, { pt: 'Erro ao salvar.', en: 'Could not save.' }), detail: data }, 500)

    return json({ success: true })
  }

  return json({ error: msg(req, { pt: 'Método não permitido.', en: 'Method not allowed.' }) }, 405)
}
