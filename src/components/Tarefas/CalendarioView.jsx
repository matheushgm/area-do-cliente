// Visualização "Calendário" do VertaTask: tarefas de topo no dia do vencimento.
import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { paraISODia, hojeISO, somarDias } from '../../lib/vertatask'
import { StatusIcon, FOCO } from './Campos'

const SEMANA = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']

function diaDe(item) {
  if (!item.data_vencimento) return null
  return paraISODia(new Date(item.data_vencimento))
}

export default function CalendarioView({ itens, ctx }) {
  const hoje = hojeISO()
  const [ref, setRef] = useState(() => { const d = new Date(); return { a: d.getFullYear(), m: d.getMonth() } })
  const nome = new Date(ref.a, ref.m, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const porDia = useMemo(() => {
    const m = new Map()
    for (const it of itens) {
      const k = diaDe(it)
      if (!k) continue
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(it)
    }
    return m
  }, [itens])
  const semData = useMemo(() => itens.filter((it) => !it.data_vencimento).length, [itens])

  const celulas = useMemo(() => {
    const desvio = (new Date(ref.a, ref.m, 1).getDay() + 6) % 7
    const inicio = paraISODia(new Date(ref.a, ref.m, 1 - desvio))
    const total = Math.ceil((desvio + new Date(ref.a, ref.m + 1, 0).getDate()) / 7) * 7
    return Array.from({ length: total }, (_, i) => somarDias(inicio, i))
  }, [ref])

  const mover = (n) => setRef((r) => { const d = new Date(r.a, r.m + n, 1); return { a: d.getFullYear(), m: d.getMonth() } })

  return (
    <div className="p-3">
      <div className="flex items-center gap-2 mb-3">
        <button type="button" onClick={() => mover(-1)} className="ln-iconbtn" aria-label="Mês anterior"><ChevronLeft className="w-4 h-4" /></button>
        <h2 className="text-sm font-semibold text-ln-t1 min-w-[150px]">{nome.charAt(0).toUpperCase() + nome.slice(1)}</h2>
        <button type="button" onClick={() => mover(1)} className="ln-iconbtn" aria-label="Próximo mês"><ChevronRight className="w-4 h-4" /></button>
        <button type="button" onClick={() => { const d = new Date(); setRef({ a: d.getFullYear(), m: d.getMonth() }) }} className="ln-pill">Hoje</button>
        {semData > 0 && <span className="text-xs text-ln-t4 ml-auto">{semData} sem data de vencimento</span>}
      </div>
      <div className="grid grid-cols-7 rounded-lg border border-ln-ink/5 overflow-hidden bg-ln-panel">
        {SEMANA.map((d) => <div key={d} className="px-2 py-1.5 text-[11px] uppercase tracking-wider text-ln-t4 font-medium border-b border-ln-ink/5 bg-ln-ink/[0.02]">{d}</div>)}
        {celulas.map((k) => {
          const fora = Number(k.slice(5, 7)) - 1 !== ref.m
          const lista = porDia.get(k) || []
          return (
            <div key={k} className={`min-h-[104px] p-1.5 border-b border-r border-ln-ink/5 [&:nth-child(7n)]:border-r-0 ${fora ? 'bg-ln-ink/[0.02]' : ''}`}>
              <span className={`inline-flex items-center justify-center min-w-[22px] h-[22px] rounded-full text-xs tabular mb-1 ${k === hoje ? 'bg-ln-accent text-white font-semibold' : fora ? 'text-ln-t4' : 'text-ln-t2'}`}>{Number(k.slice(8))}</span>
              {lista.slice(0, 4).map((it) => (
                <button key={it.id} type="button" onClick={() => ctx.onAbrir(it.id)} title={it.titulo} className={`w-full flex items-center gap-1.5 h-6 px-1.5 mb-0.5 rounded-md text-left text-xs hover:bg-ln-ink/5 ${FOCO}`}>
                  <StatusIcon status={it.status} statuses={ctx.statuses} size={12} />
                  <span className={`truncate ${it.status_tipo === 'closed' ? 'line-through text-ln-t4' : 'text-ln-t2'}`}>{it.titulo}</span>
                </button>
              ))}
              {lista.length > 4 && <span className="text-[11px] text-ln-t4 px-1.5">+{lista.length - 4} mais</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
