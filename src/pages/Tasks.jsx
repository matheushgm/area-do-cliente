import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import AppSidebar from '../components/AppSidebar'
import Modal from '../components/UI/Modal'
import Toast from '../components/UI/Toast'
import { useToast } from '../hooks/useToast'
import { uploadFile, deleteFile, getSignedUrl } from '../lib/supabase'
import {
  CheckSquare, Plus, Menu, Zap, Calendar, Trash2, Edit2,
  AlertTriangle, Flame, Circle, X, Filter, Search,
  Clock, CheckCircle2, Loader2, LayoutDashboard, List,
  CalendarDays, CalendarClock, CalendarOff, History,
  ChevronDown, Building2, Paperclip, FileText,
} from 'lucide-react'

const TASK_BUCKET = 'task-attachments'

function fmtBytes(n) {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${Math.round(n / 1024)} KB`
  return `${(n / 1048576).toFixed(1)} MB`
}

const URGENCY_OPTIONS = [
  { value: 'baixa',    label: 'Baixa',    Icon: Circle,         color: 'text-rl-muted',  bg: 'bg-rl-muted/10',  border: 'border-rl-muted/30'  },
  { value: 'media',    label: 'Média',    Icon: Clock,          color: 'text-rl-cyan',   bg: 'bg-rl-cyan/10',   border: 'border-rl-cyan/30'   },
  { value: 'alta',     label: 'Alta',     Icon: AlertTriangle,  color: 'text-rl-gold',   bg: 'bg-rl-gold/10',   border: 'border-rl-gold/30'   },
  { value: 'critica',  label: 'Crítica',  Icon: Flame,          color: 'text-red-400',   bg: 'bg-red-400/10',   border: 'border-red-400/30'   },
]

const STATUS_OPTIONS = [
  { value: 'backlog',      label: 'Backlog',      dot: 'bg-rl-muted/60' },
  { value: 'a_fazer',      label: 'A fazer',      dot: 'bg-rl-muted'    },
  { value: 'em_andamento', label: 'Em andamento', dot: 'bg-rl-cyan'     },
  { value: 'em_revisao',   label: 'Em revisão',   dot: 'bg-rl-gold'     },
  { value: 'concluido',    label: 'Finalizado',   dot: 'bg-rl-green'    },
]

function urgencyConfig(value) {
  return URGENCY_OPTIONS.find((u) => u.value === value) || URGENCY_OPTIONS[1]
}

function statusConfig(value) {
  return STATUS_OPTIONS.find((s) => s.value === value) || STATUS_OPTIONS[0]
}

function fmtDate(iso) {
  if (!iso) return null
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function isOverdue(due, status) {
  if (!due || status === 'concluido') return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(due + 'T00:00:00')
  return d.getTime() < today.getTime()
}

// ─── Helpers de data para o painel pessoal ───────────────────────────────────
function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function dueDateMs(iso) {
  if (!iso) return null
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso)
  if (isNaN(d.getTime())) return null
  return d.getTime()
}

function bucketize(tasks, currentUserId) {
  const today      = startOfToday().getTime()
  const tomorrow   = today + 86400000
  const sevenDays  = today + 7 * 86400000
  const yesterday  = today - 86400000

  const overdue   = []
  const todayList = []
  const next7Days = []
  const noDate    = []
  const doneToday     = []
  const doneYesterday = []

  for (const t of tasks) {
    if (currentUserId && !(t.assignee_ids || []).includes(currentUserId)) continue

    if (t.status === 'concluido') {
      const ms = t.completed_at ? new Date(t.completed_at).getTime() : null
      if (ms == null) continue
      if (ms >= today && ms < tomorrow) doneToday.push(t)
      else if (ms >= yesterday && ms < today) doneYesterday.push(t)
      continue
    }

    const dueMs = dueDateMs(t.due_date)
    if (dueMs == null) { noDate.push(t); continue }
    if (dueMs < today)                             overdue.push(t)
    else if (dueMs >= today && dueMs < tomorrow)   todayList.push(t)
    else if (dueMs >= tomorrow && dueMs <= sevenDays) next7Days.push(t)
    // tarefas com vencimento >7 dias não entram em nenhum bucket
  }

  return { overdue, today: todayList, next7Days, noDate, doneToday, doneYesterday }
}

function UrgencyBadge({ value }) {
  const c = urgencyConfig(value)
  const Icon = c.Icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${c.bg} ${c.color} ${c.border}`}>
      <Icon className="w-3 h-3" />
      {c.label}
    </span>
  )
}

function StatusBadge({ value }) {
  const c = statusConfig(value)
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-rl-muted">
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  )
}

