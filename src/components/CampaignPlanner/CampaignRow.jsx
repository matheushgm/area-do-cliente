import { useState } from 'react'
import { CalendarDays, Trash2, X } from 'lucide-react'
import { formatCampaignPeriod, getDaysBetween, fmtBRL, FUNNEL_GRID, FUNNEL_NAME } from './campaignHelpers'
import PctInput from './PctInput'
import ValueInput from './ValueInput'

// Campanha dentro de uma etapa da FunnelTable: mesma grade da etapa, nome
// recuado e sem caixa (vira campo só no hover/foco), para não competir com a
// linha da etapa. O calendário abre o período próprio da campanha.
export default function CampaignRow({ campaign, stageMonthly, daysLeft, onUpdate, onDelete }) {
  const monthly = stageMonthly * (campaign.percentage / 100)
  const hasOwnPeriod = !!(campaign.startDate && campaign.endDate)
  const ownDays = hasOwnPeriod ? getDaysBetween(campaign.startDate, campaign.endDate) : null
  const daily = hasOwnPeriod ? monthly / ownDays : monthly / daysLeft
  const periodLabel = formatCampaignPeriod(campaign.startDate, campaign.endDate)

  const [datesOpen, setDatesOpen] = useState(false)

  return (
    <div className="group">
      <div className={`${FUNNEL_GRID} px-2 py-1 sm:py-0.5`}>
        <div className={`${FUNNEL_NAME} flex items-center gap-1 min-w-0 pl-4 border-l border-rl-border/80 ml-1`}>
          <input
            type="text"
            placeholder="Nome da campanha"
            value={campaign.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="flex-1 min-w-0 bg-transparent border border-transparent hover:border-rl-border focus:border-rl-purple rounded-md px-2 py-1.5 text-sm text-rl-text placeholder-rl-muted outline-none transition-colors"
          />
          {hasOwnPeriod && (
            <button
              onClick={() => setDatesOpen((v) => !v)}
              className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-rl-purple/10 text-rl-purple border border-rl-purple/30 whitespace-nowrap"
              title="Período próprio desta campanha"
            >
              {periodLabel}
            </button>
          )}
        </div>
        <PctInput size="sm" value={campaign.percentage} onChange={(v) => onUpdate({ percentage: v })} />
        <ValueInput
          size="sm"
          value={monthly}
          parentBudget={stageMonthly}
          onChange={(newPct) => onUpdate({ percentage: newPct })}
        />
        <span
          className="hidden sm:block text-right text-sm text-rl-muted tabular-nums"
          title={hasOwnPeriod ? `Por dia em ${ownDays} ${ownDays === 1 ? 'dia' : 'dias'} do período próprio` : undefined}
        >
          {fmtBRL(daily)}
        </span>
        <div className="flex items-center justify-end gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
          {!hasOwnPeriod && (
            <button
              onClick={() => setDatesOpen((v) => !v)}
              className="p-1 rounded text-rl-muted hover:text-rl-purple transition-colors"
              title="Definir período específico para esta campanha"
            >
              <CalendarDays className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-1 rounded text-rl-muted hover:text-red-400 transition-colors"
            title="Remover campanha"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Período próprio da campanha */}
      {datesOpen && (
        <div className="ml-8 mr-2 mb-1.5 flex flex-wrap items-end gap-2 px-3 py-2 rounded-lg bg-rl-purple/5 border border-rl-purple/20">
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
              className="input-field text-xs py-1.5"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-rl-muted">Fim</label>
            <input
              type="date"
              value={campaign.endDate || ''}
              min={campaign.startDate || undefined}
              onChange={(e) => onUpdate({ endDate: e.target.value || null })}
              className="input-field text-xs py-1.5"
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
