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

  const headline = extractFirstHeadline(firstChunk)
  // SUBHEADLINE — vários formatos comuns
  let subheadline = extractSection(firstChunk, [
    'HEADLINE SECUND[ÁA]RIA', 'HEADLINE 2',
    'SUBHEADLINE', 'SUB-HEADLINE', 'SUB HEADLINE',
  ])
  // Body / copy — usado tanto pra preencher um campo separado quanto como
  // fallback de subheadline em criativos sem secundária explícita
  const body = extractSection(firstChunk, [
    'COPY COMPLEMENTAR', 'COPY', 'CORPO DO AN[ÚU]NCIO', 'CORPO', 'BODY', 'TEXTO',
  ])
  // Se não encontrou subheadline mas tem corpo, usa o corpo como subheadline
  // (mais substancioso pra renderizar em templates visuais como o Tweet)
  if (!subheadline && body) subheadline = body

  const cta = extractSection(firstChunk, [
    'CALL[- ]TO[- ]ACTION', 'CHAMADA PRA A[ÇC][ÃA]O', 'CHAMADA PARA A[ÇC][ÃA]O', 'CTA',
  ])

  return { headline, subheadline, body, cta }
}

// Procura pela primeira "headline principal" do criativo. Aceita vários
// formatos: "HEADLINE PRINCIPAL:", "OPÇÃO 1 DE HEADLINE", "HEADLINE 1",
// "## HEADLINE", etc. Quando encontra um header, retorna o que vem depois
// (mesma linha após ":" ou a próxima linha não-header).
function extractFirstHeadline(text) {
  const lines = text.split('\n')
  // Estratégia 1: header inline com valor após `:` na MESMA linha
  // Ex: "HEADLINE PRINCIPAL: Seu SaaS pode ter 3-5 reuniões..."
  for (const raw of lines) {
    const m = raw.match(/^[#*\s>"]*(?:HEADLINE\s*PRINCIPAL|HEADLINE\s*1|OPÇÃO\s*1\s*(?:DE)?\s*HEADLINE)\s*:\s*(.+)$/i)
    if (m && m[1].trim()) return clean(m[1])
  }
  // Estratégia 2: header sozinho, valor na próxima linha
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim()
    if (/HEADLINE/i.test(l) && /(OPÇÃO\s*1|HEADLINE\s*PRINCIPAL|HEADLINE\s*1|^#{1,3}\s*HEADLINE|^HEADLINE\s*[:$])/i.test(l)) {
      for (let j = i + 1; j < lines.length; j++) {
        const nx = lines[j].trim().replace(/^[*\-•>"]+\s*/, '').replace(/^[*_]+(.+?)[*_]+$/, '$1')
        if (nx && !nx.startsWith('#') && !/^(OPÇÃO|SUBHEADLINE|HEADLINE|CTA|COPY|CORPO|CALL[- ]TO)/i.test(nx)) {
          return clean(nx)
        }
      }
    }
  }
  // Estratégia 3: primeira frase razoável (linha não-vazia, não-header)
  for (const raw of lines) {
    const l = raw.trim().replace(/^[#*\-•>"]+\s*/, '').replace(/^[*_]+(.+?)[*_]+$/, '$1')
    if (l && l.length > 4 && l.length < 200 && !/^(OPÇÃO|SUBHEADLINE|CTA|COPY|CORPO|HEADLINE|CALL[- ]TO|ELEMENTOS|ANÚNCIO|AN[UÚ]NCIO)/i.test(l)) {
      return clean(l)
    }
  }
  return ''
}

function extractSection(text, labels) {
  const lines = text.split('\n')
  const labelGroup = `(?:${labels.join('|')})`
  // Match com valor inline (após `:`) — captura o resto da linha
  const inlineRe = new RegExp(`^[#*\\s>"]*(?:OPÇÃO\\s*\\d+\\s*(?:DE)?\\s*)?${labelGroup}\\s*:\\s*(.+)$`, 'i')
  // Match sem valor inline (header sozinho)
  const headerRe = new RegExp(`^[#*\\s>"]*(?:OPÇÃO\\s*\\d+\\s*(?:DE)?\\s*)?${labelGroup}\\s*:?\\s*$`, 'i')
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(inlineRe)
    if (m && m[1] && m[1].trim()) {
      // Valor já tá na mesma linha — mas pode continuar nas próximas linhas
      // até o próximo header
      const out = [m[1].trim()]
      for (let j = i + 1; j < lines.length; j++) {
        const l = lines[j]
        if (/^[#*]{1,3}\s|^OPÇÃO\b|^SUBHEADLINE|^HEADLINE|^CTA\b|^COPY\b|^CORPO\b|^TEXTO\b|^CALL[- ]TO|^ELEMENTOS\b|^AN[UÚ]NCIO\b/i.test(l.trim())) break
        if (l.trim() === '' && out.length > 0) break
        if (l.trim() !== '') out.push(l.trim().replace(/^[*\-•>"]+\s*/, '').replace(/^[*_]+(.+?)[*_]+$/, '$1'))
      }
      return clean(out.join(' '))
    }
    if (headerRe.test(lines[i])) {
      // Header sozinho — pega as próximas linhas até o próximo header
      const out = []
      for (let j = i + 1; j < lines.length; j++) {
        const l = lines[j]
        if (/^[#*]{1,3}\s|^OPÇÃO\b|^SUBHEADLINE|^HEADLINE|^CTA\b|^COPY\b|^CORPO\b|^TEXTO\b|^CALL[- ]TO|^ELEMENTOS\b|^AN[UÚ]NCIO\b/i.test(l.trim())) break
        if (l.trim() === '' && out.length > 0) break
        if (l.trim() !== '') out.push(l.trim().replace(/^[*\-•>"]+\s*/, '').replace(/^[*_]+(.+?)[*_]+$/, '$1'))
      }
      if (out.length > 0) return clean(out.join(' '))
    }
  }
  return ''
}

function clean(s) {
  return String(s || '').replace(/\s+/g, ' ').replace(/[*_`]+/g, '').trim()
}

/**
 * Aplica os campos no template HTML substituindo placeholders {{KEY}}.
 *
 * Suporte além da substituição literal:
 *  - **negrito** vira <strong>negrito</strong>
 *  - *itálico*  vira <em>itálico</em>
 *  - quebras de linha (\n) viram <br>
 *  - Derivados automáticos: {{INITIALS}} (2 primeiras letras),
 *    {{HANDLE}} (slug do companyName)
 *
 * @param {string} html
 * @param {object} fields  - { headline, subheadline, cta, brandColor, companyName }
 */
export function applyTemplatePlaceholders(html, fields = {}) {
  const company = String(fields.companyName || '')
  const initials = company
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || 'C'
  const handle = company
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24) || 'empresa'

  const map = {
    HEADLINE:     renderRich(fields.headline    || ''),
    SUBHEADLINE:  renderRich(fields.subheadline || ''),
    CTA:          renderRich(fields.cta         || 'Saiba mais'),
    BRAND_COLOR:  String(fields.brandColor || '#000000'),
    COMPANY_NAME: escapeHtml(company),
    INITIALS:     escapeHtml(initials),
    HANDLE:       escapeHtml(handle),
  }
  return String(html).replace(PLACEHOLDER_RE, (_, key) =>
    Object.prototype.hasOwnProperty.call(map, key) ? map[key] : ''
  )
}

// Render rich: escape HTML, então aplica **negrito**, *itálico* e \n→<br>.
// Ordem importa: escape primeiro pra não introduzir tags via input do user;
// como asterisco e quebra-de-linha não são chars especiais HTML, passam intactos.
function renderRich(s) {
  let out = escapeHtml(s)
  out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
  out = out.replace(/\n/g, '<br>')
  return out
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