// ─── Task form (modal de criação/edição) ─────────────────────────────────────
function TaskForm({ initial, projects, teamMembers, onClose, onSubmit, onError }) {
  const [taskId]    = useState(() => initial?.id || crypto.randomUUID())
  const [projectId,   setProjectId]   = useState(initial?.project_id  || projects[0]?.id || '')
  const [personaId,   setPersonaId]   = useState(initial?.persona_id  || '')
  const [title,       setTitle]       = useState(initial?.title       || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [assigneeIds, setAssigneeIds] = useState(initial?.assignee_ids || [])
  const [clientResponsible, setClientResponsible] = useState(!!initial?.client_responsible)
  const [dueDate,     setDueDate]     = useState(initial?.due_date    || '')
  const [urgency,     setUrgency]     = useState(initial?.urgency     || 'media')
  const [status,      setStatus]      = useState(initial?.status      || 'backlog')
  const [attachments, setAttachments] = useState(initial?.attachments || [])
  const [uploading,   setUploading]   = useState(false)
  const [submitting,  setSubmitting]  = useState(false)
  const [assigneeOpen, setAssigneeOpen] = useState(false)

  async function handleUpload(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = '' // permite selecionar o mesmo arquivo novamente
    if (files.length === 0) return
    setUploading(true)
    const uploaded = []
    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${taskId}/${Date.now()}-${safeName}`
      const url = await uploadFile(TASK_BUCKET, path, file)
      if (url) uploaded.push({ path, name: file.name, type: file.type, size: file.size })
      else if (onError) onError(`Falha ao enviar ${file.name}`)
    }
    setAttachments((prev) => [...prev, ...uploaded])
    setUploading(false)
  }

  async function handleRemoveAttachment(idx) {
    const att = attachments[idx]
    setAttachments((prev) => prev.filter((_, i) => i !== idx))
    if (att?.path) await deleteFile(TASK_BUCKET, att.path)
  }

  async function handleOpenAttachment(att) {
    if (!att?.path) return
    const url = await getSignedUrl(TASK_BUCKET, att.path)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  const project  = projects.find((p) => p.id === projectId)
  const personas = project?.personas || []

  // Reset persona se mudar de projeto e a persona atual não pertence ao novo projeto
  function handleProjectChange(newId) {
    setProjectId(newId)
    const newProj = projects.find((p) => p.id === newId)
    const exists = (newProj?.personas || []).some((p) => p.id === personaId)
    if (!exists) setPersonaId('')
  }

  function toggleAssignee(id) {
    setAssigneeIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim() || !projectId) return
    setSubmitting(true)
    await onSubmit({
      id:                 initial ? undefined : taskId,
      project_id:         projectId,
      persona_id:         personaId || null,
      title:              title.trim(),
      description:        description.trim() || null,
      assignee_ids:       assigneeIds,
      client_responsible: clientResponsible,
      due_date:           dueDate || null,
      urgency,
      status,
      attachments,
    })
    setSubmitting(false)
  }

  const clientLabel = project?.responsibleName || project?.responsible_name || project?.companyName || project?.company_name || 'Cliente'
  const selectedMembers = teamMembers.filter((m) => assigneeIds.includes(m.id))
  const assigneeButtonLabel = (() => {
    const parts = []
    if (clientResponsible) parts.push(`Cliente · ${clientLabel}`)
    if (selectedMembers.length === 1) parts.push(selectedMembers[0].name)
    else if (selectedMembers.length > 1) parts.push(`${selectedMembers.length} membros`)
    return parts.length ? parts.join(' + ') : 'Sem responsável'
  })()

  return (
    <Modal onClose={onClose} maxWidth="lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-rl-text">
          {initial ? 'Editar tarefa' : 'Nova tarefa'}
        </h2>
        <button onClick={onClose} className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition">
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Cliente */}
        <div>
          <label className="block text-xs font-semibold text-rl-muted mb-1.5 uppercase tracking-wider">Cliente</label>
          <select
            value={projectId}
            onChange={(e) => handleProjectChange(e.target.value)}
            required
            className="w-full bg-rl-surface border border-rl-border rounded-lg px-3 py-2 text-sm text-rl-text focus:outline-none focus:border-rl-purple"
          >
            <option value="">Selecione um cliente</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.companyName || p.company_name}</option>
            ))}
          </select>
        </div>

        {/* Perfil de cliente (persona) */}
        {personas.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-rl-muted mb-1.5 uppercase tracking-wider">
              Perfil de cliente <span className="text-rl-muted/60 normal-case font-normal">(opcional)</span>
            </label>
            <select
              value={personaId}
              onChange={(e) => setPersonaId(e.target.value)}
              className="w-full bg-rl-surface border border-rl-border rounded-lg px-3 py-2 text-sm text-rl-text focus:outline-none focus:border-rl-purple"
            >
              <option value="">Sem perfil específico</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>{p.name || 'Persona'}</option>
              ))}
            </select>
          </div>
        )}

        {/* Título */}
        <div>
          <label className="block text-xs font-semibold text-rl-muted mb-1.5 uppercase tracking-wider">Título</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Ex.: Configurar campanha de remarketing"
            className="w-full bg-rl-surface border border-rl-border rounded-lg px-3 py-2 text-sm text-rl-text placeholder:text-rl-muted focus:outline-none focus:border-rl-purple"
          />
        </div>

        {/* Descrição */}
        <div>
          <label className="block text-xs font-semibold text-rl-muted mb-1.5 uppercase tracking-wider">Descrição</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Detalhes da atividade..."
            className="w-full bg-rl-surface border border-rl-border rounded-lg px-3 py-2 text-sm text-rl-text placeholder:text-rl-muted focus:outline-none focus:border-rl-purple resize-none"
          />

          {/* Anexos */}
          <div className="mt-2">
            <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rl-surface border border-rl-border text-xs text-rl-muted hover:text-rl-text hover:border-rl-purple/50 cursor-pointer transition">
              {uploading
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando...</>
                : <><Paperclip className="w-3.5 h-3.5" /> Adicionar anexo</>
              }
              <input
                type="file"
                multiple
                onChange={handleUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
            {attachments.length > 0 && (
              <ul className="mt-2 space-y-1">
                {attachments.map((att, idx) => (
                  <li key={att.path || idx} className="flex items-center gap-2 px-2.5 py-1.5 bg-rl-surface/60 border border-rl-border rounded-lg">
                    <FileText className="w-3.5 h-3.5 text-rl-purple shrink-0" />
                    <button
                      type="button"
                      onClick={() => handleOpenAttachment(att)}
                      className="flex-1 min-w-0 text-left text-xs text-rl-text hover:text-rl-purple truncate"
                      title={att.name}
                    >
                      {att.name}
                    </button>
                    {att.size > 0 && (
                      <span className="text-[10px] text-rl-muted shrink-0">{fmtBytes(att.size)}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(idx)}
                      className="p-0.5 rounded text-rl-muted hover:text-red-400 transition"
                      aria-label="Remover anexo"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Responsáveis (multi-select com cliente) */}
        <div className="relative">
          <label className="block text-xs font-semibold text-rl-muted mb-1.5 uppercase tracking-wider">
            Responsáveis <span className="text-rl-muted/60 normal-case font-normal">(time + cliente)</span>
          </label>
          <button
            type="button"
            onClick={() => setAssigneeOpen((v) => !v)}
            className="w-full bg-rl-surface border border-rl-border rounded-lg px-3 py-2 text-sm text-rl-text hover:border-rl-purple/50 focus:outline-none focus:border-rl-purple flex items-center justify-between gap-2"
          >
            <span className={`truncate text-left ${assigneeButtonLabel === 'Sem responsável' ? 'text-rl-muted' : ''}`}>
              {assigneeButtonLabel}
            </span>
            <ChevronDown className={`w-4 h-4 shrink-0 text-rl-muted transition-transform ${assigneeOpen ? 'rotate-180' : ''}`} />
          </button>
          {(clientResponsible || selectedMembers.length > 0) && (
            <div className="flex flex-wrap gap-1 mt-2">
              {clientResponsible && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-rl-gold/10 text-rl-gold border border-rl-gold/30">
                  <Building2 className="w-3 h-3" /> {clientLabel}
                  <button type="button" onClick={() => setClientResponsible(false)} className="hover:text-rl-text">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {selectedMembers.map((m) => (
                <span key={m.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-rl-purple/10 text-rl-purple border border-rl-purple/30">
                  {m.name.split(' ')[0]}
                  <button type="button" onClick={() => toggleAssignee(m.id)} className="hover:text-rl-text">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          {assigneeOpen && (
            <div className="absolute z-10 mt-1 left-0 right-0 max-h-60 overflow-y-auto glass-card border border-rl-border rounded-lg shadow-2xl py-1">
              {/* Cliente como responsável */}
              <label className="flex items-center gap-2 px-3 py-2 hover:bg-rl-surface cursor-pointer">
                <input
                  type="checkbox"
                  checked={clientResponsible}
                  onChange={(e) => setClientResponsible(e.target.checked)}
                  className="w-4 h-4 accent-rl-gold"
                />
                <Building2 className="w-3.5 h-3.5 text-rl-gold" />
                <span className="text-sm text-rl-text">Cliente</span>
                <span className="text-xs text-rl-muted truncate">· {clientLabel}</span>
              </label>
              <div className="border-t border-rl-border/50 my-1" />
              {teamMembers.length === 0 ? (
                <p className="px-3 py-2 text-xs text-rl-muted">Nenhum membro disponível</p>
              ) : teamMembers.map((m) => (
                <label key={m.id} className="flex items-center gap-2 px-3 py-2 hover:bg-rl-surface cursor-pointer">
                  <input
                    type="checkbox"
                    checked={assigneeIds.includes(m.id)}
                    onChange={() => toggleAssignee(m.id)}
                    className="w-4 h-4 accent-rl-purple"
                  />
                  <div className="w-5 h-5 rounded-full bg-gradient-rl flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                    {(m.avatar || m.name?.slice(0, 2) || '??').toUpperCase()}
                  </div>
                  <span className="text-sm text-rl-text">{m.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Vencimento */}
          <div>
            <label className="block text-xs font-semibold text-rl-muted mb-1.5 uppercase tracking-wider">Vencimento</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-rl-surface border border-rl-border rounded-lg px-3 py-2 text-sm text-rl-text focus:outline-none focus:border-rl-purple"
            />
          </div>

          {/* Urgência */}
          <div>
            <label className="block text-xs font-semibold text-rl-muted mb-1.5 uppercase tracking-wider">Urgência</label>
            <select
              value={urgency}
              onChange={(e) => setUrgency(e.target.value)}
              className="w-full bg-rl-surface border border-rl-border rounded-lg px-3 py-2 text-sm text-rl-text focus:outline-none focus:border-rl-purple"
            >
              {URGENCY_OPTIONS.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-rl-muted mb-1.5 uppercase tracking-wider">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-rl-surface border border-rl-border rounded-lg px-3 py-2 text-sm text-rl-text focus:outline-none focus:border-rl-purple"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-rl-border">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-rl-muted hover:text-rl-text transition">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting || !title.trim() || !projectId}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Salvando...' : initial ? 'Salvar' : 'Criar tarefa'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Task row (linha da tabela) ──────────────────────────────────────────────
function TaskRow({ task, project, persona, assignees, onEdit, onDelete, onToggleStatus }) {
  const overdue  = isOverdue(task.due_date, task.status)
  const dueLabel = fmtDate(task.due_date)
  const created  = fmtDate(task.created_at)

  return (
    <tr className="border-b border-rl-border/50 hover:bg-rl-surface/40 transition-colors">
      <td className="py-3 px-3">
        <button
          onClick={() => onToggleStatus(task)}
          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition ${
            task.status === 'concluido'
              ? 'bg-rl-green border-rl-green'
              : 'border-rl-border hover:border-rl-purple'
          }`}
          aria-label="Concluir tarefa"
        >
          {task.status === 'concluido' && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
        </button>
      </td>
      <td className="py-3 px-3">
        <div className="flex flex-col">
          <span className={`text-sm font-medium inline-flex items-center gap-1.5 ${task.status === 'concluido' ? 'text-rl-muted line-through' : 'text-rl-text'}`}>
            {task.title}
            {Array.isArray(task.attachments) && task.attachments.length > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-rl-muted" title={`${task.attachments.length} anexo(s)`}>
                <Paperclip className="w-3 h-3" />
                {task.attachments.length}
              </span>
            )}
          </span>
          {task.description && (
            <span className="text-xs text-rl-muted line-clamp-1 mt-0.5">{task.description}</span>
          )}
          <div className="mt-1"><StatusBadge value={task.status} /></div>
        </div>
      </td>
      <td className="py-3 px-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-rl-text whitespace-nowrap">
            {project?.companyName || project?.company_name || '—'}
          </span>
          {persona && (
            <span className="text-[11px] text-rl-purple bg-rl-purple/10 px-1.5 py-0.5 rounded-full self-start">
              {persona.name}
            </span>
          )}
        </div>
      </td>
      <td className="py-3 px-3">
        {(task.client_responsible || (assignees && assignees.length > 0)) ? (
          <div className="flex items-center gap-1 flex-wrap">
            {task.client_responsible && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] bg-rl-gold/10 text-rl-gold border border-rl-gold/30">
                <Building2 className="w-2.5 h-2.5" /> Cliente
              </span>
            )}
            {(assignees || []).slice(0, 3).map((a) => (
              <div
                key={a.id}
                title={a.name}
                className="w-5 h-5 rounded-full bg-gradient-rl flex items-center justify-center text-[9px] font-bold text-white border border-rl-bg"
              >
                {(a.avatar || a.name?.slice(0, 2) || '??').toUpperCase()}
              </div>
            ))}
            {assignees && assignees.length > 3 && (
              <span className="text-[10px] text-rl-muted">+{assignees.length - 3}</span>
            )}
          </div>
        ) : (
          <span className="text-xs text-rl-muted">—</span>
        )}
      </td>
      <td className="py-3 px-3 text-xs text-rl-muted whitespace-nowrap">{created || '—'}</td>
      <td className="py-3 px-3 whitespace-nowrap">
        {dueLabel ? (
          <span className={`inline-flex items-center gap-1 text-xs ${overdue ? 'text-red-400 font-semibold' : 'text-rl-text'}`}>
            <Calendar className="w-3 h-3" />
            {dueLabel}
            {overdue && <span className="text-[10px] uppercase">atrasado</span>}
          </span>
        ) : (
          <span className="text-xs text-rl-muted">—</span>
        )}
      </td>
      <td className="py-3 px-3"><UrgencyBadge value={task.urgency} /></td>
      <td className="py-3 px-3">
        <div className="flex items-center gap-1">
          <button onClick={() => onEdit(task)} className="p-1.5 rounded-lg text-rl-muted hover:text-rl-cyan hover:bg-rl-cyan/10 transition" aria-label="Editar">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(task)} className="p-1.5 rounded-lg text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition" aria-label="Excluir">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Bucket card (painel pessoal) ────────────────────────────────────────────
