// Replanejamento em cascata do VertaTask. Mudar a data de uma tarefa desloca, na mesma
// quantidade de dias úteis, as que ela bloqueia (tarefas_relacoes tipo 'bloqueia', em cadeia)
// e as subtarefas dela; depois cada tarefa pai acima de quem mudou é recalculada pelas filhas
// (início = o mais cedo, vencimento = o mais tarde). A data que a pessoa escolheu fica como ela
// escolheu. Concluídas e arquivadas não andam. Puro: quem chama carrega o grafo, confirma com a
// pessoa e grava (useCascata). Dia útil = segunda a sexta, como nos templates.
import { paraData, datasCoerentes } from './tarefas'

const DATAS = ['data_inicio', 'data_vencimento']
const COM_HORA = { data_inicio: 'inicio_com_hora', data_vencimento: 'vencimento_com_hora' }

const util = (d) => d.getDay() !== 0 && d.getDay() !== 6
const aberta = (t) => !!t && !t.arquivada && t.status_tipo !== 'closed'
export const mexeEmData = (patch) => DATAS.some((k) => k in (patch || {}))

/** Meia-noite local do dia útil de d (sábado e domingo contam como a segunda seguinte). */
function diaUtil(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  while (!util(x)) x.setDate(x.getDate() + 1)
  return x
}

/** Dias úteis de a até b, com sinal (b antes de a = negativo). */
export function diferencaUteis(a, b) {
  const da = paraData(a), db = paraData(b)
  if (!da || !db) return null
  const x = diaUtil(da), y = diaUtil(db)
  const sinal = y < x ? -1 : 1
  const d = new Date(sinal > 0 ? x : y)
  const fim = sinal > 0 ? y : x
  let n = 0
  while (d < fim) { d.setDate(d.getDate() + 1); if (util(d)) n++ }
  return n * sinal
}

/** iso + n dias úteis (n com sinal), mantendo a hora do dia. */
export function deslocarUteis(iso, n) {
  const d = paraData(iso)
  if (!d || !n) return iso
  const alvo = diaUtil(d)
  let falta = Math.abs(n)
  while (falta > 0) { alvo.setDate(alvo.getDate() + Math.sign(n)); if (util(alvo)) falta-- }
  const meiaNoite = new Date(d); meiaNoite.setHours(0, 0, 0, 0)
  const out = new Date(d)
  out.setDate(out.getDate() + Math.round((alvo - meiaNoite) / 864e5))
  return out.toISOString()
}

const mesmoInstante = (a, b) => (paraData(a)?.getTime() ?? null) === (paraData(b)?.getTime() ?? null)
const mesmoDia = (a, b) => {
  const x = paraData(a), y = paraData(b)
  return !x || !y ? x === y : x.toDateString() === y.toDateString()
}

/**
 * Plano da cascata para `patch` na tarefa `id`.
 * itens: Map ou objeto id → tarefa (id, parent_id, titulo, status_tipo, arquivada, datas e *_com_hora),
 *        com a família inteira e quem ela bloqueia. relacoes: linhas de tarefas_relacoes.
 * deslocar: false = só recalcula os pais ("Só esta tarefa").
 * Devolve { origem: patch final da tarefa, delta, outras: [{ id, patch, motivo, antes }] },
 * motivo 'dependente' | 'subtarefa' | 'pai'.
 */
