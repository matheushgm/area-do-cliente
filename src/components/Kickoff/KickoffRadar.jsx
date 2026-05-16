import { PILLARS } from './KickoffQuestions'

// Radar/aranha dos 9 pilares em SVG puro. Sem dep externa.
// Pode ser usado na tela (com bg do design system) e dentro do HTML do PDF
// (passar `theme="light"` para ficar bem em fundo branco).
export default function KickoffRadar({
  pillarScores = {},
  width = 420,
  height = 420,
  fillColor = '#7C3AED',
  theme = 'dark', // 'dark' | 'light'
}) {
  const cx = width / 2
  const cy = height / 2
  const radius = Math.min(width, height) / 2 - 60  // padding pros labels

  const n = PILLARS.length
  const angleStep = (Math.PI * 2) / n

  // Cada pilar é um vértice; ângulo começa em cima (-90°) e roda sentido horário
  const angleFor = (i) => -Math.PI / 2 + i * angleStep
  const pointAt = (i, ratio) => {
    const a = angleFor(i)
    return {
      x: cx + Math.cos(a) * radius * ratio,
      y: cy + Math.sin(a) * radius * ratio,
    }
  }

  // App é light theme (rl-bg = #EEF2F9). Forçamos preto sólido nos labels
  // independente do theme passado pra garantir leitura nos cards translúcidos.
  const gridColor   = '#D8E0F0'   // rl-border
  const axisColor   = '#CBD5E1'
  const labelColor  = '#0F172A'   // rl-text — quase preto
  const scoreColor  = '#000000'   // preto absoluto pros números
  const ringTextCol = '#94A3B8'   // rl-muted

  // Polígono de scores
  const points = PILLARS.map((p, i) => {
    const score = pillarScores[p.id]?.score ?? pillarScores[p.id] ?? 0
    const ratio = Math.max(0, Math.min(100, score)) / 100
    const { x, y } = pointAt(i, ratio)
    return `${x},${y}`
  }).join(' ')

  // Rings de referência: 25, 50, 75, 100
  const rings = [0.25, 0.5, 0.75, 1].map((ratio, idx) => {
    const polyPoints = PILLARS.map((_, i) => {
      const { x, y } = pointAt(i, ratio)
      return `${x},${y}`
    }).join(' ')
    return { ratio, idx, polyPoints }
  })

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className="block mx-auto"
      role="img"
      aria-label="Mapa visual de pilares"
    >
      {/* Rings de referência */}
      {rings.map((r) => (
        <polygon
          key={r.ratio}
          points={r.polyPoints}
          fill="none"
          stroke={gridColor}
          strokeWidth={1}
        />
      ))}

      {/* Eixos */}
      {PILLARS.map((_, i) => {
        const { x, y } = pointAt(i, 1)
        return (
          <line
            key={`axis-${i}`}
            x1={cx} y1={cy} x2={x} y2={y}
            stroke={axisColor}
            strokeWidth={1}
          />
        )
      })}

      {/* Polígono de scores */}
      <polygon
        points={points}
        fill={fillColor}
        fillOpacity={0.25}
        stroke={fillColor}
        strokeWidth={2}
      />

      {/* Pontos nos vértices */}
      {PILLARS.map((p, i) => {
        const score = pillarScores[p.id]?.score ?? pillarScores[p.id] ?? 0
        const ratio = Math.max(0, Math.min(100, score)) / 100
        const { x, y } = pointAt(i, ratio)
        return (
          <circle
            key={`pt-${p.id}`}
            cx={x} cy={y} r={4}
            fill={fillColor}
            stroke="#FFFFFF"
            strokeWidth={1.5}
          />
        )
      })}

      {/* Labels nos vértices */}
      {PILLARS.map((p, i) => {
        const labelRatio = 1.20
        const { x, y } = pointAt(i, labelRatio)
        // Alinhamento de texto: depende do quadrante
        const a = angleFor(i)
        const cos = Math.cos(a)
        const anchor = Math.abs(cos) < 0.2 ? 'middle' : cos > 0 ? 'start' : 'end'
        const score = pillarScores[p.id]?.score ?? pillarScores[p.id] ?? 0
        return (
          <g key={`lbl-${p.id}`}>
            <text
              x={x} y={y}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize="13"
              fontWeight="700"
              fill={labelColor}
            >
              {p.short}
            </text>
            <text
              x={x} y={y + 16}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize="13"
              fontWeight="800"
              fill={scoreColor}
            >
              {score}
            </text>
          </g>
        )
      })}

      {/* Marcador dos rings 50 e 100 */}
      <text
        x={cx + 4}
        y={cy - radius + 4}
        fontSize="10"
        fontWeight="600"
        fill={ringTextCol}
        textAnchor="start"
      >
        100
      </text>
      <text
        x={cx + 4}
        y={cy - radius * 0.5 + 4}
        fontSize="10"
        fontWeight="600"
        fill={ringTextCol}
        textAnchor="start"
      >
        50
      </text>
    </svg>
  )
}
