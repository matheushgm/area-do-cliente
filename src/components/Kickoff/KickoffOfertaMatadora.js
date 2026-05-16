// Diagnóstico de viabilidade da Oferta Matadora.
// Avalia 5 pilares e devolve um veredito final: cabe / cabe com ajustes / não cabe.
// Sem dependência de React — usado pelo Panel e pelo PDF.

// ─── Os 5 pilares ─────────────────────────────────────────────────────────────
export const OM_PILLARS = [
  {
    id: 'dor_latente',
    label: 'Dor latente do lead',
    short: 'Dor latente',
    desc:  'A dor que seu produto resolve precisa ser sentida no dia a dia — não algo que o lead descobre só quando o vendedor explica.',
  },
  {
    id: 'poder_compra',
    label: 'Poder de compra do público',
    short: 'Poder de compra',
    desc:  'Sem capacidade financeira, a melhor oferta do mundo não converte.',
  },
  {
    id: 'encontrar_online',
    label: 'Facilidade de encontrar o público online',
    short: 'Segmentável',
    desc:  'Se Meta/Google/LinkedIn não conseguem segmentar bem o público, escalar é caro demais.',
  },
  {
    id: 'mercado_expansao',
    label: 'Mercado em expansão',
    short: 'Mercado',
    desc:  'Mercados crescendo permitem entrada agressiva; em mercados estagnados, ofertas matadoras canibalizam concorrentes — muito mais difícil.',
  },
  {
    id: 'consciencia_autoridade',
    label: 'Baixa consciência + baixa autoridade',
    short: 'Consciência/Autoridade',
    desc:  'Oferta matadora brilha quando o público ainda não sabe da solução E a marca não é referência. Em mercados maduros com marcas líderes, o jogo muda.',
  },
]

export const OM_PILLARS_BY_ID = Object.fromEntries(OM_PILLARS.map((p) => [p.id, p]))

// ─── Veredito ─────────────────────────────────────────────────────────────────
// Score geral × veredito + cor + frase de chamada
export const OM_VERDICTS = [
  {
    id: 'cabe',
    range: [75, 100],
    label: 'Cabe! Oferta matadora é a estratégia certa',
    short: 'Cabe',
    color: '#15803D',
    emoji: '✅',
    desc:  'O cenário do cliente bate em todos os pilares. Estruture uma oferta agressiva com garantia, prazo e prova social — vai vender.',
  },
  {
    id: 'talvez',
    range: [50, 74],
    label: 'Talvez — funciona com ajustes',
    short: 'Talvez',
    color: '#EAB308',
    emoji: '⚠️',
    desc:  'Existem brechas em pelo menos um pilar. Vale testar uma oferta matadora num público mais nichado, ou corrigir os pontos fracos antes de escalar.',
  },
  {
    id: 'nao_cabe',
    range: [0, 49],
    label: 'Outras estratégias funcionam melhor',
    short: 'Não cabe',
    color: '#EF4444',
    emoji: '❌',
    desc:  'O contexto não favorece oferta matadora. Foque em construção de autoridade, conteúdo educativo, prova social e mid-funnel antes de tentar a oferta agressiva.',
  },
]

export function getVerdict(score) {
  for (const v of OM_VERDICTS) {
    if (score >= v.range[0] && score <= v.range[1]) return v
  }
  return OM_VERDICTS[OM_VERDICTS.length - 1]
}

