import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import '../DashboardTrafego/dashboard.css'

// ─────────────────────────────────────────────────────────────────────────────
// ProjectTrafficDashboard — espelho do Dashboard de Tráfego (API) escopado às
// contas vinculadas a um projeto. Aqui só vive o vínculo de contas (chips +
// "+ vincular conta"); a visão de campanhas Meta/Google é o PRÓPRIO viewer de
// /dashboard-teste (public/dash-teste/viewer.html) em modo ?embed=1, travado na
// conta escolhida. Qualquer alteração feita no viewer aparece aqui sem retrabalho.
// ─────────────────────────────────────────────────────────────────────────────

const CHANNEL_LABEL = { meta: 'Meta', google: 'Google' }

// `dash` vem do ResultadosModule (uma única instância de useDashboardData é
// compartilhada com o painel de canais do funil, para não buscar 2x).
export default function ProjectTrafficDashboard({ project, dash }) {
  const { accounts, allAccountNames, accountChannels = {}, loading, error } = dash

  const [toast, setToast] = useState('')
  const [ativa, setAtiva] = useState(0)
  const [cheia, setCheia] = useState(false)
  const [altura, setAltura] = useState(1600)
  const iframeRef = useRef(null)

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

  // Uma entrada por (canal, conta): a mesma conta pode ter dados em Meta e Google.
  const contas = useMemo(() => {
    const out = []
    ;[...projectAccountNames].sort((a, b) => a.localeCompare(b, 'pt-BR')).forEach(n => {
      ;(accountChannels[n] || []).forEach(canal => out.push({ canal, conta: n }))
    })
    return out.sort((a, b) => (a.canal === b.canal ? 0 : a.canal === 'meta' ? -1 : 1))
  }, [projectAccountNames, accountChannels])

  // ── Vincular conta de anúncio a este cliente ─────────────────────────────────
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

  const idx = Math.min(ativa, Math.max(contas.length - 1, 0))
  const c = contas[idx]
  const src = c ? `/dash-teste/viewer.html?embed=1&cliente=${encodeURIComponent(c.conta)}&canal=${c.canal}` : null

  // Tela cheia: o mesmo iframe só muda de posição (fixed), sem recarregar.
  useEffect(() => {
    if (!cheia) return
    const h = (e) => { if (e.key === 'Escape') setCheia(false) }
    window.addEventListener('keydown', h)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = '' }
  }, [cheia])

  // Viewer é same-origin: acompanha a altura do conteúdo pra não ter 2 scrolls.
  const roRef = useRef(null)
  const onLoad = useCallback(() => {
    roRef.current?.disconnect()
    try {
      const doc = iframeRef.current?.contentDocument
      if (!doc?.documentElement) return
      const ro = new ResizeObserver(() => {
        const h = doc.documentElement.scrollHeight
        if (h > 300) setAltura(h)
      })
      ro.observe(doc.documentElement)
      roRef.current = ro
    } catch { /* cross-origin: mantém a altura padrão */ }
  }, [])
  useEffect(() => () => roRef.current?.disconnect(), [])

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

  const rotulo = (x) => `${CHANNEL_LABEL[x.canal]} · ${x.conta}`

  return (
    <div className="dt-root">
      {linker}

      {error && <div className="error-box">⚠️ Erro ao carregar tráfego: {error}</div>}

      {!error && loading && contas.length === 0 && (
        <div className="empty"><div className="spinner" style={{ margin: '0 auto 12px' }} /><p>Carregando contas de tráfego…</p></div>
      )}

      {!error && !loading && projectAccountNames.size === 0 && (
        <div className="empty" style={{ padding: '32px 20px' }}>
          <div style={{ marginBottom: 8, fontSize: 14 }}>Nenhuma conta de anúncio vinculada a este cliente.</div>
          <div style={{ fontSize: 12, color: '#94A3B8' }}>Use o seletor acima (<b style={{ color: '#64748B' }}>+ vincular conta</b>) para associar uma conta e ver as campanhas aqui.</div>
        </div>
      )}

      {!error && !loading && projectAccountNames.size > 0 && contas.length === 0 && (
        <div className="empty" style={{ padding: '32px 20px' }}>As contas vinculadas ainda não têm dados de campanha no dashboard.</div>
      )}

      {src && (
        <div className={cheia ? 'fixed inset-0 z-[70] bg-rl-bg flex flex-col' : 'space-y-3'}>
          <div className={`squad-bar ${cheia ? '' : ''}`} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', ...(cheia ? { padding: '10px 16px', borderBottom: '1px solid #D8E0F0', background: '#fff' } : {}) }}>
            <span className="filter-label">Conta:</span>
            {contas.map((x, i) => (
              <button key={x.canal + x.conta} className={`squad-btn${i === idx ? ' active' : ''}`} onClick={() => setAtiva(i)}>
                {x.canal === 'meta' ? '📱' : '🔍'} {rotulo(x)}
              </button>
            ))}
            <span style={{ flex: 1 }} />
            <button className="btn" onClick={() => setCheia(v => !v)} title={cheia ? 'Minimizar (Esc)' : 'Ver em tela cheia'} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {cheia ? <Minimize2 size={14} /> : <Maximize2 size={14} />}{cheia ? 'Minimizar' : 'Tela cheia'}
            </button>
          </div>
          <div className={cheia ? 'flex-1 min-h-0' : ''} style={cheia ? undefined : { border: '1px solid #D8E0F0', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
            <iframe
              ref={iframeRef}
              key={src}
              src={src}
              onLoad={onLoad}
              title={`Dashboard de Tráfego · ${c.conta}`}
              className="w-full border-0 block"
              style={cheia ? { height: '100%' } : { height: altura, minHeight: 600 }}
            />
          </div>
        </div>
      )}

      {toast && <div className="share-toast">{toast}</div>}
    </div>
  )
}
