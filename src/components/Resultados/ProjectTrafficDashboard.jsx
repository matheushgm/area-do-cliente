import { useMemo, useState, useCallback, useRef, useEffect } from 'react'
import { Maximize2, Minimize2, Loader2, AlertTriangle } from 'lucide-react'
import { CanalLogo } from './ContasVinculadas'

// ─────────────────────────────────────────────────────────────────────────────
// ProjectTrafficDashboard — espelho do Dashboard de Tráfego (API) escopado às
// contas vinculadas a um projeto (o vínculo fica em ContasVinculadas, logo acima).
// A visão de campanhas Meta/Google é o PRÓPRIO viewer de /dashboard-teste
// (public/dash-teste/viewer.html) em modo ?embed=1, travado na conta escolhida.
// Qualquer alteração feita no viewer aparece aqui sem retrabalho.
// `viewerExtra` acrescenta parâmetros ao viewer (o preview /dev/resultados passa &mock=1).
// ─────────────────────────────────────────────────────────────────────────────

const CHANNEL_LABEL = { meta: 'Meta', google: 'Google' }

// `dash` vem do ResultadosModule (uma única instância de useDashboardData é
// compartilhada com o painel de canais do funil, para não buscar 2x).
export default function ProjectTrafficDashboard({ project, dash, viewerExtra = '' }) {
  const { accounts, accountChannels = {}, loading, error } = dash

  const [ativa, setAtiva] = useState(0)
  const [cheia, setCheia] = useState(false)
  const [altura, setAltura] = useState(1600)
  const iframeRef = useRef(null)

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

  const idx = Math.min(ativa, Math.max(contas.length - 1, 0))
  const c = contas[idx]
  const src = c ? `/dash-teste/viewer.html?embed=1&cliente=${encodeURIComponent(c.conta)}&canal=${c.canal}${viewerExtra}` : null

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
      // Mede o <body> (altura do conteúdo), não o <html>: o scrollHeight do html
      // nunca fica menor que o iframe e a altura não encolhia ao minimizar painéis.
      const ro = new ResizeObserver(() => {
        const h = Math.ceil(doc.body.getBoundingClientRect().height)
        if (h > 100) setAltura(h + 8)
      })
      ro.observe(doc.body)
      roRef.current = ro
    } catch { /* cross-origin: mantém a altura padrão */ }
  }, [])
  useEffect(() => () => roRef.current?.disconnect(), [])

  const vazio = (texto) => (
    <div className="rounded-2xl border border-dashed border-rl-border px-4 py-10 text-center text-sm text-rl-subtle">{texto}</div>
  )

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-500 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0" /> Erro ao carregar o tráfego: {error}
      </div>
    )
  }
  if (loading && contas.length === 0) {
    return <div className="flex items-center justify-center gap-2 py-10 text-sm text-rl-muted"><Loader2 className="w-4 h-4 animate-spin" /> Carregando o dashboard…</div>
  }
  if (projectAccountNames.size === 0) return vazio('Vincule uma conta de anúncio acima para ver as campanhas aqui.')
  if (contas.length === 0) return vazio('As contas vinculadas ainda não têm dados de campanha no dashboard.')

  return (
    <div className={cheia ? 'fx fixed inset-0 z-[70] bg-rl-bg flex flex-col' : 'space-y-3'}>
      <div className={`flex items-center gap-1.5 flex-wrap ${cheia ? 'px-4 py-2.5 border-b border-rl-border bg-rl-card shrink-0' : ''}`}>
        {contas.length > 1 && contas.map((x, i) => (
          <button key={x.canal + x.conta} onClick={() => setAtiva(i)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm transition-colors ${i === idx ? 'bg-rl-purple/10 border-rl-purple/40 text-rl-purple font-semibold' : 'bg-rl-card border-rl-border text-rl-subtle hover:text-rl-text'}`}>
            <CanalLogo canal={x.canal} className="w-3.5 h-3.5" /> {CHANNEL_LABEL[x.canal]} · {x.conta}
          </button>
        ))}
        {contas.length === 1 && (
          <span className="inline-flex items-center gap-2 text-sm text-rl-subtle"><CanalLogo canal={c.canal} className="w-3.5 h-3.5" /> {CHANNEL_LABEL[c.canal]} · {c.conta}</span>
        )}
        <button onClick={() => setCheia(v => !v)} title={cheia ? 'Minimizar (Esc)' : 'Ver em tela cheia'} className="btn-secondary text-xs flex items-center gap-1.5 !px-3 !py-1.5 ml-auto">
          {cheia ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}{cheia ? 'Minimizar' : 'Tela cheia'}
        </button>
      </div>
      <div className={cheia ? 'flex-1 min-h-0' : 'rounded-2xl border border-rl-border overflow-hidden'}>
        <iframe
          ref={iframeRef}
          key={src}
          src={src}
          onLoad={onLoad}
          title={`Dashboard de Tráfego · ${c.conta}`}
          className="w-full border-0 block"
          style={cheia ? { height: '100%' } : { height: altura }}
        />
      </div>
    </div>
  )
}
