// Busca de tarefa para criar uma relação (painel da tarefa e tarefa nova).
// - Aceita link ou id: link do VertaTask (`?tarefa=<uuid>`), uuid solto, link do ClickUp
//   (`app.clickup.com/t/<id>`) ou o id do ClickUp sozinho (também busca pelo título).
// - Texto: todas as palavras, em qualquer ordem, sem ligar para acento.
// - Ordem: família da tarefa (pai, irmãs, subtarefas), depois o mesmo cliente (pasta), depois o
//   resto, sempre com as abertas antes das concluídas. "Só deste cliente" filtra a pasta; sem ele,
//   a pasta é lida à parte para o limite da busca geral não cortar as tarefas do cliente.
// - Cada resultado traz o contexto: cliente › lista, pai, status, vencimento, responsáveis.

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
const LINK_CLICKUP = /clickup\.com\/t\/(?:\d+\/)?([a-z0-9]+)/i
const ID_CLICKUP = /^#?([a-z0-9]{6,12})$/i

export const semAcento = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** O que a pessoa digitou: { id } | { clickup } | { palavras, clickupTalvez }. */
export function interpretarBusca(q) {
  const t = (q || '').trim()
  if (!t) return { palavras: [] }
  const link = t.match(LINK_CLICKUP)
  if (link) return { clickup: link[1] }
  const uuid = t.match(UUID)
  if (uuid) return { id: uuid[0].toLowerCase() }
  const palavras = semAcento(t).split(/\s+/).filter(Boolean)
  const id = palavras.length === 1 && t.match(ID_CLICKUP)
  // id do ClickUp tem letra e número (ex.: 86ak25ft0); palavra comum não vira busca por id
  const clickupTalvez = id && /\d/.test(id[1]) && /[a-z]/i.test(id[1]) ? id[1].toLowerCase() : null
  return { palavras, clickupTalvez }
}

// letras que podem vir acentuadas viram "_" (um caractere qualquer) no ilike; o filtro exato
// sem acento é feito depois, aqui no navegador
const padraoIlike = (p) => `%${p.replace(/[%_\\]/g, '').replace(/[aeiouc]/g, '_')}%`

export const contemPalavras = (titulo, palavras) => {
  const t = semAcento(titulo)
  return palavras.every((p) => t.includes(p))
}

/** 0 = família (pai, irmã, subtarefa), 1 = mesmo cliente, 2 = resto. */
export function faixa(r, ctx) {
  if (!ctx) return 2
  if (ctx.id && (r.id === ctx.parentId || r.parent_id === ctx.id || (ctx.parentId && r.parent_id === ctx.parentId))) return 0
  if (ctx.pastaId && r.lista?.pasta_id === ctx.pastaId) return 1
  return 2
}

export function ordenarResultados(rows, ctx) {
  return rows
    .map((r, i) => ({ r, i, f: faixa(r, ctx), c: r.status_tipo === 'closed' ? 1 : 0 }))
    .sort((a, b) => a.c - b.c || a.f - b.f || a.i - b.i)
    .map((x) => ({ ...x.r, familia: x.f === 0 }))
}

const SELECT = 'id,titulo,status,status_tipo,lista_id,parent_id,responsaveis,data_vencimento,clickup_task_id,'
  + 'lista:tarefas_listas!lista_id(nome,pasta_id,statuses,pasta:tarefas_pastas!pasta_id(nome)),pai:parent_id(titulo)'

/**
 * Onde a tarefa de origem está: { id, parentId, pastaId, listaIds }. Pela tarefa (painel) ou
 * só pela lista (tarefa nova, ainda sem id).
 */
export async function contextoDaRelacao(sb, { tarefaId, listaId }) {
  let ctx = { id: tarefaId || null, parentId: null, pastaId: null, listaIds: [] }
  let lid = listaId
  if (tarefaId) {
    const { data } = await sb.from('tarefas_itens').select('lista_id,parent_id').eq('id', tarefaId).maybeSingle()
    if (data) { ctx.parentId = data.parent_id; lid = data.lista_id }
  }
  if (!lid) return ctx
  const { data: lista } = await sb.from('tarefas_listas').select('pasta_id').eq('id', lid).maybeSingle()
  if (!lista?.pasta_id) return { ...ctx, listaIds: [lid] }
  const { data: listas } = await sb.from('tarefas_listas').select('id').eq('pasta_id', lista.pasta_id)
  return { ...ctx, pastaId: lista.pasta_id, listaIds: (listas || []).map((l) => l.id) }
}

/** Busca. opts: { ctx, soCliente, excluirIds, limite }. Resultado no formato de `achados`. */
export async function buscarTarefasRelacao(sb, q, { ctx = null, soCliente = false, excluirIds = [], limite = 8 } = {}) {
  const b = interpretarBusca(q)
  const excluir = new Set(excluirIds.filter(Boolean))
  const base = () => sb.from('tarefas_itens').select(SELECT).eq('arquivada', false)
  let rows = []
  if (b.id) {
    rows = (await base().eq('id', b.id).limit(1)).data || []
  } else if (b.clickup) {
    rows = (await base().eq('clickup_task_id', b.clickup).limit(1)).data || []
  } else {
    if (!b.palavras.length) return []
    const texto = (doCliente) => {
      let qy = base()
      for (const p of b.palavras) qy = qy.ilike('titulo', padraoIlike(p))
      if (doCliente) qy = qy.in('lista_id', ctx.listaIds)
      return qy.order('updated_at', { ascending: false }).limit(200)
    }
    const temCliente = !!ctx?.listaIds?.length
    const vazio = Promise.resolve({ data: [] })
    const [cliente, geral, porId] = await Promise.all([
      temCliente ? texto(true) : vazio,
      soCliente && temCliente ? vazio : texto(false),
      b.clickupTalvez ? base().eq('clickup_task_id', b.clickupTalvez).limit(1) : vazio,
    ])
    rows = [...(porId.data || []), ...[...(cliente.data || []), ...(geral.data || [])].filter((r) => contemPalavras(r.titulo, b.palavras))]
  }
  const vistos = new Set()
  rows = rows.filter((r) => !excluir.has(r.id) && !vistos.has(r.id) && vistos.add(r.id))
  return ordenarResultados(rows, ctx).slice(0, limite).map((r) => ({ ...r, pelo: b.id || b.clickup ? 'link' : null }))
}
