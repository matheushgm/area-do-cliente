// Peças compartilhadas pelas telas do módulo Sprints: linha de tarefa, barra de carga, cartões,
// campo de texto que grava ao sair e gráfico de burndown.
import { useState, useRef } from 'react'
import { CornerDownRight, ArrowRightLeft } from 'lucide-react'
import { Avatar, FOCO, ItemMenu, Popover, PrioridadeIcon, StatusCampo, StatusIcon, EstimativaCampo } from './Campos'
import { fmtVencimentoClickUp, pessoaDoPerfil, statusDaLista } from '../../lib/tarefas'
import { fmtDiaMes } from '../../lib/vertatask'
import { FOLGA_RECOMENDADA, fmtMin, minutosDaTarefa } from '../../lib/sprints'

export function Tile({ k, v, sub, tom, dica }) {
  const cor = tom === 'red' ? 'text-ln-red' : tom === 'green' ? 'text-ln-green' : tom === 'yellow' ? 'text-ln-yellow' : 'text-ln-t1'
  return (
    <div className="ln-card px-3 py-2.5 min-w-0" title={dica}>
      <p className="text-[11px] uppercase tracking-wider text-ln-t4 font-medium truncate">{k}</p>
      <p className={`text-xl font-semibold tabular tracking-tight ${cor}`}>{v}{sub != null && <span className="text-sm font-normal text-ln-t4"> {sub}</span>}</p>
    </div>
  )
}

const COR_CARGA = { folga: 'bg-ln-green', justa: 'bg-ln-yellow', passou: 'bg-ln-red', vazia: 'bg-ln-ink/20' }
export const TEXTO_CARGA = { folga: 'text-ln-green', justa: 'text-ln-yellow', passou: 'text-ln-red', vazia: 'text-ln-t4' }

/** Barra de carga x capacidade, com a marca da folga recomendada. */
export function BarraCarga({ saude, altura = 8 }) {
  const larg = Math.min(100, Math.round((saude.pct || 0) * 100))
  return (
    <div className="relative rounded-full bg-ln-ink/[0.07] w-full" style={{ height: altura }} role="img" aria-label={`${Math.round((saude.pct || 0) * 100)}% da capacidade`}>
      <div className={`h-full rounded-full transition-[width] duration-200 ${COR_CARGA[saude.nivel]}`} style={{ width: `${larg}%` }} />
      <i className="absolute inset-y-[-2px] w-px bg-ln-ink/40" style={{ left: `${(1 - FOLGA_RECOMENDADA) * 100}%` }} title="Até aqui sobra folga para imprevisto" />
    </div>
  )
}

/** Texto ou objetivo que grava ao sair do campo. */
export function CampoTexto({ valor, onSalvar, placeholder, linhas = 1, className = '', rotulo, somenteLeitura = false }) {
  // fora de foco mostra o valor gravado, para a edição de outra pessoa aparecer na hora
  const [txt, setTxt] = useState('')
  const [focado, setFocado] = useState(false)
  const salvar = () => {
    if (!focado) return
    setFocado(false)
    const novo = txt.trim()
    if (novo !== (valor || '').trim()) onSalvar(novo || null)
  }
  if (somenteLeitura) return <p className={`text-[13px] whitespace-pre-wrap ${valor ? 'text-ln-t2' : 'text-ln-t4'} ${className}`}>{valor || 'Não preenchido'}</p>
  const comum = {
    value: focado ? txt : (valor || ''), placeholder, 'aria-label': rotulo || placeholder,
    onChange: (e) => { setTxt(e.target.value); setFocado(true) }, onFocus: () => { setTxt(valor || ''); setFocado(true) }, onBlur: salvar,
  }
  return linhas > 1
    ? <textarea {...comum} rows={linhas} className={`ln-input !h-auto !py-1.5 w-full resize-y leading-relaxed ${className}`} />
    : <input {...comum} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} className={`ln-input !h-8 w-full ${className}`} />
}

/** Popover para passar a tarefa a outra pessoa da sprint. */
export function BotaoDelegar({ pessoas, membrosMap, onEscolher }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  return (
    <>
      <button ref={ref} type="button" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }} className="ln-iconbtn !w-6 !h-6" aria-label="Passar para outra pessoa" title="Passar para outra pessoa">
        <ArrowRightLeft className="w-3.5 h-3.5" />
      </button>
      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={220} align="right">
        <div className="p-1 overflow-y-auto">
          <p className="px-2.5 py-1.5 text-[11px] text-ln-t4">Passar para</p>
          {pessoas.map((p) => {
            const m = membrosMap.get(p.pessoa_id)
            if (!m) return null
            return <ItemMenu key={p.id} onClick={() => { setOpen(false); onEscolher(p) }}><Avatar pessoa={pessoaDoPerfil(m)} size={18} /><span className="truncate">{m.name}</span></ItemMenu>
          })}
        </div>
      </Popover>
    </>
  )
}

/**
 * Linha de uma tarefa nas telas de sprint. `inicio` e `fim` são as ações das pontas;
 * `editavel` liga os editores de status e estimativa, que gravam na própria tarefa.
 */
