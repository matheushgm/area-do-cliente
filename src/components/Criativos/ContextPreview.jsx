import { useState } from 'react'
import { useI18n } from '../../i18n'

export default function ContextPreview({ project, collapsed = false }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(!collapsed)
  const hasPersonas    = (project.personas || []).length > 0
  const hasOferta      = !!(project.ofertaData?.nome || project.ofertaData?.resultadoSonho)
  const hasAttachments = (project.attachments || []).length > 0

  const items = [
    { label: t('criativos.contexto.onboarding'), ok: !!project.companyName, detail: project.businessType || t('criativos.contexto.dadosBasicos') },
    { label: t('criativos.contexto.personas'),   ok: hasPersonas,           detail: hasPersonas ? t('criativos.contexto.nPersonas', { count: project.personas.length }) : t('criativos.contexto.nenhumaCriada') },
    { label: t('criativos.contexto.oferta'),     ok: hasOferta,             detail: hasOferta ? (project.ofertaData?.nome || t('criativos.contexto.configurada')) : t('criativos.contexto.naoConfigurada') },
    { label: t('criativos.contexto.anexos'),     ok: hasAttachments,        detail: hasAttachments ? t('criativos.contexto.nArquivos', { count: project.attachments.length }) : t('criativos.contexto.nenhum') },
  ]

  return (
    <div className="glass-card border border-rl-border/60 overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <span className="text-xs font-semibold text-rl-muted uppercase tracking-wider">📋 {t('criativos.contexto.titulo')}</span>
        <span className="text-rl-muted text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-rl-border/40 pt-3">
          {items.map((item) => (
            <div key={item.label} className="flex items-start gap-2.5">
              <span className={`mt-0.5 text-xs font-bold ${item.ok ? 'text-rl-green' : 'text-rl-muted/40'}`}>{item.ok ? '✓' : '○'}</span>
              <span className={`text-xs ${item.ok ? 'text-rl-text' : 'text-rl-muted'}`}>
                {item.label} <span className="text-rl-muted">— {item.detail}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
