// Banco de perguntas, pilares e estágios do diagnóstico Kickoff.
// Sem dependência de React — usado pelo KickoffModule, KickoffScorer e kickoffPDF.

// ─── Os 9 pilares ─────────────────────────────────────────────────────────────
export const PILLARS = [
  { id: 'margem_lucro',         label: 'Margem de lucro',          short: 'Margem',         color: 'rl-gold'   },
  { id: 'oferta_entrada',       label: 'Oferta de entrada',        short: 'Oferta entrada', color: 'rl-purple' },
  { id: 'conjunto_ofertas',     label: 'Conjunto de ofertas',      short: 'Recompra',       color: 'rl-cyan'   },
  { id: 'grande_promessa',      label: 'Grande promessa',          short: 'Promessa',       color: 'rl-blue'   },
  { id: 'posicionamento',       label: 'Posicionamento',           short: 'Posicionamento', color: 'rl-purple' },
  { id: 'autoridade',           label: 'Autoridade no mercado',    short: 'Autoridade',     color: 'rl-green'  },
  { id: 'processo_comercial',   label: 'Processo comercial',       short: 'Comercial',      color: 'rl-blue'   },
  { id: 'funil_previsivel',     label: 'Funil previsível',         short: 'Funil',          color: 'rl-cyan'   },
  { id: 'empilhamento_canais',  label: 'Empilhamento de canais',   short: 'Canais',         color: 'rl-gold'   },
]

export const PILLARS_BY_ID = Object.fromEntries(PILLARS.map((p) => [p.id, p]))

// ─── Estágios de maturidade ───────────────────────────────────────────────────
export const STAGES = [
  { id: 0, label: 'Caos',          range: [0, 30],   color: '#EF4444', desc: 'Negócio sem fundação estruturada — várias frentes simultâneas a atacar.' },
  { id: 1, label: 'Validação',     range: [31, 50],  color: '#F59E0B', desc: 'Tem produto e algumas vendas, mas sem previsibilidade nem processos.' },
  { id: 2, label: 'Estruturação',  range: [51, 70],  color: '#EAB308', desc: 'Bases comerciais existem; falta padronizar e empilhar canais.' },
  { id: 3, label: 'Aceleração',    range: [71, 85],  color: '#22C55E', desc: 'Pronto para escalar — funis previsíveis, oferta validada.' },
  { id: 4, label: 'Escala',        range: [86, 100], color: '#15803D', desc: 'Negócio maduro, com canais empilhados e ofertas estruturadas.' },
]

// ─── Helpers de scoreFn ───────────────────────────────────────────────────────
// (definidos como funções nomeadas para serem fáceis de testar/depurar)

// Score por faixa: aceita lista [[min, max, score], ...]; usa <= max
function rangeScore(ranges) {
  return (val) => {
    const n = Number(val) || 0
    for (const [min, max, score] of ranges) {
      if (n >= min && n <= max) return score
    }
    return 0
  }
}

// Score por número de itens marcados (multi)
function countScore(perItem = 20, cap = 100) {
  return (arr) => {
    const n = Array.isArray(arr) ? arr.length : 0
    return Math.min(cap, n * perItem)
  }
}

// Score por preenchimento de texto (presença + quantidade de tokens-chave)
function promiseScore(text) {
  const t = String(text || '').trim()
  if (t.length < 10) return 10
  let s = 40
  // bônus por presença de números (métrica) e prazos
  if (/\d/.test(t)) s += 20
  if (/(dias?|semanas?|meses?|ano|mês|horas?)/i.test(t)) s += 20
  if (/(garantia|asseguramos|reembolso|sem|sem custo)/i.test(t)) s += 10
  if (t.length > 80) s += 10
  return Math.min(100, s)
}

// Score por número de concorrentes listados (uma linha por concorrente)
function competitorsScore(text) {
  const lines = String(text || '').split(/\n|,/).map((l) => l.trim()).filter(Boolean)
  if (lines.length >= 3) return 100
  if (lines.length === 2) return 65
  if (lines.length === 1) return 35
  return 0
}

