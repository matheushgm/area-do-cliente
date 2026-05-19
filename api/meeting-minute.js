// Edge Function pública pra ata de reunião assinável pelo cliente.
// Validação SÓ pelo share_token (sem JWT). Operações: GET (carregar) e PATCH
// (marcar ciência + assinar).
export const config = { runtime: 'edge' }

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}

async function sb(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      apikey:         SERVICE_KEY,
      Authorization:  `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer:         opts.prefer || 'return=representation',
      ...opts.extraHeaders,
    },
  })
  const text = await res.text()
  let data = null
  try { data = JSON.parse(text) } catch { data = text }
  return { data, status: res.status }
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'GET,PATCH,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ error: 'Servidor não configurado.' }, 500)
  }

  // ── GET — carrega ata pública via share_token ────────────────────────────
  if (req.method === 'GET') {
    const url   = new URL(req.url)
    const token = url.searchParams.get('token')
    if (!token) return json({ error: 'Token inválido.' }, 400)

    const select = encodeURIComponent(
      'id,project_id,title,meeting_date,recording_url,attendees,template,next_actions,notes,client_acknowledgements,client_signature,created_at,updated_at'
    )
    const { data: rows, status } = await sb(
      `/meeting_minutes?share_token=eq.${encodeURIComponent(token)}&select=${select}`
    )
    if (status !== 200 || !Array.isArray(rows) || !rows.length) {
      return json({ error: 'Link inválido ou expirado.' }, 404)
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
    try { body = await req.json() } catch { return json({ error: 'JSON inválido.' }, 400) }

    const { token, acknowledgements, signature } = body
    if (!token) return json({ error: 'Token obrigatório.' }, 400)
    if (!acknowledgements && !signature) {
      return json({ error: 'Informe acknowledgements ou signature.' }, 400)
    }

    // Localiza a ata
    const { data: rows, status: getStatus } = await sb(
      `/meeting_minutes?share_token=eq.${encodeURIComponent(token)}&select=id,client_acknowledgements,client_signature`
    )
    if (getStatus !== 200 || !Array.isArray(rows) || !rows.length) {
      return json({ error: 'Token inválido.' }, 404)
    }
    const minute = rows[0]

    // Se já está assinado, não permite mudar nada (assinatura é definitiva).
    if (minute.client_signature) {
      return json({ error: 'Ata já assinada — não pode mais ser alterada.' }, 409)
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
      if (!name) return json({ error: 'Nome obrigatório pra assinar.' }, 400)
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
      return json({ error: 'Erro ao salvar.', detail: data }, 500)
    }

    return json({ success: true, minute: Array.isArray(data) ? data[0] : data })
  }

  return json({ error: 'Método não permitido.' }, 405)
}
