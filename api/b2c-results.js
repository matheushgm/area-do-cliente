// Public Edge Function — validated only by client_share_token
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

  // ── GET — carrega resultados b2c pelo token ──────────────────────────────
  if (req.method === 'GET') {
    const url   = new URL(req.url)
    const token = url.searchParams.get('token')
    if (!token) return json({ error: 'Token inválido.' }, 400)

    const { data: projects, status } = await sb(
      `/projects_v2?client_share_token=eq.${encodeURIComponent(token)}&select=id,company_name`
    )
    if (status !== 200 || !Array.isArray(projects) || !projects.length) {
      return json({ error: 'Link inválido ou expirado.' }, 404)
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

  // ── PATCH — salva dados b2c ───────────────────────────────────────────────
  if (req.method === 'PATCH') {
    let body
    try { body = await req.json() } catch { return json({ error: 'JSON inválido.' }, 400) }

    const { token, b2cData } = body
    if (!token || !b2cData) return json({ error: 'Dados incompletos.' }, 400)

    const { data: projects } = await sb(
      `/projects_v2?client_share_token=eq.${encodeURIComponent(token)}&select=id`
    )
    if (!Array.isArray(projects) || !projects.length) {
      return json({ error: 'Token inválido.' }, 404)
    }
    const pid = projects[0].id

    // Busca resultados atuais para merge
    const { data: existing } = await sb(`/resultados?project_id=eq.${pid}&select=data`)
    const current = (Array.isArray(existing) && existing[0]?.data) || {}

    // Merge somente os campos b2c e b2c_semanas
    const merged = {
      ...current,
      b2c:         b2cData.b2c         !== undefined ? b2cData.b2c         : current.b2c,
      b2c_semanas: b2cData.b2c_semanas !== undefined ? b2cData.b2c_semanas : current.b2c_semanas,
    }

    const { status, data: res } = await sb('/resultados', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=representation',
      body:   JSON.stringify({ project_id: pid, period: '1900-01-01', data: merged }),
    })
    if (status >= 400) return json({ error: 'Erro ao salvar.', detail: res }, 500)

    return json({ success: true })
  }

  return json({ error: 'Método não permitido.' }, 405)
}
