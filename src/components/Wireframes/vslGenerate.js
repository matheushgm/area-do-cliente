// ─── VSL — Geração estruturada da copy ────────────────────────────────────────
// A copy do VSL é gerada DIRETO no formato dos slots do wireframe (JSON), para que
// cada texto caia exatamente no seu lugar na página. Aqui ficam: o system prompt,
// o builder da instrução, o parser tolerante do JSON e a renderização em texto
// legível (usada na visão "texto" e no copiar).

import { VSL_WIREFRAME } from './vslSchema'

export const VSL_SYSTEM = `Você é um especialista em copy de alta conversão para páginas de VENDA ancoradas em vídeo (VSL — Video Sales Letter), usando a metodologia Revenue Lab.

Sua copy é agressiva, persuasiva e focada nas dores e sonhos do público, com o objetivo de maximizar conversão.

Você vai escrever a copy de UMA página VSL com a estrutura abaixo. Responda APENAS com um objeto JSON válido, sem texto antes ou depois, sem blocos de código (sem \`\`\`), exatamente neste formato:

{
  "announcement": "barra de aviso curta no topo (urgência/escassez) — máx 12 palavras",
  "headline": "headline principal da página: a promessa central da VSL. Use **negrito** em 1 a 3 palavras-chave para destaque",
  "subheadline": "subtítulo que reforça a promessa e o mecanismo único, 1 a 2 frases",
  "heroCta": "texto do botão principal abaixo do vídeo (ação clara) — máx 5 palavras",
  "forWhomTitle": "título da seção 'para quem é a oferta'",
  "cards": [
    { "title": "título curto do perfil/dor 1", "desc": "descrição em 1 frase" },
    { "title": "título curto do perfil/dor 2", "desc": "descrição em 1 frase" },
    { "title": "título curto do perfil/dor 3", "desc": "descrição em 1 frase" },
    { "title": "título curto do perfil/dor 4", "desc": "descrição em 1 frase" }
  ],
  "offerTitle": "título da seção de oferta/desconto",
  "offerText": "parágrafo curto apresentando a oferta e o desconto",
  "discountValue": "o valor do desconto em destaque (ex: 40%) — curto",
  "discountLabel": "rótulo do desconto (ex: de desconto)",
  "offerCta": "texto do botão da oferta — máx 4 palavras",
  "storyTitle": "título da seção de história/prova social (ex: Veja a história de quem já transformou ...)",
  "storyText": "história de sucesso/depoimento em prosa, 2 a 4 frases, com nome e resultado concreto",
  "opportunityTitle": "título da seção de preço (ex: Oportunidade única)",
  "bullets": ["benefício/entregável 1", "benefício/entregável 2", "benefício/entregável 3", "benefício/entregável 4"],
  "priceLabel": "linha acima do preço (ex: ou 12x de)",
  "price": "o preço em destaque (ex: R$ 49,90)",
  "priceSecondary": "linha abaixo do preço (ex: ou R$ 497 à vista)",
  "priceCta": "texto do botão de compra — máx 5 palavras",
  "testimonials": [
    { "name": "Nome", "role": "cargo/contexto curto", "text": "depoimento curto, 1 a 2 frases" },
    { "name": "Nome", "role": "cargo/contexto curto", "text": "depoimento curto, 1 a 2 frases" },
    { "name": "Nome", "role": "cargo/contexto curto", "text": "depoimento curto, 1 a 2 frases" }
  ]
}

Diretrizes obrigatórias:
- Português brasileiro persuasivo, direto e específico ao negócio. Nunca use frases genéricas ou de template.
- Use APENAS os dados do contexto (oferta matadora, produto/serviço, persona) e a direção criativa. NÃO invente dados de empresa, produtos ou números que não estejam no contexto.
- Quando houver oferta matadora, ela é a BASE: headline, oferta e bullets devem refletir diretamente essa oferta.
- Preço e depoimentos: se não houver dado no contexto, gere valores realistas e plausíveis como SUGESTÃO inicial — o designer/cliente vai ajustar depois. Não invente números de faturamento específicos sem base.
- Fale diretamente com o lead (use "você").
- Não use travessões (—) dentro dos textos.
- Responda SOMENTE o JSON. Nada de comentários, explicações ou markdown fora dos valores.`

