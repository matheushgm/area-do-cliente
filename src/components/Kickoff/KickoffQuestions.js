// Banco de perguntas, pilares e estágios do diagnóstico Kickoff.
// Sem dependência de React — usado pelo KickoffModule, KickoffScorer e kickoffPDF.
//
// Os textos (enunciado, ajuda, placeholder, rótulo de opção, pilar, estágio e próximos
// passos) moram em src/i18n/locales/{pt,en}/kickoffPerguntas.js. No fim deste arquivo
// cada campo de texto vira um getter que traduz no idioma de agora a cada leitura, então
// quem lê `q.label` / `o.label` / `p.short` continua igual (o portal também). Ids,
// pilares, valores de opção e scores ficam aqui e não mudam: são o que vai pra
// `kickoff.answers` e o que o KickoffScorer usa.
import { t } from '../../i18n'
import TEXTOS_PT from '../../i18n/locales/pt/kickoffPerguntas.js'

export function lerCaminho(dic, caminho) {
  return caminho.split('.').reduce((v, p) => (v == null ? undefined : v[p]), dic)
}

/** Texto sempre em português (o que é gravado no projeto ou vai pro prompt da IA). */
export function textoPt(caminho) {
  return lerCaminho(TEXTOS_PT, caminho) ?? ''
}

/** Trecho do dicionário pt (objeto), para saber quais campos de texto ligar. */
export function textosPt(caminho) {
  return lerCaminho(TEXTOS_PT, caminho) || {}
}

/** Troca `alvo[campo]` por um getter que lê `t(chave)` no idioma de agora. */
export function ligarCampo(alvo, campo, chave) {
  Object.defineProperty(alvo, campo, { enumerable: true, configurable: true, get: () => t(chave) })
}

/** Liga, de uma vez, todo campo de texto que existe em `textos` (o dicionário pt). */
export function ligarTextos(alvo, textos, chave) {
  for (const [campo, v] of Object.entries(textos || {})) {
    if (typeof v === 'string') ligarCampo(alvo, campo, `${chave}.${campo}`)
  }
  return alvo
}

// ─── Os 9 pilares ─────────────────────────────────────────────────────────────
export const PILLARS = [
  { id: 'margem_lucro',         color: 'rl-gold'   },
  { id: 'oferta_entrada',       color: 'rl-purple' },
  { id: 'conjunto_ofertas',     color: 'rl-cyan'   },
  { id: 'grande_promessa',      color: 'rl-blue'   },
  { id: 'posicionamento',       color: 'rl-purple' },
  { id: 'autoridade',           color: 'rl-green'  },
  { id: 'processo_comercial',   color: 'rl-blue'   },
  { id: 'funil_previsivel',     color: 'rl-cyan'   },
  { id: 'empilhamento_canais',  color: 'rl-gold'   },
]

export const PILLARS_BY_ID = Object.fromEntries(PILLARS.map((p) => [p.id, p]))

