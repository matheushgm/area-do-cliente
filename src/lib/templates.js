// Templates do VertaTask (tabela tarefas_modelos, coluna itens): uma árvore de
// tarefas (cada uma com subtarefas) que se aplica na lista de um cliente. Regras
// puras, sem React nem Supabase.
//
// Item do template:
//   { id, titulo, descricao, prioridade, estimativa_min, tipo_tarefa, dificuldade,
//     departamento[], etiquetas[], checklists[],
//     responsavel: { modo: 'departamento' | 'pessoa' | 'nenhum', pessoa_id },
//     inicio_dia, vencimento_dia,  // dias úteis depois da data de início; null = sem data
//     depende_de[],                // ids de outros itens: viram "bloqueia" ao aplicar
//     subtarefas[] }               // mesmos campos, sem subtarefas próprias
import { novoId, deInputDate } from './tarefas'
import { paraDiaLocal, paraISODia, hojeISO } from './vertatask'
import { DEPARTAMENTO_ALIAS_SQUAD, CLICKUP_USUARIO_CLIENTE } from './constants'

export const MODOS_RESPONSAVEL = [
  { key: 'departamento', label: 'Pelo departamento (squad do cliente)' },
  { key: 'pessoa', label: 'Pessoa fixa' },
  { key: 'nenhum', label: 'Sem responsável' },
]

export function novoItem(patch = {}) {
  return {
    id: novoId(), titulo: '', descricao: '', prioridade: null, estimativa_min: null,
    tipo_tarefa: null, dificuldade: null, departamento: [], etiquetas: [], checklists: [],
    responsavel: { modo: 'departamento', pessoa_id: null },
    inicio_dia: null, vencimento_dia: null, depende_de: [], subtarefas: [],
    ...patch,
  }
}

const num = (v) => (v === '' || v == null || isNaN(Number(v)) ? null : Math.max(0, Math.round(Number(v))))

function normalizarItem(it, comSubs) {
  const base = novoItem()
  const r = { ...base, ...it, id: it?.id || base.id }
  r.departamento = Array.isArray(r.departamento) ? r.departamento : r.departamento ? [r.departamento] : []
  r.etiquetas = Array.isArray(r.etiquetas) ? r.etiquetas : []
  r.checklists = Array.isArray(r.checklists) ? r.checklists : []
  r.depende_de = Array.isArray(r.depende_de) ? r.depende_de : []
  r.responsavel = { ...base.responsavel, ...(r.responsavel || {}) }
  r.inicio_dia = num(r.inicio_dia)
  r.vencimento_dia = num(r.vencimento_dia)
  r.subtarefas = comSubs ? (Array.isArray(r.subtarefas) ? r.subtarefas : []).map((s) => normalizarItem(s, false)) : []
  return r
}

/** Itens de um template, com defaults. Linhas antigas (só payload) viram uma tarefa com subtarefas. */
export function itensDoTemplate(t) {
  if (Array.isArray(t?.itens) && t.itens.length) return t.itens.map((i) => normalizarItem(i, true))
  const p = t?.payload
  if (p && (p.titulo || (p.subtarefas || []).length)) {
    const { subtarefas = [], ...resto } = p
    return [normalizarItem({ ...resto, subtarefas: subtarefas.map((s) => (typeof s === 'string' ? { titulo: s } : s)) }, true)]
  }
  return []
}

/** Lista plana (tarefas e subtarefas), na ordem de exibição. */
export function achatar(itens) {
  const out = []
  for (const it of itens) {
    out.push({ item: it, nivel: 0, pai: null })
    for (const s of it.subtarefas || []) out.push({ item: s, nivel: 1, pai: it })
  }
  return out
}

/** Número de cada item na ordem do template: "1", "1.1", "1.2", "2"… (id → número). */
export function numeracao(itens) {
  const m = new Map()
  itens.forEach((it, i) => { m.set(it.id, `${i + 1}`); (it.subtarefas || []).forEach((s, j) => m.set(s.id, `${i + 1}.${j + 1}`)) })
  return m
}

