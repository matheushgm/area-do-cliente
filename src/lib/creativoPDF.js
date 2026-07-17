import { jsPDF } from 'jspdf'

// ─── Verta design tokens ──────────────────────────────────────────────────────
// Sistema monocromático azul + neutros frios (Design system verta). Azul-marca
// #2A25F0 é a única cor "alta"; todo o resto é ink ou papel. Sem arco-íris.
// Tipografia da marca é Sora/Manrope, mas o jsPDF só tem fontes base — usamos
// helvetica como substituta (não há binários .ttf para embutir).
const C = {
  // rampa de azul (amostrada do símbolo em gradiente)
  blue50:  [238, 241, 254],
  blue100: [220, 226, 254],
  blue300: [143, 166, 255],
  blue400: [ 81, 140, 255],
  blue600: [ 42,  37, 240],   // PRIMARY — azul da marca
  blue700: [ 24,   0, 219],
  blue800: [ 20,   4, 156],
  blue900: [ 10,   2, 112],
  blue950: [  7,   2,  48],   // navy quase-preto (canvas invertido)
  // neutros frios
  ink900:  [ 11,  11,  20],   // fg
  ink700:  [ 61,  66,  84],   // fg-muted
  ink500:  [118, 124, 142],   // fg-subtle
  ink300:  [194, 198, 210],
  ink200:  [228, 231, 240],   // border
  ink100:  [242, 244, 250],   // surface suave
  ink50:   [248, 249, 252],
  white:   [255, 255, 255],
  // aliases semânticos usados no corpo
  text:    [ 11,  11,  20],
  muted:   [ 61,  66,  84],
  subtle:  [118, 124, 142],
  border:  [228, 231, 240],
  surface: [242, 244, 250],
  navyCard:[ 16,  10,  74],   // superfície elevada sobre o navy
}

const PW = 210
const PH = 297
const ML = 18
const MR = 18
const CW = PW - ML - MR

// ─── Sanitização de texto ─────────────────────────────────────────────────────
// As fontes base do jsPDF (helvetica/WinAnsi) não têm glifos de emoji: eles saem
// como lixo ("Ø=Üý"). O design system Verta também proíbe emoji. Então removemos
// emojis e normalizamos tipográficos que a fonte base não cobre.
function sanitize(str) {
  if (str == null) return ''
  return String(str)
    .replace(/[‘’‚‛]/g, "'")     // aspas simples curvas
    .replace(/[“”„‟]/g, '"')     // aspas duplas curvas
    .replace(/[–—]/g, '-')                 // en/em dash → hífen
    .replace(/…/g, '...')                       // reticências
    .replace(/[→➔➡⇾]/g, '»')     // setas → chevron (existe no WinAnsi)
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, '')        // tudo fora de Latin-1 (emoji, símbolos, CJK)
    .replace(/[ \t]{2,}/g, ' ')
    .trimEnd()
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setFill(doc, c)  { doc.setFillColor(...c) }
function setDraw(doc, c)  { doc.setDrawColor(...c) }
function setColor(doc, c) { doc.setTextColor(...c) }

function rect(doc, x, y, w, h, color) {
  setFill(doc, color)
  doc.rect(x, y, w, h, 'F')
}

function roundRect(doc, x, y, w, h, r, color, border = null) {
  setFill(doc, color)
  if (border) {
    setDraw(doc, border)
    doc.setLineWidth(0.3)
    doc.roundedRect(x, y, w, h, r, r, 'FD')
  } else {
    doc.roundedRect(x, y, w, h, r, r, 'F')
  }
}

function hline(doc, x1, y1, x2, lw = 0.25, color = C.border) {
  doc.setLineWidth(lw)
  setDraw(doc, color)
  doc.line(x1, y1, x2, y1)
}

// Wrapped text — returns new y after last line
function wtext(doc, str, x, y, { color = C.text, size = 9, bold = false, maxW = CW, align = 'left' } = {}) {
  const clean = sanitize(str)
  if (!clean) return y
  setColor(doc, color)
  doc.setFontSize(size)
  doc.setFont('helvetica', bold ? 'bold' : 'normal')
  const lh = size * 0.37       // line-height in mm
  const lines = doc.splitTextToSize(clean, maxW)
  lines.forEach((line, i) => {
    if (i > 0) y += lh + 0.8
    doc.text(line, x, y, align !== 'left' ? { align } : undefined)
  })
  return y + lh + 1.2          // bottom of last line + gap
}

