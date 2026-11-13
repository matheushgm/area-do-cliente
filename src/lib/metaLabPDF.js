// Plano do Laboratório Meta Ads em PDF — HTML + window.print(), no scaffold
// comum (printDoc.js). Capa, visão geral, uma página por fase e o resumo do
// investimento. As cores por fase vêm de variáveis CSS (--c forte, --l clara).
import { printDocument } from './printDoc'
import { escapeHtml as esc, fmtCurrency } from './utils'
import { t, localeAtual } from '../i18n'

// Sai no idioma de quem gera: textos em locales/{pt,en}/metaLab.js (`pdf.*` e `fases.*`).
const L = (k, vars) => t(`metaLab.pdf.${k}`, vars)
const F = (fase, k, vars) => t(`metaLab.fases.${fase}.${k}`, vars)
const TF = (fase, k, vars) => t(`metaLab.pdf.textoFases.${fase}.${k}`, vars)
const nFases = (n) => t('metaLab.nFases', { count: n })
const tipoLab = (lab) => t(`metaLab.tipos.${lab.labTipo}`)

const CSS = `
  body { color: #1E1E37; }
  .cover { background: #0A0A19; color: #fff; min-height: 100vh; padding: 48px 56px; border-top: 6px solid #7C3AED; display: flex; flex-direction: column; page-break-after: always; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand-mark { width: 40px; height: 40px; border-radius: 10px; background: #7C3AED; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px; }
  .brand-name { font-size: 17px; font-weight: 800; }
  .brand-sub { font-size: 11px; color: #9696C8; }
  .hero { margin-top: 90px; line-height: 1.05; }
  .hero-kicker { font-size: 36px; color: #B4B4DC; }
  .hero-title { font-size: 52px; font-weight: 800; }
  .hero-title.accent { color: #7C3AED; }
  .hero-rule { border: 0; border-top: 1px solid #3C3C5A; margin: 22px 0; }
  .hero-sub { color: #A0A0C8; font-size: 14px; line-height: 1.5; }
  .info { background: #16162D; border-radius: 12px; padding: 24px 28px; margin-top: 44px; }
  .info-label { font-size: 9px; letter-spacing: .1em; font-weight: 700; color: #7878A0; text-transform: uppercase; }
  .info-value { font-size: 22px; font-weight: 800; margin: 4px 0 14px; }
  .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; border-top: 1px solid #28284A; padding-top: 14px; }
  .info-grid .info-value { font-size: 14px; margin-bottom: 0; }
  .cover-foot { margin-top: auto; text-align: center; font-size: 11px; color: #505078; padding-top: 40px; }
  .cover-foot small { display: block; color: #3C3C64; margin-top: 4px; }
  .page { padding: 0 0 24px; page-break-before: always; }
  .page-head { background: var(--c, #7C3AED); color: #fff; padding: 12px 40px; display: flex; justify-content: space-between; align-items: center; }
  .page-head h2 { font-size: 15px; font-weight: 800; }
  .page-head span { font-size: 11px; color: #DCDCFF; }
  .page-body { padding: 22px 40px 0; }
  .intro { color: #646482; font-size: 12.5px; line-height: 1.6; margin-bottom: 18px; }
  .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 22px; }
  .card { border-radius: 10px; padding: 12px; text-align: center; background: var(--l, #F5F6FC); }
  .card-label { font-size: 9px; color: #646482; margin-bottom: 4px; }
  .card-value { font-size: 13px; font-weight: 800; color: var(--c, #1E1E37); }
  h3.sec { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 800; margin: 18px 0 12px; }
  h3.sec::before { content: ''; width: 4px; height: 18px; background: var(--c, #7C3AED); border-radius: 2px; }
  .timeline { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 18px; }
  .tl { border-radius: 10px; padding: 12px 10px; text-align: center; color: #fff; background: var(--c); }
  .tl.off { background: #DCE1F0; color: #646482; }
  .tl b { display: block; font-size: 9px; letter-spacing: .05em; }
  .tl span { font-size: 11px; opacity: .85; }
  .box { background: #F5F6FC; border-radius: 10px; padding: 12px 16px; margin-bottom: 18px; }
  .box .lbl { font-size: 10px; color: #646482; margin-bottom: 4px; }
  .box .val { font-size: 12px; font-weight: 700; }
  .box .mono { font-size: 11px; margin-top: 4px; }
  .phase { border-radius: 10px; padding: 14px 16px; margin-bottom: 12px; background: var(--l); display: grid; grid-template-columns: 1fr auto; gap: 8px 16px; page-break-inside: avoid; }
  .phase-badge { display: inline-block; background: var(--c); color: #fff; font-size: 9px; font-weight: 800; letter-spacing: .05em; padding: 3px 10px; border-radius: 6px; margin-right: 8px; vertical-align: middle; }
  .phase-name { font-size: 14px; font-weight: 800; color: var(--c); }
  .phase-days { font-size: 11px; color: #646482; margin: 2px 0 8px; }
  .phase-desc { font-size: 11px; line-height: 1.55; grid-column: 1 / -1; }
  .phase-cost { text-align: right; }
  .phase-cost b { display: block; font-size: 15px; color: var(--c); }
  .phase-cost span { font-size: 9px; color: #646482; }
  .note { background: #EBE8FE; color: #7C3AED; border-radius: 10px; padding: 12px 16px; font-size: 11px; line-height: 1.55; margin-top: 18px; }
  .cfg { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; }
  .cfg div { background: var(--l); border-radius: 8px; padding: 9px 12px; }
  .cfg small { display: block; font-size: 9px; color: #646482; margin-bottom: 3px; }
  .cfg b { font-size: 11.5px; }
  .crit { background: var(--l); border-radius: 8px; padding: 8px 12px; margin-bottom: 6px; font-size: 11px; }
  .crit b { color: var(--c); margin-right: 8px; }
  table.days { width: 100%; border-collapse: collapse; margin: 6px 0 16px; font-size: 11px; }
  table.days th { background: var(--c); color: #fff; font-size: 9px; letter-spacing: .05em; text-align: left; padding: 7px 8px; }
  table.days td { padding: 8px; border-bottom: 1px solid #DCE1F0; vertical-align: top; }
  table.days tr:nth-child(odd) td { background: #F5F6FC; }
  table.days td.day { color: var(--c); font-weight: 800; white-space: nowrap; }
  table.days td.act { font-weight: 700; white-space: nowrap; }
  table.days td.det { color: #646482; }
  table.days tr.hl td:first-child { box-shadow: inset 3px 0 0 var(--c); }
  .fin { background: var(--l); border-radius: 10px; padding: 12px 16px; page-break-inside: avoid; }
  .fin .lbl { font-size: 9px; font-weight: 800; color: var(--c); letter-spacing: .05em; margin-bottom: 8px; }
  .fin-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .fin-grid small { display: block; font-size: 9px; color: #646482; }
  .fin-grid b { font-size: 12px; }
  .fin-grid .total b { font-size: 14px; color: var(--c); }
  .total-box { background: #D1FAE5; border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 22px; }
  .total-box small { display: block; font-size: 10px; font-weight: 800; color: #059669; letter-spacing: .05em; }
  .total-box b { font-size: 28px; color: #059669; }
  .dist { display: flex; justify-content: space-between; align-items: center; border-radius: 10px; padding: 12px 16px; margin-bottom: 8px; background: var(--l, #F5F6FC); }
  .dist .name { font-size: 12.5px; font-weight: 800; color: var(--c, #646482); }
  .dist .days { font-size: 10px; color: #646482; }
  .dist .cost { font-size: 15px; font-weight: 800; color: var(--c, #646482); }
  .dist .off { color: #646482; font-weight: 600; font-size: 12px; }
  .badge { display: inline-block; background: #FEF3C7; color: #D97706; font-size: 9px; font-weight: 800; padding: 2px 8px; border-radius: 6px; margin-right: 10px; }
  .rest { background: #D1FAE5; color: #059669; border-radius: 10px; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; margin: 4px 0 18px; }
  .rest b { display: block; font-size: 13px; }
  .next { background: #F5F6FC; border-radius: 8px; padding: 10px 14px; margin-bottom: 6px; font-size: 12px; }
  .page-foot { margin: 28px 40px 0; padding-top: 8px; border-top: 1px solid #DCE1F0; font-size: 9px; color: #646482; display: flex; justify-content: space-between; }
`

