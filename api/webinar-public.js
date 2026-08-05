// Edge Function pública da ferramenta "Criação de Webinar" preenchível pelo
// cliente. Validação SÓ pelo client_share_token (sem JWT) — mesmo token usado
// por Matriz de Objeção / CRM / Precificação. GET (carregar) + PATCH (salvar).
//
// O cliente pode criar webinars do zero pelo link: o PATCH grava a coluna
// JSONB `webinars` de projects_v2 inteira (lista de webinars do projeto).
export const config = { runtime: 'edge' }

const SUPABASE_URL = process.env.SUPABASE_URL
// A chave legada service_role foi desativada em 2026-04-28 — usar a secret nova
// (sb_secret_...), com fallback pro nome antigo por compatibilidade de ambiente.
const SERVICE_KEY  = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

const MAX_WEBINARS = 30
const MAX_FIELD    = 8000   // caracteres por campo de texto
const MAX_FIELDS   = 400    // campos por etapa
const ETAPAS_OK    = ['abertura', 'historia', 'conteudo', 'oferta_agendamento', 'oferta_direta']

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
    },
  })
  const text = await res.text()
  let data = null
  try { data = JSON.parse(text) } catch { data = text }
  return { data, status: res.status }
}

const str = (v, max = MAX_FIELD) => String(v ?? '').slice(0, max)

// Aceita apenas string ou array de strings em cada campo de etapa (o form usa
// os dois: 'text'/'area'/'radio' salvam string, 'checks' salva array).
function sanitizeEtapa(raw) {
  if (!raw || typeof raw !== 'object') return {}
  const out = {}
  for (const [k, v] of Object.entries(raw).slice(0, MAX_FIELDS)) {
    const key = str(k, 120)
    if (Array.isArray(v)) out[key] = v.slice(0, 100).map((x) => str(x, 1000))
    else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[key] = str(v)
  }
  return out
}

function sanitizeWebinars(raw) {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, MAX_WEBINARS).map((w) => {
    const etapasRaw = w && typeof w.etapas === 'object' && w.etapas ? w.etapas : {}
    const etapas = {}
    for (const id of ETAPAS_OK) {
      if (etapasRaw[id]) etapas[id] = sanitizeEtapa(etapasRaw[id])
    }
    return {
      id:        str(w?.id, 60) || crypto.randomUUID(),
      nome:      str(w?.nome, 200) || 'Webinar',
      etapas,
      createdAt: str(w?.createdAt, 40) || new Date().toISOString(),
      updatedAt: str(w?.updatedAt, 40) || new Date().toISOString(),
    }
  })
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

  // ── GET — carrega os webinars do projeto pelo token ──────────────────────
  if (req.method === 'GET') {
    const url   = new URL(req.url)
    const token = url.searchParams.get('token')
    if (!token) return json({ error: 'Token inválido.' }, 400)

    const { data: projects, status } = await sb(
      `/projects_v2?client_share_token=eq.${encodeURIComponent(token)}&select=company_name,webinars`
    )
    if (status !== 200 || !Array.isArray(projects) || !projects.length) {
      return json({ error: 'Link inválido ou expirado.' }, 404)
    }
    return json({
      companyName: projects[0].company_name || '',
      webinars:    Array.isArray(projects[0].webinars) ? projects[0].webinars : [],
    })
  }

  // ── PATCH — salva a lista de webinars ────────────────────────────────────
  if (req.method === 'PATCH') {
    let body
    try { body = await req.json() } catch { return json({ error: 'JSON inválido.' }, 400) }

    const { token, webinars } = body
    if (!token || !Array.isArray(webinars)) return json({ error: 'Dados incompletos.' }, 400)

    const { data: projects } = await sb(
      `/projects_v2?client_share_token=eq.${encodeURIComponent(token)}&select=id`
    )
    if (!Array.isArray(projects) || !projects.length) {
      return json({ error: 'Token inválido.' }, 404)
    }
    const pid = projects[0].id

    const { status, data } = await sb(
      `/projects_v2?id=eq.${encodeURIComponent(pid)}`,
      { method: 'PATCH', body: JSON.stringify({ webinars: sanitizeWebinars(webinars) }) }
    )
    if (status >= 400) return json({ error: 'Erro ao salvar.', detail: data }, 500)

    return json({ success: true })
  }

  return json({ error: 'Método não permitido.' }, 405)
}
