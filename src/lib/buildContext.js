/**
 * buildContext.js — Context builder compartilhado entre módulos de IA
 *
 * Textos gerados por IA (generatedOffer, generatedProfile, summary) são
 * excluídos — apenas os campos estruturais preenchidos pelo usuário são
 * enviados. Isso reduz tokens e evita que o modelo "ecoe" output anterior.
 *
 * Anexos:
 * - Arquivos de texto (text/*, application/json): conteúdo decodificado e incluído no contexto
 * - PDFs: enviados como bloco nativo { type: 'document' } da API Anthropic
 * - Imagens: enviadas como bloco nativo { type: 'image' } da API Anthropic
 * - Outros (.docx, .xlsx…): apenas o nome é listado
 */

// Limites de tamanho (caracteres)
const MAX_TEXT_FILE    = 4000  // caracteres máximos por arquivo de texto
const MAX_CONTEXT_CHARS = 50_000 // ~12.500 tokens — limite total do contexto de texto

// Limites de tamanho base64 para blocos nativos (evitar estourar body da Edge Function)
const MAX_PDF_B64   = 2_000_000  // ~1.5 MB original
const MAX_IMAGE_B64 = 1_500_000  // ~1.1 MB original

/** Remove o prefixo "data:...;base64," retornando apenas o base64 puro */
function extractBase64(dataUrl) {
  return dataUrl.replace(/^data:[^;]+;base64,/, '')
}

const BTYPE = {
  b2b: 'B2B',
  local: 'Negócio Local',
  ecommerce: 'E-commerce',
  infoproduto: 'Infoproduto',
}

/**
 * Monta o bloco de contexto do cliente em Markdown.
 * Campos gerados por IA são truncados automaticamente.
 *
 * @param {object} project — projeto do AppContext
 * @returns {string} contexto formatado
 */
export function buildContext(project) {
  const lines = ['# CONTEXTO COMPLETO DO CLIENTE\n']

  lines.push(`## EMPRESA: ${project.companyName}`)
  if (project.businessType)       lines.push(`Nicho/Tipo: ${BTYPE[project.businessType] || project.businessType}`)
  if (project.productDescription) lines.push(`Produto/Serviço: ${project.productDescription}`)
  if (project.mainGoal)           lines.push(`Objetivo: ${project.mainGoal}`)
  if (project.targetAudience)     lines.push(`Público-Alvo: ${project.targetAudience}`)
  if (project.averageTicket)      lines.push(`Ticket Médio: R$ ${project.averageTicket}`)
  if (project.mediaBudget)        lines.push(`Verba Mensal: R$ ${project.mediaBudget}`)
  const comps = (project.competitors || []).filter(Boolean)
  if (comps.length)               lines.push(`Concorrentes: ${comps.join(', ')}`)

  const produtos = (project.produtos || []).filter((p) => p.nome || p.answers)
  if (produtos.length) {
    lines.push('\n## PRODUTO / SERVIÇO')
    const PRODUTO_LABELS = {
      q1:  'O que resolve',
      q2:  'Quando o cliente precisa',
      q3:  'Vida depois do produto',
      q4:  'Diferencial vs concorrente',
      q5:  'Por que comprar agora',
      q6:  'Vida sem o produto',
      q7:  'Objeções de compra',
      q8:  'Tentativas anteriores',
      q9:  'Por que desconfiam',
      q10: 'Cases / resultados mensuráveis',
      q11: 'Tempo para 1º resultado',
      q12: 'O que mais elogiam',
      q13: 'Diferencial único',
      q14: 'Custo de inação (3 meses)',
      q15: 'Sazonalidade / janela de oportunidade',
      q16: 'Garantia',
      q17: 'Se der errado',
    }
    produtos.forEach((p) => {
      const tipoLabel = p.tipo === 'servico' ? 'Serviço' : 'Produto Físico'
      lines.push(`\n### ${p.nome || 'Produto Principal'} (${tipoLabel})`)
      const a = p.answers || {}
      Object.entries(PRODUTO_LABELS).forEach(([key, label]) => {
        if (a[key]?.trim()) lines.push(`${label}: ${a[key].trim()}`)
      })
    })
  }

  const personas = (project.personas || []).filter((p) => p.name || p.answers)
  if (personas.length) {
    lines.push('\n## PERSONAS / PÚBLICO-ALVO')
    personas.forEach((p) => {
      lines.push(`\n### ${p.name || 'Persona Principal'}`)
      const a    = p.answers || {}
      const pick = (k) => (a[k] || []).filter((s) => s?.trim()).slice(0, 4).join('; ')
      if (pick('resultado'))  lines.push(`Resultado desejado: ${pick('resultado')}`)
      if (pick('sonhos'))     lines.push(`Sonhos: ${pick('sonhos')}`)
      if (pick('objecoes'))   lines.push(`Objeções: ${pick('objecoes')}`)
      if (pick('medos'))      lines.push(`Medos: ${pick('medos')}`)
      if (pick('erros'))      lines.push(`Erros comuns: ${pick('erros')}`)
    })
  }

  const o = project.ofertaData
  if (o && (o.nome || o.resultadoSonho)) {
    lines.push('\n## OFERTA')
    if (o.nome)               lines.push(`Nome: ${o.nome}`)
    if (o.resultadoSonho)     lines.push(`Resultado do Sonho: ${o.resultadoSonho}`)
    if (o.porqueVaiFuncionar) lines.push(`Por que funciona: ${o.porqueVaiFuncionar}`)
    if (o.velocidade)         lines.push(`Prazo/Velocidade: ${o.velocidade}`)
    if (o.esforcoMinimo)      lines.push(`Esforço mínimo: ${o.esforcoMinimo}`)
    if (o.garantia)           lines.push(`Garantia: ${o.garantia}`)
    if (o.escassez)           lines.push(`Escassez/Urgência: ${o.escassez}`)
    const bonus = (o.bonus || []).filter(Boolean)
    if (bonus.length)         lines.push(`Bônus: ${bonus.join(' | ')}`)
  }

  const atts = project.attachments || []
  if (atts.length) {
    lines.push('\n## DOCUMENTOS DO CLIENTE')
    atts.forEach((a) => {
      const isText = a.type?.startsWith('text/') || a.type === 'application/json'
      if (isText && a.data) {
        // Arquivos de texto: decodifica e inclui o conteúdo diretamente
        try {
          const raw     = atob(extractBase64(a.data))
          const snippet = raw.length > MAX_TEXT_FILE
            ? raw.slice(0, MAX_TEXT_FILE) + '\n…(truncado)'
            : raw
          lines.push(`\n### ${a.name}\n\`\`\`\n${snippet}\n\`\`\``)
        } catch {
          lines.push(`- ${a.name}`)
        }
      } else if (a.type === 'application/pdf') {
        // PDF: nome aqui; conteúdo vai como bloco nativo em buildCachedPayload
        const b64 = a.data ? extractBase64(a.data) : ''
        const nota = b64.length > MAX_PDF_B64 ? ' (arquivo muito grande — apenas referenciado)' : ' (PDF — conteúdo incluído abaixo)'
        lines.push(`- ${a.name}${nota}`)
      } else if (a.type?.startsWith('image/')) {
        // Imagem: nome aqui; conteúdo vai como bloco nativo em buildCachedPayload
        const b64 = a.data ? extractBase64(a.data) : ''
        const nota = b64.length > MAX_IMAGE_B64 ? ' (imagem muito grande — apenas referenciada)' : ' (imagem — conteúdo incluído abaixo)'
        lines.push(`- ${a.name}${nota}`)
      } else {
        // Outros formatos (.docx, .xlsx…): apenas o nome
        lines.push(`- ${a.name}`)
      }
    })
  }

  const ctx = lines.join('\n')
  if (ctx.length > MAX_CONTEXT_CHARS) {
    return ctx.slice(0, MAX_CONTEXT_CHARS) + '\n\n[contexto truncado — projeto excede o limite de tamanho]'
  }
  return ctx
}

