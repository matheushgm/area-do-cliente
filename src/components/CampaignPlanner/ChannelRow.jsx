import { ChevronDown, Trash2, DownloadCloud, Plus, Building2 } from 'lucide-react'
import { CHANNEL_OPTIONS, STAGE_KEYS, STAGE_META, fmtBRL, stageSum, channelStyle } from './campaignHelpers'
import AdAccountSection from './AdAccountSection'
import FunnelTable from './FunnelTable'
import PctInput from './PctInput'
import ValueInput from './ValueInput'

// Barrinha Topo/Meio/Fundo do cabeçalho: mostra como a verba do canal está
// repartida no funil sem precisar abrir o cartão.
function FunnelBar({ stages }) {
  const partes = STAGE_KEYS.map((k) => ({ k, pct: stages?.[k]?.percentage || 0 })).filter((p) => p.pct > 0)
  if (!partes.length) return <span className="text-[11px] text-rl-muted">funil sem distribuição</span>
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex h-1.5 w-20 shrink-0 rounded-full overflow-hidden bg-rl-border/60">
        {partes.map((p) => (
          <span key={p.k} className={STAGE_META[p.k].dotClass} style={{ width: `${Math.min(p.pct, 100)}%` }} />
        ))}
      </div>
      <span className="text-[11px] text-rl-muted truncate">
        {partes.map((p) => `${STAGE_META[p.k].short} ${Math.round(p.pct)}%`).join(' · ')}
      </span>
    </div>
  )
}

export function ChannelMark({ name, size = 'w-5 h-5' }) {
  const { logo, color } = channelStyle(name)
  if (logo) return <img src={logo} alt="" className={`${size} shrink-0`} />
  return (
    <span className={`${size} shrink-0 rounded-md text-[10px] font-bold text-white flex items-center justify-center`} style={{ background: color }}>
      {(name || '?').charAt(0)}
    </span>
  )
}

