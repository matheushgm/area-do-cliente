// Gráficos e blocos visuais do módulo Resultados.
//
// Tudo é SVG inline — sem dependência de biblioteca de chart. As cores saem das
// CSS custom properties `--rl-*` (definidas em src/index.css), então os
// gráficos acompanham automaticamente o tema claro/escuro.

import { fmtMoney } from './resultadosHelpers'

// Paleta em formato CSS (var() só funciona em `style`, não em atributos SVG).
export const C = {
  purple: 'rgb(var(--rl-purple))',
  blue:   'rgb(var(--rl-blue))',
  cyan:   'rgb(var(--rl-cyan))',
  gold:   'rgb(var(--rl-gold))',
  green:  'rgb(var(--rl-green))',
  red:    'rgb(var(--rl-red))',
  border: 'rgb(var(--rl-border))',
  muted:  'rgb(var(--rl-muted))',
  text:   'rgb(var(--rl-text))',
}

const TEXT_CLASS = {
  purple: 'text-rl-purple',
  blue:   'text-rl-blue',
  cyan:   'text-rl-cyan',
  gold:   'text-rl-gold',
  green:  'text-rl-green',
  red:    'text-rl-red',
}

// ─── KPI de destaque ───────────────────────────────────────────────────────────
// O card de número grande do topo do dashboard (equivalente ao "Cost Per Click"
// / "Organic Traffic" do layout de referência).
export function KpiHero({ label, value, sub, color = 'blue', icon, footer }) {
  return (
    <div className="glass-card p-5 flex flex-col justify-between min-h-[132px]">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-rl-muted leading-tight">
          {label}
        </span>
        {icon && (
          <span className={`shrink-0 ${TEXT_CLASS[color] || 'text-rl-blue'} opacity-70`}>{icon}</span>
        )}
      </div>
      <div className="mt-3">
        <div className={`font-bold leading-none tracking-tight text-[28px] sm:text-[32px] ${TEXT_CLASS[color] || 'text-rl-text'}`}>
          {value ?? '—'}
        </div>
        {sub && <div className="text-[11px] text-rl-muted mt-1.5">{sub}</div>}
      </div>
      {footer && <div className="mt-3 pt-2 border-t border-rl-border/60">{footer}</div>}
    </div>
  )
}

