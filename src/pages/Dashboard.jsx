import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import {
  Zap, Plus, LogOut, Clock, CheckCircle2, Layers,
  Calendar, User,
  BarChart3, FileText, DollarSign, Users,
  Eye, X, Trash2, AlertTriangle,
  Cloud, CloudOff, Loader2, Menu, Search,
  LayoutGrid, List, ChevronUp, ChevronDown, ChevronsUpDown, Users2,
  Wallet, TrendingDown,
} from 'lucide-react'
import AppSidebar from '../components/AppSidebar'
import { SQUAD_COLORS } from '../lib/constants'
import { fmtCurrency, hashId, mrrValue, canViewSquadsReport } from '../lib/utils'
import Modal from '../components/UI/Modal'

const CORE_STEPS = ['roi', 'strategy', 'oferta']
function isProfileComplete(project) {
  return CORE_STEPS.every(s => (project.completedSteps || []).includes(s))
}

function SquadBadge({ name, emoji, colorIndex = 0, members = [] }) {
  if (!name) return <span className="text-rl-muted text-xs">—</span>
  const c = SQUAD_COLORS[colorIndex % SQUAD_COLORS.length]

  return (
    <div className="relative group/squad inline-flex">
      <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border cursor-default ${c.bg} ${c.text} ${c.border}`}>
        {emoji && <span className="text-[11px] leading-none">{emoji}</span>}
        <span className="text-[11px] font-semibold whitespace-nowrap">{name}</span>
      </div>

      {members.length > 0 && (
        <div className="absolute bottom-full left-0 mb-2 hidden group-hover/squad:block z-50 pointer-events-none">
          <div className="glass-card border border-rl-border shadow-xl py-2 px-3 rounded-xl min-w-[180px]">
            <p className="text-[10px] font-semibold text-rl-muted uppercase tracking-wider mb-1.5">{name}</p>
            {members.map((m, i) => (
              <div key={i} className="flex items-center justify-between gap-4 py-0.5">
                <span className="text-xs text-rl-text whitespace-nowrap">{m.name}</span>
                <span className="text-[10px] text-rl-muted whitespace-nowrap">{m.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Risk badge ────────────────────────────────────────────────────────────────
const RISK_CONFIG = {
  em_risco: { label: 'Em Risco',  className: 'text-red-400 bg-red-400/10 border-red-400/30',     dot: 'bg-red-400'     },
  neutro:   { label: 'Neutro',    className: 'text-rl-gold bg-rl-gold/10 border-rl-gold/30',      dot: 'bg-rl-gold'     },
  saudavel: { label: 'Saudável',  className: 'text-rl-green bg-rl-green/10 border-rl-green/30',   dot: 'bg-rl-green'    },
}

function RiskBadge({ riskLevel }) {
  if (!riskLevel) return null
  const cfg = RISK_CONFIG[riskLevel]
  if (!cfg) return null
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${cfg.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

// ─── Momento badge ─────────────────────────────────────────────────────────────
const MOMENTO_OPTIONS = [
  { value: 'onboarding',      label: 'Onboarding',      dot: 'bg-orange-400', text: 'text-orange-400', activeCls: 'bg-orange-400/10 border-orange-400/40 text-orange-400' },
  { value: 'aceleracao',      label: 'Aceleração',      dot: 'bg-rl-green',   text: 'text-rl-green',   activeCls: 'bg-rl-green/10 border-rl-green/40 text-rl-green'       },
  { value: 'voo_de_cruzeiro', label: 'Voo de cruzeiro', dot: 'bg-rl-cyan',    text: 'text-rl-cyan',    activeCls: 'bg-rl-cyan/10 border-rl-cyan/40 text-rl-cyan'          },
  { value: 'churn',           label: 'Churn',           dot: 'bg-red-600',    text: 'text-red-600',    activeCls: 'bg-red-700/10 border-red-700/40 text-red-600'          },
]

function MomentoBadge({ momento }) {
  if (!momento) return null
  const cfg = MOMENTO_OPTIONS.find(m => m.value === momento)
  if (!cfg) return null
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${cfg.activeCls}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
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

function ProjectCard({ project, onClick, onDelete }) {
  const daysSince = Math.floor(
    (Date.now() - new Date(project.createdAt).getTime()) / 86400000
  )
  const daysLeft = project.contractDate
    ? Math.ceil((new Date(project.contractDate).getTime() - Date.now()) / 86400000)
    : null

  return (
    <div onClick={onClick} className="glass-card p-5 hover:border-rl-purple/40 transition-all duration-200 cursor-pointer group relative">
      {/* Delete button */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="absolute top-3 right-3 p-1.5 rounded-lg text-rl-muted opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-400/10 transition-all duration-150 z-10"
        aria-label="Excluir projeto"
        title="Excluir projeto"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {/* Header */}
      <div className="mb-1">
        <h3 className="font-semibold text-rl-text group-hover:text-rl-purple transition-colors leading-tight pr-8">
          {project.companyName}
        </h3>
      </div>
      <p className="text-rl-muted text-xs mb-3">{project.responsibleName}{project.responsibleRole ? ` · ${project.responsibleRole}` : ''}</p>

      {/* Squad + Risk + Momento */}
      <div className="mb-3 flex items-center gap-2 flex-wrap">
        <SquadBadge name={project.squadName} emoji={project.squadEmoji} colorIndex={project.squadColorIndex} members={project.squadMembers ?? []} />
        <RiskBadge riskLevel={project.riskLevel} />
        <MomentoBadge momento={project.momento} />
      </div>

      {/* Progress */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-rl-muted">Progresso</span>
          <span className="text-xs font-semibold text-rl-purple">{project.progress}%</span>
        </div>
        <div className="h-1.5 bg-rl-surface rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-rl rounded-full progress-fill"
            style={{ width: `${project.progress}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-rl-muted">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>Iniciado há {daysSince}d</span>
        </div>
        {daysLeft !== null && (
          <div className={`flex items-center gap-1 ${daysLeft < 7 ? 'text-rl-red' : 'text-rl-muted'}`}>
            <Calendar className="w-3 h-3" />
            <span>{daysLeft > 0 ? `${daysLeft}d restantes` : 'Vencido'}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function ClientProfileCard({ project, onClick, onDelete }) {
  const daysSince = Math.floor(
    (Date.now() - new Date(project.createdAt).getTime()) / 86400000
  )
  const totalInvestimento = project.roiResult?.totalInvestimento
  const personaCount = project.personas?.length || 0
  const ofertaNome = project.ofertaData?.nome

  return (
    <div
      onClick={onClick}
      className="glass-card p-5 border border-rl-green/30 hover:border-rl-green/60 transition-all duration-200 cursor-pointer group relative"
    >
      {/* Delete button */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="absolute top-3 right-3 p-1.5 rounded-lg text-rl-muted opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-400/10 transition-all duration-150 z-10"
        aria-label="Excluir projeto"
        title="Excluir projeto"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {/* Header */}
      <div className="flex items-center gap-3 min-w-0 mb-1">
        <div className="w-9 h-9 rounded-xl bg-rl-green/10 flex items-center justify-center shrink-0">
          <FileText className="w-4 h-4 text-rl-green" />
        </div>
        <div className="min-w-0 pr-8">
          <h3 className="font-semibold text-rl-text group-hover:text-rl-purple transition-colors truncate">
            {project.companyName}
          </h3>
          <p className="text-rl-muted text-xs mt-0.5 truncate">
            {project.businessType && <span className="mr-1">{project.businessType} ·</span>}
            {project.responsibleName}
          </p>
        </div>
      </div>

      {/* Squad + Risk + Momento */}
      <div className="mt-3 mb-3 flex items-center gap-2 flex-wrap">
        <SquadBadge name={project.squadName} emoji={project.squadEmoji} colorIndex={project.squadColorIndex} members={project.squadMembers ?? []} />
        <RiskBadge riskLevel={project.riskLevel} />
        <MomentoBadge momento={project.momento} />
      </div>

      {/* Chips de resumo */}
      <div className="flex flex-wrap gap-2 mb-4">
        {totalInvestimento && (
          <div className="flex items-center gap-1.5 bg-rl-surface px-2.5 py-1 rounded-lg">
            <DollarSign className="w-3 h-3 text-rl-purple" />
            <span className="text-xs text-rl-text">{fmtCurrency(totalInvestimento)}/mês</span>
          </div>
        )}
        {personaCount > 0 && (
          <div className="flex items-center gap-1.5 bg-rl-surface px-2.5 py-1 rounded-lg">
            <Users className="w-3 h-3 text-rl-blue" />
            <span className="text-xs text-rl-text">{personaCount} persona{personaCount > 1 ? 's' : ''}</span>
          </div>
        )}
        {ofertaNome && (
          <div className="flex items-center gap-1.5 bg-rl-surface px-2.5 py-1 rounded-lg max-w-full overflow-hidden">
            <Zap className="w-3 h-3 text-rl-gold shrink-0" />
            <span className="text-xs text-rl-text truncate">{ofertaNome}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-rl-muted">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>Criado há {daysSince}d</span>
        </div>
        <div className="flex items-center gap-1 text-rl-green/70">
          <CheckCircle2 className="w-3 h-3" />
          <span>Documentação completa</span>
        </div>
      </div>
    </div>
  )
}

// ─── Squad Dropdown ───────────────────────────────────────────────────────────

function SquadDropdown({ squadFilter, setSquadFilter, squads, counts }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const activeSquad = squads.find(s => String(s.id) === String(squadFilter))
  const label = activeSquad ? (activeSquad.emoji ? `${activeSquad.emoji} ${activeSquad.name}` : activeSquad.name) : 'Squad'
  const isFiltered = !!activeSquad

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-2 h-[38px] px-3 rounded-xl border text-sm font-medium transition-all ${
          isFiltered
            ? 'bg-rl-purple/10 border-rl-purple/40 text-rl-purple'
            : 'bg-rl-surface border-rl-border text-rl-muted hover:text-rl-text hover:border-rl-purple/30'
        }`}
      >
        <Users className="w-3.5 h-3.5 shrink-0" />
        <span className="max-w-[120px] truncate">{label}</span>
        {isFiltered
          ? <span
              role="button"
              onClick={(e) => { e.stopPropagation(); setSquadFilter('all') }}
              className="ml-0.5 rounded-full hover:bg-rl-purple/20 p-0.5 transition-colors"
            ><X className="w-3 h-3" /></span>
          : <ChevronDown className={`w-3.5 h-3.5 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
        }
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-52 glass-card border border-rl-border shadow-xl py-1 rounded-xl overflow-hidden">
          <button
            onClick={() => { setSquadFilter('all'); setOpen(false) }}
            className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-rl-surface/80 ${
              !isFiltered ? 'text-rl-purple font-semibold' : 'text-rl-muted'
            }`}
          >
            <span>Todos os squads</span>
            {!isFiltered && <span className="w-1.5 h-1.5 rounded-full bg-rl-purple" />}
          </button>

          {squads.length > 0 && <div className="border-t border-rl-border/60 my-1" />}

          {squads.map((s, idx) => {
            const isActive = String(squadFilter) === String(s.id)
            const c = SQUAD_COLORS[idx % SQUAD_COLORS.length]
            const count = counts?.squads?.[String(s.id)] ?? 0
            return (
              <button
                key={s.id}
                onClick={() => { setSquadFilter(String(s.id)); setOpen(false) }}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-rl-surface/80 ${
                  isActive ? 'text-rl-text font-medium' : 'text-rl-muted'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${c.bg.replace('/15', '')}`} />
                  <span className="truncate">{s.emoji ? `${s.emoji} ${s.name}` : s.name}</span>
                </div>
                <span className="text-[11px] text-rl-muted bg-rl-surface px-1.5 py-0.5 rounded-full shrink-0">
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Risk Dropdown ────────────────────────────────────────────────────────────

const RISK_OPTIONS = [
  { value: 'em_risco', label: 'Em Risco',  dot: 'bg-red-400',   text: 'text-red-400',   activeCls: 'bg-red-400/10 border-red-400/40 text-red-400'    },
  { value: 'neutro',   label: 'Neutro',    dot: 'bg-rl-gold',   text: 'text-rl-gold',   activeCls: 'bg-rl-gold/10 border-rl-gold/40 text-rl-gold'    },
  { value: 'saudavel', label: 'Saudável',  dot: 'bg-rl-green',  text: 'text-rl-green',  activeCls: 'bg-rl-green/10 border-rl-green/40 text-rl-green' },
]

function RiskDropdown({ riskFilter, setRiskFilter, counts }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const active = RISK_OPTIONS.find(r => r.value === riskFilter)

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-2 h-[38px] px-3 rounded-xl border text-sm font-medium transition-all ${
          active
            ? active.activeCls
            : 'bg-rl-surface border-rl-border text-rl-muted hover:text-rl-text hover:border-rl-purple/30'
        }`}
      >
        {active
          ? <><span className={`w-2 h-2 rounded-full shrink-0 ${active.dot}`} />{active.label}</>
          : <><Eye className="w-3.5 h-3.5 shrink-0" />Risco</>
        }
        {active
          ? <span
              role="button"
              onClick={(e) => { e.stopPropagation(); setRiskFilter('all') }}
              className="ml-0.5 rounded-full hover:opacity-70 p-0.5 transition-opacity"
            ><X className="w-3 h-3" /></span>
          : <ChevronDown className={`w-3.5 h-3.5 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
        }
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-48 glass-card border border-rl-border shadow-xl py-1 rounded-xl overflow-hidden">
          <button
            onClick={() => { setRiskFilter('all'); setOpen(false) }}
            className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-rl-surface/80 ${
              !active ? 'text-rl-purple font-semibold' : 'text-rl-muted'
            }`}
          >
            <span>Todos</span>
            {!active && <span className="w-1.5 h-1.5 rounded-full bg-rl-purple" />}
          </button>
          <div className="border-t border-rl-border/60 my-1" />
          {RISK_OPTIONS.map(r => {
            const isActive = riskFilter === r.value
            const count = counts?.risks?.[r.value] ?? 0
            return (
              <button
                key={r.value}
                onClick={() => { setRiskFilter(r.value); setOpen(false) }}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-rl-surface/80 ${
                  isActive ? `${r.text} font-medium` : 'text-rl-muted'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${r.dot}`} />
                  {r.label}
                </div>
                <span className="text-[11px] text-rl-muted bg-rl-surface px-1.5 py-0.5 rounded-full shrink-0">{count}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Momento Dropdown ─────────────────────────────────────────────────────────

function MomentoDropdown({ momentoFilter, setMomentoFilter, counts }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const active = MOMENTO_OPTIONS.find(m => m.value === momentoFilter)

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-2 h-[38px] px-3 rounded-xl border text-sm font-medium transition-all ${
          active
            ? active.activeCls
            : 'bg-rl-surface border-rl-border text-rl-muted hover:text-rl-text hover:border-rl-purple/30'
        }`}
      >
        {active
          ? <><span className={`w-2 h-2 rounded-full shrink-0 ${active.dot}`} />{active.label}</>
          : <>🎯 Momento</>
        }
        {active
          ? <span
              role="button"
              onClick={(e) => { e.stopPropagation(); setMomentoFilter('all') }}
              className="ml-0.5 rounded-full hover:opacity-70 p-0.5 transition-opacity"
            ><X className="w-3 h-3" /></span>
          : <ChevronDown className={`w-3.5 h-3.5 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
        }
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-52 glass-card border border-rl-border shadow-xl py-1 rounded-xl overflow-hidden">
          <button
            onClick={() => { setMomentoFilter('all'); setOpen(false) }}
            className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-rl-surface/80 ${
              !active ? 'text-rl-purple font-semibold' : 'text-rl-muted'
            }`}
          >
            <span>Todos</span>
            {!active && <span className="w-1.5 h-1.5 rounded-full bg-rl-purple" />}
          </button>
          <div className="border-t border-rl-border/60 my-1" />
          {MOMENTO_OPTIONS.map(m => {
            const isActive = momentoFilter === m.value
            const count = counts?.momentos?.[m.value] ?? 0
            return (
              <button
                key={m.value}
                onClick={() => { setMomentoFilter(m.value); setOpen(false) }}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-rl-surface/80 ${
                  isActive ? `${m.text} font-medium` : 'text-rl-muted'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${m.dot}`} />
                  {m.label}
                </div>
                <span className="text-[11px] text-rl-muted bg-rl-surface px-1.5 py-0.5 rounded-full shrink-0">{count}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── List View ────────────────────────────────────────────────────────────────
const LIST_COLS = [
  { key: 'companyName',     label: 'Empresa'             },
  { key: 'squadName',       label: 'Squad'               },
  { key: 'responsibleName', label: 'Responsável / Cargo' },
  { key: 'riskLevel',       label: 'Risco'               },
  { key: 'momento',         label: 'Momento'             },
  { key: 'progress',        label: 'Progresso'           },
  { key: 'contractValue',   label: 'Contrato'            },
  { key: 'createdAt',       label: 'Criado em'           },
]


function SortIcon({ col, sortBy, sortDir }) {
  if (sortBy !== col) return <ChevronsUpDown className="w-3 h-3 text-rl-muted/40" />
  return sortDir === 'asc'
    ? <ChevronUp   className="w-3 h-3 text-rl-purple" />
    : <ChevronDown className="w-3 h-3 text-rl-purple" />
}

const RISK_GROUPS = [
  { value: 'em_risco', label: 'Em Risco', dot: 'bg-red-400',  text: 'text-red-400',  border: 'border-red-400/30',  bg: 'bg-red-400/5'  },
  { value: 'neutro',   label: 'Neutro',   dot: 'bg-rl-gold',  text: 'text-rl-gold',  border: 'border-rl-gold/30',  bg: 'bg-rl-gold/5'  },
  { value: 'saudavel', label: 'Saudável', dot: 'bg-rl-green', text: 'text-rl-green', border: 'border-rl-green/30', bg: 'bg-rl-green/5' },
  { value: null,       label: 'Sem Risco',dot: 'bg-rl-muted', text: 'text-rl-muted', border: 'border-rl-border',   bg: 'bg-rl-surface/30' },
]


function ProjectListView({ projects, onNavigate, onDelete, groupByRisk = false }) {
  const [sortBy,  setSortBy]  = useState('createdAt')
  const [sortDir, setSortDir] = useState('desc')

  function handleSort(key) {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(key); setSortDir('asc') }
  }

  const sorted = [...projects].sort((a, b) => {
    let av = a[sortBy] ?? ''
    let bv = b[sortBy] ?? ''
    if (sortBy === 'progress' || sortBy === 'contractValue') {
      av = Number(av) || 0; bv = Number(bv) || 0
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

  function renderRow(p, isLast) {
    const createdStr = p.createdAt
      ? new Date(p.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
      : '—'
    return (
      <tr
        key={p.id}
        onClick={() => onNavigate(p.id)}
        className={`cursor-pointer transition-colors hover:bg-rl-surface/50 group
          ${!isLast ? 'border-b border-rl-border/50' : ''}`}
      >
        {/* Empresa */}
        <td className="px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-rl-text group-hover:text-rl-purple transition-colors leading-tight">
              {p.companyName}
            </span>
            {p.businessType && (
              <span className="text-[10px] text-rl-muted">{p.businessType}</span>
            )}
          </div>
        </td>

        {/* Squad */}
        <td className="px-4 py-3">
          <SquadBadge name={p.squadName} emoji={p.squadEmoji} colorIndex={p.squadColorIndex} members={p.squadMembers ?? []} />
        </td>

        {/* Responsável / Cargo */}
        <td className="px-4 py-3">
          {p.responsibleName
            ? <div className="flex flex-col">
                <span className="text-rl-text leading-tight">{p.responsibleName}</span>
                {p.responsibleRole && (
                  <span className="text-xs text-rl-muted mt-0.5">{p.responsibleRole}</span>
                )}
              </div>
            : <span className="text-rl-muted">—</span>
          }
        </td>

        {/* Risco */}
        <td className="px-4 py-3">
          {p.riskLevel
            ? <RiskBadge riskLevel={p.riskLevel} />
            : <span className="text-rl-muted">—</span>
          }
        </td>

        {/* Momento */}
        <td className="px-4 py-3">
          {p.momento
            ? <MomentoBadge momento={p.momento} />
            : <span className="text-rl-muted">—</span>
          }
        </td>

        {/* Progresso */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2 min-w-[80px]">
            <div className="flex-1 h-1.5 bg-rl-surface rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-rl rounded-full"
                style={{ width: `${p.progress ?? 0}%` }}
              />
            </div>
            <span className="text-xs text-rl-muted w-7 text-right shrink-0">
              {p.progress ?? 0}%
            </span>
          </div>
        </td>

        {/* Contrato */}
        <td className="px-4 py-3 text-rl-muted whitespace-nowrap">
          {p.contractValue ? fmtCurrency(Number(p.contractValue)) : '—'}
        </td>

        {/* Criado em */}
        <td className="px-4 py-3 text-rl-muted whitespace-nowrap text-xs">
          {createdStr}
        </td>

        {/* Ações */}
        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onDelete(p)}
            aria-label="Excluir projeto"
            title="Excluir projeto"
            className="p-1.5 rounded-lg text-rl-muted opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-400/10 transition-all"
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
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-rl-border">
              {LIST_COLS.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-4 py-3 text-left text-xs font-semibold text-rl-muted uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:text-rl-text transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    {col.label}
                    <SortIcon col={col.key} sortBy={sortBy} sortDir={sortDir} />
                  </span>
                </th>
              ))}
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => renderRow(p, i === rows.length - 1))}
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
    <div className="space-y-6">
      {groups.map(g => (
        <div
          key={g.value ?? 'sem_risco'}
          className={`glass-card overflow-hidden border ${g.border}`}
        >
          <div className={`flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 border-b border-rl-border/60 ${g.bg}`}>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${g.dot}`} />
              <span className={`text-sm font-bold uppercase tracking-wider ${g.text}`}>{g.label}</span>
              <span className="text-xs text-rl-muted bg-rl-surface border border-rl-border px-2 py-0.5 rounded-full">
                {g.rows.length} {g.rows.length === 1 ? 'cliente' : 'clientes'}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-6">
              {g.totalVal > 0 && (
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-rl-muted">Contrato Cheio</span>
                  <span className={`text-2xl font-bold leading-tight ${g.text}`}>{fmtCurrency(g.totalVal)}</span>
                </div>
              )}
              {g.totalMRR > 0 && (
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-rl-muted">MRR</span>
                  <span className={`text-2xl font-bold leading-tight ${g.text}`}>{fmtCurrency(g.totalMRR)}</span>
                </div>
              )}
            </div>
          </div>
          {renderTable(g.rows)}
        </div>
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
    loadingProjects, isSupabaseReady, teamMembers, squads,
  } = useApp()
  const navigate = useNavigate()
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [filter, setFilter] = useState('all') // 'all' | 'onboarding' | 'active' | accountId
  const [squadFilter, setSquadFilter] = useState('all') // 'all' | squadId
  const [riskFilter, setRiskFilter] = useState('all') // 'all' | 'em_risco' | 'neutro' | 'saudavel'
  const [momentoFilter, setMomentoFilter] = useState('all') // 'all' | momento value
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [view, setView] = useState(() => localStorage.getItem('rl_dashboard_view') || 'grid')
  const [churnListOpen, setChurnListOpen] = useState(false)

  function switchView(v) { setView(v); localStorage.setItem('rl_dashboard_view', v) }

  const isAdmin = user?.role === 'admin'

  // Squads marcados como "Em teste" são excluídos de todas as agregações
  // e da listagem da home — visualização permanece via /squads-report.
  const testSquadIds = new Set(squads.filter(s => s.isTest).map(s => String(s.id)))

  // RLS no Supabase já filtra: admins veem tudo; accounts veem apenas projetos
  // cujo squad atribuído inclui o usuário como membro
  const baseProjects = testSquadIds.size > 0
    ? projects.filter(p => !p.squad || !testSquadIds.has(String(p.squad)))
    : projects

  // Apply status/member filter
  const filteredProjects = (() => {
    let result = baseProjects
    if (filter === 'churn')            result = result.filter(p => p.momento === 'churn')
    else if (filter === 'onboarding') result = result.filter(p => p.status === 'onboarding')
    else if (filter === 'active')     result = result.filter(p => p.status === 'active')
    else if (filter !== 'all')        result = result.filter(p => String(p.accountId) === String(filter))
    if (squadFilter   !== 'all')      result = result.filter(p => String(p.squad) === String(squadFilter))
    if (riskFilter    !== 'all')      result = result.filter(p => p.riskLevel === riskFilter)
    if (momentoFilter !== 'all')      result = result.filter(p => p.momento === momentoFilter)
    else if (filter !== 'churn')      result = result.filter(p => p.momento !== 'churn')
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
  }

  // Derive page title from filter
  const pageTitle = (() => {
    if (filter === 'all')        return 'Clientes'
    if (filter === 'churn')      return 'Churn'
    if (filter === 'onboarding') return 'Em Onboarding'
    if (filter === 'active')     return 'Perfis Ativos'
    const member = teamMembers.find(m => String(m.id) === String(filter))
    return member ? `Clientes de ${member.name.split(' ')[0]}` : 'Clientes'
  })()

  function riskCounts(list) {
    return {
      em_risco: list.filter(p => p.riskLevel === 'em_risco').length,
      neutro:   list.filter(p => p.riskLevel === 'neutro').length,
      saudavel: list.filter(p => p.riskLevel === 'saudavel').length,
      vazio:    list.filter(p => !p.riskLevel).length,
    }
  }

  const MOMENTO_CARDS = [
    { value: 'onboarding',      label: 'Em Onboarding',   icon: <Clock    className="w-5 h-5" />, color: 'text-orange-400', bg: 'bg-orange-400/10' },
    { value: 'voo_de_cruzeiro', label: 'Voo de Cruzeiro', icon: <Cloud    className="w-5 h-5" />, color: 'text-rl-cyan',    bg: 'bg-rl-cyan/10'    },
    { value: 'aceleracao',      label: 'Aceleração',      icon: <Zap      className="w-5 h-5" />, color: 'text-rl-green',   bg: 'bg-rl-green/10'   },
    { value: null,              label: 'Sem Momento',     icon: <Layers   className="w-5 h-5" />, color: 'text-rl-muted',   bg: 'bg-rl-muted/10'   },
  ]

  const stats = [
    ...MOMENTO_CARDS.map(m => {
      const group = baseProjects.filter(p =>
        m.value === null ? (!p.momento || p.momento === '') : p.momento === m.value
      )
      return { ...m, count: group.length, risks: riskCounts(group) }
    }),
    {
      label: 'Total de Clientes',
      count: baseProjects.filter(p => p.momento !== 'churn').length,
      icon:  <BarChart3 className="w-5 h-5" />,
      color: 'text-rl-purple',
      bg:    'bg-rl-purple/10',
      risks: riskCounts(baseProjects.filter(p => p.momento !== 'churn')),
    },
  ]

  // ── Resumo financeiro + churn do mês corrente ─────────────────────────────
  const _now      = new Date()
  const _yyyy     = _now.getFullYear()
  const _mm       = _now.getMonth()
  const _monthsPT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  const monthLabel = `${_monthsPT[_mm]} ${_yyyy}`

  const activeBase  = baseProjects.filter(p => p.momento !== 'churn')
  const totalContract = activeBase.reduce((acc, p) => acc + (Number(p.contractValue) || 0), 0)
  const totalMRR      = activeBase.reduce((acc, p) => acc + mrrValue(p), 0)

  const churnedThisMonth = baseProjects.filter(p => {
    if (p.momento !== 'churn' || !p.churnDate) return false
    const d = new Date(p.churnDate + 'T00:00:00')
    return d.getFullYear() === _yyyy && d.getMonth() === _mm
  }).map(p => {
    const squad = squads.find(s => String(s.id) === String(p.squad)) || null
    return { ...p, _squadName: squad?.name ?? null, _squadEmoji: squad?.emoji ?? null }
  }).sort((a, b) => (b.churnDate || '').localeCompare(a.churnDate || ''))

  const churnCount    = churnedThisMonth.length
  const churnMRR      = churnedThisMonth.reduce((acc, p) => acc + mrrValue(p), 0)
  const churnContract = churnedThisMonth.reduce((acc, p) => acc + (Number(p.contractValue) || 0), 0)

  return (
    <div className="min-h-screen flex bg-gradient-dark">

      {/* ── Sidebar ─────────────────────────────────────── */}
      <AppSidebar
        filter={filter}
        setFilter={setFilter}
        counts={counts}
        activeAccounts={activeAccounts}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* ── Main content ────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 border-b border-rl-border bg-rl-bg/90 backdrop-blur-xl">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menu de navegação"
            className="p-2 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-rl flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-rl-text text-sm">Revenue Lab</span>
          </div>
        </div>

        <main className="flex-1 px-6 py-8 space-y-8">

          {/* Welcome */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-slide-up">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-bold text-rl-text">
                  Olá, {user.name.split(' ')[0]} 👋
                </h1>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-rl-purple/10 text-rl-purple border border-rl-purple/20">
                  <Eye className="w-3 h-3" />
                  {isAdmin ? 'Visão Admin' : 'Visão Geral'}
                </span>
              </div>
              <p className="text-rl-muted mt-1 text-sm">
                Bem-vindo ao Revenue Lab Internal
              </p>
            </div>
            <button
              onClick={() => navigate('/onboarding/new')}
              className="hidden sm:flex btn-primary items-center gap-2 whitespace-nowrap animate-pulse-glow"
            >
              <Plus className="w-4 h-4" />
              Novo Cliente
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 animate-slide-up" style={{ animationDelay: '0.05s' }}>
            {stats.map((s) => (
              <div key={s.label} className="glass-card p-5">
                <div className="flex items-start justify-between gap-2 mb-0">
                  <div>
                    <p className="text-2xl font-bold text-rl-text">{s.count}</p>
                    <p className={`text-xs mt-0.5 ${s.count === 0 ? 'text-rl-muted/50' : 'text-rl-muted'}`}>{s.label}</p>
                  </div>
                  <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center shrink-0 ${s.color}`}>
                    {s.icon}
                  </div>
                </div>

                {s.risks && (s.risks.em_risco > 0 || s.risks.neutro > 0 || s.risks.saudavel > 0 || s.risks.vazio > 0) && (
                  <div className="mt-3 pt-3 border-t border-rl-border space-y-1.5">
                    {s.risks.em_risco > 0 && (
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5 text-rl-muted">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                          Em Risco
                        </div>
                        <span className="font-semibold text-red-400">{s.risks.em_risco}</span>
                      </div>
                    )}
                    {s.risks.neutro > 0 && (
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5 text-rl-muted">
                          <span className="w-1.5 h-1.5 rounded-full bg-rl-gold shrink-0" />
                          Neutro
                        </div>
                        <span className="font-semibold text-rl-gold">{s.risks.neutro}</span>
                      </div>
                    )}
                    {s.risks.saudavel > 0 && (
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5 text-rl-muted">
                          <span className="w-1.5 h-1.5 rounded-full bg-rl-green shrink-0" />
                          Saudável
                        </div>
                        <span className="font-semibold text-rl-green">{s.risks.saudavel}</span>
                      </div>
                    )}
                    {s.risks.vazio > 0 && (
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5 text-rl-muted">
                          <span className="w-1.5 h-1.5 rounded-full bg-rl-muted/40 shrink-0" />
                          Sem risco
                        </div>
                        <span className="font-semibold text-rl-muted">{s.risks.vazio}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Resumo financeiro + churn do mês corrente */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            {/* Contrato Cheio total */}
            <div className="glass-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-rl-muted">Contrato Cheio</p>
                  <p className="text-2xl font-bold text-rl-text mt-1 leading-tight">{fmtCurrency(totalContract)}</p>
                  <p className="text-[11px] text-rl-muted mt-1">
                    {activeBase.length} {activeBase.length === 1 ? 'cliente ativo' : 'clientes ativos'}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-rl-cyan/10 text-rl-cyan flex items-center justify-center shrink-0">
                  <Wallet className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* MRR total */}
            <div className="glass-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-rl-muted">MRR</p>
                  <p className="text-2xl font-bold text-rl-text mt-1 leading-tight">{fmtCurrency(totalMRR)}</p>
                  <p className="text-[11px] text-rl-muted mt-1">Receita mensal recorrente</p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-rl-green/10 text-rl-green flex items-center justify-center shrink-0">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Churn do mês — clicável para abrir lista */}
            <button
              type="button"
              onClick={() => churnCount > 0 && setChurnListOpen(true)}
              disabled={churnCount === 0}
              className={`glass-card p-5 text-left transition-all ${
                churnCount > 0
                  ? 'border-red-400/30 cursor-pointer hover:border-red-400/60 hover:bg-red-400/5'
                  : 'cursor-default'
              }`}
              title={churnCount > 0 ? 'Ver lista de clientes que churnaram este mês' : ''}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-rl-muted">Churn — {monthLabel}</p>
                  <p className={`text-2xl font-bold mt-1 leading-tight ${churnCount > 0 ? 'text-red-400' : 'text-rl-text'}`}>
                    {churnCount} {churnCount === 1 ? 'cliente' : 'clientes'}
                  </p>
                  {churnCount > 0 ? (
                    <div className="mt-1.5 space-y-0.5">
                      <p className="text-[11px] text-rl-muted">
                        <span className="text-red-400 font-semibold">{fmtCurrency(churnMRR)}</span> em MRR perdido
                      </p>
                      <p className="text-[11px] text-rl-muted">
                        <span className="text-red-400 font-semibold">{fmtCurrency(churnContract)}</span> em contrato cheio
                      </p>
                      <p className="text-[10px] text-red-400/80 mt-1 font-medium">Clique para ver lista →</p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-rl-muted mt-1">Nenhum churn neste mês</p>
                  )}
                </div>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${churnCount > 0 ? 'bg-red-400/10 text-red-400' : 'bg-rl-muted/10 text-rl-muted'}`}>
                  <TrendingDown className="w-5 h-5" />
                </div>
              </div>
            </button>
          </div>

          {/* Projects */}
          <div className="animate-slide-up" style={{ animationDelay: '0.15s' }}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
              {/* Title + count */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-rl-text">{pageTitle}</h2>
                {visibleProjects.length > 0 && (
                  <span className="text-xs bg-rl-cyan/10 text-rl-cyan border border-rl-cyan/30 px-2 py-0.5 rounded-full font-medium">
                    {visibleProjects.length}
                  </span>
                )}
              </div>

              {/* Search input */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-rl-muted pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nome..."
                  className="input-field w-full pl-8 pr-8 py-2 text-sm"
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

              {/* Squad filter dropdown */}
              {squads.length > 0 && (
                <SquadDropdown
                  squadFilter={squadFilter}
                  setSquadFilter={setSquadFilter}
                  squads={squads}
                  counts={counts}
                />
              )}

              {/* Risk filter dropdown */}
              <RiskDropdown riskFilter={riskFilter} setRiskFilter={setRiskFilter} counts={counts} />

              {/* Momento filter dropdown */}
              <MomentoDropdown momentoFilter={momentoFilter} setMomentoFilter={setMomentoFilter} counts={counts} />

              {/* Dashboard de Squads — relatório por squad (acesso restrito) */}
              {canViewSquadsReport(user) && (
                <button
                  onClick={() => navigate('/squads-report')}
                  className="flex items-center gap-2 h-[38px] px-3 rounded-xl border border-rl-purple/40 bg-rl-purple/10 text-rl-purple text-sm font-medium hover:bg-rl-purple/20 transition-all whitespace-nowrap shrink-0"
                  title="Abrir relatório por squad"
                >
                  <Users2 className="w-4 h-4" />
                  <span className="hidden md:inline">Dashboard de Squads</span>
                </button>
              )}

              {/* View switcher */}
              <div className="flex items-center gap-1 bg-rl-surface border border-rl-border rounded-xl p-1 shrink-0">
                <button
                  onClick={() => switchView('grid')}
                  aria-label="Visualização em cards"
                  title="Cards"
                  className={`p-1.5 rounded-lg transition-all ${
                    view === 'grid'
                      ? 'bg-rl-purple text-white shadow-sm'
                      : 'text-rl-muted hover:text-rl-text'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => switchView('list')}
                  aria-label="Visualização em lista"
                  title="Lista"
                  className={`p-1.5 rounded-lg transition-all ${
                    view === 'list'
                      ? 'bg-rl-purple text-white shadow-sm'
                      : 'text-rl-muted hover:text-rl-text'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>

            {loadingProjects ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-rl-muted">
                <Loader2 className="w-8 h-8 animate-spin text-rl-purple" />
                <p className="text-sm">Carregando projetos da nuvem...</p>
              </div>
            ) : visibleProjects.length === 0 && !query ? (
              <div className="grid grid-cols-1">
                <EmptyState onNew={() => navigate('/onboarding/new')} />
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
            ) : view === 'list' ? (
              <ProjectListView
                projects={visibleProjects}
                onNavigate={(id) => navigate(`/project/${id}`)}
                onDelete={(p) => setDeleteTarget(p)}
                groupByRisk={momentoFilter === 'all' && riskFilter === 'all'}
              />
            ) : (momentoFilter !== 'all' || riskFilter !== 'all') ? (
              /* Flat grid when any filter is active */
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {visibleProjects.map((p) =>
                  isProfileComplete(p)
                    ? <ClientProfileCard key={p.id} project={p} onClick={() => navigate(`/project/${p.id}`)} onDelete={() => setDeleteTarget(p)} />
                    : <ProjectCard       key={p.id} project={p} onClick={() => navigate(`/project/${p.id}`)} onDelete={() => setDeleteTarget(p)} />
                )}
              </div>
            ) : (
              /* Grouped by risk when no filter active — order: Em Risco → Neutro → Saudável → Sem Risco */
              <div className="space-y-8">
                {RISK_GROUPS.map(group => {
                  const grouped = visibleProjects.filter(p =>
                    group.value === null ? !p.riskLevel : p.riskLevel === group.value
                  )
                  if (grouped.length === 0) return null
                  const totalVal = grouped.reduce((acc, p) => acc + (Number(p.contractValue) || 0), 0)
                  const totalMRR = grouped.reduce((acc, p) => acc + mrrValue(p), 0)
                  return (
                    <div key={group.value ?? 'none'}>
                      <div className={`flex flex-wrap items-center gap-x-6 gap-y-3 mb-4 px-4 py-3 rounded-xl border ${group.border} ${group.bg}`}>
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${group.dot}`} />
                          <span className={`text-sm font-bold uppercase tracking-wider ${group.text}`}>{group.label}</span>
                          <span className="text-xs text-rl-muted bg-rl-surface border border-rl-border px-2 py-0.5 rounded-full">
                            {grouped.length} {grouped.length === 1 ? 'cliente' : 'clientes'}
                          </span>
                        </div>
                        <div className="ml-auto flex items-center gap-6">
                          {totalVal > 0 && (
                            <div className="flex flex-col items-end">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-rl-muted">Contrato Cheio</span>
                              <span className={`text-2xl font-bold leading-tight ${group.text}`}>{fmtCurrency(totalVal)}</span>
                            </div>
                          )}
                          {totalMRR > 0 && (
                            <div className="flex flex-col items-end">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-rl-muted">MRR</span>
                              <span className={`text-2xl font-bold leading-tight ${group.text}`}>{fmtCurrency(totalMRR)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {grouped.map((p) =>
                          isProfileComplete(p)
                            ? <ClientProfileCard key={p.id} project={p} onClick={() => navigate(`/project/${p.id}`)} onDelete={() => setDeleteTarget(p)} />
                            : <ProjectCard       key={p.id} project={p} onClick={() => navigate(`/project/${p.id}`)} onDelete={() => setDeleteTarget(p)} />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </main>
      </div>

      {deleteTarget && (
        <DeleteConfirmModal
          project={deleteTarget}
          onConfirm={() => { deleteProject(deleteTarget.id); setDeleteTarget(null) }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {churnListOpen && (
        <Modal onClose={() => setChurnListOpen(false)} maxWidth="2xl" className="border-red-400/30">
          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-red-400/10 border border-red-400/30 flex items-center justify-center text-red-400 shrink-0">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-rl-text">Clientes em Churn — {monthLabel}</h3>
              <p className="text-xs text-rl-muted">
                {churnCount} {churnCount === 1 ? 'cliente saiu' : 'clientes saíram'} neste mês ·
                <span className="text-red-400 font-semibold"> {fmtCurrency(churnMRR)}</span> em MRR ·
                <span className="text-red-400 font-semibold"> {fmtCurrency(churnContract)}</span> em contrato cheio
              </p>
            </div>
          </div>

          {/* Lista */}
          <div className="max-h-[60vh] overflow-y-auto -mx-6 px-6 -mb-6 pb-6">
            <div className="space-y-2">
              {churnedThisMonth.map(p => {
                const dStr = new Date(p.churnDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                const mrr  = mrrValue(p)
                const contract = Number(p.contractValue) || 0
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setChurnListOpen(false); navigate(`/project/${p.id}`) }}
                    className="w-full flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border border-rl-border hover:border-red-400/40 hover:bg-red-400/5 transition-all text-left group"
                  >
                    {/* Identidade */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-rl-text group-hover:text-red-400 transition-colors leading-tight truncate">
                        {p.companyName || '—'}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[11px] text-rl-muted">
                        {p._squadName && (
                          <span className="inline-flex items-center gap-1">
                            {p._squadEmoji && <span>{p._squadEmoji}</span>}
                            {p._squadName}
                          </span>
                        )}
                        {p._squadName && <span>·</span>}
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Saiu em {dStr}
                        </span>
                      </div>
                    </div>

                    {/* Valores */}
                    <div className="flex items-center gap-6 shrink-0">
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wider text-rl-muted font-semibold">MRR</p>
                        <p className="text-sm font-bold text-red-400">{fmtCurrency(mrr)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wider text-rl-muted font-semibold">Contrato</p>
                        <p className="text-sm font-bold text-red-400">{fmtCurrency(contract)}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
