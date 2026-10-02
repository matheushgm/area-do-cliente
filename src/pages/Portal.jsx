// Portal do cliente / parceiro: /portal/:projectId
// Sem login Supabase. O visitante digita a senha da chave (ver módulo
// Compartilhamento), api/portal.js emite um token de sessão e devolve só os
// módulos liberados. Tudo aqui é somente leitura.
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Lock, Loader2, AlertTriangle, Eye, EyeOff, LogOut, Menu, X, Sun, Moon,
  ClipboardList, Compass, Package, Users, Zap, BarChart3, CalendarDays, Megaphone,
  LayoutTemplate, Search, FlaskConical, Map, Activity, Star, NotebookPen, Link2, Paperclip,
  CheckSquare, Sparkles,
} from 'lucide-react'
import { useTheme } from '../hooks/useTheme'
import {
  PORTAL_MODULES, portalLogin, portalData, getPortalSession, setPortalSession,
} from '../lib/portal'
import PortalModule from '../components/Portal/PortalModule'

const ICONS = {
  dados: ClipboardList, kickoff: Compass, produtos: Package, icp: Users, oferta: Zap,
  roi: BarChart3, campaign: CalendarDays, debriefing: Megaphone, lpcentral: LayoutTemplate,
  landingpage: LayoutTemplate, googleads: Search, metalab: FlaskConical, estrategiav2: Map,
  resultados: Activity, nps: Star, atas: NotebookPen, links: Link2, anexos: Paperclip,
  aprovacao: CheckSquare, criativos: Sparkles,
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-gradient-dark flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-rl-purple/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-rl-blue/10 rounded-full blur-3xl pointer-events-none" />
      <div className="relative z-10 w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <img src="/logo-revenue-azul-2024.png" alt="Revenue Lab" className="h-12 w-auto mx-auto mb-3 object-contain" />
          <p className="text-rl-muted text-sm">Portal do cliente</p>
        </div>
        <div className="glass-card p-8">{children}</div>
      </div>
    </div>
  )
}

function LoginScreen({ projectId, onLogged }) {
  const [password, setPassword] = useState('')
  const [show, setShow]         = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (!password) return
    setLoading(true); setError(null)
    try {
      const res = await portalLogin(projectId, password)
      setPortalSession(projectId, res.token)
      onLogged(res.token)
    } catch (err) {
      setError(err.status === 429
        ? 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'
        : err.status === 404 ? 'Este portal não está disponível.'
        : 'Senha incorreta.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Shell>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-rl-purple/10 flex items-center justify-center shrink-0">
          <Lock className="w-5 h-5 text-rl-purple" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-rl-text">Acesso restrito</h1>
          <p className="text-xs text-rl-muted">Digite a senha que você recebeu para entrar.</p>
        </div>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label-field">Senha</label>
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field w-full pr-10"
              autoFocus
              autoComplete="current-password"
            />
            <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-rl-muted hover:text-rl-text" aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}>
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        {error && (
          <p className="flex items-center gap-2 text-sm text-red-400"><AlertTriangle className="w-4 h-4 shrink-0" />{error}</p>
        )}
        <button type="submit" disabled={loading || !password} className="btn-primary w-full flex items-center justify-center gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />} Entrar
        </button>
      </form>
    </Shell>
  )
}

function NavList({ modules, active, onPick }) {
  return modules.map((m) => {
    const Icon = ICONS[m.id] || ClipboardList
    const isActive = m.id === active
    return (
      <button
        key={m.id}
        onClick={() => onPick(m.id)}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
          isActive ? 'bg-rl-purple text-white shadow-sm' : 'text-rl-subtle hover:bg-rl-bg hover:text-rl-text'
        }`}
      >
        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-rl-cyan'}`} />
        <span className="truncate flex-1 text-left">{m.label}</span>
      </button>
    )
  })
}

export default function Portal() {
  const { projectId } = useParams()
  const { theme, toggleTheme } = useTheme()
  const [token, setToken]     = useState(() => getPortalSession(projectId))
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(!!token)
  const [error, setError]     = useState(null)
  const [active, setActive]   = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!token) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    portalData(projectId, token)
      .then((d) => { if (!cancelled) { setData(d); setError(null) } })
      .catch((err) => {
        if (cancelled) return
        if (err.status === 401 || err.status === 403) { setPortalSession(projectId, null); setToken(null); setData(null) }
        else setError(err.message)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [projectId, token])

  const modules = useMemo(
    () => PORTAL_MODULES.filter((m) => data?.permissions?.[m.id]),
    [data],
  )

  useEffect(() => {
    if (modules.length && !modules.some((m) => m.id === active)) setActive(modules[0].id)
  }, [modules, active])

  useEffect(() => {
    document.title = data?.company ? `${data.company} · Portal` : 'Portal do cliente'
  }, [data])

  function logout() {
    setPortalSession(projectId, null)
    setToken(null); setData(null); setActive(null)
  }

  if (!token) return <LoginScreen projectId={projectId} onLogged={setToken} />

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center gap-2 text-sm text-rl-muted py-6">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
        </div>
      </Shell>
    )
  }

  if (error || !data) {
    return (
      <Shell>
        <p className="flex items-center gap-2 text-sm text-red-400"><AlertTriangle className="w-4 h-4 shrink-0" />{error || 'Não foi possível carregar.'}</p>
        <button onClick={logout} className="btn-secondary w-full mt-4 text-sm">Voltar</button>
      </Shell>
    )
  }

  const current = modules.find((m) => m.id === active)

  return (
    <div className="min-h-screen bg-rl-bg text-rl-text">
      <header className="sticky top-0 z-40 bg-rl-card/90 backdrop-blur border-b border-rl-border">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => setMenuOpen(true)} className="lg:hidden p-2 -ml-2 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface" aria-label="Abrir menu">
            <Menu className="w-5 h-5" />
          </button>
          <img src="/logo-revenue-azul-2024.png" alt="Revenue Lab" className="h-7 w-auto object-contain" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-rl-text truncate">{data.company}</p>
            <p className="text-[11px] text-rl-muted truncate">Portal · {data.label}</p>
          </div>
          <button onClick={toggleTheme} className="p-2 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface" title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}>
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button onClick={logout} className="p-2 rounded-lg text-rl-muted hover:text-red-400 hover:bg-red-400/10" title="Sair">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col lg:flex-row gap-4">
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="glass-card p-2 sticky top-20"><NavList modules={modules} active={active} onPick={setActive} /></div>
        </aside>

        {menuOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMenuOpen(false)} />
            <aside className="relative z-10 flex flex-col w-72 max-w-[85vw] h-full bg-rl-card border-r border-rl-border overflow-y-auto animate-slide-up">
              <div className="flex items-center justify-between px-4 py-3 border-b border-rl-border">
                <span className="text-sm font-semibold text-rl-text">Módulos</span>
                <button onClick={() => setMenuOpen(false)} className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface" aria-label="Fechar menu"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-2"><NavList modules={modules} active={active} onPick={(id) => { setActive(id); setMenuOpen(false) }} /></div>
            </aside>
          </div>
        )}

        <main className="flex-1 min-w-0">
          {current
            ? <PortalModule key={current.id} moduleId={current.id} label={current.label} data={data.modules?.[current.id]} project={data.project} projectId={projectId} token={token} level={data.permissions?.[current.id]} />
            : (
              <div className="glass-card p-8 text-center text-sm text-rl-muted">Nenhum módulo liberado para esta chave.</div>
            )}
        </main>
      </div>
    </div>
  )
}
