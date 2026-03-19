import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import {
  Zap, Plus, LogOut, Clock, CheckCircle2, Layers,
  Calendar, User,
  BarChart3, FileText, DollarSign, Users,
  Eye, X, Trash2, AlertTriangle,
  Cloud, CloudOff, Loader2, Menu, Search,
  LayoutGrid, List, ChevronUp, ChevronDown, ChevronsUpDown,
} from 'lucide-react'
import AppSidebar from '../components/AppSidebar'
import { SQUAD_COLORS } from '../lib/constants'

const CORE_STEPS = ['roi', 'strategy', 'oferta']
function isProfileComplete(project) {
  return CORE_STEPS.every(s => (project.completedSteps || []).includes(s))
}

function fmtCurrency(n) {
  if (!n || isNaN(n) || !isFinite(n)) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function SquadBadge({ name, emoji, colorIndex = 0, members = [] }) {
  const ref = useRef(null)
  const [tooltipPos, setTooltipPos] = useState(null)

  if (!name) return <span className="text-rl-muted text-xs">—</span>
  const c = SQUAD_COLORS[colorIndex % SQUAD_COLORS.length]

  function handleMouseEnter() {
    if (!members.length || !ref.current) return
    const rect = ref.current.getBoundingClientRect()
    setTooltipPos({ x: rect.left, y: rect.top })
  }

  return (
    <>
      <div
        ref={ref}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setTooltipPos(null)}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border cursor-default ${c.bg} ${c.text} ${c.border}`}
      >
        {emoji && <span className="text-[11px] leading-none">{emoji}</span>}
        <span className="text-[11px] font-semibold whitespace-nowrap">{name}</span>
      </div>

      {tooltipPos && createPortal(
        <div
          style={{ position: 'fixed', left: tooltipPos.x, top: tooltipPos.y - 8, transform: 'translateY(-100%)' }}
          className="z-[9999] pointer-events-none"
        >
          <div className="glass-card border border-rl-border shadow-xl py-2 px-3 rounded-xl min-w-[180px]">
            <p className="text-[10px] font-semibold text-rl-muted uppercase tracking-wider mb-1.5">{name}</p>
            {members.map((m, i) => (
              <div key={i} className="flex items-center justify-between gap-4 py-0.5">
                <span className="text-xs text-rl-text whitespace-nowrap">{m.name}</span>
                <span className="text-[10px] text-rl-muted whitespace-nowrap">{m.role}</span>
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
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

// Funciona com IDs numéricos antigos (1, 2...) e UUIDs do Supabase
function hashId(id) {
  if (!id) return 0
  const n = Number(id)
  if (!isNaN(n) && isFinite(n)) return n
  return String(id).split('').reduce((a, c) => a + c.charCodeAt(0), 0)
}

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

  const statusColor = {
    onboarding: 'text-rl-cyan bg-rl-cyan/10 border-rl-cyan/30',
    active:     'text-rl-green bg-rl-green/10 border-rl-green/30',
    paused:     'text-rl-gold bg-rl-gold/10 border-rl-gold/30',
  }[project.status] || 'text-rl-muted bg-rl-muted/10 border-rl-muted/30'

  const statusLabel = {
    onboarding: 'Em Onboarding',
    active:     'Ativo',
    paused:     'Pausado',
  }[project.status] || project.status

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
      <div className="flex items-start justify-between mb-1">
        <h3 className="font-semibold text-rl-text group-hover:text-rl-purple transition-colors leading-tight">
          {project.companyName}
        </h3>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border mr-7 shrink-0 ml-2 ${statusColor}`}>
          {statusLabel}
        </span>
      </div>
      <p className="text-rl-muted text-xs mb-3">{project.responsibleName}{project.responsibleRole ? ` · ${project.responsibleRole}` : ''}</p>

      {/* Squad */}
      <div className="mb-3">
        <SquadBadge name={project.squadName} emoji={project.squadEmoji} colorIndex={project.squadColorIndex} members={project.squadMembers ?? []} />
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
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-rl-green/10 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4 text-rl-green" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-rl-text group-hover:text-rl-purple transition-colors truncate">
              {project.companyName}
            </h3>
            <p className="text-rl-muted text-xs mt-0.5 truncate">
              {project.businessType && <span className="mr-1">{project.businessType} ·</span>}
              {project.responsibleName}
            </p>
          </div>
        </div>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full border text-rl-green bg-rl-green/10 border-rl-green/30 whitespace-nowrap mr-7 shrink-0 ml-2">
          Perfil Completo
        </span>
      </div>

      {/* Squad */}
      <div className="mt-3 mb-3">
        <SquadBadge name={project.squadName} emoji={project.squadEmoji} colorIndex={project.squadColorIndex} members={project.squadMembers ?? []} />
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
        <ChevronDown className={`w-3.5 h-3.5 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
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

// ─── List View ────────────────────────────────────────────────────────────────
const LIST_COLS = [
  { key: 'companyName',     label: 'Empresa'             },
  { key: 'squadName',       label: 'Squad'               },
  { key: 'responsibleName', label: 'Responsável / Cargo' },
  { key: 'status',          label: 'Status'              },
  { key: 'progress',        label: 'Progresso'           },
  { key: 'contractValue',   label: 'Contrato'            },
  { key: 'createdAt',       label: 'Criado em'           },
]

const STATUS_LABEL = { onboarding: 'Em Onboarding', active: 'Ativo', paused: 'Pausado' }
const STATUS_COLOR = {
  onboarding: 'text-rl-cyan  bg-rl-cyan/10  border-rl-cyan/30',
  active:     'text-rl-green bg-rl-green/10 border-rl-green/30',
  paused:     'text-rl-gold  bg-rl-gold/10  border-rl-gold/30',
}

function SortIcon({ col, sortBy, sortDir }) {
  if (sortBy !== col) return <ChevronsUpDown className="w-3 h-3 text-rl-muted/40" />
  return sortDir === 'asc'
    ? <ChevronUp   className="w-3 h-3 text-rl-purple" />
    : <ChevronDown className="w-3 h-3 text-rl-purple" />
}

function ProjectListView({ projects, onNavigate, onDelete }) {
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

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          {/* Header */}
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

          {/* Body */}
          <tbody>
            {sorted.map((p, i) => {
              const complete = isProfileComplete(p)
              const statusLabel = complete ? 'Perfil Completo' : (STATUS_LABEL[p.status] || p.status)
              const statusColor = complete
                ? 'text-rl-green bg-rl-green/10 border-rl-green/30'
                : (STATUS_COLOR[p.status] || 'text-rl-muted bg-rl-muted/10 border-rl-muted/30')
              const createdStr = p.createdAt
                ? new Date(p.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
                : '—'

              return (
                <tr
                  key={p.id}
                  onClick={() => onNavigate(p.id)}
                  className={`cursor-pointer transition-colors hover:bg-rl-surface/50 group
                    ${i !== sorted.length - 1 ? 'border-b border-rl-border/50' : ''}`}
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

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${statusColor}`}>
                      {statusLabel}
                    </span>
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
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DeleteConfirmModal({ project, onConfirm, onCancel }) {
  const [typed, setTyped] = useState('')
  const canDelete = typed === 'DELETE'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="glass-card w-full max-w-md p-6 border border-red-500/30 animate-slide-up shadow-2xl">
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
      </div>
    </div>
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
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [view, setView] = useState(() => localStorage.getItem('rl_dashboard_view') || 'grid')

  function switchView(v) { setView(v); localStorage.setItem('rl_dashboard_view', v) }

  const isAdmin = user?.role === 'admin'

  // RLS no Supabase já filtra: admins veem tudo; accounts veem apenas projetos
  // cujo squad atribuído inclui o usuário como membro
  const baseProjects = projects

  // Apply status/member filter
  const filteredProjects = (() => {
    let result = baseProjects
    if (filter === 'onboarding')      result = result.filter(p => p.status === 'onboarding')
    else if (filter === 'active')     result = result.filter(p => p.status === 'active')
    else if (filter !== 'all')        result = result.filter(p => String(p.accountId) === String(filter))
    if (squadFilter !== 'all')        result = result.filter(p => String(p.squad) === String(squadFilter))
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
    all:        baseProjects.length,
    onboarding: baseProjects.filter(p => p.status === 'onboarding').length,
    active:     baseProjects.filter(p => p.status === 'active').length,
    members:    Object.fromEntries(
      activeAccounts.map(m => [String(m.id), baseProjects.filter(p => String(p.accountId) === String(m.id)).length])
    ),
    squads:     Object.fromEntries(
      squads.map(s => [String(s.id), baseProjects.filter(p => String(p.squad) === String(s.id)).length])
    ),
  }

  // Derive page title from filter
  const pageTitle = (() => {
    if (filter === 'all')        return 'Clientes'
    if (filter === 'onboarding') return 'Em Onboarding'
    if (filter === 'active')     return 'Perfis Ativos'
    const member = teamMembers.find(m => String(m.id) === String(filter))
    return member ? `Clientes de ${member.name.split(' ')[0]}` : 'Clientes'
  })()

  const stats = [
    {
      label: 'Em Onboarding',
      value: counts.onboarding,
      icon: <Clock className="w-5 h-5" />,
      color: 'text-rl-cyan',
      bg: 'bg-rl-cyan/10',
    },
    {
      label: 'Clientes Ativos',
      value: counts.active,
      icon: <CheckCircle2 className="w-5 h-5" />,
      color: 'text-rl-green',
      bg: 'bg-rl-green/10',
    },
    {
      label: 'Total de Clientes',
      value: baseProjects.length,
      icon: <BarChart3 className="w-5 h-5" />,
      color: 'text-rl-purple',
      bg: 'bg-rl-purple/10',
    },
  ]

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
              <h1 className="text-2xl font-bold text-rl-text">
                Olá, {user.name.split(' ')[0]} 👋
              </h1>
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

          {/* Workspace badge */}
          <div
            className="flex items-center gap-2 animate-slide-up"
            style={{ animationDelay: '0.03s' }}
          >
            <Eye className="w-3.5 h-3.5 text-rl-purple" />
            <p className="text-xs text-rl-purple font-medium">
              {isAdmin ? 'Visão Admin' : 'Visão Geral'} — {projects.length} projeto{projects.length !== 1 ? 's' : ''} no workspace
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up" style={{ animationDelay: '0.05s' }}>
            {stats.map((s) => (
              <div key={s.label} className="glass-card p-5">
                <div className={`w-10 h-10 rounded-xl ${s.bg} flex items-center justify-center mb-3 ${s.color}`}>
                  {s.icon}
                </div>
                <p className="text-2xl font-bold text-rl-text">{s.value}</p>
                <p className="text-rl-muted text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
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
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {visibleProjects.map((p) =>
                  isProfileComplete(p)
                    ? <ClientProfileCard key={p.id} project={p} onClick={() => navigate(`/project/${p.id}`)} onDelete={() => setDeleteTarget(p)} />
                    : <ProjectCard       key={p.id} project={p} onClick={() => navigate(`/project/${p.id}`)} onDelete={() => setDeleteTarget(p)} />
                )}
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
    </div>
  )
}
