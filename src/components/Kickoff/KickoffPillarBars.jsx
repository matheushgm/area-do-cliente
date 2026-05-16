import { PILLARS } from './KickoffQuestions'

// Barras horizontais 0-100 por pilar, coloridas por severidade.
// Usado tanto na UI quanto no HTML do PDF (passar `theme="light"`).
export default function KickoffPillarBars({
  pillarScores = {},
  theme = 'dark',
}) {
  const trackColor = theme === 'light' ? '#E2E8F0' : 'rgba(255,255,255,0.08)'
  const labelColor = theme === 'light' ? '#0F172A' : '#F1F5F9'
  const subColor   = theme === 'light' ? '#64748B' : 'rgba(255,255,255,0.55)'

  // Ordena por score crescente — fraquezas no topo da lista
  const rows = PILLARS
    .map((p) => ({
      ...p,
      score: pillarScores[p.id]?.score ?? pillarScores[p.id] ?? 0,
    }))
    .sort((a, b) => a.score - b.score)

  return (
    <div className="space-y-2.5">
      {rows.map((p) => {
        const color = severityColor(p.score)
        return (
          <div key={p.id} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold" style={{ color: labelColor }}>{p.label}</span>
              <span className="font-bold tabular-nums" style={{ color }}>{p.score}</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: trackColor }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(2, p.score)}%`,
                  background: color,
                }}
              />
            </div>
            <div className="text-[10px]" style={{ color: subColor }}>
              {severityLabel(p.score)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function severityColor(score) {
  if (score < 31) return '#EF4444'  // vermelho
  if (score < 51) return '#F59E0B'  // laranja
  if (score < 71) return '#EAB308'  // amarelo
  if (score < 86) return '#22C55E'  // verde claro
  return '#15803D'                  // verde escuro
}

function severityLabel(score) {
  if (score < 31) return 'Crítico — precisa de atenção imediata'
  if (score < 51) return 'Frágil — risco no curto prazo'
  if (score < 71) return 'Em estruturação — base existente, falta padronizar'
  if (score < 86) return 'Saudável — pronto pra acelerar'
  return 'Excelente — vantagem competitiva clara'
}
