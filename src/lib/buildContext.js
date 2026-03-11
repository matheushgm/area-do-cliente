/**
 * buildContext.js — Context builder compartilhado entre módulos de IA
 *
 * Textos gerados pela IA (generatedOffer, generatedProfile) são truncados
 * para evitar reenvio desnecessário de tokens. Os dados estruturais
 * da oferta (campos individuais) são enviados completos — eles são curtos
 * e relevantes para qualquer geração.
 */

// Limites de truncamento (caracteres)
const MAX_OFFER_TEXT  = 800  // generatedOffer pode ter 3.000-4.000 chars; só o início é necessário
const MAX_PERSONA_BIO = 600  // generatedProfile por persona

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
      if (p.generatedProfile) {
        const txt = p.generatedProfile.length > MAX_PERSONA_BIO
          ? p.generatedProfile.slice(0, MAX_PERSONA_BIO) + '…'
          : p.generatedProfile
        lines.push(`\nPerfil:\n${txt}`)
      }
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
    if (o.generatedOffer) {
      // Truncado: os campos estruturais acima já contêm o essencial
      const txt = o.generatedOffer.length > MAX_OFFER_TEXT
        ? o.generatedOffer.slice(0, MAX_OFFER_TEXT) + '…'
        : o.generatedOffer
      lines.push(`\nOferta (resumo):\n${txt}`)
    }
  }

  const atts = project.attachments || []
  if (atts.length) {
    lines.push('\n## DOCUMENTOS DO CLIENTE')
    atts.forEach((a) => lines.push(`- ${a.name}`))
  }

  return lines.join('\n')
}

/**
 * Monta { system, messages } com cache_control para economia de tokens.
 *
 * Como funciona:
 * - O system prompt é marcado como ephemeral (cacheable por 5 min)
 * - O contexto do cliente também é marcado como ephemeral
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
          {
            type: 'text',
            text: instruction,
          },
        ],
      },
    ],
  }
}
