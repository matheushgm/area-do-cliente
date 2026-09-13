import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import AppSidebar from '../components/AppSidebar'
import Modal from '../components/UI/Modal'
import Toast from '../components/UI/Toast'
import { useToast } from '../hooks/useToast'
import { supabase } from '../lib/supabase'
import { sugerirAtividade, listarListasClickUp, criarAtividade, carregarConfigAtividades } from '../lib/atividades'
import {
  Menu, CalendarCheck, Loader2, Sparkles, AlertTriangle, CheckCircle2, ExternalLink,
  Users, Settings, X, Clock, ChevronDown, ChevronUp, RefreshCw, History, Info, ArrowRight,
} from 'lucide-react'

// ─── Constantes (espelham os campos do ClickUp no space "Clientes") ──────────

// Tipo de tarefa → departamento que normalmente executa
const TIPO_PARA_DEPARTAMENTO = {
  'Criação de Arte Estática':     'Designer',
  'Criação de Landing Page':      'Web Designer',
  'Relatório':                    'Gestor de tráfego',
  'Edição de vídeo':              'Designer',
  'Integração':                   'Tecnologia',
  'Copy de anúncio':              'Copywriter',
  'Copy de Landing Page':         'Copywriter',
  'Estratégia':                   'Estrategista',
  'Traqueamento':                 'Tecnologia',
  'Reunião':                      'Account Manager',
  'Preenchimento de resultado':   'Gestor de tráfego',
  'Otimização':                   'Gestor de tráfego',
  'Subir Criativo':               'Gestor de tráfego',
  'Criar Campanha':               'Gestor de tráfego',
  'Gravação de vídeo':            'Designer',
  'Fotografia':                   'Designer',
  'Edição de fotografia':         'Designer',
  'Mídia Offline':                'Designer',
  'Motion design':                'Designer',
  'Projeto de identidade visual': 'Designer',
  'Branding (estratégia)':        'Estrategista',
}
const TIPOS_TAREFA = Object.keys(TIPO_PARA_DEPARTAMENTO)

const DEPARTAMENTOS = [
  'Gestor de tráfego', 'Estrategista', 'Comercial', 'Copywriter',
  'Web Designer', 'Designer', 'Account Manager', 'Tecnologia',
]
// No squad da Área do Cliente o departamento de tecnologia ainda se chama assim
const DEPARTAMENTO_ALIAS_SQUAD = { 'Tecnologia': 'Automação / Integração' }

const PRIORIDADES = [
  { value: 'urgent', label: 'Urgente', cls: 'text-red-400 border-red-400/40 bg-red-400/10' },
  { value: 'high',   label: 'Alta',    cls: 'text-rl-gold border-rl-gold/40 bg-rl-gold/10' },
  { value: 'normal', label: 'Normal',  cls: 'text-rl-cyan border-rl-cyan/40 bg-rl-cyan/10' },
  { value: 'low',    label: 'Baixa',   cls: 'text-rl-muted border-rl-border bg-rl-surface' },
]

// Fallback só pra tela não quebrar sem API; a fonte de verdade é DEFAULT_CONFIG
// em api/_atividades_engine.js (mesclado com atividades_config), via action=config.
const CONFIG_FALLBACK = {
  capacidade_padrao_horas_dia: 6,
  capacidade_por_pessoa: {},
  horas_padrao_sem_estimativa: 1,
  horas_por_tipo: {},
  horas_por_dificuldade: {},
  dias_atraso_maximo: 14,
  considerar_backlog: true,
  considerar_sem_data: false,
  horizonte_dias_uteis: 60,
}

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const DIAS_LONGO = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

