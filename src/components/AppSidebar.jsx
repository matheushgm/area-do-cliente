import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { useTheme } from '../hooks/useTheme'
import {
  Plus, Layers, TrendingDown,
  LogOut, Cloud, Loader2,
  X, UserCog, BookOpen, Library, ExternalLink, GitFork, CheckSquare, MessageSquare, BarChart3, DollarSign,
  Sun, Moon, Clapperboard, Timer, Layout, CalendarCheck, PanelLeftClose, PanelLeftOpen, Waypoints,
} from 'lucide-react'

// Sidebar recolhida (só ícones) para sobrar espaço aos módulos. O estado é
// global (localStorage) e vale para todas as páginas; atalho: tecla `[`.
const COLLAPSE_KEY = 'app.sidebar.collapsed'
const COLLAPSE_EVENT = 'app-sidebar-collapsed'

function lerRecolhida() {
  try { return localStorage.getItem(COLLAPSE_KEY) === '1' } catch { return false }
}

export function useSidebarCollapsed() {
  const [collapsed, setCollapsedState] = useState(lerRecolhida)
  const setCollapsed = useCallback((v) => {
    const next = typeof v === 'function' ? v(lerRecolhida()) : v
    try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0') } catch { /* noop */ }
    window.dispatchEvent(new Event(COLLAPSE_EVENT))
  }, [])
  useEffect(() => {
    const sync = () => setCollapsedState(lerRecolhida())
    window.addEventListener(COLLAPSE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => { window.removeEventListener(COLLAPSE_EVENT, sync); window.removeEventListener('storage', sync) }
  }, [])
  useEffect(() => {
    const h = (e) => {
      if (e.key !== '[' || e.metaKey || e.ctrlKey || e.altKey) return
      const el = document.activeElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
      e.preventDefault()
      setCollapsed((c) => !c)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [setCollapsed])
  return [collapsed, setCollapsed]
}

const NAV_ITEMS = [
  { id: 'all',      label: 'Clientes',          Icon: Layers,        type: 'filter'   },
  { id: 'churn',    label: 'Churn',             Icon: TrendingDown,  type: 'filter'   },
]

const NAV_LINKS = [
  { id: 'tarefas',   label: 'Tarefas',           Icon: CheckSquare,  type: 'route',    to: '/tarefas' },
  { id: 'planejador',label: 'Atividades',        Icon: CalendarCheck,type: 'route',    to: '/atividades' },
  { id: 'atividades',label: 'Atividades 15min',  Icon: Timer,        type: 'route',    to: '/atividades-15min' },
  { id: 'roteiros',  label: 'Roteiros Express',  Icon: Clapperboard, type: 'route',    to: '/roteiros-express' },
  { id: 'chat',      label: 'Chat',              Icon: MessageSquare,type: 'route',    to: '/chat' },
  { id: 'banco',     label: 'Banco de Anúncios', Icon: Library,      type: 'route',    to: '/banco-de-anuncios' },
  { id: 'banco-lps', label: 'Banco de LP',       Icon: Layout,       type: 'route',    to: '/banco-de-lps' },
  { id: 'funil',     label: 'Funil de Vendas',   Icon: GitFork,      type: 'route',    to: '/funil' },
  { id: 'ads-roadmap', label: 'ADS Roadmap',     Icon: Waypoints,    type: 'route',    to: '/ads-roadmap' },
  { id: 'playbook',  label: 'Playbook',          Icon: BookOpen,     type: 'external', href: 'https://app.clickup.com/9009170774/v/dc/8cfu2ap-40333/8cfu2ap-18173' },
  { id: 'dashboard-teste', label: 'Dashboard',   Icon: BarChart3,    type: 'route',    to: '/dashboard-teste', badge: 'API' },
  { id: 'precificacao', label: 'Precificação',   Icon: DollarSign,   type: 'external', href: 'https://vvmkxurb.manus.space/' },
]

function SidebarContent({
  user, logout,
  filter, counts,
  loadingProjects,
  onNav, onNew, onClose,
  navigate, location,
  collapsed = false, onToggleCollapse,
}) {
  const isAdmin = user?.role === 'admin'
  const { theme, toggleTheme } = useTheme()

  if (collapsed) {
    const iconBtn = (active) => `w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-150 border ${
      active ? 'bg-rl-purple/15 text-rl-purple border-rl-purple/25' : 'text-rl-muted hover:bg-rl-surface hover:text-rl-text border-transparent'
    }`
    return (
      <div className="flex flex-col items-center h-full py-4 px-2 gap-1">
        <img src="/favicon.png" alt="Revenue Lab" className="w-8 h-8 shrink-0 object-contain mb-2" onError={(e) => { e.currentTarget.style.display = 'none' }} />
        <button onClick={onToggleCollapse} aria-label="Expandir menu" title="Expandir menu ( [ )" className={iconBtn(false)}>
          <PanelLeftOpen className="w-4 h-4" />
        </button>
        <button onClick={onNew} aria-label="Novo cliente" title="Novo cliente" className="w-10 h-10 flex items-center justify-center rounded-xl bg-gradient-rl text-white mb-2 hover:opacity-90">
          <Plus className="w-4 h-4" />
        </button>
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => onNav(id)} aria-label={label} title={label} className={iconBtn(filter === id && location.pathname === '/')}>
            <Icon className="w-4 h-4" />
          </button>
        ))}
        <div className="border-t border-rl-border/50 w-8 my-1" />
        {NAV_LINKS.map(({ id, label, Icon, type, to, href }) => (
          type === 'external'
            ? <a key={id} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label} className={iconBtn(false)}><Icon className="w-4 h-4" /></a>
            : <button key={id} onClick={() => { navigate(to); onClose() }} aria-label={label} title={label} className={iconBtn(location.pathname === to)}><Icon className="w-4 h-4" /></button>
        ))}
        <div className="flex-1" />
        <span title={loadingProjects ? 'Sincronizando...' : 'Dados na nuvem'} className={`w-10 h-8 flex items-center justify-center ${loadingProjects ? 'text-rl-gold' : 'text-rl-green'}`}>
          {loadingProjects ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />}
        </span>
        <button onClick={toggleTheme} aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'} title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'} className={iconBtn(false)}>
          {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>
        {isAdmin && (
          <button onClick={() => { navigate('/users'); onClose() }} aria-label="Gerenciar usuários" title="Usuários" className={iconBtn(location.pathname === '/users')}><UserCog className="w-3.5 h-3.5" /></button>
        )}
        <button onClick={logout} aria-label="Fazer logout" title="Sair" className="w-10 h-10 flex items-center justify-center rounded-xl text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition-all"><LogOut className="w-3.5 h-3.5" /></button>
        <div className="w-8 h-8 mt-1 rounded-full bg-gradient-rl flex items-center justify-center text-xs font-bold text-white shrink-0" title={`${user.name} · ${user.role}`}>
          {user.avatar}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full py-4 px-3">

      {/* ── Header ───────────────────────────────────────── */}
      <div className="flex items-center justify-between px-2 mb-5">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo-revenue-azul-2024.png"
            alt="Revenue Lab"
            className="h-8 w-auto shrink-0 object-contain"
          />
          <div>
            <p className="text-[10px] text-rl-muted mt-0.5">Internal Tool</p>
          </div>
        </div>
        {/* Recolher (desktop) */}
        <button
          onClick={onToggleCollapse}
          aria-label="Recolher menu"
          title="Recolher menu ( [ )"
          className="hidden lg:inline-flex p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
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
          const active = filter === id && location.pathname === '/'
          return (
            <button
              key={id}
              onClick={() => onNav(id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group border ${
                active
                  ? 'bg-rl-purple/15 text-rl-purple border-rl-purple/25'
                  : 'text-rl-muted hover:bg-rl-surface hover:text-rl-text border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className="w-4 h-4 shrink-0" />
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

      <div className="border-t border-rl-border/50 mx-1 my-2" />

      <nav className="space-y-0.5">
        {NAV_LINKS.map(({ id, label, Icon, type, to, href, badge }) => {
          const active = type === 'route' && location.pathname === to
          const baseClass = `w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group border ${
            active
              ? 'bg-rl-purple/15 text-rl-purple border-rl-purple/25'
              : 'text-rl-muted hover:bg-rl-surface hover:text-rl-text border-transparent'
          }`
          const content = (
            <>
              <div className="flex items-center gap-2.5">
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </div>
              {badge && (
                <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-rl-green/15 text-rl-green border border-rl-green/30">
                  {badge}
                </span>
              )}
              {type === 'external' && <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-50" />}
            </>
          )
          if (type === 'external') {
            return (
              <a key={id} href={href} target="_blank" rel="noopener noreferrer" className={baseClass}>
                {content}
              </a>
            )
          }
          return (
            <button key={id} onClick={() => { navigate(to); onClose() }} className={baseClass}>
              {content}
            </button>
          )
        })}
      </nav>

      {/* ── Spacer ──────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── Cloud status ─────────────────────────────────── */}
      <div className={`mx-1 mb-3 flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all ${
        loadingProjects
          ? 'text-rl-gold border-rl-gold/20 bg-rl-gold/5'
          : 'text-rl-green border-rl-green/20 bg-rl-green/5'
      }`}>
        {loadingProjects
          ? <><Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /><span>Sincronizando...</span></>
          : <><Cloud className="w-3.5 h-3.5 shrink-0" /><span>Dados na nuvem</span></>
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
        <button
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
          title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
          className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all"
        >
          {theme === 'dark'
            ? <Sun className="w-3.5 h-3.5" />
            : <Moon className="w-3.5 h-3.5" />}
        </button>
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
  const { user, logout, loadingProjects } = useApp()
  const [collapsed, setCollapsed] = useSidebarCollapsed()

  const handleNav = (id) => { setFilter(id); onClose() }
  const handleNew = () => { navigate('/onboarding/new'); onClose() }

  const sharedProps = {
    user, logout, filter, counts,
    loadingProjects,
    onNav: handleNav, onNew: handleNew, onClose,
    navigate, location,
  }

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────── */}
      <aside className={`hidden lg:flex flex-col ${collapsed ? 'w-14' : 'w-60'} shrink-0 sticky top-0 h-screen border-r border-rl-border bg-rl-surface overflow-y-auto scroll-hide shadow-[1px_0_0_rgb(var(--rl-border))] transition-[width] duration-200`}>
        <SidebarContent {...sharedProps} collapsed={collapsed} onToggleCollapse={() => setCollapsed((c) => !c)} />
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