export function resumoDoTemplate(itens) {
  const plano = achatar(itens)
  const deps = new Set()
  let min = 0
  for (const { item } of plano) { min += item.estimativa_min || 0; for (const d of item.departamento) deps.add(d) }
  return { tarefas: itens.length, total: plano.length, estimativaMin: min, departamentos: [...deps] }
}

// ─── Datas em dias úteis ─────────────────────────────────────────────────────

const util = (d) => d.getDay() !== 0 && d.getDay() !== 6

/** Primeiro dia útil a partir de iso (o próprio, se for útil). */
export function proximoDiaUtil(iso = hojeISO()) {
  const d = paraDiaLocal(iso)
  while (!util(d)) d.setDate(d.getDate() + 1)
  return paraISODia(d)
}

/** iso + n dias úteis (n = 0 devolve o primeiro dia útil a partir de iso). */
export function somarDiasUteis(iso, n) {
  const d = paraDiaLocal(proximoDiaUtil(iso))
  let falta = n
  while (falta > 0) { d.setDate(d.getDate() + 1); if (util(d)) falta-- }
  return paraISODia(d)
}

/** Dias úteis de a até b (b antes de a = 0). */
export function diasUteisEntre(a, b) {
  let d = paraDiaLocal(proximoDiaUtil(a))
  const fim = paraDiaLocal(b)
  let n = 0
  while (d < fim) { d.setDate(d.getDate() + 1); if (util(d) && d <= fim) n++ }
  return n
}

// ─── De uma tarefa para template ─────────────────────────────────────────────

const dia = (v) => (v ? String(paraISODia(new Date(v))) : null)

function deLinha(row, base, mapaIds) {
  const id = mapaIds.get(row.id) || novoId()
  mapaIds.set(row.id, id)
  return normalizarItem({
    id, titulo: row.titulo || '', descricao: row.descricao || '', prioridade: row.prioridade || null,
    estimativa_min: row.estimativa_min || null, tipo_tarefa: row.tipo_tarefa || null, dificuldade: row.dificuldade || null,
    departamento: row.departamento || [], etiquetas: row.etiquetas || [],
    checklists: (row.checklists || []).map((c) => ({ ...c, itens: (c.itens || []).map((i) => ({ ...i, feito: false })) })),
    responsavel: (row.departamento || []).length ? { modo: 'departamento', pessoa_id: null }
      : (row.responsaveis || []).length ? { modo: 'pessoa', pessoa_id: row.responsaveis[0] } : { modo: 'nenhum', pessoa_id: null },
    inicio_dia: base && row.data_inicio ? diasUteisEntre(base, dia(row.data_inicio)) : null,
    vencimento_dia: base && row.data_vencimento ? diasUteisEntre(base, dia(row.data_vencimento)) : null,
  }, false)
}

/**
 * Template a partir de uma tarefa e das subtarefas dela, com todos os atributos.
 * Os prazos viram dias úteis contados da data mais cedo entre elas.
 */
export function templateDaTarefa(tarefa, subtarefas = []) {
  const datas = [tarefa, ...subtarefas].flatMap((r) => [dia(r.data_inicio), dia(r.data_vencimento)]).filter(Boolean).sort()
  const base = datas[0] || null
  const mapa = new Map()
  const raiz = deLinha(tarefa, base, mapa)
  raiz.subtarefas = [...subtarefas]
    .sort((a, b) => (Number(a.posicao) || 0) - (Number(b.posicao) || 0))
    .map((s) => deLinha(s, base, mapa))
  return [raiz]
}

// ─── Edição da árvore ────────────────────────────────────────────────────────

