import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  CFG, num, fmtMoney, fmtNum, fmtPct, fmtBR, inRange, fmtDate, addDays,
  buildPeriod, periodFromDays, maxDate, buildStats, groupBy, varCls,
} from '../../lib/dashboardData'
import { cplActualCls, LineChart } from './helpers'
import { MetaCampaigns, MetaAdsets, MetaAds, GoogleCampaigns, GoogleGroups } from './DrillTables'

// ─────────────────────────────────────────────────────────────────────────────
// Página de detalhe de um cliente. Renderizada inline na rota (não mais como
// overlay full-screen). Período/filtro de campanhas são estado local; as 4 abas
// (Resultados, Campanhas, Atividades, Parâmetros) recomputam a partir de RAW.
// ─────────────────────────────────────────────────────────────────────────────

const PERIOD_PRESETS = [['Hoje', 'today'], ['Ontem', 'yesterday'], ['3d', 3], ['7d', 7], ['14d', 14], ['30d', 30], ['Custom', 0]]

function computePeriod(channelRows, channel, days, customFrom, customTo) {
  const dateKey = CFG[channel].dateKey
  if (days === 0 && customFrom && customTo) return buildPeriod(customFrom, customTo)
  if (days === 'today') { const m = maxDate(channelRows, dateKey); return m ? buildPeriod(m, m) : null }
  if (days === 'yesterday') { const m = maxDate(channelRows, dateKey); if (!m) return null; const y = addDays(m, -1); return buildPeriod(y, y) }
  return periodFromDays(channelRows, dateKey, days)
}

// ─── Insights IA (diagnóstico + plano de ação) ────────────────────────────────
function buildInsights(stats, channel, allRows, target) {
  if (!stats || !allRows.length) return null
  const s = stats, isMeta = channel === 'meta'
  const adNameKey = isMeta ? 'Nome do Anúncio' : 'Campanha'
  const adStatusKey = isMeta ? 'Status do Aúncio' : null
  const groups = groupBy(allRows, r => r[adNameKey], {
    spend: r => isMeta ? num(r['Valor investido']) : num(r['Gasto']),
    conv: r => isMeta ? (num(r['Número de conversas iniciadas no Whatsapp']) + num(r['Leads']) + num(r['Número de vendas'])) : num(r['Conversões']),
    clicks: r => isMeta ? num(r['Número de cliques no link']) : (num(r['CLiques']) || num(r['Cliques'])),
    impressions: r => isMeta ? num(r['Impressões']) : num(r['Impressões na parte superior']),
  })
  const wasters = groups.filter(g => {
    if (g.conv > 0 || g.spend < 35) return false
    if (!isMeta) return true
    return !(g._rows[0]?.[adStatusKey] || '').toLowerCase().includes('paus')
  }).sort((a, b) => b.spend - a.spend).slice(0, 3)
  const totalWaste = wasters.reduce((a, g) => a + g.spend, 0)
  const performers = groups.filter(g => g.conv > 0).map(g => ({ ...g, cpl: g.spend / g.conv }))
  const topPerformer = performers.length ? performers.sort((a, b) => a.cpl - b.cpl)[0] : null
  const totalClicks = groups.reduce((a, g) => a + g.clicks, 0)
  const totalImps = groups.reduce((a, g) => a + g.impressions, 0)
  const totalConv = groups.reduce((a, g) => a + g.conv, 0)
  const aggCtr = totalImps > 0 ? totalClicks / totalImps * 100 : null
  const aggConvRate = totalClicks > 0 ? totalConv / totalClicks * 100 : null
  const benchCtr = isMeta ? 1 : 5
  const ctrBad = aggCtr != null && aggCtr < (isMeta ? 0.5 : 2)
  const convRateBad = aggConvRate != null && aggConvRate < (isMeta ? 20 : 5)
  const overTarget = target && s.cpl1 && s.cpl1 > target.value
  const overTargetPct = overTarget ? ((s.cpl1 - target.value) / target.value * 100) : 0

  let diagnosis
  if (s.status === 'CRÍTICO') diagnosis = '🔴 CRÍTICO: 0 conversões no período. Conta praticamente parada — investigar urgentemente.'
  else if (s.status === 'QUEDA') {
    const parts = []
    if (s.varConv < -10) parts.push(`conversões caíram ${Math.abs(s.varConv).toFixed(0)}%`)
    if (s.varCpl != null && s.varCpl > 15) parts.push(`CPL subiu ${s.varCpl.toFixed(0)}%`)
    diagnosis = `🔴 QUEDA: ${parts.join(' e ') || 'piora detectada'} vs período anterior.`
  } else if (s.status === 'MELHORA') {
    const parts = []
    if (s.varConv > 10) parts.push(`conversões subiram ${s.varConv.toFixed(0)}%`)
    if (s.varCpl != null && s.varCpl < -10) parts.push(`CPL caiu ${Math.abs(s.varCpl).toFixed(0)}%`)
    diagnosis = `🟢 MELHORA: ${parts.join(' e ') || 'evolução positiva'} vs período anterior.`
  } else diagnosis = '🟡 ESTÁVEL: variações dentro da normalidade.'
  if (s.declining3d && s.status !== 'CRÍTICO') diagnosis += ' ⚠️ Tendência negativa nos últimos 3 dias.'

  const plan = []
  if (wasters.length) plan.push({ level: 'URGENTE', action: `Pausar ${wasters.length} ${isMeta ? 'anúncio(s)' : 'campanha(s)'} sem conversão — economiza R$ ${totalWaste.toFixed(2)}` })
  if (s.declining3d && s.status !== 'CRÍTICO') plan.push({ level: 'URGENTE', action: 'Conversões em queda 3 dias seguidos — revisar criativos e segmentação imediatamente' })
  if (s.status === 'CRÍTICO') plan.push({ level: 'URGENTE', action: 'Auditar tracking, públicos e criativos — verificar se há bloqueio na entrega' })
  if (ctrBad) plan.push({ level: 'ALTA', action: `CTR ${aggCtr.toFixed(2)}% bem abaixo do benchmark (${benchCtr}%) — renovar criativos e copy` })
  if (convRateBad) plan.push({ level: 'ALTA', action: `Taxa de conversão ${aggConvRate.toFixed(1)}% baixa — revisar landing page / oferta / qualidade do lead` })
  if (overTarget && overTargetPct > 30) plan.push({ level: 'ALTA', action: `CPL ${overTargetPct.toFixed(0)}% acima do alvo (R$ ${target.value}) — diagnosticar causa raiz` })
  if (topPerformer && target && topPerformer.cpl < target.value * 0.8) plan.push({ level: 'MÉDIA', action: `Escalar "${topPerformer.key}" — CPL R$ ${topPerformer.cpl.toFixed(2)} (${((target.value - topPerformer.cpl) / target.value * 100).toFixed(0)}% abaixo do alvo)` })
  if (s.varConv >= 20) plan.push({ level: 'MÉDIA', action: `Conversões subiram ${s.varConv.toFixed(0)}% — entender o que mudou e replicar` })
  if (!plan.length) plan.push({ level: 'MÉDIA', action: 'Performance estável — manter monitoramento e testar novos criativos' })

  return { diagnosis, wasters, totalWaste, topPerformer, aggCtr, aggConvRate, benchCtr, plan, target, overTarget, overTargetPct, isMeta }
}