// Score genérico pra respostas abertas que pedem diferenciação/posicionamento.
// Recompensa esforço (comprimento), presença de marcadores concretos de
// diferencial e múltiplos motivos listados.
function differentiatorScore(text) {
  const t = String(text || '').trim()
  if (t.length < 15) return 0
  let s = 25

  if (t.length >= 80)  s += 15
  if (t.length >= 200) s += 10

  const markers = [
    /\b(experi[êe]ncia|anos|tempo de mercado|hist[óo]rico)/i,
    /\b(metodologia|m[ée]todo|processo|framework|sistema)/i,
    /\b(resultados?|cases?|portf[óo]lio|comprovad)/i,
    /\b(especialista?|especializ|nicho|foco)/i,
    /\b(equipe|time|profissionais?|certificad)/i,
    /\b(tecnologia|ferramenta|exclusiv|propriet[áa]rio)/i,
    /\b(garantia|seguro|comprovado|sem risco)/i,
    /\b(personaliz|customiz|adapt|sob medida)/i,
    /\b(velocidade|agilidade|r[áa]pido|prazo)/i,
    /\b(suporte|atendimento|acompanhamento|consultor)/i,
  ]
  let hits = 0
  for (const re of markers) if (re.test(t)) hits++
  s += Math.min(40, hits * 8)

  const separators = (t.match(/[,;]|\bou\b|\be\b/gi) || []).length
  if (separators >= 2) s += 10

  return Math.min(100, s)
}

// Score por margem bruta em %. Aceita número (0-100) ou 'unknown'.
function grossMarginScore(value) {
  if (value === 'unknown' || value == null || value === '') return 0
  const n = Number(value)
  if (isNaN(n)) return 0
  if (n >= 60) return 95
  if (n >= 40) return 75
  if (n >= 20) return 50
  if (n > 0)   return 25
  return 0
}

// Score do ICP + critérios de lead qualificado.
// Recompensa esforço (comprimento), especificidade (presença de marcadores
// como cargo, faturamento, dor, etc.) e múltiplos critérios listados.
function qualifiedLeadScore(text) {
  const t = String(text || '').trim()
  if (t.length < 10) return 0
  let s = 25  // base de "tentou responder"

  // Bônus por comprimento
  if (t.length >= 60)  s += 15
  if (t.length >= 150) s += 10

  // Marcadores de especificidade — quanto mais aspectos diferentes, melhor.
  // 8 pontos por categoria de marcador encontrada, cap em 40.
  const markers = [
    /\b(cargo|gerente|diretor|founder|ceo|cto|head|coordenador|s[óo]cio)/i,
    /\b(faturamento|receita|R\$|milh[ãa]o|mil reais?)/i,
    /\b(funcion[áa]rios?|colaboradores?|equipe|tamanho|porte|empresa pequena|m[ée]dia empresa)/i,
    /\b(segmento|setor|ind[úu]stria|nicho|mercado|vertical)/i,
    /\b(dor|problema|desafio|necessidade|pain)/i,
    /\b(idade|anos?|gera[çc][ãa]o|demograf|p[úu]blico)/i,
    /\b(localiza[çc][ãa]o|cidade|regi[ãa]o|estado|capital|interior)/i,
    /\b(or[çc]amento|investimento|budget|disposto a pagar|ticket)/i,
    /\b(tempo|prazo|urg[êe]ncia|maturidade|preparado|consciente)/i,
  ]
  let hits = 0
  for (const re of markers) if (re.test(t)) hits++
  s += Math.min(40, hits * 8)

  // Bônus por múltiplos critérios listados (vírgula, ponto-e-vírgula, "e", "ou")
  const separators = (t.match(/[,;]|\bou\b|\be\b/gi) || []).length
  if (separators >= 2) s += 10

  return Math.min(100, s)
}