function BucketCard({ title, Icon, tone, tasks, projectMap, onEdit, onToggleStatus, emptyLabel }) {
  const TONE = {
    red:    { ring: 'border-red-400/30',   bg: 'bg-red-400/5',   text: 'text-red-400',   icon: 'text-red-400'   },
    orange: { ring: 'border-orange-400/30', bg: 'bg-orange-400/5', text: 'text-orange-400', icon: 'text-orange-400' },
    cyan:   { ring: 'border-rl-cyan/30',   bg: 'bg-rl-cyan/5',   text: 'text-rl-cyan',   icon: 'text-rl-cyan'   },
    muted:  { ring: 'border-rl-border',    bg: 'bg-rl-surface/40', text: 'text-rl-muted', icon: 'text-rl-muted'  },
    green:  { ring: 'border-rl-green/30',  bg: 'bg-rl-green/5',  text: 'text-rl-green',  icon: 'text-rl-green'  },
    purple: { ring: 'border-rl-purple/30', bg: 'bg-rl-purple/5', text: 'text-rl-purple', icon: 'text-rl-purple' },
  }
  const t = TONE[tone] || TONE.muted

  return (
    <div className={`glass-card border ${t.ring} flex flex-col overflow-hidden`}>
      <div className={`flex items-center justify-between px-4 py-3 ${t.bg} border-b ${t.ring}`}>
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${t.icon}`} />
          <h3 className="text-sm font-bold text-rl-text">{title}</h3>
        </div>
        <span className={`text-xs font-bold tabular-nums ${t.text}`}>{tasks.length}</span>
      </div>
      <div className="flex-1 max-h-[340px] overflow-y-auto scroll-hide">
        {tasks.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-rl-muted">
            {emptyLabel || 'Nada por aqui'}
          </div>
        ) : (
          <ul className="divide-y divide-rl-border/40">
            {tasks.map((task) => {
              const project = projectMap.get(task.project_id)
              const persona = (project?.personas || []).find((p) => p.id === task.persona_id)
              const dueLabel = fmtDate(task.due_date)
              const completedLabel = task.completed_at
                ? new Date(task.completed_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                : null
              return (
                <li key={task.id} className="px-3 py-2.5 hover:bg-rl-surface/40 transition-colors">
                  <div className="flex items-start gap-2">
                    <button
                      onClick={() => onToggleStatus(task)}
                      className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center transition shrink-0 ${
                        task.status === 'concluido'
                          ? 'bg-rl-green border-rl-green'
                          : 'border-rl-border hover:border-rl-purple'
                      }`}
                      aria-label="Concluir tarefa"
                    >
                      {task.status === 'concluido' && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => onEdit(task)}
                        className="text-left w-full"
                      >
                        <p className={`text-sm font-medium leading-snug inline-flex items-center gap-1.5 ${task.status === 'concluido' ? 'text-rl-muted line-through' : 'text-rl-text'}`}>
                          {task.title}
                          {Array.isArray(task.attachments) && task.attachments.length > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-rl-muted" title={`${task.attachments.length} anexo(s)`}>
                              <Paperclip className="w-3 h-3" />
                              {task.attachments.length}
                            </span>
                          )}
                        </p>
                      </button>
                      <div className="flex items-center gap-1.5 flex-wrap mt-1">
                        <span className="text-[11px] text-rl-muted truncate max-w-[160px]">
                          {project?.companyName || project?.company_name || '—'}
                        </span>
                        {persona && (
                          <span className="text-[10px] text-rl-purple bg-rl-purple/10 px-1.5 py-0.5 rounded-full">
                            {persona.name}
                          </span>
                        )}
                        {task.client_responsible && (
                          <span className="text-[10px] inline-flex items-center gap-0.5 text-rl-gold bg-rl-gold/10 border border-rl-gold/30 px-1.5 py-0.5 rounded-full">
                            <Building2 className="w-2.5 h-2.5" /> Cliente
                          </span>
                        )}
                        {task.status !== 'concluido' && dueLabel && (
                          <span className={`text-[10px] inline-flex items-center gap-0.5 ${tone === 'red' ? 'text-red-400 font-semibold' : 'text-rl-muted'}`}>
                            <Calendar className="w-2.5 h-2.5" /> {dueLabel}
                          </span>
                        )}
                        {task.status === 'concluido' && completedLabel && (
                          <span className="text-[10px] text-rl-green inline-flex items-center gap-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5" /> {completedLabel}
                          </span>
                        )}
                        <UrgencyBadge value={task.urgency} />
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

