// Crescimento da base: tela própria da home (`/?visao=crescimento`), com as
// entradas, saídas e o Net MRR de cada mês. Substituiu o card de Net MRR e os
// modais de histórico de Novos e de Churn, que mostravam a mesma conta em
// três lugares.
import { useMemo } from 'react'
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react'
import { fmtCurrency, mrrValue, entryDate } from '../../lib/utils'
import { netStats, netSeries, monthOptions, monthKey } from '../../lib/growth'
import { useI18n, localeAtual } from '../../i18n'

const MESES = 12

const fmtData = (d) => (d ? d.toLocaleDateString(localeAtual(), { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')
const dataChurn = (p) => (p.churnDate ? new Date(p.churnDate + 'T00:00:00') : null)

// "+R$ 4.600" / "−R$ 700" / "R$ 0"
export function fmtNet(v) {
  if (!v) return fmtCurrency(0)
  return `${v > 0 ? '+' : '−'}${fmtCurrency(Math.abs(v))}`
}
const corNet = (v) => (v > 0 ? 'text-rl-green' : v < 0 ? 'text-rl-red' : 'text-rl-text')
export const fmtPct = (v) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString(localeAtual(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`)

// ─── Barras: Net MRR por mês (positivo acima, negativo abaixo) ──────────────
// Cada barra é um botão que escolhe o mês.
function NetBars({ series, selKey, onSelect }) {
  const { t } = useI18n()
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
            title={t('crescimento.barra', {
              mes: s.label,
              entradas: t('crescimento.entradas', { count: s.novos.count }),
              entrou: fmtCurrency(s.novos.mrr),
              saidas: t('crescimento.saidas', { count: s.churn.count }),
              saiu: fmtCurrency(s.churn.mrr),
              net: fmtNet(s.net),
            })}
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
  const { t } = useI18n()
  if (valor == null) return null
  return (
    <span className={`text-sm font-semibold tabular-nums ${corNet(valor)}`} title={t('crescimento.crescimentoDica')}>
      {fmtPct(valor)}
    </span>
  )
}

function Delta({ valor, bom = 'sobe' }) {
  const { t } = useI18n()
  if (!valor) return <span className="text-rl-muted">{t('crescimento.igualMesAnterior')}</span>
  const sobe = valor > 0
  const ok = bom === 'sobe' ? sobe : !sobe
  const Icone = sobe ? TrendingUp : TrendingDown
  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${ok ? 'text-rl-green' : 'text-rl-red'}`}>
      <Icone className="w-3 h-3" />
      {t('crescimento.vsMesAnterior', { valor: fmtNet(valor) })}
    </span>
  )
}

// `mes`: 'yyyy-mm' escolhido (null = mês corrente). `aba`: 'novos' | 'churn'.
export function CrescimentoView({ projects, squads, yyyy, mm, mes, aba = 'novos', onMes, onAba, onVoltar, onOpenProject }) {
  const { t, lang } = useI18n()
  const options = monthOptions(yyyy, mm, MESES)
  const sel = options.find(o => o.key === mes) || options[0]
  // `lang` nas dependências: os rótulos dos meses (s.label) saem no idioma atual.
  const series = useMemo(() => netSeries(projects, yyyy, mm, MESES), [projects, yyyy, mm, lang]) // eslint-disable-line react-hooks/exhaustive-deps
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
            <ArrowLeft className="w-3.5 h-3.5" /> {t('crescimento.voltar')}
          </button>
          <h1 className="text-2xl font-bold text-rl-text">{t('crescimento.titulo')}</h1>
          <p className="text-sm text-rl-muted mt-0.5">
            {t('crescimento.subtitulo', { meses: MESES })}{' '}
            <span className={`font-semibold ${corNet(acumulado)}`}>{fmtNet(acumulado)}</span>
          </p>
        </div>
        <select
          aria-label={t('crescimento.mesReferencia')}
          value={sel.key}
          onChange={(e) => onMes(e.target.value)}
          className="input-field w-full sm:w-56"
        >
          {options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>

      {/* O mês escolhido */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile rotulo={t('crescimento.mrrInicio')} valor={fmtCurrency(cur.mrrInicial)}>
          {sel.key === options[0].key ? t('crescimento.hoje') : t('crescimento.fechouEm')} <span className="font-semibold text-rl-text">{fmtCurrency(cur.mrrFinal)}</span>
        </Tile>
        <Tile rotulo={t('crescimento.entraramN', { count: cur.novos.count })} valor={`+${fmtCurrency(cur.novos.mrr)}`} cor={cur.novos.mrr ? 'text-rl-green' : 'text-rl-text'}>
          <Delta valor={cur.novos.mrr - prev.novos.mrr} bom="sobe" />
        </Tile>
        <Tile rotulo={t('crescimento.sairamN', { count: cur.churn.count })} valor={`−${fmtCurrency(cur.churn.mrr)}`} cor={cur.churn.mrr ? 'text-rl-red' : 'text-rl-text'}>
          {cur.churnRatePct != null ? t('crescimento.daBase', { pct: fmtPct(cur.churnRatePct).replace('+', '') }) : ''}
          <Delta valor={cur.churn.mrr - prev.churn.mrr} bom="desce" />
        </Tile>
        <Tile rotulo={t('crescimento.netMrrMes', { mes: cur.label })} valor={fmtNet(cur.net)} cor={corNet(cur.net)} extra={<PctNet valor={cur.growthPct} />}>
          {t('crescimento.crescimentoSobreInicio')}
        </Tile>
      </div>

      {/* Série */}
      <section className="glass-card p-5" aria-label={t('crescimento.netPorMes')}>
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold text-rl-text">{t('crescimento.netPorMes')}</h2>
          <span className="text-[11px] text-rl-muted">{t('crescimento.netPorMesDica', { meses: MESES })}</span>
        </div>
        <NetBars series={series} selKey={sel.key} onSelect={onMes} />
      </section>

      {/* Mês a mês */}
      <section className="glass-card overflow-hidden" aria-label={t('crescimento.mesAMes')}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="bg-rl-surface/60 border-b border-rl-border text-[11px] font-semibold uppercase tracking-wider text-rl-muted">
                <th className="text-left px-4 py-2.5">{t('crescimento.colunas.mes')}</th>
                <th className="text-right px-4 py-2.5">{t('crescimento.colunas.mrrInicio')}</th>
                <th className="text-right px-4 py-2.5">{t('crescimento.colunas.entraram')}</th>
                <th className="text-right px-4 py-2.5">{t('crescimento.colunas.sairam')}</th>
                <th className="text-right px-4 py-2.5">{t('crescimento.colunas.netMrr')}</th>
                <th className="text-right px-4 py-2.5">{t('crescimento.colunas.crescimento')}</th>
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
      <section className="glass-card overflow-hidden" aria-label={t('crescimento.clientesDe', { mes: cur.label })}>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-rl-border">
          <h2 className="text-sm font-semibold text-rl-text mr-auto">{cur.label}</h2>
          <div className="flex items-center gap-1 p-1 rounded-xl bg-rl-surface border border-rl-border" role="tablist">
            {[
              { id: 'novos', rotulo: t('crescimento.entraram'), n: cur.novos.count },
              { id: 'churn', rotulo: t('crescimento.sairam'),   n: cur.churn.count },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={aba === tab.id}
                onClick={() => onAba(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  aba === tab.id ? 'bg-rl-card text-rl-text shadow-sm' : 'text-rl-muted hover:text-rl-text'
                }`}
              >
                {tab.rotulo}
                <span className="tabular-nums text-rl-muted">{tab.n}</span>
              </button>
            ))}
          </div>
        </div>

        {lista.length === 0 ? (
          <p className="text-sm text-rl-muted py-8 text-center">
            {aba === 'churn' ? t('crescimento.nenhumSaiu') : t('crescimento.nenhumEntrou')}
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
                        {sq ? `${sq.emoji ? sq.emoji + ' ' : ''}${sq.name}` : t('crescimento.semSquad')} ·{' '}
                        {aba === 'churn' ? t('crescimento.saiuEm', { data: fmtData(dataChurn(p)) }) : t('crescimento.entrouEm', { data: fmtData(entryDate(p)) })}
                      </p>
                    </div>
                    <div className="text-right tabular-nums shrink-0">
                      <p className={`text-sm font-bold ${aba === 'churn' ? 'text-rl-red' : 'text-rl-green'}`}>{fmtCurrency(mrrValue(p))}<span className="text-[11px] font-medium text-rl-muted">{t('crescimento.porMes')}</span></p>
                      <p className="text-[11px] text-rl-muted">{t('crescimento.contrato', { valor: fmtCurrency(Number(p.contractValue) || 0) })}</p>
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
