import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import AppSidebar from '../components/AppSidebar'
import {
  FAIXAS, REGRAS, BENCHMARKS, BENCHMARK_INTERNO, NOMENCLATURA, VISUALIZACOES, LINKS,
} from '../lib/adsRoadmap'
import { carregarRoadmapClickUp } from '../lib/adsRoadmapApi'
import {
  Menu, Zap, Waypoints, ExternalLink, ChevronDown, Table2, GitFork, ShieldCheck,
  Gauge, Tag, Columns3, Info, RefreshCw, Loader2, CloudOff, Cloud, BarChart3,
  ZoomIn, ZoomOut, Maximize2, Minimize2, LocateFixed, Move,
} from 'lucide-react'

// ─── Árvore campanha → conjunto → anúncios ───────────────────────────────────
// Desenho em HTML puro: cada linha é uma campanha; os conectores são bordas.
// Tracejado = opcional (só entra se o cliente tiver a condição na nota).

const SEG = { b2c: 'B2C', b2b: 'B2B' }

function Caixa({ titulo, sub, opcional, destaque, tag }) {
  return (
    <div
      className={`rounded-xl border px-3.5 py-2.5 min-w-[150px] ${
        opcional ? 'border-dashed border-rl-muted/60' : 'border-rl-border'
      } ${destaque ? 'bg-rl-purple/10' : 'bg-rl-surface'}`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`text-[15px] leading-tight ${destaque ? 'font-bold text-rl-text' : 'font-semibold text-rl-text'}`}>{titulo}</span>
        {tag && (
          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-rl-cyan/15 text-rl-cyan border border-rl-cyan/30">
            {tag}
          </span>
        )}
      </div>
      {sub && <div className="text-[12px] text-rl-muted leading-tight mt-1">{sub}</div>}
    </div>
  )
}

function Ad({ label, opcional }) {
  if (label === '…') return <div className="text-rl-muted text-base leading-none px-3">···</div>
  return (
    <div className={`rounded-lg border px-3 py-1.5 text-[13px] text-rl-text bg-rl-card whitespace-nowrap ${
      opcional ? 'border-dashed border-rl-muted/60' : 'border-rl-border'
    }`}>
      {label}
    </div>
  )
}

// Conector vertical + ramos horizontais, feito com bordas. O traço vertical
// vai só do centro do primeiro ramo ao centro do último.
function Ramo({ children, opcional }) {
  const b = opcional ? 'border-dashed border-rl-muted/60' : 'border-rl-border'
  const n = children.length
  return (
    <div className="flex flex-col gap-3">
      {children.map((child, i) => (
        <div key={i} className="flex items-stretch">
          <div className="w-5 shrink-0 flex flex-col">
            <div className={`flex-1 ${i === 0 ? '' : `border-l ${b}`}`} />
            <div className={`flex-1 ${i === n - 1 ? '' : `border-l ${b}`}`} />
          </div>
          <div className="flex items-center">
            <div className={`w-5 border-t ${b}`} />
            {child}
          </div>
        </div>
      ))}
    </div>
  )
}

function Conjunto({ c, opcional }) {
  const opc = opcional || c.opcional
  return (
    <div className="flex items-center">
      <Caixa titulo={c.nome} sub={c.sub} opcional={opc} />
      <div className="flex flex-col py-1">
        <Ramo opcional={opc}>
          {c.ads.map((a, i) => <Ad key={i} label={a} opcional={opc} />)}
        </Ramo>
        {c.nota && (
          <div className="text-[12px] text-rl-muted leading-snug pl-10 pt-1 italic max-w-[360px]">{c.nota}</div>
        )}
      </div>
    </div>
  )
}

