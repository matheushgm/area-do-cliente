// Resumo semanal do projeto (aba "Resumo" do hub do cliente): KPIs dos últimos
// 7 dias, atividades do período e as grandes alterações detectadas no
// gerenciador de anúncios (Meta e Google) comparando a semana com a anterior.
// Funções puras sobre as linhas do dash_insights.
import { num, fmtDate, addDays, maxDate, CFG, googleImpr } from './dashboardData'

const META_STATUS_AD = 'Status do Aúncio'
const isPaused = (s) => /paus|inativ|off|disabled|archiv/i.test(s || '')

function convMeta(r) {
  if (r['Conversões'] != null && r['Conversões'] !== '' && r['Conversões'] !== '-') return num(r['Conversões'])
  return CFG.meta.convKeys.reduce((a, k) => a + num(r[k]), 0)
}
const spendOf = (r, ch) => num(r[ch === 'meta' ? 'Valor investido' : 'Gasto'])
const convOf = (r, ch) => (ch === 'meta' ? convMeta(r) : num(r['Conversões']))

function comData(rows, ch) {
  const k = ch === 'meta' ? 'Dia' : 'Data'
  return rows.map((r) => (r._d ? r : { ...r, _d: fmtDate(r[k]) })).filter((r) => r._d)
}

/** Janelas: últimos 7 dias (até o último dia com dado) e os 7 anteriores. */
export function janelas7d(rows, ch) {
  const norm = comData(rows, ch)
  const fim = maxDate(norm, '_d')
  if (!fim) return { atual: [], anterior: [], inicio: null, fim: null }
  const inicio = addDays(fim, -6)
  const inicioAnt = addDays(inicio, -7)
  return {
    fim, inicio,
    atual: norm.filter((r) => r._d >= inicio && r._d <= fim),
    anterior: norm.filter((r) => r._d >= inicioAnt && r._d < inicio),
  }
}

function soma(rows, ch) {
  let spend = 0, conv = 0
  for (const r of rows) { spend += spendOf(r, ch); conv += convOf(r, ch) }
  return { spend, conv, cpl: conv > 0 ? spend / conv : null }
}

const varPct = (a, b) => (b > 0 && a != null ? (a - b) / b * 100 : null)

/**
 * KPIs dos últimos 7 dias, total e por canal, com variação vs os 7 anteriores.
 * @returns {{ total, meta, google, inicio, fim }} (cada um {spend, conv, cpl, varSpend, varConv, varCpl})
 */
export function kpis7d({ meta = [], google = [] }) {
  const out = { inicio: null, fim: null }
  const tot = { spend: 0, conv: 0 }, totAnt = { spend: 0, conv: 0 }
  for (const ch of ['meta', 'google']) {
    const rows = ch === 'meta' ? meta : google
    const w = janelas7d(rows, ch)
    const a = soma(w.atual, ch), b = soma(w.anterior, ch)
    out[ch] = rows.length ? { ...a, varSpend: varPct(a.spend, b.spend), varConv: varPct(a.conv, b.conv), varCpl: varPct(a.cpl, b.cpl), inicio: w.inicio, fim: w.fim } : null
    tot.spend += a.spend; tot.conv += a.conv; totAnt.spend += b.spend; totAnt.conv += b.conv
    if (w.fim && (!out.fim || w.fim > out.fim)) { out.fim = w.fim; out.inicio = w.inicio }
  }
  const cpl = tot.conv > 0 ? tot.spend / tot.conv : null
  const cplAnt = totAnt.conv > 0 ? totAnt.spend / totAnt.conv : null
  out.total = { ...tot, cpl, varSpend: varPct(tot.spend, totAnt.spend), varConv: varPct(tot.conv, totAnt.conv), varCpl: varPct(cpl, cplAnt) }
  return out
}

