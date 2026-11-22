// Dashboard de tráfego no portal: o resumo do mês de todas as contas do projeto (Meta e
// Google) e, embaixo, o mesmo viewer do link compartilhado, com o token de 24 h que o
// api/portal.js gera para cada conta. Um lugar só para o cliente, sem link solto.
import { useMemo, useState } from 'react'
import { BarChart3, TrendingUp, TrendingDown, Maximize2 } from 'lucide-react'
import { Empty } from './PortalUI'

const CANAL = { meta: 'Meta Ads', google: 'Google Ads' }
const brl = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: n >= 1000 ? 0 : 2 })
const int = (n) => Math.round(Number(n) || 0).toLocaleString('pt-BR')
const dia = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '')

function variacao(atual, antes) {
  if (!antes) return null
  return (atual - antes) / antes
}

function Delta({ v, inverso = false }) {
  if (v == null || !Number.isFinite(v)) return <span className="text-[11px] text-rl-muted">sem comparação</span>
  const bom = inverso ? v < 0 : v > 0
  const Ic = v >= 0 ? TrendingUp : TrendingDown
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${Math.abs(v) < 0.005 ? 'text-rl-muted' : bom ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
      <Ic className="w-3.5 h-3.5" />{v >= 0 ? '+' : ''}{(v * 100).toFixed(0)}% vs mês passado
    </span>
  )
}

function Kpi({ rotulo, valor, delta, inverso, dica }) {
  return (
    <div className="rounded-xl bg-rl-surface p-3 sm:p-4" title={dica}>
      <p className="text-[11px] sm:text-xs font-semibold text-rl-muted">{rotulo}</p>
      <p className="text-xl sm:text-2xl font-bold text-rl-text tabular-nums mt-0.5">{valor}</p>
      <div className="mt-1"><Delta v={delta} inverso={inverso} /></div>
    </div>
  )
}

