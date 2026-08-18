// ─────────────────────────────────────────────────────────────────────────────
// "Puxar dados" — lê os números REAIS das contas de anúncio vinculadas ao
// projeto (mesma fonte do módulo Resultados: dash_insights via /api/dash-data)
// e devolve os valores prontos pro Planejamento de Campanhas.
//
// Duas leituras independentes:
//   1. pullMonthSpend    → gasto do mês corrente (Meta + Google) = "Já Utilizado"
//   2. pullChannelPlan   → campanhas ATIVAS de um canal + proporção de verba
//                          atual, já distribuída em topo/meio/fundo
//
// Nada aqui escreve no banco — só transforma as linhas que o useDashboardData
// já carregou.
// ─────────────────────────────────────────────────────────────────────────────
import {
  CFG, num, fmtDate, inRange, addDays, localDateStr, maxDate, classifyFunnel, normStr,
} from '../../lib/dashboardData'
import { uid, emptyStages } from './campaignHelpers'

// Mesmo imposto aplicado ao canal Meta em CampaignPlanner.jsx / ChannelRow.jsx.
const META_TAX = 0.13

// Canais do planner que têm dado no dashboard.
export const CHANNEL_KEY = { 'Meta Ads': 'meta', 'Google Ads': 'google' }
export const DATA_CHANNELS = Object.keys(CHANNEL_KEY)

const CAMP_KEY = { meta: 'Nome da campanha', google: 'Campanha' }
// Google não traz status de campanha nas planilhas/dash_insights — nesse canal
// "ativa" é inferido por gasto na janela (ver pullChannelPlan).
const STATUS_KEYS = { meta: ['Status da Campanha', ' Status da Campanha'], google: [] }

// Campanhas sem marcador de funil no nome (TOPO/MOF/BOFU…) caem aqui.
const FALLBACK_STAGE = 'topo'

// Linha sintética que o sync grava para conta que não veiculou no período —
// não é campanha e não pode entrar no planejamento.
const PLACEHOLDER = 'sem veiculacao no periodo'

function spendOf(row, channel) {
  return num(row[CFG[channel].spendKey])
}

function isActiveStatus(s) {
  const v = (s || '').toLowerCase()
  return v.includes('ativ') || v === 'active' || v === 'enabled'
}

// Linhas do canal pertencentes às contas pedidas, dentro do intervalo.
function rowsFor(raw, channel, names, from, to) {
  const { accountKey, dateKey } = CFG[channel]
  return (raw?.[channel] || []).filter((r) => {
    const n = r[accountKey]?.trim()
    if (!n || !names.has(n)) return false
    return inRange(fmtDate(r[dateKey]), from, to)
  })
}

// Distribui 100% entre `values` proporcionalmente, em INTEIROS que somam
// exatamente 100 (maior resto). O planner valida `soma === 100`, então float
// aqui quebraria a validação (33,33 + 33,33 + 33,34 ≠ 100 em ponto flutuante).
//
// `minForPositive` garante um piso para quem teve gasto: uma conta que gastou
// R$ 2,46 numa semana de R$ 1.090 arredonda para 0% e desapareceria do plano.
// O piso sai de quem tem a maior fatia, mantendo a soma em 100.
export function pctSplit(values, { minForPositive = 0 } = {}) {
  const n = values.length
  if (!n) return []
  const total = values.reduce((a, v) => a + v, 0)
  const base = total > 0 ? values.map((v) => (v / total) * 100) : values.map(() => 100 / n)
  const out = base.map((v) => Math.floor(v))
  const order = base
    .map((v, i) => [i, v - Math.floor(v)])
    .sort((a, b) => b[1] - a[1])
  let rest = 100 - out.reduce((a, v) => a + v, 0)
  for (let k = 0; rest > 0; k++, rest--) out[order[k % n][0]]++

  if (minForPositive > 0 && n * minForPositive <= 100) {
    for (let i = 0; i < n; i++) {
      if (!(values[i] > 0)) continue
      while (out[i] < minForPositive) {
        let big = -1
        for (let j = 0; j < n; j++) {
          if (out[j] > minForPositive && (big === -1 || out[j] > out[big])) big = j
        }
        if (big === -1) break
        out[big]--
        out[i]++
      }
    }
  }
  return out
}

