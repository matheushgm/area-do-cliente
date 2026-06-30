// ─── Webinar — geração estruturada da copy ────────────────────────────────────
import { WEBINAR_WIREFRAME } from './webinarSchema'

export const WEBINAR_SYSTEM = `Você é um especialista em copy de alta conversão para páginas de captação de REUNIÃO/WEBINAR (agendamento de reunião estratégica), usando a metodologia Revenue Lab.

Sua copy é persuasiva, específica e focada em levar o lead qualificado a preencher o formulário e agendar a reunião.

Você vai escrever a copy de UMA página de captação de webinar/reunião com a estrutura abaixo. Responda APENAS com um objeto JSON válido, sem texto antes ou depois, sem blocos de código (sem \`\`\`), exatamente neste formato:

{
  "heroBadge": "selo curto do método (ex: Metodologia de agendamento de reunião qualificada)",
  "headline": "headline principal: a promessa central. Use **negrito** em 1 a 3 palavras-chave",
  "heroBullets": ["benefício/objeção curto 1", "benefício/objeção curto 2", "benefício/objeção curto 3"],
  "heroCta": "texto do botão principal do hero",
  "heroGuarantee": "selo de garantia curto (ex: Garantia blindada)",
  "heroTags": ["tag curta 1", "tag curta 2", "tag curta 3"],
  "heroMetricLabel": "rótulo do card de métrica (ex: Reuniões qualificadas)",
  "heroMetricValue": "número de destaque (ex: +4x na agenda)",
  "heroMetricSub": "complemento do número (ex: em menos de 60 dias)",
  "painsTitle": "título da seção de dores (pergunta)",
  "painsSubtitle": "subtítulo da seção de dores",
  "pains": [
    { "pain": "dor 1 em forma de pergunta", "solution": "solução específica para a dor 1" },
    { "pain": "dor 2 em forma de pergunta", "solution": "solução específica para a dor 2" },
    { "pain": "dor 3 em forma de pergunta", "solution": "solução específica para a dor 3" }
  ],
  "comparisonTitle": "título do comparativo sem × com",
  "withoutTitle": "título da coluna negativa (ex: Sua empresa sem método)",
  "without": ["ponto negativo 1", "ponto negativo 2", "ponto negativo 3", "ponto negativo 4", "ponto negativo 5"],
  "withTitle": "título da coluna positiva (ex: Com a metodologia)",
  "with": ["ponto positivo 1", "ponto positivo 2", "ponto positivo 3", "ponto positivo 4", "ponto positivo 5"],
  "authorityTitle": "título de autoridade (use **negrito** num trecho)",
  "authorityText": "parágrafo de autoridade e posicionamento",
  "authorityCaption": "legenda curta da imagem de prova",
  "resultsTitle": "título dos cases (ex: Resultados reais que entregamos)",
  "results": [
    { "value": "número/resultado do case 1 (ex: R$100k → R$500k)", "desc": "descrição curta do case 1" },
    { "value": "número/resultado do case 2", "desc": "descrição curta do case 2" },
    { "value": "número/resultado do case 3", "desc": "descrição curta do case 3" }
  ],
  "methodTitle": "título do que o lead recebe na reunião (use **negrito** num trecho)",
  "methodSubtitle": "subtítulo do método",
  "steps": [
    { "tag": "etiqueta curta (ex: Na reunião)", "title": "título do passo 1", "desc": "descrição do passo 1" },
    { "tag": "etiqueta curta (ex: O caminho)", "title": "título do passo 2", "desc": "descrição do passo 2" },
    { "tag": "etiqueta curta (ex: Provas reais)", "title": "título do passo 3", "desc": "descrição do passo 3" },
    { "tag": "etiqueta curta (ex: Próximo passo)", "title": "título do passo 4", "desc": "descrição do passo 4" }
  ],
  "objectionsTitle": "título da seção de objeções",
  "objections": [
    { "objection": "objeção 1 entre aspas", "rebuttal": "quebra da objeção 1" },
    { "objection": "objeção 2 entre aspas", "rebuttal": "quebra da objeção 2" },
    { "objection": "objeção 3 entre aspas", "rebuttal": "quebra da objeção 3" }
  ],
  "ctaTitle": "título do formulário final",
  "ctaSubtitle": "subtítulo do formulário (critério de qualificação)",
  "formCta": "texto do botão de envio do formulário",
  "footerNote": "texto curto de rodapé"
}

Diretrizes obrigatórias:
- Português brasileiro persuasivo, direto e específico ao negócio. Nunca use frases genéricas ou de template.
- Use APENAS os dados do contexto (oferta matadora, produto/serviço, persona) e a direção criativa. NÃO invente números de faturamento ou cases específicos sem base; quando não houver dado, gere exemplos plausíveis como SUGESTÃO inicial.
- Fale diretamente com o lead (use "você").
- Não use travessões (—) dentro dos textos.
- Responda SOMENTE o JSON.`

