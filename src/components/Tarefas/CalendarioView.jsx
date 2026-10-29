// Visualização "Calendário" do VertaTask: tarefas no dia do vencimento, por mês ou por
// semana (domingo a sábado). Na semana cada dia é uma coluna alta com todas as tarefas
// do dia; no mês aparecem até 4 por dia. O modo fica na config da view (ctx.calendario /
// ctx.onCalendario), como o agrupamento.
import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, CornerDownRight } from 'lucide-react'
import { paraISODia, hojeISO, somarDias } from '../../lib/vertatask'
import { StatusIcon, Avatares, FOCO } from './Campos'

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function diaDe(item) {
  if (!item.data_vencimento) return null
  return paraISODia(new Date(item.data_vencimento))
}
const deISO = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d) }
const domingoDe = (k) => somarDias(k, -deISO(k).getDay()) // a semana começa no domingo

function ItemDia({ it, ctx, alto }) {
  const pai = ctx.nomePai?.(it)
  return (
    <button type="button" onClick={() => ctx.onAbrir(it.id)}
      onContextMenu={ctx.onMenuTarefa ? (e) => { e.preventDefault(); ctx.onMenuTarefa(it, e.clientX, e.clientY, 'calendario') } : undefined}
      title={pai ? `${it.titulo} (subtarefa de ${pai})` : it.titulo}
      className={`w-full flex ${alto ? 'items-start gap-1.5 px-2 py-1.5 rounded-lg border border-ln-ink/[0.06] bg-ln-panel hover:border-ln-ink/[0.14]' : 'items-center gap-1.5 h-6 px-1.5 rounded-md hover:bg-ln-ink/5'} mb-1 text-left text-xs ${FOCO}`}>
      <StatusIcon status={it.status} statuses={ctx.statusesDe?.(it) || ctx.statuses} size={12} className={alto ? 'mt-0.5' : ''} />
      {alto ? (
        <span className="flex-1 min-w-0 flex flex-col gap-1">
          <span className={`line-clamp-2 leading-snug ${it.status_tipo === 'closed' ? 'line-through text-ln-t4' : 'text-ln-t1'}`}>{it.titulo}</span>
          {pai && <span className="flex items-center gap-1 text-[11px] text-ln-t4 min-w-0"><CornerDownRight className="w-3 h-3 shrink-0" /><span className="truncate">{pai}</span></span>}
          {(it.responsaveis?.length > 0 || it.responsaveis_extra?.length > 0) && <Avatares item={it} membrosMap={ctx.membrosMap} size={16} max={3} vazio={false} />}
        </span>
      ) : (<>
        {pai && <CornerDownRight className="w-3 h-3 text-ln-t4 shrink-0" aria-label="Subtarefa" />}
        <span className={`truncate ${it.status_tipo === 'closed' ? 'line-through text-ln-t4' : 'text-ln-t2'}`}>{it.titulo}</span>
      </>)}
    </button>
  )
}

