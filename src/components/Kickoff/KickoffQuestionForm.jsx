import { useMemo, useState } from 'react'
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
      {type === 'percent' && <PercentInput value={value} onChange={onChange} unknownLabel={question.unknownLabel} />}
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

// MoneyInput: estado local de texto pra digitação livre. Só reformata no blur.
// O parent recebe o número parseado em todas as keystrokes (pro score), mas o
// que aparece no campo é exatamente o que o user digitou — sem cursor "pulando"
// nem reformatação no meio da digitação.
function MoneyInput({ value, onChange }) {
  const initial = value !== '' && value != null && Number(value) > 0
    ? fmtMoney(Number(value))
    : ''
  const [text, setText] = useState(initial)

  function handleChange(e) {
    const raw = e.target.value
    setText(raw)
    onChange(parseMoney(raw))
  }

  function handleBlur() {
    if (!text.trim()) { onChange(''); return }
    const n = parseMoney(text)
    if (n > 0) {
      setText(fmtMoney(n))
      onChange(n)
    } else {
      setText('')
      onChange('')
    }
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder="R$ 0,00"
      className="input-field w-full max-w-xs"
    />
  )
}

// PercentInput: input numérico em % OU botão "Não sei calcular".
// Valor armazenado: number (0-100), '' (vazio), ou 'unknown' (não sei).
function PercentInput({ value, onChange, unknownLabel = 'Não sei calcular' }) {
  const isUnknown = value === 'unknown'
  const displayValue = isUnknown || value == null || value === '' ? '' : String(value)

  function handleNumberChange(e) {
    const raw = e.target.value
    // Aceita só dígitos e vírgula/ponto; converte vírgula em ponto pra Number()
    const cleaned = raw.replace(/[^0-9.,]/g, '').replace(',', '.')
    if (cleaned === '') { onChange(''); return }
    const n = Number(cleaned)
    if (!isNaN(n) && n >= 0 && n <= 100) onChange(n)
  }

  return (
    <div className="space-y-2 max-w-xs">
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleNumberChange}
          placeholder="Ex: 45"
          disabled={isUnknown}
          className={`input-field w-full pr-10 ${isUnknown ? 'opacity-40 cursor-not-allowed' : ''}`}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-rl-muted font-bold pointer-events-none">
          %
        </span>
      </div>
      <button
        type="button"
        onClick={() => onChange(isUnknown ? '' : 'unknown')}
        className={`w-full px-3 py-2 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
          isUnknown
            ? 'bg-rl-purple/10 border-rl-purple/50 text-rl-purple'
            : 'bg-rl-surface border-rl-border text-rl-muted hover:border-rl-purple/30 hover:text-rl-text'
        }`}
      >
        {isUnknown && <Check className="w-3 h-3" />}
        {unknownLabel}
      </button>
    </div>
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
