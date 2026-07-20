// ─────────────────────────────────────────────────────────────────────────────
// Building blocks de formulário do Mecanismo Único.
// Extraídos de MecanismoUnicoModule para serem usados também pelo wizard
// guiado (MecanismoWizard) e pela página pública /mecanismo/:token.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { Plus, X } from 'lucide-react'

export function Label({ children }) {
  return (
    <p className="text-[11px] uppercase tracking-wider font-bold text-rl-text mb-1">
      {children}
    </p>
  )
}

export function Field({ label, children }) {
  return (
    <div>
      <p className="text-[11px] font-bold text-rl-text mb-1">{label}</p>
      {children}
    </div>
  )
}

// Lista dinâmica de strings simples (adicionar / remover)
export function DynamicStringList({ title, hint, placeholder, items = [], onChange }) {
  const [draft, setDraft] = useState('')

  function add() {
    const t = draft.trim()
    if (!t) return
    onChange([...(items || []), t])
    setDraft('')
  }

  function remove(i) {
    const next = [...items]
    next.splice(i, 1)
    onChange(next)
  }

  return (
    <div>
      <Label>{title}</Label>
      {hint && <p className="text-[11px] text-rl-muted mb-2">{hint}</p>}
      <div className="space-y-1.5">
        {(items || []).map((it, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rl-surface/60 border border-rl-border">
            <span className="text-sm text-rl-text flex-1">{it}</span>
            <button
              type="button"
              onClick={() => remove(i)}
              className="p-1 text-rl-muted hover:text-red-400 transition-colors"
              aria-label="Remover"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
            placeholder={placeholder}
            className="input-field flex-1"
          />
          <button
            type="button"
            onClick={add}
            disabled={!draft.trim()}
            className="flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg bg-rl-purple text-white hover:bg-rl-purple/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar
          </button>
        </div>
      </div>
    </div>
  )
}

// Tabela dinâmica: cada row tem N colunas. Add row / remove row.
export function DynamicTable({ title, hint, columns = [], rows = [], onChange }) {
  function add() {
    const empty = Object.fromEntries(columns.map((c) => [c.id, '']))
    onChange([...(rows || []), { id: crypto.randomUUID(), ...empty }])
  }

  function update(idx, colId, val) {
    const next = [...rows]
    next[idx] = { ...next[idx], [colId]: val }
    onChange(next)
  }

  function remove(idx) {
    const next = [...rows]
    next.splice(idx, 1)
    onChange(next)
  }

  return (
    <div>
      <Label>{title}</Label>
      {hint && <p className="text-[11px] text-rl-muted mb-2">{hint}</p>}
      <div className="space-y-2">
        {(rows || []).map((row, i) => (
          <div key={row.id || i} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr)) auto` }}>
            {columns.map((c) => (
              <input
                key={c.id}
                type="text"
                value={row[c.id] || ''}
                onChange={(e) => update(i, c.id, e.target.value)}
                placeholder={c.placeholder || c.label}
                className="input-field w-full"
              />
            ))}
            <button
              type="button"
              onClick={() => remove(i)}
              className="p-2 rounded-lg text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition-all"
              aria-label="Remover linha"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-dashed border-rl-border text-rl-muted hover:text-rl-purple hover:border-rl-purple/40 transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> Adicionar linha
        </button>
      </div>
    </div>
  )
}
