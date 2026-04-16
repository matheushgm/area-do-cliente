import { jsPDF } from 'jspdf'

// ─── Design tokens (alinhados com metaLabPDF) ────────────────────────────────
const C = {
  bg:      [255, 255, 255],
  text:    [30,  30,  55 ],
  muted:   [100, 100, 130],
  subtle:  [140, 140, 170],
  border:  [220, 225, 240],
  surface: [245, 246, 252],
  purple:  [124, 58,  237],
  purpleL: [237, 233, 254],
  blue:    [37,  99,  235],
  blueL:   [219, 234, 254],
  green:   [5,   150, 105],
  greenL:  [209, 250, 229],
  gold:    [217, 119, 6  ],
  goldL:   [254, 243, 199],
  white:   [255, 255, 255],
  cover:   [10,  10,  25 ],
}

const PW = 210
const PH = 297
const ML = 18
const MR = 18
const CW = PW - ML - MR

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setFill(doc, c)  { doc.setFillColor(...c) }
function setDraw(doc, c)  { doc.setDrawColor(...c) }
function setColor(doc, c) { doc.setTextColor(...c) }

function rect(doc, x, y, w, h, color) {
  setFill(doc, color)
  doc.rect(x, y, w, h, 'F')
}

function roundRect(doc, x, y, w, h, r, color) {
  setFill(doc, color)
  doc.roundedRect(x, y, w, h, r, r, 'F')
}

function hline(doc, x1, y1, x2, lw = 0.25) {
  doc.setLineWidth(lw)
  setDraw(doc, C.border)
  doc.line(x1, y1, x2, y1)
}

