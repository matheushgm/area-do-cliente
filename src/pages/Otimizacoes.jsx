// Central de Otimizações (/otimizacoes): as sugestões do playbook de TODOS os
// clientes, agrupadas por cliente, com o porquê, o caminho até a entidade
// (Campanha → Conjunto → Anúncio) e aceitar / recusar. A decisão fica em
// `projeto_sugestoes` e alimenta a fila que a automação vai executar no
// Meta/Google (execucao_status = 'pendente').
import { useState, useMemo } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import {
  Menu, Sparkles, Check, X, ChevronDown, ChevronRight, ExternalLink, Loader2, RefreshCw,
  AlertTriangle, RotateCcw, Search, Wrench, History, Inbox, Bot, Clock, CheckCircle2, XCircle,
} from 'lucide-react'
import { useDashboardData } from '../hooks/useDashboardData'
import { useSugestoesGlobais } from '../hooks/useSugestoesGlobais'
import { PRIORIDADE_LABEL, PRIORIDADE_ORDEM } from '../lib/playbookSugestoes'
import { Caminho } from '../components/ProjetoHub/SugestoesPlaybook'
import { fmtBR, maxDate } from '../lib/dashboardData'
import { cliente } from '../routes/paths'
import Toast from '../components/UI/Toast'
import { useToast } from '../hooks/useToast'

const PRI_CLS = {
  urgente: 'bg-rl-red/10 text-rl-red border-rl-red/30',
  alta: 'bg-rl-gold/10 text-rl-gold border-rl-gold/30',
  media: 'fx-soft border-transparent',
}
const CANAL_LABEL = { meta: 'Meta Ads', google: 'Google Ads' }
const STATUS_CLS = {
  aceita: 'bg-rl-green/10 text-rl-green border-rl-green/30',
  recusada: 'bg-rl-red/10 text-rl-red border-rl-red/30',
  descartada: 'bg-rl-surface text-rl-muted border-rl-border',
}
const STATUS_LABEL = { aceita: 'Aceita', recusada: 'Recusada', descartada: 'Adiada' }
const EXEC_LABEL = { pendente: 'Na fila da automação', executada: 'Executada', erro: 'Erro na execução', cancelada: 'Cancelada' }
const EXEC_CLS = {
  pendente: 'text-rl-purple', executada: 'text-rl-green', erro: 'text-rl-red', cancelada: 'text-rl-muted',
}

