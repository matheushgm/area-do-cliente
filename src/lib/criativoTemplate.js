// Helpers puros pra extrair campos (headline/sub/cta) de uma copy
// markdown gerada no CriativosModule, e pra aplicar esses campos
// nos placeholders dos templates HTML.

const PLACEHOLDER_RE = /\{\{\s*([A-Z_]+)\s*\}\}/g

/**
 * Extrai headline, subheadline, body e CTA da copy markdown de um criativo.
 * O conteúdo gerado pela IA hoje vem com seções como:
 *   OPÇÃO 1 DE HEADLINE
 *   ## SUBHEADLINE
 *   ## COPY (corpo do anúncio)
 *   ## CTA
 *
 * Esta função é tolerante: se não encontrar uma seção, retorna ''.
 * @param {object} creative — objeto vindo de project.creatives[]
 * @returns {{ headline:string, subheadline:string, body:string, cta:string }}
 */
export function parseCreativeForFields(creative) {
  const content = String(creative?.content || '')
  // 1) Pega apenas o primeiro "anúncio" (separados por linha com `---`)
  const firstChunk = content.split(/\n-{3,}\n/)[0] || content

  const headline    = extractFirstHeadline(firstChunk)
  const subheadline = extractSection(firstChunk, ['SUBHEADLINE', 'SUB-HEADLINE', 'SUB HEADLINE'])
  const body        = extractSection(firstChunk, ['COPY', 'CORPO', 'BODY', 'TEXTO'])
  const cta         = extractSection(firstChunk, ['CTA', 'CHAMADA PRA AÇÃO', 'CHAMADA PARA AÇÃO'])
  return { headline, subheadline, body, cta }
}

// Procura por algo como "OPÇÃO 1 DE HEADLINE" ou "## HEADLINE" e pega
// a primeira linha não vazia que não seja um header.
function extractFirstHeadline(text) {
  const lines = text.split('\n')
  // Estratégia 1: encontra um header de headline e retorna a próxima linha
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim()
    if (/HEADLINE/i.test(l) && /(OPÇÃO\s*1|HEADLINE\s*1|^#{1,3}\s*HEADLINE|^HEADLINE)/i.test(l)) {
      for (let j = i + 1; j < lines.length; j++) {
        const nx = lines[j].trim().replace(/^[*\-•>"]+\s*/, '').replace(/^[*_]+(.+?)[*_]+$/, '$1')
        if (nx && !nx.startsWith('#') && !/^(OPÇÃO|SUBHEADLINE|CTA|COPY|CORPO)/i.test(nx)) {
          return clean(nx)
        }
      }
    }
  }
  // Estratégia 2: primeira frase razoável (linha não-vazia, não-header)
  for (const raw of lines) {
    const l = raw.trim().replace(/^[#*\-•>"]+\s*/, '').replace(/^[*_]+(.+?)[*_]+$/, '$1')
    if (l && l.length > 4 && l.length < 200 && !/^(OPÇÃO|SUBHEADLINE|CTA|COPY|CORPO|HEADLINE)/i.test(l)) {
      return clean(l)
    }
  }
  return ''
}

function extractSection(text, labels) {
  const lines = text.split('\n')
  const labelRe = new RegExp(`^[#*\\s>"]*(?:OPÇÃO\\s*\\d+\\s*(?:DE)?\\s*)?(?:${labels.join('|')})\\b`, 'i')
  for (let i = 0; i < lines.length; i++) {
    if (labelRe.test(lines[i])) {
      // pega as próximas linhas até o próximo header ou linha vazia dupla
      const out = []
      for (let j = i + 1; j < lines.length; j++) {
        const l = lines[j]
        if (/^[#*]{1,3}\s|^OPÇÃO\b|^SUBHEADLINE|^HEADLINE|^CTA\b|^COPY\b|^CORPO\b|^TEXTO\b/i.test(l.trim())) break
        if (l.trim() === '' && out.length > 0) break
        if (l.trim() !== '') out.push(l.trim().replace(/^[*\-•>"]+\s*/, '').replace(/^[*_]+(.+?)[*_]+$/, '$1'))
      }
      return clean(out.join(' '))
    }
  }
  return ''
}

function clean(s) {
  return String(s || '').replace(/\s+/g, ' ').replace(/[*_`]+/g, '').trim()
}

/**
 * Aplica os campos no template HTML substituindo placeholders {{KEY}}.
 * Campos sem valor caem no `defaults` (ou string vazia).
 * @param {string} html
 * @param {object} fields  - { headline, subheadline, cta, brandColor, companyName }
 */
export function applyTemplatePlaceholders(html, fields = {}) {
  const map = {
    HEADLINE:     escapeHtml(fields.headline     || ''),
    SUBHEADLINE:  escapeHtml(fields.subheadline  || ''),
    CTA:          escapeHtml(fields.cta          || 'Saiba mais'),
    BRAND_COLOR:  String(fields.brandColor || '#000000'),
    COMPANY_NAME: escapeHtml(fields.companyName || ''),
  }
  return String(html).replace(PLACEHOLDER_RE, (_, key) =>
    Object.prototype.hasOwnProperty.call(map, key) ? map[key] : ''
  )
}

// Escapa HTML pra evitar quebrar o template com aspas/tags inline.
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
