import { num, fmtMoney, fmtNum, groupBy } from '../../lib/dashboardData'
import { StatusTag, ConvCell, CtrCell, TxConvCell, HookRateCell } from './helpers'

// ─────────────────────────────────────────────────────────────────────────────
// Tabelas de drill-down (drawer + aba Campanhas da página de cliente).
// Cada componente recebe `rows` (já filtradas pelo período/cliente) e callbacks
// de navegação (onDrillCampaign / onDrillAdset) e preview (onPreview).
//
// Os nomes de coluna refletem EXATAMENTE os cabeçalhos das planilhas, incluindo
// quirks preservados do original: 'Status do Aúncio' (typo), 'CLiques', etc.
// ─────────────────────────────────────────────────────────────────────────────

function FlagRow({ flags, kind }) {
  if (!flags.length) return null
  return (
    <div className="flag-row">
      {flags.map((f, i) => <span key={i} className={`flag flag-${kind}`}>{f}</span>)}
    </div>
  )
}

// ─── META: CAMPANHAS ──────────────────────────────────────────────────────────
export function MetaCampaigns({ rows, onDrillCampaign }) {
  const groups = groupBy(rows, r => r['Nome da campanha'], {
    spend: r => num(r['Valor investido']),
    conv: r => num(r['Número de conversas iniciadas no Whatsapp']) + num(r['Leads']) + num(r['Número de vendas']),
    leads: r => num(r['Leads']),
    impressions: r => num(r['Impressões']),
    clicks: r => num(r['Número de cliques no link']),
  })
  if (!groups.length) return <div className="empty">Sem campanhas no período.</div>
  const flags = groups.filter(g => g.spend > 0 && g.conv === 0).map(g => `🚨 ${g.key} — gasto sem conv.`)

  return (
    <>
      <FlagRow flags={flags} kind="red" />
      <div className="dt-wrap"><table>
        <thead><tr><th>Campanha</th><th>Status</th><th>Conv.</th><th>Gasto</th><th>CPL</th><th>Tx. Conv.</th><th>Impressões</th><th>Cliques</th></tr></thead>
        <tbody>{groups.map((g, i) => {
          const cpl = g.conv > 0 ? g.spend / g.conv : null
          const ref = rows.find(r => r['Nome da campanha'] === g.key)
          const status = ref?.[' Status da Campanha'] || ref?.['Status da Campanha'] || ''
          return (
            <tr key={g.key}>
              <td className="ad-name" title={g.key}><span className="drill-link" onClick={() => onDrillCampaign(g.key)}>{i === 0 && g.conv > 0 ? '🏆 ' : ''}{g.key}</span></td>
              <td><StatusTag status={status} /></td>
              <td><ConvCell conv={g.conv} spend={g.spend} /></td>
              <td>{fmtMoney(g.spend)}</td>
              <td>{fmtMoney(cpl)}</td>
              <td><TxConvCell leads={g.leads} clicks={g.clicks} /></td>
              <td>{fmtNum(g.impressions)}</td>
              <td>{fmtNum(g.clicks)}</td>
            </tr>
          )
        })}</tbody>
      </table></div>
    </>
  )
}

// ─── META: CONJUNTOS ──────────────────────────────────────────────────────────
export function MetaAdsets({ rows, onDrillAdset }) {
  const groups = groupBy(rows, r => r['Conjunto de Anúncio'], {
    spend: r => num(r['Valor investido']),
    conv: r => num(r['Número de conversas iniciadas no Whatsapp']) + num(r['Leads']) + num(r['Número de vendas']),
    leads: r => num(r['Leads']),
    clicks: r => num(r['Número de cliques no link']),
    impressions: r => num(r['Impressões']),
  })
  if (!groups.length) return <div className="empty">Sem conjuntos no período.</div>
  const flags = groups.filter(g => g.spend > 0 && g.conv === 0).map(g => `🚨 ${g.key} — gasto sem conv.`)

  return (
    <>
      <FlagRow flags={flags} kind="red" />
      <div className="dt-wrap"><table>
        <thead><tr><th>Conjunto</th><th>Status</th><th>Conv.</th><th>Gasto</th><th>CPL</th><th>Tx. Conv.</th><th>Impressões</th></tr></thead>
        <tbody>{groups.map((g, i) => {
          const cpl = g.conv > 0 ? g.spend / g.conv : null
          const status = rows.find(r => r['Conjunto de Anúncio'] === g.key)?.['Status do Conjunto de Anúncio'] || ''
          return (
            <tr key={g.key}>
              <td className="ad-name" title={g.key}><span className="drill-link" onClick={() => onDrillAdset(g.key)}>{i === 0 && g.conv > 0 ? '🏆 ' : ''}{g.key}</span></td>
              <td><StatusTag status={status} /></td>
              <td><ConvCell conv={g.conv} spend={g.spend} /></td>
              <td>{fmtMoney(g.spend)}</td>
              <td>{fmtMoney(cpl)}</td>
              <td><TxConvCell leads={g.leads} clicks={g.clicks} /></td>
              <td>{fmtNum(g.impressions)}</td>
            </tr>
          )
        })}</tbody>
      </table></div>
    </>
  )
}

