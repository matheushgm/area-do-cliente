// ─────────────────────────────────────────────────────────────────────────────
// Dashboard de Tráfego — funções puras de dados.
//
// Portado do index.html standalone (projeto dashboard-trafego). Toda a lógica
// que antes lia variáveis globais mutáveis (clientMapping, cplTargets,
// acCompanyList, squads) foi reescrita para receber esses dados como
// PARÂMETROS, mantendo as funções puras e desacopladas do estado React.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Fontes (planilhas Google publicadas como CSV) ───────────────────────────
export const SHEETS = {
  meta:   'https://docs.google.com/spreadsheets/d/1XRK8rrCj8-szehrY_i_dcR7UkB7KTb1jc5gy3rKVfxg/gviz/tq?tqx=out:csv&gid=258011907',
  google: 'https://docs.google.com/spreadsheets/d/1IT_NXwknJM5wB4b0MyRBLCrz1XRCDXpa6A3sfIG2lp8/gviz/tq?tqx=out:csv&gid=1448343005',
}

// ─── Config de colunas por canal ─────────────────────────────────────────────
export const CFG = {
  meta:   { accountKey: 'Nome da conta', dateKey: 'Dia',  spendKey: 'Valor investido', convKeys: ['Número de conversas iniciadas no Whatsapp', 'Leads', 'Número de vendas'] },
  google: { accountKey: 'Nome da conta', dateKey: 'Data', spendKey: 'Gasto',           convKeys: ['Conversões'] },
}

// Range de combining diacritical marks — usado para remover acentos.
const COMBINING = /[̀-ͯ]/g

// ─── Normalização de strings (fuzzy match) ───────────────────────────────────
export function normStr(s) {
  return (s || '').toLowerCase().trim()
    .normalize('NFD').replace(COMBINING, '')
    .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ')
}

// ─── CSV ──────────────────────────────────────────────────────────────────────
function splitLine(line) {
  const res = []; let cur = ''; let q = false
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { q = !q }
    else if (line[i] === ',' && !q) { res.push(cur); cur = '' }
    else cur += line[i]
  }
  res.push(cur); return res
}

export function parseCSV(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim())
  if (!lines.length) return []
  const headers = splitLine(lines[0]).map(h => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map(line => {
    const vals = splitLine(line); const row = {}
    headers.forEach((h, i) => { row[h] = (vals[i] || '').trim().replace(/^"|"$/g, '') })
    return row
  }).filter(r => Object.values(r).some(v => v))
}

// ─── Parsers / formatadores ───────────────────────────────────────────────────
export function num(s) {
  if (!s || s === '-' || s === '') return 0
  s = s.replace(/R\$\s*/g, '').replace(/%/g, '').trim()
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.')
  else if (s.includes(',')) s = s.replace(',', '.')
  return parseFloat(s) || 0
}