function hojeISO() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function weekday(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}
function fmtCurta(iso) {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}
function fmtLonga(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${DIAS_LONGO[weekday(iso)]}, ${d}/${m}/${y}`
}
function fmtHoras(h) {
  const n = Number(h) || 0
  return Number.isInteger(n) ? `${n}h` : `${n.toFixed(1).replace('.', ',')}h`
}
function primeiroNome(nome) {
  return String(nome || '').split(' ')[0]
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function Atividades() {
  const navigate = useNavigate()
  const { user, projects, teamMembers, squads } = useApp()
  const { toast, showToast } = useToast()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isAdmin = user?.role === 'admin'

  // Config (capacidade, horas padrão): padrão do motor + atividades_config, via API
  const [config, setConfig] = useState(CONFIG_FALLBACK)
  const [showConfig, setShowConfig] = useState(false)

  useEffect(() => {
    carregarConfigAtividades()
      .then((r) => { if (r?.config) setConfig(r.config) })
      .catch((e) => console.warn('[Atividades] config:', e.message))
  }, [])

  // Clientes com pasta no ClickUp (sem pasta não dá pra criar a tarefa no lugar certo)
  const clientes = useMemo(() => {
    return (projects || [])
      .filter((p) => p.clickupFolderId || p.clickup_folder_id)
      .map((p) => ({
        id: p.id,
        nome: (p.companyName || p.company_name || '').trim(),
        folderId: p.clickupFolderId || p.clickup_folder_id,
        listId: p.clickupListId || p.clickup_list_id || null,
        squad: p.squad || null,
        status: p.status,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [projects])

  // Só quem tem ClickUp mapeado consegue receber a tarefa
  const responsaveis = useMemo(() => {
    return (teamMembers || [])
      .filter((m) => Number(m.clickupUserId ?? m.clickup_user_id) > 0)
      .map((m) => ({ id: m.id, nome: m.name, clickupId: Number(m.clickupUserId ?? m.clickup_user_id), avatar: m.avatar }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [teamMembers])
  const responsavelPorClickup = useMemo(() => new Map(responsaveis.map((r) => [r.clickupId, r])), [responsaveis])

  // ── Formulário ─────────────────────────────────────────────────────────────
  const [projectId, setProjectId] = useState('')
  const [listId, setListId] = useState('')
  const [listas, setListas] = useState([])
  const [listasErro, setListasErro] = useState(null)
  const [loadingListas, setLoadingListas] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [tipo, setTipo] = useState('')
  const [departamento, setDepartamento] = useState('')
  const [responsavelId, setResponsavelId] = useState('')
  const [horas, setHoras] = useState('')
  const [horasTouched, setHorasTouched] = useState(false)
  const [prioridade, setPrioridade] = useState('normal')
  const [naoAntesDe, setNaoAntesDe] = useState(hojeISO())
  const [dataDesejada, setDataDesejada] = useState('')

  const cliente = clientes.find((c) => c.id === projectId) || null
  const responsavel = responsaveis.find((r) => r.id === responsavelId) || null

  // Listas da pasta do cliente (a tarefa vai pra "Geral" por padrão)
  useEffect(() => {
    if (!cliente?.folderId) { setListas([]); setListId(''); return }
    let cancelled = false
    setLoadingListas(true)
    setListasErro(null)
    listarListasClickUp(cliente.folderId)
      .then((r) => {
        if (cancelled) return
        const ls = r?.listas || []
        setListas(ls)
        const geral = ls.find((l) => l.name.trim().toLowerCase() === 'geral') || ls[0]
        setListId(geral?.id || cliente.listId || '')
      })
      .catch((e) => {
        if (cancelled) return
        setListas([])
        setListId(cliente.listId || '')
        setListasErro(e.message)
      })
      .finally(() => { if (!cancelled) setLoadingListas(false) })
    return () => { cancelled = true }
  }, [cliente?.folderId, cliente?.listId])

  // Tipo → departamento + horas padrão
  function handleTipoChange(novo) {
    setTipo(novo)
    const dep = TIPO_PARA_DEPARTAMENTO[novo]
    if (dep) setDepartamento(dep)
    if (!horasTouched) {
      const h = config.horas_por_tipo?.[novo]
      setHoras(h != null ? String(h) : '')
    }
  }

  // Departamento + squad do cliente → responsável sugerido
  useEffect(() => {
    if (!departamento || !cliente) return
    const squad = (squads || []).find((s) => s.id === cliente.squad)
    const assignments = squad?.department_assignments || squad?.departmentAssignments || {}
    const profileId = assignments[departamento] || assignments[DEPARTAMENTO_ALIAS_SQUAD[departamento]] || null
    if (profileId && responsaveis.some((r) => r.id === profileId)) setResponsavelId(profileId)
  }, [departamento, cliente, squads, responsaveis])

  // ── Sugestão ───────────────────────────────────────────────────────────────
  const [calculando, setCalculando] = useState(false)
  const [resultado, setResultado] = useState(null)   // planejarParaPessoa do responsável
  const [erroCalculo, setErroCalculo] = useState(null)
  const [dataEscolhida, setDataEscolhida] = useState('')
  const [justificativa, setJustificativa] = useState('')
  const [comparacao, setComparacao] = useState(null) // [{ pessoa, resultado }]
  const [comparando, setComparando] = useState(false)
  const [mostrarFila, setMostrarFila] = useState(false)
  const calcSeq = useRef(0)

  const horasNum = Number(String(horas).replace(',', '.'))
  const formOk = !!cliente && !!listId && titulo.trim().length > 2 && !!responsavel && horasNum > 0

  const calcular = useCallback(async ({ dataForcada = null, silencioso = false } = {}) => {
    if (!responsavel || !(horasNum > 0)) return
    const seq = ++calcSeq.current
    if (!silencioso) { setCalculando(true); setErroCalculo(null); setComparacao(null) }
    try {
      const r = await sugerirAtividade({
        assignees: [responsavel.clickupId],
        horas: horasNum,
        naoAntesDe: naoAntesDe || null,
        dataDesejada: dataForcada || null,
      })
      if (seq !== calcSeq.current) return
      const res = r?.resultados?.[0]
      if (!res) throw new Error(r?.erros?.[0]?.error || 'Sem resultado para o responsável.')
      setResultado(res)
      if (!silencioso) {
        const entrega = res.sugestao?.entrega || ''
        // Se o account já tinha um prazo em mente, ele vira a data escolhida (e é avaliado)
        if (dataDesejada && entrega && dataDesejada < entrega) {
          setDataEscolhida(dataDesejada)
          calcular({ dataForcada: dataDesejada, silencioso: true })
        } else {
          setDataEscolhida(dataDesejada && dataDesejada > entrega ? dataDesejada : entrega)
        }
        setJustificativa('')
      }
    } catch (e) {
      if (seq !== calcSeq.current) return
      setErroCalculo(e.message)
      if (!silencioso) setResultado(null)
    } finally {
      if (seq === calcSeq.current && !silencioso) setCalculando(false)
    }
  }, [responsavel, horasNum, naoAntesDe, dataDesejada])

  // Mudou a data escolhida pra antes da sugerida: reavalia a sobrecarga (debounce)
  const sugerida = resultado?.sugestao?.entrega || null
  const forcandoData = !!(resultado && dataEscolhida && sugerida && dataEscolhida < sugerida)
  useEffect(() => {
    if (!forcandoData) return
    const t = setTimeout(() => calcular({ dataForcada: dataEscolhida, silencioso: true }), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataEscolhida, forcandoData])

  async function comparar() {
    if (!(horasNum > 0) || responsaveis.length === 0) return
    setComparando(true)
    try {
      const r = await sugerirAtividade({
        assignees: responsaveis.map((p) => p.clickupId),
        horas: horasNum,
        naoAntesDe: naoAntesDe || null,
      })
      const rows = (r?.resultados || []).map((res) => ({ pessoa: responsavelPorClickup.get(res.clickupUserId), resultado: res }))
        .filter((x) => x.pessoa)
        .sort((a, b) => {
          const ea = a.resultado.sugestao?.entrega || '9999', eb = b.resultado.sugestao?.entrega || '9999'
          return ea < eb ? -1 : ea > eb ? 1 : (a.resultado.totais.ocupacaoProximosDias - b.resultado.totais.ocupacaoProximosDias)
        })
      setComparacao({ rows, erros: r?.erros || [] })
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setComparando(false)
    }
  }

  function escolherAlternativa(row) {
    setResponsavelId(row.pessoa.id)
    setResultado(row.resultado)
    setDataEscolhida(row.resultado.sugestao?.entrega || '')
    setJustificativa('')
  }

  // ── Criação no ClickUp ─────────────────────────────────────────────────────
  const [criando, setCriando] = useState(false)
  const [criada, setCriada] = useState(null)
  const forcada = forcandoData ? resultado?.forcada : null
  const sobrecarga = !!(forcada && !forcada.cabe)
  const podeCriar = formOk && !!resultado && !!dataEscolhida && !criando && (!sobrecarga || justificativa.trim().length >= 5)

  async function aprovar() {
    if (!podeCriar) return
    setCriando(true)
    try {
      const r = await criarAtividade({
        projectId: cliente.id,
        clienteNome: cliente.nome,
        listId,
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        tipoTarefa: tipo || null,
        departamento: departamento || null,
        responsavelProfileId: responsavel.id,
        assigneeClickupId: responsavel.clickupId,
        horas: horasNum,
        prioridade,
        dataInicio: resultado.sugestao?.inicio || null,
        dataSugerida: sugerida,
        dataEscolhida,
        sobrecarga,
        horasExcedentes: sobrecarga ? forcada.horasExcedentes : null,
        justificativa: sobrecarga ? justificativa.trim() : null,
        snapshot: { hoje: resultado.hoje, capacidadeDia: resultado.capacidadeDia, totais: resultado.totais, resumo: resultado.resumo, sugestao: resultado.sugestao },
      })
      setCriada({ ...r, titulo: titulo.trim(), responsavel: responsavel.nome, data: dataEscolhida })
      showToast('Tarefa criada no ClickUp')
      carregarHistorico()
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setCriando(false)
    }
  }

  function novaAtividade() {
    setCriada(null)
    setResultado(null)
    setComparacao(null)
    setTitulo(''); setDescricao(''); setTipo(''); setDepartamento('')
    setHoras(''); setHorasTouched(false); setPrioridade('normal')
    setDataDesejada(''); setDataEscolhida(''); setJustificativa('')
    setNaoAntesDe(hojeISO())
  }

  // ── Histórico ──────────────────────────────────────────────────────────────
  const [historico, setHistorico] = useState([])
  const [loadingHist, setLoadingHist] = useState(true)
  const carregarHistorico = useCallback(async () => {
    if (!supabase) { setLoadingHist(false); return }
    const { data, error } = await supabase
      .from('atividades_planejadas')
      .select('id, project_id, titulo, tipo_tarefa, responsavel_profile_id, horas_estimadas, prioridade, data_sugerida, data_escolhida, sobrecarga, clickup_task_url, aviso, created_at, created_by')
      .order('created_at', { ascending: false })
      .limit(60)
    if (error) console.error('[Atividades] histórico:', error.message)
    setHistorico(data || [])
    setLoadingHist(false)
  }, [])
  useEffect(() => { carregarHistorico() }, [carregarHistorico])

  const nomeProjeto = useMemo(() => new Map((projects || []).map((p) => [p.id, p.companyName || p.company_name])), [projects])
  const nomeMembro = useMemo(() => new Map((teamMembers || []).map((m) => [m.id, m.name])), [teamMembers])

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

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 border-b border-rl-border bg-rl-bg/90 backdrop-blur-xl">
          <button onClick={() => setSidebarOpen(true)} aria-label="Abrir menu de navegação" className="p-2 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold text-rl-text text-sm">Atividades</span>
        </div>

        <main className="flex-1 px-6 py-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rl-purple/10 flex items-center justify-center">
                  <CalendarCheck className="w-5 h-5 text-rl-purple" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-rl-text">Atividades</h1>
                  <p className="text-sm text-rl-muted">A data de entrega sai da carga real de quem vai executar, lida do ClickUp</p>
                </div>
              </div>
              {isAdmin && (
                <button onClick={() => setShowConfig(true)} className="btn-secondary flex items-center gap-2 text-sm px-4 py-2">
                  <Settings className="w-4 h-4" /> Capacidade e horas padrão
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
              {/* ── Formulário ─────────────────────────────────────────── */}
              <section className="xl:col-span-2 glass-card p-5 space-y-4 self-start">
                <h2 className="text-sm font-bold text-rl-text flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-rl-purple" /> Nova atividade
                </h2>

                <Field label="Cliente">
                  <select value={projectId} onChange={(e) => { setProjectId(e.target.value); setResultado(null); setComparacao(null); setCriada(null) }} className={selectCls}>
                    <option value="">Selecione o cliente</option>
                    {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                  {clientes.length === 0 && <Hint tone="warn">Nenhum cliente com pasta do ClickUp vinculada.</Hint>}
                </Field>

                {cliente && (
                  <Field label="Lista no ClickUp">
                    {loadingListas ? (
                      <div className="flex items-center gap-2 text-xs text-rl-muted py-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando listas da pasta…</div>
                    ) : listas.length > 0 ? (
                      <select value={listId} onChange={(e) => setListId(e.target.value)} className={selectCls}>
                        {listas.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    ) : (
                      <input value={listId} onChange={(e) => setListId(e.target.value)} placeholder="ID da lista do ClickUp" className={inputCls} />
                    )}
                    {listasErro && <Hint tone="error">{listasErro}</Hint>}
                  </Field>
                )}

                <Field label="Título">
                  <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Criar 3 artes estáticas para a campanha de setembro" className={inputCls} />
                </Field>

                <Field label="Descrição / briefing">
                  <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} placeholder="O que precisa ser feito, referências, onde estão os materiais…" className={`${inputCls} resize-none`} />
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Tipo de tarefa">
                    <select value={tipo} onChange={(e) => handleTipoChange(e.target.value)} className={selectCls}>
                      <option value="">Selecione</option>
                      {TIPOS_TAREFA.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="Departamento">
                    <select value={departamento} onChange={(e) => setDepartamento(e.target.value)} className={selectCls}>
                      <option value="">Selecione</option>
                      {DEPARTAMENTOS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </Field>
                </div>

                <Field label="Responsável" hint={cliente && departamento ? 'sugerido pelo squad do cliente' : null}>
                  <select value={responsavelId} onChange={(e) => { setResponsavelId(e.target.value); setResultado(null); setComparacao(null) }} className={selectCls}>
                    <option value="">Selecione quem executa</option>
                    {responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
                  </select>
                </Field>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Field label="Horas estimadas">
                    <input
                      type="number" min="0.25" step="0.25" inputMode="decimal"
                      value={horas}
                      onChange={(e) => { setHoras(e.target.value); setHorasTouched(true) }}
                      placeholder="ex.: 2"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Prioridade">
                    <select value={prioridade} onChange={(e) => setPrioridade(e.target.value)} className={selectCls}>
                      {PRIORIDADES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Não começar antes de" className="col-span-2 sm:col-span-1">
                    <input type="date" value={naoAntesDe} min={hojeISO()} onChange={(e) => setNaoAntesDe(e.target.value)} className={inputCls} />
                  </Field>
                </div>

                <Field label="Prazo pedido pelo cliente" hint="opcional. Se for antes do que cabe, o sistema mostra a sobrecarga">
                  <input type="date" value={dataDesejada} min={hojeISO()} onChange={(e) => setDataDesejada(e.target.value)} className={inputCls} />
                </Field>

                <button
                  onClick={() => calcular()}
                  disabled={!formOk || calculando}
                  className="btn-primary w-full flex items-center justify-center gap-2 text-sm py-2.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {calculando ? <><Loader2 className="w-4 h-4 animate-spin" /> Lendo a agenda no ClickUp…</> : <><Clock className="w-4 h-4" /> Calcular data de entrega</>}
                </button>
                {!formOk && <p className="text-[11px] text-rl-muted text-center">Preencha cliente, título, responsável e horas para calcular.</p>}
              </section>

              {/* ── Resultado ──────────────────────────────────────────── */}
              <section className="xl:col-span-3 space-y-4">
                {criada ? (
                  <div className="glass-card p-6 border-rl-green/40">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-rl-green shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-bold text-rl-text">Tarefa criada no ClickUp</h3>
                        <p className="text-sm text-rl-muted mt-1">
                          <span className="text-rl-text font-medium">{criada.titulo}</span> · {criada.responsavel} · entrega {fmtLonga(criada.data)}
                        </p>
                        {criada.aviso && <Hint tone="warn">{criada.aviso}</Hint>}
                        <div className="flex flex-wrap gap-2 mt-4">
                          <a href={criada.url} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm px-4 py-2 flex items-center gap-2">
                            Abrir no ClickUp <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <button onClick={novaAtividade} className="btn-secondary text-sm px-4 py-2">Nova atividade</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : !resultado ? (
                  <div className="glass-card p-8 flex flex-col items-center justify-center text-center min-h-[320px]">
                    {calculando ? (
                      <>
                        <Loader2 className="w-8 h-8 text-rl-purple animate-spin mb-3" />
                        <p className="text-sm text-rl-text font-medium">Lendo as tarefas abertas de {primeiroNome(responsavel?.nome)} no ClickUp…</p>
                        <p className="text-xs text-rl-muted mt-1">Isso leva alguns segundos.</p>
                      </>
                    ) : erroCalculo ? (
                      <>
                        <AlertTriangle className="w-8 h-8 text-red-400 mb-3" />
                        <p className="text-sm text-rl-text font-medium">Não deu pra calcular</p>
                        <p className="text-xs text-red-400 mt-1 max-w-md">{erroCalculo}</p>
                      </>
                    ) : (
                      <>
                        <div className="w-14 h-14 rounded-2xl bg-rl-purple/10 flex items-center justify-center mb-3">
                          <CalendarCheck className="w-7 h-7 text-rl-purple" />
                        </div>
                        <p className="text-sm text-rl-text font-medium">A data certa aparece aqui</p>
                        <p className="text-xs text-rl-muted mt-1 max-w-sm">
                          Preencha a atividade e clique em calcular. O sistema soma as horas que o responsável já tem no ClickUp, dia a dia, e encaixa a nova tarefa no primeiro espaço livre.
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    <SugestaoCard
                      resultado={resultado}
                      responsavel={responsavel}
                      horas={horasNum}
                      dataEscolhida={dataEscolhida}
                      setDataEscolhida={setDataEscolhida}
                      forcandoData={forcandoData}
                      forcada={forcada}
                      justificativa={justificativa}
                      setJustificativa={setJustificativa}
                      config={config}
                      mostrarFila={mostrarFila}
                      setMostrarFila={setMostrarFila}
                      onRecalcular={() => calcular()}
                      calculando={calculando}
                    />

                    {/* Alternativas */}
                    <div className="glass-card p-5">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <h3 className="text-sm font-bold text-rl-text flex items-center gap-2"><Users className="w-4 h-4 text-rl-purple" /> Quem entrega antes?</h3>
                          <p className="text-xs text-rl-muted mt-0.5">Compara a mesma tarefa de {fmtHoras(horasNum)} na agenda de todo o time.</p>
                        </div>
                        <button onClick={comparar} disabled={comparando} className="btn-secondary text-sm px-4 py-2 flex items-center gap-2 disabled:opacity-50">
                          {comparando ? <><Loader2 className="w-4 h-4 animate-spin" /> Lendo o time…</> : <><RefreshCw className="w-4 h-4" /> Comparar com o time</>}
                        </button>
                      </div>
                      {comparacao && (
                        <div className="mt-4 divide-y divide-rl-border/60">
                          {comparacao.rows.map((row) => {
                            const s = row.resultado.sugestao
                            const atual = row.pessoa.id === responsavel?.id
                            return (
                              <div key={row.pessoa.id} className="flex items-center gap-3 py-2.5">
                                <div className="w-7 h-7 rounded-full bg-gradient-rl flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                                  {(row.pessoa.avatar || row.pessoa.nome.slice(0, 2)).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-rl-text font-medium truncate">{row.pessoa.nome}{atual && <span className="ml-2 text-[10px] text-rl-purple font-bold uppercase">atual</span>}</p>
                                  <p className="text-[11px] text-rl-muted">{row.resultado.totais.ocupacaoProximosDias}% ocupado nos próximos 10 dias úteis · {row.resultado.totais.consideradas} tarefas na fila</p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className={`text-sm font-bold tabular-nums ${s?.entrega ? 'text-rl-text' : 'text-red-400'}`}>{s?.entrega ? `${DIAS[weekday(s.entrega)]} ${fmtCurta(s.entrega)}` : 'não cabe'}</p>
                                  {!atual && s?.entrega && (
                                    <button onClick={() => escolherAlternativa(row)} className="text-[11px] text-rl-purple hover:underline flex items-center gap-1 ml-auto">
                                      usar <ArrowRight className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                          {comparacao.erros.length > 0 && (
                            <Hint tone="warn">{comparacao.erros.length} pessoa(s) não puderam ser lidas: {comparacao.erros.map((e) => `${responsavelPorClickup.get(e.clickupUserId)?.nome || e.clickupUserId}: ${e.error}`).join('; ')}</Hint>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Aprovação */}
                    <div className="glass-card p-5">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="text-sm text-rl-muted">
                          Ao aprovar, a tarefa entra na lista <span className="text-rl-text font-medium">{listas.find((l) => l.id === listId)?.name || listId}</span> da pasta <span className="text-rl-text font-medium">{cliente?.nome}</span>, atribuída a <span className="text-rl-text font-medium">{responsavel?.nome}</span>, com {fmtHoras(horasNum)} de estimativa e entrega em <span className="text-rl-text font-medium">{dataEscolhida ? fmtLonga(dataEscolhida) : '…'}</span>.
                        </div>
                        <button onClick={aprovar} disabled={!podeCriar} className="btn-primary text-sm px-5 py-2.5 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
                          {criando ? <><Loader2 className="w-4 h-4 animate-spin" /> Criando…</> : <><CheckCircle2 className="w-4 h-4" /> Aprovar e criar no ClickUp</>}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </section>
            </div>

            {/* ── Histórico ────────────────────────────────────────────── */}
            <section className="glass-card p-5">
              <h2 className="text-sm font-bold text-rl-text flex items-center gap-2 mb-3"><History className="w-4 h-4 text-rl-purple" /> Atividades planejadas</h2>
              {loadingHist ? (
                <div className="flex items-center gap-2 text-xs text-rl-muted py-4"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando…</div>
              ) : historico.length === 0 ? (
                <p className="text-xs text-rl-muted py-4">Nenhuma atividade planejada ainda.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-rl-muted text-left">
                        <th className="py-2 pr-3 font-semibold">Criada em</th>
                        <th className="py-2 pr-3 font-semibold">Cliente</th>
                        <th className="py-2 pr-3 font-semibold">Atividade</th>
                        <th className="py-2 pr-3 font-semibold">Responsável</th>
                        <th className="py-2 pr-3 font-semibold text-right">Horas</th>
                        <th className="py-2 pr-3 font-semibold">Sugerida</th>
                        <th className="py-2 pr-3 font-semibold">Entrega</th>
                        <th className="py-2 font-semibold"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rl-border/60">
                      {historico.map((h) => (
                        <tr key={h.id} className="text-rl-text">
                          <td className="py-2 pr-3 text-rl-muted whitespace-nowrap">{new Date(h.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</td>
                          <td className="py-2 pr-3 whitespace-nowrap">{nomeProjeto.get(h.project_id) || '—'}</td>
                          <td className="py-2 pr-3 min-w-[220px]">
                            <span className="font-medium">{h.titulo}</span>
                            {h.tipo_tarefa && <span className="ml-2 text-[11px] text-rl-muted">{h.tipo_tarefa}</span>}
                            {h.aviso && <span className="ml-2 text-[11px] text-rl-gold" title={h.aviso}>aviso</span>}
                          </td>
                          <td className="py-2 pr-3 whitespace-nowrap">{nomeMembro.get(h.responsavel_profile_id) || '—'}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{fmtHoras(h.horas_estimadas)}</td>
                          <td className="py-2 pr-3 text-rl-muted whitespace-nowrap">{h.data_sugerida ? fmtCurta(h.data_sugerida) : '—'}</td>
                          <td className="py-2 pr-3 whitespace-nowrap">
                            <span className={h.sobrecarga ? 'text-red-400 font-semibold' : ''}>{fmtCurta(h.data_escolhida)}</span>
                            {h.sobrecarga && <span className="ml-1 text-[10px] text-red-400 uppercase font-bold">forçada</span>}
                          </td>
                          <td className="py-2 text-right">
                            {h.clickup_task_url && (
                              <a href={h.clickup_task_url} target="_blank" rel="noopener noreferrer" className="text-rl-purple hover:underline inline-flex items-center gap-1 text-xs">ClickUp <ExternalLink className="w-3 h-3" /></a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>

      {showConfig && (
        <ConfigModal
          config={config}
          responsaveis={responsaveis}
          userId={user?.id}
          onClose={() => setShowConfig(false)}
          onSaved={(cfg) => { setConfig(cfg); setShowConfig(false); showToast('Configuração salva') }}
          onError={(m) => showToast(m, 'error')}
        />
      )}

      <Toast toast={toast} />
    </div>
  )
}

// ─── Cartão da sugestão ──────────────────────────────────────────────────────

function SugestaoCard({ resultado, responsavel, horas, dataEscolhida, setDataEscolhida, forcandoData, forcada, justificativa, setJustificativa, config, mostrarFila, setMostrarFila, onRecalcular, calculando }) {
  const s = resultado.sugestao
  const t = resultado.totais
  const cap = resultado.capacidadeDia
  const maxBar = Math.max(cap * 1.5, ...resultado.resumo.map((d) => d.carga + d.alocadoNovaTarefa + (d.excedente || 0)))

  return (
    <div className="glass-card p-5 space-y-5">
      {/* Headline */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] font-semibold text-rl-muted uppercase tracking-wider">Entrega possível sem sobrecarregar {primeiroNome(responsavel?.nome)}</p>
          {s?.cabe ? (
            <>
              <p className="text-2xl font-bold text-rl-text mt-1 capitalize">{fmtLonga(s.entrega)}</p>
              <p className="text-xs text-rl-muted mt-1">
                Começa {s.inicio === resultado.hoje ? 'hoje' : `em ${fmtCurta(s.inicio)}`} · {s.diasUteisAteEntrega} dia(s) útil(eis) · {fmtHoras(horas)} encaixadas em {s.alocacao.length} dia(s)
              </p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-red-400 mt-1">Não cabe nos próximos {config.horizonte_dias_uteis} dias úteis</p>
              <p className="text-xs text-rl-muted mt-1">A agenda de {primeiroNome(responsavel?.nome)} está tomada. Compare com o time ou redistribua tarefas.</p>
            </>
          )}
        </div>
        <button onClick={onRecalcular} disabled={calculando} className="btn-ghost text-xs flex items-center gap-1.5 px-3 py-1.5 disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${calculando ? 'animate-spin' : ''}`} /> Recalcular
        </button>
      </div>

      {/* Números */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Ocupação 10 dias úteis" value={`${t.ocupacaoProximosDias}%`} sub={`${fmtHoras(t.horasProximosDias)} de ${fmtHoras(t.capacidadeProximosDias)}`} tone={t.ocupacaoProximosDias >= 100 ? 'red' : t.ocupacaoProximosDias >= 75 ? 'gold' : 'green'} />
        <Kpi label="Na fila (com data)" value={t.consideradas} sub={`${fmtHoras(t.horasConsideradas)} no total`} />
        <Kpi label="Atrasadas contadas" value={t.atrasadas} sub={`${fmtHoras(t.horasAtrasadas)} caem em hoje`} tone={t.atrasadas > 0 ? 'gold' : undefined} />
        <Kpi label="Fora do cálculo" value={t.zumbis + t.semData} sub={`${t.zumbis} atrasadas há +${config.dias_atraso_maximo}d · ${t.semData} sem data`} tone={t.zumbis > 0 ? 'red' : undefined} />
      </div>

      {/* Gráfico dia a dia */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold text-rl-muted uppercase tracking-wider">Carga por dia útil · capacidade {fmtHoras(cap)}/dia</p>
          <div className="flex items-center gap-3 text-[10px] text-rl-muted">
            <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-rl-cyan/70 inline-block" /> já na agenda</span>
            <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-rl-purple inline-block" /> esta atividade</span>
            <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-red-400/80 inline-block" /> estouro</span>
          </div>
        </div>
        <div className="relative h-36 flex items-end gap-1.5">
          {/* linha da capacidade */}
          <div className="absolute left-0 right-0 border-t border-dashed border-rl-muted/50 pointer-events-none" style={{ bottom: `${(cap / maxBar) * 100}%` }}>
            <span className="absolute right-0 -top-4 text-[10px] text-rl-muted">{fmtHoras(cap)}</span>
          </div>
          {resultado.resumo.map((d) => {
            const forcadoAqui = forcandoData && forcada?.alocacao?.find((a) => a.data === d.data)?.horas
            const novo = forcandoData ? (forcadoAqui || 0) : d.alocadoNovaTarefa
            const excedenteForcado = forcandoData && d.data === dataEscolhida && forcada && !forcada.cabe ? forcada.horasExcedentes : 0
            const excedente = (d.excedente || 0) + excedenteForcado
            const hCarga = (d.carga / maxBar) * 100
            const hNovo = (novo / maxBar) * 100
            const hExc = (excedente / maxBar) * 100
            const hojeCol = d.data === resultado.hoje
            const entregaCol = d.data === (forcandoData ? dataEscolhida : s?.entrega)
            return (
              <div key={d.data} className="flex-1 flex flex-col items-center justify-end h-full min-w-0" title={`${DIAS[d.diaSemana]} ${fmtCurta(d.data)}: ${fmtHoras(d.carga)} na agenda${novo ? ` + ${fmtHoras(novo)} desta atividade` : ''}${excedente ? ` + ${fmtHoras(excedente)} de estouro` : ''} · ${d.tarefas} tarefa(s)`}>
                <div className="w-full flex flex-col-reverse rounded-t-md overflow-hidden" style={{ height: `${Math.min(100, hCarga + hNovo + hExc)}%` }}>
                  {hCarga > 0 && <div className="w-full bg-rl-cyan/70" style={{ flexBasis: `${(hCarga / (hCarga + hNovo + hExc)) * 100}%` }} />}
                  {hNovo > 0 && <div className="w-full bg-rl-purple" style={{ flexBasis: `${(hNovo / (hCarga + hNovo + hExc)) * 100}%` }} />}
                  {hExc > 0 && <div className="w-full bg-red-400/80" style={{ flexBasis: `${(hExc / (hCarga + hNovo + hExc)) * 100}%` }} />}
                </div>
                <p className={`text-[10px] mt-1.5 leading-tight text-center ${entregaCol ? 'text-rl-purple font-bold' : hojeCol ? 'text-rl-text font-semibold' : 'text-rl-muted'}`}>
                  {DIAS[d.diaSemana]}<br />{fmtCurta(d.data)}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Fila */}
      <div>
        <button onClick={() => setMostrarFila((v) => !v)} className="text-xs text-rl-muted hover:text-rl-text flex items-center gap-1">
          {mostrarFila ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          O que {primeiroNome(responsavel?.nome)} já tem nos próximos 10 dias úteis ({resultado.filaProxima.length})
        </button>
        {mostrarFila && (
          <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-rl-border divide-y divide-rl-border/60">
            {resultado.filaProxima.length === 0 && <p className="text-xs text-rl-muted p-3">Nada com data nos próximos dias.</p>}
            {resultado.filaProxima.map((tk) => (
              <div key={tk.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                <span className={`w-12 shrink-0 tabular-nums ${tk.atrasada ? 'text-red-400 font-semibold' : 'text-rl-muted'}`}>{fmtCurta(tk.dia)}</span>
                <a href={tk.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 truncate text-rl-text hover:text-rl-purple" title={`${tk.pasta || ''} › ${tk.lista || ''}`}>{tk.nome}</a>
                {tk.atrasada && <span className="text-[10px] text-red-400 uppercase font-bold shrink-0">atrasada</span>}
                <span className="w-14 text-right shrink-0 text-rl-text tabular-nums" title={`origem: ${tk.origem}`}>{fmtHoras(tk.horas)}<span className="text-rl-muted">{tk.origem === 'estimativa' ? '' : '*'}</span></span>
              </div>
            ))}
            <p className="text-[10px] text-rl-muted px-3 py-2">* horas estimadas pelo tipo/dificuldade (a tarefa não tem estimativa preenchida no ClickUp)</p>
          </div>
        )}
      </div>

      {/* Data escolhida */}
      <div className="border-t border-rl-border/60 pt-4">
        <div className="flex items-end gap-3 flex-wrap">
          <Field label="Data de entrega que vai pro ClickUp" className="w-56">
            <input type="date" value={dataEscolhida} min={resultado.hoje} onChange={(e) => setDataEscolhida(e.target.value)} className={inputCls} />
          </Field>
          {s?.entrega && dataEscolhida !== s.entrega && (
            <button onClick={() => setDataEscolhida(s.entrega)} className="btn-ghost text-xs px-3 py-2">Voltar pra sugerida ({fmtCurta(s.entrega)})</button>
          )}
        </div>
        {forcandoData && (
          <div className={`mt-3 rounded-lg border p-3 text-xs ${forcada && !forcada.cabe ? 'border-red-400/40 bg-red-400/5' : 'border-rl-gold/40 bg-rl-gold/5'}`}>
            {!forcada ? (
              <p className="text-rl-muted flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Avaliando a data…</p>
            ) : forcada.cabe ? (
              <p className="text-rl-gold flex items-start gap-2"><Info className="w-4 h-4 shrink-0" /> Cabe até {fmtCurta(dataEscolhida)} sem estourar, mas usando toda a folga desses dias. Qualquer imprevisto atrasa.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-red-400 flex items-start gap-2 font-medium">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Entregar em {fmtCurta(dataEscolhida)} estoura {fmtHoras(forcada.horasExcedentes)} da capacidade de {primeiroNome(responsavel?.nome)}: o dia fica com {fmtHoras(forcada.cargaNoDia)} para {fmtHoras(cap)} disponíveis. Ou alguém faz hora extra, ou outra tarefa atrasa.
                </p>
                <textarea
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  rows={2}
                  placeholder="Justifique a data forçada (obrigatório): o que vai ser despriorizado ou por que não dá pra esperar"
                  className={`${inputCls} resize-none`}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Modal de configuração (admin) ───────────────────────────────────────────

function ConfigModal({ config, responsaveis, userId, onClose, onSaved, onError }) {
  const [capPadrao, setCapPadrao] = useState(String(config.capacidade_padrao_horas_dia))
  const [capPessoa, setCapPessoa] = useState(() => ({ ...(config.capacidade_por_pessoa || {}) }))
  const [diasAtraso, setDiasAtraso] = useState(String(config.dias_atraso_maximo))
  const [padraoSem, setPadraoSem] = useState(String(config.horas_padrao_sem_estimativa))
  const [backlog, setBacklog] = useState(!!config.considerar_backlog)
  const [semData, setSemData] = useState(!!config.considerar_sem_data)
  const [horasTipo, setHorasTipo] = useState(() => ({ ...(config.horas_por_tipo || {}) }))
  const [saving, setSaving] = useState(false)

  async function salvar() {
    setSaving(true)
    const cfg = {
      ...config,
      capacidade_padrao_horas_dia: Number(capPadrao) || config.capacidade_padrao_horas_dia,
      capacidade_por_pessoa: Object.fromEntries(Object.entries(capPessoa).filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Number(v)])),
      dias_atraso_maximo: Number(diasAtraso) >= 0 ? Number(diasAtraso) : config.dias_atraso_maximo,
      horas_padrao_sem_estimativa: Number(padraoSem) > 0 ? Number(padraoSem) : config.horas_padrao_sem_estimativa,
      considerar_backlog: backlog,
      considerar_sem_data: semData,
      horas_por_tipo: Object.fromEntries(Object.entries(horasTipo).map(([k, v]) => [k, Number(v) > 0 ? Number(v) : config.horas_por_tipo?.[k] || 1])),
    }
    const { error } = await supabase
      .from('atividades_config')
      .upsert({ id: 'global', config: cfg, updated_at: new Date().toISOString(), updated_by: userId || null })
    setSaving(false)
    if (error) return onError(error.message)
    onSaved(cfg)
  }

  return (
    <Modal onClose={onClose} maxWidth="2xl" className="max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-rl-text">Capacidade e horas padrão</h2>
        <button onClick={onClose} className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition"><X className="w-4 h-4" /></button>
      </div>
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Horas produtivas por dia" hint="padrão pra quem não tem valor próprio">
            <input type="number" min="1" max="12" step="0.5" value={capPadrao} onChange={(e) => setCapPadrao(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Ignorar atrasadas há mais de (dias)" hint="viram alerta, não bloqueiam">
            <input type="number" min="0" step="1" value={diasAtraso} onChange={(e) => setDiasAtraso(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Horas de tarefa sem estimativa" hint="sem tipo nem dificuldade">
            <input type="number" min="0.25" step="0.25" value={padraoSem} onChange={(e) => setPadraoSem(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-rl-text">
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={backlog} onChange={(e) => setBacklog(e.target.checked)} className="w-4 h-4 accent-rl-purple" /> Tarefas em backlog (com data) contam na agenda</label>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={semData} onChange={(e) => setSemData(e.target.checked)} className="w-4 h-4 accent-rl-purple" /> Tarefas sem data contam em hoje</label>
        </div>

        <div>
          <p className="text-xs font-semibold text-rl-muted uppercase tracking-wider mb-2">Capacidade por pessoa (h/dia)</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {responsaveis.map((r) => (
              <label key={r.id} className="flex items-center gap-2 text-xs text-rl-text">
                <span className="flex-1 truncate">{r.nome}</span>
                <input type="number" min="0" max="12" step="0.5" placeholder={capPadrao} value={capPessoa[r.clickupId] ?? ''} onChange={(e) => setCapPessoa((p) => ({ ...p, [r.clickupId]: e.target.value }))} className={`${inputCls} w-20 px-2 py-1.5`} />
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-rl-muted uppercase tracking-wider mb-2">Horas por tipo de tarefa (quando a task do ClickUp não tem estimativa)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {TIPOS_TAREFA.map((t) => (
              <label key={t} className="flex items-center gap-2 text-xs text-rl-text">
                <span className="flex-1 truncate">{t}</span>
                <input type="number" min="0.25" step="0.25" value={horasTipo[t] ?? ''} onChange={(e) => setHorasTipo((p) => ({ ...p, [t]: e.target.value }))} className={`${inputCls} w-20 px-2 py-1.5`} />
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary text-sm px-4 py-2">Cancelar</button>
          <button onClick={salvar} disabled={saving} className="btn-primary text-sm px-4 py-2 flex items-center gap-2 disabled:opacity-50">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando…</> : 'Salvar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Primitivos ──────────────────────────────────────────────────────────────

const inputCls = 'w-full bg-rl-surface border border-rl-border rounded-lg px-3 py-2 text-sm text-rl-text placeholder:text-rl-muted focus:outline-none focus:border-rl-purple'
const selectCls = inputCls

function Field({ label, hint, className = '', children }) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-rl-muted mb-1.5 uppercase tracking-wider">
        {label}{hint && <span className="ml-1.5 normal-case font-normal text-rl-muted/70">· {hint}</span>}
      </label>
      {children}
    </div>
  )
}

function Hint({ tone = 'info', children }) {
  const cls = tone === 'error' ? 'text-red-400' : tone === 'warn' ? 'text-rl-gold' : 'text-rl-muted'
  return <p className={`text-[11px] mt-1.5 ${cls}`}>{children}</p>
}

function Kpi({ label, value, sub, tone }) {
  const color = tone === 'red' ? 'text-red-400' : tone === 'gold' ? 'text-rl-gold' : tone === 'green' ? 'text-rl-green' : 'text-rl-text'
  return (
    <div className="rounded-lg border border-rl-border bg-rl-surface/50 p-3">
      <p className="text-[10px] font-semibold text-rl-muted uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-bold mt-0.5 tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-rl-muted mt-0.5">{sub}</p>}
    </div>
  )
}
