import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  CalendarDays, Loader2, AlertTriangle, TrendingUp, Megaphone, Building2,
} from 'lucide-react'
import {
  fmtBRL, STAGE_KEYS, STAGE_META,
  getDaysBetween, getPeriodLabel, formatCampaignPeriod,
} from '../components/CampaignPlanner/campaignHelpers'

// Mesmo imposto aplicado pelo CampaignPlanner interno ao canal Meta Ads.
// Precisa bater com o valor de CampaignPlanner.jsx / ChannelRow.jsx, senão o
// cliente vê um número diferente do que o time vê internamente.
const META_TAX = 0.13

// Reproduz o cálculo do módulo interno (CampaignPlanner.jsx → `derived`):
// canal = disponível × %canal (menos 13% se for Meta) → etapa × %etapa →
// campanha × %campanha.
function deriveStageList(stages, parentMonthly, daysLeft) {
  return STAGE_KEYS.map((key) => {
    const st    = stages?.[key] || { percentage: 0, campaigns: [] }
    const stMon = parentMonthly * (st.percentage / 100)
    return {
      key,
      percentage: st.percentage || 0,
      monthly:    stMon,
      daily:      stMon / daysLeft,
      campaigns: (st.campaigns || []).map((c) => {
        const cMon         = stMon * (c.percentage / 100)
        const hasOwnPeriod = !!(c.startDate && c.endDate)
        const ownDays      = hasOwnPeriod ? getDaysBetween(c.startDate, c.endDate) : null
        return {
          ...c,
          monthly: cMon,
          daily:   hasOwnPeriod ? cMon / ownDays : cMon / daysLeft,
          period:  formatCampaignPeriod(c.startDate, c.endDate),
        }
      }),
    }
  })
}

function deriveChannels(channels, budgetDisponivel, daysLeft) {
  return channels.map((ch) => {
    const isMeta       = ch.name === 'Meta Ads'
    const chBruto      = budgetDisponivel * (ch.percentage / 100)
    const chEfetivo    = isMeta ? chBruto * (1 - META_TAX) : chBruto
    // Canal repartido por conta de anúncio: o funil fica dentro de cada conta.
    const adAccounts = (ch.adAccounts || []).map((ac) => {
      const acMon = chEfetivo * ((ac.percentage || 0) / 100)
      return {
        ...ac,
        monthly: acMon,
        daily:   acMon / daysLeft,
        stages:  deriveStageList(ac.stages, acMon, daysLeft),
      }
    })
    return {
      ...ch,
      isMeta,
      monthlyBruto: chBruto,
      monthly:      chEfetivo,
      daily:        chEfetivo / daysLeft,
      stages:       deriveStageList(ch.stages, chEfetivo, daysLeft),
      adAccounts,
    }
  })
}

