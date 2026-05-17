// Catálogo de funis + lógica de recomendação. Roda no fim do diagnóstico
// Kickoff e devolve quais funis fazem sentido pra esse cliente, com a
// justificativa de cada match.

export const FUNNELS = [
  {
    id: 'webinar',
    label: 'Funil de Webinar',
    icon: '🎥',
    desc: 'Ideal pra produtos/serviços com baixa consciência do lead e marcas que ainda não são autoridade. O webinar prende o lead por horas e constrói confiança.',
  },
  {
    id: 'diagnostico',
    label: 'Funil de Diagnóstico',
    icon: '🔍',
    desc: 'Excelente pra SaaS que querem agendar demonstração e pra empresas B2B que entregam diagnóstico específico (ex: saúde financeira da empresa).',
  },
  {
    id: 'webinar_pago',
    label: 'Funil de Webinar Pago',
    icon: '💎',
    desc: 'Funcionou muito bem pra infoprodutores e coaches/mentores que querem qualificar a audiência cobrando uma entrada simbólica.',
  },
  {
    id: 'vsl',
    label: 'Funil de VSL',
    icon: '📹',
    desc: 'Alternativa ao webinar. Brilha quando o lead já tem dor latente mas ainda não conhece uma solução específica pro problema dele.',
  },
  {
    id: 'lancamento',
    label: 'Funil de Lançamento',
    icon: '🚀',
    desc: 'Estratégia clássica de infoprodutos. Constrói antecipação, faz o lead chegar quente no carrinho e maximiza conversão em janela curta.',
  },
  {
    id: 'wymb',
    label: 'Funil Win-Your-Money-Back',
    icon: '🛡️',
    desc: 'Excelente pra prestadores de serviços: garantia de devolução total se o cliente não tiver o resultado prometido. Quebra objeção de risco com força.',
  },
  {
    id: 'aplicacao',
    label: 'Funil de Aplicação',
    icon: '📋',
    desc: 'Pra marcas que já têm autoridade e querem filtrar leads antes de mandar pro comercial. Funciona bem em ticket alto B2B.',
  },
  {
    id: 'ecommerce',
    label: 'Funil de E-commerce',
    icon: '🛒',
    desc: 'Estrutura padrão pra venda direta de produtos físicos online: anúncio → produto → checkout → upsell.',
  },
  {
    id: 'isca_digital',
    label: 'Funil de Isca Digital',
    icon: '🧲',
    desc: 'Roda em paralelo a outro funil que já está performando. Capta leads via material gratuito (eBook, kit, planilha) pro comercial trabalhar.',
  },
  {
    id: 'quiz',
    label: 'Funil de Quiz',
    icon: '❓',
    desc: 'Indicado pra empresas B2B que querem diagnosticar o lead enquanto coletam mais informações pra qualificação posterior.',
  },
  {
    id: 'desafio',
    label: 'Funil de Desafio',
    icon: '🏆',
    desc: 'Funciona pra prestadores de serviços, coaches e mentores. Engaja o lead num desafio de poucos dias e gera prova social ao vivo.',
  },
]

export const FUNNELS_BY_ID = Object.fromEntries(FUNNELS.map((f) => [f.id, f]))