function fmtDataHora(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// ── Cartão de uma sugestão ────────────────────────────────────────────────────
function Sugestao({ s, onAceitar, onRecusar }) {
  const [aberta, setAberta] = useState(false)
  const [recusando, setRecusando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(null) // 'aceita' | 'recusada'

  async function aceitar() {
    setSalvando('aceita')
    try { await onAceitar(s) } finally { setSalvando(null) }
  }
  async function recusar() {
    if (!motivo.trim()) return
    setSalvando('recusada')
    try { await onRecusar(s, motivo.trim()) } finally { setSalvando(null) }
  }

  return (
    <div className="glass-card border border-rl-border/60 p-4">
      <div className="flex items-start gap-3">
        <button onClick={() => setAberta((v) => !v)} className="mt-0.5 p-0.5 rounded text-rl-muted hover:text-rl-text" aria-label="Detalhes">
          {aberta ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${PRI_CLS[s.prioridade]}`}>{PRIORIDADE_LABEL[s.prioridade]}</span>
            <span className="text-[11px] text-rl-muted">{CANAL_LABEL[s.canal] || s.canal}</span>
            {s.conta && <span className="text-[11px] text-rl-muted">· {s.conta}</span>}
            <span className="text-[11px] text-rl-muted">· {s.tipo}</span>
          </div>
          <p className="text-sm font-semibold text-rl-text leading-snug break-words">{s.titulo}</p>
          {s.acao && (
            <p className="text-xs text-rl-text mt-1.5 flex items-start gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-rl-purple shrink-0 mt-px" />
              <span><span className="font-semibold">Otimização:</span> {s.acao}</span>
            </p>
          )}
          <Caminho caminho={s.caminho} />
          <p className="text-xs text-rl-subtle mt-1.5"><span className="font-semibold text-rl-text">Por quê:</span> {s.contexto}</p>
          {s.evidencias?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {s.evidencias.map((e) => (
                <span key={e.label} className="text-[11px] px-2 py-0.5 rounded-md bg-rl-surface border border-rl-border text-rl-subtle">
                  {e.label}: <span className="text-rl-text font-medium">{e.valor}</span>
                </span>
              ))}
            </div>
          )}
          {aberta && (
            <div className="mt-3 text-xs text-rl-subtle space-y-2">
              {s.passos?.length > 0 && (
                <ol className="list-decimal pl-4 space-y-0.5">
                  {s.passos.map((p, i) => <li key={i}>{p}</li>)}
                </ol>
              )}
              <p className="italic text-rl-muted">Regra do playbook: {s.regra}</p>
            </div>
          )}
          {recusando && (
            <div className="mt-3 p-3 rounded-lg bg-rl-red/5 border border-rl-red/20">
              <label className="text-[11px] font-semibold text-rl-text block mb-1">Por que recusar? (fica no histórico)</label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={2}
                autoFocus
                placeholder="Ex.: o anúncio é o único priorizado do conjunto, vamos subir substituto antes"
                className="input-field w-full text-xs resize-y"
              />
              <div className="flex items-center gap-2 mt-2">
                <button onClick={recusar} disabled={!motivo.trim() || salvando} className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-rl-red/10 text-rl-red border border-rl-red/30 hover:bg-rl-red/20 disabled:opacity-50">
                  {salvando === 'recusada' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />} Confirmar recusa
                </button>
                <button onClick={() => { setRecusando(false); setMotivo('') }} className="text-xs text-rl-muted hover:text-rl-text px-2 py-1.5">Cancelar</button>
              </div>
            </div>
          )}
        </div>
        {!recusando && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={aceitar} disabled={salvando} className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-rl-green/10 text-rl-green border border-rl-green/30 hover:bg-rl-green/20 disabled:opacity-50" title="Aceitar: entra na fila da automação">
              {salvando === 'aceita' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Aceitar
            </button>
            <button onClick={() => setRecusando(true)} disabled={salvando} className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg text-rl-muted border border-rl-border hover:text-rl-red hover:border-rl-red/30 hover:bg-rl-red/10 disabled:opacity-50" title="Recusar com motivo">
              <X className="w-3.5 h-3.5" /> Recusar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Grupo por cliente ─────────────────────────────────────────────────────────
function GrupoCliente({ g, onAceitar, onRecusar, onAbrir }) {
  const [aberto, setAberto] = useState(true)
  const urg = g.sugestoes.filter((s) => s.prioridade === 'urgente').length
  const alta = g.sugestoes.filter((s) => s.prioridade === 'alta').length
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-3 px-1">
        <button onClick={() => setAberto((v) => !v)} className="flex items-center gap-2 min-w-0 text-left group">
          {aberto ? <ChevronDown className="w-4 h-4 text-rl-muted" /> : <ChevronRight className="w-4 h-4 text-rl-muted" />}
          <h2 className="text-base font-bold text-rl-text truncate group-hover:text-rl-purple">{g.nome}</h2>
        </button>
        {g.responsavel && <span className="text-xs text-rl-muted hidden sm:inline">· {g.responsavel}</span>}
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-rl-surface border border-rl-border text-rl-subtle">{g.sugestoes.length} sugest{g.sugestoes.length > 1 ? 'ões' : 'ão'}</span>
        {urg > 0 && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border bg-rl-red/10 text-rl-red border-rl-red/30">{urg} urgente{urg > 1 ? 's' : ''}</span>}
        {alta > 0 && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border bg-rl-gold/10 text-rl-gold border-rl-gold/30">{alta} alta{alta > 1 ? 's' : ''}</span>}
        <button onClick={() => onAbrir(g.projectId)} className="ml-auto flex items-center gap-1 text-xs text-rl-purple hover:underline shrink-0">
          abrir cliente <ExternalLink className="w-3 h-3" />
        </button>
      </div>
      {aberto && <div className="space-y-2">{g.sugestoes.map((s) => <Sugestao key={s.chave} s={s} onAceitar={onAceitar} onRecusar={onRecusar} />)}</div>}
    </section>
  )
}

// ── Histórico de decisões ─────────────────────────────────────────────────────
function Historico({ itens, onReabrir, onAbrir }) {
  if (!itens.length) return <p className="text-sm text-rl-subtle text-center py-10">Nenhuma decisão registrada ainda.</p>
  return (
    <div className="space-y-2">
      {itens.map((d) => {
        const cam = d.payload?.caminho || {}
        const niveis = [['Campanha', d.campanha || cam.campanha], ['Conjunto', d.conjunto || cam.conjunto], ['Anúncio', d.anuncio || cam.anuncio]].filter(([, v]) => v)
        return (
          <div key={d.id} className="glass-card border border-rl-border/60 p-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_CLS[d.status] || STATUS_CLS.descartada}`}>{STATUS_LABEL[d.status] || d.status}</span>
                  <button onClick={() => onAbrir(d.project_id)} className="text-xs font-semibold text-rl-text hover:text-rl-purple truncate">{d.nomeCliente}</button>
                  {d.canal && <span className="text-[11px] text-rl-muted">· {CANAL_LABEL[d.canal] || d.canal}</span>}
                  <span className="text-[11px] text-rl-muted flex items-center gap-1"><Clock className="w-3 h-3" /> {fmtDataHora(d.decidida_em || d.created_at)}{d.decidida_por ? ` · ${d.decidida_por}` : ''}</span>
                </div>
                <p className="text-sm text-rl-text break-words">{d.titulo || d.chave}</p>
                {(d.acao || d.payload?.acao) && <p className="text-xs text-rl-subtle mt-0.5"><span className="font-semibold text-rl-text">Otimização:</span> {d.acao || d.payload?.acao}</p>}
                {niveis.length > 0 && (
                  <p className="text-[11px] text-rl-muted mt-1 break-words">
                    {niveis.map(([l, v], i) => <span key={l}>{i > 0 ? ' › ' : ''}<span className="text-rl-subtle">{l}:</span> {v}</span>)}
                    {(d.ad_id || cam.adId) && <span className="font-mono"> (ID {d.ad_id || cam.adId})</span>}
                  </p>
                )}
                {d.motivo && <p className="text-xs text-rl-subtle mt-1"><span className="font-semibold text-rl-text">Motivo:</span> {d.motivo}</p>}
                {d.status === 'aceita' && (
                  <p className={`text-[11px] mt-1 flex items-center gap-1 ${EXEC_CLS[d.execucao_status] || 'text-rl-muted'}`}>
                    {d.execucao_status === 'executada' ? <CheckCircle2 className="w-3 h-3" /> : d.execucao_status === 'erro' ? <XCircle className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                    {d.execucao_status ? EXEC_LABEL[d.execucao_status] : 'Virou tarefa no ClickUp'}
                    {d.executada_em ? ` · ${fmtDataHora(d.executada_em)}` : ''}
                    {d.clickup_task_url && <a href={d.clickup_task_url} target="_blank" rel="noreferrer" className="text-rl-purple inline-flex items-center gap-0.5 ml-1">tarefa <ExternalLink className="w-3 h-3" /></a>}
                  </p>
                )}
              </div>
              {d.execucao_status !== 'executada' && (
                <button onClick={() => onReabrir(d)} className="text-xs text-rl-muted hover:text-rl-text flex items-center gap-1 shrink-0" title="Apagar a decisão e voltar a sugerir">
                  <RotateCcw className="w-3 h-3" /> reabrir
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function Otimizacoes() {
  const { openSidebar } = useOutletContext()
  const navigate = useNavigate()
  const { toast, showToast } = useToast()
  // 20 dias: o motor usa 7 + 7 anteriores (igual à home, que já carrega isso)
  const dash = useDashboardData({ source: 'api', dias: 20 })
  const sg = useSugestoesGlobais(dash)
  const [tab, setTab] = useState('pendentes')
  const [busca, setBusca] = useState('')
  const [prioridade, setPrioridade] = useState('todas')
  const [canal, setCanal] = useState('todos')

  const ultimoDia = useMemo(() => {
    const a = maxDate(dash.raw?.meta || [], 'Dia'), b = maxDate(dash.raw?.google || [], 'Data')
    return [a, b].filter(Boolean).sort().pop() || null
  }, [dash.raw])

  const grupos = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return sg.grupos
      .filter((g) => !q || g.nome.toLowerCase().includes(q) || (g.responsavel || '').toLowerCase().includes(q))
      .map((g) => ({
        ...g,
        sugestoes: g.sugestoes.filter((s) =>
          (prioridade === 'todas' || PRIORIDADE_ORDEM[s.prioridade] <= PRIORIDADE_ORDEM[prioridade]) &&
          (canal === 'todos' || s.canal === canal)),
      }))
      .filter((g) => g.sugestoes.length > 0)
  }, [sg.grupos, busca, prioridade, canal])

  const totalFiltrado = grupos.reduce((a, g) => a + g.sugestoes.length, 0)
  const naFila = sg.historico.filter((d) => d.execucao_status === 'pendente').length

  async function aceitar(s) {
    try { await sg.decidir(s, 'aceita'); showToast('Aceita. Entrou na fila da automação.') }
    catch (e) { showToast(e.message, 'error') }
  }
  async function recusar(s, motivo) {
    try { await sg.decidir(s, 'recusada', { motivo }); showToast('Recusada e registrada no histórico.') }
    catch (e) { showToast(e.message, 'error') }
  }
  async function reabrir(d) {
    try { await sg.reabrir(d); showToast('Decisão apagada. A sugestão volta a aparecer se a regra ainda valer.') }
    catch (e) { showToast(e.message, 'error') }
  }
  const abrir = (id) => navigate(cliente(id))

  const SELECT = 'input-field text-sm py-2 pr-8'

  return (
    <div className="fx flex-1 min-w-0 flex flex-col">
      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 border-b border-rl-border bg-rl-bg/90 backdrop-blur-xl">
        <button onClick={openSidebar} aria-label="Abrir menu de navegação" className="p-2 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all"><Menu className="w-5 h-5" /></button>
        <span className="font-bold text-rl-text text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-rl-purple" /> Otimizações</span>
      </div>

      <main className="flex-1 px-4 sm:px-6 py-6">
        <div className="w-full min-w-0 max-w-5xl mx-auto space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-rl-text flex items-center gap-2"><Sparkles className="w-6 h-6 text-rl-purple" /> Otimizações do dia</h1>
              <p className="text-sm text-rl-subtle mt-1">
                Sugestões do playbook de todos os clientes, calculadas sobre os últimos 7 dias do dashboard
                {ultimoDia ? ` (até ${fmtBR(ultimoDia)})` : ''} contra os 7 anteriores. Aceitar coloca a otimização na fila da automação; recusar registra o motivo.
              </p>
            </div>
            <button onClick={() => { dash.reload(); sg.recarregarDecisoes() }} className="btn-secondary text-xs flex items-center gap-1.5 !px-3 !py-2 shrink-0" title="Recarregar">
              <RefreshCw className={`w-3.5 h-3.5 ${sg.loading ? 'animate-spin' : ''}`} /> Recarregar
            </button>
          </div>

          {/* Resumo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ['Pendentes', sg.pendentes.length, Inbox, 'text-rl-purple'],
              ['Clientes com sugestão', sg.grupos.length, Sparkles, 'text-rl-gold'],
              ['Na fila da automação', naFila, Bot, 'text-rl-green'],
              ['Clientes analisados', sg.clientesComDados, Search, 'text-rl-muted'],
            ].map(([label, n, Icon, cls]) => (
              <div key={label} className="glass-card border border-rl-border/60 p-3 flex items-center gap-3">
                <span className="w-8 h-8 rounded-full fx-soft flex items-center justify-center shrink-0"><Icon className={`w-4 h-4 ${cls}`} /></span>
                <div className="min-w-0">
                  <p className="text-xl font-bold text-rl-text leading-tight tabular-nums">{sg.loading && n === 0 ? '…' : n}</p>
                  <p className="text-[11px] text-rl-muted truncate">{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Abas + filtros */}
          <div className="glass-card border border-rl-border/60 p-2 flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex items-center gap-1">
              {[['pendentes', 'Pendentes', Inbox, sg.pendentes.length], ['historico', 'Histórico', History, sg.historico.length]].map(([id, label, Icon, n]) => (
                <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors ${tab === id ? 'bg-rl-purple text-white font-semibold' : 'text-rl-subtle hover:text-rl-text hover:bg-rl-surface'}`}>
                  <Icon className="w-4 h-4" /> {label}
                  <span className={`text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center ${tab === id ? 'bg-white/20 text-white' : 'bg-rl-surface text-rl-muted'}`}>{n}</span>
                </button>
              ))}
            </div>
            {tab === 'pendentes' && (
              <div className="flex items-center gap-2 sm:ml-auto flex-wrap">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-rl-muted pointer-events-none" />
                  <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Cliente ou responsável" className="input-field text-sm py-2 pl-8 w-full sm:w-56" />
                </div>
                <select value={prioridade} onChange={(e) => setPrioridade(e.target.value)} className={SELECT}>
                  <option value="todas">Todas as prioridades</option>
                  <option value="urgente">Só urgentes</option>
                  <option value="alta">Urgentes e altas</option>
                </select>
                <select value={canal} onChange={(e) => setCanal(e.target.value)} className={SELECT}>
                  <option value="todos">Meta e Google</option>
                  <option value="meta">Só Meta Ads</option>
                  <option value="google">Só Google Ads</option>
                </select>
              </div>
            )}
          </div>

          {sg.erro && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rl-red/10 border border-rl-red/30 text-xs text-rl-text"><AlertTriangle className="w-4 h-4 text-rl-red shrink-0" /> {String(sg.erro)}</div>
          )}

          {tab === 'pendentes' ? (
            sg.loading && sg.pendentes.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-rl-muted py-16 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Lendo o dashboard de todas as contas…</div>
            ) : grupos.length === 0 ? (
              <div className="text-center py-16">
                <CheckCircle2 className="w-8 h-8 text-rl-green mx-auto mb-2" />
                <p className="text-sm text-rl-text font-semibold">{totalFiltrado === 0 && sg.pendentes.length > 0 ? 'Nenhuma sugestão com esses filtros.' : 'Nenhuma otimização pendente.'}</p>
                <p className="text-xs text-rl-muted mt-1">{sg.pendentes.length > 0 ? 'Limpe os filtros pra ver as outras.' : 'Todas as contas estão dentro das regras do playbook ou já foram decididas.'}</p>
              </div>
            ) : (
              <div className="space-y-6">
                {grupos.map((g) => <GrupoCliente key={g.projectId} g={g} onAceitar={aceitar} onRecusar={recusar} onAbrir={abrir} />)}
              </div>
            )
          ) : (
            <Historico itens={sg.historico} onReabrir={reabrir} onAbrir={abrir} />
          )}
        </div>
      </main>
      <Toast toast={toast} />
    </div>
  )
}
