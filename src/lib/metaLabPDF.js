import { jsPDF } from 'jspdf'

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  bg:        [255, 255, 255],
  dark:      [15,  15,  30 ],
  text:      [30,  30,  55 ],
  muted:     [100, 100, 130],
  border:    [220, 225, 240],
  surface:   [245, 246, 252],
  purple:    [124, 58,  237],
  purpleL:   [237, 233, 254],
  blue:      [37,  99,  235],
  blueL:     [219, 234, 254],
  gold:      [217, 119, 6  ],
  goldL:     [254, 243, 199],
  green:     [5,   150, 105],
  greenL:    [209, 250, 229],
  white:     [255, 255, 255],
  cover:     [10,  10,  25 ],
}

const PW = 210  // A4 width mm
const PH = 297  // A4 height mm
const ML = 18   // margin left
const MR = 18   // margin right
const CW = PW - ML - MR  // content width

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rgb(arr)  { return { r: arr[0], g: arr[1], b: arr[2] } }

function setFill(doc, color)   { doc.setFillColor(...color) }
function setDraw(doc, color)   { doc.setDrawColor(...color) }
function setColor(doc, color)  { doc.setTextColor(...color) }

function rect(doc, x, y, w, h, color, border) {
  setFill(doc, color)
  if (border) {
    setDraw(doc, border)
    doc.rect(x, y, w, h, 'FD')
  } else {
    doc.rect(x, y, w, h, 'F')
  }
}

function roundRect(doc, x, y, w, h, r, color) {
  setFill(doc, color)
  doc.roundedRect(x, y, w, h, r, r, 'F')
}

function text(doc, str, x, y, opts = {}) {
  const { color = C.text, size = 10, bold = false, align = 'left', maxWidth } = opts
  setColor(doc, color)
  doc.setFontSize(size)
  doc.setFont('helvetica', bold ? 'bold' : 'normal')
  const txtOpts = {}
  if (align !== 'left') txtOpts.align = align
  if (maxWidth) txtOpts.maxWidth = maxWidth
  doc.text(str, x, y, txtOpts)
}

function line(doc, x1, y1, x2, y2, color = C.border, lw = 0.3) {
  doc.setLineWidth(lw)
  setDraw(doc, color)
  doc.line(x1, y1, x2, y2)
}

function badge(doc, label, x, y, bg, fg, w = null) {
  setColor(doc, fg)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  const tw = doc.getTextWidth(label)
  const bw = w || tw + 10
  const bh = 6
  roundRect(doc, x, y - 4.5, bw, bh, 1.5, bg)
  doc.text(label, x + bw / 2, y, { align: 'center' })
  return bw
}