// ─── Perguntas compartilhadas (sempre fazem) ──────────────────────────────────
const SHARED = [
  {
    id: 'grande_promessa',
    pillarIds: ['grande_promessa'],
    type: 'text',
    label: 'Qual é a grande promessa do seu produto/serviço?',
    hint: 'Idealmente específica, mensurável e com prazo. Ex: "Triplicamos o ROI do seu tráfego em 90 dias".',
    scoreFn: promiseScore,
  },
  {
    id: 'porque_voce',
    pillarIds: ['posicionamento'],
    type: 'text',
    label: 'Por que o cliente deve escolher a sua empresa e não a do concorrente?',
    hint: 'Liste os diferenciais concretos — experiência, metodologia, resultados, especialização, garantia, tecnologia, etc. Quanto mais específico e múltiplos motivos, melhor.',
    scoreFn: differentiatorScore,
  },
  {
    id: 'concorrentes',
    pillarIds: ['posicionamento'],
    type: 'text',
    label: 'Quem são seus 3 principais concorrentes?',
    hint: 'Um por linha. Quanto mais específico, melhor.',
    scoreFn: competitorsScore,
  },
  {
    id: 'cliente_ideal_qualificado',
    pillarIds: ['posicionamento', 'processo_comercial'],
    type: 'text',
    label: 'Quem é o cliente ideal e o que valida claramente que geramos um lead qualificado?',
    hint: 'Descreva o perfil (cargo, segmento, tamanho/faturamento, dor principal) + os critérios objetivos que tornam um lead pronto pra venda. Ex.: "Gestor de tráfego de e-commerce com R$50k+/mês de faturamento, que já investe em Meta Ads e quer escalar — qualificado se tem cargo decisor e budget mínimo de R$10k/mês".',
    scoreFn: qualifiedLeadScore,
  },
  {
    id: 'margem_bruta',
    pillarIds: ['margem_lucro'],
    type: 'percent',
    label: 'Qual a margem bruta média por venda/contrato?',
    hint: 'Margem BRUTA = (Receita - Custo direto do produto/serviço) / Receita. Considera só o que é diretamente atribuível à entrega (ex: matéria-prima, mão de obra de execução, taxa de plataforma). NÃO subtrai custos administrativos, salários fixos, aluguel ou marketing — isso é margem LÍQUIDA. Queremos a BRUTA porque é ela que define quanto sobra pra investir em aquisição (marketing/tráfego).',
    unknownLabel: 'Não sei calcular',
    scoreFn: grossMarginScore,
  },
  {
    id: 'ticket_medio',
    pillarIds: ['margem_lucro'],
    type: 'money',
    label: 'Qual o ticket médio das suas vendas?',
    hint: 'Valor médio por venda/contrato fechado.',
    scoreFn: (val) => (Number(val) > 0 ? 100 : 0),
  },
  {
    id: 'faturamento_mensal',
    pillarIds: ['margem_lucro'],
    type: 'money',
    label: 'Qual foi o faturamento do último mês?',
    hint: 'Receita total no mês anterior — soma de todas as vendas/contratos.',
    scoreFn: (val) => {
      const n = Number(val) || 0
      if (n === 0) return 0
      if (n < 10000)    return 25  // <R$10k/mês
      if (n < 50000)    return 50  // R$10-50k
      if (n < 200000)   return 75  // R$50-200k
      if (n < 1000000)  return 90  // R$200k-1M
      return 100                    // R$1M+
    },
  },
  {
    id: 'cac_ltv',
    pillarIds: ['margem_lucro', 'funil_previsivel'],
    type: 'money',
    label: 'Qual o CAC máximo que você está disposto a pagar por cliente?',
    hint: 'CAC máximo aceitável = o teto de quanto custar uma aquisição mantendo o negócio saudável (regra prática: CAC < 1/3 do LTV). Esse número é o que define a previsibilidade do funil — sem ele, a cada real investido em tráfego você não sabe se ainda está no positivo. É ele que estabelece o teto de CPL em cada canal e o ponto em que escalar deixa de ser rentável. Se não tiver esse número, deixe em branco e priorize calcular antes da próxima rodada de investimento.',
    scoreFn: (val) => (Number(val) > 0 ? 100 : 0),
  },
  {
    id: 'conteudo',
    pillarIds: ['autoridade'],
    type: 'single',
    label: 'Você produz conteúdo orgânico regularmente?',
    options: [
      { value: 'forte',  label: 'Sim, semanalmente em 2+ canais',     score: 100 },
      { value: 'medio',  label: 'Sim, esporadicamente em 1 canal',    score: 50  },
      { value: 'nenhum', label: 'Não produzo',                         score: 0   },
    ],
  },
  {
    id: 'lead_magnet',
    pillarIds: ['autoridade', 'oferta_entrada'],
    type: 'yesno',
    label: 'Você tem isca digital / lead magnet (eBook, webinar, kit, amostra)?',
    askDescription: true,
    descriptionLabel: 'Descreva a isca atual',
    descriptionPlaceholder: 'Ex: eBook sobre tráfego pago captado via formulário no site...',
    options: [
      { value: 'sim', label: 'Sim', score: 80 },
      { value: 'nao', label: 'Não', score: 20 },
    ],
  },
  {
    id: 'investimento_passado',
    pillarIds: ['funil_previsivel'],
    type: 'money',
    label: 'Quanto investiu em tráfego no mês passado?',
    hint: 'Some Meta + Google + outras plataformas no mês anterior.',
    scoreFn: rangeScore([
      [0, 0, 0],
      [1, 1999, 20],
      [2000, 6999, 50],
      [7000, 16999, 75],
      [17000, Infinity, 95],
    ]),
  },
  {
    id: 'investimento_futuro',
    pillarIds: ['funil_previsivel'],
    type: 'money',
    label: 'Quanto pretende investir em tráfego por mês conosco?',
    hint: 'Budget mensal estimado de mídia paga / aquisição daqui pra frente.',
    scoreFn: rangeScore([
      [0, 0, 0],
      [1, 4999, 30],
      [5000, 19999, 60],
      [20000, 49999, 85],
      [50000, Infinity, 100],
    ]),
  },
  {
    id: 'canais_ativos',
    pillarIds: ['empilhamento_canais'],
    type: 'multi',
    label: 'Quais canais de aquisição você usa hoje? (marque todos)',
    options: [
      { value: 'meta',        label: 'Meta Ads',           score: 100 },
      { value: 'google',      label: 'Google Ads',         score: 100 },
      { value: 'tiktok',      label: 'TikTok Ads',         score: 100 },
      { value: 'linkedin',    label: 'LinkedIn Ads',       score: 100 },
      { value: 'youtube',     label: 'YouTube Ads',        score: 100 },
      { value: 'organico',    label: 'Orgânico (IG/TT/YT)', score: 100 },
      { value: 'email',       label: 'Email marketing',    score: 100 },
      { value: 'whatsapp',    label: 'WhatsApp / SMS',     score: 100 },
      { value: 'indicacao',   label: 'Indicação',          score: 100 },
      { value: 'outbound',    label: 'Outbound / cold',    score: 100 },
      { value: 'eventos',     label: 'Eventos',            score: 100 },
      { value: 'influencia',  label: 'Influenciadores',    score: 100 },
    ],
    scoreFn: countScore(20, 100),
  },
  {
    id: 'oferta_entrada',
    pillarIds: ['oferta_entrada'],
    type: 'single',
    label: 'Você tem alguma oferta de entrada, garantia ou bônus diferenciado pra captar a primeira venda?',
    hint: 'Conta como oferta de entrada: preço promocional, kit/combo, trial/demo, garantia incondicional, bônus exclusivo na primeira compra, frete grátis, etc.',
    options: [
      { value: 'sim_testada', label: 'Sim, estruturada e testada',    score: 100 },
      { value: 'sim',         label: 'Sim, mas não testada',          score: 60  },
      { value: 'nao',         label: 'Não tenho',                      score: 10  },
    ],
  },
]