function Campanha({ camp }) {
  const opc = camp.opcional
  return (
    <div className="flex items-center">
      <Caixa
        titulo={camp.nome}
        sub={[camp.sub, camp.verba].filter(Boolean).join(' · ')}
        opcional={opc}
        destaque
        tag={camp.tipo || null}
      />
      <Ramo opcional={opc}>
        {camp.conjuntos.map((c, i) => <Conjunto key={i} c={c} opcional={opc} />)}
      </Ramo>
    </div>
  )
}

// Lista de pontos do treinamento (embaixo do desenho). Item = string ou { t, sub[] }.
function Pontos({ itens }) {
  return (
    <ul className="space-y-2">
      {itens.map((it, i) => {
        const t = typeof it === 'string' ? it : it.t
        const sub = typeof it === 'string' ? null : it.sub
        return (
          <li key={i} className="text-[14px] text-rl-subtle leading-relaxed">
            <div className="flex gap-2.5"><span className="text-rl-cyan shrink-0">•</span><span className="text-rl-text">{t}</span></div>
            {sub?.length > 0 && (
              <ul className="pl-7 mt-1 space-y-1">
                {sub.map((x, j) => (
                  <li key={j} className="flex gap-2.5 text-[13px]"><span className="text-rl-muted shrink-0">◦</span><span>{x}</span></li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function Estrutura({ campanhas, notas, titulo, vazio, pontos, largura }) {
  return (
    // Dentro do canvas (largura definida) o desenho fica solto, sem caixa em volta.
    <div className={largura ? 'space-y-5 px-2' : 'glass-card p-6 space-y-5'} style={largura ? { minWidth: largura, maxWidth: largura + 160, width: 'max-content' } : undefined}>
      <div className="flex items-center gap-2">
        <GitFork className="w-5 h-5 text-rl-cyan" />
        <h3 className={`font-bold text-rl-text ${largura ? 'text-lg' : 'text-base'}`}>{titulo}</h3>
      </div>
      {campanhas ? (
        <div className={largura ? '' : 'overflow-x-auto'}>
          <div className="space-y-6 min-w-max py-1">
            {campanhas.map((camp, i) => <Campanha key={i} camp={camp} />)}
          </div>
        </div>
      ) : (
        <p className="text-sm text-rl-muted">{vazio}</p>
      )}
      {pontos?.length > 0 && (
        <div className="pt-4 border-t border-rl-border/60"><Pontos itens={pontos} /></div>
      )}
      {notas?.length > 0 && (
        <ul className="text-[12px] text-rl-subtle space-y-1 pt-3 border-t border-rl-border/60">
          {notas.map((n, i) => <li key={i}>• {n}</li>)}
        </ul>
      )}
    </div>
  )
}

// ─── Tabela explicativa ──────────────────────────────────────────────────────
function Tabela({ rows, seg }) {
  const cols = seg === 'ambos' ? ['b2c', 'b2b'] : [seg]
  return (
    <div className="glass-card overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-rl-border">
        <Table2 className="w-4 h-4 text-rl-cyan" />
        <h3 className="text-sm font-bold text-rl-text">Tabela explicativa</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-rl-surface text-left">
              <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-rl-muted w-48">Parâmetro</th>
              {cols.map((c) => (
                <th key={c} className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-rl-muted">{SEG[c]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([param, b2c, b2b], i) => {
              const val = { b2c, b2b }
              return (
                <tr key={i} className="border-t border-rl-border/60 align-top">
                  <td className="px-4 py-3 font-semibold text-rl-text text-[13px]">{param}</td>
                  {cols.map((c) => (
                    <td key={c} className={`px-4 py-3 text-[13px] whitespace-pre-line leading-relaxed ${
                      val[c] === 'Não faz' ? 'text-rl-muted italic' : 'text-rl-subtle'
                    }`}>
                      {val[c] || <span className="text-rl-muted">–</span>}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Regras universais (acordeão) ────────────────────────────────────────────
function Acordeao({ Icon, titulo, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-5 py-3.5 text-left hover:bg-rl-surface/60 transition-colors"
        aria-expanded={open}
      >
        <Icon className="w-4 h-4 text-rl-cyan shrink-0" />
        <span className="text-sm font-bold text-rl-text flex-1">{titulo}</span>
        <ChevronDown className={`w-4 h-4 text-rl-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-5 pb-5 pt-1 border-t border-rl-border/60">{children}</div>}
    </div>
  )
}

function Regras() {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {REGRAS.map((r) => (
        <div key={r.id} className="glass-card p-5">
          <h4 className="text-sm font-bold text-rl-text mb-2">{r.titulo}</h4>
          <ul className="space-y-1.5">
            {r.itens.map((it, i) => (
              <li key={i} className="text-[13px] text-rl-subtle leading-relaxed flex gap-2">
                <span className="text-rl-cyan shrink-0">•</span>
                <span>{it}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function Benchmarks() {
  return (
    <div className="grid md:grid-cols-3 gap-4">
      {BENCHMARKS.map((b) => (
        <div key={b.etapa} className="glass-card p-5 space-y-3">
          <div>
            <h4 className="text-sm font-bold text-rl-text">{b.etapa}</h4>
            <p className="text-[12px] text-rl-muted">{b.objetivo}</p>
          </div>
          <table className="w-full text-[12px]">
            <tbody>
              {b.metricas.map(([m, v]) => (
                <tr key={m} className="border-t border-rl-border/60">
                  <td className="py-1.5 pr-2 text-rl-subtle">{m}</td>
                  <td className="py-1.5 text-rl-text font-semibold text-right whitespace-nowrap">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[12px] text-rl-muted italic leading-snug">{b.otimizacao}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Benchmark interno (portfólio) ───────────────────────────────────────────
// Números reais das contas do dashboard, 30 dias. Dados em BENCHMARK_INTERNO.
function TabelaContas({ cols, rows, titulo }) {
  return (
    <div>
      <div className="text-[13px] font-semibold text-rl-text mb-2">{titulo}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-rl-muted">
              {cols.map((c, i) => (
                <th key={c} className={`py-2 pr-3 whitespace-nowrap ${i > 0 ? 'text-right' : ''}`}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[0]} className="border-t border-rl-border/60">
                {r.map((v, i) => (
                  <td key={i} className={`py-1.5 pr-3 whitespace-nowrap ${
                    i === 0 ? 'font-semibold text-rl-text' : 'text-right text-rl-subtle tabular-nums'
                  }`}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BenchmarkInterno({ seg }) {
  const B = BENCHMARK_INTERNO
  const segs = seg === 'ambos' ? ['b2b', 'b2c'] : [seg]
  const canais = [['meta', 'Meta Ads'], ['google', 'Google Ads']]
  return (
    <div className="space-y-5">
      <div className="text-[13px] text-rl-subtle leading-relaxed">
        <p><strong className="text-rl-text">Período:</strong> {B.periodo}. {B.fonte}</p>
        <p className="mt-1">{B.comoUsar}</p>
      </div>

      {/* Referência rápida: mediana + ponderada */}
      <div className="grid md:grid-cols-2 gap-4">
        {canais.map(([canal, nome]) => {
          const m = B.mediana[canal]
          return (
            <div key={canal} className="glass-card p-4">
              <h4 className="text-sm font-bold text-rl-text mb-2">{nome} · referência (mediana)</h4>
              <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-rl-muted">
                    <th className="py-1.5 pr-2">Seg.</th>
                    {m.cols.map((c) => <th key={c} className="py-1.5 pr-2 text-right whitespace-nowrap">{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {segs.map((sg) => (
                    <tr key={sg} className="border-t border-rl-border/60">
                      <td className="py-1.5 pr-2 font-semibold text-rl-text">{SEG[sg]}</td>
                      {m[sg].map((v, i) => (
                        <td key={i} className="py-1.5 pr-2 text-right text-rl-text font-semibold tabular-nums whitespace-nowrap">{v}</td>
                      ))}
                    </tr>
                  ))}
                  {segs.map((sg) => (
                    <tr key={`p-${sg}`} className="border-t border-rl-border/40">
                      <td className="py-1.5 pr-2 text-rl-muted text-[11px]">{SEG[sg]} ponderada</td>
                      {B.ponderada[canal][sg].map((v, i) => (
                        <td key={i} className="py-1.5 pr-2 text-right text-rl-muted tabular-nums whitespace-nowrap">{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )
        })}
      </div>

      {/* Conta a conta */}
      {canais.map(([canal, nome]) => (
        <div key={canal} className={`grid gap-4 ${segs.length > 1 ? 'xl:grid-cols-2' : ''}`}>
          {segs.map((sg) => (
            <div key={sg} className="glass-card p-4">
              <TabelaContas titulo={`${nome} · ${SEG[sg]}, conta a conta`} cols={B[canal].cols} rows={B[canal][sg]} />
            </div>
          ))}
        </div>
      ))}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <h4 className="text-sm font-bold text-rl-text mb-2">Como cada métrica foi calculada</h4>
          <ul className="space-y-1">
            {B.definicoes.map(([m, d]) => (
              <li key={m} className="text-[12px] text-rl-subtle"><span className="font-semibold text-rl-text">{m}:</span> {d}</li>
            ))}
          </ul>
        </div>
        <div className="glass-card p-4">
          <h4 className="text-sm font-bold text-rl-text mb-2">Ressalvas na leitura</h4>
          <ul className="space-y-1.5">
            {B.ressalvas.map((r, i) => (
              <li key={i} className="text-[12px] text-rl-subtle leading-relaxed flex gap-2">
                <span className="text-rl-cyan shrink-0">•</span><span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="text-[11px] text-rl-muted">Atualizado em {B.atualizadoEm}. Os dados ficam em <code className="text-rl-cyan">BENCHMARK_INTERNO</code> em <code className="text-rl-cyan">src/lib/adsRoadmap.js</code>.</p>
    </div>
  )
}

// ─── Canvas navegável do mapa mental ─────────────────────────────────────────
// Uma tela só, grande: arrasta pra mover, roda do mouse (ou botões) pra zoom,
// botão de tela cheia pra apresentar. O conteúdo é o mesmo JSX dos cards.
const ZOOM_MIN = 0.35
const ZOOM_MAX = 2.5

function MapaCanvas({ children, fitKey }) {
  const viewRef = useRef(null)
  const contentRef = useRef(null)
  const [t, setT] = useState({ x: 0, y: 0, k: 1 })
  const [full, setFull] = useState(false)
  const drag = useRef(null)
  const [dragging, setDragging] = useState(false)

  const clampK = (k) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, k))

  // Enquadra o conteúdo inteiro na tela (com margem), centralizado.
  const fit = () => {
    const v = viewRef.current, c = contentRef.current
    if (!v || !c) return
    const vw = v.clientWidth, vh = v.clientHeight
    const cw = c.scrollWidth, ch = c.scrollHeight
    if (!cw || !ch) return
    const k = clampK(Math.min((vw - 48) / cw, (vh - 48) / ch, 1.15))
    setT({ x: (vw - cw * k) / 2, y: Math.max(24, (vh - ch * k) / 2), k })
  }
  useLayoutEffect(() => { fit() }, [fitKey, full]) // eslint-disable-line react-hooks/exhaustive-deps

  // Zoom em torno do cursor (roda do mouse). Listener manual pra poder
  // preventDefault (React registra wheel como passive).
  useEffect(() => {
    const v = viewRef.current
    if (!v) return
    const onWheel = (e) => {
      e.preventDefault()
      const rect = v.getBoundingClientRect()
      const mx = e.clientX - rect.left, my = e.clientY - rect.top
      setT((p) => {
        const k = clampK(p.k * (e.deltaY < 0 ? 1.1 : 0.9))
        const r = k / p.k
        return { k, x: mx - (mx - p.x) * r, y: my - (my - p.y) * r }
      })
    }
    v.addEventListener('wheel', onWheel, { passive: false })
    return () => v.removeEventListener('wheel', onWheel)
  }, [])

  const zoomBy = (f) => {
    const v = viewRef.current
    if (!v) return
    const mx = v.clientWidth / 2, my = v.clientHeight / 2
    setT((p) => {
      const k = clampK(p.k * f)
      const r = k / p.k
      return { k, x: mx - (mx - p.x) * r, y: my - (my - p.y) * r }
    })
  }

  const onPointerDown = (e) => {
    if (e.button !== 0) return
    drag.current = { sx: e.clientX, sy: e.clientY, ox: t.x, oy: t.y }
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e) => {
    if (!drag.current) return
    const d = drag.current
    setT((p) => ({ ...p, x: d.ox + (e.clientX - d.sx), y: d.oy + (e.clientY - d.sy) }))
  }
  const onPointerUp = () => { drag.current = null; setDragging(false) }

  // Esc sai da tela cheia
  useEffect(() => {
    if (!full) return
    const onKey = (e) => { if (e.key === 'Escape') setFull(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [full])

  const btn = 'w-9 h-9 rounded-lg bg-rl-card/90 border border-rl-border text-rl-subtle hover:text-rl-text hover:bg-rl-surface flex items-center justify-center transition-colors'

  return (
    <div className={full
      ? 'fixed inset-0 z-[80] bg-rl-bg'
      : 'glass-card relative overflow-hidden h-[78vh] min-h-[560px]'}>
      <div
        ref={viewRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`absolute inset-0 select-none touch-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{
          backgroundImage: 'radial-gradient(rgba(148,163,184,0.18) 1px, transparent 1px)',
          backgroundSize: `${24 * t.k}px ${24 * t.k}px`,
          backgroundPosition: `${t.x}px ${t.y}px`,
        }}
      >
        <div
          ref={contentRef}
          className="absolute top-0 left-0 w-max"
          style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.k})`, transformOrigin: '0 0' }}
        >
          {children}
        </div>
      </div>

      {/* Controles */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5">
        <button className={btn} onClick={() => zoomBy(1 / 1.2)} title="Diminuir zoom"><ZoomOut className="w-4 h-4" /></button>
        <span className="h-9 px-2 rounded-lg bg-rl-card/90 border border-rl-border text-[11px] font-bold text-rl-subtle flex items-center tabular-nums">{Math.round(t.k * 100)}%</span>
        <button className={btn} onClick={() => zoomBy(1.2)} title="Aumentar zoom"><ZoomIn className="w-4 h-4" /></button>
        <button className={btn} onClick={fit} title="Enquadrar o mapa"><LocateFixed className="w-4 h-4" /></button>
        <button className={btn} onClick={() => setFull((f) => !f)} title={full ? 'Sair da tela cheia (Esc)' : 'Tela cheia'}>
          {full ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
      <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-[11px] text-rl-muted bg-rl-card/80 border border-rl-border rounded-lg px-2 py-1 pointer-events-none">
        <Move className="w-3.5 h-3.5" /> arraste pra mover · roda do mouse pra zoom
      </div>
    </div>
  )
}

// ─── Página ──────────────────────────────────────────────────────────────────
export default function AdsRoadmap() {
  const navigate = useNavigate()
  const { squads, teamMembers } = useApp()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const emptyCounts = { all: 0, churn: 0, squads: {}, risks: {}, momentos: {} }
  const activeAccounts = teamMembers.filter((m) => !m.disabled)

  const [faixaId, setFaixaId] = useState('3k')
  const [seg, setSeg] = useState('b2c') // 'b2c' | 'b2b' | 'ambos'

  // Tabelas vêm da página do ClickUp (fonte única); os desenhos ficam no JS.
  // Se a API falhar, cai na cópia local de src/lib/adsRoadmap.js.
  const [remoto, setRemoto] = useState(null)   // { faixas, updatedAt, url }
  const [fonte, setFonte] = useState('carregando') // 'carregando' | 'clickup' | 'local'
  const [erroRemoto, setErroRemoto] = useState(null)
  const [atualizando, setAtualizando] = useState(false)

  const carregar = async (refresh = false) => {
    setAtualizando(true)
    try {
      const d = await carregarRoadmapClickUp({ refresh })
      if (!d?.faixas?.length) throw new Error('A página do ClickUp não tem tabelas de orçamento.')
      setRemoto(d); setFonte('clickup'); setErroRemoto(null)
    } catch (e) {
      setFonte('local'); setErroRemoto(e?.message || 'Falha ao ler o ClickUp')
    } finally {
      setAtualizando(false)
    }
  }
  useEffect(() => { carregar(false) }, [])

  // Lista final: faixas do ClickUp com o desenho local da mesma faixa (por id).
  const faixas = useMemo(() => {
    if (fonte !== 'clickup' || !remoto) return FAIXAS
    return remoto.faixas.map((r) => {
      const local = FAIXAS.find((f) => f.id === r.id)
      return {
        id: r.id, label: r.label, verbaMensal: r.verbaMensal, verbaDia: r.verbaDia,
        resumo: r.resumo || local?.resumo || '',
        rows: r.rows,
        estrutura: local?.estrutura || null,
      }
    })
  }, [fonte, remoto])

  const faixa = useMemo(() => faixas.find((f) => f.id === faixaId) || faixas[0], [faixas, faixaId])
  const est = faixa.estrutura

  const segBtn = (id, label) => (
    <button
      key={id}
      onClick={() => setSeg(id)}
      className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
        seg === id ? 'bg-rl-purple text-white' : 'text-rl-subtle hover:text-rl-text hover:bg-rl-surface'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="min-h-screen flex bg-gradient-dark">
      <AppSidebar
        filter="all"
        setFilter={() => navigate('/')}
        counts={emptyCounts}
        activeAccounts={activeAccounts}
        squads={squads}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 border-b border-rl-border bg-rl-bg/90 backdrop-blur-xl">
          <button onClick={() => setSidebarOpen(true)} aria-label="Abrir menu de navegação" className="p-2 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-rl flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-rl-text text-sm">ADS Roadmap</span>
          </div>
        </div>

        <main className="flex-1 px-6 py-8">
          <div className="max-w-7xl mx-auto space-y-8">

            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rl-cyan/10 flex items-center justify-center">
                  <Waypoints className="w-5 h-5 text-rl-cyan" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-rl-text">ADS Roadmap</h1>
                  <p className="text-sm text-rl-muted">O que dá pra montar de campanha com a verba que o cliente trouxe</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  title={fonte === 'clickup'
                    ? `Tabelas lidas da página do ClickUp${remoto?.updatedAt ? ` · editada em ${new Date(remoto.updatedAt).toLocaleString('pt-BR')}` : ''}`
                    : (erroRemoto || 'Carregando…')}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${
                    fonte === 'clickup'
                      ? 'bg-rl-green/10 text-rl-green border-rl-green/30'
                      : fonte === 'local'
                        ? 'bg-rl-gold/10 text-rl-gold border-rl-gold/30'
                        : 'bg-rl-surface text-rl-muted border-rl-border'
                  }`}
                >
                  {fonte === 'clickup' ? <Cloud className="w-3 h-3" /> : fonte === 'local' ? <CloudOff className="w-3 h-3" /> : <Loader2 className="w-3 h-3 animate-spin" />}
                  {fonte === 'clickup' ? 'Tabelas do ClickUp' : fonte === 'local' ? 'Cópia local (ClickUp indisponível)' : 'Lendo o ClickUp…'}
                </span>
                <button
                  onClick={() => carregar(true)}
                  disabled={atualizando}
                  title="Reler a página do ClickUp agora"
                  className="btn-secondary !px-3 !py-2 text-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${atualizando ? 'animate-spin' : ''}`} /> Atualizar
                </button>
                <a href={remoto?.url || LINKS.roadmapClickUp} target="_blank" rel="noopener noreferrer" className="btn-secondary !px-4 !py-2 text-xs flex items-center gap-1.5">
                  Editar no ClickUp <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Seletor de verba */}
            <div className="glass-card p-4 space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rl-muted mr-1">Verba mensal</span>
                  {faixas.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFaixaId(f.id)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                        f.id === faixaId
                          ? 'bg-gradient-rl text-white border-transparent shadow-card'
                          : 'bg-rl-surface text-rl-subtle border-rl-border hover:text-rl-text hover:border-rl-purple/40'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1 p-1 rounded-xl bg-rl-surface border border-rl-border">
                  {segBtn('b2c', 'B2C')}
                  {segBtn('b2b', 'B2B')}
                  {segBtn('ambos', 'Lado a lado')}
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm text-rl-subtle">
                <Info className="w-4 h-4 text-rl-cyan shrink-0 mt-0.5" />
                <p>
                  <strong className="text-rl-text">{faixa.label}</strong> · R$ {faixa.verbaDia}/dia. {faixa.resumo}
                </p>
              </div>
            </div>

            {/* Estruturas: mapa mental numa tela só, navegável */}
            <section className="space-y-4">
              <h2 className="text-base font-bold text-rl-text">Estrutura de campanhas</h2>
              {!est && (
                <div className="glass-card p-5 text-sm text-rl-muted">
                  Essa faixa existe na página do ClickUp mas ainda não tem desenho de estrutura no app. Adicione em <code className="text-rl-cyan">src/lib/adsRoadmap.js</code>.
                </div>
              )}
              {est && (() => {
                const ou = !!est.google?.ou
                const W = 620 // largura de cada coluna do mapa (px, antes do zoom)
                const metaCards = [
                  (seg === 'b2c' || seg === 'ambos') && (
                    <Estrutura
                      key="b2c"
                      largura={W}
                      titulo={`Estrutura Meta · B2C · R$ ${faixa.verbaDia}/dia`}
                      campanhas={est.b2c}
                      notas={est.notas?.b2c}
                      pontos={est.pontos?.b2c}
                      vazio="B2C não faz nessa faixa."
                    />
                  ),
                  (seg === 'b2b' || seg === 'ambos') && (
                    <Estrutura
                      key="b2b"
                      largura={W}
                      titulo={`Estrutura Meta · B2B · R$ ${faixa.verbaDia}/dia`}
                      campanhas={est.b2b}
                      notas={est.notas?.b2b}
                      pontos={est.pontos?.b2b}
                      vazio="B2B não faz nessa faixa: nenhum canal (Meta ou Google) roda com essa verba diária."
                    />
                  ),
                ].filter(Boolean)
                // Google só aparece se algum segmento exibido faz a faixa (B2B em R$ 1k
                // não roda nem Meta nem Google: nenhum mapa).
                const algumFaz = (seg !== 'b2b' && !!est.b2c) || (seg !== 'b2c' && !!est.b2b)
                const googleCard = est.google && algumFaz && (
                  <Estrutura
                    key="google"
                    largura={W}
                    titulo={`${est.google.titulo}${ou ? ` · R$ ${faixa.verbaDia}/dia` : ''}`}
                    campanhas={est.google.campanhas}
                    notas={[est.google.nota]}
                    pontos={est.pontos?.google}
                  />
                )
                const fazMeta = (c) => (c.key === 'b2c' ? !!est.b2c : !!est.b2b)
                const pares = ou ? metaCards.filter(fazMeta) : metaCards
                const avisos = ou ? metaCards.filter((c) => !fazMeta(c)) : []
                return (
                  <MapaCanvas fitKey={`${faixa.id}|${seg}`}>
                    <div className="p-8 space-y-6">
                      <div className="text-center">
                        <div className="text-2xl font-black text-rl-text tracking-tight">{faixa.label}</div>
                        <div className="text-[13px] text-rl-muted">R$ {faixa.verbaDia}/dia · {faixa.resumo}</div>
                      </div>
                      <div className="flex items-start gap-8">
                        <div className="space-y-6">{pares}</div>
                        {googleCard && (
                          <>
                            {ou && (
                              <div className="self-center shrink-0">
                                <span className="text-base font-black uppercase tracking-widest text-rl-cyan bg-rl-cyan/10 border border-rl-cyan/30 rounded-full px-4 py-1.5">ou</span>
                              </div>
                            )}
                            <div>{googleCard}</div>
                          </>
                        )}
                      </div>
                      {avisos.length > 0 && <div className="space-y-6">{avisos}</div>}
                    </div>
                  </MapaCanvas>
                )
              })()}
            </section>

            {/* Tabela (recolhida por padrão: o mapa é o que guia o treinamento) */}
            <section className="space-y-4">
              <Acordeao Icon={Table2} titulo="Tabela explicativa (parâmetros da faixa)">
                <div className="pt-3"><Tabela rows={faixa.rows} seg={seg} /></div>
              </Acordeao>
            </section>

            {/* Regras universais */}
            <section className="space-y-4">
              <h2 className="text-base font-bold text-rl-text">Regras que valem em toda faixa</h2>
              <Acordeao Icon={ShieldCheck} titulo="Otimizar, desligar, escalar, verba mínima, canais e Laboratório" defaultOpen>
                <div className="pt-3"><Regras /></div>
              </Acordeao>
              <Acordeao Icon={Gauge} titulo="Benchmarks por etapa do funil (Protocolo)">
                <div className="pt-3"><Benchmarks /></div>
              </Acordeao>
              <Acordeao Icon={BarChart3} titulo={`Benchmark interno do portfólio (${BENCHMARK_INTERNO.periodo})`}>
                <div className="pt-3"><BenchmarkInterno seg={seg} /></div>
              </Acordeao>
              <Acordeao Icon={Tag} titulo="Nomenclatura de campanha, conjunto e anúncio">
                <table className="w-full text-sm mt-3">
                  <thead>
                    <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-rl-muted">
                      <th className="py-2 pr-4">Nível</th><th className="py-2 pr-4">Padrão</th><th className="py-2">Exemplo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {NOMENCLATURA.map(([n, p, e]) => (
                      <tr key={n} className="border-t border-rl-border/60">
                        <td className="py-2 pr-4 font-semibold text-rl-text">{n}</td>
                        <td className="py-2 pr-4 text-rl-subtle">{p}</td>
                        <td className="py-2 font-mono text-[12px] text-rl-cyan">{e}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Acordeao>
              <Acordeao Icon={Columns3} titulo="Visualizações de coluna no Gerenciador (criar uma vez por conta)">
                <div className="space-y-3 mt-3">
                  {VISUALIZACOES.map((v) => (
                    <div key={v.nome}>
                      <div className="text-[13px] font-semibold text-rl-text">{v.nome}</div>
                      <div className="text-[12px] text-rl-subtle leading-relaxed">{v.colunas}</div>
                    </div>
                  ))}
                </div>
              </Acordeao>
              <p className="text-[12px] text-rl-muted">
                As tabelas são lidas da página Roadmap Ads do Playbook Operacional no ClickUp (cache de 5 min). Os desenhos de estrutura e as regras desta seção ficam em <code className="text-rl-cyan">src/lib/adsRoadmap.js</code>.
                {' '}<a href={LINKS.labClickUp} target="_blank" rel="noopener noreferrer" className="text-rl-cyan hover:underline">Laboratório REV</a>
              </p>
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}
