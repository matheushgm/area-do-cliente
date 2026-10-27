import { useState } from 'react'
import { Plus, Edit2, Check, X, Link2, CheckCircle2, FileDown } from 'lucide-react'
import { fmtMoney, fmtPct, parseMoney, getDaysInMonth, getWeekRanges, computeRoiPlan, weekdayShort, MONTH_NAMES } from './resultadosHelpers'
import { MonthNav } from './B2BResultados'
import { CostTile } from './ResultadosCharts'
import GraficosEvolucao from './GraficosEvolucao'
import FunilDoMes, { FonteTag } from './FunilDoMes'
import ComparativoCanais from './ComparativoCanais'
import PlanoVsRealizado from './PlanoVsRealizado'
import { AutofillButton, AutoBadge } from './AutofillResultados'
import VendasPorUnidade from './VendasPorUnidade'
import { getUnidades } from '../../lib/constants'
import { investimentoPorUnidade } from '../../lib/roasPorUnidade'
import { exportResultadosB2CPDF } from '../../utils/exportPDF'

// ─── Form compartilhado (dia e semana) ────────────────────────────────────────
// B2C não tem MQL/SQL — o funil é Lead → Venda. O campo "Vendas (qtd)" é
// opcional e existe para permitir o cálculo do CAC; sem ele, só temos CPL.
function B2CEntryForm({ initial = {}, onSave, onCancel }) {
  const [form, setForm] = useState({
    investido:   initial.investido   != null ? String(initial.investido).replace('.', ',')   : '',
    leads:       initial.leads       || '',
    valorVendas: initial.valorVendas != null ? String(initial.valorVendas).replace('.', ',') : '',
    vendas:      initial.vendas      || '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const inv  = parseMoney(form.investido)
  const lds  = Number(form.leads)  || 0
  const qtd  = Number(form.vendas) || 0
  const vend = parseMoney(form.valorVendas)
  const cpl  = lds > 0 && inv > 0 ? inv / lds : 0
  const cac  = qtd > 0 && inv > 0 ? inv / qtd : 0
  const roas = inv > 0 ? vend / inv : 0

  const campos = [
    ['investido', 'Investido', 'R$ 0,00', 'api'], ['leads', 'Leads', '0', 'api'],
    ['vendas', 'Vendas (qtd)', '0', 'lancado'], ['valorVendas', 'Vendas (R$)', 'R$ 0,00', 'lancado'],
  ]
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {campos.map(([k, lbl, ph, fonte]) => (
          <div key={k}>
            <label className="label-field flex items-center gap-1.5">{lbl} <FonteTag fonte={fonte} /></label>
            <input className="input-field" placeholder={ph} value={form[k]} onChange={e => set(k, e.target.value)}
              {...(ph === '0' ? { type: 'number', min: '0' } : {})} />
          </div>
        ))}
      </div>
      {initial.fonte === 'api' && <p className="text-xs text-rl-muted">Investido e leads vêm da API: uma mudança aqui é sobrescrita no próximo preenchimento automático.</p>}
      <div className="flex items-center gap-3 flex-wrap">
        {inv > 0 && (
          <div className="grid grid-cols-3 gap-1.5 flex-1 min-w-[240px] max-w-md">
            <CostTile label="Custo / Lead" value={cpl} color="blue" />
            <CostTile label="CAC" value={cac} color="gold" />
            <div className="rounded-lg border border-rl-green/25 bg-rl-green/8 text-rl-green px-2 py-1.5 text-center">
              <div className="text-[11px] uppercase tracking-wider text-rl-muted leading-tight">ROAS</div>
              <div className="text-sm font-bold leading-tight mt-0.5">{roas > 0 ? `${roas.toFixed(2)}x` : '—'}</div>
            </div>
          </div>
        )}
        <div className="flex gap-2 ml-auto">
          <button onClick={onCancel} className="btn-secondary flex items-center gap-1 text-sm"><X size={13} /> Cancelar</button>
          <button onClick={() => onSave(form)} className="btn-primary flex items-center gap-1.5 text-sm"><Check size={13} /> Salvar</button>
        </div>
      </div>
    </div>
  )
}

const fmtInt = n => Number(n || 0).toLocaleString('pt-BR')

// Tabela de períodos (dias ou semanas): investido e leads da API, vendas e receita lançadas,
// custos calculados. O lançamento abre numa linha logo abaixo da linha editada.
// `cobrarLancamento`: destaca "Lançar vendas" onde já há investimento e nenhuma venda (nas
// semanas; no diário, dia sem venda é comum e o destaque viraria ruído).
function TabelaPeriodos({ linhas, editando, onEditar, onSalvar, onCancelar, totais, cobrarLancamento = false }) {
  const cel = 'px-3 py-2 text-right tabular-nums'
  const per = (d, q) => (d?.investido > 0 && q > 0 ? fmtMoney(d.investido / q) : '—')
  return (
    <div className="rounded-2xl border border-rl-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider">
              <th className="bg-rl-surface/60" />
              <th colSpan={2} className="bg-rl-surface/60 px-3 pt-2.5 text-left"><FonteTag fonte="api" /></th>
              <th colSpan={2} className="bg-rl-surface/60 px-3 pt-2.5 text-left border-l border-rl-border"><FonteTag fonte="lancado" /></th>
              <th colSpan={3} className="bg-rl-surface/60 px-3 pt-2.5 text-left text-rl-muted font-semibold border-l border-rl-border">Calculado</th>
              <th className="bg-rl-surface/60" />
            </tr>
            <tr className="text-xs text-rl-muted border-b border-rl-border">
              {['Período', 'Investido', 'Leads', 'Vendas', 'Receita', 'CPL', 'CAC', 'ROAS', ''].map((h, i) => (
                <th key={h + i} className={`bg-rl-surface/60 px-3 pb-2 pt-1 font-medium ${i === 0 ? 'text-left' : 'text-right'} ${i === 3 || i === 5 ? 'border-l border-rl-border' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map(({ key, label, sub, d, futuro }) => {
              const semLancamento = cobrarLancamento && d && d.investido > 0 && !(d.vendas || d.valorVendas)
              return [
                <tr key={key} className={`border-b border-rl-border/50 ${editando === key ? 'bg-rl-purple/5' : 'hover:bg-rl-surface/40'} ${futuro ? 'opacity-40' : ''}`}>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="font-medium text-rl-text">{label}</span>
                    {sub && <span className="ml-1.5 text-xs text-rl-muted">{sub}</span>}
                    {d?.parcial && <span className="ml-2 align-middle"><AutoBadge entry={d} /></span>}
                  </td>
                  {d ? (
                    <>
                      <td className={cel}>{fmtMoney(d.investido)}</td>
                      <td className={cel}>{fmtInt(d.leads)}</td>
                      <td className={`${cel} border-l border-rl-border/60`}>{d.vendas ? fmtInt(d.vendas) : '—'}</td>
                      <td className={cel}>{d.valorVendas ? fmtMoney(d.valorVendas) : '—'}</td>
                      <td className={`${cel} border-l border-rl-border/60 text-rl-subtle`}>{per(d, d.leads)}</td>
                      <td className={`${cel} text-rl-subtle`}>{per(d, d.vendas)}</td>
                      <td className={`${cel} text-rl-subtle`}>{d.investido > 0 && d.valorVendas > 0 ? `${(d.valorVendas / d.investido).toFixed(2)}x` : '—'}</td>
                    </>
                  ) : (
                    <td colSpan={7} className="px-3 py-2 text-xs text-rl-muted">{futuro ? '' : 'Sem dados'}</td>
                  )}
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">
                    {futuro ? null : semLancamento ? (
                      <button onClick={() => onEditar(key)} className="inline-flex items-center gap-1 text-xs font-semibold text-rl-purple bg-rl-purple/10 hover:bg-rl-purple/15 px-2.5 py-1 rounded-lg">
                        <Plus size={12} /> Lançar vendas
                      </button>
                    ) : (
                      <button onClick={() => onEditar(editando === key ? null : key)} title={d ? 'Editar' : 'Lançar'}
                        className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-colors">
                        {d ? <Edit2 size={13} /> : <Plus size={13} />}
                      </button>
                    )}
                  </td>
                </tr>,
                editando === key && (
                  <tr key={key + '-form'} className="border-b border-rl-border/50 bg-rl-purple/5">
                    <td colSpan={9} className="px-3 pb-4 pt-1">
                      <B2CEntryForm initial={d} onSave={data => onSalvar(key, data)} onCancel={onCancelar} />
                    </td>
                  </tr>
                ),
              ]
            })}
          </tbody>
          {totais.investido > 0 && (
            <tfoot>
              <tr className="bg-rl-surface/60 font-semibold text-rl-text">
                <td className="px-3 py-2.5">Total do mês</td>
                <td className={cel}>{fmtMoney(totais.investido)}</td>
                <td className={cel}>{fmtInt(totais.leads)}</td>
                <td className={`${cel} border-l border-rl-border/60`}>{fmtInt(totais.vendas)}</td>
                <td className={cel}>{fmtMoney(totais.valorVendas)}</td>
                <td className={`${cel} border-l border-rl-border/60`}>{per(totais, totais.leads)}</td>
                <td className={cel}>{per(totais, totais.vendas)}</td>
                <td className={cel}>{totais.valorVendas > 0 ? `${(totais.valorVendas / totais.investido).toFixed(2)}x` : '—'}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

// Normaliza o payload do form antes de persistir.
const normalize = data => ({
  investido:   parseMoney(data.investido),
  leads:       Number(data.leads)  || 0,
  vendas:      Number(data.vendas) || 0,
  valorVendas: parseMoney(data.valorVendas),
})

// ─── B2C View ─────────────────────────────────────────────────────────────────
export default function B2CView({ resultados, onUpdate, clientShareToken, getOrCreateShareToken, companyName, roiCalc, dash, projectId }) {
  const today = new Date()
  const [year, setYear]     = useState(today.getFullYear())
  const [month, setMonth]   = useState(today.getMonth())
  const [mode, setMode]     = useState('diario') // 'diario' | 'semanal'
  const [editing, setEditing]     = useState(null)
  const [editingWeek, setEditingWeek] = useState(null)
  const [copied, setCopied] = useState(false)

  const monthKey  = `${year}-${String(month + 1).padStart(2, '0')}`
  const monthData = resultados.b2c?.[monthKey] || {}
  const weekData  = resultados.b2c_semanas?.[monthKey] || {}
  const unitData  = resultados.b2c_unidades?.[monthKey] || {}
  const unitWeekData = resultados.b2c_unidades_semanas?.[monthKey] || {}
  const daysInMon = getDaysInMonth(year, month)
  const weeks     = getWeekRanges(year, month)

  // Quebra por unidade: recurso pontual, habilitado por projeto (ver constants).
  const unidades = getUnidades(projectId)
  const investimento = unidades ? investimentoPorUnidade(dash?.raw, projectId, unidades, year, month) : null

  // ── Save day ────────────────────────────────────────────────────────────────
  const saveDay = (day, data) => {
    const dayKey = String(day).padStart(2, '0')
    onUpdate({
      ...resultados,
      b2c: {
        ...(resultados.b2c || {}),
        [monthKey]: { ...(resultados.b2c?.[monthKey] || {}), [dayKey]: normalize(data) },
      },
    })
    setEditing(null)
  }

  // ── Save week ───────────────────────────────────────────────────────────────
  const saveWeek = (weekIdx, data) => {
    onUpdate({
      ...resultados,
      b2c_semanas: {
        ...(resultados.b2c_semanas || {}),
        [monthKey]: { ...(resultados.b2c_semanas?.[monthKey] || {}), [String(weekIdx)]: normalize(data) },
      },
    })
    setEditingWeek(null)
  }

  // ── Save dia por unidade ────────────────────────────────────────────────────
  // Grava a quebra em `b2c_unidades` e repassa a soma do dia para `b2c`, que
  // continua sendo a única fonte de vendas/receita para KPIs, ROAS e gráficos.
  const saveUnidadesDay = (dayKey, perUnit) => {
    const total = Object.values(perUnit).reduce(
      (acc, u) => ({
        vendas:      acc.vendas      + (Number(u.vendas)      || 0),
        valorVendas: acc.valorVendas + (Number(u.valorVendas) || 0),
      }),
      { vendas: 0, valorVendas: 0 },
    )
    const diaAtual = resultados.b2c?.[monthKey]?.[dayKey] || {}

    onUpdate({
      ...resultados,
      b2c_unidades: {
        ...(resultados.b2c_unidades || {}),
        [monthKey]: { ...(resultados.b2c_unidades?.[monthKey] || {}), [dayKey]: perUnit },
      },
      b2c: {
        ...(resultados.b2c || {}),
        [monthKey]: {
          ...(resultados.b2c?.[monthKey] || {}),
          [dayKey]: {
            investido: diaAtual.investido || 0,
            leads:     diaAtual.leads     || 0,
            ...diaAtual,
            vendas:      total.vendas,
            valorVendas: total.valorVendas,
          },
        },
      },
    })
  }

  // ── Save semana por unidade ─────────────────────────────────────────────────
  // Lançamento direto por semana (sem passar pelos dias). Grava a quebra em
  // `b2c_unidades_semanas` e repassa a soma para `b2c_semanas`, que continua
  // sendo a única fonte de vendas/receita da visão Semanal.
  const saveUnidadesWeek = (weekKey, perUnit) => {
    const total = Object.values(perUnit).reduce(
      (acc, u) => ({
        vendas:      acc.vendas      + (Number(u.vendas)      || 0),
        valorVendas: acc.valorVendas + (Number(u.valorVendas) || 0),
      }),
      { vendas: 0, valorVendas: 0 },
    )
    const semanaAtual = resultados.b2c_semanas?.[monthKey]?.[weekKey] || {}

    onUpdate({
      ...resultados,
      b2c_unidades_semanas: {
        ...(resultados.b2c_unidades_semanas || {}),
        [monthKey]: { ...(resultados.b2c_unidades_semanas?.[monthKey] || {}), [weekKey]: perUnit },
      },
      b2c_semanas: {
        ...(resultados.b2c_semanas || {}),
        [monthKey]: {
          ...(resultados.b2c_semanas?.[monthKey] || {}),
          [weekKey]: {
            investido: semanaAtual.investido || 0,
            leads:     semanaAtual.leads     || 0,
            ...semanaAtual,
            vendas:      total.vendas,
            valorVendas: total.valorVendas,
          },
        },
      },
    })
  }

  const sum = rows => rows.reduce(
    (acc, d) => ({
      investido:   acc.investido   + (d.investido   || 0),
      leads:       acc.leads       + (d.leads       || 0),
      vendas:      acc.vendas      + (d.vendas      || 0),
      valorVendas: acc.valorVendas + (d.valorVendas || 0),
    }),
    { investido: 0, leads: 0, vendas: 0, valorVendas: 0 },
  )

  const dailyTotals  = sum(Object.values(monthData))
  const weeklyTotals = sum(Object.values(weekData))
  // A visão por unidade alimenta os dias, então lê os mesmos totais do Diário.
  const totals = mode === 'semanal' ? weeklyTotals : dailyTotals

  const perUnit = qty => (totals.investido > 0 && qty > 0 ? totals.investido / qty : 0)
  const cpl  = perUnit(totals.leads)
  const cac  = perUnit(totals.vendas)
  const roas = totals.investido > 0 ? totals.valorVendas / totals.investido : 0
  const ticket = totals.vendas > 0 ? totals.valorVendas / totals.vendas : 0

  // Meta mensal vinda da Calculadora de ROI do projeto.
  const plan = computeRoiPlan(roiCalc)

  // Última vez que a API preencheu algum dia/semana do mês
  const atualizadoApi = (() => {
    const ts = [...Object.values(monthData), ...Object.values(weekData)].map(d => d?.fonte === 'api' && d.atualizadoEm).filter(Boolean).sort().at(-1)
    return ts ? new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null
  })()

  const days = Array.from({ length: daysInMon }, (_, i) => i + 1)


  // ── Copy share link ─────────────────────────────────────────────────────────
  // Usa getOrCreateShareToken quando disponível (gera token se ainda não
  // existir), com fallback para o clientShareToken já existente.
  const copyLink = () => {
    const token = (getOrCreateShareToken && getOrCreateShareToken()) || clientShareToken
    if (!token) return
    const url = `${window.location.origin}/b2c/${token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="space-y-6">

      {/* Nav + mode toggle + share link */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <MonthNav year={year} month={month} setYear={setYear} setMonth={setMonth} />

        <div className="flex items-center gap-2 flex-wrap">
          <AutofillButton
            projectId={projectId}
            year={year}
            month={month}
            onFilled={onUpdate}
          />
          {(clientShareToken || getOrCreateShareToken) && (
            <button
              onClick={copyLink}
              className={`flex items-center gap-2 text-sm px-4 py-2 rounded-xl border font-medium transition-all ${
                copied
                  ? 'bg-rl-green/10 border-rl-green/30 text-rl-green'
                  : 'bg-rl-surface border-rl-border text-rl-muted hover:text-rl-text hover:border-rl-purple/30'
              }`}
              title="Copia um link para o cliente preencher os resultados B2C"
            >
              {copied ? <CheckCircle2 size={14} /> : <Link2 size={14} />}
              {copied ? 'Link copiado!' : 'Copiar link do cliente'}
            </button>
          )}

          <button
            onClick={() => exportResultadosB2CPDF({
              companyName, resultados, year, month, mode,
              weekRanges: weeks, unidades, plan, MONTH_NAMES,
            })}
            className="btn-secondary flex items-center gap-2 text-sm whitespace-nowrap"
            title="Gerar PDF do mês para o cliente"
          >
            <FileDown size={15} />
            Gerar PDF
          </button>
        </div>
      </div>

      {/* ── Funil do mês: API + lançado ──────────────────────────────────────── */}
      <FunilDoMes
        titulo={`Funil de ${MONTH_NAMES[month]}${mode === 'semanal' ? ' (lançamentos semanais)' : ''}`}
        atualizado={atualizadoApi}
        etapas={[
          { key: 'inv', label: 'Investido', valor: fmtMoney(totals.investido), sub: plan ? `plano ${fmtMoney(plan.mediaOrcamento)}` : null, fonte: 'api' },
          { key: 'leads', label: 'Leads', valor: fmtInt(totals.leads), sub: cpl ? `${fmtMoney(cpl)} por lead` : null, fonte: 'api' },
          { key: 'vendas', label: 'Vendas', valor: fmtInt(totals.vendas), sub: cac ? `CAC ${fmtMoney(cac)}` : null, fonte: 'lancado', conversao: totals.vendas ? `${fmtPct(totals.vendas, totals.leads)} dos leads` : null },
          { key: 'receita', label: 'Receita', valor: fmtMoney(totals.valorVendas), sub: roas ? `ROAS ${roas.toFixed(2)}x` : null, fonte: 'lancado', conversao: ticket ? `ticket ${fmtMoney(ticket)}` : null },
        ]}
      />

      {/* ── Lançamentos: diário, semanal ou por unidade ──────────────────────────── */}
      <div className="space-y-3">
        <div className="inline-flex p-1 rounded-xl bg-rl-surface border border-rl-border">
          {[
            { id: 'diario',   label: 'Diário' },
            { id: 'semanal',  label: 'Semanal' },
            ...(unidades ? [{ id: 'unidades', label: 'Por loja' }] : []),
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => { setMode(opt.id); setEditing(null); setEditingWeek(null) }}
              className={`px-3.5 py-1.5 rounded-lg text-sm transition-colors ${mode === opt.id ? 'bg-rl-card text-rl-text font-semibold shadow-sm' : 'text-rl-subtle hover:text-rl-text'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {mode === 'diario' && (
          <TabelaPeriodos
            linhas={days.map(day => ({
              key: day,
              label: `${day}/${month + 1}`,
              sub: weekdayShort(year, month, day),
              d: monthData[String(day).padStart(2, '0')],
              futuro: new Date(year, month, day) > today,
            }))}
            editando={editing}
            onEditar={setEditing}
            onSalvar={(day, data) => saveDay(day, data)}
            onCancelar={() => setEditing(null)}
            totais={dailyTotals}
          />
        )}

        {mode === 'semanal' && (
          <TabelaPeriodos
            linhas={weeks.map((week, idx) => ({
              key: idx,
              label: week.label,
              sub: `${week.start}/${month + 1} a ${week.end}/${month + 1}`,
              d: weekData[String(idx + 1)],
              futuro: new Date(year, month, week.start) > today,
            }))}
            editando={editingWeek}
            onEditar={setEditingWeek}
            cobrarLancamento
            onSalvar={(idx, data) => saveWeek(idx + 1, data)}
            onCancelar={() => setEditingWeek(null)}
            totais={weeklyTotals}
          />
        )}

        {mode === 'unidades' && unidades && (
          <VendasPorUnidade
            unidades={unidades}
            investimento={investimento}
            year={year}
            month={month}
            data={unitData}
            onSaveDay={saveUnidadesDay}
            weekData={unitWeekData}
            onSaveWeek={saveUnidadesWeek}
          />
        )}
      </div>

      {/* ── Evolução (diária ou semanal, conforme a aba) ──────────────────────────── */}
      {mode === 'semanal' ? (
        <GraficosEvolucao
          titulo="Evolução semanal"
          labels={weeks.map((_, i) => `S${i + 1}`)}
          nomes={weeks.map(w => `${w.label} · ${w.start}/${month + 1} a ${w.end}/${month + 1}`)}
            periodos={weeks.map((_, i) => {
            const w = weekData[String(i + 1)]
            return w ? { investido: w.investido, leads: w.leads, vendas: w.vendas, receita: w.valorVendas } : null
          })}
        />
      ) : (
        <GraficosEvolucao
          titulo="Evolução diária"
          labels={days.map(d => String(d))}
          nomes={days.map(d => `${d}/${month + 1} · ${weekdayShort(year, month, d)}`)}
          rotuloX={i => ([0, 4, 9, 14, 19, 24, 29].includes(i) ? String(i + 1) : null)}
          periodos={days.map(d => {
            const x = monthData[String(d).padStart(2, '0')]
            return x ? { investido: x.investido, leads: x.leads, vendas: x.vendas, receita: x.valorVendas } : null
          })}
        />
      )}

      {/* ── Plano de ROI e canais ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <PlanoVsRealizado
          plan={plan}
          showMqlSql={false}
          real={{
            investido: totals.investido,
            leads:  totals.leads,
            mql: 0, sql: 0,
            vendas: totals.vendas,
            receita: totals.valorVendas,
          }}
        />
        <div className="lg:col-span-2">
          <ComparativoCanais
            dash={dash}
            projectId={projectId}
            year={year}
            month={month}
            monthLabel={`${MONTH_NAMES[month]} ${year}`}
          />
        </div>
      </div>
    </div>
  )
}