/** Aplica fn ao item id (em qualquer nível). */
export function atualizarItem(itens, id, fn) {
  return itens.map((it) => {
    if (it.id === id) return fn(it)
    if (!(it.subtarefas || []).some((s) => s.id === id)) return it
    return { ...it, subtarefas: it.subtarefas.map((s) => (s.id === id ? fn(s) : s)) }
  })
}

/** Remove o item id e as referências a ele (e às subtarefas dele) em depende_de. */
export function removerItem(itens, id) {
  const alvo = itens.find((i) => i.id === id)
  const fora = new Set([id, ...(alvo?.subtarefas || []).map((s) => s.id)])
  const limpa = (it) => ({ ...it, depende_de: it.depende_de.filter((d) => !fora.has(d)) })
  return itens
    .filter((it) => it.id !== id)
    .map((it) => ({ ...limpa(it), subtarefas: it.subtarefas.filter((s) => s.id !== id).map(limpa) }))
}

/** Move o item id uma posição para cima (-1) ou para baixo (+1), no mesmo nível. */
export function moverItem(itens, id, delta) {
  const troca = (arr) => {
    const i = arr.findIndex((x) => x.id === id)
    if (i < 0) return null
    const j = i + delta
    if (j < 0 || j >= arr.length) return arr
    const n = [...arr]; [n[i], n[j]] = [n[j], n[i]]; return n
  }
  const topo = troca(itens)
  if (topo) return topo
  return itens.map((it) => {
    const s = troca(it.subtarefas || [])
    return s ? { ...it, subtarefas: s } : it
  })
}

/** Cópia com ids novos (depende_de remapeado). */
export function clonarItens(itens) {
  const mapa = new Map()
  for (const { item } of achatar(itens)) mapa.set(item.id, novoId())
  const re = (it) => ({ ...it, id: mapa.get(it.id), depende_de: it.depende_de.map((d) => mapa.get(d)).filter(Boolean) })
  return itens.map((it) => ({ ...re(it), subtarefas: it.subtarefas.map(re) }))
}

export function duplicarItem(itens, id) {
  const i = itens.findIndex((x) => x.id === id)
  if (i >= 0) {
    const [copia] = clonarItens([itens[i]])
    copia.depende_de = []
    const n = [...itens]; n.splice(i + 1, 0, { ...copia, titulo: `${copia.titulo} (cópia)` }); return n
  }
  return itens.map((it) => {
    const j = it.subtarefas.findIndex((s) => s.id === id)
    if (j < 0) return it
    const subs = [...it.subtarefas]
    subs.splice(j + 1, 0, { ...it.subtarefas[j], id: novoId(), depende_de: [], titulo: `${it.subtarefas[j].titulo} (cópia)` })
    return { ...it, subtarefas: subs }
  })
}

/** Problemas que impedem aplicar: título vazio, dependência circular, prazo antes do início. */
export function validarItens(itens) {
  const erros = []
  const plano = achatar(itens)
  const porId = new Map(plano.map((p) => [p.item.id, p.item]))
  for (const { item } of plano) {
    if (!item.titulo.trim()) erros.push({ id: item.id, msg: 'Tarefa sem título' })
    if (item.inicio_dia != null && item.vencimento_dia != null && item.vencimento_dia < item.inicio_dia) erros.push({ id: item.id, msg: `"${item.titulo || 'Sem título'}" vence antes de começar` })
    if (item.responsavel.modo === 'pessoa' && !item.responsavel.pessoa_id) erros.push({ id: item.id, msg: `"${item.titulo || 'Sem título'}" está como pessoa fixa sem pessoa escolhida` })
  }
  // ciclo em depende_de
  const estado = new Map()
  const visita = (id) => {
    if (estado.get(id) === 1) return true
    if (estado.get(id) === 2) return false
    estado.set(id, 1)
    for (const d of porId.get(id)?.depende_de || []) if (porId.has(d) && visita(d)) return true
    estado.set(id, 2)
    return false
  }
  for (const id of porId.keys()) if (visita(id)) { erros.push({ id, msg: 'Há uma dependência circular entre as tarefas' }); break }
  return erros
}