export default function CalendarioView({ itens, ctx }) {
  const hoje = hojeISO()
  const modo = ctx.calendario === 'semana' ? 'semana' : 'mes'
  const [ancora, setAncora] = useState(hoje) // um dia do mês ou da semana à mostra
  const ref = useMemo(() => { const d = deISO(ancora); return { a: d.getFullYear(), m: d.getMonth() } }, [ancora])

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
    if (modo === 'semana') { const ini = domingoDe(ancora); return Array.from({ length: 7 }, (_, i) => somarDias(ini, i)) }
    const desvio = new Date(ref.a, ref.m, 1).getDay()
    const inicio = paraISODia(new Date(ref.a, ref.m, 1 - desvio))
    const total = Math.ceil((desvio + new Date(ref.a, ref.m + 1, 0).getDate()) / 7) * 7
    return Array.from({ length: total }, (_, i) => somarDias(inicio, i))
  }, [modo, ancora, ref])

  const titulo = (() => {
    if (modo === 'mes') { const n = new Date(ref.a, ref.m, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); return n.charAt(0).toUpperCase() + n.slice(1) }
    const a = deISO(celulas[0]), b = deISO(celulas[6])
    return a.getMonth() === b.getMonth()
      ? `${a.getDate()} – ${b.getDate()} ${MESES_CURTOS[b.getMonth()]} ${b.getFullYear()}`
      : `${a.getDate()} ${MESES_CURTOS[a.getMonth()]} – ${b.getDate()} ${MESES_CURTOS[b.getMonth()]} ${b.getFullYear()}`
  })()
  const mover = (n) => setAncora((k) => (modo === 'semana' ? somarDias(k, 7 * n) : paraISODia(new Date(deISO(k).getFullYear(), deISO(k).getMonth() + n, 1))))
  const rotuloMover = modo === 'semana' ? 'semana' : 'mês'

  return (
    <div className="p-3">
      <div className="flex items-center gap-2 mb-3">
        <button type="button" onClick={() => mover(-1)} className="ln-iconbtn" aria-label={`${rotuloMover} anterior`}><ChevronLeft className="w-4 h-4" /></button>
        <h2 className="text-sm font-semibold text-ln-t1 min-w-[170px] text-center tabular">{titulo}</h2>
        <button type="button" onClick={() => mover(1)} className="ln-iconbtn" aria-label={modo === 'semana' ? 'Próxima semana' : 'Próximo mês'}><ChevronRight className="w-4 h-4" /></button>
        <button type="button" onClick={() => setAncora(hoje)} className="ln-pill">Hoje</button>
        {ctx.onCalendario && (
          <span className="inline-flex items-center p-0.5 rounded-lg bg-ln-ink/[0.05] ml-1" role="group" aria-label="Escala do calendário">
            {[['mes', 'Mês'], ['semana', 'Semana']].map(([k, l]) => (
              <button key={k} type="button" onClick={() => ctx.onCalendario(k)} aria-pressed={modo === k}
                className={`h-7 px-2.5 rounded-md text-xs font-medium ${modo === k ? 'bg-ln-panel text-ln-t1 shadow-sm' : 'text-ln-t3 hover:text-ln-t1'} ${FOCO}`}>{l}</button>
            ))}
          </span>
        )}
        {semData > 0 && <span className="text-xs text-ln-t4 ml-auto">{semData} sem data de vencimento</span>}
      </div>
      <div className="grid grid-cols-7 rounded-lg border border-ln-ink/5 overflow-hidden bg-ln-panel">
        {celulas.slice(0, 7).map((k, i) => (
          <div key={`cab-${i}`} className="px-2 py-1.5 text-[11px] uppercase tracking-wider text-ln-t4 font-medium border-b border-ln-ink/5 bg-ln-ink/[0.02]">
            {SEMANA[i]}{modo === 'semana' && <span className={`ml-1.5 normal-case tracking-normal text-xs tabular ${k === hoje ? 'text-ln-accent font-semibold' : 'text-ln-t2'}`}>{Number(k.slice(8))}</span>}
          </div>
        ))}
        {celulas.map((k) => {
          const fora = modo === 'mes' && Number(k.slice(5, 7)) - 1 !== ref.m
          const lista = porDia.get(k) || []
          if (modo === 'semana') {
            return (
              <div key={k} className={`min-h-[60vh] p-1.5 border-r border-ln-ink/5 [&:nth-child(7n)]:border-r-0 ${k === hoje ? 'bg-ln-accent/[0.04]' : ''}`}>
                {lista.map((it) => <ItemDia key={it.id} it={it} ctx={ctx} alto />)}
                {!lista.length && <span className="block text-center text-[11px] text-ln-t4 pt-3">—</span>}
              </div>
            )
          }
          return (
            <div key={k} className={`min-h-[104px] p-1.5 border-b border-r border-ln-ink/5 [&:nth-child(7n)]:border-r-0 ${fora ? 'bg-ln-ink/[0.02]' : ''}`}>
              <span className={`inline-flex items-center justify-center min-w-[22px] h-[22px] rounded-full text-xs tabular mb-1 ${k === hoje ? 'bg-ln-accent text-white font-semibold' : fora ? 'text-ln-t4' : 'text-ln-t2'}`}>{Number(k.slice(8))}</span>
              {lista.slice(0, 4).map((it) => <ItemDia key={it.id} it={it} ctx={ctx} />)}
              {lista.length > 4 && (
                <button type="button" onClick={() => { setAncora(k); ctx.onCalendario?.('semana') }} className="text-[11px] text-ln-t4 hover:text-ln-accent px-1.5" title="Ver a semana">+{lista.length - 4} mais</button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
