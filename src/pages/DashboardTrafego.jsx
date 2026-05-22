import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, BarChart3 } from 'lucide-react'
import { useDashboardData } from '../hooks/useDashboardData'
import AppSidebar from '../components/AppSidebar'
import {
  CFG, buildPeriod, periodFromDays, maxDate, addDays, buildStats,
  buildWeeklyMessage, localDateStr,
} from '../lib/dashboardData'
import ChannelSection from '../components/DashboardTrafego/ChannelSection'
import ClientPage from '../components/DashboardTrafego/ClientPage'
import { PreviewModal, MappingModal, ClickupMapModal, WeeklyMessageModal } from '../components/DashboardTrafego/Modals'
import '../components/DashboardTrafego/dashboard.css'

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard de Tráfego — página principal (rota /dashboard, protegida).
// Orquestra estado global: canal ativo, período/filtros, busca, squad, página
// de cliente, modais e modo compartilhado (shared link).
// ─────────────────────────────────────────────────────────────────────────────

const PRESETS = [['Hoje', 'today'], ['Ontem', 'yesterday'], ['3 dias', 3], ['7 dias', 7], ['14 dias', 14], ['30 dias', 30], ['Custom', 0]]

// Período do filtro principal (suporta today/yesterday/N dias/custom).
function mainPeriod(channelRows, channel, days, from, to) {
  const dateKey = CFG[channel].dateKey
  if (days === 'today') { const m = maxDate(channelRows, dateKey); return m ? buildPeriod(m, m) : null }
  if (days === 'yesterday') { const m = maxDate(channelRows, dateKey); if (!m) return null; const y = addDays(m, -1); return buildPeriod(y, y) }
  if (days === 0) return (from && to) ? buildPeriod(from, to) : null
  return periodFromDays(channelRows, dateKey, days)
}

