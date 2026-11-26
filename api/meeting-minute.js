import { jsonCors, preflight, sb, msg } from './_http.js'
// Edge Function pública pra ata de reunião assinável pelo cliente.
// Validação SÓ pelo share_token (sem JWT). Operações: GET (carregar) e PATCH
// (marcar ciência + assinar).
export const config = { runtime: 'edge' }

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

const json = jsonCors

export default async function handler(req) {
  if (req.method === 'OPTIONS') return preflight()

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ error: msg(req, { pt: 'Servidor não configurado.', en: 'Server not configured.' }) }, 500)
  }

  // ── GET — carrega ata pública via share_token ────────────────────────────
  if (req.method === 'GET') {
    const url   = new URL(req.url)
    const token = url.searchParams.get('token')
    if (!token) return json({ error: msg(req, { pt: 'Token inválido.', en: 'Invalid token.' }) }, 400)

    const select = encodeURIComponent(
      'id,project_id,title,meeting_date,recording_url,attendees,template,next_actions,notes,client_acknowledgements,client_signature,created_at,updated_at'
    )
    const { data: rows, status } = await sb(
      `/meeting_minutes?share_token=eq.${encodeURIComponent(token)}&select=${select}`
    )
    if (status !== 200 || !Array.isArray(rows) || !rows.length) {
      return json({ error: msg(req, { pt: 'Link inválido ou expirado.', en: 'This link is invalid or has expired.' }) }, 404)
    }
    const minute = rows[0]

    // Busca o nome da empresa do projeto pra mostrar no header
    const { data: projects } = await sb(
      `/projects_v2?id=eq.${encodeURIComponent(minute.project_id)}&select=company_name`
    )
    const companyName = Array.isArray(projects) && projects[0]
      ? projects[0].company_name
      : ''

    return json({ minute, companyName })
  }

  // ── PATCH — marca ciência ou assina ──────────────────────────────────────
  if (req.method === 'PATCH') {
    let body
    try { body = await req.json() } catch { return json({ error: msg(req, { pt: 'JSON inválido.', en: 'Invalid JSON.' }) }, 400) }

    const { token, acknowledgements, signature } = body
    if (!token) return json({ error: msg(req, { pt: 'Token obrigatório.', en: 'Token is required.' }) }, 400)
    if (!acknowledgements && !signature) {
      return json({ error: msg(req, { pt: 'Informe acknowledgements ou signature.', en: 'Provide acknowledgements or signature.' }) }, 400)
    }

    // Localiza a ata
    const { data: rows, status: getStatus } = await sb(
      `/meeting_minutes?share_token=eq.${encodeURIComponent(token)}&select=id,client_acknowledgements,client_signature`
    )
    if (getStatus !== 200 || !Array.isArray(rows) || !rows.length) {
      return json({ error: msg(req, { pt: 'Token inválido.', en: 'Invalid token.' }) }, 404)
    }
    const minute = rows[0]

    // Se já está assinado, não permite mudar nada (assinatura é definitiva).
    if (minute.client_signature) {
      return json({ error: msg(req, { pt: 'Ata já assinada — não pode mais ser alterada.', en: 'These minutes are already signed and can no longer be changed.' }) }, 409)
    }

    const patch = {}
    if (acknowledgements && typeof acknowledgements === 'object') {
      // Merge — não substitui ciências anteriores acidentalmente
      patch.client_acknowledgements = {
        ...(minute.client_acknowledgements || {}),
        ...acknowledgements,
      }
    }
    if (signature && typeof signature === 'object') {
      const name = String(signature.name || '').trim()
      if (!name) return json({ error: msg(req, { pt: 'Nome obrigatório pra assinar.', en: 'A name is required to sign.' }) }, 400)
      patch.client_signature = {
        name,
        signedAt:  new Date().toISOString(),
        userAgent: req.headers.get('user-agent') || null,
      }
      // Quando assina, congela TODAS as ciências também (merge final)
      if (acknowledgements && typeof acknowledgements === 'object') {
        patch.client_acknowledgements = {
          ...(minute.client_acknowledgements || {}),
          ...acknowledgements,
        }
      }
    }
    patch.updated_at = new Date().toISOString()

    const { status, data } = await sb(
      `/meeting_minutes?id=eq.${encodeURIComponent(minute.id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) }
    )
    if (status >= 400) {
      return json({ error: msg(req, { pt: 'Erro ao salvar.', en: 'Could not save.' }), detail: data }, 500)
    }

    return json({ success: true, minute: Array.isArray(data) ? data[0] : data })
  }

  return json({ error: msg(req, { pt: 'Método não permitido.', en: 'Method not allowed.' }) }, 405)
}
