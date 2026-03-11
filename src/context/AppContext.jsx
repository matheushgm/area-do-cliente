import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { supabase, isSupabaseReady } from '../lib/supabase'

const AppContext = createContext()

// ─── Team Members ─────────────────────────────────────────────────────────────
const MOCK_USERS = [
  { id: 1, name: 'Matheus Martins',  email: 'matheus@revenuelab.com',               role: 'admin',   avatar: 'MM' },
  { id: 2, name: 'Account Manager',  email: 'account@revenuelab.com',               role: 'account', avatar: 'AM' },
  { id: 3, name: 'Eduardo',          email: 'eduardo@revenuelab.com.br',             role: 'account', avatar: 'ED' },
  { id: 4, name: 'Victor Zampieri',  email: 'victor.zampieri@revenuelab.com.br',     role: 'account', avatar: 'VZ' },
  { id: 5, name: 'Mario Marques',    email: 'mario.marques@revenuelab.com.br',       role: 'account', avatar: 'MM' },
  { id: 6, name: 'Matheus Assis',    email: 'matheusassis@revenuelab.com.br',        role: 'account', avatar: 'MA' },
]

export { MOCK_USERS }

// ─── Supabase helpers ──────────────────────────────────────────────────────────
async function sbFetchAll() {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('projects')
    .select('id, data')
    .order('created_at', { ascending: false })
  if (error) { console.error('[Supabase] fetch:', error.message); return null }
  return data.map(row => ({ ...row.data, id: row.id }))
}

async function sbUpsert(project) {
  if (!supabase) return
  const { error } = await supabase
    .from('projects')
    .upsert({ id: project.id, data: project, updated_at: new Date().toISOString() })
  if (error) console.error('[Supabase] upsert:', error.message)
}

async function sbDelete(id) {
  if (!supabase) return
  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) console.error('[Supabase] delete:', error.message)
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AppProvider({ children }) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const [user, setUser] = useState(() => {
    try { const s = localStorage.getItem('rl_user'); return s ? JSON.parse(s) : null }
    catch { return null }
  })

  // ── Projects ──────────────────────────────────────────────────────────────
  const [projects, setProjects] = useState(() => {
    try { const s = localStorage.getItem('rl_projects'); return s ? JSON.parse(s) : [] }
    catch { return [] }
  })

  const [loadingProjects, setLoadingProjects] = useState(isSupabaseReady)

  // ── Anthropic key ─────────────────────────────────────────────────────────
  const [anthropicKey, setAnthropicKeyState] = useState(
    () => localStorage.getItem('anthropic_api_key') || ''
  )

  // ── Cloud sync on mount ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isSupabaseReady) return
    setLoadingProjects(true)
    sbFetchAll().then(rows => {
      if (rows !== null) {
        setProjects(rows)
        localStorage.setItem('rl_projects', JSON.stringify(rows))
      }
      setLoadingProjects(false)
    })
  }, [])

  // ── Real-time subscription ─────────────────────────────────────────────────
  useEffect(() => {
    if (!supabase) return
    const channel = supabase
      .channel('projects-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
        // Re-fetch on any change from another session
        sbFetchAll().then(rows => {
          if (rows !== null) {
            setProjects(rows)
            localStorage.setItem('rl_projects', JSON.stringify(rows))
          }
        })
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  // ── Auth actions ──────────────────────────────────────────────────────────
  const login = useCallback((email, password) => {
    const found = MOCK_USERS.find(
      u => u.email.toLowerCase() === email.toLowerCase() &&
           (password === 'Revenue@lab!' || password === 'revenue123')
    )
    if (found) {
      setUser(found)
      localStorage.setItem('rl_user', JSON.stringify(found))
      return { ok: true, user: found }
    }
    return { ok: false, error: 'E-mail ou senha incorretos.' }
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem('rl_user')
  }, [])

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const setAnthropicKey = useCallback(key => {
    localStorage.setItem('anthropic_api_key', key)
    setAnthropicKeyState(key)
  }, [])

  const addProject = useCallback((data) => {
    const project = {
      ...data,
      id: Date.now(),
      createdAt: new Date().toISOString(),
      status: 'onboarding',
      progress: 0,
      accountId:   user?.id,
      accountName: user?.name,
      completedSteps: [],
    }
    setProjects(prev => {
      const updated = [project, ...prev]
      localStorage.setItem('rl_projects', JSON.stringify(updated))
      return updated
    })
    sbUpsert(project)
    return project
  }, [user])

  const updateProject = useCallback((id, patch) => {
    setProjects(prev => {
      const updated = prev.map(p => {
        if (p.id !== id) return p
        const merged = { ...p, ...patch }
        sbUpsert(merged)
        return merged
      })
      localStorage.setItem('rl_projects', JSON.stringify(updated))
      return updated
    })
  }, [])

  const deleteProject = useCallback((id) => {
    setProjects(prev => {
      const updated = prev.filter(p => p.id !== id)
      localStorage.setItem('rl_projects', JSON.stringify(updated))
      return updated
    })
    sbDelete(id)
  }, [])

  // ── Context value ─────────────────────────────────────────────────────────
  const value = {
    user, projects, loadingProjects,
    login, logout,
    addProject, updateProject, deleteProject,
    anthropicKey, setAnthropicKey,
    isSupabaseReady,
    teamMembers: MOCK_USERS,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export const useApp = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be inside AppProvider')
  return ctx
}
