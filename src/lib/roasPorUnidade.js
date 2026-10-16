import { CFG, num, fmtDate, inRange } from './dashboardData'
import { ANUNCIOS_POR_UNIDADE } from './constants'

const CAMP_KEY  = { meta: 'Nome da campanha', google: 'Campanha' }
const pad = n => String(n).padStart(2, '0')

// Investimento (soma crua do dashboard, sem recompor imposto) do mês por unidade.
// `month` é 0-based. Devolve null quando o projeto não tem mapeamento de anúncios.
// `total` soma TODAS as contas vinculadas (inclusive campanhas sem unidade), que
// é o denominador do ROAS geral.
export function investimentoPorUnidade(raw, projectId, unidades, year, month) {
  const mapa = ANUNCIOS_POR_UNIDADE[projectId]
  if (!mapa || !raw) return null
  const from = `${year}-${pad(month + 1)}-01`
  const to   = `${year}-${pad(month + 1)}-${pad(new Date(year, month + 1, 0).getDate())}`

  const porUnidade = Object.fromEntries(unidades.map(u => [u.id, { meta: 0, google: 0, total: 0 }]))
  let total = 0
  for (const ch of ['meta', 'google']) {
    const { accountKey, dateKey, spendKey } = CFG[ch]
    for (const r of raw[ch] || []) {
      if (!inRange(fmtDate(r[dateKey]), from, to)) continue
      const v = num(r[spendKey])
      if (!v) continue
      total += v
      const conta = r[accountKey]?.trim()
      const camp  = (r[CAMP_KEY[ch]] || '').trim()
      const u = unidades.find(x => {
        const m = mapa[x.id]
        if (!m) return false
        return ch === 'meta' ? m.meta?.test(camp) : (m.google || []).includes(conta)
      })
      if (u) { porUnidade[u.id][ch] += v; porUnidade[u.id].total += v }
    }
  }
  return { porUnidade, total }
}
