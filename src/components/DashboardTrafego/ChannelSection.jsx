import { useMemo } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import {
  num, fmtMoney, fmtNum, fmtPct, inRange, fmtDate, classifyFunnel,
  pillCls, pillIco, varCls,
} from '../../lib/dashboardData'
import { CplTargetCell, cplActualCls } from './helpers'

// ─────────────────────────────────────────────────────────────────────────────
// Seção de um canal (Meta ou Google): barra de resumo + grupos por status.
// Recebe `stats` JÁ filtradas (search/squad) e o período; computa a barra de
// resumo e as flags de poucos criativos a partir das linhas cruas do período.
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_GROUPS = [
  { key: 'CRÍTICO', icon: '🔴', hcls: 'gh-red', label: 'Crítico' },
  { key: 'QUEDA', icon: '🔴', hcls: 'gh-red', label: 'Queda' },
  { key: 'ESTÁVEL', icon: '🟡', hcls: 'gh-yellow', label: 'Estável' },
  { key: 'MELHORA', icon: '🟢', hcls: 'gh-green', label: 'Melhora' },
]

// Squad da conta. Conta mapeada (com projeto) → badge read-only (herda do
// projeto). Conta sem projeto → seletor editável (override em dashboard_accounts).
function SquadCell({ name, squad, mapped, setSquad, small }) {
  const cls = squad === 'Caça ROI' ? 'sq-caca' : squad === 'Zero Churn' ? 'sq-zero' : ''
  if (mapped) {
    return (
      <span
        className={`squad-derived${small ? ' squad-derived-sm' : ''}${cls ? ' ' + cls : ''}`}
        title="Squad herdado do projeto vinculado — altere no perfil do cliente (Área do Cliente)"
        onClick={e => e.stopPropagation()}
      >
        {squad === 'Caça ROI' ? '🎯 ' : squad === 'Zero Churn' ? '🔒 ' : ''}{squad || '—'}
      </span>
    )
  }
  return (
    <select
      className={`${small ? 'squad-sel-sm' : 'squad-sel'}${cls ? ' ' + cls : ''}`}
      value={squad || ''}
      onClick={e => e.stopPropagation()}
      onChange={e => setSquad(name, e.target.value)}
    >
      <option value="">{small ? 'sem squad' : '—'}</option>
      <option value="Caça ROI">🎯 Caça ROI</option>
      <option value="Zero Churn">🔒 Zero Churn</option>
    </select>
  )
}

