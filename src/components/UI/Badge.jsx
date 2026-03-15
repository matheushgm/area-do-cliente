/**
 * Badge — chip colorido reutilizável
 *
 * Props:
 *   color   — 'purple' | 'blue' | 'green' | 'gold' | 'cyan' | 'red' | 'muted' (default 'purple')
 *   size    — 'sm' | 'md' (default 'sm')
 *   icon    — ReactNode opcional, renderizado à esquerda do label
 *   children — conteúdo do badge
 *   className — classes extras
 */

const COLOR_MAP = {
  purple: 'bg-rl-purple/10 text-rl-purple border-rl-purple/20',
  blue:   'bg-rl-blue/10   text-rl-blue   border-rl-blue/20',
  green:  'bg-rl-green/10  text-rl-green  border-rl-green/20',
  gold:   'bg-rl-gold/10   text-rl-gold   border-rl-gold/20',
  cyan:   'bg-rl-cyan/10   text-rl-cyan   border-rl-cyan/30',
  red:    'bg-red-500/10   text-red-400   border-red-500/20',
  muted:  'bg-rl-surface   text-rl-muted  border-rl-border',
}

const SIZE_MAP = {
  sm: 'text-xs px-2.5 py-1',
  md: 'text-sm px-3   py-1.5',
}

export default function Badge({ color = 'purple', size = 'sm', icon, children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium border
        ${COLOR_MAP[color] ?? COLOR_MAP.purple}
        ${SIZE_MAP[size]  ?? SIZE_MAP.sm}
        ${className}`}
    >
      {icon && <span className="shrink-0 w-3.5 h-3.5 flex items-center">{icon}</span>}
      {children}
    </span>
  )
}
