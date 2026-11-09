// Ponte entre as tarefas do VertaTask e o @jaeungkim/gantt-chart (GanttView).
// Puro: converte tarefas em `Task` da biblioteca e traduz a lista que ela devolve em patches de
// `onAtualizar`. A cascata (dependentes e subtarefas andando junto) não mora aqui: os patches vão
// pelo `onAtualizar` do AreaTarefas, que passa pelo useCascata (src/lib/cascata.js).
//
// Datas: a biblioteca lê 'YYYY-MM-DD' como meia-noite UTC e o fim é EXCLUSIVO (um dia só =
// início D, fim D+1). Aqui os dias são locais (America/Sao_Paulo), como no resto do VertaTask.
import { paraISODia, somarDias, diasEntre } from './vertatask'
import { acharStatus, deInputDate } from './tarefas'
import { t as tr } from '../i18n'

const diaDe = (v) => (v ? paraISODia(new Date(v)) : null)
const diaDaLib = (s) => String(s).slice(0, 10)
const fimDaLib = (s) => somarDias(diaDaLib(s), -1)

/** Dias (inclusivos) de uma tarefa; sem início, a barra é só o vencimento. null = sem datas. */
export function diasDaTarefa(it) {
  const venc = diaDe(it.data_vencimento), ini = diaDe(it.data_inicio)
  if (!venc && !ini) return null
  const a = ini || venc, b = venc || ini
  return a <= b ? { a, b } : { a: b, b: a }
}

const porInicio = (lista) => [...lista].sort((x, y) => {
  const a = diasDaTarefa(x).a, b = diasDaTarefa(y).a
  return a < b ? -1 : a > b ? 1 : (x.titulo || '').localeCompare(y.titulo || '', 'pt-BR') || (x.id < y.id ? -1 : 1)
})

/**
 * Tarefas → `Task[]` (só as que têm alguma data).
 * - `relacoes`: linhas de `tarefas_relacoes`; só `bloqueia` vira seta (Fim → Início): a tarefa
 *   bloqueada (`relacionada_id`) espera a que bloqueia (`tarefa_id`).
 * - `ordenar(lista)`: ordem entre irmãs (a da Lista); sem ele, pelo início.
 * - `corDe(it)`: cor da barra; sem ele, a do status em `statuses`.
 * - `plano`: sem hierarquia (subtarefas "Separar" viram linhas soltas).
 * Tarefa-pai sem datas próprias, com subtarefas datadas, entra como resumo delas (a biblioteca
 * calcula a barra pelas filhas; as datas que vão aqui são só para ela ter onde começar) e não move:
 * sem datas no pai, não há deslocamento para a cascata aplicar. As filhas continuam movendo.
 */
export function paraTasks(itens, { statuses = [], relacoes = [], ordenar = porInicio, corDe, plano = false } = {}) {
  const resumoSemDatas = plano ? new Map() : paisSemDatas(itens)
  const comDatas = itens.filter((it) => diasDaTarefa(it) || resumoSemDatas.has(it.id))
  const ids = new Set(comDatas.map((it) => it.id))
  const esperaPor = new Map()
  for (const r of relacoes) {
    if (r.tipo !== 'bloqueia' || !ids.has(r.tarefa_id) || !ids.has(r.relacionada_id)) continue
    if (!esperaPor.has(r.relacionada_id)) esperaPor.set(r.relacionada_id, [])
    esperaPor.get(r.relacionada_id).push({ targetId: r.tarefa_id, type: 'FS' })
  }
  const paiDe = (it) => (!plano && it.parent_id && ids.has(it.parent_id) ? it.parent_id : null)
  // sequence: "2.1" = 1ª filha da 2ª raiz, na ordem de `ordenar`
  const filhas = new Map()
  for (const it of comDatas) {
    const pai = paiDe(it)
    if (!filhas.has(pai)) filhas.set(pai, [])
    filhas.get(pai).push(it)
  }
  const seq = new Map()
  const numerar = (pai, prefixo) => {
    // o pai sem datas ordena pelo período das filhas (como a barra dele)
    const lista = (filhas.get(pai) || []).map((it) => (resumoSemDatas.has(it.id) ? { ...it, data_inicio: deInputDate(resumoSemDatas.get(it.id).a), data_vencimento: deInputDate(resumoSemDatas.get(it.id).b) } : it))
    ordenar(lista).forEach((it, i) => { const s = prefixo ? `${prefixo}.${i + 1}` : String(i + 1); seq.set(it.id, s); numerar(it.id, s) })
  }
  numerar(null, '')
  return comDatas.map((it) => {
    const { a, b } = diasDaTarefa(it) || resumoSemDatas.get(it.id)
    return {
      id: it.id,
      name: it.titulo || tr('tarefas.semTitulo'),
      startDate: a,
      endDate: somarDias(b, 1),
      parentId: paiDe(it),
      sequence: seq.get(it.id),
      color: (corDe ? corDe(it) : acharStatus(statuses, it.status).cor) || undefined,
      ...(it.status_tipo === 'closed' ? { progress: 100 } : {}),
      ...(esperaPor.has(it.id) ? { dependencies: esperaPor.get(it.id) } : {}),
      ...(resumoSemDatas.has(it.id) ? { allowMove: false } : {}),
    }
  })
}