// Wrapped text — returns new y after last line
function wtext(doc, str, x, y, { color = C.text, size = 9, bold = false, maxW = CW, align = 'left' } = {}) {
  if (!str) return y
  setColor(doc, color)
  doc.setFontSize(size)
  doc.setFont('helvetica', bold ? 'bold' : 'normal')
  const lh = size * 0.37       // line-height in mm
  const lines = doc.splitTextToSize(String(str), maxW)
  lines.forEach((line, i) => {
    if (i > 0) y += lh + 0.8
    const xPos = align === 'right' ? x : (align === 'center' ? x : x)
    doc.text(line, xPos, y, align !== 'left' ? { align } : undefined)
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

function drawCover(doc, { companyName, type, adTypeLabels, quantity, customNote, today, accentColor }) {
  rect(doc, 0, 0, PW, PH, C.cover)
  rect(doc, 0, 0, PW, 2, accentColor)

  // Logo
  roundRect(doc, ML, 28, 14, 14, 3, accentColor)
  setColor(doc, C.white)
  doc.setFontSize(11); doc.setFont('helvetica', 'bold')
  doc.text('RL', ML + 7, 37, { align: 'center' })
  wtext(doc, 'Revenue Lab',  ML + 18, 33, { color: C.white, size: 13, bold: true })
  wtext(doc, 'Internal Tool', ML + 18, 38.5, { color: [150, 150, 200], size: 8 })

  // Hero
  wtext(doc, 'Criativos', ML, 78, { color: [180, 180, 220], size: 28 })
  const typeLabel = type === 'video' ? 'de Vídeo' : 'Estáticos'
  wtext(doc, typeLabel, ML, 93, { color: C.white, size: 38, bold: true })

  hline(doc, ML, 105, PW - MR)

  wtext(doc, 'Anúncios gerados com IA — Revenue Lab', ML, 115, { color: [160, 160, 200], size: 10.5 })

  // Info card
  roundRect(doc, ML, 132, CW, 60, 4, [22, 22, 45])

  wtext(doc, 'CLIENTE', ML + 10, 144, { color: [120, 120, 160], size: 7, bold: true })
  wtext(doc, companyName || 'Cliente', ML + 10, 151, { color: C.white, size: 16, bold: true })

  hline(doc, ML + 10, 156, ML + CW - 10)

  const stats = [
    { label: 'TIPO',       value: type === 'video' ? 'Vídeo (Roteiro)' : 'Estático (Imagem)' },
    { label: 'QUANTIDADE', value: `${quantity} criativo${quantity !== 1 ? 's' : ''}` },
  ]
  const sw = (CW - 20) / 2
  stats.forEach((s, i) => {
    const sx = ML + 10 + i * sw
    wtext(doc, s.label, sx, 165, { color: [120, 120, 160], size: 7, bold: true })
    wtext(doc, s.value,  sx, 172, { color: C.white, size: 10, bold: true })
  })

  // Types chips area
  wtext(doc, 'TIPOS DE ANÚNCIO', ML + 10, 182, { color: [120, 120, 160], size: 7, bold: true })
  const labelsStr = (adTypeLabels || []).join(' · ')
  wtext(doc, labelsStr || '—', ML + 10, 187, { color: [200, 200, 240], size: 8, maxW: CW - 20 })

  if (customNote) {
    wtext(doc, 'DIREÇÃO CRIATIVA', ML + 10, 196, { color: [120, 120, 160], size: 7, bold: true })
    wtext(doc, `"${customNote}"`, ML + 10, 201, { color: [200, 200, 240], size: 8, maxW: CW - 20 })
  }

  wtext(doc, `Gerado em ${today}`, PW / 2, PH - 14, { color: [80, 80, 120], size: 8, align: 'center' })
  wtext(doc, 'Confidencial — uso exclusivo', PW / 2, PH - 9, { color: [60, 60, 100], size: 7.5, align: 'center' })
}

// ─── Page header ─────────────────────────────────────────────────────────────

function drawPageHeader(doc, title, subtitle, accentColor) {
  rect(doc, 0, 0, PW, 16, accentColor)
  wtext(doc, title, ML, 10.5, { color: C.white, size: 11, bold: true })
  if (subtitle) wtext(doc, subtitle, PW - MR, 10.5, { color: [220, 220, 255], size: 8, align: 'right', maxW: 80 })
  return 24
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function addFooters(doc, total, companyName, today) {
  for (let i = 2; i <= total; i++) {
    doc.setPage(i)
    hline(doc, ML, PH - 12, PW - MR)
    wtext(doc, `Revenue Lab × ${companyName}`,  ML,       PH - 7, { color: C.muted, size: 7 })
    wtext(doc, today,                           PW / 2,   PH - 7, { color: C.muted, size: 7, align: 'center', maxW: 80 })
    wtext(doc, `${i} / ${total}`,               PW - MR,  PH - 7, { color: C.muted, size: 7, align: 'right',  maxW: 30 })
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
    // **LABEL:** value  OR  **LABEL (time)**
    const bold = line.match(/^\*\*(.*?)\*\*:?\s*(.*)$/)
    if (bold) return { kind: 'field', label: bold[1], value: bold[2].replace(/\*\*(.*?)\*\*/g, '$1') }
    if (/^-\s+/.test(line))       return { kind: 'bullet', text: line.replace(/^-\s+/, '') }
    return { kind: 'body', text: line.replace(/\*\*(.*?)\*\*/g, '$1') }
  })
}

function renderAdOnPage(doc, chunk, accentColor, adIndex, totalAds, isVideo) {
  let y = drawPageHeader(
    doc,
    isVideo ? `Roteiro ${adIndex + 1}` : `Anúncio ${adIndex + 1}`,
    `${adIndex + 1} de ${totalAds}`,
    accentColor,
  )

  const segments = parseAdLines(chunk)
  let inHeadlineBlock = false

  for (const seg of segments) {
    if (seg.kind === 'space') {
      y += 2
      continue
    }

    y = checkPage(doc, y, 12)

    if (seg.kind === 'h2') {
      // Ad title bar
      roundRect(doc, ML, y - 1, CW, 10, 2, [...accentColor.map(v => Math.min(255, v + 160))])
      y = wtext(doc, seg.text, ML + 4, y + 6.5, { color: accentColor, size: 9, bold: true, maxW: CW - 8 })
      y += 2
      inHeadlineBlock = false
    } else if (seg.kind === 'h3') {
      y = wtext(doc, seg.text, ML, y, { color: C.muted, size: 8, bold: true })
    } else if (seg.kind === 'field') {
      const label = seg.label
      const value = seg.value

      // Detect headline options for visual grouping
      const isHeadlineOpt = /OPÇÃO\s+\d+\s+DE\s+HEADLINE|HEADLINE\s+PRINCIPAL/i.test(label)
      const isSubhead     = /SUBHEADLINE/i.test(label)
      const isCTA         = /CALL.TO.ACTION/i.test(label)
      const isGancho      = /GANCHO/i.test(label)
      const isMensagem    = /MENSAGEM/i.test(label)
      const isCTAfinal    = /CTA\s+FINAL/i.test(label)
      const isLegenda     = /LEGENDA/i.test(label)

      let bg    = C.surface
      let lc    = C.muted
      let vc    = C.text
      let vSize = 9

      if (isHeadlineOpt) {
        bg = accentColor.map(v => Math.min(255, v + 195))
        lc = accentColor
        vc = accentColor
        vSize = 10
        inHeadlineBlock = true
      } else if (isSubhead) {
        bg = C.surface
        lc = C.subtle
      } else if (isCTA || isCTAfinal) {
        bg = C.greenL
        lc = C.green
        vc = C.green
      } else if (isGancho) {
        bg = accentColor.map(v => Math.min(255, v + 185))
        lc = accentColor
        vc = C.text
      } else if (isMensagem) {
        bg = C.surface
        lc = C.subtle
      } else if (isLegenda) {
        bg = C.goldL
        lc = C.gold
        vc = C.text
      }

      // Draw bg rect + label + value
      const labelH  = 4.5
      const valueLines = value ? doc.splitTextToSize(value, CW - 8) : []
      const valueH  = value ? valueLines.length * (vSize * 0.37 + 0.8) : 0
      const blockH  = labelH + valueH + 6
      y = checkPage(doc, y, blockH + 2)

      roundRect(doc, ML, y, CW, blockH, 2, bg)
      wtext(doc, label.toUpperCase(), ML + 4, y + 4, { color: lc, size: 6.5, bold: true })

      if (value) {
        let vy = y + 4 + labelH
        setColor(doc, vc)
        doc.setFontSize(vSize)
        doc.setFont('helvetica', isHeadlineOpt ? 'bold' : 'normal')
        valueLines.forEach((l, i) => {
          if (i > 0) vy += vSize * 0.37 + 0.8
          doc.text(l, ML + 4, vy)
        })
      }

      y += blockH + 2

    } else if (seg.kind === 'bullet') {
      y = checkPage(doc, y, 7)
      setColor(doc, accentColor)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text('·', ML + 3, y)
      y = wtext(doc, seg.text, ML + 8, y, { color: C.text, size: 8, maxW: CW - 10 })
      y += 0.5
    } else if (seg.kind === 'body') {
      if (seg.text.trim()) {
        y = wtext(doc, seg.text, ML, y, { color: C.muted, size: 8, maxW: CW })
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
  const today       = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  const isVideo     = type === 'video'
  const accentColor = isVideo ? C.purple : C.blue

  // Capa simplificada (1 anúncio = sem capa, vai direto ao conteúdo)
  renderAdOnPage(doc, content, accentColor, index, 1, isVideo)
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
  const today       = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  const isVideo     = type === 'video'
  const accentColor = isVideo ? C.purple : C.blue

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
    accentColor,
  })

  // Um anúncio por página
  const ads = splitIntoAds(content)
  ads.forEach((chunk, i) => {
    doc.addPage()
    renderAdOnPage(doc, chunk.trim(), accentColor, i, ads.length, isVideo)
  })

  addFooters(doc, doc.getNumberOfPages(), companyName || 'Cliente', today)

  const typeStr  = isVideo ? 'Video' : 'Estatico'
  const dateStr  = createdAt ? new Date(createdAt).toISOString().slice(0, 10) : today
  doc.save(`Criativos-${typeStr}-${dateStr}-${(companyName || 'Cliente').replace(/\s+/g, '-')}.pdf`)
}
