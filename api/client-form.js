// Public Edge Function — no auth required, validated only by client_share_token
export const config = { runtime: 'edge' }

const SUPABASE_URL  = process.env.SUPABASE_URL
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY

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
      apikey:          SERVICE_KEY,
      Authorization:   `Bearer ${SERVICE_KEY}`,
      'Content-Type':  'application/json',
      Prefer:          opts.prefer || 'return=representation',
      ...opts.extraHeaders,
    },
  })
  const text = await res.text()
  let data = null
  try { data = JSON.parse(text) } catch { data = text }
  return { data, status: res.status }
}

export default async function handler(req) {
  // CORS preflight
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

  // ── GET — carrega dados do projeto pelo token ─────────────────────────────
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

    const [produtosRes, personasRes, ofertasRes] = await Promise.all([
      sb(`/produtos?project_id=eq.${pid}&select=id,nome,tipo,answers&order=created_at.asc`),
      sb(`/personas?project_id=eq.${pid}&select=id,name,answers&order=created_at.asc`),
      sb(`/ofertas?project_id=eq.${pid}&select=id,answers`),
    ])

    return json({
      projectId:   pid,
      companyName: projects[0].company_name,
      produtos:    Array.isArray(produtosRes.data) ? produtosRes.data : [],
      personas:    Array.isArray(personasRes.data) ? personasRes.data : [],
      ofertaData:  Array.isArray(ofertasRes.data) && ofertasRes.data[0]
        ? ofertasRes.data[0].answers
        : null,
      ofertaId:    Array.isArray(ofertasRes.data) && ofertasRes.data[0]
        ? ofertasRes.data[0].id
        : null,
    })
  }

  // ── PATCH — salva dados ───────────────────────────────────────────────────
  if (req.method === 'PATCH') {
    let body
    try { body = await req.json() } catch { return json({ error: 'JSON inválido.' }, 400) }

    const { token, module: mod, data } = body
    if (!token || !mod || !data) return json({ error: 'Dados incompletos.' }, 400)

    // Verifica token
    const { data: projects } = await sb(
      `/projects_v2?client_share_token=eq.${encodeURIComponent(token)}&select=id`
    )
    if (!Array.isArray(projects) || !projects.length) {
      return json({ error: 'Token inválido.' }, 404)
    }
    const pid = projects[0].id

    // ── Produtos ───────────────────────────────────────────────────────────
    if (mod === 'produtos') {
      await sb(`/produtos?project_id=eq.${pid}`, { method: 'DELETE' })
      if (Array.isArray(data.produtos) && data.produtos.length > 0) {
        const { status, data: res } = await sb('/produtos', {
          method: 'POST',
          body: JSON.stringify(
            data.produtos.map((p) => ({
              id:         p.id || crypto.randomUUID(),
              project_id: pid,
              nome:       p.nome || '',
              tipo:       p.tipo || 'produto',
              answers:    p.answers || {},
            }))
          ),
        })
        if (status >= 400) return json({ error: 'Erro ao salvar produto.', detail: res }, 500)
      }
      return json({ success: true })
    }

    // ── Personas ───────────────────────────────────────────────────────────
    if (mod === 'personas') {
      await sb(`/personas?project_id=eq.${pid}`, { method: 'DELETE' })
      if (Array.isArray(data.personas) && data.personas.length > 0) {
        const { status, data: res } = await sb('/personas', {
          method: 'POST',
          body: JSON.stringify(
            data.personas.map((p) => ({
              id:               p.id || crypto.randomUUID(),
              project_id:       pid,
              name:             p.name || 'Persona',
              answers:          p.answers || {},
              generated_content: null,
              generated_at:     null,
            }))
          ),
        })
        if (status >= 400) return json({ error: 'Erro ao salvar persona.', detail: res }, 500)
      }
      return json({ success: true })
    }

    // ── Oferta ─────────────────────────────────────────────────────────────
    if (mod === 'oferta') {
      const { data: existing } = await sb(`/ofertas?project_id=eq.${pid}&select=id`)
      const ofertaId = (Array.isArray(existing) && existing[0]?.id) || crypto.randomUUID()

      const { status, data: res } = await sb('/ofertas', {
        method:       'POST',
        prefer:       'resolution=merge-duplicates,return=representation',
        body: JSON.stringify({
          id:         ofertaId,
          project_id: pid,
          answers:    data.ofertaData || {},
        }),
      })
      if (status >= 400) return json({ error: 'Erro ao salvar oferta.', detail: res }, 500)
      return json({ success: true })
    }

    return json({ error: 'Módulo desconhecido.' }, 400)
  }

  return json({ error: 'Método não permitido.' }, 405)
}
