// Módulo "Compartilhamento" do ClientProfile: chaves de acesso do portal
// (/portal/:projectId). Cada chave tem rótulo, senha, validade e a matriz
// módulo × permissão. Tudo passa por api/portal.js (a senha vira hash no servidor).
import { useEffect, useState } from 'react'
import {
  Share2, Plus, Copy, Check, Pencil, Trash2, Power, Eye, EyeOff, RefreshCw,
  Loader2, AlertTriangle, Clock, KeyRound, ExternalLink,
} from 'lucide-react'
import Modal from './UI/Modal'
import {
  PORTAL_MODULES, PERMISSION_LABELS,
  listShares, saveShare, deleteShare, generatePassword, portalUrl,
} from '../lib/portal'

const LEVELS = ['none', 'view', 'edit']

function statusOf(share) {
  if (!share.enabled) return { label: 'Desativada', cls: 'text-rl-muted bg-rl-surface border-rl-border' }
  if (share.expires_at && new Date(share.expires_at) < new Date()) return { label: 'Expirada', cls: 'text-amber-400 bg-amber-400/10 border-amber-400/30' }
  return { label: 'Ativa', cls: 'text-rl-green bg-rl-green/10 border-rl-green/30' }
}

function fmtDate(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function emptyForm() {
  return { id: null, label: '', password: generatePassword(), enabled: true, expires_at: '', permissions: {} }
}

export default function CompartilhamentoModule({ project, showToast }) {
  const [shares, setShares]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [form, setForm]       = useState(null)
  const [saving, setSaving]   = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [copied, setCopied]   = useState(false)
  const [showPwd, setShowPwd] = useState(true)

  const url = portalUrl(project.id)

  async function load() {
    setLoading(true); setError(null)
    try {
      const data = await listShares(project.id)
      setShares(data.shares || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [project.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function copyUrl() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function openNew() { setForm(emptyForm()); setShowPwd(true) }
  function openEdit(s) {
    setForm({ id: s.id, label: s.label, password: '', enabled: s.enabled, expires_at: s.expires_at ? s.expires_at.slice(0, 10) : '', permissions: s.permissions || {} })
    setShowPwd(true)
  }

  function setPerm(moduleId, level) {
    setForm((f) => {
      const permissions = { ...f.permissions }
      if (level === 'none') delete permissions[moduleId]
      else permissions[moduleId] = level
      return { ...f, permissions }
    })
  }
  function setAll(level) {
    setForm((f) => {
      const permissions = {}
      if (level !== 'none') for (const m of PORTAL_MODULES) permissions[m.id] = level
      return { ...f, permissions }
    })
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.label.trim()) { showToast?.('Dê um nome para a chave.', 'error'); return }
    if (!form.id && form.password.length < 6) { showToast?.('A senha precisa ter ao menos 6 caracteres.', 'error'); return }
    if (form.password && form.password.length < 6) { showToast?.('A senha precisa ter ao menos 6 caracteres.', 'error'); return }
    if (Object.keys(form.permissions).length === 0) { showToast?.('Libere ao menos um módulo.', 'error'); return }
    setSaving(true)
    try {
      await saveShare({
        projectId:   project.id,
        id:          form.id,
        label:       form.label.trim(),
        password:    form.password || undefined,
        enabled:     form.enabled,
        expires_at:  form.expires_at ? new Date(form.expires_at + 'T23:59:59').toISOString() : null,
        permissions: form.permissions,
      })
      showToast?.(form.id ? 'Chave atualizada.' : 'Chave criada.')
      setForm(null)
      load()
    } catch (err) {
      showToast?.(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function toggle(s) {
    try {
      await saveShare({ projectId: project.id, id: s.id, enabled: !s.enabled })
      showToast?.(s.enabled ? 'Chave desativada.' : 'Chave ativada.')
      load()
    } catch (err) { showToast?.(err.message, 'error') }
  }

  async function handleDelete() {
    try {
      await deleteShare(project.id, confirmDelete.id)
      showToast?.('Chave excluída.')
      setConfirmDelete(null)
      load()
    } catch (err) { showToast?.(err.message, 'error') }
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="glass-card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rl-cyan/10 flex items-center justify-center shrink-0">
              <Share2 className="w-5 h-5 text-rl-cyan" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-rl-text">Compartilhamento</h2>
              <p className="text-sm text-rl-muted mt-0.5 max-w-xl">
                Um único link para este cliente. Cada chave tem a própria senha e define quais módulos
                aparecem para quem entra. Use uma chave por público (parceiro, cliente…), assim dá para
                revogar uma sem mexer na outra.
              </p>
            </div>
          </div>
          <button onClick={openNew} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Nova chave
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-rl-muted">Link do portal</span>
          <code className="text-xs px-2.5 py-1.5 rounded-lg bg-rl-bg border border-rl-border text-rl-text truncate max-w-full">{url}</code>
          <button onClick={copyUrl} className="btn-secondary flex items-center gap-1.5 text-xs px-2.5 py-1.5" title="Copiar link">
            {copied ? <Check className="w-3.5 h-3.5 text-rl-green" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
          <a href={url} target="_blank" rel="noreferrer" className="btn-secondary flex items-center gap-1.5 text-xs px-2.5 py-1.5" title="Abrir portal">
            <ExternalLink className="w-3.5 h-3.5" /> Abrir
          </a>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="glass-card p-8 flex items-center justify-center gap-2 text-sm text-rl-muted">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando chaves…
        </div>
      ) : error ? (
        <div className="glass-card p-5 flex items-center gap-2 text-sm text-red-400">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      ) : shares.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <KeyRound className="w-8 h-8 text-rl-muted mx-auto mb-2" />
          <p className="text-sm text-rl-text font-medium">Nenhuma chave criada</p>
          <p className="text-xs text-rl-muted mt-1">O portal só abre depois que existir ao menos uma chave ativa.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {shares.map((s) => {
            const st = statusOf(s)
            const mods = PORTAL_MODULES.filter((m) => s.permissions?.[m.id])
            return (
              <div key={s.id} className={`glass-card p-4 ${!s.enabled ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-rl-text truncate">{s.label}</h3>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span>
                    </div>
                    <p className="text-xs text-rl-muted mt-1">
                      {mods.length} {mods.length === 1 ? 'módulo' : 'módulos'}
                      {s.expires_at && <> · <Clock className="w-3 h-3 inline -mt-0.5" /> expira {fmtDate(s.expires_at)}</>}
                    </p>
                    <p className="text-xs text-rl-muted mt-0.5">
                      {s.last_access_at ? `Último acesso ${fmtDate(s.last_access_at)} · ${s.access_count} ${s.access_count === 1 ? 'entrada' : 'entradas'}` : 'Nunca acessada'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggle(s)} title={s.enabled ? 'Desativar' : 'Ativar'} className={`p-1.5 rounded-lg transition-all ${s.enabled ? 'text-rl-green hover:bg-rl-green/10' : 'text-rl-muted hover:bg-rl-surface'}`}>
                      <Power className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => openEdit(s)} title="Editar" className="p-1.5 rounded-lg text-rl-muted hover:text-rl-purple hover:bg-rl-purple/10 transition-all">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setConfirmDelete(s)} title="Excluir" className="p-1.5 rounded-lg text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {mods.map((m) => (
                    <span key={m.id} className={`text-[10px] px-2 py-0.5 rounded-full border ${s.permissions[m.id] === 'edit' ? 'text-rl-gold bg-rl-gold/10 border-rl-gold/30' : 'text-rl-cyan bg-rl-cyan/10 border-rl-cyan/30'}`}>
                      {m.label}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Formulário */}
      {form && (
        <Modal onClose={() => !saving && setForm(null)} maxWidth="2xl" className="max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <h3 className="text-base font-semibold text-rl-text">{form.id ? 'Editar chave' : 'Nova chave de acesso'}</h3>
              <p className="text-xs text-rl-muted mt-0.5">Quem entrar com esta senha vê apenas os módulos liberados abaixo.</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label-field">Nome da chave</label>
                <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Ex.: Parceiro X, Cliente" className="input-field w-full" autoFocus />
              </div>
              <div>
                <label className="label-field">Validade (opcional)</label>
                <input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} className="input-field w-full" />
              </div>
            </div>

            <div>
              <label className="label-field">{form.id ? 'Nova senha (deixe em branco para manter)' : 'Senha'}</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder={form.id ? '••••••••' : 'mínimo 6 caracteres'}
                    className="input-field w-full pr-9 font-mono"
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowPwd((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-rl-muted hover:text-rl-text" title={showPwd ? 'Ocultar' : 'Mostrar'}>
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button type="button" onClick={() => { setForm({ ...form, password: generatePassword() }); setShowPwd(true) }} className="btn-secondary flex items-center gap-1.5 text-xs px-3" title="Gerar senha">
                  <RefreshCw className="w-3.5 h-3.5" /> Gerar
                </button>
              </div>
              <p className="text-[11px] text-rl-muted mt-1">A senha não fica visível depois de salvar. Copie e envie agora.</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label-field mb-0">Módulos e permissões</label>
                <div className="flex gap-1 text-[11px]">
                  <button type="button" onClick={() => setAll('view')} className="px-2 py-1 rounded-lg text-rl-cyan hover:bg-rl-cyan/10">Liberar todos</button>
                  <button type="button" onClick={() => setAll('none')} className="px-2 py-1 rounded-lg text-rl-muted hover:bg-rl-surface">Limpar</button>
                </div>
              </div>
              <div className="rounded-xl border border-rl-border divide-y divide-rl-border/60 overflow-hidden">
                {PORTAL_MODULES.map((m) => {
                  const cur = form.permissions[m.id] || 'none'
                  return (
                    <div key={m.id} className="flex items-center justify-between gap-3 px-3 py-2 bg-rl-bg/40">
                      <span className="text-sm text-rl-text">{m.label}</span>
                      <div className="flex gap-1">
                        {LEVELS.map((lv) => {
                          const disabled = lv === 'edit'
                          const active = cur === lv
                          return (
                            <button
                              key={lv}
                              type="button"
                              disabled={disabled}
                              onClick={() => setPerm(m.id, lv)}
                              title={disabled ? 'Edição pelo portal ainda não disponível' : undefined}
                              className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                                active
                                  ? lv === 'none' ? 'bg-rl-surface border-rl-border text-rl-text' : 'bg-rl-cyan/15 border-rl-cyan/40 text-rl-cyan'
                                  : 'border-transparent text-rl-muted hover:bg-rl-surface'
                              } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                            >
                              {PERMISSION_LABELS[lv]}{disabled ? ' (em breve)' : ''}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-rl-text cursor-pointer">
              <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} className="accent-rl-purple" />
              Chave ativa
            </label>

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setForm(null)} disabled={saving} className="btn-secondary text-sm">Cancelar</button>
              <button type="submit" disabled={saving} className="btn-primary text-sm flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {form.id ? 'Salvar' : 'Criar chave'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(null)} maxWidth="sm">
          <h3 className="text-base font-semibold text-rl-text">Excluir chave "{confirmDelete.label}"?</h3>
          <p className="text-sm text-rl-muted mt-1">Quem usa esta senha perde o acesso na hora.</p>
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={() => setConfirmDelete(null)} className="btn-secondary text-sm">Cancelar</button>
            <button onClick={handleDelete} className="btn-primary !bg-red-500 hover:!bg-red-600 text-sm">Excluir</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
