import { fmtMoney, fmtNum, fmtPct, varCls } from '../../lib/dashboardData'

// ─────────────────────────────────────────────────────────────────────────────
// Visualização "Diagnóstico de Queda": classifica as contas em QUEDA de conversão
// pela CAUSA da queda — verba (cortou investimento) vs. performance (CTR ou taxa
// de conversão). Recebe `diag` já filtrado (search/squad/ocultas). Ver
// buildDeclineDiagnosis em lib/dashboardData.js.
// ─────────────────────────────────────────────────────────────────────────────

const GROUPS = [
  {
    key: 'verba', hcls: 'gh-yellow', icon: '💸', label: 'Queda por Verba',
    hint: 'A conversão caiu MENOS que o investimento — a queda de resultado é reflexo do corte de verba, não de performance (eficiência manteve/melhorou).',
    match: d => d.bucket === 'verba',
  },
  {
    key: 'ctr', hcls: 'gh-red', icon: '📉', label: 'Queda por Performance → CTR',
    hint: 'A conversão caiu MAIS que a verba justifica, e o CTR foi a alavanca que mais caiu — sinal de criativo/segmentação. Testar criativos.',
    match: d => d.bucket === 'performance' && d.culprit === 'CTR',
  },
  {
    key: 'taxa', hcls: 'gh-red', icon: '📉', label: 'Queda por Performance → Taxa de conversão',
    hint: 'A conversão caiu MAIS que a verba justifica, e a taxa de conversão foi a que mais caiu — sinal de LP/oferta/fundo de funil. Testar landing page.',
    match: d => d.bucket === 'performance' && d.culprit === 'Taxa de conversão',
  },
]

const fmtRatioPct = v => (v != null ? (v * 100).toFixed(2) + '%' : '—')

export default function DiagnosisSection({ diag, period, onOpenClient, prefix }) {
  if (!period) {
    return <div className="empty">Nenhum dado disponível para o período selecionado.</div>
  }
  if (!diag.length) {
    return <div className="empty">Nenhuma conta em queda de conversão no período selecionado. 🎉</div>
  }

  return (
    <>
      <div className="period-row">
        <div className="period-badge">Selecionado: <b>{period.label1}</b></div>
        <div className="period-badge">Comparativo: <b>{period.label2}</b></div>
        <div className="period-badge">Contas em queda: <b>{diag.length}</b></div>
      </div>

      {GROUPS.map(g => {
        const group = diag.filter(g.match)
        if (!group.length) return null
        return (
          <div className="group-section" key={g.key}>
            <div className={`group-header ${g.hcls}`}>
              <span className="gh-icon">{g.icon}</span>
              <span className="gh-title">{g.label}</span>
              <span className="gh-count">{group.length} conta{group.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="diag-hint">{g.hint}</div>

            {/* Desktop table */}
            <div className="table-wrap"><table>
              <thead><tr>
                <th>Conta</th>
                <th>Conv.</th><th>Var. Conv.</th>
                <th>Investimento</th><th>Var. Invest.</th>
                <th>CTR</th><th>Var. CTR</th>
                <th>Tx. Conv.</th><th>Var. Tx. Conv.</th>
                <th>CPL</th><th>Var. CPL</th>
              </tr></thead>
              <tbody>{group.map(d => (
                <tr key={d.name}>
                  <td><span className="client-link" onClick={() => onOpenClient(d.name, prefix)}>{d.name}</span></td>
                  <td>{fmtNum(d.conv1)}</td>
                  <td className={varCls(d.varConv, false)}>{fmtPct(d.varConv)}</td>
                  <td>{fmtMoney(d.spend1)}</td>
                  <td className={varCls(d.varSpend, false)}>{fmtPct(d.varSpend)}</td>
                  <td>{fmtRatioPct(d.ctr1)}</td>
                  <td className={varCls(d.varCtr, false)}>{fmtPct(d.varCtr)}</td>
                  <td>{fmtRatioPct(d.cr1)}</td>
                  <td className={varCls(d.varCr, false)}>{fmtPct(d.varCr)}</td>
                  <td>{fmtMoney(d.cpl1)}</td>
                  <td className={varCls(d.varCpl, true)}>{fmtPct(d.varCpl)}</td>
                </tr>
              ))}</tbody>
            </table></div>

            {/* Mobile list */}
            <div className="mcl">{group.map(d => (
              <div className="mcl-item" key={d.name} onClick={() => onOpenClient(d.name, prefix)}>
                <div className="mcl-left">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="mcl-name">{d.name}</div>
                    <div className="diag-mini">
                      <span className={varCls(d.varConv, false)}>conv {fmtPct(d.varConv)}</span>
                      <span className={varCls(d.varSpend, false)}>verba {fmtPct(d.varSpend)}</span>
                    </div>
                  </div>
                </div>
                <div className="mcl-right">
                  <div className="diag-mini">
                    <span className={varCls(d.varCtr, false)}>CTR {fmtPct(d.varCtr)}</span>
                    <span className={varCls(d.varCr, false)}>Tx {fmtPct(d.varCr)}</span>
                  </div>
                  <div className="mcl-meta"><span className="mcl-spend">CPL {fmtMoney(d.cpl1)}</span></div>
                </div>
                <span className="mcl-chevron">›</span>
              </div>
            ))}</div>
          </div>
        )
      })}
    </>
  )
}
