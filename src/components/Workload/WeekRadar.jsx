import { AlertTriangle } from 'lucide-react'

const HOURS_PER_DAY = 8

function level(n) {
  if (!n) return 'bg-transparent border border-dashed border-rl-border text-rl-muted'
  if (n <= 2)  return 'bg-rl-cyan/15 text-rl-cyan'
  if (n <= 5)  return 'bg-rl-blue/25 text-rl-text'
  if (n <= 9)  return 'bg-rl-gold/30 text-rl-text'
  return 'bg-rl-red/30 text-rl-text font-bold'
}

/**
 * Radar de prazos (tarefas por dia de vencimento) + carga em horas.
 *
 * A carga em horas só é honesta quando `time_estimate` está preenchido no
 * ClickUp. Onde falta estimativa a célula mostra "Xh+" e um alerta: o número é
 * um piso, não o total. A cobertura real é medida, não presumida.
 */
export default function WeekRadar({ workload }) {
  const { people, days, estimateCoverage } = workload
  const active = people.filter(p => p.byDay.some(n => n > 0))

  return (
    <>
      <div className="flex items-baseline justify-between flex-wrap gap-2 mt-8 mb-3">
        <h2 className="text-base font-bold text-rl-text">Radar de prazos — próximos {days.length} dias</h2>
        <span className="text-[11px] text-rl-muted">
          {days[0]?.label} a {days[days.length - 1]?.label} · tarefas abertas por dia de vencimento
        </span>
      </div>

      {estimateCoverage.pct < 50 && (
        <div className="glass-card border-rl-gold/30 bg-rl-gold/5 px-4 py-3 mb-3 flex gap-3">
          <AlertTriangle className="w-4 h-4 text-rl-gold shrink-0 mt-0.5" />
          <div className="text-[12px] text-rl-subtle leading-relaxed">
            <b className="text-rl-text">Isto conta tarefas, não horas.</b> Só{' '}
            <b className="text-rl-gold">{estimateCoverage.withEstimate} de {estimateCoverage.total} tarefas
            ({estimateCoverage.pct}%)</b> têm horas estimadas preenchidas no ClickUp. Enquanto isso não subir,
            a linha de horas abaixo é um piso — as células marcadas com <b>+</b> têm tarefas sem estimativa.
            A régua de {HOURS_PER_DAY}h/dia só vira medida real de capacidade quando o time preencher
            a estimativa na task.
          </div>
        </div>
      )}

      <div className="glass-card overflow-x-auto">
        <table className="w-full text-[12px] min-w-[640px]">
          <thead>
            <tr className="text-rl-muted">
              <th className="text-left font-medium px-4 py-2.5">Pessoa</th>
              {days.map(d => (
                <th key={d.key} className={`font-medium px-2 py-2.5 ${d.isToday ? 'text-rl-cyan' : ''}`}>
                  {d.label}{d.isToday && ' ·'}
                </th>
              ))}
              <th className="font-medium px-3 py-2.5 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rl-border">
            {active.map(p => {
              const total = p.byDay.reduce((a, b) => a + b, 0)
              return (
                <tr key={p.id}>
                  <td className="px-4 py-2 text-rl-text truncate max-w-[180px]">
                    {p.id === '__none__' ? 'Sem responsável' : p.name}
                  </td>
                  {p.byDay.map((n, i) => {
                    const h   = p.hoursByDay[i]
                    const gap = p.missingByDay[i]
                    return (
                      <td key={days[i].key} className="px-2 py-2 text-center">
                        <div
                          className={`inline-flex flex-col items-center justify-center min-w-[46px] rounded-md px-1.5 py-1 ${level(n)}`}
                          title={gap > 0 ? `${n} tarefa(s) · ${gap} sem estimativa de horas` : `${n} tarefa(s)`}
                        >
                          <span className="leading-none">{n || ''}</span>
                          {n > 0 && (
                            <span className="text-[9px] text-rl-muted mt-0.5 leading-none">
                              {h > 0 ? `${h.toFixed(1)}h` : '—'}{gap > 0 ? '+' : ''}
                            </span>
                          )}
                        </div>
                      </td>
                    )
                  })}
                  <td className="px-3 py-2 text-right font-bold text-rl-text tabular-nums">{total}</td>
                </tr>
              )
            })}
            {active.length === 0 && (
              <tr>
                <td colSpan={days.length + 2} className="px-4 py-8 text-center text-rl-muted">
                  Nenhuma tarefa com vencimento nos próximos {days.length} dias.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