// ─── META: ANÚNCIOS ───────────────────────────────────────────────────────────
export function MetaAds({ rows, onPreview }) {
  const groups = groupBy(rows, r => r['Nome do Anúncio'], {
    spend: r => num(r['Valor investido']),
    conv: r => num(r['Número de conversas iniciadas no Whatsapp']) + num(r['Leads']) + num(r['Número de vendas']),
    impressions: r => num(r['Impressões']),
    clicks: r => num(r['Número de cliques no link']),
    leads: r => num(r['Leads']),
    hook3s: r => num(r['Número de vezes que assistiram os 3 primeiros segundos']),
    videoViews: r => num(r['Número de vezes que o vídeo foi exibido']),
    p25: r => num(r['Número de vezes que assistiram 25% do vídeo']),
    p50: r => num(r['Número de vezes que assistiram 50% do vídeo']),
    p75: r => num(r['Número de vezes que assistiram 75% do vídeo']),
    p100: r => num(r['Número de vezes que assistiram 100% do vídeo']),
  })
  if (!groups.length) return <div className="empty">Sem anúncios no período.</div>

  const noConv = groups.filter(g => g.spend > 0 && g.conv === 0)
  const paused = groups.filter(g => (rows.find(r => r['Nome do Anúncio'] === g.key)?.['Status do Aúncio'] || '').toLowerCase().includes('paus'))

  return (
    <>
      {noConv.length > 0 && (
        <div className="flag-row">
          <span className="flag flag-red">🚨 {noConv.length} anúncio(s) com gasto e 0 conversões — R$ {noConv.reduce((a, g) => a + g.spend, 0).toFixed(2)} desperdiçados</span>
        </div>
      )}
      {paused.length > 0 && (
        <div className="flag-row">
          {paused.map(g => <span key={g.key} className="flag flag-yellow">⏸ {g.key} PAUSADO{g.conv > 0 ? ' — convertia bem!' : ''}</span>)}
        </div>
      )}
      <div className="dt-wrap"><table>
        <thead><tr><th>Anúncio</th><th>Status</th><th>Preview</th><th>Conv.</th><th>Gasto</th><th>CPL</th><th>Tx. Conv.</th><th>Hook 3s</th><th>CTR Link</th><th>V25%</th><th>V50%</th><th>V75%</th><th>V100%</th></tr></thead>
        <tbody>{groups.map((g, i) => {
          const cpl = g.conv > 0 ? g.spend / g.conv : null
          const adRow = rows.find(r => r['Nome do Anúncio'] === g.key)
          const status = adRow?.['Status do Aúncio'] || ''
          const adUrl = (adRow?.['Link do anúncio'] || '').trim()
          const ctr = g.impressions > 0 ? (g.clicks / g.impressions) * 100 : null
          const pr = p => g.videoViews > 0 ? (p / g.videoViews) * 100 : null
          const isPaused = status.toLowerCase().includes('paus')
          return (
            <tr key={g.key} style={isPaused ? { opacity: 0.55 } : undefined}>
              <td className="ad-name" title={g.key}>{i === 0 && g.conv > 0 ? '🏆 ' : ''}{g.key}</td>
              <td><StatusTag status={status} /></td>
              <td>{adUrl ? <button className="preview-btn" onClick={() => onPreview(adUrl, g.key)}>👁 Ver</button> : '—'}</td>
              <td><ConvCell conv={g.conv} spend={g.spend} /></td>
              <td>{fmtMoney(g.spend)}</td>
              <td>{fmtMoney(cpl)}</td>
              <td><TxConvCell leads={g.leads} clicks={g.clicks} /></td>
              <td><HookRateCell h3={g.hook3s} vv={g.videoViews} /></td>
              <td><CtrCell v={ctr} /></td>
              <td>{pr(g.p25) != null ? pr(g.p25).toFixed(0) + '%' : '—'}</td>
              <td>{pr(g.p50) != null ? pr(g.p50).toFixed(0) + '%' : '—'}</td>
              <td>{pr(g.p75) != null ? pr(g.p75).toFixed(0) + '%' : '—'}</td>
              <td>{pr(g.p100) != null ? pr(g.p100).toFixed(0) + '%' : '—'}</td>
            </tr>
          )
        })}</tbody>
      </table></div>
    </>
  )
}

