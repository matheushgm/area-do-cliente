// Aba Analytics: números do time nas tarefas (RPC vertatask_analytics), sem carregar
// as tarefas no navegador. Período de 7 a 90 dias.
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { rotuloStatus, prioridade as prioDe } from '../../lib/tarefas'
import { fmtDiaMes } from '../../lib/vertatask'

const PERIODOS = [[7, '7 dias'], [14, '14 dias'], [30, '30 dias'], [90, '90 dias']]
const COR_PRIO = { urgent: '#E2564B', high: '#C99A2E', normal: '#518CFF', low: '#9AA0B2', sem: '#C2C6D2' }

function Tile({ k, v, sub, alerta }) {
  return (
    <div className="ln-card px-4 py-3 min-w-0">
      <p className="text-[11px] uppercase tracking-wider text-ln-t4 font-bold">{k}</p>
      <p className={`text-2xl font-bold tabular vt-display ${alerta ? 'text-ln-red' : 'text-ln-t1'}`}>{v}</p>
      {sub && <p className="text-[11px] text-ln-t4 mt-0.5">{sub}</p>}
    </div>
  )
}

function Cartao({ titulo, children, className = '' }) {
  return <section className={`ln-card p-4 ${className}`}><h3 className="text-[13px] font-bold text-ln-t1 mb-3">{titulo}</h3>{children}</section>
}

function BarrasH({ linhas, cor = 'rgb(var(--ln-accent))', vazio = 'Sem dados no período.' }) {
  const max = Math.max(1, ...linhas.map((l) => l.valor))
  if (!linhas.length) return <p className="text-xs text-ln-t4">{vazio}</p>
  return (
    <div className="flex flex-col gap-2">
      {linhas.map((l) => (
        <div key={l.rotulo} className="flex items-center gap-2 text-[13px]">
          <span className="w-[130px] shrink-0 truncate text-ln-t2" title={l.rotulo}>{l.rotulo}</span>
          <div className="flex-1 h-2.5 rounded-full bg-ln-ink/[0.06] overflow-hidden"><i className="block h-full rounded-full" style={{ width: `${(l.valor / max) * 100}%`, backgroundColor: l.cor || cor }} /></div>
          <span className="w-9 text-right tabular text-ln-t3">{l.valor}</span>
        </div>
      ))}
    </div>
  )
}

function BarrasDuplas({ linhas }) {
  const max = Math.max(1, ...linhas.flatMap((l) => [l.a, l.b]))
  if (!linhas.length) return <p className="text-xs text-ln-t4">Sem dados no período.</p>
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-4 text-[11px] text-ln-t4"><span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-ln-accent" />Abertas</span><span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm bg-ln-green" />Concluídas no período</span></div>
      {linhas.map((l) => (
        <div key={l.rotulo} className="flex items-center gap-2 text-[13px]">
          <span className="w-[130px] shrink-0 truncate text-ln-t2" title={l.rotulo}>{l.rotulo}</span>
          <div className="flex-1 flex flex-col gap-1">
            <div className="h-2 rounded-full bg-ln-ink/[0.06] overflow-hidden"><i className="block h-full rounded-full bg-ln-accent" style={{ width: `${(l.a / max) * 100}%` }} /></div>
            <div className="h-2 rounded-full bg-ln-ink/[0.06] overflow-hidden"><i className="block h-full rounded-full bg-ln-green" style={{ width: `${(l.b / max) * 100}%` }} /></div>
          </div>
          <span className="w-16 text-right tabular text-ln-t3 text-xs">{l.a} · {l.b}</span>
        </div>
      ))}
    </div>
  )
}

