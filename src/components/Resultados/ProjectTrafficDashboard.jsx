import { useMemo, useState, useCallback } from 'react'
import {
  CFG, num, fmtMoney, fmtNum, fmtDate, inRange,
  computeMainPeriod, buildStats, buildWeeklyMessage, localDateStr,
  pillCls, pillIco, varCls, fmtPct,
} from '../../lib/dashboardData'
import { CplTargetCell, cplActualCls } from '../DashboardTrafego/helpers'
import ClientPage from '../DashboardTrafego/ClientPage'
import { PreviewModal, MappingModal, ClickupMapModal, WeeklyMessageModal, ShareLinkModal } from '../DashboardTrafego/Modals'
import '../DashboardTrafego/dashboard.css'

// ─────────────────────────────────────────────────────────────────────────────
// ProjectTrafficDashboard — a experiência completa do Dashboard de Tráfego,
// porém ESCOPADA às contas vinculadas a um único projeto (project.id).
//
// Reaproveita useDashboardData (carrega planilhas + contas) e apenas FILTRA o
// universo pelo projeto. Entrega: (1) totalizadores combinados Meta+Google,
// (2) tabela única unindo todas as contas do cliente (coluna Canal no lugar de
// squad), (3) filtros de data (Hoje/Ontem/3/7/14/30/Custom), (4) clique na conta
// → mesma ClientPage do dashboard (inline, com "← Voltar"), incluindo modais.
// ─────────────────────────────────────────────────────────────────────────────

const PRESETS = [['Hoje', 'today'], ['Ontem', 'yesterday'], ['3 dias', 3], ['7 dias', 7], ['14 dias', 14], ['30 dias', 30], ['Custom', 0]]
const CHANNELS = ['meta', 'google']
const fmtSumPct = v => (v != null ? v.toFixed(2) + '%' : '—')

// Soma crua (spend/leads/clicks/impr) das contas do projeto, dentro do período
// do canal. Espelha o cálculo do ChannelSection, restrito ao conjunto de contas.
function channelSummary(rows, channel, period, names) {
  const zero = { spend: 0, leads: 0, clicks: 0, impr: 0 }
  if (!period) return zero
  const { accountKey, dateKey } = CFG[channel]
  return rows.reduce((a, r) => {
    if (!names.has(r[accountKey]?.trim())) return a
    if (!inRange(fmtDate(r[dateKey]), period.p1s, period.p1e)) return a
    if (channel === 'meta') {
      a.spend += num(r['Valor investido'])
      a.leads += num(r['Número de conversas iniciadas no Whatsapp']) + num(r['Leads']) + num(r['Número de vendas'])
      a.clicks += num(r['Número de cliques no link'])
      a.impr += num(r['Impressões'])
    } else {
      a.spend += num(r['Gasto'])
      a.leads += num(r['Conversões'])
      a.clicks += (num(r['CLiques']) || num(r['Cliques']))
      a.impr += (num(r['Impressões na parte superior']) || num(r['Impressões']))
    }
    return a
  }, { ...zero })
}

const STATUS_ORDER = { 'CRÍTICO': 0, 'QUEDA': 1, 'ESTÁVEL': 2, 'MELHORA': 3 }