export function fmtDate(s) {
  if (!s) return null
  s = s.trim().replace(/^"|"$/g, '')
  if (!s || s === '-') return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const sl = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (sl) { const [, d, m, y] = sl; return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` }
  const gv = s.match(/^Date\((\d+),(\d+),(\d+)\)$/)
  if (gv) { const [, y, m, d] = gv; return `${y}-${(+m + 1).toString().padStart(2, '0')}-${(+d).toString().padStart(2, '0')}` }
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(s)) return s.replace(/\//g, '-')
  return null
}

export function addDays(iso, n) {
  if (!iso) return null
  const d = new Date(iso + 'T12:00:00Z')
  if (isNaN(d.getTime())) return null
  d.setDate(d.getDate() + n); return d.toISOString().split('T')[0]
}

export function diffDays(a, b) {
  return Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000)
}

export function fmtBR(iso) { if (!iso) return ''; const [, m, d] = iso.split('-'); return `${d}/${m}` }
export function fmtMoney(n) { return n == null ? '—' : 'R$ ' + n.toFixed(2).replace('.', ',') }
export function fmtPct(n) { if (n == null) return '—'; return (n >= 0 ? '+' : '') + n.toFixed(1) + '%' }
export function fmtNum(n) { return n != null ? Math.round(n).toString() : '0' }
export function inRange(d, s, e) { return d && s && e && d >= s && d <= e }
export function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ─── Períodos (período atual vs. anterior + janelas de tendência) ─────────────
export function maxDate(rows, dateKey) {
  const dates = [...new Set(rows.map(r => fmtDate(r[dateKey])).filter(d => d && /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort()
  return dates.length ? dates[dates.length - 1] : null
}

export function buildPeriod(p1s, p1e) {
  if (!p1s || !p1e) return null
  const span = diffDays(p1s, p1e)
  const p2e = addDays(p1s, -1)
  const p2s = addDays(p2e, -span)
  const t1 = [addDays(p1e, -2), addDays(p1e, -1), p1e]
  const t0 = [addDays(p1e, -5), addDays(p1e, -4), addDays(p1e, -3)]
  return {
    p1s, p1e, p2s, p2e, t1, t0, span,
    label1: `${fmtBR(p1s)} – ${fmtBR(p1e)}`,
    label2: `${fmtBR(p2s)} – ${fmtBR(p2e)}`,
  }
}

export function periodFromDays(rows, dateKey, days) {
  const max = maxDate(rows, dateKey); if (!max) return null
  return buildPeriod(addDays(max, -(days - 1)), max)
}

// Período do filtro principal (presets today/yesterday/N dias/custom).
// Compartilhado entre a página do dashboard e o board scoped da seção Resultados.
export function computeMainPeriod(channelRows, channel, days, from, to) {
  const dateKey = CFG[channel].dateKey
  if (days === 'today') { const m = maxDate(channelRows, dateKey); return m ? buildPeriod(m, m) : null }
  if (days === 'yesterday') { const m = maxDate(channelRows, dateKey); if (!m) return null; const y = addDays(m, -1); return buildPeriod(y, y) }
  if (days === 0) return (from && to) ? buildPeriod(from, to) : null
  return periodFromDays(channelRows, dateKey, days)
}

// ─── Status / classificação ───────────────────────────────────────────────────
export function getStatus(varConv, varCpl, conv1) {
  if (conv1 === 0) return 'CRÍTICO'
  // Classificação só pelo número de conversões (CPL ignorado de propósito).
  if (varConv <= -20) return 'QUEDA'
  if (varConv >= 20) return 'MELHORA'
  return 'ESTÁVEL'
}
export function pillCls(s) { return s === 'MELHORA' ? 'pill-green' : s === 'ESTÁVEL' ? 'pill-yellow' : 'pill-red' }
export function pillIco(s) { return s === 'MELHORA' ? '🟢' : s === 'ESTÁVEL' ? '🟡' : '🔴' }
export function varCls(n, inv) { if (n == null) return 'fl'; const g = inv ? n < -5 : n > 5, b = inv ? n > 5 : n < -5; return g ? 'up' : b ? 'dn' : 'fl' }

// Classifica campanha Meta por etapa de funil pela convenção de nomenclatura.
export function classifyFunnel(campaignName) {
  const norm = (campaignName || '').toUpperCase().normalize('NFD').replace(COMBINING, '')
  if (/(^|[^A-Z])(MEIO|MOF)([^A-Z]|$)/.test(norm)) return 'meio'
  if (/(^|[^A-Z])(FUNDO|BOFU|BOF)([^A-Z]|$)/.test(norm)) return 'fundo'
  if (/(^|[^A-Z])(TOPO|TOFU|TOF|RECONHECIMENTO|BRANDING)([^A-Z]|$)/.test(norm)) return 'topo'
  return 'outro'
}

// ─── Estatísticas por cliente (núcleo do dashboard) ───────────────────────────
// Agrega linhas por conta, compara período atual (p1) vs. anterior (p2),
// calcula CPL, variações e tendência de 3 dias, e ordena por gravidade.
export function buildStats(rows, cfg, p) {
  if (!p) return []
  const { accountKey, dateKey, spendKey, convKeys } = cfg
  const byClient = {}
  rows.forEach(r => {
    const name = r[accountKey]?.trim(); const date = fmtDate(r[dateKey])
    if (!name || !date) return
    if (!byClient[name]) byClient[name] = []
    byClient[name].push({ date, spend: num(r[spendKey]), conv: convKeys.reduce((a, k) => a + num(r[k]), 0) })
  })

  const ORDER = { 'CRÍTICO': 0, 'QUEDA': 1, 'ESTÁVEL': 2, 'MELHORA': 3 }
  return Object.entries(byClient).map(([name, clientRows]) => {
    const p1r = clientRows.filter(r => inRange(r.date, p.p1s, p.p1e))
    const p2r = clientRows.filter(r => inRange(r.date, p.p2s, p.p2e))
    const day = d => clientRows.find(r => r.date === d) || { spend: 0, conv: 0 }

    const conv1 = p1r.reduce((a, r) => a + r.conv, 0)
    const conv2 = p2r.reduce((a, r) => a + r.conv, 0)
    const spend1 = p1r.reduce((a, r) => a + r.spend, 0)
    const spend2 = p2r.reduce((a, r) => a + r.spend, 0)
    const cpl1 = conv1 > 0 ? spend1 / conv1 : null
    const cpl2 = conv2 > 0 ? spend2 / conv2 : null
    const varConv = conv2 > 0 ? ((conv1 - conv2) / conv2) * 100 : (conv1 > 0 ? 100 : 0)
    const varCpl = (cpl1 && cpl2) ? ((cpl1 - cpl2) / cpl2) * 100 : null
    const varSpend = spend2 > 0 ? ((spend1 - spend2) / spend2) * 100 : 0

    const t1vals = p.t1.map(d => day(d).conv)
    const t0vals = p.t0.map(d => day(d).conv)
    const t1sum = t1vals.reduce((a, v) => a + v, 0)
    const t0sum = t0vals.reduce((a, v) => a + v, 0)
    const trendPct = t0sum > 0 ? ((t1sum - t0sum) / t0sum) * 100 : (t1sum > 0 ? 100 : 0)
    const declining3d = (t1vals[2] < t1vals[1] && t1vals[1] < t1vals[0]) || trendPct <= -25
    const trendDir = trendPct > 20 ? 'up' : trendPct < -20 ? 'dn' : 'fl'

    const chartDates = []
    for (let i = p.span; i >= 0; i--) chartDates.push(addDays(p.p1e, -i))
    const sampled = chartDates.length <= 30 ? chartDates
      : chartDates.filter((_, i) => i % Math.ceil(chartDates.length / 30) === 0 || i === chartDates.length - 1)
    const chartConv = sampled.map(d => day(d).conv)

    const status = getStatus(varConv, varCpl, conv1)
    return {
      name, conv1, conv2, spend1, spend2, cpl1, cpl2, varConv, varCpl, varSpend,
      t1vals, trendDir, declining3d, status, chartConv, chartDates: sampled,
    }
  }).sort((a, b) => ORDER[a.status] - ORDER[b.status])
}

// ─── Agrupamento genérico (drill-down de campanhas/conjuntos/anúncios) ────────
// keyFn extrai a chave de agrupamento; metrics é um mapa { nome: fn(row)→number }.
// Retorna array de grupos { key, ...somas, _rows } ordenado por conv desc.
export function groupBy(rows, keyFn, metrics) {
  const g = {}
  rows.forEach(r => {
    const k = keyFn(r); if (!k) return
    if (!g[k]) g[k] = { key: k, ...Object.fromEntries(Object.keys(metrics).map(m => [m, 0])), _rows: [] }
    g[k]._rows.push(r)
    Object.entries(metrics).forEach(([m, fn]) => { g[k][m] += fn(r) })
  })
  return Object.values(g).sort((a, b) => b.conv - a.conv)
}

// Classifica o status textual de uma campanha/anúncio em { cls, label }.
export function statusTagInfo(s) {
  if (!s) return null
  const lower = s.toLowerCase()
  if (lower.includes('ativ') || lower === 'active' || lower === 'enabled') return { cls: 'st-active', label: 'ATIVO' }
  if (lower.includes('paus') || lower === 'paused') return { cls: 'st-paused', label: 'PAUSADO' }
  return { cls: 'st-other', label: s }
}

// ─── Mensagem semanal (texto pronto para enviar ao cliente) ───────────────────
// Recomendações por campanha: CTR baixo → testar criativos; conversão baixa →
// testar landing page. Prioriza fundo > meio > topo (Meta) e gasto desc.
export function buildClientFacingSteps(rows, channel) {
  const isMeta = channel === 'meta'
  const campKey = isMeta ? 'Nome da campanha' : 'Campanha'
  const groups = groupBy(rows, r => r[campKey], {
    spend: r => isMeta ? num(r['Valor investido']) : num(r['Gasto']),
    conv: r => isMeta
      ? num(r['Número de conversas iniciadas no Whatsapp']) + num(r['Leads']) + num(r['Número de vendas'])
      : num(r['Conversões']),
    clicks: r => isMeta ? num(r['Número de cliques no link']) : (num(r['CLiques']) || num(r['Cliques'])),
    impressions: r => isMeta ? num(r['Impressões']) : (num(r['Impressões na parte superior']) || num(r['Impressões'])),
  })

  const ctrThreshold = isMeta ? 1 : 5
  const convThreshold = isMeta ? 10 : 5
  const minSpend = 50
  const minClicks = 30
  const stagePri = { fundo: 0, meio: 1, topo: 2, outro: 3 }

  const lowCtr = []
  const lowConv = []
  groups.forEach(g => {
    if (g.spend < minSpend) return
    const stage = isMeta ? classifyFunnel(g.key) : 'outro'
    const ctr = g.impressions > 0 ? (g.clicks / g.impressions) * 100 : null
    const convRate = g.clicks > 0 ? (g.conv / g.clicks) * 100 : null
    if (ctr != null && ctr < ctrThreshold) lowCtr.push({ key: g.key, ctr, spend: g.spend, stage })
    if (convRate != null && g.clicks >= minClicks && convRate < convThreshold) lowConv.push({ key: g.key, convRate, clicks: g.clicks, stage })
  })
  const sortByStage = (a, b) => (stagePri[a.stage] - stagePri[b.stage]) || (b.spend - a.spend)
  lowCtr.sort(sortByStage)
  lowConv.sort(sortByStage)

  const steps = []
  lowCtr.slice(0, 3).forEach(c => steps.push(`Precisamos testar mais criativos na campanha "${c.key}" — CTR está em ${c.ctr.toFixed(2).replace('.', ',')}% (alvo ≥ ${ctrThreshold}%).`))
  lowConv.slice(0, 3).forEach(c => steps.push(`Precisamos testar a landing page da campanha "${c.key}" — taxa de conversão está em ${c.convRate.toFixed(1).replace('.', ',')}% (alvo ≥ ${convThreshold}%).`))
  if (!steps.length) steps.push('Performance dentro do esperado — manter cadência e seguir monitorando.')
  return steps
}

// Gera a mensagem semanal completa. channelRows = RAW[channel]. Retorna
// { msg, periodLabel } ou null se não houver dados suficientes.
export function buildWeeklyMessage(channelRows, channel, client) {
  if (!channelRows?.length) return null
  const cfg = CFG[channel]
  const clientRows = channelRows.filter(r => r[cfg.accountKey]?.trim() === client)
  if (!clientRows.length) return null
  const maxD = maxDate(clientRows, cfg.dateKey)
  if (!maxD) return null
  const p1s = addDays(maxD, -6), p1e = maxD
  const p2s = addDays(maxD, -13), p2e = addDays(maxD, -7)

  const sumPeriod = (s, e) => {
    let spend = 0, conv = 0
    clientRows.forEach(r => {
      const d = fmtDate(r[cfg.dateKey])
      if (!inRange(d, s, e)) return
      if (channel === 'meta') {
        spend += num(r['Valor investido'])
        conv += num(r['Número de conversas iniciadas no Whatsapp']) + num(r['Leads']) + num(r['Número de vendas'])
      } else {
        spend += num(r['Gasto'])
        conv += num(r['Conversões'])
      }
    })
    return { spend, conv }
  }
  const cur = sumPeriod(p1s, p1e)
  const prv = sumPeriod(p2s, p2e)

  const fmtPctDiff = (c, p) => {
    if (p === 0 && c === 0) return 'sem variação (ambos zero)'
    if (p === 0) return c > 0 ? '+100% (de 0)' : '—'
    const pct = ((c - p) / p) * 100
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(1).replace('.', ',')}%`
  }
  const curCpl = cur.conv > 0 ? cur.spend / cur.conv : null
  const prvCpl = prv.conv > 0 ? prv.spend / prv.conv : null
  const fmtCpl = v => v == null ? 'sem conversões' : fmtMoney(v)
  const fmtCplDiff = (c, p) => {
    if (c == null && p == null) return 'sem conversões em ambos'
    if (p == null) return `de sem conversões para ${fmtMoney(c)}`
    if (c == null) return `de ${fmtMoney(p)} para sem conversões`
    return `${fmtMoney(p)} → ${fmtMoney(c)} (${fmtPctDiff(c, p)})`
  }

  const lastWeekRows = clientRows.filter(r => inRange(fmtDate(r[cfg.dateKey]), p1s, p1e))
  const proximos = buildClientFacingSteps(lastWeekRows, channel).map(s => `• ${s}`).join('\n')
  const canalLabel = channel === 'meta' ? 'Meta Ads' : 'Google Ads'

  const msg = `Bom dia! Segue os dados dos últimos 7 dias de ${canalLabel} (${fmtBR(p1s)} – ${fmtBR(p1e)}):

• Valor investido: ${fmtMoney(cur.spend)}
• Conversões: ${fmtNum(cur.conv)}
• Custo por conversão: ${fmtCpl(curCpl)}

Comparação com os 7 dias anteriores (${fmtBR(p2s)} – ${fmtBR(p2e)}):
   • Conversões: ${fmtNum(prv.conv)} → ${fmtNum(cur.conv)} (${fmtPctDiff(cur.conv, prv.conv)})
   • Investimento: ${fmtMoney(prv.spend)} → ${fmtMoney(cur.spend)} (${fmtPctDiff(cur.spend, prv.spend)})
   • Custo por conversão: ${fmtCplDiff(curCpl, prvCpl)}

Próximos passos:
${proximos}`

  return { msg, periodLabel: `${fmtBR(p1s)} – ${fmtBR(p1e)}` }
}