// ─── Aplicação ───────────────────────────────────────────────────────────────

export const DEPARTAMENTO_CLIENTE = 'Cliente'

/** Perfil do usuário "Cliente" do ClickUp entre os membros do time (id ou null). */
export function perfilDoUsuarioCliente(membros = []) {
  const porClickup = membros.find((m) => Number(m.clickup_user_id ?? m.clickupUserId) === CLICKUP_USUARIO_CLIENTE)
  return (porClickup || membros.find((m) => String(m.name || '').trim().toLowerCase() === 'cliente'))?.id || null
}

/**
 * Responsáveis de um item do template para um cliente. Departamento "Cliente" vai para
 * o usuário Cliente do ClickUp (usuarioClienteId); os demais, para quem o squad do
 * cliente designou ao departamento (squad.department_assignments). Com `ativos` (Set de
 * ids de perfis ativos), quem o squad aponta mas está desativado não é atribuído.
 */
export function responsaveisDoItem(item, squad, usuarioClienteId = null, ativos = null) {
  const r = item.responsavel || {}
  if (r.modo === 'nenhum') return { ids: [], aviso: null }
  if (r.modo === 'pessoa') return { ids: r.pessoa_id ? [r.pessoa_id] : [], aviso: r.pessoa_id ? null : 'Pessoa não escolhida' }
  if (!item.departamento.length) return { ids: [], aviso: 'Sem departamento' }
  const asg = squad?.department_assignments || squad?.departmentAssignments || {}
  const ids = []
  const faltam = []
  const desativados = []
  for (const d of item.departamento) {
    const id = d === DEPARTAMENTO_CLIENTE ? usuarioClienteId : (asg[d] || asg[DEPARTAMENTO_ALIAS_SQUAD[d]] || null)
    if (id && ativos && !ativos.has(id)) desativados.push(d)
    else if (id) { if (!ids.includes(id)) ids.push(id) } else faltam.push(d)
  }
  if (!faltam.length && !desativados.length) return { ids, aviso: null }
  const doSquad = faltam.filter((d) => d !== DEPARTAMENTO_CLIENTE)
  const avisos = []
  if (faltam.includes(DEPARTAMENTO_CLIENTE)) avisos.push('Usuário Cliente não encontrado')
  if (doSquad.length) avisos.push(squad ? `Squad sem ${doSquad.join(', ')}` : 'Cliente sem squad')
  if (desativados.length) avisos.push(`Squad aponta pessoa desativada em ${desativados.join(', ')}`)
  return { ids, aviso: avisos.join(' · ') }
}

/** {cliente} no título ou na descrição vira o nome do cliente ao aplicar. */
export const VARIAVEL_CLIENTE = '{cliente}'
export const comCliente = (txt, cliente) => String(txt || '').split(VARIAVEL_CLIENTE).join(cliente || 'cliente')

/**
 * Plano de aplicação: uma linha por tarefa a criar, com datas (ISO, meio-dia local,
 * como o DataCampo grava), responsáveis e textos já resolvidos.
 */
export function planejarAplicacao(itens, { dataInicio, squad, cliente = '', usuarioClienteId = null, ativos = null }) {
  const inicio = proximoDiaUtil(dataInicio || hojeISO())
  const data = (n) => (n == null ? null : deInputDate(somarDiasUteis(inicio, n)))
  return achatar(itens).map(({ item, nivel, pai }) => {
    const resp = responsaveisDoItem(item, squad, usuarioClienteId, ativos)
    return {
      item, nivel, paiId: pai?.id || null,
      titulo: comCliente(item.titulo, cliente).trim() || 'Nova tarefa',
      descricao: item.descricao ? comCliente(item.descricao, cliente) : null,
      data_inicio: data(item.inicio_dia), data_vencimento: data(item.vencimento_dia),
      responsaveis: resp.ids, aviso: resp.aviso,
    }
  })
}
