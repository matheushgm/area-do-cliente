// Agregação dos snapshots do Microsoft Clarity (tabela clarity_snapshots).
//
// Cada snapshot guarda a resposta crua da API: uma lista de métricas
// ({ metricName, information: [linhas] }) e cada linha traz os valores da
// dimensão (Url, Device, Source…) mais os números da métrica. Aqui juntamos as
// métricas pela mesma linha de dimensão e agrupamos como a tela precisa.

// Campos numéricos de métrica; todo o resto da linha é valor de dimensão.
const CAMPOS_METRICA = new Set([
  'sessionsCount', 'sessionsWithMetricPercentage', 'sessionsWithoutMetricPercentage', 'pagesViews', 'subTotal',
  'averageScrollDepth', 'totalSessionCount', 'totalBotSessionCount', 'distinctUserCount',
  'pagesPerSessionPercentage', 'totalTime', 'activeTime',
])

// Comportamentos de frustração: acumulam as sessões que tiveram o evento.
const FRUSTRACAO = {
  RageClickCount: 'rage',
  DeadClickCount: 'dead',
  QuickbackClick: 'quickback',
  ExcessiveScroll: 'excessScroll',
  ScriptErrorCount: 'jsErro',
  ErrorClickCount: 'erroClick',
}

const vazio = () => ({
  sessoes: 0, usuarios: 0, scrollPeso: 0, ativoPeso: 0, totalPeso: 0,
  rage: 0, dead: 0, quickback: 0, excessScroll: 0, jsErro: 0, erroClick: 0,
})

function chaveDimensao(info) {
  return Object.entries(info).filter(([k]) => !CAMPOS_METRICA.has(k)).map(([, v]) => v ?? '').join(' | ')
}

/** Junta as métricas do snapshot por linha de dimensão. Devolve Map<chave, acumulador>. */
export function linhasDoSnapshot(dados) {
  const mapa = new Map()
  const get = (info) => {
    const k = chaveDimensao(info)
    if (!mapa.has(k)) mapa.set(k, { chave: k, ...vazio() })
    return mapa.get(k)
  }
  // 1º as sessões (precisamos delas como peso das médias)
  for (const m of dados || []) {
    if (m.metricName !== 'Traffic') continue
    for (const info of m.information || []) {
      const r = get(info)
      r.sessoes += Math.max(0, (info.totalSessionCount || 0) - (info.totalBotSessionCount || 0))
      r.usuarios += info.distinctUserCount || 0
    }
  }
  for (const m of dados || []) {
    for (const info of m.information || []) {
      const r = get(info)
      if (m.metricName === 'ScrollDepth') r.scrollPeso += (info.averageScrollDepth || 0) * r.sessoes
      else if (m.metricName === 'EngagementTime') {
        r.ativoPeso += (info.activeTime || 0) * r.sessoes
        r.totalPeso += (info.totalTime || 0) * r.sessoes
      } else if (FRUSTRACAO[m.metricName]) {
        // sessionsCount = sessões da URL; a fatia que teve o evento vem em % (sessionsWithMetricPercentage)
        r[FRUSTRACAO[m.metricName]] += ((info.sessionsCount || 0) * (info.sessionsWithMetricPercentage || 0)) / 100
      }
    }
  }
  return mapa
}

/** Soma acumuladores e calcula os indicadores finais (scroll %, tempo ativo em s, % com rage/dead). */
export function fecharLinha(acc) {
  const s = acc.sessoes || 0
  return {
    ...acc,
    scroll: s ? acc.scrollPeso / s : null,
    tempoAtivo: s ? acc.ativoPeso / s : null,
    pctRage: s ? (acc.rage / s) * 100 : null,
    pctDead: s ? (acc.dead / s) * 100 : null,
    pctQuickback: s ? (acc.quickback / s) * 100 : null,
  }
}

function somar(a, b) {
  const out = { ...a }
  for (const k of Object.keys(vazio())) out[k] = (a[k] || 0) + (b[k] || 0)
  return out
}

/** Agrupa as linhas por uma função de chave (ex.: utm_content). Ordena por sessões. */
export function agrupar(mapa, keyFn) {
  const grupos = new Map()
  for (const r of mapa.values()) {
    const k = keyFn(r.chave)
    grupos.set(k, grupos.has(k) ? somar(grupos.get(k), r) : { ...r, chave: k })
  }
  return [...grupos.values()].map(fecharLinha).sort((a, b) => b.sessoes - a.sessoes)
}

export function totalGeral(mapa) {
  let acc = { chave: 'total', ...vazio() }
  for (const r of mapa.values()) acc = somar(acc, r)
  return fecharLinha(acc)
}

// ── Chaves de agrupamento a partir da URL ────────────────────────────────────
function paramsDe(url) {
  try { return new URL(url).searchParams } catch { return new URLSearchParams() }
}

export function porPagina(url) {
  try { const u = new URL(url); return `${u.hostname}${u.pathname === '/' ? '' : u.pathname}` } catch { return url || '(sem URL)' }
}
export const porAnuncio = (url) => paramsDe(url).get('utm_content') || '(sem utm_content)'
export const porCampanha = (url) => paramsDe(url).get('utm_campaign') || '(sem utm_campaign)'

/** Formata segundos como "1m 05s". */
export function fmtSeg(s) {
  if (s == null) return '–'
  const t = Math.round(s)
  return t >= 60 ? `${Math.floor(t / 60)}m ${String(t % 60).padStart(2, '0')}s` : `${t}s`
}