export default function DashboardTrafego() {
  const navigate = useNavigate()
  const dash = useDashboardData()
  const { raw, accounts, squadByAccount, projectsList, cplTargets, loading, error, lastUpdate } = dash

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [channel, setChannel] = useState('meta')
  const [days, setDays] = useState(7)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [search, setSearch] = useState('')
  const [squadFilter, setSquadFilter] = useState('')

  const [openClient, setOpenClient] = useState(null) // { client, channel }
  const [shared, setShared] = useState(false)
  const [preview, setPreview] = useState(null)        // { url, name }
  const [mapModal, setMapModal] = useState(null)      // dashName
  const [cuMapModal, setCuMapModal] = useState(null)  // dashName
  const [weekly, setWeekly] = useState(null)          // { client, periodLabel, text }
  const [toast, setToast] = useState('')

  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2400)
  }, [])

  // Modo compartilhado: ?cliente=&canal=&shared=1 — abre direto a página do cliente.
  useEffect(() => {
    if (loading || openClient) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('shared') !== '1') return
    const cliente = params.get('cliente'), canal = params.get('canal')
    if (cliente && canal && raw[canal]?.length) {
      setShared(true)
      setChannel(canal)
      setOpenClient({ client: cliente, channel: canal })
    }
  }, [loading, raw, openClient])

  const getTarget = useCallback((name) => accounts[name]?.cplTarget ?? null, [accounts])

  // Período + estatísticas por canal (computado uma vez; reusado p/ contagem e render).
  const periods = useMemo(() => ({
    meta: mainPeriod(raw.meta, 'meta', days, customFrom, customTo),
    google: mainPeriod(raw.google, 'google', days, customFrom, customTo),
  }), [raw, days, customFrom, customTo])

  const statsByChannel = useMemo(() => {
    const build = (ch) => {
      const p = periods[ch]
      if (!p) return []
      let st = buildStats(raw[ch], CFG[ch], p)
      if (search) st = st.filter(s => s.name.toLowerCase().includes(search))
      if (squadFilter) st = st.filter(s => squadByAccount[s.name] === squadFilter)
      return st
    }
    return { meta: build('meta'), google: build('google') }
  }, [raw, periods, search, squadFilter, squadByAccount])

  const filterInfo = useMemo(() => {
    const p = periods[channel] || periods.meta || periods.google
    return p ? `Exibindo: ${p.label1} · Comparando com: ${p.label2}` : ''
  }, [periods, channel])

  // ── Handlers ───────────────────────────────────────────────────────────────
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
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(() => showToast('🔗 Link copiado')).catch(() => window.prompt('Copie o link:', url))
    else window.prompt('Copie o link:', url)
  }

  // Modais compartilhados pelas duas visões (lista e página de cliente).
  const modals = (
    <>
      {preview && <PreviewModal url={preview.url} name={preview.name} onClose={() => setPreview(null)} />}
      {mapModal && <MappingModal dashName={mapModal} projectsList={projectsList} cplTargets={cplTargets} currentProjectId={accounts[mapModal]?.projectId} onSave={dash.linkProject} onClose={() => setMapModal(null)} />}
      {cuMapModal && <ClickupMapModal dashName={cuMapModal} currentFolderId={accounts[cuMapModal]?.clickupOverride} onSave={dash.setClickupFolder} onClose={() => setCuMapModal(null)} />}
      {weekly && <WeeklyMessageModal client={weekly.client} periodLabel={weekly.periodLabel} initialText={weekly.text} onClose={() => setWeekly(null)} onToast={showToast} />}
      {toast && <div className="share-toast">{toast}</div>}
    </>
  )

  // Envolve o conteúdo na moldura padrão da AC (sidebar + top bar mobile).
  // No modo compartilhado, renderiza uma visão limpa, sem a moldura.
  const withShell = (inner) => {
    if (shared) return <div className="dt-root" style={{ minHeight: '100vh' }}>{inner}{modals}</div>
    return (
      <div className="min-h-screen flex bg-gradient-dark">
        <AppSidebar filter="dashboard" setFilter={() => navigate('/')} counts={{}} activeAccounts={[]} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 border-b border-rl-border bg-rl-bg/90 backdrop-blur-xl">
            <button onClick={() => setSidebarOpen(true)} aria-label="Abrir menu de navegação" className="p-2 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all">
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-gradient-rl flex items-center justify-center"><BarChart3 className="w-3.5 h-3.5 text-white" /></div>
              <span className="font-bold text-rl-text text-sm">Dashboard</span>
            </div>
          </div>
          <div className="dt-root flex-1 min-w-0" style={{ position: 'relative' }}>{inner}{modals}</div>
        </div>
      </div>
    )
  }

  // ── Render: página de cliente substitui a lista quando aberta ────────────────
  if (openClient) {
    return withShell(
      <ClientPage
          key={openClient.client + openClient.channel}
          client={openClient.client}
          channel={openClient.channel}
          raw={raw}
          initialDays={[3, 7, 14, 30].includes(days) || days === 'today' || days === 'yesterday' || days === 0 ? days : 7}
          initialPeriod={periods[openClient.channel]}
          account={accounts[openClient.client]}
          shared={shared}
          onClose={() => setOpenClient(null)}
          onPreview={(url, name) => setPreview({ url, name })}
          onOpenWeekly={openWeekly}
          onShare={shareLink}
          onOpenMap={(n) => setMapModal(n)}
          onOpenCuMap={(n) => setCuMapModal(n)}
        />
    )
  }

  return withShell(
    <>
      {loading && <div className="dt-loader"><div className="spinner" /><p>Carregando dados das planilhas…</p></div>}

      <div className="header">
        <div className="header-left">
          <h1>Dashboard Tráfego</h1>
          <p>Revenue Lab — Meta Ads &amp; Google Ads</p>
        </div>
        <div className="header-right">
          <div className="update-info">Última atualização<span>{lastUpdate ? lastUpdate.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</span></div>
          <button className={`btn${loading ? ' loading' : ''}`} onClick={dash.reload}>⟳ Atualizar</button>
        </div>
      </div>

      {/* Channel tabs */}
      <div className="tabs">
        <div className={`tab${channel === 'meta' ? ' active' : ''}`} onClick={() => setChannel('meta')}>📱 Meta Ads <span className="badge">{statsByChannel.meta.length}</span></div>
        <div className={`tab${channel === 'google' ? ' active' : ''}`} onClick={() => setChannel('google')}>🔍 Google Ads <span className="badge">{statsByChannel.google.length}</span></div>
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
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
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input type="text" placeholder="Buscar cliente…" value={search} onChange={e => setSearch(e.target.value.toLowerCase().trim())} />
          {search && <span className="clear-btn" style={{ display: 'block' }} onClick={() => setSearch('')}>✕</span>}
        </div>
        <span className="filter-info">{filterInfo}</span>
      </div>

      {/* Squad filter */}
      <div className="squad-bar">
        <span className="filter-label">Squad:</span>
        <button className={`squad-btn${squadFilter === '' ? ' active' : ''}`} onClick={() => setSquadFilter('')}>Todos</button>
        <button className={`squad-btn${squadFilter === 'Caça ROI' ? ' active' : ''}`} data-squad="Caça ROI" onClick={() => setSquadFilter('Caça ROI')}>🎯 Caça ROI</button>
        <button className={`squad-btn${squadFilter === 'Zero Churn' ? ' active' : ''}`} data-squad="Zero Churn" onClick={() => setSquadFilter('Zero Churn')}>🔒 Zero Churn</button>
      </div>

      {/* Active channel content */}
      <div className="tab-panel">
        {error ? (
          <div className="error-box">⚠️ Erro ao carregar: {error}<br /><small>Verifique se as planilhas estão com acesso público.</small></div>
        ) : (
          <ChannelSection
            rows={raw[channel]}
            cfg={CFG[channel]}
            period={periods[channel]}
            prefix={channel}
            stats={statsByChannel[channel]}
            accounts={accounts}
            setSquad={dash.setSquad}
            getTarget={getTarget}
            onOpenClient={(client, ch) => setOpenClient({ client, channel: ch })}
            onOpenMap={(n) => setMapModal(n)}
          />
        )}
      </div>
    </>
  )
}
