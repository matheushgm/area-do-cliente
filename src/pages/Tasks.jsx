import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import AppSidebar from '../components/AppSidebar'
import Modal from '../components/UI/Modal'
import Toast from '../components/UI/Toast'
import { useToast } from '../hooks/useToast'
import {
  CheckSquare, Plus, Menu, Zap, Calendar, User, Trash2, Edit2,
  AlertTriangle, Flame, Circle, X, Filter, ChevronDown, Search,
  Clock, CheckCircle2, Loader2,
} from 'lucide-react'

const URGENCY_OPTIONS = [
  { value: 'baixa',    label: 'Baixa',    Icon: Circle,         color: 'text-rl-muted',  bg: 'bg-rl-muted/10',  border: 'border-rl-muted/30'  },
  { value: 'media',    label: 'Média',    Icon: Clock,          color: 'text-rl-cyan',   bg: 'bg-rl-cyan/10',   border: 'border-rl-cyan/30'   },
  { value: 'alta',     label: 'Alta',     Icon: AlertTriangle,  color: 'text-rl-gold',   bg: 'bg-rl-gold/10',   border: 'border-rl-gold/30'   },
  { value: 'critica',  label: 'Crítica',  Icon: Flame,          color: 'text-red-400',   bg: 'bg-red-400/10',   border: 'border-red-400/30'   },
]

const STATUS_OPTIONS = [
  { value: 'pending',     label: 'A fazer',     dot: 'bg-rl-muted'  },
  { value: 'in_progress', label: 'Em progresso', dot: 'bg-rl-cyan'   },
  { value: 'done',        label: 'Concluída',    dot: 'bg-rl-green'  },
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
  if (!due || status === 'done') return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(due + 'T00:00:00')
  return d.getTime() < today.getTime()
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
function TaskForm({ initial, projects, teamMembers, onClose, onSubmit }) {
  const [projectId,   setProjectId]   = useState(initial?.project_id  || projects[0]?.id || '')
  const [personaId,   setPersonaId]   = useState(initial?.persona_id  || '')
  const [title,       setTitle]       = useState(initial?.title       || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [assigneeId,  setAssigneeId]  = useState(initial?.assignee_id || '')
  const [dueDate,     setDueDate]     = useState(initial?.due_date    || '')
  const [urgency,     setUrgency]     = useState(initial?.urgency     || 'media')
  const [status,      setStatus]      = useState(initial?.status      || 'pending')
  const [submitting,  setSubmitting]  = useState(false)

  const project  = projects.find((p) => p.id === projectId)
  const personas = project?.personas || []

  // Reset persona se mudar de projeto e a persona atual não pertence ao novo projeto
  function handleProjectChange(newId) {
    setProjectId(newId)
    const newProj = projects.find((p) => p.id === newId)
    const exists = (newProj?.personas || []).some((p) => p.id === personaId)
    if (!exists) setPersonaId('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim() || !projectId) return
    setSubmitting(true)
    await onSubmit({
      project_id:  projectId,
      persona_id:  personaId || null,
      title:       title.trim(),
      description: description.trim() || null,
      assignee_id: assigneeId || null,
      due_date:    dueDate || null,
      urgency,
      status,
    })
    setSubmitting(false)
  }

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
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Responsável */}
          <div>
            <label className="block text-xs font-semibold text-rl-muted mb-1.5 uppercase tracking-wider">Responsável</label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full bg-rl-surface border border-rl-border rounded-lg px-3 py-2 text-sm text-rl-text focus:outline-none focus:border-rl-purple"
            >
              <option value="">Sem responsável</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

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
function TaskRow({ task, project, persona, assignee, onEdit, onDelete, onToggleStatus }) {
  const overdue  = isOverdue(task.due_date, task.status)
  const dueLabel = fmtDate(task.due_date)
  const created  = fmtDate(task.created_at)

  return (
    <tr className="border-b border-rl-border/50 hover:bg-rl-surface/40 transition-colors">
      <td className="py-3 px-3">
        <button
          onClick={() => onToggleStatus(task)}
          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition ${
            task.status === 'done'
              ? 'bg-rl-green border-rl-green'
              : 'border-rl-border hover:border-rl-purple'
          }`}
          aria-label="Concluir tarefa"
        >
          {task.status === 'done' && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
        </button>
      </td>
      <td className="py-3 px-3">
        <div className="flex flex-col">
          <span className={`text-sm font-medium ${task.status === 'done' ? 'text-rl-muted line-through' : 'text-rl-text'}`}>
            {task.title}
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
        {assignee ? (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-gradient-rl flex items-center justify-center text-[9px] font-bold text-white">
              {(assignee.avatar || assignee.name?.slice(0, 2) || '??').toUpperCase()}
            </div>
            <span className="text-xs text-rl-text whitespace-nowrap">{assignee.name?.split(' ')[0]}</span>
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

// ─── Página principal ────────────────────────────────────────────────────────
export default function Tasks() {
  const navigate = useNavigate()
  const { tasks, loadingTasks, projects, teamMembers, addTask, updateTask, deleteTask } = useApp()
  const { toast, showToast } = useToast()

  const [sidebarOpen, setSidebarOpen] = useState(false)
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
    const pending    = filtered.filter((t) => t.status === 'pending').length
    const inProgress = filtered.filter((t) => t.status === 'in_progress').length
    const done       = filtered.filter((t) => t.status === 'done').length
    const overdue    = filtered.filter((t) => isOverdue(t.due_date, t.status)).length
    const critical   = filtered.filter((t) => t.urgency === 'critica' && t.status !== 'done').length
    return { total, pending, inProgress, done, overdue, critical }
  }, [filtered])

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
    const newStatus = task.status === 'done' ? 'pending' : 'done'
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

            {/* ── KPIs ───────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <KpiCard label="Total" value={kpis.total} color="text-rl-text" />
              <KpiCard label="A fazer" value={kpis.pending} color="text-rl-muted" />
              <KpiCard label="Em progresso" value={kpis.inProgress} color="text-rl-cyan" />
              <KpiCard label="Concluídas" value={kpis.done} color="text-rl-green" />
              <KpiCard label="Atrasadas" value={kpis.overdue} color="text-red-400" />
              <KpiCard label="Críticas" value={kpis.critical} color="text-red-400" />
            </div>

            {/* ── Filters ────────────────────────────────────── */}
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Filter className="w-4 h-4 text-rl-muted" />
                <h2 className="text-xs font-semibold text-rl-muted uppercase tracking-wider">Filtros</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* Search */}
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

                {/* Cliente */}
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

                {/* Perfil de cliente */}
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

                {/* Status + urgência em linha */}
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
              ) : filtered.length === 0 ? (
                <div className="text-center py-16">
                  <CheckSquare className="w-10 h-10 text-rl-muted mx-auto mb-3 opacity-50" />
                  <p className="text-sm text-rl-muted">
                    {tasks.length === 0
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
                      {filtered.map((t) => {
                        const project = projectMap.get(t.project_id)
                        const persona = (project?.personas || []).find((p) => p.id === t.persona_id)
                        const assignee = memberMap.get(t.assignee_id)
                        return (
                          <TaskRow
                            key={t.id}
                            task={t}
                            project={project}
                            persona={persona}
                            assignee={assignee}
                            onEdit={(task) => { setEditing(task); setShowForm(true) }}
                            onDelete={handleDelete}
                            onToggleStatus={handleToggleStatus}
                          />
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
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
