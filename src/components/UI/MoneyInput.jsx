import { useState } from 'react'
import { fmtMoney, parseMoney } from '../Resultados/resultadosHelpers'

// MoneyInput: estado local de texto pra digitação livre. Só reformata no blur.
// O parent recebe o número parseado em todas as keystrokes (pro score/cálculo),
// mas o que aparece no campo é exatamente o que o user digitou — sem cursor
// "pulando" nem reformatação no meio da digitação.
//
// Extraído de src/components/Kickoff/KickoffQuestionForm.jsx pra ser reusado
// por outras ferramentas (Precificação, etc.).
export default function MoneyInput({
  value,
  onChange,
  placeholder = 'R$ 0,00',
  className = '',
  maxWidth = 'max-w-xs',
}) {
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
      placeholder={placeholder}
      className={`input-field w-full ${maxWidth} ${className}`}
    />
  )
}
