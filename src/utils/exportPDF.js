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

  const serviceDetailEntries = Object.entries(project.servicesData || {}).reduce((acc, [id, data]) => {
    if (!data || Object.keys(data).length === 0) return acc
    const SERVICE_DETAIL_LABELS = { imagemQty: 'Imagens', videoQty: 'Vídeos', estaticosQty: 'Estáticos', qty: 'Qtd.', nivel: 'Nível' }
    const parts = Object.entries(data).filter(([, v]) => v).map(([key, val]) => `${SERVICE_DETAIL_LABELS[key] || key}: ${val}`).join(' · ')
    if (parts) acc.push({ id, detail: parts })
    return acc
  }, [])

  const CONTRACT_MODEL_LABELS = { aceleracao: '🚀 Programa de Aceleração', assessoria: '📅 Assessoria Mensal' }
  const CONTRACT_PAYMENT_LABELS = { unico: 'Valor Único', mensal: 'Parcelado (Mensal)' }

  const body = `
    <section>
      <div class="section-title">🏢 Empresa</div>
      <div class="grid grid-3">
        ${project.businessType    ? `<div class="field"><div class="field-label">Tipo de Negócio</div><div class="field-value">${esc(BUSINESS_LABELS[project.businessType] || project.businessType)}</div></div>` : ''}
        ${project.segmento        ? `<div class="field"><div class="field-label">Segmento</div><div class="field-value">${esc(project.segmento)}</div></div>` : ''}
        ${project.cnpj            ? `<div class="field"><div class="field-label">CNPJ</div><div class="field-value">${esc(project.cnpj)}</div></div>` : ''}
        ${project.responsibleName ? `<div class="field"><div class="field-label">Responsável</div><div class="field-value">${esc(project.responsibleName)}</div></div>` : ''}
        ${project.responsibleRole ? `<div class="field"><div class="field-label">Cargo</div><div class="field-value">${esc(project.responsibleRole)}</div></div>` : ''}
        ${project.contractDate    ? `<div class="field"><div class="field-label">Data do Contrato</div><div class="field-value">${new Date(project.contractDate + 'T00:00:00').toLocaleDateString('pt-BR')}</div></div>` : ''}
      </div>
    </section>

    ${(project.contractModel || project.contractValue) ? `
    <section>
      <div class="section-title">📋 Contrato</div>
      <div class="grid grid-3">
        ${project.contractModel ? `<div class="field"><div class="field-label">Modelo</div><div class="field-value">${esc(CONTRACT_MODEL_LABELS[project.contractModel] || project.contractModel)}</div></div>` : ''}
        ${project.contractModel === 'aceleracao' && project.contractPaymentType ? `<div class="field"><div class="field-label">Tipo de Pagamento</div><div class="field-value">${esc(CONTRACT_PAYMENT_LABELS[project.contractPaymentType])}</div></div>` : ''}
        ${project.contractValue ? `<div class="field"><div class="field-label">${project.contractModel === 'aceleracao' ? 'Valor do Contrato' : 'Valor Mensal'}</div><div class="field-value purple">${fmtBRL(project.contractValue)}</div></div>` : ''}
      </div>
    </section>` : ''}

    ${project.services?.length ? `
    <section>
      <div class="section-title">⚙️ Serviços Contratados</div>
      <div>${project.services.map((s) => `<span class="chip">${esc(s)}</span>`).join('')}</div>
      ${serviceDetailEntries.length ? `<div style="margin-top:8px">${serviceDetailEntries.map(({ detail }) => `<p style="font-size:11px;color:#64748b;margin-top:4px">↳ ${esc(detail)}</p>`).join('')}</div>` : ''}
    </section>` : ''}

    <section>
      <div class="section-title">👥 Equipe &amp; Maturidade</div>
      <div class="grid grid-3">
        ${project.hasSalesTeam != null ? `<div class="field"><div class="field-label">Time de Vendas</div><div class="field-value">${project.hasSalesTeam ? 'Sim' : 'Não'}</div></div>` : ''}
        ${project.digitalMaturity ? `<div class="field"><div class="field-label">Maturidade Digital</div><div class="field-value">${esc(MATURITY_LABELS[project.digitalMaturity] || project.digitalMaturity)}</div></div>` : ''}
        ${project.upsellPotential != null ? `<div class="field"><div class="field-label">Potencial de Upsell</div><div class="field-value">${project.upsellPotential ? 'Sim' : 'Não'}</div></div>` : ''}
      </div>
      ${project.upsellNotes ? `<div class="field" style="margin-top:8px"><div class="field-label">Obs. Upsell</div><div class="field-value" style="font-weight:400">${esc(project.upsellNotes)}</div></div>` : ''}
    </section>

    ${otherPeople.length ? `
    <section>
      <div class="section-title">👤 Outras Pessoas Envolvidas</div>
      <div class="grid grid-3">
        ${otherPeople.map((p) => `<div class="field"><div class="field-label">${esc(p.name)}</div>${p.role ? `<div class="field-value" style="font-size:11px;color:#9ca3af">${esc(p.role)}</div>` : ''}</div>`).join('')}
      </div>
    </section>` : ''}

    ${competitors.length ? `
    <section>
      <div class="section-title">⚔️ Concorrentes</div>
      <div>${competitors.map((c) => `<span class="chip">${esc(c)}</span>`).join('')}</div>
    </section>` : ''}

    ${project.productDescription ? `
    <section>
      <div class="section-title">🛍️ Produto / Serviço</div>
      <div class="field"><div class="field-value" style="font-weight:400;line-height:1.6">${esc(project.productDescription)}</div></div>
    </section>` : ''}
    ${project.targetAudience ? `
    <section>
      <div class="section-title">🎯 Público-Alvo</div>
      <div class="field"><div class="field-value" style="font-weight:400;line-height:1.6">${esc(project.targetAudience)}</div></div>
    </section>` : ''}
  `

  printHTML('Dados do Cliente', project.companyName, body)
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

// ─── Estratégia V2 PDF ────────────────────────────────────────────────────────

