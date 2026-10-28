// Crescimento da base: tela própria da home (`/?visao=crescimento`), com as
// entradas, saídas e o Net MRR de cada mês. Substituiu o card de Net MRR e os
// modais de histórico de Novos e de Churn, que mostravam a mesma conta em
// três lugares.
import { useMemo } from 'react'
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react'
import { fmtCurrency, mrrValue, entryDate } from '../../lib/utils'
import { netStats, netSeries, monthOptions, monthKey } from '../../lib/growth'

const MESES = 12

const fmtData = (d) => (d ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')
const dataChurn = (p) => (p.churnDate ? new Date(p.churnDate + 'T00:00:00') : null)

// "+R$ 4.600" / "−R$ 700" / "R$ 0"
export function fmtNet(v) {
  if (!v) return fmtCurrency(0)
  return `${v > 0 ? '+' : '−'}${fmtCurrency(Math.abs(v))}`
}
const corNet = (v) => (v > 0 ? 'text-rl-green' : v < 0 ? 'text-rl-red' : 'text-rl-text')
export const fmtPct = (v) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1).replace('.', ',')}%`)

// ─── Barras: Net MRR por mês (positivo acima, negativo abaixo) ──────────────
// Cada barra é um botão que escolhe o mês.
function NetBars({ series, selKey, onSelect }) {
  const max = Math.max(...series.map(s => Math.abs(s.net)), 1)
  return (
    <div className="flex items-stretch justify-between gap-1.5 sm:gap-2">
      {series.map((s) => {
        const key = monthKey(s.yyyy, s.mm)
        const pct = (Math.abs(s.net) / max) * 100
        const up = s.net > 0
        const flat = s.net === 0
        const sel = key === selKey
        const cor = up ? 'bg-rl-green' : 'bg-rl-red'
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            aria-pressed={sel}
            title={`${s.label}: ${s.novos.count} entrada(s) ${fmtCurrency(s.novos.mrr)} · ${s.churn.count} saída(s) ${fmtCurrency(s.churn.mrr)} · net ${fmtNet(s.net)}`}
            className={`flex-1 min-w-0 flex flex-col items-center rounded-lg pt-1 pb-1.5 transition-colors ${sel ? 'bg-rl-surface' : 'hover:bg-rl-surface/60'}`}
          >
            <div className="w-full h-16 flex items-end justify-center px-1">
              {up && <div className={`w-full max-w-[36px] rounded-t ${cor} ${sel ? '' : 'opacity-60'}`} style={{ height: `${Math.max(pct, 4)}%` }} />}
            </div>
            <div className="w-full border-t border-rl-border" />
            <div className="w-full h-16 flex items-start justify-center px-1">
              {!up && !flat && <div className={`w-full max-w-[36px] rounded-b ${cor} ${sel ? '' : 'opacity-60'}`} style={{ height: `${Math.max(pct, 4)}%` }} />}
            </div>
            <span className={`text-[10px] mt-1 truncate w-full text-center ${sel ? 'text-rl-text font-semibold' : 'text-rl-muted'}`}>
              {s.labelShort}
            </span>
            <span className={`hidden sm:block text-[10px] tabular-nums leading-none mt-0.5 ${flat ? 'text-rl-muted' : corNet(s.net)}`}>
              {flat ? '—' : fmtNet(s.net)}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function Tile({ rotulo, valor, cor = 'text-rl-text', extra, children }) {
  return (
    <div className="glass-card p-4">
      <p className="text-xs text-rl-muted">{rotulo}</p>
      <p className="flex items-baseline gap-2 mt-1">
        <span className={`text-xl font-bold tabular-nums leading-tight ${cor}`}>{valor}</span>
        {extra}
      </p>
      {children && <p className="text-xs sm:text-sm text-rl-muted mt-1.5">{children}</p>}
    </div>
  )
}

// Percentual de crescimento do Net MRR sobre o MRR do início do mês, ao lado do valor.
export function PctNet({ valor }) {
  if (valor == null) return null
  return (
    <span className={`text-sm font-semibold tabular-nums ${corNet(valor)}`} title="Crescimento sobre o MRR do início do mês">
      {fmtPct(valor)}
    </span>
  )
}

function Delta({ valor, bom = 'sobe' }) {
  if (!valor) return <span className="text-rl-muted">igual ao mês anterior</span>
  const sobe = valor > 0
  const ok = bom === 'sobe' ? sobe : !sobe
  const Icone = sobe ? TrendingUp : TrendingDown
  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${ok ? 'text-rl-green' : 'text-rl-red'}`}>
      <Icone className="w-3 h-3" />
      {fmtNet(valor)} vs. mês anterior
    </span>
  )
}

