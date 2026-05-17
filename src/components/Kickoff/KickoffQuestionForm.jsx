import { useMemo } from 'react'
import { Check } from 'lucide-react'
import MoneyInput from '../UI/MoneyInput'
import PercentInput from '../UI/PercentInput'

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

      {type === 'single'  && <SingleSelect question={question} options={options} value={value} onChange={onChange} />}
      {type === 'yesno'   && <YesNo        question={question} options={options} value={value} onChange={onChange} />}
      {type === 'scale'   && <Scale        options={options} value={value} onChange={onChange} />}
      {type === 'multi'   && <MultiSelect  options={options} value={value} onChange={onChange} />}
      {type === 'number'  && <NumberInput  value={value} onChange={onChange} placeholder="Ex: 30" />}
      {type === 'money'   && <MoneyInput   value={value} onChange={onChange} />}
      {type === 'percent' && <PercentInput value={value} onChange={onChange} unknownLabel={question.unknownLabel} showUnknownToggle />}
      {type === 'text'    && <TextInput    value={value} onChange={onChange} />}
    </div>
  )
}

// ─── Inputs ──────────────────────────────────────────────────────────────────

// SingleSelect: botões empilhados. Suporta `askDescription` + `descriptionWhen`
// (lista de valores que disparam a caixa de descrição inline). Quando ativo,
// armazena o valor como objeto { value, description }.
function SingleSelect({ question = {}, options = [], value, onChange }) {
  const askDesc = !!question.askDescription
  const triggers = Array.isArray(question.descriptionWhen) ? question.descriptionWhen : []
  const isObj   = value && typeof value === 'object' && !Array.isArray(value)
  const current = isObj ? value.value : value
  const desc    = isObj ? (value.description || '') : ''
  const shouldShowDesc = askDesc && triggers.includes(current)

  function setValue(v) {
    if (askDesc) {
      // Mantém descrição se o novo valor também dispara; zera caso contrário
      const keep = triggers.includes(v)
      onChange({ value: v, description: keep ? desc : '' })
    } else {
      onChange(v)
    }
  }

  function setDesc(d) {
    onChange({ value: current, description: d })
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {options.map((opt) => {
          const selected = current === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setValue(opt.value)}
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

      {shouldShowDesc && (
        <div className="pt-1">
          <label className="text-xs font-semibold text-rl-subtle mb-1.5 block">
            {question.descriptionLabel || 'Descreva (opcional)'}
          </label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
            placeholder={question.descriptionPlaceholder || 'Detalhe a resposta...'}
            className="input-field w-full resize-none"
          />
        </div>
      )}
    </div>
  )
}

// YesNo: 2 botões + (opcional) descrição inline quando "Sim".
// Quando question.askDescription = true:
//  - Sem subQuestions: caixa de texto livre. Valor: { value, description }
//  - Com subQuestions:  inputs estruturados de %. Valor: { value, subAnswers }
// Sem askDescription continua string ('sim' | 'nao').
function YesNo({ question = {}, options = [], value, onChange }) {
  const askDesc = !!question.askDescription
  const subQs   = Array.isArray(question.subQuestions) ? question.subQuestions : null
  const isObj   = value && typeof value === 'object' && !Array.isArray(value)
  const current = isObj ? value.value : value
  const desc    = isObj ? (value.description || '') : ''
  const subAnswers = isObj && value.subAnswers && typeof value.subAnswers === 'object'
    ? value.subAnswers
    : {}

  function setValue(v) {
    if (askDesc) {
      // Mantém estado anterior se for "Sim"; zera em "Não"
      const keep = v === 'sim'
      onChange(subQs
        ? { value: v, subAnswers: keep ? subAnswers : {} }
        : { value: v, description: keep ? desc : '' }
      )
    } else {
      onChange(v)
    }
  }

  function setDesc(d) {
    onChange({ value: current || 'sim', description: d })
  }

  function setSubAnswer(subId, val) {
    onChange({
      value: current || 'sim',
      subAnswers: { ...subAnswers, [subId]: val },
    })
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {options.map((opt) => {
          const selected = current === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setValue(opt.value)}
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

      {askDesc && current === 'sim' && subQs && (
        <div className="pt-1">
          <label className="text-xs font-semibold text-rl-subtle mb-2 block">
            {question.descriptionLabel || 'Informe os valores'}
          </label>
          <div className="space-y-2">
            {subQs.map((sq) => (
              <SubPercentInput
                key={sq.id}
                label={sq.label}
                placeholder={sq.placeholder}
                value={subAnswers[sq.id]}
                onChange={(v) => setSubAnswer(sq.id, v)}
              />
            ))}
          </div>
        </div>
      )}

      {askDesc && current === 'sim' && !subQs && (
        <div className="pt-1">
          <label className="text-xs font-semibold text-rl-subtle mb-1.5 block">
            {question.descriptionLabel || 'Descreva (opcional)'}
          </label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
            placeholder={question.descriptionPlaceholder || 'Detalhe a resposta...'}
            className="input-field w-full resize-none"
          />
        </div>
      )}
    </div>
  )
}

// SubPercentInput: input compacto de % com botão "Não sei" inline. Usado
// dentro do YesNo quando a pergunta tem subQuestions estruturadas.
function SubPercentInput({ label, value, onChange, placeholder }) {
  const isUnknown = value === 'unknown'
  const displayValue = isUnknown || value == null || value === '' ? '' : String(value)

  function handleNumberChange(e) {
    const raw = e.target.value
    const cleaned = raw.replace(/[^0-9.,]/g, '').replace(',', '.')
    if (cleaned === '') { onChange(''); return }
    const n = Number(cleaned)
    if (!isNaN(n) && n >= 0 && n <= 100) onChange(n)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <label className="text-sm font-semibold text-rl-text min-w-[120px]">
        {label}
      </label>
      <div className="relative flex-1 min-w-[120px] max-w-[160px]">
        <input
          type="text"
          inputMode="decimal"
          value={displayValue}
          onChange={handleNumberChange}
          placeholder={placeholder}
          disabled={isUnknown}
          className={`input-field w-full pr-7 text-sm ${isUnknown ? 'opacity-40 cursor-not-allowed' : ''}`}
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-rl-muted font-bold pointer-events-none">
          %
        </span>
      </div>
      <button
        type="button"
        onClick={() => onChange(isUnknown ? '' : 'unknown')}
        className={`text-xs px-2.5 py-1.5 rounded-lg border font-semibold transition-all flex items-center gap-1 ${
          isUnknown
            ? 'bg-rl-purple/10 border-rl-purple/50 text-rl-purple'
            : 'bg-rl-surface border-rl-border text-rl-muted hover:border-rl-purple/30 hover:text-rl-text'
        }`}
      >
        {isUnknown && <Check className="w-3 h-3" />}
        Não sei
      </button>
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