export function planejarCascata({ itens, relacoes = [], id, patch, deslocar = true }) {
  const porId = itens instanceof Map ? itens : new Map(Object.entries(itens || {}))
  const origem = porId.get(id)
  if (!origem) return { origem: patch, delta: 0, outras: [] }

  const filhos = new Map()
  for (const t of porId.values()) {
    if (!t.parent_id || t.arquivada) continue
    if (!filhos.has(t.parent_id)) filhos.set(t.parent_id, [])
    filhos.get(t.parent_id).push(t.id)
  }
  const bloqueia = new Map()
  for (const r of relacoes) {
    if (r.tipo !== 'bloqueia' || !porId.has(r.relacionada_id)) continue
    if (!bloqueia.has(r.tarefa_id)) bloqueia.set(r.tarefa_id, [])
    bloqueia.get(r.tarefa_id).push(r.relacionada_id)
  }

  const patchOrigem = datasCoerentes(origem, patch)
  const novos = new Map([[id, patchOrigem]])
  const motivos = new Map()
  const atual = (tid) => ({ ...porId.get(tid), ...(novos.get(tid) || {}) })

  // quanto a pessoa moveu, em dias úteis, na data que ela mexeu (o vencimento manda)
  const chave = 'data_vencimento' in patch ? 'data_vencimento' : 'data_inicio'
  const delta = deslocar && mexeEmData(patch) ? (diferencaUteis(origem[chave], patchOrigem[chave]) || 0) : 0

  if (delta) {
    const movidas = new Set([id])
    const fila = [id]
    const mover = (tid, motivo) => {
      if (movidas.has(tid)) return
      const t = porId.get(tid)
      if (!aberta(t)) return
      movidas.add(tid)
      const p = {}
      for (const k of DATAS) if (t[k]) p[k] = deslocarUteis(t[k], delta)
      if (Object.keys(p).length) { novos.set(tid, datasCoerentes(t, p)); motivos.set(tid, motivo) }
      fila.push(tid)
    }
    while (fila.length) {
      const tid = fila.shift()
      for (const f of filhos.get(tid) || []) mover(f, 'subtarefa')
      for (const b of bloqueia.get(tid) || []) mover(b, 'dependente')
    }
  }

  // pais de quem mudou, do mais fundo para cima; a origem não é recalculada (a pessoa escolheu)
  const profundidade = (tid) => { let n = 0; for (let p = porId.get(tid)?.parent_id; p && porId.has(p); p = porId.get(p).parent_id) n++; return n }
  const pais = new Set()
  for (const tid of novos.keys()) {
    for (let p = porId.get(tid)?.parent_id; p && porId.has(p); p = porId.get(p).parent_id) if (p !== id) pais.add(p)
  }
  for (const pid of [...pais].sort((a, b) => profundidade(b) - profundidade(a))) {
    if (!aberta(porId.get(pid))) continue
    const fs = (filhos.get(pid) || []).map(atual)
    const pai = atual(pid)
    const p = {}
    for (const k of DATAS) {
      // filha só com uma das datas é um ponto nela (no template quase toda subtarefa só vence)
      const outra = k === 'data_inicio' ? 'data_vencimento' : 'data_inicio'
      const pontos = fs.map((f) => (paraData(f[k]) ? [f[k], f[COM_HORA[k]]] : paraData(f[outra]) ? [f[outra], f[COM_HORA[outra]]] : null)).filter(Boolean)
      if (!pontos.length) continue
      const [iso, comHora] = pontos.reduce((a, b) => {
        const ta = paraData(a[0]).getTime(), tb = paraData(b[0]).getTime()
        return k === 'data_inicio' ? (tb < ta ? b : a) : (tb > ta ? b : a)
      })
      // sem hora, o dia é o que conta: o ClickUp grava às 04:00 e a tela ao meio-dia
      const igual = comHora || pai[COM_HORA[k]] ? mesmoInstante(iso, pai[k]) : mesmoDia(iso, pai[k])
      if (!igual) { p[k] = iso; p[COM_HORA[k]] = !!comHora }
    }
    if (Object.keys(p).length) {
      novos.set(pid, { ...(novos.get(pid) || {}), ...datasCoerentes(pai, p) })
      if (!motivos.has(pid)) motivos.set(pid, 'pai')
    }
  }

  const outras = []
  for (const [tid, p] of novos) {
    if (tid === id) continue
    const t = porId.get(tid)
    outras.push({ id: tid, patch: p, motivo: motivos.get(tid), antes: { data_inicio: t.data_inicio ?? null, data_vencimento: t.data_vencimento ?? null } })
  }
  return { origem: patchOrigem, delta, outras }
}

const DIA = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })
export const fmtDia = (v) => (paraData(v) ? DIA.format(paraData(v)) : 'sem data')

/** "+3 dias úteis" / "-1 dia útil". */
export function rotuloDelta(n) {
  const abs = Math.abs(n)
  return `${n > 0 ? '+' : '-'}${abs} ${abs === 1 ? 'dia útil' : 'dias úteis'}`
}

// ─── Entrega: atrasadas e conflitos de dependência ──────────────────────────────

const dia = (v) => { const d = paraData(v); if (!d) return null; const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime() }
const mapaDe = (itens) => new Map(itens instanceof Map ? itens : Object.entries(itens || {}))

/** Aberta e com vencimento antes de hoje. */
export const atrasadaEm = (t, hoje = new Date()) => aberta(t) && dia(t.data_vencimento) != null && dia(t.data_vencimento) < dia(hoje)

function grafoBloqueia(relacoes) {
  const g = new Map()
  for (const r of relacoes || []) if (r.tipo === 'bloqueia') { if (!g.has(r.tarefa_id)) g.set(r.tarefa_id, []); g.get(r.tarefa_id).push(r.relacionada_id) }
  return g
}

/** Raiz da família (o pai mais alto que está no mapa) e todos os ids dela, raiz incluída. */
export function familia(itens, id) {
  const porId = mapaDe(itens)
  let raiz = porId.get(id)
  while (raiz?.parent_id && porId.has(raiz.parent_id)) raiz = porId.get(raiz.parent_id)
  const filhos = new Map()
  for (const t of porId.values()) if (t.parent_id && !t.arquivada) { if (!filhos.has(t.parent_id)) filhos.set(t.parent_id, []); filhos.get(t.parent_id).push(t.id) }
  const ids = []
  const fila = raiz ? [raiz.id] : []
  while (fila.length) { const x = fila.shift(); ids.push(x); fila.push(...(filhos.get(x) || [])) }
  return { raizId: raiz?.id ?? null, ids, filhos }
}

