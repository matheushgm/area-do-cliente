import { apiFetch } from '../lib/api'
// Módulo Tarefas: réplica do ClickUp dentro da Área do Cliente, no visual do
// Linear (tokens ln-*, mesmo frame do módulo Atividades).
//
// Esquerda: pastas (uma por cliente) → listas. Centro: barra superior com
// breadcrumb e ações, barra de views (Lista/Quadro, agrupar, filtros, busca)
// e o conteúdo rolável. À direita, o painel da tarefa aberta (empurra o
// conteúdo em telas largas, sobrepõe nas estreitas), com subtarefas,
// descrição, checklists, anexos e comentários.
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Menu, List, KanbanSquare, ChevronRight, ChevronDown, Search, X, Plus, Loader2, Layers, Eye, EyeOff, PanelLeft, User, RefreshCw,
  CheckSquare, Trash2, Check, Maximize2, Minimize2, Rows3,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import AppSidebar from '../components/AppSidebar'
import Toast from '../components/UI/Toast'
import { useToast } from '../hooks/useToast'
import { useTarefas } from '../hooks/useTarefas'
import { statusDaLista, statusDasListas, agruparItens, filtrarItens, AGRUPAMENTOS, STATUSES_PADRAO, corDaPessoa, iniciais } from '../lib/tarefas'
import TarefasSidebar from '../components/Tarefas/TarefasSidebar'
import ListaView from '../components/Tarefas/ListaView'
import QuadroView from '../components/Tarefas/QuadroView'
import TarefaPanel from '../components/Tarefas/TarefaPanel'
import { Popover, Avatar, FOCO } from '../components/Tarefas/Campos'

const PAINEL_LARGURA = 480
const EMPURRA_A_PARTIR_DE = 1200

function useLarguraDoConteudo(ref) {
  const [w, setW] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1440))
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => setW(entries[0]?.contentRect?.width || window.innerWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return w
}

function estaDigitando() {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

// Sincronização incremental com o ClickUp (api/tarefas-sync.js): botão na
// barra e disparo automático ao abrir a página se a última rodada tem +30 min.
const SYNC_AUTO_MS = 30 * 60 * 1000
function useSyncClickup({ ativo, aoTerminar }) {
  const [estado, setEstado] = useState(null)   // linha de tarefas_sync
  const [rodando, setRodando] = useState(false)
  const [erro, setErro] = useState(null)
  const disparado = useRef(false)

  const lerEstado = useCallback(async () => {
    const { data } = await supabase.from('tarefas_sync').select('*').eq('id', 'clickup').maybeSingle()
    setEstado(data || null)
    return data
  }, [])

  const sincronizar = useCallback(async () => {
    if (rodando) return
    setRodando(true)
    setErro(null)
    try {
      const json = await apiFetch('/api/tarefas-sync', { body: {} })
      if (json.ok === false) throw new Error(json.error || 'Falha na sincronização.')
      await lerEstado()
      aoTerminar?.(json)
    } catch (e) {
      setErro(e.message)
      await lerEstado()
    } finally {
      setRodando(false)
    }
  }, [rodando, lerEstado, aoTerminar])

  useEffect(() => {
    if (!ativo || disparado.current) return
    disparado.current = true
    lerEstado().then((s) => {
      const ultimo = s?.ultimo_inicio ? new Date(s.ultimo_inicio).getTime() : 0
      if (Date.now() - ultimo > SYNC_AUTO_MS) sincronizar()
    })
  }, [ativo, lerEstado, sincronizar])

  return { estado, rodando, erro, sincronizar }
}

function tempoRelativo(iso) {
  if (!iso) return 'nunca'
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 48) return `há ${h} h`
  return `há ${Math.round(h / 24)} dias`
}

function lerPref(chave, padrao) {
  try { const v = localStorage.getItem(`tarefas.${chave}`); return v == null ? padrao : JSON.parse(v) } catch { return padrao }
}
function gravarPref(chave, v) {
  try { localStorage.setItem(`tarefas.${chave}`, JSON.stringify(v)) } catch { /* noop */ }
}

