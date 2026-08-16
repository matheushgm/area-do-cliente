import { BUCKETS } from '../../lib/workload'

function Stat({ n, label, tone = '' }) {
  return (
    <div className="glass-card px-4 py-3 flex-1 min-w-[150px]">
      <div className={`text-2xl font-bold leading-none ${tone || 'text-rl-text'}`}>{n}</div>
      <div className="text-[11px] text-rl-muted mt-1.5 leading-tight">{label}</div>
    </div>
  )
}

/**
 * Barras de carga por pessoa, segmentadas por status. Clicar abre o detalhe.
 */
export default function WorkloadBoard({ workload, onSelectPerson }) {
  const { people, maxTotal, totalOpen, totalOverdue, peopleCount, topPerson } = workload

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Stat n={totalOpen} label="tarefas abertas (distintas)" />
        <Stat n={totalOverdue} label="com prazo vencido" tone={totalOverdue > 0 ? 'text-rl-red' : ''} />
        <Stat n={peopleCount} label="pessoas com tarefas atribuídas" />
        <Stat
          n={maxTotal}
          label={topPerson ? `maior carga individual (${topPerson.name.split(' ')[0]})` : 'maior carga individual'}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-5 mb-3 text-[11px] text-rl-muted">
        {BUCKETS.map(b => (
          <span key={b.key} className="inline-flex items-center gap-1.5">
            <i className={`w-2.5 h-2.5 rounded-sm ${b.cls}`} />{b.label}
          </span>
        ))}
        <span className="ml-auto">
          uma tarefa com 2 responsáveis conta para os dois — a soma das linhas pode passar de {totalOpen}
        </span>
      </div>

      <div className="glass-card divide-y divide-rl-border">
        {people.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-rl-muted">
            Nenhuma tarefa aberta no cache. Rode um sync completo para popular.
          </div>
        )}
        {people.map(p => {
          const pct   = p.total ? Math.round((p.overdue.length / p.total) * 100) : 0
          const width = maxTotal ? Math.max((p.total / maxTotal) * 100, 4) : 0
          return (
            <button
              key={p.id}
              onClick={() => onSelectPerson(p)}
              className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-rl-surface/60 transition-colors"
            >
              <div className="w-44 shrink-0 min-w-0">
                <div className="text-sm font-semibold text-rl-text truncate">
                  {p.id === '__none__' ? 'Sem responsável' : p.name}
                </div>
                {p.overdue.length > 0 ? (
                  <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                    pct >= 40 ? 'bg-rl-red/15 text-rl-red' : 'bg-rl-gold/15 text-rl-gold'
                  }`}>
                    {p.overdue.length} vencidas · {pct}%
                  </span>
                ) : (
                  <span className="text-[10px] text-rl-muted">em dia</span>
                )}
              </div>

              <div className="flex-1 h-5 rounded-md bg-rl-surface overflow-hidden min-w-0">
                <div className="flex h-full" style={{ width: `${width}%` }}>
                  {BUCKETS.map(b => {
                    const n = p.buckets[b.key].length
                    if (!n) return null
                    return (
                      <div
                        key={b.key}
                        className={b.cls}
                        style={{ width: `${(n / p.total) * 100}%` }}
                        title={`${b.label}: ${n}`}
                      />
                    )
                  })}
                </div>
              </div>

              <div className="w-10 text-right text-sm font-bold text-rl-text tabular-nums">{p.total}</div>
            </button>
          )
        })}
      </div>
    </>
  )
}
