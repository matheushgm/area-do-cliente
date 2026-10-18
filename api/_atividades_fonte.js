// Fonte de dados do Planejador de Atividades / Capacidade do time: as tabelas
// tarefas_* (espelho do ClickUp mantido por api/_tarefas_sync_core.js), e não
// mais a API do ClickUp ao vivo. Assim a Capacidade bate 100% com o VertaTask:
// mesma linha, mesma estimativa, mesmo vencimento, e tarefa criada só aqui
// também entra na conta.
//
// O motor (api/_atividades_engine.js) continua lendo o formato de tarefa do
// ClickUp; este módulo converte cada linha para esse formato (`tarefaParaClickUp`)
// para não mexer na regra de cálculo. Quem escreve no ClickUp (criar, estimar,
// tipar) chama `espelharTarefaClickUp` logo depois, para o espelho refletir a
// mudança na hora em vez de esperar a sincronização diária.
import { sb } from './_http.js'
import { mapTarefa, fazPerfilDe } from './_tarefas_clickup_map.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ms = (v) => (v ? String(new Date(v).getTime()) : null)

async function todas(path, { passo = 1000 } = {}) {
  const out = []
  for (let de = 0; ; de += passo) {
    const r = await sb(`${path}`, { range: `${de}-${de + passo - 1}`, prefer: 'count=exact' })
    if (!r.ok) throw new Error(`Supabase ${path}: ${r.status} ${typeof r.data === 'string' ? r.data : JSON.stringify(r.data)}`)
    const arr = Array.isArray(r.data) ? r.data : []
    out.push(...arr)
    if (arr.length < passo) break
  }
  return out
}

/** Mapas de apoio (listas, pastas, projetos, perfis) carregados uma vez por request. */
export async function carregarMapas() {
  const [listas, pastas, projetos, perfis] = await Promise.all([
    todas('/tarefas_listas?select=id,nome,pasta_id,clickup_list_id,statuses,arquivada,posicao'),
    todas('/tarefas_pastas?select=id,nome,project_id,clickup_folder_id,arquivada,espaco'),
    todas('/projects_v2?select=id,company_name,clickup_folder_id'),
    todas('/profiles?select=id,name,email,clickup_user_id,disabled'),
  ])
  return {
    listas: new Map(listas.map((l) => [l.id, l])),
    pastas: new Map(pastas.map((p) => [p.id, p])),
    projetos: new Map(projetos.map((p) => [p.id, p])),
    perfis: new Map(perfis.map((p) => [p.id, p])),
    perfilPorClickup: new Map(perfis.filter((p) => p.clickup_user_id).map((p) => [Number(p.clickup_user_id), p])),
    perfilDe: fazPerfilDe(perfis),
    listasBrutas: listas, pastasBrutas: pastas,
  }
}

/**
 * Resolve o que o front manda em `assignees` (clickup_user_id numérico, como
 * sempre foi, ou o uuid do perfil para quem não tem ClickUp) em perfis.
 * Devolve [{ chave, perfil }] — `chave` é o valor original, ecoado na resposta.
 */
export function resolverPessoas(ids, mapas) {
  const out = []
  for (const raw of ids || []) {
    const chave = typeof raw === 'string' && UUID.test(raw) ? raw : Number(raw)
    let perfil = null
    if (typeof chave === 'string') perfil = mapas.perfis.get(chave) || null
    else if (Number.isFinite(chave) && chave > 0) perfil = mapas.perfilPorClickup.get(chave) || mapas.perfilDe(chave) || null
    if (!perfil) { out.push({ chave, perfil: null, erro: 'Pessoa sem perfil na Área do Cliente.' }); continue }
    out.push({ chave, perfil })
  }
  return out
}

/** Linha de tarefas_itens → formato de tarefa do ClickUp que o motor entende. */
export function tarefaParaClickUp(row, mapas) {
  const lista = mapas.listas.get(row.lista_id)
  const pasta = lista ? mapas.pastas.get(lista.pasta_id) : null
  const projeto = pasta?.project_id ? mapas.projetos.get(pasta.project_id) : null
  const assignees = []
  for (const pid of row.responsaveis || []) {
    const p = mapas.perfis.get(pid)
    assignees.push({ id: p?.clickup_user_id ? Number(p.clickup_user_id) : pid, username: p?.name || null, email: p?.email || null, profile_id: pid })
  }
  for (const e of row.responsaveis_extra || []) assignees.push({ id: Number(e.clickup_id) || e.nome, username: e.nome, extra: true })
  const cf = (name, value) => (value == null || value === '' || (Array.isArray(value) && !value.length)) ? null : { name, value, type_config: {} }
  return {
    id: row.clickup_task_id || row.id,
    vertatask_id: row.id,
    name: row.titulo,
    url: row.clickup_url || `/tarefas?tarefa=${row.id}`,
    status: { status: row.status, type: row.status_tipo },
    due_date: ms(row.data_vencimento),
    start_date: ms(row.data_inicio),
    date_created: ms(row.created_at),
    date_updated: ms(row.clickup_updated_at || row.updated_at),
    date_done: ms(row.data_conclusao),
    date_closed: ms(row.data_fechamento || row.data_conclusao),
    time_estimate: row.estimativa_min ? row.estimativa_min * 60000 : null,
    priority: row.prioridade ? { priority: row.prioridade } : null,
    parent: row.parent_id || null,
    archived: !!row.arquivada,
    assignees,
    list: { id: lista?.clickup_list_id || row.lista_id, name: lista?.nome || null },
    folder: { id: pasta?.clickup_folder_id || pasta?.id || null, name: pasta?.nome || null },
    custom_fields: [
      cf('Tipo de tarefa', row.tipo_tarefa),
      cf('Dificuldade', row.dificuldade),
      cf('Departamento', (row.departamento || [])[0] || null),
      cf('Cliente', projeto?.company_name || null),
    ].filter(Boolean),
    tags: row.tags || [],
  }
}