function InsightsCard({ ins, periodLabel, cpl1 }) {
  if (!ins) return null
  const priCls = { 'URGENTE': 'ins-pri-urgent', 'ALTA': 'ins-pri-high', 'MÉDIA': 'ins-pri-med' }
  const ctrThreshold = ins.isMeta ? 1 : 5
  const convThreshold = ins.isMeta ? 20 : 5
  return (
    <div className="ins-card">
      <div className="ins-header"><span className="ins-icon">🤖</span><span className="ins-title">Análise IA — Revenue Lab</span><span className="ins-meta">{periodLabel}</span></div>
      <div className="ins-diag">{ins.diagnosis}</div>
      <div className="ins-plan">
        <div className="ins-plan-title">🎯 Plano de ação</div>
        {ins.plan.map((p, i) => (
          <div key={i} className={`ins-plan-row ${priCls[p.level]}`}><span className="ins-plan-pri">{p.level}</span><span className="ins-plan-action">{p.action}</span></div>
        ))}
      </div>
      <div className="ins-grid" style={{ marginTop: 14, marginBottom: 0 }}>
        {ins.wasters.length > 0 && (
          <div className="ins-section">
            <div className="ins-section-title">🚨 Torrando dinheiro</div>
            <div className="ins-section-sub">R$ {ins.totalWaste.toFixed(2)} desperdiçados em {ins.wasters.length} {ins.isMeta ? 'anúncio(s)' : 'campanha(s)'}</div>
            {ins.wasters.map(w => <div key={w.key} className="ins-item"><span className="ins-item-name" title={w.key}>{w.key}</span><span className="ins-item-val ins-bad">R$ {w.spend.toFixed(2)}</span></div>)}
          </div>
        )}
        {ins.topPerformer && (
          <div className="ins-section">
            <div className="ins-section-title">🏆 Top performer</div>
            <div className="ins-section-sub">Menor CPL com conversão</div>
            <div className="ins-item"><span className="ins-item-name" title={ins.topPerformer.key}>{ins.topPerformer.key}</span><span className="ins-item-val ins-good">CPL R$ {ins.topPerformer.cpl.toFixed(2)}</span></div>
            <div className="ins-item"><span className="ins-item-name">Conversões</span><span className="ins-item-val">{fmtNum(ins.topPerformer.conv)}</span></div>
          </div>
        )}
        <div className="ins-section">
          <div className="ins-section-title">📊 Benchmarks</div>
          <div className="ins-section-sub">vs Revenue Lab</div>
          {ins.aggCtr != null && <div className="ins-item"><span className="ins-item-name">CTR {ins.isMeta ? 'Link' : 'Search'}</span><span className={`ins-item-val ${ins.aggCtr >= ctrThreshold ? 'ins-good' : ins.aggCtr < ctrThreshold * 0.5 ? 'ins-bad' : 'ins-warn'}`}>{ins.aggCtr.toFixed(2)}% (alvo ≥{ctrThreshold}%)</span></div>}
          {ins.aggConvRate != null && <div className="ins-item"><span className="ins-item-name">Tx. conversão</span><span className={`ins-item-val ${ins.aggConvRate >= convThreshold ? 'ins-good' : 'ins-warn'}`}>{ins.aggConvRate.toFixed(1)}%</span></div>}
          {ins.target && <div className="ins-item"><span className="ins-item-name">CPL vs alvo</span><span className={`ins-item-val ${!ins.overTarget ? 'ins-good' : ins.overTargetPct > 30 ? 'ins-bad' : 'ins-warn'}`}>{cpl1 ? fmtMoney(cpl1) : '—'}{ins.overTarget ? ` (+${ins.overTargetPct.toFixed(0)}%)` : ''}</span></div>}
        </div>
      </div>
    </div>
  )
}

