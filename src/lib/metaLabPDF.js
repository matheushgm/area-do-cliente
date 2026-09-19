// Plano do Laboratório Meta Ads em PDF — HTML + window.print(), no scaffold
// comum (printDoc.js). Capa, visão geral, uma página por fase e o resumo do
// investimento. As cores por fase vêm de variáveis CSS (--c forte, --l clara).
import { printDocument, todayLong } from './printDoc'
import { escapeHtml as esc, fmtCurrency } from './utils'

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

const AUDIENCE_LABEL = {
  remarketing: 'Remarketing (público de engajamento)',
  lookalike:   'Lookalike (público semelhante à base de clientes)',
  interesses:  'Interesses gerais mistos',
}

const PHASES = [
  {
    key: 'f1', num: '01', name: 'Teste de Criativos', days: 'Dias 1–7', start: 1, tone: 'purple', itemsLabel: 'criativos',
    description: 'Identificar os 3 criativos com maior potencial de conversão em 7 dias. Cada conjunto roda com orçamento igual para garantir comparação justa.',
    selectionDay2: ['Priorize menor CPL (se houve conversões)', 'Use CTR no link como critério (se não houve conversões)'],
    objective: 'Conversão ou Tráfego',
    summary: (p) => `Lançamos ${p.conjuntos} conjuntos de anúncio no Dia 1 para identificar os ${p.keepAfterDay1} criativos com melhor desempenho. No Dia 2, pausamos os piores e mantemos os campeões pelos próximos 5 dias.`,
    conclusion: 'Prepare o criativo vencedor para a Fase 02.',
  },
  {
    key: 'f2', num: '02', name: 'Teste de Públicos', days: 'Dias 8–14', start: 8, tone: 'blue', itemsLabel: 'públicos',
    description: 'Com o criativo campeão da Fase 01, descobrir os públicos com maior probabilidade de conversão. Usamos o mesmo criativo em todos os conjuntos para isolar a variável público.',
    selectionDay2: ['Menor CPL (se houve conversões)', 'CTR no link + Custo por clique (se não houve conversões)'],
    objective: 'Conversão ou Tráfego',
    summary: (p) => `Com o criativo campeão da Fase 01, testamos ${p.conjuntos} públicos diferentes para descobrir qual audiência converte melhor ao menor custo.`,
    conclusion: 'Prepare o público vencedor para a Fase 03.',
  },
  {
    key: 'f3', num: '03', name: 'Teste de Ganchos', days: 'Dias 15–21', start: 15, tone: 'gold', itemsLabel: 'ganchos',
    description: 'Com criativo e público já validados, testamos variações do início do vídeo (gancho) para aumentar retenção nos primeiros 3 segundos e reduzir o CPL final.',
    selectionDay2: ['Menor CPL (se houve conversões)', 'Retenção nos 3 primeiros segundos + CTR (se não houve conversões)'],
    objective: 'Conversão (criativo e público já validados)',
    summary: (p) => `Com criativo e público já validados, testamos ${p.conjuntos} variações do início do vídeo para maximizar a retenção nos primeiros 3 segundos e reduzir o CPL final.`,
    conclusion: 'Consolide os resultados finais do laboratório.',
  },
]

const pageFoot = (companyName, today) =>
  `<div class="page-foot"><span>Revenue Lab × ${esc(companyName)}</span><span>${esc(today)}</span></div>`

function coverHtml({ companyName, lab, budget, today }) {
  return `
  <section class="cover">
    <div class="brand">
      <div class="brand-mark">RL</div>
      <div><div class="brand-name">Revenue Lab</div><div class="brand-sub">Internal Tool</div></div>
    </div>
    <div class="hero">
      <div class="hero-kicker">Plano de</div>
      <div class="hero-title">Laboratório</div>
      <div class="hero-title accent">Meta Ads</div>
      <hr class="hero-rule">
      <div class="hero-sub">Metodologia de validação de criativos, públicos e ganchos<br>no Meta Ads — com clareza total sobre cada dia do projeto.</div>
    </div>
    <div class="info">
      <div class="info-label">Cliente</div>
      <div class="info-value">${esc(companyName)}</div>
      <div class="info-grid">
        <div><div class="info-label">Tipo de lab</div><div class="info-value">${esc(lab.labType)}</div></div>
        <div><div class="info-label">Duração</div><div class="info-value">${lab.duration} dias</div></div>
        <div><div class="info-label">Fases</div><div class="info-value">${lab.phases} fase${lab.phases > 1 ? 's' : ''}</div></div>
        <div><div class="info-label">Investimento</div><div class="info-value">${fmtCurrency(budget)}</div></div>
      </div>
    </div>
    <div class="cover-foot">Gerado em ${esc(today)}<small>Confidencial — uso exclusivo do cliente</small></div>
  </section>`
}