/**
 * Cascatas em série: cada candidata que nenhuma outra candidata alcança pelas relações, em
 * ordem de vencimento, recebe o vencimento de `novoVenc(tarefa, mapa)` (null = deixa) e as
 * dependentes andam; cada cascata já conta o que as anteriores moveram.
 */
function cascatasEmSerie({ itens, relacoes, candidatas, novoVenc, motivo }) {
  const original = mapaDe(itens)
  const mapa = mapaDe(itens)
  const g = grafoBloqueia(relacoes)
  // como na cascata, concluída não passa o deslocamento adiante
  const alcanca = (de, alvo) => {
    const vistos = new Set([de]); const fila = [de]
    while (fila.length) {
      for (const x of g.get(fila.shift()) || []) {
        if (x === alvo) return true
        if (!vistos.has(x) && aberta(mapa.get(x))) { vistos.add(x); fila.push(x) }
      }
    }
    return false
  }
  const raizes = candidatas
    .filter((c) => !candidatas.some((o) => o !== c && alcanca(o, c)))
    .sort((a, b) => (dia(mapa.get(a)?.data_vencimento) ?? 0) - (dia(mapa.get(b)?.data_vencimento) ?? 0))
  const patches = new Map(), motivos = new Map()
  const guardar = (tid, p, m) => {
    patches.set(tid, { ...(patches.get(tid) || {}), ...p })
    if (!motivos.has(tid)) motivos.set(tid, m)
    mapa.set(tid, { ...mapa.get(tid), ...p })
  }
  for (const r of raizes) {
    const venc = novoVenc(mapa.get(r), mapa)
    if (!venc) continue
    const pl = planejarCascata({ itens: mapa, relacoes, id: r, patch: { data_vencimento: venc } })
    guardar(r, pl.origem, motivo)
    for (const o of pl.outras) guardar(o.id, o.patch, o.motivo)
  }
  return {
    raizes,
    outras: [...patches].map(([id, patch]) => {
      const t = original.get(id)
      return { id, patch, motivo: motivos.get(id), antes: { data_inicio: t?.data_inicio ?? null, data_vencimento: t?.data_vencimento ?? null } }
    }),
  }
}

/** "Replanejar a partir de hoje": cada atrasada da família (sem contar pais) vence hoje e as dependentes andam junto. */
export function planejarReplanejamento({ itens, relacoes = [], id, hoje = new Date() }) {
  const { ids, filhos } = familia(itens, id)
  const porId = mapaDe(itens)
  const candidatas = ids.filter((x) => !filhos.has(x) && atrasadaEm(porId.get(x), hoje))
  return cascatasEmSerie({
    itens, relacoes, candidatas, motivo: 'atrasada',
    novoVenc: (t) => (atrasadaEm(t, hoje) ? deslocarUteis(t.data_vencimento, diferencaUteis(t.data_vencimento, hoje)) : null),
  })
}

/** Dependente aberta que vence antes de quem a bloqueia (também aberta). `ids` limita às dependentes desses ids. */
export function conflitosDependencia({ itens, relacoes = [], ids = null }) {
  const porId = mapaDe(itens)
  const dentro = ids ? new Set(ids) : null
  const out = []
  for (const r of relacoes) {
    if (r.tipo !== 'bloqueia') continue
    const a = porId.get(r.tarefa_id), b = porId.get(r.relacionada_id)
    if (!aberta(a) || !aberta(b) || (dentro && !dentro.has(b.id))) continue
    if (dia(b.data_vencimento) != null && dia(a.data_vencimento) != null && dia(b.data_vencimento) < dia(a.data_vencimento)) {
      out.push({ id: b.id, bloqueadora: a.id, dias: diferencaUteis(b.data_vencimento, a.data_vencimento) })
    }
  }
  return out
}

/** "Ajustar dependências": a dependente em conflito passa a vencer junto com quem a bloqueia, e as seguintes andam. */
export function planejarAjusteConflitos({ itens, relacoes = [], id }) {
  const { ids } = familia(itens, id)
  const candidatas = [...new Set(conflitosDependencia({ itens, relacoes, ids }).map((c) => c.id))]
  return cascatasEmSerie({
    itens, relacoes, candidatas, motivo: 'conflito',
    novoVenc: (t, mapa) => {
      const maior = Math.max(0, ...conflitosDependencia({ itens: mapa, relacoes, ids: [t.id] }).map((c) => c.dias))
      return maior ? deslocarUteis(t.data_vencimento, maior) : null
    },
  })
}