// ─── Métricas agregadas (Custos / Engajamento / Performance) ──────────────────
function aggMetrics(rows, isMeta) {
  if (isMeta) {
    const spend = rows.reduce((a, r) => a + num(r['Valor investido']), 0)
    const impressions = rows.reduce((a, r) => a + num(r['Impressões']), 0)
    const clicks = rows.reduce((a, r) => a + num(r['Número de cliques no link']), 0)
    const conv = rows.reduce((a, r) => a + CFG.meta.convKeys.reduce((b, k) => b + num(r[k]), 0), 0)
    const fRows = rows.filter(r => num(r['Frequência']) > 0 && num(r['Impressões']) > 0)
    const fImps = fRows.reduce((a, r) => a + num(r['Impressões']), 0)
    const frequency = fImps > 0 ? fRows.reduce((a, r) => a + num(r['Frequência']) * num(r['Impressões']), 0) / fImps : null
    return { spend, impressions, clicks, conv, cpm: impressions > 0 ? (spend / impressions) * 1000 : null, ctr: impressions > 0 ? (clicks / impressions) * 100 : null, cpl: conv > 0 ? spend / conv : null, convRate: clicks > 0 ? (conv / clicks) * 100 : null, frequency }
  }
  const spend = rows.reduce((a, r) => a + num(r['Gasto']), 0)
  const clicks = rows.reduce((a, r) => a + (num(r['CLiques']) || num(r['Cliques'])), 0)
  const conv = rows.reduce((a, r) => a + num(r['Conversões']), 0)
  const impressions = rows.reduce((a, r) => a + (num(r['Impressões na parte superior']) || num(r['Impressões'])), 0)
  return { spend, impressions, clicks, conv, cpc: clicks > 0 ? spend / clicks : null, cpm: impressions > 0 ? (spend / impressions) * 1000 : null, ctr: impressions > 0 ? (clicks / impressions) * 100 : null, cpl: conv > 0 ? spend / conv : null, convRate: clicks > 0 ? (conv / clicks) * 100 : null }
}
function pctVar(cur, prev) {
  if (cur == null && prev == null) return null
  if (prev == null || prev === 0) return (cur != null && cur > 0) ? 100 : null
  if (cur == null) return -100
  return ((cur - prev) / prev) * 100
}
function MetricTile({ label, value, variance, inverted }) {
  const arrow = variance == null ? '' : variance > 0.05 ? '▲' : variance < -0.05 ? '▼' : '•'
  const cls = variance == null ? 'fl' : varCls(variance, inverted)
  return (
    <div className="mg-tile">
      <div className="mg-tile-label">{label}</div>
      <div className="mg-tile-value">{value}</div>
      <div className={`mg-tile-var ${cls}`}><span className="mg-arrow">{arrow}</span>{variance == null ? '—' : fmtPct(variance)}</div>
    </div>
  )
}
function MetricGroups({ allRows, prevRows, isMeta }) {
  if (!allRows.length) return null
  const cur = aggMetrics(allRows, isMeta), prv = aggMetrics(prevRows, isMeta)
  const fmtInt = n => n != null ? Math.round(n).toLocaleString('pt-BR') : '—'
  const fmtPctVal = n => n != null ? n.toFixed(1).replace('.', ',') + '%' : '—'
  const fmtFreq = n => n != null ? n.toFixed(2).replace('.', ',') : '—'
  return (
    <div className="mg-grid">
      <div className="mg-card mg-cost"><h4 className="mg-title">Custos</h4><div className="mg-tiles">
        <MetricTile label="Gasto" value={fmtMoney(cur.spend)} variance={pctVar(cur.spend, prv.spend)} inverted={false} />
        {isMeta
          ? <MetricTile label="Frequência" value={fmtFreq(cur.frequency)} variance={pctVar(cur.frequency, prv.frequency)} inverted />
          : <MetricTile label="CPC" value={fmtMoney(cur.cpc)} variance={pctVar(cur.cpc, prv.cpc)} inverted />}
        <MetricTile label="CPM" value={fmtMoney(cur.cpm)} variance={pctVar(cur.cpm, prv.cpm)} inverted />
      </div></div>
      <div className="mg-card mg-eng"><h4 className="mg-title">Engajamento</h4><div className="mg-tiles">
        <MetricTile label="CTR" value={fmtPctVal(cur.ctr)} variance={pctVar(cur.ctr, prv.ctr)} inverted={false} />
        <MetricTile label="Cliques" value={fmtInt(cur.clicks)} variance={pctVar(cur.clicks, prv.clicks)} inverted={false} />
        <MetricTile label="Impressões" value={fmtInt(cur.impressions)} variance={pctVar(cur.impressions, prv.impressions)} inverted={false} />
      </div></div>
      <div className="mg-card mg-perf"><h4 className="mg-title">Performance</h4><div className="mg-tiles">
        <MetricTile label="Conversões" value={fmtInt(cur.conv)} variance={pctVar(cur.conv, prv.conv)} inverted={false} />
        <MetricTile label={isMeta ? 'CPL' : 'CPA'} value={fmtMoney(cur.cpl)} variance={pctVar(cur.cpl, prv.cpl)} inverted />
        <MetricTile label="Taxa de conv." value={fmtPctVal(cur.convRate)} variance={pctVar(cur.convRate, prv.convRate)} inverted={false} />
      </div></div>
    </div>
  )
}

// ─── Charts (investimento + conversões: atual vs anterior) ────────────────────
const chartBaseOptions = (yFmt) => ({
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#334155', font: { size: 10 } } }, tooltip: { mode: 'index', intersect: false } },
  scales: {
    x: { ticks: { color: '#64748B', font: { size: 9 }, maxRotation: 45 }, grid: { color: '#E4EAF7' } },
    y: { ticks: { color: '#64748B', font: { size: 9 }, callback: yFmt }, grid: { color: '#E4EAF7' }, beginAtZero: true },
  },
})

