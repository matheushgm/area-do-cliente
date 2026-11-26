import { fmtCurrency, projectCurrency, fmtNum, escapeHtml } from '../lib/utils'
import { t, localeAtual, idiomaAtual } from '../i18n'
import { printDocument, docHeader, markdownToHtml, PAGE_CSS } from '../lib/printDoc'
import {
  rotuloNegocio, rotuloMaturidade, rotuloSegmento, rotuloModeloContrato, rotuloPagamento,
  rotuloServico, rotuloFunil,
} from '../lib/constants'
import { PROPOSTA_SECTIONS } from '../lib/propostaComercial'
import { webinarNoIdioma } from '../components/Webinar/webinarData'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtBRL = (n) => fmtCurrency(n, 2)
const esc = escapeHtml

// Formata percentuais no locale de quem gera. Ex: 10 → "10%", 10.5 → "10,5%" (pt) / "10.5%" (en).
function fmtPct(n) {
  if (n == null || isNaN(n) || !isFinite(n)) return '—'
  const formatted = Number(n).toLocaleString(localeAtual(), { maximumFractionDigits: 2 })
  return `${formatted}%`
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const PRINT_CSS = PAGE_CSS + `
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
  .prose ul, .prose ol { padding-left: 20px; margin-bottom: 6px; }
  .prose li { font-size: 12px; margin-bottom: 2px; }
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
  .account-row td { padding-left: 12px; background: #F8FAFF; font-weight: 600; }
  .stage-row td { padding-left: 20px; background: #F5F8FD; }
  .campaign-row td { padding-left: 36px; font-size: 11px; color: #64748B; }
  /* Proposta Comercial — 1 bloco por página (momento vs slide) */
  .pc-block { page-break-after: always; padding-top: 6px; }
  .pc-block:last-child { page-break-after: auto; }
  .pc-block-head {
    display: flex; align-items: center; gap: 10px;
    border-bottom: 2px solid #164496; padding-bottom: 10px; margin-bottom: 14px;
  }
  .pc-num { font-size: 20px; font-weight: 800; color: #164496; }
  .pc-title { font-size: 18px; font-weight: 800; color: #0F172A; flex: 1; }
  .pc-badge {
    font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
    padding: 3px 10px; border-radius: 99px;
  }
  .pc-badge.slide { background: #E4EBF7; color: #164496; }
  .pc-badge.momento { background: #F1F5F9; color: #64748B; }
  .pc-desc { font-size: 12px; color: #64748B; margin-bottom: 12px; }
  .pc-field { margin-bottom: 14px; }
  .pc-field .field-label { font-size: 11px; font-weight: 700; color: #164496; margin-bottom: 4px; }
  @media print {
    .persona-block { page-break-inside: avoid; }
    .pc-block { page-break-after: always; }
    .pc-block:last-child { page-break-after: auto; }
  }
`

// ─── Core printer ─────────────────────────────────────────────────────────────

function printHTML(title, subtitle, bodyHTML) {
  printDocument({
    title: `${title} — ${subtitle}`,
    css: PRINT_CSS,
    body: docHeader({ logo: 'Revenue Lab · Internal', title, subtitle }) + bodyHTML,
  })
}

// ─── Proposta Comercial PDF ─────────────────────────────────────────────────────
//
// Gera 1 bloco por página, cada um marcado como MOMENTO (fala/condução) ou SLIDE
// (conteúdo de slide). Blocos totalmente vazios são omitidos. A estrutura vem de
// PROPOSTA_SECTIONS (lib/propostaComercial.js), a mesma usada pelo formulário.
export function exportPropostaComercialPDF(project, data = {}) {
  const blocks = PROPOSTA_SECTIONS.map((sec) => {
    const filled = sec.campos.filter((f) => (data[f.id] || '').trim())
    if (!filled.length) return ''

    const badge = sec.tipo === 'SLIDE'
      ? `<span class="pc-badge slide">${L('proposta.slide')}</span>`
      : `<span class="pc-badge momento">${L('proposta.momento')}</span>`

    const fieldsHTML = filled
      .map((f) => `
        <div class="pc-field">
          <div class="field-label">${esc(f.label)}</div>
          <div class="prose">${markdownToHtml(data[f.id])}</div>
        </div>`)
      .join('')

    return `
      <section class="pc-block">
        <div class="pc-block-head">
          <span class="pc-num">${String(sec.n).padStart(2, '0')}</span>
          <span class="pc-title">${esc(sec.titulo)}</span>
          ${badge}
        </div>
        ${sec.descricao ? `<p class="pc-desc">${esc(sec.descricao)}</p>` : ''}
        ${fieldsHTML}
      </section>`
  }).filter(Boolean).join('\n')

  const body = blocks
    || `<section><p class="prose">${L('proposta.vazio')}</p></section>`
  const subtitle = project.companyName || project.nome || t('pdf.proposta.subtitulo')
  printHTML(t('pdf.proposta.titulo'), subtitle, body)
}

// ─── Onboarding PDF ───────────────────────────────────────────────────────────

export function exportOnboardingPDF(project) {
  const competitors = (project.competitors || []).filter(Boolean)
  const otherPeople = (project.otherPeople || []).filter((p) => p?.name)

  const serviceDetailEntries = Object.entries(project.servicesData || {}).reduce((acc, [id, data]) => {
    if (!data || Object.keys(data).length === 0) return acc
    const SERVICE_DETAIL_KEYS = ['imagemQty', 'videoQty', 'estaticosQty', 'qty', 'nivel']
    const parts = Object.entries(data).filter(([, v]) => v).map(([key, val]) => `${SERVICE_DETAIL_KEYS.includes(key) ? t(`pdf.onboarding.detalhe.${key}`) : key}: ${val}`).join(' · ')
    if (parts) acc.push({ id, detail: parts })
    return acc
  }, [])

  const simNao = (v) => L(v ? 'comum.sim' : 'comum.nao')

  const body = `
    <section>
      <div class="section-title">${L('onboarding.empresa')}</div>
      <div class="grid grid-3">
        ${project.businessType    ? `<div class="field"><div class="field-label">${L('onboarding.tipoNegocio')}</div><div class="field-value">${esc(rotuloNegocio(project.businessType))}</div></div>` : ''}
        ${project.segmento        ? `<div class="field"><div class="field-label">${L('onboarding.segmento')}</div><div class="field-value">${esc(rotuloSegmento(project.segmento))}</div></div>` : ''}
        ${project.cnpj            ? `<div class="field"><div class="field-label">${L('onboarding.cnpj')}</div><div class="field-value">${esc(project.cnpj)}</div></div>` : ''}
        ${project.responsibleName ? `<div class="field"><div class="field-label">${L('onboarding.responsavel')}</div><div class="field-value">${esc(project.responsibleName)}</div></div>` : ''}
        ${project.responsibleRole ? `<div class="field"><div class="field-label">${L('onboarding.cargo')}</div><div class="field-value">${esc(project.responsibleRole)}</div></div>` : ''}
        ${project.contractDate    ? `<div class="field"><div class="field-label">${L('onboarding.dataContrato')}</div><div class="field-value">${new Date(project.contractDate + 'T00:00:00').toLocaleDateString(localeAtual())}</div></div>` : ''}
      </div>
    </section>

    ${(project.contractModel || project.contractValue) ? `
    <section>
      <div class="section-title">${L('onboarding.contrato')}</div>
      <div class="grid grid-3">
        ${project.contractModel ? `<div class="field"><div class="field-label">${L('onboarding.modelo')}</div><div class="field-value">${esc(rotuloModeloContrato(project.contractModel))}</div></div>` : ''}
        ${project.contractModel === 'aceleracao' && project.contractPaymentType ? `<div class="field"><div class="field-label">${L('onboarding.tipoPagamento')}</div><div class="field-value">${esc(rotuloPagamento(project.contractPaymentType))}</div></div>` : ''}
        ${project.contractModel === 'aceleracao' ? `<div class="field"><div class="field-label">${L('onboarding.duracao')}</div><div class="field-value">${L('onboarding.nMeses', { count: Number(project.contractDurationMonths) || 3, n: Number(project.contractDurationMonths) || 3 })}</div></div>` : ''}
        ${project.contractValue ? `<div class="field"><div class="field-label">${project.contractModel === 'aceleracao' ? L('onboarding.valorContrato') : L('onboarding.valorMensal')}</div><div class="field-value purple">${fmtBRL(project.contractValue)}</div></div>` : ''}
      </div>
    </section>` : ''}

    ${project.services?.length ? `
    <section>
      <div class="section-title">${L('onboarding.servicos')}</div>
      <div>${project.services.map((s) => `<span class="chip">${esc(rotuloServico(s))}</span>`).join('')}</div>
      ${serviceDetailEntries.length ? `<div style="margin-top:8px">${serviceDetailEntries.map(({ detail }) => `<p style="font-size:11px;color:#64748b;margin-top:4px">↳ ${esc(detail)}</p>`).join('')}</div>` : ''}
    </section>` : ''}

    <section>
      <div class="section-title">${L('onboarding.equipe')}</div>
      <div class="grid grid-3">
        ${project.hasSalesTeam != null ? `<div class="field"><div class="field-label">${L('onboarding.timeVendas')}</div><div class="field-value">${simNao(project.hasSalesTeam)}</div></div>` : ''}
        ${project.digitalMaturity ? `<div class="field"><div class="field-label">${L('onboarding.maturidade')}</div><div class="field-value">${esc(rotuloMaturidade(project.digitalMaturity))}</div></div>` : ''}
        ${project.upsellPotential != null ? `<div class="field"><div class="field-label">${L('onboarding.upsell')}</div><div class="field-value">${simNao(project.upsellPotential)}</div></div>` : ''}
      </div>
      ${project.upsellNotes ? `<div class="field" style="margin-top:8px"><div class="field-label">${L('onboarding.obsUpsell')}</div><div class="field-value" style="font-weight:400">${esc(project.upsellNotes)}</div></div>` : ''}
    </section>

    ${otherPeople.length ? `
    <section>
      <div class="section-title">${L('onboarding.outrasPessoas')}</div>
      <div class="grid grid-3">
        ${otherPeople.map((p) => `<div class="field"><div class="field-label">${esc(p.name)}</div>${p.role ? `<div class="field-value" style="font-size:11px;color:#9ca3af">${esc(p.role)}</div>` : ''}</div>`).join('')}
      </div>
    </section>` : ''}

    ${competitors.length ? `
    <section>
      <div class="section-title">${L('onboarding.concorrentes')}</div>
      <div>${competitors.map((c) => `<span class="chip">${esc(c)}</span>`).join('')}</div>
    </section>` : ''}

    ${project.productDescription ? `
    <section>
      <div class="section-title">${L('onboarding.produto')}</div>
      <div class="field"><div class="field-value" style="font-weight:400;line-height:1.6">${esc(project.productDescription)}</div></div>
    </section>` : ''}
    ${project.targetAudience ? `
    <section>
      <div class="section-title">${L('onboarding.publico')}</div>
      <div class="field"><div class="field-value" style="font-weight:400;line-height:1.6">${esc(project.targetAudience)}</div></div>
    </section>` : ''}
    ${project.observacoes ? `
    <section>
      <div class="section-title">${L('onboarding.observacoes')}</div>
      <div class="field"><div class="field-value" style="font-weight:400;line-height:1.6;white-space:pre-wrap">${esc(project.observacoes)}</div></div>
    </section>` : ''}
  `

  printHTML(t('pdf.onboarding.titulo'), project.companyName, body)
}

// ─── ROI Calculator PDF ───────────────────────────────────────────────────────

// Rótulos dos PDFs saem no idioma de quem gera (namespace `pdf`); o que foi gravado e
// o que a IA gerou aparecem como estão.
const L = (chave, vars) => esc(t(`pdf.${chave}`, vars))
const pctLocal = (n) => (n == null || n === '' || isNaN(Number(n))
  ? '—'
  : `${Number(n).toLocaleString(localeAtual(), { maximumFractionDigits: 2 })}%`)

export function exportROIPDF(calc, result, project) {
  if (!result) return
  const moeda = projectCurrency(project)
  const money = (n) => fmtCurrency(n, 2, moeda)

  const body = `
    <section>
      <div class="section-title">💰 ${L('roi.investimento')}</div>
      <div class="grid grid-3">
        <div class="field"><div class="field-label">${L('roi.orcamentoMidia')}</div><div class="field-value purple">${money(calc.mediaOrcamento)}</div></div>
        <div class="field"><div class="field-label">${L('roi.custoMarketing')}</div><div class="field-value">${money(calc.custoMarketing)}</div></div>
        <div class="field"><div class="field-label">${L('roi.totalInvestido')}</div><div class="field-value" style="font-size:16px">${money(result.totalInvestimento)}</div></div>
      </div>
    </section>
    <section>
      <div class="section-title">📦 ${L('roi.produtoServico')}</div>
      <div class="grid grid-4">
        <div class="field"><div class="field-label">${L('roi.ticketMedio')}</div><div class="field-value">${money(calc.ticketMedio)}</div></div>
        <div class="field"><div class="field-label">${L('roi.compras')}</div><div class="field-value">${calc.qtdCompras}x</div></div>
        <div class="field"><div class="field-label">${L('roi.margemBruta')}</div><div class="field-value">${pctLocal(calc.margemBruta)}</div></div>
        <div class="field"><div class="field-label">${L('roi.lucroPorVenda')}</div><div class="field-value green">${money(result.lucroPorVenda)}</div></div>
      </div>
    </section>
    <section>
      <div class="section-title">🎯 ${L('roi.taxasConversao')}</div>
      <div class="grid grid-3">
        <div class="field"><div class="field-label">Lead → MQL</div><div class="field-value">${pctLocal(calc.taxaLead2MQL)}</div></div>
        <div class="field"><div class="field-label">MQL → SQL</div><div class="field-value">${pctLocal(calc.taxaMQL2SQL)}</div></div>
        <div class="field"><div class="field-label">${L('roi.sqlVenda')}</div><div class="field-value">${pctLocal(calc.taxaSQL2Venda)}</div></div>
      </div>
    </section>
    <section>
      <div class="section-title">📊 ${L('roi.metasPara', { roi: pctLocal(calc.roiDesejado) })}</div>
      <div class="grid grid-4">
        <div class="field"><div class="field-label">${L('roi.leadsNecessarios')}</div><div class="field-value purple" style="font-size:20px">${fmtNum(result.leadsNecessarios)}</div><div class="field-label" style="margin-top:4px">CPL: ${money(result.custoPorLead)}</div></div>
        <div class="field"><div class="field-label">${L('roi.mqlsNecessarios')}</div><div class="field-value cyan" style="font-size:20px">${fmtNum(result.mqlsNecessarios)}</div><div class="field-label" style="margin-top:4px">CPM: ${money(result.custoPorMQL)}</div></div>
        <div class="field"><div class="field-label">${L('roi.sqlsNecessarios')}</div><div class="field-value" style="font-size:20px;color:#0891b2">${fmtNum(result.sqlsNecessarios)}</div><div class="field-label" style="margin-top:4px">CPS: ${money(result.custoPorSQL)}</div></div>
        <div class="field"><div class="field-label">${L('roi.vendasNecessarias')}</div><div class="field-value green" style="font-size:20px">${fmtNum(result.vendasNecessarias)}</div><div class="field-label" style="margin-top:4px">CAC: ${money(result.cac)}</div></div>
      </div>
    </section>
    <section>
      <div class="section-title">💹 ${L('roi.financeiro')}</div>
      <div class="grid grid-4">
        <div class="field"><div class="field-label">${L('roi.totalInvestido')}</div><div class="field-value">${money(result.totalInvestimento)}</div></div>
        <div class="field"><div class="field-label">${L('roi.faturamentoAlvo')}</div><div class="field-value purple">${money(result.faturamento)}</div></div>
        <div class="field"><div class="field-label">${L('roi.lucroBruto')}</div><div class="field-value cyan">${money(result.lucroBruto)}</div></div>
        <div class="field"><div class="field-label">${L('roi.lucroLiquido')}</div><div class="field-value ${result.lucroLiquido >= 0 ? 'green' : 'red'}">${money(result.lucroLiquido)}</div></div>
      </div>
    </section>
    <section>
      <div class="section-title">⚖️ ${L('roi.pontoEquilibrio')}</div>
      <div class="grid grid-2">
        <div class="field"><div class="field-label">${L('roi.vendasMinimas')}</div><div class="field-value gold" style="font-size:18px">${L('roi.nVendas', { count: result.vendasBreakeven, n: fmtNum(result.vendasBreakeven) })}</div></div>
        <div class="field"><div class="field-label">CAC</div><div class="field-value gold" style="font-size:18px">${money(result.cac)}</div></div>
      </div>
    </section>
  `

  printHTML(t('pdf.roi.titulo'), project.companyName, body)
}

// ─── Metas Semanais PDF ───────────────────────────────────────────────────────
//
// Espelha a aba "Metas Semanais" da Calculadora de ROI: distribui as metas
// mensais (leads/MQLs/SQLs/vendas) pelo número de semanas do mês corrente e
// mostra o custo de marketing por semana. `numSemanas` e `mesAtual` são
// calculados no componente e passados prontos.
export function exportMetasSemanaisPDF(calc, result, project, numSemanas, mesAtual) {
  if (!result) return
  const moeda = projectCurrency(project)
  const money = (n) => fmtCurrency(n, 2, moeda)

  const semanas = Math.max(Number(numSemanas) || 1, 1)

  const metas = [
    { label: t('pdf.metas.leadsSemana'),  total: result.leadsNecessarios,  color: 'purple' },
    { label: t('pdf.metas.mqlsSemana'),   total: result.mqlsNecessarios,   color: 'cyan'   },
    { label: t('pdf.metas.sqlsSemana'),   total: result.sqlsNecessarios,   color: 'cyan'   },
    { label: t('pdf.metas.vendasSemana'), total: result.vendasNecessarias, color: 'green'  },
  ].map((m) => ({ ...m, semanal: Math.ceil(m.total / semanas) }))

  const cardsHTML = metas.map((m) => `
    <div class="field" style="text-align:center">
      <div class="field-value ${m.color}" style="font-size:28px">${fmtNum(m.semanal)}</div>
      <div class="field-label" style="margin-top:4px">${esc(m.label)}</div>
      <div class="field-label" style="margin-top:2px;color:#94A3B8">${L('metas.porMes', { n: fmtNum(m.semanal * semanas) })}</div>
    </div>`).join('')

  const body = `
    <section>
      <div class="section-title">🗓️ ${L('metas.periodo')}</div>
      <div class="grid grid-3">
        <div class="field"><div class="field-label">${L('metas.mes')}</div><div class="field-value">${esc(mesAtual || '—')}</div></div>
        <div class="field"><div class="field-label">${L('metas.semanasNoMes')}</div><div class="field-value purple">${L('metas.nSemanas', { count: semanas, n: fmtNum(semanas) })}</div></div>
        <div class="field"><div class="field-label">${L('metas.roiAlvo')}</div><div class="field-value">${pctLocal(calc.roiDesejado)}</div></div>
      </div>
    </section>
    <section>
      <div class="section-title">🎯 ${L('metas.titulo')}</div>
      <div class="grid grid-4">${cardsHTML}</div>
    </section>
    <section>
      <div class="section-title">💸 ${L('roi.custoMarketing')}</div>
      <div class="grid grid-2">
        <div class="field"><div class="field-label">${L('metas.porSemana')}</div><div class="field-value gold" style="font-size:18px">${money(calc.custoMarketing / semanas)}</div></div>
        <div class="field"><div class="field-label">${L('metas.totalNoMes')}</div><div class="field-value">${money(calc.custoMarketing)}</div></div>
      </div>
    </section>
  `

  printHTML(t('pdf.metas.titulo'), project.companyName, body)
}

// ─── Personas PDF ─────────────────────────────────────────────────────────────

function isSectionHeaderPDF(line) {
  const t = line.trim()
  if (!t || t === '---') return false
  return t === t.toUpperCase() && /[A-ZÁÉÍÓÚÀÂÊÔÃÕÜÇ]/.test(t)
}

function plainTextToHTML(text) {
  if (!text) return ''
  return text.split('\n').map((line) => {
    const trimmed = line.trim()
    if (trimmed === '---') return '<hr style="border:none;border-top:1px solid #e9d5ff;margin:12px 0">'
    if (trimmed === '')    return '<br>'
    if (isSectionHeaderPDF(trimmed))
      return `<p style="font-size:11px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:.06em;margin:14px 0 4px">${esc(trimmed)}</p>`
    if (line.startsWith('  - '))
      return `<p style="font-size:11px;color:#6b7280;margin:2px 0 2px 24px">– ${esc(line.slice(4))}</p>`
    if (trimmed.startsWith('- '))
      return `<p style="font-size:11px;color:#1f2937;margin:3px 0 3px 8px">• ${esc(trimmed.slice(2))}</p>`
    return `<p style="font-size:11px;color:#374151;margin:3px 0 3px 8px">${esc(trimmed)}</p>`
  }).join('\n')
}

export function exportPersonasPDF(personas, project) {
  const blocksHTML = personas
    .filter((p) => p.generatedProfile)
    .map((persona) => `
      <div class="persona-block">
        <div class="persona-name">${esc(persona.name || t('pdf.personas.persona'))}</div>
        <div class="prose">${plainTextToHTML(persona.generatedProfile)}</div>
      </div>
    `).join('')

  const empty = !blocksHTML
    ? '<p style="color:#9ca3af;font-size:13px;text-align:center;padding:32px 0">' + L('personas.vazio') + '</p>'
    : ''

  printHTML(t('pdf.personas.titulo'), project.companyName, blocksHTML + empty)
}

// ─── Oferta Matadora PDF ──────────────────────────────────────────────────────

// Labels dos campos guiados do wizard (espelham ofertaShared.js — manter em sync).
// Valor gravado → chave em pdf.oferta.*; valor desconhecido aparece como veio.
const OFERTA_ATENCAO_CHAVE = { '1a1': 'umAUm', grupo: 'grupo', muitos: 'muitos' }
const OFERTA_ESFORCO_IDS   = ['dfy', 'dwy', 'diy']
const OFERTA_GARANTIA_IDS  = ['incondicional', 'condicional', 'anti', 'implicita']
const OFERTA_DRIVER_IDS    = ['valor', 'probabilidade', 'esforco', 'tempo']

export function exportOfertaPDF(oferta, project) {
  const bonusValidos = (oferta.bonus || []).filter((b) => b.trim())
  const fmtR$ = (n) => `R$ ${(Number(n) || 0).toLocaleString(localeAtual())}`

  // ── Diagnóstico (Passo 0) ──
  const diag = oferta.diagnostico
  const tipoLabel = oferta.tipoCliente === 'b2b' ? t('pdf.oferta.tipoB2b') : oferta.tipoCliente === 'b2c' ? t('pdf.oferta.tipoB2c') : ''
  const diagHTML = (diag?.verdict || tipoLabel) ? `
    <section>
      <div class="section-title">${L('oferta.diagnostico')}</div>
      <div class="grid grid-2">
        ${tipoLabel ? `<div class="field"><div class="field-label">${L('oferta.tipoCliente')}</div><div class="field-value">${esc(tipoLabel)}</div></div>` : ''}
        ${diag?.verdict ? `<div class="field"><div class="field-label">${L('oferta.veredito')}</div><div class="field-value" style="color:${esc(diag.verdict.color || '#374151')}">${esc(diag.verdict.emoji || '')} ${esc(diag.verdict.label || '')} · ${esc(String(diag.totalScore ?? ''))}/100</div></div>` : ''}
      </div>
    </section>` : ''

  // ── Sonho (Passo 1) ──
  const fieldsHTML = `
    <section>
      <div class="section-title">${L('oferta.dados')}</div>
      <div class="grid" style="grid-template-columns:1fr;">
        ${oferta.nome ? `<div class="field"><div class="field-label">${L('oferta.nome')}</div><div class="field-value purple">${esc(oferta.nome)}</div></div>` : ''}
        ${oferta.dorAtual ? `<div class="field"><div class="field-label">${L('oferta.dorAtual')}</div><div class="field-value" style="font-weight:400;line-height:1.6">${esc(oferta.dorAtual)}</div></div>` : ''}
        ${oferta.resultadoSonho ? `<div class="field"><div class="field-label">${L('oferta.resultadoSonho')}</div><div class="field-value" style="font-weight:400;line-height:1.6">${esc(oferta.resultadoSonho)}</div></div>` : ''}
        ${oferta.statusGanho ? `<div class="field"><div class="field-label">${L('oferta.statusGanho')}</div><div class="field-value" style="font-weight:400;line-height:1.6">${esc(oferta.statusGanho)}</div></div>` : ''}
        ${oferta.porqueVaiFuncionar ? `<div class="field"><div class="field-label">${L('oferta.porqueFunciona')}</div><div class="field-value" style="font-weight:400;line-height:1.6">${esc(oferta.porqueVaiFuncionar)}</div></div>` : ''}
        ${oferta.velocidade ? `<div class="field"><div class="field-label">${L('oferta.velocidade')}</div><div class="field-value" style="font-weight:400">${esc(oferta.velocidade)}</div></div>` : ''}
        ${oferta.esforcoMinimo ? `<div class="field"><div class="field-label">${L('oferta.esforcoMinimo')}</div><div class="field-value" style="font-weight:400;line-height:1.6">${esc(oferta.esforcoMinimo)}</div></div>` : ''}
      </div>
    </section>
  `

  // ── Problemas + Soluções (Passos 2-3) ──
  const problemas = (oferta.problemas || []).filter((p) => p.texto?.trim())
  const solucoes  = oferta.solucoes || []
  const solByProb = (pid) => solucoes.find((s) => s.problemaId === pid)?.comoResolve?.trim()
  const problemasHTML = problemas.length ? `
    <section>
      <div class="section-title">${L('oferta.problemas')}</div>
      <div class="grid" style="grid-template-columns:1fr;">
        ${['valor', 'probabilidade', 'esforco', 'tempo'].map((driver) => {
          const doDriver = problemas.filter((p) => p.driver === driver)
          if (!doDriver.length) return ''
          return `
            <div class="field">
              <div class="field-label">${OFERTA_DRIVER_IDS.includes(driver) ? L(`oferta.driver.${driver}`) : esc(driver)}</div>
              ${doDriver.map((p) => {
                const sol = solByProb(p.id)
                return `<div style="font-size:11px;color:#374151;margin:3px 0 3px 8px">• ${esc(p.texto)}${sol ? `<br><span style="color:#7c3aed;margin-left:12px">→ ${esc(sol)}</span>` : ''}</div>`
              }).join('')}
            </div>`
        }).join('')}
      </div>
    </section>` : ''

  // ── Entrega (Passo 4) ──
  const ent = oferta.entrega || {}
  const entregaParts = [
    ent.atencao ? (OFERTA_ATENCAO_CHAVE[ent.atencao] ? t(`pdf.oferta.atencao.${OFERTA_ATENCAO_CHAVE[ent.atencao]}`) : ent.atencao) : null,
    ent.esforcoModelo ? (OFERTA_ESFORCO_IDS.includes(ent.esforcoModelo) ? t(`pdf.oferta.esforcoModelo.${ent.esforcoModelo}`) : ent.esforcoModelo) : null,
    (ent.meio || []).length ? (ent.meio || []).join(', ') : null,
  ].filter(Boolean)
  const entregaHTML = entregaParts.length ? `
    <section>
      <div class="section-title">${L('oferta.entrega')}</div>
      <div class="field"><div class="field-value" style="font-weight:400">${esc(entregaParts.join(' · '))}</div></div>
    </section>` : ''

  // ── Núcleo + Stack + Preço (Passo 5) ──
  const stack = (oferta.itensStack || []).filter((i) => i.nome?.trim())
  const valorTotal = stack.reduce((s, i) => s + (Number(i.valor) || 0), 0)
  const preco = Number(oferta.preco) || 0
  const ratio = preco > 0 && valorTotal > 0 ? (valorTotal / preco) : 0
  const stackHTML = (oferta.nucleo || stack.length || preco) ? `
    <section>
      <div class="section-title">${L('oferta.stack')}</div>
      <div class="grid" style="grid-template-columns:1fr;">
        ${oferta.nucleo ? `<div class="field"><div class="field-label">${L('oferta.nucleo')}</div><div class="field-value" style="font-weight:400">${esc(oferta.nucleo)}</div></div>` : ''}
        ${stack.length ? `
          <div class="field">
            <div class="field-label">${L('oferta.entregas')}</div>
            ${stack.map((i, idx) => `<div style="font-size:11px;color:#374151;margin:3px 0 3px 8px;display:flex;justify-content:space-between"><span>${L('oferta.entregaN', { n: idx + 1, nome: i.nome })}</span><span style="font-weight:600;white-space:nowrap;margin-left:12px">${fmtR$(i.valor)}</span></div>`).join('')}
          </div>` : ''}
        ${(valorTotal || preco) ? `
          <div class="field">
            <div class="field-value" style="font-size:13px">
              ${valorTotal ? `${L('oferta.valorTotal')} <b>${fmtR$(valorTotal)}</b>` : ''}
              ${preco ? ` · ${L('oferta.preco')} <b class="gold">${fmtR$(preco)}</b>` : ''}
              ${ratio ? ` · <b>${ratio.toLocaleString(localeAtual(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })}x</b> ${L('oferta.deValor')}` : ''}
            </div>
          </div>` : ''}
      </div>
    </section>` : ''

  // ── Escassez + Urgência (Passo 6) ──
  const escUrgHTML = (oferta.escassez || oferta.urgencia) ? `
    <section>
      <div class="section-title">${L('oferta.escassezUrgencia')}</div>
      <div class="grid" style="grid-template-columns:1fr;">
        ${oferta.escassez ? `<div class="field"><div class="field-label">${L('oferta.escassez')}</div><div class="field-value" style="font-weight:400">${esc(oferta.escassez)}</div></div>` : ''}
        ${oferta.urgencia ? `<div class="field"><div class="field-label">${L('oferta.urgencia')}</div><div class="field-value" style="font-weight:400">${esc(oferta.urgencia)}</div></div>` : ''}
      </div>
    </section>` : ''

  // ── Bônus (Passo 7) ──
  const bonusHTML = bonusValidos.length ? `
    <section>
      <div class="section-title">${L('oferta.bonus')}</div>
      <div class="grid" style="grid-template-columns:1fr;">
        ${bonusValidos.map((b, i) => `
          <div class="field"><div class="field-label">${L('oferta.bonusN', { n: i + 1 })}</div><div class="field-value" style="font-weight:400">${esc(b)}</div></div>
        `).join('')}
      </div>
    </section>` : ''

  // ── Garantia (Passo 8) ──
  const garantiaHTML = oferta.garantia ? `
    <section>
      <div class="section-title">${L('oferta.garantia')}${oferta.garantiaTipo ? ` — ${OFERTA_GARANTIA_IDS.includes(oferta.garantiaTipo) ? L(`oferta.garantiaTipo.${oferta.garantiaTipo}`) : esc(oferta.garantiaTipo)}` : ''}</div>
      <div class="field"><div class="field-value" style="font-weight:400;line-height:1.6">${esc(oferta.garantia)}</div></div>
    </section>` : ''

  const generatedHTML = oferta.generatedOffer ? `
    <section>
      <div class="section-title">${L('oferta.gerada')}</div>
      <div class="prose">${markdownToHtml(oferta.generatedOffer)}</div>
    </section>` : ''

  printHTML(
    t('pdf.oferta.titulo'),
    project.companyName,
    diagHTML + fieldsHTML + problemasHTML + entregaHTML + stackHTML + escUrgHTML + bonusHTML + garantiaHTML + generatedHTML
  )
}

// ─── Campaign Planner PDF ─────────────────────────────────────────────────────

const stageLabel   = (key) => t(`pdf.campanha.etapa.${key}`)
const STAGE_KEYS   = ['topo', 'meio', 'fundo']
const META_TAX     = 0.13

// Calcula dias entre duas datas ISO inclusive, com mínimo 1.
function daysBetweenISO(startISO, endISO) {
  if (!endISO) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const start = startISO ? new Date(startISO + 'T00:00:00') : today
  if (start < today) start.setTime(today.getTime())
  const end = new Date(endISO + 'T00:00:00')
  const diff = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
  return Math.max(diff, 1)
}

// Default: primeiro até o último dia do mês corrente.
function defaultDaysOfCurrentMonth() {
  const today   = new Date()
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  return Math.max(lastDay.getDate() - today.getDate() + 1, 1)
}

function fmtCampaignPeriod(startISO, endISO) {
  if (!startISO || !endISO) return null
  const fmt = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString(localeAtual(), { day: '2-digit', month: '2-digit' })
  return `${fmt(startISO)} → ${fmt(endISO)}`
}

export function exportCampaignPDF(campaignPlan, project) {
  if (!campaignPlan?.totalBudget) return

  // Período do plano — usa as datas salvas se houver, senão cai pro mês corrente.
  const planStartISO = campaignPlan.startDate || null
  const planEndISO   = campaignPlan.endDate   || null
  const daysLeft     = planEndISO ? daysBetweenISO(planStartISO, planEndISO) : defaultDaysOfCurrentMonth()

  const periodLabel = (() => {
    if (!planEndISO) {
      const today = new Date()
      const monthOnly = today.toLocaleDateString(localeAtual(), { month: 'long', year: 'numeric' })
      return `${monthOnly.charAt(0).toUpperCase()}${monthOnly.slice(1)}`
    }
    const fmt = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString(localeAtual(), { day: '2-digit', month: '2-digit', year: 'numeric' })
    if (planStartISO) return t('pdf.campanha.periodoDeAte', { inicio: fmt(planStartISO), fim: fmt(planEndISO) })
    return t('pdf.campanha.periodoAte', { fim: fmt(planEndISO) })
  })()

  const { totalBudget, channels = [] } = campaignPlan

  // Soma do investimento líquido (com -13% nos canais Meta) — usado no card de resumo.
  let netTotal = 0

  const rows = channels.map((ch) => {
    const isMeta       = ch.name === 'Meta Ads'
    const chMonBruto   = totalBudget * (ch.percentage / 100)
    const chMon        = isMeta ? chMonBruto * (1 - META_TAX) : chMonBruto
    const chDay        = chMon / daysLeft
    netTotal += chMon

    const metaInfo = isMeta
      ? `<span style="display:block;font-size:9px;color:#94A3B8;font-weight:500">${L('campanha.bruto', { valor: fmtBRL(chMonBruto) })}</span>`
      : ''

    const channelRow = `<tr class="channel-header">
      <td><strong>${esc(ch.name)}</strong>${metaInfo}</td>
      <td>${fmtPct(ch.percentage)}</td>
      <td>${fmtBRL(chMon)}</td>
      <td>${fmtBRL(chDay)}</td>
    </tr>`

    // Etapas + campanhas de um "pai" (o canal, ou uma conta de anúncio dele).
    const stageRowsFor = (stages, parentMon) => STAGE_KEYS.map((key) => {
      const st = stages?.[key]
      if (!st || st.percentage === 0) return ''
      const stMon = parentMon * (st.percentage / 100)
      const stDay = stMon / daysLeft

      const campRows = (st.campaigns || []).map((c) => {
        if (!c.name && !c.percentage) return ''
        const cMon = stMon * (c.percentage / 100)
        const hasOwnPeriod = !!(c.startDate && c.endDate)
        const ownDays      = hasOwnPeriod ? daysBetweenISO(c.startDate, c.endDate) : null
        const cDay         = hasOwnPeriod ? cMon / ownDays : cMon / daysLeft
        const periodInfo   = hasOwnPeriod
          ? `<span style="display:block;font-size:9px;color:#7C3AED;font-weight:600">📅 ${fmtCampaignPeriod(c.startDate, c.endDate)} · ${L('campanha.nDias', { count: ownDays, n: ownDays })}</span>`
          : ''
        const dailyLabel = hasOwnPeriod ? `${fmtBRL(cDay)} <span style="font-size:9px;color:#94A3B8">(${ownDays}d)</span>` : fmtBRL(cDay)
        return `<tr class="campaign-row">
          <td>${esc(c.name || t('pdf.campanha.semNome'))}${periodInfo}</td>
          <td>${fmtPct(c.percentage)}</td>
          <td>${fmtBRL(cMon)}</td>
          <td>${dailyLabel}</td>
        </tr>`
      }).join('')

      return `<tr class="stage-row">
        <td>${esc(stageLabel(key))}</td>
        <td>${fmtPct(st.percentage)}</td>
        <td>${fmtBRL(stMon)}</td>
        <td>${fmtBRL(stDay)}</td>
      </tr>${campRows}`
    }).join('')

    // Canal repartido por conta de anúncio ganha uma linha por conta.
    const subAccounts = ch.adAccounts || []
    const stageRows = subAccounts.length
      ? subAccounts.map((ac) => {
        const acMon = chMon * ((ac.percentage || 0) / 100)
        return `<tr class="account-row">
          <td>${esc(ac.name || t('pdf.campanha.contaSemNome'))}</td>
          <td>${fmtPct(ac.percentage)}</td>
          <td>${fmtBRL(acMon)}</td>
          <td>${fmtBRL(acMon / daysLeft)}</td>
        </tr>${stageRowsFor(ac.stages, acMon)}`
      }).join('')
      : stageRowsFor(ch.stages, chMon)

    return channelRow + stageRows
  }).join('')

  const hasMetaChannel = channels.some((ch) => ch.name === 'Meta Ads')
  const grossLine = hasMetaChannel
    ? `<div class="field"><div class="field-label">${L('campanha.investBruto')}</div><div class="field-value">${fmtBRL(totalBudget)}</div></div>`
    : ''
  const netLine = hasMetaChannel
    ? `<div class="field"><div class="field-label">${L('campanha.investLiquido')}</div><div class="field-value purple" style="font-size:20px">${fmtBRL(netTotal)}</div></div>`
    : `<div class="field"><div class="field-label">${L('campanha.orcamentoTotal')}</div><div class="field-value purple" style="font-size:20px">${fmtBRL(totalBudget)}</div></div>`

  const body = `
    <section>
      <div class="section-title">${L('campanha.resumo')}</div>
      <div class="grid grid-3">
        ${netLine}
        <div class="field"><div class="field-label">${L('campanha.diarioMedio')}</div><div class="field-value">${fmtBRL(netTotal / daysLeft)}</div></div>
        <div class="field"><div class="field-label">${L('campanha.periodo')}</div><div class="field-value" style="font-size:12px">${esc(periodLabel)} · ${L('campanha.nDias', { count: daysLeft, n: daysLeft })}</div></div>
      </div>
      ${hasMetaChannel ? `<div style="margin-top:8px">${grossLine}</div>` : ''}
    </section>
    <section>
      <div class="section-title">${L('campanha.distribuicao')}</div>
      <table>
        <thead>
          <tr>
            <th>${L('campanha.colCanal')}</th>
            <th>${L('campanha.colVerba')}</th>
            <th>${L('campanha.colMensal')}</th>
            <th>${L('campanha.colDiario')}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `

  printHTML(t('pdf.campanha.titulo'), project.companyName, body)
}

// ─── Planejamento de Marketing PDF (paisagem) ───────────────────────────────────
//
// Recebe `data` (inputs do formulário) e `plan` (saída de computePlan no módulo) já
// prontos — não recalcula nada. Gera uma página A4 horizontal com faixa de KPIs e a
// planilha mês a mês (Meta, Crescimento, funil, investimento e custos).
const PLANEJAMENTO_MKT_CSS = `
  @page { size: A4 landscape; margin: 10mm; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #0F172A; background: #fff; padding: 24px 28px;
    -webkit-font-smoothing: antialiased;
  }
  .header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 2px solid #164496; padding-bottom: 14px; margin-bottom: 18px; }
  .logo { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #164496; }
  .doc-title { font-size: 22px; font-weight: 800; color: #0F172A; margin-top: 2px; }
  .doc-subtitle { font-size: 13px; color: #64748B; margin-top: 1px; }
  .doc-meta { text-align: right; font-size: 11px; color: #94A3B8; }
  .badge { display: inline-block; margin-top: 6px; padding: 3px 10px; border-radius: 99px; background: #E4EBF7; color: #164496; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
  .kpis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 18px; }
  .kpi { background: #F5F8FD; border: 1px solid #D8E0F0; border-radius: 8px; padding: 9px 11px; }
  .kpi-label { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #94A3B8; margin-bottom: 3px; }
  .kpi-value { font-size: 14px; font-weight: 800; color: #0F172A; line-height: 1.1; }
  .kpi-value.green { color: #059669; } .kpi-value.purple { color: #164496; } .kpi-value.gold { color: #D97706; } .kpi-value.cyan { color: #0284C7; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; table-layout: fixed; }
  thead th { background: #EEF2F9; color: #164496; font-size: 10px; font-weight: 700; padding: 7px 6px; text-align: right; border-bottom: 2px solid #D8E0F0; }
  thead th.rowlabel { text-align: left; width: 128px; }
  thead th.total { border-left: 1.5px solid #C7D3EA; }
  tbody th.rowlabel { text-align: left; font-size: 10.5px; font-weight: 600; color: #475569; padding: 6px 8px 6px 2px; }
  tbody td { padding: 6px 6px; text-align: right; font-variant-numeric: tabular-nums; border-bottom: 1px solid #F1F5F9; color: #0F172A; }
  tr.strong th.rowlabel, tr.strong td { font-weight: 800; }
  td.past { color: #94A3B8; background: #FAFBFE; }
  td.total { border-left: 1.5px solid #C7D3EA; font-weight: 800; }
  td.green, th.green { color: #059669; } td.purple { color: #164496; } td.gold { color: #D97706; } td.cyan { color: #0284C7; } td.blue { color: #2563EB; }
  tr.strong { background: #FBFCFE; }
  .foot { margin-top: 14px; font-size: 10px; color: #94A3B8; line-height: 1.5; }
  @media print { body { padding: 0; } }
`

export function exportPlanejamentoMarketingPDF(data, plan, project) {
  const loc = localeAtual()
  const MESES = Array.from({ length: 12 }, (_, i) => {
    const m = new Date(2000, i, 1).toLocaleDateString(loc, { month: 'short' }).replace('.', '')
    return m.charAt(0).toUpperCase() + m.slice(1)
  })
  const empresa = project?.companyName || project?.company_name || project?.nome || t('pdf.produto.cliente')
  const today = new Date().toLocaleDateString(loc, { day: '2-digit', month: 'long', year: 'numeric' })
  const money = (n) => (n == null || !isFinite(n) || isNaN(n)) ? '—'
    : n.toLocaleString(loc, { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 })
  const pctv = (n) => (n == null || !isFinite(n) || isNaN(n)) ? '—'
    : `${(n * 100).toLocaleString(loc, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
  const numv = (n) => (n == null || !isFinite(n) || isNaN(n)) ? '—' : Math.ceil(n).toLocaleString(loc)

  const distLabel = plan.distribuicao === 'linear' ? t('pdf.planejamento.distribuicao.linear')
    : plan.distribuicao === 'igual' ? t('pdf.planejamento.distribuicao.igual') : t('pdf.planejamento.distribuicao.composto')

  const crescIgual = plan.distribuicao === 'igual'
  const crescLabel = crescIgual ? t('pdf.planejamento.metaPorMes')
    : plan.distribuicao === 'linear' ? t('pdf.planejamento.crescMedio') : t('pdf.planejamento.crescNecessario')
  const crescValue = crescIgual
    ? ((plan.mesesRestantes > 0 && plan.gap > 0) ? money(plan.gap / plan.mesesRestantes) : '—')
    : (plan.crescimentoRef != null ? pctv(plan.crescimentoRef) : '—')

  const kpis = [
    { label: t('pdf.planejamento.faturamentoAteAgora'), value: money(plan.realizadoTotal), cls: '' },
    { label: t('pdf.planejamento.mediaMensal', { n: plan.mesesDecorridos }), value: money(plan.mediaMensal), cls: 'cyan' },
    { label: t('pdf.planejamento.metaAnual'), value: money(plan.metaAnual), cls: 'green' },
    { label: t('pdf.planejamento.projecao'), value: money(plan.projetadoMedia), cls: 'gold' },
    { label: crescLabel, value: crescValue, cls: 'purple' },
    { label: t('pdf.planejamento.gap'), value: money(plan.gap), cls: 'gold' },
  ]

  const rowsCfg = [
    { label: t('pdf.planejamento.metaFaturamento'), get: (r) => r.meta,         fmt: money, tk: 'meta',         strong: true, cls: 'green' },
    { label: t('pdf.planejamento.crescimento'), get: (r) => r.crescimento,  fmt: pctv,  tk: null,           cls: 'purple' },
    { label: t('pdf.planejamento.novasVendas'), get: (r) => r.vendas,       fmt: numv,  tk: 'vendas',       cls: '' },
    { label: 'SQLs',                get: (r) => r.sqls,         fmt: numv,  tk: 'sqls',         cls: 'cyan' },
    { label: 'MQLs',                get: (r) => r.mqls,         fmt: numv,  tk: 'mqls',         cls: 'purple' },
    { label: 'Leads',               get: (r) => r.leads,        fmt: numv,  tk: 'leads',        cls: 'blue' },
    { label: t('pdf.planejamento.investimento'), get: (r) => r.investimento, fmt: money, tk: 'investimento', strong: true, cls: 'gold' },
    { label: 'CPL',                 get: (r) => r.cpl,          fmt: money, tk: 'cpl',          cls: '' },
    { label: 'CPMql',               get: (r) => r.cpmql,        fmt: money, tk: 'cpmql',        cls: 'purple' },
    { label: 'CPSql',               get: (r) => r.cpsql,        fmt: money, tk: 'cpsql',        cls: 'cyan' },
    { label: 'CAC',                 get: (r) => r.cac,          fmt: money, tk: 'cac',          cls: 'green' },
  ]

  const headCols = MESES.map((m, i) => `<th class="${i < plan.mesesDecorridos ? 'past' : ''}">${m}</th>`).join('')
  const bodyRows = rowsCfg.map((rc) => {
    const tds = plan.rows.map((r, i) => {
      const past = i < plan.mesesDecorridos
      return `<td class="${past ? 'past' : ''} ${rc.cls}">${rc.fmt(rc.get(r))}</td>`
    }).join('')
    const totalVal = rc.tk ? rc.fmt(plan.totals[rc.tk]) : ''
    return `<tr class="${rc.strong ? 'strong' : ''}">
      <th scope="row" class="rowlabel">${esc(rc.label)}</th>
      ${tds}
      <td class="total ${rc.cls}">${totalVal}</td>
    </tr>`
  }).join('')

  printDocument({
    title: `${t('pdf.planejamento.titulo')} — ${empresa}`,
    css: PLANEJAMENTO_MKT_CSS,
    body: `
  <div class="header">
    <div>
      <div class="logo">Revenue Lab · Internal</div>
      <div class="doc-title">${L('planejamento.titulo')}</div>
      <div class="doc-subtitle">${esc(empresa)}</div>
    </div>
    <div class="doc-meta">
      ${L('doc.geradoEm', { data: today })}
      <div class="badge">${esc(distLabel)}</div>
    </div>
  </div>

  <div class="kpis">
    ${kpis.map((k) => `<div class="kpi"><div class="kpi-label">${esc(k.label)}</div><div class="kpi-value ${k.cls}">${k.value}</div></div>`).join('')}
  </div>

  <table>
    <thead>
      <tr>
        <th class="rowlabel">${L('planejamento.indicador')}</th>
        ${headCols}
        <th class="total">${L('planejamento.total')}</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>

  <p class="foot">
    ${L('planejamento.rodape1')}
    ${L('planejamento.rodape2')}
    ${L('planejamento.rodape3')}
  </p>`,
    width: 1200, height: 800,
  })
}

// ─── Estratégia V2 PDF ────────────────────────────────────────────────────────

const V2_CSS = `
  @media print { .page-break { page-break-before: always; } }

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
  .account-row td { padding-left: 12px; background: #F8FAFF; font-weight: 600; }
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
  const loc = localeAtual()
  const today = new Date().toLocaleDateString(loc, { day: '2-digit', month: 'long', year: 'numeric' })

  const { mesesPlano = [], problemas = [], swot = {}, concorrentes = [], riscos = [], funis = [],
          roiResult = null, roiCalc = null } = data
  const personas     = project.personas     || []
  const campaignPlan = project.campaignPlan || null
  const totalBudget  = campaignPlan?.orcamentoTotal || campaignPlan?.totalBudget || 0

  function fmtBudget(n) {
    if (!n || !isFinite(n) || isNaN(n)) return '—'
    return n.toLocaleString(loc, { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
  }
  function fmtN(n) {
    if (n == null || isNaN(n)) return '—'
    if (!isFinite(n)) return '∞'
    return n.toLocaleString(loc, { maximumFractionDigits: 0 })
  }

  // ── Cover ──────────────────────────────────────────────────────────────────
  const cover = `
    <div class="cover">
      <div class="cover-logo">Revenue Lab</div>
      <div class="cover-badge">${L('estrategia.badge')}</div>
      <div class="cover-company">${esc(project.companyName)}</div>
      <div class="cover-title">${L('estrategia.docTitulo')}</div>
      <div class="cover-meta">
        <div class="cover-meta-item">
          <div class="cover-meta-label">${L('estrategia.data')}</div>
          <div class="cover-meta-value">${today}</div>
        </div>
        ${project.businessType ? `<div class="cover-meta-item">
          <div class="cover-meta-label">${L('onboarding.tipoNegocio')}</div>
          <div class="cover-meta-value">${esc(rotuloNegocio(project.businessType))}</div>
        </div>` : ''}
        ${problemas.length ? `<div class="cover-meta-item">
          <div class="cover-meta-label">${L('estrategia.problemas')}</div>
          <div class="cover-meta-value">${problemas.length}</div>
        </div>` : ''}
        ${funis.length ? `<div class="cover-meta-item">
          <div class="cover-meta-label">${L('estrategia.funis')}</div>
          <div class="cover-meta-value">${funis.length}</div>
        </div>` : ''}
      </div>
    </div>`

  // ── Vitórias & Metas por Mês ──────────────────────────────────────────────
  const mesesHTML = mesesPlano.some(m => m.vitorias || m.metas) ? `
    <div class="section page-break">
      <div class="section-title">00 · ${L('estrategia.vitoriasMetas')}</div>
      <table style="width:100%;border-collapse:collapse;margin-top:12px">
        <thead>
          <tr>
            <th style="width:33.3%;padding:10px 14px;background:#f0f2ff;border:1px solid #d8ddf5;font-size:12px;color:#164496;text-align:left">${L('estrategia.mesN', { n: 1 })}</th>
            <th style="width:33.3%;padding:10px 14px;background:#f0f2ff;border:1px solid #d8ddf5;font-size:12px;color:#164496;text-align:left">${L('estrategia.mesN', { n: 2 })}</th>
            <th style="width:33.3%;padding:10px 14px;background:#f0f2ff;border:1px solid #d8ddf5;font-size:12px;color:#164496;text-align:left">${L('estrategia.mesN', { n: 3 })}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            ${[0,1,2].map(i => {
              const m = mesesPlano[i] || { vitorias: '', metas: '' }
              return `<td style="vertical-align:top;padding:12px 14px;border:1px solid #d8ddf5;font-size:11px;line-height:1.6">
                ${m.vitorias ? `<div style="margin-bottom:8px"><strong style="display:block;color:#16a34a;font-size:10px;letter-spacing:.05em;text-transform:uppercase;margin-bottom:4px">${L('estrategia.vitorias')}</strong><div style="white-space:pre-wrap;color:#374151">${esc(m.vitorias)}</div></div>` : ''}
                ${m.metas    ? `<div><strong style="display:block;color:#7c3aed;font-size:10px;letter-spacing:.05em;text-transform:uppercase;margin-bottom:4px">${L('estrategia.metas')}</strong><div style="white-space:pre-wrap;color:#374151">${esc(m.metas)}</div></div>` : ''}
                ${!m.vitorias && !m.metas ? `<span style="color:#9ca3af;font-style:italic">${L('estrategia.naoPreenchido')}</span>` : ''}
              </td>`
            }).join('')}
          </tr>
        </tbody>
      </table>
    </div>
  ` : ''

  // Numeração sequencial — seções ocultas não consomem número
  let secCount = 0
  const secN = () => String(++secCount).padStart(2, '0')

  // ── Problemas ─────────────────────────────────────────────────────────────
  const problemasHTML = `
    <div class="section">
      <div class="section-title">${secN()} · ${L('estrategia.problemasKickoff')}</div>
      ${problemas.length ? `
        <ul class="problema-list">
          ${problemas.map((p, i) => `
            <li class="problema-item">
              <span class="problema-num">${String(i + 1).padStart(2, '0')}</span>
              <span class="problema-text">${esc(p)}</span>
            </li>`).join('')}
        </ul>
      ` : `<div class="empty-state">${L('estrategia.semProblemas')}</div>`}`

  // ── SWOT ──────────────────────────────────────────────────────────────────
  // Ocultável por projeto — quando swot.oculto === true, some do PDF por completo
  const swotHTML = swot.oculto ? '' : `
    <div class="section page-break">
      <div class="section-title">${secN()} · ${L('estrategia.swot')}</div>
      <div class="swot-grid">
        <div class="swot-cell forcas">
          <div class="swot-label">${L('estrategia.forcas')}</div>
          <div class="swot-content">${esc(swot.forcas || '—')}</div>
        </div>
        <div class="swot-cell fraquezas">
          <div class="swot-label">${L('estrategia.fraquezas')}</div>
          <div class="swot-content">${esc(swot.fraquezas || '—')}</div>
        </div>
        <div class="swot-cell oportunidades">
          <div class="swot-label">${L('estrategia.oportunidades')}</div>
          <div class="swot-content">${esc(swot.oportunidades || '—')}</div>
        </div>
        <div class="swot-cell ameacas">
          <div class="swot-label">${L('estrategia.ameacas')}</div>
          <div class="swot-content">${esc(swot.ameacas || '—')}</div>
        </div>
      </div>
    </div>`

  // ── Benchmark ─────────────────────────────────────────────────────────────
  const benchmarkHTML = `
    <div class="section page-break">
      <div class="section-title">${secN()} · ${L('estrategia.benchmark')}</div>
      ${concorrentes.length ? concorrentes.map(c => `
        <div class="competitor-block">
          <div class="competitor-name">${esc(c.nome || t('pdf.estrategia.concorrente'))}</div>
          <table class="competitor-table">
            <tr>
              <td>${L('estrategia.plataformas')}</td>
              <td>
                ${c.metaAds   ? '<span class="platform-badge badge-meta">Meta Ads</span>'   : `<span class="platform-badge badge-no">${L('estrategia.semMeta')}</span>`}
                ${c.googleAds ? '<span class="platform-badge badge-google">Google Ads</span>' : `<span class="platform-badge badge-no">${L('estrategia.semGoogle')}</span>`}
              </td>
            </tr>
            ${c.linkSite ? `<tr><td>${L('estrategia.site')}</td><td style="word-break:break-all"><a href="${esc(c.linkSite)}" style="color:#164496">${esc(c.linkSite)}</a></td></tr>` : ''}
            ${c.linkInstagram ? `<tr><td>Instagram</td><td style="word-break:break-all"><a href="${esc(c.linkInstagram)}" style="color:#164496">${esc(c.linkInstagram)}</a></td></tr>` : ''}
            ${c.metaAds && c.linkBiblioteca ? `<tr><td>${L('estrategia.anunciosMeta')}</td><td style="word-break:break-all">${esc(c.linkBiblioteca)}</td></tr>` : ''}
            ${c.googleAds && c.linkBibliotecaGoogle ? `<tr><td>${L('estrategia.anunciosGoogle')}</td><td style="word-break:break-all">${esc(c.linkBibliotecaGoogle)}</td></tr>` : ''}
            ${c.grandePromessa ? `<tr><td>${L('estrategia.grandePromessa')}</td><td>${esc(c.grandePromessa)}</td></tr>` : ''}
            ${c.comunicacao ? `<tr><td>${L('estrategia.comunicacao')}</td><td>${esc(c.comunicacao)}</td></tr>` : ''}
          </table>
        </div>`).join('') : `<div class="empty-state">${L('estrategia.semConcorrentes')}</div>`}`

  // ── Riscos ────────────────────────────────────────────────────────────────
  const nivelLabel = (n) => L(`estrategia.nivel.${['baixo', 'medio', 'alto'].includes(n) ? n : 'medio'}`)
  const riscosHTML = `
    <div class="section">
      <div class="section-title">${secN()} · ${L('estrategia.riscos')}</div>
      ${riscos.length ? `
        <table class="risk-table">
          <thead>
            <tr>
              <th style="width:28%">${L('estrategia.colProblema')}</th>
              <th style="width:28%">${L('estrategia.colRisco')}</th>
              <th style="width:28%">${L('estrategia.colImpacto')}</th>
              <th style="width:16%">${L('estrategia.colNivel')}</th>
            </tr>
          </thead>
          <tbody>
            ${riscos.map(r => `
              <tr>
                <td>${esc(r.problema  || '—')}</td>
                <td>${esc(r.riscoGerado || '—')}</td>
                <td>${esc(r.impacto   || '—')}</td>
                <td><span class="nivel-badge nivel-${r.nivel || 'medio'}">${nivelLabel(r.nivel)}</span></td>
              </tr>`).join('')}
          </tbody>
        </table>
      ` : `<div class="empty-state">${L('estrategia.semRiscos')}</div>`}`

  // ── ICPs ──────────────────────────────────────────────────────────────────
  const icpsHTML = `
    <div class="section page-break">
      <div class="section-title">${secN()} · ${L('estrategia.icps')}</div>
      ${personas.length ? `
        <div class="icp-grid">
          ${personas.map(p => {
            const a    = p.answers || {}
            const pick = (key) => (a[key] || []).filter(Boolean).slice(0, 3)
            return `
              <div class="icp-card">
                <div class="icp-name">${esc(p.name || t('pdf.estrategia.personaPrincipal'))}</div>
                ${pick('resultado').length ? `<div class="icp-attr-row"><span class="icp-attr-label">${L('estrategia.deseja')}</span><div class="icp-chips">${pick('resultado').map(x => `<span class="icp-chip chip-green">${esc(x)}</span>`).join('')}</div></div>` : ''}
                ${pick('objecoes').length  ? `<div class="icp-attr-row"><span class="icp-attr-label">${L('estrategia.objecao')}</span><div class="icp-chips">${pick('objecoes').map(x => `<span class="icp-chip chip-red">${esc(x)}</span>`).join('')}</div></div>` : ''}
                ${pick('medos').length     ? `<div class="icp-attr-row"><span class="icp-attr-label">${L('estrategia.medo')}</span><div class="icp-chips">${pick('medos').map(x => `<span class="icp-chip chip-gold">${esc(x)}</span>`).join('')}</div></div>` : ''}
                ${pick('sonhos').length    ? `<div class="icp-attr-row"><span class="icp-attr-label">${L('estrategia.sonha')}</span><div class="icp-chips">${pick('sonhos').map(x => `<span class="icp-chip chip-purple">${esc(x)}</span>`).join('')}</div></div>` : ''}
                ${p.generatedProfile ? `<div class="icp-profile">${esc(p.generatedProfile.slice(0, 220))}${p.generatedProfile.length > 220 ? '…' : ''}</div>` : ''}
              </div>`
          }).join('')}
        </div>
      ` : `<div class="empty-state">${L('estrategia.semIcps')}</div>`}`

  // ── Funis ─────────────────────────────────────────────────────────────────
  const funisHTML = `
    <div class="section">
      <div class="section-title">${secN()} · ${L('estrategia.funisSelecionados')}</div>
      ${funis.length ? `
        <div class="funil-grid">
          ${funis.map(f => `<div class="funil-item"><span class="funil-dot"></span>${esc(rotuloFunil(f))}</div>`).join('')}
        </div>
      ` : `<div class="empty-state">${L('estrategia.semFunis')}</div>`}`

  // ── Metas do Funil (ROI) ─────────────────────────────────────────────────
  let metasHTML = `<div class="section page-break"><div class="section-title">${secN()} · ${L('estrategia.metasFunil')}</div>`

  if (!roiResult) {
    metasHTML += `<div class="empty-state">${L('estrategia.roiVazio')}</div>`
  } else {
    const nivelLiquidoClass = roiResult.lucroLiquido >= 0 ? 'color:#16A34A' : 'color:#DC2626'
    metasHTML += `
      <!-- KPI strip -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <tr>
          ${[
            { label: L('estrategia.roiDesejado'), value: roiCalc?.roiDesejado != null ? `${roiCalc.roiDesejado}%` : '—', style: 'color:#7C3AED;font-weight:800' },
            { label: L('roi.totalInvestido'), value: fmtBudget(roiResult.totalInvestimento), style: 'color:#1a1a2e;font-weight:800' },
            { label: L('roi.faturamentoAlvo'), value: fmtBudget(roiResult.faturamento),       style: 'color:#2563EB;font-weight:800' },
            { label: L('roi.lucroLiquido'), value: fmtBudget(roiResult.lucroLiquido),      style: nivelLiquidoClass+';font-weight:800' },
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
            ${['Leads', 'MQLs', 'SQLs', L('estrategia.vendas')].map(h => `<th style="text-align:center;padding:6px;font-size:10px;color:#64748B;font-weight:800;text-transform:uppercase;letter-spacing:.07em;border-bottom:2px solid #E2E8F0">${h}</th>`).join('')}
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
              ${s.rate != null ? `<div style="font-size:9px;color:#94A3B8;margin-top:3px">${L('estrategia.conv', { n: s.rate })}</div>` : ''}
            </td>`).join('<td style="width:6px;text-align:center;color:#CBD5E1;font-size:14px">→</td>')}
          </tr>
        </tbody>
      </table>

      <!-- Financeiro -->
      <table style="width:100%;border-collapse:collapse">
        <tr>
          ${[
            { label: L('roi.lucroBruto'), value: fmtBudget(roiResult.lucroBruto),      style: 'color:#0891B2' },
            { label: L('estrategia.cacMidia'), value: fmtBudget(roiResult.cac),             style: 'color:#B45309' },
            { label: L('estrategia.breakeven'), value: fmtN(roiResult.vendasBreakeven),      style: 'color:#1a1a2e' },
            { label: L('estrategia.lucroVenda'), value: fmtBudget(roiResult.lucroPorVenda),   style: 'color:#16A34A' },
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
      <div class="section-title">${secN()} · ${L('estrategia.campanhas')}</div>`

  if (!campaignPlan || !campaignPlan.channels?.length) {
    campanhasHTML += `<div class="empty-state">${L('estrategia.campanhasVazio')}</div>`
  } else {
    campanhasHTML += campaignPlan.channels.map(ch => {
      const chBudget = totalBudget * (ch.percentage / 100)
      const stages   = ch.stages || {}
      const stagesHTML = ['topo', 'meio', 'fundo'].map(key => {
        const stage = stages[key]
        if (!stage || !stage.campaigns?.length) return ''
        const stageBudget = chBudget * (stage.percentage / 100)
        return `
          <div class="stage-row">
            <div class="stage-label">${esc(stageLabel(key))} — ${L('estrategia.porMes', { valor: fmtBudget(stageBudget) })}</div>
            ${stage.campaigns.map(camp => `
              <div class="campaign-row">
                <span>${esc(camp.name || '—')}</span>
                <span>${L('estrategia.porMes', { valor: fmtBudget(stageBudget * (camp.percentage / 100)) })}</span>
              </div>`).join('')}
          </div>`
      }).join('')
      return `
        <div class="channel-block">
          <div class="channel-header">
            <span class="channel-name">${esc(ch.name)}</span>
            <span><span class="channel-budget">${L('estrategia.porMes', { valor: fmtBudget(chBudget) })}</span><span class="channel-pct">${ch.percentage}%</span></span>
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
      <span>${L('estrategia.confidencial', { empresa: project.companyName })}</span>
      <span>${today}</span>
    </div>`

  // ── Assemble ──────────────────────────────────────────────────────────────
  printDocument({
    title: `${t('pdf.estrategia.titulo')} — ${project.companyName}`,
    css: V2_CSS,
    body: `
  ${cover}
  <div class="content">
    ${mesesHTML}
    ${problemasHTML}
    ${swotHTML}
    ${benchmarkHTML}
    ${riscosHTML}
    ${icpsHTML}
    ${funisHTML}
    ${metasHTML}
    ${campanhasHTML}
    ${footer}
  </div>`,
    width: 1100, height: 900,
  })
}

// ─── Produto / Serviço PDF ────────────────────────────────────────────────────

// Enunciados em produto.perguntas.qN (mesmo dicionário do ProdutoServicoModule).
const PRODUTO_QUESTIONS = [
  { id: 'q1',  emoji: '🎯' },
  { id: 'q2',  emoji: '⏰' },
  { id: 'q3',  emoji: '✨' },
  { id: 'q4',  emoji: '🏆' },
  { id: 'q5',  emoji: '🔥' },
  { id: 'q6',  emoji: '😔' },
  { id: 'q7',  emoji: '🚧' },
  { id: 'q8',  emoji: '🔄' },
  { id: 'q9',  emoji: '🤔' },
  { id: 'q10', emoji: '📊' },
  { id: 'q11', emoji: '⏱️' },
  { id: 'q12', emoji: '💬' },
  { id: 'q13', emoji: '💡' },
  { id: 'q14', emoji: '⚠️' },
  { id: 'q15', emoji: '📅' },
  { id: 'q16', emoji: '🛡️' },
  { id: 'q17', emoji: '🤝' },
]

export function exportProdutoServicoPDF(project) {
  const produtos = project.produtos || []
  if (!produtos.length) { alert(t('pdf.produto.nenhum')); return }

  const produtosHTML = produtos.map((p, idx) => {
    const tipo = p.tipo === 'servico' ? t('produto.servico') : t('produto.produtoFisico')
    const tipoColor = p.tipo === 'servico' ? '#0284C7' : '#D97706'

    const answeredQuestions = PRODUTO_QUESTIONS.filter((q) => p.answers?.[q.id]?.trim())

    const questionsHTML = answeredQuestions.length === 0
      ? '<p style="color:#94A3B8;font-style:italic;font-size:12px">' + L('produto.nenhumaResposta') + '</p>'
      : answeredQuestions.map((q) => `
          <div class="qa-item" style="margin-bottom:14px;padding:12px 14px;background:#F2F5FB;border:1px solid #D8E0F0;border-radius:8px;page-break-inside:avoid">
            <div class="qa-label" style="font-size:10px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:5px">
              ${esc(q.emoji)} ${esc(t(`produto.perguntas.${q.id}.label`))}
            </div>
            <div style="font-size:13px;color:#0F172A;line-height:1.6;white-space:pre-wrap">${esc(p.answers[q.id])}</div>
          </div>
        `).join('')

    return `
      <div style="margin-bottom:36px;page-break-inside:avoid">
        <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #D8E0F0;padding-bottom:10px;margin-bottom:18px">
          <div>
            <div style="font-size:18px;font-weight:800;color:#0F172A">${esc(p.nome || t('produto.nomePadrao', { n: idx + 1 }))}</div>
            <div style="margin-top:4px">
              <span style="display:inline-block;padding:3px 12px;border-radius:99px;font-size:11px;font-weight:700;background:${tipoColor}18;color:${tipoColor};border:1px solid ${tipoColor}40">
                ${esc(tipo)}
              </span>
            </div>
          </div>
          <div style="text-align:right;font-size:11px;color:#94A3B8">
            ${L('produto.respondidas', { n: answeredQuestions.length, total: PRODUTO_QUESTIONS.length })}
          </div>
        </div>
        ${questionsHTML}
        ${p.summary ? `
          <div style="margin-top:18px;page-break-inside:avoid">
            <div class="qa-label" style="font-size:10px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">${L('produto.briefingIa')}</div>
            <div style="font-size:13px;color:#0F172A;line-height:1.6">${markdownToHtml(p.summary)}</div>
          </div>` : ''}
      </div>
    `
  }).join('<hr style="border:none;border-top:1px solid #E2E8F0;margin:32px 0">')

  const bodyHTML = `
    <section>
      <div class="section-title">${L('produto.secao')} — ${esc(project.company_name || project.companyName || '')}</div>
      ${produtosHTML}
    </section>
  `

  printHTML(
    t('produto.titulo'),
    project.company_name || project.companyName || t('pdf.produto.cliente'),
    bodyHTML
  )
}

// ─── Resultados B2B PDF ────────────────────────────────────────────────────────

const RESULTADOS_CSS = `
  body { max-width: 960px; margin: 0 auto; }
  .cover {
    background: linear-gradient(135deg, #0F172A 0%, #1e3a8a 60%, #0369a1 100%);
    color: #fff; padding: 52px 48px 44px; position: relative; overflow: hidden;
  }
  .cover::before {
    content: ''; position: absolute; inset: 0;
    background: radial-gradient(ellipse at top right, rgba(255,255,255,0.07) 0%, transparent 65%);
  }
  .cover-tag { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: rgba(255,255,255,0.55); margin-bottom: 12px; }
  .cover-company { font-size: 34px; font-weight: 900; letter-spacing: -0.5px; margin-bottom: 6px; }
  .cover-period { font-size: 16px; font-weight: 600; color: rgba(255,255,255,0.75); margin-bottom: 28px; }
  .cover-chips { display: flex; gap: 10px; flex-wrap: wrap; }
  .cover-chip { background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.2); border-radius: 99px; padding: 5px 14px; font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.9); }
  .cover-date { position: absolute; top: 44px; right: 48px; font-size: 11px; color: rgba(255,255,255,0.45); }
  .kpi-strip { background: #F8FAFF; border-bottom: 1px solid #D8E0F0; display: grid; grid-template-columns: repeat(4, 1fr); }
  .kpi-item { padding: 20px 22px; border-right: 1px solid #D8E0F0; text-align: center; }
  .kpi-item:last-child { border-right: none; }
  .kpi-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #94A3B8; margin-bottom: 4px; }
  .kpi-value { font-size: 20px; font-weight: 900; color: #0F172A; line-height: 1.1; }
  .kpi-value.green { color: #059669; } .kpi-value.gold { color: #D97706; } .kpi-value.cyan { color: #0284C7; }
  .kpi-sub { font-size: 10px; color: #94A3B8; margin-top: 3px; }
  .content { padding: 36px 48px 48px; }
  .section { margin-bottom: 36px; }
  .section-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #164496; border-bottom: 2px solid #D8E0F0; padding-bottom: 8px; margin-bottom: 18px; }
  .weeks-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .week-card { border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; page-break-inside: avoid; }
  .week-header { background: #F1F5F9; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; }
  .week-name { font-size: 12px; font-weight: 700; color: #0F172A; }
  .week-dates { font-size: 10px; color: #94A3B8; }
  .week-body { padding: 14px; }
  .week-no-data { padding: 20px 14px; text-align: center; color: #CBD5E1; font-size: 11px; }
  .finance-row { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 12px; }
  .finance-left { display: flex; gap: 18px; }
  .fi-label { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #94A3B8; margin-bottom: 2px; }
  .fi-value { font-size: 15px; font-weight: 800; }
  .fi-value.gold { color: #D97706; } .fi-value.green { color: #059669; }
  .roas-badge { background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 8px; padding: 6px 12px; text-align: center; }
  .roas-badge-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #10B981; }
  .roas-badge-value { font-size: 16px; font-weight: 900; color: #059669; }
  .funnel-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 10px; }
  .funnel-item { background: #F8FAFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 7px 8px; text-align: center; }
  .fi2-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #94A3B8; margin-bottom: 2px; }
  .fi2-value { font-size: 16px; font-weight: 800; color: #0F172A; }
  .ticket-row { background: #F0F9FF; border: 1px solid #BAE6FD; border-radius: 8px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; }
  .ticket-label { font-size: 10px; font-weight: 600; color: #0284C7; }
  .ticket-value { font-size: 13px; font-weight: 800; color: #0369A1; }
  .sum-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 12px; }
  .sum-card { background: #F8FAFF; border: 1px solid #D8E0F0; border-radius: 10px; padding: 12px; text-align: center; }
  .sum-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #94A3B8; margin-bottom: 4px; }
  .sum-value { font-size: 17px; font-weight: 900; color: #0F172A; }
  .sum-value.green { color: #059669; } .sum-value.gold { color: #D97706; } .sum-value.cyan { color: #0284C7; } .sum-value.blue { color: #3B82F6; } .sum-value.purple { color: #7C3AED; }
  .sum-sub { font-size: 9px; color: #94A3B8; margin-top: 3px; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #E2E8F0; display: flex; justify-content: space-between; font-size: 10px; color: #94A3B8; }
  .footer-brand { font-weight: 700; color: #164496; }
  .rtable { width: 100%; border-collapse: collapse; font-size: 11px; }
  .rtable th { background: #F1F5F9; color: #64748B; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 8px 10px; text-align: right; border-bottom: 1px solid #D8E0F0; }
  .rtable th:first-child { text-align: left; }
  .rtable td { padding: 6px 10px; text-align: right; border-bottom: 1px solid #EEF2F7; color: #334155; }
  .rtable td:first-child { text-align: left; font-weight: 600; color: #0F172A; white-space: nowrap; }
  .rtable tfoot td { background: #F8FAFF; font-weight: 800; color: #0F172A; border-top: 2px solid #D8E0F0; border-bottom: none; }
  .rtable tr { page-break-inside: avoid; }
  .goal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
  .goal-group-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #94A3B8; margin-bottom: 6px; }
  .goal-row { display: flex; align-items: center; gap: 8px; padding: 5px 0; border-bottom: 1px solid #EEF2F7; font-size: 11px; }
  .goal-label { flex: 1; color: #64748B; }
  .goal-real { font-weight: 700; color: #0F172A; }
  .goal-meta { font-size: 10px; color: #94A3B8; width: 74px; text-align: right; }
  .goal-badge { width: 48px; text-align: right; font-weight: 800; }
  .goal-badge.ok { color: #059669; } .goal-badge.warn { color: #D97706; } .goal-badge.bad { color: #DC2626; } .goal-badge.none { color: #CBD5E1; }
  .note { font-size: 10px; color: #94A3B8; margin-top: 8px; }
  @media print { body { max-width: 100%; } .week-card { page-break-inside: avoid; } .section { page-break-inside: auto; } }
`

// Mês e semanas saem no idioma de quem gera. `MONTH_NAMES` e o `label` das semanas
// que a tela manda são ignorados (vinham em português); só `start`/`end` são lidos.
function rotuloMesAno(year, month) {
  const m = new Date(year, month, 1).toLocaleDateString(localeAtual(), { month: 'long' })
  return `${m.charAt(0).toUpperCase()}${m.slice(1)} ${year}`
}
const rotuloSemana = (i) => L('resultados.semana', { n: i + 1 })
const nLoc = (n) => Number(n || 0).toLocaleString(localeAtual())
const pct1 = (n) => n.toLocaleString(localeAtual(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const xRoas = (n) => `${n.toLocaleString(localeAtual(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x`

export function exportResultadosB2BPDF({ companyName, resultados, year, month, weekRanges }) {
  const today      = new Date().toLocaleDateString(localeAtual(), { day: '2-digit', month: 'long', year: 'numeric' })
  const monthLabel = rotuloMesAno(year, month)
  const monthKey   = `${year}-${String(month + 1).padStart(2, '0')}`
  const monthData  = resultados.b2b?.[monthKey] || {}

  // Totals
  const totals = weekRanges.reduce((acc, _, i) => {
    const wk = monthData[`semana${i + 1}`] || {}
    return {
      investido:     acc.investido     + (wk.investido     || 0),
      receitaVendas: acc.receitaVendas + (wk.receitaVendas || 0),
      leads:  acc.leads  + (wk.leads  || 0),
      mql:    acc.mql    + (wk.mql    || 0),
      sql:    acc.sql    + (wk.sql    || 0),
      vendas: acc.vendas + (wk.vendas || 0),
    }
  }, { investido: 0, receitaVendas: 0, leads: 0, mql: 0, sql: 0, vendas: 0 })

  const roas        = totals.investido > 0 && totals.receitaVendas > 0 ? totals.receitaVendas / totals.investido : null
  const ticketMedio = totals.vendas > 0 && totals.receitaVendas > 0 ? totals.receitaVendas / totals.vendas : null

  // Cover
  const cover = `
    <div class="cover">
      <div class="cover-date">${L('doc.geradoEm', { data: today })}</div>
      <div class="cover-tag">${L('resultados.tag')}</div>
      <div class="cover-company">${esc(companyName)}</div>
      <div class="cover-period">${esc(monthLabel)}</div>
      <div class="cover-chips">
        <span class="cover-chip">${L('resultados.chipB2b')}</span>
        ${totals.investido > 0 ? `<span class="cover-chip">${L('resultados.chipInvestido', { valor: fmtBRL(totals.investido) })}</span>` : ''}
        ${totals.receitaVendas > 0 ? `<span class="cover-chip">${L('resultados.chipReceita', { valor: fmtBRL(totals.receitaVendas) })}</span>` : ''}
        ${roas != null ? `<span class="cover-chip">${L('resultados.chipRoas', { valor: xRoas(roas) })}</span>` : ''}
      </div>
    </div>`

  // KPI Strip
  const kpiStrip = `
    <div class="kpi-strip">
      <div class="kpi-item">
        <div class="kpi-label">${L('resultados.totalInvestido')}</div>
        <div class="kpi-value gold">${fmtBRL(totals.investido)}</div>
        <div class="kpi-sub">${L('resultados.noMes')}</div>
      </div>
      <div class="kpi-item">
        <div class="kpi-label">${L('resultados.receitaVendas')}</div>
        <div class="kpi-value green">${totals.receitaVendas > 0 ? fmtBRL(totals.receitaVendas) : '—'}</div>
        <div class="kpi-sub">${L('resultados.noMes')}</div>
      </div>
      <div class="kpi-item">
        <div class="kpi-label">ROAS</div>
        <div class="kpi-value ${roas != null && roas >= 1 ? 'green' : ''}">${roas != null ? xRoas(roas) : '—'}</div>
        <div class="kpi-sub">${roas != null ? L(roas >= 1 ? 'resultados.positivo' : 'resultados.negativo') : L('resultados.semDados')}</div>
      </div>
      <div class="kpi-item">
        <div class="kpi-label">${L('resultados.ticketMedio')}</div>
        <div class="kpi-value cyan">${ticketMedio != null ? fmtBRL(ticketMedio) : '—'}</div>
        <div class="kpi-sub">${totals.vendas > 0 ? L('roi.nVendas', { count: totals.vendas, n: nLoc(totals.vendas) }) : L('resultados.semVendas')}</div>
      </div>
    </div>`

  // Weekly cards
  const weekCards = weekRanges.map((week, i) => {
    const wk       = monthData[`semana${i + 1}`]
    const wkRoas   = wk && wk.investido > 0 && wk.receitaVendas > 0 ? wk.receitaVendas / wk.investido : null
    const wkTicket = wk && wk.vendas > 0 && wk.receitaVendas > 0 ? wk.receitaVendas / wk.vendas : null

    if (!wk) return `
      <div class="week-card">
        <div class="week-header">
          <span class="week-name">${rotuloSemana(i)}</span>
          <span class="week-dates">${week.start}/${month + 1} – ${week.end}/${month + 1}</span>
        </div>
        <div class="week-no-data">${L('resultados.semDadosRegistrados')}</div>
      </div>`

    return `
      <div class="week-card">
        <div class="week-header">
          <span class="week-name">${rotuloSemana(i)}</span>
          <span class="week-dates">${week.start}/${month + 1} – ${week.end}/${month + 1}</span>
        </div>
        <div class="week-body">
          <div class="finance-row">
            <div class="finance-left">
              <div>
                <div class="fi-label">${L('resultados.investido')}</div>
                <div class="fi-value gold">${fmtBRL(wk.investido)}</div>
              </div>
              ${wk.receitaVendas > 0 ? `
              <div>
                <div class="fi-label">${L('resultados.receita')}</div>
                <div class="fi-value green">${fmtBRL(wk.receitaVendas)}</div>
              </div>` : ''}
            </div>
            ${wkRoas != null ? `
            <div class="roas-badge">
              <div class="roas-badge-label">ROAS</div>
              <div class="roas-badge-value">${xRoas(wkRoas)}</div>
            </div>` : ''}
          </div>
          <div class="funnel-row">
            <div class="funnel-item"><div class="fi2-label">Leads</div><div class="fi2-value" style="color:#3B82F6">${wk.leads || 0}</div></div>
            <div class="funnel-item"><div class="fi2-label">MQL</div><div class="fi2-value" style="color:#0284C7">${wk.mql || 0}</div></div>
            <div class="funnel-item"><div class="fi2-label">SQL</div><div class="fi2-value" style="color:#7C3AED">${wk.sql || 0}</div></div>
            <div class="funnel-item"><div class="fi2-label">${L('resultados.vendas')}</div><div class="fi2-value" style="color:#D97706">${wk.vendas || 0}</div></div>
          </div>
          ${wkTicket != null ? `
          <div class="ticket-row">
            <span class="ticket-label">🎫 ${L('resultados.ticketMedio')}</span>
            <span class="ticket-value">${fmtBRL(wkTicket)}</span>
          </div>` : ''}
        </div>
      </div>`
  }).join('')

  // Monthly consolidation
  const consolidadoHTML = (totals.leads > 0 || totals.investido > 0) ? `
    <div class="section">
      <div class="section-title">${L('resultados.consolidado', { mes: monthLabel })}</div>
      <div class="sum-grid">
        <div class="sum-card"><div class="sum-label">${L('resultados.investido')}</div><div class="sum-value gold">${fmtBRL(totals.investido)}</div></div>
        <div class="sum-card"><div class="sum-label">${L('resultados.receitaVendas')}</div><div class="sum-value green">${totals.receitaVendas > 0 ? fmtBRL(totals.receitaVendas) : '—'}</div></div>
        <div class="sum-card"><div class="sum-label">ROAS</div><div class="sum-value ${roas != null && roas >= 1 ? 'green' : ''}">${roas != null ? xRoas(roas) : '—'}</div>${roas != null ? `<div class="sum-sub">${L(roas >= 1 ? 'resultados.positivo' : 'resultados.negativo')}</div>` : ''}</div>
        <div class="sum-card"><div class="sum-label">${L('resultados.ticketMedio')}</div><div class="sum-value cyan">${ticketMedio != null ? fmtBRL(ticketMedio) : '—'}</div></div>
      </div>
      <div class="sum-grid">
        <div class="sum-card"><div class="sum-label">Leads</div><div class="sum-value blue">${nLoc(totals.leads)}</div>${totals.leads > 0 && totals.investido > 0 ? `<div class="sum-sub">${L('resultados.porLead', { valor: fmtBRL(totals.investido / totals.leads) })}</div>` : ''}</div>
        <div class="sum-card"><div class="sum-label">MQL</div><div class="sum-value cyan">${nLoc(totals.mql)}</div>${totals.mql > 0 && totals.leads > 0 ? `<div class="sum-sub">${L('resultados.dosLeads', { pct: pct1((totals.mql / totals.leads) * 100) })}</div>` : ''}</div>
        <div class="sum-card"><div class="sum-label">SQL</div><div class="sum-value purple">${nLoc(totals.sql)}</div>${totals.sql > 0 && totals.mql > 0 ? `<div class="sum-sub">${L('resultados.dosMql', { pct: pct1((totals.sql / totals.mql) * 100) })}</div>` : ''}</div>
        <div class="sum-card"><div class="sum-label">${L('resultados.vendas')}</div><div class="sum-value gold">${nLoc(totals.vendas)}</div>${totals.vendas > 0 && totals.sql > 0 ? `<div class="sum-sub">${L('resultados.dosSql', { pct: pct1((totals.vendas / totals.sql) * 100) })}</div>` : ''}</div>
      </div>
    </div>` : ''

  const footer = `
    <div class="footer">
      <div class="footer-brand">Revenue Lab</div>
      <div>${L('resultados.rodape', { empresa: companyName, data: today })}</div>
    </div>`

  printDocument({
    title: t('pdf.resultados.titulo', { mes: monthLabel, empresa: companyName }),
    css: RESULTADOS_CSS,
    body: `
  ${cover}
  ${kpiStrip}
  <div class="content">
    <div class="section">
      <div class="section-title">${L('resultados.porSemana')}</div>
      <div class="weeks-grid">${weekCards}</div>
    </div>
    ${consolidadoHTML}
    ${footer}
  </div>`,
    width: 1100, height: 900,
  })
}

// ─── Resultados B2C PDF ───────────────────────────────────────────────────────
//
// Espelha o que a tela do B2C mostra: KPIs do mês, consolidado, Plano vs
// Realizado (quando há Calculadora de ROI) e o detalhamento do modo em que o
// gestor está — Diário (tabela dia a dia), Semanal (cards de semana) ou Por
// unidade (tabela por unidade). No modo Diário/Por unidade também entra um
// resumo por semana agregado a partir dos dias, que é como o cliente lê.

// Uma linha do Plano vs Realizado. `better: 'low'` inverte a lógica (custo).
function b2cGoalRow({ label, real, meta, money = false, better = 'high' }) {
  const fmt = money ? fmtBRL : nLoc
  const hasMeta = meta != null && meta > 0
  const hasReal = real > 0

  if (!hasMeta) {
    return `<div class="goal-row">
      <span class="goal-label">${esc(label)}</span>
      <span class="goal-badge none">${L('resultados.semMeta')}</span>
    </div>`
  }

  const ratio = better === 'high' ? real / meta : (hasReal ? meta / real : 0)
  const cls   = !hasReal ? 'none' : ratio >= 1 ? 'ok' : ratio >= 0.8 ? 'warn' : 'bad'
  const badge = !hasReal
    ? '—'
    : better === 'high'
      ? `${Math.round((real / meta) * 100)}%`
      : `${real <= meta ? '−' : '+'}${Math.abs(Math.round((real / meta - 1) * 100))}%`

  return `<div class="goal-row">
    <span class="goal-label">${esc(label)}</span>
    <span class="goal-real">${hasReal ? fmt(real) : '—'}</span>
    <span class="goal-meta">/${fmt(meta)}</span>
    <span class="goal-badge ${cls}">${badge}</span>
  </div>`
}

export function exportResultadosB2CPDF({
  companyName, resultados, year, month, mode = 'diario',
  weekRanges, unidades = null, plan = null,
}) {
  const today      = new Date().toLocaleDateString(localeAtual(), { day: '2-digit', month: 'long', year: 'numeric' })
  const monthLabel = rotuloMesAno(year, month)
  const monthKey   = `${year}-${String(month + 1).padStart(2, '0')}`

  const monthData = resultados.b2c?.[monthKey] || {}
  const weekData  = resultados.b2c_semanas?.[monthKey] || {}
  const unitData  = resultados.b2c_unidades?.[monthKey] || {}

  const sum = (rows) => rows.reduce(
    (acc, d) => ({
      investido:   acc.investido   + (d?.investido   || 0),
      leads:       acc.leads       + (d?.leads       || 0),
      vendas:      acc.vendas      + (d?.vendas      || 0),
      valorVendas: acc.valorVendas + (d?.valorVendas || 0),
    }),
    { investido: 0, leads: 0, vendas: 0, valorVendas: 0 },
  )

  // A visão "Por unidade" alimenta os dias, então lê os mesmos totais do Diário.
  const isWeekly = mode === 'semanal'
  const totals   = isWeekly ? sum(Object.values(weekData)) : sum(Object.values(monthData))

  const per    = (qty) => (totals.investido > 0 && qty > 0 ? totals.investido / qty : 0)
  const cpl    = per(totals.leads)
  const cac    = per(totals.vendas)
  const roas   = totals.investido > 0 ? totals.valorVendas / totals.investido : 0
  const ticket = totals.vendas > 0 ? totals.valorVendas / totals.vendas : 0

  const modeLabel = t(`pdf.resultados.modo.${isWeekly ? 'semanal' : mode === 'unidades' ? 'unidades' : 'diario'}`)

  // ── Capa ────────────────────────────────────────────────────────────────────
  const cover = `
    <div class="cover">
      <div class="cover-date">${L('doc.geradoEm', { data: today })}</div>
      <div class="cover-tag">${L('resultados.tag')}</div>
      <div class="cover-company">${esc(companyName || '')}</div>
      <div class="cover-period">${esc(monthLabel)}</div>
      <div class="cover-chips">
        <span class="cover-chip">${L('resultados.chipB2c', { modo: modeLabel })}</span>
        ${totals.investido > 0 ? `<span class="cover-chip">${L('resultados.chipInvestido', { valor: fmtBRL(totals.investido) })}</span>` : ''}
        ${totals.leads > 0 ? `<span class="cover-chip">${L('resultados.chipLeads', { n: nLoc(totals.leads) })}</span>` : ''}
        ${roas > 0 ? `<span class="cover-chip">${L('resultados.chipRoas', { valor: xRoas(roas) })}</span>` : ''}
      </div>
    </div>`

  // ── Faixa de KPIs (mesmos 4 da tela) ────────────────────────────────────────
  const kpiStrip = `
    <div class="kpi-strip">
      <div class="kpi-item">
        <div class="kpi-label">${L('resultados.investimento')}</div>
        <div class="kpi-value gold">${fmtBRL(totals.investido)}</div>
        <div class="kpi-sub">${esc(monthLabel)}</div>
      </div>
      <div class="kpi-item">
        <div class="kpi-label">${L('resultados.custoPorLead')}</div>
        <div class="kpi-value cyan">${cpl > 0 ? fmtBRL(cpl) : '—'}</div>
        <div class="kpi-sub">${L('resultados.leadsPeriodo', { n: nLoc(totals.leads) })}</div>
      </div>
      <div class="kpi-item">
        <div class="kpi-label">CAC</div>
        <div class="kpi-value">${cac > 0 ? fmtBRL(cac) : '—'}</div>
        <div class="kpi-sub">${totals.vendas > 0
          ? L('resultados.vendasTicket', { count: totals.vendas, n: nLoc(totals.vendas), ticket: fmtBRL(ticket) })
          : L('resultados.semVendasLancadas')}</div>
      </div>
      <div class="kpi-item">
        <div class="kpi-label">ROAS</div>
        <div class="kpi-value ${roas >= 1 ? 'green' : ''}">${roas > 0 ? xRoas(roas) : '—'}</div>
        <div class="kpi-sub">${totals.valorVendas > 0 ? L('resultados.deReceita', { valor: fmtBRL(totals.valorVendas) }) : L('resultados.semReceita')}</div>
      </div>
    </div>`

  // ── Consolidado do mês ──────────────────────────────────────────────────────
  const hasData = totals.investido > 0 || totals.leads > 0
  const consolidadoHTML = hasData ? `
    <div class="section">
      <div class="section-title">${L('resultados.consolidado', { mes: monthLabel })}</div>
      <div class="sum-grid">
        <div class="sum-card"><div class="sum-label">${L('resultados.investido')}</div><div class="sum-value gold">${fmtBRL(totals.investido)}</div></div>
        <div class="sum-card"><div class="sum-label">Leads</div><div class="sum-value blue">${nLoc(totals.leads)}</div>${cpl > 0 ? `<div class="sum-sub">${L('resultados.porLead', { valor: fmtBRL(cpl) })}</div>` : ''}</div>
        <div class="sum-card"><div class="sum-label">${L('resultados.vendas')}</div><div class="sum-value purple">${nLoc(totals.vendas)}</div>${cac > 0 ? `<div class="sum-sub">${L('resultados.porVenda', { valor: fmtBRL(cac) })}</div>` : ''}</div>
        <div class="sum-card"><div class="sum-label">${L('resultados.receita')}</div><div class="sum-value green">${totals.valorVendas > 0 ? fmtBRL(totals.valorVendas) : '—'}</div></div>
      </div>
      <div class="sum-grid" style="grid-template-columns:repeat(2,1fr)">
        <div class="sum-card"><div class="sum-label">${L('resultados.ticketMedio')}</div><div class="sum-value cyan">${ticket > 0 ? fmtBRL(ticket) : '—'}</div></div>
        <div class="sum-card"><div class="sum-label">ROAS</div><div class="sum-value ${roas >= 1 ? 'green' : ''}">${roas > 0 ? xRoas(roas) : '—'}</div>${roas > 0 ? `<div class="sum-sub">${L(roas >= 1 ? 'resultados.positivo' : 'resultados.negativo')}</div>` : ''}</div>
      </div>
    </div>` : ''

  // ── Plano vs Realizado (meta da Calculadora de ROI) ─────────────────────────
  const planoHTML = plan ? `
    <div class="section">
      <div class="section-title">${L('resultados.plano')}</div>
      <div class="goal-grid">
        <div>
          <div class="goal-group-title">${L('resultados.volume')}</div>
          ${b2cGoalRow({ label: 'Leads',   real: totals.leads,       meta: plan.leads })}
          ${b2cGoalRow({ label: t('pdf.resultados.vendas'),  real: totals.vendas,      meta: plan.vendas })}
          ${b2cGoalRow({ label: t('pdf.resultados.receita'), real: totals.valorVendas, meta: plan.faturamento, money: true })}
        </div>
        <div>
          <div class="goal-group-title">${L('resultados.custoMenor')}</div>
          ${b2cGoalRow({ label: t('pdf.resultados.custoLead'), real: cpl, meta: plan.cpl, money: true, better: 'low' })}
          ${b2cGoalRow({ label: 'CAC',          real: cac, meta: plan.cac, money: true, better: 'low' })}
        </div>
      </div>
      <div class="note">
        ${L('resultados.verbaPlanejada')} <strong>${fmtBRL(plan.mediaOrcamento)}</strong> · ${L('resultados.investidoMin')} <strong>${fmtBRL(totals.investido)}</strong>
      </div>
    </div>` : ''

  // ── Semanal: cards de semana ────────────────────────────────────────────────
  const weekCardsHTML = weekRanges.map((week, i) => {
    const w = weekData[String(i + 1)]
    const header = `
      <div class="week-header">
        <span class="week-name">${rotuloSemana(i)}</span>
        <span class="week-dates">${week.start}/${month + 1} – ${week.end}/${month + 1}</span>
      </div>`

    if (!w) return `<div class="week-card">${header}<div class="week-no-data">${L('resultados.semDadosRegistrados')}</div></div>`

    const wCpl    = w.leads  > 0 && w.investido > 0 ? w.investido / w.leads  : 0
    const wCac    = w.vendas > 0 && w.investido > 0 ? w.investido / w.vendas : 0
    const wRoas   = w.investido > 0 ? (w.valorVendas || 0) / w.investido : 0
    const wTicket = w.vendas > 0 && w.valorVendas > 0 ? w.valorVendas / w.vendas : 0

    return `
      <div class="week-card">
        ${header}
        <div class="week-body">
          <div class="finance-row">
            <div class="finance-left">
              <div><div class="fi-label">${L('resultados.investido')}</div><div class="fi-value gold">${fmtBRL(w.investido)}</div></div>
              ${w.valorVendas > 0 ? `<div><div class="fi-label">${L('resultados.receita')}</div><div class="fi-value green">${fmtBRL(w.valorVendas)}</div></div>` : ''}
            </div>
            ${wRoas > 0 ? `<div class="roas-badge"><div class="roas-badge-label">ROAS</div><div class="roas-badge-value">${xRoas(wRoas)}</div></div>` : ''}
          </div>
          <div class="funnel-row">
            <div class="funnel-item"><div class="fi2-label">Leads</div><div class="fi2-value" style="color:#3B82F6">${w.leads || 0}</div></div>
            <div class="funnel-item"><div class="fi2-label">${L('resultados.vendas')}</div><div class="fi2-value" style="color:#7C3AED">${w.vendas || 0}</div></div>
            <div class="funnel-item"><div class="fi2-label">${L('resultados.custoLead')}</div><div class="fi2-value" style="color:#0284C7">${wCpl > 0 ? fmtBRL(wCpl) : '—'}</div></div>
            <div class="funnel-item"><div class="fi2-label">CAC</div><div class="fi2-value" style="color:#D97706">${wCac > 0 ? fmtBRL(wCac) : '—'}</div></div>
          </div>
          ${wTicket > 0 ? `
          <div class="ticket-row">
            <span class="ticket-label">${L('resultados.ticketVendas', { count: w.vendas, n: nLoc(w.vendas) })}</span>
            <span class="ticket-value">${fmtBRL(wTicket)}</span>
          </div>` : ''}
        </div>
      </div>`
  }).join('')

  // ── Diário: tabela dia a dia (só os dias lançados) ──────────────────────────
  const dayKeys = Object.keys(monthData).filter((k) => {
    const d = monthData[k]
    return d && (d.investido > 0 || d.leads > 0 || d.vendas > 0 || d.valorVendas > 0)
  }).sort()

  const dailyRows = dayKeys.map((k) => {
    const d       = monthData[k]
    const dCpl    = d.leads  > 0 && d.investido > 0 ? d.investido / d.leads  : 0
    const dCac    = d.vendas > 0 && d.investido > 0 ? d.investido / d.vendas : 0
    const dRoas   = d.investido > 0 ? (d.valorVendas || 0) / d.investido : 0
    return `<tr>
      <td>${Number(k)}/${month + 1}</td>
      <td>${d.investido ? fmtBRL(d.investido) : '—'}</td>
      <td>${d.leads || '—'}</td>
      <td>${d.vendas || '—'}</td>
      <td>${d.valorVendas ? fmtBRL(d.valorVendas) : '—'}</td>
      <td>${dCpl > 0 ? fmtBRL(dCpl) : '—'}</td>
      <td>${dCac > 0 ? fmtBRL(dCac) : '—'}</td>
      <td>${dRoas > 0 ? xRoas(dRoas) : '—'}</td>
    </tr>`
  }).join('')

  const dailyTableHTML = dayKeys.length ? `
    <div class="section">
      <div class="section-title">${L('resultados.porDia')}</div>
      <table class="rtable">
        <thead>
          <tr>
            <th>${L('resultados.dia')}</th><th>${L('resultados.investido')}</th><th>Leads</th><th>${L('resultados.vendas')}</th>
            <th>${L('resultados.receita')}</th><th>CPL</th><th>CAC</th><th>ROAS</th>
          </tr>
        </thead>
        <tbody>${dailyRows}</tbody>
        <tfoot>
          <tr>
            <td>${L('resultados.total')}</td>
            <td>${fmtBRL(totals.investido)}</td>
            <td>${nLoc(totals.leads)}</td>
            <td>${nLoc(totals.vendas)}</td>
            <td>${fmtBRL(totals.valorVendas)}</td>
            <td>${cpl > 0 ? fmtBRL(cpl) : '—'}</td>
            <td>${cac > 0 ? fmtBRL(cac) : '—'}</td>
            <td>${roas > 0 ? xRoas(roas) : '—'}</td>
          </tr>
        </tfoot>
      </table>
    </div>` : ''

  // Resumo por semana agregado a partir dos dias — só faz sentido no Diário.
  const weeklyFromDays = weekRanges.map((week, i) => {
    const rows = []
    for (let d = week.start; d <= week.end; d++) {
      const row = monthData[String(d).padStart(2, '0')]
      if (row) rows.push(row)
    }
    return { week, i, t: sum(rows) }
  })

  const weeklyRollupHTML = dayKeys.length ? `
    <div class="section">
      <div class="section-title">${L('resultados.resumoSemana')}</div>
      <table class="rtable">
        <thead>
          <tr>
            <th>${L('resultados.colSemana')}</th><th>${L('resultados.investido')}</th><th>Leads</th><th>${L('resultados.vendas')}</th>
            <th>${L('resultados.receita')}</th><th>CPL</th><th>CAC</th><th>ROAS</th>
          </tr>
        </thead>
        <tbody>
          ${weeklyFromDays.map(({ week, i, t }) => {
            const wCpl  = t.leads  > 0 && t.investido > 0 ? t.investido / t.leads  : 0
            const wCac  = t.vendas > 0 && t.investido > 0 ? t.investido / t.vendas : 0
            const wRoas = t.investido > 0 ? t.valorVendas / t.investido : 0
            return `<tr>
              <td>${rotuloSemana(i)} <span style="color:#94A3B8;font-weight:400">(${week.start}–${week.end})</span></td>
              <td>${t.investido ? fmtBRL(t.investido) : '—'}</td>
              <td>${t.leads || '—'}</td>
              <td>${t.vendas || '—'}</td>
              <td>${t.valorVendas ? fmtBRL(t.valorVendas) : '—'}</td>
              <td>${wCpl > 0 ? fmtBRL(wCpl) : '—'}</td>
              <td>${wCac > 0 ? fmtBRL(wCac) : '—'}</td>
              <td>${wRoas > 0 ? xRoas(wRoas) : '—'}</td>
            </tr>`
          }).join('')}
        </tbody>
      </table>
    </div>` : ''

  // ── Por unidade: vendas e receita consolidadas por unidade ──────────────────
  let unidadesHTML = ''
  if (mode === 'unidades' && Array.isArray(unidades) && unidades.length) {
    const porUnidade = unidades.map((u) => {
      const t = Object.values(unitData).reduce(
        (acc, dia) => ({
          vendas:      acc.vendas      + (Number(dia?.[u.id]?.vendas)      || 0),
          valorVendas: acc.valorVendas + (Number(dia?.[u.id]?.valorVendas) || 0),
        }),
        { vendas: 0, valorVendas: 0 },
      )
      return { ...u, ...t }
    })
    const totUnid = porUnidade.reduce(
      (acc, u) => ({ vendas: acc.vendas + u.vendas, valorVendas: acc.valorVendas + u.valorVendas }),
      { vendas: 0, valorVendas: 0 },
    )

    if (totUnid.vendas > 0 || totUnid.valorVendas > 0) {
      unidadesHTML = `
        <div class="section">
          <div class="section-title">${L('resultados.porUnidade')}</div>
          <table class="rtable">
            <thead>
              <tr><th>${L('resultados.unidade')}</th><th>${L('resultados.vendas')}</th><th>${L('resultados.receita')}</th><th>${L('resultados.ticketMedio')}</th><th>${L('resultados.pctReceita')}</th></tr>
            </thead>
            <tbody>
              ${porUnidade.map((u) => {
                const tk  = u.vendas > 0 ? u.valorVendas / u.vendas : 0
                const shr = totUnid.valorVendas > 0 ? (u.valorVendas / totUnid.valorVendas) * 100 : 0
                return `<tr>
                  <td>${esc(u.label)}</td>
                  <td>${u.vendas || '—'}</td>
                  <td>${u.valorVendas ? fmtBRL(u.valorVendas) : '—'}</td>
                  <td>${tk > 0 ? fmtBRL(tk) : '—'}</td>
                  <td>${shr > 0 ? fmtPct(shr) : '—'}</td>
                </tr>`
              }).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td>${L('resultados.total')}</td>
                <td>${nLoc(totUnid.vendas)}</td>
                <td>${fmtBRL(totUnid.valorVendas)}</td>
                <td>${totUnid.vendas > 0 ? fmtBRL(totUnid.valorVendas / totUnid.vendas) : '—'}</td>
                <td>100%</td>
              </tr>
            </tfoot>
          </table>
        </div>`
    }
  }

  const detalheHTML = isWeekly
    ? `<div class="section">
         <div class="section-title">${L('resultados.porSemana')}</div>
         <div class="weeks-grid">${weekCardsHTML}</div>
       </div>`
    : `${unidadesHTML}${weeklyRollupHTML}${dailyTableHTML}`

  const vazioHTML = hasData ? '' : `
    <div class="section">
      <div class="week-no-data" style="border:1px dashed #E2E8F0;border-radius:12px">
        ${L('resultados.vazio', { mes: monthLabel })}
      </div>
    </div>`

  const footer = `
    <div class="footer">
      <div class="footer-brand">Revenue Lab</div>
      <div>${L('resultados.rodape', { empresa: companyName || '', data: today })}</div>
    </div>`

  printDocument({
    title: t('pdf.resultados.titulo', { mes: monthLabel, empresa: companyName || '' }),
    css: RESULTADOS_CSS,
    body: `
  ${cover}
  ${kpiStrip}
  <div class="content">
    ${consolidadoHTML}
    ${planoHTML}
    ${detalheHTML}
    ${vazioHTML}
    ${footer}
  </div>`,
    width: 1100, height: 900,
  })
}

// ─── Google Ads (Estrutura de Campanhas) PDF ─────────────────────────────────

// Chave = valor gravado (em pt); o rótulo exibido vem de googleAds.concorrencia.*.
const GOOGLE_ADS_COMPETITION_BADGE = {
  Baixo: 'background:#dcfce7;color:#15803d',
  Médio: 'background:#fef3c7;color:#92400e',
  Alto:  'background:#fee2e2;color:#b91c1c',
}
const GOOGLE_ADS_COMPETITION_CHAVE = { Baixo: 'baixo', Médio: 'medio', Alto: 'alto' }
const GOOGLE_ADS_TIPOS = ['marca', 'generico', 'concorrentes', 'problema']

/**
 * Exporta a estrutura de Google Ads (grupos de palavras-chave + último
 * conteúdo gerado pela IA, se houver) em PDF.
 * @param {object} project — projeto carregado em ClientProfile
 * @param {object|null} entry — entrada específica do googleAds. Se null,
 *                              usa o draft (rascunho atual) ou a última entry
 *                              não-draft.
 */
export function exportGoogleAdsPDF(project, entry = null) {
  const list = project?.googleAds || []
  const draft   = list.find((e) => e.isDraft)
  const lastGen = list.filter((e) => !e.isDraft).at(-1)
  const src     = entry || draft || lastGen
  if (!src) {
    alert(t('pdf.googleAds.nada'))
    return
  }

  const groups = Array.isArray(src.keywordGroups) ? src.keywordGroups : []
  const filledGroups = groups.filter((g) => (g.keywords || []).some((k) => (k.keyword || '').trim()))

  const totalKeywords = filledGroups.reduce(
    (acc, g) => acc + (g.keywords || []).filter((k) => (k.keyword || '').trim()).length,
    0
  )

  const generated = src.content || src.generated_content || src.generatedContent || null
  const generatedHTML = generated ? `
    <section>
      <div class="section-title">${L('googleAds.gerada')}</div>
      <div class="prose">${markdownToHtml(generated)}</div>
    </section>
  ` : ''

  const groupsHTML = filledGroups.length === 0
    ? `<p style="color:#64748b;font-size:13px;font-style:italic">${L('googleAds.semGrupos')}</p>`
    : filledGroups.map((g, i) => {
        const keywordsRows = (g.keywords || [])
          .filter((k) => (k.keyword || '').trim())
          .map((k) => {
            const compStyle = GOOGLE_ADS_COMPETITION_BADGE[k.competition] || 'background:#f1f5f9;color:#64748b'
            return `<tr>
              <td>${esc(k.keyword)}</td>
              <td style="text-align:right">${fmtNum(Number(k.searches) || 0)}</td>
              <td style="text-align:center">
                <span style="display:inline-block;padding:2px 10px;border-radius:9999px;font-size:11px;font-weight:600;${compStyle}">
                  ${GOOGLE_ADS_COMPETITION_CHAVE[k.competition] ? esc(t(`googleAds.concorrencia.${GOOGLE_ADS_COMPETITION_CHAVE[k.competition]}`)) : esc(k.competition || '—')}
                </span>
              </td>
            </tr>`
          }).join('')
        return `<section>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;padding:8px 12px;background:#f8fafe;border:1px solid #d8e0f0;border-radius:10px">
            <span style="font-size:11px;font-weight:700;color:#94a3b8">#${i + 1}</span>
            <strong style="font-size:14px;color:#0f172a">${esc((g.name || '').toUpperCase())}</strong>
            <span style="margin-left:auto;font-size:10px;font-weight:600;color:#94a3b8">${(() => { const n = (g.keywords || []).filter((k) => (k.keyword || '').trim()).length; return L('googleAds.nPalavras', { count: n, n }) })()}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>${L('googleAds.colPalavra')}</th>
                <th style="text-align:right">${L('googleAds.colBuscas')}</th>
                <th style="text-align:center">${L('googleAds.colConcorrencia')}</th>
              </tr>
            </thead>
            <tbody>${keywordsRows}</tbody>
          </table>
        </section>`
      }).join('')

  const types = Array.isArray(src.campaignTypes) ? src.campaignTypes : []
  const typesHTML = types.length > 0 ? `
    <section>
      <div class="section-title">${L('googleAds.campanhasSelecionadas')}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${types.map((tipo) => `<span style="display:inline-block;padding:4px 12px;border-radius:9999px;background:#ede9fe;color:#6d28d9;font-size:11px;font-weight:600">${esc(GOOGLE_ADS_TIPOS.includes(tipo) ? t(`googleAds.tipos.${tipo}.label`) : tipo)}</span>`).join('')}
      </div>
    </section>
  ` : ''

  const summaryHTML = `
    <section>
      <div class="section-title">${L('googleAds.resumo')}</div>
      <div class="grid grid-3">
        <div class="field"><div class="field-label">${L('googleAds.grupos')}</div><div class="field-value purple">${filledGroups.length}</div></div>
        <div class="field"><div class="field-label">${L('googleAds.totalPalavras')}</div><div class="field-value">${fmtNum(totalKeywords)}</div></div>
        <div class="field"><div class="field-label">${L('googleAds.metodologia')}</div><div class="field-value" style="font-size:11px">${L('googleAds.bolo')}</div></div>
      </div>
      <p style="font-size:11px;color:#64748b;margin-top:10px;line-height:1.5">
        ${L('googleAds.nota')}
      </p>
    </section>
  `

  printHTML(t('pdf.googleAds.titulo'), project.companyName, summaryHTML + typesHTML + groupsHTML + generatedHTML)
}

// ─── Webinar PDF ──────────────────────────────────────────────────────────────
//
// Exporta o webinar COMPLETO (Abertura, História, Conteúdo e Oferta de
// Agendamento) num único documento. A estrutura (blocos/labels) vem de
// webinarData.js — a mesma usada pelo formulário — então o PDF fica em sinc
// com a ferramenta automaticamente. Campos vazios são omitidos; scripts-modelo
// (type 'info') entram como caixas de roteiro.

const WB_SCRIPT_BOX = 'background:#F5F3FF;border:1px solid #DDD6FE;border-radius:8px;padding:10px 12px;margin-bottom:10px'
const WB_SCRIPT_LABEL = 'font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#7C3AED;margin-bottom:3px'

function wbVal(data, id) {
  const v = data?.[id]
  if (Array.isArray(v)) return v
  return (v == null ? '' : String(v)).trim()
}

function wbFieldHTML(f, data) {
  if (f.type === 'alert') return ''

  if (f.type === 'info') {
    return `<div style="${WB_SCRIPT_BOX}">
      <div style="${WB_SCRIPT_LABEL}">🎙️ ${esc(f.label || t('pdf.webinar.script'))}</div>
      <div style="font-size:12px;color:#4C1D95;line-height:1.6">${esc(f.text)}</div>
    </div>`
  }

  if (f.type === 'preview') {
    const computed = typeof f.compute === 'function' ? f.compute(data || {}) : ''
    if (!computed) return ''
    return `<div style="${WB_SCRIPT_BOX}">
      <div style="${WB_SCRIPT_LABEL}">${esc(f.label)}</div>
      <div style="font-size:13px;font-weight:600;color:#4C1D95;line-height:1.6">${esc(computed)}</div>
    </div>`
  }

  if (f.type === 'choice') {
    const filled = (f.options || []).filter((o) => wbVal(data, o.id))
    if (!filled.length) return ''
    return `<div class="qa-item">
      <div class="qa-label">${esc(f.label)}</div>
      ${filled.map((o) => `<div class="qa-value"><strong>${esc(o.label)}:</strong> ${esc(wbVal(data, o.id))}</div>`).join('')}
    </div>`
  }

  if (f.type === 'radio') {
    const v = wbVal(data, f.id)
    if (!v) return ''
    const opt = (f.options || []).find((o) => o.value === v)
    return `<div class="qa-item">
      <div class="qa-label">${esc(f.label)}</div>
      <div class="qa-value">${esc(opt ? opt.label : v)}</div>
    </div>`
  }

  if (f.type === 'checks') {
    const arr = wbVal(data, f.id)
    if (!Array.isArray(arr) || !arr.length) return ''
    return `<div class="qa-item">
      <div class="qa-label">${esc(f.label)}</div>
      ${arr.map((o) => {
        // Grava-se o texto da opção em pt; no inglês `labels` traz o rótulo na mesma posição.
        const idx = (f.options || []).indexOf(o)
        return `<div class="qa-value">✓ ${esc((idx >= 0 && f.labels?.[idx]) || o)}</div>`
      }).join('')}
    </div>`
  }

  // text / area
  const v = wbVal(data, f.id)
  if (!v) return ''
  const prefix = f.prefix ? `<strong>${esc(f.prefix)}</strong> ` : ''
  return `<div class="qa-item">
    <div class="qa-label">${esc(f.label)}</div>
    <div class="qa-value" style="white-space:pre-wrap">${prefix}${esc(v)}</div>
  </div>`
}

function wbBlocksHTML(blocos, data) {
  return (blocos || []).map((bloco) => {
    const fieldsHTML = (bloco.fields || []).map((f) => wbFieldHTML(f, data)).join('')
    // Bloco só entra se algum campo produziu conteúdo (info-only, ex.: fechamento,
    // entra sempre que a etapa tiver dados — decidido pelo caller).
    const hasRealField = (bloco.fields || []).some((f) => {
      if (f.type === 'info' || f.type === 'alert' || f.type === 'preview') return false
      if (f.type === 'choice') return (f.options || []).some((o) => wbVal(data, o.id))
      const v = wbVal(data, f.id)
      return Array.isArray(v) ? v.length > 0 : !!v
    })
    const infoOnly = (bloco.fields || []).every((f) => f.type === 'info' || f.type === 'alert')
    if (!hasRealField && !infoOnly) return ''
    return `<div class="persona-block">
      <div class="persona-name">${esc(bloco.title)}${bloco.subtitle ? ` <span style="font-weight:400;font-size:11px;color:#94A3B8">— ${esc(bloco.subtitle)}</span>` : ''}</div>
      ${fieldsHTML}
    </div>`
  }).join('')
}

function wbEtapaHeader(emoji, num, chave) {
  return `<div class="section-title" style="font-size:14px;margin-top:8px">${L('webinar.etapa', { emoji, n: num, label: t(`pdf.webinar.etapas.${chave}`) })}</div>`
}

export function exportWebinarPDF(webinar, project) {
  // Estrutura (blocos, rótulos, scripts-modelo) no idioma de quem gera; ids iguais nos dois.
  const {
    ABERTURA_BLOCOS, HISTORIA_TIPOS, HISTORIA_TRANSICOES,
    HISTORIA_3A_BLOCOS, HISTORIA_3B_BLOCOS,
    CONTEUDO_ETAPA1, CONTEUDO_TEMAS, CONTEUDO_ETAPA4, CONTEUDO_ETAPA5, CONTEUDO_ETAPA6,
    CONTEUDO_ROTEIRO_ABERTURA, CONTEUDO_ROTEIRO_PILARES, CONTEUDO_ROTEIRO_PONTOS,
    CONTEUDO_ETAPA9, CONTEUDO_TRANSICOES,
    OA_BLOCOS, OA_OBJECOES_FIXAS, OA_FECHAMENTO,
  } = webinarNoIdioma(idiomaAtual())
  const et = webinar?.etapas || {}
  const sections = []

  // ── Etapa 1: Abertura ──
  const ab = et.abertura || {}
  if (Object.keys(ab).length) {
    sections.push(`<section>${wbEtapaHeader('🎬', 1, 'abertura')}${wbBlocksHTML(ABERTURA_BLOCOS, ab)}</section>`)
  }

  // ── Etapa 2: História ──
  const hi = et.historia || {}
  if (Object.keys(hi).length) {
    const tipoMeta = HISTORIA_TIPOS.find((t) => t.id === hi.tipo)
    const tipoHTML = tipoMeta
      ? `<div class="field" style="margin-bottom:12px"><div class="field-label">${L('webinar.tipoHistoria')}</div><div class="field-value purple">${L('webinar.opcao', { id: tipoMeta.id, label: tipoMeta.label })}</div><div style="font-size:11px;color:#64748B;margin-top:3px">${esc(tipoMeta.desc)}</div></div>`
      : ''
    const transHTML = HISTORIA_TRANSICOES.map((tr) => {
      if (!wbVal(hi, tr.field.id)) return ''
      return `<div class="persona-block">
        <div class="persona-name">${esc(tr.title)}</div>
        ${wbFieldHTML(tr.field, hi)}
        <div style="${WB_SCRIPT_BOX}">
          <div style="${WB_SCRIPT_LABEL}">${L('webinar.transicaoFica')}</div>
          <div style="font-size:12px;color:#4C1D95;line-height:1.6">${esc(tr.compute(hi))}</div>
        </div>
      </div>`
    }).join('')
    const blocos = hi.tipo === 'A' ? HISTORIA_3A_BLOCOS : hi.tipo === 'B' ? HISTORIA_3B_BLOCOS : []
    sections.push(`<section>${wbEtapaHeader('📖', 2, 'historia')}${tipoHTML}${transHTML}${wbBlocksHTML(blocos, hi)}</section>`)
  }

  // ── Etapa 3: Conteúdo ──
  const co = et.conteudo || {}
  if (Object.keys(co).length) {
    const parts = [wbBlocksHTML(CONTEUDO_ETAPA1, co)]

    const temaMeta = CONTEUDO_TEMAS.find((t) => t.id === co.tema)
    if (temaMeta) {
      parts.push(`<div class="persona-block">
        <div class="persona-name">${L('webinar.temaAula', { id: temaMeta.id, label: temaMeta.label })}</div>
        ${(temaMeta.fields || []).map((f) => wbFieldHTML(f, co)).join('')}
      </div>`)
    }

    const rotAbertura = wbFieldHTML(CONTEUDO_ROTEIRO_ABERTURA, co)
    if (rotAbertura) parts.push(`<div class="persona-block"><div class="persona-name">${L('webinar.roteiroAbertura')}</div>${rotAbertura}</div>`)

    const roteiro = co.tema === 'A' ? CONTEUDO_ROTEIRO_PILARES : (co.tema === 'B' || co.tema === 'C') ? CONTEUDO_ROTEIRO_PONTOS : []
    parts.push(wbBlocksHTML(roteiro, co))
    parts.push(wbBlocksHTML(CONTEUDO_ETAPA4, co))
    parts.push(wbBlocksHTML(CONTEUDO_ETAPA5, co))
    parts.push(wbBlocksHTML(CONTEUDO_ETAPA6, co))
    parts.push(wbBlocksHTML(CONTEUDO_ETAPA9, co))

    const transMeta = CONTEUDO_TRANSICOES.find((t) => t.id === co.transicao_oferta)
    const transFinal = wbVal(co, 'c_transicao_final')
    if (transMeta || transFinal) {
      parts.push(`<div class="persona-block">
        <div class="persona-name">${L('webinar.transicaoOferta')}${transMeta ? ` — ${esc(transMeta.titulo)}` : ''}</div>
        ${transMeta ? `<div style="${WB_SCRIPT_BOX}"><div style="${WB_SCRIPT_LABEL}">${L('webinar.modelo')}</div><div style="font-size:12px;color:#4C1D95;line-height:1.6">${esc(transMeta.texto)}</div></div>` : ''}
        ${transFinal ? `<div class="qa-item"><div class="qa-label">${L('webinar.suaTransicao')}</div><div class="qa-value" style="white-space:pre-wrap">${esc(transFinal)}</div></div>` : ''}
      </div>`)
    }

    sections.push(`<section>${wbEtapaHeader('🎓', 3, 'conteudo')}${parts.join('')}</section>`)
  }

  // ── Etapa 4: Oferta de Agendamento ──
  const oa = et.oferta_agendamento || {}
  if (Object.keys(oa).length) {
    const parts = [wbBlocksHTML(OA_BLOCOS, oa)]

    const fixasHTML = OA_OBJECOES_FIXAS.map((obj) => {
      const resp = wbVal(oa, `oa_obj${obj.n}_resp`)
      if (!resp) return ''
      return `<div class="persona-block">
        <div class="persona-name">${L('webinar.objecao', { n: obj.n, pergunta: obj.pergunta })}</div>
        <div class="qa-item"><div class="qa-label">${L('webinar.resposta')}</div><div class="qa-value" style="white-space:pre-wrap">${esc(resp)}</div></div>
        <div class="qa-item"><div class="qa-label">${L('webinar.cta')}</div><div class="qa-value">${esc(obj.cta)}</div></div>
      </div>`
    }).join('')

    const customHTML = [8, 9, 10].map((n) => {
      const perg = wbVal(oa, `oa_obj${n}_pergunta`)
      const resp = wbVal(oa, `oa_obj${n}_resp`)
      if (!perg && !resp) return ''
      return `<div class="persona-block">
        <div class="persona-name">${L('webinar.objecaoNicho', { n, pergunta: perg || '—' })}</div>
        ${resp ? `<div class="qa-item"><div class="qa-label">${L('webinar.resposta')}</div><div class="qa-value" style="white-space:pre-wrap">${esc(resp)}</div></div>` : ''}
        ${wbVal(oa, `oa_obj${n}_cta`) ? `<div class="qa-item"><div class="qa-label">${L('webinar.cta')}</div><div class="qa-value">${esc(wbVal(oa, `oa_obj${n}_cta`))}</div></div>` : ''}
      </div>`
    }).join('')

    if (fixasHTML || customHTML) {
      parts.push(`<div class="persona-name" style="border:none;margin-top:4px">${L('webinar.objecoesRespostas')}</div>${fixasHTML}${customHTML}`)
    }
    parts.push(wbBlocksHTML(OA_FECHAMENTO, oa))

    sections.push(`<section>${wbEtapaHeader('📅', 4, 'ofertaAgendamento')}${parts.join('')}</section>`)
  }

  const body = sections.length
    ? sections.join('\n')
    : `<section><p class="prose">${L('webinar.vazio')}</p></section>`

  const empresa = project?.companyName || project?.company_name || ''
  printHTML(webinar?.nome || t('pdf.webinar.titulo'), empresa ? t('pdf.webinar.subtitulo', { empresa }) : t('pdf.webinar.titulo'), body)
}