const TONES = {
  purple: { c: '#7C3AED', l: '#EDE9FE' },
  blue:   { c: '#2563EB', l: '#DBEAFE' },
  gold:   { c: '#D97706', l: '#FEF3C7' },
  green:  { c: '#059669', l: '#D1FAE5' },
}
const tone = (t) => `--c:${TONES[t].c};--l:${TONES[t].l}`

const AUDIENCES = ['remarketing', 'lookalike', 'interesses']

const PHASES = [
  { key: 'f1', num: '01', start: 1,  tone: 'purple' },
  { key: 'f2', num: '02', start: 8,  tone: 'blue' },
  { key: 'f3', num: '03', start: 15, tone: 'gold' },
]

const pageFoot = (companyName, today) =>
  `<div class="page-foot"><span>Revenue Lab × ${esc(companyName)}</span><span>${esc(today)}</span></div>`

function coverHtml({ companyName, lab, budget, today }) {
  return `
  <section class="cover">
    <div class="brand">
      <div class="brand-mark">RL</div>
      <div><div class="brand-name">Revenue Lab</div><div class="brand-sub">${esc(L('ferramenta'))}</div></div>
    </div>
    <div class="hero">
      <div class="hero-kicker">${esc(L('planoDe'))}</div>
      <div class="hero-title">${esc(L('heroTitulo'))}</div>
      <div class="hero-title accent">${esc(L('heroDestaque'))}</div>
      <hr class="hero-rule">
      <div class="hero-sub">${L('heroSub')}</div>
    </div>
    <div class="info">
      <div class="info-label">${esc(L('cliente'))}</div>
      <div class="info-value">${esc(companyName)}</div>
      <div class="info-grid">
        <div><div class="info-label">${esc(L('tipoLab'))}</div><div class="info-value">${esc(tipoLab(lab))}</div></div>
        <div><div class="info-label">${esc(L('duracao'))}</div><div class="info-value">${esc(t('metaLab.nDias', { count: lab.duration }))}</div></div>
        <div><div class="info-label">${esc(L('fases'))}</div><div class="info-value">${esc(nFases(lab.phases))}</div></div>
        <div><div class="info-label">${esc(L('investimento'))}</div><div class="info-value">${fmtCurrency(budget)}</div></div>
      </div>
    </div>
    <div class="cover-foot">${esc(L('geradoEm', { data: today }))}<small>${esc(L('confidencial'))}</small></div>
  </section>`
}

