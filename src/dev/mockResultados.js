// Dados fictícios do preview /dev/resultados (só em DEV).
// O tráfego vem de public/dash-teste/mock/*.csv (scripts/gerar_mock_dash.mjs, roda no
// predev). O funil é montado em cima dele do mesmo jeito que api/resultados-autofill.js:
// investimento e conversões por semana/dia saem do dashboard, e as vendas são lançamentos
// fictícios, como o time ou o cliente faria pelo link.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { parseCSV, num, CFG } from '../lib/dashboardData'
import { getWeekRanges, getDaysInMonth } from '../components/Resultados/resultadosHelpers'
import { getUnidades } from '../lib/constants'

export const CONTA_META = 'Aurora Odontologia'
export const CONTA_GOOGLE = 'Aurora Odontologia - Google'

// Outras contas do "workspace", pro seletor de vínculo ter o que mostrar
const OUTRAS = {
  'Padaria Trigo Bom': { canais: ['meta'] },
  'Studio Fit Prime': { canais: ['meta', 'google'], cliente: 'Studio Fit Prime' },
  'Ótica Visão Clara': { canais: ['google'] },
  'Pet Feliz Goiânia': { canais: ['meta'], cliente: 'Pet Feliz' },
  'Aurora Odontologia - Unidade 2': { canais: [] },
}

export const ID_B2B = '00000000-0000-4000-8000-00000000a0a0'
// B2C usa o id real da Boa Noite só para herdar as lojas de UNIDADES_POR_PROJETO
export const ID_B2C = 'baae1d12-5bd6-42a0-925b-9dd8ee706cd4'

// ─── Dash fictício: mesma forma que useDashboardData ────────────────────────
export function useDashMock(projectId) {
  const [linhas, setLinhas] = useState({ meta: [], google: [] })
  const [loading, setLoading] = useState(true)
  // vínculos por projeto do preview (B2B e B2C não se misturam)
  const [porProjeto, setPorProjeto] = useState({})
  const vinculos = useMemo(() => porProjeto[projectId]
    || { [CONTA_META]: projectId, [CONTA_GOOGLE]: projectId, 'Studio Fit Prime': 'outro', 'Pet Feliz Goiânia': 'outro' }, [porProjeto, projectId])
  useEffect(() => {
    Promise.all(['meta', 'google'].map((ch) => fetch(`/dash-teste/mock/${ch}.csv`)
      .then((r) => (r.ok && !/text\/html/.test(r.headers.get('content-type') || '') ? r.text() : ''))
      .then(parseCSV)))
      .then(([meta, google]) => { setLinhas({ meta, google }); setLoading(false) })
  }, [])

  const accountChannels = useMemo(() => ({
    [CONTA_META]: ['meta'], [CONTA_GOOGLE]: ['google'],
    ...Object.fromEntries(Object.entries(OUTRAS).map(([n, o]) => [n, o.canais])),
  }), [])
  const allAccountNames = useMemo(() => Object.keys(accountChannels).sort((a, b) => a.localeCompare(b, 'pt-BR')), [accountChannels])
  const accounts = useMemo(() => Object.fromEntries(allAccountNames.map((n) => {
    const pid = vinculos[n] || null
    return [n, { projectId: pid, acCompanyName: pid === projectId ? 'Aurora Odontologia' : OUTRAS[n]?.cliente || null }]
  })), [allAccountNames, vinculos, projectId])
  // como no modo por projeto: o raw só tem as contas vinculadas
  const raw = useMemo(() => {
    const minhas = new Set(allAccountNames.filter((n) => vinculos[n] === projectId))
    return {
      meta: linhas.meta.filter((r) => minhas.has((r['Nome da conta'] || '').trim())),
      google: linhas.google.filter((r) => minhas.has((r['Nome da conta'] || '').trim())),
    }
  }, [linhas, vinculos, allAccountNames, projectId])

  const linkProject = useCallback(async (nome, pid) => {
    await new Promise((r) => setTimeout(r, 300))
    setPorProjeto((p) => ({ ...p, [projectId]: { ...vinculos, [nome]: pid || null } }))
  }, [projectId, vinculos])

  return { raw, accounts, allAccountNames, accountChannels, cplTargets: {}, loading, error: null, reload: () => {}, linkProject }
}

// ─── Funil fictício ──────────────────────────────────────────────────────────
let semente = 7
const rnd = () => ((semente = (semente * 1664525 + 1013904223) % 4294967296) / 4294967296)
const pad = (n) => String(n).padStart(2, '0')

