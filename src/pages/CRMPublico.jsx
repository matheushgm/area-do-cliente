import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  KanbanSquare, Plus, X, Check, Trash2, Edit2,
  Phone, Mail, ChevronDown, Loader2,
} from 'lucide-react'

// ─── Constants (duplicated from CRMModule — standalone page, no shared import) ─

const CATEGORIES = [
  { id: 'lead_novo',    label: 'Lead Novo',        color: '#2563EB', bgClass: 'bg-blue-100',   textClass: 'text-blue-700',   borderClass: 'border-blue-200'   },
  { id: 'conectado',    label: 'Lead Conectado',   color: '#0891B2', bgClass: 'bg-cyan-100',   textClass: 'text-cyan-700',   borderClass: 'border-cyan-200'   },
  { id: 'qualificado',  label: 'Lead Qualificado', color: '#7C3AED', bgClass: 'bg-purple-100', textClass: 'text-purple-700', borderClass: 'border-purple-200' },
  { id: 'oportunidade', label: 'Oportunidade',     color: '#B45309', bgClass: 'bg-amber-100',  textClass: 'text-amber-700',  borderClass: 'border-amber-200'  },
  { id: 'venda',        label: 'Venda',            color: '#16A34A', bgClass: 'bg-green-100',  textClass: 'text-green-700',  borderClass: 'border-green-200'  },
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
      className="group bg-white rounded-xl border border-gray-200 p-3 shadow-sm cursor-grab active:cursor-grabbing select-none"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-gray-800 leading-tight">{contact.nome}</p>
        <button
          onClick={() => onDelete(contact.id)}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-400 hover:text-red-500 transition-all shrink-0"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      {contact.valor > 0 && (
        <p className="text-xs font-bold text-green-600 mt-1">{fmtBRL(contact.valor)}</p>
      )}
      {contact.email && (
        <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-1 truncate">
          <Mail className="w-3 h-3 shrink-0" />{contact.email}
        </p>
      )}
      {contact.telefone && (
        <p className="text-[11px] text-gray-500 flex items-center gap-1 truncate">
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

  const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 placeholder-gray-400 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-200'

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-3 space-y-2 shadow-sm">
      <input autoFocus value={form.nome} onChange={(e) => set('nome', e.target.value)} placeholder="Nome *" className={inputClass} required />
      <input value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="Email" type="email" className={inputClass} />
      <input value={form.telefone} onChange={(e) => set('telefone', e.target.value)} placeholder="Telefone" className={inputClass} />
      <input value={form.valor} onChange={(e) => set('valor', e.target.value)} placeholder="Valor (R$)" className={inputClass} />
      <div className="flex gap-2">
        <button type="submit" className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-xs py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors">
          <Check className="w-3 h-3" /> Adicionar
        </button>
        <button type="button" onClick={onCancel} className="px-3 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors">
          <X className="w-3 h-3" />
        </button>
      </div>
    </form>
  )
}

