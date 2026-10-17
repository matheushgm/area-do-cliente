// Visualização "Gantt": cada tarefa com datas vira uma barra do início ao vencimento.
// Janela de 8 semanas com navegação; sem início, a barra é só o dia do vencimento.
import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { acharStatus } from '../../lib/tarefas'
import { paraISODia, hojeISO, somarDias, diasEntre, paraDiaLocal } from '../../lib/vertatask'
import { FOCO } from './Campos'

const DIA_PX = 30
const SEMANAS = 8
const ESQ = 280

function isoDe(v) { return v ? paraISODia(new Date(v)) : null }

export default function GanttView({ itens, ctx }) {
  const hoje = hojeISO()
  const [offset, setOffset] = useState(-1) // semanas em relação à segunda atual
  const inicio = useMemo(() => {
    const d = paraDiaLocal(hoje)
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7)
    return paraISODia(d)
  }, [hoje, offset])
  const total = SEMANAS * 7
  const dias = useMemo(() => Array.from({ length: total }, (_, i) => somarDias(inicio, i)), [inicio, total])

  const { comData, semData } = useMemo(() => {
    const com = []
    let sem = 0
    for (const it of itens) {
      const venc = isoDe(it.data_vencimento), ini = isoDe(it.data_inicio)
      if (!venc && !ini) { sem++; continue }
      const a = ini || venc, b = venc || ini
      com.push({ it, a: a <= b ? a : b, b: a <= b ? b : a })
    }
    com.sort((x, y) => (x.a < y.a ? -1 : x.a > y.a ? 1 : 0))
    return { comData: com, semData: sem }
  }, [itens])

  const visiveis = comData.filter(({ a, b }) => b >= dias[0] && a <= dias[total - 1])
  const hojeIdx = diasEntre(inicio, hoje)

  return (
    <div className="p-3">
      <div className="flex items-center gap-2 mb-3">
        <button type="button" onClick={() => setOffset((o) => o - 4)} className="ln-iconbtn" aria-label="Voltar 4 semanas"><ChevronLeft className="w-4 h-4" /></button>
        <button type="button" onClick={() => setOffset((o) => o + 4)} className="ln-iconbtn" aria-label="Avançar 4 semanas"><ChevronRight className="w-4 h-4" /></button>
        <button type="button" onClick={() => setOffset(-1)} className="ln-pill">Hoje</button>
        <span className="text-xs text-ln-t4 ml-2">{visiveis.length} na janela{semData > 0 ? ` · ${semData} sem datas` : ''}</span>
      </div>
      <div className="ln-card overflow-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
        <div style={{ width: ESQ + total * DIA_PX, minWidth: '100%' }}>
          <div className="sticky top-0 z-20 flex bg-ln-panel border-b border-ln-ink/[0.08]">
            <div className="sticky left-0 z-30 bg-ln-panel border-r border-ln-ink/[0.08] px-3 flex items-center text-[11px] uppercase tracking-wider font-bold text-ln-t4" style={{ width: ESQ }}>Tarefa</div>
            <div className="flex">
              {dias.map((d) => {
                const dt = paraDiaLocal(d), fim = dt.getDay() === 0 || dt.getDay() === 6, segunda = dt.getDay() === 1
                return (
                  <div key={d} className={`flex flex-col items-center justify-center h-10 text-[10px] tabular border-r border-ln-ink/5 ${fim ? 'bg-ln-ink/[0.03]' : ''} ${d === hoje ? 'text-ln-accent font-bold' : 'text-ln-t4'}`} style={{ width: DIA_PX }}>
                    {segunda && <span className="text-[9px] font-semibold text-ln-t3">{String(dt.getDate()).padStart(2, '0')}/{String(dt.getMonth() + 1).padStart(2, '0')}</span>}
                    <span>{dt.getDate()}</span>
                  </div>
                )
              })}
            </div>
          </div>
          {!visiveis.length && <p className="py-12 text-center text-[13px] text-ln-t4">Nenhuma tarefa com datas nesta janela.</p>}
          {visiveis.map(({ it, a, b }) => {
            const st = acharStatus(ctx.statuses, it.status)
            const ia = Math.max(0, diasEntre(inicio, a)), ib = Math.min(total - 1, diasEntre(inicio, b))
            return (
              <div key={it.id} className="flex h-9 border-b border-ln-ink/5 hover:bg-ln-ink/[0.02]">
                <button type="button" onClick={() => ctx.onAbrir(it.id)} title={it.titulo} className={`sticky left-0 z-10 bg-ln-panel border-r border-ln-ink/[0.08] px-3 text-left text-[13px] truncate ${it.status_tipo === 'closed' ? 'text-ln-t4 line-through' : 'text-ln-t2'} hover:text-ln-accent ${FOCO}`} style={{ width: ESQ }}>{it.titulo}</button>
                <div className="relative flex-1" style={{ width: total * DIA_PX }}>
                  {hojeIdx >= 0 && hojeIdx < total && <i className="absolute top-0 bottom-0 w-px bg-ln-accent/50" style={{ left: hojeIdx * DIA_PX + DIA_PX / 2 }} />}
                  <button
                    type="button"
                    onClick={() => ctx.onAbrir(it.id)}
                    title={`${it.titulo}: ${a === b ? a : `${a} a ${b}`}`}
                    className={`absolute top-1.5 h-6 rounded-md text-[11px] font-semibold text-white px-2 truncate text-left ${FOCO}`}
                    style={{ left: ia * DIA_PX + 2, width: Math.max(DIA_PX - 4, (ib - ia + 1) * DIA_PX - 4), backgroundColor: st.cor || '#2A25F0', opacity: it.status_tipo === 'closed' ? 0.55 : 1 }}
                  >
                    {(ib - ia + 1) * DIA_PX > 90 ? it.titulo : ''}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
