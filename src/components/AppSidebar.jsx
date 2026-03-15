import PropTypes from 'prop-types'
import { useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import {
  Zap, Plus, Layers, BarChart3,
  LogOut, Cloud, CloudOff, Loader2,
  X, UserCog,
} from 'lucide-react'

export default function AppSidebar({
  open,             // mobile overlay open
  onClose,
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    user, logout,
    loadingProjects, isSupabaseReady,
  } = useApp()

  const isAdmin    = user?.role === 'admin'
  const isHome     = location.pathname === '/'
  const isOverview = location.pathname === '/overview'

  const handleNew = () => {
    navigate('/onboarding/new')
    onClose()
  }

  const SidebarContent = () => (
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
        onClick={handleNew}
        className="btn-primary flex items-center justify-center gap-2 mx-1 mb-5 text-sm py-2.5 animate-pulse-glow"
      >
        <Plus className="w-4 h-4" />
        Novo Onboarding
      </button>

      {/* ── Navigation ──────────────────────────────────── */}
      <nav className="space-y-0.5 mb-2">
        <button
          onClick={() => { navigate('/overview'); onClose() }}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group border ${
            isOverview
              ? 'bg-rl-purple/15 text-rl-purple border-rl-purple/25'
              : 'text-rl-muted hover:bg-rl-surface hover:text-rl-text border-transparent'
          }`}
        >
          <BarChart3 className={`w-4 h-4 shrink-0 ${isOverview ? 'text-rl-purple' : 'text-rl-muted group-hover:text-rl-text'}`} />
          Visão Geral
        </button>
        <button
          onClick={() => { navigate('/'); onClose() }}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group border ${
            isHome
              ? 'bg-rl-purple/15 text-rl-purple border-rl-purple/25'
              : 'text-rl-muted hover:bg-rl-surface hover:text-rl-text border-transparent'
          }`}
        >
          <Layers className={`w-4 h-4 shrink-0 ${isHome ? 'text-rl-purple' : 'text-rl-muted group-hover:text-rl-text'}`} />
          Clientes
        </button>
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

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 sticky top-0 h-screen border-r border-rl-border bg-rl-surface overflow-y-auto scroll-hide shadow-[1px_0_0_#D8E0F0]">
        <SidebarContent />
      </aside>

      {/* ── Mobile overlay ──────────────────────────────── */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60"
            onClick={onClose}
          />
          {/* Drawer */}
          <aside className="relative z-10 flex flex-col w-60 h-full border-r border-rl-border bg-rl-surface overflow-y-auto scroll-hide animate-slide-up">
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  )
}

AppSidebar.propTypes = {
  open:    PropTypes.bool,
  onClose: PropTypes.func,
}