function agrupar(rows, keyFn) {
  const m = new Map()
  for (const r of rows) { const k = (keyFn(r) || '').trim(); if (!k) continue; if (!m.has(k)) m.set(k, []); m.get(k).push(r) }
  return m
}
function ultimoStatus(rows) {
  let best = null
  for (const r of rows) if (!best || r._d > best._d) best = r
  return best?.[META_STATUS_AD] || ''
}
const fmtMoney = (n) => 'R$ ' + (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const fmtPct = (n) => (n >= 0 ? '+' : '') + Math.round(n) + '%'

/**
 * Grandes alterações no gerenciador nos últimos 7 dias, inferidas dos dados:
 * campanhas/anúncios novos, pausados ou que pararam de rodar, e mudanças de
 * verba (gasto da campanha variou 30%+ vs a semana anterior).
 * @returns {{ meta: Array<{tipo, texto}>, google: Array<{tipo, texto}> }}
 */
export function alteracoesGerenciador({ meta = [], google = [] }) {
  const out = { meta: [], google: [] }

  // ── Meta ────────────────────────────────────────────────────────────────
  {
    const w = janelas7d(meta, 'meta')
    const campAtual = agrupar(w.atual, (r) => r['Nome da campanha'])
    const campAnt = agrupar(w.anterior, (r) => r['Nome da campanha'])
    for (const [camp, rs] of campAtual) {
      const a = soma(rs, 'meta'), b = campAnt.has(camp) ? soma(campAnt.get(camp), 'meta') : null
      if (!b && a.spend > 0) out.meta.push({ tipo: 'nova', texto: `Campanha nova no ar: "${camp}" (${fmtMoney(a.spend)} na semana)` })
      else if (b && b.spend >= 30 && a.spend >= 30) {
        const v = varPct(a.spend, b.spend)
        if (v >= 30) out.meta.push({ tipo: 'verba', texto: `Verba da campanha "${camp}" subiu ${fmtPct(v)} (${fmtMoney(b.spend)} → ${fmtMoney(a.spend)})` })
        else if (v <= -30) out.meta.push({ tipo: 'verba', texto: `Verba da campanha "${camp}" caiu ${fmtPct(v)} (${fmtMoney(b.spend)} → ${fmtMoney(a.spend)})` })
      }
    }
    for (const [camp, rs] of campAnt) {
      if (campAtual.has(camp) && soma(campAtual.get(camp), 'meta').spend > 0) continue
      const b = soma(rs, 'meta')
      if (b.spend >= 30) out.meta.push({ tipo: 'parou', texto: `Campanha "${camp}" parou de rodar (gastava ${fmtMoney(b.spend)}/semana)` })
    }
    const adAtual = agrupar(w.atual, (r) => r['Nome do Anúncio'])
    const adAnt = agrupar(w.anterior, (r) => r['Nome do Anúncio'])
    const novos = [], pausados = []
    for (const [ad, rs] of adAtual) {
      if (!adAnt.has(ad) && soma(rs, 'meta').spend > 0) novos.push(ad)
      else if (isPaused(ultimoStatus(rs)) && !isPaused(ultimoStatus(adAnt.get(ad) || []))) pausados.push(ad)
    }
    for (const [ad, rs] of adAnt) {
      if (adAtual.has(ad)) continue
      if (soma(rs, 'meta').spend >= 20) pausados.push(ad)
    }
    if (novos.length) out.meta.push({ tipo: 'nova', texto: `${novos.length} anúncio${novos.length > 1 ? 's' : ''} novo${novos.length > 1 ? 's' : ''}: ${novos.slice(0, 4).map((n) => `"${n}"`).join(', ')}${novos.length > 4 ? ` e mais ${novos.length - 4}` : ''}` })
    if (pausados.length) out.meta.push({ tipo: 'parou', texto: `${pausados.length} anúncio${pausados.length > 1 ? 's' : ''} pausado${pausados.length > 1 ? 's' : ''} ou sem entrega: ${pausados.slice(0, 4).map((n) => `"${n}"`).join(', ')}${pausados.length > 4 ? ` e mais ${pausados.length - 4}` : ''}` })
  }

  // ── Google ──────────────────────────────────────────────────────────────
  {
    const w = janelas7d(google, 'google')
    const campAtual = agrupar(w.atual, (r) => r['Campanha'])
    const campAnt = agrupar(w.anterior, (r) => r['Campanha'])
    for (const [camp, rs] of campAtual) {
      const a = soma(rs, 'google'), b = campAnt.has(camp) ? soma(campAnt.get(camp), 'google') : null
      if (!b && a.spend > 0) out.google.push({ tipo: 'nova', texto: `Campanha nova no ar: "${camp}" (${fmtMoney(a.spend)} na semana)` })
      else if (b && b.spend >= 30 && a.spend >= 30) {
        const v = varPct(a.spend, b.spend)
        if (v >= 30) out.google.push({ tipo: 'verba', texto: `Verba da campanha "${camp}" subiu ${fmtPct(v)} (${fmtMoney(b.spend)} → ${fmtMoney(a.spend)})` })
        else if (v <= -30) out.google.push({ tipo: 'verba', texto: `Verba da campanha "${camp}" caiu ${fmtPct(v)} (${fmtMoney(b.spend)} → ${fmtMoney(a.spend)})` })
      }
      const imps = rs.reduce((s, r) => s + googleImpr(r), 0)
      if (b && b.spend >= 30 && a.spend > 0 && imps === 0) out.google.push({ tipo: 'parou', texto: `Campanha "${camp}" sem impressões na semana` })
    }
    for (const [camp, rs] of campAnt) {
      if (campAtual.has(camp) && soma(campAtual.get(camp), 'google').spend > 0) continue
      const b = soma(rs, 'google')
      if (b.spend >= 30) out.google.push({ tipo: 'parou', texto: `Campanha "${camp}" parou de rodar (gastava ${fmtMoney(b.spend)}/semana)` })
    }
  }
  return out
}