export function buildWebinarInstruction({ customNote, baseClause }) {
  const customSection = customNote?.trim()
    ? `\n## DIREÇÃO CRIATIVA\n${customNote.trim()}\n(Esta direção deve orientar toda a copy.)\n`
    : ''
  return `${customSection}
---

## SOLICITAÇÃO

Crie a copy COMPLETA de uma página de captação de webinar/reunião preenchendo todos os campos do JSON.${baseClause} Use APENAS as informações deste contexto e a direção criativa. Responda SOMENTE com o objeto JSON no formato especificado.`
}

export function parseWebinarContent(text) {
  let jsonStr = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const start = jsonStr.indexOf('{')
  const end = jsonStr.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  jsonStr = jsonStr.slice(start, end + 1)
  let parsed
  try { parsed = JSON.parse(jsonStr) } catch { return null }
  const base = WEBINAR_WIREFRAME.emptyContent
  const strArr = (v, fb) => (Array.isArray(v) && v.length ? v.map((x) => (typeof x === 'string' ? x : '')) : fb)
  const objArr = (v, fb, keys) => (Array.isArray(v) && v.length
    ? v.map((it) => Object.fromEntries(keys.map((k) => [k, typeof it?.[k] === 'string' ? it[k] : ''])))
    : fb)
  return {
    ...base,
    ...parsed,
    heroBullets: strArr(parsed.heroBullets, base.heroBullets),
    heroTags: strArr(parsed.heroTags, base.heroTags),
    without: strArr(parsed.without, base.without),
    with: strArr(parsed.with, base.with),
    pains: objArr(parsed.pains, base.pains, ['pain', 'solution']),
    results: objArr(parsed.results, base.results, ['value', 'desc']),
    steps: objArr(parsed.steps, base.steps, ['tag', 'title', 'desc']),
    objections: objArr(parsed.objections, base.objections, ['objection', 'rebuttal']),
  }
}

export function webinarToText(content) {
  const c = { ...WEBINAR_WIREFRAME.emptyContent, ...(content || {}) }
  const L = []
  const push = (label, val) => { if (val?.trim?.()) L.push(`**${label}:** ${val.trim()}`) }

  L.push('## HERO')
  push('Selo', c.heroBadge)
  push('Headline', c.headline)
  ;(c.heroBullets || []).forEach((b) => { if (b?.trim()) L.push(`- ${b.trim()}`) })
  push('CTA', c.heroCta)
  push('Garantia', c.heroGuarantee)
  push('Tags', (c.heroTags || []).filter(Boolean).join(', '))
  push('Métrica', [c.heroMetricValue, c.heroMetricLabel, c.heroMetricSub].filter(Boolean).join(' · '))

  L.push('\n## DORES & SOLUÇÕES')
  push('Título', c.painsTitle)
  push('Subtítulo', c.painsSubtitle)
  ;(c.pains || []).forEach((p, i) => {
    if (p.pain?.trim() || p.solution?.trim()) L.push(`- Dor ${i + 1}: ${p.pain || ''} → ${p.solution || ''}`.trim())
  })

  L.push('\n## SEM × COM')
  push('Título', c.comparisonTitle)
  push('Coluna negativa', c.withoutTitle)
  ;(c.without || []).forEach((x) => { if (x?.trim()) L.push(`- (sem) ${x.trim()}`) })
  push('Coluna positiva', c.withTitle)
  ;(c.with || []).forEach((x) => { if (x?.trim()) L.push(`- (com) ${x.trim()}`) })

  L.push('\n## AUTORIDADE & PROVA')
  push('Título', c.authorityTitle)
  push('Texto', c.authorityText)
  push('Legenda', c.authorityCaption)
  push('Cases', c.resultsTitle)
  ;(c.results || []).forEach((r) => {
    if (r.value?.trim() || r.desc?.trim()) L.push(`- ${r.value || ''}: ${r.desc || ''}`.trim())
  })

  L.push('\n## O QUE RECEBE NA REUNIÃO')
  push('Título', c.methodTitle)
  push('Subtítulo', c.methodSubtitle)
  ;(c.steps || []).forEach((s, i) => {
    if (s.title?.trim() || s.desc?.trim()) L.push(`- Passo ${i + 1} (${s.tag || ''}): ${s.title || ''} — ${s.desc || ''}`.trim())
  })

  L.push('\n## OBJEÇÕES')
  push('Título', c.objectionsTitle)
  ;(c.objections || []).forEach((o) => {
    if (o.objection?.trim() || o.rebuttal?.trim()) L.push(`- "${o.objection || ''}" → ${o.rebuttal || ''}`.trim())
  })

  L.push('\n## FORMULÁRIO / CTA FINAL')
  push('Título', c.ctaTitle)
  push('Subtítulo', c.ctaSubtitle)
  push('CTA', c.formCta)
  push('Rodapé', c.footerNote)

  return L.join('\n')
}
