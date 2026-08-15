// Levas de aprovação de copy — a ponte entre "Criativos com IA" e a
// "Central de anúncios".
//
// Regra do fluxo:
//   1. A geração de copy fica só em Criativos com IA. Nada entra na central por
//      geração — o gestor decide o que vai pro cliente.
//   2. Ao enviar pra aprovação, cada criativo escolhido vira anúncio na central
//      (aba "Ads para aprovação") e ganha uma LEVA com link só dela
//      (/aprovacao-copy/<token>).
//   3. O cliente aprovando, o mesmo anúncio passa a "Aprovado para Edição" e
//      espera o designer; reprovando, volta com o motivo à vista.
//   4. Quando o designer anexa a peça, o anúncio migra pra aba "Design pronto".
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

// Nome curto pro card da central. O título do criativo é comprido demais
// ("ROTEIRO 1: Tese: ... | Ângulo: ... | Nível: ...") e estourava a coluna.
export function nomeCurtoDoAd(titulo, index) {
  const semPrefixo = String(titulo || '')
    .replace(/^(ROTEIRO|AN[ÚU]NCIO)\s*\d+\s*[:.-]?\s*/i, '')
  const primeiro = (semPrefixo.split('|')[0] || '')
    .replace(/^(Tese|Tipo|Dor)\s*:\s*/i, '')
    .trim()
  const base = primeiro || semPrefixo.trim() || `Criativo ${index + 1}`
  return `${index + 1}. ${base}`.slice(0, 70)
}

// Anúncio criado quando a copy vai pro cliente. Nasce sem mídia: a peça ainda
// vai ser produzida pelo designer depois da aprovação.
export function novoAdDeCopy(creative, item) {
  return {
    id:             crypto.randomUUID(),
    createdAt:      new Date().toISOString().slice(0, 10),
    nome:           nomeCurtoDoAd(item.titulo, item.index),
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

// Lista de candidatos ao envio: os criativos da geração, reaproveitando o
// anúncio de quem já foi enviado antes e montando um novo (ainda não salvo) pro
// resto. `novos` só entra na central quando o gestor confirma o envio.
export function garantirAdsDaGeracao(project, creative) {
  const existentes = adsDaGeracao(project, creative.id)
  const porIndice = new Map(existentes.map((ad) => [ad.copyOrigem?.itemIndex, ad]))
  const novos = []
  const ads = itensDaGeracao(creative).map((item) => {
    const achado = porIndice.get(item.index)
    if (!achado) {
      const ad = novoAdDeCopy(creative, item)
      novos.push(ad)
      return ad
    }
    // Reenvio (o cliente reprovou e a copy foi corrigida): leva o texto atual.
    // Copy já aprovada não é reescrita — o que ele aprovou é o que vale.
    if (achado.copyAprovacao?.status === 'aprovado') return achado
    return {
      ...achado,
      nome: nomeCurtoDoAd(item.titulo, item.index),
      copy: item.conteudo,
    }
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

  // Mapa por id com a versão ATUAL do anúncio (pode ter copy corrigida), pra
  // que o reenvio grave o texto novo na central, não o que estava lá antes.
  const enviados = new Map(ads.map((ad) => [ad.id, ad]))
  const store = project.copyAprovacoes || {}
  const debriefing = project.debriefing || {}
  // adsExtras = anúncios que estão nascendo agora com este envio; é o momento em
  // que a copy passa a existir na central.
  const listaAtual = [...(debriefing.ads || []), ...adsExtras]

  return {
    leva,
    patch: {
      copyAprovacoes: { ...store, levas: [...(store.levas || []), leva] },
      debriefing: {
        ...debriefing,
        ads: listaAtual.map((ad) => {
          const atual = enviados.get(ad.id)
          if (!atual) return ad
          return {
            ...atual,
            // Reenviar uma copy que já tinha sido aprovada volta o anúncio pra
            // espera; quem já tem peça pronta mantém o status de veiculação.
            status: (atual.url || atual.attachmentPath) ? atual.status : DRAFT_STATUS,
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
