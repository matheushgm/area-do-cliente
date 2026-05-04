import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { CHANNEL_OPTIONS, STAGE_KEYS, fmtBRL } from './campaignHelpers'
import PctInput from './PctInput'
import ValueInput from './ValueInput'
import ValueCell from './ValueCell'
import StageSection from './StageSection'

const META_TAX = 0.13

export default function ChannelRow({ channel, derived, daysLeft, validation, usedNames, budgetDisponivel, onUpdate, onDelete, onUpdateStage, onAddCampaign, onUpdateCampaign, onDeleteCampaign }) {
  const stageSum = STAGE_KEYS.reduce((s, k) => s + (channel.stages[k].percentage || 0), 0)
  const stageRemaining = 100 - stageSum
  const stageValid = stageSum === 100

  // Available channel options (not used by other channels, but include current)
  const availableOptions = CHANNEL_OPTIONS.filter(
    (opt) => opt === channel.name || !usedNames.includes(opt)
  )

  return (
    <div className="glass-card overflow-hidden">
      {/* Channel header */}
      <div className="flex items-center gap-2 flex-wrap px-4 py-3 bg-rl-surface/50">
        {/* Name select */}
        <select
          value={channel.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="input-field flex-1 min-w-[140px] text-sm font-semibold"
        >
          {availableOptions.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>

        {/* Percentage */}
        <div className="w-[88px] shrink-0">
          <PctInput value={channel.percentage} onChange={(v) => onUpdate({ percentage: v })} />
        </div>

        {/* Valor mensal — editável (back-calcula percentage do canal).
            Para Meta, edita-se o valor BRUTO (antes dos impostos), pois é
            esse que mapeia direto para a porcentagem do orçamento. */}
        <div className="w-[140px] shrink-0">
          <ValueInput
            value={derived.monthlyBruto}
            parentBudget={budgetDisponivel}
            onChange={(newPct) => onUpdate({ percentage: newPct })}
          />
        </div>

        {/* Derived values — só Meta (líquido) e Diário ficam read-only */}
        <div className="hidden sm:flex items-center gap-4">
          {derived.isMeta && (
            <div className="text-right">
              <p className="text-[10px] text-rl-muted leading-tight">Líquido</p>
              <p className="text-sm font-bold text-rl-text">{fmtBRL(derived.monthly)}</p>
              <p className="text-[10px] text-rl-gold">−13% impostos</p>
            </div>
          )}
          <ValueCell label="Diário" value={derived.daily} />
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => onUpdate({ expanded: !channel.expanded })}
          className="p-1.5 text-rl-muted hover:text-rl-text transition-colors shrink-0"
          title={channel.expanded ? 'Recolher' : 'Expandir'}
        >
          {channel.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {/* Delete */}
        <button
          onClick={onDelete}
          className="p-1.5 text-rl-muted hover:text-red-400 transition-colors shrink-0"
          title="Remover canal"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Expanded body */}
      {channel.expanded && (
        <div className="p-4 space-y-3">
          {/* Funnel distribution header */}
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-rl-muted uppercase tracking-wider">
              Distribuição do Funil
            </p>
            <div className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
              stageValid
                ? 'bg-rl-green/10 border-rl-green/20 text-rl-green'
                : 'bg-rl-gold/10 border-rl-gold/20 text-rl-gold'
            }`}>
              {stageValid
                ? <><CheckCircle2 className="w-3 h-3" /> 100% distribuído</>
                : <><AlertCircle className="w-3 h-3" /> Restante: {stageRemaining}%</>
              }
            </div>
          </div>

          {/* Stage rows */}
          <div className="space-y-2">
            {STAGE_KEYS.map((key) => (
              <StageSection
                key={key}
                stageKey={key}
                stage={channel.stages[key]}
                derived={derived.stages[key]}
                channelMonthly={derived.monthly}
                daysLeft={daysLeft}
                onUpdateStage={(patch) => onUpdateStage(key, patch)}
                onAddCampaign={() => onAddCampaign(key)}
                onUpdateCampaign={(campId, patch) => onUpdateCampaign(key, campId, patch)}
                onDeleteCampaign={(campId) => onDeleteCampaign(key, campId)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