// ─── Perguntas B2B ────────────────────────────────────────────────────────────
const B2B = [
  {
    id: 'b2b_demanda',
    pillarIds: ['funil_previsivel'],
    type: 'multi',
    label: 'Como você gera demanda hoje? (processo atual, marque todos)',
    options: [
      { value: 'outbound',   label: 'Outbound / Cold call',    score: 100 },
      { value: 'inbound',    label: 'Inbound (orgânico + ads)', score: 100 },
      { value: 'eventos',    label: 'Eventos / palestras',      score: 100 },
      { value: 'parceria',   label: 'Parcerias / canais',       score: 100 },
      { value: 'indicacao',  label: 'Indicação',                score: 100 },
      { value: 'nenhum',     label: 'Não tenho processo',       score: 0   },
    ],
    scoreFn: countScore(25, 100),
  },
  {
    id: 'b2b_clientes_base',
    pillarIds: ['processo_comercial'],
    type: 'number',
    label: 'Quantos clientes ativos tem na base hoje?',
    scoreFn: rangeScore([
      [0, 0, 0],
      [1, 5, 30],
      [6, 20, 60],
      [21, 100, 85],
      [101, Infinity, 100],
    ]),
  },
  {
    id: 'b2b_recompra',
    pillarIds: ['conjunto_ofertas'],
    type: 'single',
    label: 'Seu modelo de negócio tem recompra ou recorrência?',
    options: [
      { value: 'recorrente',  label: 'Recorrência mensal/anual (SaaS, contrato)', score: 100 },
      { value: 'recompra',    label: 'Recompra natural (consumível)',              score: 75  },
      { value: 'unica',       label: 'Compra única',                                score: 30  },
    ],
  },
  {
    id: 'b2b_precificacao',
    pillarIds: ['margem_lucro', 'grande_promessa'],
    type: 'single',
    label: 'Como você precifica seu produto/serviço hoje?',
    options: [
      { value: 'valor',     label: 'Baseado em valor entregue (ROI)', score: 100 },
      { value: 'hora',      label: 'Baseado em hora/projeto',          score: 60  },
      { value: 'mercado',   label: 'Cópia da concorrência',            score: 30  },
      { value: 'unknown',   label: 'Não sei bem',                       score: 0   },
    ],
  },
  {
    id: 'b2b_crm',
    pillarIds: ['processo_comercial'],
    type: 'single',
    label: 'Onde você gerencia sua base de clientes hoje?',
    options: [
      { value: 'crm',       label: 'CRM dedicado (RD, Pipedrive, HubSpot, Salesforce)', score: 100 },
      { value: 'planilha',  label: 'Planilha estruturada',                              score: 50  },
      { value: 'whats',     label: 'WhatsApp / email / memória',                        score: 10  },
    ],
  },
  {
    id: 'b2b_ciclo_venda',
    pillarIds: ['processo_comercial'],
    type: 'number',
    label: 'Qual o ciclo médio de venda em dias?',
    hint: 'Da entrada do lead ao fechamento.',
    scoreFn: rangeScore([
      [0, 0, 0],
      [1, 14, 100],
      [15, 30, 85],
      [31, 60, 70],
      [61, 120, 50],
      [121, Infinity, 30],
    ]),
  },
  {
    id: 'b2b_processo_comercial',
    pillarIds: ['processo_comercial'],
    type: 'single',
    label: 'Qual seu processo comercial após o lead entrar?',
    options: [
      { value: 'sdr_closer',  label: 'SDR qualifica, closer fecha, etapas no CRM', score: 100 },
      { value: 'unico',       label: 'Vendedor único cuida do ciclo todo',          score: 65  },
      { value: 'nenhum',      label: 'Não tenho processo definido',                  score: 15  },
    ],
  },
  {
    id: 'b2b_taxas_conversao',
    pillarIds: ['funil_previsivel', 'processo_comercial'],
    type: 'yesno',
    label: 'Você conhece as taxas de conversão do seu funil (lead→MQL→SQL→venda)?',
    askDescription: true,
    descriptionLabel: 'Quais são as taxas atuais?',
    descriptionPlaceholder: 'Ex: Lead→MQL 30%, MQL→SQL 50%, SQL→Venda 25%...',
    options: [
      { value: 'sim', label: 'Sim', score: 100 },
      { value: 'nao', label: 'Não', score: 20  },
    ],
  },
]