const V2_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 13px;
    color: #1a1a2e;
    background: #fff;
  }
  @media print {
    .print-btn { display: none !important; }
    .page-break { page-break-before: always; }
  }
  .print-btn {
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: #164496;
    color: #fff;
    border: none;
    border-radius: 10px;
    padding: 10px 20px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(22,68,150,0.3);
    z-index: 999;
  }

  /* Cover */
  .cover {
    background: linear-gradient(135deg, #0F172A 0%, #1a1a2e 50%, #16203a 100%);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    padding: 60px 40px;
    position: relative;
  }
  .cover-logo {
    position: absolute;
    top: 32px;
    left: 40px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #4F7EF8;
  }
  .cover-badge {
    background: rgba(79,126,248,0.15);
    border: 1px solid rgba(79,126,248,0.35);
    color: #4F7EF8;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 6px 16px;
    border-radius: 100px;
    margin-bottom: 24px;
    display: inline-block;
  }
  .cover-company {
    font-size: 42px;
    font-weight: 900;
    color: #fff;
    line-height: 1.1;
    margin-bottom: 12px;
    letter-spacing: -0.02em;
  }
  .cover-title {
    font-size: 18px;
    color: rgba(255,255,255,0.55);
    margin-bottom: 40px;
    font-weight: 500;
  }
  .cover-meta {
    display: flex;
    gap: 40px;
    margin-top: 16px;
  }
  .cover-meta-item {
    text-align: center;
  }
  .cover-meta-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(255,255,255,0.35);
    margin-bottom: 4px;
  }
  .cover-meta-value {
    font-size: 13px;
    font-weight: 700;
    color: rgba(255,255,255,0.8);
  }

  /* Content wrapper */
  .content {
    max-width: 860px;
    margin: 0 auto;
    padding: 48px 40px 80px;
  }

  /* Section */
  .section { margin-bottom: 40px; }
  .section-title {
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #164496;
    border-bottom: 2px solid #D8E0F0;
    padding-bottom: 8px;
    margin-bottom: 18px;
  }

  /* Problemas */
  .problema-list { list-style: none; display: flex; flex-direction: column; gap: 8px; }
  .problema-item {
    display: flex;
    align-items: baseline;
    gap: 12px;
    background: #FFFBF0;
    border: 1px solid #F0D080;
    border-radius: 8px;
    padding: 10px 14px;
  }
  .problema-num {
    font-size: 11px;
    font-weight: 800;
    color: #B8860B;
    min-width: 20px;
  }
  .problema-text { font-size: 13px; color: #1a1a2e; line-height: 1.4; }

  /* SWOT */
  .swot-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .swot-cell {
    border-radius: 10px;
    padding: 16px;
    min-height: 100px;
  }
  .swot-cell.forcas      { background: #F0FDF4; border: 1px solid #86EFAC; }
  .swot-cell.fraquezas   { background: #FFF1F2; border: 1px solid #FDA4AF; }
  .swot-cell.oportunidades { background: #EFF6FF; border: 1px solid #93C5FD; }
  .swot-cell.ameacas     { background: #FFFBEB; border: 1px solid #FCD34D; }
  .swot-label {
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 8px;
  }
  .swot-cell.forcas      .swot-label { color: #16A34A; }
  .swot-cell.fraquezas   .swot-label { color: #DC2626; }
  .swot-cell.oportunidades .swot-label { color: #2563EB; }
  .swot-cell.ameacas     .swot-label { color: #B45309; }
  .swot-content { font-size: 12px; color: #374151; line-height: 1.5; white-space: pre-line; }

  /* Benchmark */
  .competitor-block { margin-bottom: 24px; }
  .competitor-name {
    font-size: 14px;
    font-weight: 800;
    color: #0F172A;
    margin-bottom: 10px;
    padding-bottom: 6px;
    border-bottom: 1px solid #E2E8F0;
  }
  .competitor-table { width: 100%; border-collapse: collapse; }
  .competitor-table td {
    padding: 6px 10px;
    font-size: 12px;
    border-bottom: 1px solid #F1F5F9;
    vertical-align: top;
  }
  .competitor-table td:first-child {
    font-weight: 700;
    color: #64748B;
    width: 160px;
    white-space: nowrap;
  }
  .platform-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 100px;
    font-size: 10px;
    font-weight: 700;
    margin-right: 6px;
  }
  .badge-meta   { background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE; }
  .badge-google { background: #F0FDF4; color: #15803D; border: 1px solid #86EFAC; }
  .badge-no     { background: #F8FAFC; color: #94A3B8; border: 1px solid #E2E8F0; }

  /* Riscos */
  .risk-table { width: 100%; border-collapse: collapse; }
  .risk-table th {
    text-align: left;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #64748B;
    padding: 6px 10px;
    border-bottom: 2px solid #E2E8F0;
  }
  .risk-table td {
    padding: 8px 10px;
    font-size: 12px;
    color: #1a1a2e;
    border-bottom: 1px solid #F1F5F9;
    vertical-align: top;
    line-height: 1.4;
  }
  .nivel-badge {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 100px;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .nivel-baixo { background: #F0FDF4; color: #16A34A; border: 1px solid #86EFAC; }
  .nivel-medio { background: #FFFBEB; color: #B45309; border: 1px solid #FCD34D; }
  .nivel-alto  { background: #FFF1F2; color: #DC2626; border: 1px solid #FDA4AF; }

  /* ICPs */
  .icp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .icp-card { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 16px; }
  .icp-name { font-size: 14px; font-weight: 800; color: #0F172A; margin-bottom: 10px; }
  .icp-attr-row { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 6px; }
  .icp-attr-label {
    font-size: 9px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #94A3B8;
    width: 44px;
    flex-shrink: 0;
    padding-top: 2px;
  }
  .icp-chips { display: flex; flex-wrap: wrap; gap: 4px; }
  .icp-chip {
    font-size: 10px;
    padding: 2px 7px;
    border-radius: 100px;
    font-weight: 600;
  }
  .chip-green  { background: #F0FDF4; color: #16A34A; }
  .chip-red    { background: #FFF1F2; color: #DC2626; }
  .chip-gold   { background: #FFFBEB; color: #B45309; }
  .chip-purple { background: #F5F3FF; color: #7C3AED; }
  .icp-profile { font-size: 11px; color: #64748B; margin-top: 8px; line-height: 1.5; }

  /* Funis */
  .funil-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .funil-item {
    display: flex;
    align-items: center;
    gap: 10px;
    background: #F5F3FF;
    border: 1px solid #DDD6FE;
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 12px;
    font-weight: 600;
    color: #5B21B6;
  }
  .funil-dot { width: 8px; height: 8px; border-radius: 50%; background: #7C3AED; flex-shrink: 0; }

  /* Campanhas */
  .channel-block { margin-bottom: 16px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; overflow: hidden; }
  .channel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #EFF6FF;
    padding: 10px 14px;
    border-bottom: 1px solid #DBEAFE;
  }
  .channel-name { font-size: 13px; font-weight: 800; color: #1E40AF; }
  .channel-budget { font-size: 13px; font-weight: 700; color: #1D4ED8; }
  .channel-pct { font-size: 11px; color: #64748B; margin-left: 8px; }
  .stage-row { padding: 6px 14px; border-bottom: 1px solid #F1F5F9; }
  .stage-label { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.07em; color: #94A3B8; margin-bottom: 4px; }
  .campaign-row { display: flex; justify-content: space-between; font-size: 11px; color: #64748B; padding: 2px 0 2px 12px; }

  /* Footer */
  .footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 40px;
    font-size: 10px;
    color: #94A3B8;
    background: #fff;
    border-top: 1px solid #E2E8F0;
  }
  .footer-brand { font-weight: 800; color: #164496; }
  .empty-state { color: #94A3B8; font-style: italic; font-size: 12px; padding: 12px 0; }
`

export function exportEstrategiaV2PDF(project, data) {
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  const { problemas = [], swot = {}, concorrentes = [], riscos = [], funis = [],
          roiResult = null, roiCalc = null } = data
  const personas     = project.personas     || []
  const campaignPlan = project.campaignPlan || null
  const totalBudget  = campaignPlan?.orcamentoTotal || campaignPlan?.totalBudget || 0

  function fmtBudget(n) {
    if (!n || !isFinite(n) || isNaN(n)) return '—'
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
  }
  function fmtN(n) {
    if (n == null || isNaN(n)) return '—'
    if (!isFinite(n)) return '∞'
    return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
  }

  // ── Cover ──────────────────────────────────────────────────────────────────
  const cover = `
    <div class="cover">
      <div class="cover-logo">Revenue Lab</div>
      <div class="cover-badge">Estratégia Digital V2</div>
      <div class="cover-company">${esc(project.companyName)}</div>
      <div class="cover-title">Documento de Estratégia Digital</div>
      <div class="cover-meta">
        <div class="cover-meta-item">
          <div class="cover-meta-label">Data</div>
          <div class="cover-meta-value">${today}</div>
        </div>
        ${project.businessType ? `<div class="cover-meta-item">
          <div class="cover-meta-label">Tipo de Negócio</div>
          <div class="cover-meta-value">${esc({ b2b:'B2B', local:'Negócio Local', ecommerce:'E-commerce', infoproduto:'Infoproduto' }[project.businessType] || project.businessType)}</div>
        </div>` : ''}
        ${problemas.length ? `<div class="cover-meta-item">
          <div class="cover-meta-label">Problemas</div>
          <div class="cover-meta-value">${problemas.length}</div>
        </div>` : ''}
        ${funis.length ? `<div class="cover-meta-item">
          <div class="cover-meta-label">Funis</div>
          <div class="cover-meta-value">${funis.length}</div>
        </div>` : ''}
      </div>
    </div>`

  // ── Problemas ─────────────────────────────────────────────────────────────
  const problemasHTML = `
    <div class="section">
      <div class="section-title">01 · Problemas Identificados no Kickoff</div>
      ${problemas.length ? `
        <ul class="problema-list">
          ${problemas.map((p, i) => `
            <li class="problema-item">
              <span class="problema-num">${String(i + 1).padStart(2, '0')}</span>
              <span class="problema-text">${esc(p)}</span>
            </li>`).join('')}
        </ul>
      ` : '<div class="empty-state">Nenhum problema registrado.</div>'}`

  // ── SWOT ──────────────────────────────────────────────────────────────────
  const swotHTML = `
    <div class="section page-break">
      <div class="section-title">02 · Análise SWOT</div>
      <div class="swot-grid">
        <div class="swot-cell forcas">
          <div class="swot-label">Forças</div>
          <div class="swot-content">${esc(swot.forcas || '—')}</div>
        </div>
        <div class="swot-cell fraquezas">
          <div class="swot-label">Fraquezas</div>
          <div class="swot-content">${esc(swot.fraquezas || '—')}</div>
        </div>
        <div class="swot-cell oportunidades">
          <div class="swot-label">Oportunidades</div>
          <div class="swot-content">${esc(swot.oportunidades || '—')}</div>
        </div>
        <div class="swot-cell ameacas">
          <div class="swot-label">Ameaças</div>
          <div class="swot-content">${esc(swot.ameacas || '—')}</div>
        </div>
      </div>
    </div>`

  // ── Benchmark ─────────────────────────────────────────────────────────────
  const benchmarkHTML = `
    <div class="section page-break">
      <div class="section-title">03 · Benchmark de Concorrentes</div>
      ${concorrentes.length ? concorrentes.map(c => `
        <div class="competitor-block">
          <div class="competitor-name">${esc(c.nome || 'Concorrente')}</div>
          <table class="competitor-table">
            <tr>
              <td>Plataformas</td>
              <td>
                ${c.metaAds   ? '<span class="platform-badge badge-meta">Meta Ads</span>'   : '<span class="platform-badge badge-no">Sem Meta Ads</span>'}
                ${c.googleAds ? '<span class="platform-badge badge-google">Google Ads</span>' : '<span class="platform-badge badge-no">Sem Google Ads</span>'}
              </td>
            </tr>
            ${c.metaAds && c.linkBiblioteca ? `<tr><td>Biblioteca de Anúncios</td><td style="word-break:break-all">${esc(c.linkBiblioteca)}</td></tr>` : ''}
            ${c.grandePromessa ? `<tr><td>Grande Promessa</td><td>${esc(c.grandePromessa)}</td></tr>` : ''}
            ${c.comunicacao ? `<tr><td>Comunicação</td><td>${esc(c.comunicacao)}</td></tr>` : ''}
          </table>
        </div>`).join('') : '<div class="empty-state">Nenhum concorrente registrado.</div>'}`

  // ── Riscos ────────────────────────────────────────────────────────────────
  const nivelLabel = { baixo: 'Baixo', medio: 'Médio', alto: 'Alto' }
  const riscosHTML = `
    <div class="section">
      <div class="section-title">04 · Riscos do Projeto</div>
      ${riscos.length ? `
        <table class="risk-table">
          <thead>
            <tr>
              <th style="width:28%">Problema / Causa</th>
              <th style="width:28%">Risco Gerado</th>
              <th style="width:28%">Impacto</th>
              <th style="width:16%">Nível</th>
            </tr>
          </thead>
          <tbody>
            ${riscos.map(r => `
              <tr>
                <td>${esc(r.problema  || '—')}</td>
                <td>${esc(r.riscoGerado || '—')}</td>
                <td>${esc(r.impacto   || '—')}</td>
                <td><span class="nivel-badge nivel-${r.nivel || 'medio'}">${nivelLabel[r.nivel] || 'Médio'}</span></td>
              </tr>`).join('')}
          </tbody>
        </table>
      ` : '<div class="empty-state">Nenhum risco registrado.</div>'}`

  // ── ICPs ──────────────────────────────────────────────────────────────────
  const icpsHTML = `
    <div class="section page-break">
      <div class="section-title">05 · Resumo dos ICPs</div>
      ${personas.length ? `
        <div class="icp-grid">
          ${personas.map(p => {
            const a    = p.answers || {}
            const pick = (key) => (a[key] || []).filter(Boolean).slice(0, 3)
            return `
              <div class="icp-card">
                <div class="icp-name">${esc(p.name || 'Persona Principal')}</div>
                ${pick('resultado').length ? `<div class="icp-attr-row"><span class="icp-attr-label">Deseja</span><div class="icp-chips">${pick('resultado').map(x => `<span class="icp-chip chip-green">${esc(x)}</span>`).join('')}</div></div>` : ''}
                ${pick('objecoes').length  ? `<div class="icp-attr-row"><span class="icp-attr-label">Objeção</span><div class="icp-chips">${pick('objecoes').map(x => `<span class="icp-chip chip-red">${esc(x)}</span>`).join('')}</div></div>` : ''}
                ${pick('medos').length     ? `<div class="icp-attr-row"><span class="icp-attr-label">Medo</span><div class="icp-chips">${pick('medos').map(x => `<span class="icp-chip chip-gold">${esc(x)}</span>`).join('')}</div></div>` : ''}
                ${pick('sonhos').length    ? `<div class="icp-attr-row"><span class="icp-attr-label">Sonha</span><div class="icp-chips">${pick('sonhos').map(x => `<span class="icp-chip chip-purple">${esc(x)}</span>`).join('')}</div></div>` : ''}
                ${p.generatedProfile ? `<div class="icp-profile">${esc(p.generatedProfile.slice(0, 220))}${p.generatedProfile.length > 220 ? '…' : ''}</div>` : ''}
              </div>`
          }).join('')}
        </div>
      ` : '<div class="empty-state">Nenhum ICP cadastrado.</div>'}`

  // ── Funis ─────────────────────────────────────────────────────────────────
  const funisHTML = `
    <div class="section">
      <div class="section-title">06 · Tipos de Funis Selecionados</div>
      ${funis.length ? `
        <div class="funil-grid">
          ${funis.map(f => `<div class="funil-item"><span class="funil-dot"></span>${esc(f)}</div>`).join('')}
        </div>
      ` : '<div class="empty-state">Nenhum funil selecionado.</div>'}`

  // ── Metas do Funil (ROI) ─────────────────────────────────────────────────
  let metasHTML = `<div class="section page-break"><div class="section-title">07 · Metas do Funil (ROI)</div>`

  if (!roiResult) {
    metasHTML += '<div class="empty-state">Calculadora de ROI não preenchida.</div>'
  } else {
    const nivelLiquidoClass = roiResult.lucroLiquido >= 0 ? 'color:#16A34A' : 'color:#DC2626'
    metasHTML += `
      <!-- KPI strip -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <tr>
          ${[
            { label: 'ROI Desejado',    value: roiCalc?.roiDesejado != null ? `${roiCalc.roiDesejado}%` : '—', style: 'color:#7C3AED;font-weight:800' },
            { label: 'Total Investido', value: fmtBudget(roiResult.totalInvestimento), style: 'color:#1a1a2e;font-weight:800' },
            { label: 'Faturamento Alvo',value: fmtBudget(roiResult.faturamento),       style: 'color:#2563EB;font-weight:800' },
            { label: 'Lucro Líquido',   value: fmtBudget(roiResult.lucroLiquido),      style: nivelLiquidoClass+';font-weight:800' },
          ].map(k => `<td style="text-align:center;padding:10px 8px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px">
            <div style="font-size:11px;color:#94A3B8;font-weight:700;text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px">${k.label}</div>
            <div style="font-size:15px;${k.style}">${k.value}</div>
          </td>`).join('<td style="width:8px"></td>')}
        </tr>
      </table>

      <!-- Funil step -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:14px">
        <thead>
          <tr>
            ${['Leads', 'MQLs', 'SQLs', 'Vendas'].map(h => `<th style="text-align:center;padding:6px;font-size:10px;color:#64748B;font-weight:800;text-transform:uppercase;letter-spacing:.07em;border-bottom:2px solid #E2E8F0">${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          <tr>
            ${[
              { value: roiResult.leadsNecessarios,  cost: roiResult.custoPorLead, label: 'CPL',  rate: null, color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
              { value: roiResult.mqlsNecessarios,   cost: roiResult.custoPorMQL,  label: 'C.MQL', rate: roiCalc?.taxaLead2MQL, color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
              { value: roiResult.sqlsNecessarios,   cost: roiResult.custoPorSQL,  label: 'C.SQL', rate: roiCalc?.taxaMQL2SQL,  color: '#0891B2', bg: '#ECFEFF', border: '#A5F3FC' },
              { value: roiResult.vendasNecessarias, cost: roiResult.cac,          label: 'CAC',  rate: roiCalc?.taxaSQL2Venda, color: '#16A34A', bg: '#F0FDF4', border: '#86EFAC' },
            ].map(s => `<td style="text-align:center;padding:10px 6px;background:${s.bg};border:1px solid ${s.border};border-radius:6px">
              <div style="font-size:22px;font-weight:900;color:${s.color}">${fmtN(s.value)}</div>
              <div style="font-size:11px;font-weight:700;color:${s.color};margin-top:1px">${fmtBudget(s.cost)}<br><span style="font-size:9px;color:#94A3B8">${s.label}</span></div>
              ${s.rate != null ? `<div style="font-size:9px;color:#94A3B8;margin-top:3px">${s.rate}% conv.</div>` : ''}
            </td>`).join('<td style="width:6px;text-align:center;color:#CBD5E1;font-size:14px">→</td>')}
          </tr>
        </tbody>
      </table>

      <!-- Financeiro -->
      <table style="width:100%;border-collapse:collapse">
        <tr>
          ${[
            { label: 'Lucro Bruto',        value: fmtBudget(roiResult.lucroBruto),      style: 'color:#0891B2' },
            { label: 'CAC (mídia)',         value: fmtBudget(roiResult.cac),             style: 'color:#B45309' },
            { label: 'Breakeven (vendas)',  value: fmtN(roiResult.vendasBreakeven),      style: 'color:#1a1a2e' },
            { label: 'Lucro/Venda',        value: fmtBudget(roiResult.lucroPorVenda),   style: 'color:#16A34A' },
          ].map(k => `<td style="text-align:center;padding:8px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:6px">
            <div style="font-size:10px;color:#94A3B8;font-weight:700;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px">${k.label}</div>
            <div style="font-size:13px;font-weight:800;${k.style}">${k.value}</div>
          </td>`).join('<td style="width:6px"></td>')}
        </tr>
      </table>`
  }
  metasHTML += '</div>'

  // ── Campanhas ─────────────────────────────────────────────────────────────
  let campanhasHTML = `
    <div class="section page-break">
      <div class="section-title">08 · Planejamento de Campanhas por Canais</div>`

  if (!campaignPlan || !campaignPlan.channels?.length) {
    campanhasHTML += '<div class="empty-state">Planejamento de campanhas não preenchido.</div>'
  } else {
    campanhasHTML += campaignPlan.channels.map(ch => {
      const chBudget = totalBudget * (ch.percentage / 100)
      const stages   = ch.stages || {}
      const stagesHTML = ['topo', 'meio', 'fundo'].map(key => {
        const stage = stages[key]
        if (!stage || !stage.campaigns?.length) return ''
        const stageBudget = chBudget * (stage.percentage / 100)
        const label = key === 'topo' ? 'Topo de Funil' : key === 'meio' ? 'Meio de Funil' : 'Fundo de Funil'
        return `
          <div class="stage-row">
            <div class="stage-label">${label} — ${fmtBudget(stageBudget)}/mês</div>
            ${stage.campaigns.map(camp => `
              <div class="campaign-row">
                <span>${esc(camp.name || '—')}</span>
                <span>${fmtBudget(stageBudget * (camp.percentage / 100))}/mês</span>
              </div>`).join('')}
          </div>`
      }).join('')
      return `
        <div class="channel-block">
          <div class="channel-header">
            <span class="channel-name">${esc(ch.name)}</span>
            <span><span class="channel-budget">${fmtBudget(chBudget)}/mês</span><span class="channel-pct">${ch.percentage}%</span></span>
          </div>
          ${stagesHTML}
        </div>`
    }).join('')
  }
  campanhasHTML += '</div>'

  // ── Footer ────────────────────────────────────────────────────────────────
  const footer = `
    <div class="footer">
      <span class="footer-brand">Revenue Lab</span>
      <span>Documento confidencial · ${esc(project.companyName)}</span>
      <span>${today}</span>
    </div>`

  // ── Assemble ──────────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Estratégia V2 — ${esc(project.companyName)}</title>
  <style>${V2_CSS}</style>
</head>
<body>
  ${cover}
  <div class="content">
    ${problemasHTML}
    ${swotHTML}
    ${benchmarkHTML}
    ${riscosHTML}
    ${icpsHTML}
    ${funisHTML}
    ${metasHTML}
    ${campanhasHTML}
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

// ─── Produto / Serviço PDF ────────────────────────────────────────────────────

const PRODUTO_QUESTIONS = [
  { id: 'q1',  emoji: '🎯', label: 'O que seu produto resolve?' },
  { id: 'q2',  emoji: '⏰', label: 'Por que e em que momento o seu cliente precisa do seu produto/serviço?' },
  { id: 'q3',  emoji: '✨', label: 'Como é a vida dele depois de usar seu produto/serviço?' },
  { id: 'q4',  emoji: '🏆', label: 'Por que vou usar seu produto/serviço e não o do concorrente?' },
  { id: 'q5',  emoji: '🔥', label: 'Por que eu preciso comprar agora?' },
  { id: 'q6',  emoji: '😔', label: 'Como é a vida sem o seu produto/serviço?' },
  { id: 'q7',  emoji: '🚧', label: 'Quais são as principais desculpas que os clientes dão para não comprar?' },
  { id: 'q8',  emoji: '🔄', label: 'Já tentou resolver esse problema de outra forma antes? O que não funcionou?' },
  { id: 'q9',  emoji: '🤔', label: 'O que faz o cliente desconfiar de produtos como o seu?' },
  { id: 'q10', emoji: '📊', label: 'Tem cases de clientes com resultado mensurável?' },
  { id: 'q11', emoji: '⏱️', label: 'Quanto tempo leva para o cliente sentir o primeiro resultado?' },
  { id: 'q12', emoji: '💬', label: 'O que seus clientes mais elogiam espontaneamente?' },
  { id: 'q13', emoji: '💡', label: 'O que você faz que nenhum concorrente faz ou consegue copiar facilmente?' },
  { id: 'q14', emoji: '⚠️', label: 'O que acontece se o cliente esperar mais 3 meses para resolver isso?' },
  { id: 'q15', emoji: '📅', label: 'Existe alguma sazonalidade ou janela de oportunidade no seu mercado?' },
  { id: 'q16', emoji: '🛡️', label: 'Você oferece alguma garantia hoje? Se não, o que te impede?' },
  { id: 'q17', emoji: '🤝', label: 'Se der errado, o que você faz pelo cliente?' },
]

export function exportProdutoServicoPDF(project) {
  const produtos = project.produtos || []
  if (!produtos.length) { alert('Nenhum produto/serviço cadastrado.'); return }

  const produtosHTML = produtos.map((p, idx) => {
    const tipo = p.tipo === 'servico' ? 'Serviço' : 'Produto Físico'
    const tipoColor = p.tipo === 'servico' ? '#0284C7' : '#D97706'

    const answeredQuestions = PRODUTO_QUESTIONS.filter((q) => p.answers?.[q.id]?.trim())

    const questionsHTML = answeredQuestions.length === 0
      ? '<p style="color:#94A3B8;font-style:italic;font-size:12px">Nenhuma pergunta respondida.</p>'
      : answeredQuestions.map((q) => `
          <div class="qa-item" style="margin-bottom:14px;padding:12px 14px;background:#F2F5FB;border:1px solid #D8E0F0;border-radius:8px;page-break-inside:avoid">
            <div class="qa-label" style="font-size:10px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:5px">
              ${esc(q.emoji)} ${esc(q.label)}
            </div>
            <div style="font-size:13px;color:#0F172A;line-height:1.6;white-space:pre-wrap">${esc(p.answers[q.id])}</div>
          </div>
        `).join('')

    return `
      <div style="margin-bottom:36px;page-break-inside:avoid">
        <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #D8E0F0;padding-bottom:10px;margin-bottom:18px">
          <div>
            <div style="font-size:18px;font-weight:800;color:#0F172A">${esc(p.nome || `Produto ${idx + 1}`)}</div>
            <div style="margin-top:4px">
              <span style="display:inline-block;padding:3px 12px;border-radius:99px;font-size:11px;font-weight:700;background:${tipoColor}18;color:${tipoColor};border:1px solid ${tipoColor}40">
                ${esc(tipo)}
              </span>
            </div>
          </div>
          <div style="text-align:right;font-size:11px;color:#94A3B8">
            ${answeredQuestions.length} / ${PRODUTO_QUESTIONS.length} perguntas respondidas
          </div>
        </div>
        ${questionsHTML}
      </div>
    `
  }).join('<hr style="border:none;border-top:1px solid #E2E8F0;margin:32px 0">')

  const bodyHTML = `
    <section>
      <div class="section-title">Produtos &amp; Serviços — ${esc(project.company_name || project.companyName || '')}</div>
      ${produtosHTML}
    </section>
  `

  printHTML(
    'Produto / Serviço',
    project.company_name || project.companyName || 'Cliente',
    bodyHTML
  )
}

// ─── Perfil Completo do Cliente PDF ──────────────────────────────────────────

const CONTRACT_MODEL_LABELS_PDF = {
  aceleracao: '🚀 Programa de Aceleração',
  assessoria: '📅 Assessoria Mensal',
}
const CONTRACT_PAYMENT_LABELS_PDF = {
  unico:  'Valor Único',
  mensal: 'Parcelado (Mensal)',
}

export function exportClientProfilePDF(project) {
  const competitors  = (project.competitors || []).filter(Boolean)
  const otherPeople  = (project.otherPeople || []).filter((p) => p?.name)
  const personas     = project.personas || []
  const oferta       = project.ofertaData || null
  const roiCalc      = project.roiCalc || null
  const roiResult    = project.roiResult || null
  const campaignPlan = project.campaignPlan || null
  const produtos     = (project.produtos || []).filter((p) => p?.nome || p?.answers?.q1)

  // ── 1. Empresa
  const empresaHTML = `
    <section>
      <div class="section-title">🏢 Dados da Empresa</div>
      <div class="grid grid-3">
        ${project.businessType    ? `<div class="field"><div class="field-label">Tipo de Negócio</div><div class="field-value">${esc(BUSINESS_LABELS[project.businessType] || project.businessType)}</div></div>` : ''}
        ${project.segmento        ? `<div class="field"><div class="field-label">Segmento</div><div class="field-value">${esc(project.segmento)}</div></div>` : ''}
        ${project.cnpj            ? `<div class="field"><div class="field-label">CNPJ</div><div class="field-value">${esc(project.cnpj)}</div></div>` : ''}
        ${project.responsibleName ? `<div class="field"><div class="field-label">Responsável</div><div class="field-value">${esc(project.responsibleName)}</div></div>` : ''}
        ${project.responsibleRole ? `<div class="field"><div class="field-label">Cargo</div><div class="field-value">${esc(project.responsibleRole)}</div></div>` : ''}
        ${project.contractDate    ? `<div class="field"><div class="field-label">Data do Contrato</div><div class="field-value">${new Date(project.contractDate + 'T00:00:00').toLocaleDateString('pt-BR')}</div></div>` : ''}
        ${project.contractModel   ? `<div class="field"><div class="field-label">Modelo de Contrato</div><div class="field-value">${esc(CONTRACT_MODEL_LABELS_PDF[project.contractModel] || project.contractModel)}</div></div>` : ''}
        ${project.contractModel === 'aceleracao' && project.contractPaymentType ? `<div class="field"><div class="field-label">Tipo de Pagamento</div><div class="field-value">${esc(CONTRACT_PAYMENT_LABELS_PDF[project.contractPaymentType] || project.contractPaymentType)}</div></div>` : ''}
        ${project.contractValue   ? `<div class="field"><div class="field-label">${project.contractModel === 'aceleracao' ? 'Valor do Contrato' : 'Valor Mensal'}</div><div class="field-value purple">${fmtBRL(project.contractValue)}</div></div>` : ''}
        ${project.digitalMaturity ? `<div class="field"><div class="field-label">Maturidade Digital</div><div class="field-value">${esc(MATURITY_LABELS[project.digitalMaturity] || project.digitalMaturity)}</div></div>` : ''}
        ${project.hasSalesTeam != null ? `<div class="field"><div class="field-label">Time de Vendas</div><div class="field-value">${project.hasSalesTeam ? 'Sim' : 'Não'}</div></div>` : ''}
        ${project.upsellPotential != null ? `<div class="field"><div class="field-label">Potencial de Upsell</div><div class="field-value">${project.upsellPotential ? 'Sim' : 'Não'}</div></div>` : ''}
      </div>
      ${project.upsellNotes ? `<div class="field" style="margin-top:8px"><div class="field-label">Obs. Upsell</div><div class="field-value" style="font-weight:400">${esc(project.upsellNotes)}</div></div>` : ''}
    </section>
    ${project.services?.length ? `<section><div class="section-title">⚙️ Serviços Contratados</div><div>${project.services.map((s) => `<span class="chip">${esc(s)}</span>`).join('')}</div></section>` : ''}
    ${competitors.length ? `<section><div class="section-title">⚔️ Concorrentes</div><div>${competitors.map((c) => `<span class="chip">${esc(c)}</span>`).join('')}</div></section>` : ''}
    ${otherPeople.length ? `<section><div class="section-title">👥 Outras Pessoas Envolvidas</div><div class="grid grid-3">${otherPeople.map((p) => `<div class="field"><div class="field-label">${esc(p.name)}</div>${p.role ? `<div class="field-value" style="font-size:11px;color:#9ca3af">${esc(p.role)}</div>` : ''}</div>`).join('')}</div></section>` : ''}
  `

  // ── 2. ROI
  const roiHTML = (roiCalc && roiResult) ? `
    <section>
      <div class="section-title">📊 Calculadora de ROI</div>
      <div class="grid grid-3">
        <div class="field"><div class="field-label">Orçamento em Mídia</div><div class="field-value purple">${fmtBRL(roiCalc.mediaOrcamento)}</div></div>
        <div class="field"><div class="field-label">Custo de Marketing</div><div class="field-value">${fmtBRL(roiCalc.custoMarketing)}</div></div>
        <div class="field"><div class="field-label">Total Investido</div><div class="field-value">${fmtBRL(roiResult.totalInvestimento)}</div></div>
        <div class="field"><div class="field-label">Ticket Médio</div><div class="field-value">${fmtBRL(roiCalc.ticketMedio)}</div></div>
        <div class="field"><div class="field-label">Margem Bruta</div><div class="field-value">${roiCalc.margemBruta}%</div></div>
        <div class="field"><div class="field-label">ROI Desejado</div><div class="field-value">${roiCalc.roiDesejado}%</div></div>
      </div>
      <div class="grid grid-4" style="margin-top:12px">
        <div class="field"><div class="field-label">Leads Necessários</div><div class="field-value purple" style="font-size:18px">${fmtNum(roiResult.leadsNecessarios)}</div><div class="field-label">CPL: ${fmtBRL(roiResult.custoPorLead)}</div></div>
        <div class="field"><div class="field-label">MQLs</div><div class="field-value cyan" style="font-size:18px">${fmtNum(roiResult.mqlsNecessarios)}</div><div class="field-label">Taxa: ${roiCalc.taxaLead2MQL}%</div></div>
        <div class="field"><div class="field-label">SQLs</div><div class="field-value" style="font-size:18px;color:#0891b2">${fmtNum(roiResult.sqlsNecessarios)}</div><div class="field-label">Taxa: ${roiCalc.taxaMQL2SQL}%</div></div>
        <div class="field"><div class="field-label">Vendas</div><div class="field-value green" style="font-size:18px">${fmtNum(roiResult.vendasNecessarias)}</div><div class="field-label">CAC: ${fmtBRL(roiResult.cac)}</div></div>
      </div>
      <div class="grid grid-3" style="margin-top:12px">
        <div class="field"><div class="field-label">Faturamento Alvo</div><div class="field-value purple">${fmtBRL(roiResult.faturamento)}</div></div>
        <div class="field"><div class="field-label">Lucro Bruto</div><div class="field-value cyan">${fmtBRL(roiResult.lucroBruto)}</div></div>
        <div class="field"><div class="field-label">Lucro Líquido</div><div class="field-value ${roiResult.lucroLiquido >= 0 ? 'green' : 'red'}">${fmtBRL(roiResult.lucroLiquido)}</div></div>
      </div>
    </section>
  ` : ''

  // ── 3. Personas
  const personasHTML = personas.length ? `
    <section>
      <div class="section-title">👤 Personas</div>
      ${personas.map((persona) => {
        const answersHTML = PERSONA_QUESTIONS.map((q) => {
          const answers = (persona.answers?.[q.id] || []).filter((a) => a.trim())
          if (!answers.length) return ''
          return `<div class="qa-item"><div class="qa-label">${esc(q.label)}</div><div class="qa-value">${answers.map((a, i) => `${i + 1}. ${esc(a)}`).join(' · ')}</div></div>`
        }).filter(Boolean).join('')
        const generatedHTML = persona.generatedProfile
          ? `<div style="margin-top:12px;padding-top:10px;border-top:1px dashed #e9d5ff"><div class="qa-label" style="margin-bottom:6px">✨ Perfil Gerado por IA</div><div class="prose">${mdToHTML(persona.generatedProfile)}</div></div>`
          : ''
        return `<div class="persona-block"><div class="persona-name">${esc(persona.name || 'Persona')}</div>${answersHTML}${generatedHTML}</div>`
      }).join('')}
    </section>
  ` : ''

  // ── 4. Oferta Matadora
  const ofertaHTML = oferta ? `
    <section>
      <div class="section-title">⚡ Oferta Matadora</div>
      <div class="grid" style="grid-template-columns:1fr">
        ${oferta.nome               ? `<div class="field"><div class="field-label">🏷️ Nome da Oferta</div><div class="field-value purple">${esc(oferta.nome)}</div></div>` : ''}
        ${oferta.resultadoSonho     ? `<div class="field"><div class="field-label">✨ Resultado do Sonho</div><div class="field-value" style="font-weight:400;line-height:1.6">${esc(oferta.resultadoSonho)}</div></div>` : ''}
        ${oferta.porqueVaiFuncionar ? `<div class="field"><div class="field-label">💡 Por que vai funcionar</div><div class="field-value" style="font-weight:400;line-height:1.6">${esc(oferta.porqueVaiFuncionar)}</div></div>` : ''}
        ${oferta.velocidade         ? `<div class="field"><div class="field-label">⚡ Velocidade</div><div class="field-value" style="font-weight:400">${esc(oferta.velocidade)}</div></div>` : ''}
        ${oferta.esforcoMinimo      ? `<div class="field"><div class="field-label">🤝 Esforço Mínimo</div><div class="field-value" style="font-weight:400;line-height:1.6">${esc(oferta.esforcoMinimo)}</div></div>` : ''}
        ${oferta.garantia           ? `<div class="field"><div class="field-label">🛡️ Garantia</div><div class="field-value" style="font-weight:400;line-height:1.6">${esc(oferta.garantia)}</div></div>` : ''}
        ${oferta.escassez           ? `<div class="field"><div class="field-label">🔥 Escassez / Urgência</div><div class="field-value" style="font-weight:400">${esc(oferta.escassez)}</div></div>` : ''}
      </div>
      ${(oferta.bonus || []).filter((b) => b.trim()).length ? `<div class="section-title" style="margin-top:12px">🎁 Stack de Bônus</div><div>${(oferta.bonus || []).filter((b) => b.trim()).map((b, i) => `<div class="field"><div class="field-label">Bônus ${i + 1}</div><div class="field-value" style="font-weight:400">${esc(b)}</div></div>`).join('')}</div>` : ''}
      ${oferta.generatedOffer ? `<div class="section-title" style="margin-top:12px">🤖 Copy Gerada por IA</div><div class="prose">${mdToHTML(oferta.generatedOffer)}</div>` : ''}
    </section>
  ` : ''

  // ── 5. Planejamento de Campanhas
  let campaignHTML = ''
  if (campaignPlan?.totalBudget && campaignPlan.channels?.length) {
    const today    = new Date()
    const daysLeft = Math.max(new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate() + 1, 1)
    const { totalBudget, channels } = campaignPlan
    const rows = channels.map((ch) => {
      const chMon = totalBudget * (ch.percentage / 100)
      const stageRows = STAGE_KEYS.map((key) => {
        const st = ch.stages?.[key]
        if (!st || st.percentage === 0) return ''
        const stMon = chMon * (st.percentage / 100)
        const campRows = (st.campaigns || []).filter((c) => c.name || c.percentage).map((c) =>
          `<tr class="campaign-row"><td>${esc(c.name || '(sem nome)')}</td><td>${c.percentage}%</td><td>${fmtBRL(stMon * (c.percentage / 100))}</td><td>${fmtBRL(stMon * (c.percentage / 100) / daysLeft)}</td></tr>`
        ).join('')
        return `<tr class="stage-row"><td>${esc(STAGE_LABELS[key])}</td><td>${st.percentage}%</td><td>${fmtBRL(stMon)}</td><td>${fmtBRL(stMon / daysLeft)}</td></tr>${campRows}`
      }).join('')
      return `<tr class="channel-header"><td><strong>${esc(ch.name)}</strong></td><td>${ch.percentage}%</td><td>${fmtBRL(chMon)}</td><td>${fmtBRL(chMon / daysLeft)}</td></tr>${stageRows}`
    }).join('')
    campaignHTML = `
      <section>
        <div class="section-title">📅 Planejamento de Campanhas</div>
        <div class="grid grid-2" style="margin-bottom:12px">
          <div class="field"><div class="field-label">Orçamento Total Mensal</div><div class="field-value purple" style="font-size:18px">${fmtBRL(totalBudget)}</div></div>
          <div class="field"><div class="field-label">Orçamento Diário Médio</div><div class="field-value">${fmtBRL(totalBudget / daysLeft)}</div></div>
        </div>
        <table>
          <thead><tr><th>Canal / Etapa / Campanha</th><th>%</th><th>Mensal</th><th>Diário</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </section>
    `
  }

  // ── 6. Produtos / Serviços
  const produtosHTML = produtos.length ? `
    <section>
      <div class="section-title">📦 Produto / Serviço</div>
      ${produtos.map((p) => `
        <div class="persona-block">
          <div class="persona-name">${esc(p.nome || 'Produto')}</div>
          ${Object.entries(p.answers || {}).map(([, answers]) => {
            const valid = (Array.isArray(answers) ? answers : [answers]).filter((a) => a?.trim())
            if (!valid.length) return ''
            return `<div class="qa-item"><div class="qa-value">${valid.map((a) => esc(a)).join(' · ')}</div></div>`
          }).join('')}
        </div>
      `).join('')}
    </section>
  ` : ''

  printHTML('Perfil Completo do Cliente', project.companyName, empresaHTML + roiHTML + personasHTML + ofertaHTML + campaignHTML + produtosHTML)
}
