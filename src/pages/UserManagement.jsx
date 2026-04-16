import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { SQUAD_COLORS } from '../lib/constants'
import { initials } from '../lib/utils'
import { useToast } from '../hooks/useToast'
import Toast from '../components/UI/Toast'
import Modal from '../components/UI/Modal'
import AppSidebar from '../components/AppSidebar'
import {
  Users, Plus, Pencil, UserX, UserCheck,
  X, AlertTriangle, Loader2, Menu,
  ShieldCheck, User, Users2, Trash2, KeyRound, Eye, EyeOff,
} from 'lucide-react'

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

function PasswordModal({ user, onSave, onClose, saving }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPass, setShowPass] = useState(false)

  const mismatch = confirm.length > 0 && password !== confirm
  const valid    = password.length >= 6 && password === confirm

  return (
    <Modal onClose={onClose} maxWidth="sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-rl-purple" />
          <h2 className="text-base font-bold text-rl-text">Redefinir senha</h2>
        </div>
        <button onClick={onClose} aria-label="Fechar" className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="rounded-xl bg-rl-surface border border-rl-border px-4 py-3 mb-5">
        <p className="text-[11px] text-rl-muted mb-0.5">Usuário</p>
        <p className="text-sm font-bold text-rl-text">{user.name}</p>
        <p className="text-xs text-rl-muted mt-0.5">{user.email}</p>
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <label htmlFor="pwd-new" className="block text-xs font-semibold text-rl-text mb-1.5">Nova senha</label>
          <div className="relative">
            <input
              id="pwd-new"
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="input-field w-full pr-10"
              autoFocus
            />
            <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-rl-muted hover:text-rl-subtle transition-colors">
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {password.length > 0 && password.length < 6 && (
            <p className="text-xs text-rl-red mt-1">Mínimo 6 caracteres</p>
          )}
        </div>

        <div>
          <label htmlFor="pwd-confirm" className="block text-xs font-semibold text-rl-text mb-1.5">Confirmar senha</label>
          <input
            id="pwd-confirm"
            type={showPass ? 'text' : 'password'}
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="Repita a senha"
            className="input-field w-full"
          />
          {mismatch && <p className="text-xs text-rl-red mt-1">As senhas não coincidem</p>}
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 btn-ghost" disabled={saving}>Cancelar</button>
        <button
          onClick={() => onSave(password)}
          disabled={!valid || saving}
          className="flex-1 btn-primary disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
          Salvar senha
        </button>
      </div>
    </Modal>
  )
}

function UserFormModal({ title, initial, onSave, onClose, saving }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    email: initial?.email || '',
    password: '',
    role: initial?.role || 'member',
  })
  const isCreate = !initial

  const valid = form.name.trim() && form.email.trim() &&
    (!isCreate || form.password.length >= 6)

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  return (
    <Modal onClose={onClose} maxWidth="md">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-rl-purple" />
            <h2 className="text-base font-bold text-rl-text">{title}</h2>
          </div>
          <button onClick={onClose} aria-label="Fechar formulário" className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Fields */}
        <div className="space-y-4 mb-6">
          <div>
            <label htmlFor="field-name" className="block text-xs font-semibold text-rl-text mb-1.5">Nome completo</label>
            <input
              id="field-name"
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Ex: João Silva"
              className="input-field w-full"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="field-email" className="block text-xs font-semibold text-rl-text mb-1.5">E-mail</label>
            <input
              id="field-email"
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="joao@revenuelab.com.br"
              className="input-field w-full"
            />
          </div>

          {isCreate && (
            <div>
              <label htmlFor="field-password" className="block text-xs font-semibold text-rl-text mb-1.5">Senha inicial</label>
              <input
                id="field-password"
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
            <label htmlFor="field-role" className="block text-xs font-semibold text-rl-text mb-1.5">Permissão</label>
            <select
              id="field-role"
              value={form.role}
              onChange={e => set('role', e.target.value)}
              className="input-field w-full"
            >
              <option value="member">Membro</option>
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

    </Modal>
  )
}

function ToggleConfirmModal({ user, onConfirm, onClose, saving }) {
  const isDisabling = !user.disabled
  return (
    <Modal onClose={onClose} maxWidth="sm" className={isDisabling ? 'border-red-500/30' : 'border-rl-green/30'}>
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
    </Modal>
  )
}


