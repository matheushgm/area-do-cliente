// Módulo Atividades: capacidade do time (lida do ClickUp) + planejador de
// atividades, num frame com a linguagem visual do Linear (tokens ln-*).
//
// De cima para baixo: barra superior (breadcrumb, contador, ações), barra de
// views, KPIs do time, linha de calor dos 10 dias úteis, tabela por pessoa
// agrupada por saúde e a lista das atividades planejadas como "issues".
// À direita, um painel com três modos (pessoa, atividade, nova atividade).
// O cálculo da data vive no painel flutuante "Planejador · ClickUp".
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Menu, CalendarCheck, ChevronUp, ChevronDown, ChevronRight, Star, RefreshCw, Loader2, Settings, Plus, X,
  Users, ListChecks, Rows3, Layers,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import AppSidebar from '../components/AppSidebar'
import Toast from '../components/UI/Toast'
import { useToast } from '../hooks/useToast'
import { supabase } from '../lib/supabase'
import { carregarConfigAtividades } from '../lib/atividades'
import { useCargaTime } from '../hooks/useCargaTime'
import { usePlanejador } from '../hooks/usePlanejador'
import { fmtHora, chaveAtividade } from '../lib/atividadesCarga'
import KpiStrip from '../components/Atividades/KpiStrip'
import TeamHeatLine from '../components/Atividades/TeamHeatLine'
import TeamTable from '../components/Atividades/TeamTable'
import PersonPanel from '../components/Atividades/PersonPanel'
import IssueList from '../components/Atividades/IssueList'
import AtividadePanel from '../components/Atividades/AtividadePanel'
import NovaAtividadePanel from '../components/Atividades/NovaAtividadePanel'
import PlannerFloat from '../components/Atividades/PlannerFloat'
import ConfigModal from '../components/Atividades/ConfigModal'

// Fallback só para a tela não quebrar sem API; a fonte de verdade é DEFAULT_CONFIG
// em api/_atividades_engine.js (mesclado com atividades_config), via action=config.
const CONFIG_FALLBACK = {
  capacidade_padrao_horas_dia: 6, capacidade_por_pessoa: {}, horas_padrao_sem_estimativa: 1,
  horas_por_tipo: {}, horas_por_dificuldade: {}, dias_atraso_maximo: 14,
  considerar_backlog: true, considerar_sem_data: false, horizonte_dias_uteis: 60,
}

const PAINEL_LARGURA = 480
const EMPURRA_A_PARTIR_DE = 1200 // px de largura da área de conteúdo: abaixo disso o painel vira overlay

const AGRUPAR_TIME = [
  { value: 'saude', label: 'saúde' },
  { value: 'departamento', label: 'departamento' },
  { value: 'nenhum', label: 'nenhum' },
]
const AGRUPAR_LISTA = [
  { value: 'semana', label: 'semana' },
  { value: 'status', label: 'status' },
  { value: 'responsavel', label: 'responsável' },
]
const FILTROS_LISTA = [
  { value: 'todas', label: 'Todas' },
  { value: 'semana', label: 'Esta semana' },
  { value: 'forcadas', label: 'Forçadas' },
  { value: 'aviso', label: 'Com aviso' },
]

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

