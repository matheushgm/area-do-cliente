import { useState } from 'react'
import { Pencil, FileDown } from 'lucide-react'
import { fmtCurrency } from '../../lib/utils'
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
