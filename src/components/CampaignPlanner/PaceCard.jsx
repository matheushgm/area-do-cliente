import { useState } from 'react'
import {
  Gauge, RefreshCw, TrendingUp, TrendingDown, CheckCircle2, AlertCircle,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import { apiFetch } from '../../lib/api'
import { fmtBRL } from './campaignHelpers'
import { useI18n } from '../../i18n'

// Acima/abaixo do ideal dentro dessa margem, o ritmo é considerado ok.
const TOLERANCE = 0.05

// budgetMode chega de /api/campaign-budgets em pt (valor comparado abaixo); só o rótulo muda.
const MODO_CHAVE = { CBO: 'CBO', ABO: 'ABO', 'Diário': 'diario', 'Período': 'periodo', Compartilhado: 'compartilhado' }

/**
 * Pace de investimento — compara o que dá pra gastar POR DIA (disponível ÷
 * dias restantes) com o orçamento diário CONFIGURADO nas campanhas ativas do
 * Meta (CBO = campanha; ABO = soma dos conjuntos), lido em /api/campaign-budgets.
 */
export default function PaceCard({ accountNames, idealDaily, daysLeft, orcamentoTotal, valorJaUsado, showToast }) {
  const { t } = useI18n()
  const [loading, setLoading]   = useState(false)
  const [data, setData]         = useState(null)
  const [expanded, setExpanded] = useState(false)

  const canCheck = accountNames.length > 0 && idealDaily > 0

  async function handleCheck() {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ accounts: accountNames.join('|') })
      const body = await apiFetch(`/api/campaign-budgets?${qs}`)
      setData(body)
      // Conta não encontrada e canal sem credencial viram nota dentro do card;
      // toast vermelho fica só para erro de verdade da API.
      if (body.warnings?.length) {
        showToast(body.warnings.join(' · '), 'error')
      }
    } catch (e) {
      showToast(t('campanhas.pace.erro', { erro: e.message }), 'error')
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
        label: t('campanhas.pace.ritmoOk'),
        detail: t('campanhas.pace.ritmoOkDetalhe', { projetado: fmtBRL(projected), orcamento: fmtBRL(orcamentoTotal) }),
      }
    } else if (delta > 0) {
      verdict = {
        tone: 'down',
        label: t('campanhas.pace.reduzir', { valor: fmtBRL(delta), pct: Math.round(pct * 100) }),
        detail: t('campanhas.pace.reduzirDetalhe', { projetado: fmtBRL(projected), excesso: fmtBRL(Math.max(0, projected - orcamentoTotal)) }),
      }
    } else {
      verdict = {
        tone: 'up',
        label: t('campanhas.pace.aumentar', { valor: fmtBRL(-delta), pct: Math.round(-pct * 100) }),
        detail: t('campanhas.pace.aumentarDetalhe', { projetado: fmtBRL(projected), sobra: fmtBRL(Math.max(0, orcamentoTotal - projected)) }),
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
          <p className="text-sm font-semibold text-rl-text">{t('campanhas.pace.titulo')}</p>
          <span className="text-[11px] text-rl-muted">
            {t('campanhas.pace.subtitulo')}
          </span>
        </div>
        <button
          onClick={handleCheck}
          disabled={!canCheck || loading}
          className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          title={t('campanhas.pace.botaoTitulo')}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? t('campanhas.pace.consultando') : data ? t('campanhas.pace.atualizar') : t('campanhas.pace.comparar')}
        </button>
      </div>

      {!data && !loading && (
        <p className="text-[11px] text-rl-muted">
          {canCheck
            ? t('campanhas.pace.dicaComparar')
            : t('campanhas.pace.dicaPreencher')}
        </p>
      )}

      {data && (
        <>
          {/* Ideal vs. configurado */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-rl-bg/60 border border-rl-border px-3 py-2">
              <p className="text-[10px] text-rl-muted">{t('campanhas.pace.idealPorDia')}</p>
              <p className="text-base font-bold text-rl-text">{fmtBRL(idealDaily)}</p>
              <p className="text-[10px] text-rl-muted/60">{t('campanhas.pace.disponivelDividido', { count: daysLeft })}</p>
            </div>
            <div className="rounded-lg bg-rl-bg/60 border border-rl-border px-3 py-2">
              <p className="text-[10px] text-rl-muted">{t('campanhas.pace.configurado')}</p>
              <p className="text-base font-bold text-rl-text">{fmtBRL(configured)}</p>
              <p className="text-[10px] text-rl-muted/60">
                {hasMeta || hasGoogle
                  ? t('campanhas.pace.porCanal', { meta: fmtBRL(data.perChannel.meta), google: fmtBRL(data.perChannel.google) })
                  : ''}
                {t('campanhas.pace.campanhasAtivas', { count: campaigns.length })}
                {hasEstimate ? t('campanhas.pace.incluiEstimativa') : ''}
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
              {t('campanhas.pace.semCampanhas')}
            </div>
          )}

          {data.googleConfigured === false && (
            <div className="flex items-center gap-2 text-[11px] text-rl-muted">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {t('campanhas.pace.googleFora')}
            </div>
          )}

          {data.unchecked?.length > 0 && (
            <p className="text-[11px] text-rl-muted pl-[22px]">
              {t('campanhas.pace.naoVerificadas', { lista: data.unchecked.join(', ') })}
            </p>
          )}

          {data.unresolved?.length > 0 && (
            <div className="flex items-center gap-2 text-[11px] text-rl-gold">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {t('campanhas.pace.semAcesso', { lista: data.unresolved.join(', ') })}
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
                {expanded ? t('campanhas.pace.esconder') : t('campanhas.pace.verCampanhas')}
              </button>
              {expanded && (
                <div className="mt-2 space-y-1">
                  {campaigns.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-3 text-xs rounded-lg bg-rl-bg/40 px-3 py-1.5">
                      <div className="min-w-0">
                        <p className="text-rl-text truncate">
                          {c.name}
                          {c.limited && (
                            <span className="ml-1.5 text-[10px] text-rl-gold" title={t('campanhas.pace.limitadaTitulo')}>
                              {t('campanhas.pace.limitada')}
                            </span>
                          )}
                        </p>
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
                          {MODO_CHAVE[c.budgetMode] ? t(`campanhas.pace.modo.${MODO_CHAVE[c.budgetMode]}`) : c.budgetMode}
                        </span>
                        <span className="font-semibold text-rl-text tabular-nums">
                          {c.sharedDuplicate
                            ? t('campanhas.pace.jaContado')
                            : c.daily == null ? t('campanhas.pace.semEstimativa') : t('campanhas.pace.porDia', { valor: fmtBRL(c.daily) })}
                          {c.daily != null && c.estimated ? '*' : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                  {hasEstimate && (
                    <p className="text-[10px] text-rl-muted/60 pl-1">
                      {t('campanhas.pace.notaEstimativa')}
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
