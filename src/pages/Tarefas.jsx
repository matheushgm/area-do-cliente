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
import { useSearchParams, useOutletContext } from 'react-router-dom'
import {
  Menu, ChevronRight, X, Plus, Loader2, PanelLeft, RefreshCw, Maximize2, Minimize2, CalendarDays, CircleDot, Users, Flag, Hourglass,
  Shapes, CalendarClock, ExternalLink, CornerDownRight,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import Toast from '../components/UI/Toast'
import { useToast } from '../hooks/useToast'
import { useTarefas } from '../hooks/useTarefas'
import { useVertaTask } from '../hooks/useVertaTask'
import { useChatNaoLidas } from '../hooks/useChat'
import ChatModulo from '../components/Chat/ChatModulo'
import AtividadesModulo from '../components/Atividades/AtividadesModulo'
import GanttView from '../components/Tarefas/GanttView'
import PaginasView from '../components/Tarefas/PaginasView'
import AnalyticsView from '../components/Tarefas/AnalyticsView'
import { AbasViews, FerramentasView } from '../components/Tarefas/BarraViews'
import { PainelConfigView, PainelNovaView } from '../components/Tarefas/PainelView'
import PainelFiltros from '../components/Tarefas/PainelFiltros'
import { escopoDaSelecao, chaveEscopo, viewsDoEscopo, igualConfig, passaResponsaveis, nomeResponsavelFiltro } from '../lib/viewsTarefas'
import { passaFiltros, contarRegras } from '../lib/filtrosTarefas'
import { usePaginas } from '../hooks/usePaginas'
import { cicloPadrao } from '../lib/vertatask'
import { statusDaLista, statusDasListas, agruparItens, filtrarItens, STATUSES_PADRAO, novoId } from '../lib/tarefas'
import TarefasSidebar from '../components/Tarefas/TarefasSidebar'
import ListaView from '../components/Tarefas/ListaView'
import QuadroView from '../components/Tarefas/QuadroView'
import TarefaPanel from '../components/Tarefas/TarefaPanel'
import CalendarioView from '../components/Tarefas/CalendarioView'
import CiclosView from '../components/Tarefas/CiclosView'
import TemplatesView from '../components/Tarefas/TemplatesView'
import TemplateEditor from '../components/Tarefas/TemplateEditor'
import AplicarTemplateView from '../components/Tarefas/AplicarTemplateView'
import { templateDaTarefa, clonarItens, itensDoTemplate } from '../lib/templates'
import IntakeView from '../components/Tarefas/IntakeView'
import { FOCO, StatusCampo, DataCampo, PrioridadeCampo, TipoTarefaCampo, EstimativaCampo } from '../components/Tarefas/Campos'
import BarraSelecao, { BotaoBarra, ResponsaveisEmMassa, aplicarDiferenca } from '../components/Tarefas/BarraSelecao'
import { MenuTarefa } from '../components/Tarefas/TarefaExtras'

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

const SEM_FILHOS = new Map() // subtarefas "Separar": cada uma vira linha própria, sem aninhar

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
  const [denso, setDenso] = useState(() => lerPref('denso', false))
  const [busca, setBusca] = useState('')
  const [rascunhoView, setRascunhoView] = useState(null) // { chave, config }: o que mudou na tela e não foi salvo
  const [painelView, setPainelView] = useState(null) // null | 'config' | 'nova' | 'filtros' (sidebar à direita)
  const [painelExpandido, setPainelExpandido] = useState(false)
  const [recarregarTick, setRecarregarTick] = useState(0)
  const [selecionadas, setSelecionadas] = useState(() => new Set()) // seleção da Lista (barra no rodapé)
  const [emMassa, setEmMassa] = useState(false)
  const [aplicandoTpl, setAplicandoTpl] = useState(null) // { template, listaId }: tela "Aplicar template"
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

  useEffect(() => gravarPref('denso', denso), [denso])
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
  const tarefaAbertaId = params.get('tarefa')
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

  // ── Visualizações: abas da pasta (ou de Minhas/Todas), src/lib/viewsTarefas.js ──
  // A tela mostra o rascunho da view ativa; a barra mexe no rascunho e "Salvar
  // visualização" grava. A sidebar de configurações grava na hora.
  const mostrarViews = !aba || aba === 'ciclos'
  const escopoViews = useMemo(() => escopoDaSelecao(sel, t.listasMap), [sel, t.listasMap])
  const chaveEsc = chaveEscopo(escopoViews)
  const persistente = !!escopoViews
  const { padrao: viewsPadrao, salvas: viewsSalvas } = useMemo(() => viewsDoEscopo(vt.views, escopoViews), [vt.views, escopoViews])
  const viewParam = params.get('view')
  const viewAtiva = useMemo(() => {
    const todasV = [...viewsPadrao, ...viewsSalvas]
    return todasV.find((v) => v.chave === viewParam) || todasV.find((v) => v.chave === lerPref(`viewAtiva.${chaveEsc}`, null)) || viewsPadrao[0]
  }, [viewsPadrao, viewsSalvas, viewParam, chaveEsc])
  const chaveRascunho = `${chaveEsc}|${viewAtiva.chave}`
  const config = rascunhoView?.chave === chaveRascunho ? rascunhoView.config : viewAtiva.config
  const alterada = persistente && !igualConfig(viewAtiva.config, config)
  const podeEditarView = persistente && (viewAtiva.padrao || viewAtiva.donoId === user?.id)
  const view = config.tipo
  const agrupar = config.agrupar
  const mostrarConcluidas = config.concluidas
  // em "Minhas tarefas" o responsável é sempre a pessoa logada: o filtro da barra fica travado
  const respBloqueado = sel.tipo === 'minhas'
  const respFiltro = useMemo(() => (respBloqueado ? [] : config.responsaveis), [respBloqueado, config.responsaveis])

  const editarView = useCallback((patch) => {
    setRascunhoView((prev) => ({ chave: chaveRascunho, config: { ...(prev?.chave === chaveRascunho ? prev.config : viewAtiva.config), ...patch } }))
  }, [chaveRascunho, viewAtiva])
  const gravarView = useCallback((patch) => (viewAtiva.padrao
    ? vt.salvarViewPadrao({ escopo: escopoViews, tipo: viewAtiva.chave, nome: viewAtiva.nome, patch })
    : vt.atualizarView(viewAtiva.row.id, patch)), [viewAtiva, escopoViews, vt])
  const salvarVisualizacao = useCallback(async () => {
    if (!podeEditarView || !alterada) return
    const r = await gravarView({ config })
    if (r.error) showToast(r.error, 'error'); else { setRascunhoView(null); showToast(`"${viewAtiva.nome}" salva`) }
  }, [podeEditarView, alterada, gravarView, config, viewAtiva.nome, showToast])
  const reverterView = useCallback(() => { setRascunhoView(null); showToast('Alterações revertidas') }, [showToast])
  // sidebar de configurações: grava na hora (levando junto o que estava pendente na barra)
  const editarViewNaSidebar = useCallback(async (patch) => {
    const novo = { ...config, ...patch }
    setRascunhoView({ chave: chaveRascunho, config: novo })
    if (!podeEditarView) return
    const r = await gravarView({ config: novo })
    if (r.error) showToast(r.error, 'error')
  }, [config, chaveRascunho, podeEditarView, gravarView, showToast])
  const metaView = useCallback(async (patch) => {
    const r = await gravarView(patch)
    if (r.error) showToast(r.error, 'error')
    else if (patch.acesso) showToast(patch.acesso === 'privada' ? 'Agora só você vê esta visualização' : 'Visualização compartilhada com o time')
  }, [gravarView, showToast])
  const abrirView = useCallback((v) => {
    gravarPref(`viewAtiva.${chaveEsc}`, v.chave)
    setRascunhoView(null)
    setPainelView((p) => (p === 'nova' ? null : p))
    const p = new URLSearchParams(params)
    p.set('view', v.chave)
    setParams(p)
  }, [chaveEsc, params, setParams])
  const criarVisualizacao = useCallback(async ({ nome, publica, cfg = config }) => {
    const r = await vt.criarView({ nome, config: cfg, acesso: publica ? 'publica' : 'privada', escopo: escopoViews })
    if (r.error) { showToast(r.error, 'error'); return r }
    abrirView({ chave: r.data.id })
    setPainelView('config')
    showToast(`Visualização "${nome}" criada`)
    return r
  }, [vt, config, escopoViews, abrirView, showToast])
  const excluirVisualizacao = useCallback(async () => {
    if (viewAtiva.padrao) return
    const r = await vt.excluirView(viewAtiva.row.id)
    if (r.error) { showToast(r.error, 'error'); return }
    setPainelView(null)
    abrirView(viewsPadrao[0])
    showToast('Visualização excluída')
  }, [vt, viewAtiva, viewsPadrao, abrirView, showToast])

  // ── Templates ────────────────────────────────────────────────────────────
  const templateAbertoId = aba === 'templates' ? params.get('template') : null
  const templateAberto = templateAbertoId ? vt.modelos.find((m) => m.id === templateAbertoId) : null
  const abrirTemplate = useCallback((id) => irAba('templates', id ? { template: id } : {}), [irAba])

  const salvarComoModelo = useCallback(async (item, subs = []) => {
    const nome = window.prompt('Nome do template', item.titulo)
    if (!nome || !nome.trim()) return
    const r = await vt.criarModelo({ nome, itens: templateDaTarefa(item, subs) })
    if (r.error) { showToast(r.error, 'error'); return }
    showToast('Template salvo. Ajuste prazos e responsáveis no construtor.')
    abrirTemplate(r.data.id)
  }, [vt, showToast, abrirTemplate])

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

  const abrirTarefa = useCallback((id) => {
    if (id) setPainelView(null)
    const p = new URLSearchParams(params)
    if (id) p.set('tarefa', id); else p.delete('tarefa')
    setParams(p, { replace: !!params.get('tarefa') })
  }, [params, setParams])
  const fecharPainel = useCallback(() => { setPainelExpandido(false); abrirTarefa(null) }, [abrirTarefa])
  const abrirPainelView = useCallback((qual) => {
    if (qual && tarefaAbertaId) abrirTarefa(null)
    setPainelView(qual)
  }, [tarefaAbertaId, abrirTarefa])

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
    else if (sel.tipo === 'todas') t.carregarAbertas({ force })
    else if (sel.tipo === 'ciclo' && sel.id) t.carregarPorCampo('ciclo_id', sel.id, { force })
    else if (listasEscopo.length) t.carregarListas(listasEscopo.map((l) => l.id), { force })
  }, [sel.tipo, sel.id, t.carregarPorCampo, t.carregarAbertas, listasEscopo, t.loadingEstrutura, t.carregarMinhas, t.carregarListas, recarregarTick]) // eslint-disable-line react-hooks/exhaustive-deps

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
    if (sel.tipo === 'todas') return todos
    if (sel.tipo === 'ciclo') return todos.filter((it) => it.ciclo_id === sel.id)
    const ids = new Set(listasEscopo.map((l) => l.id))
    return todos.filter((it) => ids.has(it.lista_id))
  }, [todos, sel.tipo, sel.id, listasEscopo, user?.id])

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

  // Recolhidas/Expandidas: filtra e agrupa só as tarefas de cima (as subtarefas vêm junto do
  // pai). Separar: cada tarefa e subtarefa é avaliada e agrupada pelos próprios campos.
  // Filtros da barra (busca, responsáveis, concluídas) E filtros avançados da sidebar.
  const separar = config.subtarefas === 'separar'
  const baseFiltro = separar ? itensEscopo : topo
  const filtrados = useMemo(() => {
    const resp = respFiltro
    return filtrarItens(baseFiltro, { busca, mostrarConcluidas })
      .filter((it) => passaResponsaveis(it, resp))
      .filter((it) => passaFiltros(it, config.filtros))
  }, [baseFiltro, busca, mostrarConcluidas, respFiltro, config.filtros])
  const filhosVisao = separar ? SEM_FILHOS : filhosDe

  const grupos = useMemo(() => {
    const g = agruparItens(filtrados, agrupar, { statuses, membrosMap, listasMap: t.listasMap, ciclosMap: vt.ciclosMap })
    if (agrupar === 'status' && view === 'quadro') {
      const existentes = new Map(g.map((x) => [x.key, x]))
      return statuses
        .filter((s) => mostrarConcluidas || s.tipo !== 'closed')
        .map((s) => existentes.get(s.key) || { key: s.key, label: s.label, cor: s.cor, itens: [] })
    }
    return g
  }, [filtrados, agrupar, statuses, membrosMap, t.listasMap, vt.ciclosMap, view, mostrarConcluidas])

  const contagemComentarios = useMemo(() => {
    const m = {}
    for (const [id, arr] of Object.entries(t.comentarios)) m[id] = arr.length
    return m
  }, [t.comentarios])

  // Fora de uma pasta/lista (cycles, minhas): usa a última lista visitada.
  // Abertas por pasta, só do que já está carregado (a lista de clientes mostra o número quando existe).
  const contagemPorPasta = useMemo(() => {
    const porLista = new Map()
    for (const it of todos) if (!it.parent_id && it.status_tipo !== 'closed') porLista.set(it.lista_id, (porLista.get(it.lista_id) || 0) + 1)
    const m = {}
    for (const l of t.listas) if (porLista.has(l.id)) m[l.pasta_id] = (m[l.pasta_id] || 0) + porLista.get(l.id)
    return m
  }, [todos, t.listas])

  const listaPadraoId = useMemo(() => {
    if (sel.tipo === 'lista') return sel.id
    if (listasEscopo[0]) return listasEscopo[0].id
    const ult = lerPref('sel', null)
    if (ult?.tipo === 'lista' && t.listasMap.has(ult.id)) return ult.id
    if (ult?.tipo === 'pasta') return t.listas.find((l) => l.pasta_id === ult.id)?.id || null
    return null
  }, [sel, listasEscopo, t.listasMap, t.listas])

  // ── Ações ────────────────────────────────────────────────────────────────
  const onCriar = useCallback(async (payload) => {
    // dentro de um cycle, a tarefa nova já nasce nele
    const escopo = payload.parent_id ? {} : { ciclo_id: sel.tipo === 'ciclo' ? sel.id : undefined }
    const r = await t.criarTarefa({ ...payload, ...escopo })
    if (r.error) showToast(r.error, 'error')
    return r
  }, [t, sel, showToast])
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

  const usarModelo = useCallback((m) => setAplicandoTpl({ template: m, listaId: listaPadraoId }), [listaPadraoId])

  /** Cria as tarefas do plano (pais antes dos filhos) e as dependências como "bloqueia". */
  const aplicarTemplate = useCallback(async ({ listaId, plano, onProgresso }) => {
    const mapa = new Map()
    const base = Date.now()
    for (const [i, l] of plano.entries()) {
      const parent_id = l.paiId ? mapa.get(l.paiId) : null
      if (l.paiId && !parent_id) continue
      const it = l.item
      const r = await t.criarTarefa({
        lista_id: listaId, parent_id, titulo: l.titulo, descricao: l.descricao, posicao: base + i,
        prioridade: it.prioridade, estimativa_min: it.estimativa_min, tipo_tarefa: it.tipo_tarefa, dificuldade: it.dificuldade,
        departamento: it.departamento, etiquetas: it.etiquetas, responsaveis: l.responsaveis,
        data_inicio: l.data_inicio, data_vencimento: l.data_vencimento,
        checklists: it.checklists.map((c) => ({ ...c, id: novoId(), itens: (c.itens || []).map((x) => ({ ...x, id: novoId(), feito: false })) })),
      })
      if (r.error) {
        showToast(`Parou em "${l.titulo}" (${r.error}). ${mapa.size} tarefa(s) já criada(s).`, 'error')
        return { error: r.error }
      }
      mapa.set(it.id, r.data.id)
      onProgresso?.(mapa.size)
    }
    const relacoes = plano.flatMap((l) => l.item.depende_de.filter((d) => mapa.has(d) && mapa.has(l.item.id))
      .map((d) => ({ tarefa_id: mapa.get(d), relacionada_id: mapa.get(l.item.id), tipo: 'bloqueia', criado_por: user?.id || null })))
    if (relacoes.length) {
      const { error } = await supabase.from('tarefas_relacoes').insert(relacoes)
      if (error) showToast(`Tarefas criadas, mas as dependências falharam: ${error.message}`, 'error')
    }
    const raizes = plano.filter((l) => !l.paiId)
    setAplicandoTpl(null)
    gravarPref('sel', { tipo: 'lista', id: listaId })
    const p = new URLSearchParams({ lista: listaId })
    if (raizes.length === 1 && mapa.get(raizes[0].item.id)) p.set('tarefa', mapa.get(raizes[0].item.id))
    setParams(p)
    showToast(`${mapa.size} tarefa(s) criada(s) a partir do template`)
    return {}
  }, [t, user?.id, showToast, setParams])

  // Atalhos: C cria, Esc fecha o painel (fora de campos de texto).
  useEffect(() => {
    const h = (e) => {
      // Ctrl+Enter salva a visualização (fora de campos, para não brigar com comentários)
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && mostrarViews && alterada && podeEditarView && !estaDigitando()) { e.preventDefault(); salvarVisualizacao(); return }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Escape' && painelView && !estaDigitando()) { e.preventDefault(); setPainelView(null); return }
      if (e.key === 'Escape' && tarefaAbertaId && !estaDigitando()) { e.preventDefault(); if (painelExpandido) setPainelExpandido(false); else fecharPainel(); return }
      if (e.key === 'Escape' && selecionadas.size && !aplicandoTpl && !estaDigitando()) { e.preventDefault(); setSelecionadas(new Set()) }
      if ((e.key === 'c' || e.key === 'C') && !estaDigitando() && aba !== 'chat' && aba !== 'atividades' && aba !== 'paginas' && aba !== 'templates' && !aplicandoTpl) { e.preventDefault(); novaTarefa() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [tarefaAbertaId, painelExpandido, fecharPainel, novaTarefa, aba, aplicandoTpl, selecionadas.size, mostrarViews, alterada, podeEditarView, salvarVisualizacao, painelView])

  const ctx = useMemo(() => ({
    statuses, membros: teamMembers || [], membrosMap, itensMap: t.itens, listaPadraoId, agrupar, contagemComentarios, selecionadaId: tarefaAbertaId,
    onAbrir: abrirTarefa, onAtualizar, onMudarStatus, onCriar, etiquetasMap: vt.etiquetasMap,
    // cada tarefa só oferece os status da própria lista (Minhas/Todas misturam listas)
    statusesDe: (it) => { const l = t.listasMap.get(it.lista_id); return l ? statusDaLista(l) : statuses },
    // colunas Cliente e Sprints da Lista (estilo ClickUp)
    listas: t.listas, pastas: t.pastas, projetos: projects || [], ciclos: vt.ciclos || [],
    // subtarefas: Expandidas abre todas; Separar mostra "↳ pai" ao lado do título
    expandirTudo: config.subtarefas === 'expandidas',
    // ordenação pelos cabeçalhos da Lista (rascunho da view, como a barra)
    ordenar: config.ordenar, onOrdenar: (ordenar) => editarView({ ordenar }),
    calendario: config.calendario, onCalendario: (calendario) => editarView({ calendario }),
    // Separar: nome da tarefa-pai para Quadro, Calendário e Gantt
    nomePai: config.subtarefas === 'separar' ? (it) => (it.parent_id ? t.itens[it.parent_id]?.titulo || null : null) : undefined,
    rotuloPai: config.subtarefas === 'separar' ? (it) => (it.parent_id && t.itens[it.parent_id] ? (
      <span className="inline-flex items-center gap-1 ml-1.5 min-w-0 text-[11px] text-ln-t4" title={`Subtarefa de ${t.itens[it.parent_id].titulo}`}>
        <CornerDownRight className="w-3 h-3 shrink-0" /><span className="truncate max-w-[220px]">{t.itens[it.parent_id].titulo}</span>
      </span>
    ) : null) : undefined,
  }), [vt.etiquetasMap, vt.ciclos, statuses, teamMembers, membrosMap, t.itens, t.listas, t.pastas, projects, listaPadraoId, agrupar, contagemComentarios, tarefaAbertaId, abrirTarefa, onAtualizar, onMudarStatus, onCriar, config.subtarefas, t.listasMap, config.ordenar, config.calendario, editarView])

  // ── Seleção da Lista e ações em massa (BarraSelecao) ─────────────────────
  // a seleção vale para o que está na tela: trocar de pasta, lista, seção ou visão limpa
  useEffect(() => { setSelecionadas(new Set()) }, [sel.tipo, sel.id, aba, view])
  const selecao = useMemo(() => ({
    ids: selecionadas,
    alternar: (id) => setSelecionadas((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n }),
    definir: (ids, marcar) => setSelecionadas((p) => { const n = new Set(p); for (const id of ids) { if (marcar) n.add(id); else n.delete(id) } return n }),
  }), [selecionadas])
  const itensSel = useMemo(() => [...selecionadas].map((id) => t.itens[id]).filter(Boolean), [selecionadas, t.itens])
  // subtarefa cujo pai também está selecionado vai junto com o pai (duplicar/excluir)
  const raizesSel = useMemo(() => itensSel.filter((it) => !(it.parent_id && selecionadas.has(it.parent_id))), [itensSel, selecionadas])

  /** Roda fn em cada selecionada, uma de cada vez; fn devolve null para "pulada". */
  const emLote = useCallback(async (fn, rotulo) => {
    setEmMassa(true)
    let ok = 0, puladas = 0, falhas = 0
    for (const it of itensSel) {
      const r = await fn(it)
      if (r === null) puladas++
      else if (r?.error) falhas++
      else ok++
    }
    setEmMassa(false)
    const extra = [puladas && `${puladas} sem esse status na lista`, falhas && `${falhas} com erro`].filter(Boolean).join(', ')
    showToast(`${rotulo}: ${ok} tarefa(s)${extra ? ` (${extra})` : ''}`, falhas ? 'error' : undefined)
  }, [itensSel, showToast])
  const atualizarSel = useCallback((patch, rotulo) => emLote((it) => t.atualizarTarefa(it.id, typeof patch === 'function' ? patch(it) : patch), rotulo), [emLote, t])

  const copiaDe = (it, extra) => ({
    lista_id: it.lista_id, parent_id: it.parent_id, titulo: it.titulo, descricao: it.descricao, status: it.status, prioridade: it.prioridade,
    responsaveis: it.responsaveis, data_inicio: it.data_inicio, data_vencimento: it.data_vencimento, estimativa_min: it.estimativa_min,
    tipo_tarefa: it.tipo_tarefa, dificuldade: it.dificuldade, departamento: it.departamento, tags: it.tags, etiquetas: it.etiquetas,
    checklists: it.checklists, ciclo_id: it.ciclo_id, posicao: (Number(it.posicao) || 0) + 0.5, ...extra,
  })
  const duplicarSel = useCallback(async () => {
    setEmMassa(true)
    let n = 0, falhas = 0
    for (const it of raizesSel) {
      const r = await t.criarTarefa(copiaDe(it))
      if (r.error) { falhas++; continue }
      n++
      for (const f of filhosDe.get(it.id) || []) {
        const rf = await t.criarTarefa(copiaDe(f, { parent_id: r.data.id, lista_id: r.data.lista_id }))
        if (rf.error) falhas++; else n++
      }
    }
    setEmMassa(false)
    setSelecionadas(new Set())
    showToast(`${n} tarefa(s) duplicada(s)${falhas ? `, ${falhas} com erro` : ''}`, falhas ? 'error' : undefined)
  }, [raizesSel, filhosDe, t, showToast])
  const excluirSel = useCallback(async () => {
    const nSubs = raizesSel.reduce((a, it) => a + (filhosDe.get(it.id) || []).length, 0)
    if (!window.confirm(`Excluir ${raizesSel.length} tarefa(s)${nSubs ? ` e ${nSubs} subtarefa(s) delas` : ''}? A exclusão também acontece no ClickUp.`)) return
    setEmMassa(true)
    let n = 0, falhas = 0
    for (const it of raizesSel) { const r = await t.excluirTarefa(it.id); if (r.error) falhas++; else n++ }
    setEmMassa(false)
    if (tarefaAbertaId && selecionadas.has(tarefaAbertaId)) fecharPainel()
    setSelecionadas(new Set())
    showToast(`${n} tarefa(s) excluída(s)${falhas ? `, ${falhas} com erro` : ''}`, falhas ? 'error' : undefined)
  }, [raizesSel, filhosDe, t, showToast, tarefaAbertaId, selecionadas, fecharPainel])
  const statusComum = itensSel.length && itensSel.every((i) => i.status === itensSel[0].status) ? itensSel[0].status : null

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
  const comTopo = aba === 'ciclos' // cabeçalho acima da view: a página rola inteira
  const semRolagem = aba === 'paginas' || aba === 'templates' // templates (lista e editor) rolam por dentro
  const painel = !!tarefaAbertaId

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

            {/* ── Painel principal ─────────────────────────────────────── */}
            {aba === 'chat' ? <ChatModulo onAbrirMenu={openSidebar} /> : aba === 'atividades' ? <AtividadesModulo onAbrirMenu={openSidebar} /> : (
            <div className="relative flex-1 min-w-0 flex flex-col">
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
                  {(!aba || aba === 'ciclos') && <span className="hidden xl:inline text-xs text-ln-t4 tabular whitespace-nowrap">{totalAbertas} abertas</span>}
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
                  <button onClick={() => { if (listasEscopo.length) t.carregarListas(listasEscopo.map((l) => l.id), { force: true }); else if (sel.tipo === 'todas') t.carregarAbertas({ force: true }) }} className="ln-iconbtn" aria-label="Recarregar" title="Recarregar"><RefreshCw className="w-3.5 h-3.5" /></button>
                  {aba !== 'templates' && !mostrarViews && (
                    <button onClick={novaTarefa} className="ln-primary" title="Nova tarefa (C)">
                      <Plus className="w-3.5 h-3.5" /> Nova tarefa
                    </button>
                  )}
                </div>
              </header>

              {/* Visualizações: abas (padrão + salvas do escopo) e ferramentas */}
              {mostrarViews && (<>
                <AbasViews
                  padrao={viewsPadrao} salvas={viewsSalvas} ativaChave={viewAtiva.chave} tipoAtivo={config.tipo} alterada={alterada}
                  onAbrir={abrirView} onNova={persistente ? () => abrirPainelView('nova') : null}
                />
                <FerramentasView
                  config={config} onEditar={editarView} alterada={alterada} podeEditar={podeEditarView} persistente={persistente}
                  onSalvar={salvarVisualizacao} onSalvarNova={() => abrirPainelView('nova')} onReverter={reverterView}
                  busca={busca} onBusca={setBusca} membros={teamMembers || []} respBloqueado={respBloqueado}
                  nFiltros={contarRegras(config.filtros)} filtrosAlterados={persistente && JSON.stringify(config.filtros) !== JSON.stringify(viewAtiva.config.filtros)}
                  painel={painelView} onPainel={abrirPainelView} denso={denso} onDenso={() => setDenso((v) => !v)}
                  modelos={vt.modelos} onUsarModelo={usarModelo} onGerenciarModelos={() => abrirTemplate(null)} onNovaTarefa={novaTarefa}
                />
              </>)}

              {/* Conteúdo rolável */}
              <div className={`flex-1 min-h-0 bg-ln-bg ${(view === 'quadro' && !comTopo && mostrarViews) || semRolagem ? 'overflow-hidden' : 'overflow-auto'}`}>
                {t.loadingEstrutura || vt.loading ? (
                  <div className="flex items-center justify-center py-20 text-ln-t4 text-[13px] gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>
                ) : aba === 'intake' ? (
                  <IntakeView vt={vt} pastas={t.pastas} listas={t.listas} projetos={projects || []} membros={teamMembers || []} onAceitar={aceitarIntake} onToast={showToast} onAbrirTarefa={abrirTarefa} />
                ) : aba === 'paginas' ? (
                  <PaginasView pg={pgHook} projetos={projects || []} user={user} paginaId={params.get('pagina')} onSelecionar={(id) => setParams(id ? new URLSearchParams({ aba: 'paginas', pagina: id }) : new URLSearchParams({ aba: 'paginas' }))} onToast={showToast} />
                ) : aba === 'analytics' ? (
                  <AnalyticsView />
                ) : aba === 'templates' ? (
                  templateAbertoId ? (
                    templateAberto ? (
                      <TemplateEditor
                        key={templateAberto.id}
                        template={templateAberto} membros={teamMembers || []} membrosMap={membrosMap}
                        etiquetas={vt.etiquetas} onCriarEtiqueta={vt.criarEtiqueta}
                        onSalvar={(patch) => salvarTemplate(templateAberto.id, patch)}
                        onVoltar={() => abrirTemplate(null)}
                        onAplicar={(tpl) => setAplicandoTpl({ template: tpl, listaId: listaPadraoId })}
                        onDuplicar={duplicarTemplate} onExcluir={excluirTemplate}
                      />
                    ) : (
                      <div className="text-center text-[13px] text-ln-t4 py-20">Template não encontrado. <button type="button" onClick={() => abrirTemplate(null)} className="text-ln-accent hover:underline">Ver todos</button></div>
                    )
                  ) : (
                    <TemplatesView modelos={vt.modelos} membrosMap={membrosMap} onNovo={novoTemplate} onAbrir={abrirTemplate} onAplicar={usarModelo} onDuplicar={duplicarTemplate} onExcluir={excluirTemplate} />
                  )
                ) : (
                  <>
                    {aba === 'ciclos' && (
                      <CiclosView ciclos={vt.ciclos} ciclo={sel.id ? vt.ciclosMap.get(sel.id) : null} itens={todos} onSel={(id) => irAba('ciclos', { ciclo: id })} vt={vt} onToast={showToast} unidade={unidadeBurn} onUnidade={setUnidadeBurn} membros={teamMembers || []} onMoverPendentes={moverPendentes} />
                    )}
                    {view === 'calendario' ? (
                      <CalendarioView itens={filtrados} ctx={ctx} />
                    ) : view === 'gantt' ? (
                      <GanttView itens={filtrados} ctx={ctx} />
                    ) : view === 'quadro' ? (
                      <div className={comTopo ? 'h-[560px]' : 'h-full'}><QuadroView grupos={grupos} filhosDe={filhosVisao} ctx={ctx} /></div>
                    ) : (
                      <ListaView key={`${chaveRascunho}:${config.subtarefas}`} grupos={grupos} filhosDe={filhosVisao} ctx={{ ...ctx, selecao }} mostrarConcluidas={mostrarConcluidas} denso={denso} compacto={painel && painelEmpurra && largura < 1600} />
                    )}
                  </>
                )}
              </div>

              {mostrarViews && view === 'lista' && (
                <BarraSelecao n={itensSel.length} onLimpar={() => setSelecionadas(new Set())} onDuplicar={duplicarSel} onExcluir={excluirSel} ocupado={emMassa}>
                  <StatusCampo
                    item={{ status: statusComum }} statuses={statuses}
                    onChange={(s) => emLote((it) => { const st = statusDaLista(t.listasMap.get(it.lista_id)).find((x) => x.key === s.key); return st ? t.mudarStatus(it, st) : null }, 'Status')}
                    render={<BotaoBarra icon={CircleDot}>Status</BotaoBarra>}
                  />
                  <ResponsaveisEmMassa listas={itensSel.map((i) => i.responsaveis)} membros={teamMembers || []} membrosMap={membrosMap} icon={Users}
                    onAplicar={(d) => atualizarSel((it) => ({ responsaveis: aplicarDiferenca(it.responsaveis, d) }), 'Responsáveis')} />
                  <DataCampo valor={null} onChange={(v) => atualizarSel({ data_inicio: v }, 'Início')} render={<BotaoBarra icon={CalendarDays}>Início</BotaoBarra>} />
                  <DataCampo valor={null} onChange={(v) => atualizarSel({ data_vencimento: v }, 'Vencimento')} render={<BotaoBarra icon={CalendarClock}>Vencimento</BotaoBarra>} />
                  <PrioridadeCampo valor={null} onChange={(v) => atualizarSel({ prioridade: v }, 'Prioridade')} render={<BotaoBarra icon={Flag}>Prioridade</BotaoBarra>} />
                  <TipoTarefaCampo valor={null} onChange={(v) => atualizarSel({ tipo_tarefa: v }, 'Tipo')} render={<BotaoBarra icon={Shapes}>Tipo</BotaoBarra>} />
                  <EstimativaCampo valor={null} onChange={(v) => atualizarSel({ estimativa_min: v }, 'Estimativa')} render={<BotaoBarra icon={Hourglass}>Estimativa</BotaoBarra>} />
                </BarraSelecao>
              )}
            </div>
            )}

            {/* ── Aplicar template: cobre o quadro inteiro, como a tarefa expandida ── */}
            {aplicandoTpl && (
              <div className="absolute inset-0 z-40 flex flex-col bg-ln-panel" role="dialog" aria-label={`Aplicar ${aplicandoTpl.template.nome}`}>
                <AplicarTemplateView
                  key={aplicandoTpl.template.id}
                  template={aplicandoTpl.template} listaInicialId={aplicandoTpl.listaId}
                  pastas={t.pastas} listas={t.listas} projetos={projects || []} squads={squads}
                  membros={teamMembers || []} membrosMap={membrosMap}
                  onAplicar={aplicarTemplate} onCancelar={() => setAplicandoTpl(null)}
                />
              </div>
            )}

            {/* ── Sidebars da visualização: configurações, nova, filtros ── */}
            {painelView && mostrarViews && !aplicandoTpl && (() => {
              const larg = painelView === 'filtros' ? 600 : 340
              const empurra = largura >= larg + 760
              return (
                <>
                  {!empurra && <div className="absolute inset-0 z-30 bg-black/30" onClick={() => setPainelView(null)} aria-hidden="true" />}
                  <aside
                    className={`${empurra ? 'relative shrink-0' : 'absolute inset-y-0 right-0 z-40 shadow-2xl'} border-l border-ln-ink/[0.08] flex flex-col min-h-0 bg-ln-panel`}
                    style={{ width: empurra ? larg : `min(${larg}px, 100%)` }}
                    aria-label={painelView === 'filtros' ? 'Filtros' : painelView === 'nova' ? 'Nova visualização' : 'Configurações da visualização'}
                  >
                    {painelView === 'filtros' ? (
                      <PainelFiltros
                        filtros={config.filtros} onChange={(filtros) => editarView({ filtros })}
                        ctx={{ statuses, membros: teamMembers || [], etiquetas: vt.etiquetas, ciclos: vt.ciclos, listas: listasEscopo.length ? listasEscopo : t.listas }}
                        barra={[
                          respFiltro.length && `Responsáveis: ${respFiltro.map((id) => nomeResponsavelFiltro(id, teamMembers || [])).join(', ')}`,
                          !config.concluidas && 'Sem concluídas',
                          busca.trim() && `Nome contém “${busca.trim()}”`,
                        ].filter(Boolean)}
                        total={baseFiltro.length} mostrando={filtrados.length} persistente={persistente}
                        alterados={JSON.stringify(config.filtros) !== JSON.stringify(viewAtiva.config.filtros)} podeEditar={podeEditarView}
                        onSalvar={salvarVisualizacao} onReverter={() => editarView({ filtros: viewAtiva.config.filtros })} onFechar={() => setPainelView(null)}
                      />
                    ) : painelView === 'nova' ? (
                      <PainelNovaView config={config} origem={viewAtiva.nome} membros={teamMembers || []} onCriar={criarVisualizacao} onFechar={() => setPainelView(null)} />
                    ) : (
                      <PainelConfigView
                        key={chaveRascunho} v={viewAtiva} config={config} podeEditar={podeEditarView} membros={teamMembers || []} respBloqueado={respBloqueado}
                        onEditar={editarViewNaSidebar} onMeta={metaView} onAbrirFiltros={() => setPainelView('filtros')}
                        onDuplicar={() => criarVisualizacao({ nome: `${viewAtiva.nome} (cópia)`, publica: true })}
                        onExcluir={excluirVisualizacao} onFechar={() => setPainelView(null)}
                      />
                    )}
                  </aside>
                </>
              )
            })()}

            {/* ── Painel lateral: tarefa ──────────────────────────────── */}
            {!!tarefaAbertaId && !aplicandoTpl && aba !== 'chat' && aba !== 'atividades' && (
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
                      {tarefaAberta?.clickup_url && (
                        <a href={tarefaAberta.clickup_url} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 h-7 px-2 rounded-md text-xs text-ln-t3 hover:text-ln-accent hover:bg-ln-ink/[0.04] ${FOCO}`} title="Abrir no ClickUp">
                          ClickUp <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {tarefaAberta && (
                        <MenuTarefa
                          key={tarefaAberta.id} tarefaId={tarefaAberta.id} user={user}
                          onSalvarTemplate={() => salvarComoModelo(tarefaAberta, filhosDe.get(tarefaAberta.id) || [])}
                          onExcluir={() => { if (window.confirm('Excluir esta tarefa (e as subtarefas)?')) t.excluirTarefa(tarefaAberta.id).then((r) => { if (r.error) showToast(r.error, 'error'); else { fecharPainel(); showToast('Tarefa excluída') } }) }}
                        />
                      )}
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
                        ciclos={vt.ciclos}
                        etiquetas={vt.etiquetas}
                        ciclosMap={vt.ciclosMap}
                        etiquetasMap={vt.etiquetasMap}
                        onCriarEtiqueta={vt.criarEtiqueta}
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
    </>
  )
}