// ─── GOOGLE: CAMPANHAS ────────────────────────────────────────────────────────
export function GoogleCampaigns({ rows, onDrillCampaign }) {
  const groups = groupBy(rows, r => r['Campanha'], {
    spend: r => num(r['Gasto']),
    conv: r => num(r['Conversões']),
    clicks: r => (num(r['CLiques']) || num(r['Cliques'])),
    impressions: r => num(r['Impressões na parte superior']),
    budgetLoss: r => num(r['% de perda por orçamento']),
  })
  if (!groups.length) return <div className="empty">Sem campanhas no período.</div>
  const noConv = groups.filter(g => g.spend > 0 && g.conv === 0).map(g => `🚨 ${g.key} — sem conversões`)
  const highLoss = groups.filter(g => g.budgetLoss > 10)
    .map(g => `⚠️ ${g.key} — ${(g.budgetLoss / (g._rows.length || 1)).toFixed(1)}% perda orçamento`)

  return (
    <>
      <FlagRow flags={noConv} kind="red" />
      <FlagRow flags={highLoss} kind="yellow" />
      <div className="dt-wrap"><table>
        <thead><tr><th>Campanha</th><th>Conv.</th><th>Gasto</th><th>CPA</th><th>Cliques</th><th>% Perda Orçamento</th></tr></thead>
        <tbody>{groups.map((g, i) => {
          const cpa = g.conv > 0 ? g.spend / g.conv : null
          const avgLoss = g._rows.length > 0 ? g.budgetLoss / g._rows.length : 0
          return (
            <tr key={g.key}>
              <td className="ad-name" title={g.key}><span className="drill-link" onClick={() => onDrillCampaign(g.key)}>{i === 0 && g.conv > 0 ? '🏆 ' : ''}{g.key}</span></td>
              <td><ConvCell conv={g.conv} spend={g.spend} /></td>
              <td>{fmtMoney(g.spend)}</td>
              <td>{fmtMoney(cpa)}</td>
              <td>{fmtNum(g.clicks)}</td>
              <td>{avgLoss > 10 ? <span className="crit">{avgLoss.toFixed(1)}% 🚨</span> : avgLoss > 0 ? <span className="warn">{avgLoss.toFixed(1)}%</span> : '—'}</td>
            </tr>
          )
        })}</tbody>
      </table></div>
    </>
  )
}

// ─── GOOGLE: GRUPOS DE PALAVRAS ───────────────────────────────────────────────
export function GoogleGroups({ rows }) {
  const groups = groupBy(rows, r => r['Grupo de palavras'] || r['Grupo de palavras-chave'], {
    spend: r => num(r['Gasto']),
    conv: r => num(r['Conversões']),
    clicks: r => (num(r['CLiques']) || num(r['Cliques'])),
  })
  if (!groups.length) return <div className="empty">Sem grupos de palavras no período.</div>

  return (
    <div className="dt-wrap"><table>
      <thead><tr><th>Grupo</th><th>Conv.</th><th>Gasto</th><th>CPA</th><th>Cliques</th></tr></thead>
      <tbody>{groups.map((g, i) => {
        const cpa = g.conv > 0 ? g.spend / g.conv : null
        return (
          <tr key={g.key || '(sem grupo)'}>
            <td className="ad-name" title={g.key}>{i === 0 && g.conv > 0 ? '🏆 ' : ''}{g.key || '(sem grupo)'}</td>
            <td><ConvCell conv={g.conv} spend={g.spend} /></td>
            <td>{fmtMoney(g.spend)}</td>
            <td>{fmtMoney(cpa)}</td>
            <td>{fmtNum(g.clicks)}</td>
          </tr>
        )
      })}</tbody>
    </table></div>
  )
}