export function LinhaTarefa({ tarefa, titulo, ctx, inicio = null, fim = null, editavel = false, etiqueta = null, apagada = false }) {
  if (!tarefa) {
    return (
      <div className="flex items-center gap-2 h-10 px-3 text-[13px] text-ln-t4">
        {inicio}<span className="truncate flex-1">{titulo || 'Tarefa removida'}</span>{fim}
      </div>
    )
  }
  const lista = ctx.listasMap.get(tarefa.lista_id)
  const statuses = statusDaLista(lista)
  const cliente = ctx.clienteDe(tarefa)
  const pai = tarefa.parent_id ? ctx.itens[tarefa.parent_id] : null
  const venc = fmtVencimentoClickUp(tarefa.data_vencimento, tarefa)
  const { min, origem } = minutosDaTarefa(tarefa, ctx.config)
  const inferida = origem !== 'estimativa'
  return (
    <div
      role="button" tabIndex={0}
      onClick={() => ctx.onAbrirTarefa(tarefa.id)}
      onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) ctx.onAbrirTarefa(tarefa.id) }}
      className={`group/lin flex items-center gap-2 min-h-[40px] py-1 px-3 cursor-pointer ln-row-hover ${apagada ? 'opacity-60' : ''} ${tarefa.id === ctx.tarefaAbertaId ? 'bg-ln-accent/[0.06]' : ''} ${FOCO}`}
    >
      {inicio}
      {editavel
        ? <span onClick={(e) => e.stopPropagation()} className="contents"><StatusCampo item={tarefa} statuses={statuses} modo="icon" onChange={(s) => ctx.onStatus(tarefa, s)} /></span>
        : <StatusIcon status={tarefa.status} statuses={statuses} />}
      <div className="flex-1 min-w-0">
        <p className={`text-[13px] leading-snug truncate ${tarefa.status_tipo === 'closed' ? 'text-ln-t4 line-through' : 'text-ln-t1'}`} title={tarefa.titulo}>{titulo || tarefa.titulo}</p>
        <p className="text-[11px] text-ln-t4 truncate flex items-center gap-1">
          {pai && <><CornerDownRight className="w-3 h-3 shrink-0" /><span className="truncate max-w-[45%]" title={pai.titulo}>{pai.titulo}</span><span>·</span></>}
          <span className="truncate" title={cliente}>{cliente}</span>
        </p>
      </div>
      {etiqueta}
      <span className={`w-[58px] text-right text-xs tabular whitespace-nowrap shrink-0 ${venc.classe}`}>{venc.texto}</span>
      <span className="w-4 shrink-0 inline-flex justify-center"><PrioridadeIcon valor={tarefa.prioridade} /></span>
      <span className="w-[50px] text-right shrink-0" onClick={(e) => e.stopPropagation()} title={inferida ? `Sem estimativa: conta ${fmtMin(min)} (${origem}). Clique para estimar.` : undefined}>
        {editavel
          ? <EstimativaCampo valor={tarefa.estimativa_min} onChange={(v) => ctx.onEstimativa(tarefa, v)} render={<span className={inferida ? 'text-ln-t4' : 'text-ln-t2'}>{inferida ? '~' : ''}{fmtMin(min)}</span>} />
          : <span className={`text-xs tabular ${inferida ? 'text-ln-t4' : 'text-ln-t2'}`}>{inferida ? '~' : ''}{fmtMin(min)}</span>}
      </span>
      {fim}
    </div>
  )
}

/** Burndown em dias úteis: guia reta a partir do compromisso e o que falta de verdade. */
export function GraficoBurndown({ bd, nome }) {
  const W = 860, H = 200, L = 40, B = 24, T = 10, R = 20
  const n = bd.ideal.length
  const x = (i) => L + (n > 1 ? (i * (W - L - R)) / (n - 1) : 0)
  const y = (v) => T + (H - T - B) * (1 - v / bd.maximo)
  const pl = (a) => a.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const grade = [0, 1, 2, 3, 4].map((k) => (bd.maximo * k) / 4)
  const ultimo = bd.real.length - 1
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Burndown de ${nome}`}>
      {grade.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="rgb(var(--ln-ink) / 0.08)" />
          <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="rgb(var(--ln-ink) / 0.45)">{fmtMin(v)}</text>
        </g>
      ))}
      {bd.dias.map((d, i) => <text key={d} x={x(i + 1)} y={H - 7} textAnchor="middle" fontSize="10" fill="rgb(var(--ln-ink) / 0.45)">{fmtDiaMes(d)}</text>)}
      <text x={x(0)} y={H - 7} textAnchor="middle" fontSize="10" fill="rgb(var(--ln-ink) / 0.45)">início</text>
      <polyline points={pl(bd.ideal)} fill="none" stroke="rgb(var(--ln-ink) / 0.25)" strokeWidth="2" strokeDasharray="5 4" />
      {bd.real.length > 0 && (
        <>
          <polyline points={pl(bd.real)} fill="none" stroke="rgb(var(--ln-accent))" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(ultimo)} cy={y(bd.real[ultimo])} r="4" fill="rgb(var(--ln-accent))" />
        </>
      )}
    </svg>
  )
}

export function CartaoBurndown({ bd, nome }) {
  return (
    <div className="ln-card p-3">
      <div className="flex items-center justify-between mb-1 gap-3 flex-wrap">
        <p className="text-[13px] font-medium text-ln-t2">Burndown em horas</p>
        <div className="flex items-center gap-3 text-[11px] text-ln-t4">
          <span className="inline-flex items-center gap-1.5"><i className="w-3 h-0.5 bg-ln-ink/25" />Ritmo ideal</span>
          <span className="inline-flex items-center gap-1.5"><i className="w-3 h-0.5 bg-ln-accent" />O que falta</span>
        </div>
      </div>
      {bd.compromisso > 0
        ? <GraficoBurndown bd={bd} nome={nome} />
        : <p className="py-8 text-center text-[13px] text-ln-t4">Nenhuma tarefa nesta sprint ainda.</p>}
    </div>
  )
}

export const fmtPct = (v) => (v == null ? '-' : `${Math.round(v * 100)}%`)
