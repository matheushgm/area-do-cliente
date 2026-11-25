// Testes A/B das landing pages: dados (Supabase, tabelas ab_*), estatística e o
// trecho de instalação do kit /ab.js. Ver migration 141 e api/ab.js.

export const STATUS_AB = ['rodando', 'rascunho', 'pausado', 'encerrado']
export const SLOTS_PADRAO = ['headline', 'subheadline', 'cta']

// Mínimo por variante para começar a ler o resultado. Abaixo disso a chance de
// vencer oscila demais e qualquer diferença pode ser sorte.
export const MIN_VISITAS = 100
export const MIN_CONVERSOES = 10
export const CHANCE_VENCEDOR = 0.95

export function novoSlug() {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  return Array.from(bytes, (b) => abc[b % abc.length]).join('')
}

// Chance em texto: nos extremos a amostragem nunca chega a 0% ou 100% de verdade.
export function fmtChance(c) {
  if (c == null) return '-'
  if (c > 0.99) return '>99%'
  if (c < 0.01) return '<1%'
  return `${Math.round(c * 100)}%`
}

export function taxa(conv, visitas) {
  return visitas > 0 ? conv / visitas : 0
}

// ── Estatística (bayesiana): chance de a variante ter taxa maior que o Original.
// Beta(conv + 1, visitas - conv + 1) para cada uma, comparadas por amostragem.
function normal() {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

// Gamma(k, 1) por Marsaglia-Tsang (k >= 1; os nossos são sempre >= 1).
function gamma(k) {
  const d = k - 1 / 3
  const c = 1 / Math.sqrt(9 * d)
  for (;;) {
    let x
    let v
    do {
      x = normal()
      v = 1 + c * x
    } while (v <= 0)
    v = v * v * v
    const u = Math.random()
    if (u < 1 - 0.0331 * x * x * x * x) return d * v
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v
  }
}

function beta(a, b) {
  const x = gamma(a)
  return x / (x + gamma(b))
}

export function chanceDeVencer(varConv, varVis, orgConv, orgVis, amostras = 20000) {
  if (varVis <= 0 || orgVis <= 0) return null
  const a1 = varConv + 1
  const b1 = Math.max(varVis - varConv, 0) + 1
  const a2 = orgConv + 1
  const b2 = Math.max(orgVis - orgConv, 0) + 1
  let ganhou = 0
  for (let i = 0; i < amostras; i++) if (beta(a1, b1) > beta(a2, b2)) ganhou++
  return ganhou / amostras
}

// Junta variantes + resumo e calcula taxa, chance de vencer e se já dá para ler.
export function analisar(variantes, resumo) {
  const porId = Object.fromEntries((resumo || []).map((r) => [r.variante_id, r]))
  const linhas = variantes.map((v) => {
    const r = porId[v.id] || {}
    const visitas = Number(r.visitas) || 0
    const conversoes = Number(r.conversoes) || 0
    return {
      ...v,
      visitas,
      impressoes: Number(r.impressoes) || 0,
      conversoes,
      conversoesLead: Number(r.conversoes_lead) || 0,
      conversoesClique: Number(r.conversoes_clique) || 0,
      taxa: taxa(conversoes, visitas),
      chance: null,
      lift: null,
    }
  })
  const original = linhas.find((l) => l.original) || linhas[0]
  for (const l of linhas) {
    if (!original || l.id === original.id) continue
    l.chance = chanceDeVencer(l.conversoes, l.visitas, original.conversoes, original.visitas)
    l.lift = original.taxa > 0 ? l.taxa / original.taxa - 1 : null
  }
  const ativas = linhas.filter((l) => !l.arquivada)
  // Entram na leitura as variantes que recebem tráfego ou já receberam (depois de
  // declarar vencedor as outras ficam com 0%, mas os números delas continuam valendo).
  const comTrafego = ativas.filter((l) => l.peso > 0 || l.visitas > 0)
  const consideradas = comTrafego.length ? comTrafego : ativas
  const progresso = consideradas.length
    ? Math.min(...consideradas.map((l) => Math.min(l.visitas / MIN_VISITAS, l.conversoes / MIN_CONVERSOES, 1)))
    : 0
  const minimoAtingido = consideradas.length > 1 && progresso >= 1

  const desafiantes = consideradas.filter((l) => original && l.id !== original.id && l.chance != null)
  const melhor = desafiantes.sort((a, b) => b.chance - a.chance)[0] || null
  let veredito = 'coletando'
  if (minimoAtingido) {
    if (melhor && melhor.chance >= CHANCE_VENCEDOR) veredito = 'variante_vence'
    else if (melhor && melhor.chance <= 1 - CHANCE_VENCEDOR) veredito = 'original_vence'
    else veredito = 'sem_vencedor'
  }

  const totais = linhas.reduce(
    (t, l) => ({
      visitas: t.visitas + l.visitas,
      impressoes: t.impressoes + l.impressoes,
      conversoes: t.conversoes + l.conversoes,
      peso: t.peso + (l.arquivada ? 0 : l.peso),
    }),
    { visitas: 0, impressoes: 0, conversoes: 0, peso: 0 },
  )
  totais.taxa = taxa(totais.conversoes, totais.visitas)

  return { linhas, original, melhor, progresso, minimoAtingido, veredito, totais }
}

// ── Instalação
export function origemDoApp() {
  return typeof window !== 'undefined' ? window.location.origin : ''
}

export function trechoScript(slug) {
  return `<script src="${origemDoApp()}/ab.js" data-e="${slug}" async></script>`
}

// URL de cada variação: o kit põe ?variacao=<código> na barra de endereço depois do sorteio, então a URL
// que o formulário manda para o banco, o n8n e o CRM diz de qual variação o lead veio (migration 143).
export const PARAM_URL = 'variacao'
export const CODIGO_RE = /^[a-z0-9][a-z0-9-]{0,39}$/

export function normalizarCodigo(txt) {
  return String(txt || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 40)
}

export function linkVariacao(url, codigo) {
  if (!url || !codigo) return null
  try {
    const u = new URL(url)
    u.searchParams.set(PARAM_URL, codigo)
    return u.toString()
  } catch {
    return null
  }
}

export function linkPrevia(url, varianteId) {
  if (!url) return null
  try {
    const u = new URL(url)
    u.searchParams.set('ab_variante', varianteId)
    return u.toString()
  } catch {
    return null
  }
}

// ── Dados
export async function listarTestes(supabase) {
  const { data, error } = await supabase
    .from('ab_experimentos')
    .select('*, ab_variantes!ab_variantes_experimento_id_fkey(id,nome,peso,original,arquivada,ordem,conteudo,url,hipotese)')
    .order('created_at', { ascending: false })
  if (error) throw error
  const ids = (data || []).map((t) => t.id)
  let resumo = []
  if (ids.length) {
    const r = await supabase.from('ab_resumo_variantes').select('*').in('experimento_id', ids)
    if (r.error) throw r.error
    resumo = r.data || []
  }
  return (data || []).map((t) => ({
    ...t,
    variantes: ordenarVariantes(t.ab_variantes || []),
    resumo: resumo.filter((r) => r.experimento_id === t.id),
  }))
}

export async function carregarTeste(supabase, id) {
  const { data, error } = await supabase
    .from('ab_experimentos')
    .select('*, ab_variantes!ab_variantes_experimento_id_fkey(*)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const r = await supabase.from('ab_resumo_variantes').select('*').eq('experimento_id', id)
  if (r.error) throw r.error
  return { ...data, variantes: ordenarVariantes(data.ab_variantes || []), resumo: r.data || [] }
}

export function ordenarVariantes(vs) {
  return [...vs].sort((a, b) => (b.original - a.original) || (a.ordem - b.ordem) || String(a.created_at).localeCompare(String(b.created_at)))
}

export async function criarTeste(supabase, dados, userId) {
  const { data: teste, error } = await supabase
    .from('ab_experimentos')
    .insert({ ...dados, slug: novoSlug(), created_by: userId || null })
    .select()
    .single()
  if (error) throw error
  const { error: e2 } = await supabase
    .from('ab_variantes')
    .insert({ experimento_id: teste.id, nome: 'Original', codigo: 'original', original: true, peso: 100, ordem: 0 })
  if (e2) throw e2
  return teste
}

export async function atualizarTeste(supabase, id, patch) {
  const { error } = await supabase.from('ab_experimentos').update(patch).eq('id', id)
  if (error) throw error
}

export async function excluirTeste(supabase, id) {
  const { error } = await supabase.from('ab_experimentos').delete().eq('id', id)
  if (error) throw error
}

export async function salvarVariante(supabase, variante) {
  const { id, ...resto } = variante
  const campos = {
    experimento_id: resto.experimento_id,
    nome: resto.nome,
    hipotese: resto.hipotese || null,
    conteudo: resto.conteudo || {},
    url: resto.url || null,
    ...(resto.codigo ? { codigo: resto.codigo } : {}),
    ...(resto.peso != null ? { peso: resto.peso } : {}),
    ...(resto.ordem != null ? { ordem: resto.ordem } : {}),
  }
  const q = id
    ? supabase.from('ab_variantes').update(campos).eq('id', id)
    : supabase.from('ab_variantes').insert(campos)
  const { error } = await q
  if (error) throw error
}

export async function salvarPesos(supabase, pesos) {
  for (const [id, peso] of Object.entries(pesos)) {
    const { error } = await supabase.from('ab_variantes').update({ peso }).eq('id', id)
    if (error) throw error
  }
}

export async function arquivarVariante(supabase, id) {
  const { error } = await supabase.from('ab_variantes').update({ arquivada: true, peso: 0 }).eq('id', id)
  if (error) throw error
}

// Declarar vencedor: ele fica com 100% e o teste encerra. As visitas novas já
// veem o vencedor; passar o texto dele para o código da LP vira o novo Original.
export async function declararVencedor(supabase, teste, varianteId) {
  const pesos = Object.fromEntries(teste.variantes.filter((v) => !v.arquivada).map((v) => [v.id, v.id === varianteId ? 100 : 0]))
  await salvarPesos(supabase, pesos)
  await atualizarTeste(supabase, teste.id, { vencedor_id: varianteId, status: 'encerrado', encerrado_em: new Date().toISOString() })
}
