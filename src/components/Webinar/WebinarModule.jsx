import { useMemo, useState } from 'react'
import {
  Presentation, Plus, Trash2, Pencil, ChevronLeft, ChevronRight,
  AlertTriangle,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../hooks/useToast'
import Toast from '../UI/Toast'
import { ETAPAS, ABERTURA_BLOCOS, blankWebinar, aberturaProgress } from './webinarData'

export default function WebinarModule({ project }) {
  const { updateProject } = useApp()
  const { toast, showToast } = useToast()

  const webinars = useMemo(
    () => (Array.isArray(project.webinars) ? project.webinars : []),
    [project.webinars]
  )
  const [editingId, setEditingId] = useState(null)
  const [activeEtapa, setActiveEtapa] = useState('abertura')
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')

  const editing = webinars.find((w) => w.id === editingId) || null

  function persist(next) {
    updateProject(project.id, { webinars: next })
  }

  function createWebinar() {
    const wb = blankWebinar(`Webinar ${webinars.length + 1}`)
    persist([...webinars, wb])
    setEditingId(wb.id)
    setActiveEtapa('abertura')
    showToast('Webinar criado!')
  }

  function deleteWebinar(id) {
    if (!window.confirm('Excluir este webinar? Essa ação não pode ser desfeita.')) return
    persist(webinars.filter((w) => w.id !== id))
    if (editingId === id) setEditingId(null)
    showToast('Webinar excluído.')
  }

  function commitRename(id) {
    const nome = renameValue.trim()
    if (nome) {
      persist(webinars.map((w) => (w.id === id ? { ...w, nome, updatedAt: new Date().toISOString() } : w)))
    }
    setRenamingId(null)
    setRenameValue('')
  }

  function updateField(etapaId, field, value) {
    persist(webinars.map((w) => {
      if (w.id !== editingId) return w
      const etapas = w.etapas || {}
      return {
        ...w,
        updatedAt: new Date().toISOString(),
        etapas: { ...etapas, [etapaId]: { ...(etapas[etapaId] || {}), [field]: value } },
      }
    }))
  }

  // ── Editor de um webinar ───────────────────────────────────────────────────
  if (editing) {
    const etapaMeta = ETAPAS.find((e) => e.id === activeEtapa) || ETAPAS[0]
    const etapaData = editing.etapas?.[activeEtapa] || {}
    return (
      <div className="space-y-5">
        {/* Header do editor */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setEditingId(null)}
            className="flex items-center gap-1 text-xs text-rl-muted hover:text-rl-text transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Meus webinars
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <Presentation className="w-4 h-4 text-rl-purple" />
            <h2 className="text-base font-black text-rl-text">{editing.nome}</h2>
          </div>
        </div>

        {/* Navegação de etapas */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {ETAPAS.map((e) => {
            const active = activeEtapa === e.id
            return (
              <button
                key={e.id}
                onClick={() => setActiveEtapa(e.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                  active
                    ? 'bg-rl-purple text-white border-rl-purple shadow-glow'
                    : 'bg-rl-surface border-rl-border text-rl-muted hover:text-rl-text hover:border-rl-purple/30'
                }`}
              >
                <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black ${
                  active ? 'bg-white/20' : 'bg-rl-purple/10 text-rl-purple'
                }`}>
                  {e.num}
                </span>
                {e.label}
              </button>
            )
          })}
        </div>

        {/* Conteúdo da etapa */}
        {etapaMeta.built ? (
          <AberturaForm data={etapaData} onChange={(field, val) => updateField('abertura', field, val)} />
        ) : (
          <div className="glass-card p-10 text-center">
            <div className="text-4xl mb-3">{etapaMeta.emoji}</div>
            <h3 className="text-base font-bold text-rl-text">Etapa &ldquo;{etapaMeta.label}&rdquo;</h3>
            <p className="text-sm text-rl-muted mt-1 max-w-md mx-auto">
              Esta etapa ainda está em construção. Em breve você poderá preencher os blocos dela aqui.
            </p>
          </div>
        )}

        <Toast toast={toast} />
      </div>
    )
  }

  // ── Lista de webinars ──────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="w-11 h-11 rounded-xl bg-rl-purple/10 flex items-center justify-center shrink-0">
          <Presentation className="w-5 h-5 text-rl-purple" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-black text-rl-text leading-tight">Criação de Webinar</h2>
          <p className="text-sm text-rl-subtle mt-0.5 max-w-2xl">
            Construa webinars de conversão etapa por etapa. Cada webinar tem Abertura, História,
            Conteúdo e Ofertas. Você pode criar quantos webinars quiser.
          </p>
        </div>
        <button
          onClick={createWebinar}
          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-rl-purple text-white shadow-glow hover:bg-rl-purple/90 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" /> Novo webinar
        </button>
      </div>

      {webinars.length === 0 ? (
        <div className="rounded-xl border border-dashed border-rl-border bg-rl-surface/30 py-12 px-6 text-center space-y-3">
          <Presentation className="w-9 h-9 text-rl-muted/40 mx-auto" />
          <div>
            <p className="text-sm font-semibold text-rl-text">Nenhum webinar criado ainda.</p>
            <p className="text-xs text-rl-muted mt-1">Crie o primeiro pra começar a preencher as etapas.</p>
          </div>
          <button
            onClick={createWebinar}
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-rl-purple text-white shadow-glow hover:bg-rl-purple/90 transition-all"
          >
            <Plus className="w-4 h-4" /> Criar primeiro webinar
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {webinars.map((w) => {
            const prog = aberturaProgress(w.etapas?.abertura || {})
            const isRenaming = renamingId === w.id
            return (
              <div key={w.id} className="glass-card p-4 group">
                <div className="flex items-start justify-between gap-2">
                  {isRenaming ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => commitRename(w.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitRename(w.id) }}
                      className="input-field text-sm font-bold flex-1"
                    />
                  ) : (
                    <button
                      onClick={() => { setEditingId(w.id); setActiveEtapa('abertura') }}
                      className="text-left flex-1 min-w-0"
                    >
                      <h3 className="text-sm font-bold text-rl-text truncate group-hover:text-rl-purple transition-colors">{w.nome}</h3>
                    </button>
                  )}
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => { setRenamingId(w.id); setRenameValue(w.nome) }}
                      className="p-1.5 rounded-lg text-rl-muted hover:text-rl-purple hover:bg-rl-purple/10 transition-all"
                      title="Renomear"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteWebinar(w.id)}
                      className="p-1.5 rounded-lg text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition-all"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] text-rl-muted mb-1">
                    <span>Abertura</span>
                    <span className="font-bold">{prog.percent}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-rl-surface overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-rl-purple to-rl-cyan transition-all" style={{ width: `${prog.percent}%` }} />
                  </div>
                </div>

                <button
                  onClick={() => { setEditingId(w.id); setActiveEtapa('abertura') }}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-purple hover:border-rl-purple/30 transition-all"
                >
                  Abrir webinar <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      <Toast toast={toast} />
    </div>
  )
}

// ─── Form da Abertura (render genérico a partir de ABERTURA_BLOCOS) ───────────
function AberturaForm({ data, onChange }) {
  return (
    <div className="space-y-4">
      {ABERTURA_BLOCOS.map((bloco) => (
        <div key={bloco.id} className="glass-card p-5 space-y-4">
          <div>
            <h3 className="text-sm font-black text-rl-text uppercase tracking-wide">{bloco.title}</h3>
            {bloco.subtitle && <p className="text-xs text-rl-muted mt-0.5">{bloco.subtitle}</p>}
          </div>

          {bloco.helper && (
            <div className="rounded-xl bg-rl-purple/5 border border-rl-purple/20 p-3 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rl-purple">Use as fórmulas</p>
              {bloco.helper.map((h, i) => (
                <p key={i} className="text-[11px] text-rl-subtle">• {h}</p>
              ))}
            </div>
          )}

          {bloco.fields.map((f) => (
            <FieldRenderer key={f.id} field={f} data={data} onChange={onChange} />
          ))}
        </div>
      ))}
    </div>
  )
}

function FieldRenderer({ field, data, onChange }) {
  const f = field

  if (f.type === 'alert') {
    return (
      <div className="flex items-start gap-2 p-3 rounded-xl bg-rl-gold/5 border border-rl-gold/30">
        <AlertTriangle className="w-4 h-4 text-rl-gold mt-0.5 shrink-0" />
        <p className="text-xs text-rl-text leading-snug">{f.text}</p>
      </div>
    )
  }

  if (f.type === 'preview') {
    const val = f.compute(data || {})
    return (
      <div className="rounded-xl bg-rl-purple/5 border-2 border-rl-purple/30 p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-rl-purple mb-1">{f.label}</p>
        <p className="text-base font-bold text-rl-text leading-snug">{val}</p>
      </div>
    )
  }

  if (f.type === 'choice') {
    return (
      <div>
        <label className="text-xs font-bold text-rl-text block mb-1">{f.label}</label>
        {f.example && <p className="text-[11px] text-rl-muted mb-2 italic">Exemplo: {f.example}</p>}
        <div className="space-y-2">
          {f.options.map((opt) => (
            <div key={opt.id}>
              <label className="text-[11px] font-semibold text-rl-subtle block mb-1">{opt.label}</label>
              <input
                type="text"
                value={data?.[opt.id] || ''}
                onChange={(e) => onChange(opt.id, e.target.value)}
                className="input-field w-full text-sm"
              />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // text / area
  return (
    <div>
      <label className="text-xs font-bold text-rl-text block mb-1">{f.label}</label>
      {f.example && <p className="text-[11px] text-rl-muted mb-1.5 italic">Exemplo: {f.example}</p>}
      <div className={f.prefix ? 'flex items-start gap-2' : ''}>
        {f.prefix && (
          <span className="mt-2.5 text-xs font-bold text-rl-purple shrink-0 whitespace-nowrap">{f.prefix}</span>
        )}
        {f.type === 'area' ? (
          <textarea
            value={data?.[f.id] || ''}
            onChange={(e) => onChange(f.id, e.target.value)}
            rows={2}
            className="input-field w-full text-sm resize-y"
          />
        ) : (
          <input
            type="text"
            value={data?.[f.id] || ''}
            onChange={(e) => onChange(f.id, e.target.value)}
            className="input-field w-full text-sm"
          />
        )}
      </div>
    </div>
  )
}