// ─── Stage Modal ──────────────────────────────────────────────────────────────

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800">{initial ? 'Editar etapa' : 'Nova etapa'}</h3>
          <button type="button" onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nome da etapa</label>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-400" required />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Categoria</label>
          <div className="relative">
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm appearance-none pr-8 outline-none focus:border-purple-400">
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          <div className={`mt-2 flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg ${CAT_MAP[category].bgClass} ${CAT_MAP[category].textClass} border ${CAT_MAP[category].borderClass}`}>
            <span className="w-2 h-2 rounded-full" style={{ background: CAT_MAP[category].color }} />
            {CAT_MAP[category].label}
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="flex-1 bg-purple-600 text-white rounded-xl py-2 text-sm font-semibold hover:bg-purple-700 transition-colors">Salvar</button>
          <button type="button" onClick={onClose} className="px-4 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">Cancelar</button>
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
        over ? 'border-purple-400 bg-purple-50' : 'border-gray-200 bg-gray-50'
      }`}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onDrop(stage.id) }}
    >
      <div className="p-3 border-b border-gray-200">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: stage.color }} />
            <span className="text-sm font-bold text-gray-800 truncate">{stage.name}</span>
            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-white border border-gray-200 text-gray-500 shrink-0">{contacts.length}</span>
          </div>
          <div className="flex gap-1 shrink-0">
            <button onClick={() => onEditStage(stage)} className="p-1 rounded text-gray-400 hover:text-gray-700 transition-colors">
              <Edit2 className="w-3 h-3" />
            </button>
            <button onClick={() => onDeleteStage(stage.id)} className="p-1 rounded text-gray-400 hover:text-red-500 transition-colors">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
        <div className={`mt-1.5 text-[10px] px-2 py-0.5 rounded-full w-fit ${cat.bgClass} ${cat.textClass} border ${cat.borderClass}`}>
          {cat.label}
        </div>
        {total > 0 && <p className="text-[11px] font-semibold text-green-600 mt-1">{fmtBRL(total)}</p>}
      </div>

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
            className="w-full text-[11px] text-gray-400 hover:text-gray-700 border border-dashed border-gray-300 hover:border-purple-400 rounded-xl py-2 transition-all flex items-center justify-center gap-1"
          >
            <Plus className="w-3 h-3" /> Novo contato
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Public CRM Page ──────────────────────────────────────────────────────────

export default function CRMPublico() {
  const { token } = useParams()
  const [companyName, setCompanyName] = useState('')
  const [projectId,   setProjectId]   = useState(null)
  const [crm,         setCRM]         = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [notFound,    setNotFound]    = useState(false)
  const [draggingId,  setDraggingId]  = useState(null)
  const [stageModal,  setStageModal]  = useState(null)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('projects_v2')
        .select('id, company_name, crm_data')
        .eq('client_share_token', token)
        .single()

      if (error || !data) { setNotFound(true); setLoading(false); return }

      setProjectId(data.id)
      setCompanyName(data.company_name)
      setCRM(initCRM(data.crm_data))
      setLoading(false)
    }
    load()
  }, [token])

  const save = useCallback(async (next) => {
    setCRM(next)
    await supabase
      .from('projects_v2')
      .update({ crm_data: next })
      .eq('id', projectId)
  }, [projectId])

  function handleSaveStage(data) {
    if (stageModal && stageModal !== 'new') {
      save({ ...crm, stages: crm.stages.map((s) => s.id === stageModal.id ? { ...s, ...data } : s) })
    } else {
      save({ ...crm, stages: [...crm.stages, { id: crypto.randomUUID(), order: crm.stages.length, ...data }] })
    }
  }

  function handleDeleteStage(stageId) {
    if (!window.confirm('Excluir esta etapa? Os contatos dela também serão removidos.')) return
    save({ stages: crm.stages.filter((s) => s.id !== stageId), contacts: crm.contacts.filter((c) => c.stageId !== stageId) })
  }

  function handleAddContact(stageId, data) {
    save({ ...crm, contacts: [...crm.contacts, { ...data, stageId }] })
  }

  function handleDeleteContact(contactId) {
    save({ ...crm, contacts: crm.contacts.filter((c) => c.id !== contactId) })
  }

  function handleDrop(targetStageId) {
    if (!draggingId) return
    save({ ...crm, contacts: crm.contacts.map((c) => c.id === draggingId ? { ...c, stageId: targetStageId } : c) })
    setDraggingId(null)
  }

  const metrics = CATEGORIES.map((cat) => {
    const stageIds = crm?.stages.filter((s) => s.category === cat.id).map((s) => s.id) || []
    const contacts = crm?.contacts.filter((c) => stageIds.includes(c.stageId)) || []
    return { cat, count: contacts.length, valor: contacts.reduce((s, c) => s + (c.valor || 0), 0) }
  })

  const sortedStages = crm ? [...crm.stages].sort((a, b) => a.order - b.order) : []

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3">
        <KanbanSquare className="w-12 h-12 text-gray-300" />
        <p className="text-gray-500 font-medium">CRM não encontrado.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50" onDragEnd={() => setDraggingId(null)}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center">
          <KanbanSquare className="w-4 h-4 text-purple-600" />
        </div>
        <div>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">CRM</p>
          <h1 className="text-base font-bold text-gray-800">{companyName}</h1>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        {/* Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {metrics.map(({ cat, count, valor }) => (
            <div key={cat.id} className={`bg-white rounded-2xl border p-4 ${cat.borderClass}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${cat.textClass}`}>{cat.label}</p>
              <p className={`text-3xl font-black mt-1 ${cat.textClass}`}>{count}</p>
              {valor > 0 && <p className="text-[11px] text-gray-400 mt-0.5">{fmtBRL(valor)}</p>}
            </div>
          ))}
        </div>

        {/* Kanban */}
        <div className="overflow-x-auto pb-4">
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
            <div className="flex items-start pt-1">
              <button
                onClick={() => setStageModal('new')}
                className="flex items-center gap-2 px-4 py-3 rounded-2xl border-2 border-dashed border-gray-300 text-gray-400 hover:border-purple-400 hover:text-purple-600 transition-all text-sm whitespace-nowrap"
              >
                <Plus className="w-4 h-4" /> Nova etapa
              </button>
            </div>
          </div>
        </div>
      </div>

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
