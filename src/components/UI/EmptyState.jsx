/**
 * EmptyState — estado vazio padronizado
 *
 * Props:
 *   icon     — ReactNode (ícone grande, ex: <Users className="w-8 h-8" />)
 *   title    — string principal
 *   subtitle — string secundária (opcional)
 *   action   — ReactNode botão/link CTA (opcional)
 *   className — classes extras no wrapper
 */
export default function EmptyState({ icon, title, subtitle, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 text-center ${className}`}>
      {icon && (
        <div className="text-rl-muted/30 mb-4">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-rl-muted">{title}</p>
      {subtitle && <p className="text-xs text-rl-muted/60 mt-1 max-w-xs">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
