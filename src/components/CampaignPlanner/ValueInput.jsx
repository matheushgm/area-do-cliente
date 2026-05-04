import { useEffect, useState } from 'react'

const fmtBR = (n) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Input de valor em R$ que mantém sincronia bi-direcional com a porcentagem do
 * pai. Quando o usuário digita, calcula `(valor / parentBudget) * 100` e
 * dispara `onChange(novoPct)`. Ao perder o foco, formata o número no padrão
 * pt-BR (`3.836,70`); ao focar, mostra o valor sem máscara para edição.
 */
export default function ValueInput({ value, parentBudget, onChange, className = '', disabled = false }) {
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)

  // Quando não está editando, sincroniza com o valor calculado do pai (formatado BR)
  useEffect(() => {
    if (!editing) {
      setDraft(value > 0 ? fmtBR(value) : '')
    }
  }, [value, editing])

  function handleChange(e) {
    const raw = e.target.value
    setDraft(raw)
    // Aceita "1.234,56" (BR) e "1234.56" (numérico) — remove pontos de milhar e troca vírgula por ponto
    const cleaned = raw.replace(/\./g, '').replace(',', '.')
    const num = parseFloat(cleaned)
    if (isNaN(num) || !isFinite(num) || num < 0) return
    if (parentBudget <= 0) return
    const pct = Math.max(0, Math.min(100, (num / parentBudget) * 100))
    onChange(pct)
  }

  function handleFocus(e) {
    setEditing(true)
    // Ao focar, mostra valor sem máscara (mais fácil de editar)
    if (value > 0) {
      const plain = value.toFixed(2).replace('.', ',')
      setDraft(plain)
      // Selecionar tudo facilita substituição
      requestAnimationFrame(() => e.target?.select())
    }
  }

  return (
    <div className={`relative ${className}`}>
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-rl-muted text-[11px] font-semibold pointer-events-none">R$</span>
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        onFocus={handleFocus}
        onBlur={() => setEditing(false)}
        onChange={handleChange}
        disabled={disabled || parentBudget <= 0}
        className="input-field pl-9 pr-2.5 text-right w-full text-sm tabular-nums disabled:opacity-50 disabled:cursor-not-allowed"
        placeholder="0,00"
      />
    </div>
  )
}