// Monta a instrução final enviada ao modelo (direção criativa + base + pedido).
export function buildVslInstruction({ customNote, baseClause }) {
  const customSection = customNote?.trim()
    ? `\n## DIREÇÃO CRIATIVA\n${customNote.trim()}\n(Esta direção deve orientar toda a copy.)\n`
    : ''
  return `${customSection}
---

## SOLICITAÇÃO

Crie a copy COMPLETA de uma página VSL preenchendo todos os campos do JSON.${baseClause} Use APENAS as informações deste contexto e a direção criativa. Responda SOMENTE com o objeto JSON no formato especificado.`
}

// Parser tolerante: extrai o primeiro objeto JSON do texto (mesmo com cercas de
// código ou texto residual) e mescla com o shape vazio para garantir todos os slots.
export function parseVslContent(text) {
  const raw = String(text || '')
  let jsonStr = raw.trim()
  // Remove cercas de código se vierem
  jsonStr = jsonStr.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  // Recorta do primeiro { ao último }
  const start = jsonStr.indexOf('{')
  const end = jsonStr.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  jsonStr = jsonStr.slice(start, end + 1)
  let parsed
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    return null
  }
  // Mescla com o shape vazio (preserva slots faltantes e normaliza arrays)
  const base = VSL_WIREFRAME.emptyContent
  return {
    ...base,
    ...parsed,
    cards: normalizeArray(parsed.cards, base.cards, ['title', 'desc']),
    bullets: Array.isArray(parsed.bullets) && parsed.bullets.length ? parsed.bullets : base.bullets,
    testimonials: normalizeArray(parsed.testimonials, base.testimonials, ['name', 'role', 'text']),
  }
}

function normalizeArray(value, fallback, keys) {
  if (!Array.isArray(value) || !value.length) return fallback
  return value.map((item) => {
    const obj = {}
    keys.forEach((k) => { obj[k] = typeof item?.[k] === 'string' ? item[k] : '' })
    return obj
  })
}

// Renderiza a copy estruturada como texto legível (markdown leve) — usado na visão
// "texto" do card e no botão Copiar.
export function vslToText(content) {
  const c = { ...VSL_WIREFRAME.emptyContent, ...(content || {}) }
  const lines = []
  const push = (label, val) => { if (val?.trim?.()) lines.push(`**${label}:** ${val.trim()}`) }

  lines.push('## HERO')
  push('Barra de aviso', c.announcement)
  push('Headline', c.headline)
  push('Subtítulo', c.subheadline)
  push('CTA', c.heroCta)

  lines.push('\n## PARA QUEM É A OFERTA')
  push('Título', c.forWhomTitle)
  ;(c.cards || []).forEach((card, i) => {
    if (card.title?.trim() || card.desc?.trim()) {
      lines.push(`- **${card.title || `Card ${i + 1}`}** — ${card.desc || ''}`.trim())
    }
  })

  lines.push('\n## OFERTA')
  push('Título', c.offerTitle)
  push('Texto', c.offerText)
  push('Desconto', [c.discountValue, c.discountLabel].filter(Boolean).join(' '))
  push('CTA', c.offerCta)

  lines.push('\n## PROVA SOCIAL')
  push('Título', c.storyTitle)
  push('História', c.storyText)

  lines.push('\n## PREÇO')
  push('Título', c.opportunityTitle)
  ;(c.bullets || []).forEach((b) => { if (b?.trim()) lines.push(`- ${b.trim()}`) })
  push('Linha acima', c.priceLabel)
  push('Preço', c.price)
  push('Linha abaixo', c.priceSecondary)
  push('CTA', c.priceCta)

  lines.push('\n## DEPOIMENTOS')
  ;(c.testimonials || []).forEach((t, i) => {
    if (t.name?.trim() || t.text?.trim()) {
      lines.push(`- **${t.name || `Depoimento ${i + 1}`}** (${t.role || ''}): ${t.text || ''}`.trim())
    }
  })

  return lines.join('\n')
}
