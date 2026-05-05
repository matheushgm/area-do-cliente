import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { fmtCurrency, mrrValue } from '../lib/utils'
import { SQUAD_COLORS } from '../lib/constants'
import { useToast } from '../hooks/useToast'
import Toast from '../components/UI/Toast'
import {
  ArrowLeft, Users2, Pencil, Check, X, TrendingUp, TrendingDown,
  DollarSign, Wallet, Activity,
} from 'lucide-react'

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const MONTHS_PT_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function isChurnedThisMonth(p, year, month) {
  if (p.momento !== 'churn' || !p.churnDate) return false
  const d = new Date(p.churnDate + 'T00:00:00')
  return d.getFullYear() === year && d.getMonth() === month
}

function SummaryCard({ icon: Icon, label, value, valueClass = 'text-rl-text', sublabel }) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-rl-muted">{label}</p>
          <p className={`text-2xl font-bold mt-1 leading-tight ${valueClass}`}>{value}</p>
          {sublabel && <p className="text-[11px] text-rl-muted mt-1">{sublabel}</p>}
        </div>
        <div className="w-9 h-9 rounded-xl bg-rl-purple/10 text-rl-purple flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  )
}

function SquadCard({ squad, colorIndex, projects, year, month, monthLabel, onSaveCost, isAdmin }) {
  const c = SQUAD_COLORS[colorIndex % SQUAD_COLORS.length]

  // Projetos deste squad (qualquer status — usado pelos gráficos históricos)
  const squadProjects = projects.filter(p => String(p.squad) === String(squad.id))

  const activeClients = squadProjects.filter(p => p.momento !== 'churn')
  const totalContract = activeClients.reduce((acc, p) => acc + (Number(p.contractValue) || 0), 0)
  const totalMRR      = activeClients.reduce((acc, p) => acc + mrrValue(p), 0)
  const cost          = Number(squad.monthlyCost) || 0
  const margin        = totalMRR - cost
  const marginPct     = totalMRR > 0 ? (margin / totalMRR) * 100 : 0
  const marginPositive = margin >= 0

  const churned = squadProjects.filter(p => isChurnedThisMonth(p, year, month))
  const churnCount     = churned.length
  const churnMRR       = churned.reduce((acc, p) => acc + mrrValue(p), 0)
  const churnContract  = churned.reduce((acc, p) => acc + (Number(p.contractValue) || 0), 0)

  // ── Dados dos 12 meses para os gráficos do squad ───────────────────────────
  const monthsBuckets = buildLast12Months(year, month)

  // Churn do squad por mês (MRR perdido + contagem)
  const churnYearData = monthsBuckets.map((m) => {
    const list = squadProjects.filter(p => isChurnedThisMonth(p, m.yyyy, m.mm))
    return {
      key: m.key,
      label: m.label,
      value: list.reduce((acc, p) => acc + mrrValue(p), 0),
      count: list.length,
      highlight: m.yyyy === year && m.mm === month,
    }
  })
  const churnYearMax = Math.max(...churnYearData.map(d => d.value), 0)

  // MRR gerenciado pelo squad por mês (clientes ativos no fim de cada mês)
  const mrrYearData = monthsBuckets.map((m) => {
    const activeAtEnd = squadProjects.filter(p => wasActiveAtEndOfMonth(p, m.yyyy, m.mm))
    return {
      key: m.key,
      label: m.label,
      value: activeAtEnd.reduce((acc, p) => acc + mrrValue(p), 0),
      count: activeAtEnd.length,
      highlight: m.yyyy === year && m.mm === month,
    }
  })
  const mrrYearMax = Math.max(...mrrYearData.map(d => d.value), 0)
  const lastMRR    = mrrYearData[mrrYearData.length - 1]?.value ?? 0
  const prevMRR    = mrrYearData[mrrYearData.length - 2]?.value ?? 0
  const mrrDelta   = lastMRR - prevMRR
  const mrrDeltaPct = prevMRR > 0 ? (mrrDelta / prevMRR) * 100 : 0

  // Inline cost editor
  const [editing, setEditing] = useState(false)
  const [costInput, setCostInput] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef(null)

  function startEdit() {
    setCostInput(squad.monthlyCost != null ? String(squad.monthlyCost) : '')
    setEditing(true)
  }
  function cancelEdit() {
    setEditing(false)
    setCostInput('')
  }
  async function confirmEdit() {
    if (saving) return
    const num = costInput.trim() === '' ? null : Number(costInput)
    if (num !== null && (isNaN(num) || num < 0)) return
    setSaving(true)
    await onSaveCost(squad, num)
    setSaving(false)
    setEditing(false)
  }
  function handleKey(e) {
    if (e.key === 'Enter') confirmEdit()
    if (e.key === 'Escape') cancelEdit()
  }

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  return (
    <div className={`glass-card overflow-hidden border ${c.border}`}>
      {/* Header */}
      <div className={`flex items-center gap-2 flex-wrap px-5 py-3 border-b border-rl-border/60 ${c.bg}`}>
        {squad.emoji && <span className="text-base leading-none">{squad.emoji}</span>}
        <span className={`text-sm font-bold uppercase tracking-wider ${c.text}`}>{squad.name}</span>
        <span className="text-xs text-rl-muted bg-rl-surface border border-rl-border px-2 py-0.5 rounded-full ml-auto">
          {activeClients.length} {activeClients.length === 1 ? 'cliente' : 'clientes'}
        </span>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">
        {/* Valores */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-rl-muted">Contrato Cheio</p>
            <p className="text-xl font-bold text-rl-text mt-0.5">{fmtCurrency(totalContract)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-rl-muted">MRR</p>
            <p className="text-xl font-bold text-rl-text mt-0.5">{fmtCurrency(totalMRR)}</p>
          </div>
        </div>

        {/* Custo + Margem */}
        <div className="border-t border-rl-border/60 pt-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-rl-muted">Custo do Squad</span>
            {editing ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-rl-muted">R$</span>
                <input
                  ref={inputRef}
                  type="number"
                  min="0"
                  step="0.01"
                  value={costInput}
                  onChange={(e) => setCostInput(e.target.value)}
                  onKeyDown={handleKey}
                  className="w-32 px-2 py-1 text-sm rounded-lg bg-rl-surface border border-rl-purple/40 text-rl-text focus:outline-none"
                  placeholder="0,00"
                />
                <button
                  onClick={confirmEdit}
                  disabled={saving}
                  className="p-1.5 rounded-lg text-rl-green hover:bg-rl-green/10 disabled:opacity-50"
                  title="Confirmar"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={cancelEdit}
                  className="p-1.5 rounded-lg text-rl-muted hover:bg-rl-surface"
                  title="Cancelar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-rl-text">
                  {squad.monthlyCost != null ? fmtCurrency(cost) : <span className="text-rl-muted italic">não definido</span>}
                </span>
                {isAdmin && (
                  <button
                    onClick={startEdit}
                    className="p-1.5 rounded-lg text-rl-muted hover:text-rl-purple hover:bg-rl-purple/10 transition-all"
                    title="Editar custo"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-rl-muted">Margem Operacional</span>
            <div className="flex items-baseline gap-2">
              <span className={`text-lg font-bold ${marginPositive ? 'text-rl-green' : 'text-red-400'}`}>
                {fmtCurrency(margin)}
              </span>
              {totalMRR > 0 && (
                <span className={`text-xs ${marginPositive ? 'text-rl-green' : 'text-red-400'}`}>
                  ({marginPct.toFixed(0)}%)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Churn do mês */}
        <div className="border-t border-rl-border/60 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-3.5 h-3.5 text-red-400" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-red-400">
              Churn — {monthLabel}
            </span>
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-rl-muted">Clientes churnados</span>
              <span className={`font-semibold ${churnCount > 0 ? 'text-red-400' : 'text-rl-muted'}`}>
                {churnCount}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-rl-muted">MRR perdido</span>
              <span className={`font-semibold ${churnMRR > 0 ? 'text-red-400' : 'text-rl-muted'}`}>
                {fmtCurrency(churnMRR)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-rl-muted">Contrato cheio perdido</span>
              <span className={`font-semibold ${churnContract > 0 ? 'text-red-400' : 'text-rl-muted'}`}>
                {fmtCurrency(churnContract)}
              </span>
            </div>
          </div>
        </div>

        {/* Gráficos históricos do squad — 12 meses */}
        <div className="border-t border-rl-border/60 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Churn ao longo do ano */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5">
                <TrendingDown className="w-3 h-3 text-red-400" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-red-400">Churn 12m</span>
              </div>
              <span className="text-[10px] text-rl-muted tabular-nums">
                Total: {fmtCurrency(churnYearData.reduce((acc, d) => acc + d.value, 0))}
              </span>
            </div>
            <BarChart
              items={churnYearData}
              maxValue={churnYearMax}
              formatValue={fmtCurrency}
              barColorClass="bg-red-400/30"
              highlightColorClass="bg-red-400"
              compact
            />
          </div>

          {/* MRR gerenciado ao longo do ano */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5">
                <Activity className="w-3 h-3 text-rl-purple" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-rl-purple">MRR 12m</span>
              </div>
              {prevMRR > 0 ? (
                <span className={`text-[10px] tabular-nums font-semibold inline-flex items-center gap-0.5 ${mrrDelta >= 0 ? 'text-rl-green' : 'text-red-400'}`}>
                  {mrrDelta >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                  {mrrDelta >= 0 ? '+' : ''}{mrrDeltaPct.toFixed(1)}%
                </span>
              ) : (
                <span className="text-[10px] text-rl-muted">—</span>
              )}
            </div>
            <BarChart
              items={mrrYearData}
              maxValue={mrrYearMax}
              formatValue={fmtCurrency}
              barColorClass="bg-rl-purple/30"
              highlightColorClass="bg-rl-purple"
              compact
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers para os gráficos históricos ─────────────────────────────────────

// Parse de date string (yyyy-mm-dd ou ISO timestamp) em ms.
function parseDate(iso) {
  if (!iso) return NaN
  const s = typeof iso === 'string' && iso.length === 10 ? iso + 'T00:00:00' : iso
  const t = new Date(s).getTime()
  return isNaN(t) ? NaN : t
}

// Constrói os últimos 12 meses (arr de { yyyy, mm, label, key }) ordenados
// do mais antigo para o mais recente.
function buildLast12Months(refYear, refMonth) {
  const out = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(refYear, refMonth - i, 1)
    out.push({
      yyyy: d.getFullYear(),
      mm: d.getMonth(),
      label: `${MONTHS_PT_SHORT[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    })
  }
  return out
}

// Verifica se o projeto estava ativo (não churnado e contrato iniciado)
// no fim do mês de referência.
function wasActiveAtEndOfMonth(project, year, month) {
  const startTime = parseDate(project.contractDate || project.createdAt)
  if (isNaN(startTime)) return false
  const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59).getTime()
  if (startTime > endOfMonth) return false
  if (project.momento === 'churn' && project.churnDate) {
    const churnTime = parseDate(project.churnDate)
    if (!isNaN(churnTime) && churnTime <= endOfMonth) return false
  }
  return true
}

// Gráfico de barras vertical simples (sem lib externa).
// items: [{ key, label, value, count?, highlight? }], maxValue: número
function BarChart({ items, maxValue, formatValue, barColorClass = 'bg-rl-purple', highlightColorClass = 'bg-red-400', compact = false }) {
  const safeMax = Math.max(maxValue, 1)
  const barAreaH = compact ? 'h-16' : 'h-28'
  const wrapperH = compact ? 'h-24' : 'h-40'
  return (
    <div className={`flex items-end justify-between gap-1 ${wrapperH}`}>
      {items.map((it) => {
        const heightPct = (it.value / safeMax) * 100
        const cls = it.highlight ? highlightColorClass : barColorClass
        return (
          <div key={it.key} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
            <span className={`text-[9px] font-semibold tabular-nums leading-tight ${it.value > 0 ? 'text-rl-text' : 'text-rl-muted'}`}>
              {it.count != null ? (it.count > 0 ? it.count : '—') : (it.value > 0 ? formatValue(it.value) : '—')}
            </span>
            <div className={`w-full flex items-end justify-center ${barAreaH}`}>
              <div
                className={`w-full rounded-t transition-all ${cls}`}
                style={{ height: it.value > 0 ? `${Math.max(heightPct, 4)}%` : '2px' }}
                title={`${it.label}: ${formatValue(it.value)}${it.count != null ? ` · ${it.count} cliente${it.count === 1 ? '' : 's'}` : ''}`}
              />
            </div>
            <span className="text-[9px] text-rl-muted truncate leading-tight">{it.label}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function SquadsReport() {
  const { user, projects, squads, updateSquad } = useApp()
  const navigate = useNavigate()
  const { toast, showToast } = useToast()
  const isAdmin = user?.role === 'admin'

  const now = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth()
  const monthLabel = `${MONTHS_PT[month]} ${year}`

  // Totais consolidados — todos os squads entram (sem distinção de teste).
  const projectsWithSquad = projects.filter(p => !!p.squad)
  const activeAssigned    = projectsWithSquad.filter(p => p.momento !== 'churn')
  const totalActive       = activeAssigned.length
  const totalMRRAll       = activeAssigned.reduce((acc, p) => acc + mrrValue(p), 0)
  const totalCostAll      = squads.reduce((acc, s) => acc + (Number(s.monthlyCost) || 0), 0)
  const totalMarginAll    = totalMRRAll - totalCostAll

  const churnedAll = projectsWithSquad.filter(p => isChurnedThisMonth(p, year, month))
  const totalChurnMRR = churnedAll.reduce((acc, p) => acc + mrrValue(p), 0)

  async function handleSaveCost(squad, newCost) {
    const res = await updateSquad(squad.id, {
      name: squad.name,
      emoji: squad.emoji,
      members: squad.members,
      monthly_cost: newCost,
    })
    if (res?.error) {
      showToast('Erro ao salvar custo', 'error')
    } else {
      showToast('Custo do squad atualizado')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-dark">
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-slide-up">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <Users2 className="w-6 h-6 text-rl-purple" />
                <h1 className="text-2xl font-bold text-rl-text">Dashboard de Squads</h1>
              </div>
              <p className="text-rl-muted mt-1 text-sm">
                {squads.length} {squads.length === 1 ? 'squad' : 'squads'} · Mês de referência: {monthLabel}
              </p>
            </div>
          </div>
        </div>

        {/* Totais consolidados */}
        {squads.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up" style={{ animationDelay: '0.05s' }}>
            <SummaryCard icon={Users2}     label="Clientes ativos (com squad)" value={totalActive} />
            <SummaryCard icon={DollarSign} label="MRR total"                  value={fmtCurrency(totalMRRAll)} />
            <SummaryCard icon={Wallet}     label="Custo total"                value={fmtCurrency(totalCostAll)} />
            <SummaryCard
              icon={totalMarginAll >= 0 ? TrendingUp : TrendingDown}
              label="Margem total"
              value={fmtCurrency(totalMarginAll)}
              valueClass={totalMarginAll >= 0 ? 'text-rl-green' : 'text-red-400'}
              sublabel={totalChurnMRR > 0 ? `MRR perdido em ${monthLabel}: ${fmtCurrency(totalChurnMRR)}` : null}
            />
          </div>
        )}

        {/* Cards por squad */}
        {squads.length === 0 ? (
          <div className="glass-card p-12 flex flex-col items-center justify-center text-center">
            <Activity className="w-12 h-12 text-rl-muted/30 mb-3" />
            <p className="text-rl-text font-semibold mb-1">Nenhum squad cadastrado</p>
            <p className="text-rl-muted text-sm">Crie squads na página de Usuários para ver as métricas aqui.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            {squads.map((s, idx) => (
              <SquadCard
                key={s.id}
                squad={s}
                colorIndex={idx}
                projects={projects}
                year={year}
                month={month}
                monthLabel={monthLabel}
                onSaveCost={handleSaveCost}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        )}

      </main>

      <Toast toast={toast} />
    </div>
  )
}