// Barras do investimento por dia do mês, com as conversões por cima de cada barra no hover.
function Barras({ diario, ini, ate }) {
  const dias = useMemo(() => {
    const out = []
    if (!ini || !ate) return out
    const fim = Number(ate.slice(8, 10))
    const porDia = Object.fromEntries(diario.map((d) => [d.dia, d]))
    for (let d = 1; d <= fim; d++) {
      const k = `${ini.slice(0, 8)}${String(d).padStart(2, '0')}`
      out.push({ dia: k, investimento: porDia[k]?.investimento || 0, conversoes: porDia[k]?.conversoes || 0 })
    }
    return out
  }, [diario, ini, ate])
  const max = Math.max(1, ...dias.map((d) => d.investimento))
  if (!dias.length) return null
  return (
    <div>
      <div className="flex items-end gap-[3px] h-24" role="img" aria-label="Investimento por dia no mês">
        {dias.map((d) => (
          <div key={d.dia} className="flex-1 min-w-0 h-full flex items-end group relative">
            <div className="w-full rounded-t bg-rl-purple/70 group-hover:bg-rl-purple transition-colors" style={{ height: `${Math.max(d.investimento ? 3 : 0, (d.investimento / max) * 100)}%` }} />
            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block whitespace-nowrap rounded-md bg-rl-text text-rl-card text-[11px] px-2 py-1 z-10">
              {dia(d.dia)}: {brl(d.investimento)} · {int(d.conversoes)} conv.
            </span>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-rl-muted mt-1"><span>{dia(dias[0].dia)}</span><span>{dia(dias[dias.length - 1].dia)}</span></div>
    </div>
  )
}

export default function PortalDashboard({ data }) {
  const contas = useMemo(() => data?.contas || [], [data])
  const [sel, setSel] = useState(0)
  const [alto, setAlto] = useState(false)
  const total = useMemo(() => {
    const soma = (k, campo) => contas.reduce((s, c) => s + (Number(c[k]?.[campo]) || 0), 0)
    const diario = {}
    for (const c of contas) for (const d of c.diario || []) {
      const x = (diario[d.dia] ||= { dia: d.dia, investimento: 0, conversoes: 0 })
      x.investimento += d.investimento; x.conversoes += d.conversoes
    }
    return {
      inv: soma('mes', 'investimento'), conv: soma('mes', 'conversoes'), cliques: soma('mes', 'cliques'),
      invAnt: soma('anterior', 'investimento'), convAnt: soma('anterior', 'conversoes'), cliquesAnt: soma('anterior', 'cliques'),
      diario: Object.values(diario),
    }
  }, [contas])

  if (!contas.length) return <Empty text="Nenhuma conta de anúncio ligada ainda." hint="Assim que a primeira campanha rodar, os números aparecem aqui." />

  const atual = contas[Math.min(sel, contas.length - 1)]
  const cpa = total.conv ? total.inv / total.conv : null
  const cpaAnt = total.convAnt ? total.invAnt / total.convAnt : null
  const src = `/dash-teste/viewer.html?cliente=${encodeURIComponent(atual.conta)}&canal=${atual.canal}&shared=1&t=${encodeURIComponent(atual.token)}`
  const p = data.periodo || {}

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <p className="text-sm font-semibold text-rl-text">Este mês{p.de ? `, de ${dia(p.de)} a ${dia(p.ate)}` : ''}</p>
          <p className="text-[11px] text-rl-muted">{contas.length > 1 ? `${contas.length} contas somadas` : `${CANAL[atual.canal]} · ${atual.conta}`}</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          <Kpi rotulo="Investimento" valor={brl(total.inv)} delta={variacao(total.inv, total.invAnt)} />
          <Kpi rotulo="Conversões" valor={int(total.conv)} delta={variacao(total.conv, total.convAnt)} dica="Conversas no WhatsApp, leads e vendas no Meta; conversões no Google" />
          <Kpi rotulo="Custo por conversão" valor={cpa ? brl(cpa) : '—'} delta={cpa && cpaAnt ? variacao(cpa, cpaAnt) : null} inverso />
          <Kpi rotulo="Cliques" valor={int(total.cliques)} delta={variacao(total.cliques, total.cliquesAnt)} />
        </div>
        <div className="mt-4"><Barras diario={total.diario} ini={p.de} ate={p.ate} /></div>
        <p className="text-[11px] text-rl-muted mt-2">A comparação usa o mesmo trecho do mês passado ({dia(p.anteriorDe)} a {dia(p.anteriorAte)}).</p>
      </div>

      {contas.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Contas">
          {contas.map((c, i) => (
            <button key={`${c.canal}|${c.conta}`} type="button" role="tab" aria-selected={i === sel} onClick={() => setSel(i)}
              className={`text-left rounded-xl border px-3 py-2 transition ${i === sel ? 'border-rl-purple bg-rl-purple/[0.06] ring-1 ring-rl-purple' : 'border-rl-border bg-rl-card hover:border-rl-purple/40'}`}>
              <span className="block text-[11px] font-semibold text-rl-muted">{CANAL[c.canal]}</span>
              <span className="block text-sm font-semibold text-rl-text">{c.conta}</span>
              <span className="block text-[11px] text-rl-muted tabular-nums">{brl(c.mes.investimento)} · {int(c.mes.conversoes)} conv.</span>
            </button>
          ))}
        </div>
      )}

      <div className="glass-card !p-0 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-rl-border flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-rl-purple" />
          <p className="text-sm font-semibold text-rl-text truncate">{CANAL[atual.canal]} · {atual.conta}</p>
          <button type="button" onClick={() => setAlto((v) => !v)} className="ml-auto text-xs font-semibold text-rl-muted hover:text-rl-text inline-flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-rl-surface">
            <Maximize2 className="w-3.5 h-3.5" /> {alto ? 'Tamanho normal' : 'Ver maior'}
          </button>
        </div>
        <iframe key={src} title={`Dashboard ${atual.conta}`} src={src} className="w-full block border-0 bg-white" style={{ height: alto ? 'calc(100vh - 120px)' : 'max(760px, calc(100vh - 260px))' }} />
      </div>
    </div>
  )
}