function ResultadosTab({ stats, period, allRows, prevRows, channel }) {
  const isMeta = channel === 'meta'
  const chartData = useMemo(() => {
    const days = [], spends = [], convs = [], spendsPrev = [], convsPrev = []
    const spendKey = isMeta ? 'Valor investido' : 'Gasto'
    const sumDay = (rows, d) => {
      const dr = rows.filter(r => fmtDate(r[CFG[channel].dateKey]) === d)
      return { spend: dr.reduce((a, r) => a + num(r[spendKey]), 0), conv: dr.reduce((a, r) => a + CFG[channel].convKeys.reduce((b, k) => b + num(r[k]), 0), 0) }
    }
    for (let i = period.span; i >= 0; i--) {
      const d = addDays(period.p1e, -i), dPrev = addDays(period.p2e, -i)
      const c = sumDay(allRows, d), pv = sumDay(prevRows, dPrev)
      days.push(fmtBR(d))
      spends.push(parseFloat(c.spend.toFixed(2))); convs.push(c.conv)
      spendsPrev.push(parseFloat(pv.spend.toFixed(2))); convsPrev.push(pv.conv)
    }
    return {
      line: { labels: days, datasets: [
        { label: 'Atual (R$)', data: spends, borderColor: '#D97706', backgroundColor: 'rgba(217,119,6,0.12)', tension: 0.35, fill: true, pointRadius: 2, pointHoverRadius: 5, order: 1 },
        { label: 'Anterior (R$)', data: spendsPrev, borderColor: '#94A3B8', backgroundColor: 'transparent', borderDash: [5, 4], tension: 0.35, fill: false, pointRadius: 0, pointHoverRadius: 4, borderWidth: 1.5, order: 2 },
      ] },
      bar: { labels: days, datasets: [
        { label: 'Atual', data: convs, borderColor: '#2563EB', backgroundColor: 'rgba(37,99,235,0.12)', tension: 0.35, fill: true, pointRadius: 2, pointHoverRadius: 5, order: 1 },
        { label: 'Anterior', data: convsPrev, borderColor: '#94A3B8', backgroundColor: 'transparent', borderDash: [5, 4], tension: 0.35, fill: false, pointRadius: 0, pointHoverRadius: 4, borderWidth: 1.5, order: 2 },
      ] },
    }
  }, [period, allRows, prevRows, channel, isMeta])

  if (!stats) return <div className="empty">Sem dados no período.</div>
  const s = stats
  const target = s.__target
  return (
    <div className="cp-panel">
      <MetricGroups allRows={allRows} prevRows={prevRows} isMeta={isMeta} />
      <div className="cp-charts">
        <div className="cp-chart-card"><h4>Investimento ao longo do período</h4><div className="cp-chart-canvas"><LineChart data={chartData.line} options={chartBaseOptions(v => 'R$' + v.toFixed(0))} /></div></div>
        <div className="cp-chart-card"><h4>Conversões ao longo do período</h4><div className="cp-chart-canvas"><LineChart data={chartData.bar} options={chartBaseOptions(v => v)} /></div></div>
      </div>
      <div className="table-wrap"><table>
        <thead><tr><th>Período</th><th>Conversões</th><th>Investimento</th><th>CPL / CPA</th><th>Var. Conv.</th><th>Var. CPL</th><th>Var. Invest.</th></tr></thead>
        <tbody>
          <tr>
            <td><b>{period.label1}</b> (atual)</td>
            <td>{fmtNum(s.conv1)}</td><td>{fmtMoney(s.spend1)}</td>
            <td className={cplActualCls(s.cpl1, target)}>{fmtMoney(s.cpl1)}</td>
            <td>—</td><td>—</td><td>—</td>
          </tr>
          <tr>
            <td>{period.label2} (anterior)</td>
            <td>{fmtNum(s.conv2)}</td><td>{fmtMoney(s.spend2)}</td><td>{fmtMoney(s.cpl2)}</td>
            <td className={varCls(s.varConv, false)}>{fmtPct(s.varConv)}</td>
            <td className={varCls(s.varCpl, true)}>{fmtPct(s.varCpl)}</td>
            <td className={varCls(s.varSpend, false)}>{fmtPct(s.varSpend)}</td>
          </tr>
        </tbody>
      </table></div>
    </div>
  )
}

function CampaignsTab({ allRows, channel, stats, target, periodLabel, onPreview, shared }) {
  const isMeta = channel === 'meta'
  const [sub, setSub] = useState(0)
  const [campaign, setCampaign] = useState(null)
  const [adset, setAdset] = useState(null)
  const ins = useMemo(() => buildInsights(stats, channel, allRows, target), [stats, channel, allRows, target])

  // Drill dentro da aba.
  if (campaign || adset) {
    let body
    if (isMeta && adset) body = <MetaAds rows={allRows.filter(r => r['Conjunto de Anúncio'] === adset)} onPreview={onPreview} />
    else if (isMeta) body = <MetaAdsets rows={allRows.filter(r => r['Nome da campanha'] === campaign)} onDrillAdset={setAdset} />
    else body = <GoogleGroups rows={allRows.filter(r => r['Campanha'] === campaign)} />
    return (
      <div className="cp-panel">
        <div className="breadcrumb">
          <button className="bc-back" style={{ marginRight: 4 }} onClick={() => (adset ? setAdset(null) : setCampaign(null))}>← Voltar</button>
          <span className="bc-item" onClick={() => { setCampaign(null); setAdset(null) }}>Campanhas</span>
          <span className="bc-sep">›</span>
          {adset ? <><span className="bc-item" onClick={() => setAdset(null)}>{campaign}</span><span className="bc-sep">›</span><span className="bc-current">{adset}</span></> : <span className="bc-current">{campaign}</span>}
        </div>
        {body}
      </div>
    )
  }

  const tabs = isMeta ? [['📊 Campanhas', 0], ['🎯 Conjuntos', 1], ['🎨 Anúncios', 2]] : [['📊 Campanhas', 0], ['🔑 Grupos', 1]]
  let panel
  if (isMeta) panel = sub === 1 ? <MetaAdsets rows={allRows} onDrillAdset={setAdset} /> : sub === 2 ? <MetaAds rows={allRows} onPreview={onPreview} /> : <MetaCampaigns rows={allRows} onDrillCampaign={setCampaign} />
  else panel = sub === 1 ? <GoogleGroups rows={allRows} /> : <GoogleCampaigns rows={allRows} onDrillCampaign={setCampaign} />

  if (!allRows.length) return <div className="cp-panel"><div className="empty">Sem dados no período.</div></div>
  return (
    <div className="cp-panel">
      {!shared && <InsightsCard ins={ins} periodLabel={periodLabel} cpl1={stats?.cpl1} />}
      <div style={{ display: 'flex', borderBottom: '1px solid #D8E0F0', margin: '0 -22px 18px', padding: '0 22px', background: '#FFFFFF' }}>
        {tabs.map(([label, idx]) => <div key={idx} className={`dtab${sub === idx ? ' active' : ''}`} onClick={() => setSub(idx)}>{label}</div>)}
      </div>
      {panel}
    </div>
  )
}

