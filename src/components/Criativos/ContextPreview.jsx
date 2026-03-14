import { useState } from 'react'

export default function ContextPreview({ project, collapsed = false }) {
  const [open, setOpen] = useState(!collapsed)
  const hasPersonas    = (project.personas || []).length > 0
  const hasOferta      = !!(project.ofertaData?.nome || project.ofertaData?.resultadoSonho)
  const hasAttachments = (project.attachments || []).length > 0

  const items = [
    { label: 'Onboarding (empresa, produto, objetivo)', ok: !!project.companyName,    detail: project.businessType || 'dados básicos' },
    { label: 'Personas / ICP',                          ok: hasPersonas,              detail: hasPersonas ? `${project.personas.length} persona${project.personas.length > 1 ? 's' : ''}` : 'nenhuma criada' },
    { label: 'Oferta Matadora',                         ok: hasOferta,                detail: hasOferta ? (project.ofertaData?.nome || 'configurada') : 'não configurada' },
    { label: 'Documentos em Anexo',                     ok: hasAttachments,           detail: hasAttachments ? `${project.attachments.length} arquivo${project.attachments.length > 1 ? 's' : ''}` : 'nenhum' },
  ]

  return (
    <div className="glass-card border border-rl-border/60 overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <span className="text-xs font-semibold text-rl-muted uppercase tracking-wider">📋 Contexto usado na geração</span>
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
