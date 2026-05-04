import { useEffect, useState } from 'react'

/**
 * Input de valor em R$ que mantém sincronia bi-direcional com a porcentagem do
 * pai. Quando o usuário digita, calcula `(valor / parentBudget) * 100` e
 * dispara `onChange(novoPct)`. O componente externo continua sendo a "fonte
 * da verdade" via `value` (que é derivado da porcentagem) e este input só
 * mantém o draft enquanto o usuário digita.
 */
export default function ValueInput({ value, parentBudget, onChange, className = '', disabled = false }) {
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)

  // Quando não está editando, sincroniza com o valor calculado do pai
  useEffect(() => {
    if (!editing) {
      setDraft(value > 0 ? value.toFixed(2) : '')
    }
  }, [value, editing])

  function handleChange(e) {
    const raw = e.target.value
    setDraft(raw)
    const num = parseFloat(raw.replace(',', '.'))
    if (isNaN(num) || !isFinite(num) || num < 0) return
    if (parentBudget <= 0) return
    const pct = Math.max(0, Math.min(100, (num / parentBudget) * 100))
    onChange(pct)
  }

  return (
    <div className={`relative ${className}`}>
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-rl-muted text-xs pointer-events-none">R$</span>
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        onFocus={() => setEditing(true)}
        onBlur={() => setEditing(false)}
        onChange={handleChange}
        disabled={disabled || parentBudget <= 0}
        className="input-field pl-8 pr-2 text-right w-full text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        placeholder="0,00"
      />
    </div>
  )
}