// Fetch do proxy ClickUp que detecta quando /api NÃO está sendo servido — caso
// típico de rodar `npm run dev` (Vite puro) em vez de `vercel dev`: o Vite
// responde o HTML do SPA (fallback) em vez de JSON, e um JSON.parse falharia com
// um erro críptico ("Unexpected token '<'"). Aqui trocamos por algo acionável.
async function fetchClickupJson(url) {
  const res = await fetch(url)
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch {
    throw new Error('A API de atividades não está disponível neste ambiente. Rode o app com `vercel dev` (porta 3000) — `npm run dev` não serve as rotas /api.')
  }
  if (!res.ok) throw new Error(data?.error || `Erro HTTP ${res.status}`)
  if (data.err) throw new Error(data.err)
  return data
}

function AtividadesTab({ client, folderId, onOpenCuMap }) {
  const [state, setState] = useState({ loading: true, error: null, data: null })

  useEffect(() => {
    if (!folderId) { setState({ loading: false, error: null, data: null }); return }
    let alive = true
    setState({ loading: true, error: null, data: null })
    ;(async () => {
      try {
        const listsData = await fetchClickupJson(`/api/clickup-proxy?path=folder/${folderId}/list`)
        const lists = listsData.lists || []
        const geral = lists.find(l => l.name?.toLowerCase() === 'geral') || lists[0]
        if (!geral) { if (alive) setState({ loading: false, error: null, data: { noGeral: true, lists } }); return }
        const tasksData = await fetchClickupJson(`/api/clickup-proxy?path=list/${geral.id}/task&subtasks=true&include_closed=true&page=0`)
        if (alive) setState({ loading: false, error: null, data: { tasks: tasksData.tasks || [], geral } })
      } catch (err) {
        if (alive) setState({ loading: false, error: err.message, data: null })
      }
    })()
    return () => { alive = false }
  }, [folderId, client])

  if (!folderId) {
    return (
      <div className="cp-panel"><div className="empty" style={{ padding: '32px 20px' }}>
        <div style={{ marginBottom: 14, fontSize: 14 }}>Nenhuma pasta ClickUp vinculada a este cliente.</div>
        <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 16 }}>Tente vincular manualmente ou verifique se o nome está correto.</div>
        <button className="cu-link-btn" onClick={() => onOpenCuMap(client)}>🔗 Vincular pasta ClickUp</button>
      </div></div>
    )
  }
  if (state.loading) return <div className="cp-panel"><div className="empty"><div className="spinner" style={{ margin: '0 auto 12px' }} /><p>Carregando atividades do ClickUp…</p></div></div>
  if (state.error) return <div className="cp-panel"><div className="error-box">⚠️ Erro ao carregar atividades: {state.error}</div><div style={{ marginTop: 12 }}><button className="cu-link-btn" onClick={() => onOpenCuMap(client)}>🔗 Vincular pasta diferente</button></div></div>
  if (state.data?.noGeral) return <div className="cp-panel"><div className="empty">Lista "Geral" não encontrada nesta pasta ClickUp.<br /><small>Pastas disponíveis: {state.data.lists.map(l => l.name).join(', ')}</small></div></div>

  const { tasks, geral } = state.data
  const isClosed = t => { const st = (t.status?.status || '').toLowerCase(); return t.status?.type === 'closed' || ['complete', 'done', 'concluído', 'concluida', 'closed'].includes(st) }
  const closed = tasks.filter(isClosed)
  const open = tasks.filter(t => !isClosed(t))
  const total = tasks.length
  const pct = total > 0 ? Math.round(closed.length / total * 100) : 0
  const today = Date.now()
  const fmtDue = ts => { if (!ts) return null; const ms = parseInt(ts); const d = new Date(ms); const diff = Math.ceil((ms - today) / 86400000); return { str: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), overdue: diff < 0, diff } }

  const buckets = { atrasoMaisSemana: [], atrasoAteSemana: [], hoje: [], proximosSete: [], semData: [] }
  open.forEach(t => {
    if (!t.due_date) { buckets.semData.push(t); return }
    const diff = fmtDue(t.due_date).diff
    if (diff < -7) buckets.atrasoMaisSemana.push(t)
    else if (diff < 0) buckets.atrasoAteSemana.push(t)
    else if (diff === 0) buckets.hoje.push(t)
    else buckets.proximosSete.push(t)
  })
  const sortByDue = (a, b) => parseInt(a.due_date) - parseInt(b.due_date)
  Object.values(buckets).forEach(arr => arr.sort(sortByDue))
  const recentClosed = [...closed].sort((a, b) => parseInt(b.date_closed || b.date_updated || 0) - parseInt(a.date_closed || a.date_updated || 0)).slice(0, 10)

  const Task = ({ t }) => {
    const done = isClosed(t), due = t.due_date ? fmtDue(t.due_date) : null
    const sc = t.status?.color || '#94A3B8', sn = t.status?.status || ''
    return (
      <div className={`cu-task${done ? ' cu-task-done' : ''}`}>
        <span className="cu-check">{done ? '✅' : '⬜'}</span>
        <div className="cu-task-name">{t.name}</div>
        {sn && <span className="cu-status-badge" style={{ background: sc + '22', color: sc, border: `1px solid ${sc}44` }}>{sn}</span>}
        {due && <span className={`cu-due${due.overdue ? ' overdue' : ''}`}>{due.overdue ? '⚠️ ' : ''}{due.str}</span>}
      </div>
    )
  }
  const Bucket = ({ title, arr }) => arr.length ? <><div className="cu-section-title">{title} ({arr.length})</div>{arr.map(t => <Task key={t.id} t={t} />)}</> : null

  return (
    <div className="cp-panel">
      <div className="cu-progress-wrap">
        <div className="cu-progress-label">{closed.length} de {total} tarefas concluídas ({pct}%) — lista <b>{geral.name}</b></div>
        <div className="cu-progress"><div className="cu-progress-bar" style={{ width: pct + '%' }} /></div>
      </div>
      <div style={{ textAlign: 'right', marginBottom: 8 }}><button className="cu-link-btn" onClick={() => onOpenCuMap(client)}>🔗 Mudar pasta</button></div>
      {open.length ? (
        <>
          <Bucket title="🚨 Atraso de mais de 1 semana" arr={buckets.atrasoMaisSemana} />
          <Bucket title="⚠️ Atraso de até 7 dias" arr={buckets.atrasoAteSemana} />
          <Bucket title="📅 Hoje" arr={buckets.hoje} />
          <Bucket title="🗓️ Vencimento nos próximos 7 dias" arr={buckets.proximosSete} />
          <Bucket title="📌 Sem data definida" arr={buckets.semData} />
        </>
      ) : (
        <><div className="cu-section-title">📋 Em aberto</div><div className="cu-task"><span className="cu-check">🎉</span><div className="cu-task-name">Nenhuma tarefa em aberto!</div></div></>
      )}
      {recentClosed.length > 0 && <><div className="cu-section-title">✅ Concluídas recentes ({recentClosed.length})</div>{recentClosed.map(t => <Task key={t.id} t={t} />)}</>}
    </div>
  )
}

