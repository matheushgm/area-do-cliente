import { useMemo } from 'react'
import { Workflow, Star, Check } from 'lucide-react'
import { recommendFunnelsWithBusiness } from './KickoffFunnelRecommendations'
import { useI18n } from '../../i18n'

// Painel embutido na tela de resultado do Kickoff. Mostra os funis sugeridos
// pra esse cliente, ranqueados pela compatibilidade com as respostas dadas.
export default function KickoffFunnelRecommendationsPanel({ kickoff }) {
  const { t, lang } = useI18n()
  // `lang`: nome, descrição e razões dos funis saem no idioma da tela.
  const recs = useMemo(
    () => recommendFunnelsWithBusiness({
      answers:        kickoff?.answers || {},
      ofertaMatadora: kickoff?.ofertaMatadora || null,
      businessType:   kickoff?.businessType,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kickoff, lang]
  )

  const top     = recs.filter((r) => r.tier === 'top')
  const others  = recs.filter((r) => r.tier === 'consider')
  const hasData = recs.length > 0

  return (
    <div className="glass-card p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Workflow className="w-4 h-4 text-rl-blue" />
        <h3 className="text-sm font-bold text-rl-text">{t('kickoffRecomendacoes.painel.titulo')}</h3>
        {hasData && (
          <span className="text-[10px] text-rl-muted ml-auto">
            {t('kickoffRecomendacoes.painel.compativeis', { count: recs.length })}
          </span>
        )}
      </div>

      {!hasData && (
        <div className="rounded-xl border border-dashed border-rl-border p-6 text-center">
          <p className="text-sm text-rl-muted">
            {t('kickoffRecomendacoes.painel.semSinais')}
          </p>
          <p className="text-xs text-rl-muted/80 mt-1">
            {t('kickoffRecomendacoes.painel.semSinaisDica')}
          </p>
        </div>
      )}

      {/* Top recomendações */}
      {top.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Star className="w-3.5 h-3.5 text-rl-green fill-rl-green" />
            <p className="text-[10px] uppercase tracking-wider text-rl-subtle font-bold">
              {t('kickoffRecomendacoes.painel.recomendados')}
            </p>
          </div>
          {top.map((funnel) => (
            <FunnelCard key={funnel.id} funnel={funnel} highlighted />
          ))}
        </div>
      )}

      {/* Vale considerar */}
      {others.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-wider text-rl-subtle font-bold">
            {t('kickoffRecomendacoes.painel.considerar')}
          </p>
          {others.map((funnel) => (
            <FunnelCard key={funnel.id} funnel={funnel} />
          ))}
        </div>
      )}
    </div>
  )
}

function FunnelCard({ funnel, highlighted = false }) {
  const { t } = useI18n()
  return (
    <div
      className={`rounded-xl p-4 border transition-all ${
        highlighted
          ? 'bg-rl-green/5 border-rl-green/30'
          : 'bg-rl-surface/50 border-rl-border'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
            highlighted ? 'bg-rl-green/10' : 'bg-rl-surface'
          }`}
        >
          {funnel.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className={`text-sm font-bold ${highlighted ? 'text-rl-text' : 'text-rl-text'}`}>
              {funnel.label}
            </h4>
            <span
              className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-full ${
                highlighted
                  ? 'bg-rl-green/15 text-rl-green'
                  : 'bg-rl-surface text-rl-muted border border-rl-border'
              }`}
            >
              {t('kickoffRecomendacoes.painel.match', { n: funnel.score })}
            </span>
          </div>
          <p className="text-xs text-rl-subtle mt-1 leading-relaxed">{funnel.desc}</p>
          {funnel.reasons.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wide text-rl-muted">
                {t('kickoffRecomendacoes.painel.porQue')}
              </p>
              <ul className="space-y-0.5">
                {funnel.reasons.map((reason, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-rl-subtle">
                    <Check className={`w-3 h-3 mt-0.5 shrink-0 ${
                      highlighted ? 'text-rl-green' : 'text-rl-muted'
                    }`} />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
