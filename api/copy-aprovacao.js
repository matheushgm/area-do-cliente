// Edge Function pública — APROVAÇÃO DE COPY (leva de Criativos com IA).
//
// Diferente de /api/anuncios-aprovacao (que usa o client_share_token do projeto
// e lista tudo que já foi enviado), aqui o token é EXCLUSIVO de uma leva: o
// cliente só enxerga as copies daquela geração.
//
//   GET  ?token=UUID → devolve a leva (nome, tipo e itens com a copy)
//   POST { token, itemId, decision, motivo, sugestao } → registra a decisão
//
// Ao APROVAR, a mesma chamada cria o anúncio correspondente em
// projects_v2.debriefing.ads[] com status 'aprovado_edicao' — é isso que aciona
// o designer na Central de anúncios. A copy aprovada vai junto no campo `copy`.
export const config = { runtime: 'edge' }

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

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
      apikey:         SERVICE_KEY,
      Authorization:  `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const text = await res.text()
  let data = null
  try { data = JSON.parse(text) } catch { data = text }
  return { data, status: res.status }
}

const str = (v, max = 400) => String(v == null ? '' : v).trim().slice(0, max)

const SELECT = 'id,company_name,copy_aprovacoes,debriefing'

// Acha o projeto + a leva pelo token da leva. Primeiro tenta o filtro de
// containment em JSONB (índice-friendly); se não achar, varre os projetos que
// têm alguma leva — são poucos e evita depender do parser do PostgREST.
async function findLeva(token) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token || '')
  if (!isUuid) return null

  const contains = encodeURIComponent(JSON.stringify({ levas: [{ token }] }))
  let { data, status } = await sb(`/projects_v2?copy_aprovacoes=cs.${contains}&select=${SELECT}`)

  if (status !== 200 || !Array.isArray(data) || !data.length) {
    const scan = await sb(`/projects_v2?copy_aprovacoes=not.is.null&select=${SELECT}`)
    if (scan.status !== 200 || !Array.isArray(scan.data)) return null
    data = scan.data
  }

  for (const project of data) {
    const leva = (project.copy_aprovacoes?.levas || []).find((l) => l?.token === token)
    if (leva) return { project, leva }
  }
  return null
}

function sanitizeAprovacao(a) {
  return {
    status:     str(a?.status, 20) || 'pendente',
    motivo:     str(a?.motivo, 2000) || null,
    sugestao:   str(a?.sugestao, 2000) || null,
    decididoEm: str(a?.decididoEm, 40) || null,
  }
}

function sanitizeLeva(leva, companyName) {
  return {
    companyName,
    id:         str(leva.id, 60),
    nome:       str(leva.nome, 160) || 'Leva de criativos',
    tipo:       str(leva.tipo, 20) || 'estatico',
    funilLabel: str(leva.funilLabel, 80) || null,
    nivelLabel: str(leva.nivelLabel, 80) || null,
    enviadoEm:  str(leva.enviadoEm || leva.criadoEm, 40) || null,
    itens: (leva.itens || []).slice(0, 60).map((it) => ({
      id:        str(it.id, 60),
      titulo:    str(it.titulo, 200) || 'Criativo',
      conteudo:  str(it.conteudo, 20000),
      aprovacao: sanitizeAprovacao(it.aprovacao),
    })),
  }
}

// Decisão do cliente gravada no anúncio que já existe na Central (o rascunho
// que nasceu junto com a copy). Aprovado vai pra fila do designer; reprovado
// volta a rascunho, com o motivo à vista pra refazer.
function aplicarDecisaoNoAd(ad, { decision, motivo, sugestao, now, leva }) {
  return {
    ...ad,
    status: decision === 'aprovado' ? 'aprovado_edicao' : 'rascunho',
    updatedAt: now,
    copyAprovacao: {
      status:     decision,
      motivo:     decision === 'reprovado' ? motivo   : null,
      sugestao:   decision === 'reprovado' ? sugestao : null,
      enviadoEm:  ad?.copyAprovacao?.enviadoEm || null,
      decididoEm: now,
      levaId:     str(leva.id, 60),
      levaNome:   str(leva.nome, 160),
      token:      str(leva.token, 60),
    },
  }
}

// Anúncio criado na Central quando o cliente aprova uma copy de uma leva ANTIGA,
// enviada antes de a geração passar a criar o rascunho automaticamente. Nasce em
// 'aprovado_edicao' (fila do designer) e sem mídia — a peça ainda vai ser feita.
function novoAnuncio(leva, item) {
  const hoje = new Date().toISOString().slice(0, 10)
  return {
    id:              crypto.randomUUID(),
    createdAt:       hoje,
    nome:            str(item.titulo, 120) || 'Criativo aprovado',
    tipo:            leva.tipo === 'video' ? 'video' : 'imagem',
    campanhaId:      '',
    funilId:         str(leva.funilId, 60) || '',
    observacao:      '',
    status:          'aprovado_edicao',
    startedAt:       null,
    finishedAt:      null,
    resultado:       null,
    justificativa:   '',
    url:             '',
    attachmentPath:  null,
    attachmentName:  null,
    attachmentUrl:   null,
    // Aprovação da MÍDIA (link público /aprovacao) começa zerada: o que o
    // cliente aprovou aqui foi o texto, a peça pronta vai pra aprovação depois.
    aprovacao:       null,
    copyAprovacao: {
      status:     'aprovado',
      motivo:     null,
      sugestao:   null,
      enviadoEm:  str(leva.enviadoEm || leva.criadoEm, 40) || null,
      decididoEm: new Date().toISOString(),
      levaId:     str(leva.id, 60),
      levaNome:   str(leva.nome, 160),
      token:      str(leva.token, 60),
    },
    version:         1,
    versionHistory:  [],
    // Copy aprovada + rastro da leva de origem
    copy:            str(item.conteudo, 20000),
    copyOrigem: {
      tipo:       'copy-ia',
      levaId:     str(leva.id, 60),
      levaNome:   str(leva.nome, 160),
      itemId:     str(item.id, 60),
      creativeId: str(leva.creativeId, 60) || null,
      aprovadoEm: new Date().toISOString(),
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

  // ── GET: a leva que o cliente vai avaliar ───────────────────────────────────
  if (req.method === 'GET') {
    const token = new URL(req.url).searchParams.get('token')
    const found = await findLeva(str(token, 60))
    if (!found) return json({ error: 'Link inválido ou expirado.' }, 404)
    return json(sanitizeLeva(found.leva, found.project.company_name || ''))
  }

  // ── POST: decisão do cliente sobre uma copy ─────────────────────────────────
  if (req.method === 'POST') {
    let body
    try { body = await req.json() } catch { return json({ error: 'JSON inválido.' }, 400) }

    const token = str(body?.token, 60)
    const found = await findLeva(token)
    if (!found) return json({ error: 'Link inválido ou expirado.' }, 404)

    const { project, leva } = found
    const itemId   = str(body?.itemId, 60)
    const decision = str(body?.decision, 20)
    const motivo   = str(body?.motivo, 2000)
    const sugestao = str(body?.sugestao, 2000)

    if (!itemId || !['aprovado', 'reprovado'].includes(decision)) {
      return json({ error: 'Decisão inválida.' }, 400)
    }
    if (decision === 'reprovado' && (!motivo || !sugestao)) {
      return json({ error: 'Pra reprovar, preencha o motivo e como deveria estar.' }, 400)
    }

    const item = (leva.itens || []).find((it) => it?.id === itemId)
    if (!item) return json({ error: 'Criativo não encontrado nesta leva.' }, 404)
    if ((item.aprovacao?.status || 'pendente') !== 'pendente') {
      return json({ error: 'Essa copy já foi avaliada.' }, 409)
    }

    const now = new Date().toISOString()

    // O normal é o anúncio já existir na Central (rascunho criado junto com a
    // copy) e só receber a decisão. Sem ele, a leva é antiga: cria na hora, e
    // só quando aprovado — reprovado antigo não vira card.
    const debriefing = project.debriefing || {}
    const adsAtuais  = Array.isArray(debriefing.ads) ? debriefing.ads : []
    const adExistente = item.adId ? adsAtuais.find((a) => a?.id === item.adId) : null
    const adNovo = !adExistente && decision === 'aprovado' ? novoAnuncio(leva, item) : null

    const store = project.copy_aprovacoes || {}
    const nextCopy = {
      ...store,
      levas: (store.levas || []).map((l) => (l?.id !== leva.id ? l : {
        ...l,
        atualizadoEm: now,
        itens: (l.itens || []).map((it) => (it?.id !== itemId ? it : {
          ...it,
          adId: adNovo ? adNovo.id : it.adId ?? null,
          aprovacao: {
            status:     decision,
            motivo:     decision === 'reprovado' ? motivo   : null,
            sugestao:   decision === 'reprovado' ? sugestao : null,
            decididoEm: now,
          },
        })),
      })),
    }

    const patch = { copy_aprovacoes: nextCopy }

    if (adExistente) {
      patch.debriefing = {
        ...debriefing,
        ads: adsAtuais.map((a) => (a?.id !== adExistente.id
          ? a
          : aplicarDecisaoNoAd(a, { decision, motivo, sugestao, now, leva }))),
      }
    } else if (adNovo) {
      // Leva antiga: aprovou → entra na Central como "Aprovado para Edição".
      patch.debriefing = { ...debriefing, ads: [...adsAtuais, adNovo] }
    }

    const { status } = await sb(
      `/projects_v2?id=eq.${encodeURIComponent(project.id)}`,
      { method: 'PATCH', body: JSON.stringify(patch), headers: { Prefer: 'return=minimal' } }
    )
    if (status >= 400) return json({ error: 'Erro ao salvar a decisão.' }, 500)

    return json({ success: true })
  }

  return json({ error: 'Método não permitido.' }, 405)
}
