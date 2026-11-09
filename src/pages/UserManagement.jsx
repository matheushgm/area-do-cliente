import { apiFetch } from '../lib/api'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { SQUAD_COLORS, CLICKUP_DEPARTMENTS, rotuloDepartamento } from '../lib/constants'
import { initials } from '../lib/utils'
import { listClickUpMembers } from '../lib/clickup'
import { useToast } from '../hooks/useToast'
import Toast from '../components/UI/Toast'
import Modal from '../components/UI/Modal'
import { useI18n, t as tSolto } from '../i18n'
import {
  Users, Plus, Pencil, UserX, UserCheck,
  X, AlertTriangle, Loader2, Menu,
  ShieldCheck, User, Users2, Trash2, KeyRound, Eye, EyeOff,
  Layers, Check,
} from 'lucide-react'

async function callAdminAPI(action, payload) {
  try {
    return await apiFetch('/api/admin-users', { body: { action, ...payload } })
  } catch (err) {
    return { error: err.message || tSolto('usuarios.erroServidor') }
  }
}

// ── Modais ─────────────────────────────────────────────────────────────────

function PasswordModal({ user, onSave, onClose, saving }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPass, setShowPass] = useState(false)
  const { t } = useI18n()

  const mismatch = confirm.length > 0 && password !== confirm
  const valid    = password.length >= 6 && password === confirm

  return (
    <Modal onClose={onClose} maxWidth="sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-rl-purple" />
          <h2 className="text-base font-bold text-rl-text">{t('usuarios.redefinirSenha')}</h2>
        </div>
        <button onClick={onClose} aria-label={t('comum.fechar')} className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="rounded-xl bg-rl-surface border border-rl-border px-4 py-3 mb-5">
        <p className="text-[11px] text-rl-muted mb-0.5">{t('usuarios.senha.usuario')}</p>
        <p className="text-sm font-bold text-rl-text">{user.name}</p>
        <p className="text-xs text-rl-muted mt-0.5">{user.email}</p>
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <label htmlFor="pwd-new" className="block text-xs font-semibold text-rl-text mb-1.5">{t('usuarios.senha.nova')}</label>
          <div className="relative">
            <input
              id="pwd-new"
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={t('usuarios.senha.minimo')}
              className="input-field w-full pr-10"
              autoFocus
            />
            <button type="button" onClick={() => setShowPass(v => !v)} aria-label={showPass ? t('usuarios.senha.ocultar') : t('usuarios.senha.mostrar')} className="absolute right-3 top-1/2 -translate-y-1/2 text-rl-muted hover:text-rl-subtle transition-colors">
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {password.length > 0 && password.length < 6 && (
            <p className="text-xs text-rl-red mt-1">{t('usuarios.senha.minimo')}</p>
          )}
        </div>

        <div>
          <label htmlFor="pwd-confirm" className="block text-xs font-semibold text-rl-text mb-1.5">{t('usuarios.senha.confirmar')}</label>
          <input
            id="pwd-confirm"
            type={showPass ? 'text' : 'password'}
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder={t('usuarios.senha.repita')}
            className="input-field w-full"
          />
          {mismatch && <p className="text-xs text-rl-red mt-1">{t('usuarios.senha.naoCoincidem')}</p>}
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 btn-ghost" disabled={saving}>{t('comum.cancelar')}</button>
        <button
          onClick={() => onSave(password)}
          disabled={!valid || saving}
          className="flex-1 btn-primary disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
          {t('usuarios.senha.salvar')}
        </button>
      </div>
    </Modal>
  )
}

