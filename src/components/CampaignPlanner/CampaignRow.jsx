import { useState } from 'react'
import { CalendarDays, Trash2, X } from 'lucide-react'
import { formatCampaignPeriod, getDaysBetween } from './campaignHelpers'
import PctInput from './PctInput'
import ValueInput from './ValueInput'
import ValueCell from './ValueCell'

export default function CampaignRow({ campaign, stageMonthly, daysLeft, onUpdate, onDelete }) {
  const monthly = stageMonthly * (campaign.percentage / 100)
  const hasOwnPeriod = !!(campaign.startDate && campaign.endDate)
  const ownDays = hasOwnPeriod ? getDaysBetween(campaign.startDate, campaign.endDate) : null
  const daily = hasOwnPeriod ? monthly / ownDays : monthly / daysLeft
  const periodLabel = formatCampaignPeriod(campaign.startDate, campaign.endDate)

  const [datesOpen, setDatesOpen] = useState(hasOwnPeriod)

  function toggleDates() {
    if (datesOpen && hasOwnPeriod) {
      // Fechar e limpar as datas (campanha volta ao período global)
      onUpdate({ startDate: null, endDate: null })
    }
    setDatesOpen((v) => !v)
  }

  return (
    <div className="py-2 border-b border-rl-border/50 last:border-0">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Name */}
        <input
          type="text"
          placeholder="Nome da campanha"
          value={campaign.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="input-field flex-1 min-w-[150px] text-sm"
        />

        {/* Datas — toggle */}
        <button
          onClick={toggleDates}
          title={hasOwnPeriod ? `Período próprio: ${periodLabel}` : 'Definir período específico para esta campanha'}
          className={`p-1.5 rounded-lg border transition-all shrink-0 ${
            hasOwnPeriod
              ? 'bg-rl-purple/10 border-rl-purple/40 text-rl-purple'
              : 'border-rl-border text-rl-muted hover:text-rl-purple hover:border-rl-purple/30'
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5" />
        </button>

        {/* Percentage */}
        <div className="w-20 shrink-0">
          <PctInput value={campaign.percentage} onChange={(v) => onUpdate({ percentage: v })} />
        </div>

        {/* Valor mensal — editável (back-calcula percentage) */}
        <div className="w-28 shrink-0">
          <ValueInput
            value={monthly}
            parentBudget={stageMonthly}
            onChange={(newPct) => onUpdate({ percentage: newPct })}
          />
        </div>

        {/* Daily (read-only) */}
        <div className="hidden sm:flex items-center gap-4">
          <ValueCell label={hasOwnPeriod ? `Diário (${ownDays}d)` : 'Diário'} value={daily} />
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

      {/* Sub-row: datas próprias */}
      {datesOpen && (
        <div className="mt-2 ml-1 flex flex-wrap items-end gap-2 px-3 py-2.5 rounded-lg bg-rl-purple/5 border border-rl-purple/20">
          <div className="flex flex-col">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-rl-muted">Início</label>
            <input
              type="date"
              value={campaign.startDate || ''}
              onChange={(e) => {
                const v = e.target.value || null
                const patch = { startDate: v }
                // Se a data final ficou anterior à nova de início, limpa
                if (v && campaign.endDate && v > campaign.endDate) patch.endDate = null
                onUpdate(patch)
              }}
              className="input-field text-xs h-8"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-rl-muted">Fim</label>
            <input
              type="date"
              value={campaign.endDate || ''}
              min={campaign.startDate || undefined}
              onChange={(e) => onUpdate({ endDate: e.target.value || null })}
              className="input-field text-xs h-8"
            />
          </div>
          {hasOwnPeriod && (
            <span className="text-[11px] font-medium text-rl-purple ml-1">
              {ownDays} {ownDays === 1 ? 'dia' : 'dias'} · {periodLabel}
            </span>
          )}
          <button
            onClick={() => { onUpdate({ startDate: null, endDate: null }); setDatesOpen(false) }}
            className="ml-auto p-1.5 text-rl-muted hover:text-red-400 transition-colors"
            title="Remover período específico"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