export default function ChannelRow({
  channel, derived, daysLeft, usedNames, budgetDisponivel, canPull, onPull,
  onUpdate, onDelete, onUpdateStage, onAddCampaign, onUpdateCampaign, onDeleteCampaign,
  onUpdateAdAccount, onAddAdAccount, onDeleteAdAccount,
}) {
  // Canal subdividido por conta de anúncio: o funil fica dentro de cada conta e
  // o que precisa fechar 100% aqui é a divisão entre as contas.
  const adAccounts   = channel.adAccounts || []
  const subdivided   = adAccounts.length > 0
  const acctSum      = adAccounts.reduce((s, a) => s + (a.percentage || 0), 0)
  const stageTotal   = subdivided ? acctSum : stageSum(channel.stages)
  const stageRemaining = Math.round((100 - stageTotal) * 100) / 100
  const { color } = channelStyle(channel.name)
  const open = !!channel.expanded

  const nCampanhas = subdivided
    ? adAccounts.reduce((s, a) => s + STAGE_KEYS.reduce((t, k) => t + (a.stages?.[k]?.campaigns?.length || 0), 0), 0)
    : STAGE_KEYS.reduce((t, k) => t + (channel.stages?.[k]?.campaigns?.length || 0), 0)

  // Canais ainda livres + o atual (o select do nome troca o canal do cartão)
  const availableOptions = CHANNEL_OPTIONS.filter(
    (opt) => opt === channel.name || !usedNames.includes(opt)
  )

  const toggle = () => onUpdate({ expanded: !open })

  return (
    <div className="glass-card overflow-hidden" style={{ borderLeft: `4px solid ${color}` }}>
      {/* Cabeçalho: identidade + resumo à esquerda (clica para abrir), números à direita */}
      <div className="flex items-center gap-3 flex-wrap px-4 py-3">
        <div
          role="button"
          tabIndex={0}
          onClick={toggle}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } }}
          className="flex items-center gap-3 flex-1 min-w-[220px] cursor-pointer select-none"
          aria-expanded={open}
        >
          <ChevronDown className={`w-4 h-4 text-rl-muted shrink-0 transition-transform ${open ? '' : '-rotate-90'}`} />
          <ChannelMark name={channel.name} size="w-6 h-6" />
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              {/* Select com cara de título: trocar o canal é raro */}
              <select
                value={channel.name}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => onUpdate({ name: e.target.value })}
                className="bg-transparent border-0 p-0 pr-1 text-base font-bold text-rl-text outline-none cursor-pointer hover:underline"
                title="Trocar canal"
              >
                {availableOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              <span className="text-[11px] text-rl-muted whitespace-nowrap">
                {subdivided ? `${adAccounts.length} contas · ` : ''}{nCampanhas} {nCampanhas === 1 ? 'campanha' : 'campanhas'}
              </span>
              {stageRemaining !== 0 && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-rl-gold/10 text-rl-gold border border-rl-gold/20 whitespace-nowrap">
                  {subdivided ? 'contas' : 'funil'}: {stageRemaining > 0 ? `falta ${stageRemaining}%` : `passou ${-stageRemaining}%`}
                </span>
              )}
            </div>
            {subdivided
              ? <span className="text-[11px] text-rl-muted">verba dividida entre {adAccounts.map((a) => a.name || 'sem nome').join(', ')}</span>
              : <FunnelBar stages={channel.stages} />}
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <div className="w-[76px] shrink-0">
            <PctInput size="sm" value={channel.percentage} onChange={(v) => onUpdate({ percentage: v })} />
          </div>
          {/* Para Meta, edita-se o valor BRUTO (antes dos impostos), que é o
              que mapeia direto para a porcentagem do orçamento. */}
          <div className="w-[124px] shrink-0">
            <ValueInput
              size="sm"
              value={derived.monthlyBruto}
              parentBudget={budgetDisponivel}
              onChange={(newPct) => onUpdate({ percentage: newPct })}
            />
          </div>
          <div className="hidden sm:block text-right w-[104px] shrink-0">
            <p className="text-sm font-bold text-rl-text tabular-nums">{fmtBRL(derived.daily)}<span className="text-[10px] font-medium text-rl-muted">/dia</span></p>
            {derived.isMeta && (
              <p className="text-[10px] text-rl-gold" title={`Líquido no período: ${fmtBRL(derived.monthly)}`}>
                líquido, −13% impostos
              </p>
            )}
          </div>
          {onPull && (
            <button
              onClick={onPull}
              disabled={!canPull}
              className="p-1.5 rounded-lg text-rl-muted hover:text-rl-green hover:bg-rl-surface transition-colors shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
              title={canPull
                ? `Puxar dados: campanhas ativas de ${channel.name} e a verba na proporção atual`
                : `Sem dados de ${channel.name} para as contas vinculadas a este cliente`}
            >
              <DownloadCloud className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-rl-muted hover:text-red-400 hover:bg-rl-surface transition-colors shrink-0"
            title="Remover canal"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Corpo: o funil (ou as contas de anúncio) em tabela */}
      {open && (
        <div className="px-4 pb-3 pt-1 border-t border-rl-border/60 space-y-2">
          {subdivided ? (
            <div className="space-y-2 pt-2">
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
            <div className="pt-2">
              <FunnelTable
                stages={channel.stages}
                derived={derived.stages}
                parentMonthly={derived.monthly}
                daysLeft={daysLeft}
                onUpdateStage={(key, patch) => onUpdateStage(key, patch)}
                onAddCampaign={(key) => onAddCampaign(key)}
                onUpdateCampaign={(key, campId, patch) => onUpdateCampaign(key, campId, patch)}
                onDeleteCampaign={(key, campId) => onDeleteCampaign(key, campId)}
              />
            </div>
          )}

          {/* Subdividir / adicionar conta de anúncio */}
          <button
            onClick={onAddAdAccount}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-colors"
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