/**
 * Gera blocos nativos da API Anthropic para PDFs e imagens.
 * Esses blocos são inseridos na mensagem do usuário APÓS o contexto de texto,
 * permitindo que o Claude leia o conteúdo real dos arquivos.
 *
 * @param {Array} attachments — project.attachments[]
 * @returns {Array} — array de content blocks (document | image)
 */
export function buildAttachmentBlocks(attachments = []) {
  const blocks = []
  for (const a of attachments) {
    if (!a.data) continue
    const b64 = extractBase64(a.data)

    if (a.type === 'application/pdf' && b64.length <= MAX_PDF_B64) {
      blocks.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: b64 },
      })
    } else if (a.type?.startsWith('image/') && b64.length <= MAX_IMAGE_B64) {
      blocks.push({
        type: 'image',
        source: { type: 'base64', media_type: a.type, data: b64 },
      })
    }
  }
  return blocks
}

/**
 * Monta { system, messages } com cache_control para economia de tokens.
 *
 * Como funciona:
 * - O system prompt é marcado como ephemeral (cacheable por 5 min)
 * - O contexto do cliente também é marcado como ephemeral
 * - Blocos de PDF/imagem são inseridos APÓS o contexto (NÃO cacheados — dinâmicos)
 * - A instrução específica NÃO é cacheada (varia a cada geração)
 *
 * Economia real: a partir da 2ª geração no mesmo módulo/cliente na sessão,
 * o contexto + system custam apenas 10% do preço normal (cache hit).
 * Custo de escrita do cache: 125% — recuperado na 2ª leitura.
 *
 * @param {object} opts
 * @param {string} opts.systemPrompt  — system prompt do módulo (será cacheado)
 * @param {object} opts.project       — projeto (contexto será cacheado)
 * @param {string} opts.instruction   — instrução específica da geração (NÃO cacheada)
 * @returns {{ system: Array, messages: Array }}
 */
export function buildCachedPayload({ systemPrompt, project, instruction }) {
  const attBlocks = buildAttachmentBlocks(project.attachments)

  return {
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: buildContext(project),
            cache_control: { type: 'ephemeral' },
          },
          ...attBlocks,          // PDFs e imagens como blocos nativos (lidos pelo Claude)
          {
            type: 'text',
            text: instruction,
          },
        ],
      },
    ],
  }
}
