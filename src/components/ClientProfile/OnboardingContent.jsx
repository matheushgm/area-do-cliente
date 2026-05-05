import { useState } from 'react'
import { Pencil, FileDown, TrendingUp, Activity } from 'lucide-react'
import { fmtCurrency, ltvBreakdown, activeMonths } from '../../lib/utils'
import { exportOnboardingPDF } from '../../utils/exportPDF'
import {
  SERVICES_CONFIG, BUSINESS_LABELS, MATURITY_LABELS,
  CONTRACT_MODEL_LABELS, CONTRACT_PAYMENT_LABELS,
} from '../../lib/constants'
import OnboardingEditForm from './OnboardingEditForm'
import ProjectDocs from './ProjectDocs'

function Field({ label, value }) {
  if (!value) return null
  return (
    <div className="rounded-xl bg-rl-surface p-3">
      <p className="text-[11px] text-rl-muted mb-0.5">{label}</p>
      <p className="text-sm text-rl-text font-medium">{value}</p>
    </div>
  )
}

export default function OnboardingContent({ project, onSave }) {
  const [isEditing, setIsEditing] = useState(false)

  if (isEditing) {
    return (
      <OnboardingEditForm
        project={project}
        onSave={(data) => { onSave(data); setIsEditing(false) }}
        onCancel={() => setIsEditing(false)}
      />
    )
  }

  const competitors = (project.competitors || []).filter(Boolean)
  const otherPeople = (project.otherPeople || []).filter((p) => p.name)

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          onClick={() => setIsEditing(true)}
          className="btn-ghost flex items-center gap-2 text-sm"
        >
          <Pencil className="w-4 h-4" />
          Editar Dados
        </button>
        <button
          onClick={() => exportOnboardingPDF(project)}
          className="btn-secondary flex items-center gap-2 text-sm"
          title="Exportar PDF"
        >
          <FileDown className="w-4 h-4" />
          Exportar PDF
        </button>
      </div>

      {/* Empresa */}
      <div>
        <p className="text-xs font-semibold text-rl-muted uppercase tracking-wider mb-3">🏢 Empresa</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Tipo de Negócio"  value={BUSINESS_LABELS[project.businessType] || project.businessType} />
          <Field label="Segmento"         value={project.segmento} />
          <Field label="CNPJ"             value={project.cnpj} />
          <Field label="Responsável"      value={project.responsibleName} />
          <Field label="Cargo"            value={project.responsibleRole} />
          <Field label="Data do Contrato" value={project.contractDate
            ? new Date(project.contractDate + 'T00:00:00').toLocaleDateString('pt-BR')
            : null} />
        </div>
      </div>

      {/* Modelo de Contrato */}
      {(project.contractModel || project.contractValue) && (
        <div>
          <p className="text-xs font-semibold text-rl-muted uppercase tracking-wider mb-3">📋 Modelo de Contrato</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="Modelo"           value={CONTRACT_MODEL_LABELS[project.contractModel]} />
            {project.contractModel === 'aceleracao' && (
              <Field label="Tipo de Pagamento" value={CONTRACT_PAYMENT_LABELS[project.contractPaymentType]} />
            )}
            <Field
              label={project.contractModel === 'aceleracao' ? 'Valor do Contrato' : 'Valor Mensal'}
              value={project.contractValue ? fmtCurrency(project.contractValue) : null}
            />
          </div>
        </div>
      )}

      {/* LTV — usa contractDate quando disponível, senão createdAt como fallback */}
      {(() => {
        const breakdown = ltvBreakdown(project)
        if (!breakdown || breakdown.ltv <= 0) return null

        const months      = activeMonths(project)
        const isEstimated = breakdown.source === 'created'
        const fmtMonths   = months >= 1
          ? `${months.toFixed(1)} ${months < 2 ? 'mês' : 'meses'}`
          : `${Math.max(1, Math.round(months * 30))} dia${Math.round(months * 30) === 1 ? '' : 's'}`
        const startISO    = breakdown.source === 'contract' ? project.contractDate : project.createdAt
        const startStr    = breakdown.source === 'contract'
          ? new Date(startISO + 'T00:00:00').toLocaleDateString('pt-BR')
          : new Date(startISO).toLocaleDateString('pt-BR')
        const endStr      = breakdown.isChurned
          ? new Date(project.churnDate + 'T00:00:00').toLocaleDateString('pt-BR')
          : 'hoje'

        // Texto pra explicar a fórmula no card "Como é calculado"
        let formulaTitle  = ''
        let formulaDetail = ''
        if (breakdown.kind === 'unico') {
          formulaTitle  = 'Pagamento único'
          formulaDetail = `${fmtCurrency(breakdown.installmentValue)} pago integral no início do contrato`
        } else if (breakdown.kind === 'aceleracao_parcelado') {
          formulaTitle  = `Parcela ${breakdown.cobrancas} de ${breakdown.installments}`
          formulaDetail = `${breakdown.cobrancas} × ${fmtCurrency(breakdown.installmentValue)}`
        } else {
          formulaTitle  = `${breakdown.cobrancas} ${breakdown.cobrancas === 1 ? 'cobrança' : 'cobranças'}`
          formulaDetail = `${breakdown.cobrancas} × ${fmtCurrency(breakdown.installmentValue)} (mensal)`
        }

        return (
          <div>
            <p className="text-xs font-semibold text-rl-muted uppercase tracking-wider mb-3">💎 LTV (Lifetime Value)</p>

            {isEstimated && (
              <div className="mb-3 px-3 py-2 rounded-xl border border-rl-gold/30 bg-rl-gold/5 flex items-start gap-2">
                <span className="text-rl-gold text-sm leading-none mt-0.5">⚠️</span>
                <p className="text-[11px] text-rl-gold leading-snug">
                  <span className="font-bold">Valor estimado.</span> A Data de Assinatura ainda não foi preenchida — o cálculo está usando a data de cadastro do cliente como início do ciclo. Edite os dados do cliente pra obter um LTV preciso.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Card principal — LTV em destaque */}
              <div className={`rounded-xl border p-4 sm:col-span-1 ${isEstimated ? 'border-rl-gold/30 bg-rl-gold/5' : 'border-rl-purple/30 bg-rl-purple/5'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className={`w-3.5 h-3.5 ${isEstimated ? 'text-rl-gold' : 'text-rl-purple'}`} />
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${isEstimated ? 'text-rl-gold' : 'text-rl-purple'}`}>
                    LTV Acumulado{isEstimated ? ' (estimado)' : ''}
                  </p>
                </div>
                <p className="text-2xl font-bold text-rl-text leading-tight tabular-nums">{fmtCurrency(breakdown.ltv)}</p>
                {breakdown.isChurned && (
                  <p className="text-[10px] text-red-400 font-semibold mt-1">· valor final (cliente em churn)</p>
                )}
              </div>

              {/* Tempo ativo */}
              <div className="rounded-xl bg-rl-surface p-4">
                <div className="flex items-center gap-1.5 mb-1">
                  <Activity className="w-3.5 h-3.5 text-rl-cyan" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-rl-muted">Tempo Ativo</p>
                </div>
                <p className="text-lg font-bold text-rl-text leading-tight">{fmtMonths}</p>
                <p className="text-[10px] text-rl-muted mt-0.5">
                  {isEstimated ? 'cadastrado' : 'assinado'} {startStr} → {endStr}
                </p>
              </div>

              {/* Fórmula do cálculo */}
              <div className="rounded-xl bg-rl-surface p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-rl-muted mb-1">Como é calculado</p>
                <p className="text-lg font-bold text-rl-text leading-tight">{formulaTitle}</p>
                <p className="text-[10px] text-rl-muted mt-0.5 tabular-nums">{formulaDetail}</p>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Produto (backward compat — only show if exists) */}
      {project.productDescription && (
        <div>
          <p className="text-xs font-semibold text-rl-muted uppercase tracking-wider mb-3">🛍️ Produto / Serviço</p>
          <div className="rounded-xl bg-rl-surface p-4">
            <p className="text-sm text-rl-text leading-relaxed">{project.productDescription}</p>
          </div>
        </div>
      )}

      {/* Serviços contratados */}
      {project.services?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-rl-muted uppercase tracking-wider mb-3">⚙️ Serviços Contratados</p>

          {/* Service chips */}
          <div className="flex flex-wrap gap-2 mb-4">
            {project.services.map((s) => (
              <span key={s} className="px-3 py-1.5 rounded-full text-xs font-medium bg-rl-purple/10 text-rl-purple border border-rl-purple/20">
                {s}
              </span>
            ))}
          </div>

          {/* Deliverable cards — per service with sub-fields */}
          {(() => {
            const DELIVERABLE_META = {
              imagemQty:    { label: 'Imagens',   icon: '📸', color: 'text-rl-gold   bg-rl-gold/10   border-rl-gold/20' },
              videoQty:     { label: 'Vídeos',    icon: '🎬', color: 'text-rl-purple bg-rl-purple/10 border-rl-purple/20' },
              estaticosQty: { label: 'Estáticos', icon: '🖼️', color: 'text-rl-blue  bg-rl-blue/10   border-rl-blue/20' },
              qty:          { label: 'Páginas',   icon: '📄', color: 'text-rl-cyan  bg-rl-cyan/10   border-rl-cyan/20' },
              nivel:        { label: 'Nível',     icon: '⭐', color: 'text-rl-gold   bg-rl-gold/10   border-rl-gold/20' },
            }

            const serviceRows = Object.entries(project.servicesData || {}).reduce((acc, [svcId, data]) => {
              if (!data) return acc
              const svcConfig = SERVICES_CONFIG.find((s) => s.id === svcId)
              if (!svcConfig?.sub) return acc
              const items = svcConfig.sub
                .map(({ key }) => ({ key, value: data[key] }))
                .filter(({ value }) => value !== '' && value != null && value !== '0' && value !== 0)
              if (items.length) acc.push({ svcConfig, items })
              return acc
            }, [])

            if (!serviceRows.length) return null

            return (
              <div className="mt-1 space-y-3">
                <p className="text-[10px] font-semibold text-rl-muted uppercase tracking-wider">📦 Entregáveis por Serviço</p>
                {serviceRows.map(({ svcConfig, items }) => (
                  <div key={svcConfig.id} className="rounded-xl border border-rl-border bg-rl-surface/50 px-3 py-3">
                    <p className="text-xs font-semibold text-rl-text mb-2">
                      {svcConfig.emoji} {svcConfig.label}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {items.map(({ key, value }) => {
                        const meta = DELIVERABLE_META[key]
                        if (!meta) return null
                        const isText = isNaN(Number(value))
                        return (
                          <div
                            key={key}
                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${meta.color}`}
                          >
                            <span className="text-base leading-none">{meta.icon}</span>
                            <div className="leading-tight">
                              {isText ? (
                                <p className="text-xs font-bold">{value}</p>
                              ) : (
                                <p className="text-xl font-extrabold leading-none">{value}</p>
                              )}
                              <p className="text-[10px] opacity-60">{meta.label}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      )}

      {/* Público-alvo (backward compat) */}
      {project.targetAudience && (
        <div>
          <p className="text-xs font-semibold text-rl-muted uppercase tracking-wider mb-3">🎯 Público-Alvo</p>
          <div className="rounded-xl bg-rl-surface p-4">
            <p className="text-sm text-rl-text leading-relaxed">{project.targetAudience}</p>
          </div>
        </div>
      )}

      {/* Equipe */}
      <div>
        <p className="text-xs font-semibold text-rl-muted uppercase tracking-wider mb-3">👥 Equipe & Maturidade</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Time de Vendas"      value={project.hasSalesTeam === true ? 'Sim' : project.hasSalesTeam === false ? 'Não' : null} />
          <Field label="Maturidade Digital"  value={MATURITY_LABELS[project.digitalMaturity]} />
          <Field label="Potencial de Upsell" value={project.upsellPotential === true ? 'Sim' : project.upsellPotential === false ? 'Não' : null} />
        </div>
        {project.upsellNotes && (
          <div className="mt-3 rounded-xl bg-rl-surface p-4">
            <p className="text-[11px] text-rl-muted mb-1">Obs. Upsell</p>
            <p className="text-sm text-rl-text">{project.upsellNotes}</p>
          </div>
        )}
      </div>

      {/* Outras pessoas */}
      {otherPeople.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-rl-muted uppercase tracking-wider mb-3">👤 Outras Pessoas Envolvidas</p>
          <div className="flex flex-wrap gap-2">
            {otherPeople.map((p, i) => (
              <span key={i} className="px-3 py-1.5 rounded-full text-xs bg-rl-surface text-rl-text border border-rl-border">
                {p.name}{p.role ? ` · ${p.role}` : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Concorrentes */}
      {competitors.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-rl-muted uppercase tracking-wider mb-3">⚔️ Concorrentes</p>
          <div className="flex flex-wrap gap-2">
            {competitors.map((c, i) => (
              <span key={i} className="px-3 py-1.5 rounded-full text-xs bg-rl-surface text-rl-muted border border-rl-border font-mono">
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Arquivos */}
      <ProjectDocs project={project} />
    </div>
  )
}
