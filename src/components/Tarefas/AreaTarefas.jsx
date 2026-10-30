// Área de tarefas do VertaTask: tudo o que fica à direita da coluna de pastas. Abas de
// visualização, barra de ferramentas, Lista/Quadro/Calendário/Gantt, sidebars da view
// (configurações, nova, filtros), seleção em massa, "Aplicar template" e o painel da tarefa.
//
// É a MESMA tela em dois lugares, então qualquer mudança aqui aparece nos dois:
//   - /tarefas (src/pages/Tarefas.jsx), que põe em volta a coluna de pastas, o cabeçalho
//     e as seções próprias do VertaTask (Intake, Cycles, Templates, Pages, Analytics);
//   - aba Tarefas do hub da página do cliente (TarefasDoCliente.jsx), travada na pasta dele.
//
// Quem usa passa os hooks de dados (t = useTarefas, vt = useVertaTask) e a seleção (sel). A
// view ativa (?view=) e a tarefa aberta (?tarefa=) ficam na URL da página onde a área está.
// Ganchos: `cabecalho(api)` (topo da coluna), `secao(api)` (conteúdo no lugar das views:
// Intake, Templates…), `antesDaView` (acima da view: Cycles), `largura` (largura do quadro
// medida por quem usa; sem ela a área mede a si mesma), `atalhoCriar` (tecla C),
// `onIrParaLista(listaId, tarefaId)` (depois de aplicar um template) e `onAbrirTemplate(id)`.
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  ChevronRight, X, Loader2, Maximize2, Minimize2, CalendarDays, CircleDot, Users, Flag, Hourglass,
  Shapes, CalendarClock, CornerDownRight, CloudUpload,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import GanttView from './GanttView'
import { AbasViews, FerramentasView } from './BarraViews'
import { PainelConfigView, PainelNovaView } from './PainelView'
import PainelFiltros from './PainelFiltros'
import { escopoDaSelecao, chaveEscopo, viewsDoEscopo, igualConfig, passaResponsaveis, nomeResponsavelFiltro, patchColunas, normalizarLarguraNome } from '../../lib/viewsTarefas'
import { passaFiltros, contarRegras } from '../../lib/filtrosTarefas'
import { statusDaLista, statusDasListas, agruparItens, filtrarItens, STATUSES_PADRAO, novoId } from '../../lib/tarefas'
import ListaView from './ListaView'
import QuadroView from './QuadroView'
import TarefaPanel from './TarefaPanel'
import NovaTarefaPanel from './NovaTarefaPanel'
import CalendarioView from './CalendarioView'
import AplicarTemplateView from './AplicarTemplateView'
import { templateDaTarefa } from '../../lib/templates'
import { FOCO, StatusCampo, DataCampo, PrioridadeCampo, TipoTarefaCampo, EstimativaCampo } from './Campos'
import BarraSelecao, { BotaoBarra, ResponsaveisEmMassa, aplicarDiferenca } from './BarraSelecao'
import { contarTarefas, useConfirmar } from './Confirmacao'
import { ID_RASCUNHO_TEMPLATE, guardarRascunhoTemplate } from '../../lib/rascunhoTemplate'
import { MenuTarefa, MenuContextoTarefa, linhaRelacao } from './TarefaExtras'

export const PAINEL_LARGURA = 480 // padrão do painel da tarefa; quem usa arrasta a borda esquerda (tarefas.larguraPainel)
const PAINEL_MIN = 380
const PAINEL_MAX = 1000
export const limitarPainel = (w) => (Number.isFinite(w) ? Math.round(Math.min(PAINEL_MAX, Math.max(PAINEL_MIN, w))) : PAINEL_LARGURA)

/** Alça na borda esquerda do painel da tarefa: arrastar, ← → de 20 px com foco, duplo clique volta ao padrão. */
export function AlcaPainel({ largura, onLargura }) {
  const [arrastando, setArrastando] = useState(false)
  const iniciar = (e) => {
    if (e.button !== 0) return
    e.preventDefault()
    const x0 = e.clientX
    setArrastando(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    const mover = (ev) => onLargura(limitarPainel(largura + x0 - ev.clientX))
    const soltar = () => {
      window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar)
      document.body.style.cursor = ''; document.body.style.userSelect = ''
      setArrastando(false)
    }
    window.addEventListener('pointermove', mover); window.addEventListener('pointerup', soltar)
  }
  const teclado = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    onLargura(limitarPainel(largura + (e.key === 'ArrowLeft' ? 20 : -20)))
  }
  return (
    <span
      role="separator" aria-orientation="vertical" aria-label="Largura do painel da tarefa (setas ← →; duplo clique volta ao padrão)" tabIndex={0}
      title="Arraste para mudar a largura · duplo clique: padrão"
      onPointerDown={iniciar} onKeyDown={teclado} onDoubleClick={() => onLargura(PAINEL_LARGURA)}
      className={`absolute -left-1.5 inset-y-0 z-10 w-3 flex justify-center cursor-col-resize group/alcap ${FOCO}`}
    >
      <span className={`w-0.5 h-full transition-colors ${arrastando ? 'bg-ln-accent' : 'bg-transparent group-hover/alcap:bg-ln-accent/70 group-focus-visible/alcap:bg-ln-accent'}`} />
    </span>
  )
}
// O painel da tarefa fica sempre por cima da lista; abaixo desta largura ganha um fundo escuro
// que fecha ao clicar. Acima, a lista continua clicável (clicar em outra linha troca a tarefa).
const FUNDO_ATE = 1200

