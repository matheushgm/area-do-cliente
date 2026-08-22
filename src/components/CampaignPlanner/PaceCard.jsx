import { useState } from 'react'
import {
  Gauge, RefreshCw, TrendingUp, TrendingDown, CheckCircle2, AlertCircle,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { fmtBRL } from './campaignHelpers'

// Acima/abaixo do ideal dentro dessa margem, o ritmo é considerado ok.
const TOLERANCE = 0.05

/**
 * Pace de investimento — compara o que dá pra gastar POR DIA (disponível ÷
 * dias restantes) com o orçamento diário CONFIGURADO nas campanhas ativas do
 * Meta (CBO = campanha; ABO = soma dos conjuntos), lido em /api/campaign-budgets.
 */
export default function PaceCard({ accountNames, idealDaily, daysLeft, orcamentoTotal, valorJaUsado, showToast }) {
  const [loading, setLoading]   = useState(false)
  const [data, setData]         = useState(null)
  const [expanded, setExpanded] = useState(false)

  const canCheck = accountNames.length > 0 && idealDaily > 0

  async function handleCheck() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const qs = new URLSearchParams({ accounts: accountNames.join('|') })
      const res = await fetch(`/api/campaign-budgets?${qs}`, {
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error?.message || `HTTP ${res.status}`)
      setData(body)
      if (body.unresolved?.length) {
        showToast(`Sem acesso em Meta/Google: ${body.unresolved.join(', ')}`, 'error')
      }
      if (body.warnings?.length) {
        showToast(body.warnings.join(' · '), 'error')
      }
    } catch (e) {
      showToast('Pace: ' + e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  // ── Veredito ───────────────────────────────────────────────────────────────
  const configured = data?.daily ?? null
  const hasEstimate = !!data?.accounts?.some((a) => a.campaigns.some((c) => c.estimated))
  let verdict = null
  if (configured != null && idealDaily > 0) {
    const delta = configured - idealDaily
    const pct   = idealDaily > 0 ? delta / idealDaily : 0
    const projected = valorJaUsado + configured * daysLeft
    if (Math.abs(pct) <= TOLERANCE) {
      verdict = {
        tone: 'ok',
        label: 'Ritmo ok',
        detail: `Nesse ritmo o período fecha em ${fmtBRL(projected)} de ${fmtBRL(orcamentoTotal)}.`,
      }
    } else if (delta > 0) {
      verdict = {
        tone: 'down',
        label: `Reduzir ${fmtBRL(delta)}/dia (${Math.round(pct * 100)}% acima)`,
        detail: `Mantendo assim, o período fecha em ${fmtBRL(projected)} e estoura ${fmtBRL(Math.max(0, projected - orcamentoTotal))} do orçamento.`,
      }
    } else {
      verdict = {
        tone: 'up',
        label: `Aumentar ${fmtBRL(-delta)}/dia (${Math.round(-pct * 100)}% abaixo)`,
        detail: `Mantendo assim, o período fecha em ${fmtBRL(projected)} e sobram ${fmtBRL(Math.max(0, orcamentoTotal - projected))} sem investir.`,
      }
    }
  }

  const TONE = {
    ok:   { chip: 'bg-rl-green/10 border-rl-green/20 text-rl-green', Icon: CheckCircle2 },
    up:   { chip: 'bg-rl-cyan/10 border-rl-cyan/20 text-rl-cyan',    Icon: TrendingUp },
    down: { chip: 'bg-rl-gold/10 border-rl-gold/20 text-rl-gold',    Icon: TrendingDown },
  }

  const campaigns = (data?.accounts || []).flatMap((a) =>
    a.campaigns.map((c) => ({ ...c, account: a.name, channel: a.channel }))
  )
  const multiAccount = new Set((data?.accounts || []).map((a) => a.name)).size > 1
  const hasGoogle = !!data?.perChannel?.google
  const hasMeta   = !!data?.perChannel?.meta

  return (
    <div className="rounded-xl bg-rl-surface border border-rl-border px-4 py-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-rl-purple" />
          <p className="text-sm font-semibold text-rl-text">Pace de investimento</p>
          <span className="text-[11px] text-rl-muted">
            orçamento diário configurado no Meta vs. ideal
          </span>
        </div>
        <button
          onClick={handleCheck}
          disabled={!canCheck || loading}
          className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          title="Lê o orçamento diário das campanhas ativas (CBO) e conjuntos (ABO) direto do Meta"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Consultando Meta…' : data ? 'Atualizar' : 'Comparar pace'}
        </button>
      </div>

      {!data && !loading && (
        <p className="text-[11px] text-rl-muted">
          {canCheck
            ? 'Clique em "Comparar pace" pra ler o orçamento diário das campanhas ativas no Meta e comparar com o ideal por dia.'
            : 'Preencha o orçamento e vincule uma conta de anúncio pra comparar o pace.'}
        </p>
      )}

      {data && (
        <>
          {/* Ideal vs. configurado */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-rl-bg/60 border border-rl-border px-3 py-2">
              <p className="text-[10px] text-rl-muted">Ideal por dia</p>
              <p className="text-base font-bold text-rl-text">{fmtBRL(idealDaily)}</p>
              <p className="text-[10px] text-rl-muted/60">disponível ÷ {daysLeft} {daysLeft === 1 ? 'dia' : 'dias'}</p>
            </div>
            <div className="rounded-lg bg-rl-bg/60 border border-rl-border px-3 py-2">
              <p className="text-[10px] text-rl-muted">Configurado hoje (Meta + Google)</p>
              <p className="text-base font-bold text-rl-text">{fmtBRL(configured)}</p>
              <p className="text-[10px] text-rl-muted/60">
                {hasMeta || hasGoogle
                  ? `Meta ${fmtBRL(data.perChannel.meta)} · Google ${fmtBRL(data.perChannel.google)} · `
                  : ''}
                {campaigns.length} campanha{campaigns.length === 1 ? '' : 's'} ativa{campaigns.length === 1 ? '' : 's'}
                {hasEstimate ? ' · inclui estimativa' : ''}
              </p>
            </div>
          </div>

          {/* Veredito */}
          {verdict && (() => {
            const { chip, Icon } = TONE[verdict.tone]
            return (
              <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${chip}`}>
                <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-semibold">{verdict.label}</p>
                  <p className="opacity-80 mt-0.5">{verdict.detail}</p>
                </div>
              </div>
            )
          })()}

          {campaigns.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-rl-muted">
              <AlertCircle className="w-3.5 h-3.5" />
              Nenhuma campanha ativa encontrada nas contas vinculadas.
            </div>
          )}

          {data.googleConfigured === false && (
            <div className="flex items-center gap-2 text-[11px] text-rl-muted">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              Google Ads fora do pace: faltam as envs GOOGLE_ADS_* na Vercel (só Meta foi considerado).
            </div>
          )}

          {/* Detalhe por campanha */}
          {campaigns.length > 0 && (
            <div>
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 text-[11px] text-rl-muted hover:text-rl-text transition-colors"
              >
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {expanded ? 'Esconder campanhas' : 'Ver campanha por campanha'}
              </button>
              {expanded && (
                <div className="mt-2 space-y-1">
                  {campaigns.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-3 text-xs rounded-lg bg-rl-bg/40 px-3 py-1.5">
                      <div className="min-w-0">
                        <p className="text-rl-text truncate">{c.name}</p>
                        {multiAccount && <p className="text-[10px] text-rl-muted/60 truncate">{c.account}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                          c.channel === 'google'
                            ? 'bg-rl-green/10 border-rl-green/20 text-rl-green'
                            : 'bg-rl-blue/10 border-rl-blue/20 text-rl-blue'
                        }`}>
                          {c.channel === 'google' ? 'Google' : 'Meta'}
                        </span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                          c.budgetMode === 'CBO' || c.budgetMode === 'Diário'
                            ? 'bg-rl-purple/10 border-rl-purple/20 text-rl-purple'
                            : 'bg-rl-cyan/10 border-rl-cyan/20 text-rl-cyan'
                        }`}>
                          {c.budgetMode}
                        </span>
                        <span className="font-semibold text-rl-text tabular-nums">
                          {c.sharedDuplicate
                            ? 'já contado'
                            : c.daily == null ? 'sem estimativa' : `${fmtBRL(c.daily)}/dia`}
                          {c.daily != null && c.estimated ? '*' : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                  {hasEstimate && (
                    <p className="text-[10px] text-rl-muted/60 pl-1">
                      * orçamento por período (lifetime): diário estimado pelo valor ÷ dias até a data final da campanha.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
