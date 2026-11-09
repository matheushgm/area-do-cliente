// Central de Otimizações (/otimizacoes): as sugestões do playbook de TODOS os
// clientes, agrupadas por cliente, com o porquê, o caminho até a entidade
// (Campanha → Conjunto → Anúncio) e aceitar / recusar. A decisão fica em
// `projeto_sugestoes` e alimenta a fila que a automação vai executar no
// Meta/Google (execucao_status = 'pendente').
import { useState, useMemo } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import {
  Menu, Sparkles, Check, X, ChevronDown, ChevronRight, ExternalLink, Loader2, RefreshCw,
  AlertTriangle, RotateCcw, Search, History, Inbox, Bot, Clock, CheckCircle2, XCircle,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { useDashboardData } from '../hooks/useDashboardData'
import { useSugestoesGlobais } from '../hooks/useSugestoesGlobais'
import { PRIORIDADE_ORDEM, janelaAnalise, tituloConta, tituloSemConta, tituloLocal, rotuloPrioridade, rotuloTipo } from '../lib/playbookSugestoes'
import { Caminho } from '../components/ProjetoHub/SugestoesPlaybook'
import { aceitarComTarefa, criarTarefaDaSugestao } from '../lib/aceitarSugestao'
import { useI18n } from '../i18n'
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
// Rótulos em otimizacoes.status.* (o valor gravado continua aceita/recusada/descartada)
const STATUSES = ['aceita', 'recusada', 'descartada']
// bloqueada/manual: migration 098 (reconciliar_fila_otimizacoes). Bloqueada = o
// anúncio voltou a converter depois da decisão e o robô não executa; manual = ação
// que o robô não sabe fazer (criativo, investigação, Google), fica com a tarefa.
// Rótulos em otimizacoes.execucao.<status>
const EXEC_STATUS = ['pendente', 'executada', 'erro', 'cancelada', 'bloqueada', 'manual']
const EXEC_CLS = {
  pendente: 'text-rl-purple', executada: 'text-rl-green', erro: 'text-rl-red', cancelada: 'text-rl-muted',
  bloqueada: 'text-rl-gold', manual: 'text-rl-muted',
}

function fmtDataHora(iso, locale) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
}

// yyyy-mm-dd → dd/mm (pt) ou mm/dd (en)
function fmtDia(iso, lang) {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  return lang === 'en' ? `${m}/${d}` : `${d}/${m}`
}
// yyyy-mm-dd → dd/mm/aaaa (pt) ou mm/dd/yyyy (en)
function fmtDataCompleta(iso, lang) {
  const [a, m, d] = iso.split('-')
  return lang === 'en' ? `${m}/${d}/${a}` : `${d}/${m}/${a}`
}

