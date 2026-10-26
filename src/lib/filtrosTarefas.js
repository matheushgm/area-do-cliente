// Filtros avançados das views do VertaTask (sidebar do funil), no modelo do ClickUp.
// Salvos na config da view: { op: 'e'|'ou', grupos: [{ id, op, regras: [{ id, campo, operador, valor }] }] }.
// Dentro de um grupo as regras se ligam pelo op do grupo; os grupos, pelo op de fora.
// Regra incompleta (sem campo ou sem valor) é ignorada até ser completada. Quem usa soma
// (E) o resultado com os filtros da barra (busca, responsáveis, concluídas).
import { PRIORIDADES, TIPOS_TAREFA, DIFICULDADES, DEPARTAMENTOS } from './tarefas'

export const FILTROS_VAZIOS = { op: 'e', grupos: [] }

// tipo: opcao (um valor por tarefa) | multi (lista na tarefa) | data | numero | texto
export const CAMPOS_FILTRO = [
  { key: 'status', label: 'Status', tipo: 'opcao' },
  { key: 'prioridade', label: 'Prioridade', tipo: 'opcao', vazio: true },
  { key: 'responsaveis', label: 'Responsáveis', tipo: 'multi', pessoas: true },
  { key: 'vencimento', label: 'Data de vencimento', tipo: 'data', atrasada: true },
  { key: 'inicio', label: 'Data de início', tipo: 'data' },
  { key: 'criada', label: 'Data de criação', tipo: 'data' },
  { key: 'concluida', label: 'Data de conclusão', tipo: 'data' },
  { key: 'tipo', label: 'Tipo de tarefa', tipo: 'opcao', vazio: true },
  { key: 'dificuldade', label: 'Dificuldade', tipo: 'opcao', vazio: true },
  { key: 'departamento', label: 'Departamento', tipo: 'multi' },
  { key: 'etiquetas', label: 'Etiquetas', tipo: 'multi' },
  { key: 'ciclo', label: 'Cycle (Sprint)', tipo: 'opcao', vazio: true },
  { key: 'lista', label: 'Lista', tipo: 'opcao' },
  { key: 'estimativa', label: 'Estimativa (horas)', tipo: 'numero' },
  { key: 'nome', label: 'Nome', tipo: 'texto' },
]
const OPERADORES = {
  opcao: [['e', 'é'], ['nao_e', 'não é'], ['definido', 'está definido'], ['vazio', 'não está definido']],
  multi: [['qualquer', 'contém qualquer'], ['todos', 'contém todos'], ['nenhum', 'não contém'], ['definido', 'tem algum'], ['vazio', 'está vazio']],
  data: [['e', 'é'], ['antes', 'antes de'], ['depois', 'depois de'], ['atrasada', 'está atrasada'], ['definido', 'está definida'], ['vazio', 'não está definida']],
  numero: [['maior', 'maior que'], ['menor', 'menor que'], ['igual', 'igual a'], ['definido', 'está definida'], ['vazio', 'não está definida']],
  texto: [['contem', 'contém'], ['nao_contem', 'não contém']],
}
export const SEM_VALOR = new Set(['definido', 'vazio', 'atrasada'])
export const PERIODOS = [
  ['hoje', 'Hoje'], ['ontem', 'Ontem'], ['amanha', 'Amanhã'], ['esta_semana', 'Esta semana'], ['semana_passada', 'Semana passada'],
  ['proxima_semana', 'Próxima semana'], ['ultimos_7', 'Últimos 7 dias'], ['proximos_7', 'Próximos 7 dias'], ['este_mes', 'Este mês'],
]

export const campoFiltro = (k) => CAMPOS_FILTRO.find((c) => c.key === k) || null
export const operadoresDe = (c) => (c ? OPERADORES[c.tipo].filter(([k]) => (k !== 'atrasada' || c.atrasada) && (!['definido', 'vazio'].includes(k) || c.tipo !== 'opcao' || c.vazio)) : [])
const idLocal = () => Math.random().toString(36).slice(2, 9)
export const novaRegra = () => ({ id: idLocal(), campo: '', operador: '', valor: null })
export const novoGrupo = (regra = novaRegra()) => ({ id: idLocal(), op: 'e', regras: [regra] })

export function normalizarFiltros(f) {
  if (!f || !Array.isArray(f.grupos)) return FILTROS_VAZIOS
  return { op: f.op === 'ou' ? 'ou' : 'e', grupos: f.grupos.filter((g) => Array.isArray(g?.regras) && g.regras.length) }
}

export function regraCompleta(r) {
  if (!r.campo || !r.operador || !campoFiltro(r.campo)) return false
  if (SEM_VALOR.has(r.operador)) return true
  return Array.isArray(r.valor) ? r.valor.length > 0 : r.valor !== null && r.valor !== undefined && String(r.valor).trim() !== ''
}
export const contarRegras = (f) => (f?.grupos || []).reduce((n, g) => n + g.regras.filter(regraCompleta).length, 0)

