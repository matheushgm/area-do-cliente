import { STAGE_KEYS, FUNNEL_GRID } from './campaignHelpers'
import StageSection from './StageSection'

// ─────────────────────────────────────────────────────────────────────────────
// Funil de um canal (ou de uma conta de anúncio) como tabela: uma linha por
// etapa e as campanhas logo abaixo, recuadas, todas nas mesmas colunas. Antes
// cada etapa era uma caixa colorida com os campos dela e as campanhas repetiam o
// mesmo layout por dentro, então canal, etapa e campanha tinham a mesma cara.
// ─────────────────────────────────────────────────────────────────────────────

export default function FunnelTable({
  stages, derived, parentMonthly, daysLeft,
  onUpdateStage, onAddCampaign, onUpdateCampaign, onDeleteCampaign,
}) {
  return (
    <div>
      <div className={`${FUNNEL_GRID} !hidden sm:!grid px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-rl-muted`}>
        <span>Etapa / campanha</span>
        <span className="text-right">%</span>
        <span className="text-right">Valor</span>
        <span className="text-right hidden sm:block">Por dia</span>
        <span />
      </div>
      <div className="divide-y divide-rl-border/60 border-y border-rl-border/60">
        {STAGE_KEYS.map((key) => (
          <StageSection
            key={key}
            stageKey={key}
            stage={stages[key]}
            derived={derived[key]}
            channelMonthly={parentMonthly}
            daysLeft={daysLeft}
            onUpdateStage={(patch) => onUpdateStage(key, patch)}
            onAddCampaign={() => onAddCampaign(key)}
            onUpdateCampaign={(campId, patch) => onUpdateCampaign(key, campId, patch)}
            onDeleteCampaign={(campId) => onDeleteCampaign(key, campId)}
          />
        ))}
      </div>
    </div>
  )
}