function overviewHtml({ lab, audienceLabel, companyName, today }) {
  const cards = [
    [L('investimentoTotal'), fmtCurrency(lab.total), 'purple'],
    [L('duracao'), t('metaLab.nDias', { count: lab.duration }), 'blue'],
    [L('fasesAtivas'), nFases(lab.phases), 'green'],
    [L('tipoLaboratorio'), tipoLab(lab), 'gold'],
  ]
  return `
  <section class="page" style="${tone('purple')}">
    <div class="page-head"><h2>${esc(L('visaoGeral'))}</h2><span>${esc(tipoLab(lab))}</span></div>
    <div class="page-body">
      <p class="intro">${L('intro')}</p>
      <div class="cards">
        ${cards.map(([l, v, t]) => `<div class="card" style="${tone(t)}"><div class="card-label">${esc(l)}</div><div class="card-value">${esc(v)}</div></div>`).join('')}
      </div>
      <h3 class="sec">${esc(L('linhaTempo'))}</h3>
      <div class="timeline">
        ${PHASES.map((p) => lab[p.key]
          ? `<div class="tl" style="${tone(p.tone)}"><b>${esc(L('faseMaiuscula', { num: p.num }))} — ${esc(F(p.key, 'curto').toUpperCase())}</b><span>${esc(F(p.key, 'dias'))}</span></div>`
          : `<div class="tl off"><b>${esc(L('faseMaiuscula', { num: p.num }))} — ${esc(F(p.key, 'curto').toUpperCase())}</b><span>${esc(L('naoIncluida'))}</span></div>`).join('')}
      </div>
      <div class="box"><div class="lbl">${esc(L('tipoPublico'))}</div><div class="val">${esc(audienceLabel)}</div></div>
      <h3 class="sec">${esc(L('oQueAcontece'))}</h3>
      ${PHASES.filter((p) => lab[p.key]).map((p) => `
      <div class="phase" style="${tone(p.tone)}">
        <div><span class="phase-badge">${esc(L('faseMaiuscula', { num: p.num }))}</span><span class="phase-name">${esc(F(p.key, 'nome'))}</span><div class="phase-days">${esc(F(p.key, 'dias'))}</div></div>
        <div class="phase-cost"><b>${fmtCurrency(lab[p.key].totalCost)}</b><span>${esc(L('totalDaFase'))}</span></div>
        <div class="phase-desc">${esc(TF(p.key, 'resumo', { conjuntos: lab[p.key].conjuntos, manter: lab[p.key].keepAfterDay1 }))}</div>
      </div>`).join('')}
      <div class="note">${esc(L('notaFases'))}</div>
    </div>
    ${pageFoot(companyName, today)}
  </section>`
}