// ─── Perguntas B2C ────────────────────────────────────────────────────────────
const B2C = [
  {
    id: 'b2c_demanda',
    pillarIds: ['funil_previsivel'],
    type: 'multi',
    label: 'Como você gera demanda hoje? (marque todos)',
    options: [
      { value: 'meta',        label: 'Meta Ads',           score: 100 },
      { value: 'google',      label: 'Google Shopping',    score: 100 },
      { value: 'influencia',  label: 'Influenciadores',    score: 100 },
      { value: 'email',       label: 'Email / WhatsApp',   score: 100 },
      { value: 'indicacao',   label: 'Indicação',          score: 100 },
      { value: 'fisica',      label: 'Loja física',        score: 100 },
      { value: 'nenhum',      label: 'Não tenho processo', score: 0   },
    ],
    scoreFn: countScore(20, 100),
  },
  {
    id: 'b2c_clientes_base',
    pillarIds: ['processo_comercial'],
    type: 'number',
    label: 'Quantos clientes ativos tem na base?',
    scoreFn: rangeScore([
      [0, 0, 0],
      [1, 50, 30],
      [51, 500, 60],
      [501, 5000, 85],
      [5001, Infinity, 100],
    ]),
  },
  {
    id: 'b2c_atendimento',
    pillarIds: ['processo_comercial'],
    type: 'single',
    label: 'Qual seu processo de atendimento ao cliente?',
    options: [
      { value: 'dedicado',  label: 'Equipe dedicada com SLA + script',  score: 100 },
      { value: 'proprio',   label: 'Atendimento próprio sem padrão',    score: 50  },
      { value: 'reativo',   label: 'Reativo, conforme aparece',          score: 15  },
    ],
  },
  {
    id: 'b2c_recompra',
    pillarIds: ['conjunto_ofertas'],
    type: 'single',
    label: 'Seu produto permite recompra? Como você estimula isso hoje?',
    options: [
      { value: 'fidelidade',  label: 'Sim, com programa de fidelidade/recorrência', score: 100 },
      { value: 'email',       label: 'Sim, com email/WhatsApp pós-venda',           score: 70  },
      { value: 'passivo',     label: 'Sim, mas não estimulo',                        score: 35  },
      { value: 'nao_permite', label: 'Não permite recompra',                          score: 50  },
    ],
  },
  {
    id: 'b2c_upsell',
    pillarIds: ['conjunto_ofertas'],
    type: 'yesno',
    label: 'Você tem ofertas de upsell/cross-sell no checkout ou pós-venda?',
    askDescription: true,
    descriptionLabel: 'Quais ofertas?',
    descriptionPlaceholder: 'Ex: Cross-sell de acessórios no checkout, email com produto complementar 7 dias após compra...',
    options: [
      { value: 'sim', label: 'Sim', score: 85 },
      { value: 'nao', label: 'Não', score: 20 },
    ],
  },
  {
    id: 'b2c_frequencia_recompra',
    pillarIds: ['conjunto_ofertas'],
    type: 'number',
    label: 'Qual sua frequência média de recompra (em dias)?',
    hint: 'Deixe em branco se não permite recompra.',
    showWhen: (a) => a.b2c_recompra && a.b2c_recompra !== 'nao_permite',
    scoreFn: (val) => {
      const n = Number(val) || 0
      if (n === 0) return 0
      if (n <= 30) return 100
      if (n <= 60) return 85
      if (n <= 90) return 70
      if (n <= 180) return 50
      return 30
    },
  },
]

