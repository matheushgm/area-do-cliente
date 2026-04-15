import { useState, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import {
  KanbanSquare, Plus, X, Check, Trash2, Edit2,
  Users, Link2, Maximize2, Phone, Mail, DollarSign,
  ChevronDown,
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'lead_novo',    label: 'Lead Novo',        color: '#2563EB', bg: 'bg-rl-blue/10',   border: 'border-rl-blue/30',   text: 'text-rl-blue'   },
  { id: 'conectado',    label: 'Lead Conectado',   color: '#0891B2', bg: 'bg-rl-cyan/10',   border: 'border-rl-cyan/30',   text: 'text-rl-cyan'   },
  { id: 'qualificado',  label: 'Lead Qualificado', color: '#7C3AED', bg: 'bg-rl-purple/10', border: 'border-rl-purple/30', text: 'text-rl-purple' },
  { id: 'oportunidade', label: 'Oportunidade',     color: '#B45309', bg: 'bg-rl-gold/10',   border: 'border-rl-gold/30',   text: 'text-rl-gold'   },
  { id: 'venda',        label: 'Venda',            color: '#16A34A', bg: 'bg-rl-green/10',  border: 'border-rl-green/30',  text: 'text-rl-green'  },
]

const CAT_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]))

const DEFAULT_STAGES = CATEGORIES.map((c, i) => ({
  id: crypto.randomUUID(),
  name: c.label,
  category: c.id,
  color: c.color,
  order: i,
}))

function fmtBRL(n) {
  if (!n && n !== 0) return '—'
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function initCRM(existing) {
  if (existing?.stages?.length) return existing
  return { stages: DEFAULT_STAGES, contacts: [] }
}

// ─── Contact Card ─────────────────────────────────────────────────────────────

function ContactCard({ contact, onDelete, onDragStart }) {
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(contact.id) }}
      className="group glass-card p-3 cursor-grab active:cursor-grabbing select-none"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-rl-text leading-tight">{contact.nome}</p>
        <button
          onClick={() => onDelete(contact.id)}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-rl-muted hover:text-red-400 transition-all shrink-0"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      {contact.valor > 0 && (
        <p className="text-xs font-bold text-rl-green mt-1">{fmtBRL(contact.valor)}</p>
      )}
      {contact.email && (
        <p className="text-[11px] text-rl-muted flex items-center gap-1 mt-1 truncate">
          <Mail className="w-3 h-3 shrink-0" />{contact.email}
        </p>
      )}
      {contact.telefone && (
        <p className="text-[11px] text-rl-muted flex items-center gap-1 truncate">
          <Phone className="w-3 h-3 shrink-0" />{contact.telefone}
        </p>
      )}
    </div>
  )
}

// ─── Add Contact Form ─────────────────────────────────────────────────────────

function AddContactForm({ onAdd, onCancel }) {
  const [form, setForm] = useState({ nome: '', email: '', telefone: '', valor: '' })
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.nome.trim()) return
    onAdd({
      id: crypto.randomUUID(),
      nome: form.nome.trim(),
      email: form.email.trim(),
      telefone: form.telefone.trim(),
      valor: parseFloat(form.valor.replace(',', '.')) || 0,
      createdAt: new Date().toISOString(),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card p-3 space-y-2">
      <input
        autoFocus
        value={form.nome}
        onChange={(e) => set('nome', e.target.value)}
        placeholder="Nome *"
        className="input-field w-full text-xs py-2"
        required
      />
      <input
        value={form.email}
        onChange={(e) => set('email', e.target.value)}
        placeholder="Email"
        type="email"
        className="input-field w-full text-xs py-2"
      />
      <input
        value={form.telefone}
        onChange={(e) => set('telefone', e.target.value)}
        placeholder="Telefone"
        className="input-field w-full text-xs py-2"
      />
      <input
        value={form.valor}
        onChange={(e) => set('valor', e.target.value)}
        placeholder="Valor (R$)"
        className="input-field w-full text-xs py-2"
      />
      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1 text-xs py-1.5 flex items-center justify-center gap-1">
          <Check className="w-3 h-3" /> Adicionar
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary text-xs py-1.5 px-3">
          <X className="w-3 h-3" />
        </button>
      </div>
    </form>
  )
}

// ─── Add / Edit Stage Modal ───────────────────────────────────────────────────