function overviewHtml({ lab, audienceLabel, companyName, today }) {
  const cards = [
    ['Investimento Total', fmtCurrency(lab.total), 'purple'],
    ['Duração', `${lab.duration} dias`, 'blue'],
    ['Fases Ativas', `${lab.phases} fase${lab.phases > 1 ? 's' : ''}`, 'green'],
    ['Tipo de Laboratório', lab.labType, 'gold'],
  ]
  return `
  <section class="page" style="${tone('purple')}">
    <div class="page-head"><h2>Visão Geral do Laboratório</h2><span>${esc(lab.labType)}</span></div>
    <div class="page-body">
      <p class="intro">Este documento apresenta o plano completo do Laboratório Meta Ads.<br>Cada fase tem um objetivo claro, e cada dia tem uma ação definida.</p>
      <div class="cards">
        ${cards.map(([l, v, t]) => `<div class="card" style="${tone(t)}"><div class="card-label">${esc(l)}</div><div class="card-value">${esc(v)}</div></div>`).join('')}
      </div>
      <h3 class="sec">Linha do Tempo</h3>
      <div class="timeline">
        ${PHASES.map((p) => lab[p.key]
          ? `<div class="tl" style="${tone(p.tone)}"><b>FASE ${p.num} — ${esc(p.name.replace('Teste de ', '').toUpperCase())}</b><span>${p.days}</span></div>`
          : `<div class="tl off"><b>FASE ${p.num} — ${esc(p.name.replace('Teste de ', '').toUpperCase())}</b><span>Não incluída</span></div>`).join('')}
      </div>
      <div class="box"><div class="lbl">Tipo de Público — Fase 01:</div><div class="val">${esc(audienceLabel)}</div></div>
      <h3 class="sec">O Que Acontece em Cada Fase</h3>
      ${PHASES.filter((p) => lab[p.key]).map((p) => `
      <div class="phase" style="${tone(p.tone)}">
        <div><span class="phase-badge">FASE ${p.num}</span><span class="phase-name">${esc(p.name)}</span><div class="phase-days">${p.days}</div></div>
        <div class="phase-cost"><b>${fmtCurrency(lab[p.key].totalCost)}</b><span>total da fase</span></div>
        <div class="phase-desc">${esc(p.summary(lab[p.key]))}</div>
      </div>`).join('')}
      <div class="note">💡 Cada fase roda por exatamente 7 dias. Os resultados de cada etapa alimentam a próxima, criando uma estratégia de dados progressiva e validada.</div>
    </div>
    ${pageFoot(companyName, today)}
  </section>`
}

function phaseHtml(def, plan, { audienceLabel, companyName, today }) {
  const sd = def.start
  const configs = [
    ['Objetivo', def.objective],
    ['Tipo de orçamento', 'Por conjunto (ABO)'],
    ['Verba por conjunto', 'R$ 35,00 / dia'],
    ['Conjuntos no Dia 1', `${plan.conjuntos} conjuntos`],
  ]
  if (def.key === 'f1') configs.push(['Público (Fase 01)', audienceLabel])
  if (def.key === 'f2') configs.push(['Criativo usado', 'Criativo campeão da Fase 01'])
  if (def.key === 'f3') configs.push(['Base', 'Criativo campeão da Fase 01 (só muda o início)'], ['Público', 'Público campeão da Fase 02'])

  const days = [
    [`Dia ${sd}`, '🚀 Lançamento', `Suba ${plan.conjuntos} conjuntos de anúncio com ${plan.itemsPerConjunto} ${def.itemsLabel} por conjunto. Verba: R$35/conjunto. Deixe rodar 24h sem mexer.`, true],
    [`Dia ${sd + 1}`, '🔍 Seleção', `Analise os resultados. Pause os piores e mantenha os ${plan.keepAfterDay1} melhores ${def.itemsLabel}. Critério: ${def.selectionDay2[0]}.`, true],
    [`Dia ${sd + 2}`, '📊 Otimização', `Continue com os ${plan.keepAfterDay1} melhores. Monitore CPL e CTR. Ajuste verba se necessário.`, false],
    [`Dia ${sd + 3}`, '📊 Otimização', 'Observe tendências. Se algum conjunto cair de performance, considere substituição.', false],
    [`Dia ${sd + 4}`, '📊 Otimização', 'Mantenha os vencedores. Avalie se há necessidade de novos criativos para os conjuntos fracos.', false],
    [`Dia ${sd + 5}`, '📊 Otimização', 'Continue monitorando CPL/ROAS. Documente os aprendizados para a próxima fase.', false],
    [`Dia ${sd + 6}`, '✅ Conclusão', `Registre o campeão desta fase. ${def.conclusion}`, true],
  ]

  return `
  <section class="page" style="${tone(def.tone)}">
    <div class="page-head"><h2>Fase ${def.num} — ${esc(def.name)}</h2><span>${def.days}</span></div>
    <div class="page-body">
      <p class="intro">${esc(def.description)}</p>
      <h3 class="sec">Configuração no Meta Ads</h3>
      <div class="cfg">${configs.map(([l, v]) => `<div><small>${esc(l)}</small><b>${esc(v)}</b></div>`).join('')}</div>
      <div class="box">
        <div class="lbl"><b>NOMENCLATURA SUGERIDA</b></div>
        <div class="mono">Campanha: [Cliente] – LAB – Fase ${def.num} – ${esc(def.name)}</div>
        <div class="mono">Conjunto:  [Cliente] – F${def.num} – CA01 / CA02 / CA03…</div>
      </div>
      <h3 class="sec">Critério de Seleção (Dia 2)</h3>
      ${def.selectionDay2.map((s, i) => `<div class="crit"><b>${i + 1}º critério:</b>${esc(s)}</div>`).join('')}
      <h3 class="sec">O Que Fazer em Cada Dia</h3>
      <table class="days">
        <thead><tr><th>DIA</th><th>AÇÃO</th><th>DETALHES</th></tr></thead>
        <tbody>${days.map(([d, a, det, hl]) => `<tr${hl ? ' class="hl"' : ''}><td class="day">${d}</td><td class="act">${a}</td><td class="det">${esc(det)}</td></tr>`).join('')}</tbody>
      </table>
      <div class="fin">
        <div class="lbl">RESUMO FINANCEIRO DA FASE</div>
        <div class="fin-grid">
          <div><small>Dia ${sd} (lançamento)</small><b>${fmtCurrency(plan.dia1Cost)}</b></div>
          <div><small>Dias ${sd + 1}–${sd + 6} (otimização)</small><b>${fmtCurrency(plan.dias2a7Cost)}</b></div>
          <div class="total"><small>Total da fase</small><b>${fmtCurrency(plan.totalCost)}</b></div>
        </div>
      </div>
    </div>
    ${pageFoot(companyName, today)}
  </section>`
}

