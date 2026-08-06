// Edge Function pública — APROVAÇÃO DE ANÚNCIOS E LANDING PAGES pelo cliente.
// Validação só pelo client_share_token do projeto (mesmo token de
// /campanhas, /precificacao, /crm...). Sem login.
//
//   GET  ?token=UUID → lista anúncios (debriefing) e LPs (lp_central) enviados pra aprovação
//   POST { token, adId, kind: 'ad'|'lp', decision, motivo, sugestao } → registra a decisão
//
// Os itens vivem nos JSONB projects_v2.debriefing (Central de anúncios) e
// projects_v2.lp_central (Central de Landing Pages). Só sai pro cliente o que
// tem .aprovacao (foi explicitamente enviado), e o POST só aceita decisão
// quando o status atual é 'pendente' — decidir de novo exige o time reenviar
// pra aprovação no módulo interno.
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
    `/projects_v2?client_share_token=eq.${encodeURIComponent(token)}&select=id,company_name,debriefing,lp_central`
  )
  if (status !== 200 || !Array.isArray(data) || !data.length) return null
  return data[0]
}

function sanitizeAprovacao(aprovacao) {
  return {
    status:     str(aprovacao?.status, 20) || 'pendente',
    motivo:     str(aprovacao?.motivo, 2000) || null,
    sugestao:   str(aprovacao?.sugestao, 2000) || null,
    enviadoEm:  str(aprovacao?.enviadoEm, 40) || null,
    decididoEm: str(aprovacao?.decididoEm, 40) || null,
  }
}

function sanitizeLp(lp) {
  return {
    id:         str(lp.id, 60),
    nome:       str(lp.nome, 160),
    createdAt:  str(lp.createdAt, 30),
    url:        /^https?:\/\//i.test(lp.url || '') ? str(lp.url, 800) : null,
    observacao: str(lp.observacao, 1200) || null,
    aprovacao:  sanitizeAprovacao(lp.aprovacao),
  }
}

// Versão arquivada quando o time cria v2/v3... após uma reprovação — guarda a
// mídia antiga + a decisão do cliente na época, pra comparação lado a lado.
async function sanitizeVersionEntry(v) {
  return {
    version:        Number(v?.version) || 1,
    url:            /^https?:\/\//i.test(v?.url || '') ? str(v.url, 800) : null,
    attachmentName: str(v?.attachmentName, 200) || null,
    attachmentUrl:  await signAttachment(v?.attachmentPath),
    mediaKind:      v?.attachmentPath ? mediaKind(v.attachmentName || v.attachmentPath) : null,
    aprovacao:      v?.aprovacao ? sanitizeAprovacao(v.aprovacao) : null,
    archivedAt:     str(v?.archivedAt, 40) || null,
  }
}

async function sanitizeAd(ad) {
  const versionHistory = Array.isArray(ad.versionHistory) ? ad.versionHistory : []
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
    aprovacao:      sanitizeAprovacao(ad.aprovacao),
    version:        Number(ad.version) || 1,
    versionHistory: await Promise.all(versionHistory.slice(0, 20).map(sanitizeVersionEntry)),
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

    const lps = (project.lp_central?.lps || [])
      .filter((lp) => lp && lp.aprovacao)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, 100)

    return json({
      companyName: project.company_name || '',
      ads: await Promise.all(ads.map(sanitizeAd)),
      lps: lps.map(sanitizeLp),
    })
  }

  // ── POST: decisão do cliente ────────────────────────────────────────────────
  if (req.method === 'POST') {
    let body
    try { body = await req.json() } catch { return json({ error: 'JSON inválido.' }, 400) }

    const project = await findProject(str(body?.token, 60))
    if (!project) return json({ error: 'Link inválido ou expirado.' }, 404)

    const adId     = str(body?.adId, 60)
    const kind     = str(body?.kind, 10) || 'ad' // 'ad' (criativo) | 'lp' (landing page)
    const decision = str(body?.decision, 20)
    const motivo   = str(body?.motivo, 2000)
    const sugestao = str(body?.sugestao, 2000)

    if (!adId || !['aprovado', 'reprovado'].includes(decision) || !['ad', 'lp'].includes(kind)) {
      return json({ error: 'Decisão inválida.' }, 400)
    }
    if (decision === 'reprovado' && (!motivo || !sugestao)) {
      return json({ error: 'Pra reprovar, preencha o motivo e como deveria estar.' }, 400)
    }

    // Mesmo ciclo pros dois tipos — muda só a coluna e a chave da lista.
    const column  = kind === 'lp' ? 'lp_central' : 'debriefing'
    const listKey = kind === 'lp' ? 'lps' : 'ads'
    const store = project[column] || {}
    const list = Array.isArray(store[listKey]) ? store[listKey] : []
    const target = list.find((it) => it?.id === adId && it?.aprovacao)
    if (!target) return json({ error: 'Item não encontrado.' }, 404)
    if (target.aprovacao.status !== 'pendente') {
      return json({ error: 'Esse item já foi avaliado.' }, 409)
    }

    const now = new Date().toISOString()
    const next = {
      ...store,
      [listKey]: list.map((it) => (it?.id !== adId ? it : {
        ...it,
        updatedAt: now,
        aprovacao: {
          status:     decision,
          motivo:     decision === 'reprovado' ? motivo   : null,
          sugestao:   decision === 'reprovado' ? sugestao : null,
          enviadoEm:  it.aprovacao.enviadoEm || null,
          decididoEm: now,
        },
      })),
    }

    const { status } = await sb(
      `/projects_v2?id=eq.${encodeURIComponent(project.id)}`,
      { method: 'PATCH', body: JSON.stringify({ [column]: next }), headers: { Prefer: 'return=minimal' } }
    )
    if (status >= 400) return json({ error: 'Erro ao salvar a decisão.' }, 500)

    return json({ success: true })
  }

  return json({ error: 'Método não permitido.' }, 405)
}
