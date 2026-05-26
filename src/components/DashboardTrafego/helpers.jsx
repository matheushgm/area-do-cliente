import { useEffect, useRef } from 'react'
import {
  Chart, LineController, LineElement, PointElement, LinearScale,
  CategoryScale, Filler, Tooltip, Legend,
} from 'chart.js'
import { fmtMoney, fmtNum, statusTagInfo } from '../../lib/dashboardData'

// Registra apenas os controllers/elementos usados (tree-shaking do Chart.js v4).
Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend)

// ─── Wrapper de gráfico de linha ──────────────────────────────────────────────
// Cria/destrói a instância Chart.js imperativamente via ref — espelhando o uso
// original (new Chart / .destroy), mas com ciclo de vida controlado pelo React.
export function LineChart({ data, options }) {
  const canvasRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    chartRef.current = new Chart(ctx, { type: 'line', data, options })
    return () => { chartRef.current?.destroy(); chartRef.current = null }
    // Recria o gráfico quando os dados mudam (período/cliente/filtro).
  }, [data, options])

  return <canvas ref={canvasRef} />
}

// ─── Células de tabela (pequenos formatadores visuais) ────────────────────────
export function StatusTag({ status }) {
  const info = statusTagInfo(status)
  if (!info) return null
  return <span className={`status-tag ${info.cls}`}>{info.label}</span>
}

export function ConvCell({ conv, spend }) {
  if (spend > 0 && conv === 0) return <span className="crit">0 🚨</span>
  return <span>{fmtNum(conv)}</span>
}

export function CtrCell({ v }) {
  if (v == null) return '—'
  return <span className={v < 1 ? 'warn' : 'good'}>{v.toFixed(2)}%</span>
}

export function TxConvCell({ leads, clicks }) {
  if (!clicks) return '—'
  const r = (leads / clicks) * 100
  return <span className={r >= 5 ? 'good' : r >= 1 ? 'warn' : 'crit'}>{r.toFixed(1)}%</span>
}

export function HookRateCell({ h3, vv }) {
  if (!vv) return <span className="fl">—</span>
  const r = (h3 / vv) * 100
  const cls = r >= 30 ? 'good' : r >= 20 ? 'warn' : 'crit'
  return <span className={cls}>{r.toFixed(1)}%</span>
}

// Badge de CPL alvo para a célula da tabela principal.
// target = { value, acName } | null. Retorna botão de vínculo quando ausente.
export function CplTargetCell({ dashName, actualCpl, target, onMap }) {
  if (!target) {
    return (
      <button className="map-btn" onClick={(e) => { e.stopPropagation(); onMap(dashName) }}>
        🔗 vincular
      </button>
    )
  }
  if (actualCpl == null || actualCpl === 0) {
    return <span className="cpl-target-badge ctb-none" title={target.acName}>{fmtMoney(target.value)}</span>
  }
  let cls, ico
  if (actualCpl <= target.value) { cls = 'ctb-ok'; ico = '✅' }
  else if (actualCpl <= target.value * 1.3) { cls = 'ctb-warn'; ico = '⚠️' }
  else { cls = 'ctb-bad'; ico = '🚨' }
  return (
    <span className={`cpl-target-badge ${cls}`} title={`${target.acName}: alvo ${fmtMoney(target.value)}`}>
      {ico} {fmtMoney(target.value)}
    </span>
  )
}

export function cplActualCls(actualCpl, target) {
  if (!target || !actualCpl) return ''
  if (actualCpl <= target.value) return 'cpl-ok'
  if (actualCpl <= target.value * 1.3) return 'cpl-warn'
  return 'cpl-bad'
}
