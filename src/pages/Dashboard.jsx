import { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { useDashboardData } from '../hooks/useDashboardData'
import { CFG, buildStats, computeMainPeriod, fmtNum } from '../lib/dashboardData'
import {
  Zap, Plus, LogOut, Layers,
  User,
  DollarSign, Users,
  X, Trash2, AlertTriangle,
  CloudOff, Loader2, Menu, Search,
  ChevronUp, ChevronDown, ChevronsUpDown, Users2,
  Wallet, TrendingDown, TrendingUp, Building2, UserPlus,
  Check, ShieldAlert, Target, ShieldCheck, ArrowRight,
} from 'lucide-react'
import { cliente } from '../routes/paths'
import { SQUAD_COLORS } from '../lib/constants'
import { fmtCurrency, hashId, mrrValue, calcLTV, activeMonths, canViewSquadsReport, initials } from '../lib/utils'
import { useLogosAssinados } from '../hooks/useLogosAssinados'
import { NEW_CLIENT_WINDOW_DAYS, isNewClient, baseProjectsOf } from '../lib/dashboardCounts'
import Modal from '../components/UI/Modal'
import UnsignedAtaPopups from '../components/Dashboard/UnsignedAtaPopups'
import { CrescimentoView, fmtNet, PctNet } from '../components/Dashboard/Crescimento'
import { netStats, MONTHS_PT } from '../lib/growth'
import OtimizacoesBanner from '../components/Dashboard/OtimizacoesBanner'

// Base comum dos chips da lista (squad, risco, momento): mesma altura, raio e corpo.
const CHIP = 'inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full text-[11px] font-semibold whitespace-nowrap max-w-full'

// Squad é identificação, não estado: chip neutro, com o emoji (ou um ponto na
// cor do squad) para distinguir. A cor forte fica para risco e momento.
// Os membros abrem num cartão em portal: dentro da tabela ele era cortado pelo
// `overflow` do cartão do grupo (a 1ª linha abria pra cima e sumia).
function SquadBadge({ name, emoji, colorIndex = 0, members = [] }) {
  const ref = useRef(null)
  const [pos, setPos] = useState(null)
  // Rolar a página com o cartão aberto o deixaria solto: fecha.
  useEffect(() => {
    if (!pos) return
    const fechar = () => setPos(null)
    window.addEventListener('scroll', fechar, true)
    return () => window.removeEventListener('scroll', fechar, true)
  }, [pos])
  if (!name) return <Vazio />
  const c = SQUAD_COLORS[colorIndex % SQUAD_COLORS.length]

  function abrir() {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    // Abre embaixo; se não couber (~ 40px por membro + cabeçalho), abre em cima.
    const altura = 56 + Math.max(1, members.length) * 30
    const emCima = r.bottom + 8 + altura > window.innerHeight && r.top > altura
    setPos({ left: Math.min(r.left, window.innerWidth - 248), top: emCima ? r.top - 8 : r.bottom + 8, emCima })
  }

  return (
    <>
      <span
        ref={ref}
        tabIndex={0}
        onMouseEnter={abrir}
        onMouseLeave={() => setPos(null)}
        onFocus={abrir}
        onBlur={() => setPos(null)}
        className={`${CHIP} cursor-default bg-rl-surface border border-rl-border text-rl-subtle hover:border-rl-text/20 hover:text-rl-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-rl-purple transition-colors`}
      >
        {emoji
          ? <span className="text-[12px] leading-none shrink-0">{emoji}</span>
          : <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />}
        <span className="truncate">{name}</span>
      </span>

      {pos && createPortal(
        <div
          role="tooltip"
          className="fx fixed z-[60] pointer-events-none w-60"
          style={{ left: pos.left, top: pos.top, transform: pos.emCima ? 'translateY(-100%)' : undefined }}
        >
          <div className="bg-rl-card border border-rl-border shadow-xl rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-rl-border">
              {emoji
                ? <span className="text-sm leading-none">{emoji}</span>
                : <span className={`w-2 h-2 rounded-full ${c.dot}`} />}
              <span className="text-[13px] font-semibold text-rl-text truncate">{name}</span>
              <span className="ml-auto text-[11px] text-rl-muted tabular-nums shrink-0">
                {members.length} {members.length === 1 ? 'pessoa' : 'pessoas'}
              </span>
            </div>
            {members.length > 0 ? (
              <ul className="py-1.5">
                {members.map((m, i) => (
                  <li key={i} className="flex items-center gap-2.5 px-3 py-1">
                    <span className="fx-soft w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">
                      {initials(m.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-medium text-rl-text truncate">{m.name}</span>
                      {m.role && <span className="block text-[11px] text-rl-muted truncate">{m.role}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-3 py-2.5 text-xs text-rl-muted">Nenhum membro no squad.</p>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

// ─── Pílulas de risco / momento ───────────────────────────────────────────────
// Tinta = texto colorido sobre fundo do mesmo tom. No escuro a tinta aproxima
// fundo e texto, então o alfa cai (a mesma regra do `--dt-tint-*` do dashboard).
const RISK_CONFIG = {
  em_risco: { label: 'Em Risco',  className: 'text-rl-red bg-rl-red/10 dark:bg-rl-red/[.12]',       dot: 'bg-rl-red'   },
  neutro:   { label: 'Neutro',    className: 'text-rl-gold bg-rl-gold/10 dark:bg-rl-gold/[.12]',    dot: 'bg-rl-gold'  },
  saudavel: { label: 'Saudável',  className: 'text-rl-green bg-rl-green/10 dark:bg-rl-green/[.12]', dot: 'bg-rl-green' },
}

function RiskBadge({ riskLevel }) {
  if (!riskLevel) return null
  const cfg = RISK_CONFIG[riskLevel]
  if (!cfg) return null
  return (
    <span className={`${CHIP} ${cfg.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

// Onboarding segue laranja: não há token laranja e o âmbar (rl-gold) já é "Neutro".
// `chip`: o chip da lista (só tinta, sem borda); `dot` também vai no filtro.
const MOMENTO_OPTIONS = [
  { value: 'onboarding',      label: 'Onboarding',      dot: 'bg-orange-500', chip: 'bg-orange-500/10 dark:bg-orange-400/[.12] text-orange-700 dark:text-orange-400' },
  { value: 'aceleracao',      label: 'Aceleração',      dot: 'bg-rl-green', chip: 'bg-rl-green/10 dark:bg-rl-green/[.12] text-rl-green' },
  { value: 'voo_de_cruzeiro', label: 'Voo de cruzeiro', dot: 'bg-rl-cyan', chip: 'bg-rl-cyan/10 dark:bg-rl-cyan/[.12] text-rl-cyan' },
  { value: 'churn',           label: 'Churn',           dot: 'bg-rl-red', chip: 'bg-rl-red/10 dark:bg-rl-red/[.12] text-rl-red' },
]

function MomentoBadge({ momento }) {
  if (!momento) return null
  const cfg = MOMENTO_OPTIONS.find(m => m.value === momento)
  if (!cfg) return null
  return (
    <span className={`${CHIP} ${cfg.chip}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

// LT (lifetime) em meses e dias: "3m 11d", "14m", "12d". Mês = 30,4375 dias,
// o mesmo de `activeMonths`, para bater com o LTV.
const DIAS_MES = 30.4375
function LtCell({ meses }) {
  if (!(meses > 0)) return <Vazio />
  const total = Math.max(1, Math.round(meses * DIAS_MES))
  let m = Math.floor(total / DIAS_MES)
  let d = Math.round(total - m * DIAS_MES)
  if (d >= 30) { m += 1; d = 0 }
  const txt = m === 0 ? `${d}d` : d === 0 ? `${m}m` : `${m}m ${d}d`
  return <span className="text-rl-subtle">{txt}</span>
}

// Célula vazia: traço discreto, igual em todas as colunas.
function Vazio({ children = '—' }) {
  return <span className="text-rl-muted/60">{children}</span>
}

// ─── Creator badge ─────────────────────────────────────────────────────────────
const CREATOR_COLORS = [
  { bg: 'bg-rl-purple/15', text: 'text-rl-purple', avatar: 'bg-rl-purple' },
  { bg: 'bg-rl-blue/15',   text: 'text-rl-blue',   avatar: 'bg-rl-blue'   },
  { bg: 'bg-rl-green/15',  text: 'text-rl-green',  avatar: 'bg-rl-green'  },
  { bg: 'bg-rl-cyan/15',   text: 'text-rl-cyan',   avatar: 'bg-rl-cyan'   },
  { bg: 'bg-rl-gold/15',   text: 'text-rl-gold',   avatar: 'bg-rl-gold'   },
  { bg: 'bg-red-500/15',   text: 'text-red-400',   avatar: 'bg-red-400'   },
]


function CreatorBadge({ accountName, colorIndex = 0 }) {
  if (!accountName) return null
  const c = CREATOR_COLORS[colorIndex % CREATOR_COLORS.length]
  const parts    = accountName.trim().split(' ')
  const initials = parts.slice(0, 2).map(w => w[0]?.toUpperCase()).join('')
  const display  = parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0]
  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${c.bg} ${c.text} border-current/20`}>
      <div className={`w-4 h-4 rounded-full ${c.avatar} flex items-center justify-center text-[8px] font-bold text-white shrink-0`}>
        {initials}
      </div>
      <span className="text-[11px] font-semibold whitespace-nowrap">{display}</span>
    </div>
  )
}

// ─── Filtros da lista ─────────────────────────────────────────────────────────
// Um visual só para todos: pílula neutra; ativa, ganha a tinta do azul de ação,
// mostra o valor escolhido e um X próprio (botão irmão, não aninhado). A cor
// de cada opção fica no ponto, como nos chips da tabela.
const FILTRO_BASE = 'inline-flex items-center gap-1.5 h-8 rounded-full border text-[13px] font-medium transition-colors whitespace-nowrap shrink-0'
const FILTRO_OFF  = 'bg-rl-card border-rl-border text-rl-subtle hover:text-rl-text hover:border-rl-text/25'
const FILTRO_ON   = 'bg-rl-purple/[.08] dark:bg-rl-purple/[.12] border-rl-purple/35 text-rl-text'
const FOCO = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rl-purple'

function PontoOpcao({ o }) {
  if (o.emoji) return <span className="text-[13px] leading-none w-4 text-center shrink-0">{o.emoji}</span>
  return <span className={`w-2 h-2 rounded-full shrink-0 ${o.dot}`} />
}

// `opcoes`: [{ value, label, dot?, emoji?, count }]. `valor` 'all' = sem filtro.
function FiltroMenu({ icone: Icone, rotulo, valor, opcoes, onChange, todos = 'Todos' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const fora = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const esc  = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc) }
  }, [open])

  const ativo = opcoes.find(o => String(o.value) === String(valor))
  const escolher = (v) => { onChange(v); setOpen(false) }

  return (
    <div ref={ref} className="relative shrink-0">
      <div className={`${FILTRO_BASE} ${ativo ? FILTRO_ON : FILTRO_OFF}`}>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          className={`inline-flex items-center gap-1.5 h-full rounded-full ${ativo ? 'pl-3 pr-1' : 'px-3'} ${FOCO}`}
        >
          {ativo ? (
            <>
              <span className="text-rl-muted">{rotulo}:</span>
              <PontoOpcao o={ativo} />
              <span className="max-w-[140px] truncate">{ativo.label}</span>
            </>
          ) : (
            <>
              <Icone className="w-3.5 h-3.5 shrink-0" />
              {rotulo}
              <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </>
          )}
        </button>
        {ativo && (
          <button
            type="button"
            onClick={() => onChange('all')}
            aria-label={`Limpar filtro ${rotulo}`}
            className={`mr-1 p-1 rounded-full text-rl-muted hover:text-rl-text hover:bg-rl-purple/10 ${FOCO}`}
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {open && (
        <div role="menu" className="absolute left-0 top-[calc(100%+6px)] z-30 min-w-[13rem] bg-rl-card border border-rl-border shadow-xl py-1 rounded-xl">
          <ItemFiltro selecionado={!ativo} onClick={() => escolher('all')}>
            <span className="w-2 shrink-0" />
            <span className="flex-1 text-left">{todos}</span>
          </ItemFiltro>
          <div className="border-t border-rl-border my-1" />
          {opcoes.map(o => (
            <ItemFiltro key={o.value} selecionado={String(o.value) === String(valor)} onClick={() => escolher(String(o.value))}>
              <PontoOpcao o={o} />
              <span className="flex-1 text-left truncate">{o.label}</span>
              <span className="text-[11px] text-rl-muted tabular-nums">{o.count ?? 0}</span>
            </ItemFiltro>
          ))}
        </div>
      )}
    </div>
  )
}

function ItemFiltro({ selecionado, onClick, children }) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selecionado}
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-rl-surface focus-visible:bg-rl-surface focus-visible:outline-none ${
        selecionado ? 'text-rl-text font-semibold' : 'text-rl-subtle'
      }`}
    >
      {children}
      <Check className={`w-3.5 h-3.5 shrink-0 text-rl-purple ${selecionado ? '' : 'invisible'}`} />
    </button>
  )
}

// Atalho liga/desliga (Novos, Churn): mesma pílula, com o contador.
function FiltroAtalho({ icone: Icone, rotulo, ativo, count, onClick, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      title={title}
      className={`${FILTRO_BASE} px-3 ${ativo ? FILTRO_ON : FILTRO_OFF} ${FOCO}`}
    >
      <Icone className="w-3.5 h-3.5 shrink-0" />
      {rotulo}
      {count > 0 && (
        <span className={`text-[11px] font-semibold tabular-nums px-1.5 rounded-full ${ativo ? 'bg-rl-purple/15 text-rl-text' : 'bg-rl-surface text-rl-muted'}`}>
          {count}
        </span>
      )}
      {ativo && <X className="w-3 h-3 text-rl-muted" />}
    </button>
  )
}

const RISK_OPTIONS = [
  { value: 'em_risco', label: 'Em Risco', dot: 'bg-rl-red'   },
  { value: 'neutro',   label: 'Neutro',   dot: 'bg-rl-gold'  },
  { value: 'saudavel', label: 'Saudável', dot: 'bg-rl-green' },
]

const BIZ_MODEL_OPTIONS = [
  { value: 'b2b', label: 'B2B', dot: 'bg-rl-blue'  },
  { value: 'b2c', label: 'B2C', dot: 'bg-rl-green' },
]

// ─── Indicador do topo ────────────────────────────────────────────────────────
// Com `onClick`, o cartão inteiro vira botão e mostra a `acao` no rodapé.
function Kpi({ icone: Icone, rotulo, valor, cor = 'text-rl-text', extra, title, onClick, acao, children }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={title}
      className={`glass-card p-4 sm:p-5 text-left flex flex-col min-w-0 ${onClick ? 'group/kpi hover:border-rl-purple/40 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-rl-purple' : ''}`}
    >
      <span className="flex items-center gap-2 text-xs text-rl-muted">
        <Icone className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">{rotulo}</span>
      </span>
      <span className="flex items-baseline gap-2 mt-1.5 min-w-0">
        <span className={`text-xl sm:text-2xl font-bold tabular-nums leading-tight truncate ${cor}`}>{valor}</span>
        {extra}
      </span>
      <span className="text-xs sm:text-sm text-rl-muted mt-1.5 tabular-nums">{children}</span>
      {acao && (
        <span className="mt-auto pt-2 inline-flex items-center gap-1 text-xs font-semibold text-rl-purple">
          {acao}
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover/kpi:translate-x-0.5" />
        </span>
      )}
    </Tag>
  )
}

// ─── List View ────────────────────────────────────────────────────────────────
// `num`: alinhado à direita (números tabulares). `hide`: some no mobile.
// `w`: largura fixa — cada grupo de risco é uma tabela própria, e sem largura
// fixa as colunas de um grupo não alinham com as do outro. Empresa fica com o resto.
const LIST_COLS = [
  { key: 'companyName',   label: 'Empresa'                                                         },
  { key: 'squadName',     label: 'Squad',         w: 'w-36', hide: 'hidden md:table-cell'           },
  { key: 'conv7d',        label: 'Conversões 7d', w: 'w-36', hide: 'hidden lg:table-cell', num: true },
  { key: 'riskLevel',     label: 'Risco',         w: 'w-32', semGrupo: true                         },
  { key: 'momento',       label: 'Momento',       w: 'w-40', hide: 'hidden sm:table-cell'           },
  { key: 'ltv',           label: 'LTV',           w: 'w-32', num: true                              },
  { key: 'lt',            label: 'LT',            w: 'w-28', hide: 'hidden sm:table-cell', num: true, title: 'Lifetime: tempo de contrato ativo, em meses e dias (até hoje ou até o churn)' },
  { key: 'contractValue', label: 'Contrato',      w: 'w-28', hide: 'hidden sm:table-cell', num: true },
  { key: 'createdAt',     label: 'Criado em',     w: 'w-36', hide: 'hidden xl:table-cell', num: true },
]

function SortIcon({ col, sortBy, sortDir }) {
  if (sortBy !== col) return <ChevronsUpDown className="w-3 h-3 opacity-0 group-hover/th:opacity-60 transition-opacity" />
  return sortDir === 'asc'
    ? <ChevronUp   className="w-3 h-3 text-rl-purple" />
    : <ChevronDown className="w-3 h-3 text-rl-purple" />
}

const RISK_GROUPS = [
  { value: 'em_risco', label: 'Em Risco',  dot: 'bg-rl-red',   text: 'text-rl-red',   valor: 'text-rl-red',   bg: 'bg-rl-red/[.04]'   },
  { value: 'neutro',   label: 'Neutro',    dot: 'bg-rl-gold',  text: 'text-rl-gold',  valor: 'text-rl-gold',  bg: 'bg-rl-gold/[.04]'  },
  { value: 'saudavel', label: 'Saudável',  dot: 'bg-rl-green', text: 'text-rl-green', valor: 'text-rl-green', bg: 'bg-rl-green/[.04]' },
  { value: null,       label: 'Sem Risco', dot: 'bg-rl-muted', text: 'text-rl-muted', valor: 'text-rl-text',  bg: 'bg-rl-surface/60'  },
]


// Célula de Conversões 7d: número + seta de tendência (vs 7 dias anteriores).
function ConvCell({ t, loading }) {
  if (!t) return <Vazio>{loading ? '·' : '—'}</Vazio>
  const { conv, prev } = t
  if (conv === 0 && prev === 0) return <Vazio />
  const dir = conv > prev ? 'up' : conv < prev ? 'down' : 'flat'
  const pct = prev > 0 ? Math.round(((conv - prev) / prev) * 100) : null
  const color = dir === 'up' ? 'text-rl-green' : dir === 'down' ? 'text-rl-red' : 'text-rl-muted'
  const arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '▬'
  const label = pct == null ? 'novo' : `${pct > 0 ? '+' : ''}${pct}%`
  return (
    <div className="flex items-center justify-end gap-2 whitespace-nowrap">
      <span className="text-rl-text font-medium">{fmtNum(conv)}</span>
      <span className={`text-xs flex items-center gap-0.5 ${color}`}>{arrow} {label}</span>
    </div>
  )
}

function ProjectListView({ projects, onNavigate, onDelete, groupByRisk = false, dash }) {
  const [sortBy,  setSortBy]  = useState('createdAt')
  const [sortDir, setSortDir] = useState('desc')
  const logoDe = useLogosAssinados(projects.map(p => p.logoUrl))

  function handleSort(key) {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(key); setSortDir('asc') }
  }

  // Conversões 7d (Meta + Google) por projeto — fonte NOVA (dash_insights/API),
  // somando as contas vinculadas. conv = últimos 7d, prev = 7d anteriores (trend).
  // Só precisa de 14 dias fechados (7 + 7 anteriores); pede 20 de folga em vez
  // do histórico inteiro, que estourava o tempo da função Edge. O fetch vive no
  // Dashboard (prop `dash`) porque o atalho de Otimizações usa os mesmos dados.
  const trafficByProject = useMemo(() => {
    const { raw, accounts } = dash
    const periods = {
      meta: computeMainPeriod(raw.meta, 'meta', 7),
      google: computeMainPeriod(raw.google, 'google', 7),
    }
    // Campanhas com "vaga" no nome são recrutamento, não resultado de cliente —
    // não contam como conversão na tela inicial.
    const CAMP_KEY = { meta: 'Nome da campanha', google: 'Campanha' }
    const semVaga = (rows, ch) => (rows || []).filter(
      r => !((r[CAMP_KEY[ch]] || '').toLowerCase().includes('vaga'))
    )
    const map = {}
    ;['meta', 'google'].forEach(ch => {
      const p = periods[ch]
      if (!p) return
      buildStats(semVaga(raw[ch], ch), CFG[ch], p).forEach(s => {
        const pid = accounts[s.name]?.projectId
        if (!pid) return
        if (!map[pid]) map[pid] = { conv: 0, prev: 0 }
        map[pid].conv += s.conv1 || 0
        map[pid].prev += s.conv2 || 0
      })
    })
    return map
  }, [dash.raw, dash.accounts])

  const sorted = [...projects].sort((a, b) => {
    let av = a[sortBy] ?? ''
    let bv = b[sortBy] ?? ''
    if (sortBy === 'contractValue') {
      av = Number(av) || 0; bv = Number(bv) || 0
    } else if (sortBy === 'ltv') {
      av = calcLTV(a); bv = calcLTV(b)
    } else if (sortBy === 'lt') {
      av = activeMonths(a); bv = activeMonths(b)
    } else if (sortBy === 'conv7d') {
      av = trafficByProject[a.id]?.conv || 0; bv = trafficByProject[b.id]?.conv || 0
    } else if (sortBy === 'createdAt') {
      av = new Date(av).getTime() || 0; bv = new Date(bv).getTime() || 0
    } else {
      av = String(av).toLowerCase(); bv = String(bv).toLowerCase()
    }
    if (av < bv) return sortDir === 'asc' ? -1 :  1
    if (av > bv) return sortDir === 'asc' ?  1 : -1
    return 0
  })

  const groups = groupByRisk
    ? RISK_GROUPS.map(g => {
        const rows = sorted.filter(p =>
          g.value === null ? !p.riskLevel : p.riskLevel === g.value
        )
        return {
          ...g,
          rows,
          totalVal: rows.reduce((acc, p) => acc + (Number(p.contractValue) || 0), 0),
          totalMRR: rows.reduce((acc, p) => acc + mrrValue(p), 0),
        }
      }).filter(g => g.rows.length > 0)
    : null

  const cols = groupByRisk ? LIST_COLS.filter(c => !c.semGrupo) : LIST_COLS

  function renderRow(p) {
    const createdStr = p.createdAt
      ? new Date(p.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
      : null
    const ltv = calcLTV(p)
    const logo = logoDe(p.logoUrl)
    const td = (c) => `px-4 py-2.5 ${c.hide || ''} ${c.num ? 'text-right tabular-nums whitespace-nowrap' : ''} ${c.key === 'companyName' ? '' : 'overflow-hidden'}`
    const cel = {
      companyName: (
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-8 h-8 shrink-0 rounded-[10px] border border-rl-border overflow-hidden flex items-center justify-center ${logo ? 'bg-rl-card' : 'fx-soft'}`}>
            {logo
              ? <img src={logo} alt="" className="w-full h-full object-cover" loading="lazy" />
              : <span className="text-[11px] font-bold">{initials(p.companyName)}</span>
            }
          </div>
          <span className="font-semibold text-rl-text group-hover:text-rl-purple transition-colors truncate" title={p.companyName}>
            {p.companyName}
          </span>
        </div>
      ),
      squadName: <SquadBadge name={p.squadName} emoji={p.squadEmoji} colorIndex={p.squadColorIndex} members={p.squadMembers ?? []} />,
      conv7d: <ConvCell t={trafficByProject[p.id]} loading={dash.loading} />,
      riskLevel: p.riskLevel ? <RiskBadge riskLevel={p.riskLevel} /> : <Vazio />,
      momento: p.momento ? <MomentoBadge momento={p.momento} /> : <Vazio />,
      ltv: ltv > 0 ? <span className="font-semibold text-rl-text">{fmtCurrency(ltv)}</span> : <Vazio />,
      lt: <LtCell meses={activeMonths(p)} />,
      contractValue: p.contractValue ? <span className="text-rl-subtle">{fmtCurrency(Number(p.contractValue))}</span> : <Vazio />,
      createdAt: createdStr ? <span className="text-xs text-rl-muted">{createdStr}</span> : <Vazio />,
    }
    return (
      <tr
        key={p.id}
        tabIndex={0}
        onClick={() => onNavigate(p.id)}
        onKeyDown={e => { if (e.key === 'Enter' && e.target === e.currentTarget) onNavigate(p.id) }}
        className="cursor-pointer transition-colors hover:bg-rl-surface focus-visible:outline-none focus-visible:bg-rl-surface focus-visible:shadow-[inset_2px_0_0_rgb(var(--rl-purple))] group border-b border-rl-border last:border-b-0"
      >
        {cols.map(c => <td key={c.key} className={td(c)}>{cel[c.key]}</td>)}
        <td className="pl-1 pr-3 py-2.5 w-10" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onDelete(p)}
            aria-label={`Excluir ${p.companyName}`}
            title="Excluir projeto"
            className="p-1.5 rounded-lg text-rl-muted md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 hover:text-rl-red hover:bg-rl-red/10 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </td>
      </tr>
    )
  }

  function renderTable(rows) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full table-fixed min-w-[17rem] sm:min-w-[40rem] text-sm border-collapse">
          <thead>
            <tr className="border-b border-rl-border bg-rl-surface/60">
              {cols.map(col => {
                const ativo = sortBy === col.key
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={ativo ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={`px-4 py-2 font-semibold whitespace-nowrap ${col.w || ''} ${col.hide || ''} ${col.num ? 'text-right' : 'text-left'}`}
                  >
                    <button
                      type="button"
                      title={col.title}
                      onClick={() => handleSort(col.key)}
                      className={`group/th inline-flex items-center gap-1 text-[11px] uppercase tracking-wider transition-colors hover:text-rl-text ${ativo ? 'text-rl-text' : 'text-rl-muted'} ${col.num ? 'flex-row-reverse' : ''}`}
                    >
                      {col.label}
                      <SortIcon col={col.key} sortBy={sortBy} sortDir={sortDir} />
                    </button>
                  </th>
                )
              })}
              <th className="w-10"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(p => renderRow(p))}
          </tbody>
        </table>
      </div>
    )
  }

  if (!groups) {
    return (
      <div className="glass-card overflow-hidden">
        {renderTable(sorted)}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {groups.map(g => (
        <section key={g.value ?? 'sem_risco'} className="glass-card overflow-hidden" aria-label={g.label}>
          <div className={`flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 border-b border-rl-border ${g.bg}`}>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${g.dot}`} />
              <h3 className={`text-xs font-bold uppercase tracking-wider ${g.text}`}>{g.label}</h3>
              <span className="text-[11px] font-semibold text-rl-muted bg-rl-card border border-rl-border px-2 py-0.5 rounded-full tabular-nums">
                {g.rows.length} {g.rows.length === 1 ? 'cliente' : 'clientes'}
              </span>
            </div>
            {/* Totais do grupo: valor grande, na cor do grupo (o "Sem risco" fica no texto) */}
            <dl className="ml-auto flex items-center gap-6 sm:gap-8">
              {g.totalVal > 0 && (
                <div className="text-right">
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-rl-muted">Contrato cheio</dt>
                  <dd className={`text-lg font-bold tabular-nums leading-tight ${g.valor}`}>{fmtCurrency(g.totalVal)}</dd>
                </div>
              )}
              {g.totalMRR > 0 && (
                <div className="text-right">
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-rl-muted">MRR</dt>
                  <dd className={`text-lg font-bold tabular-nums leading-tight ${g.valor}`}>{fmtCurrency(g.totalMRR)}</dd>
                </div>
              )}
            </dl>
          </div>
          {renderTable(g.rows)}
        </section>
      ))}
    </div>
  )
}

function DeleteConfirmModal({ project, onConfirm, onCancel }) {
  const [typed, setTyped] = useState('')
  const canDelete = typed === 'DELETE'

  return (
    <Modal onClose={onCancel} maxWidth="md" className="border-red-500/30">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-rl-text">Excluir cliente</h2>
            <p className="text-xs text-rl-muted mt-0.5">Esta ação é permanente e não pode ser desfeita.</p>
          </div>
        </div>

        {/* Project name */}
        <div className="rounded-xl bg-rl-surface border border-rl-border px-4 py-3 mb-5">
          <p className="text-[11px] text-rl-muted mb-0.5">Cliente a ser excluído</p>
          <p className="text-sm font-bold text-red-400">{project.companyName}</p>
          {project.responsibleName && (
            <p className="text-xs text-rl-muted mt-0.5">{project.responsibleName} · {project.responsibleRole}</p>
          )}
        </div>

        {/* Confirmation input */}
        <div className="space-y-2 mb-6">
          <label className="text-sm text-rl-text">
            Digite <span className="font-mono font-bold text-red-400">DELETE</span> para confirmar:
          </label>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="DELETE"
            className="input-field w-full font-mono tracking-widest"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && canDelete && onConfirm()}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 btn-ghost">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={!canDelete}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-semibold text-sm transition-all hover:bg-red-500/20 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
            Excluir cliente
          </button>
        </div>
    </Modal>
  )
}

function EmptyState({ onNew }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-rl-purple/10 flex items-center justify-center mb-4 animate-float">
        <Layers className="w-8 h-8 text-rl-purple/60" />
      </div>
      <h3 className="text-lg font-semibold text-rl-text mb-2">Nenhum cliente ainda</h3>
      <p className="text-rl-muted text-sm mb-6 max-w-xs">
        Adicione seu primeiro cliente para começar a gerenciar sua carteira.
      </p>
      <button onClick={onNew} className="btn-primary flex items-center gap-2">
        <Plus className="w-4 h-4" />
        Novo Cliente
      </button>
    </div>
  )
}

export default function Dashboard() {
  const {
    user, projects, logout, deleteProject,
    loadingProjects, teamMembers, squads,
  } = useApp()
  const navigate = useNavigate()
  const { openSidebar } = useOutletContext()
  const dash = useDashboardData({ source: 'api', dias: 20 })
  const [deleteTarget, setDeleteTarget] = useState(null)
  // O filtro mora na URL (`/?lista=`) para sobreviver a refresh e poder ser
  // linkado — a AppSidebar lê o mesmo parâmetro em vez de receber por prop.
  const [searchParams, setSearchParams] = useSearchParams()
  // Tela de crescimento da base: mesma rota, `?visao=crescimento&mes=yyyy-mm&aba=novos|churn`.
  const emCrescimento = searchParams.get('visao') === 'crescimento'
  function abrirCrescimento(extra = {}) {
    setSearchParams({ visao: 'crescimento', ...extra })
    window.scrollTo(0, 0)
  }
  function mudarCrescimento(chave, valor) {
    const q = new URLSearchParams(searchParams)
    q.set(chave, valor)
    setSearchParams(q, { replace: true })
  }
  const filter = searchParams.get('lista') || 'all'  // 'all' | 'onboarding' | 'active' | accountId
  const [squadFilter, setSquadFilter] = useState('all') // 'all' | squadId
  const [riskFilter, setRiskFilter] = useState('all') // 'all' | 'em_risco' | 'neutro' | 'saudavel'
  const [momentoFilter, setMomentoFilter] = useState('all') // 'all' | momento value
  const [bizFilter, setBizFilter] = useState('all') // 'all' | 'b2b' | 'b2c'
  const [searchQuery, setSearchQuery] = useState('')

  // A visão em cards saiu (2026-10-28); a lista é a única. Limpa a preferência antiga.
  useEffect(() => { localStorage.removeItem('rl_dashboard_view') }, [])

  const isAdmin = user?.role === 'admin'


  // Corte da janela de "cliente novo" — calculado uma vez por render.
  const newClientCutoff = Date.now() - NEW_CLIENT_WINDOW_DAYS * 86400000

  // RLS no Supabase já filtra: admins veem tudo; accounts veem apenas projetos
  // cujo squad atribuído inclui o usuário como membro
  const baseProjects = baseProjectsOf(projects, squads)

  // Apply status/member filter
  const filteredProjects = (() => {
    let result = baseProjects
    if (filter === 'churn')            result = result.filter(p => p.momento === 'churn')
    else if (filter === 'novos')      result = result.filter(p => isNewClient(p, newClientCutoff))
    else if (filter === 'onboarding') result = result.filter(p => p.status === 'onboarding')
    else if (filter === 'active')     result = result.filter(p => p.status === 'active')
    else if (filter !== 'all')        result = result.filter(p => String(p.accountId) === String(filter))
    if (squadFilter   !== 'all')      result = result.filter(p => String(p.squad) === String(squadFilter))
    if (riskFilter    !== 'all')      result = result.filter(p => p.riskLevel === riskFilter)
    if (momentoFilter !== 'all')      result = result.filter(p => p.momento === momentoFilter)
    else if (filter !== 'churn')      result = result.filter(p => p.momento !== 'churn')
    if (bizFilter === 'b2b')      result = result.filter(p => p.businessType === 'b2b')
    else if (bizFilter === 'b2c') result = result.filter(p => p.businessType !== 'b2b')
    return result
  })()

  // All active (non-disabled) team members appear in the sidebar filter
  const activeAccounts = teamMembers.filter(m => !m.disabled)

  // Apply search on top of the status/member filter
  const query = searchQuery.trim().toLowerCase()
  const visibleProjects = (query
    ? filteredProjects.filter(p =>
        (p.companyName    || '').toLowerCase().includes(query) ||
        (p.responsibleName|| '').toLowerCase().includes(query)
      )
    : filteredProjects
  ).map(p => {
    const memberIdx = teamMembers.findIndex(m => String(m.id) === String(p.accountId))
    const squadIdx     = squads.findIndex(s => String(s.id) === String(p.squad))
    const squad        = squadIdx >= 0 ? squads[squadIdx] : null
    const squadMembers = (squad?.members ?? []).map(m => {
      const profile = teamMembers.find(t => String(t.id) === String(m.profile_id))
      return profile ? { name: profile.name, role: m.role } : null
    }).filter(Boolean)
    return {
      ...p,
      accountName:       teamMembers[memberIdx]?.name ?? p.accountName,
      accountColorIndex: memberIdx >= 0 ? memberIdx : 0,
      squadName:         squad?.name ?? null,
      squadEmoji:        squad?.emoji ?? null,
      squadColorIndex:   squadIdx >= 0 ? squadIdx : 0,
      squadMembers,
    }
  })

  // Counts for sidebar nav
  const counts = {
    all:        baseProjects.filter(p => p.momento !== 'churn').length,
    churn:      baseProjects.filter(p => p.momento === 'churn').length,
    novos:      baseProjects.filter(p => p.momento !== 'churn' && isNewClient(p, newClientCutoff)).length,
    onboarding: baseProjects.filter(p => p.status === 'onboarding').length,
    active:     baseProjects.filter(p => p.status === 'active').length,
    members:    Object.fromEntries(
      activeAccounts.map(m => [String(m.id), baseProjects.filter(p => String(p.accountId) === String(m.id)).length])
    ),
    squads:     Object.fromEntries(
      squads.map(s => [String(s.id), baseProjects.filter(p => String(p.squad) === String(s.id)).length])
    ),
    risks:      Object.fromEntries(
      RISK_OPTIONS.map(r => [r.value, baseProjects.filter(p => p.riskLevel === r.value).length])
    ),
    momentos:   Object.fromEntries(
      MOMENTO_OPTIONS.map(m => [m.value, baseProjects.filter(p => p.momento === m.value).length])
    ),
    businessModels: {
      b2b: baseProjects.filter(p => p.momento !== 'churn' && p.businessType === 'b2b').length,
      b2c: baseProjects.filter(p => p.momento !== 'churn' && p.businessType !== 'b2b').length,
    },
  }

  // Derive page title from filter
  const listaAtalho = filter === 'novos' || filter === 'churn'
  const filtrosAtivos = [squadFilter, riskFilter, momentoFilter, bizFilter].filter(v => v !== 'all').length + (listaAtalho ? 1 : 0)
  function limparFiltros() {
    setSquadFilter('all'); setRiskFilter('all'); setMomentoFilter('all'); setBizFilter('all')
    if (listaAtalho) navigate('/', { replace: true })
  }

  const pageTitle = (() => {
    if (filter === 'all')        return 'Clientes'
    if (filter === 'churn')      return 'Churn'
    if (filter === 'novos')      return `Novos Clientes (últimos ${NEW_CLIENT_WINDOW_DAYS} dias)`
    if (filter === 'onboarding') return 'Em Onboarding'
    if (filter === 'active')     return 'Perfis Ativos'
    const member = teamMembers.find(m => String(m.id) === String(filter))
    return member ? `Clientes de ${member.name.split(' ')[0]}` : 'Clientes'
  })()

  // ── Resumo financeiro + churn do mês corrente ─────────────────────────────
const _now      = new Date()
  const _yyyy     = _now.getFullYear()
  const _mm       = _now.getMonth()
  const monthLabel = MONTHS_PT[_mm]

  const activeBase  = baseProjects.filter(p => p.momento !== 'churn')
  const totalContract = activeBase.reduce((acc, p) => acc + (Number(p.contractValue) || 0), 0)
  const totalMRR      = activeBase.reduce((acc, p) => acc + mrrValue(p), 0)
  // Ticket médio considera apenas clientes ativos com contractValue > 0
  // para evitar "diluição" por contas ainda em onboarding sem valor preenchido.
  const billedClients = activeBase.filter(p => (Number(p.contractValue) || 0) > 0)
  const avgTicketMRR  = billedClients.length > 0 ? totalMRR / billedClients.length : 0

  // LTV Médio — considera TODOS os clientes com contractDate (ativos +
  // churnados), pois churnados representam ciclos completos que entram
  // na média histórica. Test squads já estão fora via baseProjects.
  const ltvClients = baseProjects.filter(p => !!p.contractDate && (Number(p.contractValue) || 0) > 0)
  const totalLTV   = ltvClients.reduce((acc, p) => acc + calcLTV(p), 0)
  const avgLTV     = ltvClients.length > 0 ? totalLTV / ltvClients.length : 0

  // Saldo do mês corrente (entradas − saídas), a mesma conta da tela de crescimento.
  const net = netStats(baseProjects, _yyyy, _mm)

  return (
    <>

      {/* ── Sidebar ─────────────────────────────────────── */}

      {/* ── Main content ────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 border-b border-rl-border bg-rl-bg/90 backdrop-blur-xl">
          <button
            onClick={openSidebar}
            aria-label="Abrir menu de navegação"
            className="p-2 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-rl flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-rl-text text-sm">Verta</span>
          </div>
        </div>

        <main className="flex-1 px-6 py-8 space-y-8">
          {emCrescimento ? (
            <CrescimentoView
              projects={baseProjects}
              squads={squads}
              yyyy={_yyyy}
              mm={_mm}
              mes={searchParams.get('mes')}
              aba={searchParams.get('aba') === 'churn' ? 'churn' : 'novos'}
              onMes={(v) => mudarCrescimento('mes', v)}
              onAba={(v) => mudarCrescimento('aba', v)}
              onVoltar={() => setSearchParams({})}
              onOpenProject={(id) => navigate(cliente(id))}
            />
          ) : (<>

          {/* Cabeçalho: escopo do que a pessoa vê + ações da página */}
          <div className="flex flex-wrap items-center gap-3 animate-slide-up">
            <div className="flex items-center gap-2.5 flex-wrap mr-auto min-w-0">
              <h1 className="text-2xl font-bold text-rl-text">Visão geral</h1>
              <span
                title={isAdmin ? 'Você é admin: vê os clientes de todos os squads' : 'Você vê os clientes dos squads de que faz parte'}
                className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-semibold bg-rl-surface border border-rl-border text-rl-subtle"
              >
                {isAdmin ? <ShieldCheck className="w-3.5 h-3.5 text-rl-purple" /> : <Users className="w-3.5 h-3.5 text-rl-purple" />}
                {isAdmin ? 'Admin · todos os squads' : 'Seus squads'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {canViewSquadsReport(user) && (
                <button
                  onClick={() => navigate('/relatorio-squads')}
                  className="btn-secondary inline-flex items-center gap-2 h-[38px] px-3 text-sm whitespace-nowrap"
                  title="Abrir relatório por squad"
                >
                  <Users2 className="w-4 h-4" />
                  <span className="hidden md:inline">Dashboard de Squads</span>
                </button>
              )}
              <button
                onClick={() => navigate('/cliente/novo')}
                className="btn-primary inline-flex items-center gap-2 h-[38px] px-4 py-0 text-sm whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Novo cliente
              </button>
            </div>
          </div>

          {/* Indicadores: a carteira hoje + o saldo do mês. O detalhe de
              entradas e saídas mora em `/?visao=crescimento`. */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 animate-slide-up" style={{ animationDelay: '0.05s' }}>
            <Kpi icone={DollarSign} rotulo="MRR" valor={fmtCurrency(totalMRR)}>
              Contrato cheio <span className="font-semibold text-rl-text">{fmtCurrency(totalContract)}</span>
            </Kpi>
            <Kpi icone={Users} rotulo="Clientes ativos" valor={activeBase.length}>
              {billedClients.length > 0
                ? <>Ticket médio <span className="font-semibold text-rl-text">{fmtCurrency(avgTicketMRR)}</span>/mês</>
                : 'Sem valor de contrato'}
            </Kpi>
            <Kpi
              icone={Wallet}
              rotulo="LTV médio"
              valor={ltvClients.length ? fmtCurrency(avgLTV) : '—'}
              title="Média do LTV dos clientes com data de assinatura, ativos e churn"
            >
              {ltvClients.length} {ltvClients.length === 1 ? 'cliente' : 'clientes'}, ativos e churn
            </Kpi>
            <Kpi
              icone={net.net < 0 ? TrendingDown : TrendingUp}
              rotulo={`Net MRR · ${monthLabel}`}
              valor={fmtNet(net.net)}
              extra={<PctNet valor={net.growthPct} />}
              cor={net.net > 0 ? 'text-rl-green' : net.net < 0 ? 'text-rl-red' : 'text-rl-text'}
              onClick={() => abrirCrescimento()}
              acao="Ver crescimento"
            >
              <span className="text-rl-green font-semibold">+{fmtCurrency(net.novos.mrr)}</span> ({net.novos.count})
              {' · '}
              <span className="text-rl-red font-semibold">−{fmtCurrency(net.churn.mrr)}</span> ({net.churn.count})
            </Kpi>
          </div>

          {/* Otimizações do playbook pendentes (todos os clientes) */}
          <div className="animate-slide-up" style={{ animationDelay: '0.13s' }}>
            <OtimizacoesBanner dash={dash} onAbrir={() => navigate('/otimizacoes')} />
          </div>

          {/* Projects */}
          <div className="animate-slide-up" style={{ animationDelay: '0.15s' }}>
            {/* Título, filtros e busca numa linha só (quebra quando falta largura) */}
            <div className="flex flex-wrap items-center gap-2 mb-4" role="group" aria-label="Filtros da lista">
              <div className="flex items-center gap-2 mr-2 min-w-0">
                <h2 className="text-lg font-semibold text-rl-text truncate">{pageTitle}</h2>
                {visibleProjects.length > 0 && (
                  <span className="text-xs font-semibold tabular-nums text-rl-subtle bg-rl-surface border border-rl-border px-2 py-0.5 rounded-full">
                    {visibleProjects.length}
                  </span>
                )}
              </div>
              {squads.length > 0 && (
                <FiltroMenu
                  icone={Users}
                  rotulo="Squad"
                  todos="Todos os squads"
                  valor={squadFilter}
                  onChange={setSquadFilter}
                  opcoes={squads.map((s, idx) => ({
                    value: String(s.id),
                    label: s.name,
                    emoji: s.emoji,
                    dot: SQUAD_COLORS[idx % SQUAD_COLORS.length].dot,
                    count: counts.squads?.[String(s.id)],
                  }))}
                />
              )}
              <FiltroMenu
                icone={Building2}
                rotulo="Modelo"
                valor={bizFilter}
                onChange={setBizFilter}
                opcoes={BIZ_MODEL_OPTIONS.map(o => ({ ...o, count: counts.businessModels?.[o.value] }))}
              />
              <FiltroMenu
                icone={ShieldAlert}
                rotulo="Risco"
                valor={riskFilter}
                onChange={setRiskFilter}
                opcoes={RISK_OPTIONS.map(o => ({ ...o, count: counts.risks?.[o.value] }))}
              />
              <FiltroMenu
                icone={Target}
                rotulo="Momento"
                valor={momentoFilter}
                onChange={setMomentoFilter}
                opcoes={MOMENTO_OPTIONS.map(o => ({ value: o.value, label: o.label, dot: o.dot, count: counts.momentos?.[o.value] }))}
              />

              <span className="hidden sm:block w-px h-5 bg-rl-border mx-1" aria-hidden="true" />

              {/* Novos / Churn escrevem em `/?lista=` (o título da página, os
                  contadores e o link direto dependem disso). Clicar no ativo volta
                  para a lista completa. */}
              <FiltroAtalho
                icone={UserPlus}
                rotulo={`Novos (${NEW_CLIENT_WINDOW_DAYS}d)`}
                ativo={filter === 'novos'}
                count={counts.novos}
                title={`Clientes que entraram nos últimos ${NEW_CLIENT_WINDOW_DAYS} dias`}
                onClick={() => navigate(filter === 'novos' ? '/' : '/?lista=novos', { replace: true })}
              />
              <FiltroAtalho
                icone={TrendingDown}
                rotulo="Churn"
                ativo={filter === 'churn'}
                count={counts.churn}
                title="Clientes que deram churn"
                onClick={() => navigate(filter === 'churn' ? '/' : '/?lista=churn', { replace: true })}
              />

              {filtrosAtivos > 0 && (
                <button
                  type="button"
                  onClick={limparFiltros}
                  className="h-8 px-2 text-[13px] font-medium text-rl-muted hover:text-rl-text underline-offset-2 hover:underline"
                >
                  Limpar filtros ({filtrosAtivos})
                </button>
              )}
              {/* Busca à direita */}
              <div className="relative w-full sm:w-56 sm:ml-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-rl-muted pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nome..."
                  aria-label="Buscar cliente"
                  className="input-field w-full h-8 pl-8 pr-8 py-0 text-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    aria-label="Limpar busca"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-rl-muted hover:text-rl-text transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Com o cache local da lista, a home já desenha a última versão e só troca
                os dados quando a nuvem responde; o loading fica para a primeira visita. */}
            {loadingProjects && !projects.length ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-rl-muted">
                <Loader2 className="w-8 h-8 animate-spin text-rl-purple" />
                <p className="text-sm">Carregando projetos da nuvem...</p>
              </div>
            ) : visibleProjects.length === 0 && !query && filtrosAtivos > 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Search className="w-10 h-10 text-rl-muted/30 mb-3" />
                <p className="text-rl-text font-semibold mb-1">Nenhum cliente com esses filtros</p>
                <p className="text-rl-muted text-sm">Tire um filtro ou limpe todos.</p>
                <button onClick={limparFiltros} className="mt-4 text-xs text-rl-purple hover:underline">
                  Limpar filtros
                </button>
              </div>
            ) : visibleProjects.length === 0 && !query ? (
              <div className="grid grid-cols-1">
                <EmptyState onNew={() => navigate('/cliente/novo')} />
              </div>
            ) : visibleProjects.length === 0 && query ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Search className="w-10 h-10 text-rl-muted/30 mb-3" />
                <p className="text-rl-text font-semibold mb-1">Nenhum resultado para "{searchQuery}"</p>
                <p className="text-rl-muted text-sm">Tente outro nome ou responsável.</p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-4 text-xs text-rl-purple hover:underline"
                >
                  Limpar busca
                </button>
              </div>
            ) : (
              <ProjectListView
                dash={dash}
                projects={visibleProjects}
                onNavigate={(id) => navigate(cliente(id))}
                onDelete={(p) => setDeleteTarget(p)}
                groupByRisk={true}
              />
            )}
          </div>

          </>)}
        </main>
      </div>

      {deleteTarget && (
        <DeleteConfirmModal
          project={deleteTarget}
          onConfirm={() => { deleteProject(deleteTarget.id); setDeleteTarget(null) }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Popup amarelo de atas pendentes (canto inferior direito, a cada 1h) */}
      <UnsignedAtaPopups projects={projects} />
    </>
  )
}