function UserFormModal({ title, initial, onSave, onClose, saving, clickupMembers, loadingMembers }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    email: initial?.email || '',
    password: '',
    role: initial?.role || 'member',
    clickup_user_id: initial?.clickup_user_id ?? initial?.clickupUserId ?? '',
  })
  const isCreate = !initial
  const { t } = useI18n()

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
          <button onClick={onClose} aria-label={t('usuarios.form.fechar')} className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Fields */}
        <div className="space-y-4 mb-6">
          <div>
            <label htmlFor="field-name" className="block text-xs font-semibold text-rl-text mb-1.5">{t('usuarios.form.nome')}</label>
            <input
              id="field-name"
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder={t('usuarios.form.nomePlaceholder')}
              className="input-field w-full"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="field-email" className="block text-xs font-semibold text-rl-text mb-1.5">{t('usuarios.form.email')}</label>
            <input
              id="field-email"
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder={t('usuarios.form.emailPlaceholder')}
              className="input-field w-full"
            />
          </div>

          {isCreate && (
            <div>
              <label htmlFor="field-password" className="block text-xs font-semibold text-rl-text mb-1.5">{t('usuarios.form.senhaInicial')}</label>
              <input
                id="field-password"
                type="password"
                value={form.password}
                onChange={e => set('password', e.target.value)}
                placeholder={t('usuarios.senha.minimo')}
                className="input-field w-full"
              />
              {form.password && form.password.length < 6 && (
                <p className="text-xs text-rl-red mt-1">{t('usuarios.senha.minimo')}</p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="field-role" className="block text-xs font-semibold text-rl-text mb-1.5">{t('usuarios.form.permissao')}</label>
            <select
              id="field-role"
              value={form.role}
              onChange={e => set('role', e.target.value)}
              className="input-field w-full"
            >
              <option value="member">{t('usuarios.papel.member')}</option>
              <option value="admin">{t('usuarios.papel.admin')}</option>
            </select>
          </div>

          {/* Mapeamento ClickUp — só aparece em edição (precisa do user já criado) */}
          {!isCreate && (
            <div>
              <label htmlFor="field-clickup" className="block text-xs font-semibold text-rl-text mb-1.5">
                {t('usuarios.form.clickup')}
              </label>
              <select
                id="field-clickup"
                value={form.clickup_user_id || ''}
                onChange={e => set('clickup_user_id', e.target.value)}
                className="input-field w-full"
                disabled={loadingMembers}
              >
                <option value="">{t('usuarios.form.naoVinculado')}</option>
                {(clickupMembers || []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}{m.email ? ` (${m.email})` : ''}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-rl-muted mt-1">
                {loadingMembers
                  ? t('usuarios.form.carregandoClickup')
                  : t('usuarios.form.clickupDica')}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 btn-ghost" disabled={saving}>
            {t('comum.cancelar')}
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={!valid || saving}
            className="flex-1 btn-primary disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isCreate ? t('usuarios.form.criar') : t('usuarios.form.salvarAlteracoes')}
          </button>
        </div>

    </Modal>
  )
}

function ToggleConfirmModal({ user, onConfirm, onClose, saving }) {
  const isDisabling = !user.disabled
  const { t } = useI18n()
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
              {isDisabling ? t('usuarios.desativarUsuario') : t('usuarios.reativarUsuario')}
            </h2>
            <p className="text-xs text-rl-muted mt-0.5">
              {isDisabling
                ? t('usuarios.toggle.desativarTexto')
                : t('usuarios.toggle.reativarTexto')}
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-rl-surface border border-rl-border px-4 py-3 mb-5">
          <p className="text-[11px] text-rl-muted mb-0.5">{t('usuarios.senha.usuario')}</p>
          <p className="text-sm font-bold text-rl-text">{user.name}</p>
          <p className="text-xs text-rl-muted mt-0.5">{user.email}</p>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 btn-ghost" disabled={saving}>
            {t('comum.cancelar')}
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
            {isDisabling ? t('usuarios.desativar') : t('usuarios.reativar')}
          </button>
        </div>
    </Modal>
  )
}


const SQUAD_MEMBER_ROLES = ['Account Manager', 'Gestor de Tráfego', 'Designer']
// Valor gravado em squads.members[].role → chave do rótulo (só a tela traduz).
const PAPEL_EQUIPE_CHAVE = { 'Account Manager': 'accountManager', 'Gestor de Tráfego': 'gestorTrafego', 'Designer': 'designer' }
function rotuloPapelEquipe(t, role) {
  const k = PAPEL_EQUIPE_CHAVE[role]
  return k ? t(`usuarios.papelEquipe.${k}`) : role
}

// ── SquadFormModal ──────────────────────────────────────────────────────────

function SquadFormModal({ initial, teamMembers, perfis, onSave, onClose, saving }) {
  const isCreate = !initial
  const { t } = useI18n()
  const [form, setForm] = useState({
    name:    initial?.name    || '',
    emoji:   initial?.emoji   || '',
    members: initial?.members ? [...initial.members] : [],
  })

  const valid = form.name.trim().length > 0
  // membros gravados na equipe que não estão entre os ativos (desativados ou apagados)
  const inativos = form.members.filter((m) => !teamMembers.some((tm) => tm.id === m.profile_id))

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
            <h2 className="text-base font-bold text-rl-text">{isCreate ? t('usuarios.novaEquipe') : t('usuarios.editarEquipe')}</h2>
          </div>
          <button onClick={onClose} aria-label={t('comum.fechar')} className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 mb-6">
          {/* Nome */}
          <div>
            <label htmlFor="field-squad-name" className="block text-xs font-semibold text-rl-text mb-1.5">{t('usuarios.equipe.nome')}</label>
            <input
              id="field-squad-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t('usuarios.equipe.nomePlaceholder')}
              className="input-field w-full"
              autoFocus
            />
          </div>

          {/* Emoji */}
          <div>
            <label htmlFor="field-squad-emoji" className="block text-xs font-semibold text-rl-text mb-1.5">{t('usuarios.equipe.emoji')} <span className="text-rl-muted font-normal">{t('usuarios.equipe.opcional')}</span></label>
            <input
              id="field-squad-emoji"
              type="text"
              value={form.emoji}
              onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
              placeholder={t('usuarios.equipe.emojiPlaceholder')}
              className="input-field w-full"
              maxLength={4}
            />
          </div>

          {/* Membros */}
          <div>
            <label className="block text-xs font-semibold text-rl-text mb-2">{t('usuarios.equipe.membros')}</label>
            <div className="space-y-2">
              {inativos.length > 0 && (
                <p className="text-[11px] text-red-400">
                  {t('usuarios.equipe.inativosAviso', { count: inativos.length })}
                </p>
              )}
              {inativos.map((m) => {
                const info = rotuloInativo(perfis, m.profile_id)
                return (
                  <div key={m.profile_id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-red-500/30 bg-red-500/5 cursor-pointer" onClick={() => toggleMember(m.profile_id)}>
                    <input type="checkbox" checked onChange={() => toggleMember(m.profile_id)} onClick={(e) => e.stopPropagation()} className="w-4 h-4 accent-rl-purple shrink-0" aria-label={t('usuarios.equipe.tirar', { nome: info.nome })} />
                    <div className="w-8 h-8 rounded-full bg-rl-surface border border-rl-border flex items-center justify-center text-xs font-bold text-rl-muted shrink-0">{initials(info.nome)}</div>
                    <span className="text-base text-rl-muted flex-1 min-w-0 truncate leading-none line-through">{info.nome}</span>
                    <SeloInativo motivo={info.motivo} />
                    <span className="text-xs text-rl-muted w-48 shrink-0 truncate">{rotuloPapelEquipe(t, m.role)}</span>
                  </div>
                )
              })}
              {teamMembers.map((tm) => {
                const memberEntry = form.members.find((m) => m.profile_id === tm.id)
                const checked     = !!memberEntry
                return (
                  <div key={tm.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-pointer ${checked ? 'bg-rl-surface border-rl-purple/30' : 'border-rl-border hover:border-rl-border/60'}`}
                    onClick={() => toggleMember(tm.id)}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMember(tm.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 accent-rl-purple shrink-0"
                    />
                    <div className="w-8 h-8 rounded-full bg-gradient-rl flex items-center justify-center text-xs font-bold text-white shrink-0">
                      {tm.avatar || initials(tm.name)}
                    </div>
                    <span className="text-base text-rl-text flex-1 min-w-0 truncate leading-none">{tm.name}</span>
                    {checked && (
                      <select
                        value={memberEntry.role}
                        onChange={(e) => { e.stopPropagation(); setMemberRole(tm.id, e.target.value) }}
                        onClick={(e) => e.stopPropagation()}
                        className="input-field text-xs py-1 px-2 h-auto w-48 shrink-0"
                      >
                        {SQUAD_MEMBER_ROLES.map((r) => (
                          <option key={r} value={r}>{rotuloPapelEquipe(t, r)}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )
              })}
              {teamMembers.length === 0 && (
                <p className="text-xs text-rl-muted py-2">{t('usuarios.equipe.semMembros')}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 btn-ghost" disabled={saving}>{t('comum.cancelar')}</button>
          <button
            onClick={() => onSave(form)}
            disabled={!valid || saving}
            className="flex-1 btn-primary disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {isCreate ? t('usuarios.equipe.criar') : t('usuarios.form.salvarAlteracoes')}
          </button>
        </div>
    </Modal>
  )
}

// Perfil de quem está na equipe mas não está ativo: desativado em Usuários ou apagado.
// `perfis` = todos os profiles (ativos e desativados), carregados pela página.
function rotuloInativo(perfis, id) {
  const p = perfis?.get(id)
  return p ? { nome: p.name || p.email || tSolto('usuarios.inativo.semNome'), motivo: 'desativado' } : { nome: tSolto('usuarios.inativo.perfilRemovido', { id: String(id).slice(0, 8) }), motivo: 'removido' }
}

function SeloInativo({ motivo }) {
  const { t } = useI18n()
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 whitespace-nowrap">
      {motivo === 'removido' ? t('usuarios.inativo.removido') : t('usuarios.inativo.desativado')}
    </span>
  )
}

// ── DeleteSquadModal ────────────────────────────────────────────────────────

function DeleteSquadModal({ squad, onConfirm, onClose, saving }) {
  const { t } = useI18n()
  return (
    <Modal onClose={onClose} maxWidth="sm" className="border-red-500/30">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-red-500/10">
            <Trash2 className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-rl-text">{t('usuarios.excluirEquipe.titulo')}</h2>
            <p className="text-xs text-rl-muted mt-0.5">{t('usuarios.excluirEquipe.texto')}</p>
          </div>
        </div>
        <div className="rounded-xl bg-rl-surface border border-rl-border px-4 py-3 mb-5">
          <p className="text-[11px] text-rl-muted mb-0.5">{t('usuarios.excluirEquipe.equipe')}</p>
          <p className="text-sm font-bold text-rl-text">{squad.emoji} {squad.name}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 btn-ghost" disabled={saving}>{t('comum.cancelar')}</button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-40"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {t('comum.excluir')}
          </button>
        </div>
    </Modal>
  )
}

// ── SquadDepartmentsModal ──────────────────────────────────────────────────
// Configuração de "departamento → responsável" para o squad. Usado pela
// integração com ClickUp: quando uma tarefa tem o custom field 'Departamento'
// preenchido, o sistema atribui o responsável conforme essa matriz.

function SquadDepartmentsModal({ squad, teamMembers, perfis, onSave, onClose, saving }) {
  const { t } = useI18n()
  // assignments: { [departmentName]: profile_uuid | '' }
  const [assignments, setAssignments] = useState(() => {
    const initial = squad.departmentAssignments || squad.department_assignments || {}
    const filled = {}
    CLICKUP_DEPARTMENTS.forEach((d) => { filled[d.name] = initial[d.name] || '' })
    return filled
  })

  function set(department, profileId) {
    setAssignments((prev) => ({ ...prev, [department]: profileId }))
  }

  // Lista todos os profiles ativos com clickupUserId preenchido (mostra também os
  // sem ClickUp mas marcados — usuário pode escolher e depois cadastrar o ID).
  const sortedMembers = [...teamMembers].sort((a, b) => (a.name || '').localeCompare(b.name || ''))

  function handleSave() {
    // Persiste limpando as chaves vazias pra economizar espaço no JSONB.
    const cleaned = {}
    Object.entries(assignments).forEach(([k, v]) => {
      if (v && v.trim()) cleaned[k] = v
    })
    onSave({ department_assignments: cleaned })
  }

  return (
    <Modal onClose={onClose} maxWidth="lg">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-rl-cyan/10 border border-rl-cyan/30 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5 text-rl-cyan" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-rl-text truncate">
              {t('usuarios.departamentos.titulo', { equipe: `${squad.emoji || ''} ${squad.name}`.trim() })}
            </h2>
            <p className="text-xs text-rl-muted mt-0.5">
              {t('usuarios.departamentos.texto')}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all" aria-label={t('comum.fechar')}>
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2 max-h-[55vh] overflow-y-auto -mx-2 px-2">
        {CLICKUP_DEPARTMENTS.map((dep) => {
          const value = assignments[dep.name] || ''
          const selected = value ? sortedMembers.find((m) => m.id === value) : null
          const inativo = value && !selected ? rotuloInativo(perfis, value) : null
          const noClickup = selected && !(selected.clickupUserId ?? selected.clickup_user_id)
          return (
            <div key={dep.id} className={`flex flex-col sm:flex-row sm:items-center gap-2 px-3 py-2.5 rounded-xl border ${inativo ? 'border-red-500/30 bg-red-500/5' : 'border-rl-border bg-rl-surface/40'}`}>
              <div className="flex items-center gap-2 sm:w-44 shrink-0">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: dep.color }} />
                <span className="text-sm font-semibold text-rl-text truncate">{rotuloDepartamento(dep.name)}</span>
              </div>
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <select
                  value={value}
                  onChange={(e) => set(dep.name, e.target.value)}
                  className="input-field flex-1 text-sm"
                >
                  <option value="">{t('usuarios.departamentos.naoAtribuido')}</option>
                  {inativo && <option value={value}>{inativo.nome} ({t(`usuarios.inativo.${inativo.motivo}`)})</option>}
                  {sortedMembers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                {inativo && <SeloInativo motivo={inativo.motivo} />}
                {noClickup && (
                  <span title={t('usuarios.departamentos.semClickupDica')} className="text-[10px] text-rl-gold font-semibold whitespace-nowrap">
                    {t('usuarios.departamentos.semClickup')}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex gap-3 mt-5">
        <button onClick={onClose} className="flex-1 btn-ghost" disabled={saving}>{t('comum.cancelar')}</button>
        <button onClick={handleSave} disabled={saving} className="flex-1 btn-primary flex items-center justify-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {t('usuarios.departamentos.salvar')}
        </button>
      </div>
    </Modal>
  )
}

// ── Página ─────────────────────────────────────────────────────────────────

export default function UserManagement() {
  const { user: currentUser, squads, addSquad, updateSquad, deleteSquad, teamMembers } = useApp()
  const { openSidebar } = useOutletContext()
  const [activeTab, setActiveTab] = useState('users')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [toggleTarget, setToggleTarget] = useState(null)
  const [saving, setSaving] = useState(false)
  const { toast, showToast } = useToast()
  const { t } = useI18n()

  // Password reset state
  const [passwordTarget, setPasswordTarget] = useState(null)

  // Squad state
  const [showCreateSquad, setShowCreateSquad] = useState(false)
  const [editSquadTarget, setEditSquadTarget] = useState(null)
  const [deleteSquadTarget, setDeleteSquadTarget] = useState(null)
  const [departmentSquadTarget, setDepartmentSquadTarget] = useState(null)
  const [savingSquad, setSavingSquad] = useState(false)

  // ClickUp members — carregados sob demanda quando abrir um modal de edição
  const [clickupMembers, setClickupMembers] = useState([])
  const [loadingClickupMembers, setLoadingClickupMembers] = useState(false)
  const [clickupMembersLoaded, setClickupMembersLoaded] = useState(false)

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
  // todos os perfis (ativos e desativados): dá nome a quem segue numa equipe depois de desativado
  const perfis = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])

  // Carrega lista de membros do ClickUp sob demanda na primeira vez que
  // um modal de edição for aberto (cache no estado do componente).
  useEffect(() => {
    if (!editTarget || clickupMembersLoaded) return
    let cancelled = false
    setLoadingClickupMembers(true)
    listClickUpMembers()
      .then((res) => {
        if (cancelled) return
        if (res.ok) {
          setClickupMembers(res.members)
        } else {
          console.error('[ClickUp] erro ao listar membros:', res.error)
          showToast(tSolto('usuarios.toast.erroClickup'), 'error')
        }
        setClickupMembersLoaded(true)
      })
      .catch((e) => {
        if (cancelled) return
        console.error('[ClickUp] erro inesperado:', e)
        setClickupMembersLoaded(true)
      })
      .finally(() => {
        if (!cancelled) setLoadingClickupMembers(false)
      })
    return () => { cancelled = true }
    // showToast é estável (vem de useToast); não precisa do loadingClickupMembers nas deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTarget, clickupMembersLoaded])

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
      showToast(t('usuarios.toast.usuarioCriado', { nome: form.name }))
      setShowCreate(false)
      loadUsers()
    }
    setSaving(false)
  }

  async function handleUpdate(form) {
    setSaving(true)
    const avatar = initials(form.name)
    // Normaliza clickup_user_id: '' vira null, número vira number
    const clickupId = form.clickup_user_id === '' || form.clickup_user_id == null
      ? null
      : Number(form.clickup_user_id)
    const result = await callAdminAPI('update_user', {
      userId: editTarget.id,
      ...form,
      clickup_user_id: clickupId,
    })
    if (result.error) {
      showToast(result.error, 'error')
    } else {
      await supabase.from('profiles').update({
        name: form.name,
        email: form.email,
        avatar,
        role: form.role,
        clickup_user_id: clickupId,
      }).eq('id', editTarget.id)
      showToast(t('usuarios.toast.usuarioAtualizado'))
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
      showToast(toggleTarget.disabled ? t('usuarios.toast.usuarioReativado') : t('usuarios.toast.usuarioDesativado'), 'success', 6000)
      setToggleTarget(null)
      loadUsers()
    }
    setSaving(false)
  }

  const ROLE_BADGE = {
    admin:  'text-rl-purple bg-rl-purple/10 border-rl-purple/30',
    member: 'text-rl-blue   bg-rl-blue/10   border-rl-blue/30',
  }
  const ROLE_LABEL = { admin: t('usuarios.papel.admin'), member: t('usuarios.papel.member') }

  async function handleResetPassword(password) {
    setSaving(true)
    const result = await callAdminAPI('reset_password', { userId: passwordTarget.id, password })
    if (result.error) {
      showToast(result.error, 'error')
    } else {
      showToast(t('usuarios.toast.senhaRedefinida', { nome: passwordTarget.name }))
      setPasswordTarget(null)
    }
    setSaving(false)
  }

  async function handleCreateSquad(form) {
    setSavingSquad(true)
    const result = await addSquad(form)
    if (result.error) showToast(result.error, 'error')
    else { showToast(t('usuarios.toast.equipeCriada')); setShowCreateSquad(false) }
    setSavingSquad(false)
  }

  async function handleUpdateSquad(form) {
    setSavingSquad(true)
    const result = await updateSquad(editSquadTarget.id, form)
    if (result.error) showToast(result.error, 'error')
    else { showToast(t('usuarios.toast.equipeAtualizada')); setEditSquadTarget(null) }
    setSavingSquad(false)
  }

  async function handleUpdateSquadDepartments(patch) {
    setSavingSquad(true)
    const sq = departmentSquadTarget
    // Mantém todos os outros campos do squad e atualiza apenas department_assignments
    const result = await updateSquad(sq.id, {
      name: sq.name,
      emoji: sq.emoji,
      members: sq.members,
      department_assignments: patch.department_assignments,
    })
    if (result.error) showToast(result.error, 'error')
    else { showToast(t('usuarios.toast.departamentosAtualizados')); setDepartmentSquadTarget(null) }
    setSavingSquad(false)
  }

  async function handleDeleteSquad() {
    setSavingSquad(true)
    const result = await deleteSquad(deleteSquadTarget.id)
    if (result.error) showToast(result.error, 'error')
    else { showToast(t('usuarios.toast.equipeExcluida')); setDeleteSquadTarget(null) }
    setSavingSquad(false)
  }

  return (
    <>

      {/* Sidebar (sem filtros, só navegação) */}

      <div className="flex-1 min-w-0 flex flex-col">

        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 border-b border-rl-border bg-rl-bg/90 backdrop-blur-xl">
          <button
            onClick={openSidebar}
            aria-label={t('usuarios.abrirMenu')}
            className="p-2 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold text-rl-text text-sm">{t('usuarios.topo')}</span>
        </div>

        <main className="flex-1 px-6 py-8 max-w-4xl w-full mx-auto space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between animate-slide-up">
            <div>
              <h1 className="text-2xl font-bold text-rl-text">{t('usuarios.titulo')}</h1>
              <p className="text-rl-muted text-sm mt-1">{t('usuarios.subtitulo')}</p>
            </div>
            {activeTab === 'users' ? (
              <button
                onClick={() => setShowCreate(true)}
                className="btn-primary flex items-center gap-2 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                {t('usuarios.novoUsuario')}
              </button>
            ) : (
              <button
                onClick={() => setShowCreateSquad(true)}
                className="btn-primary flex items-center gap-2 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                {t('usuarios.novaEquipe')}
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
              {t('usuarios.abas.usuarios')}
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
              {t('usuarios.abas.equipes')}
            </button>
          </div>

          {/* Aba Usuários */}
          {activeTab === 'users' && (
          <div className="glass-card overflow-hidden animate-slide-up" style={{ animationDelay: '0.05s' }}>
            {loading ? (
              <div className="flex items-center justify-center py-16 gap-3 text-rl-muted">
                <Loader2 className="w-6 h-6 animate-spin text-rl-purple" />
                <span className="text-sm">{t('usuarios.carregandoUsuarios')}</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center gap-3 px-6 py-8 text-red-400">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
                <button onClick={loadUsers} className="btn-ghost text-sm text-rl-muted hover:text-rl-text">
                  {t('comum.tenteNovamente')}
                </button>
              </div>
            ) : users.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-rl-muted">
                <Users className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">{t('usuarios.semUsuarios')}</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-rl-border">
                    <th className="text-left px-5 py-3 text-[11px] font-bold text-rl-muted uppercase tracking-wider">{t('usuarios.tabela.usuario')}</th>
                    <th className="text-left px-5 py-3 text-[11px] font-bold text-rl-muted uppercase tracking-wider hidden md:table-cell">{t('usuarios.tabela.email')}</th>
                    <th className="text-left px-5 py-3 text-[11px] font-bold text-rl-muted uppercase tracking-wider">{t('usuarios.tabela.permissao')}</th>
                    <th className="text-left px-5 py-3 text-[11px] font-bold text-rl-muted uppercase tracking-wider">{t('usuarios.tabela.status')}</th>
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
                            <span className="text-[10px] text-rl-muted border border-rl-border px-1.5 py-0.5 rounded-full">{t('usuarios.voce')}</span>
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
                          {u.disabled ? t('usuarios.status.desativado') : t('usuarios.status.ativo')}
                        </span>
                      </td>
                      {/* Ações */}
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditTarget(u)}
                            aria-label={t('usuarios.editar')}
                            className="p-1.5 rounded-lg text-rl-muted hover:text-rl-purple hover:bg-rl-purple/10 transition-all"
                            title={t('comum.editar')}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setPasswordTarget(u)}
                            aria-label={t('usuarios.redefinirSenha')}
                            className="p-1.5 rounded-lg text-rl-muted hover:text-rl-cyan hover:bg-rl-cyan/10 transition-all"
                            title={t('usuarios.redefinirSenha')}
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
                              aria-label={u.disabled ? t('usuarios.reativarUsuario') : t('usuarios.desativarUsuario')}
                              title={u.disabled ? t('usuarios.reativar') : t('usuarios.desativar')}
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
                  <p className="text-sm">{t('usuarios.equipe.semEquipes')}</p>
                  <button onClick={() => setShowCreateSquad(true)} className="mt-4 btn-ghost text-sm">
                    {t('usuarios.equipe.criarPrimeira')}
                  </button>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {squads.map((sq, idx) => {
                    const colors   = SQUAD_COLORS[idx % SQUAD_COLORS.length]
                    const members  = (sq.members || []).map((m) => {
                      const profile = teamMembers.find((tm) => tm.id === m.profile_id)
                      if (profile) return { id: m.profile_id, name: profile.name, role: m.role, avatar: profile.avatar }
                      const info = rotuloInativo(perfis, m.profile_id)
                      return { id: m.profile_id, name: info.nome, role: m.role, inativo: info.motivo }
                    })
                    const asg = sq.department_assignments || sq.departmentAssignments || {}
                    const depsInativos = Object.entries(asg).filter(([, id]) => id && !teamMembers.some((tm) => tm.id === id)).map(([d]) => d)
                    const ativos = members.filter((m) => !m.inativo).length
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
                              <p className="text-xs text-rl-muted">{t('usuarios.equipe.contagemMembros', { count: ativos })}{members.length > ativos ? t('usuarios.equipe.contagemInativos', { count: members.length - ativos }) : ''}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => setDepartmentSquadTarget(sq)}
                              aria-label={t('usuarios.equipe.configurarDepartamentos')}
                              className="p-1.5 rounded-lg text-rl-muted hover:text-rl-cyan hover:bg-rl-cyan/10 transition-all"
                              title={t('usuarios.equipe.configurarDepartamentosDica')}
                            >
                              <Layers className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditSquadTarget(sq)}
                              aria-label={t('usuarios.equipe.editar')}
                              className="p-1.5 rounded-lg text-rl-muted hover:text-rl-purple hover:bg-rl-purple/10 transition-all"
                              title={t('comum.editar')}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteSquadTarget(sq)}
                              aria-label={t('usuarios.equipe.excluir')}
                              className="p-1.5 rounded-lg text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition-all"
                              title={t('comum.excluir')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Membros */}
                        {members.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {members.map((m) => (
                              <div key={m.id} className={`flex items-center gap-1.5 ${m.inativo ? 'opacity-70' : ''}`}>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${m.inativo ? 'bg-rl-surface text-rl-muted' : `${colors.bg} ${colors.text}`}`}>
                                  {m.avatar || initials(m.name)}
                                </div>
                                <span className={`text-xs ${m.inativo ? 'text-rl-muted line-through' : 'text-rl-text'}`}>{m.name}</span>
                                {m.inativo && <SeloInativo motivo={m.inativo} />}
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}>{rotuloPapelEquipe(t, m.role)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {depsInativos.length > 0 && (
                          <button type="button" onClick={() => setDepartmentSquadTarget(sq)} className="w-full text-left text-[11px] text-red-400 px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 transition-all">
                            {t('usuarios.equipe.depsInativos', { count: depsInativos.length, lista: depsInativos.map((d) => rotuloDepartamento(d)).join(', ') })}
                          </button>
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
          title={t('usuarios.novoUsuario')}
          initial={null}
          onSave={handleCreate}
          onClose={() => setShowCreate(false)}
          saving={saving}
        />
      )}
      {editTarget && (
        <UserFormModal
          title={t('usuarios.editarUsuario')}
          initial={editTarget}
          onSave={handleUpdate}
          onClose={() => setEditTarget(null)}
          saving={saving}
          clickupMembers={clickupMembers}
          loadingMembers={loadingClickupMembers}
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
          perfis={perfis}
          onSave={handleCreateSquad}
          onClose={() => setShowCreateSquad(false)}
          saving={savingSquad}
        />
      )}
      {editSquadTarget && (
        <SquadFormModal
          initial={editSquadTarget}
          teamMembers={teamMembers}
          perfis={perfis}
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
      {departmentSquadTarget && (
        <SquadDepartmentsModal
          squad={departmentSquadTarget}
          teamMembers={teamMembers}
          perfis={perfis}
          onSave={handleUpdateSquadDepartments}
          onClose={() => setDepartmentSquadTarget(null)}
          saving={savingSquad}
        />
      )}
    </>
  )
}
