import { ChevronDown, ChevronUp, Trash2, DownloadCloud, Plus, Building2 } from 'lucide-react'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { CHANNEL_OPTIONS, STAGE_KEYS, fmtBRL, stageSum } from './campaignHelpers'
import AdAccountSection from './AdAccountSection'
import PctInput from './PctInput'
import ValueInput from './ValueInput'
import ValueCell from './ValueCell'
import StageSection from './StageSection'

const META_TAX = 0.13

export default function ChannelRow({
  channel, derived, daysLeft, validation, usedNames, budgetDisponivel, canPull, onPull,
  onUpdate, onDelete, onUpdateStage, onAddCampaign, onUpdateCampaign, onDeleteCampaign,
  onUpdateAdAccount, onAddAdAccount, onDeleteAdAccount,
}) {
  // Canal subdividido por conta de anúncio: o funil fica dentro de cada conta e
  // o que precisa fechar 100% aqui é a divisão entre as contas.
  const adAccounts   = channel.adAccounts || []
  const subdivided   = adAccounts.length > 0
  const acctSum      = adAccounts.reduce((s, a) => s + (a.percentage || 0), 0)
  const stageTotal   = subdivided ? acctSum : stageSum(channel.stages)
  const stageRemaining = 100 - stageTotal
  const stageValid   = stageTotal === 100

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

        {/* Puxar dados — campanhas ativas + proporção de verba atual do canal */}
        {onPull && (
          <button
            onClick={onPull}
            disabled={!canPull}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-rl-border text-[11px] font-semibold text-rl-muted hover:text-rl-text hover:border-rl-green/40 transition-all shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            title={canPull
              ? `Puxa as campanhas ativas de ${channel.name} e distribui a verba na proporção atual`
              : `Sem dados de ${channel.name} para as contas vinculadas a este cliente`}
          >
            <DownloadCloud className="w-3.5 h-3.5" />
            Puxar dados
          </button>
        )}

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
          {/* Cabeçalho da distribuição — por conta de anúncio ou pelo funil */}
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-rl-muted uppercase tracking-wider">
              {subdivided ? 'Contas de Anúncio' : 'Distribuição do Funil'}
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

          {subdivided ? (
            <div className="space-y-2">
              {adAccounts.map((ac, i) => (
                <AdAccountSection
                  key={ac.id}
                  account={ac}
                  derived={derived.adAccounts[i]}
                  channelMonthly={derived.monthly}
                  daysLeft={daysLeft}
                  onUpdate={(patch) => onUpdateAdAccount(ac.id, patch)}
                  onDelete={() => onDeleteAdAccount(ac.id)}
                  onUpdateStage={(stageKey, patch) => onUpdateStage(stageKey, patch, ac.id)}
                  onAddCampaign={(stageKey) => onAddCampaign(stageKey, ac.id)}
                  onUpdateCampaign={(stageKey, campId, patch) => onUpdateCampaign(stageKey, campId, patch, ac.id)}
                  onDeleteCampaign={(stageKey, campId) => onDeleteCampaign(stageKey, campId, ac.id)}
                />
              ))}
            </div>
          ) : (
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
          )}

          {/* Subdividir / adicionar conta de anúncio */}
          <button
            onClick={onAddAdAccount}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-rl-border text-[11px] font-semibold text-rl-muted hover:text-rl-text hover:border-rl-purple/40 transition-all"
            title={subdivided
              ? 'Adicionar outra conta de anúncio a este canal'
              : 'Repartir a verba deste canal entre contas de anúncio (o funil atual vai para a primeira conta)'}
          >
            {subdivided ? <Plus className="w-3.5 h-3.5" /> : <Building2 className="w-3.5 h-3.5" />}
            {subdivided ? 'Adicionar conta de anúncio' : 'Dividir por conta de anúncio'}
          </button>
        </div>
      )}
    </div>
  )
}
