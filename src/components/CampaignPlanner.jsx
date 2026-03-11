import { useState, useMemo, useCallback } from 'react'
import {
  Plus, Trash2, ChevronDown, ChevronUp,
  Save, AlertCircle, CheckCircle2, CalendarDays, DollarSign, FileDown,
} from 'lucide-react'
import { exportCampaignPDF } from '../utils/exportPDF'

// ─── Constants ────────────────────────────────────────────────────────────────

const CHANNEL_OPTIONS = ['Meta Ads', 'Google Ads', 'LinkedIn Ads', 'TikTok Ads', 'YouTube Ads']

const STAGE_KEYS = ['topo', 'meio', 'fundo']

const STAGE_META = {
  topo:  { label: 'Topo de Funil',  colorClass: 'text-rl-cyan',   bgClass: 'bg-rl-cyan/10',   borderClass: 'border-rl-cyan/20'   },
  meio:  { label: 'Meio de Funil',  colorClass: 'text-rl-purple', bgClass: 'bg-rl-purple/10', borderClass: 'border-rl-purple/20' },
  fundo: { label: 'Fundo de Funil', colorClass: 'text-rl-green',  bgClass: 'bg-rl-green/10',  borderClass: 'border-rl-green/20'  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDaysLeft() {
  const today   = new Date()
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  return Math.max(lastDay.getDate() - today.getDate() + 1, 1)
}

function getMonthLabel() {
  return new Date()
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    .replace(/^./, (c) => c.toUpperCase())
}

function fmtBRL(n) {
  if (n == null || !isFinite(n) || isNaN(n)) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

function makeChannel(name = '') {
  return {
    id: uid(),
    name,
    percentage: 0,
    expanded: true,
    stages: {
      topo:  { percentage: 0, campaigns: [] },
      meio:  { percentage: 0, campaigns: [] },
      fundo: { percentage: 0, campaigns: [] },
    },
  }
}

function makeCampaign() {
  return { id: uid(), name: '', percentage: 0 }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PctInput({ value, onChange, className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <input
        type="number"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
        className="input-field pr-8 text-right w-full"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-rl-muted text-sm pointer-events-none">%</span>
    </div>
  )
}

function ValueCell({ label, value }) {
  return (
    <div className="text-right">
      <p className="text-xs text-rl-muted leading-tight">{label}</p>
      <p className="text-sm font-bold text-rl-text">{fmtBRL(value)}</p>
    </div>
  )
}

function CampaignRow({ campaign, stageMonthly, daysLeft, onUpdate, onDelete }) {
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

function StageSection({ stageKey, stage, derived, daysLeft, onUpdateStage, onAddCampaign, onUpdateCampaign, onDeleteCampaign }) {
  const meta = STAGE_META[stageKey]
  const campSum = stage.campaigns.reduce((s, c) => s + (c.percentage || 0), 0)
  const campRemaining = 100 - campSum

  return (
    <div className={`rounded-xl border ${meta.borderClass} ${meta.bgClass} overflow-hidden`}>
      {/* Stage header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${meta.colorClass}`}>{meta.label}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-20">
            <PctInput value={stage.percentage} onChange={(v) => onUpdateStage({ percentage: v })} />
          </div>
          <div className="hidden sm:flex items-center gap-4">
            <ValueCell label="Mensal" value={derived.monthly} />
            <ValueCell label="Diário"  value={derived.daily}   />
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

function ChannelRow({ channel, derived, daysLeft, validation, usedNames, onUpdate, onDelete, onUpdateStage, onAddCampaign, onUpdateCampaign, onDeleteCampaign }) {
  const stageSum = STAGE_KEYS.reduce((s, k) => s + (channel.stages[k].percentage || 0), 0)
  const stageRemaining = 100 - stageSum
  const stageValid = stageSum === 100

  // Available channel options (not used by other channels, but include current)
  const availableOptions = CHANNEL_OPTIONS.filter(
    (opt) => opt === channel.name || !usedNames.includes(opt)
  )

  return (
    <div className="glass-card overflow-hidden">
      {/* Channel header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-rl-surface/50">
        {/* Name select */}
        <select
          value={channel.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="input-field flex-1 text-sm font-semibold"
        >
          {availableOptions.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>

        {/* Percentage */}
        <div className="w-20 shrink-0">
          <PctInput value={channel.percentage} onChange={(v) => onUpdate({ percentage: v })} />
        </div>

        {/* Derived values */}
        <div className="hidden sm:flex items-center gap-4">
          {derived.isMeta ? (
            <div className="text-right">
              <p className="text-xs text-rl-muted leading-tight line-through opacity-50">{fmtBRL(derived.monthlyBruto)}</p>
              <p className="text-sm font-bold text-rl-text">{fmtBRL(derived.monthly)}</p>
              <p className="text-[10px] text-rl-gold">−13% impostos</p>
            </div>
          ) : (
            <ValueCell label="Mensal" value={derived.monthly} />
          )}
          <ValueCell label="Diário" value={derived.daily} />
        </div>

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
          {/* Funnel distribution header */}
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-rl-muted uppercase tracking-wider">
              Distribuição do Funil
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

          {/* Stage rows */}
          <div className="space-y-2">
            {STAGE_KEYS.map((key) => (
              <StageSection
                key={key}
                stageKey={key}
                stage={channel.stages[key]}
                derived={derived.stages[key]}
                daysLeft={daysLeft}
                onUpdateStage={(patch) => onUpdateStage(key, patch)}
                onAddCampaign={() => onAddCampaign(key)}
                onUpdateCampaign={(campId, patch) => onUpdateCampaign(key, campId, patch)}
                onDeleteCampaign={(campId) => onDeleteCampaign(key, campId)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const META_TAX = 0.13 // 13% retido pela Meta como imposto

export default function CampaignPlanner({ project, onSave }) {
  const [orcamentoTotal, setOrcamentoTotal] = useState(
    () => project.campaignPlan?.orcamentoTotal ?? project.campaignPlan?.totalBudget ?? 0
  )
  const [valorJaUsado, setValorJaUsado] = useState(
    () => project.campaignPlan?.valorJaUsado || 0
  )
  const [channels, setChannels] = useState(
    () => (project.campaignPlan?.channels || []).map((ch) => ({ ...ch, expanded: true }))
  )

  const budgetDisponivel = Math.max(0, orcamentoTotal - valorJaUsado)

  // ── Derived ────────────────────────────────────────────────────────────────

  const daysLeft   = useMemo(() => getDaysLeft(), [])
  const monthLabel = useMemo(() => getMonthLabel(), [])

  const derived = useMemo(() => {
    return channels.map((ch) => {
      const isMeta        = ch.name === 'Meta Ads'
      const chMonBruto    = budgetDisponivel * (ch.percentage / 100)
      const chMonEfetivo  = isMeta ? chMonBruto * (1 - META_TAX) : chMonBruto
      const chDay         = chMonEfetivo / daysLeft
      const stages = {}
      STAGE_KEYS.forEach((key) => {
        const st     = ch.stages[key]
        const stMon  = chMonEfetivo * (st.percentage / 100)
        const stDay  = stMon / daysLeft
        stages[key]  = {
          ...st,
          monthly: stMon,
          daily: stDay,
          campaigns: st.campaigns.map((c) => {
            const cMon = stMon * (c.percentage / 100)
            return { ...c, monthly: cMon, daily: cMon / daysLeft }
          }),
        }
      })
      return { ...ch, monthly: chMonEfetivo, monthlyBruto: chMonBruto, isMeta, daily: chDay, stages }
    })
  }, [channels, budgetDisponivel, daysLeft])

  const validation = useMemo(() => {
    const chSum   = channels.reduce((s, ch) => s + (ch.percentage || 0), 0)
    const stageErrors = channels.map((ch) => {
      const sum = STAGE_KEYS.reduce((s, k) => s + (ch.stages[k].percentage || 0), 0)
      return { id: ch.id, name: ch.name, sum, valid: sum === 100 }
    })
    return {
      chSum,
      chValid: chSum === 100 || channels.length === 0,
      stageErrors,
      allValid: (chSum === 100 || channels.length === 0) && stageErrors.every((e) => e.valid),
    }
  }, [channels])

  // ── Updaters ───────────────────────────────────────────────────────────────

  const updateChannel = useCallback((id, patch) => {
    setChannels((prev) => prev.map((ch) => ch.id === id ? { ...ch, ...patch } : ch))
  }, [])

  const updateStage = useCallback((channelId, stageKey, patch) => {
    setChannels((prev) =>
      prev.map((ch) => {
        if (ch.id !== channelId) return ch
        return { ...ch, stages: { ...ch.stages, [stageKey]: { ...ch.stages[stageKey], ...patch } } }
      })
    )
  }, [])

  const addCampaign = useCallback((channelId, stageKey) => {
    setChannels((prev) =>
      prev.map((ch) => {
        if (ch.id !== channelId) return ch
        return {
          ...ch,
          stages: {
            ...ch.stages,
            [stageKey]: {
              ...ch.stages[stageKey],
              campaigns: [...ch.stages[stageKey].campaigns, makeCampaign()],
            },
          },
        }
      })
    )
  }, [])

  const updateCampaign = useCallback((channelId, stageKey, campaignId, patch) => {
    setChannels((prev) =>
      prev.map((ch) => {
        if (ch.id !== channelId) return ch
        return {
          ...ch,
          stages: {
            ...ch.stages,
            [stageKey]: {
              ...ch.stages[stageKey],
              campaigns: ch.stages[stageKey].campaigns.map((c) =>
                c.id === campaignId ? { ...c, ...patch } : c
              ),
            },
          },
        }
      })
    )
  }, [])

  const deleteCampaign = useCallback((channelId, stageKey, campaignId) => {
    setChannels((prev) =>
      prev.map((ch) => {
        if (ch.id !== channelId) return ch
        return {
          ...ch,
          stages: {
            ...ch.stages,
            [stageKey]: {
              ...ch.stages[stageKey],
              campaigns: ch.stages[stageKey].campaigns.filter((c) => c.id !== campaignId),
            },
          },
        }
      })
    )
  }, [])

  const addChannel = useCallback(() => {
    const usedNames = channels.map((ch) => ch.name)
    const nextName  = CHANNEL_OPTIONS.find((n) => !usedNames.includes(n)) || CHANNEL_OPTIONS[0]
    // Auto-suggest the remaining % so values appear immediately
    const usedPct      = channels.reduce((s, ch) => s + (ch.percentage || 0), 0)
    const suggestedPct = Math.max(0, 100 - usedPct)
    const newCh        = makeChannel(nextName)
    newCh.percentage   = suggestedPct
    setChannels((prev) => [...prev, newCh])
  }, [channels])

  const deleteChannel = useCallback((id) => {
    setChannels((prev) => prev.filter((ch) => ch.id !== id))
  }, [])

  // ── Save ───────────────────────────────────────────────────────────────────

  function handleSave() {
    const plan = {
      orcamentoTotal,
      valorJaUsado,
      totalBudget: budgetDisponivel, // backward compat
      // Strip UI-only 'expanded' flag before persisting
      channels: channels.map(({ expanded, ...rest }) => rest),
    }
    onSave(plan)
  }

  // ── Computed values ────────────────────────────────────────────────────────

  const channelSum       = validation.chSum
  const channelRemaining = 100 - channelSum
  const usedChannelNames = channels.map((ch) => ch.name)
  const canAddChannel    = channels.length < CHANNEL_OPTIONS.length
  const totalBudget      = budgetDisponivel // alias para exportPDF

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-rl-text flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-rl-green" />
            Planejamento de Campanhas
          </h2>
          <p className="text-sm text-rl-muted mt-0.5">
            Distribua o orçamento por canal, etapa do funil e campanhas individuais
          </p>
        </div>
        <button
          onClick={() => exportCampaignPDF({ totalBudget, channels: channels.map(({ expanded, ...rest }) => rest) }, project)}
          disabled={channels.length === 0 || totalBudget === 0}
          className="btn-secondary flex items-center gap-2 text-sm shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          title="Exportar PDF"
        >
          <FileDown className="w-4 h-4" />
          PDF
        </button>
      </div>

      {/* Budget + date info */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          {/* Orçamento Total */}
          <div className="flex-1">
            <label className="label-field">Orçamento Total do Mês</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rl-muted text-sm pointer-events-none">R$</span>
              <input
                type="number"
                min={0}
                value={orcamentoTotal}
                onChange={(e) => setOrcamentoTotal(parseFloat(e.target.value) || 0)}
                className="input-field pl-10 w-full"
                placeholder="0"
              />
            </div>
          </div>

          {/* Já Utilizado */}
          <div className="flex-1">
            <label className="label-field">Já Utilizado</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rl-muted text-sm pointer-events-none">R$</span>
              <input
                type="number"
                min={0}
                value={valorJaUsado}
                onChange={(e) => setValorJaUsado(parseFloat(e.target.value) || 0)}
                className="input-field pl-10 w-full"
                placeholder="0"
              />
            </div>
          </div>

          {/* Date info */}
          <div className="flex flex-col sm:items-end justify-center gap-1.5 pt-1 sm:pt-6">
            <div className="flex items-center gap-1.5 bg-rl-green/10 border border-rl-green/20 px-3 py-1.5 rounded-full">
              <CalendarDays className="w-3.5 h-3.5 text-rl-green" />
              <span className="text-xs font-semibold text-rl-green">{monthLabel}</span>
            </div>
            <span className="text-xs text-rl-muted text-center sm:text-right">
              {daysLeft} dias restantes no mês
            </span>
          </div>
        </div>

        {/* Disponível para investir */}
        <div className="flex items-center justify-between rounded-xl bg-rl-surface border border-rl-border px-4 py-3">
          <div>
            <p className="text-xs text-rl-muted">Disponível para investir</p>
            <p className="text-[10px] text-rl-muted/60 mt-0.5">
              {fmtBRL(orcamentoTotal)} − {fmtBRL(valorJaUsado)}
            </p>
          </div>
          <p className={`text-lg font-bold ${budgetDisponivel > 0 ? 'text-rl-green' : 'text-red-400'}`}>
            {fmtBRL(budgetDisponivel)}
          </p>
        </div>
      </div>

      {/* Channels section */}
      <div className="space-y-3">
        {/* Section header with channel distribution indicator */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-rl-text">Canais</p>
          {channels.length > 0 && (
            <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border ${
              validation.chValid
                ? 'bg-rl-green/10 border-rl-green/20 text-rl-green'
                : 'bg-rl-gold/10 border-rl-gold/20 text-rl-gold'
            }`}>
              {validation.chValid
                ? <><CheckCircle2 className="w-3.5 h-3.5" /> 100% distribuído</>
                : <><AlertCircle className="w-3.5 h-3.5" /> Restante: {channelRemaining}%</>
              }
            </div>
          )}
        </div>

        {/* Empty state */}
        {channels.length === 0 && (
          <div className="glass-card p-8 text-center">
            <DollarSign className="w-8 h-8 text-rl-muted/40 mx-auto mb-2" />
            <p className="text-sm text-rl-muted">Nenhum canal adicionado ainda</p>
            <p className="text-xs text-rl-muted/60 mt-1">
              Clique em "+ Adicionar Canal" para começar a distribuir o orçamento
            </p>
          </div>
        )}

        {/* Channel list */}
        {derived.map((ch, idx) => (
          <ChannelRow
            key={ch.id}
            channel={channels[idx]}
            derived={ch}
            daysLeft={daysLeft}
            validation={validation}
            usedNames={usedChannelNames.filter((n) => n !== ch.name)}
            onUpdate={(patch) => updateChannel(ch.id, patch)}
            onDelete={() => deleteChannel(ch.id)}
            onUpdateStage={(stageKey, patch) => updateStage(ch.id, stageKey, patch)}
            onAddCampaign={(stageKey) => addCampaign(ch.id, stageKey)}
            onUpdateCampaign={(stageKey, campId, patch) => updateCampaign(ch.id, stageKey, campId, patch)}
            onDeleteCampaign={(stageKey, campId) => deleteCampaign(ch.id, stageKey, campId)}
          />
        ))}

        {/* Add channel */}
        <button
          onClick={addChannel}
          disabled={!canAddChannel}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-rl-border text-rl-muted hover:border-rl-purple/40 hover:text-rl-text transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">
            {canAddChannel ? 'Adicionar Canal' : 'Todos os canais já adicionados'}
          </span>
        </button>
      </div>

      {/* Global validation warning */}
      {!validation.allValid && channels.length > 0 && (
        <div className="flex items-start gap-2 bg-rl-gold/10 border border-rl-gold/20 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-rl-gold shrink-0 mt-0.5" />
          <div className="text-xs text-rl-gold space-y-0.5">
            {!validation.chValid && (
              <p>A distribuição total dos canais deve somar 100% (atual: {channelSum}%).</p>
            )}
            {validation.stageErrors.filter((e) => !e.valid && channels.find(ch => ch.id === e.id)?.percentage > 0).map((e) => (
              <p key={e.id}>{e.name}: distribuição do funil soma {e.sum}% (deve ser 100%).</p>
            ))}
          </div>
        </div>
      )}

      {/* Save button */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          className="btn-primary flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          Salvar Planejamento
        </button>
      </div>
    </div>
  )
}
