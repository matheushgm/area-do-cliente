// Funções puras do relatório de tarefas concluídas (módulo Atividades).
// Recebem a lista que a action `concluidas` devolve e montam o que a UI mostra:
// recorte por período (hoje / ontem / 7 dias), ranking por colaborador e por
// cliente, e o relatório de cada pessoa dividido por dia.
import { DIAS, MESES, weekday, fmtCurta } from './atividadesCarga'

export const PERIODOS = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'ontem', label: 'Ontem' },
  { value: '7dias', label: 'Últimos 7 dias' },
]

const SEM_RESPONSAVEL = 'sem'
export const SEM_RESPONSAVEL_KEY = SEM_RESPONSAVEL

function addDias(iso, n) {
  const [y, m, d] = String(iso).split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return dt.toISOString().slice(0, 10)
}

function norm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

function round2(n) {
  return Math.round(n * 100) / 100
}

/** Intervalo [desde, ate] de cada período pré-pronto. */
export function intervaloDoPeriodo(periodo, hoje) {
  if (periodo === 'hoje') return { desde: hoje, ate: hoje }
  if (periodo === 'ontem') { const o = addDias(hoje, -1); return { desde: o, ate: o } }
  return { desde: addDias(hoje, -6), ate: hoje }
}

/** Lista de dias do intervalo, do mais recente para o mais antigo. */
export function diasDoIntervalo({ desde, ate }) {
  const out = []
  let d = ate
  for (let i = 0; i < 40 && d >= desde; i++) { out.push(d); d = addDias(d, -1) }
  return out
}

/** '2026-09-15' → 'Hoje · seg 15 set' / 'Ontem · dom 14 set' / 'sex 12 set' */
export function rotuloDia(iso, hoje) {
  if (!iso) return ''
  const [, m, d] = String(iso).split('-')
  const base = `${DIAS[weekday(iso)].toLowerCase()} ${Number(d)} ${MESES[Number(m) - 1]}`
  if (iso === hoje) return `Hoje · ${base}`
  if (iso === addDias(hoje, -1)) return `Ontem · ${base}`
  return base
}

/** Texto do período para o cabeçalho: '15/09' ou '09/09 a 15/09'. */
export function rotuloIntervalo({ desde, ate }) {
  if (!desde || !ate) return ''
  return desde === ate ? fmtCurta(desde) : `${fmtCurta(desde)} a ${fmtCurta(ate)}`
}

export function filtrarPorPeriodo(tarefas, periodo, hoje) {
  const { desde, ate } = intervaloDoPeriodo(periodo, hoje)
  return (tarefas || []).filter((t) => t.dia && t.dia >= desde && t.dia <= ate)
}

/**
 * Pastas do ClickUp costumam ter a razão social em caixa alta
 * ("GYNFER GOIANIA FERRAMENTAS E ACESSORIOS LTDA"): vira "Gynfer Goiania
 * Ferramentas e Acessorios". Nome com caixa mista fica como está.
 */
export function nomeBonito(nome) {
  const s = String(nome || '').trim()
  if (!s || s !== s.toUpperCase() || !/[A-Z]/.test(s)) return s
  const semSufixo = s.replace(/\s+(LTDA|ME|EPP|EIRELI|S\.?A\.?|S\/A)\.?$/i, '')
  const minusculas = new Set(['E', 'DE', 'DA', 'DO', 'DAS', 'DOS', 'EM'])
  return semSufixo.split(/\s+/).map((w, i) => (i > 0 && minusculas.has(w) ? w.toLowerCase() : w[0] + w.slice(1).toLowerCase())).join(' ')
}

/**
 * Nome do cliente de uma tarefa. A pasta do ClickUp é a chave (uma pasta =
 * um cliente): projeto da Área do Cliente vinculado à pasta > nome da pasta.
 * Só sem pasta é que vale o campo "Cliente" da tarefa, depois a lista.
 */
export function resolverCliente(t, projetosPorPasta) {
  const proj = t.pastaId ? projetosPorPasta?.get(String(t.pastaId)) : null
  if (proj) return nomeBonito(proj)
  if (t.pasta && t.pasta !== 'hidden') return nomeBonito(t.pasta)
  if (t.clienteCf) return t.clienteCf
  return t.lista || 'Sem cliente'
}

/**
 * Quem entregou: perfis do time (por clickup_user_id) para nome e avatar
 * iguais aos do resto do módulo; quem não está no time aparece com o nome do
 * ClickUp; sem responsável vira um grupo próprio.
 */
export function resolverPessoas(t, membrosPorClickup) {
  if (!t.assignees?.length) return [{ key: SEM_RESPONSAVEL, nome: null, avatar: null, profileId: null, clickupId: null }]
  return t.assignees.map((a) => {
    const m = membrosPorClickup?.get(Number(a.id))
    if (m) return { key: `p:${m.id}`, nome: m.nome, avatar: m.avatar || null, profileId: m.id, clickupId: Number(a.id) }
    return { key: `c:${a.id}`, nome: a.nome || `ClickUp ${a.id}`, avatar: null, profileId: null, clickupId: Number(a.id) }
  })
}

/** Enriquecimento único por tarefa (cliente + pessoas resolvidos). */
export function enriquecerTarefas(tarefas, { projetosPorPasta, membrosPorClickup } = {}) {
  return (tarefas || []).map((t) => ({
    ...t,
    cliente: resolverCliente(t, projetosPorPasta),
    pessoas: resolverPessoas(t, membrosPorClickup),
  }))
}

function somaHoras(arr) {
  return round2(arr.reduce((s, t) => s + (Number(t.horas) || 0), 0))
}