function checkPage(doc, y, needed = 16) {
  if (y + needed > PH - 16) {
    doc.addPage()
    return 22
  }
  return y
}

// ─── Cover page ───────────────────────────────────────────────────────────────

function drawCover(doc, { companyName, type, adTypeLabels, quantity, customNote, today }) {
  rect(doc, 0, 0, PW, PH, C.blue950)
  rect(doc, 0, 0, PW, 2.5, C.blue600)

  // Logo / wordmark
  roundRect(doc, ML, 28, 14, 14, 3, C.blue600)
  setColor(doc, C.white)
  doc.setFontSize(12); doc.setFont('helvetica', 'bold')
  doc.text('V', ML + 7, 37.5, { align: 'center' })
  wtext(doc, 'Verta',             ML + 19, 33,   { color: C.white,  size: 14, bold: true })
  wtext(doc, 'Ferramenta interna', ML + 19, 38.5, { color: C.blue300, size: 8 })

  // Hero
  wtext(doc, 'Criativos', ML, 80, { color: C.blue300, size: 26 })
  const typeLabel = type === 'video' ? 'de vídeo' : 'estáticos'
  wtext(doc, typeLabel, ML, 95, { color: C.white, size: 38, bold: true })

  hline(doc, ML, 107, PW - MR, 0.3, [40, 40, 90])

  wtext(doc, 'Anúncios gerados com IA — Verta', ML, 117, { color: C.blue300, size: 10.5 })

  // Info card
  roundRect(doc, ML, 134, CW, 60, 4, C.navyCard)

  wtext(doc, 'CLIENTE', ML + 10, 146, { color: C.blue300, size: 7, bold: true })
  wtext(doc, companyName || 'Cliente', ML + 10, 153, { color: C.white, size: 16, bold: true })

  hline(doc, ML + 10, 158, ML + CW - 10, 0.25, [40, 40, 90])

  const stats = [
    { label: 'TIPO',       value: type === 'video' ? 'Vídeo (roteiro)' : 'Estático (imagem)' },
    { label: 'QUANTIDADE', value: `${quantity} criativo${quantity !== 1 ? 's' : ''}` },
  ]
  const sw = (CW - 20) / 2
  stats.forEach((s, i) => {
    const sx = ML + 10 + i * sw
    wtext(doc, s.label, sx, 167, { color: C.blue300, size: 7, bold: true })
    wtext(doc, s.value,  sx, 174, { color: C.white, size: 10, bold: true })
  })

  // Types chips area
  wtext(doc, 'TIPOS DE ANÚNCIO', ML + 10, 184, { color: C.blue300, size: 7, bold: true })
  const labelsStr = (adTypeLabels || []).join(' · ')
  wtext(doc, labelsStr || '—', ML + 10, 189, { color: C.blue100, size: 8, maxW: CW - 20 })

  if (customNote) {
    wtext(doc, 'DIREÇÃO CRIATIVA', ML + 10, 198, { color: C.blue300, size: 7, bold: true })
    wtext(doc, `"${customNote}"`, ML + 10, 203, { color: C.blue100, size: 8, maxW: CW - 20 })
  }

  wtext(doc, `Gerado em ${today}`, PW / 2, PH - 14, { color: C.blue300, size: 8, align: 'center' })
  wtext(doc, 'Confidencial — uso exclusivo', PW / 2, PH - 9, { color: [90, 90, 140], size: 7.5, align: 'center' })
}

// ─── Page header ─────────────────────────────────────────────────────────────

