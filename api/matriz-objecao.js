// Edge Function pública pra Matriz de Objeção preenchível pelo cliente.
// Validação SÓ pelo client_share_token (sem JWT). GET (carregar) + PATCH (salvar).
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

  // ── GET — carrega a matriz pelo token ────────────────────────────────────
  if (req.method === 'GET') {
    const url   = new URL(req.url)
    const token = url.searchParams.get('token')
    if (!token) return json({ error: 'Token inválido.' }, 400)

    const { data: projects, status } = await sb(
      `/projects_v2?client_share_token=eq.${encodeURIComponent(token)}&select=company_name,matriz_objecao`
    )
    if (status !== 200 || !Array.isArray(projects) || !projects.length) {
      return json({ error: 'Link inválido ou expirado.' }, 404)
    }
    return json({
      companyName: projects[0].company_name || '',
      matriz:      projects[0].matriz_objecao || { rows: [] },
    })
  }

  // ── PATCH — salva a matriz ────────────────────────────────────────────────
  if (req.method === 'PATCH') {
    let body
    try { body = await req.json() } catch { return json({ error: 'JSON inválido.' }, 400) }

    const { token, matriz } = body
    if (!token || !matriz) return json({ error: 'Dados incompletos.' }, 400)

    const { data: projects } = await sb(
      `/projects_v2?client_share_token=eq.${encodeURIComponent(token)}&select=id`
    )
    if (!Array.isArray(projects) || !projects.length) {
      return json({ error: 'Token inválido.' }, 404)
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
    if (status >= 400) return json({ error: 'Erro ao salvar.', detail: data }, 500)

    return json({ success: true })
  }

  return json({ error: 'Método não permitido.' }, 405)
}
