// Replanejamento em cascata na tela: no lugar do atualizarTarefa quando o patch mexe em data.
// Carrega a família da tarefa e quem ela bloqueia, monta o plano (src/lib/cascata.js), pergunta
// se as dependentes andam junto e grava tudo. Mexeu só no pai (nenhuma outra andou) = grava sem
// perguntar e avisa a nova entrega. Edição em massa, webhook e rodada não passam por aqui.
import { useCallback } from 'react'
import { CalendarClock } from 'lucide-react'
import { planejarCascata, mexeEmData, fmtDia, rotuloDelta } from '../lib/cascata'

const COLS = 'id,parent_id,titulo,status_tipo,arquivada,data_inicio,data_vencimento,inicio_com_hora,vencimento_com_hora'
const CAMPOS = COLS.split(',')
const LOTE = 150
const lotes = (ids) => Array.from({ length: Math.ceil(ids.length / LOTE) }, (_, i) => ids.slice(i * LOTE, (i + 1) * LOTE))

/**
 * Família (da raiz para baixo) da tarefa e de cada tarefa que ela bloqueia, em cadeia, mais as
 * relações 'bloqueia'. `locais` (id → tarefa na tela) vence o banco: a tela pode estar à frente.
 */
export async function carregarGrafoCascata(sb, id, locais = {}) {
  const itens = new Map()
  const relacoes = new Map()
  const raizesVistas = new Set()
  const ler = async (coluna, ids) => {
    const out = []
    for (const l of lotes(ids)) {
      const { data, error } = await sb.from('tarefas_itens').select(COLS).in(coluna, l)
      if (error) throw error
      out.push(...(data || []))
    }
    for (const r of out) itens.set(r.id, r)
    return out
  }
  let pendentes = [id]
  for (let rodada = 0; pendentes.length && rodada < 8 && itens.size < 800; rodada++) {
    await ler('id', pendentes.filter((x) => !itens.has(x)))
    const raizes = new Set()
    for (const x of pendentes) {
      let t = itens.get(x)
      while (t?.parent_id) {
        if (!itens.has(t.parent_id)) await ler('id', [t.parent_id])
        if (!itens.has(t.parent_id)) break
        t = itens.get(t.parent_id)
      }
      if (t) raizes.add(t.id)
    }
    let nivel = [...raizes].filter((r) => !raizesVistas.has(r))
    for (const r of nivel) raizesVistas.add(r)
    while (nivel.length) nivel = (await ler('parent_id', nivel)).filter((f) => !f.arquivada).map((f) => f.id)
    for (const l of lotes([...itens.keys()])) {
      const { data, error } = await sb.from('tarefas_relacoes').select('tarefa_id,relacionada_id,tipo').eq('tipo', 'bloqueia').in('tarefa_id', l)
      if (error) throw error
      for (const r of data || []) relacoes.set(`${r.tarefa_id}>${r.relacionada_id}`, r)
    }
    pendentes = [...new Set([...relacoes.values()].map((r) => r.relacionada_id))].filter((x) => !itens.has(x))
  }
  for (const [k, v] of itens) {
    const l = locais[k]
    if (l) itens.set(k, { ...v, ...Object.fromEntries(CAMPOS.filter((c) => c in l).map((c) => [c, l[c]])) })
  }
  return { itens, relacoes: [...relacoes.values()] }
}

/** Linhas "04/11 → 09/11 · Título" para o diálogo de confirmação. */
export const linhasDoPlano = (outras, nome) => outras.map((o) => `${fmtDia(dataPrincipal({}, o.antes))} → ${fmtDia(dataPrincipal(o.patch, o.antes))} · ${nome(o.id)}`)

/** Grava cada alteração; devolve quantas falharam e o primeiro erro. */
export async function gravarTudo(alteracoes, gravar) {
  const res = await Promise.all(alteracoes.map((o) => gravar(o.id, o.patch)))
  const erros = res.filter((x) => x?.error)
  return { falhas: erros.length, erro: erros[0]?.error || null }
}

