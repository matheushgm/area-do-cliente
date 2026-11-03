// Visualização "Gantt" com o @jaeungkim/gantt-chart: arrastar a barra muda as datas, as bordas mudam
// a duração e os pontos nas pontas ligam duas tarefas ("bloqueia"). Subtarefas ficam sob o pai, cuja
// barra a biblioteca calcula pelas filhas (como a cascata recalcula o pai). Toda mudança de data vai
// pelo `ctx.onAtualizar`, o mesmo da Lista: passa pela cascata (pergunta antes de mover as seguintes)
// e segue para o ClickUp pela outbox. Clique abre a tarefa; Ctrl+Z desfaz o último gesto daqui.
// A lista à esquerda (nome + colunas da view, recolher, arrastar linhas) é nossa (GanttLista); a
// biblioteca fica só com a linha do tempo e a rolagem vertical é a dela.
// Ponte de dados em src/lib/gantt.js. Carregado sob demanda pelo AreaTarefas (a biblioteca só entra
// quando alguém abre a aba Gantt).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ReactGanttChart } from '@jaeungkim/gantt-chart'
import '@jaeungkim/gantt-chart/style.css'
import { CalendarCheck, ChevronsDownUp, ChevronsUpDown, Columns3, Maximize2, Undo2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { acharStatus, ordenarItens, ordenarPorCampo } from '../../lib/tarefas'
import { paraTasks, patchesDeDatas, chavesDependencias } from '../../lib/gantt'
import { COLUNAS_GANTT, OCULTAS_GANTT, colunasDaView } from '../../lib/viewsTarefas'
import GanttLista from './GanttLista'
import EditorColunas from './ColunasLista'
import { Popover } from './Campos'

const ESCALAS = [{ v: 'day', l: 'Dia' }, { v: 'week', l: 'Semana' }, { v: 'month', l: 'Mês' }, { v: 'quarter', l: 'Trimestre' }]
const CHAVE_ESCALA = 'tarefas.gantt.escala'
const lerEscala = () => { try { const v = localStorage.getItem(CHAVE_ESCALA); return ESCALAS.some((e) => e.v === v) ? v : 'week' } catch { return 'week' } }
const LOTE = 150
const ALTURA_LINHA = 36

// "Ordenar por" do Gantt: gravado no `ordenar` da view do Gantt (rascunho, como na Lista). Sem
// ordenação gravada (ou com uma que o Gantt não oferece) = Início, a ordem natural de um cronograma;
// Manual = `posicao`, a mesma das setas da Lista. Arrastar uma linha em Início ou Vencimento passa
// para Manual, congelando a ordem que está na tela.
const ORDENS = [{ v: 'inicio', l: 'Início' }, { v: 'venc', l: 'Vencimento' }, { v: 'manual', l: 'Manual' }]
const ORDEM_PADRAO = { campo: 'inicio', dir: 1 }
const posDe = (it) => Number(it?.posicao) || 0
const PASSO = 1000

// Tokens da biblioteca a partir dos --ln-* (seguem .vt e .dark sozinhos).
const TEMA = {
  '--gantt-font-sans': 'inherit',
  '--gantt-background': 'rgb(var(--ln-bg))',
  '--gantt-foreground': 'rgb(var(--ln-t1))',
  '--gantt-muted': 'rgb(var(--ln-panel))',
  '--gantt-muted-foreground': 'rgb(var(--ln-t3))',
  '--gantt-border': 'rgb(var(--ln-border))',
  '--gantt-border-subtle': 'rgb(var(--ln-ink) / 0.05)',
  '--gantt-accent': 'rgb(var(--ln-accent))',
  '--gantt-arrow': 'rgb(var(--ln-t3))',
  '--gantt-today-marker': 'rgb(var(--ln-accent))',
  '--gantt-non-working-bg': 'rgb(var(--ln-ink) / 0.03)',
  '--gantt-summary-bg': 'rgb(var(--ln-ink) / 0.16)',
  '--gantt-summary-bg-hover': 'rgb(var(--ln-ink) / 0.22)',
  '--gantt-bar-bg': 'rgb(var(--ln-ink) / 0.2)',
}

function useEscuro() {
  const [escuro, setEscuro] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    const ob = new MutationObserver(() => setEscuro(document.documentElement.classList.contains('dark')))
    ob.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => ob.disconnect()
  }, [])
  return escuro
}

