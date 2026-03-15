import { Trash2 } from 'lucide-react'
import { fmtBRL } from './campaignHelpers'
import PctInput from './PctInput'
import ValueCell from './ValueCell'

export default function CampaignRow({ campaign, stageMonthly, daysLeft, onUpdate, onDelete }) {
  const monthly = stageMonthly * (campaign.percentage / 100)
  const daily   = monthly / daysLeft

  return (
    <div className="flex items-center gap-2 py-2 border-b border-rl-border/50 last:border-0">
      {/* Name */}
      <input
        type="text"
        placeholder="Nome da campanha"
        value={campaign.name}
        onChange={(e) => onUpdate({ name: e.target.value })}
        className="input-field flex-1 text-sm"
      />
      {/* Percentage */}
      <div className="w-20 relative shrink-0">
        <PctInput value={campaign.percentage} onChange={(v) => onUpdate({ percentage: v })} />
      </div>
      {/* Derived values */}
      <div className="hidden sm:flex items-center gap-4">
        <ValueCell label="Mensal" value={monthly} />
        <ValueCell label="Diário"  value={daily}   />
      </div>
      {/* Delete */}
      <button
        onClick={onDelete}
        className="p-1.5 text-rl-muted hover:text-red-400 transition-colors shrink-0"
        title="Remover campanha"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
