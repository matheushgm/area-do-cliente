import { Plus } from 'lucide-react'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { STAGE_META } from './campaignHelpers'
import PctInput from './PctInput'
import ValueInput from './ValueInput'
import ValueCell from './ValueCell'
import CampaignRow from './CampaignRow'

export default function StageSection({ stageKey, stage, derived, channelMonthly, daysLeft, onUpdateStage, onAddCampaign, onUpdateCampaign, onDeleteCampaign }) {
  const meta = STAGE_META[stageKey]
  const campSum = stage.campaigns.reduce((s, c) => s + (c.percentage || 0), 0)
  const campRemaining = 100 - campSum

  return (
    <div className={`rounded-xl border ${meta.borderClass} ${meta.bgClass} overflow-hidden`}>
      {/* Stage header */}
      <div className="flex items-center justify-between gap-2 flex-wrap px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${meta.colorClass}`}>{meta.label}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-[88px]">
            <PctInput value={stage.percentage} onChange={(v) => onUpdateStage({ percentage: v })} />
          </div>
          <div className="w-[140px]">
            <ValueInput
              value={derived.monthly}
              parentBudget={channelMonthly}
              onChange={(newPct) => onUpdateStage({ percentage: newPct })}
            />
          </div>
          <div className="hidden sm:flex items-center gap-4">
            <ValueCell label="Diário" value={derived.daily} />
          </div>
        </div>
      </div>

      {/* Campaigns — visible whenever stage has % set */}
      {stage.percentage > 0 && (
        <div className="px-4 pb-3 border-t border-current/10">
          {/* Campaign header + validation indicator */}
          <div className="flex items-center justify-between py-2 mb-1">
            <p className="text-[10px] text-rl-muted uppercase tracking-wider">Campanhas</p>
            {stage.campaigns.length > 0 && (
              <div className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                campRemaining === 0
                  ? 'bg-rl-green/10 border-rl-green/20 text-rl-green'
                  : 'bg-rl-gold/10 border-rl-gold/20 text-rl-gold'
              }`}>
                {campRemaining === 0
                  ? <><CheckCircle2 className="w-3 h-3" /> 100%</>
                  : <><AlertCircle className="w-3 h-3" /> Restante: {campRemaining}%</>
                }
              </div>
            )}
          </div>

          {/* Campaign rows */}
          <div>
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
          </div>

          {/* Add campaign */}
          <button
            onClick={onAddCampaign}
            className="mt-2 flex items-center gap-1.5 text-xs text-rl-muted hover:text-rl-text transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar campanha
          </button>
        </div>
      )}
    </div>
  )
}