function MenuAgrupar({ valor, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const atual = AGRUPAMENTOS.find((a) => a.value === valor)
  return (
    <>
      <button ref={ref} type="button" onClick={() => setOpen((v) => !v)} className={`ln-pill ${FOCO}`} title="Agrupar as tarefas">
        <Layers className="w-3.5 h-3.5" /> Agrupar: {atual?.label} <ChevronDown className="w-3 h-3" />
      </button>
      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={200} align="right">
        <div className="p-1">
          {AGRUPAMENTOS.map((a) => (
            <button key={a.value} type="button" onClick={() => { setOpen(false); onChange(a.value) }} className={`w-full flex items-center h-8 px-2.5 rounded-md text-[13px] hover:bg-ln-ink/5 ${a.value === valor ? 'text-ln-t1' : 'text-ln-t2'}`}>
              {a.label}{a.value === valor && <Check className="w-3.5 h-3.5 ml-auto text-ln-accent" />}
            </button>
          ))}
        </div>
      </Popover>
    </>
  )
}

function MenuResponsavel({ valor, membros, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const sel = membros.find((m) => m.id === valor)
  const ativo = valor !== 'todos'
  const rotulo = valor === 'todos' ? 'Responsável' : valor === 'eu' ? 'Minhas' : sel?.name?.split(' ')[0] || 'Responsável'
  return (
    <>
      <button ref={ref} type="button" onClick={() => setOpen((v) => !v)} className={`ln-pill ${ativo ? '!bg-ln-ink/[0.08] !text-ln-t1' : ''} ${FOCO}`} title="Filtrar por responsável">
        <User className="w-3.5 h-3.5" /> {rotulo}
        {ativo ? <X className="w-3 h-3" onClick={(e) => { e.stopPropagation(); onChange('todos') }} /> : <ChevronDown className="w-3 h-3" />}
      </button>
      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={240} align="right">
        <div className="p-1 overflow-y-auto">
          {[{ id: 'todos', label: 'Todos' }, { id: 'eu', label: 'Minhas tarefas' }].map((o) => (
            <button key={o.id} type="button" onClick={() => { setOpen(false); onChange(o.id) }} className={`w-full flex items-center h-8 px-2.5 rounded-md text-[13px] hover:bg-ln-ink/5 ${valor === o.id ? 'text-ln-t1' : 'text-ln-t2'}`}>
              {o.label}{valor === o.id && <Check className="w-3.5 h-3.5 ml-auto text-ln-accent" />}
            </button>
          ))}
          <div className="border-t border-ln-ink/5 my-1" />
          {membros.filter((m) => !m.disabled).map((m) => (
            <button key={m.id} type="button" onClick={() => { setOpen(false); onChange(m.id) }} className={`w-full flex items-center gap-2 h-8 px-2.5 rounded-md text-[13px] hover:bg-ln-ink/5 ${valor === m.id ? 'text-ln-t1' : 'text-ln-t2'}`}>
              <Avatar pessoa={{ nome: m.name, iniciais: m.avatar || iniciais(m.name), cor: corDaPessoa(m.id) }} size={18} />
              <span className="truncate">{m.name}</span>
              {valor === m.id && <Check className="w-3.5 h-3.5 ml-auto text-ln-accent" />}
            </button>
          ))}
        </div>
      </Popover>
    </>
  )
}

// `tarefasHook` só é trocado pelo preview de desenvolvimento (/dev/tarefas),
// que injeta um hook de fixture em vez do Supabase.
export default function Tarefas({ tarefasHook = null }) {
  const { user, projects, teamMembers } = useApp()
  const { toast, showToast } = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const useDados = tarefasHook || useTarefas
  const t = useDados(user)

  const conteudoRef = useRef(null)
  const largura = useLarguraDoConteudo(conteudoRef)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [arvoreAberta, setArvoreAberta] = useState(false)
  const [view, setView] = useState(() => lerPref('view', 'lista'))
  const [agrupar, setAgrupar] = useState(() => lerPref('agrupar', 'status'))
  const [mostrarConcluidas, setMostrarConcluidas] = useState(() => lerPref('concluidas', false))
  const [denso, setDenso] = useState(() => lerPref('denso', false))
  const [busca, setBusca] = useState('')
  const [filtroResp, setFiltroResp] = useState('todos')
  const [painelExpandido, setPainelExpandido] = useState(false)
  const [recarregarTick, setRecarregarTick] = useState(0)
  const sync = useSyncClickup({
    ativo: !tarefasHook && !t.loadingEstrutura,
    aoTerminar: useCallback((r) => {
      const n = (r?.criadas || 0) + (r?.atualizadas || 0)
      if (n > 0) { t.carregarEstrutura(); setRecarregarTick((x) => x + 1) }
      showToast(n > 0 ? `ClickUp sincronizado: ${n} tarefa(s) atualizada(s)` : 'ClickUp sincronizado, nada novo')
    }, [t, showToast]),
  })

  useEffect(() => gravarPref('view', view), [view])
  useEffect(() => gravarPref('agrupar', agrupar), [agrupar])
  useEffect(() => gravarPref('concluidas', mostrarConcluidas), [mostrarConcluidas])
  useEffect(() => gravarPref('denso', denso), [denso])

  // ── Seleção (pasta / lista / minhas) via URL ─────────────────────────────
  const sel = useMemo(() => {
    if (params.get('lista')) return { tipo: 'lista', id: params.get('lista') }
    if (params.get('pasta')) return { tipo: 'pasta', id: params.get('pasta') }
    if (params.get('minhas') === '1') return { tipo: 'minhas' }
    return lerPref('sel', null) || { tipo: 'minhas' }
  }, [params])
  const tarefaAbertaId = params.get('tarefa')

  const setSel = useCallback((s) => {
    gravarPref('sel', s)
    const p = new URLSearchParams()
    if (s.tipo === 'lista') p.set('lista', s.id)
    else if (s.tipo === 'pasta') p.set('pasta', s.id)
    else p.set('minhas', '1')
    setParams(p)
  }, [setParams])

  const abrirTarefa = useCallback((id) => {
    const p = new URLSearchParams(params)
    if (id) p.set('tarefa', id); else p.delete('tarefa')
    setParams(p, { replace: !!params.get('tarefa') })
  }, [params, setParams])
  const fecharPainel = useCallback(() => { setPainelExpandido(false); abrirTarefa(null) }, [abrirTarefa])

  useEffect(() => {
    if (t.loadingEstrutura) return
    if (sel.tipo === 'pasta' && !t.pastasMap.has(sel.id)) setSel({ tipo: 'minhas' })
    if (sel.tipo === 'lista' && !t.listasMap.has(sel.id)) setSel({ tipo: 'minhas' })
  }, [t.loadingEstrutura, sel, t.pastasMap, t.listasMap, setSel])

  // ── Escopo: listas da seleção ────────────────────────────────────────────
  const listasEscopo = useMemo(() => {
    if (sel.tipo === 'lista') { const l = t.listasMap.get(sel.id); return l ? [l] : [] }
    if (sel.tipo === 'pasta') return t.listas.filter((l) => l.pasta_id === sel.id)
    return []
  }, [sel, t.listas, t.listasMap])

  useEffect(() => {
    if (t.loadingEstrutura) return
    const force = recarregarTick > 0
    if (sel.tipo === 'minhas') t.carregarMinhas()
    else if (listasEscopo.length) t.carregarListas(listasEscopo.map((l) => l.id), { force })
  }, [sel.tipo, listasEscopo, t.loadingEstrutura, t.carregarMinhas, t.carregarListas, recarregarTick]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tarefaAbertaId && !t.itens[tarefaAbertaId]) t.carregarTarefa(tarefaAbertaId)
  }, [tarefaAbertaId]) // eslint-disable-line react-hooks/exhaustive-deps

  const statuses = useMemo(() => {
    if (sel.tipo === 'lista') return listasEscopo[0] ? statusDaLista(listasEscopo[0]) : STATUSES_PADRAO
    if (sel.tipo === 'pasta') return listasEscopo.length ? statusDasListas(listasEscopo) : STATUSES_PADRAO
    return statusDasListas(t.listas)
  }, [sel.tipo, listasEscopo, t.listas])

  const membrosMap = useMemo(() => new Map((teamMembers || []).map((m) => [m.id, m])), [teamMembers])

  // ── Itens do escopo ──────────────────────────────────────────────────────
  const todos = useMemo(() => Object.values(t.itens), [t.itens])
  const itensEscopo = useMemo(() => {
    if (sel.tipo === 'minhas') return todos.filter((it) => (it.responsaveis || []).includes(user?.id))
    const ids = new Set(listasEscopo.map((l) => l.id))
    return todos.filter((it) => ids.has(it.lista_id))
  }, [todos, sel.tipo, listasEscopo, user?.id])

  const filhosDe = useMemo(() => {
    const m = new Map()
    for (const it of todos) {
      if (!it.parent_id) continue
      if (!m.has(it.parent_id)) m.set(it.parent_id, [])
      m.get(it.parent_id).push(it)
    }
    return m
  }, [todos])

  const topo = useMemo(() => {
    const ids = new Set(itensEscopo.map((i) => i.id))
    return itensEscopo.filter((it) => !it.parent_id || !ids.has(it.parent_id))
  }, [itensEscopo])

  const filtrados = useMemo(
    () => filtrarItens(topo, { busca, responsavel: filtroResp, mostrarConcluidas, userId: user?.id }),
    [topo, busca, filtroResp, mostrarConcluidas, user?.id],
  )

  const grupos = useMemo(() => {
    const g = agruparItens(filtrados, agrupar, { statuses, membrosMap, listasMap: t.listasMap })
    if (agrupar === 'status' && view === 'quadro') {
      const existentes = new Map(g.map((x) => [x.key, x]))
      return statuses
        .filter((s) => mostrarConcluidas || s.tipo !== 'closed')
        .map((s) => existentes.get(s.key) || { key: s.key, label: s.label, cor: s.cor, itens: [] })
    }
    return g
  }, [filtrados, agrupar, statuses, membrosMap, t.listasMap, view, mostrarConcluidas])

  const contagemComentarios = useMemo(() => {
    const m = {}
    for (const [id, arr] of Object.entries(t.comentarios)) m[id] = arr.length
    return m
  }, [t.comentarios])

  const listaPadraoId = sel.tipo === 'lista' ? sel.id : listasEscopo[0]?.id || null

  // ── Ações ────────────────────────────────────────────────────────────────
  const onCriar = useCallback(async (payload) => {
    const r = await t.criarTarefa(payload)
    if (r.error) showToast(r.error, 'error')
    return r
  }, [t, showToast])
  const onAtualizar = useCallback(async (id, patch) => {
    const r = await t.atualizarTarefa(id, patch)
    if (r.error) showToast(r.error, 'error')
  }, [t, showToast])
  const onMudarStatus = useCallback(async (item, s) => {
    const r = await t.mudarStatus(item, s)
    if (r.error) showToast(r.error, 'error')
  }, [t, showToast])
  const novaTarefa = useCallback(() => {
    if (!listaPadraoId) { showToast('Escolha uma pasta ou lista primeiro', 'error'); return }
    onCriar({ lista_id: listaPadraoId, titulo: 'Nova tarefa' }).then((r) => r?.data && abrirTarefa(r.data.id))
  }, [listaPadraoId, onCriar, abrirTarefa, showToast])

  // Atalhos: C cria, Esc fecha o painel (fora de campos de texto).
  useEffect(() => {
    const h = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Escape' && tarefaAbertaId && !estaDigitando()) { e.preventDefault(); if (painelExpandido) setPainelExpandido(false); else fecharPainel() }
      if ((e.key === 'c' || e.key === 'C') && !estaDigitando()) { e.preventDefault(); novaTarefa() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [tarefaAbertaId, painelExpandido, fecharPainel, novaTarefa])

  const ctx = useMemo(() => ({
    statuses, membros: teamMembers || [], membrosMap, itensMap: t.itens, listaPadraoId, agrupar, contagemComentarios, selecionadaId: tarefaAbertaId,
    onAbrir: abrirTarefa, onAtualizar, onMudarStatus, onCriar,
  }), [statuses, teamMembers, membrosMap, t.itens, listaPadraoId, agrupar, contagemComentarios, tarefaAbertaId, abrirTarefa, onAtualizar, onMudarStatus, onCriar])

  // ── Cabeçalho e painel ───────────────────────────────────────────────────
  const pastaSel = sel.tipo === 'pasta' ? t.pastasMap.get(sel.id) : sel.tipo === 'lista' ? t.pastasMap.get(t.listasMap.get(sel.id)?.pasta_id) : null
  const listaSel = sel.tipo === 'lista' ? t.listasMap.get(sel.id) : null
  const totalAbertas = itensEscopo.filter((i) => i.status_tipo !== 'closed' && !i.parent_id).length

  const tarefaAberta = tarefaAbertaId ? t.itens[tarefaAbertaId] : null
  const listaDaAberta = tarefaAberta ? t.listasMap.get(tarefaAberta.lista_id) : null
  const pastaDaAberta = listaDaAberta ? t.pastasMap.get(listaDaAberta.pasta_id) : null
  const paiDaAberta = tarefaAberta?.parent_id ? t.itens[tarefaAberta.parent_id] : null
  const statusesDaAberta = listaDaAberta ? statusDaLista(listaDaAberta) : statuses
  const painelEmpurra = largura >= EMPURRA_A_PARTIR_DE
  const painel = !!tarefaAbertaId

  return (
    <div className="min-h-screen flex bg-gradient-dark">
      <AppSidebar filter="tarefas" setFilter={() => navigate('/')} counts={{}} activeAccounts={[]} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div ref={conteudoRef} className="ln flex-1 min-w-0 flex flex-col h-screen bg-ln-bg">
        <div className="flex-1 min-h-0 p-2">
          <div className="relative h-full min-h-0 flex rounded-lg border border-ln-ink/5 bg-ln-panel overflow-hidden" style={{ boxShadow: '0 0 0 2px rgb(var(--ln-ink) / 0.02)' }}>
            <TarefasSidebar
              pastas={t.pastas} listas={t.listas} projetos={projects} sel={sel} onSel={setSel}
              onCriarPasta={(nome) => t.criarPasta({ nome })}
              onCriarLista={(pastaId, nome) => t.criarLista({ pasta_id: pastaId, nome })}
              onAtualizarPasta={t.atualizarPasta}
              onAtualizarLista={t.atualizarLista}
              aberta={arvoreAberta} onFechar={() => setArvoreAberta(false)}
            />

            {/* ── Painel principal ─────────────────────────────────────── */}
            <div className="flex-1 min-w-0 flex flex-col">
              <header className="h-11 shrink-0 flex items-center justify-between gap-3 px-3 border-b border-ln-ink/5">
                <div className="flex items-center gap-1 min-w-0">
                  <button onClick={() => setSidebarOpen(true)} aria-label="Abrir menu de navegação" className="ln-iconbtn lg:hidden"><Menu className="w-4 h-4" /></button>
                  <button onClick={() => setArvoreAberta(true)} aria-label="Abrir pastas" className="ln-iconbtn md:hidden"><PanelLeft className="w-4 h-4" /></button>
                  <div className="flex items-center gap-2 h-7 px-2.5 rounded-lg text-xs font-medium text-ln-t2 min-w-0">
                    <CheckSquare className="w-3.5 h-3.5 text-ln-accent shrink-0" />
                    <span className="truncate">Tarefas</span>
                    {pastaSel && (<>
                      <ChevronRight className="w-3 h-3 text-ln-t4 shrink-0" />
                      <button type="button" onClick={() => setSel({ tipo: 'pasta', id: pastaSel.id })} className={`truncate max-w-[200px] rounded ${listaSel ? 'text-ln-t3 hover:text-ln-t2' : 'text-ln-t2'} ${FOCO}`}>{pastaSel.nome}</button>
                    </>)}
                    {listaSel && (<><ChevronRight className="w-3 h-3 text-ln-t4 shrink-0" /><span className="truncate max-w-[200px]">{listaSel.nome}</span></>)}
                    {sel.tipo === 'minhas' && (<><ChevronRight className="w-3 h-3 text-ln-t4 shrink-0" /><span className="truncate">Minhas tarefas</span></>)}
                  </div>
                  <span className="hidden sm:inline text-xs text-ln-t4 tabular whitespace-nowrap">{totalAbertas} abertas</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {t.carregando && <Loader2 className="w-3.5 h-3.5 animate-spin text-ln-t4" />}
                  {!tarefasHook && (
                    <button
                      type="button"
                      onClick={sync.sincronizar}
                      disabled={sync.rodando}
                      title={sync.erro ? `Erro na última sincronização: ${sync.erro}` : `Última sincronização com o ClickUp: ${tempoRelativo(sync.estado?.ultimo_inicio)}${sync.estado?.ultimo_ok === false ? ' (com erro)' : ''}`}
                      className={`hidden sm:inline-flex items-center gap-1.5 text-xs ${sync.erro || sync.estado?.ultimo_ok === false ? 'text-ln-red' : 'text-ln-t4 hover:text-ln-t2'} disabled:opacity-60 ${FOCO} rounded`}
                    >
                      <RefreshCw className={`w-3 h-3 ${sync.rodando ? 'animate-spin' : ''}`} />
                      {sync.rodando ? 'sincronizando ClickUp…' : `ClickUp ${tempoRelativo(sync.estado?.ultimo_inicio)}`}
                    </button>
                  )}
                  <button onClick={() => { if (listasEscopo.length) t.carregarListas(listasEscopo.map((l) => l.id), { force: true }) }} className="ln-iconbtn" aria-label="Recarregar" title="Recarregar"><RefreshCw className="w-3.5 h-3.5" /></button>
                  <button onClick={novaTarefa} className="ln-primary" title="Nova tarefa (C)">
                    <Plus className="w-3.5 h-3.5" /> Nova tarefa <kbd className="ln-kbd !text-white/80 !bg-white/15 !border-white/20 ml-0.5">C</kbd>
                  </button>
                </div>
              </header>

              {/* Barra de views */}
              <div className="h-11 shrink-0 flex items-center justify-between gap-3 px-3 border-b border-ln-ink/5">
                <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto scroll-hide">
                  <button onClick={() => setView('lista')} className={`ln-tab ${view === 'lista' ? 'ln-tab-active' : ''} ${FOCO}`}><List className="w-3.5 h-3.5" /> Lista</button>
                  <button onClick={() => setView('quadro')} className={`ln-tab ${view === 'quadro' ? 'ln-tab-active' : ''} ${FOCO}`}><KanbanSquare className="w-3.5 h-3.5" /> Quadro</button>
                  <span className="w-px h-4 bg-ln-line mx-1 shrink-0" />
                  <MenuAgrupar valor={agrupar} onChange={setAgrupar} />
                  <MenuResponsavel valor={filtroResp} membros={teamMembers || []} onChange={setFiltroResp} />
                  <button onClick={() => setMostrarConcluidas((v) => !v)} className={`ln-pill ${mostrarConcluidas ? '!bg-ln-ink/[0.08] !text-ln-t1' : ''} ${FOCO}`} title={mostrarConcluidas ? 'Esconder concluídas' : 'Mostrar concluídas'}>
                    {mostrarConcluidas ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />} Concluídas
                  </button>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="ln-input !h-7 !w-[150px] hidden sm:flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-ln-t4 shrink-0" />
                    <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar tarefa" className="flex-1 min-w-0 bg-transparent outline-none text-xs text-ln-t1 placeholder:text-ln-t4" aria-label="Buscar tarefa" />
                    {busca && <button type="button" onClick={() => setBusca('')} className="text-ln-t4 hover:text-ln-t2" aria-label="Limpar busca"><X className="w-3 h-3" /></button>}
                  </div>
                  {view === 'lista' && (
                    <button onClick={() => setDenso((v) => !v)} className={`ln-iconbtn ${denso ? 'bg-ln-ink/[0.08] text-ln-t1' : ''}`} aria-label="Densidade" title={denso ? 'Linhas confortáveis' : 'Linhas compactas'}><Rows3 className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              </div>

              {/* Conteúdo rolável */}
              <div className={`flex-1 min-h-0 ${view === 'quadro' ? 'overflow-hidden' : 'overflow-auto'}`}>
                {t.loadingEstrutura ? (
                  <div className="flex items-center justify-center py-20 text-ln-t4 text-[13px] gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>
                ) : view === 'quadro' ? (
                  <QuadroView grupos={grupos} filhosDe={filhosDe} ctx={ctx} />
                ) : (
                  <ListaView grupos={grupos} filhosDe={filhosDe} ctx={ctx} mostrarConcluidas={mostrarConcluidas} denso={denso} compacto={painel && painelEmpurra && largura < 1600} />
                )}
              </div>
            </div>

            {/* ── Painel lateral ──────────────────────────────────────── */}
            {painel && (
              <>
                {!painelEmpurra && !painelExpandido && <div className="absolute inset-0 z-30 bg-black/30" onClick={fecharPainel} aria-hidden="true" />}
                <aside
                  className={`${painelExpandido ? 'absolute inset-0 z-40' : painelEmpurra ? 'relative shrink-0 border-l border-ln-ink/[0.08]' : 'absolute inset-y-0 right-0 z-40 shadow-2xl border-l border-ln-ink/[0.08]'} flex flex-col bg-ln-panel`}
                  style={painelExpandido ? undefined : { width: painelEmpurra ? PAINEL_LARGURA : `min(${PAINEL_LARGURA}px, 100%)` }}
                  aria-label="Detalhe da tarefa"
                >
                  <div className="h-11 shrink-0 flex items-center justify-between gap-2 px-3 border-b border-ln-ink/5">
                    <div className="flex items-center gap-2 text-xs font-medium text-ln-t2 min-w-0">
                      {pastaDaAberta && <span className="text-ln-t4 truncate max-w-[140px]">{pastaDaAberta.nome}</span>}
                      {pastaDaAberta && <ChevronRight className="w-3 h-3 text-ln-t4 shrink-0" />}
                      {listaDaAberta && <span className="text-ln-t4 truncate max-w-[140px]">{listaDaAberta.nome}</span>}
                      {paiDaAberta && (<>
                        <ChevronRight className="w-3 h-3 text-ln-t4 shrink-0" />
                        <button type="button" onClick={() => abrirTarefa(paiDaAberta.id)} className={`truncate max-w-[180px] text-ln-t3 hover:text-ln-t1 rounded ${FOCO}`} title={paiDaAberta.titulo}>{paiDaAberta.titulo}</button>
                      </>)}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {tarefaAberta && tarefaAberta.status_tipo !== 'closed' && (
                        <button type="button" onClick={() => { const s = statusesDaAberta.find((x) => x.tipo === 'closed'); if (s) onMudarStatus(tarefaAberta, s) }} className={`ln-pill !text-ln-green ${FOCO}`} title="Marcar como concluída">
                          <Check className="w-3.5 h-3.5" /> Concluir
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => { if (tarefaAberta && window.confirm('Excluir esta tarefa (e as subtarefas)?')) t.excluirTarefa(tarefaAberta.id).then((r) => { if (r.error) showToast(r.error, 'error'); else { fecharPainel(); showToast('Tarefa excluída') } }) }}
                        className="ln-iconbtn hover:!text-ln-red" aria-label="Excluir tarefa" title="Excluir"
                      ><Trash2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setPainelExpandido((v) => !v)} className="ln-iconbtn" aria-label={painelExpandido ? 'Voltar ao painel lateral' : 'Expandir em tela cheia'} title={painelExpandido ? 'Voltar ao painel lateral (Esc)' : 'Expandir em tela cheia'}>
                        {painelExpandido ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={fecharPainel} className="ln-iconbtn" aria-label="Fechar painel" title="Fechar (Esc)"><X className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className={`flex-1 min-h-0 overflow-y-auto ${painelExpandido ? '[&>*]:max-w-4xl [&>*]:mx-auto [&>*]:w-full' : ''}`}>
                    {tarefaAberta ? (
                      <TarefaPanel
                        key={tarefaAberta.id}
                        item={tarefaAberta}
                        subtarefas={filhosDe.get(tarefaAberta.id) || []}
                        statuses={statusesDaAberta}
                        membros={teamMembers || []}
                        membrosMap={membrosMap}
                        comentarios={t.comentarios[tarefaAberta.id]}
                        user={user}
                        onAtualizar={onAtualizar}
                        onMudarStatus={onMudarStatus}
                        onCriarSub={(pai, tituloSub) => onCriar({ lista_id: pai.lista_id, parent_id: pai.id, titulo: tituloSub })}
                        onAbrir={abrirTarefa}
                        onComentar={async (id, texto) => { const r = await t.criarComentario(id, texto); if (r.error) showToast(r.error, 'error') }}
                        onExcluirComentario={async (tarefaId, id) => { const r = await t.excluirComentario(tarefaId, id); if (r.error) showToast(r.error, 'error') }}
                        onCarregarComentarios={t.carregarComentarios}
                        onErro={(m) => showToast(m, 'error')}
                      />
                    ) : (
                      <div className="flex items-center justify-center py-20 text-ln-t4"><Loader2 className="w-4 h-4 animate-spin" /></div>
                    )}
                  </div>
                </aside>
              </>
            )}
          </div>
        </div>
      </div>

      <Toast toast={toast} />
    </div>
  )
}
