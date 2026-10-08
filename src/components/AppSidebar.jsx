import { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect, Fragment } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { useTheme } from '../hooks/useTheme'
import { canViewSquadsReport } from '../lib/utils'
import { baseProjectsOf, sidebarCounts } from '../lib/dashboardCounts'
import { Sparkles,
  Layers, TrendingDown, UserPlus,
  LogOut, Cloud, Loader2,
  X, UserCog, BookOpen, Library, ExternalLink, GitFork, CheckSquare, MessageSquare, BarChart3, DollarSign,
  Sun, Moon, Clapperboard, Timer, Layout, CalendarCheck, PanelLeftClose, PanelLeftOpen, Waypoints, Users2,
  ChevronUp,
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

// Bloco do topo. Os três primeiros são "filtros" da lista de clientes — viraram
// link (`/?lista=`) em vez de callback, então sobrevivem a um refresh e dá para
// abrir em outra aba. O Dashboard é rota normal e convive no mesmo bloco.
const NAV_ITEMS = [
  { id: 'all',       label: 'Clientes',       Icon: Layers,       type: 'filter' },
  { id: 'novos',     label: 'Novos Clientes', Icon: UserPlus,     type: 'filter' },
  { id: 'churn',     label: 'Churn',          Icon: TrendingDown, type: 'filter' },
  { id: 'dashboard', label: 'Dashboard',      Icon: BarChart3,    type: 'route', to: '/dashboard', badge: 'API' },
]

// Menu agrupado por área. Cada seção vira um rótulo na sidebar expandida e um
// separador na recolhida. `gate` esconde o item de quem não tem acesso.
const NAV_SECTIONS = [
  {
    label: 'Operação',
    items: [
      { id: 'otimizacoes', label: 'Otimizações',       Icon: Sparkles,      type: 'route', to: '/otimizacoes' },
      { id: 'planejador',  label: 'Atividades',        Icon: CalendarCheck, type: 'route', to: '/atividades' },
      { id: 'tarefas',     label: 'Tarefas',           Icon: CheckSquare,   type: 'route', to: '/tarefas' },
      { id: 'atividades',  label: 'Atividades 15min',  Icon: Timer,         type: 'route', to: '/atividades-15min' },
      { id: 'chat',        label: 'Chat',              Icon: MessageSquare, type: 'route', to: '/chat' },
    ],
  },
  {
    label: 'Biblioteca',
    items: [
      { id: 'banco',       label: 'Banco de Anúncios', Icon: Library,       type: 'route', to: '/banco-de-anuncios' },
      { id: 'banco-lps',   label: 'Banco de LP',       Icon: Layout,        type: 'route', to: '/banco-de-lps' },
      { id: 'roteiros',    label: 'Roteiros Express',  Icon: Clapperboard,  type: 'route', to: '/roteiros-express' },
      { id: 'playbook',    label: 'Playbook',          Icon: BookOpen,      type: 'external', href: 'https://app.clickup.com/9009170774/v/dc/8cfu2ap-40333/8cfu2ap-18173' },
    ],
  },
  {
    label: 'Dados',
    items: [
      { id: 'funil',       label: 'Funil de Vendas',   Icon: GitFork,       type: 'route', to: '/funil' },
      { id: 'ads-roadmap', label: 'ADS Roadmap',       Icon: Waypoints,     type: 'route', to: '/ads-roadmap' },
      // Antes só existia como botão dentro do Dashboard — ninguém achava.
      { id: 'squads',      label: 'Relatório de Squads', Icon: Users2,      type: 'route', to: '/relatorio-squads', gate: canViewSquadsReport },
      { id: 'precificacao',label: 'Precificação',      Icon: DollarSign,    type: 'external', href: 'https://vvmkxurb.manus.space/' },
    ],
  },
]

// Lista achatada — usada pelo modo recolhido, que não mostra rótulo de seção.
const navItemsFor = (user) => NAV_SECTIONS.map((sec) => ({
  ...sec,
  items: sec.items.filter((it) => !it.gate || it.gate(user)),
})).filter((sec) => sec.items.length > 0)


// Menu do avatar: status da nuvem, tema, usuários e sair. Vai num portal com
// position:fixed porque o <aside> tem overflow-y-auto, que recortaria um menu
// posicionado por absolute. Abre pra cima — o avatar fica no rodapé.
//
// A mecânica (portal, clique fora, Escape, clamp na viewport) é a mesma do
// Popover de Tarefas/Campos.jsx, mas aquele é do design system `ln`; aqui
// precisa dos tokens `rl-*` da sidebar.
const MENU_WIDTH = 216

function UserMenu({ anchorRef, open, onClose, user, logout, loadingProjects, navigate, location, onCloseSidebar }) {
  const ref = useRef(null)
  const [pos, setPos] = useState(null)
  const { theme, toggleTheme } = useTheme()
  const isAdmin = user?.role === 'admin'

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return
    const r = anchorRef.current.getBoundingClientRect()
    const left = Math.max(8, Math.min(r.left, window.innerWidth - MENU_WIDTH - 8))
    setPos({
      left,
      bottom: Math.max(8, window.innerHeight - r.top + 6),
      // O portal pendura no document.body, fora da árvore da página — e `fx`
      // (tema Fynix) redefine os tokens rl-* por subárvore. Sem copiar a
      // classe, o menu sai escuro numa página clara.
      fx: !!anchorRef.current.closest('.fx'),
    })
  }, [open, anchorRef])

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (ref.current?.contains(e.target)) return
      if (anchorRef.current?.contains(e.target)) return
      onClose()
    }
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open, onClose, anchorRef])

  if (!open || !pos) return null

  const item = 'w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-left transition-colors'

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label="Menu do usuário"
      style={{ position: 'fixed', left: pos.left, bottom: pos.bottom, width: MENU_WIDTH, zIndex: 90 }}
      className={`${pos.fx ? 'fx ' : ''}rounded-xl border border-rl-border bg-rl-surface shadow-glow overflow-hidden py-1`}
    >
      {/* Identificação — não é ação, só contexto de quem está logado */}
      <div className="px-3 py-2 border-b border-rl-border/60">
        <p className="text-xs font-semibold text-rl-text truncate">{user.name}</p>
        <p className="text-[10px] text-rl-muted truncate">{user.email}</p>
      </div>

      {/* Status da sincronização — informativo, não clicável */}
      <div className={`${item} ${loadingProjects ? 'text-rl-gold' : 'text-rl-green'}`}>
        {loadingProjects
          ? <><Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" /><span>Sincronizando...</span></>
          : <><Cloud className="w-3.5 h-3.5 shrink-0" /><span>Dados na nuvem</span></>}
      </div>

      <div className="border-t border-rl-border/60 my-1" />

      <button
        role="menuitem"
        onClick={() => { toggleTheme(); onClose() }}
        className={`${item} text-rl-muted hover:bg-rl-bg hover:text-rl-text`}
      >
        {theme === 'dark'
          ? <><Sun className="w-3.5 h-3.5 shrink-0" /><span>Tema claro</span></>
          : <><Moon className="w-3.5 h-3.5 shrink-0" /><span>Tema escuro</span></>}
      </button>

      {isAdmin && (
        <button
          role="menuitem"
          onClick={() => { navigate('/usuarios'); onClose(); onCloseSidebar() }}
          className={`${item} ${
            location.pathname === '/usuarios'
              ? 'text-rl-purple bg-rl-purple/10'
              : 'text-rl-muted hover:bg-rl-bg hover:text-rl-text'
          }`}
        >
          <UserCog className="w-3.5 h-3.5 shrink-0" />
          <span>Usuários</span>
        </button>
      )}

      <div className="border-t border-rl-border/60 my-1" />

      <button
        role="menuitem"
        onClick={() => { onClose(); logout() }}
        className={`${item} text-rl-muted hover:bg-red-400/10 hover:text-red-400`}
      >
        <LogOut className="w-3.5 h-3.5 shrink-0" />
        <span>Sair</span>
      </button>
    </div>,
    document.body,
  )
}