function StageModal({ initial, onSave, onClose }) {
  const [name,     setName]     = useState(initial?.name     || '')
  const [category, setCategory] = useState(initial?.category || 'lead_novo')

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    onSave({ name: name.trim(), category, color: CAT_MAP[category].color })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <form onSubmit={handleSubmit} className="glass-card p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-rl-text">{initial ? 'Editar etapa' : 'Nova etapa'}</h3>
          <button type="button" onClick={onClose}><X className="w-4 h-4 text-rl-muted" /></button>
        </div>
        <div>
          <label className="label-field">Nome da etapa</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field w-full"
            required
          />
        </div>
        <div>
          <label className="label-field">Categoria</label>
          <div className="relative">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input-field w-full appearance-none pr-8"
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rl-muted pointer-events-none" />
          </div>
          <div className={`mt-2 flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg ${CAT_MAP[category].bg} ${CAT_MAP[category].text} ${CAT_MAP[category].border} border`}>
            <span className="w-2 h-2 rounded-full" style={{ background: CAT_MAP[category].color }} />
            {CAT_MAP[category].label}
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary flex-1">Salvar</button>
          <button type="button" onClick={onClose} className="btn-secondary px-4">Cancelar</button>
        </div>
      </form>
    </div>
  )
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

function KanbanColumn({ stage, contacts, draggingId, onDragStart, onDrop, onAddContact, onDeleteContact, onEditStage, onDeleteStage }) {
  const [adding, setAdding] = useState(false)
  const [over,   setOver]   = useState(false)
  const cat = CAT_MAP[stage.category] || CATEGORIES[0]
  const total = contacts.reduce((s, c) => s + (c.valor || 0), 0)

  return (
    <div
      className={`flex flex-col min-w-[260px] w-[260px] rounded-2xl border transition-all ${
        over ? 'border-rl-purple/60 bg-rl-purple/5' : 'border-rl-border bg-rl-surface/50'
      }`}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onDrop(stage.id) }}
    >
      {/* Column header */}
      <div className="p-3 border-b border-rl-border">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: stage.color }} />
            <span className="text-sm font-bold text-rl-text truncate">{stage.name}</span>
            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-rl-surface border border-rl-border text-rl-muted shrink-0">
              {contacts.length}
            </span>
          </div>
          <div className="flex gap-1 shrink-0">
            <button onClick={() => onEditStage(stage)} className="p-1 rounded text-rl-muted hover:text-rl-text transition-colors">
              <Edit2 className="w-3 h-3" />
            </button>
            <button onClick={() => onDeleteStage(stage.id)} className="p-1 rounded text-rl-muted hover:text-red-400 transition-colors">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
        <div className={`mt-1.5 text-[10px] px-2 py-0.5 rounded-full w-fit ${cat.bg} ${cat.text} border ${cat.border}`}>
          {cat.label}
        </div>
        {total > 0 && (
          <p className="text-[11px] font-semibold text-rl-green mt-1">{fmtBRL(total)}</p>
        )}
      </div>

      {/* Cards */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[420px]">
        {contacts.map((c) => (
          <div key={c.id} style={{ opacity: draggingId === c.id ? 0.4 : 1 }}>
            <ContactCard contact={c} onDelete={onDeleteContact} onDragStart={onDragStart} />
          </div>
        ))}

        {adding ? (
          <AddContactForm
            onAdd={(data) => { onAddContact(stage.id, data); setAdding(false) }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full text-[11px] text-rl-muted hover:text-rl-text border border-dashed border-rl-border hover:border-rl-purple/40 rounded-xl py-2 transition-all flex items-center justify-center gap-1"
          >
            <Plus className="w-3 h-3" /> Novo contato
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Dashboard Metrics ────────────────────────────────────────────────────────

function MetricCard({ cat, count, valor }) {
  return (
    <div className={`glass-card p-4 border ${cat.border} flex flex-col gap-1`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider ${cat.text}`}>{cat.label}</p>
      <p className={`text-3xl font-black ${cat.text}`}>{count}</p>
      {valor > 0 && <p className="text-[11px] text-rl-muted">{fmtBRL(valor)}</p>}
    </div>
  )
}

// ─── Main CRM Module ──────────────────────────────────────────────────────────

export default function CRMModule({ project }) {
  const { updateProject } = useApp()
  const [crm, setCRM] = useState(() => initCRM(project.crmData))
  const [draggingId,  setDraggingId]  = useState(null)
  const [stageModal,  setStageModal]  = useState(null) // null | 'new' | stage object
  const [copied,      setCopied]      = useState(false)

  const save = useCallback((next) => {
    setCRM(next)
    updateProject(project.id, { crmData: next })
  }, [project.id, updateProject])

  // ── Token helpers ──────────────────────────────────────────────────────────
  function getOrCreateToken() {
    if (project.clientShareToken) return project.clientShareToken
    const token = crypto.randomUUID()
    updateProject(project.id, { clientShareToken: token })
    return token
  }

  function handleFullscreen() {
    const token = getOrCreateToken()
    window.open(`${window.location.origin}/crm/${token}`, '_blank')
  }

  function handleShare() {
    const token = getOrCreateToken()
    navigator.clipboard.writeText(`${window.location.origin}/crm/${token}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  // ── Stage CRUD ─────────────────────────────────────────────────────────────
  function handleSaveStage(data) {
    if (stageModal && stageModal !== 'new') {
      // edit
      save({
        ...crm,
        stages: crm.stages.map((s) => s.id === stageModal.id ? { ...s, ...data } : s),
      })
    } else {
      // new
      save({
        ...crm,
        stages: [...crm.stages, { id: crypto.randomUUID(), order: crm.stages.length, ...data }],
      })
    }
  }

  function handleDeleteStage(stageId) {
    if (!window.confirm('Excluir esta etapa? Os contatos dela também serão removidos.')) return
    save({
      stages: crm.stages.filter((s) => s.id !== stageId),
      contacts: crm.contacts.filter((c) => c.stageId !== stageId),
    })
  }

  // ── Contact CRUD ───────────────────────────────────────────────────────────
  function handleAddContact(stageId, data) {
    save({ ...crm, contacts: [...crm.contacts, { ...data, stageId }] })
  }

  function handleDeleteContact(contactId) {
    save({ ...crm, contacts: crm.contacts.filter((c) => c.id !== contactId) })
  }

  // ── DnD ───────────────────────────────────────────────────────────────────
  function handleDrop(targetStageId) {
    if (!draggingId || draggingId === targetStageId) return
    save({
      ...crm,
      contacts: crm.contacts.map((c) =>
        c.id === draggingId ? { ...c, stageId: targetStageId } : c
      ),
    })
    setDraggingId(null)
  }

  // ── Metrics ───────────────────────────────────────────────────────────────
  const metrics = CATEGORIES.map((cat) => {
    const stageIds = crm.stages.filter((s) => s.category === cat.id).map((s) => s.id)
    const contacts = crm.contacts.filter((c) => stageIds.includes(c.stageId))
    return {
      cat,
      count: contacts.length,
      valor: contacts.reduce((s, c) => s + (c.valor || 0), 0),
    }
  })

  const sortedStages = [...crm.stages].sort((a, b) => a.order - b.order)

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-rl-text flex items-center gap-2">
            <KanbanSquare className="w-5 h-5 text-rl-purple" />
            CRM
          </h2>
          <p className="text-sm text-rl-muted mt-0.5">Pipeline de vendas e gestão de contatos</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleShare}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            {copied ? <Check className="w-4 h-4 text-rl-green" /> : <Link2 className="w-4 h-4" />}
            {copied ? 'Link copiado!' : 'Compartilhar'}
          </button>
          <button
            onClick={handleFullscreen}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Maximize2 className="w-4 h-4" />
            Tela Cheia
          </button>
        </div>
      </div>

      {/* Dashboard Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {metrics.map(({ cat, count, valor }) => (
          <MetricCard key={cat.id} cat={cat} count={count} valor={valor} />
        ))}
      </div>

      {/* Kanban */}
      <div
        className="overflow-x-auto pb-4"
        onDragEnd={() => setDraggingId(null)}
      >
        <div className="flex gap-3" style={{ minWidth: `${sortedStages.length * 272 + 160}px` }}>
          {sortedStages.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              contacts={crm.contacts.filter((c) => c.stageId === stage.id)}
              draggingId={draggingId}
              onDragStart={setDraggingId}
              onDrop={handleDrop}
              onAddContact={handleAddContact}
              onDeleteContact={handleDeleteContact}
              onEditStage={(s) => setStageModal(s)}
              onDeleteStage={handleDeleteStage}
            />
          ))}

          {/* Add stage button */}
          <div className="flex items-start pt-1">
            <button
              onClick={() => setStageModal('new')}
              className="flex items-center gap-2 px-4 py-3 rounded-2xl border-2 border-dashed border-rl-border text-rl-muted hover:border-rl-purple/50 hover:text-rl-text transition-all text-sm whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> Nova etapa
            </button>
          </div>
        </div>
      </div>

      {/* Stage Modal */}
      {stageModal && (
        <StageModal
          initial={stageModal === 'new' ? null : stageModal}
          onSave={handleSaveStage}
          onClose={() => setStageModal(null)}
        />
      )}
    </div>
  )
}