function agruparPorDia(tarefas) {
  const map = new Map()
  for (const t of tarefas) {
    if (!map.has(t.dia)) map.set(t.dia, [])
    map.get(t.dia).push(t)
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([dia, lista]) => ({
      dia,
      tarefas: lista.slice().sort((a, b) => (b.concluidaEm || '').localeCompare(a.concluidaEm || '')),
      horas: somaHoras(lista),
    }))
}

function contarClientes(tarefas) {
  const map = new Map()
  for (const t of tarefas) {
    const k = t.cliente
    const c = map.get(k) || { nome: k, tarefas: 0, horas: 0 }
    c.tarefas += 1
    c.horas = round2(c.horas + (Number(t.horas) || 0))
    map.set(k, c)
  }
  return Array.from(map.values()).sort((a, b) => b.tarefas - a.tarefas || b.horas - a.horas)
}

/**
 * Agrega as tarefas (já enriquecidas) do período:
 *  - totais do período
 *  - porPessoa: ranking + relatório de cada colaborador dividido por dia
 *  - porCliente: ranking de quem consumiu mais demandas (com quem atendeu)
 *  - porDia: contagem por dia (para a faixa dos 7 dias)
 * Uma tarefa com dois responsáveis conta uma vez nos totais e no cliente, e
 * aparece no relatório dos dois.
 */
export function agregarConcluidas(tarefas, { dias = [] } = {}) {
  const lista = tarefas || []
  const totalTarefas = lista.length
  const totalHoras = somaHoras(lista)

  // por pessoa
  const pessoas = new Map()
  for (const t of lista) {
    for (const p of t.pessoas) {
      const g = pessoas.get(p.key) || { ...p, tarefas: [] }
      g.tarefas.push(t)
      pessoas.set(p.key, g)
    }
  }
  const porPessoa = Array.from(pessoas.values()).map((g) => {
    const subtarefas = g.tarefas.filter((t) => t.subtarefa).length
    const registradas = g.tarefas.filter((t) => t.tempoRegistrado)
    return {
      key: g.key,
      nome: g.nome,
      avatar: g.avatar,
      profileId: g.profileId,
      clickupId: g.clickupId,
      total: g.tarefas.length,
      horas: somaHoras(g.tarefas),
      horasEstimadas: g.tarefas.filter((t) => t.origem === 'estimativa').length,
      tempoRegistrado: registradas.length ? round2(registradas.reduce((s, t) => s + t.tempoRegistrado, 0)) : null,
      subtarefas,
      clientes: contarClientes(g.tarefas),
      dias: agruparPorDia(g.tarefas),
      pct: totalTarefas ? Math.round((g.tarefas.length / totalTarefas) * 100) : 0,
    }
  }).sort((a, b) => {
    // sem responsável sempre por último
    if (a.key === SEM_RESPONSAVEL) return 1
    if (b.key === SEM_RESPONSAVEL) return -1
    return b.total - a.total || b.horas - a.horas || String(a.nome).localeCompare(String(b.nome), 'pt-BR')
  })

  // por cliente
  const clientes = new Map()
  for (const t of lista) {
    const g = clientes.get(t.cliente) || { nome: t.cliente, tarefas: [] }
    g.tarefas.push(t)
    clientes.set(t.cliente, g)
  }
  const porCliente = Array.from(clientes.values()).map((g) => {
    const quem = new Map()
    for (const t of g.tarefas) for (const p of t.pessoas) {
      const q = quem.get(p.key) || { key: p.key, nome: p.nome, tarefas: 0 }
      q.tarefas += 1
      quem.set(p.key, q)
    }
    return {
      nome: g.nome,
      total: g.tarefas.length,
      horas: somaHoras(g.tarefas),
      pct: totalTarefas ? Math.round((g.tarefas.length / totalTarefas) * 100) : 0,
      pessoas: Array.from(quem.values()).sort((a, b) => b.tarefas - a.tarefas),
      dias: agruparPorDia(g.tarefas),
    }
  }).sort((a, b) => b.total - a.total || b.horas - a.horas || a.nome.localeCompare(b.nome, 'pt-BR'))

  // por dia (inclui dias zerados do intervalo)
  const contDia = new Map()
  for (const t of lista) {
    const c = contDia.get(t.dia) || { dia: t.dia, total: 0, horas: 0 }
    c.total += 1
    c.horas = round2(c.horas + (Number(t.horas) || 0))
    contDia.set(t.dia, c)
  }
  const porDia = (dias.length ? dias : Array.from(contDia.keys()).sort().reverse())
    .map((d) => contDia.get(d) || { dia: d, total: 0, horas: 0 })

  const semResponsavel = pessoas.get(SEM_RESPONSAVEL)?.tarefas.length || 0
  return {
    totais: {
      tarefas: totalTarefas,
      horas: totalHoras,
      pessoas: porPessoa.filter((p) => p.key !== SEM_RESPONSAVEL).length,
      clientes: porCliente.length,
      semResponsavel,
      semEstimativa: lista.filter((t) => t.origem !== 'estimativa').length,
    },
    porPessoa,
    porCliente,
    porDia,
  }
}

/** Filtra tarefas por pessoa (key) e/ou cliente (nome). */
export function aplicarFiltros(tarefas, { pessoa = null, cliente = null } = {}) {
  let out = tarefas || []
  if (pessoa) out = out.filter((t) => t.pessoas.some((p) => p.key === pessoa))
  if (cliente) out = out.filter((t) => norm(t.cliente) === norm(cliente))
  return out
}