const dataPrincipal = (p, antes) => ('data_vencimento' in p ? p.data_vencimento : antes?.data_vencimento) || ('data_inicio' in p ? p.data_inicio : antes?.data_inicio)
export const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`

/**
 * carregarGrafo(id) → { itens: Map, relacoes }; gravar(id, patch) → { error? };
 * confirmar = useConfirmar(); avisar(msg, tipo?) = showToast.
 * Devolve atualizar(id, patch) → { error? } | { cancelado: true }.
 */
export function useCascata({ carregarGrafo, gravar, confirmar, avisar }) {
  return useCallback(async (id, patch) => {
    if (!mexeEmData(patch)) return gravar(id, patch)
    let grafo
    try {
      grafo = await carregarGrafo(id)
    } catch (e) {
      console.error('Cascata: não deu para ler as dependências, gravando só a tarefa', e)
      return gravar(id, patch)
    }
    let plano = planejarCascata({ ...grafo, id, patch })
    const nome = (tid) => grafo.itens.get(tid)?.titulo || 'Sem título'
    const andam = plano.outras.filter((o) => o.motivo !== 'pai')
    if (andam.length) {
      // a entrega = o pai mais alto que muda
      const pai = plano.outras.filter((o) => o.motivo === 'pai').at(-1)
      const nDep = andam.filter((o) => o.motivo === 'dependente').length
      const nSub = andam.length - nDep
      const quem = [nDep && plural(nDep, 'tarefa que depende dela', 'tarefas que dependem dela'), nSub && plural(nSub, 'subtarefa aberta', 'subtarefas abertas')].filter(Boolean).join(' e ')
      const resp = await confirmar({
        icone: CalendarClock,
        titulo: `${plano.delta > 0 ? 'Empurrar' : 'Antecipar'} ${nDep ? 'as tarefas seguintes' : 'as subtarefas'}?`,
        texto: `“${nome(id)}” mudou ${rotuloDelta(plano.delta)}. ${quem[0].toUpperCase()}${quem.slice(1)} ${andam.length === 1 ? 'anda' : 'andam'} junto, mantendo a distância entre elas.`
          + (pai ? ` A entrega “${nome(pai.id)}” passa de ${fmtDia(dataPrincipal({}, pai.antes))} para ${fmtDia(dataPrincipal(pai.patch, pai.antes))}.` : ''),
        rotuloItens: 'Novas datas',
        itens: linhasDoPlano(andam, nome),
        maxItens: 6,
        acao: `Mover ${plural(andam.length, 'tarefa', 'tarefas')}`,
        acaoSecundaria: 'Só esta tarefa',
      })
      if (!resp) return { cancelado: true }
      if (resp === 'secundaria') plano = planejarCascata({ ...grafo, id, patch, deslocar: false })
    }
    const r = await gravar(id, plano.origem)
    if (r?.error) return r
    const { falhas, erro } = await gravarTudo(plano.outras, gravar)
    if (falhas) { avisar?.(`${plural(falhas, 'tarefa não foi atualizada', 'tarefas não foram atualizadas')}: ${erro}`, 'error'); return {} }
    const movidas = plano.outras.filter((o) => o.motivo !== 'pai').length
    const pai = plano.outras.filter((o) => o.motivo === 'pai').at(-1)
    const entrega = pai ? `entrega “${nome(pai.id)}” em ${fmtDia(dataPrincipal(pai.patch, pai.antes))}` : ''
    if (movidas) avisar?.(`${plural(movidas, 'tarefa movida', 'tarefas movidas')} ${rotuloDelta(plano.delta)}${entrega ? ` · ${entrega}` : ''}`)
    else if (entrega) avisar?.(`${entrega[0].toUpperCase()}${entrega.slice(1)}`)
    return {}
  }, [carregarGrafo, gravar, confirmar, avisar])
}