// ─── Bundle por tipo ──────────────────────────────────────────────────────────
// Híbrido = compartilhadas + B2B + B2C (todas)
export const QUESTIONS_BY_TYPE = {
  shared: SHARED,
  b2b: [...SHARED, ...B2B],
  b2c: [...SHARED, ...B2C],
  hibrido: [...SHARED, ...B2B, ...B2C],
}

// ─── Próximos passos sugeridos ────────────────────────────────────────────────
// Mapeia { pillarId × businessType } → ação concreta (1-2 frases).
export const NEXT_STEPS = {
  margem_lucro: {
    b2b:    'Mapear CAC e LTV por canal nos próximos 30 dias; revisar precificação baseada em valor entregue.',
    b2c:    'Calcular margem por SKU, identificar produtos âncora vs sangradores e reprecificar o portfólio.',
    hibrido:'Mapear margem por linha de receita e CAC/LTV por canal; reprecificar com base em valor entregue.',
  },
  oferta_entrada: {
    b2b:    'Estruturar uma oferta de entrada (POC, projeto-piloto ou trial 14d) com escopo, prazo e garantia.',
    b2c:    'Lançar uma oferta de entrada testável (kit/desconto/garantia) e validar com 2 anúncios em A/B por 14 dias.',
    hibrido:'Criar duas ofertas de entrada (uma B2B, uma B2C) com gatilho de urgência e teste A/B em 30 dias.',
  },
  conjunto_ofertas: {
    b2b:    'Estruturar plano de upsell/cross-sell e pacotes recorrentes; implementar QBR pra retenção.',
    b2c:    'Implementar fluxo de pós-venda (email + WhatsApp) com upsell, programa de fidelidade e cross-sell no checkout.',
    hibrido:'Mapear oportunidades de recompra em ambas as linhas e lançar 1 upsell por linha nos próximos 60 dias.',
  },
  grande_promessa: {
    b2b:    'Reescrever a promessa com métrica + prazo + garantia; validar com 5 clientes atuais.',
    b2c:    'Reescrever a promessa com benefício específico + prazo + prova social; testar em 2 criativos.',
    hibrido:'Definir uma promessa única por linha de negócio e padronizar em site, ads e materiais comerciais.',
  },
  posicionamento: {
    b2b:    'Definir nicho de atuação e ICP (Ideal Customer Profile); mapear 3 concorrentes e diferenciais claros.',
    b2c:    'Construir narrativa de marca e diferenciais visuais/verbais; auditar concorrência diretamente.',
    hibrido:'Posicionar cada linha com proposta única; mapear ICP B2B e persona B2C separadamente.',
  },
  autoridade: {
    b2b:    'Plano editorial de 12 semanas no LinkedIn + 1 isca digital (eBook ou webinar) lançado em 30 dias.',
    b2c:    'Calendário de conteúdo orgânico (IG/TikTok) 3x por semana + 1 lead magnet (kit, amostra) em 30 dias.',
    hibrido:'Plano editorial duplo: LinkedIn pro B2B, IG/TT pro B2C; 1 lead magnet por linha em 45 dias.',
  },
  processo_comercial: {
    b2b:    'Implementar CRM, definir etapas do funil, criar SLA SDR↔Closer e dashboard semanal de pipeline.',
    b2c:    'Padronizar atendimento com script, SLA de resposta (<5 min) e ferramenta única (WhatsApp Business + planilha).',
    hibrido:'CRM unificado com pipelines separados; processo comercial por linha + dashboard mensal de conversão.',
  },
  funil_previsivel: {
    b2b:    'Investir em mídia paga (Meta + LinkedIn) com R$15k+/mês e medir CAC por canal nos próximos 90 dias.',
    b2c:    'Aumentar investimento em Meta + Google Shopping; medir ROAS por anúncio e por SKU semanalmente.',
    hibrido:'Distribuir budget entre canais B2B e B2C; tracking de funil com origem por canal em 30 dias.',
  },
  empilhamento_canais: {
    b2b:    'Adicionar 2 canais (ex: LinkedIn Ads + Email outbound) e testar por 60 dias com tracking dedicado.',
    b2c:    'Adicionar 2 canais (ex: TikTok + Email + Influência) e validar performance por 60 dias.',
    hibrido:'Empilhar canais por linha: B2B (LinkedIn, Outbound, Eventos) + B2C (Meta, TikTok, Influência).',
  },
}

// ─── Helpers públicos ─────────────────────────────────────────────────────────

/** Retorna a lista de perguntas para um businessType. */
export function getQuestionsFor(businessType) {
  return QUESTIONS_BY_TYPE[businessType] || []
}

/** Retorna o estágio (objeto STAGES) correspondente a um score 0-100. */
export function getStage(overallScore) {
  for (const stage of STAGES) {
    if (overallScore >= stage.range[0] && overallScore <= stage.range[1]) return stage
  }
  return STAGES[0]
}