// ─── Página principal ────────────────────────────────────────────────────────
export default function Tasks() {
  const navigate = useNavigate()
  const { user, tasks, loadingTasks, projects, teamMembers, addTask, updateTask, deleteTask } = useApp()
  const { toast, showToast } = useToast()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [view,          setView]          = useState('panel') // 'panel' | 'list'
  const [panelScope,    setPanelScope]    = useState('mine')  // 'mine' | 'all'
  const [filterClient,  setFilterClient]  = useState('all')
  const [filterPersona, setFilterPersona] = useState('all')
  const [filterUrgency, setFilterUrgency] = useState('all')
  const [filterStatus,  setFilterStatus]  = useState('all')
  const [search,        setSearch]        = useState('')
  const [showForm,      setShowForm]      = useState(false)
  const [editing,       setEditing]       = useState(null)

  // Mapas para lookups rápidos
  const projectMap = useMemo(() => {
    const m = new Map()
    projects.forEach((p) => m.set(p.id, p))
    return m
  }, [projects])

  const memberMap = useMemo(() => {
    const m = new Map()
    teamMembers.forEach((mb) => m.set(mb.id, mb))
    return m
  }, [teamMembers])

  // Quando filtra por cliente, mostra as personas daquele cliente
  const personasOfFilteredClient = useMemo(() => {
    if (filterClient === 'all') return []
    const p = projectMap.get(filterClient)
    return p?.personas || []
  }, [filterClient, projectMap])

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (filterClient !== 'all' && t.project_id !== filterClient) return false
      if (filterPersona !== 'all') {
        if (filterPersona === 'none' && t.persona_id) return false
        if (filterPersona !== 'none' && t.persona_id !== filterPersona) return false
      }
      if (filterUrgency !== 'all' && t.urgency !== filterUrgency) return false
      if (filterStatus  !== 'all' && t.status  !== filterStatus)  return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const project = projectMap.get(t.project_id)
        const haystack = [
          t.title, t.description,
          project?.companyName, project?.company_name,
        ].filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [tasks, filterClient, filterPersona, filterUrgency, filterStatus, search, projectMap])

  // ── KPIs ────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total      = filtered.length
    const backlog    = filtered.filter((t) => t.status === 'backlog').length
    const aFazer     = filtered.filter((t) => t.status === 'a_fazer').length
    const emAndamento= filtered.filter((t) => t.status === 'em_andamento').length
    const emRevisao  = filtered.filter((t) => t.status === 'em_revisao').length
    const concluido  = filtered.filter((t) => t.status === 'concluido').length
    const overdue    = filtered.filter((t) => isOverdue(t.due_date, t.status)).length
    const critical   = filtered.filter((t) => t.urgency === 'critica' && t.status !== 'concluido').length
    return { total, backlog, aFazer, emAndamento, emRevisao, concluido, overdue, critical }
  }, [filtered])

  // ── Buckets do painel pessoal ───────────────────────────────────────────
  const buckets = useMemo(
    () => bucketize(tasks, panelScope === 'mine' ? user?.id : null),
    [tasks, panelScope, user?.id],
  )

  async function handleSave(payload) {
    if (editing) {
      const { error } = await updateTask(editing.id, payload)
      if (error) { showToast(error, 'error'); return }
      showToast('Tarefa atualizada')
    } else {
      const { error } = await addTask(payload)
      if (error) { showToast(error, 'error'); return }
      showToast('Tarefa criada')
    }
    setShowForm(false)
    setEditing(null)
  }

  async function handleToggleStatus(task) {
    const newStatus = task.status === 'concluido' ? 'a_fazer' : 'concluido'
    const { error } = await updateTask(task.id, { status: newStatus })
    if (error) showToast(error, 'error')
  }

  async function handleDelete(task) {
    if (!window.confirm(`Excluir "${task.title}"?`)) return
    const { error } = await deleteTask(task.id)
    if (error) showToast(error, 'error')
    else showToast('Tarefa excluída')
  }

  return (
    <div className="min-h-screen flex bg-gradient-dark">
      <AppSidebar
        filter="tarefas"
        setFilter={() => navigate('/')}
        counts={{}}
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
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-rl flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-rl-text text-sm">Tarefas</span>
          </div>
        </div>

        <main className="flex-1 px-6 py-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* ── Header ─────────────────────────────────────── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rl-purple/10 flex items-center justify-center">
                  <CheckSquare className="w-5 h-5 text-rl-purple" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-rl-text">Tarefas</h1>
                  <p className="text-sm text-rl-muted">Atividades por cliente e perfil de cliente</p>
                </div>
              </div>
              <button
                onClick={() => { setEditing(null); setShowForm(true) }}
                className="btn-primary flex items-center gap-2 text-sm px-4 py-2"
              >
                <Plus className="w-4 h-4" /> Nova tarefa
              </button>
            </div>

            {/* ── Tabs ───────────────────────────────────────── */}
            <div className="flex items-center gap-1 border-b border-rl-border">
              <button
                onClick={() => setView('panel')}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
                  view === 'panel'
                    ? 'border-rl-purple text-rl-purple'
                    : 'border-transparent text-rl-muted hover:text-rl-text'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Meu painel
              </button>
              <button
                onClick={() => setView('list')}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
                  view === 'list'
                    ? 'border-rl-purple text-rl-purple'
                    : 'border-transparent text-rl-muted hover:text-rl-text'
                }`}
              >
                <List className="w-4 h-4" />
                Todas as tarefas
              </button>
            </div>

            {view === 'panel' ? (
              <PersonalPanel
                buckets={buckets}
                scope={panelScope}
                onScopeChange={setPanelScope}
                projectMap={projectMap}
                memberMap={memberMap}
                onEdit={(task) => { setEditing(task); setShowForm(true) }}
                onToggleStatus={handleToggleStatus}
                loadingTasks={loadingTasks}
              />
            ) : (
              <ListView
                kpis={kpis}
                tasks={filtered}
                allTasks={tasks}
                loadingTasks={loadingTasks}
                projects={projects}
                projectMap={projectMap}
                memberMap={memberMap}
                personasOfFilteredClient={personasOfFilteredClient}
                search={search} setSearch={setSearch}
                filterClient={filterClient} setFilterClient={setFilterClient}
                filterPersona={filterPersona} setFilterPersona={setFilterPersona}
                filterUrgency={filterUrgency} setFilterUrgency={setFilterUrgency}
                filterStatus={filterStatus} setFilterStatus={setFilterStatus}
                onEdit={(task) => { setEditing(task); setShowForm(true) }}
                onDelete={handleDelete}
                onToggleStatus={handleToggleStatus}
              />
            )}
          </div>
        </main>
      </div>

      {showForm && (
        <TaskForm
          initial={editing}
          projects={projects}
          teamMembers={teamMembers}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSubmit={handleSave}
          onError={(msg) => showToast(msg, 'error')}
        />
      )}

      <Toast toast={toast} />
    </div>
  )
}

function KpiCard({ label, value, color }) {
  return (
    <div className="glass-card p-3">
      <p className="text-[10px] font-semibold text-rl-muted uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 tabular-nums ${color}`}>{value}</p>
    </div>
  )
}