export default function Atividades() {
  const navigate = useNavigate()
  const { user, projects, teamMembers, squads } = useApp()
  const { toast, showToast } = useToast()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isAdmin = user?.role === 'admin'

  // ── Config do cálculo ──────────────────────────────────────────────────────
  const [config, setConfig] = useState(CONFIG_FALLBACK)
  const [showConfig, setShowConfig] = useState(false)
  useEffect(() => {
    carregarConfigAtividades()
      .then((r) => { if (r?.config) setConfig(r.config) })
      .catch((e) => console.warn('[Atividades] config:', e.message))
  }, [])

  // ── Time e carga ───────────────────────────────────────────────────────────
  const membros = useMemo(() => (teamMembers || [])
    .map((m) => ({ id: m.id, nome: m.name, avatar: m.avatar, clickupId: Number(m.clickupUserId ?? m.clickup_user_id) || null }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [teamMembers])
  const carga = useCargaTime(membros, squads)

  // ── Histórico ──────────────────────────────────────────────────────────────
  const [historico, setHistorico] = useState([])
  const [loadingHist, setLoadingHist] = useState(true)
  const carregarHistorico = useCallback(async () => {
    if (!supabase) { setLoadingHist(false); return }
    const { data, error } = await supabase
      .from('atividades_planejadas')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(120)
    if (error) console.error('[Atividades] histórico:', error.message)
    setHistorico(data || [])
    setLoadingHist(false)
  }, [])
  useEffect(() => { carregarHistorico() }, [carregarHistorico])

  const nomeProjeto = useMemo(() => new Map((projects || []).map((p) => [p.id, p.companyName || p.company_name])), [projects])
  const nomeMembro = useMemo(() => new Map((teamMembers || []).map((m) => [m.id, m.name])), [teamMembers])

  // ── Planejador (fluxo de nova atividade) ───────────────────────────────────
  const [painel, setPainel] = useState(null) // { tipo: 'pessoa', profileId, aba } | { tipo: 'atividade', id } | { tipo: 'nova' }
  const [plannerAberto, setPlannerAberto] = useState(false)
  const [plannerMin, setPlannerMin] = useState(false)
  const { refresh: refreshCarga } = carga

  const onCriada = useCallback((r) => {
    carregarHistorico()
    // a carga do responsável acabou de mudar
    const id = Number(r?.registro?.responsavel_clickup_id)
    if (id > 0) refreshCarga([id])
  }, [carregarHistorico, refreshCarga])
  const pl = usePlanejador({ projects, teamMembers, squads, config, showToast, onCriada })
  const { novaAtividade: resetPlanejador } = pl

  // ── Estado de UI ───────────────────────────────────────────────────────────
  const [view, setView] = useState('time')            // 'time' | 'atividades' (breadcrumb + tab ativa)
  const [diaSelecionado, setDiaSelecionado] = useState(null)
  const [filtroNivel, setFiltroNivel] = useState(null)
  const [agrupar, setAgrupar] = useState('saude')
  const [denso, setDenso] = useState(false)
  const [filtroLista, setFiltroLista] = useState('todas')
  const [agruparLista, setAgruparLista] = useState('semana')

  const conteudoRef = useRef(null)
  const scrollRef = useRef(null)
  const timeRef = useRef(null)
  const listaRef = useRef(null)
  const largura = useLarguraDoConteudo(conteudoRef)
  const painelEmpurra = largura >= EMPURRA_A_PARTIR_DE

  // breadcrumb e tab ativa acompanham a rolagem: vira "Atividades planejadas"
  // quando o topo da lista passa do meio da área visível
  useEffect(() => {
    const root = scrollRef.current
    if (!root) return
    let raf = 0
    const medir = () => {
      raf = 0
      const alvo = listaRef.current
      if (!alvo) return
      const r = root.getBoundingClientRect()
      const a = alvo.getBoundingClientRect()
      setView(a.top - r.top < r.height * 0.45 ? 'atividades' : 'time')
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(medir) }
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => { root.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf) }
  }, [])

  const irPara = (qual) => {
    setView(qual)
    const el = qual === 'time' ? timeRef.current : listaRef.current
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // ── Ações ──────────────────────────────────────────────────────────────────
  const abrirPessoa = useCallback((pessoa, aba = 'fila') => {
    setPainel({ tipo: 'pessoa', profileId: pessoa.profileId, aba })
  }, [])
  const abrirAtividade = useCallback((registro) => {
    setPainel({ tipo: 'atividade', id: registro.id })
  }, [])
  const novaAtividade = useCallback((pessoa = null) => {
    resetPlanejador(pessoa?.profileId ? { responsavelId: pessoa.profileId } : {})
    setPainel({ tipo: 'nova' })
    setPlannerAberto(false)
    setPlannerMin(false)
  }, [resetPlanejador])
  const fecharPainel = useCallback(() => setPainel(null), [])
  const onCalculado = useCallback(() => { setPlannerAberto(true); setPlannerMin(false) }, [])
  const recarregarPessoa = useCallback((pessoa) => { if (pessoa?.clickupId) refreshCarga([pessoa.clickupId]) }, [refreshCarga])

  // atalhos: C nova atividade, Esc fecha painel, setas no contador
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (painel) setPainel(null)
        else if (plannerAberto) setPlannerMin(true)
        return
      }
      if (estaDigitando() || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'c' || e.key === 'C') { e.preventDefault(); novaAtividade() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [painel, plannerAberto, novaAtividade])

  // ── Contador "n / N" do painel ─────────────────────────────────────────────
  const pessoaAberta = painel?.tipo === 'pessoa' ? carga.pessoas.find((p) => p.profileId === painel.profileId) || null : null
  const atividadeAberta = painel?.tipo === 'atividade' ? historico.find((h) => h.id === painel.id) || null : null
  const contador = useMemo(() => {
    if (painel?.tipo === 'pessoa') {
      const i = carga.pessoas.findIndex((p) => p.profileId === painel.profileId)
      return { i, n: carga.pessoas.length, ir: (j) => { const p = carga.pessoas[j]; if (p) setPainel({ tipo: 'pessoa', profileId: p.profileId, aba: painel.aba }) } }
    }
    if (painel?.tipo === 'atividade') {
      const i = historico.findIndex((h) => h.id === painel.id)
      return { i, n: historico.length, ir: (j) => { const h = historico[j]; if (h) setPainel({ tipo: 'atividade', id: h.id }) } }
    }
    return { i: -1, n: carga.pessoas.length, ir: () => {} }
  }, [painel, carga.pessoas, historico])

  const tituloPainel = painel?.tipo === 'pessoa' ? (pessoaAberta?.nome || 'Pessoa')
    : painel?.tipo === 'atividade' ? (atividadeAberta ? chaveAtividade(atividadeAberta.id) : 'Atividade')
    : painel?.tipo === 'nova' ? 'Nova atividade' : ''

  const plannerOffset = painel && painelEmpurra ? PAINEL_LARGURA + 16 : 16

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex bg-gradient-dark">
      <AppSidebar
        filter="atividades"
        setFilter={() => navigate('/')}
        counts={{}}
        activeAccounts={[]}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div ref={conteudoRef} className="ln flex-1 min-w-0 flex flex-col h-screen bg-ln-bg">
        <div className="flex-1 min-h-0 p-2">
          <div className="relative h-full min-h-0 flex rounded-lg border border-ln-ink/5 bg-ln-panel overflow-hidden" style={{ boxShadow: '0 0 0 2px rgb(var(--ln-ink) / 0.02)' }}>
            {/* ── Painel principal ─────────────────────────────────────── */}
            <div className="flex-1 min-w-0 flex flex-col">
              {/* Barra superior */}
              <header className="h-11 shrink-0 flex items-center justify-between gap-3 px-3 border-b border-ln-ink/5">
                <div className="flex items-center gap-1 min-w-0">
                  <button onClick={() => setSidebarOpen(true)} aria-label="Abrir menu de navegação" className="ln-iconbtn lg:hidden"><Menu className="w-4 h-4" /></button>
                  <div className="flex items-center gap-2 h-7 px-2.5 rounded-lg text-xs font-medium text-ln-t2 min-w-0">
                    <CalendarCheck className="w-3.5 h-3.5 text-ln-accent shrink-0" />
                    <span className="truncate">Atividades</span>
                    <ChevronRight className="w-3 h-3 text-ln-t4 shrink-0" />
                    <span className="truncate text-ln-t2">{view === 'time' ? 'Capacidade do time' : 'Atividades planejadas'}</span>
                  </div>
                  <button className="ln-iconbtn" aria-label="Favorito" title="Favorito"><Star className="w-3.5 h-3.5" /></button>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`hidden sm:inline-flex items-center gap-1.5 text-xs ${carga.envelhecido ? 'text-ln-yellow' : 'text-ln-t4'}`} title={carga.geradoEm ? `Carga lida do ClickUp às ${fmtHora(carga.geradoEm)}` : 'Ainda não li o ClickUp'}>
                    {carga.loading
                      ? <><Loader2 className="w-3 h-3 animate-spin" /> Lendo {carga.progresso.lidas} de {carga.progresso.total}…</>
                      : carga.geradoEm ? `atualizado ${fmtHora(carga.geradoEm)}` : 'sem leitura'}
                  </span>
                  <span className="hidden md:inline-flex items-center text-xs text-ln-t4 tabular">
                    {contador.i >= 0 ? `${contador.i + 1} / ${contador.n}` : `${carga.lidas} / ${carga.pessoas.length}`}
                  </span>
                  <div className="hidden md:flex items-center">
                    <button onClick={() => contador.ir(contador.i - 1)} disabled={contador.i <= 0} className="ln-iconbtn !w-[30px] !rounded-md" aria-label="Anterior"><ChevronUp className="w-3.5 h-3.5" /></button>
                    <button onClick={() => contador.ir(contador.i + 1)} disabled={contador.i < 0 || contador.i >= contador.n - 1} className="ln-iconbtn !w-[30px] !rounded-md" aria-label="Próximo"><ChevronDown className="w-3.5 h-3.5" /></button>
                  </div>
                  <button onClick={() => carga.refresh()} disabled={carga.loading} className="ln-iconbtn" aria-label="Recarregar do ClickUp" title="Recarregar do ClickUp">
                    <RefreshCw className={`w-3.5 h-3.5 ${carga.loading ? 'animate-spin' : ''}`} />
                  </button>
                  <button onClick={() => novaAtividade()} className="ln-primary" title="Nova atividade (C)">
                    <Plus className="w-3.5 h-3.5" /> Nova atividade <kbd className="ln-kbd !text-white/80 !bg-white/15 !border-white/20 ml-0.5">C</kbd>
                  </button>
                  {isAdmin && (
                    <button onClick={() => setShowConfig(true)} className="ln-iconbtn" aria-label="Capacidade e horas padrão" title="Capacidade e horas padrão"><Settings className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              </header>

              {/* Barra de views */}
              <div className="h-11 shrink-0 flex items-center justify-between gap-3 px-3 border-b border-ln-ink/5">
                <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto scroll-hide">
                  <button onClick={() => irPara('time')} className={`ln-tab ${view === 'time' ? 'ln-tab-active' : ''}`}><Users className="w-3.5 h-3.5" /> Time</button>
                  <button onClick={() => irPara('atividades')} className={`ln-tab ${view === 'atividades' ? 'ln-tab-active' : ''}`}><ListChecks className="w-3.5 h-3.5" /> Atividades</button>
                  <span className="w-px h-4 bg-ln-line mx-1 shrink-0" />
                  {FILTROS_LISTA.map((f) => (
                    <button key={f.value} onClick={() => { setFiltroLista(f.value); if (f.value !== 'todas') irPara('atividades') }} className={`ln-tab ${filtroLista === f.value ? 'ln-tab-active' : ''}`}>{f.label}</button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {view === 'time' ? (
                    <button onClick={() => setAgrupar(AGRUPAR_TIME[(AGRUPAR_TIME.findIndex((a) => a.value === agrupar) + 1) % AGRUPAR_TIME.length].value)} className="ln-pill" title="Agrupar a tabela do time">
                      <Layers className="w-3.5 h-3.5" /> Agrupar: {AGRUPAR_TIME.find((a) => a.value === agrupar)?.label} <ChevronDown className="w-3 h-3" />
                    </button>
                  ) : (
                    <button onClick={() => setAgruparLista(AGRUPAR_LISTA[(AGRUPAR_LISTA.findIndex((a) => a.value === agruparLista) + 1) % AGRUPAR_LISTA.length].value)} className="ln-pill" title="Agrupar a lista de atividades">
                      <Layers className="w-3.5 h-3.5" /> Agrupar: {AGRUPAR_LISTA.find((a) => a.value === agruparLista)?.label} <ChevronDown className="w-3 h-3" />
                    </button>
                  )}
                  {filtroNivel && (
                    <button onClick={() => setFiltroNivel(null)} className="ln-pill" title="Limpar filtro de saúde">Filtro: {filtroNivel.replace('_', ' ')} <X className="w-3 h-3" /></button>
                  )}
                  <button onClick={() => setDenso((v) => !v)} className={`ln-iconbtn ${denso ? 'bg-ln-ink/[0.08] text-ln-t1' : ''}`} aria-label="Densidade" title={denso ? 'Linhas confortáveis' : 'Linhas compactas'}><Rows3 className="w-3.5 h-3.5" /></button>
                </div>
              </div>

              {/* Conteúdo rolável */}
              <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
                <section ref={timeRef} className="pb-4">
                  <KpiStrip
                    pessoas={carga.pessoas}
                    hoje={carga.hoje}
                    diaSelecionado={diaSelecionado}
                    filtroNivel={filtroNivel}
                    onFiltrarNivel={setFiltroNivel}
                    onSelecionarDia={setDiaSelecionado}
                    loading={carga.loading}
                    progresso={carga.progresso}
                    diasAtrasoMaximo={config.dias_atraso_maximo}
                    colunas={painel && painelEmpurra ? 3 : 6}
                  />
                  <TeamHeatLine pessoas={carga.pessoas} hoje={carga.hoje} diaSelecionado={diaSelecionado} onSelecionarDia={setDiaSelecionado} />
                  <TeamTable
                    pessoas={carga.pessoas}
                    hoje={carga.hoje}
                    loading={carga.loading}
                    agrupar={agrupar}
                    filtroNivel={filtroNivel}
                    diaSelecionado={diaSelecionado}
                    selecionadaId={painel?.tipo === 'pessoa' ? painel.profileId : null}
                    denso={denso}
                    onAbrirPessoa={abrirPessoa}
                    onNovaAtividadePara={(p) => novaAtividade(p)}
                    onRecarregar={recarregarPessoa}
                    colunasOcultas={painel && painelEmpurra ? (largura < 1440 ? ['semdata', 'zumbis', 'alem', 'proxlivre'].concat(largura < 1100 ? ['hoje'] : []) : []) : []}
                  />
                </section>
                <section ref={listaRef} className="pb-24">
                  <IssueList
                    registros={historico}
                    nomeProjeto={nomeProjeto}
                    nomeMembro={nomeMembro}
                    filtro={filtroLista}
                    agrupar={agruparLista}
                    selecionadaId={painel?.tipo === 'atividade' ? painel.id : null}
                    onAbrir={abrirAtividade}
                    loading={loadingHist}
                  />
                </section>
              </div>
            </div>

            {/* ── Painel lateral ──────────────────────────────────────── */}
            {painel && (
              <>
                {!painelEmpurra && <div className="absolute inset-0 z-30 bg-black/30" onClick={fecharPainel} aria-hidden="true" />}
                <aside
                  className={`${painelEmpurra ? 'relative shrink-0' : 'absolute inset-y-0 right-0 z-40 shadow-2xl'} flex flex-col bg-ln-panel border-l border-ln-ink/[0.08]`}
                  style={{ width: painelEmpurra ? PAINEL_LARGURA : `min(${PAINEL_LARGURA}px, 100%)` }}
                  aria-label={tituloPainel}
                >
                  <div className="h-11 shrink-0 flex items-center justify-between gap-2 px-3 border-b border-ln-ink/5">
                    <div className="flex items-center gap-2 text-xs font-medium text-ln-t2 min-w-0">
                      <span className="text-ln-t4">Atividades</span>
                      <ChevronRight className="w-3 h-3 text-ln-t4 shrink-0" />
                      <span className="truncate">{tituloPainel}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {contador.i >= 0 && (
                        <>
                          <span className="text-xs text-ln-t4 tabular mr-1">{contador.i + 1} / {contador.n}</span>
                          <button onClick={() => contador.ir(contador.i - 1)} disabled={contador.i <= 0} className="ln-iconbtn" aria-label="Anterior"><ChevronUp className="w-3.5 h-3.5" /></button>
                          <button onClick={() => contador.ir(contador.i + 1)} disabled={contador.i >= contador.n - 1} className="ln-iconbtn" aria-label="Próximo"><ChevronDown className="w-3.5 h-3.5" /></button>
                        </>
                      )}
                      <button onClick={fecharPainel} className="ln-iconbtn" aria-label="Fechar painel" title="Fechar (Esc)"><X className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    {painel.tipo === 'pessoa' && pessoaAberta && (
                      <PersonPanel
                        pessoa={{ ...pessoaAberta, atualizadoEm: carga.geradoEm }}
                        hoje={carga.hoje}
                        diaSelecionado={diaSelecionado}
                        abaInicial={painel.aba}
                        onNovaAtividade={(p) => novaAtividade(p)}
                        onRecarregar={recarregarPessoa}
                      />
                    )}
                    {painel.tipo === 'atividade' && atividadeAberta && (
                      <AtividadePanel registro={atividadeAberta} nomeProjeto={nomeProjeto} nomeMembro={nomeMembro} />
                    )}
                    {painel.tipo === 'nova' && (
                      <NovaAtividadePanel pl={pl} responsavelInicial={pl.form.responsavelId || null} onCalculado={onCalculado} />
                    )}
                  </div>
                </aside>
              </>
            )}
          </div>
        </div>

        <PlannerFloat
          pl={pl}
          aberto={plannerAberto}
          minimizado={plannerMin}
          onMinimizar={setPlannerMin}
          onFechar={() => setPlannerAberto(false)}
          offsetRight={plannerOffset}
          hoje={carga.hoje}
        />
      </div>

      {showConfig && (
        <ConfigModal
          config={config}
          responsaveis={pl.responsaveis}
          userId={user?.id}
          onClose={() => setShowConfig(false)}
          onSaved={(cfg) => { setConfig(cfg); setShowConfig(false); showToast('Configuração salva'); carga.refresh() }}
          onError={(m) => showToast(m, 'error')}
        />
      )}

      <Toast toast={toast} />
    </div>
  )
}
