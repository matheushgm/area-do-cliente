import { ChevronDown, ChevronUp, Trash2, CheckCircle2, AlertCircle, Building2 } from 'lucide-react'
import { STAGE_KEYS, stageSum } from './campaignHelpers'
import PctInput from './PctInput'
import ValueInput from './ValueInput'
import ValueCell from './ValueCell'
import StageSection from './StageSection'

// ─────────────────────────────────────────────────────────────────────────────
// Conta de anúncio dentro de um canal. Só aparece em cliente que tem mais de
// uma conta no mesmo canal (ex.: Nacional Kart tem 3 contas no Google Ads):
// a verba do canal é repartida entre as contas e cada uma tem o funil dela.
// ─────────────────────────────────────────────────────────────────────────────

export default function AdAccountSection({
  account, derived, channelMonthly, daysLeft,
  onUpdate, onDelete, onUpdateStage, onAddCampaign, onUpdateCampaign, onDeleteCampaign,
}) {
  const sum   = stageSum(account.stages)
  const valid = sum === 100

  return (
    <div className="rounded-xl border border-rl-border bg-rl-surface/40 overflow-hidden">
      {/* Cabeçalho da conta */}
      <div className="flex items-center gap-2 flex-wrap px-3 py-2.5">
        <Building2 className="w-3.5 h-3.5 text-rl-muted shrink-0" />
        <input
          type="text"
          value={account.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Nome da conta de anúncio"
          className="input-field py-1.5 text-sm font-semibold flex-1 min-w-[140px]"
        />

        <div className="w-[88px] shrink-0">
          <PctInput value={account.percentage} onChange={(v) => onUpdate({ percentage: v })} />
        </div>

        <div className="w-[140px] shrink-0">
          <ValueInput
            value={derived.monthly}
            parentBudget={channelMonthly}
            onChange={(newPct) => onUpdate({ percentage: newPct })}
          />
        </div>

        <div className="hidden sm:flex items-center gap-4">
          <ValueCell label="Diário" value={derived.daily} />
        </div>

        <button
          onClick={() => onUpdate({ expanded: !account.expanded })}
          className="p-1.5 text-rl-muted hover:text-rl-text transition-colors shrink-0"
          title={account.expanded ? 'Recolher' : 'Expandir'}
        >
          {account.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        <button
          onClick={onDelete}
          className="p-1.5 text-rl-muted hover:text-red-400 transition-colors shrink-0"
          title="Remover conta deste canal"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Funil da conta */}
      {account.expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-rl-border/60 pt-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-rl-muted uppercase tracking-wider">
              Distribuição do Funil
            </p>
            <div className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
              valid
                ? 'bg-rl-green/10 border-rl-green/20 text-rl-green'
                : 'bg-rl-gold/10 border-rl-gold/20 text-rl-gold'
            }`}>
              {valid
                ? <><CheckCircle2 className="w-3 h-3" /> 100% distribuído</>
                : <><AlertCircle className="w-3 h-3" /> Restante: {100 - sum}%</>
              }
            </div>
          </div>

          {STAGE_KEYS.map((key) => (
            <StageSection
              key={key}
              stageKey={key}
              stage={account.stages[key]}
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
      )}
    </div>
  )
}
