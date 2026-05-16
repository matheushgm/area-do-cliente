import { useMemo } from 'react'
import { Check } from 'lucide-react'
import { fmtMoney, parseMoney } from '../Resultados/resultadosHelpers'

// Renderiza o input de UMA pergunta, despachando pelo `type`.
// - value/onChange: estado controlado pelo orquestrador (KickoffModule).
// - Mantém apenas a estética; lógica de score fica no KickoffScorer.
export default function KickoffQuestionForm({ question, value, onChange }) {
  if (!question) return null
  const { type, label, hint, options } = question

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-rl-text leading-snug">{label}</h3>
        {hint && <p className="text-xs text-rl-muted mt-1">{hint}</p>}
      </div>

      {type === 'single'  && <SingleSelect options={options} value={value} onChange={onChange} />}
      {type === 'yesno'   && <YesNo        options={options} value={value} onChange={onChange} />}
      {type === 'scale'   && <Scale        options={options} value={value} onChange={onChange} />}
      {type === 'multi'   && <MultiSelect  options={options} value={value} onChange={onChange} />}
      {type === 'number'  && <NumberInput  value={value} onChange={onChange} placeholder="Ex: 30" />}
      {type === 'money'   && <MoneyInput   value={value} onChange={onChange} />}
      {type === 'text'    && <TextInput    value={value} onChange={onChange} />}
    </div>
  )
}

// ─── Inputs ──────────────────────────────────────────────────────────────────

function SingleSelect({ options = [], value, onChange }) {
  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center gap-3 ${
              selected
                ? 'bg-rl-purple/10 border-rl-purple/50 text-rl-purple shadow-glow'
                : 'bg-rl-surface border-rl-border text-rl-text hover:border-rl-purple/30 hover:bg-rl-surface/80'
            }`}
          >
            <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
              selected ? 'border-rl-purple bg-rl-purple' : 'border-rl-border'
            }`}>
              {selected && <Check className="w-2.5 h-2.5 text-white" />}
            </div>
            <span className="text-sm">{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function YesNo({ options = [], value, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-4 py-4 rounded-xl border text-sm font-semibold transition-all ${
              selected
                ? 'bg-rl-purple/10 border-rl-purple/50 text-rl-purple shadow-glow'
                : 'bg-rl-surface border-rl-border text-rl-text hover:border-rl-purple/30'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function Scale({ options = [], value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      {options.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            title={opt.label}
            className={`flex-1 px-2 py-3 rounded-xl border text-sm font-bold transition-all ${
              selected
                ? 'bg-rl-purple/10 border-rl-purple/50 text-rl-purple shadow-glow'
                : 'bg-rl-surface border-rl-border text-rl-muted hover:text-rl-text hover:border-rl-purple/30'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function MultiSelect({ options = [], value, onChange }) {
  const set = useMemo(() => new Set(Array.isArray(value) ? value : []), [value])
  const toggle = (v) => {
    const next = new Set(set)
    if (next.has(v)) next.delete(v); else next.add(v)
    onChange([...next])
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {options.map((opt) => {
        const selected = set.has(opt.value)
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={`text-left px-3 py-2.5 rounded-xl border text-sm transition-all flex items-center gap-2 ${
              selected
                ? 'bg-rl-purple/10 border-rl-purple/50 text-rl-purple'
                : 'bg-rl-surface border-rl-border text-rl-text hover:border-rl-purple/30'
            }`}
          >
            <div className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center ${
              selected ? 'border-rl-purple bg-rl-purple' : 'border-rl-border'
            }`}>
              {selected && <Check className="w-2.5 h-2.5 text-white" />}
            </div>
            <span>{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function NumberInput({ value, onChange, placeholder }) {
  return (
    <input
      type="number"
      min="0"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder || '0'}
      className="input-field w-full max-w-xs"
    />
  )
}

function MoneyInput({ value, onChange }) {
  const display = value !== '' && value != null ? fmtMoney(parseMoney(value)) : ''
  return (
    <input
      type="text"
      value={display === 'R$ 0' || display === 'R$0' || display === 'R$ 0,00' ? '' : display}
      onChange={(e) => onChange(parseMoney(e.target.value))}
      placeholder="R$ 0,00"
      className="input-field w-full max-w-xs"
    />
  )
}

function TextInput({ value, onChange }) {
  return (
    <textarea
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      rows={4}
      placeholder="Digite aqui..."
      className="input-field w-full resize-none"
    />
  )
}
