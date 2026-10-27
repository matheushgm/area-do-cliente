// Contas de anúncio vinculadas ao cliente (seção 1 do módulo Resultados).
// O vínculo mora em dashboard_accounts.project_id e é o que alimenta o Dashboard
// de Tráfego da seção 2 e o investimento/conversões que o funil puxa da API.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link2, Plus, Search, X, Loader2, Check } from 'lucide-react'

const normalizar = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const CANAL = {
  meta: { label: 'Meta Ads', logo: '/dash-teste/vendor/logos/meta.svg' },
  google: { label: 'Google Ads', logo: '/dash-teste/vendor/logos/google-ads.svg' },
}

export function CanalLogo({ canal, className = 'w-4 h-4' }) {
  const c = CANAL[canal]
  return c ? <img src={c.logo} alt={c.label} title={c.label} className={`${className} shrink-0`} /> : null
}

function Seletor({ dash, projectId, onVincular, onFechar }) {
  const [busca, setBusca] = useState('')
  const ref = useRef(null)
  useEffect(() => {
    const fora = (e) => { if (ref.current && !ref.current.contains(e.target)) onFechar() }
    const esc = (e) => { if (e.key === 'Escape') onFechar() }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc) }
  }, [onFechar])

  const opcoes = useMemo(() => {
    const q = normalizar(busca.trim())
    return (dash.allAccountNames || [])
      .filter((n) => dash.accounts?.[n]?.projectId !== projectId)
      .filter((n) => !q || normalizar(n).includes(q))
  }, [dash.allAccountNames, dash.accounts, projectId, busca])

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1.5 z-30 w-[360px] max-w-[calc(100vw-2rem)] glass-card border border-rl-border shadow-xl p-1.5">
      <div className="relative mb-1">
        <Search className="w-4 h-4 text-rl-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar conta de anúncio…" className="input-field !py-2 !pl-9 !pr-3" />
      </div>
      <div className="max-h-72 overflow-y-auto">
        {opcoes.length === 0 ? (
          <p className="text-xs text-rl-muted text-center py-4">Nenhuma conta encontrada</p>
        ) : opcoes.map((n) => {
          const outro = dash.accounts?.[n]?.projectId ? dash.accounts[n].acCompanyName || 'outro cliente' : null
          return (
            <button key={n} onClick={() => onVincular(n)} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left hover:bg-rl-surface transition-colors">
              <span className="flex items-center gap-1">{(dash.accountChannels?.[n] || []).map((c) => <CanalLogo key={c} canal={c} className="w-3.5 h-3.5" />)}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-rl-text truncate">{n}</span>
                {outro && <span className="block text-xs text-rl-gold truncate">Hoje em {outro}: vincular aqui tira de lá</span>}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function ContasVinculadas({ project, dash, showToast }) {
  const [abrir, setAbrir] = useState(false)
  const [salvando, setSalvando] = useState(null)

  const vinculadas = useMemo(() => Object.entries(dash.accounts || {})
    .filter(([, a]) => a.projectId === project.id)
    .map(([n]) => n)
    .sort((a, b) => a.localeCompare(b, 'pt-BR')), [dash.accounts, project.id])

  async function vincular(nome) {
    setAbrir(false)
    setSalvando(nome)
    try { await dash.linkProject(nome, project.id); showToast?.('Conta vinculada a este cliente') }
    catch (e) { showToast?.(e.message || 'Não foi possível vincular', 'error') }
    finally { setSalvando(null) }
  }
  async function desvincular(nome) {
    setSalvando(nome)
    try { await dash.linkProject(nome, null); showToast?.('Conta desvinculada') }
    catch (e) { showToast?.(e.message || 'Não foi possível desvincular', 'error') }
    finally { setSalvando(null) }
  }

  return (
    <div className="rounded-2xl border border-rl-border bg-rl-surface/40 p-4">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl fx-soft flex items-center justify-center shrink-0"><Link2 className="w-4 h-4" /></span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-rl-text">Contas de anúncio</p>
          <p className="text-xs text-rl-muted">De onde vêm o dashboard abaixo e o investimento e as conversões do funil.</p>
        </div>
        <div className="relative shrink-0">
          <button onClick={() => setAbrir((v) => !v)} className="btn-secondary text-sm flex items-center gap-1.5 !px-3 !py-1.5">
            <Plus className="w-4 h-4" /> Vincular conta
          </button>
          {abrir && <Seletor dash={dash} projectId={project.id} onVincular={vincular} onFechar={() => setAbrir(false)} />}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {dash.loading && vinculadas.length === 0 ? (
          <span className="flex items-center gap-2 text-xs text-rl-muted"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando contas…</span>
        ) : vinculadas.length === 0 ? (
          <button onClick={() => setAbrir(true)} className="w-full text-left rounded-xl border border-dashed border-rl-border px-4 py-3 text-sm text-rl-subtle hover:border-rl-purple/40 hover:text-rl-text transition-colors">
            Nenhuma conta vinculada. Vincule a conta do Meta e/ou do Google Ads deste cliente.
          </button>
        ) : vinculadas.map((n) => (
          <span key={n} className="group inline-flex items-center gap-2 pl-2.5 pr-1.5 py-1.5 rounded-xl bg-rl-card border border-rl-border text-sm text-rl-text">
            <span className="flex items-center gap-1">{(dash.accountChannels?.[n] || []).map((c) => <CanalLogo key={c} canal={c} />)}</span>
            {n}
            {(dash.accountChannels?.[n] || []).length === 0 && <span className="text-xs text-rl-muted">sem dados ainda</span>}
            {salvando === n ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-rl-muted" />
            ) : (
              <button onClick={() => desvincular(n)} title="Desvincular deste cliente" className="p-0.5 rounded-md text-rl-muted hover:text-red-500 hover:bg-red-500/10 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </span>
        ))}
        {salvando && !vinculadas.includes(salvando) && (
          <span className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-dashed border-rl-border text-sm text-rl-muted"><Check className="w-3.5 h-3.5" /> {salvando}</span>
        )}
      </div>
    </div>
  )
}
