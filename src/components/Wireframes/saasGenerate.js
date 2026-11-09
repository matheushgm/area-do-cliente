// ─── SaaS / Produto — geração estruturada da copy ─────────────────────────────
import { SAAS_WIREFRAME } from './saasSchema'
import { t } from '../../i18n'

// Rótulos da versão em texto (no idioma de quem está usando): wireframes.texto.* e wireframes.secao.*
const R = (k, vars) => t(`wireframes.texto.${k}`, vars)
const S = (k, quebra) => `${quebra ? '\n' : ''}## ${t(`wireframes.secao.${k}`).toUpperCase()}`

export const SAAS_SYSTEM = `Você é um especialista em copy de alta conversão para páginas de PRODUTO SaaS (software vendido por assinatura, com captura de e-mail para teste grátis ou cadastro na primeira dobra), usando a metodologia Revenue Lab.

Sua copy é persuasiva, específica e focada em fazer o visitante entender em segundos o que o software resolve e deixar o e-mail para começar a usar.

Diferença essencial para outras páginas: aqui você NÃO vende reunião nem agendamento, você vende o PRODUTO. O visitante precisa enxergar a ferramenta funcionando e sentir que começar é fácil e sem risco.

Você vai escrever a copy de UMA página de produto SaaS com a estrutura abaixo. Responda APENAS com um objeto JSON válido, sem texto antes ou depois, sem blocos de código (sem \`\`\`), exatamente neste formato:

{
  "navLinks": ["item de menu 1", "item de menu 2", "item de menu 3", "item de menu 4"],
  "navCta": "botão do menu (ex: Teste grátis)",
  "heroBadge": "selo curto do produto (ex: Sistema de gestão para clínicas)",
  "headline": "headline principal: a promessa central do produto. Use **negrito** em 1 a 3 palavras-chave",
  "heroSubheadline": "subheadline: o que o software faz, para quem, e o resultado que entrega",
  "heroFormPlaceholder": "placeholder do campo de e-mail (ex: Digite seu e-mail profissional)",
  "heroCta": "texto do botão do hero (ex: Começar grátis)",
  "heroImageCaption": "legenda curta do print do produto (ex: Painel de gestão da clínica)",
  "featuresEyebrow": "etiqueta curta da seção em MAIÚSCULAS (ex: DIFERENCIAIS)",
  "featuresTitle": "título dos diferenciais. Use **negrito** num trecho",
  "featuresSubtitle": "subtítulo dos diferenciais",
  "features": [
    { "title": "nome do diferencial 1", "desc": "o que ele resolve na prática 1" },
    { "title": "nome do diferencial 2", "desc": "o que ele resolve na prática 2" },
    { "title": "nome do diferencial 3", "desc": "o que ele resolve na prática 3" }
  ],
  "howEyebrow": "etiqueta curta da seção em MAIÚSCULAS (ex: COMO FUNCIONA)",
  "howTitle": "título dos recursos do produto. Use **negrito** num trecho",
  "howSubtitle": "subtítulo dos recursos",
  "howItems": [
    { "title": "nome do recurso 1", "desc": "o resultado que entrega 1" },
    { "title": "nome do recurso 2", "desc": "o resultado que entrega 2" },
    { "title": "nome do recurso 3", "desc": "o resultado que entrega 3" },
    { "title": "nome do recurso 4", "desc": "o resultado que entrega 4" },
    { "title": "nome do recurso 5", "desc": "o resultado que entrega 5" }
  ],
  "proofEyebrow": "etiqueta curta da seção em MAIÚSCULAS (ex: DEPOIMENTOS)",
  "proofTitle": "título da prova social",
  "proofSubtitle": "subtítulo da prova social",
  "testimonials": [
    { "metric": "número em destaque 1 (ex: 36 meses)", "metricLabel": "o que o número significa 1", "quote": "depoimento do cliente 1", "name": "nome de quem falou 1", "role": "cargo e empresa 1" },
    { "metric": "número em destaque 2", "metricLabel": "o que o número significa 2", "quote": "depoimento do cliente 2", "name": "nome de quem falou 2", "role": "cargo e empresa 2" }
  ],
  "midCtaTitle": "título do CTA intermediário",
  "midCtaText": "texto de apoio do CTA intermediário",
  "midCtaButton": "botão do CTA intermediário",
  "faqEyebrow": "etiqueta curta da seção em MAIÚSCULAS (ex: DÚVIDAS)",
  "faqTitle": "título do FAQ",
  "faqs": [
    { "q": "pergunta 1 que trava a decisão", "a": "resposta 1 que destrava" },
    { "q": "pergunta 2", "a": "resposta 2" },
    { "q": "pergunta 3", "a": "resposta 3" },
    { "q": "pergunta 4", "a": "resposta 4" },
    { "q": "pergunta 5", "a": "resposta 5" }
  ],
  "finalCtaTitle": "título do CTA final",
  "finalCtaSubtitle": "subtítulo do CTA final, de preferência com prova ou número",
  "finalCtaButton": "botão do CTA final",
  "footerTitle": "chamada curta do rodapé",
  "footerCta": "botão do rodapé"
}

Diretrizes obrigatórias:
- Português brasileiro persuasivo, direto e específico ao negócio. Nunca use frases genéricas ou de template.
- Venda RESULTADO, não funcionalidade. Todo recurso precisa vir com a consequência prática para quem usa.
- Use APENAS os dados do contexto (oferta matadora, produto/serviço, persona) e a direção criativa. NÃO invente números de faturamento nem cases sem base; quando não houver dado, gere exemplos plausíveis como SUGESTÃO inicial.
- Fale diretamente com o lead (use "você").
- O hero pede apenas o e-mail: a copy do botão precisa reduzir atrito (ex: "Começar grátis", não "Solicitar orçamento").
- Não use travessões (—) dentro dos textos.
- Responda SOMENTE o JSON.`