const SQUAD_MEMBER_ROLES = ['Account Manager', 'Gestor de Tráfego', 'Designer']

// ── SquadFormModal ──────────────────────────────────────────────────────────

function SquadFormModal({ initial, teamMembers, onSave, onClose, saving }) {
  const isCreate = !initial
  const [form, setForm] = useState({
    name:    initial?.name    || '',
    emoji:   initial?.emoji   || '',
    members: initial?.members ? [...initial.members] : [],
  })

  const valid = form.name.trim().length > 0

  function toggleMember(profileId) {
    setForm((prev) => {
      const exists = prev.members.find((m) => m.profile_id === profileId)
      if (exists) {
        return { ...prev, members: prev.members.filter((m) => m.profile_id !== profileId) }
      }
      return { ...prev, members: [...prev.members, { profile_id: profileId, role: SQUAD_MEMBER_ROLES[0] }] }
    })
  }

  function setMemberRole(profileId, role) {
    setForm((prev) => ({
      ...prev,
      members: prev.members.map((m) => m.profile_id === profileId ? { ...m, role } : m),
    }))
  }

  return (
    <Modal onClose={onClose} maxWidth="2xl" className="max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Users2 className="w-5 h-5 text-rl-cyan" />
            <h2 className="text-base font-bold text-rl-text">{isCreate ? 'Nova Equipe' : 'Editar Equipe'}</h2>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 mb-6">
          {/* Nome */}
          <div>
            <label htmlFor="field-squad-name" className="block text-xs font-semibold text-rl-text mb-1.5">Nome da equipe</label>
            <input
              id="field-squad-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ex: Caça ROI"
              className="input-field w-full"
              autoFocus
            />
          </div>

          {/* Emoji */}
          <div>
            <label htmlFor="field-squad-emoji" className="block text-xs font-semibold text-rl-text mb-1.5">Emoji <span className="text-rl-muted font-normal">(opcional)</span></label>
            <input
              id="field-squad-emoji"
              type="text"
              value={form.emoji}
              onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
              placeholder="Ex: 🏹"
              className="input-field w-full"
              maxLength={4}
            />
          </div>

          {/* Membros */}
          <div>
            <label className="block text-xs font-semibold text-rl-text mb-2">Membros</label>
            <div className="space-y-2">
              {teamMembers.map((t) => {
                const memberEntry = form.members.find((m) => m.profile_id === t.id)
                const checked     = !!memberEntry
                return (
                  <div key={t.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-pointer ${checked ? 'bg-rl-surface border-rl-purple/30' : 'border-rl-border hover:border-rl-border/60'}`}
                    onClick={() => toggleMember(t.id)}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMember(t.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 accent-rl-purple shrink-0"
                    />
                    <div className="w-8 h-8 rounded-full bg-gradient-rl flex items-center justify-center text-xs font-bold text-white shrink-0">
                      {t.avatar || initials(t.name)}
                    </div>
                    <span className="text-base text-rl-text flex-1 min-w-0 truncate leading-none">{t.name}</span>
                    {checked && (
                      <select
                        value={memberEntry.role}
                        onChange={(e) => { e.stopPropagation(); setMemberRole(t.id, e.target.value) }}
                        onClick={(e) => e.stopPropagation()}
                        className="input-field text-xs py-1 px-2 h-auto w-48 shrink-0"
                      >
                        {SQUAD_MEMBER_ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )
              })}
              {teamMembers.length === 0 && (
                <p className="text-xs text-rl-muted py-2">Nenhum membro disponível.</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 btn-ghost" disabled={saving}>Cancelar</button>
          <button
            onClick={() => onSave(form)}
            disabled={!valid || saving}
            className="flex-1 btn-primary disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isCreate ? 'Criar equipe' : 'Salvar alterações'}
          </button>
        </div>
    </Modal>
  )
}

// ── DeleteSquadModal ────────────────────────────────────────────────────────

function DeleteSquadModal({ squad, onConfirm, onClose, saving }) {
  return (
    <Modal onClose={onClose} maxWidth="sm" className="border-red-500/30">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-red-500/10">
            <Trash2 className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-rl-text">Excluir equipe</h2>
            <p className="text-xs text-rl-muted mt-0.5">Projetos vinculados perderão o squad.</p>
          </div>
        </div>
        <div className="rounded-xl bg-rl-surface border border-rl-border px-4 py-3 mb-5">
          <p className="text-[11px] text-rl-muted mb-0.5">Equipe</p>
          <p className="text-sm font-bold text-rl-text">{squad.emoji} {squad.name}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 btn-ghost" disabled={saving}>Cancelar</button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-40"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Excluir
          </button>
        </div>
    </Modal>
  )
}

// ── Página ─────────────────────────────────────────────────────────────────

export default function UserManagement() {
  const { user: currentUser, squads, addSquad, updateSquad, deleteSquad, teamMembers } = useApp()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('users')
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
  const { toast, showToast } = useToast()

  // Password reset state
  const [passwordTarget, setPasswordTarget] = useState(null)

  // Squad state
  const [showCreateSquad, setShowCreateSquad] = useState(false)
  const [editSquadTarget, setEditSquadTarget] = useState(null)
  const [deleteSquadTarget, setDeleteSquadTarget] = useState(null)
  const [savingSquad, setSavingSquad] = useState(false)

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
      showToast(toggleTarget.disabled ? 'Usuário reativado.' : 'Usuário desativado.', 'success', 6000)
      setToggleTarget(null)
      loadUsers()
    }
    setSaving(false)
  }

  const ROLE_BADGE = {
    admin:  'text-rl-purple bg-rl-purple/10 border-rl-purple/30',
    member: 'text-rl-blue   bg-rl-blue/10   border-rl-blue/30',
  }
  const ROLE_LABEL = { admin: 'Admin', member: 'Membro' }

  async function handleResetPassword(password) {
    setSaving(true)
    const result = await callAdminAPI('reset_password', { userId: passwordTarget.id, password })
    if (result.error) {
      showToast(result.error, 'error')
    } else {
      showToast(`Senha de ${passwordTarget.name} redefinida.`)
      setPasswordTarget(null)
    }
    setSaving(false)
  }

  async function handleCreateSquad(form) {
    setSavingSquad(true)
    const result = await addSquad(form)
    if (result.error) showToast(result.error, 'error')
    else { showToast('Equipe criada com sucesso.'); setShowCreateSquad(false) }
    setSavingSquad(false)
  }

  async function handleUpdateSquad(form) {
    setSavingSquad(true)
    const result = await updateSquad(editSquadTarget.id, form)
    if (result.error) showToast(result.error, 'error')
    else { showToast('Equipe atualizada.'); setEditSquadTarget(null) }
    setSavingSquad(false)
  }

  async function handleDeleteSquad() {
    setSavingSquad(true)
    const result = await deleteSquad(deleteSquadTarget.id)
    if (result.error) showToast(result.error, 'error')
    else { showToast('Equipe excluída.'); setDeleteSquadTarget(null) }
    setSavingSquad(false)
  }

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
            aria-label="Abrir menu de navegação"
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
              <h1 className="text-2xl font-bold text-rl-text">Configurações</h1>
              <p className="text-rl-muted text-sm mt-1">Gerencie usuários e equipes do time.</p>
            </div>
            {activeTab === 'users' ? (
              <button
                onClick={() => setShowCreate(true)}
                className="btn-primary flex items-center gap-2 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Novo Usuário
              </button>
            ) : (
              <button
                onClick={() => setShowCreateSquad(true)}
                className="btn-primary flex items-center gap-2 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Nova Equipe
              </button>
            )}
          </div>

          {/* Abas */}
          <div className="flex gap-1 p-1 rounded-xl bg-rl-surface border border-rl-border w-fit animate-slide-up" style={{ animationDelay: '0.03s' }}>
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'users'
                  ? 'bg-rl-bg text-rl-text shadow-sm border border-rl-border'
                  : 'text-rl-muted hover:text-rl-text'
              }`}
            >
              <Users className="w-4 h-4" />
              Usuários
            </button>
            <button
              onClick={() => setActiveTab('squads')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'squads'
                  ? 'bg-rl-bg text-rl-text shadow-sm border border-rl-border'
                  : 'text-rl-muted hover:text-rl-text'
              }`}
            >
              <Users2 className="w-4 h-4" />
              Equipes
            </button>
          </div>

          {/* Aba Usuários */}
          {activeTab === 'users' && (
          <div className="glass-card overflow-hidden animate-slide-up" style={{ animationDelay: '0.05s' }}>
            {loading ? (
              <div className="flex items-center justify-center py-16 gap-3 text-rl-muted">
                <Loader2 className="w-6 h-6 animate-spin text-rl-purple" />
                <span className="text-sm">Carregando usuários...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center gap-3 px-6 py-8 text-red-400">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
                <button onClick={loadUsers} className="btn-ghost text-sm text-rl-muted hover:text-rl-text">
                  Tentar novamente
                </button>
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
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${ROLE_BADGE[u.role] || ROLE_BADGE.member}`}>
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
                            aria-label="Editar usuário"
                            className="p-1.5 rounded-lg text-rl-muted hover:text-rl-purple hover:bg-rl-purple/10 transition-all"
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setPasswordTarget(u)}
                            aria-label="Redefinir senha"
                            className="p-1.5 rounded-lg text-rl-muted hover:text-rl-cyan hover:bg-rl-cyan/10 transition-all"
                            title="Redefinir senha"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                          {u.id !== currentUser?.id && (
                            <button
                              onClick={() => setToggleTarget(u)}
                              className={`p-1.5 rounded-lg transition-all ${
                                u.disabled
                                  ? 'text-rl-muted hover:text-rl-green hover:bg-rl-green/10'
                                  : 'text-rl-muted hover:text-red-400 hover:bg-red-400/10'
                              }`}
                              aria-label={u.disabled ? 'Reativar usuário' : 'Desativar usuário'}
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
          )}

          {/* Aba Equipes */}
          {activeTab === 'squads' && (
            <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.05s' }}>
              {squads.length === 0 ? (
                <div className="glass-card flex flex-col items-center justify-center py-16 text-rl-muted">
                  <Users2 className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm">Nenhuma equipe cadastrada.</p>
                  <button onClick={() => setShowCreateSquad(true)} className="mt-4 btn-ghost text-sm">
                    Criar primeira equipe
                  </button>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {squads.map((sq, idx) => {
                    const colors   = SQUAD_COLORS[idx % SQUAD_COLORS.length]
                    const members  = (sq.members || []).map((m) => {
                      const profile = teamMembers.find((t) => t.id === m.profile_id)
                      return { name: profile?.name || m.profile_id, role: m.role, avatar: profile?.avatar }
                    })
                    return (
                      <div key={sq.id} className={`glass-card p-5 border ${colors.border} space-y-4`}>
                        {/* Header do card */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${colors.bg} border ${colors.border}`}>
                              {sq.emoji || '👥'}
                            </div>
                            <div>
                              <p className={`font-bold text-sm ${colors.text}`}>{sq.name}</p>
                              <p className="text-xs text-rl-muted">{members.length} membro{members.length !== 1 ? 's' : ''}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => setEditSquadTarget(sq)}
                              aria-label="Editar equipe"
                              className="p-1.5 rounded-lg text-rl-muted hover:text-rl-purple hover:bg-rl-purple/10 transition-all"
                              title="Editar"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteSquadTarget(sq)}
                              aria-label="Excluir equipe"
                              className="p-1.5 rounded-lg text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition-all"
                              title="Excluir"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Membros */}
                        {members.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {members.map((m) => (
                              <div key={m.name} className="flex items-center gap-1.5">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${colors.bg} ${colors.text}`}>
                                  {m.avatar || (m.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase())}
                                </div>
                                <span className="text-xs text-rl-text">{m.name}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}>{m.role}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

        </main>
      </div>

      <Toast toast={toast} />

      {/* Modais — Usuários */}
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

      {/* Modal — Redefinir senha */}
      {passwordTarget && (
        <PasswordModal
          user={passwordTarget}
          onSave={handleResetPassword}
          onClose={() => setPasswordTarget(null)}
          saving={saving}
        />
      )}

      {/* Modais — Equipes */}
      {showCreateSquad && (
        <SquadFormModal
          initial={null}
          teamMembers={teamMembers}
          onSave={handleCreateSquad}
          onClose={() => setShowCreateSquad(false)}
          saving={savingSquad}
        />
      )}
      {editSquadTarget && (
        <SquadFormModal
          initial={editSquadTarget}
          teamMembers={teamMembers}
          onSave={handleUpdateSquad}
          onClose={() => setEditSquadTarget(null)}
          saving={savingSquad}
        />
      )}
      {deleteSquadTarget && (
        <DeleteSquadModal
          squad={deleteSquadTarget}
          onConfirm={handleDeleteSquad}
          onClose={() => setDeleteSquadTarget(null)}
          saving={savingSquad}
        />
      )}
    </div>
  )
}