// ─── 1. Gasto do mês corrente ────────────────────────────────────────────────

// Primeiro dia do mês corrente → hoje.
export function monthToDateRange() {
  const now = new Date()
  return [localDateStr(new Date(now.getFullYear(), now.getMonth(), 1)), localDateStr(now)]
}

/**
 * Soma o valor investido no mês corrente nas contas informadas.
 * Espelha o card "Total Investido — Meta + Google" do painel de Resultados
 * (soma crua, sem recompor imposto).
 */
export function pullMonthSpend(raw, names) {
  const [from, to] = monthToDateRange()
  const per = { meta: 0, google: 0 }
  Object.values(CHANNEL_KEY).forEach((ch) => {
    per[ch] = rowsFor(raw, ch, names, from, to).reduce((a, r) => a + spendOf(r, ch), 0)
  })
  const total = per.meta + per.google
  return { total: Math.round(total * 100) / 100, per, from, to }
}

// ─── 2. Campanhas ativas + proporção de verba ────────────────────────────────

// Janela usada pra ler "como está agora": últimos `days` dias COM DADO no canal.
export function recentRange(raw, channel, names, days = 7) {
  const { accountKey, dateKey } = CFG[channel]
  const rows = (raw?.[channel] || []).filter((r) => names.has(r[accountKey]?.trim()))
  const max = maxDate(rows, dateKey)
  if (!max) return null
  return [addDays(max, -(days - 1)), max]
}

// Gasto BRUTO do canal na janela recente — para Meta recompõe os 13% que o
// planner desconta depois, senão a fatia do Meta sairia subestimada frente ao
// Google na hora de comparar canais.
function recentGross(raw, channel, names, days) {
  const range = recentRange(raw, channel, names, days)
  if (!range) return null
  const spend = rowsFor(raw, channel, names, range[0], range[1])
    .reduce((a, r) => a + spendOf(r, channel), 0)
  if (spend <= 0) return null
  return channel === 'meta' ? spend / (1 - META_TAX) : spend
}

/**
 * Fatia (%) que um canal representa hoje, comparado aos outros canais do
 * planner que têm dado. Canal único com dado → 100%. Sem dado → null.
 */
export function pullChannelShare(raw, names, plannerChannelNames, channelName, days = 7) {
  const parts = [...new Set(plannerChannelNames)]
    .filter((n) => CHANNEL_KEY[n])
    .map((n) => ({ name: n, gross: recentGross(raw, CHANNEL_KEY[n], names, days) }))
    .filter((p) => p.gross != null)
  if (!parts.length) return null
  const idx = parts.findIndex((p) => p.name === channelName)
  if (idx === -1) return null
  const pcts = pctSplit(parts.map((p) => p.gross), { minForPositive: 1 })
  return pcts[idx]
}

/**
 * Campanhas ativas do canal, agrupadas POR CONTA DE ANÚNCIO.
 *
 * Devolve uma entrada por conta que tenha campanha ativa, com o gasto da conta
 * na janela e as campanhas já encaixadas em topo/meio/fundo.
 */
