// Levas de aprovação de copy — a ponte entre "Criativos com IA" e a
// "Central de anúncios".
//
// Regra do fluxo:
//   1. Toda geração de copy vira anúncio em RASCUNHO na central (um por criativo).
//   2. O rascunho pode ser mandado pro cliente numa LEVA, que é um link só dela
//      (/aprovacao-copy/<token>).
//   3. O cliente aprovando, o mesmo anúncio passa a "Aprovado para Edição" e cai
//      na fila do designer (api/copy-aprovacao.js faz esse update).
//
// Este módulo é a única fonte da verdade do formato desses objetos — o modal de
// Criativos com IA e a Central usam as mesmas funções.
import { splitChunks, parseChunk } from '../components/Criativos/CreativeResultBlock'
import { DRAFT_STATUS } from '../components/Debriefing/debriefingData'

// Título limpo pro card: "## ROTEIRO 3: Tese: X | Ângulo: Y" → sem o "##".
export function tituloDoChunk(chunk, i) {
  const { title } = parseChunk(chunk)
  return (title || `Criativo ${i + 1}`).replace(/\s+/g, ' ').trim().slice(0, 160)
}

// Criativos individuais de uma geração, na mesma ordem dos cards da tela.
export function itensDaGeracao(creative) {
  return splitChunks(creative?.content || '').map((it, i) => ({
    index: i,
    titulo: tituloDoChunk(it.chunk, i),
    conteudo: it.chunk.trim(),
  }))
}

// Anúncio em rascunho a partir de um criativo da geração. Nasce sem mídia: a
// peça ainda vai ser produzida pelo designer depois da aprovação da copy.
export function novoAdRascunho(creative, item) {
  return {
    id:             crypto.randomUUID(),
    createdAt:      new Date().toISOString().slice(0, 10),
    nome:           item.titulo,
    tipo:           creative.type === 'video' ? 'video' : 'imagem',
    campanhaId:     '',
    funilId:        creative.funil || '',
    observacao:     '',
    status:         DRAFT_STATUS,
    startedAt:      null,
    finishedAt:     null,
    resultado:      null,
    justificativa:  '',
    url:            '',
    attachmentPath: null,
    attachmentName: null,
    attachmentUrl:  null,
    aprovacao:      null,       // aprovação da PEÇA (link público /aprovacao)
    copyAprovacao:  null,       // aprovação da COPY (link da leva)
    version:        1,
    versionHistory: [],
    copy:           item.conteudo,
    copyOrigem: {
      tipo:        'copy-ia',
      creativeId:  creative.id,
      creativeName: creative.name || null,
      itemIndex:   item.index,
      criadoEm:    new Date().toISOString(),
    },
    addedAt:   new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

// Todos os rascunhos que uma geração já produziu na central.
export function adsDaGeracao(project, creativeId) {
  return (project?.debriefing?.ads || [])
    .filter((ad) => ad?.copyOrigem?.creativeId === creativeId)
    .slice()
    .sort((a, b) => (a.copyOrigem?.itemIndex ?? 0) - (b.copyOrigem?.itemIndex ?? 0))
}

// Anúncios de uma geração, criando os que ainda não existem (gerações antigas,
// anteriores ao rascunho automático). Devolve a lista e o que falta persistir.
export function garantirAdsDaGeracao(project, creative) {
  const existentes = adsDaGeracao(project, creative.id)
  const porIndice = new Map(existentes.map((ad) => [ad.copyOrigem?.itemIndex, ad]))
  const novos = []
  const ads = itensDaGeracao(creative).map((item) => {
    const achado = porIndice.get(item.index)
    if (achado) return achado
    const ad = novoAdRascunho(creative, item)
    novos.push(ad)
    return ad
  })
  return { ads, novos }
}

// Monta a leva + marca os anúncios escolhidos como "copy pendente com o cliente".
// Devolve o patch pronto pro updateProject (as duas colunas de uma vez, pra não
// disparar duas escritas concorrentes no mesmo projeto).
export function montarEnvioDeLeva({ project, ads, nome, creative = null, adsExtras = [] }) {
  const now = new Date().toISOString()
  const leva = {
    id:         crypto.randomUUID(),
    token:      crypto.randomUUID(),
    creativeId: creative?.id || null,
    nome:       (nome || '').trim() || 'Leva de criativos',
    tipo:       (creative?.type || ads[0]?.tipo) === 'video' ? 'video' : 'estatico',
    funilId:    creative?.funil || ads[0]?.funilId || null,
    funilLabel: creative?.funilLabel || null,
    nivelLabel: creative?.nivelLabel || null,
    criadoEm:   now,
    enviadoEm:  now,
    itens: ads.map((ad) => ({
      id:        crypto.randomUUID(),
      adId:      ad.id,
      titulo:    ad.nome,
      conteudo:  ad.copy || '',
      aprovacao: { status: 'pendente', motivo: null, sugestao: null, decididoEm: null },
    })),
  }

  const enviados = new Map(leva.itens.map((it) => [it.adId, it]))
  const store = project.copyAprovacoes || {}
  const debriefing = project.debriefing || {}
  // adsExtras = rascunhos criados agora (geração antiga) que ainda não estavam
  // na central; entram junto com o envio.
  const listaAtual = [...(debriefing.ads || []), ...adsExtras]

  return {
    leva,
    patch: {
      copyAprovacoes: { ...store, levas: [...(store.levas || []), leva] },
      debriefing: {
        ...debriefing,
        ads: listaAtual.map((ad) => {
          const item = enviados.get(ad.id)
          if (!item) return ad
          return {
            ...ad,
            updatedAt: now,
            copyAprovacao: {
              status:     'pendente',
              motivo:     null,
              sugestao:   null,
              enviadoEm:  now,
              decididoEm: null,
              levaId:     leva.id,
              levaNome:   leva.nome,
              token:      leva.token,
            },
          }
        }),
      },
    },
  }
}

export function linkDaLeva(token) {
  return `${window.location.origin}/aprovacao-copy/${token}`
}
