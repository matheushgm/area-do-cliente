// Public Edge Function — NPS por marco, validado por client_share_token
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

  // ── GET — carrega dados do NPS pelo token ────────────────────────────────
  if (req.method === 'GET') {
    const url   = new URL(req.url)
    const token = url.searchParams.get('token')
    if (!token) return json({ error: 'Token inválido.' }, 400)

    const { data: projects, status } = await sb(
      `/projects_v2?client_share_token=eq.${encodeURIComponent(token)}&select=id,company_name,nps`
    )
    if (status !== 200 || !Array.isArray(projects) || !projects.length) {
      return json({ error: 'Link inválido ou expirado.' }, 404)
    }

    return json({
      companyName: projects[0].company_name,
      nps:         projects[0].nps || {},
    })
  }

  // ── PATCH — salva resposta de um marco ───────────────────────────────────
  if (req.method === 'PATCH') {
    let body
    try { body = await req.json() } catch { return json({ error: 'JSON inválido.' }, 400) }

    const { token, marcoId, data } = body
    if (!token || !marcoId || !data) return json({ error: 'Dados incompletos.' }, 400)

    const validMarcos = ['marco1', 'marco2', 'marco3']
    if (!validMarcos.includes(marcoId)) return json({ error: 'Marco inválido.' }, 400)

    // Buscar projeto
    const { data: projects } = await sb(
      `/projects_v2?client_share_token=eq.${encodeURIComponent(token)}&select=id,nps`
    )
    if (!Array.isArray(projects) || !projects.length) {
      return json({ error: 'Token inválido.' }, 404)
    }

    const pid     = projects[0].id
    const current = projects[0].nps || {}

    // Merge: mantém os outros marcos intactos
    const updated = { ...current, [marcoId]: data }

    const { status, data: res } = await sb(
      `/projects_v2?id=eq.${pid}`,
      {
        method: 'PATCH',
        prefer: 'return=representation',
        body:   JSON.stringify({ nps: updated }),
      }
    )
    if (status >= 400) return json({ error: 'Erro ao salvar.', detail: res }, 500)

    return json({ success: true })
  }

  return json({ error: 'Método não permitido.' }, 405)
}