// ─── Recomendação ─────────────────────────────────────────────────────────────
// Recebe o objeto completo do kickoff + answers. Para cada funil, soma os
// pontos quando uma condição é satisfeita. Retorna lista ordenada por pontos,
// com as razões textuais que justificaram cada match.
//
// Pontuação:
//   - condição forte (perfect fit):    +3
//   - condição média (faz sentido):    +2
//   - condição leve (pode caber):      +1
//   - anti-match (não combina):        -2
//
// Limite de matches positivos pra ser "recomendado" (vs apenas "também válido"):
//   >= 3 pontos = Top recomendado
//   1-2 pontos  = Vale considerar
//   <= 0 pontos = Esconde
export function recommendFunnels({ answers = {}, ofertaMatadora = null } = {}) {
  const modelo  = answers.modelo_produto || null
  const om      = ofertaMatadora?.answers || {}
  const consciencia = om.om_consciencia
  const autoridade  = om.om_autoridade
  const dorLatente  = om.om_dor_latente

  const baixaConsciencia = consciencia === 'inconsciente' || consciencia === 'problema'
  const altaConsciencia  = consciencia === 'produto' || consciencia === 'pronto'
  const baixaAutoridade  = autoridade === 'desconhecida' || autoridade === 'pouca'
  const altaAutoridade   = autoridade === 'consolidada' || autoridade === 'lider'
  const dorForte         = dorLatente === 'aguda' || dorLatente === 'percebida'

  const investimentoPassado = Number(answers.investimento_passado) || 0
  const jaInvesteEmTrafego  = investimentoPassado > 0

  const matches = {}
  function add(funnelId, points, reason) {
    if (!matches[funnelId]) matches[funnelId] = { score: 0, reasons: [] }
    matches[funnelId].score += points
    if (points > 0) matches[funnelId].reasons.push(reason)
  }

  // ── Funil de Webinar ──────────────────────────────────────────────────────
  if (baixaConsciencia) add('webinar', 3, 'Lead com baixa consciência do problema/solução')
  if (baixaAutoridade)  add('webinar', 3, 'Marca ainda construindo autoridade')
  if (modelo === 'ecommerce') add('webinar', -2)

  // ── Funil de Diagnóstico ──────────────────────────────────────────────────
  if (modelo === 'saas')     add('diagnostico', 3, 'Modelo SaaS — diagnóstico ajuda a marcar demo')
  if (modelo === 'servicos') add('diagnostico', 2, 'Serviços B2B podem entregar diagnóstico inicial')
  if (modelo === 'ecommerce') add('diagnostico', -2)

  // ── Funil de Webinar Pago ─────────────────────────────────────────────────
  if (modelo === 'infoproduto') add('webinar_pago', 3, 'Infoprodutos respondem bem ao filtro de webinar pago')
  if (modelo === 'coach')        add('webinar_pago', 3, 'Coaches/mentores filtram bem com webinar pago')

  // ── Funil de VSL ──────────────────────────────────────────────────────────
  if (dorForte && consciencia === 'problema') add('vsl', 3, 'Lead com dor latente sem conhecer solução específica')
  if (modelo === 'infoproduto' || modelo === 'coach') add('vsl', 1, 'Modelo combina com VSL pra qualificar')

  // ── Funil de Lançamento ───────────────────────────────────────────────────
  if (modelo === 'infoproduto') add('lancamento', 3, 'Estratégia clássica de infoprodutos')
  if (modelo === 'coach')       add('lancamento', 2, 'Mentorias respondem bem a lançamentos')

  // ── Funil Win-Your-Money-Back ─────────────────────────────────────────────
  if (modelo === 'servicos') add('wymb', 3, 'Prestadores de serviços conseguem entregar garantia total')

  // ── Funil de Aplicação ────────────────────────────────────────────────────
  if (altaAutoridade) add('aplicacao', 3, 'Marca consolidada — pode filtrar leads via aplicação')
  if (modelo === 'saas' || modelo === 'servicos') add('aplicacao', 2, 'Modelo aceita filtro pré-comercial')
  if (modelo === 'ecommerce') add('aplicacao', -2)

  // ── Funil de E-commerce ───────────────────────────────────────────────────
  if (modelo === 'ecommerce') add('ecommerce', 3, 'Venda direta de produto físico online')

  // ── Funil de Isca Digital ─────────────────────────────────────────────────
  if (jaInvesteEmTrafego) add('isca_digital', 3, 'Já investe em tráfego — paralelo a um funil ativo')
  if (modelo === 'saas' || modelo === 'servicos') add('isca_digital', 1, 'Bom canal de leads pro comercial')

  // ── Funil de Quiz ─────────────────────────────────────────────────────────
  // Quiz é mais B2B — checamos se o businessType passou via answers
  // ou via flag explícita. (O businessType vem do orquestrador.)
  // Como recommendFunnels não recebe businessType direto, vamos confiar no modelo.
  if (modelo === 'saas' || modelo === 'servicos') add('quiz', 2, 'Quiz qualifica e coleta dados antes do comercial')
  if (altaConsciencia) add('quiz', 1, 'Lead já maduro responde quiz com profundidade')

  // ── Funil de Desafio ──────────────────────────────────────────────────────
  if (modelo === 'servicos') add('desafio', 2, 'Prestadores de serviço conseguem entregar desafio')
  if (modelo === 'coach')    add('desafio', 3, 'Coaches/mentores brilham em desafios ao vivo')

  // Constrói lista final ordenada
  return FUNNELS
    .map((f) => {
      const m = matches[f.id]
      if (!m || m.score <= 0) return null
      return {
        ...f,
        score: m.score,
        reasons: m.reasons,
        tier: m.score >= 3 ? 'top' : 'consider',
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
}

// Versão alternativa: aceita businessType pra refinar Quiz (B2B/Híbrido boost)
export function recommendFunnelsWithBusiness({ answers, ofertaMatadora, businessType }) {
  const baseList = recommendFunnels({ answers, ofertaMatadora })
  // Quiz ganha +1 quando é B2B/Híbrido
  if (businessType === 'b2b' || businessType === 'hibrido') {
    const quiz = baseList.find((f) => f.id === 'quiz')
    if (quiz) {
      quiz.score += 1
      quiz.reasons.unshift('Modelo B2B/Híbrido — quiz qualifica e diagnostica antes do comercial')
      if (quiz.score >= 3) quiz.tier = 'top'
    } else {
      // Insere mesmo se não tinha entrado
      baseList.push({
        ...FUNNELS_BY_ID.quiz,
        score: 2,
        reasons: ['Modelo B2B/Híbrido — quiz qualifica e diagnostica antes do comercial'],
        tier: 'consider',
      })
    }
    baseList.sort((a, b) => b.score - a.score)
  }
  return baseList
}