function drawPageHeader(doc, title, subtitle) {
  rect(doc, 0, 0, PW, 16, C.blue600)
  rect(doc, 0, 16, PW, 0.8, C.blue400)
  wtext(doc, title, ML, 10.5, { color: C.white, size: 11, bold: true })
  if (subtitle) wtext(doc, subtitle, PW - MR, 10.5, { color: C.blue100, size: 8, align: 'right', maxW: 80 })
  return 24
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function addFooters(doc, total, companyName, today) {
  for (let i = 2; i <= total; i++) {
    doc.setPage(i)
    hline(doc, ML, PH - 12, PW - MR)
    wtext(doc, `Verta × ${companyName}`,  ML,       PH - 7, { color: C.subtle, size: 7 })
    wtext(doc, today,                     PW / 2,   PH - 7, { color: C.subtle, size: 7, align: 'center', maxW: 80 })
    wtext(doc, `${i} / ${total}`,         PW - MR,  PH - 7, { color: C.subtle, size: 7, align: 'right',  maxW: 30 })
  }
}

// ─── Ad content renderer ─────────────────────────────────────────────────────

// Parse the ad chunk lines into semantic segments
function parseAdLines(chunk) {
  return chunk.split('\n').map((raw) => {
    const line = raw.trimEnd()
    if (!line.trim() || line.trim() === '---') return { kind: 'space' }
    if (/^##\s+/.test(line))      return { kind: 'h2',    text: line.replace(/^##\s+/, '') }
    if (/^###\s+/.test(line))     return { kind: 'h3',    text: line.replace(/^###\s+/, '') }
    if (/^#\s+/.test(line))       return { kind: 'h1',    text: line.replace(/^#\s+/, '') }
    // **LABEL:** value  OR  **LABEL (time)**
    const bold = line.match(/^\*\*(.*?)\*\*:?\s*(.*)$/)
    if (bold) return { kind: 'field', label: bold[1], value: bold[2].replace(/\*\*(.*?)\*\*/g, '$1') }
    if (/^-\s+/.test(line))       return { kind: 'bullet', text: line.replace(/^-\s+/, '') }
    return { kind: 'body', text: line.replace(/\*\*(.*?)\*\*/g, '$1') }
  })
}

function renderAdOnPage(doc, chunk, adIndex, totalAds, isVideo) {
  let y = drawPageHeader(
    doc,
    isVideo ? `Roteiro ${adIndex + 1}` : `Anúncio ${adIndex + 1}`,
    totalAds > 1 ? `${adIndex + 1} de ${totalAds}` : '',
  )

  const segments = parseAdLines(chunk)

  for (const seg of segments) {
    if (seg.kind === 'space') {
      y += 2
      continue
    }

    y = checkPage(doc, y, 12)

    if (seg.kind === 'h1') {
      // Linha de meta do roteiro (ex: "Roteiro 3: Gancho... | Nível...") — subtítulo discreto
      y = wtext(doc, seg.text, ML, y, { color: C.blue700, size: 8.5, bold: true, maxW: CW })
      y += 1
    } else if (seg.kind === 'h2') {
      // Barra de título da seção
      const th = 10
      roundRect(doc, ML, y - 1, CW, th, 2, C.blue50)
      rect(doc, ML, y - 1, 1.4, th, C.blue600)
      y = wtext(doc, seg.text, ML + 5, y + 6, { color: C.blue700, size: 9, bold: true, maxW: CW - 10 })
      y += 2
    } else if (seg.kind === 'h3') {
      y = wtext(doc, seg.text, ML, y, { color: C.ink500, size: 8, bold: true })
    } else if (seg.kind === 'field') {
      const label = seg.label
      const value = seg.value

      const isHeadlineOpt = /OPÇÃO\s+\d+\s+DE\s+HEADLINE|HEADLINE\s+PRINCIPAL/i.test(label)
      const isSubhead     = /SUBHEADLINE/i.test(label)
      const isCTA         = /CALL.TO.ACTION/i.test(label)
      const isGancho      = /GANCHO/i.test(label)
      const isMensagem    = /MENSAGEM/i.test(label)
      const isCTAfinal    = /CTA\s+FINAL/i.test(label)
      const isLegenda     = /LEGENDA/i.test(label)

      // Paleta monocromática: um acento (azul da marca) + neutros.
      let bg    = C.ink100      // superfície padrão
      let lc    = C.ink500      // label
      let vc    = C.ink900      // valor
      let vSize = 9
      let bd    = null          // borda opcional
      let bold  = false

      if (isHeadlineOpt) {
        bg = C.blue50; lc = C.blue700; vc = C.blue700; vSize = 10; bold = true
      } else if (isSubhead) {
        bg = C.ink100; lc = C.ink500; vc = C.ink900
      } else if (isCTA || isCTAfinal) {
        // Bloco de destaque invertido (KPI-style): fundo azul-marca, texto branco
        bg = C.blue600; lc = C.blue100; vc = C.white
      } else if (isGancho) {
        bg = C.blue50; lc = C.blue700; vc = C.ink900
      } else if (isMensagem) {
        bg = C.ink100; lc = C.ink500; vc = C.ink900
      } else if (isLegenda) {
        bg = C.ink50; lc = C.blue600; vc = C.ink700; bd = C.ink200
      }

      const cleanVal   = sanitize(value)
      const labelH     = 4.5
      // Fixar a fonte ANTES de quebrar o texto — senão a largura é calculada com
      // o tamanho errado (o do label anterior) e as linhas estouram a caixa.
      doc.setFontSize(vSize)
      doc.setFont('helvetica', (isHeadlineOpt || bold) ? 'bold' : 'normal')
      const valueLines = cleanVal ? doc.splitTextToSize(cleanVal, CW - 8) : []
      const valueH     = cleanVal ? valueLines.length * (vSize * 0.37 + 0.8) : 0
      const blockH     = labelH + valueH + 6
      y = checkPage(doc, y, blockH + 2)

      roundRect(doc, ML, y, CW, blockH, 2, bg, bd)
      wtext(doc, label.toUpperCase(), ML + 4, y + 4, { color: lc, size: 6.5, bold: true })

      if (cleanVal) {
        let vy = y + 4 + labelH
        setColor(doc, vc)
        doc.setFontSize(vSize)
        doc.setFont('helvetica', (isHeadlineOpt || bold) ? 'bold' : 'normal')
        valueLines.forEach((l, i) => {
          if (i > 0) vy += vSize * 0.37 + 0.8
          doc.text(l, ML + 4, vy)
        })
      }

      y += blockH + 2

    } else if (seg.kind === 'bullet') {
      y = checkPage(doc, y, 7)
      setColor(doc, C.blue600)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text('·', ML + 3, y)
      y = wtext(doc, seg.text, ML + 8, y, { color: C.ink900, size: 8, maxW: CW - 10 })
      y += 0.5
    } else if (seg.kind === 'body') {
      if (seg.text.trim()) {
        y = wtext(doc, seg.text, ML, y, { color: C.ink700, size: 8, maxW: CW })
      }
    }
  }
}

// ─── Split content into individual ads ───────────────────────────────────────

function splitIntoAds(content) {
  const parts = content.split(/(?=^##\s+(?:ROTEIRO|AN[ÚU]NCIO)\s+\d+)/im)
  const ads = parts.filter((p) => /^##\s+(?:ROTEIRO|AN[ÚU]NCIO)\s+\d+/im.test(p.trim()))
  // Fallback by ---
  if (ads.length === 0) {
    return content
      .split(/\n---\n/)
      .map((c) => c.trim())
      .filter((c) => c && (/HEADLINE/i.test(c) || /GANCHO/i.test(c) || /CALL.TO.ACTION/i.test(c)))
  }
  return ads
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Exporta UM anúncio individual (de um CreativeCard).
 */
export function exportCreativoSinglePDF({ content, type, index, companyName }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const today   = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  const isVideo = type === 'video'

  // 1 anúncio = sem capa, vai direto ao conteúdo (sem contador "de 1")
  renderAdOnPage(doc, content, index, 1, isVideo)
  addFooters(doc, doc.getNumberOfPages(), companyName || 'Cliente', today)

  const typeStr = isVideo ? 'Video' : 'Estatico'
  doc.save(`Criativo-${typeStr}-${index + 1}-${(companyName || 'Cliente').replace(/\s+/g, '-')}.pdf`)
}

/**
 * Exporta o conjunto completo de anúncios de uma geração (de CreativeHistory).
 */
export function exportCreativoSetPDF({ creative, companyName }) {
  const {
    content,
    type       = 'estatico',
    adTypeLabels = [],
    quantity   = 1,
    customNote = '',
    createdAt,
  } = creative

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const today   = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  const isVideo = type === 'video'

  // Capa
  drawCover(doc, {
    companyName: companyName || 'Cliente',
    type,
    adTypeLabels,
    quantity,
    customNote,
    today: createdAt
      ? new Date(createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
      : today,
  })

  // Um anúncio por página
  const ads = splitIntoAds(content)
  ads.forEach((chunk, i) => {
    doc.addPage()
    renderAdOnPage(doc, chunk.trim(), i, ads.length, isVideo)
  })

  addFooters(doc, doc.getNumberOfPages(), companyName || 'Cliente', today)

  const typeStr  = isVideo ? 'Video' : 'Estatico'
  const dateStr  = createdAt ? new Date(createdAt).toISOString().slice(0, 10) : today
  doc.save(`Criativos-${typeStr}-${dateStr}-${(companyName || 'Cliente').replace(/\s+/g, '-')}.pdf`)
}