export default function ChannelSection({ rows, cfg, period, prefix, stats, accounts, setSquad, getTarget, onOpenClient, onOpenMap, canHide, onToggleHidden }) {
  const isMeta = prefix === 'meta'

  // Botão de "olho" para ocultar/reexibir a conta do dashboard. O ícone reflete
  // o estado atual (Eye = visível → clicar oculta; EyeOff = oculta → clicar reexibe).
  const HideBtn = ({ name }) => {
    if (!canHide) return null
    const hidden = !!accounts[name]?.hidden
    const Icon = hidden ? EyeOff : Eye
    return (
      <button
        type="button"
        className={`hide-btn${hidden ? ' is-hidden' : ''}`}
        title={hidden ? 'Reexibir esta conta no dashboard' : 'Ocultar esta conta do dashboard'}
        aria-label={hidden ? 'Reexibir conta' : 'Ocultar conta'}
        onClick={(e) => { e.stopPropagation(); onToggleHidden(name, !hidden) }}
      >
        <Icon size={15} />
      </button>
    )
  }

  // Linhas cruas dentro do período atual (para resumo + flags).
  const { summary, lowCreatives } = useMemo(() => {
    if (!period) return { summary: null, lowCreatives: {} }
    const periodRows = rows.filter(r => inRange(fmtDate(r[cfg.dateKey]), period.p1s, period.p1e))

    let sumSpend = 0, sumLeads = 0, sumClicks = 0, sumImpr = 0, sumConv = 0
    if (isMeta) {
      periodRows.forEach(r => {
        sumSpend += num(r['Valor investido'])
        sumLeads += num(r['Número de conversas iniciadas no Whatsapp']) + num(r['Leads']) + num(r['Número de vendas'])
        sumClicks += num(r['Número de cliques no link'])
        sumImpr += num(r['Impressões'])
      })
    } else {
      periodRows.forEach(r => {
        sumSpend += num(r['Gasto'])
        sumConv += num(r['Conversões'])
        sumClicks += (num(r['CLiques']) || num(r['Cliques']))
        sumImpr += (num(r['Impressões na parte superior']) || num(r['Impressões']))
      })
      sumLeads = sumConv
    }

    // Flags de poucos criativos (Meta): <5 anúncios únicos em meio/fundo de funil.
    const low = {}
    if (isMeta) {
      const byClient = {}
      periodRows.forEach(r => {
        const name = r['Nome da conta']?.trim()
        const ad = r['Nome do Anúncio'] || ''
        if (!name || !ad) return
        const stage = classifyFunnel(r['Nome da campanha'] || '')
        if (stage !== 'meio' && stage !== 'fundo') return
        if (!byClient[name]) byClient[name] = new Set()
        byClient[name].add(ad)
      })
      Object.entries(byClient).forEach(([name, set]) => { if (set.size < 5) low[name] = set.size })
    }

    return {
      summary: {
        sumSpend, sumLeads, sumImpr, sumClicks,
        cpl: sumLeads > 0 ? sumSpend / sumLeads : null,
        ctr: sumImpr > 0 ? (sumClicks / sumImpr) * 100 : null,
        txConv: sumClicks > 0 ? (sumLeads / sumClicks) * 100 : null,
      },
      lowCreatives: low,
    }
  }, [rows, cfg, period, isMeta])

  if (!period || !stats.length) {
    return <div className="empty">Nenhum dado disponível para o período selecionado.</div>
  }

  const fmtSumPct = v => v != null ? v.toFixed(2) + '%' : '—'
  const cplLabel = isMeta ? 'CPL Médio' : 'CPA Médio'
  const leadsLabel = isMeta ? 'Leads Gerados' : 'Conversões'
  const dateLabels = period.t1.filter(Boolean).map(d => { const [, m, day] = d.split('-'); return `${day}/${m}` }).join(', ')

  const LowBadge = ({ name }) => {
    if (!(name in lowCreatives)) return null
    return <span className="low-creatives-warn" title={`Apenas ${lowCreatives[name]} criativo(s) ativo(s) em campanhas de meio/fundo de funil — recomendado ≥5`}> ⚠️</span>
  }

  const Trend = ({ s }) => s.declining3d
    ? <span className="trend-dn">📉 Queda</span>
    : s.trendDir === 'up' ? <span className="trend-up">📈 Alta</span> : <span className="trend-fl">➡️ Estável</span>

  return (
    <>
      <div className="summary-bar">
        <div className="sum-kpi"><div className="sum-label">Total Investido</div><div className="sum-value sum-accent">{fmtMoney(summary.sumSpend)}</div><div className="sum-sub">{period.label1}</div></div>
        <div className="sum-kpi"><div className="sum-label">{leadsLabel}</div><div className="sum-value">{fmtNum(summary.sumLeads)}</div><div className="sum-sub">no período</div></div>
        <div className="sum-kpi"><div className="sum-label">{cplLabel}</div><div className="sum-value">{summary.cpl != null ? fmtMoney(summary.cpl) : '—'}</div><div className="sum-sub">gasto ÷ leads</div></div>
        <div className="sum-kpi"><div className="sum-label">CTR Médio</div><div className="sum-value">{fmtSumPct(summary.ctr)}</div><div className="sum-sub">cliques ÷ impressões</div></div>
        <div className="sum-kpi"><div className="sum-label">Tx. Conv. Média</div><div className="sum-value">{fmtSumPct(summary.txConv)}</div><div className="sum-sub">leads ÷ cliques</div></div>
      </div>

      <div className="period-row">
        <div className="period-badge">Selecionado: <b>{period.label1}</b></div>
        <div className="period-badge">Comparativo: <b>{period.label2}</b></div>
        <div className="period-badge">Tendência 3d: <b>{dateLabels}</b></div>
        <div className="period-badge">Duração: <b>{period.span + 1} dias</b></div>
      </div>

      {STATUS_GROUPS.map(g => {
        const group = stats.filter(s => s.status === g.key)
        if (!group.length) return null
        return (
          <div className="group-section" key={g.key}>
            <div className={`group-header ${g.hcls}`}>
              <span className="gh-icon">{g.icon}</span>
              <span className="gh-title">{g.label}</span>
              <span className="gh-count">{group.length} conta{group.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Desktop table */}
            <div className="table-wrap"><table>
              <thead><tr>
                <th>Conta</th><th>Status</th><th>Squad</th>
                <th>Conv.</th><th>Conv. Ant.</th><th>Var. Conv.</th>
                <th>CPL</th><th>CPL Alvo</th><th>CPL Ant.</th><th>Var. CPL</th>
                <th>Investimento</th><th>Invest. Ant.</th><th>Var. Invest.</th>
                <th>Tend. 3d</th>
              </tr></thead>
              <tbody>{group.map(s => {
                const target = getTarget(s.name)
                return (
                  <tr key={s.name}>
                    <td><span className="client-link" onClick={() => onOpenClient(s.name, prefix)}>{s.name}</span><LowBadge name={s.name} /><HideBtn name={s.name} /></td>
                    <td><span className={`pill ${pillCls(s.status)}`}>{pillIco(s.status)} {s.status}</span></td>
                    <td><SquadCell name={s.name} squad={accounts[s.name]?.squad} mapped={!!accounts[s.name]?.projectId} setSquad={setSquad} /></td>
                    <td>{fmtNum(s.conv1)}</td><td>{fmtNum(s.conv2)}</td>
                    <td className={varCls(s.varConv, false)}>{fmtPct(s.varConv)}</td>
                    <td className={cplActualCls(s.cpl1, target)}>{fmtMoney(s.cpl1)}</td>
                    <td><CplTargetCell dashName={s.name} actualCpl={s.cpl1} target={target} onMap={onOpenMap} /></td>
                    <td>{fmtMoney(s.cpl2)}</td>
                    <td className={varCls(s.varCpl, true)}>{fmtPct(s.varCpl)}</td>
                    <td>{fmtMoney(s.spend1)}</td><td>{fmtMoney(s.spend2)}</td>
                    <td className={varCls(s.varSpend, false)}>{fmtPct(s.varSpend)}</td>
                    <td><Trend s={s} /></td>
                  </tr>
                )
              })}</tbody>
            </table></div>

            {/* Mobile list */}
            <div className="mcl">{group.map(s => {
              const target = getTarget(s.name)
              const trendIco = s.declining3d ? '📉' : s.trendDir === 'up' ? '📈' : '➡️'
              const trendCls = s.declining3d ? 'trend-dn' : s.trendDir === 'up' ? 'trend-up' : 'trend-fl'
              let cplIco = null
              if (target) cplIco = s.cpl1 <= target.value ? '✅' : s.cpl1 <= target.value * 1.3 ? '⚠️' : '🚨'
              return (
                <div className="mcl-item" key={s.name} onClick={() => onOpenClient(s.name, prefix)}>
                  <div className="mcl-left">
                    <span className={`pill ${pillCls(s.status)}`} style={{ flexShrink: 0 }}>{pillIco(s.status)}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="mcl-name">{s.name}<LowBadge name={s.name} /></div>
                      <SquadCell name={s.name} squad={accounts[s.name]?.squad} mapped={!!accounts[s.name]?.projectId} setSquad={setSquad} small />
                    </div>
                  </div>
                  <div className="mcl-right">
                    <div className="mcl-row1">
                      <span className="mcl-conv">{fmtNum(s.conv1)} conv</span>
                      <span className={`mcl-var ${varCls(s.varConv, false)}`}>{fmtPct(s.varConv)}</span>
                    </div>
                    <div className="mcl-meta">
                      <span className="mcl-spend">{fmtMoney(s.spend1)}</span>
                      {cplIco ? <span title={`CPL Alvo: ${fmtMoney(target.value)}`}>{cplIco}</span> : <span className={trendCls}>{trendIco}</span>}
                    </div>
                  </div>
                  <HideBtn name={s.name} />
                  <span className="mcl-chevron">›</span>
                </div>
              )
            })}</div>
          </div>
        )
      })}
    </>
  )
}
