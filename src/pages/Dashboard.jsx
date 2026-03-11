import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import {
  Zap, Plus, LogOut, Clock, CheckCircle2, Layers,
  Calendar, User,
  BarChart3, FileText, DollarSign, Users,
  Settings, Eye, EyeOff, X, Key, Trash2, AlertTriangle,
  Cloud, CloudOff, Loader2, Menu,
} from 'lucide-react'
import AppSidebar from '../components/AppSidebar'

const CORE_STEPS = ['roi', 'strategy', 'oferta']
function isProfileComplete(project) {
  return CORE_STEPS.every(s => (project.completedSteps || []).includes(s))
}

function fmtCurrency(n) {
  if (!n || isNaN(n) || !isFinite(n)) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
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
    onboarding: 'Onboarding',
    active:     'Ativo',
    paused:     'Pausado',
  }[project.status] || project.status

  return (
    <div onClick={onClick} className="glass-card p-5 hover:border-rl-purple/40 transition-all duration-200 cursor-pointer group relative">
      {/* Delete button */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="absolute top-3 right-3 p-1.5 rounded-lg text-rl-muted opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-400/10 transition-all duration-150 z-10"
        title="Excluir projeto"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-rl-text group-hover:text-white transition-colors">
            {project.companyName}
          </h3>
          <p className="text-rl-muted text-xs mt-0.5">{project.responsibleName} · {project.responsibleRole}</p>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border mr-7 ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      {/* Progress */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-rl-muted">Progresso do Onboarding</span>
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
        <div className="flex items-center gap-1">
          <User className="w-3 h-3" />
          <span>{project.accountName?.split(' ')[0]}</span>
        </div>
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
        title="Excluir projeto"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rl-green/10 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4 text-rl-green" />
          </div>
          <div>
            <h3 className="font-semibold text-rl-text group-hover:text-white transition-colors">
              {project.companyName}
            </h3>
            <p className="text-rl-muted text-xs mt-0.5">
              {project.businessType && <span className="mr-1">{project.businessType} ·</span>}
              {project.responsibleName}
            </p>
          </div>
        </div>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full border text-rl-green bg-rl-green/10 border-rl-green/30 whitespace-nowrap mr-7">
          Perfil Completo
        </span>
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
        <div className="flex items-center gap-1">
          <User className="w-3 h-3" />
          <span>{project.accountName?.split(' ')[0]}</span>
        </div>
      </div>
    </div>
  )
}

function DeleteConfirmModal({ project, onConfirm, onCancel }) {
  const [typed, setTyped] = useState('')
  const canDelete = typed === 'DELETE'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="glass-card w-full max-w-md p-6 border border-red-500/30 animate-slide-up shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-rl-text">Excluir projeto</h2>
            <p className="text-xs text-rl-muted mt-0.5">Esta ação é permanente e não pode ser desfeita.</p>
          </div>
        </div>

        {/* Project name */}
        <div className="rounded-xl bg-rl-surface border border-rl-border px-4 py-3 mb-5">
          <p className="text-[11px] text-rl-muted mb-0.5">Projeto a ser excluído</p>
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
            Excluir projeto
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
      <h3 className="text-lg font-semibold text-rl-text mb-2">Nenhum onboarding ainda</h3>
      <p className="text-rl-muted text-sm mb-6 max-w-xs">
        Crie seu primeiro onboarding de cliente para começar a gerenciar seus projetos.
      </p>
      <button onClick={onNew} className="btn-primary flex items-center gap-2">
        <Plus className="w-4 h-4" />
        Novo Onboarding
      </button>
    </div>
  )
}