/** Todas as tarefas ABERTAS (não arquivadas) de uma pessoa, em qualquer lista/space. */
// Tarefa em lista ou pasta arquivada não conta (o ClickUp também não as devolve).
function listaViva(row, mapas) {
  const lista = mapas.listas.get(row.lista_id)
  if (!lista || lista.arquivada) return false
  const pasta = lista.pasta_id ? mapas.pastas.get(lista.pasta_id) : null
  return !(pasta && pasta.arquivada)
}

export async function abertasDe(perfilId, mapas) {
  const rows = await todas(`/tarefas_itens?select=*&responsaveis=cs.{${perfilId}}&status_tipo=neq.closed&arquivada=is.false`)
  return rows.filter((r) => listaViva(r, mapas)).map((r) => tarefaParaClickUp(r, mapas))
}

/** Tarefas concluídas entre dois dias (inclusive), pelo data_conclusao. */
export async function concluidasEntre(desde, ate, mapas) {
  const ini = new Date(`${desde}T00:00:00-03:00`).toISOString()
  const fim = new Date(`${ate}T23:59:59.999-03:00`).toISOString()
  const rows = await todas(`/tarefas_itens?select=*&status_tipo=eq.closed&data_conclusao=gte.${encodeURIComponent(ini)}&data_conclusao=lte.${encodeURIComponent(fim)}&order=data_conclusao.desc`)
  return rows.filter((r) => listaViva(r, mapas)).map((r) => tarefaParaClickUp(r, mapas))
}

/** Listas (com statuses) da pasta do ClickUp `folderId`, lidas do espelho. */
export function listasDaPasta(folderId, mapas) {
  const pasta = mapas.pastasBrutas.find((p) => String(p.clickup_folder_id) === String(folderId) || p.id === folderId)
  if (!pasta) return []
  return mapas.listasBrutas
    .filter((l) => l.pasta_id === pasta.id && !l.arquivada && l.clickup_list_id)
    .sort((a, b) => (Number(a.posicao) || 0) - (Number(b.posicao) || 0))
    .map((l) => ({ id: String(l.clickup_list_id), name: l.nome, statuses: (l.statuses || []).map((s) => ({ status: s.key, type: s.tipo, color: s.cor })) }))
}

/**
 * Reflete no espelho uma tarefa recém-escrita no ClickUp (payload completo da
 * resposta da API). Atualiza a linha existente por clickup_task_id ou cria uma
 * nova na lista correspondente. Marca clickup_sync_at/updated_at = agora, para
 * a sincronização não achar que foi editada na Área.
 */
export async function espelharTarefaClickUp(task, mapas) {
  if (!task?.id) return { ok: false, motivo: 'sem tarefa' }
  const lista = mapas.listasBrutas.find((l) => String(l.clickup_list_id) === String(task.list?.id))
  if (!lista) return { ok: false, motivo: `lista ${task.list?.id} não está no espelho` }
  const row = mapTarefa(task, mapas.perfilDe)
  const agora = new Date().toISOString()
  const ex = await sb(`/tarefas_itens?select=id,parent_id&clickup_task_id=eq.${encodeURIComponent(task.id)}&limit=1`)
  const existente = ex.ok && Array.isArray(ex.data) ? ex.data[0] : null
  let parent_id = existente?.parent_id || null
  if (task.parent && !parent_id) {
    const pai = await sb(`/tarefas_itens?select=id&clickup_task_id=eq.${encodeURIComponent(task.parent)}&limit=1`)
    parent_id = pai.ok && Array.isArray(pai.data) ? pai.data[0]?.id || null : null
  }
  const body = { ...row, lista_id: lista.id, parent_id, clickup_sync_at: agora, updated_at: agora }
  const r = existente
    ? await sb(`/tarefas_itens?id=eq.${existente.id}`, { method: 'PATCH', body: JSON.stringify(body) })
    : await sb('/tarefas_itens', { method: 'POST', body: JSON.stringify(body) })
  if (!r.ok) return { ok: false, motivo: `${r.status} ${typeof r.data === 'string' ? r.data : JSON.stringify(r.data)}` }
  return { ok: true, id: Array.isArray(r.data) ? r.data[0]?.id : existente?.id }
}
