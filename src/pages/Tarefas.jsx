import { apiFetch } from '../lib/api'
// Módulo Tarefas (VertaTask): réplica do ClickUp dentro da Área do Cliente, no visual do
// Linear (tokens ln-*, mesmo frame do módulo Atividades).
//
// Esta página é a moldura: coluna de pastas (uma por cliente) → listas, cabeçalho com
// breadcrumb e ações, e as seções próprias do VertaTask (Intake, Cycles, Templates, Pages,
// Analytics, Chat, Atividades). A área de tarefas em si (views, Lista/Quadro/Calendário/Gantt,
// filtros, seleção em massa, painel da tarefa) é o componente AreaTarefas, o mesmo do módulo
// Tarefas da página do cliente.
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSearchParams, useOutletContext } from 'react-router-dom'
import { Menu, ChevronRight, Plus, Loader2, PanelLeft, RefreshCw } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import Toast from '../components/UI/Toast'
import { useToast } from '../hooks/useToast'
import { useTarefas } from '../hooks/useTarefas'
import { useVertaTask } from '../hooks/useVertaTask'
import { useChatNaoLidas } from '../hooks/useChat'
import ChatModulo from '../components/Chat/ChatModulo'
import AtividadesModulo from '../components/Atividades/AtividadesModulo'
import PaginasView from '../components/Tarefas/PaginasView'
import AnalyticsView from '../components/Tarefas/AnalyticsView'
import { usePaginas } from '../hooks/usePaginas'
import { cicloPadrao } from '../lib/vertatask'
import TarefasSidebar from '../components/Tarefas/TarefasSidebar'
import CiclosView from '../components/Tarefas/CiclosView'
import TemplatesView from '../components/Tarefas/TemplatesView'
import TemplateEditor from '../components/Tarefas/TemplateEditor'
import { clonarItens, itensDoTemplate } from '../lib/templates'
import IntakeView from '../components/Tarefas/IntakeView'
import { FOCO } from '../components/Tarefas/Campos'
import AreaTarefas, { lerPref, gravarPref, useLarguraDoConteudo } from '../components/Tarefas/AreaTarefas'

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

