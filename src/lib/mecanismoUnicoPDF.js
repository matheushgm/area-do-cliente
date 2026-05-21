// PDF do Mecanismo Único — segue o mesmo padrão de src/utils/exportPDF.js
// e src/lib/kickoffPDF.js (HTML + window.print()). Cobre as 6 seções do
// playbook, o pitch montado, a análise IA e o posicionamento recomendado
// (quando esses dois últimos existirem).

import {
  VILOES, TIPOS_PROVA, FORMATOS_NOME, TECNICAS,
  CRITERIOS_VALIDACAO, TESTE_AMIGO,
  countValidacao, vereditoValidacao,
} from '../components/MecanismoUnico/mecanismoUnicoData'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function esc(s) {
  if (s == null) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Conversor markdown → HTML simples — suficiente pra ## headers, **bold**,
// *italic*, listas e parágrafos do output do Claude.
function mdToHtml(md) {
  if (!md) return ''
  const lines = String(md).split('\n')
  const out = []
  let inList = false
  for (const line of lines) {
    const t = line.trim()
    if (/^### /.test(t)) { if (inList) { out.push('</ul>'); inList = false } out.push(`<h3>${esc(t.slice(4))}</h3>`); continue }
    if (/^## /.test(t))  { if (inList) { out.push('</ul>'); inList = false } out.push(`<h2>${esc(t.slice(3))}</h2>`); continue }
    if (/^# /.test(t))   { if (inList) { out.push('</ul>'); inList = false } out.push(`<h1>${esc(t.slice(2))}</h1>`); continue }
    if (/^[-*]\s+/.test(t)) {
      if (!inList) { out.push('<ul>'); inList = true }
      out.push(`<li>${inline(t.replace(/^[-*]\s+/, ''))}</li>`)
      continue
    }
    if (!t) { if (inList) { out.push('</ul>'); inList = false } continue }
    if (inList) { out.push('</ul>'); inList = false }
    out.push(`<p>${inline(t)}</p>`)
  }
  if (inList) out.push('</ul>')
  return out.join('\n')
}

function inline(text) {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(.+?)\*(?!\*)/g, '$1<em>$2</em>')
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const MU_CSS = `
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
    border-bottom: 2px solid #7C3AED;
    padding-bottom: 16px;
    margin-bottom: 24px;
  }
  .logo {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #7C3AED;
  }
  .doc-title { font-size: 22px; font-weight: 800; color: #0F172A; margin-bottom: 2px; }
  .doc-subtitle { font-size: 13px; color: #64748B; }
  .doc-date { font-size: 11px; color: #94A3B8; text-align: right; margin-top: 4px; }

  .section {
    margin-bottom: 28px;
    padding-top: 4px;
  }
  .section-title {
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #7C3AED;
    border-bottom: 1px solid #E9D5FF;
    padding-bottom: 6px;
    margin-bottom: 14px;
  }
  .section-num {
    display: inline-block;
    width: 22px; height: 22px;
    border-radius: 99px;
    background: #7C3AED; color: #fff;
    font-size: 11px; font-weight: 800;
    text-align: center; line-height: 22px;
    margin-right: 8px;
    vertical-align: middle;
  }

  .qa-block { margin-bottom: 14px; page-break-inside: avoid; }
  .qa-label { font-size: 10px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  .qa-value { font-size: 12px; color: #0F172A; line-height: 1.55; }
  .qa-empty { font-size: 12px; color: #94A3B8; font-style: italic; }

  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
  th { background: #F1F5F9; color: #475569; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 8px 10px; text-align: left; border-bottom: 1px solid #E2E8F0; }
  td { padding: 7px 10px; border-bottom: 1px solid #F1F5F9; vertical-align: top; }

  ul.bullet-list { padding-left: 20px; margin-top: 4px; }
  ul.bullet-list li { font-size: 12px; color: #0F172A; line-height: 1.55; margin-bottom: 3px; }

  .chip {
    display: inline-block; padding: 2px 8px; border-radius: 99px;
    font-size: 10px; font-weight: 700;
    background: #F3E8FF; color: #7C3AED;
    margin: 2px 3px 2px 0;
  }

  .pitch-card {
    background: #FAF5FF;
    border: 2px solid #E9D5FF;
    border-radius: 12px;
    padding: 18px;
    margin-bottom: 20px;
    page-break-inside: avoid;
  }
  .pitch-card h2 { font-size: 14px; font-weight: 800; color: #6D28D9; margin: 12px 0 4px; text-transform: none; letter-spacing: 0; border: none; padding: 0; }
  .pitch-card p { font-size: 12px; color: #1F2937; line-height: 1.6; margin-bottom: 6px; }
  .pitch-card strong { color: #0F172A; }

  .validacao-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px; }
  .validacao-item { padding: 8px 10px; border-radius: 8px; background: #F8FAFC; border: 1px solid #E2E8F0; font-size: 11px; }
  .validacao-yes { background: #ECFDF5; border-color: #A7F3D0; color: #065F46; }
  .validacao-no  { background: #FEF2F2; border-color: #FECACA; color: #991B1B; }
  .validacao-skip{ background: #F8FAFC; border-color: #E2E8F0; color: #64748B; }

  .veredito-card {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 18px; border-radius: 10px;
    border-left: 6px solid var(--veredito-color, #7C3AED);
    background: #F8FAFC;
    margin-top: 10px;
  }
  .veredito-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; color: #64748B; margin-bottom: 4px; }
  .veredito-text { font-size: 15px; font-weight: 800; color: #0F172A; }

  .ai-section { page-break-before: always; padding-top: 4px; }
  .ai-section h1 { font-size: 18px; font-weight: 800; color: #0F172A; margin-bottom: 12px; }
  .ai-prose h1 { font-size: 16px; font-weight: 800; color: #0F172A; margin: 16px 0 6px; }
  .ai-prose h2 { font-size: 14px; font-weight: 800; color: #7C3AED; margin: 14px 0 6px; }
  .ai-prose h3 { font-size: 12px; font-weight: 800; color: #0F172A; margin: 10px 0 4px; text-transform: uppercase; letter-spacing: 0.05em; }
  .ai-prose p  { font-size: 12px; line-height: 1.65; color: #1F2937; margin-bottom: 6px; }
  .ai-prose ul { padding-left: 20px; margin-bottom: 8px; }
  .ai-prose li { font-size: 12px; line-height: 1.6; color: #1F2937; margin-bottom: 3px; }
  .ai-prose strong { color: #0F172A; }
  .ai-prose em { color: #475569; }

  .print-btn {
    position: fixed; bottom: 24px; right: 24px;
    background: #7C3AED; color: white;
    border: none; border-radius: 10px;
    padding: 12px 24px; font-size: 14px; font-weight: 700;
    cursor: pointer; box-shadow: 0 4px 14px rgba(124,58,237,0.35);
    display: flex; align-items: center; gap: 8px;
  }
  .print-btn:hover { background: #6D28D9; }
  @media print {
    .print-btn { display: none !important; }
    body { padding: 20px 24px; }
    .section, .pitch-card, .veredito-card { page-break-inside: avoid; }
  }
`

// ─── Renderizadores por seção ─────────────────────────────────────────────────

function renderQA(label, value, empty = '— não preenchido —') {
  if (value == null || value === '' || (Array.isArray(value) && !value.length)) {
    return `<div class="qa-block"><div class="qa-label">${esc(label)}</div><div class="qa-empty">${esc(empty)}</div></div>`
  }
  return `<div class="qa-block"><div class="qa-label">${esc(label)}</div><div class="qa-value">${esc(String(value))}</div></div>`
}

function renderList(label, items, empty = '— não preenchido —') {
  if (!Array.isArray(items) || !items.length) {
    return `<div class="qa-block"><div class="qa-label">${esc(label)}</div><div class="qa-empty">${esc(empty)}</div></div>`
  }
  return `
    <div class="qa-block">
      <div class="qa-label">${esc(label)}</div>
      <ul class="bullet-list">${items.map((it) => `<li>${esc(it)}</li>`).join('')}</ul>
    </div>
  `
}

function renderTable(label, rows, columns, empty = '— não preenchido —') {
  if (!Array.isArray(rows) || !rows.length) {
    return `<div class="qa-block"><div class="qa-label">${esc(label)}</div><div class="qa-empty">${esc(empty)}</div></div>`
  }
  const headerHtml = columns.map((c) => `<th>${esc(c.label)}</th>`).join('')
  const rowsHtml = rows.map((row) => `
    <tr>${columns.map((c) => `<td>${esc(row[c.id] || '')}</td>`).join('')}</tr>
  `).join('')
  return `
    <div class="qa-block">
      <div class="qa-label">${esc(label)}</div>
      <table><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table>
    </div>
  `
}

function renderChips(label, ids, byId, empty = '— nenhum selecionado —') {
  if (!Array.isArray(ids) || !ids.length) {
    return `<div class="qa-block"><div class="qa-label">${esc(label)}</div><div class="qa-empty">${esc(empty)}</div></div>`
  }
  const labels = ids
    .map((id) => byId[id]?.label || id)
    .filter(Boolean)
  return `
    <div class="qa-block">
      <div class="qa-label">${esc(label)}</div>
      <div>${labels.map((l) => `<span class="chip">${esc(l)}</span>`).join('')}</div>
    </div>
  `
}

function buildPitchHTML(d) {
  const parts = []
  const header = [
    d.euAjudo     ? `<p><strong>Eu ajudo:</strong> ${esc(d.euAjudo)}</p>` : '',
    d.aConseguir  ? `<p><strong>A conseguir:</strong> ${esc(d.aConseguir)}</p>` : '',
    (d.atravesDo || d.nomeMecanismo) ? `<p><strong>Através do:</strong> ${esc(d.atravesDo || d.nomeMecanismo)}</p>` : '',
  ].filter(Boolean).join('')
  if (header) parts.push(header)

  const falhou = [d.porqueFalhou?.problema, d.porqueFalhou?.razao, d.porqueFalhou?.prova]
    .filter(Boolean).join(' ')
  if (falhou) parts.push(`<h2>Por que falhou até agora</h2><p>${esc(falhou)}</p>`)

  const funcionaParts = [
    d.porqueFunciona?.explicacao,
    (d.porqueFunciona?.diferente || d.porqueFunciona?.voce)
      ? `Diferente de ${d.porqueFunciona?.diferente || '...'}, ${d.porqueFunciona?.voce || '...'}.`
      : null,
  ].filter(Boolean).join(' ')
  if (funcionaParts) parts.push(`<h2>Por que vai funcionar</h2><p>${esc(funcionaParts)}</p>`)

  if (d.promessaPrazo || d.promessaResultado) {
    parts.push(`<h2>Promessa</h2><p>Em ${esc(d.promessaPrazo || '__')}, ${esc(d.promessaResultado || '__')}.</p>`)
  }

  return parts.join('')
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function exportMecanismoUnicoPDF({ project, mecanismoUnico }) {
  const companyName = project?.companyName || project?.company_name || 'Cliente'
  const d = mecanismoUnico || {}

  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  // ── Seção 1: Pesquisa ─────────────────────────────────────────────────────
  const sec1 = `
    <section class="section">
      <div class="section-title"><span class="section-num">1</span>Pesquisa de mercado</div>
      ${renderTable('Concorrentes mapeados', d.concorrentes, [
        { id: 'nome',   label: 'Concorrente' },
        { id: 'oferta', label: 'O que oferece' },
      ])}
      ${renderList('Padrões do mercado', d.padroesMercado)}
      ${renderList('Promessas comuns no nicho', d.promessasComuns)}
    </section>
  `

  // ── Seção 2: Cliente ──────────────────────────────────────────────────────
  const sec2 = `
    <section class="section">
      <div class="section-title"><span class="section-num">2</span>Mapeamento do cliente</div>
      ${renderTable('Tentativas anteriores', d.tentativas, [
        { id: 'tentou',    label: 'O que tentou' },
        { id: 'resultado', label: 'Resultado' },
      ])}
      ${renderList('Justificativas do próprio cliente', d.justificativas)}
    </section>
  `

  // ── Seção 3: Problema ─────────────────────────────────────────────────────
  const sec3 = `
    <section class="section">
      <div class="section-title"><span class="section-num">3</span>Mecanismo do problema</div>
      ${renderChips('Vilões selecionados', d.viloes, Object.fromEntries(VILOES.map((v) => [v.id, v])))}
      ${renderQA('Vilão principal', d.vilaoPrincipal)}
      ${renderQA('Por que é vilão', d.vilaoJustificativa)}
      <div class="qa-block">
        <div class="qa-label">Conexão lógica (vilão → problema → fracasso)</div>
        <div class="qa-value">
          <strong>Vilão:</strong> ${esc(d.conexao?.vilao || '—')}<br>
          <strong>Problema causado:</strong> ${esc(d.conexao?.problema || '—')}<br>
          <strong>Fracasso final:</strong> ${esc(d.conexao?.fracasso || '—')}
        </div>
      </div>
      ${renderChips('Tipos de prova selecionados', d.provas, Object.fromEntries(TIPOS_PROVA.map((p) => [p.id, p])))}
      ${renderQA('Texto da prova', d.provaTexto)}
    </section>
  `

  // ── Seção 4: Solução ──────────────────────────────────────────────────────
  const formatoNomeLabel = FORMATOS_NOME.find((f) => f.id === d.formatoNome)?.label
  const tecnicasHtml = Object.entries(d.tecnicas || {})
    .filter(([, v]) => v && String(v).trim())
    .map(([techId, val]) => {
      const tecnica = TECNICAS.find((t) => t.id === techId)
      return `<div class="qa-block"><div class="qa-label">${esc(tecnica?.label || techId)}</div><div class="qa-value">${esc(val)}</div></div>`
    }).join('')
  const sec4 = `
    <section class="section">
      <div class="section-title"><span class="section-num">4</span>Mecanismo da solução</div>
      ${renderTable('Diferenciais', d.diferentes, [
        { id: 'deles', label: 'Diferente de...' },
        { id: 'voce',  label: 'Eu...' },
      ])}
      ${renderQA('Formato de nome escolhido', formatoNomeLabel)}
      ${renderQA('Nome final do mecanismo', d.nomeMecanismo)}
      ${tecnicasHtml || '<div class="qa-block"><div class="qa-label">Técnicas de "por que funciona"</div><div class="qa-empty">— não preenchido —</div></div>'}
    </section>
  `

  // ── Seção 5: Pitch montado ────────────────────────────────────────────────
  const pitchHTML = buildPitchHTML(d)
  const sec5 = `
    <section class="section">
      <div class="section-title"><span class="section-num">5</span>Pitch montado</div>
      ${pitchHTML
        ? `<div class="pitch-card">${pitchHTML}</div>`
        : `<div class="qa-empty">— pitch ainda não preenchido —</div>`
      }
    </section>
  `

  // ── Seção 6: Validação ────────────────────────────────────────────────────
  const count = countValidacao(d.validacao || {})
  const veredito = vereditoValidacao(d.validacao || {})
  const validacaoItems = CRITERIOS_VALIDACAO.map((c, i) => {
    const ans = (d.validacao || {})[c.id]
    const cls = ans === 'sim' ? 'validacao-yes' : ans === 'nao' ? 'validacao-no' : 'validacao-skip'
    const tag = ans === 'sim' ? '✓ Sim' : ans === 'nao' ? '✗ Não' : '— sem resposta —'
    return `<div class="validacao-item ${cls}"><strong>${i + 1}. ${esc(c.label)}</strong> — ${esc(c.desc)}<br><strong>${esc(tag)}</strong></div>`
  }).join('')
  const testeAmigoLabel = TESTE_AMIGO.find((t) => t.id === d.testeAmigo)?.label
  const sec6 = `
    <section class="section">
      <div class="section-title"><span class="section-num">6</span>Validação</div>
      <div class="validacao-grid">${validacaoItems}</div>
      <div class="veredito-card" style="--veredito-color:${veredito.color}">
        <div>
          <div class="veredito-label">Veredito (${count}/7)</div>
          <div class="veredito-text" style="color:${veredito.color}">${esc(veredito.label)}</div>
        </div>
      </div>
      ${testeAmigoLabel ? `<div class="qa-block" style="margin-top:14px"><div class="qa-label">Teste do amigo</div><div class="qa-value">${esc(testeAmigoLabel)}</div></div>` : ''}
    </section>
  `

  // ── Análise IA (pitch refinado) ───────────────────────────────────────────
  const aiHtml = d.aiAnalysis
    ? `
      <section class="ai-section">
        <h1>Pitch refinado com IA</h1>
        <div class="ai-prose">${mdToHtml(d.aiAnalysis)}</div>
      </section>
    `
    : ''

  // ── Posicionamento sugerido pela IA ──────────────────────────────────────
  const positioningHtml = d.positioningAI
    ? `
      <section class="ai-section">
        <h1>Posicionamento sugerido</h1>
        <div class="ai-prose">${mdToHtml(d.positioningAI)}</div>
      </section>
    `
    : ''

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mecanismo Único — ${esc(companyName)}</title>
  <style>${MU_CSS}</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">Revenue Lab · Mecanismo Único</div>
      <div class="doc-title">Playbook de diferenciação</div>
      <div class="doc-subtitle">${esc(companyName)}</div>
    </div>
    <div class="doc-date">Gerado em ${today}</div>
  </div>

  ${sec1}
  ${sec2}
  ${sec3}
  ${sec4}
  ${sec5}
  ${sec6}
  ${positioningHtml}
  ${aiHtml}

  <button class="print-btn" onclick="window.print()">🖨️ Salvar como PDF</button>
</body>
</html>`

  const win = window.open('', '_blank', 'width=1000,height=800')
  if (!win) { alert('Permita pop-ups para exportar o PDF.'); return }
  win.document.write(html)
  win.document.close()
}