// ── Cartão de uma sugestão ────────────────────────────────────────────────────
function Sugestao({ s, onAceitar, onRecusar }) {
  const { t } = useI18n()
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

  const botoes = (
    <>
      <button onClick={aceitar} disabled={salvando} className="flex items-center justify-center gap-1 text-xs font-semibold px-2.5 py-2 sm:py-1.5 rounded-lg bg-rl-green/10 text-rl-green border border-rl-green/30 hover:bg-rl-green/20 disabled:opacity-50" title={t('otimizacoes.cartao.aceitarTitle')}>
        {salvando === 'aceita' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} {t('otimizacoes.cartao.aceitar')}
      </button>
      <button onClick={() => setRecusando(true)} disabled={salvando} className="flex items-center justify-center gap-1 text-xs font-semibold px-2.5 py-2 sm:py-1.5 rounded-lg text-rl-muted border border-rl-border hover:text-rl-red hover:border-rl-red/30 hover:bg-rl-red/10 disabled:opacity-50" title={t('otimizacoes.cartao.recusarTitle')}>
        <X className="w-3.5 h-3.5" /> {t('otimizacoes.cartao.recusar')}
      </button>
    </>
  )

  return (
    <div className="glass-card border border-rl-border/60 p-3 sm:p-4">
      <div className="flex items-start gap-2 sm:gap-3">
        <button onClick={() => setAberta((v) => !v)} className="mt-0.5 p-0.5 rounded text-rl-muted hover:text-rl-text hidden sm:block" aria-label={t('otimizacoes.cartao.detalhes')}>
          {aberta ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-x-2 gap-y-1 flex-wrap mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${PRI_CLS[s.prioridade]}`}>{rotuloPrioridade(s.prioridade)}</span>
            <span className="text-[11px] text-rl-muted">{CANAL_LABEL[s.canal] || s.canal}</span>
            {s.conta && <span className="text-[11px] text-rl-muted truncate max-w-[45vw] sm:max-w-none">· {s.conta}</span>}
            <span className="text-[11px] text-rl-muted hidden sm:inline">· {rotuloTipo(s.tipo)}</span>
          </div>
          <dl className="text-sm text-rl-text leading-snug space-y-0.5 [overflow-wrap:anywhere]">
            <div><dt className="inline font-semibold">{t('sugestoes.conta')} </dt><dd className="inline">{tituloConta(s)}</dd></div>
            <div><dt className="inline font-semibold">{t('sugestoes.oQueFazer')} </dt><dd className="inline">{s.acao || tituloSemConta(s)}</dd></div>
            {tituloLocal(s) && <div><dt className="inline font-semibold">{t('sugestoes.local')} </dt><dd className="inline">{tituloLocal(s)}</dd></div>}
          </dl>
          <Caminho caminho={s.caminho} />
          <p className="text-xs text-rl-subtle mt-1.5 [overflow-wrap:anywhere]"><span className="font-semibold text-rl-text">{t('otimizacoes.cartao.porque')}</span> {s.contexto}</p>
          {s.evidencias?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {s.evidencias.map((e) => (
                <span key={e.label} className="text-[11px] px-2 py-0.5 rounded-md bg-rl-surface border border-rl-border text-rl-subtle max-w-full [overflow-wrap:anywhere]">
                  {e.label}: <span className="text-rl-text font-medium">{e.valor}</span>
                </span>
              ))}
            </div>
          )}
          <button onClick={() => setAberta((v) => !v)} className="sm:hidden mt-2 text-[11px] text-rl-purple flex items-center gap-1">
            {aberta ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />} {aberta ? t('otimizacoes.cartao.esconderPassos') : t('otimizacoes.cartao.verPassos')}
          </button>
          {aberta && (
            <div className="mt-3 text-xs text-rl-subtle space-y-2">
              {s.passos?.length > 0 && (
                <ol className="list-decimal pl-4 space-y-0.5">
                  {s.passos.map((p, i) => <li key={i}>{p}</li>)}
                </ol>
              )}
              <p className="italic text-rl-muted">{t('sugestoes.regra', { regra: s.regra })}</p>
            </div>
          )}
          {recusando && (
            <div className="mt-3 p-3 rounded-lg bg-rl-red/5 border border-rl-red/20">
              <label className="text-[11px] font-semibold text-rl-text block mb-1">{t('otimizacoes.cartao.porQueRecusar')}</label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={2}
                autoFocus
                placeholder={t('otimizacoes.cartao.motivoPlaceholder')}
                className="input-field w-full text-xs resize-y"
              />
              <div className="flex items-center gap-2 mt-2">
                <button onClick={recusar} disabled={!motivo.trim() || salvando} className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-rl-red/10 text-rl-red border border-rl-red/30 hover:bg-rl-red/20 disabled:opacity-50">
                  {salvando === 'recusada' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />} {t('otimizacoes.cartao.confirmarRecusa')}
                </button>
                <button onClick={() => { setRecusando(false); setMotivo('') }} className="text-xs text-rl-muted hover:text-rl-text px-2 py-1.5">{t('comum.cancelar')}</button>
              </div>
            </div>
          )}
        </div>
        {/* Desktop: botões à direita do texto */}
        {!recusando && (
          <div className="hidden sm:flex items-center gap-1 shrink-0">
            {botoes}
          </div>
        )}
      </div>
      {/* Celular: botões numa linha própria, abaixo do conteúdo, sem disputar espaço com o texto */}
      {!recusando && (
        <div className="sm:hidden mt-3 pt-3 border-t border-rl-border/60 grid grid-cols-2 gap-2">
          {botoes}
        </div>
      )}
    </div>
  )
}

// ── Grupo por cliente ─────────────────────────────────────────────────────────
function GrupoCliente({ g, onAceitar, onRecusar, onAbrir }) {
  const { t } = useI18n()
  const [aberto, setAberto] = useState(true)
  const urg = g.sugestoes.filter((s) => s.prioridade === 'urgente').length
  const alta = g.sugestoes.filter((s) => s.prioridade === 'alta').length
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1 sticky top-0 sm:static z-10 bg-rl-bg/95 backdrop-blur py-1.5 -mx-1 sm:bg-transparent sm:backdrop-blur-0 sm:py-0">
        <button onClick={() => setAberto((v) => !v)} className="flex items-center gap-2 min-w-0 text-left group flex-1 sm:flex-initial">
          {aberto ? <ChevronDown className="w-4 h-4 text-rl-muted shrink-0" /> : <ChevronRight className="w-4 h-4 text-rl-muted shrink-0" />}
          <h2 className="text-base font-bold text-rl-text truncate group-hover:text-rl-purple">{g.nome}</h2>
        </button>
        <button onClick={() => onAbrir(g.projectId)} className="sm:order-last sm:ml-auto flex items-center gap-1 text-xs text-rl-purple hover:underline shrink-0">
          {t('otimizacoes.grupo.abrir')} <span className="hidden sm:inline">{t('otimizacoes.grupo.cliente')}</span> <ExternalLink className="w-3 h-3" />
        </button>
        <div className="flex items-center gap-1.5 flex-wrap basis-full sm:basis-auto">
          {g.responsavel && <span className="text-xs text-rl-muted hidden sm:inline">· {g.responsavel}</span>}
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-rl-surface border border-rl-border text-rl-subtle">{t('otimizacoes.grupo.sugestoes', { count: g.sugestoes.length })}</span>
          {urg > 0 && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border bg-rl-red/10 text-rl-red border-rl-red/30">{t('otimizacoes.grupo.urgentes', { count: urg })}</span>}
          {alta > 0 && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border bg-rl-gold/10 text-rl-gold border-rl-gold/30">{t('otimizacoes.grupo.altas', { count: alta })}</span>}
        </div>
      </div>
      {aberto && <div className="space-y-2">{g.sugestoes.map((s) => <Sugestao key={s.chave} s={s} onAceitar={onAceitar} onRecusar={onRecusar} />)}</div>}
    </section>
  )
}

// ── Histórico de decisões ─────────────────────────────────────────────────────
// [id, chave do rótulo, filtro]
const PERIODOS = [
  ['todos', 'comum.todos', () => true],
  ['hoje', 'comum.hoje', (n) => n === 0],
  ['ontem', 'comum.ontem', (n) => n === 1],
  ['7d', 'otimizacoes.periodos.d7', (n) => n >= 0 && n <= 6],
  ['14d', 'otimizacoes.periodos.d14', (n) => n >= 0 && n <= 13],
  ['30d', 'otimizacoes.periodos.d30', (n) => n >= 0 && n <= 29],
]
// Dias corridos entre a decisão e hoje, no fuso de São Paulo (0 = hoje, 1 = ontem).
function diasAtras(iso) {
  const dia = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  return Math.round((Date.parse(dia(new Date())) - Date.parse(dia(iso))) / 86400000)
}

function Historico({ itens, onReabrir, onAbrir, onCriarTarefa }) {
  const { t, locale } = useI18n()
  const [periodo, setPeriodo] = useState('todos')
  const comIdade = useMemo(() => itens.map((d) => ({ d, n: diasAtras(d.decidida_em || d.created_at) })), [itens])
  const visiveis = useMemo(() => {
    const ok = PERIODOS.find(([id]) => id === periodo)[2]
    return comIdade.filter(({ n }) => ok(n)).map(({ d }) => d)
  }, [comIdade, periodo])
  if (!itens.length) return <p className="text-sm text-rl-subtle text-center py-10">{t('otimizacoes.historico.vazio')}</p>
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 pb-1">
        {PERIODOS.map(([id, label, ok]) => {
          const n = comIdade.filter((x) => ok(x.n)).length
          const ativo = periodo === id
          return (
            <button key={id} onClick={() => setPeriodo(id)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${ativo ? 'bg-rl-purple text-white border-rl-purple' : 'bg-rl-card text-rl-subtle border-rl-border hover:text-rl-text'}`}>
              {t(label)} <span className={ativo ? 'opacity-80' : 'text-rl-muted'}>{n}</span>
            </button>
          )
        })}
      </div>
      {!visiveis.length && <p className="text-sm text-rl-subtle text-center py-10">{t('otimizacoes.historico.vazioPeriodo')}</p>}
      {visiveis.map((d) => {
        const cam = d.payload?.caminho || {}
        const niveis = [[t('sugestoes.niveis.campanha'), d.campanha || cam.campanha], [t('sugestoes.niveis.conjunto'), d.conjunto || cam.conjunto], [t('sugestoes.niveis.anuncio'), d.anuncio || cam.anuncio]].filter(([, v]) => v)
        return (
          <div key={d.id} className="glass-card border border-rl-border/60 p-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_CLS[d.status] || STATUS_CLS.descartada}`}>{STATUSES.includes(d.status) ? t(`otimizacoes.status.${d.status}`) : d.status}</span>
                  <button onClick={() => onAbrir(d.project_id)} className="text-xs font-semibold text-rl-text hover:text-rl-purple truncate">{d.nomeCliente}</button>
                  {d.canal && <span className="text-[11px] text-rl-muted">· {CANAL_LABEL[d.canal] || d.canal}</span>}
                  <span className="text-[11px] text-rl-muted flex items-center gap-1"><Clock className="w-3 h-3" /> {fmtDataHora(d.decidida_em || d.created_at, locale)}{d.decidida_por ? ` · ${d.decidida_por}` : ''}</span>
                </div>
                <p className="text-sm text-rl-text [overflow-wrap:anywhere]">{d.titulo || d.chave}</p>
                {(d.acao || d.payload?.acao) && <p className="text-xs text-rl-subtle mt-0.5"><span className="font-semibold text-rl-text">{t('otimizacoes.historico.otimizacao')}</span> {d.acao || d.payload?.acao}</p>}
                {niveis.length > 0 && (
                  <p className="text-[11px] text-rl-muted mt-1 break-words">
                    {niveis.map(([l, v], i) => <span key={l}>{i > 0 ? ' › ' : ''}<span className="text-rl-subtle">{l}:</span> {v}</span>)}
                    {(d.ad_id || cam.adId) && <span className="font-mono"> (ID {d.ad_id || cam.adId})</span>}
                  </p>
                )}
                {cam.url && (
                  <a href={cam.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-rl-purple hover:underline mt-1">
                    {t('sugestoes.abrirNo', { nome: cam.url.includes('ads.google.com') ? 'Google Ads' : t('sugestoes.gerenciador') })} <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {d.motivo && <p className="text-xs text-rl-subtle mt-1"><span className="font-semibold text-rl-text">{t('otimizacoes.historico.motivo')}</span> {d.motivo}</p>}
                {d.status === 'aceita' && (
                  <p className={`text-[11px] mt-1 flex items-center gap-1 ${EXEC_CLS[d.execucao_status] || 'text-rl-muted'}`}>
                    {d.execucao_status === 'executada' ? <CheckCircle2 className="w-3 h-3" /> : d.execucao_status === 'erro' ? <XCircle className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                    {d.execucao_status ? (EXEC_STATUS.includes(d.execucao_status) ? t(`otimizacoes.execucao.${d.execucao_status}`) : d.execucao_status) : t('otimizacoes.execucao.manual')}
                    {d.executada_em ? ` · ${fmtDataHora(d.executada_em, locale)}` : ''}
                  </p>
                )}
                {d.status === 'aceita' && d.clickup_task_url && (
                  <a href={d.clickup_task_url} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-rl-purple/10 text-rl-purple border border-rl-purple/30 hover:bg-rl-purple/20">
                    {t('otimizacoes.abrirAtividade')} <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {d.status === 'aceita' && !d.clickup_task_url && (
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] text-rl-red [overflow-wrap:anywhere]">{t('otimizacoes.historico.semTarefa')}{d.execucao_log?.erro_tarefa ? `: ${d.execucao_log.erro_tarefa}` : ''}</span>
                    <button onClick={() => onCriarTarefa(d)} className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-rl-purple/10 text-rl-purple border border-rl-purple/30 hover:bg-rl-purple/20">{t('otimizacoes.historico.criarTarefa')}</button>
                  </div>
                )}
              </div>
              {d.execucao_status !== 'executada' && (
                <button onClick={() => onReabrir(d)} className="text-xs text-rl-muted hover:text-rl-text flex items-center gap-1 shrink-0 p-1 -m-1" title={t('otimizacoes.historico.reabrirTitle')}>
                  <RotateCcw className="w-3 h-3" /> <span className="hidden sm:inline">{t('otimizacoes.historico.reabrir')}</span>
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
  const { squads, projects, teamMembers, user } = useApp()
  const { t, lang } = useI18n()
  // 20 dias: o motor usa 7 + 7 anteriores (igual à home, que já carrega isso)
  const dash = useDashboardData({ source: 'api', dias: 20 })
  const sg = useSugestoesGlobais(dash)
  const [tab, setTab] = useState('pendentes')
  const [busca, setBusca] = useState('')
  const [prioridade, setPrioridade] = useState('todas')
  const [canal, setCanal] = useState('todos')
  const [squad, setSquad] = useState('todos')
  const [criada, setCriada] = useState(null) // última tarefa criada ao aceitar: { titulo, url, ... }

  const projetoPorId = useMemo(() => new Map((projects || []).map((p) => [p.id, p])), [projects])

  const janela = useMemo(() => janelaAnalise(dash.raw?.meta || [], dash.raw?.google || []), [dash.raw])

  const q = busca.trim().toLowerCase()
  const grupos = useMemo(() => {
    return sg.grupos
      .filter((g) => squad === 'todos' || String(projetoPorId.get(g.projectId)?.squad || '') === String(squad))
      .filter((g) => !q || g.nome.toLowerCase().includes(q) || (g.responsavel || '').toLowerCase().includes(q))
      .map((g) => ({
        ...g,
        sugestoes: g.sugestoes.filter((s) =>
          (prioridade === 'todas' || PRIORIDADE_ORDEM[s.prioridade] <= PRIORIDADE_ORDEM[prioridade]) &&
          (canal === 'todos' || s.canal === canal)),
      }))
      .filter((g) => g.sugestoes.length > 0)
  }, [sg.grupos, q, prioridade, canal, squad, projetoPorId])

  // Clientes que batem com a busca mas NÃO têm sugestão pendente: a busca também
  // serve pra confirmar que um cliente está em dia. Separa quem foi analisado de
  // quem nem tem conta vinculada no dashboard.
  const semSugestao = useMemo(() => {
    if (!q) return []
    const comGrupo = new Set(sg.grupos.map((g) => g.projectId))
    return (projects || [])
      .filter((p) => (p.companyName || '').toLowerCase().includes(q) && !comGrupo.has(p.id))
      .filter((p) => squad === 'todos' || String(p.squad) === String(squad))
      .slice(0, 6)
      .map((p) => ({ id: p.id, nome: p.companyName, analisado: sg.projetosComDados?.has(p.id) }))
  }, [q, projects, sg.grupos, sg.projetosComDados, squad])

  const totalFiltrado = grupos.reduce((a, g) => a + g.sugestoes.length, 0)
  const naFila = sg.historico.filter((d) => d.execucao_status === 'pendente').length

  // Aceitar = cria a atividade no ClickUp do cliente e grava a decisão com o link da tarefa.
  // Se o ClickUp falhar (sem pasta, sem responsável…), a decisão é gravada mesmo assim,
  // com o motivo, e o histórico oferece "Criar tarefa" pra tentar de novo.
  const ctxTarefa = { squads, teamMembers, user, config: null }
  async function aceitar(s) {
    const projeto = projetoPorId.get(s.projectId)
    let tarefa, erroTarefa
    try {
      ({ tarefa, erroTarefa } = await aceitarComTarefa({ sug: s, projeto, ctx: ctxTarefa, gravarDecisao: sg.decidir }))
    } catch (e) {
      showToast(`${e.message}${e.tarefa ? ` ${t('otimizacoes.toast.tarefaCriadaMesmoAssim', { url: e.tarefa.url })}` : ''}`, 'error')
      return
    }
    if (tarefa) setCriada({ titulo: s.titulo, cliente: projeto?.companyName, responsavel: tarefa.responsavel, data: tarefa.data, url: tarefa.url, aviso: tarefa.aviso })
    else showToast(t('otimizacoes.toast.aceitaSemTarefa', { erro: erroTarefa }), 'error')
  }
  async function criarTarefaDe(d) {
    try {
      const sug = { ...(d.payload || {}), projectId: d.project_id, titulo: d.titulo || d.payload?.titulo }
      const tarefa = await criarTarefaDaSugestao({ sug, projeto: projetoPorId.get(d.project_id), ...ctxTarefa })
      await sg.atualizarDecisao(d, { clickup_task_id: tarefa.taskId, clickup_task_url: tarefa.url, atividade_id: tarefa.registro?.id || null, execucao_log: null })
      setCriada({ titulo: sug.titulo, cliente: projetoPorId.get(d.project_id)?.companyName, responsavel: tarefa.responsavel, data: tarefa.data, url: tarefa.url, aviso: tarefa.aviso })
    } catch (e) { showToast(e.message, 'error') }
  }
  async function recusar(s, motivo) {
    try { await sg.decidir(s, 'recusada', { motivo }); showToast(t('otimizacoes.toast.recusada')) }
    catch (e) { showToast(e.message, 'error') }
  }
  async function reabrir(d) {
    try { await sg.reabrir(d); showToast(t('otimizacoes.toast.reaberta')) }
    catch (e) { showToast(e.message, 'error') }
  }
  const abrir = (id) => navigate(cliente(id))

  const SELECT = 'input-field !w-auto max-w-full text-sm !py-2 !px-3 !pr-8 shrink-0'
  const filtrando = squad !== 'todos' || prioridade !== 'todas' || canal !== 'todos' || !!q

  return (
    <div className="fx flex-1 min-w-0 flex flex-col">
      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 border-b border-rl-border bg-rl-bg/90 backdrop-blur-xl">
        <button onClick={openSidebar} aria-label={t('otimizacoes.abrirMenu')} className="p-2 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all"><Menu className="w-5 h-5" /></button>
        <span className="font-bold text-rl-text text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-rl-purple" /> {t('otimizacoes.tituloCurto')}</span>
      </div>

      <main className="flex-1 px-3 sm:px-6 py-4 sm:py-6">
        <div className="w-full min-w-0 max-w-5xl mx-auto space-y-4 sm:space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-rl-text flex items-center gap-2"><Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-rl-purple" /> {t('otimizacoes.titulo')}</h1>
              <p className="text-xs sm:text-sm text-rl-subtle mt-1">
                {janela
                  ? t('otimizacoes.subtituloComJanela', { inicio: fmtDia(janela.inicio, lang), fim: fmtDia(janela.fim, lang) })
                  : t('otimizacoes.subtitulo')}
              </p>
            </div>
            <button onClick={() => { dash.reload(); sg.recarregarDecisoes() }} className="btn-secondary text-xs flex items-center gap-1.5 !px-3 !py-2 shrink-0 self-start sm:self-auto" title={t('otimizacoes.recarregar')}>
              <RefreshCw className={`w-3.5 h-3.5 ${sg.loading ? 'animate-spin' : ''}`} /> {t('otimizacoes.recarregar')}
            </button>
          </div>

          {/* Resumo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {[
              [t(filtrando ? 'otimizacoes.resumo.pendentesFiltro' : 'otimizacoes.resumo.pendentes'), filtrando ? totalFiltrado : sg.pendentes.length, Inbox, 'text-rl-purple'],
              [t(filtrando ? 'otimizacoes.resumo.clientesFiltro' : 'otimizacoes.resumo.clientesComSugestao'), filtrando ? grupos.length : sg.grupos.length, Sparkles, 'text-rl-gold'],
              [t('otimizacoes.execucao.pendente'), naFila, Bot, 'text-rl-green'],
              [t('otimizacoes.resumo.clientesAnalisados'), sg.clientesComDados, Search, 'text-rl-muted'],
            ].map(([label, n, Icon, cls]) => (
              <div key={label} className="glass-card border border-rl-border/60 p-2.5 sm:p-3 flex items-center gap-2 sm:gap-3">
                <span className="w-8 h-8 rounded-full fx-soft hidden sm:flex items-center justify-center shrink-0"><Icon className={`w-4 h-4 ${cls}`} /></span>
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
              {[['pendentes', t('otimizacoes.abas.pendentes'), Inbox, filtrando ? t('otimizacoes.abas.nDeTotal', { n: totalFiltrado, total: sg.pendentes.length }) : sg.pendentes.length], ['historico', t('otimizacoes.abas.historico'), History, sg.historico.length]].map(([id, label, Icon, n]) => (
                <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors ${tab === id ? 'bg-rl-purple text-white font-semibold' : 'text-rl-subtle hover:text-rl-text hover:bg-rl-surface'}`}>
                  <Icon className="w-4 h-4" /> {label}
                  <span className={`text-[10px] font-bold min-w-[18px] h-[18px] px-1.5 rounded-full flex items-center justify-center whitespace-nowrap ${tab === id ? 'bg-white/20 text-white' : 'bg-rl-surface text-rl-muted'}`}>{n}</span>
                </button>
              ))}
            </div>
            {tab === 'pendentes' && (
              <div className="flex items-center gap-2 sm:ml-auto flex-wrap">
                <div className="relative basis-full sm:basis-auto">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-rl-muted pointer-events-none" />
                  <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t('otimizacoes.filtros.buscarCliente')} className="input-field text-sm !py-2 !pl-8 !pr-3 !w-full sm:!w-52" />
                </div>
                {squads?.length > 0 && (
                  <select value={squad} onChange={(e) => setSquad(e.target.value)} className={`${SELECT} !w-full sm:!w-auto basis-full sm:basis-auto ${squad !== 'todos' ? '!border-rl-purple/50 !text-rl-purple' : ''}`} title={t('otimizacoes.filtros.squadTitle')}>
                    <option value="todos">{t('otimizacoes.filtros.todosSquads')}</option>
                    {squads.map((sq) => <option key={sq.id} value={sq.id}>{sq.emoji ? `${sq.emoji} ` : ''}{sq.name}</option>)}
                  </select>
                )}
                <div className="grid grid-cols-2 gap-2 basis-full sm:basis-auto sm:flex sm:items-center">
                  <select value={prioridade} onChange={(e) => setPrioridade(e.target.value)} className={`${SELECT} !w-full sm:!w-auto ${prioridade !== 'todas' ? '!border-rl-purple/50 !text-rl-purple' : ''}`}>
                    <option value="todas">{t('otimizacoes.filtros.todasPrioridades')}</option>
                    <option value="urgente">{t('otimizacoes.filtros.soUrgentes')}</option>
                    <option value="alta">{t('otimizacoes.filtros.urgentesEAltas')}</option>
                  </select>
                  <select value={canal} onChange={(e) => setCanal(e.target.value)} className={`${SELECT} !w-full sm:!w-auto ${canal !== 'todos' ? '!border-rl-purple/50 !text-rl-purple' : ''}`}>
                    <option value="todos">{t('otimizacoes.filtros.metaEGoogle')}</option>
                    <option value="meta">{t('otimizacoes.filtros.soMeta')}</option>
                    <option value="google">{t('otimizacoes.filtros.soGoogle')}</option>
                  </select>
                </div>
                {filtrando && (
                  <button onClick={() => { setBusca(''); setPrioridade('todas'); setCanal('todos'); setSquad('todos') }} className="text-xs text-rl-muted hover:text-rl-text flex items-center gap-1 px-2 py-1.5 shrink-0" title={t('otimizacoes.filtros.limparTitle')}>
                    <X className="w-3.5 h-3.5" /> {t('otimizacoes.filtros.limpar')}
                  </button>
                )}
              </div>
            )}
          </div>

          {criada && (
            <div className="glass-card border border-rl-green/40 bg-rl-green/5 px-4 py-3 flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-rl-green shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-rl-text">{criada.cliente ? t('otimizacoes.criada.tituloPara', { cliente: criada.cliente }) : t('otimizacoes.criada.titulo')}</p>
                <p className="text-xs text-rl-subtle [overflow-wrap:anywhere]">{criada.titulo}</p>
                <p className="text-xs text-rl-muted mt-0.5">{criada.responsavel}{criada.data ? ` · ${t('otimizacoes.criada.entrega', { data: fmtDataCompleta(criada.data, lang) })}` : ''}</p>
                {criada.aviso && <p className="text-xs text-rl-gold mt-1">{criada.aviso}</p>}
                <a href={criada.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-2 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-rl-purple/10 text-rl-purple border border-rl-purple/30 hover:bg-rl-purple/20">
                  {t('otimizacoes.abrirAtividade')} <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <button onClick={() => setCriada(null)} className="p-1 text-rl-muted hover:text-rl-text shrink-0" aria-label={t('comum.fechar')}><X className="w-4 h-4" /></button>
            </div>
          )}

          {sg.erro && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rl-red/10 border border-rl-red/30 text-xs text-rl-text"><AlertTriangle className="w-4 h-4 text-rl-red shrink-0" /> {String(sg.erro)}</div>
          )}

          {tab === 'pendentes' && semSugestao.length > 0 && (
            <div className="glass-card border border-rl-green/30 bg-rl-green/5 px-4 py-3">
              <p className="text-xs font-semibold text-rl-text flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-rl-green" /> {t('otimizacoes.semPendente.titulo')}</p>
              <ul className="mt-1.5 space-y-0.5">
                {semSugestao.map((p) => (
                  <li key={p.id} className="text-xs text-rl-subtle flex items-center gap-2 flex-wrap">
                    <button onClick={() => abrir(p.id)} className="font-medium text-rl-text hover:text-rl-purple">{p.nome}</button>
                    <span className="text-rl-muted">{p.analisado ? t('otimizacoes.semPendente.analisado') : t('otimizacoes.semPendente.semConta')}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tab === 'pendentes' ? (
            sg.loading && sg.pendentes.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-rl-muted py-16 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> {t('otimizacoes.lendo')}</div>
            ) : grupos.length === 0 && semSugestao.length > 0 ? null : grupos.length === 0 ? (
              <div className="text-center py-16">
                <CheckCircle2 className="w-8 h-8 text-rl-green mx-auto mb-2" />
                <p className="text-sm text-rl-text font-semibold">{totalFiltrado === 0 && sg.pendentes.length > 0 ? t('otimizacoes.vazio.comFiltros') : t('otimizacoes.vazio.titulo')}</p>
                <p className="text-xs text-rl-muted mt-1">{sg.pendentes.length > 0 ? t('otimizacoes.vazio.limpeFiltros') : t('otimizacoes.vazio.todasEmDia')}</p>
              </div>
            ) : (
              <div className="space-y-6">
                {grupos.map((g) => <GrupoCliente key={g.projectId} g={g} onAceitar={aceitar} onRecusar={recusar} onAbrir={abrir} />)}
              </div>
            )
          ) : (
            <Historico itens={sg.historico} onReabrir={reabrir} onAbrir={abrir} onCriarTarefa={criarTarefaDe} />
          )}
        </div>
      </main>
      <Toast toast={toast} />
    </div>
  )
}
