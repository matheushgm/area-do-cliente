import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { fmtCurrency, mrrValue } from '../lib/utils'
import { SQUAD_COLORS } from '../lib/constants'
import { useToast } from '../hooks/useToast'
import Toast from '../components/UI/Toast'
import {
  ArrowLeft, Users2, Pencil, Check, X, TrendingUp, TrendingDown,
  DollarSign, Wallet, Activity, AlertTriangle, FlaskConical,
} from 'lucide-react'

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

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

function SquadCard({ squad, colorIndex, projects, year, month, monthLabel, onSaveCost, onToggleTest, isAdmin }) {
  const c = SQUAD_COLORS[colorIndex % SQUAD_COLORS.length]
  const isTest = !!squad.isTest

  const activeClients = projects.filter(p =>
    String(p.squad) === String(squad.id) && p.momento !== 'churn'
  )
  const totalContract = activeClients.reduce((acc, p) => acc + (Number(p.contractValue) || 0), 0)
  const totalMRR      = activeClients.reduce((acc, p) => acc + mrrValue(p), 0)
  const cost          = Number(squad.monthlyCost) || 0
  const margin        = totalMRR - cost
  const marginPct     = totalMRR > 0 ? (margin / totalMRR) * 100 : 0
  const marginPositive = margin >= 0

  const churned = projects.filter(p =>
    String(p.squad) === String(squad.id) && isChurnedThisMonth(p, year, month)
  )
  const churnCount     = churned.length
  const churnMRR       = churned.reduce((acc, p) => acc + mrrValue(p), 0)
  const churnContract  = churned.reduce((acc, p) => acc + (Number(p.contractValue) || 0), 0)

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
    <div className={`glass-card overflow-hidden border ${isTest ? 'border-amber-400/40 opacity-90' : c.border}`}>
      {/* Header */}
      <div className={`flex items-center gap-2 flex-wrap px-5 py-3 border-b border-rl-border/60 ${c.bg}`}>
        {squad.emoji && <span className="text-base leading-none">{squad.emoji}</span>}
        <span className={`text-sm font-bold uppercase tracking-wider ${c.text}`}>{squad.name}</span>
        {isTest && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-400/10 text-amber-400 border border-amber-400/40">
            <FlaskConical className="w-2.5 h-2.5" />
            Em teste
          </span>
        )}
        <span className="text-xs text-rl-muted bg-rl-surface border border-rl-border px-2 py-0.5 rounded-full ml-auto">
          {activeClients.length} {activeClients.length === 1 ? 'cliente' : 'clientes'}
        </span>
        {isAdmin && (
          <button
            onClick={() => onToggleTest(squad, !isTest)}
            className={`p-1.5 rounded-lg transition-all ${
              isTest
                ? 'text-amber-400 bg-amber-400/10 hover:bg-amber-400/20'
                : 'text-rl-muted hover:text-amber-400 hover:bg-amber-400/10'
            }`}
            title={isTest ? 'Tirar do modo teste' : 'Marcar como em teste'}
          >
            <FlaskConical className="w-3.5 h-3.5" />
          </button>
        )}
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
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
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
      </div>
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

  // Totais consolidados — squads em teste ficam fora das somas mas seguem
  // visíveis como cards individuais com badge "Em teste".
  const testSquadIds = new Set(squads.filter(s => s.isTest).map(s => String(s.id)))
  const productionSquads = squads.filter(s => !s.isTest)
  const projectsWithSquad = projects.filter(p => !!p.squad && !testSquadIds.has(String(p.squad)))
  const activeAssigned    = projectsWithSquad.filter(p => p.momento !== 'churn')
  const totalActive       = activeAssigned.length
  const totalMRRAll       = activeAssigned.reduce((acc, p) => acc + mrrValue(p), 0)
  const totalCostAll      = productionSquads.reduce((acc, s) => acc + (Number(s.monthlyCost) || 0), 0)
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

  async function handleToggleTest(squad, newIsTest) {
    const res = await updateSquad(squad.id, {
      name: squad.name,
      emoji: squad.emoji,
      members: squad.members,
      is_test: newIsTest,
    })
    if (res?.error) {
      showToast('Erro ao atualizar squad', 'error')
    } else {
      showToast(newIsTest ? 'Squad marcado como em teste' : 'Squad voltou para produção')
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
                {squads.length} {squads.length === 1 ? 'squad' : 'squads'}
                {testSquadIds.size > 0 && (
                  <span className="text-amber-400">
                    {' '}· {testSquadIds.size} em teste (excluído{testSquadIds.size === 1 ? '' : 's'} dos totais)
                  </span>
                )}
                {' '}· Mês de referência: {monthLabel}
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
                onToggleTest={handleToggleTest}
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
