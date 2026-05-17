import { Check } from 'lucide-react'

// PercentInput: input numérico em % (0-100) com sufixo visual `%`.
// Opcionalmente mostra um botão "Não sei calcular" que marca o valor como
// `'unknown'` — útil em diagnósticos onde "não sei" precisa ser uma resposta
// explícita (ex: Kickoff). Em calculadoras determinísticas (ex: Precificação)
// passe `showUnknownToggle={false}` ou simplesmente omita.
//
// Extraído de src/components/Kickoff/KickoffQuestionForm.jsx.
export default function PercentInput({
  value,
  onChange,
  placeholder = 'Ex: 45',
  unknownLabel = 'Não sei calcular',
  showUnknownToggle = false,
  maxWidth = 'max-w-xs',
  max = 100,
}) {
  const isUnknown = value === 'unknown'
  const displayValue = isUnknown || value == null || value === '' ? '' : String(value)

  function handleNumberChange(e) {
    const raw = e.target.value
    const cleaned = raw.replace(/[^0-9.,]/g, '').replace(',', '.')
    if (cleaned === '') { onChange(''); return }
    const n = Number(cleaned)
    if (!isNaN(n) && n >= 0 && n <= max) onChange(n)
  }

  return (
    <div className={`space-y-2 w-full ${maxWidth}`}>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleNumberChange}
          placeholder={placeholder}
          disabled={isUnknown}
          className={`input-field w-full pr-10 ${isUnknown ? 'opacity-40 cursor-not-allowed' : ''}`}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-rl-muted font-bold pointer-events-none">
          %
        </span>
      </div>
      {showUnknownToggle && (
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
      )}
    </div>
  )
}
