// Módulo Tarefas: réplica do ClickUp dentro da Área do Cliente.
// Esquerda: pastas (uma por cliente) → listas. Centro: Lista ou Quadro da
// pasta/lista escolhida, com agrupamento, filtros e edição inline. Clicar
// numa tarefa abre o detalhe (subtarefas, descrição, checklists, comentários).
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Menu, List, KanbanSquare, ChevronRight, Search, X, Plus, Loader2, Layers, Eye, EyeOff, PanelLeft, User, RefreshCw,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import AppSidebar from '../components/AppSidebar'
import Toast from '../components/UI/Toast'
import { useToast } from '../hooks/useToast'
import { useTarefas } from '../hooks/useTarefas'
import { statusDaLista, statusDasListas, agruparItens, filtrarItens, AGRUPAMENTOS, STATUSES_PADRAO, corDaPessoa, iniciais } from '../lib/tarefas'
import TarefasSidebar from '../components/Tarefas/TarefasSidebar'
import ListaView from '../components/Tarefas/ListaView'
import QuadroView from '../components/Tarefas/QuadroView'
import TarefaModal from '../components/Tarefas/TarefaModal'
import { Popover, Avatar } from '../components/Tarefas/Campos'
import { useRef } from 'react'

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
      <button ref={ref} type="button" onClick={() => setOpen((v) => !v)} className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium border transition ${valor !== 'nenhum' ? 'bg-rl-purple/10 text-rl-purple border-rl-purple/30' : 'text-rl-subtle border-rl-border hover:bg-rl-surface'}`}>
        <Layers className="w-3.5 h-3.5" /> Agrupar: {atual?.label}
      </button>
      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={200}>
        <div className="py-1">
          {AGRUPAMENTOS.map((a) => (
            <button key={a.value} type="button" onClick={() => { setOpen(false); onChange(a.value) }} className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-rl-surface ${a.value === valor ? 'text-rl-purple font-medium' : 'text-rl-subtle'}`}>{a.label}</button>
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
  const rotulo = valor === 'todos' ? 'Responsável' : valor === 'eu' ? 'Minhas' : sel?.name?.split(' ')[0] || 'Responsável'
  return (
    <>
      <button ref={ref} type="button" onClick={() => setOpen((v) => !v)} className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium border transition ${valor !== 'todos' ? 'bg-rl-purple/10 text-rl-purple border-rl-purple/30' : 'text-rl-subtle border-rl-border hover:bg-rl-surface'}`}>
        <User className="w-3.5 h-3.5" /> {rotulo}
        {valor !== 'todos' && <X className="w-3 h-3" onClick={(e) => { e.stopPropagation(); onChange('todos') }} />}
      </button>
      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={240}>
        <div className="py-1 overflow-y-auto">
          <button type="button" onClick={() => { setOpen(false); onChange('todos') }} className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-rl-surface ${valor === 'todos' ? 'text-rl-purple font-medium' : 'text-rl-subtle'}`}>Todos</button>
          <button type="button" onClick={() => { setOpen(false); onChange('eu') }} className={`w-full text-left px-3 py-1.5 text-[13px] hover:bg-rl-surface ${valor === 'eu' ? 'text-rl-purple font-medium' : 'text-rl-subtle'}`}>Minhas tarefas</button>
          <div className="border-t border-rl-border my-1" />
          {membros.filter((m) => !m.disabled).map((m) => (
            <button key={m.id} type="button" onClick={() => { setOpen(false); onChange(m.id) }} className={`w-full flex items-center gap-2 text-left px-3 py-1.5 text-[13px] hover:bg-rl-surface ${valor === m.id ? 'text-rl-purple font-medium' : 'text-rl-subtle'}`}>
              <Avatar pessoa={{ nome: m.name, iniciais: m.avatar || iniciais(m.name), cor: corDaPessoa(m.id) }} size={20} />
              <span className="truncate">{m.name}</span>
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
  const [params, setParams] = useSearchParams()
  const useDados = tarefasHook || useTarefas
  const t = useDados(user)

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [arvoreAberta, setArvoreAberta] = useState(false)
  const [view, setView] = useState(() => lerPref('view', 'lista'))
  const [agrupar, setAgrupar] = useState(() => lerPref('agrupar', 'status'))
  const [mostrarConcluidas, setMostrarConcluidas] = useState(() => lerPref('concluidas', false))
  const [busca, setBusca] = useState('')
  const [filtroResp, setFiltroResp] = useState('todos')

  useEffect(() => gravarPref('view', view), [view])
  useEffect(() => gravarPref('agrupar', agrupar), [agrupar])
  useEffect(() => gravarPref('concluidas', mostrarConcluidas), [mostrarConcluidas])

  // ── Seleção (pasta / lista / minhas) via URL ─────────────────────────────
  const sel = useMemo(() => {
    if (params.get('lista')) return { tipo: 'lista', id: params.get('lista') }
    if (params.get('pasta')) return { tipo: 'pasta', id: params.get('pasta') }
    if (params.get('minhas') === '1') return { tipo: 'minhas' }
    const ultima = lerPref('sel', null)
    return ultima || { tipo: 'minhas' }
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

  // Depois que a estrutura carrega: se a seleção aponta para algo que não existe mais, cai em "Minhas tarefas".
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
    if (sel.tipo === 'minhas') t.carregarMinhas()
    else if (listasEscopo.length) t.carregarListas(listasEscopo.map((l) => l.id))
  }, [sel.tipo, listasEscopo, t.loadingEstrutura, t.carregarMinhas, t.carregarListas]) // eslint-disable-line react-hooks/exhaustive-deps

  // Deep-link direto numa tarefa que ainda não está em memória
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
    // Na visão "Minhas", uma subtarefa minha aparece como linha própria se o pai não for meu.
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
      // quadro mostra todas as colunas, mesmo vazias (e esconde "concluído" se não for pra mostrar)
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

  const ctx = useMemo(() => ({
    statuses, membros: teamMembers || [], membrosMap, itensMap: t.itens, listaPadraoId, agrupar, contagemComentarios,
    onAbrir: abrirTarefa, onAtualizar, onMudarStatus, onCriar,
  }), [statuses, teamMembers, membrosMap, t.itens, listaPadraoId, agrupar, contagemComentarios, abrirTarefa, onAtualizar, onMudarStatus, onCriar])

  // ── Cabeçalho ────────────────────────────────────────────────────────────
  const pastaSel = sel.tipo === 'pasta' ? t.pastasMap.get(sel.id) : sel.tipo === 'lista' ? t.pastasMap.get(t.listasMap.get(sel.id)?.pasta_id) : null
  const listaSel = sel.tipo === 'lista' ? t.listasMap.get(sel.id) : null
  const totalAbertas = itensEscopo.filter((i) => i.status_tipo !== 'closed' && !i.parent_id).length

  const tarefaAberta = tarefaAbertaId ? t.itens[tarefaAbertaId] : null
  const listaDaAberta = tarefaAberta ? t.listasMap.get(tarefaAberta.lista_id) : null
  const statusesDaAberta = listaDaAberta ? statusDaLista(listaDaAberta) : statuses

  return (
    <div className="flex min-h-screen bg-rl-bg">
      <AppSidebar filter="all" setFilter={() => {}} counts={{}} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 min-w-0 flex h-screen overflow-hidden">
        <TarefasSidebar
          pastas={t.pastas} listas={t.listas} projetos={projects} sel={sel} onSel={setSel}
          onCriarPasta={(nome) => t.criarPasta({ nome })}
          onCriarLista={(pastaId, nome) => t.criarLista({ pasta_id: pastaId, nome })}
          onAtualizarPasta={t.atualizarPasta}
          onAtualizarLista={t.atualizarLista}
          aberta={arvoreAberta} onFechar={() => setArvoreAberta(false)}
        />

        <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
          {/* Barra superior */}
          <header className="shrink-0 border-b border-rl-border bg-rl-card/60">
            <div className="flex items-center gap-2 h-12 px-4">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-1.5 rounded-lg text-rl-muted hover:text-rl-text" aria-label="Menu"><Menu className="w-4 h-4" /></button>
              <button onClick={() => setArvoreAberta(true)} className="md:hidden p-1.5 rounded-lg text-rl-muted hover:text-rl-text" aria-label="Pastas"><PanelLeft className="w-4 h-4" /></button>
              <nav className="flex items-center gap-1 text-[13px] min-w-0">
                <span className="text-rl-muted">Clientes</span>
                {pastaSel && <><ChevronRight className="w-3.5 h-3.5 text-rl-muted" /><button type="button" onClick={() => setSel({ tipo: 'pasta', id: pastaSel.id })} className={`truncate max-w-[200px] ${listaSel ? 'text-rl-muted hover:text-rl-text' : 'text-rl-text font-semibold'}`}>{pastaSel.nome}</button></>}
                {listaSel && <><ChevronRight className="w-3.5 h-3.5 text-rl-muted" /><span className="text-rl-text font-semibold truncate max-w-[200px]">{listaSel.nome}</span></>}
                {sel.tipo === 'minhas' && <><ChevronRight className="w-3.5 h-3.5 text-rl-muted" /><span className="text-rl-text font-semibold">Minhas tarefas</span></>}
                <span className="ml-2 text-[11px] text-rl-muted">{totalAbertas} abertas</span>
              </nav>
              <div className="flex-1" />
              {t.carregando && <Loader2 className="w-4 h-4 animate-spin text-rl-muted" />}
              <button type="button" onClick={() => listasEscopo.length && t.carregarListas(listasEscopo.map((l) => l.id), { force: true })} className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface" title="Recarregar"><RefreshCw className="w-3.5 h-3.5" /></button>
              {listaPadraoId && (
                <button type="button" onClick={() => onCriar({ lista_id: listaPadraoId, titulo: 'Nova tarefa' }).then((r) => r?.data && abrirTarefa(r.data.id))} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-rl-purple text-white text-xs font-semibold hover:opacity-90">
                  <Plus className="w-3.5 h-3.5" /> Tarefa
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 h-11 px-4 border-t border-rl-border/60 overflow-x-auto scroll-hide">
              <div className="flex items-center gap-0.5 mr-2">
                {[{ v: 'lista', l: 'Lista', I: List }, { v: 'quadro', l: 'Quadro', I: KanbanSquare }].map(({ v, l, I }) => (
                  <button key={v} type="button" onClick={() => setView(v)} className={`inline-flex items-center gap-1.5 h-8 px-2.5 text-[13px] font-medium border-b-2 transition ${view === v ? 'text-rl-text border-rl-purple' : 'text-rl-muted border-transparent hover:text-rl-text'}`}>
                    <I className="w-4 h-4" /> {l}
                  </button>
                ))}
              </div>
              <MenuAgrupar valor={agrupar} onChange={setAgrupar} />
              <MenuResponsavel valor={filtroResp} membros={teamMembers || []} onChange={setFiltroResp} />
              <button type="button" onClick={() => setMostrarConcluidas((v) => !v)} className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium border transition ${mostrarConcluidas ? 'bg-rl-green/10 text-rl-green border-rl-green/30' : 'text-rl-subtle border-rl-border hover:bg-rl-surface'}`}>
                {mostrarConcluidas ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />} Concluídas
              </button>
              <div className="flex-1" />
              <div className="flex items-center gap-2 h-8 px-2.5 rounded-lg bg-rl-surface border border-rl-border w-[220px] shrink-0">
                <Search className="w-3.5 h-3.5 text-rl-muted shrink-0" />
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar tarefa" className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-rl-text placeholder:text-rl-muted" />
                {busca && <button type="button" onClick={() => setBusca('')} className="text-rl-muted hover:text-rl-text"><X className="w-3.5 h-3.5" /></button>}
              </div>
            </div>
          </header>

          {/* Conteúdo */}
          <div className="flex-1 min-h-0 overflow-auto pt-3">
            {t.loadingEstrutura ? (
              <div className="flex items-center justify-center py-20 text-rl-muted text-sm gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</div>
            ) : view === 'quadro' ? (
              <QuadroView grupos={grupos} filhosDe={filhosDe} ctx={ctx} />
            ) : (
              <ListaView grupos={grupos} filhosDe={filhosDe} ctx={ctx} mostrarConcluidas={mostrarConcluidas} />
            )}
          </div>
        </main>
      </div>

      {tarefaAbertaId && (tarefaAberta ? (
        <TarefaModal
          key={tarefaAberta.id}
          item={tarefaAberta}
          pai={tarefaAberta.parent_id ? t.itens[tarefaAberta.parent_id] : null}
          subtarefas={filhosDe.get(tarefaAberta.id) || []}
          statuses={statusesDaAberta}
          lista={listaDaAberta}
          pasta={listaDaAberta ? t.pastasMap.get(listaDaAberta.pasta_id) : null}
          membros={teamMembers || []}
          membrosMap={membrosMap}
          comentarios={t.comentarios[tarefaAberta.id]}
          user={user}
          onFechar={() => abrirTarefa(null)}
          onAtualizar={onAtualizar}
          onMudarStatus={onMudarStatus}
          onCriarSub={(pai, tituloSub) => onCriar({ lista_id: pai.lista_id, parent_id: pai.id, titulo: tituloSub })}
          onAbrir={abrirTarefa}
          onExcluir={async (id) => { const r = await t.excluirTarefa(id); if (r.error) showToast(r.error, 'error'); else { abrirTarefa(null); showToast('Tarefa excluída') } }}
          onComentar={async (id, texto) => { const r = await t.criarComentario(id, texto); if (r.error) showToast(r.error, 'error') }}
          onExcluirComentario={async (tarefaId, id) => { const r = await t.excluirComentario(tarefaId, id); if (r.error) showToast(r.error, 'error') }}
          onCarregarComentarios={t.carregarComentarios}
          onErro={(m) => showToast(m, 'error')}
        />
      ) : (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60"><Loader2 className="w-6 h-6 animate-spin text-white" /></div>
      ))}

      <Toast toast={toast} />
    </div>
  )
}