// ─── Área / linha ──────────────────────────────────────────────────────────────
// `series`: [{ key, label, values: number[], color, area?: bool, axis?: 'left'|'right' }]
// Cada série é normalizada pelo próprio máximo quando `axis` difere, de modo que
// investimento (R$) e leads (unidades) convivem no mesmo gráfico.
export function AreaChart({ labels, series, height = 190, formatValue }) {
  const W = 640
  const H = height
  const padL = 8, padR = 8, padT = 14, padB = 26
  const n = labels.length
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const x = i => (n === 1 ? padL + innerW / 2 : padL + (innerW * i) / (n - 1))

  const scaled = series.map(s => {
    const max = Math.max(...s.values, 1)
    return { ...s, max, pts: s.values.map((v, i) => [x(i), padT + innerH - (v / max) * innerH]) }
  })

  // Curva suave via ponto médio (Catmull-Rom simplificado, sem overshoot).
  const linePath = pts =>
    pts.reduce((d, [px, py], i) => {
      if (i === 0) return `M ${px} ${py}`
      const [prevX, prevY] = pts[i - 1]
      const cx = (prevX + px) / 2
      return `${d} C ${cx} ${prevY}, ${cx} ${py}, ${px} ${py}`
    }, '')

  const hasData = series.some(s => s.values.some(v => v > 0))

  if (!hasData) {
    return (
      <div className="flex items-center justify-center text-xs text-rl-muted border border-dashed border-rl-border rounded-xl"
           style={{ height: H }}>
        Sem dados suficientes para o gráfico
      </div>
    )
  }

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img"
           aria-label="Evolução no período">
        {/* linhas de grade */}
        {[0, 0.25, 0.5, 0.75, 1].map(g => (
          <line key={g}
            x1={padL} x2={W - padR}
            y1={padT + innerH * g} y2={padT + innerH * g}
            style={{ stroke: C.border }} strokeWidth={1} opacity={0.5}
          />
        ))}

        {scaled.map(s => (
          <g key={s.key}>
            {s.area !== false && (
              <>
                <defs>
                  <linearGradient id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   style={{ stopColor: s.color }} stopOpacity="0.32" />
                    <stop offset="100%" style={{ stopColor: s.color }} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d={`${linePath(s.pts)} L ${s.pts[s.pts.length - 1][0]} ${padT + innerH} L ${s.pts[0][0]} ${padT + innerH} Z`}
                  fill={`url(#grad-${s.key})`}
                />
              </>
            )}
            <path d={linePath(s.pts)} fill="none" strokeWidth={2.5} strokeLinecap="round"
                  style={{ stroke: s.color }} />
            {/* Com muitos pontos (visão diária) os marcadores viram ruído. */}
            {n <= 12 && s.pts.map(([px, py], i) => (
              <circle key={i} cx={px} cy={py} r={3.5} style={{ fill: s.color }} />
            ))}
          </g>
        ))}

        {labels.map((lb, i) => (
          lb ? (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11}
                  style={{ fill: C.muted }}>
              {lb}
            </text>
          ) : null
        ))}
      </svg>

      <div className="flex items-center justify-center gap-4 flex-wrap mt-2">
        {scaled.map(s => (
          <span key={s.key} className="flex items-center gap-1.5 text-[11px] text-rl-muted">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
            {s.label}
            <b className="text-rl-text font-semibold">
              {formatValue ? formatValue(s.key, s.max) : s.max}
            </b>
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Grade de custo por etapa ──────────────────────────────────────────────────
// O bloco que aparece dentro de cada quadrante da semana: CPL, custo/MQL,
// custo/SQL e CAC lado a lado.
const COST_TILE_STYLE = {
  blue:   'bg-rl-blue/8   border-rl-blue/25   text-rl-blue',
  cyan:   'bg-rl-cyan/8   border-rl-cyan/25   text-rl-cyan',
  purple: 'bg-rl-purple/8 border-rl-purple/25 text-rl-purple',
  gold:   'bg-rl-gold/8   border-rl-gold/25   text-rl-gold',
  green:  'bg-rl-green/8  border-rl-green/25  text-rl-green',
}

export function CostTile({ label, value, color = 'blue' }) {
  return (
    <div className={`rounded-lg border px-2 py-1.5 text-center ${COST_TILE_STYLE[color]}`}>
      <div className="text-[9px] uppercase tracking-wider text-rl-muted leading-tight">{label}</div>
      <div className="text-[13px] font-bold leading-tight mt-0.5">
        {value > 0 ? fmtMoney(value) : '—'}
      </div>
    </div>
  )
}

// Custos unitários de uma semana/período. `data` precisa de investido + leads,
// mql, sql e vendas (o que faltar vira "—").
export function CostGrid({ investido, leads, mql, sql, vendas, compact = false }) {
  const inv = Number(investido) || 0
  const per = qty => (inv > 0 && Number(qty) > 0 ? inv / Number(qty) : 0)

  const tiles = [
    { label: 'Custo / Lead', value: per(leads),  color: 'blue' },
    { label: 'Custo / MQL',  value: per(mql),    color: 'cyan' },
    { label: 'Custo / SQL',  value: per(sql),    color: 'purple' },
    { label: 'CAC',          value: per(vendas), color: 'gold' },
  ]

  return (
    <div>
      {!compact && (
        <div className="text-[10px] text-rl-muted uppercase tracking-wider mb-1.5 font-semibold">
          Custo por etapa
        </div>
      )}
      <div className="grid grid-cols-4 gap-1.5">
        {tiles.map(t => <CostTile key={t.label} {...t} />)}
      </div>
    </div>
  )
}
