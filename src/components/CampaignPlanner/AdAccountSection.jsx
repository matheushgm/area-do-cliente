import { ChevronDown, Trash2, Building2 } from 'lucide-react'
import { stageSum, fmtBRL } from './campaignHelpers'
import PctInput from './PctInput'
import ValueInput from './ValueInput'
import FunnelTable from './FunnelTable'

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
  const falta = Math.round((100 - sum) * 100) / 100
  const open  = !!account.expanded

  return (
    <div className="rounded-xl border border-rl-border overflow-hidden">
      {/* Cabeçalho da conta */}
      <div className="flex items-center gap-2 flex-wrap px-3 py-2 bg-rl-surface/60">
        <button
          onClick={() => onUpdate({ expanded: !open })}
          className="p-1 text-rl-muted hover:text-rl-text transition-colors shrink-0"
          title={open ? 'Recolher' : 'Expandir'}
          aria-expanded={open}
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? '' : '-rotate-90'}`} />
        </button>
        <Building2 className="w-3.5 h-3.5 text-rl-muted shrink-0" />
        <input
          type="text"
          value={account.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Nome da conta de anúncio"
          className="flex-1 min-w-[140px] bg-transparent border border-transparent hover:border-rl-border focus:border-rl-purple rounded-md px-2 py-1 text-sm font-semibold text-rl-text outline-none transition-colors"
        />
        {falta !== 0 && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-rl-gold/10 text-rl-gold border border-rl-gold/20 whitespace-nowrap">
            funil: {falta > 0 ? `falta ${falta}%` : `passou ${-falta}%`}
          </span>
        )}
        <div className="w-[76px] shrink-0">
          <PctInput size="sm" value={account.percentage} onChange={(v) => onUpdate({ percentage: v })} />
        </div>
        <div className="w-[124px] shrink-0">
          <ValueInput
            size="sm"
            value={derived.monthly}
            parentBudget={channelMonthly}
            onChange={(newPct) => onUpdate({ percentage: newPct })}
          />
        </div>
        <span className="hidden sm:block w-[96px] text-right text-sm font-semibold text-rl-text tabular-nums">
          {fmtBRL(derived.daily)}<span className="text-[10px] font-medium text-rl-muted">/dia</span>
        </span>
        <button
          onClick={onDelete}
          className="p-1.5 text-rl-muted hover:text-red-400 transition-colors shrink-0"
          title="Remover conta deste canal"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Funil da conta */}
      {open && (
        <div className="px-2 pt-2 pb-1">
          <FunnelTable
            stages={account.stages}
            derived={derived.stages}
            parentMonthly={derived.monthly}
            daysLeft={daysLeft}
            onUpdateStage={onUpdateStage}
            onAddCampaign={onAddCampaign}
            onUpdateCampaign={onUpdateCampaign}
            onDeleteCampaign={onDeleteCampaign}
          />
        </div>
      )}
    </div>
  )
}
