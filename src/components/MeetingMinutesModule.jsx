import { fmtDate, todayISO } from '../lib/utils'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { cliente } from '../routes/paths'
import { useApp } from '../context/AppContext'
import Modal from './UI/Modal'
import Toast from './UI/Toast'
import { useToast } from '../hooks/useToast'
import { useI18n, t as tGlobal } from '../i18n'
import {
  FileText, Plus, Calendar, Video, Users, Edit2, Trash2,
  X, Loader2, ExternalLink, ChevronRight, Save, ArrowLeft,
  Megaphone, ShoppingCart, Target, Lightbulb, AlertTriangle,
  TrendingUp, CheckSquare, Link2, Check, CheckCircle2, Lock,
  PenLine, UserCircle2, ChevronDown,
} from 'lucide-react'

// Iniciais de um nome pra fallback de avatar (ex.: "João Silva" → "JS")
function nameInitials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}

// ─── Multi-seleção de participantes (usuários da plataforma) ─────────────────
function ParticipantsSelect({ members, selectedIds, onChange }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const selected = members.filter((m) => selectedIds.includes(m.id))

  function toggle(id) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input-field w-full flex items-center justify-between gap-2 text-left"
      >
        <span className="flex-1 min-w-0 truncate">
          {selected.length
            ? selected.map((m) => m.name).join(', ')
            : <span className="text-rl-muted">{t('atas.selecioneParticipantes')}</span>}
        </span>
        <ChevronDown className={`w-4 h-4 text-rl-muted shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-full max-h-60 overflow-auto rounded-xl border border-rl-border bg-rl-surface shadow-2xl p-1">
            {members.length === 0 ? (
              <p className="px-3 py-3 text-xs text-rl-muted text-center">{t('atas.nenhumUsuario')}</p>
            ) : (
              members.map((m) => {
                const checked = selectedIds.includes(m.id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggle(m.id)}
                    className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-rl-bg text-left transition"
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      checked ? 'bg-rl-purple border-rl-purple text-white' : 'border-rl-border'
                    }`}>
                      {checked && <Check className="w-3 h-3" />}
                    </span>
                    <span className="w-6 h-6 rounded-full bg-gradient-rl flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                      {m.avatar || nameInitials(m.name)}
                    </span>
                    <span className="flex-1 min-w-0 text-sm text-rl-text truncate">{m.name}</span>
                    {m.role && (
                      <span className="text-[10px] text-rl-muted capitalize shrink-0">{m.role}</span>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Configuração das 3 assinaturas ──────────────────────────────────────────
// label/shortLabel são getters do dicionário `atas` (o id é a chave gravada).
const SIGNATURE_ROLES = [
  { id: 'account_manager', source: 'internal', color: '#7C3AED' },
  { id: 'trafego',         source: 'internal', color: '#2563EB' },
  { id: 'client',          source: 'client',   color: '#059669' },
].map((r) => Object.defineProperties(r, {
  label:      { get: () => tGlobal(`atas.papeis.${r.id}`), enumerable: true },
  shortLabel: { get: () => tGlobal(`atas.papeisCurto.${r.id}`), enumerable: true },
}))

// Resumo do status de assinaturas dado um minute (read-only chips). Usado
// no MinuteCard pra mostrar 3 pontinhos coloridos com tooltip.
function signatureStatus(minute) {
  const internal = minute?.internal_signatures || {}
  const client   = minute?.client_signature || null
  return {
    account_manager: !!internal.account_manager,
    trafego:         !!internal.trafego,
    client:          !!client,
    allSigned:       !!internal.account_manager && !!internal.trafego && !!client,
    anySigned:       !!internal.account_manager || !!internal.trafego || !!client,
  }
}

// ─── Template estruturado da ata ────────────────────────────────────────────
const SECOES_BASE = [
  {
    id: 'resumo',
    Icon: FileText,
    color: 'text-rl-cyan',
    rows: 2,
  },
  {
    id: 'resultados',
    Icon: TrendingUp,
    color: 'text-rl-green',
    rows: 4,
  },
  {
    id: 'metricas',
    Icon: Target,
    color: 'text-rl-purple',
    rows: 4,
  },
  {
    id: 'pontos_atencao',
    Icon: AlertTriangle,
    color: 'text-rl-gold',
    rows: 3,
  },
  {
    id: 'discussoes',
    Icon: Lightbulb,
    color: 'text-rl-cyan',
    rows: 4,
  },
  {
    id: 'compromissos_cliente',
    Icon: Users,
    color: 'text-rl-gold',
    rows: 3,
  },
  {
    id: 'compromissos_agencia',
    Icon: CheckSquare,
    color: 'text-rl-purple',
    rows: 3,
  },
]

const AREAS_BASE = [
  { value: 'marketing', Icon: Megaphone, color: 'text-rl-purple', bg: 'bg-rl-purple/10', border: 'border-rl-purple/30' },
  { value: 'vendas',    Icon: ShoppingCart, color: 'text-rl-green',  bg: 'bg-rl-green/10',  border: 'border-rl-green/30'  },
]

// Textos no idioma de quem lê (o portal também importa estas listas): title,
// description e placeholder da seção e o label da área são getters do dicionário
// `atas`. Ids e `value` são o que a ata grava e não mudam.
export const TEMPLATE_SECTIONS = SECOES_BASE.map((sec) => Object.defineProperties(sec, {
  title:       { get: () => tGlobal(`atas.secoes.${sec.id}.titulo`), enumerable: true },
  description: { get: () => tGlobal(`atas.secoes.${sec.id}.descricao`), enumerable: true },
  placeholder: { get: () => tGlobal(`atas.secoes.${sec.id}.placeholder`), enumerable: true },
}))

export const ACTION_AREAS = AREAS_BASE.map((area) => Object.defineProperty(area, 'label', {
  get: () => tGlobal(`atas.areas.${area.value}`), enumerable: true,
}))

// ─── Editor de uma ata ──────────────────────────────────────────────────────
function MinuteEditor({ initial, projectId, currentUserId, members, onSaved, onCancel, showToast }) {
  const { t } = useI18n()
  const [title,        setTitle]        = useState(initial?.title || '')
  const [meetingDate,  setMeetingDate]  = useState(initial?.meeting_date || todayISO())
  const [recordingUrl, setRecordingUrl] = useState(initial?.recording_url || '')
  const [participantIds, setParticipantIds] = useState(
    Array.isArray(initial?.participant_ids) ? initial.participant_ids : []
  )
  const [template,     setTemplate]     = useState(initial?.template || {})
  const [actions,      setActions]      = useState(Array.isArray(initial?.next_actions) ? initial.next_actions : [])
  const [saving,       setSaving]       = useState(false)

  function setField(id, value) {
    setTemplate((prev) => ({ ...prev, [id]: value }))
  }

  function addAction(area) {
    setActions((prev) => [...prev, {
      id: crypto.randomUUID(),
      area,
      title: '',
      due_date: '',
      owner: '',
      done: false,
    }])
  }

  function updateAction(id, patch) {
    setActions((prev) => prev.map((a) => a.id === id ? { ...a, ...patch } : a))
  }

  function removeAction(id) {
    setActions((prev) => prev.filter((a) => a.id !== id))
  }

  async function handleSave() {
    if (!title.trim() || !meetingDate) {
      showToast(t('atas.preenchaTituloData'), 'error')
      return
    }
    setSaving(true)
    // Deriva os nomes dos participantes selecionados (mantém compatibilidade
    // com a exibição existente que usa `attendees`).
    const selectedMembers = members.filter((m) => participantIds.includes(m.id))
    const attendeesArr = selectedMembers.map((m) => m.name).filter(Boolean)
    const payload = {
      project_id:      projectId,
      title:           title.trim(),
      meeting_date:    meetingDate,
      recording_url:   recordingUrl.trim() || null,
      attendees:       attendeesArr,
      participant_ids: participantIds,
      template,
      next_actions:    actions,
      updated_at:      new Date().toISOString(),
    }
    let result
    if (initial?.id) {
      result = await supabase.from('meeting_minutes').update(payload).eq('id', initial.id).select().single()
    } else {
      result = await supabase.from('meeting_minutes').insert({ ...payload, created_by: currentUserId }).select().single()
    }
    setSaving(false)
    if (result.error) { showToast(result.error.message, 'error'); return }
    onSaved(result.data)
  }

  const marketingActions = actions.filter((a) => a.area === 'marketing')
  const vendasActions    = actions.filter((a) => a.area === 'vendas')

  return (
    <div className="space-y-5">
      {/* Header com voltar/salvar */}
      <div className="flex items-center justify-between gap-2 sticky top-0 bg-rl-bg/95 backdrop-blur z-10 -mx-2 px-2 py-2 border-b border-rl-border">
        <button onClick={onCancel} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-rl-muted hover:text-rl-text hover:bg-rl-surface transition">
          <ArrowLeft className="w-4 h-4" /> {t('comum.voltar')}
        </button>
        <button onClick={handleSave} disabled={saving || !title.trim() || !meetingDate} className="btn-primary inline-flex items-center gap-2 text-sm px-4 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? t('comum.salvando') : t('atas.salvarAta')}
        </button>
      </div>

      {/* Cabeçalho da ata */}
      <div className="glass-card p-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-rl-muted mb-1.5 uppercase tracking-wider">{t('atas.tituloReuniao')}</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('atas.tituloPlaceholder')}
            className="input-field w-full"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-rl-muted mb-1.5 uppercase tracking-wider">
              <Calendar className="w-3.5 h-3.5 inline mr-1" /> {t('atas.dataReuniao')}
            </label>
            <input
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              className="input-field w-full"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-rl-muted mb-1.5 uppercase tracking-wider">
              <Video className="w-3.5 h-3.5 inline mr-1" /> {t('atas.linkGravacao')}
            </label>
            <input
              type="url"
              value={recordingUrl}
              onChange={(e) => setRecordingUrl(e.target.value)}
              placeholder="https://..."
              className="input-field w-full"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-rl-muted mb-1.5 uppercase tracking-wider">
            <Users className="w-3.5 h-3.5 inline mr-1" /> {t('atas.participantes')}
          </label>
          <ParticipantsSelect
            members={members}
            selectedIds={participantIds}
            onChange={setParticipantIds}
          />
          <p className="text-[10px] text-rl-muted mt-1">
            {t('atas.participantesAjuda')}
          </p>
        </div>
      </div>

      {/* Template — passo a passo */}
      <div className="glass-card p-5 space-y-5">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-rl-purple" />
          <h3 className="text-sm font-bold text-rl-text">{t('atas.templateTitulo')}</h3>
        </div>
        {TEMPLATE_SECTIONS.map((sec, i) => (
          <div key={sec.id} className="border-l-2 border-rl-border pl-4">
            <div className="flex items-start gap-2 mb-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rl-surface text-[10px] font-bold text-rl-muted shrink-0 mt-0.5">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <label className="text-sm font-semibold text-rl-text inline-flex items-center gap-1.5">
                  <sec.Icon className={`w-4 h-4 ${sec.color}`} />
                  {sec.title}
                </label>
                <p className="text-[11px] text-rl-muted mt-0.5">{sec.description}</p>
              </div>
            </div>
            <textarea
              value={template[sec.id] || ''}
              onChange={(e) => setField(sec.id, e.target.value)}
              rows={sec.rows}
              placeholder={sec.placeholder}
              className="input-field w-full resize-y"
            />
          </div>
        ))}
      </div>

      {/* Próximas ações */}
      <div className="glass-card p-5 space-y-5">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-rl-green" />
          <h3 className="text-sm font-bold text-rl-text">{t('atas.proximasAcoes')}</h3>
          <span className="text-[11px] text-rl-muted">{t('atas.comResponsavelPrazo')}</span>
        </div>

        {ACTION_AREAS.map((area) => {
          const list = area.value === 'marketing' ? marketingActions : vendasActions
          return (
            <div key={area.value}>
              <div className="flex items-center justify-between mb-2">
                <h4 className={`text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 ${area.color}`}>
                  <area.Icon className="w-3.5 h-3.5" /> {area.label}
                </h4>
                <button
                  type="button"
                  onClick={() => addAction(area.value)}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border ${area.bg} ${area.color} ${area.border} hover:opacity-80 transition`}
                >
                  <Plus className="w-3 h-3" /> {t('comum.adicionar')}
                </button>
              </div>
              {list.length === 0 ? (
                <p className="text-[11px] text-rl-muted px-2 py-2">{t('atas.nenhumaAcao')}</p>
              ) : (
                <ul className="space-y-2">
                  {list.map((action) => (
                    <li key={action.id} className="flex items-start gap-2 p-2 bg-rl-surface/40 border border-rl-border rounded-lg">
                      <input
                        type="checkbox"
                        checked={!!action.done}
                        onChange={(e) => updateAction(action.id, { done: e.target.checked })}
                        className="mt-2 w-4 h-4 accent-rl-green shrink-0"
                      />
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <input
                          value={action.title}
                          onChange={(e) => updateAction(action.id, { title: e.target.value })}
                          placeholder={t('atas.acaoDe', { area: area.label.toLowerCase() })}
                          className={`input-field w-full text-sm ${action.done ? 'line-through opacity-60' : ''}`}
                        />
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="date"
                            value={action.due_date || ''}
                            onChange={(e) => updateAction(action.id, { due_date: e.target.value })}
                            className="input-field text-xs flex-1"
                          />
                          <input
                            value={action.owner || ''}
                            onChange={(e) => updateAction(action.id, { owner: e.target.value })}
                            placeholder={t('atas.responsavel')}
                            className="input-field text-xs flex-1"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAction(action.id)}
                        className="p-1 rounded text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition shrink-0"
                        aria-label={t('atas.removerAcao')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Card de ata ────────────────────────────────────────────────────────────
function MinuteCard({ minute, onOpen, onDelete }) {
  const { t } = useI18n()
  const actions = Array.isArray(minute.next_actions) ? minute.next_actions : []
  const open = actions.filter((a) => !a.done).length
  return (
    <div className="glass-card p-4 hover:border-rl-purple/40 transition cursor-pointer group" onClick={onOpen}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[10px] text-rl-muted uppercase font-semibold tracking-wider mb-1">
            <Calendar className="w-3 h-3" />
            {fmtDate(minute.meeting_date)}
          </div>
          <h3 className="text-sm font-bold text-rl-text truncate group-hover:text-rl-purple transition">{minute.title}</h3>
          {Array.isArray(minute.attendees) && minute.attendees.length > 0 && (
            <p className="text-[11px] text-rl-muted truncate mt-1">
              <Users className="w-3 h-3 inline mr-1" /> {minute.attendees.join(', ')}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2 text-[10px] flex-wrap">
            {minute.recording_url && (
              <a
                href={minute.recording_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-rl-cyan hover:underline"
              >
                <Video className="w-3 h-3" /> {t('atas.gravacao')}
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
            {actions.length > 0 && (
              <span className="inline-flex items-center gap-1 text-rl-muted">
                <CheckSquare className="w-3 h-3" />
                {t('atas.acoesAbertas', { abertas: open, total: actions.length })}
              </span>
            )}
            <SignatureMiniIndicator minute={minute} />
            {!minute.client_signature && minute.share_token && (
              <span className="inline-flex items-center gap-1 text-rl-purple font-semibold">
                <Link2 className="w-3 h-3" /> {t('atas.linkGerado')}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(minute) }}
            className="p-1.5 rounded-lg text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition"
            aria-label={t('atas.excluirAta')}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <ChevronRight className="w-4 h-4 text-rl-muted" />
        </div>
      </div>
    </div>
  )
}

// 3 mini-pílulas mostrando status de assinatura (AM/GT/CL)
function SignatureMiniIndicator({ minute }) {
  const { t } = useI18n()
  const status = signatureStatus(minute)
  return (
    <span className="inline-flex items-center gap-1" title={t('atas.statusAssinaturas')}>
      {SIGNATURE_ROLES.map((r) => {
        const ok = status[r.id]
        return (
          <span
            key={r.id}
            className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[8px] font-bold ${
              ok ? 'text-white' : 'text-rl-muted bg-rl-surface border border-rl-border'
            }`}
            style={ok ? { background: r.color } : undefined}
            title={t('atas.papelStatus', { papel: r.label, status: ok ? t('atas.assinadoMinusculo') : t('atas.pendenteMinusculo') })}
          >
            {r.shortLabel}
          </span>
        )
      })}
    </span>
  )
}
// ─── Painel de assinaturas (AM / GT / Cliente) ───────────────────────────────
function SignaturesPanel({ minute, currentUser, onUpdate }) {
  const { t, locale } = useI18n()
  const [busyRole, setBusyRole] = useState(null)
  const status = signatureStatus(minute)

  async function signAs(roleId) {
    if (!currentUser?.id) return
    setBusyRole(roleId)
    const internal = { ...(minute.internal_signatures || {}) }
    internal[roleId] = {
      name:     currentUser.name || currentUser.email || 'Usuário',
      userId:   currentUser.id,
      signedAt: new Date().toISOString(),
    }
    const { data, error } = await supabase
      .from('meeting_minutes')
      .update({ internal_signatures: internal })
      .eq('id', minute.id)
      .select()
      .single()
    setBusyRole(null)
    if (error) return alert(t('atas.erroAssinar', { erro: error.message }))
    onUpdate(data)
  }

  function renderRole(role) {
    if (role.source === 'client') {
      const sig = minute.client_signature
      return (
        <div
          key={role.id}
          className={`rounded-xl border p-3 ${
            sig ? 'bg-rl-green/5 border-rl-green/30' : 'bg-rl-surface/40 border-rl-border'
          }`}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <UserCircle2 className="w-4 h-4" style={{ color: role.color }} />
            <p className="text-[10px] font-bold uppercase tracking-wider text-rl-muted">
              {role.label}
            </p>
            {sig
              ? <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-rl-green"><CheckCircle2 className="w-3 h-3" /> {t('atas.assinado')}</span>
              : <span className="ml-auto text-[10px] font-bold text-rl-muted">{t('atas.pendente')}</span>
            }
          </div>
          {sig ? (
            <>
              <p className="text-sm font-black text-rl-text leading-tight">{sig.name}</p>
              <p className="text-[11px] text-rl-muted mt-0.5">
                {new Date(sig.signedAt).toLocaleString(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </>
          ) : (
            <p className="text-[11px] text-rl-muted italic">
              {t('atas.clienteAssinaLink')}
            </p>
          )}
        </div>
      )
    }

    const sig = minute.internal_signatures?.[role.id]
    const isSigned = !!sig
    return (
      <div
        key={role.id}
        className={`rounded-xl border p-3 ${
          isSigned ? 'bg-rl-green/5 border-rl-green/30' : 'bg-rl-surface/40 border-rl-border'
        }`}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <UserCircle2 className="w-4 h-4" style={{ color: role.color }} />
          <p className="text-[10px] font-bold uppercase tracking-wider text-rl-muted">
            {role.label}
          </p>
          {isSigned
            ? <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-rl-green"><CheckCircle2 className="w-3 h-3" /> {t('atas.assinado')}</span>
            : <span className="ml-auto text-[10px] font-bold text-rl-muted">{t('atas.pendente')}</span>
          }
        </div>
        {isSigned ? (
          <>
            <p className="text-sm font-black text-rl-text leading-tight">{sig.name}</p>
            <p className="text-[11px] text-rl-muted mt-0.5">
              {new Date(sig.signedAt).toLocaleString(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </>
        ) : (
          <button
            onClick={() => signAs(role.id)}
            disabled={busyRole === role.id || !currentUser?.id}
            className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-rl-purple text-white hover:bg-rl-purple/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busyRole === role.id
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('atas.assinando')}</>
              : <><PenLine className="w-3.5 h-3.5" /> {t('atas.assinarComo', { papel: role.shortLabel })}</>
            }
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <PenLine className="w-4 h-4 text-rl-purple" />
        <h3 className="text-sm font-black text-rl-text">{t('atas.assinaturas')}</h3>
        {status.allSigned && (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rl-green/10 text-rl-green border border-rl-green/30">
            <CheckCircle2 className="w-3 h-3" /> {t('atas.ataCompleta')}
          </span>
        )}
      </div>
      <p className="text-xs text-rl-muted leading-relaxed">
        {t('atas.assinaturasTexto')}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {SIGNATURE_ROLES.map(renderRole)}
      </div>
    </div>
  )
}

// ─── Visualização (modo leitura) ────────────────────────────────────────────
function MinuteView({ minute, currentUser, onEdit, onClose, onShare, onUpdate, copiedShareId }) {
  const { t } = useI18n()
  const actions = Array.isArray(minute.next_actions) ? minute.next_actions : []
  const sectionsWithContent = TEMPLATE_SECTIONS.filter((s) => (minute.template?.[s.id] || '').trim())
  const sigStatus = signatureStatus(minute)
  const signed = sigStatus.anySigned // qualquer assinatura existe → trava edição
  const justCopied = copiedShareId === minute.id
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 sticky top-0 bg-rl-bg/95 backdrop-blur z-10 -mx-2 px-2 py-2 border-b border-rl-border">
        <button onClick={onClose} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-rl-muted hover:text-rl-text hover:bg-rl-surface transition">
          <ArrowLeft className="w-4 h-4" /> {t('comum.voltar')}
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onShare(minute)}
            className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border font-medium transition ${
              justCopied
                ? 'bg-rl-green/10 border-rl-green/30 text-rl-green'
                : 'bg-rl-surface border-rl-border text-rl-muted hover:text-rl-text hover:border-rl-purple/30'
            }`}
            title={t('atas.compartilharTitulo')}
          >
            {justCopied
              ? <><Check className="w-4 h-4" /> {t('atas.linkCopiadoBotao')}</>
              : <><Link2 className="w-4 h-4" /> {t('atas.compartilhar')}</>
            }
          </button>
          <button onClick={onEdit} disabled={signed} className="btn-secondary inline-flex items-center gap-2 text-sm px-4 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed" title={signed ? t('atas.naoEditavel') : t('atas.editarAta')}>
            <Edit2 className="w-4 h-4" /> {t('comum.editar')}
          </button>
        </div>
      </div>

      {sigStatus.allSigned && (
        <div className="rounded-xl bg-rl-green/5 border border-rl-green/30 p-4 flex items-start gap-3">
          <Lock className="w-4 h-4 text-rl-green mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-rl-text">
              {t('atas.completaTitulo')}
            </p>
            <p className="text-xs text-rl-muted mt-0.5">
              {t('atas.completaResumo', { am: minute.internal_signatures.account_manager.name, gt: minute.internal_signatures.trafego.name, cliente: minute.client_signature.name })}
            </p>
          </div>
        </div>
      )}

      {/* Painel de assinaturas — sempre visível, atualiza ao assinar */}
      <SignaturesPanel
        minute={minute}
        currentUser={currentUser}
        onUpdate={onUpdate}
      />

      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center gap-2 text-[11px] text-rl-muted uppercase font-semibold tracking-wider">
          <Calendar className="w-3.5 h-3.5" /> {fmtDate(minute.meeting_date)}
        </div>
        <h2 className="text-xl font-bold text-rl-text">{minute.title}</h2>
        {Array.isArray(minute.attendees) && minute.attendees.length > 0 && (
          <p className="text-sm text-rl-muted"><Users className="w-3.5 h-3.5 inline mr-1" /> {minute.attendees.join(', ')}</p>
        )}
        {minute.recording_url && (
          <a
            href={minute.recording_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-rl-cyan hover:underline"
          >
            <Video className="w-4 h-4" /> {t('atas.acessarGravacao')}
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {sectionsWithContent.length > 0 && (
        <div className="glass-card p-5 space-y-4">
          {sectionsWithContent.map((sec) => (
            <div key={sec.id}>
              <h4 className={`text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 mb-1.5 ${sec.color}`}>
                <sec.Icon className="w-3.5 h-3.5" /> {sec.title}
              </h4>
              <p className="text-sm text-rl-text whitespace-pre-wrap leading-relaxed">{minute.template[sec.id]}</p>
            </div>
          ))}
        </div>
      )}

      {actions.length > 0 && (
        <div className="glass-card p-5 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-rl-text inline-flex items-center gap-1.5">
            <CheckSquare className="w-3.5 h-3.5" /> {t('atas.proximasAcoes')}
          </h4>
          {ACTION_AREAS.map((area) => {
            const list = actions.filter((a) => a.area === area.value)
            if (list.length === 0) return null
            return (
              <div key={area.value}>
                <h5 className={`text-[11px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5 mb-1.5 ${area.color}`}>
                  <area.Icon className="w-3 h-3" /> {area.label}
                </h5>
                <ul className="space-y-1.5">
                  {list.map((a) => (
                    <li key={a.id} className={`flex items-start gap-2 p-2 rounded-lg border ${area.bg} ${area.border}`}>
                      <input type="checkbox" checked={!!a.done} readOnly className="mt-1 w-3.5 h-3.5 accent-rl-green shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${a.done ? 'line-through opacity-60' : 'text-rl-text'}`}>{a.title || t('atas.semTitulo')}</p>
                        <div className="flex items-center gap-3 text-[10px] text-rl-muted mt-0.5">
                          {a.due_date && <span><Calendar className="w-2.5 h-2.5 inline mr-0.5" />{fmtDate(a.due_date)}</span>}
                          {a.owner && <span><Users className="w-2.5 h-2.5 inline mr-0.5" />{a.owner}</span>}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Módulo principal ──────────────────────────────────────────────────────
export default function MeetingMinutesModule({ project }) {
  const { user, teamMembers } = useApp()
  const { toast, showToast } = useToast()
  const { t } = useI18n()
  const [minutes,    setMinutes]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [view,       setView]       = useState({ mode: 'list' }) // { mode: 'list' } | { mode: 'view', minute } | { mode: 'edit', minute? }
  const [confirmDel, setConfirmDel] = useState(null)
  const [copiedShareId, setCopiedShareId] = useState(null)

  useEffect(() => {
    if (!supabase || !project?.id) return
    let cancelled = false
    setLoading(true)
    supabase
      .from('meeting_minutes')
      .select('*')
      .eq('project_id', project.id)
      .order('meeting_date', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) { console.error(error); showToast(tGlobal('atas.erroCarregar'), 'error'); setLoading(false); return }
        setMinutes(data || [])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [project?.id, showToast])

  function handleSaved(saved) {
    const exists = minutes.some((m) => m.id === saved.id)
    setMinutes((prev) => {
      if (exists) return prev.map((m) => m.id === saved.id ? saved : m)
      return [saved, ...prev].sort((a, b) => (b.meeting_date || '').localeCompare(a.meeting_date || ''))
    })
    setView({ mode: 'view', minute: saved })
    showToast(t('atas.salva'))

    // Notifica os participantes marcados SÓ na criação (não em edição)
    if (!exists) notifyParticipantsAboutNewMinute(saved)
  }

  // Quando o usuário assina (AM/GT) atualiza o state com a linha completa
  function handleMinuteUpdated(updated) {
    setMinutes((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
    if (view.mode === 'view' && view.minute?.id === updated.id) {
      setView({ mode: 'view', minute: updated })
    }
  }

  // Cria uma notificação por participante marcado na ata — o realtime do
  // NotificationCenter exibe um popup quando o usuário está logado. Quem está
  // offline vê quando entrar. Apenas os usuários marcados são notificados.
  async function notifyParticipantsAboutNewMinute(saved) {
    try {
      const memberIds = (Array.isArray(saved.participant_ids) ? saved.participant_ids : [])
        .filter(Boolean)
        .filter((id) => id !== user?.id) // não notifica o criador
      if (!memberIds.length) return
      const senderName = user?.name || user?.email || 'Alguém'
      const companyName = project.companyName || project.company_name || 'Cliente'
      const rows = memberIds.map((uid) => ({
        user_id: uid,
        type:    'meeting_minute_created',
        title:   'Nova ata de reunião',
        body:    `${senderName} criou "${saved.title}" em ${companyName}`,
        link:    cliente(project.id),
        data:    { project_id: project.id, meeting_minute_id: saved.id },
      }))
      await supabase.from('notifications').insert(rows)
    } catch (e) {
      console.warn('[MeetingMinutes] erro ao notificar participantes:', e?.message)
    }
  }

  async function handleDelete(minute) {
    setConfirmDel(null)
    const { error } = await supabase.from('meeting_minutes').delete().eq('id', minute.id)
    if (error) { showToast(error.message, 'error'); return }
    setMinutes((prev) => prev.filter((m) => m.id !== minute.id))
    if (view.mode !== 'list' && view.minute?.id === minute.id) setView({ mode: 'list' })
    showToast(t('atas.excluida'))
  }

  // Gera (ou recupera) o share_token e copia o link pra área de transferência.
  async function handleShare(minute) {
    let token = minute.share_token
    if (!token) {
      token = crypto.randomUUID()
      const { data, error } = await supabase
        .from('meeting_minutes')
        .update({ share_token: token })
        .eq('id', minute.id)
        .select()
        .single()
      if (error) {
        showToast(t('atas.erroGerarLink', { erro: error.message }), 'error')
        return
      }
      // Atualiza o state local com a row completa (inclui share_token)
      setMinutes((prev) => prev.map((m) => (m.id === minute.id ? data : m)))
      if (view.mode === 'view' && view.minute?.id === minute.id) {
        setView({ mode: 'view', minute: data })
      }
    }
    const url = `${window.location.origin}/ata/${token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedShareId(minute.id)
      setTimeout(() => setCopiedShareId(null), 2500)
      showToast(t('atas.linkCopiado'))
    } catch {
      // Fallback: mostra a URL no toast
      showToast(t('atas.linkToast', { url }))
    }
  }

  // ── Edit mode ────────────────────────────────────────────────────────────
  if (view.mode === 'edit') {
    return (
      <>
        <MinuteEditor
          initial={view.minute}
          projectId={project.id}
          currentUserId={user?.id}
          members={teamMembers || []}
          onSaved={handleSaved}
          onCancel={() => setView(view.minute ? { mode: 'view', minute: view.minute } : { mode: 'list' })}
          showToast={showToast}
        />
        <Toast toast={toast} />
      </>
    )
  }

  // ── View mode ────────────────────────────────────────────────────────────
  if (view.mode === 'view') {
    return (
      <>
        <MinuteView
          minute={view.minute}
          currentUser={user}
          onEdit={() => setView({ mode: 'edit', minute: view.minute })}
          onClose={() => setView({ mode: 'list' })}
          onShare={handleShare}
          onUpdate={handleMinuteUpdated}
          copiedShareId={copiedShareId}
        />
        <Toast toast={toast} />
      </>
    )
  }

  // ── List mode ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-rl-text inline-flex items-center gap-2">
            <FileText className="w-4 h-4 text-rl-purple" /> {t('atas.titulo')}
          </h2>
          <p className="text-xs text-rl-muted mt-0.5">{t('atas.subtitulo')}</p>
        </div>
        <button
          onClick={() => setView({ mode: 'edit', minute: null })}
          className="btn-primary inline-flex items-center gap-2 text-sm px-3 py-1.5"
        >
          <Plus className="w-4 h-4" /> {t('atas.nova')}
        </button>
      </div>

      {loading ? (
        <div className="glass-card flex items-center justify-center py-12 text-rl-muted">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('comum.carregando')}
        </div>
      ) : minutes.length === 0 ? (
        <div className="glass-card text-center py-12">
          <FileText className="w-10 h-10 text-rl-muted mx-auto mb-3 opacity-50" />
          <p className="text-sm text-rl-muted mb-4">{t('atas.vazio')}</p>
          <button
            onClick={() => setView({ mode: 'edit', minute: null })}
            className="btn-primary inline-flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" /> {t('atas.criarPrimeira')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {minutes.map((m) => (
            <MinuteCard
              key={m.id}
              minute={m}
              onOpen={() => setView({ mode: 'view', minute: m })}
              onDelete={(min) => setConfirmDel(min)}
            />
          ))}
        </div>
      )}

      {confirmDel && (
        <Modal onClose={() => setConfirmDel(null)} maxWidth="sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-rl-text">{t('atas.confirmarTitulo')}</h3>
            <button onClick={() => setConfirmDel(null)} className="p-1 rounded text-rl-muted hover:text-rl-text"><X className="w-4 h-4" /></button>
          </div>
          <p className="text-sm text-rl-muted mb-4">
            {t('atas.confirmarAntes')}<span className="text-rl-text font-semibold">&quot;{confirmDel.title}&quot;</span>{t('atas.confirmarDepois')}
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setConfirmDel(null)} className="px-3 py-1.5 text-sm text-rl-muted hover:text-rl-text">{t('comum.cancelar')}</button>
            <button onClick={() => handleDelete(confirmDel)} className="px-3 py-1.5 text-sm bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/20 transition">
              {t('comum.excluir')}
            </button>
          </div>
        </Modal>
      )}

      <Toast toast={toast} />
    </div>
  )
}
