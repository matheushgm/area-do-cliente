import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import Modal from './UI/Modal'
import Toast from './UI/Toast'
import { useToast } from '../hooks/useToast'
import {
  FileText, Plus, Calendar, Video, Users, Edit2, Trash2,
  X, Loader2, ExternalLink, ChevronRight, Save, ArrowLeft,
  Megaphone, ShoppingCart, Target, Lightbulb, AlertTriangle,
  TrendingUp, CheckSquare,
} from 'lucide-react'

// ─── Template estruturado da ata ────────────────────────────────────────────
const TEMPLATE_SECTIONS = [
  {
    id: 'resumo',
    title: 'Resumo da reunião',
    Icon: FileText,
    color: 'text-rl-cyan',
    description: 'Em uma frase, qual foi o foco principal desta reunião?',
    placeholder: 'Ex.: Revisão dos resultados do mês e planejamento da próxima campanha de Black Friday.',
    rows: 2,
  },
  {
    id: 'resultados',
    title: 'Resultados desde a última reunião',
    Icon: TrendingUp,
    color: 'text-rl-green',
    description: 'O que funcionou e o que não funcionou? Cite métricas quando possível.',
    placeholder: '• CPL caiu de R$45 para R$32\n• Anúncio "X" performou bem\n• Landing Y teve baixa conversão...',
    rows: 4,
  },
  {
    id: 'metricas',
    title: 'Principais métricas reportadas',
    Icon: Target,
    color: 'text-rl-purple',
    description: 'Liste leads, MQL, SQL, vendas, ROAS, CAC, etc.',
    placeholder: 'Leads: ___\nMQLs: ___\nVendas: ___\nROAS: ___',
    rows: 4,
  },
  {
    id: 'pontos_atencao',
    title: 'Pontos de atenção / bloqueios',
    Icon: AlertTriangle,
    color: 'text-rl-gold',
    description: 'O que está travando o avanço? Decisões pendentes?',
    placeholder: '• Aguardando aprovação dos novos criativos\n• CRM ainda não integrado...',
    rows: 3,
  },
  {
    id: 'discussoes',
    title: 'Principais discussões e decisões',
    Icon: Lightbulb,
    color: 'text-rl-cyan',
    description: 'Resumo das conversas e decisões tomadas.',
    placeholder: 'Decidimos focar em...\nValidamos que...\nO cliente prefere...',
    rows: 4,
  },
  {
    id: 'compromissos_cliente',
    title: 'Compromissos do cliente',
    Icon: Users,
    color: 'text-rl-gold',
    description: 'O que o cliente vai entregar / fazer até a próxima reunião?',
    placeholder: '• Enviar fotos novas do produto até dia ___\n• Aprovar copies da landing\n• ...',
    rows: 3,
  },
  {
    id: 'compromissos_agencia',
    title: 'Compromissos da agência',
    Icon: CheckSquare,
    color: 'text-rl-purple',
    description: 'O que a agência vai entregar até a próxima reunião?',
    placeholder: '• Subir 3 novos criativos até ___\n• Configurar pixel de conversão\n• ...',
    rows: 3,
  },
]

const ACTION_AREAS = [
  { value: 'marketing', label: 'Marketing', Icon: Megaphone, color: 'text-rl-purple', bg: 'bg-rl-purple/10', border: 'border-rl-purple/30' },
  { value: 'vendas',    label: 'Vendas',    Icon: ShoppingCart, color: 'text-rl-green',  bg: 'bg-rl-green/10',  border: 'border-rl-green/30'  },
]

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