function SettingsModal({ onClose }) {
  const { anthropicKey, setAnthropicKey } = useApp()
  const [keyValue, setKeyValue] = useState(anthropicKey)
  const [show, setShow] = useState(false)
  const [saved, setSaved] = useState(false)

  function handleSave() {
    setAnthropicKey(keyValue.trim())
    setSaved(true)
    setTimeout(() => { setSaved(false); onClose() }, 800)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-card w-full max-w-md p-6 border border-rl-border animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-rl-purple" />
            <h2 className="text-lg font-bold text-rl-text">Configurações</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* API Key Field */}
        <div className="space-y-2 mb-6">
          <label className="flex items-center gap-2 text-sm font-semibold text-rl-text">
            <Key className="w-4 h-4 text-rl-gold" />
            Chave da API Anthropic
          </label>
          <p className="text-xs text-rl-muted">
            Usada para gerar personas e ofertas com IA. Salva localmente no navegador.
          </p>
          <div className="flex gap-2 mt-2">
            <input
              type={show ? 'text' : 'password'}
              value={keyValue}
              onChange={(e) => setKeyValue(e.target.value)}
              placeholder="sk-ant-api03-..."
              className="input-field flex-1 text-sm font-mono"
            />
            <button
              onClick={() => setShow((s) => !s)}
              className="p-2 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all"
              title={show ? 'Ocultar' : 'Mostrar'}
            >
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 btn-ghost">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={!keyValue.startsWith('sk-')}
            className="flex-1 btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saved ? '✓ Salvo!' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const {
    user, projects, logout, deleteProject,
    loadingProjects, isSupabaseReady, teamMembers,
  } = useApp()
  const navigate = useNavigate()
  const [showSettings, setShowSettings] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [filter, setFilter] = useState('all') // 'all' | 'onboarding' | 'active' | accountId
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isAdmin = user?.role === 'admin'

  // Admin sees all; regular users see only their own
  const baseProjects = isAdmin
    ? projects
    : projects.filter((p) => p.accountId === user?.id)

  // Apply filter
  const visibleProjects = (() => {
    if (filter === 'all')        return baseProjects
    if (filter === 'onboarding') return baseProjects.filter(p => p.status === 'onboarding')
    if (filter === 'active')     return baseProjects.filter(p => p.status === 'active')
    // Member filter (admin only)
    return baseProjects.filter(p => String(p.accountId) === String(filter))
  })()

  // Accounts that have at least one project (for sidebar team list)
  const activeAccounts = teamMembers.filter(m =>
    baseProjects.some(p => String(p.accountId) === String(m.id))
  )

  // Counts for sidebar nav
  const counts = {
    all:        baseProjects.length,
    onboarding: baseProjects.filter(p => p.status === 'onboarding').length,
    active:     baseProjects.filter(p => p.status === 'active').length,
    members:    Object.fromEntries(
      activeAccounts.map(m => [String(m.id), baseProjects.filter(p => String(p.accountId) === String(m.id)).length])
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
      label: 'Total de Projetos',
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
        onShowSettings={() => setShowSettings(true)}
        counts={counts}
        activeAccounts={isAdmin ? activeAccounts : []}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* ── Main content ────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 border-b border-rl-border bg-rl-bg/90 backdrop-blur-xl">
          <button
            onClick={() => setSidebarOpen(true)}
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

        <main className="flex-1 px-6 py-8 space-y-8 max-w-5xl w-full mx-auto">

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
              Novo Onboarding
            </button>
          </div>

          {/* Admin badge */}
          {isAdmin && (
            <div
              className="flex items-center gap-2 animate-slide-up"
              style={{ animationDelay: '0.03s' }}
            >
              <Eye className="w-3.5 h-3.5 text-rl-purple" />
              <p className="text-xs text-rl-purple font-medium">
                Visão Admin — {projects.length} projeto{projects.length !== 1 ? 's' : ''} no workspace
              </p>
            </div>
          )}

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
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-rl-text">{pageTitle}</h2>
                {visibleProjects.length > 0 && (
                  <span className="text-xs bg-rl-cyan/10 text-rl-cyan border border-rl-cyan/30 px-2 py-0.5 rounded-full font-medium">
                    {visibleProjects.length}
                  </span>
                )}
              </div>
            </div>

            {loadingProjects ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-rl-muted">
                <Loader2 className="w-8 h-8 animate-spin text-rl-purple" />
                <p className="text-sm">Carregando projetos da nuvem...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {visibleProjects.length === 0 ? (
                  <EmptyState onNew={() => navigate('/onboarding/new')} />
                ) : (
                  visibleProjects.map((p) =>
                    isProfileComplete(p)
                      ? <ClientProfileCard key={p.id} project={p} onClick={() => navigate(`/project/${p.id}`)} onDelete={() => setDeleteTarget(p)} />
                      : <ProjectCard       key={p.id} project={p} onClick={() => navigate(`/project/${p.id}`)} onDelete={() => setDeleteTarget(p)} />
                  )
                )}
              </div>
            )}
          </div>

        </main>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

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