export default function Tarefas() {
  const { user, projects, teamMembers, squads } = useApp()
  const { toast, showToast } = useToast()
  const { openSidebar } = useOutletContext()
  const [params, setParams] = useSearchParams()
  const t = useTarefas(user)
  const vt = useVertaTask(user)
  const pgHook = usePaginas(user)

  const conteudoRef = useRef(null)
  const largura = useLarguraDoConteudo(conteudoRef)
  const [arvoreAberta, setArvoreAberta] = useState(false)
  const [recarregarTick, setRecarregarTick] = useState(0)
  const [unidadeBurn, setUnidadeBurn] = useState(() => lerPref('burn', 'tarefas'))
  const sync = useSyncClickup({
    ativo: !t.loadingEstrutura,
    aoTerminar: useCallback((r) => {
      if (r?.emAndamento) { showToast('O ClickUp já está sendo sincronizado agora'); return }
      const n = (r?.criadas || 0) + (r?.atualizadas || 0)
      if (n > 0) { t.carregarEstrutura(); setRecarregarTick((x) => x + 1) }
      showToast(n > 0 ? `ClickUp sincronizado: ${n} tarefa(s) atualizada(s)` : 'ClickUp sincronizado, nada novo')
    }, [t, showToast]),
  })

  useEffect(() => gravarPref('burn', unidadeBurn), [unidadeBurn])

  // ── Seleção (pasta / lista / minhas) via URL ─────────────────────────────
  const aba = params.get('aba') // null = tarefas | 'intake' | 'ciclos' | 'templates' | 'paginas' | 'analytics' | 'chat' | 'atividades'
  const sel = useMemo(() => {
    if (aba === 'ciclos') return { tipo: 'ciclo', id: params.get('ciclo') || cicloPadrao(vt.ciclos)?.id || null }
    if (aba === 'templates' || aba === 'intake' || aba === 'chat' || aba === 'atividades' || aba === 'paginas' || aba === 'analytics') return { tipo: 'nenhum' }
    if (params.get('lista')) return { tipo: 'lista', id: params.get('lista') }
    if (params.get('pasta')) return { tipo: 'pasta', id: params.get('pasta') }
    if (params.get('minhas') === '1') return { tipo: 'minhas' }
    if (params.get('todas') === '1') return { tipo: 'todas' }
    return lerPref('sel', null) || { tipo: 'minhas' }
  }, [params, aba, vt.ciclos])
  const chatNaoLidas = useChatNaoLidas(user?.id, aba)

  const setSel = useCallback((s) => {
    gravarPref('sel', s)
    const p = new URLSearchParams()
    if (s.tipo === 'lista') p.set('lista', s.id)
    else if (s.tipo === 'pasta') p.set('pasta', s.id)
    else if (s.tipo === 'todas') p.set('todas', '1')
    else p.set('minhas', '1')
    setParams(p)
  }, [setParams])

  const irAba = useCallback((a, extra = {}) => {
    if (a === 'tarefas') { setSel(lerPref('sel', null) || { tipo: 'minhas' }); return }
    setParams(new URLSearchParams({ aba: a, ...extra }))
  }, [setSel, setParams])

  // depois de aplicar um template: abre a lista onde as tarefas nasceram (e a tarefa, se é uma só)
  const irParaLista = useCallback((listaId, tarefaId) => {
    gravarPref('sel', { tipo: 'lista', id: listaId })
    const p = new URLSearchParams({ lista: listaId })
    if (tarefaId) p.set('tarefa', tarefaId)
    setParams(p)
  }, [setParams])

  // ── Templates ────────────────────────────────────────────────────────────
  const templateAbertoId = aba === 'templates' ? params.get('template') : null
  const templateAberto = templateAbertoId ? vt.modelos.find((m) => m.id === templateAbertoId) : null
  const abrirTemplate = useCallback((id) => irAba('templates', id ? { template: id } : {}), [irAba])

  const novoTemplate = useCallback(async () => {
    const r = await vt.criarModelo({ nome: 'Novo template', itens: [] })
    if (r.error) showToast(r.error, 'error'); else abrirTemplate(r.data.id)
  }, [vt, showToast, abrirTemplate])

  const duplicarTemplate = useCallback(async (m) => {
    const r = await vt.criarModelo({ nome: `${m.nome} (cópia)`, descricao: m.descricao || null, itens: clonarItens(itensDoTemplate(m)) })
    if (r.error) showToast(r.error, 'error'); else { showToast('Template duplicado'); abrirTemplate(r.data.id) }
  }, [vt, showToast, abrirTemplate])

  const excluirTemplate = useCallback(async (m) => {
    if (!window.confirm(`Apagar o template "${m.nome}"? As tarefas já criadas com ele continuam.`)) return
    const r = await vt.excluirModelo(m.id)
    if (r.error) { showToast(r.error, 'error'); return }
    showToast('Template apagado')
    if (templateAbertoId === m.id) abrirTemplate(null)
  }, [vt, showToast, templateAbertoId, abrirTemplate])

  const salvarTemplate = useCallback(async (id, patch) => {
    const r = await vt.atualizarModelo(id, patch)
    if (r.error) showToast(r.error, 'error'); else showToast('Template salvo')
    return r
  }, [vt, showToast])

  const moverPendentes = useCallback(async (origem, destino) => {
    const ids = Object.values(t.itens).filter((it) => it.ciclo_id === origem && !it.parent_id && it.status_tipo !== 'closed').map((i) => i.id)
    if (!ids.length) return
    const { error } = await supabase.from('tarefas_itens').update({ ciclo_id: destino }).in('id', ids)
    if (error) { showToast(error.message, 'error'); return }
    t.aplicarLocal(ids, { ciclo_id: destino })
    showToast(`${ids.length} tarefa(s) passaram para o outro cycle`)
  }, [t, showToast])

  useEffect(() => {
    if (t.loadingEstrutura) return
    if (sel.tipo === 'pasta' && !t.pastasMap.has(sel.id)) setSel({ tipo: 'minhas' })
    if (sel.tipo === 'lista' && !t.listasMap.has(sel.id)) setSel({ tipo: 'minhas' })
  }, [t.loadingEstrutura, sel, t.pastasMap, t.listasMap, setSel])

  const membrosMap = useMemo(() => new Map((teamMembers || []).map((m) => [m.id, m])), [teamMembers])
  const todos = useMemo(() => Object.values(t.itens), [t.itens])

  // Abertas por pasta, só do que já está carregado (a lista de clientes mostra o número quando existe).
  const contagemPorPasta = useMemo(() => {
    const porLista = new Map()
    for (const it of todos) if (!it.parent_id && it.status_tipo !== 'closed') porLista.set(it.lista_id, (porLista.get(it.lista_id) || 0) + 1)
    const m = {}
    for (const l of t.listas) if (porLista.has(l.id)) m[l.pasta_id] = (m[l.pasta_id] || 0) + porLista.get(l.id)
    return m
  }, [todos, t.listas])

  const aceitarIntake = useCallback(async (it, { pastaId, responsavelId }) => {
    const lista = t.listas.find((l) => l.pasta_id === pastaId && l.nome === 'Geral') || t.listas.find((l) => l.pasta_id === pastaId)
    if (!lista) { showToast('Essa pasta não tem lista. Crie uma lista primeiro.', 'error'); return }
    const r = await t.criarTarefa({
      lista_id: lista.id, titulo: it.titulo, prioridade: it.prioridade,
      descricao: it.descricao ? `${it.descricao}\n\nOrigem: ${it.origem}` : `Origem: ${it.origem}`,
      responsaveis: responsavelId ? [responsavelId] : [],
    })
    if (r.error) { showToast(r.error, 'error'); return }
    const d = await vt.decidirIntake(it.id, { status: 'aceito', tarefa_id: r.data.id })
    if (d.error) showToast(d.error, 'error')
    else showToast(`Tarefa criada em ${lista.nome}`)
  }, [t, vt, showToast])

  // ── Cabeçalho ────────────────────────────────────────────────────────────
  const pastaSel = sel.tipo === 'pasta' ? t.pastasMap.get(sel.id) : sel.tipo === 'lista' ? t.pastasMap.get(t.listasMap.get(sel.id)?.pasta_id) : null
  const listaSel = sel.tipo === 'lista' ? t.listasMap.get(sel.id) : null
  // seções que trocam a área de tarefas por outro conteúdo (Cycles mantém a área, com o resumo em cima)
  const ehSecao = aba === 'intake' || aba === 'templates' || aba === 'paginas' || aba === 'analytics'

  const cabecalho = (api) => (
    <header className="min-h-[56px] shrink-0 flex items-center justify-between gap-3 px-6 py-2 border-b border-ln-ink/[0.08]">
      <div className="flex items-center gap-2 min-w-0">
        <button onClick={openSidebar} aria-label="Abrir menu de navegação" className="ln-iconbtn lg:hidden"><Menu className="w-4 h-4" /></button>
        <button onClick={() => setArvoreAberta(true)} aria-label="Abrir pastas" className="ln-iconbtn md:hidden"><PanelLeft className="w-4 h-4" /></button>
        <h1 className="text-xl font-bold text-ln-t1 truncate">{{ intake: 'Intake', ciclos: 'Cycles', templates: 'Templates', paginas: 'Pages', analytics: 'Analytics' }[aba] || 'Tarefas'}</h1>
        {!aba && (
          <div className="hidden sm:flex items-center gap-1.5 text-[13px] text-ln-t3 min-w-0">
            {pastaSel && (<>
              <ChevronRight className="w-3 h-3 text-ln-t4 shrink-0" />
              <button type="button" onClick={() => setSel({ tipo: 'pasta', id: pastaSel.id })} className={`truncate max-w-[200px] rounded ${listaSel ? 'hover:text-ln-t1' : 'text-ln-t2'} ${FOCO}`}>{pastaSel.nome}</button>
            </>)}
            {listaSel && (<><ChevronRight className="w-3 h-3 text-ln-t4 shrink-0" /><span className="truncate max-w-[200px] text-ln-t2">{listaSel.nome}</span></>)}
            {sel.tipo === 'minhas' && (<><ChevronRight className="w-3 h-3 text-ln-t4 shrink-0" /><span className="text-ln-t2">Minhas tarefas</span></>)}
            {sel.tipo === 'todas' && (<><ChevronRight className="w-3 h-3 text-ln-t4 shrink-0" /><span className="text-ln-t2">Todas as abertas</span></>)}
          </div>
        )}
        {(!aba || aba === 'ciclos') && <span className="hidden xl:inline text-xs text-ln-t4 tabular whitespace-nowrap">{api.totalAbertas} abertas</span>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {t.carregando && <Loader2 className="w-3.5 h-3.5 animate-spin text-ln-t4" />}
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
        <button onClick={api.recarregar} className="ln-iconbtn" aria-label="Recarregar" title="Recarregar"><RefreshCw className="w-3.5 h-3.5" /></button>
        {aba !== 'templates' && !api.mostrarViews && (
          <button onClick={api.novaTarefa} className="ln-primary" title="Nova tarefa (C)">
            <Plus className="w-3.5 h-3.5" /> Nova tarefa
          </button>
        )}
      </div>
    </header>
  )

  const secao = !ehSecao ? null : (api) => (
    aba === 'intake' ? (
      <IntakeView vt={vt} pastas={t.pastas} listas={t.listas} projetos={projects || []} membros={teamMembers || []} onAceitar={aceitarIntake} onToast={showToast} onAbrirTarefa={api.abrirTarefa} />
    ) : aba === 'paginas' ? (
      <PaginasView pg={pgHook} projetos={projects || []} user={user} paginaId={params.get('pagina')} onSelecionar={(id) => setParams(id ? new URLSearchParams({ aba: 'paginas', pagina: id }) : new URLSearchParams({ aba: 'paginas' }))} onToast={showToast} />
    ) : aba === 'analytics' ? (
      <AnalyticsView />
    ) : templateAbertoId ? (
      templateAberto ? (
        <TemplateEditor
          key={templateAberto.id}
          template={templateAberto} membros={teamMembers || []} membrosMap={membrosMap}
          etiquetas={vt.etiquetas} onCriarEtiqueta={vt.criarEtiqueta}
          onSalvar={(patch) => salvarTemplate(templateAberto.id, patch)}
          onVoltar={() => abrirTemplate(null)}
          onAplicar={(tpl) => api.usarModelo(tpl)}
          onDuplicar={duplicarTemplate} onExcluir={excluirTemplate}
        />
      ) : (
        <div className="text-center text-[13px] text-ln-t4 py-20">Template não encontrado. <button type="button" onClick={() => abrirTemplate(null)} className="text-ln-accent hover:underline">Ver todos</button></div>
      )
    ) : (
      <TemplatesView modelos={vt.modelos} membrosMap={membrosMap} onNovo={novoTemplate} onAbrir={abrirTemplate} onAplicar={(m) => api.usarModelo(m)} onDuplicar={duplicarTemplate} onExcluir={excluirTemplate} />
    )
  )

  return (
    <>

      <div ref={conteudoRef} className="ln vt flex-1 min-w-0 flex flex-col h-screen bg-ln-bg">
        <div className="flex-1 min-h-0">
          <div className="relative h-full min-h-0 flex bg-ln-panel overflow-hidden">
            <TarefasSidebar
              pastas={t.pastas} listas={t.listas} projetos={projects} sel={sel} onSel={setSel}
              onCriarPasta={(nome) => t.criarPasta({ nome })}
              onCriarLista={(pastaId, nome) => t.criarLista({ pasta_id: pastaId, nome })}
              onAtualizarPasta={t.atualizarPasta}
              onAtualizarLista={t.atualizarLista}
              aberta={arvoreAberta} onFechar={() => setArvoreAberta(false)}
              nav={{ aba: aba || 'tarefas', onAba: irAba, intake: vt.intakePendentes.length, chat: chatNaoLidas }}
              contagem={contagemPorPasta}
            />

            {/* ── Área principal: Chat e Atividades têm tela própria; o resto é a área de tarefas ── */}
            {aba === 'chat' ? <ChatModulo onAbrirMenu={openSidebar} /> : aba === 'atividades' ? <AtividadesModulo onAbrirMenu={openSidebar} /> : (
              <AreaTarefas
                t={t} vt={vt} sel={sel} user={user} projects={projects} teamMembers={teamMembers} squads={squads} showToast={showToast}
                largura={largura} recarregarTick={recarregarTick}
                cabecalho={cabecalho} secao={secao}
                antesDaView={aba === 'ciclos' ? (
                  <CiclosView ciclos={vt.ciclos} ciclo={sel.id ? vt.ciclosMap.get(sel.id) : null} itens={todos} onSel={(id) => irAba('ciclos', { ciclo: id })} vt={vt} onToast={showToast} unidade={unidadeBurn} onUnidade={setUnidadeBurn} membros={teamMembers || []} onMoverPendentes={moverPendentes} />
                ) : null}
                semRolagem={aba === 'paginas' || aba === 'templates'}
                atalhoCriar={aba !== 'paginas' && aba !== 'templates'}
                onIrParaLista={irParaLista} onAbrirTemplate={abrirTemplate}
              />
            )}
          </div>
        </div>
      </div>

      <Toast toast={toast} />
    </>
  )
}