function SidebarContent({
  user, logout,
  filter, counts, sections,
  loadingProjects,
  onNav, onClose,
  navigate, location,
  collapsed = false, onToggleCollapse,
}) {
  const avatarRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)

  if (collapsed) {
    const iconBtn = (active) => `w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-150 border ${
      active ? 'bg-rl-purple/15 text-rl-purple border-rl-purple/25' : 'text-rl-muted hover:bg-rl-surface hover:text-rl-text border-transparent'
    }`
    return (
      <div className="flex flex-col items-center h-full py-4 px-2 gap-1">
        <img src="/verta/simbolo.png" alt="Verta" className="w-8 h-8 shrink-0 object-contain mb-2" onError={(e) => { e.currentTarget.style.display = 'none' }} />
        <button onClick={onToggleCollapse} aria-label="Expandir menu" title="Expandir menu ( [ )" className={iconBtn(false)}>
          <PanelLeftOpen className="w-4 h-4" />
        </button>
        {NAV_ITEMS.map(({ id, label, Icon, type, to }) => {
          const ativo = type === 'filter'
            ? filter === id && location.pathname === '/'
            : location.pathname === to
          return (
            <button
              key={id}
              onClick={() => (type === 'filter' ? onNav(id) : (navigate(to), onClose()))}
              aria-label={label}
              title={label}
              className={iconBtn(ativo)}
            >
              <Icon className="w-4 h-4" />
            </button>
          )
        })}
        {/* Sem rótulo de seção no modo recolhido — só o separador. */}
        {sections.map((sec) => (
          <Fragment key={sec.label}>
            <div className="border-t border-rl-border/50 w-8 my-1" />
            {sec.items.map(({ id, label, Icon, type, to, href }) => (
              type === 'external'
                ? <a key={id} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label} className={iconBtn(false)}><Icon className="w-4 h-4" /></a>
                : <button key={id} onClick={() => { navigate(to); onClose() }} aria-label={label} title={label} className={iconBtn(location.pathname === to)}><Icon className="w-4 h-4" /></button>
            ))}
          </Fragment>
        ))}
        <div className="flex-1" />
        <button
          ref={avatarRef}
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="Abrir menu do usuário"
          title={`${user.name} · ${user.role}`}
          className="relative shrink-0 rounded-full"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-rl flex items-center justify-center text-xs font-bold text-white">
            {user.avatar}
          </div>
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-rl-surface ${
              loadingProjects ? 'bg-rl-gold animate-pulse' : 'bg-rl-green'
            }`}
          />
        </button>

        <UserMenu
          anchorRef={avatarRef}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          user={user}
          logout={logout}
          loadingProjects={loadingProjects}
          navigate={navigate}
          location={location}
          onCloseSidebar={onClose}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full py-4 px-3">

      {/* ── Header ───────────────────────────────────────── */}
      <div className="flex items-center justify-between px-2 mb-5">
        <div className="flex items-center gap-2.5">
          {/* Troca por CSS (`darkMode: 'class'`) em vez de ler o tema no JS: não
              cria uma segunda instância do useTheme — que teria estado próprio e
              deixaria a logo defasada até o próximo mount. Só uma das duas fica
              em `display:block`, então só ela entra na árvore de acessibilidade. */}
          <img
            src="/verta/logo-azul.png"
            alt="Verta"
            className="h-7 w-auto shrink-0 object-contain dark:hidden"
          />
          <img
            src="/verta/logo-branca.png"
            alt="Verta"
            className="h-7 w-auto shrink-0 object-contain hidden dark:block"
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

      {/* ── Navigation ──────────────────────────────────── */}
      <nav className="space-y-0.5 mb-2">
        {NAV_ITEMS.map(({ id, label, Icon, type, to, badge }) => {
          const isFiltro = type === 'filter'
          const count = isFiltro ? (counts?.[id] ?? 0) : 0
          const active = isFiltro
            ? filter === id && location.pathname === '/'
            : location.pathname === to
          return (
            <button
              key={id}
              onClick={() => (isFiltro ? onNav(id) : (navigate(to), onClose()))}
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
              {badge && (
                <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-rl-green/15 text-rl-green border border-rl-green/30">
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {sections.map((sec) => (
        <div key={sec.label}>
          <div className="border-t border-rl-border/50 mx-1 my-2" />
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-rl-muted/70">
            {sec.label}
          </p>
          <nav className="space-y-0.5">
            {sec.items.map(({ id, label, Icon, type, to, href, badge }) => {
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
        </div>
      ))}

      {/* ── Spacer ──────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── Divider ─────────────────────────────────────── */}
      <div className="border-t border-rl-border mx-1 mb-3" />

      {/* ── Usuário — abre o menu (nuvem, tema, usuários, sair) ── */}
      <button
        ref={avatarRef}
        onClick={() => setMenuOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="Abrir menu do usuário"
        className={`flex items-center gap-2 px-2 py-1.5 mx-0.5 rounded-xl border transition-all ${
          menuOpen
            ? 'bg-rl-bg border-rl-border'
            : 'border-transparent hover:bg-rl-bg'
        }`}
      >
        <div className="relative shrink-0">
          <div className="w-8 h-8 rounded-full bg-gradient-rl flex items-center justify-center text-xs font-bold text-white">
            {user.avatar}
          </div>
          {/* O indicador de sincronização mudou de lugar para dentro do menu;
              o ponto mantém o sinal visível sem precisar abrir nada. */}
          <span
            title={loadingProjects ? 'Sincronizando...' : 'Dados na nuvem'}
            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-rl-surface ${
              loadingProjects ? 'bg-rl-gold animate-pulse' : 'bg-rl-green'
            }`}
          />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-xs font-semibold text-rl-text leading-none truncate">{user.name.split(' ')[0]}</p>
          <p className="text-[10px] text-rl-muted capitalize mt-0.5">{user.role}</p>
        </div>
        <ChevronUp className={`w-3.5 h-3.5 shrink-0 text-rl-muted transition-transform ${menuOpen ? '' : 'rotate-180'}`} />
      </button>

      <UserMenu
        anchorRef={avatarRef}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        user={user}
        logout={logout}
        loadingProjects={loadingProjects}
        navigate={navigate}
        location={location}
        onCloseSidebar={onClose}
      />

    </div>
  )
}

// A sidebar não recebe mais estado por prop: lê o filtro da URL (`/?lista=`) e
// calcula os contadores do próprio AppContext. Antes isso vinha do Dashboard,
// e nas outras 11 páginas chegava vazio — os números apareciam zerados.
export default function AppSidebar({ open, onClose }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { user, logout, loadingProjects, projects, squads } = useApp()
  const [collapsed, setCollapsed] = useSidebarCollapsed()

  const filter = searchParams.get('lista') || 'all'
  const counts = useMemo(
    () => sidebarCounts(baseProjectsOf(projects, squads)),
    [projects, squads],
  )
  const sections = useMemo(() => navItemsFor(user), [user])

  // `replace` para que alternar filtro não encha o histórico de voltas.
  const handleNav = (id) => {
    navigate(id === 'all' ? '/' : `/?lista=${id}`, { replace: true })
    onClose()
  }

  const sharedProps = {
    user, logout, filter, counts, sections,
    loadingProjects,
    onNav: handleNav, onClose,
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