function phaseHtml(def, plan, { audienceLabel, companyName, today }) {
  const sd = def.start
  const nome = F(def.key, 'nome')
  const rotulo = F(def.key, 'itens')
  const configs = [
    [L('objetivo'), F(def.key, 'objetivo')],
    [L('tipoOrcamento'), L('porConjuntoAbo')],
    [L('verbaConjunto'), L('verbaValor', { valor: fmtCurrency(35, 2) })],
    [L('conjuntosDia1'), L('nConjuntos', { count: plan.conjuntos })],
  ]
  if (def.key === 'f1') configs.push([L('publicoF1'), audienceLabel])
  if (def.key === 'f2') configs.push([L('criativoUsado'), L('criativoCampeao')])
  if (def.key === 'f3') configs.push([L('base'), L('baseValor')], [L('publico'), L('publicoCampeao')])

  const dia = (n) => L('dia', { n })
  const otim = L('acoes.otimizacao')
  const days = [
    [dia(sd), L('acoes.lancamento'), L('detalhes.d1', { conjuntos: plan.conjuntos, itens: plan.itemsPerConjunto, rotulo, verba: fmtCurrency(35) }), true],
    [dia(sd + 1), L('acoes.selecao'), L('detalhes.d2', { manter: plan.keepAfterDay1, rotulo, criterio: F(def.key, 'criterios.c1') }), true],
    [dia(sd + 2), otim, L('detalhes.d3', { manter: plan.keepAfterDay1 }), false],
    [dia(sd + 3), otim, L('detalhes.d4'), false],
    [dia(sd + 4), otim, L('detalhes.d5'), false],
    [dia(sd + 5), otim, L('detalhes.d6'), false],
    [dia(sd + 6), L('acoes.conclusao'), L('detalhes.d7', { conclusao: TF(def.key, 'conclusao') }), true],
  ]

  return `
  <section class="page" style="${tone(def.tone)}">
    <div class="page-head"><h2>${esc(L('faseNome', { num: def.num, nome }))}</h2><span>${esc(F(def.key, 'dias'))}</span></div>
    <div class="page-body">
      <p class="intro">${esc(TF(def.key, 'descricao'))}</p>
      <h3 class="sec">${esc(L('configuracao'))}</h3>
      <div class="cfg">${configs.map(([l, v]) => `<div><small>${esc(l)}</small><b>${esc(v)}</b></div>`).join('')}</div>
      <div class="box">
        <div class="lbl"><b>${esc(L('nomenclatura'))}</b></div>
        <div class="mono">${esc(L('campanha', { num: def.num, nome }))}</div>
        <div class="mono">${esc(L('conjunto', { num: def.num }))}</div>
      </div>
      <h3 class="sec">${esc(L('criterioDia2'))}</h3>
      ${['c1', 'c2'].map((s, i) => `<div class="crit"><b>${esc(L('nCriterio', { n: i + 1 }))}</b>${esc(F(def.key, `criterios.${s}`))}</div>`).join('')}
      <h3 class="sec">${esc(L('cadaDia'))}</h3>
      <table class="days">
        <thead><tr><th>${esc(L('colDia'))}</th><th>${esc(L('colAcao'))}</th><th>${esc(L('colDetalhes'))}</th></tr></thead>
        <tbody>${days.map(([d, a, det, hl]) => `<tr${hl ? ' class="hl"' : ''}><td class="day">${esc(d)}</td><td class="act">${esc(a)}</td><td class="det">${esc(det)}</td></tr>`).join('')}</tbody>
      </table>
      <div class="fin">
        <div class="lbl">${esc(L('resumoFinanceiro'))}</div>
        <div class="fin-grid">
          <div><small>${esc(L('diaLancamento', { n: sd }))}</small><b>${fmtCurrency(plan.dia1Cost)}</b></div>
          <div><small>${esc(L('diasOtimizacao', { de: sd + 1, ate: sd + 6 }))}</small><b>${fmtCurrency(plan.dias2a7Cost)}</b></div>
          <div class="total"><small>${esc(L('totalFase'))}</small><b>${fmtCurrency(plan.totalCost)}</b></div>
        </div>
      </div>
    </div>
    ${pageFoot(companyName, today)}
  </section>`
}

