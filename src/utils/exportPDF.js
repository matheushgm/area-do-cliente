// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBRL(n) {
  if (n == null || !isFinite(n) || isNaN(n)) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
}

function fmtNum(n) {
  if (n == null || isNaN(n)) return '—'
  if (!isFinite(n)) return '∞'
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

function esc(s) {
  if (!s) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function mdToHTML(text) {
  if (!text) return ''
  return text
    .split('\n')
    .map((line) => {
      if (line.startsWith('### ')) return `<h3>${esc(line.slice(4))}</h3>`
      if (line.startsWith('## '))  return `<h2>${esc(line.slice(3))}</h2>`
      if (line.startsWith('# '))   return `<h1>${esc(line.slice(2))}</h1>`
      if (line.trim() === '')      return '<br>'
      // Bold: **text**
      const bold = esc(line).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      return `<p>${bold}</p>`
    })
    .join('\n')
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const PRINT_CSS = `
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
  section { margin-bottom: 28px; }
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
  .grid { display: grid; gap: 10px; }
  .grid-2 { grid-template-columns: 1fr 1fr; }
  .grid-3 { grid-template-columns: 1fr 1fr 1fr; }
  .grid-4 { grid-template-columns: 1fr 1fr 1fr 1fr; }
  .field {
    background: #F2F5FB;
    border: 1px solid #D8E0F0;
    border-radius: 8px;
    padding: 10px 12px;
  }
  .field-label { font-size: 10px; color: #94A3B8; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.05em; }
  .field-value { font-size: 13px; font-weight: 600; color: #0F172A; }
  .field-value.green  { color: #059669; }
  .field-value.purple { color: #164496; }
  .field-value.gold   { color: #D97706; }
  .field-value.red    { color: #DC2626; }
  .field-value.cyan   { color: #0284C7; }
  .chip {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 99px;
    background: #E4EBF7;
    color: #164496;
    font-size: 11px;
    font-weight: 600;
    margin: 2px;
  }
  .prose { line-height: 1.7; color: #334155; }
  .prose h1 { font-size: 17px; font-weight: 700; color: #0F172A; margin: 16px 0 6px; }
  .prose h2 { font-size: 15px; font-weight: 700; color: #164496; margin: 14px 0 5px; }
  .prose h3 { font-size: 13px; font-weight: 700; color: #0F172A; margin: 12px 0 4px; }
  .prose p  { margin-bottom: 6px; font-size: 12px; }
  .prose br { display: block; content: ''; margin: 4px 0; }
  .persona-block {
    border: 1px solid #D8E0F0;
    border-radius: 10px;
    padding: 16px;
    margin-bottom: 20px;
    page-break-inside: avoid;
  }
  .persona-name {
    font-size: 15px;
    font-weight: 700;
    color: #164496;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid #D8E0F0;
  }
  .qa-item { margin-bottom: 8px; }
  .qa-label { font-size: 10px; font-weight: 600; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; }
  .qa-value { font-size: 12px; color: #334155; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
  th { background: #EEF2F9; color: #164496; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 8px 10px; text-align: left; border-bottom: 2px solid #D8E0F0; }
  td { padding: 8px 10px; border-bottom: 1px solid #F1F5F9; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .channel-header { background: #EEF2F9; font-weight: 700; }
  .stage-row td { padding-left: 20px; background: #F5F8FD; }
  .campaign-row td { padding-left: 36px; font-size: 11px; color: #64748B; }
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
    .persona-block { page-break-inside: avoid; }
  }
`

// ─── Core printer ─────────────────────────────────────────────────────────────

function printHTML(title, subtitle, bodyHTML) {
  const today = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} — ${esc(subtitle)}</title>
  <style>${PRINT_CSS}</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">Revenue Lab · Internal</div>
      <div class="doc-title">${esc(title)}</div>
      <div class="doc-subtitle">${esc(subtitle)}</div>
    </div>
    <div class="doc-date">Gerado em ${today}</div>
  </div>
  ${bodyHTML}
  <button class="print-btn" onclick="window.print()">🖨️ Salvar como PDF</button>
</body>
</html>`

  const win = window.open('', '_blank', 'width=1000,height=800')
  if (!win) { alert('Permita pop-ups para exportar o PDF.'); return }
  win.document.write(html)
  win.document.close()
}

// ─── Onboarding PDF ───────────────────────────────────────────────────────────

const BUSINESS_LABELS = {
  b2b: 'B2B',
  local: 'Negócio Local',
  ecommerce: 'E-commerce',
  infoproduto: 'Infoproduto',
}

const MATURITY_LABELS = {
  '1': 'Iniciante',
  '2': 'Básico',
  '3': 'Intermediário',
  '4': 'Avançado',
  '5': 'Expert',
}

export function exportOnboardingPDF(project) {
  const competitors = (project.competitors || []).filter(Boolean)
  const otherPeople = (project.otherPeople || []).filter((p) => p?.name)

  const competitorsHTML = competitors.length
    ? `<section>
        <div class="section-title">🏆 Concorrentes</div>
        <div>${competitors.map((c) => `<span class="chip">${esc(c)}</span>`).join('')}</div>
      </section>`
    : ''

  const otherPeopleHTML = otherPeople.length
    ? `<section>
        <div class="section-title">👥 Outras Pessoas da Conta</div>
        <div class="grid grid-3">
          ${otherPeople.map((p) => `
            <div class="field">
              <div class="field-label">Nome</div>
              <div class="field-value">${esc(p.name)}</div>
              ${p.role ? `<div class="field-value" style="font-size:11px;color:#9ca3af;margin-top:2px">${esc(p.role)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </section>`
    : ''

  const servicesHTML = project.services?.length
    ? `<section>
        <div class="section-title">⚙️ Serviços Contratados</div>
        <div>${project.services.map((s) => `<span class="chip">${esc(s)}</span>`).join('')}</div>
      </section>`
    : ''

  const body = `
    <section>
      <div class="section-title">🏢 Dados da Empresa</div>
      <div class="grid grid-3">
        <div class="field"><div class="field-label">Tipo de Negócio</div><div class="field-value">${esc(BUSINESS_LABELS[project.businessType] || project.businessType)}</div></div>
        <div class="field"><div class="field-label">CNPJ</div><div class="field-value">${esc(project.cnpj || '—')}</div></div>
        <div class="field"><div class="field-label">Responsável</div><div class="field-value">${esc(project.responsibleName)}</div></div>
        <div class="field"><div class="field-label">Cargo</div><div class="field-value">${esc(project.responsibleRole)}</div></div>
        <div class="field"><div class="field-label">Data do Contrato</div><div class="field-value">${project.contractDate ? new Date(project.contractDate + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</div></div>
        <div class="field"><div class="field-label">Maturidade Digital</div><div class="field-value">${esc(MATURITY_LABELS[project.maturityLevel] || '—')}</div></div>
      </div>
    </section>
    ${project.productDescription ? `
    <section>
      <div class="section-title">🛍️ Produto / Serviço</div>
      <div class="field"><div class="field-value" style="font-weight:400;line-height:1.6">${esc(project.productDescription)}</div></div>
    </section>` : ''}
    ${project.mainGoal ? `
    <section>
      <div class="section-title">🎯 Objetivo Principal</div>
      <div class="field"><div class="field-value" style="font-weight:400">${esc(project.mainGoal)}</div></div>
    </section>` : ''}
    ${servicesHTML}
    <section>
      <div class="section-title">💰 Orçamento e Ticket</div>
      <div class="grid grid-3">
        <div class="field"><div class="field-label">Verba de Mídia</div><div class="field-value purple">${fmtBRL(project.mediaBudget)}</div></div>
        <div class="field"><div class="field-label">Fee de Gestão</div><div class="field-value">${fmtBRL(project.managementFee)}</div></div>
        <div class="field"><div class="field-label">Ticket Médio</div><div class="field-value green">${fmtBRL(project.averageTicket)}</div></div>
      </div>
    </section>
    ${competitorsHTML}
    ${otherPeopleHTML}
    ${project.additionalInfo ? `
    <section>
      <div class="section-title">📝 Informações Adicionais</div>
      <div class="field"><div class="field-value" style="font-weight:400;line-height:1.6">${esc(project.additionalInfo)}</div></div>
    </section>` : ''}
  `

  printHTML('Onboarding', project.companyName, body)
}

// ─── ROI Calculator PDF ───────────────────────────────────────────────────────

export function exportROIPDF(calc, result, project) {
  if (!result) return

  const body = `
    <section>
      <div class="section-title">💰 Investimento</div>
      <div class="grid grid-3">
        <div class="field"><div class="field-label">Orçamento em Mídia</div><div class="field-value purple">${fmtBRL(calc.mediaOrcamento)}</div></div>
        <div class="field"><div class="field-label">Custo de Marketing</div><div class="field-value">${fmtBRL(calc.custoMarketing)}</div></div>
        <div class="field"><div class="field-label">Total Investido</div><div class="field-value" style="font-size:16px">${fmtBRL(result.totalInvestimento)}</div></div>
      </div>
    </section>
    <section>
      <div class="section-title">📦 Produto / Serviço</div>
      <div class="grid grid-4">
        <div class="field"><div class="field-label">Ticket Médio</div><div class="field-value">${fmtBRL(calc.ticketMedio)}</div></div>
        <div class="field"><div class="field-label">Compras (LT)</div><div class="field-value">${calc.qtdCompras}x</div></div>
        <div class="field"><div class="field-label">Margem Bruta</div><div class="field-value">${calc.margemBruta}%</div></div>
        <div class="field"><div class="field-label">Lucro por Venda</div><div class="field-value green">${fmtBRL(result.lucroPorVenda)}</div></div>
      </div>
    </section>
    <section>
      <div class="section-title">🎯 Taxas de Conversão</div>
      <div class="grid grid-3">
        <div class="field"><div class="field-label">Lead → MQL</div><div class="field-value">${calc.taxaLead2MQL}%</div></div>
        <div class="field"><div class="field-label">MQL → SQL</div><div class="field-value">${calc.taxaMQL2SQL}%</div></div>
        <div class="field"><div class="field-label">SQL → Venda</div><div class="field-value">${calc.taxaSQL2Venda}%</div></div>
      </div>
    </section>
    <section>
      <div class="section-title">📊 Metas para ROI de ${calc.roiDesejado}%</div>
      <div class="grid grid-4">
        <div class="field"><div class="field-label">Leads Necessários</div><div class="field-value purple" style="font-size:20px">${fmtNum(result.leadsNecessarios)}</div><div class="field-label" style="margin-top:4px">CPL: ${fmtBRL(result.custoPorLead)}</div></div>
        <div class="field"><div class="field-label">MQLs Necessários</div><div class="field-value cyan" style="font-size:20px">${fmtNum(result.mqlsNecessarios)}</div><div class="field-label" style="margin-top:4px">CPM: ${fmtBRL(result.custoPorMQL)}</div></div>
        <div class="field"><div class="field-label">SQLs Necessários</div><div class="field-value" style="font-size:20px;color:#0891b2">${fmtNum(result.sqlsNecessarios)}</div><div class="field-label" style="margin-top:4px">CPS: ${fmtBRL(result.custoPorSQL)}</div></div>
        <div class="field"><div class="field-label">Vendas Necessárias</div><div class="field-value green" style="font-size:20px">${fmtNum(result.vendasNecessarias)}</div><div class="field-label" style="margin-top:4px">CAC: ${fmtBRL(result.cac)}</div></div>
      </div>
    </section>
    <section>
      <div class="section-title">💹 Financeiro Projetado</div>
      <div class="grid grid-4">
        <div class="field"><div class="field-label">Total Investido</div><div class="field-value">${fmtBRL(result.totalInvestimento)}</div></div>
        <div class="field"><div class="field-label">Faturamento Alvo</div><div class="field-value purple">${fmtBRL(result.faturamento)}</div></div>
        <div class="field"><div class="field-label">Lucro Bruto</div><div class="field-value cyan">${fmtBRL(result.lucroBruto)}</div></div>
        <div class="field"><div class="field-label">Lucro Líquido</div><div class="field-value ${result.lucroLiquido >= 0 ? 'green' : 'red'}">${fmtBRL(result.lucroLiquido)}</div></div>
      </div>
    </section>
    <section>
      <div class="section-title">⚖️ Ponto de Equilíbrio</div>
      <div class="grid grid-2">
        <div class="field"><div class="field-label">Vendas mínimas (ROI 0%)</div><div class="field-value gold" style="font-size:18px">${fmtNum(result.vendasBreakeven)} vendas</div></div>
        <div class="field"><div class="field-label">CAC</div><div class="field-value gold" style="font-size:18px">${fmtBRL(result.cac)}</div></div>
      </div>
    </section>
  `

  printHTML('Calculadora de ROI', project.companyName, body)
}

// ─── Personas PDF ─────────────────────────────────────────────────────────────

const PERSONA_QUESTIONS = [
  { id: 'resultado', label: 'Resultado Percebido' },
  { id: 'acoes',     label: 'O que ele precisa fazer' },
  { id: 'tempo',     label: 'Prazo para o resultado' },
  { id: 'objecoes',  label: 'Objeções' },
  { id: 'sonhos',    label: 'Sonhos' },
  { id: 'erros',     label: 'Erros comuns' },
  { id: 'medos',     label: 'Medos' },
  { id: 'sinais',    label: 'Sinais do problema' },
  { id: 'valores',   label: 'Valores / contra o senso comum' },
  { id: 'habitos',   label: 'Hábitos' },
]

export function exportPersonasPDF(personas, project) {
  const blocksHTML = personas.map((persona) => {
    const answersHTML = PERSONA_QUESTIONS.map((q) => {
      const answers = (persona.answers?.[q.id] || []).filter((a) => a.trim())
      if (!answers.length) return ''
      return `<div class="qa-item">
        <div class="qa-label">${esc(q.label)}</div>
        <div class="qa-value">${answers.map((a, i) => `${i + 1}. ${esc(a)}`).join(' · ')}</div>
      </div>`
    }).filter(Boolean).join('')

    const generatedHTML = persona.generatedProfile
      ? `<div style="margin-top:16px;padding-top:12px;border-top:1px dashed #e9d5ff">
          <div class="qa-label" style="margin-bottom:8px">✨ Perfil Gerado por IA</div>
          <div class="prose">${mdToHTML(persona.generatedProfile)}</div>
        </div>`
      : ''

    return `<div class="persona-block">
      <div class="persona-name">${esc(persona.name || 'Persona')}</div>
      ${answersHTML}
      ${generatedHTML}
    </div>`
  }).join('')

  printHTML('ICP / Persona', project.companyName, blocksHTML)
}

// ─── Oferta Matadora PDF ──────────────────────────────────────────────────────

export function exportOfertaPDF(oferta, project) {
  const bonusValidos = (oferta.bonus || []).filter((b) => b.trim())

  const fieldsHTML = `
    <section>
      <div class="section-title">📋 Dados da Oferta</div>
      <div class="grid" style="grid-template-columns:1fr;">
        ${oferta.nome ? `<div class="field"><div class="field-label">🏷️ Nome da Oferta</div><div class="field-value purple">${esc(oferta.nome)}</div></div>` : ''}
        ${oferta.resultadoSonho ? `<div class="field"><div class="field-label">✨ Resultado do Sonho</div><div class="field-value" style="font-weight:400;line-height:1.6">${esc(oferta.resultadoSonho)}</div></div>` : ''}
        ${oferta.porqueVaiFuncionar ? `<div class="field"><div class="field-label">💡 Por que vai funcionar</div><div class="field-value" style="font-weight:400;line-height:1.6">${esc(oferta.porqueVaiFuncionar)}</div></div>` : ''}
        ${oferta.velocidade ? `<div class="field"><div class="field-label">⚡ Velocidade</div><div class="field-value" style="font-weight:400">${esc(oferta.velocidade)}</div></div>` : ''}
        ${oferta.esforcoMinimo ? `<div class="field"><div class="field-label">🤝 Esforço Mínimo do Cliente</div><div class="field-value" style="font-weight:400;line-height:1.6">${esc(oferta.esforcoMinimo)}</div></div>` : ''}
        ${oferta.garantia ? `<div class="field"><div class="field-label">🛡️ Garantia</div><div class="field-value" style="font-weight:400;line-height:1.6">${esc(oferta.garantia)}</div></div>` : ''}
        ${oferta.escassez ? `<div class="field"><div class="field-label">🔥 Escassez / Urgência</div><div class="field-value" style="font-weight:400">${esc(oferta.escassez)}</div></div>` : ''}
      </div>
    </section>
  `

  const bonusHTML = bonusValidos.length ? `
    <section>
      <div class="section-title">🎁 Stack de Bônus</div>
      <div class="grid" style="grid-template-columns:1fr;">
        ${bonusValidos.map((b, i) => `
          <div class="field"><div class="field-label">Bônus ${i + 1}</div><div class="field-value" style="font-weight:400">${esc(b)}</div></div>
        `).join('')}
      </div>
    </section>` : ''

  const generatedHTML = oferta.generatedOffer ? `
    <section>
      <div class="section-title">🤖 Oferta Matadora Gerada por IA</div>
      <div class="prose">${mdToHTML(oferta.generatedOffer)}</div>
    </section>` : ''

  printHTML('Oferta Matadora', project.companyName, fieldsHTML + bonusHTML + generatedHTML)
}

// ─── Campaign Planner PDF ─────────────────────────────────────────────────────

const STAGE_LABELS = { topo: 'Topo de Funil', meio: 'Meio de Funil', fundo: 'Fundo de Funil' }
const STAGE_KEYS   = ['topo', 'meio', 'fundo']

export function exportCampaignPDF(campaignPlan, project) {
  if (!campaignPlan?.totalBudget) return

  const today   = new Date()
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  const daysLeft = Math.max(lastDay.getDate() - today.getDate() + 1, 1)
  const monthLabel = today.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const { totalBudget, channels = [] } = campaignPlan

  const rows = channels.map((ch) => {
    const chMon = totalBudget * (ch.percentage / 100)
    const chDay = chMon / daysLeft

    const channelRow = `<tr class="channel-header">
      <td><strong>${esc(ch.name)}</strong></td>
      <td>${ch.percentage}%</td>
      <td>${fmtBRL(chMon)}</td>
      <td>${fmtBRL(chDay)}</td>
    </tr>`

    const stageRows = STAGE_KEYS.map((key) => {
      const st = ch.stages?.[key]
      if (!st || st.percentage === 0) return ''
      const stMon = chMon * (st.percentage / 100)
      const stDay = stMon / daysLeft

      const campRows = (st.campaigns || []).map((c) => {
        if (!c.name && !c.percentage) return ''
        const cMon = stMon * (c.percentage / 100)
        return `<tr class="campaign-row">
          <td>${esc(c.name || '(sem nome)')}</td>
          <td>${c.percentage}%</td>
          <td>${fmtBRL(cMon)}</td>
          <td>${fmtBRL(cMon / daysLeft)}</td>
        </tr>`
      }).join('')

      return `<tr class="stage-row">
        <td>${esc(STAGE_LABELS[key])}</td>
        <td>${st.percentage}%</td>
        <td>${fmtBRL(stMon)}</td>
        <td>${fmtBRL(stDay)}</td>
      </tr>${campRows}`
    }).join('')

    return channelRow + stageRows
  }).join('')

  const body = `
    <section>
      <div class="section-title">📅 Resumo do Orçamento</div>
      <div class="grid grid-3">
        <div class="field"><div class="field-label">Orçamento Total Mensal</div><div class="field-value purple" style="font-size:20px">${fmtBRL(totalBudget)}</div></div>
        <div class="field"><div class="field-label">Orçamento Diário Médio</div><div class="field-value">${fmtBRL(totalBudget / daysLeft)}</div></div>
        <div class="field"><div class="field-label">Referência</div><div class="field-value" style="font-size:12px;text-transform:capitalize">${monthLabel} · ${daysLeft} dias restantes</div></div>
      </div>
    </section>
    <section>
      <div class="section-title">📊 Distribuição por Canal, Funil e Campanhas</div>
      <table>
        <thead>
          <tr>
            <th>Canal / Etapa / Campanha</th>
            <th>% Verba</th>
            <th>Mensal</th>
            <th>Diário</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `

  printHTML('Planejamento de Campanhas', project.companyName, body)
}

// ─── Estratégia Digital PDF ────────────────────────────────────────────────────

const STRATEGY_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 13px;
    color: #0F172A;
    background: #fff;
    padding: 0;
    max-width: 900px;
    margin: 0 auto;
    -webkit-font-smoothing: antialiased;
  }

  /* ── Cover ── */
  .cover {
    background: linear-gradient(135deg, #0D2E74 0%, #164496 55%, #1B5DD6 100%);
    padding: 52px 48px 40px;
    color: white;
    position: relative;
    overflow: hidden;
  }
  .cover::before {
    content: '';
    position: absolute;
    top: -60px; right: -60px;
    width: 320px; height: 320px;
    background: rgba(255,255,255,0.04);
    border-radius: 50%;
  }
  .cover::after {
    content: '';
    position: absolute;
    bottom: -80px; left: -40px;
    width: 240px; height: 240px;
    background: rgba(255,255,255,0.03);
    border-radius: 50%;
  }
  .cover-tag {
    font-size: 10px; font-weight: 700; letter-spacing: 0.18em;
    text-transform: uppercase; color: rgba(255,255,255,0.55);
    margin-bottom: 20px;
  }
  .cover-company {
    font-size: 38px; font-weight: 900; line-height: 1.1;
    color: white; margin-bottom: 10px;
  }
  .cover-subtitle {
    font-size: 14px; color: rgba(255,255,255,0.65); margin-bottom: 36px;
  }
  .cover-meta {
    display: flex; gap: 28px; font-size: 11px; color: rgba(255,255,255,0.5);
    border-top: 1px solid rgba(255,255,255,0.12);
    padding-top: 20px; margin-top: 10px;
  }
  .cover-meta strong { color: rgba(255,255,255,0.85); display: block; font-weight: 600; font-size: 12px; }

  /* ── KPI Strip ── */
  .kpi-strip {
    display: grid; grid-template-columns: repeat(4, 1fr);
    background: #F2F6FF;
    border-bottom: 1px solid #D8E0F0;
  }
  .kpi-item {
    padding: 18px 20px;
    border-right: 1px solid #D8E0F0;
  }
  .kpi-item:last-child { border-right: none; }
  .kpi-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #94A3B8; margin-bottom: 5px; }
  .kpi-value { font-size: 20px; font-weight: 900; color: #164496; line-height: 1; }
  .kpi-sub { font-size: 10px; color: #94A3B8; margin-top: 3px; }

  /* ── Content ── */
  .content { padding: 40px 48px; }

  /* ── Section ── */
  .section { margin-bottom: 36px; page-break-inside: avoid; }
  .section-num {
    display: inline-flex; align-items: center; justify-content: center;
    width: 26px; height: 26px; border-radius: 8px;
    background: #164496; color: white;
    font-size: 11px; font-weight: 800;
    margin-right: 10px; flex-shrink: 0; vertical-align: middle;
  }
  .section-title {
    font-size: 15px; font-weight: 800; color: #0F172A;
    border-bottom: 2px solid #EEF2F9;
    padding-bottom: 10px; margin-bottom: 16px;
    display: flex; align-items: center;
  }
  .section-content { color: #334155; line-height: 1.75; font-size: 13px; }
  .section-content p { margin-bottom: 8px; }
  .section-content strong { font-weight: 700; color: #0F172A; }
  .section-content ul, .section-content ol { padding-left: 18px; }
  .section-content li { margin-bottom: 4px; }
  .section-content h3 { font-size: 13px; font-weight: 700; color: #164496; margin: 12px 0 6px; }
  .section-content h2 { font-size: 14px; font-weight: 800; color: #0F172A; margin: 16px 0 8px; }
  .section-content br { display: block; content: ''; margin: 4px 0; }

  /* ── Data panels ── */
  .data-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
  .data-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 12px; }
  .data-card {
    background: #F8FAFE; border: 1px solid #D8E0F0;
    border-radius: 10px; padding: 12px 14px;
  }
  .data-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94A3B8; margin-bottom: 4px; }
  .data-value { font-size: 14px; font-weight: 800; color: #164496; }
  .data-value.green  { color: #059669; }
  .data-value.gold   { color: #D97706; }
  .data-value.dark   { color: #0F172A; }

  /* ── Funnel ── */
  .funnel-row {
    display: flex; align-items: stretch; gap: 0;
    background: #F8FAFE; border: 1px solid #D8E0F0;
    border-radius: 12px; overflow: hidden; margin-top: 12px;
  }
  .funnel-stage {
    flex: 1; padding: 14px 10px; text-align: center;
    border-right: 1px solid #D8E0F0; position: relative;
  }
  .funnel-stage:last-child { border-right: none; }
  .funnel-stage-num { font-size: 20px; font-weight: 900; color: #164496; }
  .funnel-stage-label { font-size: 10px; font-weight: 600; color: #94A3B8; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.06em; }
  .funnel-stage-pct { font-size: 11px; font-weight: 700; color: #059669; margin-top: 4px; }
  .funnel-arrow {
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; color: #94A3B8; padding: 0 2px;
    background: #F8FAFE;
  }

  /* ── Personas ── */
  .persona-card {
    background: #F8FAFE; border: 1px solid #D8E0F0;
    border-radius: 10px; padding: 14px 16px; margin-bottom: 10px;
  }
  .persona-name { font-size: 14px; font-weight: 800; color: #164496; margin-bottom: 10px; }
  .persona-section { margin-bottom: 8px; }
  .persona-section-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94A3B8; margin-bottom: 3px; }
  .persona-item { font-size: 12px; color: #334155; line-height: 1.5; }

  /* ── Channels ── */
  .channel-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid #EEF2F9; }
  .channel-row:last-child { border-bottom: none; }
  .channel-name { font-size: 12px; font-weight: 600; color: #0F172A; width: 120px; flex-shrink: 0; }
  .channel-bar-wrap { flex: 1; background: #E8EDF6; border-radius: 4px; height: 8px; overflow: hidden; }
  .channel-bar { height: 100%; border-radius: 4px; background: linear-gradient(90deg, #164496, #1B5DD6); }
  .channel-pct { font-size: 11px; font-weight: 700; color: #164496; width: 32px; text-align: right; flex-shrink: 0; }
  .channel-val { font-size: 11px; color: #94A3B8; width: 80px; text-align: right; flex-shrink: 0; }

  /* ── Footer ── */
  .footer {
    margin-top: 48px; padding-top: 20px; border-top: 1px solid #E8EDF6;
    display: flex; justify-content: space-between; align-items: center;
    font-size: 10px; color: #94A3B8;
  }
  .footer-brand { font-weight: 700; color: #164496; font-size: 11px; }

  /* ── Print ── */
  .print-btn {
    position: fixed; bottom: 24px; right: 24px;
    background: #164496; color: white;
    border: none; border-radius: 12px;
    padding: 14px 28px; font-size: 14px; font-weight: 700;
    cursor: pointer; box-shadow: 0 4px 20px rgba(22,68,150,0.35);
    display: flex; align-items: center; gap: 8px;
    font-family: inherit;
  }
  .print-btn:hover { background: #0F3380; }
  @media print {
    .print-btn { display: none !important; }
    body { padding: 0; }
    .cover { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .kpi-strip { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .channel-bar { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .section-num { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  }
`

export function exportEstrategiaPDF(project, narrativa) {
  const today = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  const BTYPE = { b2b: 'B2B', local: 'Negócio Local', ecommerce: 'E-commerce', infoproduto: 'Infoproduto' }
  const roi       = project.roiResult
  const plan      = project.campaignPlan
  const personas  = (project.personas || []).filter((p) => p.name || p.answers)
  const oferta    = project.ofertaData
  const channels  = plan?.channels || []

  // ── Cover ───────────────────────────────────────────────────────────────────
  const logoHTML = project.logoBase64
    ? `<img src="${project.logoBase64}" style="height:48px;width:48px;object-fit:cover;border-radius:10px;margin-bottom:16px;border:2px solid rgba(255,255,255,0.2)" />`
    : ''

  const cover = `
    <div class="cover">
      ${logoHTML}
      <div class="cover-tag">Revenue Lab · Estratégia Digital</div>
      <div class="cover-company">${esc(project.companyName)}</div>
      <div class="cover-subtitle">Estratégia de Marketing Digital Personalizada</div>
      <div class="cover-meta">
        <div><strong>${esc(BTYPE[project.businessType] || project.businessType || '—')}</strong> Segmento</div>
        ${project.responsibleName ? `<div><strong>${esc(project.responsibleName)}</strong> Responsável</div>` : ''}
        ${roi ? `<div><strong>${project.roiResult?.roiDesejado || 0}% ROI</strong> Meta</div>` : ''}
        <div><strong>${today}</strong> Elaborado em</div>
      </div>
    </div>`

  // ── KPI Strip ────────────────────────────────────────────────────────────────
  const kpiStrip = roi ? `
    <div class="kpi-strip">
      <div class="kpi-item">
        <div class="kpi-label">Investimento/Mês</div>
        <div class="kpi-value">${fmtBRL(roi.totalInvestimento)}</div>
        <div class="kpi-sub">Mídia: ${fmtBRL(roi.mediaOrcamento)}</div>
      </div>
      <div class="kpi-item">
        <div class="kpi-label">Meta de Faturamento</div>
        <div class="kpi-value" style="color:#059669">${fmtBRL(roi.faturamento)}</div>
        <div class="kpi-sub">por mês</div>
      </div>
      <div class="kpi-item">
        <div class="kpi-label">ROI Desejado</div>
        <div class="kpi-value">${roi.roiDesejado || 0}%</div>
        <div class="kpi-sub">retorno sobre investimento</div>
      </div>
      <div class="kpi-item">
        <div class="kpi-label">Vendas/Mês</div>
        <div class="kpi-value" style="color:#D97706">${fmtNum(roi.vendasNecessarias)}</div>
        <div class="kpi-sub">Ticket: ${fmtBRL(roi.ticketMedio)}</div>
      </div>
    </div>` : ''

  // ── Render narrative sections ─────────────────────────────────────────────────
  function renderNarrativa(text) {
    if (!text) return ''
    const sections = text.split(/\n---\n/).map((s) => s.trim()).filter(Boolean)
    return sections.map((section) => {
      const lines = section.split('\n')
      let sectionNum = ''
      let sectionTitle = ''
      const bodyLines = []

      lines.forEach((line, i) => {
        const matchNum = line.match(/^## (\d+)\.\s*(.+)/)
        if (matchNum && i === 0) {
          sectionNum = matchNum[1]
          sectionTitle = matchNum[2]
        } else if (/^## /.test(line)) {
          if (i === 0) sectionTitle = line.replace(/^## /, '')
          else bodyLines.push(`<h2>${esc(line.replace(/^## /, ''))}</h2>`)
        } else if (/^### /.test(line)) {
          bodyLines.push(`<h3>${esc(line.replace(/^### /, ''))}</h3>`)
        } else if (/^- /.test(line)) {
          const html = esc(line.slice(2)).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          bodyLines.push(`<li>${html}</li>`)
        } else if (line.trim() === '') {
          bodyLines.push('<br>')
        } else {
          const html = esc(line).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          bodyLines.push(`<p>${html}</p>`)
        }
      })

      // Wrap consecutive <li> in <ul>
      let body = bodyLines.join('\n').replace(/(<li>.*?<\/li>\n?)+/gs, (m) => `<ul>${m}</ul>`)

      return `
        <div class="section">
          <div class="section-title">
            ${sectionNum ? `<span class="section-num">${esc(sectionNum)}</span>` : ''}
            ${esc(sectionTitle)}
          </div>
          <div class="section-content">${body}</div>
        </div>`
    }).join('')
  }

  // ── Funnel data panel ────────────────────────────────────────────────────────
  const funnelHTML = roi ? `
    <div class="section">
      <div class="section-title"><span class="section-num">F</span> Funil de Conversão Projetado</div>
      <div class="funnel-row">
        <div class="funnel-stage">
          <div class="funnel-stage-num">${fmtNum(roi.leadsNecessarios)}</div>
          <div class="funnel-stage-label">Leads</div>
          <div class="funnel-stage-pct">100%</div>
        </div>
        <div class="funnel-arrow">→</div>
        <div class="funnel-stage">
          <div class="funnel-stage-num">${fmtNum(roi.mqlsNecessarios)}</div>
          <div class="funnel-stage-label">MQLs</div>
          <div class="funnel-stage-pct">${roi.taxaLeadMql}%</div>
        </div>
        <div class="funnel-arrow">→</div>
        <div class="funnel-stage">
          <div class="funnel-stage-num">${fmtNum(roi.sqlsNecessarios)}</div>
          <div class="funnel-stage-label">SQLs</div>
          <div class="funnel-stage-pct">${roi.taxaMqlSql}%</div>
        </div>
        <div class="funnel-arrow">→</div>
        <div class="funnel-stage">
          <div class="funnel-stage-num" style="color:#059669">${fmtNum(roi.vendasNecessarias)}</div>
          <div class="funnel-stage-label">Vendas</div>
          <div class="funnel-stage-pct">${roi.taxaSqlVenda}%</div>
        </div>
      </div>
      <div class="data-grid-3" style="margin-top:10px">
        <div class="data-card"><div class="data-label">CPL (mídia)</div><div class="data-value dark">${fmtBRL(roi.custoPorLead)}</div></div>
        <div class="data-card"><div class="data-label">CAC (mídia)</div><div class="data-value dark">${fmtBRL(roi.cac)}</div></div>
        <div class="data-card"><div class="data-label">Lucro Bruto Projetado</div><div class="data-value green">${fmtBRL(roi.lucroBruto)}</div></div>
      </div>
    </div>` : ''

  // ── Channels panel ────────────────────────────────────────────────────────────
  const channelsHTML = channels.length ? `
    <div class="section">
      <div class="section-title"><span class="section-num">M</span> Distribuição de Mídia</div>
      <div style="background:#F8FAFE;border:1px solid #D8E0F0;border-radius:12px;padding:16px 20px">
        ${channels.map((ch) => `
          <div class="channel-row">
            <div class="channel-name">${esc(ch.name)}</div>
            <div class="channel-bar-wrap"><div class="channel-bar" style="width:${ch.percentage}%"></div></div>
            <div class="channel-pct">${ch.percentage}%</div>
            <div class="channel-val">${fmtBRL(ch.monthly)}/mês</div>
          </div>`).join('')}
      </div>
    </div>` : ''

  // ── Personas summary ──────────────────────────────────────────────────────────
  const personasHTML = personas.length ? `
    <div class="section">
      <div class="section-title"><span class="section-num">P</span> Personas Prioritárias</div>
      ${personas.slice(0, 3).map((p) => {
    const sonhos   = (p.answers?.sonhos   || []).filter(Boolean).slice(0, 3)
    const objecoes = (p.answers?.objecoes || []).filter(Boolean).slice(0, 3)
    return `
          <div class="persona-card">
            <div class="persona-name">${esc(p.name || 'Persona')}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              ${sonhos.length ? `<div class="persona-section">
                <div class="persona-section-label">✨ Sonhos e Desejos</div>
                ${sonhos.map((s) => `<div class="persona-item">· ${esc(s)}</div>`).join('')}
              </div>` : ''}
              ${objecoes.length ? `<div class="persona-section">
                <div class="persona-section-label">⚠️ Objeções</div>
                ${objecoes.map((o) => `<div class="persona-item">· ${esc(o)}</div>`).join('')}
              </div>` : ''}
            </div>
          </div>`
  }).join('')}
    </div>` : ''

  // ── Oferta summary ────────────────────────────────────────────────────────────
  const ofertaHTML = oferta?.nome || oferta?.resultadoSonho ? `
    <div class="section">
      <div class="section-title"><span class="section-num">O</span> Oferta Central</div>
      ${oferta.nome ? `<div style="font-size:17px;font-weight:900;color:#164496;margin-bottom:14px">"${esc(oferta.nome)}"</div>` : ''}
      <div class="data-grid">
        ${oferta.resultadoSonho ? `<div class="data-card"><div class="data-label">✨ Resultado do Sonho</div><div style="font-size:12px;color:#334155;line-height:1.6;margin-top:4px">${esc(oferta.resultadoSonho)}</div></div>` : ''}
        ${oferta.garantia ? `<div class="data-card"><div class="data-label">🛡️ Garantia</div><div style="font-size:12px;color:#334155;line-height:1.6;margin-top:4px">${esc(oferta.garantia)}</div></div>` : ''}
        ${oferta.velocidade ? `<div class="data-card"><div class="data-label">⚡ Prazo / Velocidade</div><div style="font-size:12px;color:#334155;margin-top:4px">${esc(oferta.velocidade)}</div></div>` : ''}
        ${oferta.escassez ? `<div class="data-card"><div class="data-label">🔥 Escassez / Urgência</div><div style="font-size:12px;color:#334155;margin-top:4px">${esc(oferta.escassez)}</div></div>` : ''}
      </div>
    </div>` : ''

  // ── Footer ────────────────────────────────────────────────────────────────────
  const footer = `
    <div class="footer">
      <div class="footer-brand">Revenue Lab</div>
      <div>Documento confidencial · ${esc(project.companyName)} · ${today}</div>
    </div>`

  // ── Assemble ──────────────────────────────────────────────────────────────────
  const narrativaBody = narrativa
    ? renderNarrativa(narrativa)
    : `<div class="section">
        <div style="background:#F8FAFE;border:1px solid #D8E0F0;border-radius:12px;padding:24px;text-align:center;color:#94A3B8">
          <div style="font-size:14px;font-weight:700;margin-bottom:6px">Narrativa estratégica não gerada</div>
          <div style="font-size:12px">Gere a narrativa no módulo Estratégia e exporte novamente.</div>
        </div>
      </div>`

  const bodyHTML = narrativa
    ? narrativaBody + funnelHTML + channelsHTML
    : personasHTML + ofertaHTML + funnelHTML + channelsHTML

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Estratégia Digital — ${esc(project.companyName)}</title>
  <style>${STRATEGY_CSS}</style>
</head>
<body>
  ${cover}
  ${kpiStrip}
  <div class="content">
    ${bodyHTML}
    ${footer}
  </div>
  <button class="print-btn" onclick="window.print()">🖨️ Salvar como PDF</button>
</body>
</html>`

  const win = window.open('', '_blank', 'width=1100,height=900')
  if (!win) { alert('Permita pop-ups para exportar o PDF.'); return }
  win.document.write(html)
  win.document.close()
}