function summaryHtml({ lab, budget, companyName, today }) {
  const nexts = [
    '✅ Você terá os criativos, públicos e ganchos validados com dados reais.',
    '📈 Poderemos escalar com segurança, sabendo o que funciona para o seu produto.',
    '💡 As combinações vencedoras viram a base da estratégia de performance de longo prazo.',
    '🔄 O laboratório pode ser repetido a cada trimestre para novos produtos ou fases de mercado.',
  ]
  return `
  <section class="page" style="${tone('green')}">
    <div class="page-head"><h2>Resumo do Investimento</h2><span>Visão financeira completa</span></div>
    <div class="page-body">
      <div class="total-box"><small>INVESTIMENTO TOTAL DO LABORATÓRIO</small><b>${fmtCurrency(lab.total)}</b></div>
      <h3 class="sec">Distribuição por Fase</h3>
      ${PHASES.map((p) => {
        const plan = lab[p.key]
        return plan
          ? `<div class="dist" style="${tone(p.tone)}"><div><div class="name">Fase ${p.num} — ${esc(p.name)}</div><div class="days">${p.days}</div></div><div>${plan.isStandard ? '' : '<span class="badge">Adaptado</span>'}<span class="cost">${fmtCurrency(plan.totalCost)}</span></div></div>`
          : `<div class="dist"><div><div class="name">Fase ${p.num} — ${esc(p.name)}</div><div class="days">${p.days}</div></div><span class="off">Não incluída</span></div>`
      }).join('')}
      ${lab.total < budget ? `<div class="rest"><div>Saldo restante após o laboratório<b>${fmtCurrency(budget - lab.total)}</b></div><span>(verba disponível para escalar o que for validado)</span></div>` : ''}
      <h3 class="sec">O Que Acontece Depois do Laboratório</h3>
      ${nexts.map((n) => `<div class="next">${esc(n)}</div>`).join('')}
      <div class="note">Este plano é dinâmico. Ajustes podem ser necessários conforme os dados de cada fase são coletados. Você será informado a cada decisão relevante.</div>
    </div>
    ${pageFoot(companyName, today)}
  </section>`
}

export function generateMetaLabPDF({ lab, audienceType, companyName, budget }) {
  const ctx = {
    lab, budget,
    companyName: companyName || 'Cliente',
    today: todayLong(),
    audienceLabel: AUDIENCE_LABEL[audienceType] || 'A definir',
  }
  printDocument({
    title: `Lab-Meta-Ads-${ctx.companyName.replace(/\s+/g, '-')}`,
    css: CSS,
    body: coverHtml(ctx)
      + overviewHtml(ctx)
      + PHASES.filter((p) => lab[p.key]).map((p) => phaseHtml(p, lab[p.key], ctx)).join('')
      + summaryHtml(ctx),
  })
}