export default function CampanhasPublico() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [company, setCompany] = useState('')
  const [plan,    setPlan]    = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch(`/api/campanhas-public?token=${encodeURIComponent(token)}`)
        const body = await res.json()
        if (!res.ok) throw new Error(body.error || 'Erro ao carregar.')
        setCompany(body.companyName || '')
        setPlan(body.plan || null)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  const daysLeft   = useMemo(
    () => getDaysBetween(plan?.startDate, plan?.endDate),
    [plan?.startDate, plan?.endDate]
  )
  const periodLabel = useMemo(
    () => getPeriodLabel(plan?.startDate, plan?.endDate),
    [plan?.startDate, plan?.endDate]
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-rl-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-rl-green animate-spin" />
          <p className="text-rl-muted text-sm">Carregando...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-rl-bg flex items-center justify-center p-6">
        <div className="glass-card p-8 max-w-md w-full text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto" />
          <h2 className="text-lg font-bold text-rl-text">Link inválido</h2>
          <p className="text-sm text-rl-muted">{error}</p>
        </div>
      </div>
    )
  }

  const accounts = plan?.accounts || []

  return (
    <div className="min-h-screen bg-rl-bg">
      {/* Header */}
      {/* Tokens rl-* (não bg-white) — o tema tem modo claro e escuro. */}
      <div className="border-b border-rl-border bg-rl-card/85 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-rl-green/10 flex items-center justify-center shrink-0">
              <CalendarDays className="w-5 h-5 text-rl-green" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-rl-muted font-bold">
                Planejamento de Verba
              </p>
              <h1 className="text-base font-black text-rl-text leading-tight truncate">{company}</h1>
            </div>
          </div>
          {plan && (
            <div className="text-right shrink-0">
              <span className="inline-flex items-center gap-1.5 bg-rl-green/10 border border-rl-green/20 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-rl-green">
                {periodLabel}
              </span>
              <p className="text-[10px] text-rl-muted mt-1">
                {daysLeft} {daysLeft === 1 ? 'dia' : 'dias'}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {!plan || accounts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-rl-border bg-rl-surface/30 py-12 px-6 text-center space-y-2">
            <Megaphone className="w-8 h-8 text-rl-muted/40 mx-auto" />
            <p className="text-sm font-semibold text-rl-text">
              Nenhum planejamento de verba publicado ainda.
            </p>
            <p className="text-xs text-rl-muted">
              Assim que o time montar a distribuição do orçamento, ela aparece aqui.
            </p>
          </div>
        ) : (
          accounts.map((acc, i) => (
            <AccountSection
              key={acc.id || i}
              account={acc}
              daysLeft={daysLeft}
              showName={accounts.length > 1 || !!acc.name}
            />
          ))
        )}

        <div className="pt-2 pb-8 text-center">
          <p className="text-xs text-rl-muted">
            Esta é uma visualização somente leitura do planejamento de verba.
          </p>
          <p className="text-xs text-rl-muted/60 mt-1">Revenue Lab © {new Date().getFullYear()}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Conta ───────────────────────────────────────────────────────────────────
function AccountSection({ account, daysLeft, showName }) {
  const disponivel = Math.max(0, (account.orcamentoTotal || 0) - (account.valorJaUsado || 0))
  const derived    = useMemo(
    () => deriveChannels(account.channels || [], disponivel, daysLeft),
    [account.channels, disponivel, daysLeft]
  )

  return (
    <div className="space-y-4">
      {showName && (
        <h2 className="text-sm font-black text-rl-text uppercase tracking-wider">
          {account.name || 'Conta Principal'}
        </h2>
      )}

      {/* Resumo do orçamento */}
      <div className="glass-card p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <BudgetCell label="Orçamento total" value={account.orcamentoTotal} />
          <BudgetCell label="Já utilizado" value={account.valorJaUsado} />
          <BudgetCell
            label="Disponível para investir"
            value={disponivel}
            highlight
            hint={`${fmtBRL(account.orcamentoTotal)} − ${fmtBRL(account.valorJaUsado)}`}
          />
        </div>
      </div>

      {/* Canais */}
      {derived.length === 0 ? (
        <div className="rounded-xl border border-dashed border-rl-border bg-rl-surface/30 py-8 px-6 text-center">
          <p className="text-sm text-rl-muted">Nenhum canal distribuído nesta conta.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {derived.map((ch) => <ChannelCard key={ch.id} channel={ch} />)}
        </div>
      )}
    </div>
  )
}

function BudgetCell({ label, value, highlight, hint }) {
  return (
    <div className={highlight ? 'rounded-xl bg-rl-surface border border-rl-border px-4 py-3' : 'px-1 py-3'}>
      <p className="text-xs text-rl-muted">{label}</p>
      <p className={`font-bold ${highlight ? 'text-lg text-rl-green' : 'text-lg text-rl-text'}`}>
        {fmtBRL(value || 0)}
      </p>
      {hint && <p className="text-[10px] text-rl-muted/60 mt-0.5">{hint}</p>}
    </div>
  )
}

// ─── Canal ───────────────────────────────────────────────────────────────────
// Etapas zeradas e sem campanha não interessam ao cliente — só poluem.
const visibleStages = (stages) => stages.filter((st) => st.percentage > 0 || st.campaigns.length > 0)

function ChannelCard({ channel }) {
  const adAccounts = channel.adAccounts || []
  const stages     = visibleStages(channel.stages)

  return (
    <div className="glass-card overflow-hidden">
      {/* Cabeçalho do canal */}
      <div className="flex items-center gap-3 flex-wrap px-4 py-3 bg-rl-surface/50">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <TrendingUp className="w-4 h-4 text-rl-purple shrink-0" />
          <p className="text-sm font-bold text-rl-text truncate">{channel.name}</p>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rl-purple/10 border border-rl-purple/20 text-rl-purple shrink-0">
            {channel.percentage}%
          </span>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {channel.isMeta && (
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-rl-muted leading-tight">Bruto</p>
              <p className="text-xs font-semibold text-rl-muted line-through">
                {fmtBRL(channel.monthlyBruto)}
              </p>
            </div>
          )}
          <div className="text-right">
            <p className="text-[10px] text-rl-muted leading-tight">No período</p>
            <p className="text-sm font-bold text-rl-text">{fmtBRL(channel.monthly)}</p>
            {channel.isMeta && <p className="text-[10px] text-rl-gold">−13% impostos</p>}
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-[10px] text-rl-muted leading-tight">Diário</p>
            <p className="text-sm font-bold text-rl-text">{fmtBRL(channel.daily)}</p>
          </div>
        </div>
      </div>

      {/* Contas de anúncio (quando o canal é repartido) ou o funil direto */}
      <div className="p-4 space-y-2">
        {adAccounts.length > 0 ? (
          adAccounts.map((ac) => <AdAccountBlock key={ac.id} account={ac} />)
        ) : stages.length === 0 ? (
          <p className="text-xs text-rl-muted text-center py-2">
            Distribuição do funil ainda não definida para este canal.
          </p>
        ) : (
          stages.map((st) => <StageBlock key={st.key} stage={st} />)
        )}
      </div>
    </div>
  )
}

// ─── Conta de anúncio dentro do canal ────────────────────────────────────────
function AdAccountBlock({ account }) {
  const stages = visibleStages(account.stages)

  return (
    <div className="rounded-xl border border-rl-border bg-rl-surface/40 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="w-3.5 h-3.5 text-rl-muted shrink-0" />
          <p className="text-xs font-bold text-rl-text truncate">
            {account.name || 'Conta de anúncio'}
          </p>
          <span className="text-[10px] font-semibold text-rl-muted shrink-0">
            {account.percentage}% do canal
          </span>
        </div>
        <div className="flex items-center gap-4 shrink-0 text-right">
          <div>
            <p className="text-[10px] text-rl-muted leading-tight">No período</p>
            <p className="text-xs font-bold text-rl-text">{fmtBRL(account.monthly)}</p>
          </div>
          <div className="hidden sm:block">
            <p className="text-[10px] text-rl-muted leading-tight">Diário</p>
            <p className="text-xs font-bold text-rl-text">{fmtBRL(account.daily)}</p>
          </div>
        </div>
      </div>

      <div className="px-3 pb-3 pt-1 space-y-2 border-t border-rl-border/60">
        {stages.length === 0 ? (
          <p className="text-xs text-rl-muted text-center py-2">
            Distribuição do funil ainda não definida para esta conta.
          </p>
        ) : (
          stages.map((st) => <StageBlock key={st.key} stage={st} />)
        )}
      </div>
    </div>
  )
}

// ─── Etapa do funil ──────────────────────────────────────────────────────────
function StageBlock({ stage }) {
  const meta = STAGE_META[stage.key]

  return (
    <div className={`rounded-xl border ${meta.borderClass} ${meta.bgClass} overflow-hidden`}>
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <p className={`text-xs font-bold ${meta.colorClass}`}>{meta.label}</p>
          <span className={`text-[10px] font-semibold ${meta.colorClass} opacity-80`}>
            {stage.percentage}%
          </span>
        </div>
        <div className="flex items-center gap-4 shrink-0 text-right">
          <div>
            <p className="text-[10px] text-rl-muted leading-tight">No período</p>
            <p className="text-xs font-bold text-rl-text">{fmtBRL(stage.monthly)}</p>
          </div>
          <div className="hidden sm:block">
            <p className="text-[10px] text-rl-muted leading-tight">Diário</p>
            <p className="text-xs font-bold text-rl-text">{fmtBRL(stage.daily)}</p>
          </div>
        </div>
      </div>

      {stage.campaigns.length > 0 && (
        <div className="bg-rl-card/60 border-t border-rl-border/60 divide-y divide-rl-border/40">
          {stage.campaigns.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-rl-text truncate">
                  {c.name || 'Campanha sem nome'}
                </p>
                <p className="text-[10px] text-rl-muted mt-0.5">
                  {c.percentage}% da etapa
                  {c.period && <span className="ml-2 text-rl-muted/70">{c.period}</span>}
                </p>
              </div>
              <div className="flex items-center gap-4 shrink-0 text-right">
                <div>
                  <p className="text-[10px] text-rl-muted leading-tight">No período</p>
                  <p className="text-xs font-bold text-rl-text">{fmtBRL(c.monthly)}</p>
                </div>
                <div className="hidden sm:block">
                  <p className="text-[10px] text-rl-muted leading-tight">Diário</p>
                  <p className="text-xs font-bold text-rl-text">{fmtBRL(c.daily)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