// `mes`: 'yyyy-mm' escolhido (null = mês corrente). `aba`: 'novos' | 'churn'.
export function CrescimentoView({ projects, squads, yyyy, mm, mes, aba = 'novos', onMes, onAba, onVoltar, onOpenProject }) {
  const options = monthOptions(yyyy, mm, MESES)
  const sel = options.find(o => o.key === mes) || options[0]
  const series = useMemo(() => netSeries(projects, yyyy, mm, MESES), [projects, yyyy, mm])
  const cur = netStats(projects, sel.yyyy, sel.mm)
  const idx = series.findIndex(s => monthKey(s.yyyy, s.mm) === sel.key)
  const prev = idx > 0 ? series[idx - 1] : netStats(projects, new Date(sel.yyyy, sel.mm - 1, 1).getFullYear(), new Date(sel.yyyy, sel.mm - 1, 1).getMonth())
  const acumulado = series.reduce((acc, s) => acc + s.net, 0)

  const lista = (aba === 'churn' ? cur.churn.list : cur.novos.list).slice().sort((a, b) =>
    aba === 'churn'
      ? (b.churnDate || '').localeCompare(a.churnDate || '')
      : (entryDate(b)?.getTime() ?? 0) - (entryDate(a)?.getTime() ?? 0))
  const squadDe = (p) => (squads || []).find(s => String(s.id) === String(p.squad)) || null

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={onVoltar}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-rl-muted hover:text-rl-text mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Clientes
          </button>
          <h1 className="text-2xl font-bold text-rl-text">Crescimento da base</h1>
          <p className="text-sm text-rl-muted mt-0.5">
            MRR que entrou menos o que saiu, mês a mês. Acumulado em {MESES} meses:{' '}
            <span className={`font-semibold ${corNet(acumulado)}`}>{fmtNet(acumulado)}</span>
          </p>
        </div>
        <select
          aria-label="Mês de referência"
          value={sel.key}
          onChange={(e) => onMes(e.target.value)}
          className="input-field w-full sm:w-56"
        >
          {options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>

      {/* O mês escolhido */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile rotulo="MRR no início do mês" valor={fmtCurrency(cur.mrrInicial)}>
          {sel.key === options[0].key ? 'Hoje' : 'Fechou o mês em'} <span className="font-semibold text-rl-text">{fmtCurrency(cur.mrrFinal)}</span>
        </Tile>
        <Tile rotulo={`Entraram · ${cur.novos.count}`} valor={`+${fmtCurrency(cur.novos.mrr)}`} cor={cur.novos.mrr ? 'text-rl-green' : 'text-rl-text'}>
          <Delta valor={cur.novos.mrr - prev.novos.mrr} bom="sobe" />
        </Tile>
        <Tile rotulo={`Saíram · ${cur.churn.count}`} valor={`−${fmtCurrency(cur.churn.mrr)}`} cor={cur.churn.mrr ? 'text-rl-red' : 'text-rl-text'}>
          {cur.churnRatePct != null ? `${fmtPct(cur.churnRatePct).replace('+', '')} da base · ` : ''}
          <Delta valor={cur.churn.mrr - prev.churn.mrr} bom="desce" />
        </Tile>
        <Tile rotulo={`Net MRR · ${cur.label}`} valor={fmtNet(cur.net)} cor={corNet(cur.net)} extra={<PctNet valor={cur.growthPct} />}>
          crescimento sobre o MRR do início do mês
        </Tile>
      </div>

      {/* Série */}
      <section className="glass-card p-5" aria-label="Net MRR por mês">
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold text-rl-text">Net MRR por mês</h2>
          <span className="text-[11px] text-rl-muted">últimos {MESES} meses · clique num mês para ver o detalhe</span>
        </div>
        <NetBars series={series} selKey={sel.key} onSelect={onMes} />
      </section>

      {/* Mês a mês */}
      <section className="glass-card overflow-hidden" aria-label="Mês a mês">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="bg-rl-surface/60 border-b border-rl-border text-[11px] font-semibold uppercase tracking-wider text-rl-muted">
                <th className="text-left px-4 py-2.5">Mês</th>
                <th className="text-right px-4 py-2.5">MRR no início</th>
                <th className="text-right px-4 py-2.5">Entraram</th>
                <th className="text-right px-4 py-2.5">Saíram</th>
                <th className="text-right px-4 py-2.5">Net MRR</th>
                <th className="text-right px-4 py-2.5">Crescimento</th>
              </tr>
            </thead>
            <tbody>
              {series.slice().reverse().map(s => {
                const key = monthKey(s.yyyy, s.mm)
                const ativo = key === sel.key
                return (
                  <tr
                    key={key}
                    onClick={() => onMes(key)}
                    className={`border-b border-rl-border last:border-0 cursor-pointer tabular-nums transition-colors ${ativo ? 'bg-rl-purple/[.06]' : 'hover:bg-rl-surface'}`}
                  >
                    <td className={`px-4 py-2.5 ${ativo ? 'font-semibold text-rl-text' : 'text-rl-subtle'}`}>{s.label}</td>
                    <td className="px-4 py-2.5 text-right text-rl-subtle">{fmtCurrency(s.mrrInicial)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-rl-green font-medium">{s.novos.mrr ? `+${fmtCurrency(s.novos.mrr)}` : '—'}</span>
                      <span className="text-rl-muted text-xs ml-1.5">{s.novos.count || ''}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="text-rl-red font-medium">{s.churn.mrr ? `−${fmtCurrency(s.churn.mrr)}` : '—'}</span>
                      <span className="text-rl-muted text-xs ml-1.5">{s.churn.count || ''}</span>
                    </td>
                    <td className={`px-4 py-2.5 text-right font-bold ${corNet(s.net)}`}>{fmtNet(s.net)}</td>
                    <td className="px-4 py-2.5 text-right text-rl-subtle">{fmtPct(s.growthPct)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Quem entrou / saiu no mês */}
      <section className="glass-card overflow-hidden" aria-label={`Clientes de ${cur.label}`}>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-rl-border">
          <h2 className="text-sm font-semibold text-rl-text mr-auto">{cur.label}</h2>
          <div className="flex items-center gap-1 p-1 rounded-xl bg-rl-surface border border-rl-border" role="tablist">
            {[
              { id: 'novos', rotulo: 'Entraram', n: cur.novos.count },
              { id: 'churn', rotulo: 'Saíram',   n: cur.churn.count },
            ].map(t => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={aba === t.id}
                onClick={() => onAba(t.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  aba === t.id ? 'bg-rl-card text-rl-text shadow-sm' : 'text-rl-muted hover:text-rl-text'
                }`}
              >
                {t.rotulo}
                <span className="tabular-nums text-rl-muted">{t.n}</span>
              </button>
            ))}
          </div>
        </div>

        {lista.length === 0 ? (
          <p className="text-sm text-rl-muted py-8 text-center">
            {aba === 'churn' ? 'Nenhum cliente saiu neste mês.' : 'Nenhum cliente entrou neste mês.'}
          </p>
        ) : (
          <ul>
            {lista.map(p => {
              const sq = squadDe(p)
              return (
                <li key={p.id} className="border-b border-rl-border last:border-0">
                  <button
                    type="button"
                    onClick={() => onOpenProject(p.id)}
                    className="w-full flex items-center gap-4 px-4 py-2.5 text-left hover:bg-rl-surface transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-rl-text truncate">{p.companyName || '—'}</p>
                      <p className="text-[11px] text-rl-muted truncate">
                        {sq ? `${sq.emoji ? sq.emoji + ' ' : ''}${sq.name}` : 'sem squad'} ·{' '}
                        {aba === 'churn' ? `saiu em ${fmtData(dataChurn(p))}` : `entrou em ${fmtData(entryDate(p))}`}
                      </p>
                    </div>
                    <div className="text-right tabular-nums shrink-0">
                      <p className={`text-sm font-bold ${aba === 'churn' ? 'text-rl-red' : 'text-rl-green'}`}>{fmtCurrency(mrrValue(p))}<span className="text-[11px] font-medium text-rl-muted">/mês</span></p>
                      <p className="text-[11px] text-rl-muted">contrato {fmtCurrency(Number(p.contractValue) || 0)}</p>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
