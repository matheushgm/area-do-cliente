import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import AppSidebar from '../components/AppSidebar'
import {
  Users, Plus, Pencil, UserX, UserCheck,
  X, AlertTriangle, Loader2, Menu,
  ShieldCheck, User,
} from 'lucide-react'

// ── Helpers ────────────────────────────────────────────────────────────────

function initials(name) {
  return (name || '')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

async function callAdminAPI(action, payload) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return { error: 'Sessão expirada. Faça login novamente.' }
    const res = await fetch('/api/admin-users', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action, ...payload }),
    })
    return await res.json()
  } catch (err) {
    return { error: err.message || 'Erro de comunicação com o servidor.' }
  }
}

// ── Modais ─────────────────────────────────────────────────────────────────

function UserFormModal({ title, initial, onSave, onClose, saving }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    email: initial?.email || '',
    password: '',
    role: initial?.role || 'account',
  })
  const isCreate = !initial

  const valid = form.name.trim() && form.email.trim() &&
    (!isCreate || form.password.length >= 6)

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="glass-card w-full max-w-md p-6 border border-rl-border animate-slide-up shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-rl-purple" />
            <h2 className="text-base font-bold text-rl-text">{title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Fields */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-rl-text mb-1.5">Nome completo</label>
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Ex: João Silva"
              className="input-field w-full"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-rl-text mb-1.5">E-mail</label>
            <input
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="joao@revenuelab.com.br"
              className="input-field w-full"
            />
          </div>

          {isCreate && (
            <div>
              <label className="block text-xs font-semibold text-rl-text mb-1.5">Senha inicial</label>
              <input
                type="password"
                value={form.password}
                onChange={e => set('password', e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="input-field w-full"
              />
              {form.password && form.password.length < 6 && (
                <p className="text-xs text-rl-red mt-1">Mínimo 6 caracteres</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-rl-text mb-1.5">Permissão</label>
            <select
              value={form.role}
              onChange={e => set('role', e.target.value)}
              className="input-field w-full"
            >
              <option value="account">Account Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 btn-ghost" disabled={saving}>
            Cancelar
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={!valid || saving}
            className="flex-1 btn-primary disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isCreate ? 'Criar usuário' : 'Salvar alterações'}
          </button>
        </div>

      </div>
    </div>
  )
}

function ToggleConfirmModal({ user, onConfirm, onClose, saving }) {
  const isDisabling = !user.disabled
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className={`glass-card w-full max-w-sm p-6 border animate-slide-up shadow-2xl ${
        isDisabling ? 'border-red-500/30' : 'border-rl-green/30'
      }`}>
        <div className="flex items-center gap-3 mb-5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isDisabling ? 'bg-red-500/10' : 'bg-rl-green/10'
          }`}>
            {isDisabling
              ? <UserX className="w-5 h-5 text-red-400" />
              : <UserCheck className="w-5 h-5 text-rl-green" />
            }
          </div>
          <div>
            <h2 className="text-base font-bold text-rl-text">
              {isDisabling ? 'Desativar usuário' : 'Reativar usuário'}
            </h2>
            <p className="text-xs text-rl-muted mt-0.5">
              {isDisabling
                ? 'O usuário não conseguirá mais fazer login.'
                : 'O usuário voltará a ter acesso normalmente.'}
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-rl-surface border border-rl-border px-4 py-3 mb-5">
          <p className="text-[11px] text-rl-muted mb-0.5">Usuário</p>
          <p className="text-sm font-bold text-rl-text">{user.name}</p>
          <p className="text-xs text-rl-muted mt-0.5">{user.email}</p>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 btn-ghost" disabled={saving}>
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              isDisabling
                ? 'bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20'
                : 'bg-rl-green/10 border border-rl-green/30 text-rl-green hover:bg-rl-green/20'
            }`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : isDisabling ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
            {isDisabling ? 'Desativar' : 'Reativar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página ─────────────────────────────────────────────────────────────────

export default function UserManagement() {
  const { user: currentUser } = useApp()
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const sidebarCounts = useMemo(() => ({ all: 0, onboarding: 0, active: 0, members: {} }), [])
  const handleFilterChange = useCallback(() => { navigate('/') }, [navigate])

  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [toggleTarget, setToggleTarget] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('profiles')
      .select('*')
      .order('name')
    if (err) setError(err.message)
    else setUsers(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  async function handleCreate(form) {
    setSaving(true)
    const result = await callAdminAPI('create_user', form)
    if (result.error || result.msg) {
      showToast(result.error || result.msg, 'error')
    } else {
      // Upsert profile manually (edge fn creates auth user; profile is synced on first login, but we add it now)
      const avatar = initials(form.name)
      await supabase.from('profiles').upsert({
        id: result.id,
        name: form.name,
        email: form.email,
        avatar,
        role: form.role,
        disabled: false,
      })
      showToast(`Usuário ${form.name} criado com sucesso.`)
      setShowCreate(false)
      loadUsers()
    }
    setSaving(false)
  }

  async function handleUpdate(form) {
    setSaving(true)
    const avatar = initials(form.name)
    const result = await callAdminAPI('update_user', { userId: editTarget.id, ...form })
    if (result.error) {
      showToast(result.error, 'error')
    } else {
      await supabase.from('profiles').update({
        name: form.name,
        email: form.email,
        avatar,
        role: form.role,
      }).eq('id', editTarget.id)
      showToast('Usuário atualizado com sucesso.')
      setEditTarget(null)
      loadUsers()
    }
    setSaving(false)
  }

  async function handleToggle() {
    setSaving(true)
    const result = await callAdminAPI('toggle_user', {
      userId: toggleTarget.id,
      disable: !toggleTarget.disabled,
    })
    if (result.error) {
      showToast(result.error, 'error')
    } else {
      await supabase.from('profiles').update({ disabled: !toggleTarget.disabled }).eq('id', toggleTarget.id)
      showToast(toggleTarget.disabled ? 'Usuário reativado.' : 'Usuário desativado.')
      setToggleTarget(null)
      loadUsers()
    }
    setSaving(false)
  }

  const ROLE_BADGE = {
    admin:   'text-rl-purple bg-rl-purple/10 border-rl-purple/30',
    account: 'text-rl-blue   bg-rl-blue/10   border-rl-blue/30',
  }
  const ROLE_LABEL = { admin: 'Admin', account: 'Account' }

  return (
    <div className="min-h-screen flex bg-gradient-dark">

      {/* Sidebar (sem filtros, só navegação) */}
      <AppSidebar
        filter="all"
        setFilter={handleFilterChange}
        onShowSettings={() => {}}
        counts={sidebarCounts}
        activeAccounts={[]}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">

        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 border-b border-rl-border bg-rl-bg/90 backdrop-blur-xl">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold text-rl-text text-sm">Gestão de Usuários</span>
        </div>

        <main className="flex-1 px-6 py-8 max-w-4xl w-full mx-auto space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between animate-slide-up">
            <div>
              <h1 className="text-2xl font-bold text-rl-text">Gestão de Usuários</h1>
              <p className="text-rl-muted text-sm mt-1">Crie, edite e gerencie o acesso do time.</p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="btn-primary flex items-center gap-2 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Novo Usuário
            </button>
          </div>

          {/* Tabela */}
          <div className="glass-card overflow-hidden animate-slide-up" style={{ animationDelay: '0.05s' }}>
            {loading ? (
              <div className="flex items-center justify-center py-16 gap-3 text-rl-muted">
                <Loader2 className="w-6 h-6 animate-spin text-rl-purple" />
                <span className="text-sm">Carregando usuários...</span>
              </div>
            ) : error ? (
              <div className="flex items-center gap-3 px-6 py-8 text-red-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            ) : users.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-rl-muted">
                <Users className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">Nenhum usuário encontrado.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rl-border">
                    <th className="text-left px-5 py-3 text-[11px] font-bold text-rl-muted uppercase tracking-wider">Usuário</th>
                    <th className="text-left px-5 py-3 text-[11px] font-bold text-rl-muted uppercase tracking-wider hidden md:table-cell">E-mail</th>
                    <th className="text-left px-5 py-3 text-[11px] font-bold text-rl-muted uppercase tracking-wider">Permissão</th>
                    <th className="text-left px-5 py-3 text-[11px] font-bold text-rl-muted uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-rl-border">
                  {users.map(u => (
                    <tr key={u.id} className={`transition-colors ${u.disabled ? 'opacity-50' : 'hover:bg-rl-surface/50'}`}>
                      {/* Usuário */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${u.disabled ? 'bg-rl-muted/40' : 'bg-gradient-rl'}`}>
                            {u.avatar || initials(u.name)}
                          </div>
                          <div>
                            <p className="font-semibold text-rl-text leading-none">{u.name}</p>
                            <p className="text-rl-muted text-xs mt-0.5 md:hidden">{u.email}</p>
                          </div>
                          {u.id === currentUser?.id && (
                            <span className="text-[10px] text-rl-muted border border-rl-border px-1.5 py-0.5 rounded-full">você</span>
                          )}
                        </div>
                      </td>
                      {/* Email */}
                      <td className="px-5 py-4 text-rl-muted hidden md:table-cell">{u.email}</td>
                      {/* Role */}
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${ROLE_BADGE[u.role] || ROLE_BADGE.account}`}>
                          {u.role === 'admin' ? <ShieldCheck className="w-3 h-3" /> : <User className="w-3 h-3" />}
                          {ROLE_LABEL[u.role] || u.role}
                        </span>
                      </td>
                      {/* Status */}
                      <td className="px-5 py-4">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                          u.disabled
                            ? 'text-rl-muted bg-rl-surface border-rl-border'
                            : 'text-rl-green bg-rl-green/10 border-rl-green/30'
                        }`}>
                          {u.disabled ? 'Desativado' : 'Ativo'}
                        </span>
                      </td>
                      {/* Ações */}
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditTarget(u)}
                            className="p-1.5 rounded-lg text-rl-muted hover:text-rl-purple hover:bg-rl-purple/10 transition-all"
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {u.id !== currentUser?.id && (
                            <button
                              onClick={() => setToggleTarget(u)}
                              className={`p-1.5 rounded-lg transition-all ${
                                u.disabled
                                  ? 'text-rl-muted hover:text-rl-green hover:bg-rl-green/10'
                                  : 'text-rl-muted hover:text-red-400 hover:bg-red-400/10'
                              }`}
                              title={u.disabled ? 'Reativar' : 'Desativar'}
                            >
                              {u.disabled ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl text-sm font-medium animate-slide-up ${
          toast.type === 'error'
            ? 'bg-red-500/10 border-red-500/30 text-red-400'
            : 'bg-rl-green/10 border-rl-green/30 text-rl-green'
        }`}>
          {toast.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <UserCheck className="w-4 h-4 shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* Modais */}
      {showCreate && (
        <UserFormModal
          title="Novo Usuário"
          initial={null}
          onSave={handleCreate}
          onClose={() => setShowCreate(false)}
          saving={saving}
        />
      )}
      {editTarget && (
        <UserFormModal
          title="Editar Usuário"
          initial={editTarget}
          onSave={handleUpdate}
          onClose={() => setEditTarget(null)}
          saving={saving}
        />
      )}
      {toggleTarget && (
        <ToggleConfirmModal
          user={toggleTarget}
          onConfirm={handleToggle}
          onClose={() => setToggleTarget(null)}
          saving={saving}
        />
      )}
    </div>
  )
}