export function buildSaasInstruction({ customNote, baseClause }) {
  const customSection = customNote?.trim()
    ? `\n## DIREÇÃO CRIATIVA\n${customNote.trim()}\n(Esta direção deve orientar toda a copy.)\n`
    : ''
  return `${customSection}
---

## SOLICITAÇÃO

Crie a copy COMPLETA de uma página de produto SaaS preenchendo todos os campos do JSON.${baseClause} Use APENAS as informações deste contexto e a direção criativa. Responda SOMENTE com o objeto JSON no formato especificado.`
}

export function parseSaasContent(text) {
  let jsonStr = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const start = jsonStr.indexOf('{')
  const end = jsonStr.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  jsonStr = jsonStr.slice(start, end + 1)
  let parsed
  try { parsed = JSON.parse(jsonStr) } catch { return null }
  const base = SAAS_WIREFRAME.emptyContent
  const strArr = (v, fb) => (Array.isArray(v) && v.length ? v.map((x) => (typeof x === 'string' ? x : '')) : fb)
  const objArr = (v, fb, keys) => (Array.isArray(v) && v.length
    ? v.map((it) => Object.fromEntries(keys.map((k) => [k, typeof it?.[k] === 'string' ? it[k] : ''])))
    : fb)
  return {
    ...base,
    ...parsed,
    navLinks: strArr(parsed.navLinks, base.navLinks),
    features: objArr(parsed.features, base.features, ['title', 'desc']),
    howItems: objArr(parsed.howItems, base.howItems, ['title', 'desc']),
    testimonials: objArr(parsed.testimonials, base.testimonials, ['metric', 'metricLabel', 'quote', 'name', 'role']),
    faqs: objArr(parsed.faqs, base.faqs, ['q', 'a']),
  }
}

export function saasToText(content) {
  const c = { ...SAAS_WIREFRAME.emptyContent, ...(content || {}) }
  const L = []
  const push = (label, val) => { if (val?.trim?.()) L.push(`**${label}:** ${val.trim()}`) }

  L.push(S('nav'))
  push(R('menu'), (c.navLinks || []).filter(Boolean).join(', '))
  push(R('ctaMenu'), c.navCta)

  L.push(S('hero', true))
  push(R('selo'), c.heroBadge)
  push(R('headline'), c.headline)
  push(R('subheadline'), c.heroSubheadline)
  push(R('campo'), c.heroFormPlaceholder)
  push(R('cta'), c.heroCta)
  push(R('legendaPrint'), c.heroImageCaption)

  L.push(S('diferenciais', true))
  push(R('etiqueta'), c.featuresEyebrow)
  push(R('titulo'), c.featuresTitle)
  push(R('subtitulo'), c.featuresSubtitle)
  ;(c.features || []).forEach((f) => {
    if (f.title?.trim() || f.desc?.trim()) L.push(`- ${f.title || ''}: ${f.desc || ''}`.trim())
  })

  L.push(S('recursos', true))
  push(R('etiqueta'), c.howEyebrow)
  push(R('titulo'), c.howTitle)
  push(R('subtitulo'), c.howSubtitle)
  ;(c.howItems || []).forEach((h, i) => {
    if (h.title?.trim() || h.desc?.trim()) L.push(`- ${R('recurso', { n: i + 1 })}: ${h.title || ''}: ${h.desc || ''}`.trim())
  })

  L.push(S('provaSocial', true))
  push(R('etiqueta'), c.proofEyebrow)
  push(R('titulo'), c.proofTitle)
  push(R('subtitulo'), c.proofSubtitle)
  ;(c.testimonials || []).forEach((d) => {
    if (d.quote?.trim() || d.metric?.trim()) {
      L.push(`- ${d.metric || ''} (${d.metricLabel || ''}): "${d.quote || ''}" ${d.name || ''}, ${d.role || ''}`.trim())
    }
  })

  L.push(S('ctaIntermediario', true))
  push(R('titulo'), c.midCtaTitle)
  push(R('texto'), c.midCtaText)
  push(R('botao'), c.midCtaButton)

  L.push(S('faq', true))
  push(R('etiqueta'), c.faqEyebrow)
  push(R('titulo'), c.faqTitle)
  ;(c.faqs || []).forEach((f) => {
    if (f.q?.trim() || f.a?.trim()) L.push(`- ${f.q || ''} → ${f.a || ''}`.trim())
  })

  L.push(S('ctaFinal', true))
  push(R('titulo'), c.finalCtaTitle)
  push(R('subtitulo'), c.finalCtaSubtitle)
  push(R('botao'), c.finalCtaButton)

  L.push(S('rodape', true))
  push(R('chamada'), c.footerTitle)
  push(R('botao'), c.footerCta)

  return L.join('\n')
}