// ─── Estágios de maturidade ───────────────────────────────────────────────────
export const STAGES = [
  { id: 0, range: [0, 30],   color: '#EF4444' },
  { id: 1, range: [31, 50],  color: '#F59E0B' },
  { id: 2, range: [51, 70],  color: '#EAB308' },
  { id: 3, range: [71, 85],  color: '#22C55E' },
  { id: 4, range: [86, 100], color: '#15803D' },
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
    id: 'modelo_produto',
    pillarIds: ['posicionamento'],
    type: 'single',
    options: [
      { value: 'ecommerce',   score: 100 },
      { value: 'whatsapp',    score: 100 },
      { value: 'saas',        score: 100 },
      { value: 'servicos',    score: 100 },
      { value: 'consultoria', score: 100 },
      { value: 'infoproduto', score: 100 },
      { value: 'coach',       score: 100 },
      { value: 'outro',       score: 50  },
    ],
  },
  {
    id: 'grande_promessa',
    pillarIds: ['grande_promessa'],
    type: 'text',
    scoreFn: promiseScore,
  },
  {
    id: 'porque_voce',
    pillarIds: ['posicionamento'],
    type: 'text',
    scoreFn: differentiatorScore,
  },
  {
    id: 'concorrentes',
    pillarIds: ['posicionamento'],
    type: 'text',
    scoreFn: competitorsScore,
  },
  {
    id: 'cliente_ideal_qualificado',
    pillarIds: ['posicionamento', 'processo_comercial'],
    type: 'text',
    scoreFn: qualifiedLeadScore,
  },
  {
    id: 'margem_bruta',
    pillarIds: ['margem_lucro'],
    type: 'percent',
    scoreFn: grossMarginScore,
  },
  {
    id: 'ticket_medio',
    pillarIds: ['margem_lucro'],
    type: 'money',
    scoreFn: (val) => (Number(val) > 0 ? 100 : 0),
  },
  {
    id: 'faturamento_mensal',
    pillarIds: ['margem_lucro'],
    type: 'money',
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
    scoreFn: (val) => (Number(val) > 0 ? 100 : 0),
  },
  {
    id: 'conteudo',
    pillarIds: ['autoridade'],
    type: 'single',
    options: [
      { value: 'forte',  score: 100 },
      { value: 'medio',  score: 50  },
      { value: 'nenhum', score: 0   },
    ],
  },
  {
    id: 'lead_magnet',
    pillarIds: ['autoridade'],
    type: 'yesno',
    askDescription: true,
    options: [
      { value: 'sim', score: 80 },
      { value: 'nao', score: 20 },
    ],
  },
  {
    id: 'investimento_passado',
    pillarIds: ['funil_previsivel'],
    type: 'money',
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
    options: [
      { value: 'meta',        score: 100 },
      { value: 'google',      score: 100 },
      { value: 'tiktok',      score: 100 },
      { value: 'linkedin',    score: 100 },
      { value: 'youtube',     score: 100 },
      { value: 'organico',    score: 100 },
      { value: 'email',       score: 100 },
      { value: 'whatsapp',    score: 100 },
      { value: 'indicacao',   score: 100 },
      { value: 'outbound',    score: 100 },
      { value: 'eventos',     score: 100 },
      { value: 'influencia',  score: 100 },
    ],
    scoreFn: countScore(20, 100),
  },
  {
    id: 'oferta_entrada',
    pillarIds: ['oferta_entrada'],
    type: 'single',
    askDescription: true,
    descriptionWhen: ['sim_testada', 'sim'],
    options: [
      { value: 'sim_testada', score: 100 },
      { value: 'sim',         score: 60  },
      { value: 'nao',         score: 10  },
    ],
  },
]

// ─── Perguntas B2B ────────────────────────────────────────────────────────────
const B2B = [
  {
    id: 'b2b_demanda',
    pillarIds: ['funil_previsivel'],
    type: 'multi',
    options: [
      { value: 'outbound',   score: 100 },
      { value: 'inbound',    score: 100 },
      { value: 'eventos',    score: 100 },
      { value: 'parceria',   score: 100 },
      { value: 'indicacao',  score: 100 },
      { value: 'nenhum',     score: 0   },
    ],
    scoreFn: countScore(25, 100),
  },
  {
    id: 'b2b_clientes_base',
    pillarIds: ['processo_comercial'],
    type: 'number',
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
    options: [
      { value: 'recorrente',  score: 100 },
      { value: 'recompra',    score: 75  },
      { value: 'unica',       score: 30  },
    ],
  },
  {
    id: 'b2b_precificacao',
    pillarIds: ['margem_lucro', 'grande_promessa'],
    type: 'single',
    options: [
      { value: 'valor',     score: 100 },
      { value: 'hora',      score: 60  },
      { value: 'mercado',   score: 30  },
      { value: 'unknown',   score: 0   },
    ],
  },
  {
    id: 'b2b_crm',
    pillarIds: ['processo_comercial'],
    type: 'single',
    options: [
      { value: 'crm',       score: 100 },
      { value: 'planilha',  score: 50  },
      { value: 'whats',     score: 10  },
    ],
  },
  {
    id: 'b2b_ciclo_venda',
    pillarIds: ['processo_comercial'],
    type: 'number',
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
    options: [
      { value: 'sdr_closer',  score: 100 },
      { value: 'unico',       score: 65  },
      { value: 'nenhum',      score: 15  },
    ],
  },
  {
    id: 'b2b_taxas_conversao',
    pillarIds: ['funil_previsivel', 'processo_comercial'],
    type: 'yesno',
    askDescription: true,
    // Em vez de uma textarea livre, mostra 3 inputs de % estruturados,
    // cada um com botão "Não sei". As respostas viram um objeto:
    //   subAnswers: { lead_mql: 30, mql_sql: 'unknown', sql_venda: 25 }
    subQuestions: [
      { id: 'lead_mql' },
      { id: 'mql_sql' },
      { id: 'sql_venda' },
    ],
    options: [
      { value: 'sim', score: 100 },
      { value: 'nao', score: 20  },
    ],
  },
]

