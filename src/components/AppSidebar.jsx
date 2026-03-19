import PropTypes from 'prop-types'
import { useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import {
  Zap, Plus, Layers, Clock, CheckCircle2,
  LogOut, Cloud, CloudOff, Loader2,
  X, UserCog,
} from 'lucide-react'

const NAV_ITEMS = [
  { id: 'all',        label: 'Todos os Clientes', Icon: Layers },
  { id: 'onboarding', label: 'Em Onboarding',    Icon: Clock },
  { id: 'active',    label: 'Perfis Ativos',      Icon: CheckCircle2 },
]

function SidebarContent({
  user, logout,
  filter, counts,
  loadingProjects, isSupabaseReady,
  onNav, onNew, onClose,
  navigate, location,
}) {
  const isAdmin = user?.role === 'admin'
  return (
    <div className="flex flex-col h-full py-4 px-3">

      {/* ── Header ───────────────────────────────────────── */}
      <div className="flex items-center justify-between px-2 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-rl flex items-center justify-center shadow-glow shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-rl-text text-sm leading-none">Revenue Lab</p>
            <p className="text-[10px] text-rl-muted mt-0.5">Internal Tool</p>
          </div>
        </div>
        {/* Mobile close */}
        <button
          onClick={onClose}
          aria-label="Fechar menu de navegação"
          className="lg:hidden p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── New Onboarding CTA ───────────────────────────── */}
      <button
        onClick={onNew}
        className="btn-primary flex items-center justify-center gap-2 mx-1 mb-5 text-sm py-2.5 animate-pulse-glow"
      >
        <Plus className="w-4 h-4" />
        Novo Cliente
      </button>

      {/* ── Navigation ──────────────────────────────────── */}
      <nav className="space-y-0.5 mb-2">
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const count = counts?.[id] ?? 0
          const active = filter === id && location.pathname !== '/users'
          return (
            <button
              key={id}
              onClick={() => onNav(id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
                active
                  ? 'bg-rl-purple/15 text-rl-purple border border-rl-purple/25'
                  : 'text-rl-muted hover:bg-rl-surface hover:text-rl-text border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-rl-purple' : 'text-rl-muted group-hover:text-rl-text'}`} />
                {label}
              </div>
              {count > 0 && (
                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                  active ? 'bg-rl-purple/30 text-rl-purple' : 'bg-rl-surface text-rl-muted'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* ── Spacer ──────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── Cloud status ─────────────────────────────────── */}
      <div className={`mx-1 mb-3 flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all ${
        isSupabaseReady
          ? loadingProjects
            ? 'text-rl-gold border-rl-gold/20 bg-rl-gold/5'
            : 'text-rl-green border-rl-green/20 bg-rl-green/5'
          : 'text-rl-muted border-rl-border bg-rl-surface'
      }`}>
        {isSupabaseReady
          ? loadingProjects
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /><span>Sincronizando...</span></>
            : <><Cloud className="w-3.5 h-3.5 shrink-0" /><span>Dados na nuvem</span></>
          : <><CloudOff className="w-3.5 h-3.5 shrink-0" /><span>Salvando localmente</span></>
        }
      </div>

      {/* ── Divider ─────────────────────────────────────── */}
      <div className="border-t border-rl-border mx-1 mb-3" />

      {/* ── User + actions ──────────────────────────────── */}
      <div className="flex items-center gap-2 px-2">
        <div className="w-8 h-8 rounded-full bg-gradient-rl flex items-center justify-center text-xs font-bold text-white shrink-0">
          {user.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-rl-text leading-none truncate">{user.name.split(' ')[0]}</p>
          <p className="text-[10px] text-rl-muted capitalize mt-0.5">{user.role}</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { navigate('/users'); onClose() }}
            aria-label="Gerenciar usuários"
            title="Usuários"
            className={`p-1.5 rounded-lg transition-all ${
              location.pathname === '/users'
                ? 'text-rl-purple bg-rl-purple/10'
                : 'text-rl-muted hover:text-rl-text hover:bg-rl-surface'
            }`}
          >
            <UserCog className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={logout}
          aria-label="Fazer logout"
          className="p-1.5 rounded-lg text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition-all"
          title="Sair"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>

    </div>
  )
}

export default function AppSidebar({
  filter,
  setFilter,
  counts,
  activeAccounts,
  open,
  onClose,
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, loadingProjects, isSupabaseReady } = useApp()

  const handleNav = (id) => { setFilter(id); onClose() }
  const handleNew = () => { navigate('/onboarding/new'); onClose() }

  const sharedProps = {
    user, logout, filter, counts,
    loadingProjects, isSupabaseReady,
    onNav: handleNav, onNew: handleNew, onClose,
    navigate, location,
  }

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 sticky top-0 h-screen border-r border-rl-border bg-rl-surface overflow-y-auto scroll-hide shadow-[1px_0_0_#D8E0F0]">
        <SidebarContent {...sharedProps} />
      </aside>

      {/* ── Mobile overlay ──────────────────────────────── */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={onClose} />
          <aside className="relative z-10 flex flex-col w-60 h-full border-r border-rl-border bg-rl-surface overflow-y-auto scroll-hide animate-slide-up">
            <SidebarContent {...sharedProps} />
          </aside>
        </div>
      )}
    </>
  )
}

AppSidebar.propTypes = {
  filter:         PropTypes.string.isRequired,
  setFilter:      PropTypes.func.isRequired,
  counts:         PropTypes.shape({
    all:          PropTypes.number,
    onboarding:   PropTypes.number,
    active:       PropTypes.number,
  }),
  activeAccounts: PropTypes.arrayOf(
    PropTypes.shape({
      id:     PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      name:   PropTypes.string,
      avatar: PropTypes.string,
    })
  ),
  open:    PropTypes.bool,
  onClose: PropTypes.func,
}
