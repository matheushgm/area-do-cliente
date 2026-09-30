// Movimentação da base na home: card de Novos Clientes (espelho do card de
// Churn), a análise de Net MRR do mês e o modal de histórico que compara
// entradas × saídas mês a mês.
import { useState } from 'react'
import {
  UserPlus, TrendingUp, TrendingDown, History, Calendar,
  ArrowRight, Activity, Minus,
} from 'lucide-react'
import Modal from '../UI/Modal'
import { fmtCurrency, mrrValue, entryDate } from '../../lib/utils'
import { netStats, netSeries, monthOptions, monthLabel } from '../../lib/growth'

const fmtEntryDate = (p) => {
  const d = entryDate(p)
  return d ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
}

const fmtChurnDate = (p) => (
  p.churnDate
    ? new Date(p.churnDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—'
)

function squadOf(squads, p) {
  return (squads || []).find(s => String(s.id) === String(p.squad)) || null
}

// ─── Card "Novos Clientes" do mês corrente ──────────────────────────────────
export function NovosClientesCard({ stats, monthLabel: label, onOpenList, onOpenHistory }) {
  const has = stats.count > 0
  return (
    <div className={`glass-card p-5 relative transition-all ${has ? 'border-rl-green/30' : ''}`}>
      <button
        type="button"
        onClick={onOpenHistory}
        title="Ver histórico de entradas (períodos anteriores)"
        aria-label="Histórico de novos clientes"
        className="absolute top-2 right-2 p-1.5 rounded-lg text-rl-muted/60 hover:text-rl-green hover:bg-rl-green/10 transition-all"
      >
        <History className="w-3.5 h-3.5" />
      </button>

      <div
        onClick={() => has && onOpenList()}
        role={has ? 'button' : undefined}
        tabIndex={has ? 0 : undefined}
        onKeyDown={(e) => {
          if (has && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpenList() }
        }}
        className={`flex items-start justify-between gap-3 ${
          has ? 'cursor-pointer hover:opacity-90 -m-5 p-5 rounded-xl hover:bg-rl-green/5 transition-all' : ''
        }`}
      >
        <div className="min-w-0">
          <p className="text-xs text-rl-muted">Novos — {label}</p>
          <p className={`text-2xl font-bold mt-1 leading-tight ${has ? 'text-rl-green' : 'text-rl-text'}`}>
            {stats.count} {stats.count === 1 ? 'cliente' : 'clientes'}
          </p>
          {has ? (
            <div className="mt-1.5 space-y-0.5">
              <p className="text-[11px] text-rl-muted">
                <span className="text-rl-green font-semibold">{fmtCurrency(stats.mrr)}</span> em MRR novo
              </p>
              <p className="text-[11px] text-rl-muted">
                <span className="text-rl-green font-semibold">{fmtCurrency(stats.contract)}</span> em contrato cheio
              </p>
              <p className="text-[10px] text-rl-green/80 mt-1 font-medium">Clique para ver lista →</p>
            </div>
          ) : (
            <p className="text-[11px] text-rl-muted mt-1">Nenhuma entrada neste mês</p>
          )}
        </div>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${has ? 'bg-rl-green/10 text-rl-green' : 'bg-rl-muted/10 text-rl-muted'}`}>
          <UserPlus className="w-5 h-5" />
        </div>
      </div>
    </div>
  )
}

// ─── Modal: lista de entradas do mês corrente ───────────────────────────────
export function NovosClientesModal({ stats, monthLabel: label, squads, onClose, onOpenProject }) {
  const list = [...stats.list].sort((a, b) => {
    const da = entryDate(a)?.getTime() ?? 0
    const db = entryDate(b)?.getTime() ?? 0
    return db - da
  })
  return (
    <Modal onClose={onClose} maxWidth="2xl" className="border-rl-green/30">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-rl-green/10 border border-rl-green/30 flex items-center justify-center text-rl-green shrink-0">
          <UserPlus className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-rl-text">Novos Clientes — {label}</h3>
          <p className="text-xs text-rl-muted">
            {stats.count} {stats.count === 1 ? 'cliente entrou' : 'clientes entraram'} neste mês ·
            <span className="text-rl-green font-semibold"> {fmtCurrency(stats.mrr)}</span> em MRR ·
            <span className="text-rl-green font-semibold"> {fmtCurrency(stats.contract)}</span> em contrato cheio
          </p>
        </div>
      </div>

      <div className="max-h-[60vh] overflow-y-auto -mx-6 px-6 -mb-6 pb-6">
        <div className="space-y-2">
          {list.map(p => {
            const squad = squadOf(squads, p)
            const churned = p.momento === 'churn'
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onOpenProject(p.id)}
                className="w-full flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border border-rl-border hover:border-rl-green/40 hover:bg-rl-green/5 transition-all text-left group"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-rl-text group-hover:text-rl-green transition-colors leading-tight truncate">
                    {p.companyName || '—'}
                    {churned && (
                      <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-400/10 text-red-400 border border-red-400/30 align-middle">
                        já churnou
                      </span>
                    )}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[11px] text-rl-muted">
                    {squad?.name && (
                      <span className="inline-flex items-center gap-1">
                        {squad.emoji && <span>{squad.emoji}</span>}
                        {squad.name}
                      </span>
                    )}
                    {squad?.name && <span>·</span>}
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Entrou em {fmtEntryDate(p)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-6 shrink-0">
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-rl-muted font-semibold">MRR</p>
                    <p className="text-sm font-bold text-rl-green">{fmtCurrency(mrrValue(p))}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-rl-muted font-semibold">Contrato</p>
                    <p className="text-sm font-bold text-rl-green">{fmtCurrency(Number(p.contractValue) || 0)}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}

// ─── Gráfico de barras: Net MRR por mês (positivo acima, negativo abaixo) ───
function NetBars({ series, highlightKey }) {
  const max = Math.max(...series.map(s => Math.abs(s.net)), 1)
  return (
    <div>
      <div className="flex items-stretch justify-between gap-2">
        {series.map((s) => {
          const pct = (Math.abs(s.net) / max) * 100
          const isUp = s.net > 0
          const isFlat = s.net === 0
          const strong = highlightKey === `${s.yyyy}-${s.mm}`
          const color = isFlat
            ? 'bg-rl-muted/30'
            : isUp
              ? (strong ? 'bg-rl-green' : 'bg-rl-green/60')
              : (strong ? 'bg-red-400' : 'bg-red-400/60')
          return (
            <div
              key={`${s.yyyy}-${s.mm}`}
              className="flex-1 min-w-0 flex flex-col items-center"
              title={`${s.label}: ${s.novos.count} entrada(s) ${fmtCurrency(s.novos.mrr)} · ${s.churn.count} saída(s) ${fmtCurrency(s.churn.mrr)} · net ${fmtCurrency(s.net)}`}
            >
              {/* metade de cima = crescimento */}
              <div className="w-full h-14 flex items-end justify-center">
                {isUp && (
                  <div className={`w-full rounded-t ${color}`} style={{ height: `${Math.max(pct, 4)}%` }} />
                )}
              </div>
              <div className="w-full border-t border-rl-border" />
              {/* metade de baixo = perda */}
              <div className="w-full h-14 flex items-start justify-center">
                {!isUp && !isFlat && (
                  <div className={`w-full rounded-b ${color}`} style={{ height: `${Math.max(pct, 4)}%` }} />
                )}
              </div>
              <span className={`text-[10px] mt-1 truncate w-full text-center ${strong ? 'text-rl-text font-semibold' : 'text-rl-muted'}`}>
                {s.labelShort}
              </span>
              <span className={`text-[10px] tabular-nums leading-none ${isFlat ? 'text-rl-muted' : isUp ? 'text-rl-green' : 'text-red-400'}`}>
                {isFlat ? '—' : `${isUp ? '+' : '−'}${fmtCurrency(Math.abs(s.net))}`}
              </span>
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-3 mt-3 text-[10px] text-rl-muted">
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-rl-green" />Net positivo</span>
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-400" />Net negativo</span>
      </div>
    </div>
  )
}

// ─── Seção da home: análise de Net MRR do mês ───────────────────────────────
export function NetMrrSection({ projects, yyyy, mm, onOpenHistory }) {
  const cur = netStats(projects, yyyy, mm)
  const series = netSeries(projects, yyyy, mm, 6)
  const prev = series.length > 1 ? series[series.length - 2] : null

  const up = cur.net > 0
  const flat = cur.net === 0
  const netColor = flat ? 'text-rl-text' : up ? 'text-rl-green' : 'text-red-400'
  const NetIcon = flat ? Minus : up ? TrendingUp : TrendingDown

  // Soma dos últimos 6 meses — mostra se a base está crescendo no acumulado
  const net6 = series.reduce((acc, s) => acc + s.net, 0)

  return (
    <div className="glass-card p-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            flat ? 'bg-rl-muted/10 text-rl-muted' : up ? 'bg-rl-green/10 text-rl-green' : 'bg-red-400/10 text-red-400'
          }`}>
            <Activity className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-rl-text">Net MRR — {cur.label}</p>
            <p className="text-[11px] text-rl-muted mt-0.5">
              Quanto a base cresceu no mês: MRR que entrou menos o que saiu.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenHistory}
          className="inline-flex items-center gap-1.5 self-start px-2.5 py-1.5 rounded-lg border border-rl-border text-[11px] font-semibold text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all shrink-0"
        >
          <History className="w-3.5 h-3.5" />
          Histórico
        </button>
      </div>

      {/* Número principal */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-1 mb-5">
        <p className={`text-3xl font-bold leading-none tabular-nums ${netColor}`}>
          {flat ? fmtCurrency(0) : `${up ? '+' : '−'}${fmtCurrency(Math.abs(cur.net))}`}
        </p>
        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${netColor}`}>
          <NetIcon className="w-3.5 h-3.5" />
          {cur.growthPct == null
            ? 'sem base para comparar'
            : `${up ? '+' : flat ? '' : '−'}${Math.abs(cur.growthPct).toFixed(1)}% sobre ${fmtCurrency(cur.mrrInicial)}`}
        </span>
        {prev && (
          <span className="text-[11px] text-rl-muted">
            mês anterior: <span className={prev.net > 0 ? 'text-rl-green font-semibold' : prev.net < 0 ? 'text-red-400 font-semibold' : 'font-semibold'}>
              {prev.net === 0 ? fmtCurrency(0) : `${prev.net > 0 ? '+' : '−'}${fmtCurrency(Math.abs(prev.net))}`}
            </span>
          </span>
        )}
      </div>

      {/* Composição do mês */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="rounded-xl border border-rl-border bg-rl-surface/30 p-3">
          <p className="text-[10px] uppercase tracking-wider text-rl-muted font-semibold">MRR no dia 1º</p>
          <p className="text-base font-bold text-rl-text mt-1 tabular-nums">{fmtCurrency(cur.mrrInicial)}</p>
        </div>
        <div className="rounded-xl border border-rl-green/25 bg-rl-green/5 p-3">
          <p className="text-[10px] uppercase tracking-wider text-rl-green font-semibold">+ Novos ({cur.novos.count})</p>
          <p className="text-base font-bold text-rl-green mt-1 tabular-nums">{fmtCurrency(cur.novos.mrr)}</p>
        </div>
        <div className="rounded-xl border border-red-400/25 bg-red-400/5 p-3">
          <p className="text-[10px] uppercase tracking-wider text-red-400 font-semibold">− Churn ({cur.churn.count})</p>
          <p className="text-base font-bold text-red-400 mt-1 tabular-nums">{fmtCurrency(cur.churn.mrr)}</p>
          {cur.churnRatePct != null && (
            <p className="text-[10px] text-rl-muted mt-0.5">{cur.churnRatePct.toFixed(1)}% da base</p>
          )}
        </div>
        <div className="rounded-xl border border-rl-purple/25 bg-rl-purple/5 p-3">
          <p className="text-[10px] uppercase tracking-wider text-rl-purple font-semibold flex items-center gap-1">
            <ArrowRight className="w-3 h-3" /> MRR hoje
          </p>
          <p className="text-base font-bold text-rl-purple mt-1 tabular-nums">{fmtCurrency(cur.mrrFinal)}</p>
          <p className="text-[10px] text-rl-muted mt-0.5">
            {cur.netCount === 0 ? 'mesma quantidade de contas' : `${cur.netCount > 0 ? '+' : '−'}${Math.abs(cur.netCount)} conta${Math.abs(cur.netCount) === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>

      {/* Série dos últimos 6 meses */}
      <div className="rounded-xl border border-rl-border bg-rl-surface/30 p-4">
        <div className="flex items-center justify-between mb-3 gap-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-rl-muted">Net MRR por mês (últimos 6)</p>
          <p className="text-[10px] text-rl-muted">
            Acumulado:{' '}
            <span className={net6 > 0 ? 'text-rl-green font-semibold' : net6 < 0 ? 'text-red-400 font-semibold' : 'font-semibold'}>
              {net6 === 0 ? fmtCurrency(0) : `${net6 > 0 ? '+' : '−'}${fmtCurrency(Math.abs(net6))}`}
            </span>
          </p>
        </div>
        <NetBars series={series} highlightKey={`${yyyy}-${mm}`} />
      </div>
    </div>
  )
}

// ─── Modal: histórico de crescimento (entradas × saídas por mês) ────────────
export function CrescimentoHistoryModal({ projects, squads, yyyy, mm, onClose, onOpenProject }) {
  const options = monthOptions(yyyy, mm, 12)
  const [selKey, setSelKey] = useState(options[0].key)
  const [tab, setTab] = useState('novos')

  const sel = options.find(o => o.key === selKey) || options[0]
  const cur = netStats(projects, sel.yyyy, sel.mm)

  const prevDate = new Date(sel.yyyy, sel.mm - 1, 1)
  const prevY = prevDate.getFullYear()
  const prevM = prevDate.getMonth()
  const prev = netStats(projects, prevY, prevM)

  const series = netSeries(projects, sel.yyyy, sel.mm, 6)

  const deltaNet   = cur.net - prev.net
  const deltaNovos = cur.novos.mrr - prev.novos.mrr
  const deltaChurn = cur.churn.mrr - prev.churn.mrr

  // `good` diz qual direção é boa para aquela linha (churn subindo é ruim).
  function Delta({ value, good = 'up' }) {
    if (value === 0) return <span className="text-[11px] text-rl-muted">sem mudança</span>
    const positive = value > 0
    const isGood = good === 'up' ? positive : !positive
    const Icon = positive ? TrendingUp : TrendingDown
    return (
      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${isGood ? 'text-rl-green' : 'text-red-400'}`}>
        <Icon className="w-3 h-3" />
        {positive ? '+' : '−'}{fmtCurrency(Math.abs(value))}
      </span>
    )
  }

  const activeList = tab === 'churn' ? cur.churn.list : cur.novos.list
  const sortedList = [...activeList].sort((a, b) => {
    if (tab === 'churn') return (b.churnDate || '').localeCompare(a.churnDate || '')
    return (entryDate(b)?.getTime() ?? 0) - (entryDate(a)?.getTime() ?? 0)
  })

  return (
    <Modal onClose={onClose} maxWidth="3xl" className="max-h-[90vh] overflow-y-auto">
      <div className="flex items-start gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-rl-purple/10 border border-rl-purple/30 flex items-center justify-center text-rl-purple shrink-0">
          <Activity className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-rl-text">Crescimento da base</h3>
          <p className="text-xs text-rl-muted">Entradas, saídas e Net MRR de cada mês.</p>
        </div>
      </div>

      <div className="mb-5">
        <label htmlFor="growth-month" className="block text-[10px] font-semibold uppercase tracking-wider text-rl-muted mb-1.5">
          Período de referência
        </label>
        <select
          id="growth-month"
          value={selKey}
          onChange={(e) => { setSelKey(e.target.value); setTab('novos') }}
          className="input-field w-full sm:w-64"
        >
          {options.map(opt => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
        </select>
      </div>

      {/* Comparativo mês selecionado × anterior */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <div className="rounded-xl border border-rl-purple/30 bg-rl-purple/5 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-rl-purple">Selecionado</p>
          <p className="text-sm font-semibold text-rl-text mt-0.5">{cur.label}</p>
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-rl-muted">Novos ({cur.novos.count})</span>
              <span className="text-sm font-bold text-rl-green tabular-nums">+{fmtCurrency(cur.novos.mrr)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-rl-muted">Churn ({cur.churn.count})</span>
              <span className="text-sm font-bold text-red-400 tabular-nums">−{fmtCurrency(cur.churn.mrr)}</span>
            </div>
            <div className="flex items-center justify-between pt-1.5 border-t border-rl-border/60">
              <span className="text-xs text-rl-muted">Net MRR</span>
              <span className={`text-lg font-bold tabular-nums ${cur.net > 0 ? 'text-rl-green' : cur.net < 0 ? 'text-red-400' : 'text-rl-text'}`}>
                {cur.net === 0 ? fmtCurrency(0) : `${cur.net > 0 ? '+' : '−'}${fmtCurrency(Math.abs(cur.net))}`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-rl-muted">Crescimento</span>
              <span className="text-xs font-semibold text-rl-text">
                {cur.growthPct == null ? '—' : `${cur.growthPct > 0 ? '+' : cur.growthPct < 0 ? '−' : ''}${Math.abs(cur.growthPct).toFixed(1)}%`}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-rl-border bg-rl-surface/30 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-rl-muted">Mês anterior</p>
          <p className="text-sm font-semibold text-rl-text mt-0.5">{monthLabel(prevY, prevM)}</p>
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-rl-muted">Novos ({prev.novos.count})</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-rl-text tabular-nums">{fmtCurrency(prev.novos.mrr)}</span>
                <Delta value={deltaNovos} good="up" />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-rl-muted">Churn ({prev.churn.count})</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-rl-text tabular-nums">{fmtCurrency(prev.churn.mrr)}</span>
                <Delta value={deltaChurn} good="down" />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-rl-border/60">
              <span className="text-xs text-rl-muted">Net MRR</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-rl-text tabular-nums">
                  {prev.net === 0 ? fmtCurrency(0) : `${prev.net > 0 ? '+' : '−'}${fmtCurrency(Math.abs(prev.net))}`}
                </span>
                <Delta value={deltaNet} good="up" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-rl-muted">MRR no dia 1º</span>
              <span className="text-xs font-semibold text-rl-text tabular-nums">{fmtCurrency(prev.mrrInicial)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Série */}
      <div className="rounded-xl border border-rl-border bg-rl-surface/30 p-4 mb-5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-rl-muted mb-3">Net MRR por mês (últimos 6)</p>
        <NetBars series={series} highlightKey={`${sel.yyyy}-${sel.mm}`} />
      </div>

      {/* Listas */}
      <div>
        <div className="flex items-center gap-1 p-1 rounded-xl bg-rl-surface border border-rl-border mb-3 w-full sm:w-fit">
          <button
            type="button"
            onClick={() => setTab('novos')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === 'novos' ? 'bg-rl-green text-white shadow-sm' : 'text-rl-muted hover:text-rl-text'
            }`}
          >
            Entraram
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] tabular-nums ${tab === 'novos' ? 'bg-white/20' : 'bg-rl-bg border border-rl-border'}`}>
              {cur.novos.count}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab('churn')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === 'churn' ? 'bg-red-400 text-white shadow-sm' : 'text-rl-muted hover:text-rl-text'
            }`}
          >
            Saíram
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] tabular-nums ${tab === 'churn' ? 'bg-white/20' : 'bg-rl-bg border border-rl-border'}`}>
              {cur.churn.count}
            </span>
          </button>
        </div>

        <p className="text-[10px] font-bold uppercase tracking-wider text-rl-muted mb-2">
          {tab === 'churn' ? 'Saíram' : 'Entraram'} — {cur.label}
        </p>

        {sortedList.length === 0 ? (
          <p className="text-sm text-rl-muted py-4 text-center">
            {tab === 'churn' ? 'Nenhum churn neste mês.' : 'Nenhuma entrada neste mês.'}
          </p>
        ) : (
          <div className="space-y-1.5 max-h-[40vh] overflow-y-auto -mx-6 px-6">
            {sortedList.map(p => {
              const squad = squadOf(squads, p)
              const isChurnTab = tab === 'churn'
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onOpenProject(p.id)}
                  className={`w-full flex flex-col sm:flex-row sm:items-center gap-2 p-2.5 rounded-lg border border-rl-border transition-all text-left ${
                    isChurnTab ? 'hover:border-red-400/40 hover:bg-red-400/5' : 'hover:border-rl-green/40 hover:bg-rl-green/5'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-rl-text truncate">{p.companyName || '—'}</p>
                    <p className="text-[10px] text-rl-muted">
                      {squad?.emoji && <span>{squad.emoji} </span>}{squad?.name || 'sem squad'} ·{' '}
                      {isChurnTab ? `Saiu em ${fmtChurnDate(p)}` : `Entrou em ${fmtEntryDate(p)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p className="text-[9px] uppercase text-rl-muted">MRR</p>
                      <p className={`text-xs font-bold ${isChurnTab ? 'text-red-400' : 'text-rl-green'}`}>{fmtCurrency(mrrValue(p))}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] uppercase text-rl-muted">Contrato</p>
                      <p className={`text-xs font-bold ${isChurnTab ? 'text-red-400' : 'text-rl-green'}`}>{fmtCurrency(Number(p.contractValue) || 0)}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </Modal>
  )
}