// ─── Perguntas B2C ────────────────────────────────────────────────────────────
const B2C = [
  {
    id: 'b2c_demanda',
    pillarIds: ['funil_previsivel'],
    type: 'multi',
    options: [
      { value: 'meta',        score: 100 },
      { value: 'google',      score: 100 },
      { value: 'influencia',  score: 100 },
      { value: 'email',       score: 100 },
      { value: 'indicacao',   score: 100 },
      { value: 'fisica',      score: 100 },
      { value: 'nenhum',      score: 0   },
    ],
    scoreFn: countScore(20, 100),
  },
  {
    id: 'b2c_clientes_base',
    pillarIds: ['processo_comercial'],
    type: 'number',
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
    options: [
      { value: 'dedicado',  score: 100 },
      { value: 'proprio',   score: 50  },
      { value: 'reativo',   score: 15  },
    ],
  },
  {
    id: 'b2c_recompra',
    pillarIds: ['conjunto_ofertas'],
    type: 'single',
    options: [
      { value: 'fidelidade',  score: 100 },
      { value: 'email',       score: 70  },
      { value: 'passivo',     score: 35  },
      { value: 'nao_permite', score: 50  },
    ],
  },
  {
    id: 'b2c_upsell',
    pillarIds: ['conjunto_ofertas'],
    type: 'yesno',
    askDescription: true,
    options: [
      { value: 'sim', score: 85 },
      { value: 'nao', score: 20 },
    ],
  },
  {
    id: 'b2c_frequencia_recompra',
    pillarIds: ['conjunto_ofertas'],
    type: 'number',
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
// Textos em kickoffPerguntas.proximosPassos; os getters entram em ligarTextosDasPerguntas().
export const NEXT_STEPS = Object.fromEntries(PILLARS.map((p) => [p.id, {}]))

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

// ─── Textos traduzidos (getters) ──────────────────────────────────────────────
function ligarTextosDasPerguntas() {
  const NS = 'kickoffPerguntas'
  for (const p of PILLARS) ligarTextos(p, TEXTOS_PT.pilares[p.id], `${NS}.pilares.${p.id}`)
  for (const s of STAGES) ligarTextos(s, TEXTOS_PT.estagios[s.id], `${NS}.estagios.${s.id}`)
  for (const q of [...SHARED, ...B2B, ...B2C]) {
    const base = `${NS}.perguntas.${q.id}`
    const tx = TEXTOS_PT.perguntas[q.id] || {}
    ligarTextos(q, tx, base)
    for (const o of q.options || []) {
      if (tx.opcoes?.[o.value] != null) ligarCampo(o, 'label', `${base}.opcoes.${o.value}`)
    }
    for (const sq of q.subQuestions || []) ligarTextos(sq, tx.sub?.[sq.id], `${base}.sub.${sq.id}`)
  }
  for (const [pid, porTipo] of Object.entries(TEXTOS_PT.proximosPassos)) {
    if (NEXT_STEPS[pid]) ligarTextos(NEXT_STEPS[pid], porTipo, `${NS}.proximosPassos.${pid}`)
  }
}
ligarTextosDasPerguntas()