// ─── Perguntas ────────────────────────────────────────────────────────────────
// Cada pergunta mapeia para 1 pilar. Score é direto pelas opções.
// Nota importante: em "consciencia_mercado" e "autoridade_marca" a lógica
// é INVERTIDA — quanto MENOR a consciência/autoridade, MAIOR o score (porque
// é o cenário ideal pra oferta matadora). O texto deixa isso claro.
export const OM_QUESTIONS = [
  // ── Pilar 1: Dor latente ───────────────────────────────────────────────────
  {
    id: 'om_dor_latente',
    pillarId: 'dor_latente',
    type: 'single',
    label: 'Quão latente é a dor que o produto/serviço resolve?',
    hint: 'Latente = o lead já reclama dela hoje, sem precisar de ninguém apontar.',
    options: [
      { value: 'aguda',     label: 'Dor aguda — tira o sono do lead, ele busca solução ativamente', score: 100 },
      { value: 'percebida', label: 'Percebida — o lead reclama disso quando provocado',              score: 75  },
      { value: 'media',     label: 'Média — o lead concorda quando explicada, mas não busca',         score: 50  },
      { value: 'baixa',     label: 'Baixa — precisa de muita educação pra o lead reconhecer',         score: 25  },
      { value: 'inexistente', label: 'Inexistente — produto resolve algo que ninguém pede',           score: 0   },
    ],
  },

  // ── Pilar 2: Poder de compra ───────────────────────────────────────────────
  {
    id: 'om_poder_compra',
    pillarId: 'poder_compra',
    type: 'single',
    label: 'Qual o poder de compra típico do público-alvo?',
    options: [
      { value: 'alto_b2b',    label: 'B2B — empresa com R$1M+ de faturamento anual',          score: 100 },
      { value: 'alto_b2c',    label: 'B2C classe A/AA — compra valor sem pestanejar',         score: 100 },
      { value: 'medio_b2b',   label: 'B2B — empresa menor, compara investimento com cuidado', score: 70  },
      { value: 'medio_b2c',   label: 'B2C classe B — compara preço, parcelamento ajuda',      score: 65  },
      { value: 'baixo_b2c',   label: 'B2C classe C/D — sensível a preço, ticket baixo',        score: 30  },
      { value: 'desconhecido',label: 'Difícil precificar / poder variável',                    score: 40  },
    ],
  },

  // ── Pilar 3: Facilidade de encontrar online ────────────────────────────────
  {
    id: 'om_encontrar_online',
    pillarId: 'encontrar_online',
    type: 'single',
    label: 'Quão facilmente o público é encontrado/segmentado online?',
    hint: 'Pense em interesses no Meta, palavras-chave no Google, cargos no LinkedIn.',
    options: [
      { value: 'super',  label: 'Super segmentável — interesses, cargos ou keywords claras',  score: 100 },
      { value: 'bom',    label: 'Razoável — alguns sinais de comportamento, dá pra mirar',     score: 70  },
      { value: 'fraco',  label: 'Fraco — público disperso, sem sinal claro de intenção',      score: 35  },
      { value: 'invisivel', label: 'Quase invisível — só por indicação ou offline',            score: 5   },
    ],
  },

  // ── Pilar 4: Mercado em expansão ───────────────────────────────────────────
  {
    id: 'om_mercado_expansao',
    pillarId: 'mercado_expansao',
    type: 'single',
    label: 'Em que momento o mercado está?',
    options: [
      { value: 'forte_expansao', label: 'Forte expansão — surgindo novos players, demanda crescente', score: 100 },
      { value: 'moderada',       label: 'Crescimento moderado — mercado saudável, sem boom',          score: 75  },
      { value: 'estavel',        label: 'Estável — sem grandes mudanças nos últimos anos',            score: 50  },
      { value: 'retracao_leve',  label: 'Em retração leve',                                            score: 25  },
      { value: 'retracao_forte', label: 'Em retração forte / setor em declínio',                       score: 0   },
    ],
  },

  // ── Pilar 5a: Consciência do mercado ───────────────────────────────────────
  // Lógica invertida: BAIXA consciência = score ALTO (ideal pra oferta matadora)
  {
    id: 'om_consciencia',
    pillarId: 'consciencia_autoridade',
    type: 'single',
    label: 'Qual o nível de consciência do público sobre o problema/solução?',
    hint: 'Oferta matadora brilha quando o público AINDA NÃO sabe da solução — você cria a urgência.',
    options: [
      { value: 'inconsciente',  label: 'Inconsciente — não sabe que tem o problema',                  score: 100 },
      { value: 'problema',      label: 'Consciente do problema — não sabe que existe solução',         score: 80  },
      { value: 'solucao',       label: 'Consciente da solução — não conhece marcas',                   score: 55  },
      { value: 'produto',       label: 'Comparando produtos/marcas',                                    score: 25  },
      { value: 'pronto',         label: 'Cliente já decidiu, só precisa fechar',                       score: 0   },
    ],
  },

  // ── Pilar 5b: Autoridade da marca ──────────────────────────────────────────
  // Lógica invertida: BAIXA autoridade = score ALTO (ideal pra oferta matadora)
  {
    id: 'om_autoridade',
    pillarId: 'consciencia_autoridade',
    type: 'single',
    label: 'Qual o nível de autoridade da marca no mercado?',
    hint: 'Em mercados com marcas dominantes, oferta matadora costuma sangrar dinheiro.',
    options: [
      { value: 'desconhecida', label: 'Desconhecida — está começando agora',                          score: 100 },
      { value: 'pouca',        label: 'Pouca autoridade — alguns clientes conhecem',                  score: 85  },
      { value: 'media',        label: 'Autoridade média — nicho conhece, mainstream não',              score: 50  },
      { value: 'consolidada',  label: 'Marca consolidada — referência no segmento',                    score: 30  },
      { value: 'lider',         label: 'Líder de categoria — todo mundo conhece',                     score: 10  },
    ],
  },
]