// ─── Painel pessoal ──────────────────────────────────────────────────────────
function PersonalPanel({ buckets, scope, onScopeChange, projectMap, memberMap, onEdit, onToggleStatus, loadingTasks }) {
  if (loadingTasks) {
    return (
      <div className="flex items-center justify-center py-16 text-rl-muted">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando painel...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toggle de escopo */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-rl-muted uppercase tracking-wider">Mostrar:</span>
        <div className="inline-flex bg-rl-surface border border-rl-border rounded-lg p-0.5">
          <button
            onClick={() => onScopeChange('mine')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition ${
              scope === 'mine' ? 'bg-rl-purple text-white' : 'text-rl-muted hover:text-rl-text'
            }`}
          >
            Minhas tarefas
          </button>
          <button
            onClick={() => onScopeChange('all')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition ${
              scope === 'all' ? 'bg-rl-purple text-white' : 'text-rl-muted hover:text-rl-text'
            }`}
          >
            Time inteiro
          </button>
        </div>
      </div>

      {/* Linha 1: pendentes por janela temporal */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <BucketCard
          title="Em atraso"
          Icon={AlertTriangle}
          tone="red"
          tasks={buckets.overdue}
          projectMap={projectMap}
          memberMap={memberMap}
          onEdit={onEdit}
          onToggleStatus={onToggleStatus}
          emptyLabel="Sem atrasos"
        />
        <BucketCard
          title="Para hoje"
          Icon={CalendarClock}
          tone="orange"
          tasks={buckets.today}
          projectMap={projectMap}
          memberMap={memberMap}
          onEdit={onEdit}
          onToggleStatus={onToggleStatus}
          emptyLabel="Nada para hoje"
        />
        <BucketCard
          title="Próximos 7 dias"
          Icon={CalendarDays}
          tone="cyan"
          tasks={buckets.next7Days}
          projectMap={projectMap}
          memberMap={memberMap}
          onEdit={onEdit}
          onToggleStatus={onToggleStatus}
          emptyLabel="Nenhuma tarefa nos próximos 7 dias"
        />
        <BucketCard
          title="Sem data"
          Icon={CalendarOff}
          tone="muted"
          tasks={buckets.noDate}
          projectMap={projectMap}
          memberMap={memberMap}
          onEdit={onEdit}
          onToggleStatus={onToggleStatus}
          emptyLabel="Tudo com data definida"
        />
      </div>

      {/* Linha 2: concluídas */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <History className="w-4 h-4 text-rl-green" />
          <h3 className="text-xs font-semibold text-rl-muted uppercase tracking-wider">Histórico recente</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <BucketCard
            title="Concluídas hoje"
            Icon={CheckCircle2}
            tone="green"
            tasks={buckets.doneToday}
            projectMap={projectMap}
            memberMap={memberMap}
            onEdit={onEdit}
            onToggleStatus={onToggleStatus}
            emptyLabel="Ainda nada concluído hoje"
          />
          <BucketCard
            title="Concluídas ontem"
            Icon={CheckCircle2}
            tone="purple"
            tasks={buckets.doneYesterday}
            projectMap={projectMap}
            memberMap={memberMap}
            onEdit={onEdit}
            onToggleStatus={onToggleStatus}
            emptyLabel="Nenhuma conclusão ontem"
          />
        </div>
      </div>
    </div>
  )
}

// ─── List view (visão completa com filtros e tabela) ─────────────────────────
function ListView({
  kpis, tasks, allTasks, loadingTasks, projects, projectMap, memberMap,
  personasOfFilteredClient,
  search, setSearch,
  filterClient, setFilterClient,
  filterPersona, setFilterPersona,
  filterUrgency, setFilterUrgency,
  filterStatus, setFilterStatus,
  onEdit, onDelete, onToggleStatus,
}) {
  return (
    <div className="space-y-6">
      {/* ── KPIs ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <KpiCard label="Total" value={kpis.total} color="text-rl-text" />
        <KpiCard label="Backlog" value={kpis.backlog} color="text-rl-muted" />
        <KpiCard label="A fazer" value={kpis.aFazer} color="text-rl-muted" />
        <KpiCard label="Em andamento" value={kpis.emAndamento} color="text-rl-cyan" />
        <KpiCard label="Em revisão" value={kpis.emRevisao} color="text-rl-gold" />
        <KpiCard label="Finalizadas" value={kpis.concluido} color="text-rl-green" />
        <KpiCard label="Atrasadas" value={kpis.overdue} color="text-red-400" />
      </div>

      {/* ── Filters ────────────────────────────────────── */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-rl-muted" />
          <h2 className="text-xs font-semibold text-rl-muted uppercase tracking-wider">Filtros</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-rl-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar título, descrição ou cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-rl-surface border border-rl-border rounded-lg pl-9 pr-3 py-2 text-sm text-rl-text placeholder:text-rl-muted focus:outline-none focus:border-rl-purple"
            />
          </div>
          <select
            value={filterClient}
            onChange={(e) => { setFilterClient(e.target.value); setFilterPersona('all') }}
            className="bg-rl-surface border border-rl-border rounded-lg px-3 py-2 text-sm text-rl-text focus:outline-none focus:border-rl-purple"
          >
            <option value="all">Todos os clientes</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.companyName || p.company_name}</option>
            ))}
          </select>
          <select
            value={filterPersona}
            onChange={(e) => setFilterPersona(e.target.value)}
            disabled={filterClient === 'all'}
            className="bg-rl-surface border border-rl-border rounded-lg px-3 py-2 text-sm text-rl-text focus:outline-none focus:border-rl-purple disabled:opacity-50 disabled:cursor-not-allowed"
            title={filterClient === 'all' ? 'Selecione um cliente para filtrar por perfil' : ''}
          >
            <option value="all">Todos os perfis</option>
            <option value="none">Sem perfil</option>
            {personasOfFilteredClient.map((p) => (
              <option key={p.id} value={p.id}>{p.name || 'Persona'}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-rl-surface border border-rl-border rounded-lg px-3 py-2 text-sm text-rl-text focus:outline-none focus:border-rl-purple"
            >
              <option value="all">Status</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <select
              value={filterUrgency}
              onChange={(e) => setFilterUrgency(e.target.value)}
              className="bg-rl-surface border border-rl-border rounded-lg px-3 py-2 text-sm text-rl-text focus:outline-none focus:border-rl-purple"
            >
              <option value="all">Urgência</option>
              {URGENCY_OPTIONS.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────── */}
      <div className="glass-card overflow-hidden">
        {loadingTasks ? (
          <div className="flex items-center justify-center py-16 text-rl-muted">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando tarefas...
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-16">
            <CheckSquare className="w-10 h-10 text-rl-muted mx-auto mb-3 opacity-50" />
            <p className="text-sm text-rl-muted">
              {allTasks.length === 0
                ? 'Nenhuma tarefa criada ainda.'
                : 'Nenhuma tarefa corresponde aos filtros aplicados.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-rl-surface/40 border-b border-rl-border">
                <tr>
                  <th className="text-left text-[10px] font-semibold text-rl-muted uppercase tracking-wider py-2.5 px-3"></th>
                  <th className="text-left text-[10px] font-semibold text-rl-muted uppercase tracking-wider py-2.5 px-3">Tarefa</th>
                  <th className="text-left text-[10px] font-semibold text-rl-muted uppercase tracking-wider py-2.5 px-3">Cliente / Perfil</th>
                  <th className="text-left text-[10px] font-semibold text-rl-muted uppercase tracking-wider py-2.5 px-3">Responsável</th>
                  <th className="text-left text-[10px] font-semibold text-rl-muted uppercase tracking-wider py-2.5 px-3">Criada</th>
                  <th className="text-left text-[10px] font-semibold text-rl-muted uppercase tracking-wider py-2.5 px-3">Vencimento</th>
                  <th className="text-left text-[10px] font-semibold text-rl-muted uppercase tracking-wider py-2.5 px-3">Urgência</th>
                  <th className="text-left text-[10px] font-semibold text-rl-muted uppercase tracking-wider py-2.5 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => {
                  const project = projectMap.get(t.project_id)
                  const persona = (project?.personas || []).find((p) => p.id === t.persona_id)
                  const assignees = (t.assignee_ids || []).map((id) => memberMap.get(id)).filter(Boolean)
                  return (
                    <TaskRow
                      key={t.id}
                      task={t}
                      project={project}
                      persona={persona}
                      assignees={assignees}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onToggleStatus={onToggleStatus}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
