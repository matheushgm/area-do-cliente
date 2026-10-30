import { Plus } from 'lucide-react'
import { STAGE_META, fmtBRL, FUNNEL_GRID, FUNNEL_NAME } from './campaignHelpers'
import PctInput from './PctInput'
import ValueInput from './ValueInput'
import CampaignRow from './CampaignRow'

// Uma etapa do funil dentro da FunnelTable: a linha da etapa (bolinha da cor,
// %, valor, por dia) e as campanhas dela recuadas logo abaixo. Etapa zerada e
// sem campanha fica apagada, para o olho ir direto no que tem verba.
export default function StageSection({ stageKey, stage, derived, channelMonthly, daysLeft, onUpdateStage, onAddCampaign, onUpdateCampaign, onDeleteCampaign }) {
  const meta = STAGE_META[stageKey]
  const campSum = stage.campaigns.reduce((s, c) => s + (c.percentage || 0), 0)
  const campRemaining = Math.round((100 - campSum) * 100) / 100
  const vazia = !(stage.percentage > 0) && stage.campaigns.length === 0

  return (
    <div className={vazia ? 'opacity-60 hover:opacity-100 transition-opacity' : ''}>
      {/* Linha da etapa */}
      <div className={`${FUNNEL_GRID} px-2 py-2`}>
        <div className={`${FUNNEL_NAME} flex items-center gap-2 min-w-0`}>
          <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dotClass}`} />
          <span className={`text-sm font-semibold ${meta.colorClass}`}>{meta.label}</span>
          {stage.campaigns.length > 0 && campRemaining !== 0 && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-rl-gold/10 text-rl-gold border border-rl-gold/20 whitespace-nowrap">
              campanhas: falta {campRemaining}%
            </span>
          )}
        </div>
        <PctInput size="sm" value={stage.percentage} onChange={(v) => onUpdateStage({ percentage: v })} />
        <ValueInput
          size="sm"
          value={derived.monthly}
          parentBudget={channelMonthly}
          onChange={(newPct) => onUpdateStage({ percentage: newPct })}
        />
        <span className="hidden sm:block text-right text-sm font-semibold text-rl-text tabular-nums">{fmtBRL(derived.daily)}</span>
        <span />
      </div>

      {/* Campanhas da etapa (só quando a etapa tem verba ou já tem campanha) */}
      {(stage.percentage > 0 || stage.campaigns.length > 0) && (
        <div className="pb-2">
          {derived.campaigns.map((camp) => (
            <CampaignRow
              key={camp.id}
              campaign={camp}
              stageMonthly={derived.monthly}
              daysLeft={daysLeft}
              onUpdate={(patch) => onUpdateCampaign(camp.id, patch)}
              onDelete={() => onDeleteCampaign(camp.id)}
            />
          ))}
          <button
            onClick={onAddCampaign}
            className="ml-6 mt-1 flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Campanha em {meta.short}
          </button>
        </div>
      )}
    </div>
  )
}
