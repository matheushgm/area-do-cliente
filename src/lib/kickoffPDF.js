// PDF do Kickoff — segue o mesmo padrão de src/utils/exportPDF.js
// (HTML + window.print()). Duas páginas: diagnóstico visual + perguntas/respostas.

import { PILLARS, PILLARS_BY_ID } from '../components/Kickoff/KickoffQuestions'
import { extractScore } from '../components/Kickoff/KickoffScorer'
import { formatAnswer } from '../components/Kickoff/kickoffViewHelpers'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(s) {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function severityColor(score) {
  if (score < 31) return '#EF4444'
  if (score < 51) return '#F59E0B'
  if (score < 71) return '#EAB308'
  if (score < 86) return '#22C55E'
  return '#15803D'
}

function severityLabel(score) {
  if (score < 31) return 'Crítico'
  if (score < 51) return 'Frágil'
  if (score < 71) return 'Em estruturação'
  if (score < 86) return 'Saudável'
  return 'Excelente'
}

const BUSINESS_LABELS = {
  b2b: 'B2B',
  b2c: 'B2C',
  hibrido: 'Híbrido (B2B + B2C)',
}

// ─── SVG do radar pra dentro do HTML (clone do KickoffRadar em theme light) ───
function radarSvg(scores, width = 460) {
  const height = width
  const cx = width / 2
  const cy = height / 2
  const radius = Math.min(width, height) / 2 - 70

  const n = PILLARS.length
  const angleStep = (Math.PI * 2) / n
  const angleFor = (i) => -Math.PI / 2 + i * angleStep
  const pointAt = (i, ratio) => ({
    x: cx + Math.cos(angleFor(i)) * radius * ratio,
    y: cy + Math.sin(angleFor(i)) * radius * ratio,
  })

  const stageFillColor = '#7C3AED'

  const rings = [0.25, 0.5, 0.75, 1].map((ratio) => {
    return PILLARS.map((_, i) => {
      const { x, y } = pointAt(i, ratio)
      return `${x},${y}`
    }).join(' ')
  })

  const polyPoints = PILLARS.map((p, i) => {
    const s = scores[p.id] ?? 0
    const r = Math.max(0, Math.min(100, s)) / 100
    const { x, y } = pointAt(i, r)
    return `${x},${y}`
  }).join(' ')

  const labels = PILLARS.map((p, i) => {
    const { x, y } = pointAt(i, 1.20)
    const a = angleFor(i)
    const cos = Math.cos(a)
    const anchor = Math.abs(cos) < 0.2 ? 'middle' : cos > 0 ? 'start' : 'end'
    const s = scores[p.id] ?? 0
    return `
      <text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="middle" font-size="13" font-weight="700" fill="#0F172A">${esc(p.short)}</text>
      <text x="${x}" y="${y + 16}" text-anchor="${anchor}" dominant-baseline="middle" font-size="13" font-weight="800" fill="#000000">${s}</text>
    `
  }).join('')

  const axes = PILLARS.map((_, i) => {
    const { x, y } = pointAt(i, 1)
    return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#CBD5E1" stroke-width="1"/>`
  }).join('')

  const ringsHtml = rings.map((pts) =>
    `<polygon points="${pts}" fill="none" stroke="#E2E8F0" stroke-width="1"/>`
  ).join('')

  return `
    <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${ringsHtml}
      ${axes}
      <polygon points="${polyPoints}" fill="${stageFillColor}" fill-opacity="0.25" stroke="${stageFillColor}" stroke-width="2"/>
      ${labels}
    </svg>
  `
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const KICKOFF_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 13px;
    color: #1a1a2e;
    background: #fff;
    padding: 32px 40px;
    max-width: 900px;
    margin: 0 auto;
  }
  .header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    border-bottom: 2px solid #164496;
    padding-bottom: 16px;
    margin-bottom: 24px;
  }
  .logo {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #164496;
  }
  .doc-title { font-size: 22px; font-weight: 800; color: #0F172A; margin-bottom: 2px; }
  .doc-subtitle { font-size: 13px; color: #64748B; }
  .doc-date { font-size: 11px; color: #94A3B8; text-align: right; margin-top: 4px; }

  .stage-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 22px;
    border-radius: 12px;
    border-left: 6px solid var(--stage-color, #7C3AED);
    background: #F8FAFC;
    margin-bottom: 24px;
  }
  .stage-card .stage-label-tag {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #64748B;
    margin-bottom: 4px;
  }
  .stage-card .stage-name { font-size: 22px; font-weight: 900; color: #0F172A; }
  .stage-card .stage-desc { font-size: 12px; color: #475569; margin-top: 4px; max-width: 480px; }
  .stage-card .stage-score-wrap { text-align: right; }
  .stage-card .stage-score { font-size: 44px; font-weight: 900; color: var(--stage-color, #7C3AED); line-height: 1; }
  .stage-card .stage-score-suffix { font-size: 11px; color: #64748B; font-weight: 700; }

  .grid-2 { display: grid; grid-template-columns: 1.1fr 1fr; gap: 22px; }
  .section-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #164496;
    border-bottom: 1px solid #D8E0F0;
    padding-bottom: 6px;
    margin-bottom: 14px;
  }
  .radar-card { padding: 14px; border-radius: 10px; border: 1px solid #E2E8F0; background: #fff; text-align: center; }
  .bars { display: flex; flex-direction: column; gap: 10px; }
  .bar-row { display: flex; flex-direction: column; gap: 4px; }
  .bar-head { display: flex; align-items: baseline; justify-content: space-between; font-size: 12px; }
  .bar-head .bar-label { font-weight: 600; color: #0F172A; }
  .bar-head .bar-score { font-weight: 800; font-variant-numeric: tabular-nums; }
  .bar-track { height: 8px; border-radius: 99px; background: #E2E8F0; overflow: hidden; }
  .bar-fill  { height: 100%; border-radius: 99px; }
  .bar-tag   { font-size: 10px; color: #64748B; }

  .qa-section { page-break-before: always; padding-top: 8px; }
  .qa-section h1 { font-size: 18px; font-weight: 800; color: #0F172A; margin-bottom: 14px; }
  .qa-card {
    padding: 12px 14px; border-radius: 10px;
    background: #F8FAFC; border: 1px solid #E2E8F0;
    margin-bottom: 8px;
    page-break-inside: avoid;
  }
  .qa-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 2px; }
  .qa-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 3px; }
  .qa-index { font-size: 9px; font-weight: 700; color: #94A3B8; }
  .qa-pillars {
    font-size: 8px; font-weight: 800; padding: 1px 7px; border-radius: 99px;
    text-transform: uppercase; letter-spacing: 0.05em;
    background: #EDE9FE; color: #7C3AED;
  }
  .qa-question { font-size: 12px; font-weight: 700; color: #0F172A; line-height: 1.4; }
  .qa-score { font-size: 13px; font-weight: 900; font-variant-numeric: tabular-nums; text-align: right; flex-shrink: 0; }
  .qa-score-suffix { font-size: 8px; color: #94A3B8; font-weight: 700; }
  .qa-answer-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #94A3B8; font-weight: 700; margin: 6px 0 2px; }
  .qa-answer { font-size: 11.5px; color: #1F2937; line-height: 1.5; white-space: pre-wrap; }
  .qa-answer.empty { font-style: italic; color: #94A3B8; }

  .print-btn {
    position: fixed; bottom: 24px; right: 24px;
    background: #164496; color: white;
    border: none; border-radius: 10px;
    padding: 12px 24px; font-size: 14px; font-weight: 700;
    cursor: pointer; box-shadow: 0 4px 14px rgba(22,68,150,0.35);
    display: flex; align-items: center; gap: 8px;
  }
  .print-btn:hover { background: #0F3380; }
  @media print {
    .print-btn { display: none !important; }
    body { padding: 20px 24px; }
    .stage-card { page-break-inside: avoid; }
  }
`

// ─── Main ─────────────────────────────────────────────────────────────────────

export function exportKickoffPDF({ project, kickoff, questions = [] }) {
  const companyName = project.companyName || project.company_name || 'Cliente'
  const businessLabel = BUSINESS_LABELS[kickoff.businessType] || kickoff.businessType
  const stageColor = kickoff.stageColor || '#7C3AED'

  const sortedRows = [...PILLARS]
    .map((p) => ({ ...p, score: kickoff.scores?.[p.id] ?? 0 }))
    .sort((a, b) => a.score - b.score)

  const barsHtml = sortedRows.map((row) => {
    const color = severityColor(row.score)
    return `
      <div class="bar-row">
        <div class="bar-head">
          <span class="bar-label">${esc(row.label)}</span>
          <span class="bar-score" style="color:${color}">${row.score}</span>
        </div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max(2, row.score)}%; background:${color}"></div></div>
        <div class="bar-tag">${severityLabel(row.score)}</div>
      </div>
    `
  }).join('')

  const radarHtml = radarSvg(kickoff.scores || {}, 460)

  // ── Perguntas e respostas ─────────────────────────────────────────────────
  const answers = kickoff.answers || {}
  const qaHtml = questions.map((q, i) => {
    const raw = answers[q.id]
    const formatted = formatAnswer(q, raw)
    const partial = extractScore(q, raw)
    const isAnswered = partial != null
    const scoreColor = isAnswered ? severityColor(partial) : '#94A3B8'
    const pillarLabels = (q.pillarIds || [])
      .map((pid) => PILLARS_BY_ID[pid]?.short || pid)
      .join(' · ')

    return `
      <div class="qa-card">
        <div class="qa-head">
          <div>
            <div class="qa-meta">
              <span class="qa-index">#${i + 1}</span>
              ${pillarLabels ? `<span class="qa-pillars">${esc(pillarLabels)}</span>` : ''}
            </div>
            <div class="qa-question">${esc(q.label)}</div>
          </div>
          <div class="qa-score" style="color:${scoreColor}">
            ${isAnswered ? partial : '—'}<span class="qa-score-suffix"> /100</span>
          </div>
        </div>
        <div class="qa-answer-label">Resposta</div>
        <div class="qa-answer${isAnswered ? '' : ' empty'}">${esc(formatted)}</div>
      </div>
    `
  }).join('')

  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Diagnóstico Kickoff — ${esc(companyName)}</title>
  <style>${KICKOFF_CSS}</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">Revenue Lab</div>
      <div class="doc-title">Diagnóstico de Kickoff</div>
      <div class="doc-subtitle">${esc(companyName)} · ${esc(businessLabel)}</div>
    </div>
    <div class="doc-date">Gerado em ${today}</div>
  </div>

  <div class="stage-card" style="--stage-color:${stageColor}">
    <div>
      <div class="stage-label-tag">Estágio do negócio</div>
      <div class="stage-name">${esc(kickoff.stageLabel)}</div>
      <div class="stage-desc">${esc(kickoff.stageDesc || '')}</div>
    </div>
    <div class="stage-score-wrap">
      <div class="stage-score">${kickoff.totalScore}</div>
      <div class="stage-score-suffix">/ 100</div>
    </div>
  </div>

  <div class="grid-2">
    <div>
      <div class="section-title">Radar dos 9 pilares</div>
      <div class="radar-card">${radarHtml}</div>
    </div>
    <div>
      <div class="section-title">Mapa de fraquezas</div>
      <div class="bars">${barsHtml}</div>
    </div>
  </div>

  <section class="qa-section">
    <h1>Perguntas e respostas</h1>
    ${qaHtml}
  </section>

  <button class="print-btn" onclick="window.print()">🖨️ Salvar como PDF</button>
</body>
</html>`

  const win = window.open('', '_blank', 'width=1000,height=800')
  if (!win) { alert('Permita pop-ups para exportar o PDF.'); return }
  win.document.write(html)
  win.document.close()
}