/** Relações "bloqueia" entre as tarefas da tela (as duas pontas precisam estar nela). */
async function lerRelacoes(ids) {
  const out = []
  for (let i = 0; i < ids.length; i += LOTE) {
    const { data, error } = await supabase.from('tarefas_relacoes').select('tarefa_id,relacionada_id,tipo').eq('tipo', 'bloqueia').in('tarefa_id', ids.slice(i, i + LOTE))
    if (error) throw error
    out.push(...(data || []))
  }
  const set = new Set(ids)
  return out.filter((r) => set.has(r.relacionada_id))
}

/**
 * itens: tarefas da view (as de cima, ou todas em "Separar"); filhosDe: subtarefas por pai (sem ele,
 * só o que vem em `itens`). relacoes / onCriarRelacao / onApagarRelacao: só para harness sem banco;
 * sem eles lê e grava `tarefas_relacoes` e chama `agendarPush` para a fila ir ao ClickUp.
 */
export default function GanttView({
  itens, ctx, filhosDe = null, mostrarConcluidas = true, altura = 560, userId = null, agendarPush, avisar,
  relacoes: relacoesFixas = null, onCriarRelacao, onApagarRelacao,
}) {
  const ref = useRef(null)
  const escuro = useEscuro()
  const [escala, setEscala] = useState(lerEscala)
  const mudarEscala = (v) => { setEscala(v); try { localStorage.setItem(CHAVE_ESCALA, v) } catch { /* sem storage */ } }
  const plano = !!ctx.nomePai // "Separar": cada subtarefa é uma linha solta

  // tarefas da view + subtarefas abertas (ou todas, com concluídas), em qualquer profundidade
  const linhas = useMemo(() => {
    const vistos = new Set()
    const out = []
    const pegar = (it) => {
      if (vistos.has(it.id) || it.arquivada) return
      vistos.add(it.id); out.push(it)
      if (!plano && filhosDe) for (const f of filhosDe.get(it.id) || []) if (mostrarConcluidas || f.status_tipo !== 'closed') pegar(f)
    }
    for (const it of itens) pegar(it)
    return out
  }, [itens, filhosDe, plano, mostrarConcluidas])
  const mapa = useMemo(() => ({ ...(ctx.itensMap || {}), ...Object.fromEntries(linhas.map((i) => [i.id, i])) }), [ctx.itensMap, linhas])

  // relações do banco (ou as do harness)
  const chaveIds = useMemo(() => linhas.map((i) => i.id).sort().join(','), [linhas])
  const [relacoesBanco, setRelacoesBanco] = useState([])
  useEffect(() => {
    if (relacoesFixas || !supabase || !chaveIds) return undefined
    let vivo = true
    lerRelacoes(chaveIds.split(',')).then((r) => { if (vivo) setRelacoesBanco(r) }).catch((e) => console.error('Gantt: relações', e))
    return () => { vivo = false }
  }, [chaveIds, relacoesFixas])
  const relacoes = relacoesFixas || relacoesBanco

  const ordem = ORDENS.some((o) => o.v === ctx.ordenar?.campo) ? ctx.ordenar : ORDEM_PADRAO
  const manual = ordem.campo === 'manual'
  const mudarOrdem = (campo) => ctx.onOrdenar?.(campo === ORDEM_PADRAO.campo ? null : { campo, dir: 1 })
  const ordenar = useCallback((lista) => (manual ? ordenarItens(lista) : ordenarPorCampo(lista, ordem, ctx)), [manual, ordem, ctx])
  const corDe = useCallback((it) => acharStatus(ctx.statusesDe ? ctx.statusesDe(it) : ctx.statuses, it.status).cor, [ctx])
  const base = useMemo(() => paraTasks(linhas, { relacoes, ordenar, corDe, plano }), [linhas, relacoes, ordenar, corDe, plano])
  const semDatas = linhas.length - base.length

  // Recolher/expandir: começa como o modo de subtarefas da view (Expandidas abre tudo; Recolhidas,
  // o padrão, mostra só as tarefas de cima com a barra-resumo de cada uma). As setas de cada linha
  // e o botão da barra mudam só a tela; trocar o modo na view recomeça.
  const pais = useMemo(() => [...new Set(base.filter((t) => t.parentId).map((t) => t.parentId))], [base])
  const [recolhidos, setRecolhidos] = useState(null) // null = o que a view diz
  useEffect(() => { setRecolhidos(null) }, [ctx.expandirTudo])
  const collapsedIds = useMemo(() => recolhidos ?? (ctx.expandirTudo ? [] : pais), [recolhidos, ctx.expandirTudo, pais])
  const algumRecolhido = useMemo(() => { const s = new Set(pais); return collapsedIds.some((id) => s.has(id)) }, [collapsedIds, pais])
  const alternar = useCallback((id) => setRecolhidos((r) => { const atual = r ?? collapsedIds; return atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id] }), [collapsedIds])

  // colunas da lista à esquerda (config.colunasGantt da view)
  const colunas = useMemo(() => colunasDaView(ctx.colunasGantt, COLUNAS_GANTT, OCULTAS_GANTT), [ctx.colunasGantt])
  const colsVisiveis = useMemo(() => colunas.filter((c) => !c.oculta).map((c) => c.k), [colunas])
  const ctxLista = useMemo(() => ({
    ...ctx,
    listasMap: new Map((ctx.listas || []).map((l) => [l.id, l])),
    pastasMap: new Map((ctx.pastas || []).map((p) => [p.id, p])),
    projetosMap: new Map((ctx.projetos || []).map((p) => [p.id, p])),
    rotuloColuna: (k) => ({ inicio: 'Início', venc: 'Vencimento', duracao: 'Duração', estim: 'Estimativa', tipo: 'Tipo', concluida: 'Conclusão', criada: 'Criada' })[k] || COLUNAS_GANTT.find((c) => c.k === k)?.label || k,
  }), [ctx])
  const [colunasAbertas, setColunasAbertas] = useState(false)
  const botaoColunas = useRef(null)

  // Enquanto a gravação (e a pergunta da cascata) não termina, a tela mostra o que a pessoa fez;
  // depois volta a seguir as tarefas. Cancelou a cascata = a barra volta para onde estava.
  const [otimista, setOtimista] = useState(null)
  const tasks = otimista || base

  // linhas da lista na mesma ordem da linha do tempo: por `sequence`, sem as filhas de quem está recolhido
  const visiveis = useMemo(() => {
    const filhas = new Map()
    for (const t of tasks) { if (!filhas.has(t.parentId)) filhas.set(t.parentId, []); filhas.get(t.parentId).push(t) }
    const seq = (x) => x.split('.').map(Number)
    const porSeq = (a, b) => { const x = seq(a.sequence), y = seq(b.sequence); for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0); return 0 }
    const recolhidosSet = new Set(collapsedIds)
    const out = []
    const andar = (pai, depth) => {
      for (const t of (filhas.get(pai) || []).sort(porSeq)) {
        const temFilhos = !plano && (filhas.get(t.id) || []).length > 0
        const recolhido = temFilhos && recolhidosSet.has(t.id)
        if (mapa[t.id]) out.push({ id: t.id, item: mapa[t.id], depth, temFilhos, recolhido, parentId: t.parentId })
        if (temFilhos && !recolhido) andar(t.id, depth + 1)
      }
    }
    andar(null, 0)
    return out
  }, [tasks, collapsedIds, plano, mapa])

  // a rolagem vertical é a da linha do tempo; a lista acompanha
  const [rolagem, setRolagem] = useState({ top: 0, altura: 400, cabecalho: 73 })
  // escuta a rolagem em captura no contêiner da linha do tempo: o elemento que rola é interno da
  // biblioteca e pode ser trocado por ela
  const caixaGrafico = useRef(null)
  const elRolagem = () => caixaGrafico.current?.querySelector('.gantt-scroll-container') || ref.current?.getScrollElement?.() || null
  const temGrafico = base.length > 0
  useEffect(() => {
    const caixa = caixaGrafico.current
    if (!caixa) return undefined
    const medir = () => {
      const el = elRolagem()
      if (!el) return
      const cab = el.querySelector('.gantt-header-wrapper')?.offsetHeight || 73
      setRolagem((r) => (r.top === el.scrollTop && r.altura === el.clientHeight - cab && r.cabecalho === cab ? r : { top: el.scrollTop, altura: el.clientHeight - cab, cabecalho: cab }))
    }
    const quadro = requestAnimationFrame(medir)
    caixa.addEventListener('scroll', medir, true)
    const ro = new ResizeObserver(medir)
    ro.observe(caixa)
    return () => { cancelAnimationFrame(quadro); caixa.removeEventListener('scroll', medir, true); ro.disconnect() }
  }, [temGrafico])
  const rolar = useCallback((dy) => { const el = elRolagem(); if (el) el.scrollTop += dy }, [])
  const [pilha, setPilha] = useState([]) // desfazer: { tipo: 'datas', id, antes } | { tipo: 'rel+'|'rel-', de, para }
  const ocupado = useRef(false)

  const criarRelacao = useCallback(async (de, para) => {
    if (onCriarRelacao) return onCriarRelacao(de, para)
    const { error } = await supabase.from('tarefas_relacoes').insert({ tarefa_id: de, relacionada_id: para, tipo: 'bloqueia', criado_por: userId })
    if (error && error.code !== '23505') return { error: error.message }
    setRelacoesBanco((r) => [...r, { tarefa_id: de, relacionada_id: para, tipo: 'bloqueia' }])
    agendarPush?.()
    return {}
  }, [onCriarRelacao, userId, agendarPush])
  const apagarRelacao = useCallback(async (de, para) => {
    if (onApagarRelacao) return onApagarRelacao(de, para)
    const { error } = await supabase.from('tarefas_relacoes').delete().eq('tarefa_id', de).eq('relacionada_id', para).eq('tipo', 'bloqueia')
    if (error) return { error: error.message }
    setRelacoesBanco((r) => r.filter((x) => !(x.tarefa_id === de && x.relacionada_id === para)))
    agendarPush?.()
    return {}
  }, [onApagarRelacao, agendarPush])

  const aoMudar = useCallback(async (next) => {
    if (ocupado.current) return
    const datas = patchesDeDatas(base, next, mapa)
    const antesDeps = chavesDependencias(base), depoisDeps = chavesDependencias(next)
    const novas = [...depoisDeps].filter((k) => !antesDeps.has(k)).map((k) => k.split('>'))
    const removidas = [...antesDeps].filter((k) => !depoisDeps.has(k)).map((k) => k.split('>'))
    if (!datas.length && !novas.length && !removidas.length) return
    ocupado.current = true
    setOtimista(next)
    try {
      // mover o pai leva as filhas na tela; aqui grava só quem a pessoa mexeu e a cascata leva o resto
      const mudou = new Set(datas.map((d) => d.id))
      const raizes = datas.filter((d) => !(mapa[d.id]?.parent_id && mudou.has(mapa[d.id].parent_id)))
      const desfazer = []
      for (const d of raizes) {
        const it = mapa[d.id]
        desfazer.push({ tipo: 'datas', id: d.id, antes: Object.fromEntries(Object.keys(d.patch).map((k) => [k, it[k] ?? null])) })
        await ctx.onAtualizar(d.id, d.patch)
      }
      for (const [de, para] of novas) {
        const r = await criarRelacao(de, para)
        if (r?.error) avisar?.(`Não deu para ligar as tarefas: ${r.error}`, 'error'); else desfazer.push({ tipo: 'rel+', de, para })
      }
      for (const [de, para] of removidas) {
        const r = await apagarRelacao(de, para)
        if (r?.error) avisar?.(`Não deu para apagar a ligação: ${r.error}`, 'error'); else desfazer.push({ tipo: 'rel-', de, para })
      }
      if (desfazer.length) setPilha((p) => [...p.slice(-19), desfazer])
    } finally {
      setOtimista(null)
      ocupado.current = false
    }
  }, [base, mapa, ctx, criarRelacao, apagarRelacao, avisar])

  // Arrastar uma linha (só entre irmãs): grava `posicao` entre a de cima e a de baixo, como as setas
  // da Lista; posições repetidas (comum em tarefas criadas aqui) renumeram as irmãs na ordem nova.
  // Em Início/Vencimento, a ordem da tela vira a ordem manual (renumera cada grupo de irmãs que
  // estiver fora dela) e a view passa para Manual. Trocar de pai é recusado.
  const aoMoverLinha = useCallback((c) => {
    if (c.toParentId !== c.fromParentId) { avisar?.('Para trocar uma tarefa de pai, use o painel da tarefa.', 'error'); return false }
    const seq = (s) => s.split('.').map(Number)
    const porSeq = (a, b) => { const x = seq(a.sequence), y = seq(b.sequence); for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0); return 0 }
    const grupos = new Map()
    for (const t of [...base].sort(porSeq)) { if (!grupos.has(t.parentId)) grupos.set(t.parentId, []); if (mapa[t.id]) grupos.get(t.parentId).push(mapa[t.id]) }
    const irmas = grupos.get(c.fromParentId) || []
    const sem = irmas.filter((x) => x.id !== c.taskId)
    const nova = [...sem.slice(0, c.toIndex), mapa[c.taskId], ...sem.slice(c.toIndex)]
    grupos.set(c.fromParentId, nova)
    const gravarPos = []
    const renumerar = (lista) => lista.forEach((x, k) => { const p = (k + 1) * PASSO; if (posDe(x) !== p) gravarPos.push([x, p]) })
    if (!manual) {
      // congela a tela: cada grupo cuja ordem na tela não é a manual é renumerado
      for (const lista of grupos.values()) {
        const ok = lista.every((x, k) => k === 0 || posDe(lista[k - 1]) < posDe(x))
        if (!ok) renumerar(lista)
      }
    } else {
      const acima = c.afterId ? mapa[c.afterId] : null, abaixo = c.beforeId ? mapa[c.beforeId] : null
      if (acima && abaixo && posDe(acima) >= posDe(abaixo)) renumerar(nova)
      else gravarPos.push([mapa[c.taskId], acima && abaixo ? (posDe(acima) + posDe(abaixo)) / 2 : acima ? posDe(acima) + PASSO : abaixo ? posDe(abaixo) - PASSO : posDe(mapa[c.taskId])])
    }
    const antes = gravarPos.map(([x]) => ({ id: x.id, posicao: x.posicao ?? null }))
    for (const [x, p] of gravarPos) ctx.onAtualizar(x.id, { posicao: p })
    const ordemAntes = manual ? undefined : (ctx.ordenar ?? null)
    if (!manual) ctx.onOrdenar?.({ campo: 'manual', dir: 1 })
    setPilha((pl) => [...pl.slice(-19), [{ tipo: 'posicao', antes, ordemAntes }]])
    return true
  }, [manual, base, mapa, ctx, avisar])

  const desfazer = useCallback(async () => {
    const ultimo = pilha.at(-1)
    if (!ultimo || ocupado.current) return
    setPilha((p) => p.slice(0, -1))
    ocupado.current = true
    try {
      for (const a of [...ultimo].reverse()) {
        if (a.tipo === 'rel+') await apagarRelacao(a.de, a.para)
        else if (a.tipo === 'rel-') await criarRelacao(a.de, a.para)
        else if (a.tipo === 'posicao') {
          for (const p of a.antes) if ((mapa[p.id]?.posicao ?? null) !== p.posicao) await ctx.onAtualizar(p.id, { posicao: p.posicao })
          if (a.ordemAntes !== undefined) ctx.onOrdenar?.(a.ordemAntes)
        } else {
          const it = mapa[a.id]
          // a cascata foi cancelada (ou alguém já voltou a data): nada a desfazer
          if (it && Object.entries(a.antes).every(([k, v]) => (it[k] ?? null) === v)) continue
          await ctx.onAtualizar(a.id, a.antes)
        }
      }
    } finally { ocupado.current = false }
  }, [pilha, mapa, ctx, criarRelacao, apagarRelacao])

  useEffect(() => {
    const k = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z' || e.shiftKey) return
      if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return
      if (!pilha.length) return
      e.preventDefault(); desfazer()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [pilha.length, desfazer])

  const seg = 'flex rounded-md border border-ln-border overflow-hidden'
  const segBtn = (ativo) => `px-2.5 h-7 text-xs ${ativo ? 'bg-ln-ink/10 font-semibold text-ln-t1' : 'hover:bg-ln-ink/5 text-ln-t3'}`

  return (
    <div className="flex flex-col h-full p-3 gap-2" style={altura === '100%' ? undefined : { height: altura }}>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {/* o que aparece na lista: ordem, recolher e colunas */}
        <label className="flex items-center gap-1.5 text-xs text-ln-t3" title="Arrastar uma linha passa para Manual, a mesma ordem das setas da Lista">
          Ordenar por
          <select value={ordem.campo} onChange={(e) => mudarOrdem(e.target.value)} disabled={!ctx.onOrdenar}
            className="h-7 rounded-md border border-ln-border bg-ln-panel px-1.5 text-xs text-ln-t1">
            {ORDENS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        </label>
        {!plano && pais.length > 0 && (
          <button type="button" className="ln-pill" onClick={() => setRecolhidos(algumRecolhido ? [] : pais)}>
            {algumRecolhido ? <><ChevronsUpDown className="w-3.5 h-3.5" /> Expandir tudo</> : <><ChevronsDownUp className="w-3.5 h-3.5" /> Recolher tudo</>}
          </button>
        )}
        {ctx.onColunasGantt && (<>
          <button ref={botaoColunas} type="button" className="ln-pill" onClick={() => setColunasAbertas((v) => !v)} aria-expanded={colunasAbertas}>
            <Columns3 className="w-3.5 h-3.5" /> Colunas{colsVisiveis.length ? ` (${colsVisiveis.length})` : ''}
          </button>
          <Popover anchorRef={botaoColunas} open={colunasAbertas} onClose={() => setColunasAbertas(false)} width={280} alturaMax={460}>
            <div className="p-2"><EditorColunas valor={ctx.colunasGantt} onChange={ctx.onColunasGantt} catalogo={COLUNAS_GANTT} ocultasPadrao={OCULTAS_GANTT} /></div>
          </Popover>
        </>)}
        <span className="text-xs text-ln-t4 tabular">{base.length} {base.length === 1 ? 'tarefa' : 'tarefas'}{semDatas > 0 ? ` · ${semDatas} sem datas` : ''}</span>

        {/* a linha do tempo: desfazer, navegar e escala */}
        <div className="ml-auto flex items-center gap-2">
          <button type="button" className="ln-iconbtn" disabled={!pilha.length} onClick={desfazer} title="Desfazer o último gesto no Gantt (Ctrl+Z)" aria-label="Desfazer"><Undo2 className="w-4 h-4" /></button>
          <span className="w-px h-5 bg-ln-border" aria-hidden="true" />
          <button type="button" className="ln-pill" onClick={() => ref.current?.scrollToToday({ smooth: true, align: 'center' })}><CalendarCheck className="w-3.5 h-3.5" /> Hoje</button>
          <button type="button" className="ln-iconbtn" onClick={() => ref.current?.zoomToFit()} title="Mostrar todas as tarefas" aria-label="Ajustar à tela"><Maximize2 className="w-4 h-4" /></button>
          <div className={seg} role="group" aria-label="Escala">
            {ESCALAS.map((e) => (
              <button key={e.v} type="button" onClick={() => { mudarEscala(e.v); ref.current?.setScale(e.v) }} aria-pressed={escala === e.v} className={segBtn(escala === e.v)}>{e.l}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 ln-card overflow-hidden flex">
        {!base.length ? (
          <p className="flex-1 py-12 text-center text-[13px] text-ln-t4">Nenhuma tarefa com datas{semDatas ? `: ${semDatas} sem início nem vencimento` : ''}.</p>
        ) : (<>
          <GanttLista
            linhas={visiveis} cols={colsVisiveis} ctx={ctxLista} alturaLinha={ALTURA_LINHA} cabecalho={rolagem.cabecalho}
            scrollTop={rolagem.top} altura={rolagem.altura} onRolar={rolar} onAlternar={alternar}
            onMover={!plano && ctx.onOrdenar ? aoMoverLinha : null}
          />
          <div ref={caixaGrafico} className="flex-1 min-w-0">
          <ReactGanttChart
            ref={ref}
            tasks={tasks}
            onTasksChange={aoMudar}
            height="100%"
            theme={escuro ? 'dark' : 'light'}
            style={TEMA}
            locale="pt-BR"
            firstDayOfWeek={0}
            defaultScale={escala}
            onScaleChange={mudarEscala}
            zoomOnWheel
            initialScrollTo="today"
            showTaskList={false}
            hierarchy={!plano}
            collapsedIds={collapsedIds}
            onCollapsedChange={setRecolhidos}
            workingCalendar
            showTooltip
            rowHeight={ALTURA_LINHA}
            barHeight={22}
            allowLinkCreate
            allowLinkDelete
            onDependencyCreate={(c) => {
              if (c.type !== 'FS') { avisar?.('Só dá para ligar o fim de uma tarefa ao início de outra (é o "bloqueia").', 'error'); return false }
              return undefined
            }}
            onTaskClick={(t) => ctx.onAbrir?.(t.id)}
          />
          </div>
        </>)}
      </div>
    </div>
  )
}