function ParametrosTab({ client, acName, onOpenMap }) {
  const [state, setState] = useState({ loading: true, error: null, row: null })
  useEffect(() => {
    if (!acName) { setState({ loading: false, error: null, row: null }); return }
    let alive = true
    setState({ loading: true, error: null, row: null })
    ;(async () => {
      try {
        const { data, error } = await supabase.from('roi_details_public').select('*').eq('company_name', acName).limit(1)
        if (error) throw error
        if (alive) setState({ loading: false, error: null, row: data?.[0] || null })
      } catch (err) { if (alive) setState({ loading: false, error: err.message, row: null }) }
    })()
    return () => { alive = false }
  }, [acName])

  if (!acName) return (
    <div className="cp-panel"><div className="empty" style={{ padding: '32px 20px' }}>
      <div style={{ marginBottom: 14, fontSize: 14 }}>Nenhum projeto da Área do Cliente vinculado.</div>
      <button className="map-btn" style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => onOpenMap(client)}>🔗 Vincular Área do Cliente</button>
    </div></div>
  )
  if (state.loading) return <div className="cp-panel"><div className="empty"><div className="spinner" style={{ margin: '0 auto 12px' }} /><p>Carregando parâmetros da Área do Cliente…</p></div></div>
  if (state.error) return <div className="cp-panel"><div className="error-box">⚠️ Erro ao carregar parâmetros: {state.error}</div></div>
  if (!state.row) return <div className="cp-panel"><div className="empty">Nenhum dado ROI encontrado para "<b>{acName}</b>".</div></div>

  const r = state.row
  const fmtN = v => v != null ? parseFloat(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '—'
  const fmtM = v => v != null ? 'R$ ' + parseFloat(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
  const fmtP = v => v != null ? parseFloat(v).toFixed(1) + '%' : '—'
  const Row = ({ k, v, color }) => <div className="param-row"><span className="param-key">{k}</span><span className="param-val" style={color ? { color } : undefined}>{v}</span></div>

  return (
    <div className="cp-panel">
      <div style={{ marginBottom: 16, fontSize: 12, color: '#64748B' }}>
        Projeto vinculado: <b style={{ color: '#2563EB' }}>{acName}</b>
        <button className="map-btn" style={{ marginLeft: 10 }} onClick={() => onOpenMap(client)}>✎ alterar</button>
      </div>
      <div className="param-grid">
        <div className="param-card"><div className="param-card-title">💰 Investimento</div>
          <Row k="Verba de Mídia" v={fmtM(r.media_orcamento)} /><Row k="Custo de Gestão" v={fmtM(r.custo_marketing)} /><Row k="Total" v={fmtM(r.total_investimento)} color="#2563EB" />
        </div>
        <div className="param-card"><div className="param-card-title">🎯 Funil Necessário</div>
          <Row k="Leads necessários" v={fmtN(r.leads_necessarios)} /><Row k="MQLs" v={fmtN(r.mqls_necessarios)} /><Row k="SQLs" v={fmtN(r.sqls_necessarios)} /><Row k="Vendas" v={fmtN(r.vendas_necessarias)} />
        </div>
        <div className="param-card"><div className="param-card-title">📊 Targets</div>
          <Row k="CPL Alvo" v={fmtM(r.cpl_target)} color="#059669" /><Row k="CAC" v={fmtM(r.cac)} /><Row k="ROI Desejado" v={fmtP(r.roi_desejado)} /><Row k="Margem Bruta" v={fmtP(r.margem_bruta)} /><Row k="Ticket Médio" v={fmtM(r.ticket_medio)} />
        </div>
        <div className="param-card"><div className="param-card-title">🔄 Taxas de Conversão</div>
          <Row k="Lead → MQL" v={fmtP(r.taxa_lead_mql)} /><Row k="MQL → SQL" v={fmtP(r.taxa_mql_sql)} /><Row k="SQL → Venda" v={fmtP(r.taxa_sql_venda)} /><Row k="Qtd. Compras/Cli." v={r.qtd_compras != null ? r.qtd_compras : '—'} />
        </div>
      </div>
    </div>
  )
}

export default function ClientPage({
  client, channel, raw, initialDays, initialPeriod,
  account,
  onClose, onPreview, onOpenWeekly, onShare, onOpenMap, onOpenCuMap, shared,
}) {
  const [days, setDays] = useState(initialDays)
  const [customFrom, setCustomFrom] = useState(initialPeriod?.p1s || '')
  const [customTo, setCustomTo] = useState(initialPeriod?.p1e || '')
  const [period, setPeriod] = useState(initialPeriod)
  const [campFilter, setCampFilter] = useState([])
  const [campPanelOpen, setCampPanelOpen] = useState(false)
  const [campSearch, setCampSearch] = useState('')
  const [tab, setTab] = useState('resultados')
  const campRef = useRef(null)

  const channelRows = useMemo(() => raw[channel] || [], [raw, channel])
  const target = account?.cplTarget ?? null
  const acName = account?.acCompanyName ?? null
  const folderId = account?.clickupFolderId ?? null

  // Recomputa o período quando preset/custom muda.
  const applyDays = (d) => {
    setDays(d)
    if (d === 0) return // espera "Aplicar"
    setPeriod(computePeriod(channelRows, channel, d))
  }
  const applyCustom = () => {
    if (!customFrom || !customTo || customFrom > customTo) return
    setPeriod(computePeriod(channelRows, channel, 0, customFrom, customTo))
  }

  // Fecha o dropdown de campanhas ao clicar fora.
  useEffect(() => {
    if (!campPanelOpen) return
    const onClick = e => { if (campRef.current && !campRef.current.contains(e.target)) setCampPanelOpen(false) }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [campPanelOpen])

  const campKey = channel === 'meta' ? 'Nome da campanha' : 'Campanha'
  const accountKey = CFG[channel].accountKey
  const dateKey = CFG[channel].dateKey

  // Linhas do cliente no período (respeitando filtro de campanhas) + stats.
  const { allRows, prevRows, stats } = useMemo(() => {
    if (!period) return { allRows: [], prevRows: [], stats: null }
    const campSet = campFilter.length ? new Set(campFilter) : null
    const matchesCamp = r => !campSet || campSet.has((r[campKey] || '').trim())
    const all = channelRows.filter(r => r[accountKey]?.trim() === client && inRange(fmtDate(r[dateKey]), period.p1s, period.p1e) && matchesCamp(r))
    const prev = channelRows.filter(r => r[accountKey]?.trim() === client && inRange(fmtDate(r[dateKey]), period.p2s, period.p2e) && matchesCamp(r))
    const subset = campSet ? channelRows.filter(matchesCamp) : channelRows
    const st = buildStats(subset, CFG[channel], period).find(s => s.name === client) || null
    if (st) st.__target = target
    return { allRows: all, prevRows: prev, stats: st }
  }, [channelRows, client, channel, period, campFilter, accountKey, dateKey, campKey, target])

  // Campanhas disponíveis para o filtro (por gasto desc).
  const availableCampaigns = useMemo(() => {
    if (!period) return []
    const spendKey = channel === 'meta' ? 'Valor investido' : 'Gasto'
    const map = {}
    channelRows.forEach(r => {
      if (r[accountKey]?.trim() !== client || !inRange(fmtDate(r[dateKey]), period.p1s, period.p1e)) return
      const camp = (r[campKey] || '').trim(); if (!camp) return
      if (!map[camp]) map[camp] = { name: camp, spend: 0 }
      map[camp].spend += num(r[spendKey])
    })
    return Object.values(map).sort((a, b) => b.spend - a.spend)
  }, [channelRows, client, channel, period, accountKey, dateKey, campKey])

  const toggleCamp = (name, checked) => {
    setCampFilter(prev => { const set = new Set(prev); if (checked) set.add(name); else set.delete(name); return [...set] })
  }
  const filteredCampList = campSearch ? availableCampaigns.filter(c => c.name.toLowerCase().includes(campSearch.toLowerCase())) : availableCampaigns

  const sq = account?.squad
  const delta = (target && stats?.cpl1 != null) ? ((stats.cpl1 - target.value) / target.value * 100) : null
  const dCls = delta == null ? 'fl' : delta <= 0 ? 'up' : delta <= 30 ? 'warn' : 'dn'

  return (
    <div>
      <div className="cp-header">
        {!shared && <button className="cp-back" onClick={onClose}>← Voltar</button>}
        <div className="cp-client-name">{client}</div>
        <div className="cp-badges">
          <span className="cp-channel-badge">{channel === 'meta' ? '📱 Meta Ads' : '🔍 Google Ads'}</span>
          {sq && <span className="cp-channel-badge" style={{ background: sq === 'Caça ROI' ? 'rgba(22,68,150,0.10)' : 'rgba(5,150,105,0.10)', borderColor: sq === 'Caça ROI' ? 'rgba(22,68,150,0.30)' : 'rgba(5,150,105,0.30)', color: sq === 'Caça ROI' ? '#164496' : '#059669' }}>{sq === 'Caça ROI' ? '🎯' : '🔒'} {sq}</span>}
        </div>
        {!shared && <button className="cp-weekly-btn" onClick={() => onOpenWeekly(client, channel)} title="Gerar mensagem semanal">📋 Mensagem Semanal</button>}
        {!shared && <button className="cp-share-btn" onClick={() => onShare(client, channel)} title="Copiar link compartilhável">🔗 Link</button>}
      </div>

      {/* KPI bar */}
      {stats && period && (
        <div className="cp-kpi-bar">
          <div className="cp-kpi-item"><div className="cp-kpi-label">Investido</div><div className="cp-kpi-value sum-accent">{fmtMoney(stats.spend1)}</div><div className="cp-kpi-sub">{period.label1}</div></div>
          <div className="cp-kpi-item"><div className="cp-kpi-label">{channel === 'meta' ? 'Leads / Conv.' : 'Conversões'}</div><div className="cp-kpi-value">{fmtNum(stats.conv1)}</div><div className="cp-kpi-sub">ant. {fmtNum(stats.conv2)}</div></div>
          <div className="cp-kpi-item"><div className="cp-kpi-label">CPL Real</div><div className="cp-kpi-value">{fmtMoney(stats.cpl1)}</div><div className="cp-kpi-sub">ant. {fmtMoney(stats.cpl2)}</div></div>
          <div className="cp-kpi-item"><div className="cp-kpi-label">CPL Alvo</div><div className="cp-kpi-value">{target ? fmtMoney(target.value) : '—'}</div><div className="cp-kpi-sub">{target ? target.acName : 'não vinculado'}</div></div>
          <div className="cp-kpi-item"><div className="cp-kpi-label">Δ vs Alvo</div><div className={`cp-kpi-value ${dCls}`}>{delta != null ? (delta >= 0 ? '+' : '') + delta.toFixed(1) + '%' : '—'}</div><div className="cp-kpi-sub">{delta != null ? (delta <= 0 ? '✅ dentro da meta' : '🚨 acima da meta') : 'vincular AC'}</div></div>
          <div className="cp-kpi-item"><div className="cp-kpi-label">Var. Conv.</div><div className={`cp-kpi-value ${varCls(stats.varConv, false)}`}>{fmtPct(stats.varConv)}</div><div className="cp-kpi-sub">vs período ant.</div></div>
        </div>
      )}

      {/* Period selector + campaign filter */}
      <div className="cp-period-bar">
        <span className="cp-period-label">Período</span>
        <div className="cp-period-presets">
          {PERIOD_PRESETS.map(([label, d]) => (
            <button key={String(d)} className={`cp-period-btn${days === d ? ' active' : ''}`} onClick={() => applyDays(d)}>{label}</button>
          ))}
        </div>
        {days === 0 && (
          <div className="cp-period-custom">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} />
            <button className="cp-period-apply" onClick={applyCustom}>Aplicar</button>
          </div>
        )}
        <div className="cp-camp-filter" ref={campRef}>
          <button className={`cp-camp-filter-btn${campFilter.length ? ' active' : ''}`} onClick={e => { e.stopPropagation(); setCampPanelOpen(o => !o) }}>
            🔍 Campanhas: <b>{campFilter.length === 0 ? 'todas' : campFilter.length === 1 ? '1 selecionada' : `${campFilter.length} selecionadas`}</b> <span style={{ opacity: 0.6, marginLeft: 4 }}>▾</span>
          </button>
          {campPanelOpen && (
            <div className="cp-camp-filter-panel">
              <input className="cp-camp-search" placeholder="Buscar campanha…" value={campSearch} onChange={e => setCampSearch(e.target.value)} />
              <div className="cp-camp-quick">
                <button onClick={() => setCampFilter(availableCampaigns.map(c => c.name))}>Selecionar todas</button>
                <button onClick={() => setCampFilter([])}>Limpar</button>
              </div>
              <div className="cp-camp-list">
                {filteredCampList.length === 0 ? <div className="cp-camp-list-empty">Nenhuma campanha</div> : filteredCampList.map(c => (
                  <label className="cp-camp-list-item" key={c.name}>
                    <input type="checkbox" checked={campFilter.includes(c.name)} onChange={e => toggleCamp(c.name, e.target.checked)} />
                    <span className="cp-camp-list-name" title={c.name}>{c.name}</span>
                    <span className="cp-camp-list-spend">{fmtMoney(c.spend)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <span className="cp-period-info">{period ? `${period.label1} · vs ${period.label2}` : 'Sem dados no período'}</span>
      </div>

      {/* Tabs */}
      <div className="cp-tabs">
        {[['📊 Resultados', 'resultados'], ['📋 Campanhas', 'campanhas'], ['✅ Atividades', 'atividades'], ['⚙️ Parâmetros', 'parametros']]
          .filter(([, key]) => !shared || (key !== 'atividades' && key !== 'parametros'))
          .map(([label, key]) => <div key={key} className={`cptab${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>{label}</div>)}
      </div>

      {!period ? <div className="cp-panel"><div className="empty">Sem dados no período.</div></div> : (
        <>
          {tab === 'resultados' && <ResultadosTab stats={stats} period={period} allRows={allRows} prevRows={prevRows} channel={channel} />}
          {tab === 'campanhas' && <CampaignsTab allRows={allRows} channel={channel} stats={stats} target={target} periodLabel={period.label1} onPreview={onPreview} shared={shared} />}
          {tab === 'atividades' && !shared && <AtividadesTab client={client} folderId={folderId} onOpenCuMap={onOpenCuMap} />}
          {tab === 'parametros' && !shared && <ParametrosTab client={client} acName={acName} onOpenMap={onOpenMap} />}
        </>
      )}
    </div>
  )
}