/** Pais sem datas que têm alguma descendente datada em `itens` → { a, b } (o período das descendentes). */
function paisSemDatas(itens) {
  const filhas = new Map()
  for (const it of itens) if (it.parent_id) { if (!filhas.has(it.parent_id)) filhas.set(it.parent_id, []); filhas.get(it.parent_id).push(it) }
  const out = new Map()
  const periodo = (it, vistos = new Set()) => {
    if (vistos.has(it.id)) return null
    vistos.add(it.id)
    let p = diasDaTarefa(it)
    for (const f of filhas.get(it.id) || []) {
      const q = periodo(f, vistos)
      if (q) p = p ? { a: q.a < p.a ? q.a : p.a, b: q.b > p.b ? q.b : p.b } : q
    }
    return p
  }
  for (const it of itens) {
    if (diasDaTarefa(it) || !filhas.has(it.id)) continue
    const p = periodo(it)
    if (p) out.set(it.id, p)
  }
  return out
}

/** Troca só o dia de um instante salvo, mantendo a hora (vencimento com hora continua com hora). */
function trocarDia(original, dia) {
  if (!original) return deInputDate(dia)
  const d = new Date(original)
  const [y, m, dd] = dia.split('-').map(Number)
  d.setFullYear(y, m - 1, dd)
  return d.toISOString()
}

/**
 * Compara a lista que a biblioteca devolveu com a anterior e devolve `[{ id, patch, antes, depois }]`
 * das tarefas cujas datas mudaram (`antes`/`depois` = dias inclusivos `{ a, b }`).
 * O deslocamento que a pessoa fez na barra (início e fim, em dias) é aplicado às datas reais da
 * tarefa, não à barra: a barra de uma tarefa-pai é calculada pelas filhas e pode não bater com
 * as datas gravadas nela. Tarefa que só tinha vencimento e foi só movida continua só com vencimento.
 * O patch leva só o campo que mudou de dia.
 */
export function patchesDeDatas(antes, depois, itensMap) {
  const ant = new Map(antes.map((t) => [t.id, t]))
  const out = []
  for (const t of depois) {
    const v = ant.get(t.id)
    if (!v || (v.startDate === t.startDate && v.endDate === t.endDate)) continue
    const it = itensMap[t.id]
    const real = it && diasDaTarefa(it)
    if (!real) continue
    const dA = diasEntre(diaDaLib(v.startDate), diaDaLib(t.startDate))
    const dB = diasEntre(fimDaLib(v.endDate), fimDaLib(t.endDate))
    const a = somarDias(real.a, dA), b = somarDias(real.b, dB)
    const patch = {}
    const soVencimento = !it.data_inicio && a === b
    if (!soVencimento) patch.data_inicio = trocarDia(it.data_inicio || it.data_vencimento, a)
    if (it.data_vencimento || !soVencimento) patch.data_vencimento = trocarDia(it.data_vencimento || it.data_inicio, b)
    if (patch.data_inicio && diaDe(patch.data_inicio) === diaDe(it.data_inicio)) delete patch.data_inicio
    if (patch.data_vencimento && diaDe(patch.data_vencimento) === diaDe(it.data_vencimento)) delete patch.data_vencimento
    if (Object.keys(patch).length) out.push({ id: t.id, patch, antes: real, depois: { a, b } })
  }
  return out
}

/** Setas da lista da biblioteca como chaves "quemBloqueia>bloqueada". */
export function chavesDependencias(tasks) {
  return new Set(tasks.flatMap((t) => (t.dependencies || []).filter((d) => d.type === 'FS').map((d) => `${d.targetId}>${t.id}`)))
}