// Investimento e conversões do dia (definição do Dashboard de Tráfego)
function porDia(raw) {
  const m = new Map()
  for (const ch of ['meta', 'google']) {
    const { dateKey, spendKey, convKeys } = CFG[ch]
    for (const r of raw[ch] || []) {
      const d = r[dateKey]; if (!d) continue
      const x = m.get(d) || { investido: 0, leads: 0 }
      x.investido += num(r[spendKey])
      x.leads += convKeys.reduce((s, k) => s + num(r[k]), 0)
      m.set(d, x)
    }
  }
  return m
}
const r2 = (v) => Math.round(v * 100) / 100

function mesesDoMock() {
  const hoje = new Date()
  const atual = { y: hoje.getFullYear(), m: hoje.getMonth() }
  const ant = atual.m === 0 ? { y: atual.y - 1, m: 11 } : { y: atual.y, m: atual.m - 1 }
  return [ant, atual]
}
const ontem = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d }

export function resultadosB2B(raw) {
  semente = 7
  const dias = porDia(raw)
  const lim = ontem()
  const agora = new Date().toISOString()
  const b2b = {}
  for (const { y, m } of mesesDoMock()) {
    const key = `${y}-${pad(m + 1)}`
    b2b[key] = {}
    getWeekRanges(y, m).forEach((w, i) => {
      let investido = 0, leads = 0, diasComDado = 0, parcial = false
      for (let d = w.start; d <= w.end; d++) {
        const dt = new Date(y, m, d)
        if (dt > lim) { parcial = true; continue }
        const x = dias.get(`${key}-${pad(d)}`)
        if (x) { investido += x.investido; leads += x.leads; diasComDado++ }
      }
      if (!diasComDado) return
      leads = Math.round(leads)
      const mql = Math.round(leads * (0.38 + rnd() * 0.12))
      const sql = Math.round(mql * (0.42 + rnd() * 0.15))
      const vendas = Math.round(sql * (0.08 + rnd() * 0.06))
      // a semana em curso ainda não teve as vendas lançadas
      b2b[key][`semana${i + 1}`] = {
        investido: r2(investido), leads,
        ...(parcial ? {} : { mql, sql, vendas, receitaVendas: vendas * 4800 }),
        fonte: 'api', atualizadoEm: agora, ...(parcial ? { parcial: true } : {}),
      }
    })
  }
  return { modelo: 'b2b', b2b }
}

export function resultadosB2C(raw) {
  semente = 11
  const dias = porDia(raw)
  const lim = ontem()
  const agora = new Date().toISOString()
  const unidades = getUnidades(ID_B2C) || []
  const out = { modelo: 'b2c', b2c: {}, b2c_semanas: {}, b2c_unidades: {} }
  for (const { y, m } of mesesDoMock()) {
    const key = `${y}-${pad(m + 1)}`
    out.b2c[key] = {}; out.b2c_unidades[key] = {}; out.b2c_semanas[key] = {}
    for (let d = 1; d <= getDaysInMonth(y, m); d++) {
      if (new Date(y, m, d) > lim) break
      const x = dias.get(`${key}-${pad(d)}`) || { investido: 0, leads: 0 }
      const porLoja = {}
      let vendas = 0, valorVendas = 0
      unidades.forEach((u, i) => {
        const v = rnd() < (i < 3 ? 0.35 : 0.12) ? 1 : 0
        const valor = v ? r2(1400 + rnd() * 2600) : 0
        if (v) porLoja[u.id] = { vendas: v, valorVendas: valor }
        vendas += v; valorVendas += valor
      })
      out.b2c_unidades[key][pad(d)] = porLoja
      out.b2c[key][pad(d)] = { investido: r2(x.investido), leads: Math.round(x.leads), vendas, valorVendas: r2(valorVendas), fonte: 'api', atualizadoEm: agora }
    }
    // lançamento semanal: a soma dos dias de cada semana
    getWeekRanges(y, m).forEach((w, i) => {
      const ds = Array.from({ length: w.end - w.start + 1 }, (_, k) => out.b2c[key][pad(w.start + k)]).filter(Boolean)
      if (!ds.length) return
      const soma = (k) => r2(ds.reduce((s, x) => s + x[k], 0))
      out.b2c_semanas[key][String(i + 1)] = {
        investido: soma('investido'), leads: soma('leads'), vendas: soma('vendas'), valorVendas: soma('valorVendas'),
        fonte: 'api', atualizadoEm: agora, ...(ds.length < w.end - w.start + 1 ? { parcial: true } : {}),
      }
    })
  }
  return out
}

// Plano da Calculadora de ROI (meta contra a qual o funil compara)
export const ROI_MOCK = {
  mediaOrcamento: 7500, custoMarketing: 3000, ticketMedio: 4800, qtdCompras: 1, margemBruta: 45, roiDesejado: 150,
  taxaLead2MQL: 40, taxaMQL2SQL: 50, taxaSQL2Venda: 25,
}
