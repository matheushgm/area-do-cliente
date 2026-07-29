// Edge Function pública — APROVAÇÃO DE ANÚNCIOS pelo cliente.
// Validação só pelo client_share_token do projeto (mesmo token de
// /campanhas, /precificacao, /crm...). Sem login.
//
//   GET  ?token=UUID                                → lista anúncios enviados pra aprovação
//   POST { token, adId, decision, motivo, sugestao } → registra aprovado/reprovado
//
// Os anúncios vivem no JSONB projects_v2.debriefing (Central de anúncios).
// Só saem pro cliente os que têm ad.aprovacao (foram explicitamente enviados),
// e o POST só aceita decisão quando o status atual é 'pendente' — decidir de
// novo exige o time reenviar pra aprovação no módulo interno.
export const config = { runtime: 'edge' }

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'attachments'

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    },
  })
}

async function sb(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey:        SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const text = await res.text()
  let data = null
  try { data = JSON.parse(text) } catch { data = text }
  return { data, status: res.status }
}

// URL assinada (1h) pro anexo do bucket privado — o cliente não tem login.
async function signAttachment(path) {
  if (!path) return null
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`,
    {
      method: 'POST',
      headers: {
        apikey:        SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: 3600 }),
    }
  )
  if (!res.ok) return null
  const body = await res.json().catch(() => null)
  return body?.signedURL ? `${SUPABASE_URL}/storage/v1${body.signedURL}` : null
}

const str = (v, max = 400) => String(v == null ? '' : v).trim().slice(0, max)

// Tipo de mídia pelo nome do arquivo — decide como a página pública renderiza.
function mediaKind(name) {
  const ext = String(name || '').split('.').pop()?.toLowerCase() || ''
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return 'image'
  if (['mp4', 'mov', 'webm', 'm4v'].includes(ext)) return 'video'
  if (ext === 'pdf') return 'pdf'
  return 'other'
}

async function findProject(token) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token || '')
  if (!isUuid) return null
  const { data, status } = await sb(
    `/projects_v2?client_share_token=eq.${encodeURIComponent(token)}&select=id,company_name,debriefing`
  )
  if (status !== 200 || !Array.isArray(data) || !data.length) return null
  return data[0]
}

async function sanitizeAd(ad) {
  return {
    id:        str(ad.id, 60),
    nome:      str(ad.nome, 120),
    tipo:      str(ad.tipo, 20),
    createdAt: str(ad.createdAt, 30),
    url:       /^https?:\/\//i.test(ad.url || '') ? str(ad.url, 800) : null,
    attachmentName: str(ad.attachmentName, 200) || null,
    attachmentUrl:  await signAttachment(ad.attachmentPath),
    mediaKind:      ad.attachmentPath ? mediaKind(ad.attachmentName || ad.attachmentPath) : null,
    observacao:     str(ad.observacao, 1200) || null,
    aprovacao: {
      status:     str(ad.aprovacao?.status, 20) || 'pendente',
      motivo:     str(ad.aprovacao?.motivo, 2000) || null,
      sugestao:   str(ad.aprovacao?.sugestao, 2000) || null,
      decididoEm: str(ad.aprovacao?.decididoEm, 30) || null,
    },
  }
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: 'Servidor não configurado.' }, 500)

  // ── GET: lista pro cliente ──────────────────────────────────────────────────
  if (req.method === 'GET') {
    const token = new URL(req.url).searchParams.get('token')
    const project = await findProject(token)
    if (!project) return json({ error: 'Link inválido ou expirado.' }, 404)

    const ads = (project.debriefing?.ads || [])
      .filter((ad) => ad && ad.aprovacao)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, 100)

    return json({
      companyName: project.company_name || '',
      ads: await Promise.all(ads.map(sanitizeAd)),
    })
  }

  // ── POST: decisão do cliente ────────────────────────────────────────────────
  if (req.method === 'POST') {
    let body
    try { body = await req.json() } catch { return json({ error: 'JSON inválido.' }, 400) }

    const project = await findProject(str(body?.token, 60))
    if (!project) return json({ error: 'Link inválido ou expirado.' }, 404)

    const adId     = str(body?.adId, 60)
    const decision = str(body?.decision, 20)
    const motivo   = str(body?.motivo, 2000)
    const sugestao = str(body?.sugestao, 2000)

    if (!adId || !['aprovado', 'reprovado'].includes(decision)) {
      return json({ error: 'Decisão inválida.' }, 400)
    }
    if (decision === 'reprovado' && (!motivo || !sugestao)) {
      return json({ error: 'Pra reprovar, preencha o motivo e como o anúncio deveria estar.' }, 400)
    }

    const debriefing = project.debriefing || {}
    const list = Array.isArray(debriefing.ads) ? debriefing.ads : []
    const target = list.find((ad) => ad?.id === adId && ad?.aprovacao)
    if (!target) return json({ error: 'Anúncio não encontrado.' }, 404)
    if (target.aprovacao.status !== 'pendente') {
      return json({ error: 'Esse anúncio já foi avaliado.' }, 409)
    }

    const now = new Date().toISOString()
    const next = {
      ...debriefing,
      ads: list.map((ad) => (ad?.id !== adId ? ad : {
        ...ad,
        updatedAt: now,
        aprovacao: {
          status:     decision,
          motivo:     decision === 'reprovado' ? motivo   : null,
          sugestao:   decision === 'reprovado' ? sugestao : null,
          decididoEm: now,
        },
      })),
    }

    const { status } = await sb(
      `/projects_v2?id=eq.${encodeURIComponent(project.id)}`,
      { method: 'PATCH', body: JSON.stringify({ debriefing: next }), headers: { Prefer: 'return=minimal' } }
    )
    if (status >= 400) return json({ error: 'Erro ao salvar a decisão.' }, 500)

    return json({ success: true })
  }

  return json({ error: 'Método não permitido.' }, 405)
}
