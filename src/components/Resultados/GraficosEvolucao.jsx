// Evolução do funil num gráfico só (pedido do Matheus, 2026-10-27): investido e receita em
// barras no eixo de reais (esquerda) e leads em linha no eixo de quantidade (direita).
// Os dois eixos são rotulados e o tooltip traz os valores exatos, mais CPL e ROAS do período.
// Período sem dado (futuro) fica vazio, sem despencar a zero. Cores em `.viz`
// (src/index.css), validadas para daltonismo no claro e no escuro.
import { useEffect, useRef, useState } from 'react'
import { fmtMoney } from './resultadosHelpers'

const COR = { investido: 'rgb(var(--viz-1))', receita: 'rgb(var(--viz-2))', leads: 'rgb(var(--viz-3))' }
const ALTURA = 280
const M = { top: 30, right: 48, bottom: 26, left: 70 }

const compacto = (v, dinheiro) => {
  const abs = Math.abs(v)
  const txt = abs >= 1e6 ? `${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
    : abs >= 1e3 ? `${(v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
      : v.toLocaleString('pt-BR', { maximumFractionDigits: dinheiro ? 0 : 1 })
  return dinheiro ? `R$ ${txt}` : txt
}

// Topo "redondo" do eixo, divisível em 4 marcas: 4, 8, 10, 20, 40, 50, 80 × 10^n
function topoRedondo(max) {
  if (!(max > 0)) return 4
  const p = 10 ** Math.floor(Math.log10(max))
  for (const m of [1, 2, 4, 5, 8, 10]) if (m * p >= max) return Math.max(m * p, 4)
  return 10 * p
}

function useLargura() {
  const ref = useRef(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

// Barra com o topo arredondado (4px) e a base reta
function barra(x, y, w, h) {
  const r = Math.min(4, w / 2, h)
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

function Legenda({ cor, linha, children }) {
  return (
    <span className="flex items-center gap-1.5 text-sm text-rl-subtle">
      {linha
        ? <span className="relative w-4 h-2.5 flex items-center"><span className="w-4 h-0.5 rounded-full" style={{ background: cor }} /><span className="absolute left-1/2 -translate-x-1/2 w-2 h-2 rounded-full" style={{ background: cor }} /></span>
        : <span className="w-3 h-3 rounded-sm" style={{ background: cor }} />}
      {children}
    </span>
  )
}

// labels: rótulo curto do eixo X; nomes: rótulo do tooltip; rotuloX(i): esconde rótulos (diário)
// periodos: [{ investido, leads, vendas, receita } | null] na ordem de `labels`
export default function GraficosEvolucao({ titulo, labels, nomes, rotuloX, periodos }) {
  const [ref, W] = useLargura()
  const [hover, setHover] = useState(null)
  const n = labels.length
  const H = ALTURA
  const pw = Math.max(0, W - M.left - M.right), ph = H - M.top - M.bottom

  const val = (k) => periodos.map((p) => (p ? p[k] || 0 : null))
  const inv = val('investido'), rec = val('receita'), leads = val('leads')
  const maxR = topoRedondo(Math.max(0, ...inv, ...rec))
  const maxL = topoRedondo(Math.max(0, ...leads))
  const yR = (v) => M.top + ph - (v / maxR) * ph
  const yL = (v) => M.top + ph - (v / maxL) * ph
  const banda = n ? pw / n : 0
  const xc = (i) => M.left + banda * i + banda / 2
  const marcas = [0, 0.25, 0.5, 0.75, 1]

  // duas barras por período (investido, receita), até 24px cada, 2px de vão
  const lb = Math.max(2, Math.min(24, (banda * 0.7 - 2) / 2))
  const grupo = lb * 2 + 2

  // linha de leads: segmentos entre períodos com dado
  const segs = []; let atual = []
  leads.forEach((v, i) => { if (v == null) { if (atual.length) segs.push(atual); atual = [] } else atual.push([xc(i), yL(v)]) })
  if (atual.length) segs.push(atual)

  const soma = (arr) => arr.reduce((s, v) => s + (v || 0), 0)
  const tInv = soma(inv), tRec = soma(rec), tLeads = soma(leads)

  function mover(e) {
    const r = e.currentTarget.getBoundingClientRect()
    const i = Math.floor((e.clientX - r.left - M.left) / banda)
    setHover(i >= 0 && i < n ? i : null)
  }

  const p = hover != null ? periodos[hover] : null

  return (
    <div className="viz rounded-2xl border border-rl-border bg-rl-card p-5 min-w-0">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
        <div>
          <p className="text-base font-semibold text-rl-text">{titulo}</p>
          <p className="text-sm text-rl-subtle mt-0.5 tabular-nums">
            {fmtMoney(tInv)} investidos · {tLeads.toLocaleString('pt-BR')} leads · {fmtMoney(tRec)} de receita
          </p>
        </div>
        <div className="flex items-center gap-4 flex-wrap pt-1">
          <Legenda cor={COR.investido}>Investido</Legenda>
          <Legenda cor={COR.receita}>Receita</Legenda>
          <Legenda cor={COR.leads} linha>Leads</Legenda>
        </div>
      </div>

      <div ref={ref} className="relative" style={{ height: H }}>
        {W > 0 && (
          <svg width={W} height={H} className="block" onMouseMove={mover} onMouseLeave={() => setHover(null)} role="img"
            aria-label={`${titulo}: investido, receita e leads por período`}>
            {/* nomes dos eixos */}
            <text x={M.left - 8} y={12} textAnchor="end" fontSize="12" fontWeight="600" fill="rgb(var(--rl-muted))">Reais</text>
            <text x={W - M.right + 8} y={12} textAnchor="start" fontSize="12" fontWeight="600" fill="rgb(var(--rl-muted))">Leads</text>
            {marcas.map((f) => (
              <g key={f}>
                <line x1={M.left} x2={W - M.right} y1={M.top + ph - f * ph} y2={M.top + ph - f * ph} stroke="rgb(var(--rl-border))" strokeWidth="1" />
                <text x={M.left - 8} y={M.top + ph - f * ph} dy="0.32em" textAnchor="end" fontSize="12" fill="rgb(var(--rl-muted))">{compacto(f * maxR, true)}</text>
                <text x={W - M.right + 8} y={M.top + ph - f * ph} dy="0.32em" textAnchor="start" fontSize="12" fill="rgb(var(--rl-muted))">{compacto(f * maxL, false)}</text>
              </g>
            ))}
            {hover != null && <rect x={M.left + banda * hover} y={M.top} width={banda} height={ph} fill="rgb(var(--rl-surface))" />}
            {labels.map((l, i) => {
              const t = rotuloX ? rotuloX(i) : l
              return t ? <text key={i} x={xc(i)} y={H - 6} textAnchor="middle" fontSize="12" fill="rgb(var(--rl-muted))">{t}</text> : null
            })}

            {[['investido', inv, 0], ['receita', rec, 1]].map(([k, vals, si]) => vals.map((v, i) => {
              if (!v) return null
              const x = xc(i) - grupo / 2 + si * (lb + 2)
              return <path key={k + i} d={barra(x, yR(v), lb, M.top + ph - yR(v))} fill={COR[k]} />
            }))}

            {segs.map((pts, j) => (pts.length > 1
              ? <polyline key={j} points={pts.map((q) => q.join(',')).join(' ')} fill="none" stroke={COR.leads} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              : null))}
            {leads.map((v, i) => (v == null ? null : (
              <circle key={i} cx={xc(i)} cy={yL(v)} r={hover === i ? 5 : n > 12 ? 2.5 : 4} fill={COR.leads} stroke="rgb(var(--rl-card))" strokeWidth={n > 12 && hover !== i ? 1 : 2} />
            )))}
          </svg>
        )}

        {hover != null && W > 0 && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg border border-rl-border bg-rl-card shadow-lg px-3 py-2 text-sm whitespace-nowrap min-w-[190px]"
            style={{ left: Math.min(Math.max(xc(hover), 100), W - 100), top: 0, transform: 'translateX(-50%)' }}
          >
            <p className="text-xs text-rl-muted mb-1">{(nomes || labels)[hover]}</p>
            {p ? (
              <>
                {[['Investido', COR.investido, fmtMoney(p.investido || 0)], ['Receita', COR.receita, fmtMoney(p.receita || 0)], ['Leads', COR.leads, (p.leads || 0).toLocaleString('pt-BR')]].map(([l, c, v]) => (
                  <p key={l} className="flex items-center gap-2 text-rl-text tabular-nums">
                    <span className="w-2 h-2 rounded-sm" style={{ background: c }} />
                    <span className="text-rl-subtle">{l}</span>
                    <span className="font-semibold ml-auto">{v}</span>
                  </p>
                ))}
                <p className="flex gap-3 mt-1 pt-1 border-t border-rl-border/60 text-xs text-rl-subtle tabular-nums">
                  <span>CPL {p.leads > 0 && p.investido > 0 ? fmtMoney(p.investido / p.leads) : '—'}</span>
                  <span>ROAS {p.investido > 0 && p.receita > 0 ? `${(p.receita / p.investido).toFixed(2)}x` : '—'}</span>
                </p>
              </>
            ) : <p className="text-rl-subtle">sem dado</p>}
          </div>
        )}
      </div>
    </div>
  )
}