// ─── Editor de uma ata ──────────────────────────────────────────────────────
function MinuteEditor({ initial, projectId, currentUserId, onSaved, onCancel, showToast }) {
  const [title,        setTitle]        = useState(initial?.title || '')
  const [meetingDate,  setMeetingDate]  = useState(initial?.meeting_date || todayISO())
  const [recordingUrl, setRecordingUrl] = useState(initial?.recording_url || '')
  const [attendees,    setAttendees]    = useState(Array.isArray(initial?.attendees) ? initial.attendees.join(', ') : '')
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
      showToast('Preencha título e data da reunião', 'error')
      return
    }
    setSaving(true)
    const attendeesArr = attendees.split(',').map((s) => s.trim()).filter(Boolean)
    const payload = {
      project_id:    projectId,
      title:         title.trim(),
      meeting_date:  meetingDate,
      recording_url: recordingUrl.trim() || null,
      attendees:     attendeesArr,
      template,
      next_actions:  actions,
      updated_at:    new Date().toISOString(),
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
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <button onClick={handleSave} disabled={saving || !title.trim() || !meetingDate} className="btn-primary inline-flex items-center gap-2 text-sm px-4 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Salvando...' : 'Salvar ata'}
        </button>
      </div>

      {/* Cabeçalho da ata */}
      <div className="glass-card p-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-rl-muted mb-1.5 uppercase tracking-wider">Título da reunião</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Reunião de alinhamento mensal"
            className="input-field w-full"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-rl-muted mb-1.5 uppercase tracking-wider">
              <Calendar className="w-3.5 h-3.5 inline mr-1" /> Data da reunião
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
              <Video className="w-3.5 h-3.5 inline mr-1" /> Link da gravação
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
            <Users className="w-3.5 h-3.5 inline mr-1" /> Participantes
          </label>
          <input
            value={attendees}
            onChange={(e) => setAttendees(e.target.value)}
            placeholder="João, Maria, Pedro..."
            className="input-field w-full"
          />
          <p className="text-[10px] text-rl-muted mt-1">Separe os nomes por vírgula.</p>
        </div>
      </div>

      {/* Template — passo a passo */}
      <div className="glass-card p-5 space-y-5">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-rl-purple" />
          <h3 className="text-sm font-bold text-rl-text">Template — preencha passo a passo</h3>
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
          <h3 className="text-sm font-bold text-rl-text">Próximas ações</h3>
          <span className="text-[11px] text-rl-muted">(com responsável e prazo)</span>
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
                  <Plus className="w-3 h-3" /> Adicionar
                </button>
              </div>
              {list.length === 0 ? (
                <p className="text-[11px] text-rl-muted px-2 py-2">Nenhuma ação cadastrada.</p>
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
                          placeholder={`Ação de ${area.label.toLowerCase()}...`}
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
                            placeholder="Responsável"
                            className="input-field text-xs flex-1"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAction(action.id)}
                        className="p-1 rounded text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition shrink-0"
                        aria-label="Remover ação"
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

MinuteEditor.propTypes = {
  initial: PropTypes.object,
  projectId: PropTypes.string.isRequired,
  currentUserId: PropTypes.string,
  onSaved: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  showToast: PropTypes.func.isRequired,
}

// ─── Card de ata ────────────────────────────────────────────────────────────
function MinuteCard({ minute, onOpen, onDelete }) {
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
          <div className="flex items-center gap-3 mt-2 text-[10px]">
            {minute.recording_url && (
              <a
                href={minute.recording_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-rl-cyan hover:underline"
              >
                <Video className="w-3 h-3" /> Gravação
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
            {actions.length > 0 && (
              <span className="inline-flex items-center gap-1 text-rl-muted">
                <CheckSquare className="w-3 h-3" />
                {open}/{actions.length} ações abertas
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(minute) }}
            className="p-1.5 rounded-lg text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition"
            aria-label="Excluir ata"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <ChevronRight className="w-4 h-4 text-rl-muted" />
        </div>
      </div>
    </div>
  )
}

MinuteCard.propTypes = {
  minute: PropTypes.object.isRequired,
  onOpen: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
}

// ─── Visualização (modo leitura) ────────────────────────────────────────────
function MinuteView({ minute, onEdit, onClose }) {
  const actions = Array.isArray(minute.next_actions) ? minute.next_actions : []
  const sectionsWithContent = TEMPLATE_SECTIONS.filter((s) => (minute.template?.[s.id] || '').trim())
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 sticky top-0 bg-rl-bg/95 backdrop-blur z-10 -mx-2 px-2 py-2 border-b border-rl-border">
        <button onClick={onClose} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-rl-muted hover:text-rl-text hover:bg-rl-surface transition">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <button onClick={onEdit} className="btn-secondary inline-flex items-center gap-2 text-sm px-4 py-1.5">
          <Edit2 className="w-4 h-4" /> Editar
        </button>
      </div>

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
            <Video className="w-4 h-4" /> Acessar gravação
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
            <CheckSquare className="w-3.5 h-3.5" /> Próximas ações
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
                        <p className={`text-sm ${a.done ? 'line-through opacity-60' : 'text-rl-text'}`}>{a.title || '(sem título)'}</p>
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

MinuteView.propTypes = {
  minute: PropTypes.object.isRequired,
  onEdit: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
}

// ─── Módulo principal ──────────────────────────────────────────────────────
export default function MeetingMinutesModule({ project }) {
  const { user } = useApp()
  const { toast, showToast } = useToast()
  const [minutes,    setMinutes]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [view,       setView]       = useState({ mode: 'list' }) // { mode: 'list' } | { mode: 'view', minute } | { mode: 'edit', minute? }
  const [confirmDel, setConfirmDel] = useState(null)

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
        if (error) { console.error(error); showToast('Erro ao carregar atas', 'error'); setLoading(false); return }
        setMinutes(data || [])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [project?.id, showToast])

  function handleSaved(saved) {
    setMinutes((prev) => {
      const exists = prev.some((m) => m.id === saved.id)
      if (exists) return prev.map((m) => m.id === saved.id ? saved : m)
      return [saved, ...prev].sort((a, b) => (b.meeting_date || '').localeCompare(a.meeting_date || ''))
    })
    setView({ mode: 'view', minute: saved })
    showToast('Ata salva')
  }

  async function handleDelete(minute) {
    setConfirmDel(null)
    const { error } = await supabase.from('meeting_minutes').delete().eq('id', minute.id)
    if (error) { showToast(error.message, 'error'); return }
    setMinutes((prev) => prev.filter((m) => m.id !== minute.id))
    if (view.mode !== 'list' && view.minute?.id === minute.id) setView({ mode: 'list' })
    showToast('Ata excluída')
  }

  // ── Edit mode ────────────────────────────────────────────────────────────
  if (view.mode === 'edit') {
    return (
      <>
        <MinuteEditor
          initial={view.minute}
          projectId={project.id}
          currentUserId={user?.id}
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
          onEdit={() => setView({ mode: 'edit', minute: view.minute })}
          onClose={() => setView({ mode: 'list' })}
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
            <FileText className="w-4 h-4 text-rl-purple" /> Ata de Reunião
          </h2>
          <p className="text-xs text-rl-muted mt-0.5">Histórico de reuniões, gravações e próximas ações.</p>
        </div>
        <button
          onClick={() => setView({ mode: 'edit', minute: null })}
          className="btn-primary inline-flex items-center gap-2 text-sm px-3 py-1.5"
        >
          <Plus className="w-4 h-4" /> Nova ata
        </button>
      </div>

      {loading ? (
        <div className="glass-card flex items-center justify-center py-12 text-rl-muted">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
        </div>
      ) : minutes.length === 0 ? (
        <div className="glass-card text-center py-12">
          <FileText className="w-10 h-10 text-rl-muted mx-auto mb-3 opacity-50" />
          <p className="text-sm text-rl-muted mb-4">Nenhuma ata registrada ainda.</p>
          <button
            onClick={() => setView({ mode: 'edit', minute: null })}
            className="btn-primary inline-flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" /> Criar primeira ata
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
            <h3 className="text-sm font-bold text-rl-text">Excluir ata?</h3>
            <button onClick={() => setConfirmDel(null)} className="p-1 rounded text-rl-muted hover:text-rl-text"><X className="w-4 h-4" /></button>
          </div>
          <p className="text-sm text-rl-muted mb-4">
            Esta ação não pode ser desfeita. A ata <span className="text-rl-text font-semibold">&quot;{confirmDel.title}&quot;</span> será removida permanentemente.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setConfirmDel(null)} className="px-3 py-1.5 text-sm text-rl-muted hover:text-rl-text">Cancelar</button>
            <button onClick={() => handleDelete(confirmDel)} className="px-3 py-1.5 text-sm bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/20 transition">
              Excluir
            </button>
          </div>
        </Modal>
      )}

      <Toast toast={toast} />
    </div>
  )
}

MeetingMinutesModule.propTypes = {
  project: PropTypes.object.isRequired,
}