// ─── Scoring ──────────────────────────────────────────────────────────────────
// Retorna: { scores: {pillarId: 0..100}, totalScore: 0..100, verdict: {...} }
export function computeOmDiagnosis(answers = {}) {
  const acc = {}
  for (const p of OM_PILLARS) acc[p.id] = { sum: 0, count: 0 }

  for (const q of OM_QUESTIONS) {
    const ans = answers[q.id]
    if (ans == null || ans === '') continue
    const opt = (q.options || []).find((o) => o.value === ans)
    const score = opt ? Number(opt.score) || 0 : 0
    if (acc[q.pillarId]) {
      acc[q.pillarId].sum += score
      acc[q.pillarId].count += 1
    }
  }

  const scores = {}
  for (const p of OM_PILLARS) {
    const { sum, count } = acc[p.id]
    scores[p.id] = count > 0 ? Math.round(sum / count) : 0
  }

  // Score geral = média simples dos 5 pilares
  const values = OM_PILLARS.map((p) => scores[p.id])
  const totalScore = values.length
    ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
    : 0

  // Conta quantas perguntas foram respondidas
  const answeredCount = OM_QUESTIONS.filter((q) => {
    const a = answers[q.id]
    return a != null && a !== ''
  }).length

  const verdict = getVerdict(totalScore)

  return {
    scores,
    totalScore,
    verdict,
    answeredCount,
    totalQuestions: OM_QUESTIONS.length,
  }
}

// ─── Texto da justificativa de cada pilar (pra UI e PDF) ──────────────────────
export function pillarJustification(pillarId, score) {
  if (score >= 75) {
    return {
      tag: 'Favorável',
      color: '#15803D',
      text: ({
        dor_latente:             'A dor é forte o suficiente pra justificar uma oferta agressiva com gatilho de urgência.',
        poder_compra:            'O público tem capacidade financeira pra absorver a oferta no ticket cheio.',
        encontrar_online:        'Segmentação clara — escalar mídia paga é viável e barato.',
        mercado_expansao:        'Mercado crescendo cria espaço pra entrada agressiva sem canibalizar muito.',
        consciencia_autoridade:  'Cenário ideal: público não conhece a categoria e a marca tem espaço pra criar a narrativa.',
      })[pillarId] || '',
    }
  }
  if (score >= 50) {
    return {
      tag: 'Atenção',
      color: '#EAB308',
      text: ({
        dor_latente:             'Dor não está totalmente latente. Vai precisar educar o lead antes de apresentar a oferta.',
        poder_compra:            'Poder de compra limita o ticket. Considere parcelamento ou ticket menor.',
        encontrar_online:        'Segmentação parcial. Vai gastar mais em mídia até calibrar.',
        mercado_expansao:        'Mercado morno. Oferta matadora ainda funciona, mas concorrência reage rápido.',
        consciencia_autoridade:  'Público em transição. A oferta precisa educar e converter ao mesmo tempo.',
      })[pillarId] || '',
    }
  }
  return {
    tag: 'Risco',
    color: '#EF4444',
    text: ({
      dor_latente:             'Sem dor latente, oferta matadora vira ruído. Foque em conteúdo educativo primeiro.',
      poder_compra:            'Sem poder de compra, qualquer oferta vai bater no muro do "não tenho dinheiro".',
      encontrar_online:        'Público difícil de encontrar online — escalar fica caríssimo. Outros canais podem render mais.',
      mercado_expansao:        'Mercado em retração ou estagnado. Oferta agressiva canibaliza margem sem ganhar share.',
      consciencia_autoridade:  'Público maduro com marcas fortes. Oferta matadora é jogada arriscada — invista em diferenciação.',
    })[pillarId] || '',
  }
}