function campaignsByAccount(raw, channel, names, from, to) {
  const rows = rowsFor(raw, channel, names, from, to)
  const campKey  = CAMP_KEY[channel]
  const dateKey  = CFG[channel].dateKey
  const acctKey  = CFG[channel].accountKey

  // Agrega por conta + campanha; o status vale o da linha mais recente (o sync
  // grava o status ATUAL, mas linhas antigas podem trazer o de outro dia).
  const byAcct = new Map()
  rows.forEach((r) => {
    const acct = r[acctKey]?.trim()
    const name = (r[campKey] || '').trim()
    if (!acct || !name) return
    if (normStr(name).includes(PLACEHOLDER)) return
    if (!byAcct.has(acct)) byAcct.set(acct, new Map())
    const camps = byAcct.get(acct)
    let g = camps.get(name)
    if (!g) { g = { name, spend: 0, status: '', statusDate: '' }; camps.set(name, g) }
    g.spend += spendOf(r, channel)
    const st = STATUS_KEYS[channel].map((k) => r[k]).find((v) => v && String(v).trim())
    const d = fmtDate(r[dateKey]) || ''
    if (st && d >= g.statusDate) { g.status = String(st).trim(); g.statusDate = d }
  })

  const out = []
  let totalCount = 0
  let byStatus = false
  byAcct.forEach((camps, acct) => {
    const all = [...camps.values()]
    totalCount += all.length
    // Meta traz status → filtra pelas realmente ativas. Google não traz status →
    // "ativa" = teve gasto na janela.
    const hasStatus = all.some((c) => c.status)
    if (hasStatus) byStatus = true
    const active = hasStatus
      ? all.filter((c) => isActiveStatus(c.status))
      : all.filter((c) => c.spend > 0)
    if (!active.length) return
    out.push({ name: acct, campaigns: active, spend: active.reduce((a, c) => a + c.spend, 0) })
  })
  // Conta com mais verba primeiro — é a ordem que o gestor espera ler.
  out.sort((a, b) => b.spend - a.spend)
  return { accounts: out, totalCount, byStatus }
}

// Monta { stages, unmatched } a partir de uma lista de campanhas com gasto.
function stagesFromCampaigns(campaigns) {
  const buckets = { topo: [], meio: [], fundo: [] }
  let unmatched = 0
  campaigns.forEach((c) => {
    const stage = classifyFunnel(c.name)
    if (stage === 'outro') unmatched++
    buckets[stage === 'outro' ? FALLBACK_STAGE : stage].push(c)
  })

  // % das etapas: proporcional ao gasto de cada etapa (etapa sem campanha = 0).
  const filled = Object.keys(buckets).filter((k) => buckets[k].length > 0)
  const stagePcts = pctSplit(filled.map((k) => buckets[k].reduce((a, c) => a + c.spend, 0)), { minForPositive: 1 })

  const stages = emptyStages()
  Object.keys(buckets).forEach((k) => {
    const i = filled.indexOf(k)
    const camps = buckets[k]
    const campPcts = pctSplit(camps.map((c) => c.spend), { minForPositive: 1 })
    stages[k] = {
      percentage: i === -1 ? 0 : stagePcts[i],
      campaigns: camps.map((c, j) => ({
        id: uid(),
        name: c.name,
        percentage: campPcts[j],
        startDate: null,
        endDate: null,
      })),
    }
  })
  return { stages, unmatched }
}

/**
 * Estrutura do canal como está hoje nas contas do cliente.
 *
 * - Uma conta com campanha ativa  → mode 'flat': o funil vai direto no canal.
 * - Mais de uma conta             → mode 'accounts': o canal é subdividido por
 *   conta de anúncio, cada uma com sua fatia % do canal e seu próprio funil.
 *
 * Retorna null quando nenhuma conta do cliente tem campanha ativa no canal.
 */
export function pullChannelPlan(raw, channelName, names, days = 7) {
  const channel = CHANNEL_KEY[channelName]
  if (!channel) return null
  const range = recentRange(raw, channel, names, days)
  if (!range) return null
  const [from, to] = range

  const { accounts, totalCount, byStatus } = campaignsByAccount(raw, channel, names, from, to)
  if (!accounts.length) return null

  const activeCount = accounts.reduce((a, ac) => a + ac.campaigns.length, 0)
  const totalSpend  = accounts.reduce((a, ac) => a + ac.spend, 0)
  const base = {
    channel, from, to, totalSpend, activeCount, totalCount, byStatus,
    accountNames: accounts.map((a) => a.name),
  }

  if (accounts.length === 1) {
    const { stages, unmatched } = stagesFromCampaigns(accounts[0].campaigns)
    return { ...base, mode: 'flat', stages, unmatched }
  }

  const acctPcts = pctSplit(accounts.map((a) => a.spend), { minForPositive: 1 })
  let unmatched = 0
  const adAccounts = accounts.map((ac, i) => {
    const built = stagesFromCampaigns(ac.campaigns)
    unmatched += built.unmatched
    return { id: uid(), name: ac.name, percentage: acctPcts[i], expanded: true, stages: built.stages }
  })
  return { ...base, mode: 'accounts', adAccounts, unmatched }
}