const DIA = 86400000
function intervalo(periodo) {
  const h = new Date(); h.setHours(0, 0, 0, 0)
  const h0 = h.getTime()
  const ini = h0 - h.getDay() * DIA // a semana começa no domingo, como no Calendário
  const r = {
    hoje: [h0, h0 + DIA], ontem: [h0 - DIA, h0], amanha: [h0 + DIA, h0 + 2 * DIA],
    esta_semana: [ini, ini + 7 * DIA], semana_passada: [ini - 7 * DIA, ini], proxima_semana: [ini + 7 * DIA, ini + 14 * DIA],
    ultimos_7: [h0 - 6 * DIA, h0 + DIA], proximos_7: [h0, h0 + 7 * DIA],
    este_mes: [new Date(h.getFullYear(), h.getMonth(), 1).getTime(), new Date(h.getFullYear(), h.getMonth() + 1, 1).getTime()],
  }
  return r[periodo] || [0, 0]
}

function valorDe(it, campo) {
  switch (campo) {
    case 'status': return it.status
    case 'prioridade': return it.prioridade || null
    case 'responsaveis': return it.responsaveis || []
    case 'vencimento': return it.data_vencimento
    case 'inicio': return it.data_inicio
    case 'criada': return it.created_at
    case 'concluida': return it.data_conclusao
    case 'tipo': return (it.tipo_tarefa || '').trim() || null
    case 'dificuldade': return (it.dificuldade || '').trim() || null
    case 'departamento': return it.departamento || []
    case 'etiquetas': return it.etiquetas || []
    case 'ciclo': return it.ciclo_id || null
    case 'lista': return it.lista_id
    case 'estimativa': return it.estimativa_min ? it.estimativa_min / 60 : null
    case 'nome': return it.titulo || ''
    default: return null
  }
}

function avaliarRegra(it, r) {
  const c = campoFiltro(r.campo)
  const v = valorDe(it, r.campo)
  const op = r.operador
  if (c.tipo === 'opcao') {
    if (op === 'definido') return !!v
    if (op === 'vazio') return !v
    return op === 'e' ? r.valor.includes(v) : !r.valor.includes(v)
  }
  if (c.tipo === 'multi') {
    if (op === 'definido') return v.length > 0
    if (op === 'vazio') return v.length === 0
    if (op === 'qualquer') return r.valor.some((x) => v.includes(x))
    if (op === 'todos') return r.valor.every((x) => v.includes(x))
    return !r.valor.some((x) => v.includes(x))
  }
  if (c.tipo === 'data') {
    const d = v ? new Date(v) : null
    if (op === 'definido') return !!d
    if (op === 'vazio') return !d
    if (!d || isNaN(d.getTime())) return false
    const dia = new Date(d).setHours(0, 0, 0, 0)
    if (op === 'atrasada') return dia < new Date().setHours(0, 0, 0, 0) && it.status_tipo !== 'closed'
    if (op === 'e') { const [a, b] = intervalo(r.valor); return dia >= a && dia < b }
    const [y, m, dd] = String(r.valor).split('-').map(Number)
    const ref = new Date(y, m - 1, dd).getTime()
    return op === 'antes' ? dia < ref : dia > ref
  }
  if (c.tipo === 'numero') {
    if (op === 'definido') return v != null
    if (op === 'vazio') return v == null
    if (v == null) return false
    const n = Number(r.valor)
    return op === 'maior' ? v > n : op === 'menor' ? v < n : v === n
  }
  const tem = String(v).toLowerCase().includes(String(r.valor).trim().toLowerCase())
  return op === 'contem' ? tem : !tem
}

/** true se o item passa nos filtros avançados (grupos e regras incompletos são ignorados). */
export function passaFiltros(it, f) {
  const resultados = (f?.grupos || []).map((g) => {
    const regras = g.regras.filter(regraCompleta)
    if (!regras.length) return null
    return g.op === 'ou' ? regras.some((r) => avaliarRegra(it, r)) : regras.every((r) => avaliarRegra(it, r))
  }).filter((x) => x !== null)
  if (!resultados.length) return true
  return f.op === 'ou' ? resultados.some(Boolean) : resultados.every(Boolean)
}

/** Opções de valor do campo (com cor quando houver). ctx = { statuses, membros, etiquetas, ciclos, listas }. */
export function opcoesDoCampo(campo, { statuses = [], membros = [], etiquetas = [], ciclos = [], listas = [] } = {}) {
  switch (campo) {
    case 'status': return statuses.map((s) => ({ value: s.key, label: s.label, cor: s.cor }))
    case 'prioridade': return PRIORIDADES.map((p) => ({ value: p.key, label: p.label, cor: p.cor, bandeira: true }))
    case 'responsaveis': return membros.filter((m) => !m.disabled).map((m) => ({ value: m.id, label: m.name, pessoa: m }))
    case 'tipo': return TIPOS_TAREFA.map((t) => ({ value: t.key.trim(), label: t.key.trim(), cor: t.cor }))
    case 'dificuldade': return DIFICULDADES.map((d) => ({ value: d.key, label: d.key, cor: d.cor }))
    case 'departamento': return DEPARTAMENTOS.map((d) => ({ value: d, label: d }))
    case 'etiquetas': return etiquetas.map((e) => ({ value: e.id, label: e.nome, cor: e.cor }))
    case 'ciclo': return ciclos.map((c) => ({ value: c.id, label: c.nome }))
    case 'lista': return listas.map((l) => ({ value: l.id, label: l.nome }))
    default: return []
  }
}