function summaryHtml({ lab, budget, companyName, today }) {
  const nexts = ['p1', 'p2', 'p3', 'p4'].map((k) => L(`proximos.${k}`))
  return `
  <section class="page" style="${tone('green')}">
    <div class="page-head"><h2>${esc(L('resumoInvestimento'))}</h2><span>${esc(L('visaoFinanceira'))}</span></div>
    <div class="page-body">
      <div class="total-box"><small>${esc(L('investimentoTotalLab'))}</small><b>${fmtCurrency(lab.total)}</b></div>
      <h3 class="sec">${esc(L('distribuicao'))}</h3>
      ${PHASES.map((p) => {
        const plan = lab[p.key]
        const nome = esc(L('faseNome', { num: p.num, nome: F(p.key, 'nome') }))
        const dias = esc(F(p.key, 'dias'))
        return plan
          ? `<div class="dist" style="${tone(p.tone)}"><div><div class="name">${nome}</div><div class="days">${dias}</div></div><div>${plan.isStandard ? '' : `<span class="badge">${esc(L('adaptado'))}</span>`}<span class="cost">${fmtCurrency(plan.totalCost)}</span></div></div>`
          : `<div class="dist"><div><div class="name">${nome}</div><div class="days">${dias}</div></div><span class="off">${esc(L('naoIncluida'))}</span></div>`
      }).join('')}
      ${lab.total < budget ? `<div class="rest"><div>${esc(L('saldoRestante'))}<b>${fmtCurrency(budget - lab.total)}</b></div><span>${esc(L('saldoNota'))}</span></div>` : ''}
      <h3 class="sec">${esc(L('depois'))}</h3>
      ${nexts.map((n) => `<div class="next">${esc(n)}</div>`).join('')}
      <div class="note">${esc(L('notaFinal'))}</div>
    </div>
    ${pageFoot(companyName, today)}
  </section>`
}

export function generateMetaLabPDF({ lab, audienceType, companyName, budget }) {
  const ctx = {
    lab, budget,
    companyName: companyName || L('cliente'),
    today: new Date().toLocaleDateString(localeAtual(), { day: '2-digit', month: 'long', year: 'numeric' }),
    audienceLabel: AUDIENCES.includes(audienceType) ? t(`metaLab.publicos.${audienceType}.descricao`) : t('metaLab.aDefinir'),
  }
  printDocument({
    title: L('arquivo', { cliente: ctx.companyName.replace(/\s+/g, '-') }),
    css: CSS,
    body: coverHtml(ctx)
      + overviewHtml(ctx)
      + PHASES.filter((p) => lab[p.key]).map((p) => phaseHtml(p, lab[p.key], ctx)).join('')
      + summaryHtml(ctx),
  })
}
