import { ArrowRight } from 'lucide-react'
import { fmtCurrency } from '../../lib/utils'

function fmtNum(n) {
  if (!n || isNaN(n)) return '—'
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}

export default function FunnelViz({ roi }) {
  if (!roi) return null
  const stages = [
    { label: 'Leads', value: roi.leadsNecessarios, pct: 100, color: 'bg-rl-purple' },
    { label: 'MQLs', value: roi.mqlsNecessarios, pct: roi.taxaLeadMql, color: 'bg-rl-blue' },
    { label: 'SQLs', value: roi.sqlsNecessarios, pct: roi.taxaMqlSql, color: 'bg-rl-cyan' },
    { label: 'Vendas', value: roi.vendasNecessarias, pct: roi.taxaSqlVenda, color: 'bg-rl-green' },
  ]

  return (
    <div>
      <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wider mb-3">Funil Projetado</p>
      <div className="flex items-end gap-1 h-20">
        {stages.map((s, i) => {
          const h = Math.max(20, (s.pct / 100) * 80)
          return (
            <div key={s.label} className="flex-1 flex flex-col items-center gap-1.5">
              {i > 0 && (
                <div className="absolute">
                  <ArrowRight className="w-3 h-3 text-rl-muted" />
                </div>
              )}
              <div className="w-full flex flex-col items-center justify-end" style={{ height: '80px' }}>
                <div
                  className={`w-full rounded-t-lg ${s.color} opacity-80 transition-all`}
                  style={{ height: `${h}px` }}
                />
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex gap-1 mt-2">
        {stages.map((s, i) => (
          <div key={s.label} className="flex-1 text-center">
            <p className="text-xs font-bold text-rl-text">{fmtNum(s.value)}</p>
            <p className="text-[9px] text-rl-muted">{s.label}</p>
            {i > 0 && <p className="text-[9px] text-rl-purple">{s.pct}%</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