function fmtBRL(n) {
  if (n == null || !isFinite(n) || isNaN(n)) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function checkPage(doc, y, needed = 20) {
  if (y + needed > PH - 18) {
    doc.addPage()
    return 20
  }
  return y
}

// ─── Cover Page ───────────────────────────────────────────────────────────────

function drawCover(doc, { companyName, labType, labColor, budget, duration, phases, today }) {
  // Full dark background
  rect(doc, 0, 0, PW, PH, C.cover)

  // Accent stripe top
  rect(doc, 0, 0, PW, 2, C.purple)

  // Logo area
  roundRect(doc, ML, 28, 14, 14, 3, C.purple)
  setColor(doc, C.white)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('RL', ML + 7, 37, { align: 'center' })

  text(doc, 'Revenue Lab', ML + 18, 33, { color: C.white, size: 13, bold: true })
  text(doc, 'Internal Tool', ML + 18, 38.5, { color: [150, 150, 200], size: 8 })

  // Hero title
  text(doc, 'Plano de', ML, 80, { color: [180, 180, 220], size: 28 })
  text(doc, 'Laboratório', ML, 95, { color: C.white, size: 38, bold: true })
  text(doc, 'Meta Ads', ML, 110, { color: C.purple.map ? C.purple : [124, 58, 237], size: 38, bold: true })
  setColor(doc, [124, 58, 237])
  doc.setFontSize(38)
  doc.setFont('helvetica', 'bold')

  // Divider
  line(doc, ML, 120, PW - MR, 120, [60, 60, 90], 0.5)

  // Subtitle
  text(doc, 'Metodologia de validação de criativos, públicos e ganchos', ML, 130, {
    color: [160, 160, 200], size: 10.5,
  })
  text(doc, 'no Meta Ads — com clareza total sobre cada dia do projeto.', ML, 137, {
    color: [160, 160, 200], size: 10.5,
  })

  // Client info card
  roundRect(doc, ML, 155, CW, 52, 4, [22, 22, 45])

  text(doc, 'CLIENTE', ML + 10, 167, { color: [120, 120, 160], size: 7, bold: true })
  text(doc, companyName || 'Cliente', ML + 10, 174, { color: C.white, size: 16, bold: true })

  line(doc, ML + 10, 178, ML + CW - 10, 178, [40, 40, 70], 0.3)

  // Stats row
  const stats = [
    { label: 'TIPO DE LAB',      value: labType },
    { label: 'DURAÇÃO',          value: `${duration} dias` },
    { label: 'FASES',            value: `${phases} fase${phases > 1 ? 's' : ''}` },
    { label: 'INVESTIMENTO',     value: fmtBRL(budget) },
  ]
  const sw = (CW - 20) / stats.length
  stats.forEach((s, i) => {
    const sx = ML + 10 + i * sw
    text(doc, s.label, sx, 187, { color: [120, 120, 160], size: 7, bold: true })
    text(doc, s.value, sx, 194, { color: C.white, size: 10, bold: true })
  })

  // Footer
  text(doc, `Gerado em ${today}`, PW / 2, PH - 14, { color: [80, 80, 120], size: 8, align: 'center' })
  text(doc, 'Confidencial — uso exclusivo do cliente', PW / 2, PH - 9, { color: [60, 60, 100], size: 7.5, align: 'center' })
}

// ─── Page Header ─────────────────────────────────────────────────────────────

function drawPageHeader(doc, title, subtitle, accentColor) {
  rect(doc, 0, 0, PW, 16, accentColor)
  text(doc, title,    ML,    10.5, { color: C.white, size: 11, bold: true })
  if (subtitle) text(doc, subtitle, PW - MR, 10.5, { color: [220, 220, 255], size: 8, align: 'right' })
  return 24
}

// ─── Section Title ───────────────────────────────────────────────────────────

function sectionTitle(doc, label, y, color = C.purple) {
  rect(doc, ML, y, 3, 7, color)
  text(doc, label, ML + 6, y + 5.5, { color: C.text, size: 11, bold: true })
  return y + 13
}

// ─── Overview Page ────────────────────────────────────────────────────────────

function drawOverview(doc, { lab, audienceLabel, labType, labColor }) {
  let y = drawPageHeader(doc, 'Visão Geral do Laboratório', labType, C.purple)

  // Intro text
  text(doc, 'Este documento apresenta o plano completo do Laboratório Meta Ads.', ML, y, { color: C.muted, size: 9.5 })
  y += 6
  text(doc, 'Cada fase tem um objetivo claro, e cada dia tem uma ação definida.', ML, y, { color: C.muted, size: 9.5 })
  y += 12

  // Summary cards
  const cards = [
    { label: 'Investimento Total',  value: fmtBRL(lab.total),                           color: C.purple,  light: C.purpleL },
    { label: 'Duração',             value: `${lab.duration} dias`,                      color: C.blue,    light: C.blueL   },
    { label: 'Fases Ativas',        value: `${lab.phases} fase${lab.phases > 1 ? 's' : ''}`, color: C.green, light: C.greenL },
    { label: 'Tipo de Laboratório', value: labType,                                     color: C.gold,    light: C.goldL   },
  ]
  const cw = (CW - 9) / 4
  cards.forEach((c, i) => {
    const cx = ML + i * (cw + 3)
    roundRect(doc, cx, y, cw, 22, 3, c.light)
    text(doc, c.label, cx + cw / 2, y + 7,  { color: C.muted, size: 7, align: 'center' })
    text(doc, c.value, cx + cw / 2, y + 15, { color: c.color, size: 9.5, bold: true, align: 'center' })
  })
  y += 30

  // Timeline bar
  y = sectionTitle(doc, 'Linha do Tempo', y)
  const phases = [
    { label: 'FASE 01 — CRIATIVOS', days: 'Dias 1–7',   color: C.purple, show: !!lab.f1 },
    { label: 'FASE 02 — PÚBLICOS',  days: 'Dias 8–14',  color: C.blue,   show: !!lab.f2 },
    { label: 'FASE 03 — GANCHOS',   days: 'Dias 15–21', color: C.gold,   show: !!lab.f3 },
  ]
  const pw2 = (CW - 4) / 3
  phases.forEach((p, i) => {
    const px = ML + i * (pw2 + 2)
    const alpha = p.show ? p.color : C.border
    roundRect(doc, px, y, pw2, 18, 3, alpha)
    if (p.show) {
      text(doc, p.label, px + pw2 / 2, y + 7,  { color: C.white, size: 7, bold: true, align: 'center' })
      text(doc, p.days,  px + pw2 / 2, y + 13, { color: [220, 220, 255], size: 8, align: 'center' })
    } else {
      text(doc, p.label, px + pw2 / 2, y + 7,  { color: C.muted, size: 7, bold: true, align: 'center' })
      text(doc, 'Não incluída',  px + pw2 / 2, y + 13, { color: C.muted, size: 8, align: 'center' })
    }
  })
  y += 26

  // Audience info
  roundRect(doc, ML, y, CW, 14, 3, C.surface)
  text(doc, 'Tipo de Público — Fase 01:', ML + 6, y + 6, { color: C.muted, size: 8 })
  text(doc, audienceLabel, ML + 6, y + 11.5, { color: C.text, size: 9, bold: true })
  y += 22

  // Phase summaries
  y = sectionTitle(doc, 'O Que Acontece em Cada Fase', y)

  const phaseInfos = [
    {
      show: !!lab.f1,
      num: '01', name: 'Teste de Criativos', days: 'Dias 1–7',
      color: C.purple, light: C.purpleL,
      desc: `Lançamos ${lab.f1?.conjuntos} conjuntos de anúncio no Dia 1 para identificar os ${lab.f1?.keepAfterDay1} criativos com melhor desempenho. No Dia 2, pausamos os piores e mantemos os campeões pelos próximos 5 dias.`,
      cost: fmtBRL(lab.f1?.totalCost),
    },
    {
      show: !!lab.f2,
      num: '02', name: 'Teste de Públicos', days: 'Dias 8–14',
      color: C.blue, light: C.blueL,
      desc: `Com o criativo campeão da Fase 01, testamos ${lab.f2?.conjuntos} públicos diferentes para descobrir qual audiência converte melhor ao menor custo.`,
      cost: fmtBRL(lab.f2?.totalCost),
    },
    {
      show: !!lab.f3,
      num: '03', name: 'Teste de Ganchos', days: 'Dias 15–21',
      color: C.gold, light: C.goldL,
      desc: `Com criativo e público já validados, testamos ${lab.f3?.conjuntos} variações do início do vídeo para maximizar a retenção nos primeiros 3 segundos e reduzir o CPL final.`,
      cost: fmtBRL(lab.f3?.totalCost),
    },
  ]

  phaseInfos.forEach((p) => {
    if (!p.show) return
    y = checkPage(doc, y, 35)

    roundRect(doc, ML, y, CW, 30, 3, p.light)
    // Phase badge
    roundRect(doc, ML + 5, y + 5, 30, 7, 2, p.color)
    text(doc, `FASE ${p.num}`, ML + 5 + 15, y + 9.5, { color: C.white, size: 7, bold: true, align: 'center' })
    text(doc, p.name,  ML + 40, y + 8, { color: p.color, size: 10, bold: true })
    text(doc, p.days,  ML + 40, y + 13, { color: C.muted, size: 8 })
    text(doc, p.desc,  ML + 5, y + 20, { color: C.text, size: 8, maxWidth: CW - 50 })
    text(doc, p.cost,  PW - MR, y + 10, { color: p.color, size: 11, bold: true, align: 'right' })
    text(doc, 'total da fase',  PW - MR, y + 15.5, { color: C.muted, size: 7, align: 'right' })
    y += 35
  })

  // Footer note
  y = checkPage(doc, y, 20)
  roundRect(doc, ML, y, CW, 16, 3, [235, 232, 254])
  text(doc, '💡 Cada fase roda por exatamente 7 dias. Os resultados de cada etapa alimentam a próxima,', ML + 6, y + 6, { color: C.purple, size: 8 })
  text(doc, '    criando uma estratégia de dados progressiva e validada.', ML + 6, y + 11.5, { color: C.purple, size: 8 })
}

// ─── Day-by-day table ────────────────────────────────────────────────────────

function drawDayTable(doc, rows, y, accentColor) {
  const colW = [20, 38, CW - 58]
  const headers = ['DIA', 'AÇÃO', 'DETALHES']

  // Header row
  rect(doc, ML, y, CW, 8, accentColor)
  let cx = ML
  headers.forEach((h, i) => {
    text(doc, h, cx + 3, y + 5.5, { color: C.white, size: 7, bold: true })
    cx += colW[i]
  })
  y += 8

  rows.forEach((row, ri) => {
    const rowH = 10
    y = checkPage(doc, y, rowH + 2)

    rect(doc, ML, y, CW, rowH, ri % 2 === 0 ? C.surface : C.bg)
    // subtle left accent for action days
    if (row.highlight) rect(doc, ML, y, 2, rowH, accentColor)

    cx = ML
    text(doc, row.day,     cx + 3, y + 6.5, { color: accentColor, size: 8, bold: true })
    cx += colW[0]
    text(doc, row.action,  cx + 3, y + 6.5, { color: C.text, size: 8, bold: true })
    cx += colW[1]
    // truncate details if needed
    const detail = row.details.length > 95 ? row.details.slice(0, 95) + '…' : row.details
    text(doc, detail, cx + 3, y + 6.5, { color: C.muted, size: 7.5 })
    y += rowH

    // Bottom border
    line(doc, ML, y, ML + CW, y, C.border, 0.2)
  })

  return y + 4
}

// ─── Phase Page ───────────────────────────────────────────────────────────────

function drawPhasePage(doc, { def, plan, startDay, audienceLabel, phaseColor, phaseLight, phaseNum }) {
  const pageTitle = `Fase ${phaseNum} — ${def.name}`
  let y = drawPageHeader(doc, pageTitle, def.days, phaseColor)

  // Objective + description
  text(doc, def.description, ML, y, { color: C.muted, size: 9.5, maxWidth: CW })
  y += 12

  // Config cards
  y = sectionTitle(doc, 'Configuração no Meta Ads', y, phaseColor)
  const configs = [
    { label: 'Objetivo',           value: def.objective },
    { label: 'Tipo de orçamento',  value: 'Por conjunto (ABO)' },
    { label: 'Verba por conjunto', value: 'R$ 35,00 / dia' },
    { label: 'Conjuntos no Dia 1', value: `${plan.conjuntos} conjuntos` },
  ]
  if (def.key === 'f1') {
    configs.push({ label: 'Público (Fase 01)', value: audienceLabel })
  }
  if (def.key === 'f2') {
    configs.push({ label: 'Criativo usado', value: 'Criativo campeão da Fase 01' })
  }
  if (def.key === 'f3') {
    configs.push({ label: 'Base',    value: 'Criativo campeão da Fase 01 (só muda o início)' })
    configs.push({ label: 'Público', value: 'Público campeão da Fase 02' })
  }

  const ccw = (CW - 3) / 2
  configs.forEach((c, i) => {
    const row = Math.floor(i / 2)
    const col = i % 2
    const cx = ML + col * (ccw + 3)
    const cy = y + row * 16
    roundRect(doc, cx, cy, ccw, 13, 2, phaseLight)
    text(doc, c.label, cx + 5, cy + 5.5, { color: C.muted, size: 7 })
    text(doc, c.value, cx + 5, cy + 10.5, { color: C.text, size: 8.5, bold: true })
  })
  y += Math.ceil(configs.length / 2) * 16 + 6

  // Naming convention
  roundRect(doc, ML, y, CW, 22, 3, C.surface)
  text(doc, 'NOMENCLATURA SUGERIDA', ML + 6, y + 6, { color: C.muted, size: 7, bold: true })
  text(doc, `Campanha: [Cliente] – LAB – Fase ${phaseNum} – ${def.name}`, ML + 6, y + 12.5, { color: C.text, size: 8 })
  text(doc, `Conjunto:  [Cliente] – F${phaseNum} – CA01 / CA02 / CA03…`, ML + 6, y + 17.5, { color: C.text, size: 8 })
  y += 28

  // Selection criteria
  y = sectionTitle(doc, 'Critério de Seleção (Dia 2)', y, phaseColor)
  def.selectionDay2.forEach((s, i) => {
    roundRect(doc, ML, y, CW, 10, 2, phaseLight)
    text(doc, `${i + 1}º critério:`, ML + 5, y + 6.5, { color: phaseColor, size: 7.5, bold: true })
    text(doc, s, ML + 30, y + 6.5, { color: C.text, size: 8 })
    y += 13
  })
  y += 4

  // Day-by-day table
  y = checkPage(doc, y, 60)
  y = sectionTitle(doc, 'O Que Fazer em Cada Dia', y, phaseColor)

  const sd = startDay
  const rows = [
    {
      day: `Dia ${sd}`,
      action: '🚀 Lançamento',
      details: `Suba ${plan.conjuntos} conjuntos de anúncio com ${plan.itemsPerConjunto} ${def.itemsLabel} por conjunto. Verba: R$35/conjunto. Deixe rodar 24h sem mexer.`,
      highlight: true,
    },
    {
      day: `Dia ${sd + 1}`,
      action: '🔍 Seleção',
      details: `Analise os resultados. Pause os piores e mantenha os ${plan.keepAfterDay1} melhores ${def.itemsLabel}. Critério: ${def.selectionDay2[0]}.`,
      highlight: true,
    },
    {
      day: `Dia ${sd + 2}`,
      action: '📊 Otimização',
      details: `Continue com os ${plan.keepAfterDay1} melhores. Monitore CPL e CTR. Ajuste verba se necessário.`,
      highlight: false,
    },
    {
      day: `Dia ${sd + 3}`,
      action: '📊 Otimização',
      details: 'Observe tendências. Se algum conjunto cair de performance, considere substituição.',
      highlight: false,
    },
    {
      day: `Dia ${sd + 4}`,
      action: '📊 Otimização',
      details: 'Mantenha os vencedores. Avalie se há necessidade de novos criativos para os conjuntos fracos.',
      highlight: false,
    },
    {
      day: `Dia ${sd + 5}`,
      action: '📊 Otimização',
      details: 'Continue monitorando CPL/ROAS. Documente os aprendizados para a próxima fase.',
      highlight: false,
    },
    {
      day: `Dia ${sd + 6}`,
      action: '✅ Conclusão',
      details: `Registre o campeão desta fase. ${def.key === 'f1' ? 'Prepare o criativo vencedor para a Fase 02.' : def.key === 'f2' ? 'Prepare o público vencedor para a Fase 03.' : 'Consolide os resultados finais do laboratório.'}`,
      highlight: true,
    },
  ]

  y = drawDayTable(doc, rows, y, phaseColor)
  y += 4

  // Budget summary for this phase
  y = checkPage(doc, y, 30)
  roundRect(doc, ML, y, CW, 26, 3, phaseLight)
  text(doc, 'RESUMO FINANCEIRO DA FASE', ML + 6, y + 7, { color: phaseColor, size: 7.5, bold: true })

  const bCols = [
    { label: `Dia ${sd} (lançamento)`, value: fmtBRL(plan.dia1Cost) },
    { label: `Dias ${sd + 1}–${sd + 6} (otimização)`, value: fmtBRL(plan.dias2a7Cost) },
    { label: 'Total da fase', value: fmtBRL(plan.totalCost) },
  ]
  const bcw = (CW - 12) / 3
  bCols.forEach((b, i) => {
    const bx = ML + 6 + i * (bcw + 3)
    text(doc, b.label, bx, y + 14, { color: C.muted, size: 7 })
    text(doc, b.value, bx, y + 20, { color: i === 2 ? phaseColor : C.text, size: i === 2 ? 10 : 9, bold: i === 2 })
  })

  return y + 30
}

// ─── Investment Summary Page ──────────────────────────────────────────────────

function drawSummaryPage(doc, { lab, budget }) {
  let y = drawPageHeader(doc, 'Resumo do Investimento', 'Visão financeira completa', C.green)

  // Total highlight
  roundRect(doc, ML, y, CW, 28, 4, C.greenL)
  text(doc, 'INVESTIMENTO TOTAL DO LABORATÓRIO', PW / 2, y + 9, { color: C.green, size: 8, bold: true, align: 'center' })
  text(doc, fmtBRL(lab.total), PW / 2, y + 20, { color: C.green, size: 22, bold: true, align: 'center' })
  y += 36

  // Phase breakdown
  y = sectionTitle(doc, 'Distribuição por Fase', y, C.green)
  const phases = [
    { label: 'Fase 01 — Teste de Criativos', plan: lab.f1, color: C.purple, light: C.purpleL, days: 'Dias 1–7' },
    { label: 'Fase 02 — Teste de Públicos',  plan: lab.f2, color: C.blue,   light: C.blueL,   days: 'Dias 8–14' },
    { label: 'Fase 03 — Teste de Ganchos',   plan: lab.f3, color: C.gold,   light: C.goldL,   days: 'Dias 15–21' },
  ]

  phases.forEach(({ label, plan, color, light, days }) => {
    const hasIt = !!plan
    roundRect(doc, ML, y, CW, 16, 3, hasIt ? light : C.surface)
    text(doc, label, ML + 6, y + 7, { color: hasIt ? color : C.muted, size: 9.5, bold: true })
    text(doc, days,  ML + 6, y + 12, { color: C.muted, size: 7.5 })
    text(doc, hasIt ? fmtBRL(plan.totalCost) : 'Não incluída', PW - MR, y + 10, {
      color: hasIt ? color : C.muted, size: hasIt ? 11 : 9, bold: hasIt, align: 'right',
    })
    if (hasIt && !plan.isStandard) {
      badge(doc, 'Adaptado', PW - MR - 50, y + 5, C.goldL, C.gold)
    }
    y += 20
  })

  // Remainder
  if (lab.total < budget) {
    roundRect(doc, ML, y, CW, 14, 3, C.greenL)
    text(doc, 'Saldo restante após o laboratório', ML + 6, y + 6, { color: C.green, size: 8 })
    text(doc, fmtBRL(budget - lab.total), ML + 6, y + 11, { color: C.green, size: 9, bold: true })
    text(doc, '(verba disponível para escalar o que for validado)', PW - MR, y + 9, { color: C.green, size: 7.5, align: 'right' })
    y += 20
  }

  y += 6

  // What happens next
  y = sectionTitle(doc, 'O Que Acontece Depois do Laboratório', y, C.green)
  const nexts = [
    '✅ Você terá os criativos, públicos e ganchos validados com dados reais.',
    '📈 Poderemos escalar com segurança, sabendo o que funciona para o seu produto.',
    '💡 As combinações vencedoras viram a base da estratégia de performance de longo prazo.',
    '🔄 O laboratório pode ser repetido a cada trimestre para novos produtos ou fases de mercado.',
  ]
  nexts.forEach((n) => {
    roundRect(doc, ML, y, CW, 12, 2, C.surface)
    text(doc, n, ML + 6, y + 7.5, { color: C.text, size: 9 })
    y += 15
  })

  // Final note
  y = checkPage(doc, y, 24)
  y += 6
  roundRect(doc, ML, y, CW, 20, 4, [235, 232, 254])
  text(doc, 'Este plano é dinâmico. Ajustes podem ser necessários conforme os dados de cada fase', PW / 2, y + 8, {
    color: C.purple, size: 8.5, align: 'center',
  })
  text(doc, 'são coletados. Você será informado a cada decisão relevante.', PW / 2, y + 14, {
    color: C.purple, size: 8.5, align: 'center',
  })
}

// ─── Footer on every page ────────────────────────────────────────────────────

function addFooters(doc, totalPages, companyName, today) {
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i)
    line(doc, ML, PH - 12, PW - MR, PH - 12, C.border, 0.3)
    text(doc, `Revenue Lab × ${companyName}`, ML, PH - 7, { color: C.muted, size: 7 })
    text(doc, today, PW / 2, PH - 7, { color: C.muted, size: 7, align: 'center' })
    text(doc, `${i} / ${totalPages}`, PW - MR, PH - 7, { color: C.muted, size: 7, align: 'right' })
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function generateMetaLabPDF({ lab, audienceType, companyName, budget }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  const audienceLabel = {
    remarketing: 'Remarketing (público de engajamento)',
    lookalike:   'Lookalike (público semelhante à base de clientes)',
    interesses:  'Interesses gerais mistos',
  }[audienceType] || 'A definir'

  // ── 1. Cover ──────────────────────────────────────────────────────────────
  drawCover(doc, {
    companyName,
    labType:  lab.labType,
    labColor: lab.labColor,
    budget,
    duration: lab.duration,
    phases:   lab.phases,
    today,
  })

  // ── 2. Overview ───────────────────────────────────────────────────────────
  doc.addPage()
  drawOverview(doc, { lab, audienceLabel, labType: lab.labType, labColor: lab.labColor })

  // ── 3. Phase pages ────────────────────────────────────────────────────────
  const phaseDefs = [
    {
      def: {
        key: 'f1', name: 'Teste de Criativos',
        description: 'Identificar os 3 criativos com maior potencial de conversão em 7 dias. Cada conjunto roda com orçamento igual para garantir comparação justa.',
        selectionDay2: ['Priorize menor CPL (se houve conversões)', 'Use CTR no link como critério (se não houve conversões)'],
        objective: 'Conversão ou Tráfego',
        itemsLabel: 'criativos', days: 'Dias 1–7',
      },
      plan:       lab.f1,
      startDay:   1,
      phaseColor: C.purple,
      phaseLight: C.purpleL,
      phaseNum:   '01',
    },
    lab.f2 && {
      def: {
        key: 'f2', name: 'Teste de Públicos',
        description: 'Com o criativo campeão da Fase 01, descobrir os públicos com maior probabilidade de conversão. Usamos o mesmo criativo em todos os conjuntos para isolar a variável público.',
        selectionDay2: ['Menor CPL (se houve conversões)', 'CTR no link + Custo por clique (se não houve conversões)'],
        objective: 'Conversão ou Tráfego',
        itemsLabel: 'públicos', days: 'Dias 8–14',
      },
      plan:       lab.f2,
      startDay:   8,
      phaseColor: C.blue,
      phaseLight: C.blueL,
      phaseNum:   '02',
    },
    lab.f3 && {
      def: {
        key: 'f3', name: 'Teste de Ganchos',
        description: 'Com criativo e público já validados, testamos variações do início do vídeo (gancho) para aumentar retenção nos primeiros 3 segundos e reduzir o CPL final.',
        selectionDay2: ['Menor CPL (se houve conversões)', 'Retenção nos 3 primeiros segundos + CTR (se não houve conversões)'],
        objective: 'Conversão (criativo e público já validados)',
        itemsLabel: 'ganchos', days: 'Dias 15–21',
      },
      plan:       lab.f3,
      startDay:   15,
      phaseColor: C.gold,
      phaseLight: C.goldL,
      phaseNum:   '03',
    },
  ].filter(Boolean)

  phaseDefs.forEach(({ def, plan, startDay, phaseColor, phaseLight, phaseNum }) => {
    doc.addPage()
    drawPhasePage(doc, { def, plan, startDay, audienceLabel, phaseColor, phaseLight, phaseNum })
  })

  // ── 4. Investment summary ─────────────────────────────────────────────────
  doc.addPage()
  drawSummaryPage(doc, { lab, budget })

  // ── 5. Footers ────────────────────────────────────────────────────────────
  addFooters(doc, doc.getNumberOfPages(), companyName || 'Cliente', today)

  // ── 6. Save ───────────────────────────────────────────────────────────────
  const filename = `Lab-Meta-Ads-${(companyName || 'Cliente').replace(/\s+/g, '-')}.pdf`
  doc.save(filename)
}