export function lerPref(chave, padrao) {
  try { const v = localStorage.getItem(`tarefas.${chave}`); return v == null ? padrao : JSON.parse(v) } catch { return padrao }
}
export function gravarPref(chave, v) {
  try { localStorage.setItem(`tarefas.${chave}`, JSON.stringify(v)) } catch { /* noop */ }
}

export function useLarguraDoConteudo(ref) {
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

export function estaDigitando() {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

const SEM_FILHOS = new Map() // subtarefas "Separar": cada uma vira linha própria, sem aninhar

/** Listas onde a tarefa nova cai: a lista escolhida; na pasta, a "Geral" (onde Intake e templates já criam). */
function listaPadraoDe(sel, listasEscopo, t) {
  if (sel.tipo === 'lista') return sel.id
  if (sel.tipo === 'pasta') return (listasEscopo.find((l) => l.nome === 'Geral') || listasEscopo[0])?.id || null
  const ult = lerPref('sel', null)
  if (ult?.tipo === 'lista' && t.listasMap.has(ult.id)) return ult.id
  if (ult?.tipo === 'pasta') { const ls = t.listas.filter((l) => l.pasta_id === ult.id); return (ls.find((l) => l.nome === 'Geral') || ls[0])?.id || null }
  return null
}

export default function AreaTarefas({
  t, vt, sel, user, projects, teamMembers, squads, showToast,
  largura: larguraExterna = null, recarregarTick = 0, cabecalho = null, secao = null, antesDaView = null,
  semRolagem = false, atalhoCriar = true, onIrParaLista, onAbrirTemplate,
}) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const areaRef = useRef(null)
  const larguraPropria = useLarguraDoConteudo(areaRef)
  const largura = larguraExterna ?? larguraPropria

  const [busca, setBusca] = useState('')
  const [rascunhoView, setRascunhoView] = useState(null) // { chave, config }: o que mudou na tela e não foi salvo
  const [painelView, setPainelView] = useState(null) // null | 'config' | 'nova' | 'filtros' (sidebar à direita)
  const [painelExpandido, setPainelExpandido] = useState(false)
  const [selecionadas, setSelecionadas] = useState(() => new Set()) // seleção da Lista (barra no rodapé)
  const [menuTarefa, setMenuTarefa] = useState(null) // clique direito: { item, x, y, origem }
  const [renomeandoId, setRenomeandoId] = useState(null) // "Renomear" na própria linha da Lista
  const [emMassa, setEmMassa] = useState(false)
  const [confirmar, dialogoConfirmar] = useConfirmar()
  const [aplicandoTpl, setAplicandoTpl] = useState(null) // { template, listaId }: tela "Aplicar template"
  const [novaInicial, setNovaInicial] = useState(null) // rascunho de tarefa nova no painel lateral (NovaTarefaPanel)
  // largura da coluna Nome da Lista: preferência local, a mesma em todas as views
  const [larguraNome, setLarguraNome] = useState(() => normalizarLarguraNome(lerPref('larguraNome', null)))
  useEffect(() => gravarPref('larguraNome', larguraNome), [larguraNome])
  const [larguraPainel, setLarguraPainel] = useState(() => limitarPainel(lerPref('larguraPainel', PAINEL_LARGURA)))
  useEffect(() => gravarPref('larguraPainel', larguraPainel), [larguraPainel])

  const tarefaAbertaId = params.get('tarefa')
  const abrirTemplate = useCallback((id) => {
    if (onAbrirTemplate) onAbrirTemplate(id)
    else navigate(`/tarefas?aba=templates${id ? `&template=${id}` : ''}`)
  }, [onAbrirTemplate, navigate])

  // ── Visualizações: abas da pasta (ou de Minhas/Todas), src/lib/viewsTarefas.js ──
  // A tela mostra o rascunho da view ativa; a barra mexe no rascunho e "Salvar
  // visualização" grava. A sidebar de configurações grava na hora.
  const mostrarViews = !secao
  const escopoViews = useMemo(() => escopoDaSelecao(sel, t.listasMap), [sel, t.listasMap])
  const chaveEsc = chaveEscopo(escopoViews)
  const persistente = !!escopoViews
  const { padrao: viewsPadrao, salvas: viewsSalvas } = useMemo(() => viewsDoEscopo(vt.views, escopoViews, user?.id), [vt.views, escopoViews, user?.id])
  const viewParam = params.get('view')
  const viewAtiva = useMemo(() => {
    const todasV = [...viewsPadrao, ...viewsSalvas]
    return todasV.find((v) => v.chave === viewParam) || todasV.find((v) => v.chave === lerPref(`viewAtiva.${chaveEsc}`, null)) || viewsPadrao[0]
  }, [viewsPadrao, viewsSalvas, viewParam, chaveEsc])
  const chaveRascunho = `${chaveEsc}|${viewAtiva.chave}`
  const config = rascunhoView?.chave === chaveRascunho ? rascunhoView.config : viewAtiva.config
  const alterada = persistente && !igualConfig(viewAtiva.config, config)
  // compartilhada (pública) = qualquer pessoa edita nome e configuração; quem vê e excluir ficam com o dono
  const souDonoView = viewAtiva.donoId === user?.id
  const podeEditarView = persistente && (viewAtiva.padrao || souDonoView || viewAtiva.acesso === 'publica')
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

  // abre no construtor um rascunho com a tarefa e as subtarefas; nada é gravado até o
  // Salvar de lá, onde nome, prazos e responsáveis são ajustados
  const salvarComoModelo = useCallback((item, subs = []) => {
    guardarRascunhoTemplate({ nome: item.titulo?.trim() || 'Novo template', itens: templateDaTarefa(item, subs) })
    abrirTemplate(ID_RASCUNHO_TEMPLATE)
  }, [abrirTemplate])

  const abrirTarefa = useCallback((id) => {
    if (id) { setPainelView(null); setNovaInicial(null) }
    const p = new URLSearchParams(params)
    if (id) p.set('tarefa', id); else p.delete('tarefa')
    setParams(p, { replace: !!params.get('tarefa') })
  }, [params, setParams])
  const fecharPainel = useCallback(() => { setPainelExpandido(false); abrirTarefa(null) }, [abrirTarefa])
  const abrirPainelView = useCallback((qual) => {
    if (qual && tarefaAbertaId) abrirTarefa(null)
    setPainelView(qual)
  }, [tarefaAbertaId, abrirTarefa])

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

  // Tarefa aberta fora do que foi carregado, ou subtarefa (uma vez por tarefa): carregarTarefa
  // traz a tarefa, os pais até a raiz e as irmãs, que podem estar fora do escopo (em "Minhas",
  // o pai e as irmãs de outra pessoa) e formam a Hierarquia do painel.
  const hierarquiaLida = useRef(new Set())
  const abertaTemPai = !!t.itens[tarefaAbertaId]?.parent_id
  useEffect(() => {
    if (!tarefaAbertaId) return
    if (t.itens[tarefaAbertaId] && (!abertaTemPai || hierarquiaLida.current.has(tarefaAbertaId))) return
    hierarquiaLida.current.add(tarefaAbertaId)
    t.carregarTarefa(tarefaAbertaId)
  }, [tarefaAbertaId, abertaTemPai]) // eslint-disable-line react-hooks/exhaustive-deps

  const recarregar = useCallback(() => {
    if (listasEscopo.length) t.carregarListas(listasEscopo.map((l) => l.id), { force: true })
    else if (sel.tipo === 'todas') t.carregarAbertas({ force: true })
  }, [t, listasEscopo, sel.tipo])

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
  // squad do cliente de cada lista (lista → pasta → projeto), para o campo Squad dos filtros
  const squadDaLista = useMemo(() => {
    const doProjeto = new Map((projects || []).map((p) => [p.id, p.squad || null]))
    const daPasta = new Map(t.pastas.map((p) => [p.id, p.project_id ? doProjeto.get(p.project_id) || null : null]))
    return new Map(t.listas.map((l) => [l.id, daPasta.get(l.pasta_id) || null]))
  }, [projects, t.pastas, t.listas])
  const filtrados = useMemo(() => {
    const resp = respFiltro
    const ctxFiltro = { squadDe: (it) => squadDaLista.get(it.lista_id) }
    return filtrarItens(baseFiltro, { busca, mostrarConcluidas })
      .filter((it) => passaResponsaveis(it, resp))
      .filter((it) => passaFiltros(it, config.filtros, ctxFiltro))
  }, [baseFiltro, busca, mostrarConcluidas, respFiltro, config.filtros, squadDaLista])
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

  const listaPadraoId = useMemo(() => listaPadraoDe(sel, listasEscopo, t), [sel, listasEscopo, t])

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
  // "+ Tarefa" / C abrem o rascunho; a tarefa só é criada no "Criar tarefa". Em Minhas/Todas
  // a lista é escolhida no rascunho (a última visitada vem marcada) e, em Minhas, o responsável é você.
  const novaTarefa = useCallback(() => {
    if (tarefaAbertaId) abrirTarefa(null)
    setPainelView(null)
    const eu = user?.id
    setNovaInicial({ lista_id: listaPadraoId, responsaveis: sel.tipo === 'minhas' && eu ? [eu] : [] })
  }, [tarefaAbertaId, abrirTarefa, listaPadraoId, sel.tipo, user])
  const gruposNova = useMemo(() => {
    const ativas = (ls) => ls.filter((l) => !l.arquivada).sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0) || a.nome.localeCompare(b.nome, 'pt-BR'))
    if (listasEscopo.length) return [{ pasta: t.pastasMap.get(listasEscopo[0].pasta_id) || null, listas: ativas(sel.tipo === 'pasta' ? listasEscopo : t.listas.filter((l) => l.pasta_id === listasEscopo[0].pasta_id)) }]
    return t.pastas.filter((p) => !p.arquivada)
      .map((p) => ({ pasta: p, listas: ativas(t.listas.filter((l) => l.pasta_id === p.id)) }))
      .filter((g) => g.listas.length)
      .sort((a, b) => a.pasta.nome.localeCompare(b.pasta.nome, 'pt-BR'))
  }, [listasEscopo, sel.tipo, t.pastas, t.listas, t.pastasMap])
  const agendarPush = t.agendarPush
  // cria a tarefa e, depois, as subtarefas (na mesma lista) e as relações do rascunho
  const criarDoRascunho = useCallback(async ({ subtarefas = [], relacoes = [], ...payload }) => {
    const r = await onCriar(payload)
    if (!r?.data) return r
    const id = r.data.id
    let falhas = 0
    for (const s of subtarefas) {
      const rs = await onCriar({ lista_id: r.data.lista_id, parent_id: id, titulo: s.titulo, responsaveis: payload.responsaveis })
      if (rs?.error) falhas++
    }
    if (relacoes.length) {
      const { error } = await supabase.from('tarefas_relacoes').insert(relacoes.map((x) => ({ ...linhaRelacao(id, x.tipo, x.alvo.id), criado_por: user?.id || null })))
      if (error) falhas += relacoes.length
      else agendarPush?.()
    }
    setNovaInicial(null)
    abrirTarefa(id)
    showToast(falhas ? `Tarefa criada, mas ${falhas} subtarefa(s)/relação(ões) falharam` : 'Tarefa criada', falhas ? 'error' : undefined)
    return r
  }, [onCriar, abrirTarefa, showToast, user, agendarPush])

  // `intake`: pedido do Intake que originou a aplicação (o pedido vai para a descrição da tarefa
  // raiz e sai da fila como aceito).
  const usarModelo = useCallback((m, listaId = listaPadraoId, intake = null) => setAplicandoTpl({ template: m, listaId, intake }), [listaPadraoId])

  /** Cria as tarefas do plano (pais antes dos filhos) e as dependências como "bloqueia". */
  const aplicarTemplate = useCallback(async ({ listaId, plano, onProgresso }) => {
    const intake = aplicandoTpl?.intake
    const mapa = new Map()
    const base = Date.now()
    for (const [i, l] of plano.entries()) {
      const parent_id = l.paiId ? mapa.get(l.paiId) : null
      if (l.paiId && !parent_id) continue
      const it = l.item
      const descricao = intake && !l.paiId ? [intake.descricao, l.descricao].filter(Boolean).join('\n\n---\n\n') : l.descricao
      const r = await t.criarTarefa({
        lista_id: listaId, parent_id, titulo: l.titulo, descricao, posicao: base + i,
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
      else t.agendarPush?.()
    }
    const raizes = plano.filter((l) => !l.paiId)
    if (intake) {
      const d = await vt.decidirIntake(intake.id, { status: 'aceito', tarefa_id: mapa.get(raizes[0]?.item.id) || null })
      if (d.error) showToast(`Tarefas criadas, mas o pedido não saiu da fila: ${d.error}`, 'error')
    }
    setAplicandoTpl(null)
    const tarefaId = raizes.length === 1 ? mapa.get(raizes[0].item.id) || null : null
    if (onIrParaLista) onIrParaLista(listaId, tarefaId)
    else if (tarefaId) abrirTarefa(tarefaId)
    showToast(`${mapa.size} tarefa(s) criada(s) a partir do template`)
    return {}
  }, [t, vt, aplicandoTpl, user?.id, showToast, onIrParaLista, abrirTarefa])

  // Atalhos: C cria, Esc fecha o painel (fora de campos de texto).
  useEffect(() => {
    const h = (e) => {
      // Ctrl+Enter salva a visualização (fora de campos, para não brigar com comentários)
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && mostrarViews && alterada && podeEditarView && !estaDigitando()) { e.preventDefault(); salvarVisualizacao(); return }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Escape' && novaInicial && !estaDigitando()) { e.preventDefault(); setNovaInicial(null); return }
      if (e.key === 'Escape' && painelView && !estaDigitando()) { e.preventDefault(); setPainelView(null); return }
      if (e.key === 'Escape' && tarefaAbertaId && !estaDigitando()) { e.preventDefault(); if (painelExpandido) setPainelExpandido(false); else fecharPainel(); return }
      if (e.key === 'Escape' && selecionadas.size && !aplicandoTpl && !estaDigitando()) { e.preventDefault(); setSelecionadas(new Set()) }
      if ((e.key === 'c' || e.key === 'C') && atalhoCriar && !estaDigitando() && !aplicandoTpl && !novaInicial) { e.preventDefault(); novaTarefa() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [tarefaAbertaId, painelExpandido, fecharPainel, novaTarefa, atalhoCriar, aplicandoTpl, selecionadas.size, mostrarViews, alterada, podeEditarView, salvarVisualizacao, painelView, novaInicial])

  // listas que existem no ClickUp: só nelas uma tarefa sem clickup_task_id está "aguardando ClickUp"
  const listasComClickup = useMemo(() => new Set(t.listas.filter((l) => l.clickup_list_id).map((l) => l.id)), [t.listas])
  // "Adicionar tarefa" da Lista: em Minhas tarefas o responsável já é você
  const euId = user?.id
  const responsaveisPadrao = useMemo(() => (sel.tipo === 'minhas' && euId ? [euId] : []), [sel.tipo, euId])
  const ctx = useMemo(() => ({
    statuses, membros: teamMembers || [], membrosMap, itensMap: t.itens, listaPadraoId, agrupar, contagemComentarios, selecionadaId: tarefaAbertaId,
    onAbrir: abrirTarefa, onAtualizar, onMudarStatus, onCriar, etiquetasMap: vt.etiquetasMap, listasComClickup,
    responsaveisPadrao,
    // clique direito numa tarefa (Lista, Quadro, Calendário) e "Renomear" na linha
    onMenuTarefa: (item, x, y, origem) => setMenuTarefa({ item, x, y, origem }),
    renomeandoId, onFimRenomear: () => setRenomeandoId(null),
    // cada tarefa só oferece os status da própria lista (Minhas/Todas misturam listas)
    statusesDe: (it) => { const l = t.listasMap.get(it.lista_id); return l ? statusDaLista(l) : statuses },
    // colunas Cliente e Sprints da Lista (estilo ClickUp)
    listas: t.listas, pastas: t.pastas, projetos: projects || [], ciclos: vt.ciclos || [],
    // subtarefas: Expandidas abre todas; Separar mostra "↳ pai" ao lado do título
    expandirTudo: config.subtarefas === 'expandidas',
    // ordenação pelos cabeçalhos da Lista (rascunho da view, como a barra)
    ordenar: config.ordenar, onOrdenar: (ordenar) => editarView({ ordenar }),
    calendario: config.calendario, onCalendario: (calendario) => editarView({ calendario }),
    // largura do Nome arrastada na alça do cabeçalho (rascunho da view)
    larguraNome, onLarguraNome: setLarguraNome,
    // colunas da Lista: ordem e visibilidade (rascunho da view; o "+" do cabeçalho abre o editor)
    colunas: config.colunas, onColunas: (colunas) => editarView(patchColunas(colunas, { ordenar: config.ordenar })),
    // Separar: nome da tarefa-pai para Quadro, Calendário e Gantt
    nomePai: config.subtarefas === 'separar' ? (it) => (it.parent_id ? t.itens[it.parent_id]?.titulo || null : null) : undefined,
    rotuloPai: config.subtarefas === 'separar' ? (it) => (it.parent_id && t.itens[it.parent_id] ? (
      <span className="inline-flex items-center gap-1 ml-1.5 min-w-0 text-[11px] text-ln-t4" title={`Subtarefa de ${t.itens[it.parent_id].titulo}`}>
        <CornerDownRight className="w-3 h-3 shrink-0" /><span className="truncate max-w-[220px]">{t.itens[it.parent_id].titulo}</span>
      </span>
    ) : null) : undefined,
  }), [vt.etiquetasMap, vt.ciclos, statuses, teamMembers, membrosMap, t.itens, t.listas, t.pastas, projects, listaPadraoId, agrupar, contagemComentarios, tarefaAbertaId, abrirTarefa, onAtualizar, onMudarStatus, onCriar, config.subtarefas, t.listasMap, config.ordenar, config.calendario, config.colunas, larguraNome, editarView, listasComClickup, responsaveisPadrao, renomeandoId])

  // ── Seleção da Lista e ações em massa (BarraSelecao) ─────────────────────
  // a seleção vale para o que está na tela: trocar de pasta, lista, seção ou visão limpa
  useEffect(() => { setSelecionadas(new Set()) }, [sel.tipo, sel.id, mostrarViews, view])
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
    let ok = 0, puladas = 0, falhas = 0, ajustadas = 0
    for (const it of itensSel) {
      const r = await fn(it)
      if (r === null) puladas++
      else if (r?.error) falhas++
      else { ok++; if (r?.ajustou) ajustadas++ }
    }
    setEmMassa(false)
    const extra = [
      ajustadas && `${ajustadas} com ${rotulo === 'Início' ? 'o vencimento' : 'o início'} ajustado para não ficar o início depois do vencimento`,
      puladas && `${puladas} sem esse status na lista`, falhas && `${falhas} com erro`,
    ].filter(Boolean).join(', ')
    showToast(`${rotulo}: ${ok} tarefa(s)${extra ? ` (${extra})` : ''}`, falhas ? 'error' : undefined)
  }, [itensSel, showToast])
  const atualizarSel = useCallback((patch, rotulo) => emLote((it) => t.atualizarTarefa(it.id, typeof patch === 'function' ? patch(it) : patch), rotulo), [emLote, t])

  const copiaDe = (it, extra) => ({
    lista_id: it.lista_id, parent_id: it.parent_id, titulo: it.titulo, descricao: it.descricao, status: it.status, prioridade: it.prioridade,
    responsaveis: it.responsaveis, data_inicio: it.data_inicio, data_vencimento: it.data_vencimento, estimativa_min: it.estimativa_min,
    tipo_tarefa: it.tipo_tarefa, dificuldade: it.dificuldade, departamento: it.departamento, tags: it.tags, etiquetas: it.etiquetas,
    checklists: it.checklists, ciclo_id: it.ciclo_id, posicao: (Number(it.posicao) || 0) + 0.5, ...extra,
  })
  // duplica as tarefas com as subtarefas; devolve { n, falhas }
  const duplicarTarefas = useCallback(async (tarefas) => {
    let n = 0, falhas = 0
    for (const it of tarefas) {
      const r = await t.criarTarefa(copiaDe(it))
      if (r.error) { falhas++; continue }
      n++
      for (const f of filhosDe.get(it.id) || []) {
        const rf = await t.criarTarefa(copiaDe(f, { parent_id: r.data.id, lista_id: r.data.lista_id }))
        if (rf.error) falhas++; else n++
      }
    }
    return { n, falhas }
  }, [filhosDe, t])
  const duplicarSel = useCallback(async () => {
    setEmMassa(true)
    const { n, falhas } = await duplicarTarefas(raizesSel)
    setEmMassa(false)
    setSelecionadas(new Set())
    showToast(`${n} tarefa(s) duplicada(s)${falhas ? `, ${falhas} com erro` : ''}`, falhas ? 'error' : undefined)
  }, [raizesSel, duplicarTarefas, showToast])
  // diálogo de arquivar/excluir (menu ⋯ do painel e barra de seleção)
  const pedirConfirmacao = useCallback((qual, tarefas) => {
    const nSubs = tarefas.reduce((a, it) => a + (filhosDe.get(it.id) || []).length, 0)
    const qtd = tarefas.length === 1 ? `esta tarefa${nSubs ? ` e ${nSubs === 1 ? 'a subtarefa' : `as ${nSubs} subtarefas`}` : ''}` : contarTarefas(tarefas.length, nSubs)
    const itens = tarefas.map((it) => it.titulo)
    if (qual === 'excluir') {
      return confirmar({
        perigo: true, titulo: `Excluir ${qtd}?`, acao: 'Excluir',
        texto: 'A exclusão também acontece no ClickUp e não pode ser desfeita.',
        rotuloItens: tarefas.length === 1 ? 'Tarefa a ser excluída' : 'Tarefas a serem excluídas', itens,
      })
    }
    return confirmar({
      titulo: `Arquivar ${qtd}?`, acao: 'Arquivar',
      texto: 'Saem das listas do VertaTask e ficam arquivadas no ClickUp. Nada é apagado.',
      rotuloItens: tarefas.length === 1 ? 'Tarefa a ser arquivada' : 'Tarefas a serem arquivadas', itens,
    })
  }, [confirmar, filhosDe])
  const excluirSel = useCallback(async () => {
    if (!(await pedirConfirmacao('excluir', raizesSel))) return
    setEmMassa(true)
    let n = 0, falhas = 0
    for (const it of raizesSel) { const r = await t.excluirTarefa(it.id); if (r.error) falhas++; else n++ }
    setEmMassa(false)
    if (tarefaAbertaId && selecionadas.has(tarefaAbertaId)) fecharPainel()
    setSelecionadas(new Set())
    showToast(`${n} tarefa(s) excluída(s)${falhas ? `, ${falhas} com erro` : ''}`, falhas ? 'error' : undefined)
  }, [raizesSel, t, showToast, tarefaAbertaId, selecionadas, fecharPainel, pedirConfirmacao])
  const arquivarSel = useCallback(async () => {
    if (!(await pedirConfirmacao('arquivar', raizesSel))) return
    setEmMassa(true)
    let n = 0, falhas = 0
    for (const it of raizesSel) { const r = await t.arquivarTarefa(it.id); if (r.error) falhas++; else n++ }
    setEmMassa(false)
    if (tarefaAbertaId && selecionadas.has(tarefaAbertaId)) fecharPainel()
    setSelecionadas(new Set())
    showToast(`${n} tarefa(s) arquivada(s)${falhas ? `, ${falhas} com erro` : ''}`, falhas ? 'error' : undefined)
  }, [raizesSel, t, showToast, tarefaAbertaId, selecionadas, fecharPainel, pedirConfirmacao])
  // ── Menu de uma tarefa (⋯ do painel e clique direito) ──────────────────
  const copiar = useCallback(async (texto, ok) => {
    try { await navigator.clipboard.writeText(texto); showToast(ok) } catch { showToast('Não foi possível copiar', 'error') }
  }, [showToast])
  // título do painel em foco e selecionado (Renomear no Quadro, Calendário e no ⋯ do painel)
  const focarTituloPainel = useCallback((id) => {
    let tentativas = 20
    const passo = () => {
      const el = document.querySelector(`[data-titulo-tarefa="${id}"]`)
      if (el) { el.focus(); el.select() } else if (tentativas-- > 0) requestAnimationFrame(passo)
    }
    requestAnimationFrame(passo)
  }, [])
  const tirarDaTela = useCallback((it) => {
    if (tarefaAbertaId === it.id) fecharPainel()
    setSelecionadas((p) => { if (!p.has(it.id)) return p; const n = new Set(p); n.delete(it.id); return n })
  }, [tarefaAbertaId, fecharPainel])
  const acoesTarefa = (origem) => ({
    copiarLink: (it) => copiar(`${window.location.origin}/tarefas?tarefa=${it.id}`, 'Link copiado'),
    abrirClickup: (it) => window.open(it.clickup_url, '_blank', 'noopener'),
    renomear: (it) => {
      if (origem === 'lista') { setRenomeandoId(it.id); return }
      if (tarefaAbertaId !== it.id) abrirTarefa(it.id)
      focarTituloPainel(it.id)
    },
    duplicar: async (it) => {
      const { n, falhas } = await duplicarTarefas([it])
      showToast(falhas ? `${n} criada(s), ${falhas} com erro` : 'Tarefa duplicada', falhas ? 'error' : undefined)
    },
    salvarTemplate: (it) => salvarComoModelo(it, filhosDe.get(it.id) || []),
    historico: (it) => navigate(`/tarefas?aba=sincronizacao&sync_tarefa=${it.id}`),
    arquivar: async (it) => {
      if (!(await pedirConfirmacao('arquivar', [it]))) return
      const r = await t.arquivarTarefa(it.id)
      if (r.error) showToast(r.error, 'error'); else { tirarDaTela(it); showToast('Tarefa arquivada') }
    },
    excluir: async (it) => {
      if (!(await pedirConfirmacao('excluir', [it]))) return
      const r = await t.excluirTarefa(it.id)
      if (r.error) showToast(r.error, 'error'); else { tirarDaTela(it); showToast('Tarefa excluída') }
    },
  })
  const statusComum = itensSel.length && itensSel.every((i) => i.status === itensSel[0].status) ? itensSel[0].status : null

  // ── Painel ───────────────────────────────────────────────────────────────
  const totalAbertas = itensEscopo.filter((i) => i.status_tipo !== 'closed' && !i.parent_id).length
  // na fila do push (ainda sem clickup_task_id, em lista que existe no ClickUp); o realtime
  // zera quando o vínculo é gravado. Listas sem clickup_list_id (ex.: "🤖 Agentes") ficam fora.
  const aguardandoClickup = itensEscopo.filter((i) => !i.clickup_task_id && !i.arquivada && listasComClickup.has(i.lista_id)).length
  const tarefaAberta = tarefaAbertaId ? t.itens[tarefaAbertaId] : null
  const listaDaAberta = tarefaAberta ? t.listasMap.get(tarefaAberta.lista_id) : null
  const pastaDaAberta = listaDaAberta ? t.pastasMap.get(listaDaAberta.pasta_id) : null
  const paiDaAberta = tarefaAberta?.parent_id ? t.itens[tarefaAberta.parent_id] : null
  // Hierarquia do painel: pais da raiz até o pai direto, e as irmãs (incluindo a própria).
  const ancestraisDaAberta = useMemo(() => {
    const r = []
    const vistos = new Set()
    for (let p = tarefaAberta?.parent_id; p && t.itens[p] && !vistos.has(p); p = t.itens[p].parent_id) { vistos.add(p); r.unshift(t.itens[p]) }
    return r
  }, [tarefaAberta, t.itens])
  const irmasDaAberta = tarefaAberta?.parent_id ? (filhosDe.get(tarefaAberta.parent_id) || [tarefaAberta]).filter((s) => !s.arquivada) : null
  const statusesDaAberta = listaDaAberta ? statusDaLista(listaDaAberta) : statuses
  const painelComFundo = largura < FUNDO_ATE
  const comTopo = !!antesDaView // cabeçalho acima da view: a página rola inteira

  // o que a moldura (cabeçalho, seções) pode usar
  const api = { listaPadraoId, totalAbertas, aguardandoClickup, novaTarefa, recarregar, abrirTarefa, usarModelo, todos, mostrarViews }

  return (
    <div ref={areaRef} className="relative flex-1 min-w-0 h-full min-h-0 flex">
      {dialogoConfirmar}
      {menuTarefa && (
        <MenuContextoTarefa
          key={`${menuTarefa.item.id}:${menuTarefa.x}:${menuTarefa.y}`}
          menu={{ ...menuTarefa, item: t.itens[menuTarefa.item.id] || menuTarefa.item }} user={user}
          acoes={acoesTarefa(menuTarefa.origem)} onFechar={() => setMenuTarefa(null)}
        />
      )}
      <div className="relative flex-1 min-w-0 flex flex-col">
        {cabecalho?.(api)}

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
            painel={painelView} onPainel={abrirPainelView}
            modelos={vt.modelos} onUsarModelo={usarModelo} onGerenciarModelos={() => abrirTemplate(null)} onNovaTarefa={novaTarefa}
          />
        </>)}

        {/* Conteúdo rolável */}
        <div className={`flex-1 min-h-0 bg-ln-bg ${(view === 'quadro' && !comTopo && mostrarViews) || semRolagem ? 'overflow-hidden' : 'overflow-auto'}`}>
          {t.loadingEstrutura || vt.loading ? (
            <div className="flex items-center justify-center py-20 text-ln-t4 text-[13px] gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>
          ) : secao ? secao(api) : (
            <>
              {antesDaView}
              {view === 'calendario' ? (
                <CalendarioView itens={filtrados} ctx={ctx} />
              ) : view === 'gantt' ? (
                <GanttView itens={filtrados} ctx={ctx} />
              ) : view === 'quadro' ? (
                <div className={comTopo ? 'h-[560px]' : 'h-full'}><QuadroView grupos={grupos} filhosDe={filhosVisao} ctx={ctx} /></div>
              ) : (
                <ListaView key={`${chaveRascunho}:${config.subtarefas}`} grupos={grupos} filhosDe={filhosVisao} ctx={{ ...ctx, selecao }} mostrarConcluidas={mostrarConcluidas} />
              )}
            </>
          )}
        </div>

        {mostrarViews && view === 'lista' && (
          <BarraSelecao n={itensSel.length} onLimpar={() => setSelecionadas(new Set())} onDuplicar={duplicarSel} onArquivar={arquivarSel} onExcluir={excluirSel} ocupado={emMassa}>
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

      {/* ── Aplicar template: cobre a área inteira, como a tarefa expandida ── */}
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
                  ctx={{ statuses, membros: teamMembers || [], etiquetas: vt.etiquetas, ciclos: vt.ciclos, listas: listasEscopo.length ? listasEscopo : t.listas, pastas: t.pastas, projetos: projects || [], squads: squads || [], escopo: escopoViews?.escopo }}
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
                  key={chaveRascunho} v={viewAtiva} config={config} podeEditar={podeEditarView} souDono={souDonoView} membros={teamMembers || []} respBloqueado={respBloqueado}
                  onEditar={editarViewNaSidebar} onMeta={metaView} onAbrirFiltros={() => setPainelView('filtros')}
                  onDuplicar={() => criarVisualizacao({ nome: `${viewAtiva.nome} (cópia)`, publica: true })}
                  onExcluir={excluirVisualizacao} onFechar={() => setPainelView(null)}
                />
              )}
            </aside>
          </>
        )
      })()}

      {/* ── Painel lateral: tarefa nova (rascunho) ──────────────── */}
      {!!novaInicial && !tarefaAbertaId && !aplicandoTpl && (
        <>
          {painelComFundo && <div className="absolute inset-0 z-30 bg-black/30" onClick={() => setNovaInicial(null)} aria-hidden="true" />}
          <aside className="absolute inset-y-0 right-0 z-40 shadow-2xl border-l border-ln-ink/[0.08] flex flex-col bg-ln-panel" style={{ width: `min(${larguraPainel}px, 100%)` }} aria-label="Nova tarefa">
            <AlcaPainel largura={larguraPainel} onLargura={setLarguraPainel} />
            <div className="h-11 shrink-0 flex items-center justify-between gap-2 px-3 border-b border-ln-ink/5">
              <span className="text-xs font-medium text-ln-t2">Nova tarefa</span>
              <button onClick={() => setNovaInicial(null)} className="ln-iconbtn" aria-label="Descartar a tarefa nova" title="Descartar (Esc)"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 min-h-0">
              <NovaTarefaPanel
                grupos={gruposNova} listasMap={t.listasMap} inicial={novaInicial}
                membros={teamMembers || []} membrosMap={membrosMap}
                onCriar={criarDoRascunho} onCancelar={() => setNovaInicial(null)}
              />
            </div>
          </aside>
        </>
      )}

      {/* ── Painel lateral: tarefa ──────────────────────────────── */}
      {!!tarefaAbertaId && !aplicandoTpl && (
        <>
          {painelComFundo && !painelExpandido && <div className="absolute inset-0 z-30 bg-black/30" onClick={fecharPainel} aria-hidden="true" />}
          <aside
            className={`${painelExpandido ? 'absolute inset-0 z-40' : 'absolute inset-y-0 right-0 z-40 shadow-2xl border-l border-ln-ink/[0.08]'} flex flex-col bg-ln-panel`}
            style={painelExpandido ? undefined : { width: `min(${larguraPainel}px, 100%)` }}
            aria-label="Detalhe da tarefa"
          >
            {!painelExpandido && <AlcaPainel largura={larguraPainel} onLargura={setLarguraPainel} />}
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
                {tarefaAberta && !tarefaAberta.clickup_task_id && listasComClickup.has(tarefaAberta.lista_id) && (
                  <span className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-xs text-ln-yellow" title="Está na fila para ir ao ClickUp; o link aparece assim que chegar lá">
                    <CloudUpload className="w-3 h-3" /> aguardando ClickUp
                  </span>
                )}
                {tarefaAberta && (
                  <MenuTarefa key={tarefaAberta.id} item={tarefaAberta} user={user} acoes={acoesTarefa('painel')} />
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
                  ancestrais={ancestraisDaAberta}
                  irmas={irmasDaAberta}
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
                  onRelacoesMudaram={() => t.agendarPush?.()}
                />
              ) : (
                <div className="flex items-center justify-center py-20 text-ln-t4"><Loader2 className="w-4 h-4 animate-spin" /></div>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  )
}