function Serie({ serie }) {
  const W = 760, H = 180, L = 28, B = 22, T = 8, R = 8
  if (!serie.length) return <p className="text-xs text-ln-t4">Sem dados no período.</p>
  const max = Math.max(1, ...serie.flatMap((d) => [d.criadas, d.concluidas]))
  const x = (i) => L + (serie.length > 1 ? (i * (W - L - R)) / (serie.length - 1) : 0)
  const y = (v) => T + (H - T - B) * (1 - v / max)
  const pl = (k) => serie.map((d, i) => `${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join(' ')
  const passo = Math.max(1, Math.ceil(serie.length / 8))
  return (
    <div>
      <div className="flex gap-4 text-[11px] text-ln-t4 mb-1"><span className="inline-flex items-center gap-1.5"><i className="w-3 h-0.5 bg-ln-accent" />Criadas</span><span className="inline-flex items-center gap-1.5"><i className="w-3 h-0.5 bg-ln-green" />Concluídas</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Tarefas criadas e concluídas por dia">
        {[0, 0.5, 1].map((f) => <g key={f}><line x1={L} x2={W - R} y1={y(max * f)} y2={y(max * f)} stroke="rgb(var(--ln-ink) / 0.08)" /><text x={L - 5} y={y(max * f) + 3} textAnchor="end" fontSize="10" fill="rgb(var(--ln-ink) / 0.45)">{Math.round(max * f)}</text></g>)}
        {serie.map((d, i) => (i % passo === 0 || i === serie.length - 1) && <text key={d.dia} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="rgb(var(--ln-ink) / 0.45)">{fmtDiaMes(d.dia)}</text>)}
        <polyline points={pl('criadas')} fill="none" stroke="rgb(var(--ln-accent))" strokeWidth="2.2" strokeLinejoin="round" />
        <polyline points={pl('concluidas')} fill="none" stroke="rgb(var(--ln-green))" strokeWidth="2.2" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

export default function AnalyticsView() {
  const [dias, setDias] = useState(30)
  const [d, setD] = useState(null)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    let vivo = true
    setD(null); setErro(null)
    supabase.rpc('vertatask_analytics', { p_dias: dias }).then(({ data, error }) => {
      if (!vivo) return
      if (error) setErro(error.message); else setD(data)
    })
    return () => { vivo = false }
  }, [dias])

  return (
    <div className="p-5 flex flex-col gap-4 max-w-6xl">
      <div className="flex items-center gap-1.5 flex-wrap">
        {PERIODOS.map(([n, rot]) => <button key={n} type="button" onClick={() => setDias(n)} className={`ln-tab ${dias === n ? 'ln-tab-active' : ''}`}>{rot}</button>)}
        <span className="text-xs text-ln-t4 ml-2">Só tarefas de topo, sem subtarefas.</span>
      </div>
      {erro && <p className="text-[13px] text-ln-red">Não consegui carregar: {erro}</p>}
      {!d && !erro && <div className="py-16 flex justify-center text-ln-t4"><Loader2 className="w-4 h-4 animate-spin" /></div>}
      {d && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Tile k="Abertas agora" v={d.abertas} />
            <Tile k="Atrasadas" v={d.atrasadas} alerta={d.atrasadas > 0} sub={d.abertas ? `${Math.round((d.atrasadas / d.abertas) * 100)}% das abertas` : ''} />
            <Tile k="Criadas" v={d.criadas} sub={`últimos ${d.dias} dias`} />
            <Tile k="Concluídas" v={d.concluidas} sub={`últimos ${d.dias} dias`} />
            <Tile k="Tempo até concluir" v={d.tempo_medio_dias != null ? `${String(d.tempo_medio_dias).replace('.', ',')} d` : '-'} sub="média, criação a conclusão" />
          </div>
          <Cartao titulo="Criadas e concluídas por dia"><Serie serie={d.serie || []} /></Cartao>
          <div className="grid gap-4 lg:grid-cols-2">
            <Cartao titulo="Abertas por status"><BarrasH linhas={(d.por_status || []).slice(0, 10).map((s) => ({ rotulo: rotuloStatus(s.status), valor: s.total }))} /></Cartao>
            <Cartao titulo="Abertas por prioridade"><BarrasH linhas={(d.por_prioridade || []).map((p) => ({ rotulo: p.prioridade === 'sem' ? 'Sem prioridade' : prioDe(p.prioridade)?.label || p.prioridade, valor: p.total, cor: COR_PRIO[p.prioridade] }))} /></Cartao>
            <Cartao titulo="Por pessoa"><BarrasDuplas linhas={(d.por_responsavel || []).map((r) => ({ rotulo: r.nome, a: r.abertas, b: r.concluidas }))} /></Cartao>
            <Cartao titulo="Por cliente"><BarrasDuplas linhas={(d.por_cliente || []).map((r) => ({ rotulo: r.nome, a: r.abertas, b: r.concluidas }))} /></Cartao>
          </div>
          <Cartao titulo="Cycles: o que entrou e o que fechou">
            {(d.ciclos || []).length === 0 ? <p className="text-xs text-ln-t4">Nenhum cycle criado ainda.</p> : (
              <div className="flex flex-col gap-2.5">
                {d.ciclos.map((c) => {
                  const pct = c.total ? Math.round((c.concluidas / c.total) * 100) : 0
                  return (
                    <div key={c.nome + c.inicio} className="flex items-center gap-3 text-[13px]">
                      <span className="w-[130px] shrink-0 truncate text-ln-t2">{c.nome}</span>
                      <span className="w-[96px] shrink-0 text-xs text-ln-t4 tabular">{fmtDiaMes(c.inicio)} a {fmtDiaMes(c.fim)}</span>
                      <div className="flex-1 h-2.5 rounded-full bg-ln-ink/[0.06] overflow-hidden"><i className="block h-full rounded-full bg-ln-accent" style={{ width: `${pct}%` }} /></div>
                      <span className="w-[110px] text-right tabular text-ln-t3 text-xs">{c.concluidas} de {c.total} · {pct}%</span>
                    </div>
                  )
                })}
              </div>
            )}
          </Cartao>
        </>
      )}
    </div>
  )
}
