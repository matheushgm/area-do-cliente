// Modo Apresentação, aba "Otimizações": traduz o que mudou no gerenciador de
// anúncios (inferido do dash_insights) e o que o time registrou na timeline em
// categorias que um leigo entende. Funções puras.
import { num, fmtDate, addDays, diffDays, CFG, googleImpr } from './dashboardData'
import { t, localeAtual } from '../i18n'

// `label` e `porque` são getters: traduzem no idioma de agora a cada leitura, sem mudar o
// formato da constante (quem lê `c.label` continua igual).
const categoria = (id, icone) => ({
  id, icone,
  get label() { return t(`otimizacoes.leigo.categorias.${id}.label`) },
  get porque() { return t(`otimizacoes.leigo.categorias.${id}.porque`) },
})
export const CATEGORIAS = [
  categoria('orcamento', 'Wallet'),
  categoria('pausou', 'PauseCircle'),
  categoria('novoAnuncio', 'ImagePlus'),
  categoria('publico', 'Users'),
  categoria('estrutura', 'Layers'),
  categoria('outras', 'Wrench'),
]

const META_STATUS_AD = 'Status do Aúncio'
const isPaused = (s) => /paus|inativ|off|disabled|archiv/i.test(s || '')
const spendOf = (r, ch) => num(r[ch === 'meta' ? 'Valor investido' : 'Gasto'])
const brl = (n) => 'R$ ' + (n ?? 0).toLocaleString(localeAtual(), { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const varPct = (a, b) => (b > 0 ? ((a - b) / b) * 100 : null)

function janela(rows, ch, de, ate) {
  const k = ch === 'meta' ? 'Dia' : 'Data'
  const dias = diffDays(de, ate) + 1
  const deAnt = addDays(de, -dias)
  const norm = rows.map((r) => (r._d ? r : { ...r, _d: fmtDate(r[k]) })).filter((r) => r._d)
  return {
    atual: norm.filter((r) => r._d >= de && r._d <= ate),
    anterior: norm.filter((r) => r._d >= deAnt && r._d < de),
    deAnt,
  }
}

function agrupar(rows, keyFn) {
  const m = new Map()
  for (const r of rows) {
    const k = (keyFn(r) || '').trim()
    if (!k) continue
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(r)
  }
  return m
}
const soma = (rows, ch) => rows.reduce((s, r) => s + spendOf(r, ch), 0)
function ultimoStatus(rows) {
  let best = null
  for (const r of rows) if (!best || r._d > best._d) best = r
  return best?.[META_STATUS_AD] || ''
}
const lista = (nomes, max = 3) => nomes.slice(0, max).map((n) => `"${n}"`).join(', ') + (nomes.length > max ? t('otimizacoes.leigo.eMais', { n: nomes.length - max }) : '')
const L = (k, vars) => t(`otimizacoes.leigo.${k}`, vars)

/**
 * Mudanças detectadas nos dados de mídia entre [de, ate] e a janela anterior de
 * mesmo tamanho. Retorna itens { cat, canal, texto }.
 */
export function mudancasDoGerenciador({ meta = [], google = [] }, de, ate) {
  const out = []
  const add = (cat, canal, texto) => out.push({ origem: 'gerenciador', cat, canal, texto })

  // ── Meta ──────────────────────────────────────────────────────────────────
  {
    const w = janela(meta, 'meta', de, ate)
    const campAt = agrupar(w.atual, (r) => r['Nome da campanha'])
    const campAnt = agrupar(w.anterior, (r) => r['Nome da campanha'])
    for (const [camp, rs] of campAt) {
      const a = soma(rs, 'meta')
      const b = campAnt.has(camp) ? soma(campAnt.get(camp), 'meta') : null
      if (b == null && a > 0) add('estrutura', 'meta', L('meta.campanhaNova', { camp }))
      else if (b != null && b >= 30 && a >= 30) {
        const v = varPct(a, b)
        if (v >= 30) add('orcamento', 'meta', L('meta.aumentou', { camp, pct: Math.round(v), de: brl(b), para: brl(a) }))
        else if (v <= -30) add('orcamento', 'meta', L('meta.reduziu', { camp, pct: Math.round(-v), de: brl(b), para: brl(a) }))
      }
      // Conjuntos novos dentro de campanhas que já existiam
      if (b != null) {
        const conjAt = agrupar(rs, (r) => r['Conjunto de Anúncio'])
        const conjAnt = agrupar(campAnt.get(camp), (r) => r['Conjunto de Anúncio'])
        const novos = [...conjAt].filter(([n, x]) => !conjAnt.has(n) && soma(x, 'meta') > 0).map(([n]) => n)
        if (novos.length) add('publico', 'meta', L('meta.publicos', { count: novos.length, camp, lista: lista(novos) }))
      }
    }
    for (const [camp, rs] of campAnt) {
      if (campAt.has(camp) && soma(campAt.get(camp), 'meta') > 0) continue
      if (soma(rs, 'meta') >= 30) add('pausou', 'meta', L('meta.encerrou', { camp }))
    }
    const adAt = agrupar(w.atual, (r) => r['Nome do Anúncio'])
    const adAnt = agrupar(w.anterior, (r) => r['Nome do Anúncio'])
    const novos = [], pausados = []
    for (const [ad, rs] of adAt) {
      if (!adAnt.has(ad) && soma(rs, 'meta') > 0) novos.push(ad)
      else if (isPaused(ultimoStatus(rs)) && !isPaused(ultimoStatus(adAnt.get(ad) || []))) pausados.push(ad)
    }
    for (const [ad, rs] of adAnt) if (!adAt.has(ad) && soma(rs, 'meta') >= 20) pausados.push(ad)
    if (novos.length) add('novoAnuncio', 'meta', L('meta.anunciosNovos', { count: novos.length, lista: lista(novos) }))
    if (pausados.length) add('pausou', 'meta', L('meta.anunciosPausados', { count: pausados.length, lista: lista(pausados) }))
  }

  // ── Google ────────────────────────────────────────────────────────────────
  {
    const w = janela(google, 'google', de, ate)
    const campAt = agrupar(w.atual, (r) => r['Campanha'])
    const campAnt = agrupar(w.anterior, (r) => r['Campanha'])
    for (const [camp, rs] of campAt) {
      const a = soma(rs, 'google')
      const b = campAnt.has(camp) ? soma(campAnt.get(camp), 'google') : null
      if (b == null && a > 0) add('estrutura', 'google', L('google.campanhaNova', { camp }))
      else if (b != null && b >= 30 && a >= 30) {
        const v = varPct(a, b)
        if (v >= 30) add('orcamento', 'google', L('google.aumentou', { camp, pct: Math.round(v), de: brl(b), para: brl(a) }))
        else if (v <= -30) add('orcamento', 'google', L('google.reduziu', { camp, pct: Math.round(-v), de: brl(b), para: brl(a) }))
      }
      if (b != null && b >= 30 && a > 0 && rs.reduce((s, r) => s + googleImpr(r), 0) === 0) add('pausou', 'google', L('google.semAparecer', { camp }))
    }
    for (const [camp, rs] of campAnt) {
      if (campAt.has(camp) && soma(campAt.get(camp), 'google') > 0) continue
      if (soma(rs, 'google') >= 30) add('pausou', 'google', L('google.encerrou', { camp }))
    }
  }
  return out
}

/** Classifica um registro manual do time (projeto_otimizacoes) numa categoria. */
export function categoriaDoRegistro(texto) {
  const t = String(texto || '').toLowerCase()
  if (/or[çc]amento|verba|budget|invest|escal|scal/.test(t)) return 'orcamento'
  if (/paus|desativ|desligou|desligar|encerr|turn(ed)? off|stopp?ed/.test(t)) return 'pausou'
  if (/p[úu]blico|lookalike|semelhante|segmenta|interesse|audi[êe]ncia|interest/.test(t)) return 'publico'
  if (/an[úu]ncio|criativo|v[íi]deo|imagem|copy|subi|\bads?\b(?! set)|creative|image/.test(t)) return 'novoAnuncio'
  if (/campanha|conjunto|campaign|ad set/.test(t)) return 'estrutura'
  return 'outras'
}

/** Registros de otimização do time dentro do período, já como itens. */
export function mudancasRegistradas(otimizacoes, de, ate) {
  return (otimizacoes || [])
    .filter((o) => o.tipo !== 'anotacao' && o.data && o.data >= de && o.data <= ate)
    .map((o) => ({
      origem: 'time',
      cat: categoriaDoRegistro(`${o.acao} ${o.campanha || ''}`),
      canal: o.canal || 'outro',
      texto: o.acao,
      motivo: o.motivo || null,
      resultado: o.resultado || null,
      data: o.data,
    }))
}

export const CFG_REF = CFG