// `dash` vem do ResultadosModule (uma única instância de useDashboardData é
// compartilhada com o painel de canais do funil, para não buscar 2x).
export default function ProjectTrafficDashboard({ project, dash }) {
  const { raw, accounts, projectsList, cplTargets, loading, error } = dash

  const [days, setDays] = useState(7)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [chanFilter, setChanFilter] = useState('') // '' = todos | 'meta' | 'google'

  const [openClient, setOpenClient] = useState(null) // { client, channel }
  const [preview, setPreview] = useState(null)
  const [mapModal, setMapModal] = useState(null)
  const [cuMapModal, setCuMapModal] = useState(null)
  const [weekly, setWeekly] = useState(null)
  const [share, setShare] = useState(null)            // { client, channel, url }
  const [toast, setToast] = useState('')

  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2400)
  }, [])

  // Contas vinculadas a este projeto (nome → resolução). Set de nomes p/ filtro.
  const projectAccountNames = useMemo(() => {
    const s = new Set()
    Object.entries(accounts).forEach(([name, a]) => { if (a.projectId === project.id) s.add(name) })
    return s
  }, [accounts, project.id])

  // ── Vincular conta de anúncio a este cliente (reutilizável) ──────────────────
  // Todos os nomes de conta presentes nos dados (Meta + Google).
  const allAccountNames = useMemo(() => {
    const s = new Set()
    CHANNELS.forEach(ch => (raw[ch] || []).forEach(r => {
      const n = r[CFG[ch].accountKey]?.trim()
      if (n) s.add(n)
    }))
    return [...s].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [raw])
  const [linkName, setLinkName] = useState('')
  const linkAccount = useCallback(async (name) => {
    if (!name) return
    await dash.linkProject(name, project.id)
    setLinkName('')
    showToast('✅ Conta vinculada a este cliente')
  }, [dash, project.id, showToast])
  const unlinkAccount = useCallback(async (name) => {
    await dash.linkProject(name, null)
    showToast('Conta desvinculada')
  }, [dash, showToast])

  // Período por canal (cada planilha tem seu próprio maxDate).
  const periods = useMemo(() => ({
    meta: computeMainPeriod(raw.meta, 'meta', days, customFrom, customTo),
    google: computeMainPeriod(raw.google, 'google', days, customFrom, customTo),
  }), [raw, days, customFrom, customTo])

  // Totalizadores combinados Meta + Google (apenas contas do projeto).
  const totals = useMemo(() => {
    const m = channelSummary(raw.meta, 'meta', periods.meta, projectAccountNames)
    const g = channelSummary(raw.google, 'google', periods.google, projectAccountNames)
    const spend = m.spend + g.spend, leads = m.leads + g.leads
    const clicks = m.clicks + g.clicks, impr = m.impr + g.impr
    return {
      spend, leads,
      cpl: leads > 0 ? spend / leads : null,
      ctr: impr > 0 ? (clicks / impr) * 100 : null,
      txConv: clicks > 0 ? (leads / clicks) * 100 : null,
    }
  }, [raw, periods, projectAccountNames])

  // Tabela única: stats por conta de ambos os canais, marcadas com o canal.
  const tableRows = useMemo(() => {
    const out = []
    CHANNELS.forEach(ch => {
      if (chanFilter && chanFilter !== ch) return
      const p = periods[ch]
      if (!p) return
      buildStats(raw[ch], CFG[ch], p)
        .filter(s => projectAccountNames.has(s.name))
        .forEach(s => out.push({ ...s, channel: ch }))
    })
    return out.sort((a, b) => (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) || (b.spend1 - a.spend1))
  }, [raw, periods, projectAccountNames, chanFilter])

  const getTarget = useCallback((name) => accounts[name]?.cplTarget ?? null, [accounts])

  // ── Handlers de período ──────────────────────────────────────────────────────
  const selectPreset = (d) => {
    setDays(d)
    if (d === 'today') { const s = localDateStr(new Date()); setCustomFrom(s); setCustomTo(s) }
    else if (d === 'yesterday') { const dt = new Date(); dt.setDate(dt.getDate() - 1); const s = localDateStr(dt); setCustomFrom(s); setCustomTo(s) }
  }
  const applyCustom = () => {
    if (!customFrom || !customTo) { showToast('⚠️ Selecione as duas datas'); return }
    if (customFrom > customTo) { showToast('⚠️ A data inicial deve ser anterior à final'); return }
    setDays(0)
  }

  const openWeekly = (client, ch) => {
    const result = buildWeeklyMessage(raw[ch], ch, client)
    if (!result) { showToast('⚠️ Sem dados suficientes para gerar a mensagem'); return }
    setWeekly({ client, periodLabel: result.periodLabel, text: result.msg })
  }
  const shareLink = (client, ch) => {
    const url = `${window.location.origin}/dashboard?cliente=${encodeURIComponent(client)}&canal=${ch}&shared=1`
    setShare({ client, channel: ch, url })
  }

  // Barra de vínculo de contas — chips das contas do cliente + seletor p/ vincular.
  const linker = (
    <div className="acct-linker" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '0 0 16px', padding: '10px 12px', border: '1px solid #D8E0F0', borderRadius: 12, background: '#fff' }}>
      <span className="filter-label">Contas deste cliente:</span>
      {[...projectAccountNames].length === 0 && <span style={{ fontSize: 12, color: '#94A3B8' }}>nenhuma vinculada</span>}
      {[...projectAccountNames].map(n => (
        <span key={n} className="pill" style={{ background: '#EEF4FF', color: '#1D4ED8', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 8px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
          {n}
          <button onClick={() => unlinkAccount(n)} title="Desvincular" style={{ border: 0, background: 'transparent', color: '#1D4ED8', cursor: 'pointer', fontWeight: 700, lineHeight: 1 }}>×</button>
        </span>
      ))}
      <span style={{ flex: 1 }} />
      <select value={linkName} onChange={e => setLinkName(e.target.value)} style={{ fontSize: 13, padding: '6px 8px', border: '1px solid #D8E0F0', borderRadius: 8 }}>
        <option value="">+ vincular conta…</option>
        {allAccountNames.filter(n => !projectAccountNames.has(n)).map(n => {
          const other = accounts[n]?.projectId
          return <option key={n} value={n}>{n}{other ? ' (em outro cliente)' : ''}</option>
        })}
      </select>
      <button className="btn" onClick={() => linkAccount(linkName)} disabled={!linkName}>Vincular</button>
    </div>
  )

  const modals = (
    <>
      {preview && <PreviewModal url={preview.url} name={preview.name} onClose={() => setPreview(null)} />}
      {mapModal && <MappingModal dashName={mapModal} projectsList={projectsList} cplTargets={cplTargets} currentProjectId={accounts[mapModal]?.projectId} onSave={dash.linkProject} onClose={() => setMapModal(null)} />}
      {cuMapModal && <ClickupMapModal dashName={cuMapModal} currentFolderId={accounts[cuMapModal]?.clickupOverride} onSave={dash.setClickupFolder} onClose={() => setCuMapModal(null)} />}
      {weekly && <WeeklyMessageModal client={weekly.client} periodLabel={weekly.periodLabel} initialText={weekly.text} onClose={() => setWeekly(null)} onToast={showToast} />}
      {share && <ShareLinkModal client={share.client} channel={share.channel} url={share.url} onClose={() => setShare(null)} onToast={showToast} />}
      {toast && <div className="share-toast">{toast}</div>}
    </>
  )

  // ── Drill-down: ClientPage inline substitui o board ──────────────────────────
  if (openClient) {
    return (
      <div className="dt-root">
        <ClientPage
          key={openClient.client + openClient.channel}
          client={openClient.client}
          channel={openClient.channel}
          raw={raw}
          initialDays={[3, 7, 14, 30].includes(days) || days === 'today' || days === 'yesterday' || days === 0 ? days : 7}
          initialPeriod={periods[openClient.channel]}
          account={accounts[openClient.client]}
          onClose={() => setOpenClient(null)}
          onPreview={(url, name) => setPreview({ url, name })}
          onOpenWeekly={openWeekly}
          onShare={shareLink}
          onOpenMap={(n) => setMapModal(n)}
          onOpenCuMap={(n) => setCuMapModal(n)}
        />
        {modals}
      </div>
    )
  }

  // ── Estados de carregamento / vazios ─────────────────────────────────────────
  if (loading) {
    return (
      <div className="dt-root">
        <div className="empty"><div className="spinner" style={{ margin: '0 auto 12px' }} /><p>Carregando dados de tráfego…</p></div>
      </div>
    )
  }
  if (error) {
    return <div className="dt-root"><div className="error-box">⚠️ Erro ao carregar tráfego: {error}</div></div>
  }
  if (!projectAccountNames.size) {
    return (
      <div className="dt-root">
        {linker}
        <div className="empty" style={{ padding: '32px 20px' }}>
          <div style={{ marginBottom: 8, fontSize: 14 }}>Nenhuma conta de anúncio vinculada a este cliente.</div>
          <div style={{ fontSize: 12, color: '#94A3B8' }}>Use o seletor acima (<b style={{ color: '#64748B' }}>+ vincular conta</b>) para associar uma conta e ver os números reais aqui.</div>
        </div>
        {modals}
      </div>
    )
  }

  const period = periods.meta || periods.google
  const Trend = ({ s }) => s.declining3d
    ? <span className="trend-dn">📉 Queda</span>
    : s.trendDir === 'up' ? <span className="trend-up">📈 Alta</span> : <span className="trend-fl">➡️ Estável</span>

  return (
    <div className="dt-root">
      {linker}

      {/* Filtro de período */}
      <div className="filter-bar" style={{ border: '1px solid #D8E0F0', borderRadius: 12, marginBottom: 18 }}>
        <span className="filter-label">Período:</span>
        <div className="presets">
          {PRESETS.map(([label, d]) => (
            <button key={String(d)} className={`preset${days === d ? ' active' : ''}`} onClick={() => selectPreset(d)}>{label}</button>
          ))}
        </div>
        {days === 0 && (
          <div className="custom-inputs">
            <label>De: <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} /></label>
            <label>Até: <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} /></label>
            <button className="btn" onClick={applyCustom}>Aplicar</button>
          </div>
        )}
        <span className="filter-info">{period ? `Exibindo: ${period.label1} · vs ${period.label2}` : 'Sem dados no período'}</span>
      </div>

      {/* Totalizadores combinados Meta + Google */}
      <div className="summary-bar">
        <div className="sum-kpi"><div className="sum-label">Total Investido</div><div className="sum-value sum-accent">{fmtMoney(totals.spend)}</div><div className="sum-sub">Meta + Google</div></div>
        <div className="sum-kpi"><div className="sum-label">Leads Gerados</div><div className="sum-value">{fmtNum(totals.leads)}</div><div className="sum-sub">no período</div></div>
        <div className="sum-kpi"><div className="sum-label">CPL Médio</div><div className="sum-value">{totals.cpl != null ? fmtMoney(totals.cpl) : '—'}</div><div className="sum-sub">gasto ÷ leads</div></div>
        <div className="sum-kpi"><div className="sum-label">CTR Médio</div><div className="sum-value">{fmtSumPct(totals.ctr)}</div><div className="sum-sub">cliques ÷ impressões</div></div>
        <div className="sum-kpi"><div className="sum-label">Tx. Conv. Média</div><div className="sum-value">{fmtSumPct(totals.txConv)}</div><div className="sum-sub">leads ÷ cliques</div></div>
      </div>

      {/* Filtro de canal */}
      <div className="squad-bar">
        <span className="filter-label">Canal:</span>
        <button className={`squad-btn${chanFilter === '' ? ' active' : ''}`} onClick={() => setChanFilter('')}>Todos</button>
        <button className={`squad-btn${chanFilter === 'meta' ? ' active' : ''}`} onClick={() => setChanFilter('meta')}>📱 Meta Ads</button>
        <button className={`squad-btn${chanFilter === 'google' ? ' active' : ''}`} onClick={() => setChanFilter('google')}>🔍 Google Ads</button>
      </div>

      {/* Tabela única (Meta + Google) */}
      {!tableRows.length ? (
        <div className="empty">Nenhum dado disponível para o período selecionado.</div>
      ) : (
        <div className="table-wrap"><table>
          <thead><tr>
            <th>Conta</th><th>Canal</th><th>Status</th>
            <th>Conv.</th><th>CPL</th><th>CPL Alvo</th>
            <th>Investimento</th><th>Var. Conv.</th><th>Tend. 3d</th>
          </tr></thead>
          <tbody>{tableRows.map(s => {
            const target = getTarget(s.name)
            return (
              <tr key={s.channel + s.name}>
                <td><span className="client-link" onClick={() => setOpenClient({ client: s.name, channel: s.channel })}>{s.name}</span></td>
                <td>{s.channel === 'meta' ? '📱 Meta' : '🔍 Google'}</td>
                <td><span className={`pill ${pillCls(s.status)}`}>{pillIco(s.status)} {s.status}</span></td>
                <td>{fmtNum(s.conv1)}</td>
                <td className={cplActualCls(s.cpl1, target)}>{fmtMoney(s.cpl1)}</td>
                <td><CplTargetCell dashName={s.name} actualCpl={s.cpl1} target={target} onMap={(n) => setMapModal(n)} /></td>
                <td>{fmtMoney(s.spend1)}</td>
                <td className={varCls(s.varConv, false)}>{fmtPct(s.varConv)}</td>
                <td><Trend s={s} /></td>
              </tr>
            )
          })}</tbody>
        </table></div>
      )}

      {modals}
    </div>
  )
}
