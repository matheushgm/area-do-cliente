import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import {
  Users, DollarSign, CheckCircle2, TrendingUp, Menu, BarChart3,
} from 'lucide-react'
import AppSidebar from '../components/AppSidebar'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CORE_STEPS = ['roi', 'strategy', 'oferta']

function fmtCurrency(n) {
  if (!n || isNaN(n) || !isFinite(n)) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

const CREATOR_COLORS = [
  { bg: 'bg-rl-purple/15', text: 'text-rl-purple', fill: '#7C3AED' },
  { bg: 'bg-rl-blue/15',   text: 'text-rl-blue',   fill: '#3B82F6' },
  { bg: 'bg-rl-green/15',  text: 'text-rl-green',  fill: '#10B981' },
  { bg: 'bg-rl-cyan/15',   text: 'text-rl-cyan',   fill: '#06B6D4' },
  { bg: 'bg-rl-gold/15',   text: 'text-rl-gold',   fill: '#F59E0B' },
  { bg: 'bg-red-500/15',   text: 'text-red-400',   fill: '#EF4444' },
]

const CHART_COLORS = ['#7C3AED', '#3B82F6', '#10B981', '#06B6D4', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

const STATUS_COLORS = { onboarding: '#06B6D4', active: '#10B981', paused: '#F59E0B' }
const STATUS_LABELS = { onboarding: 'Onboarding', active: 'Ativo', paused: 'Pausado' }

function hashId(id) {
  if (!id) return 0
  const n = Number(id)
  if (!isNaN(n) && isFinite(n)) return n
  return String(id).split('').reduce((a, c) => a + c.charCodeAt(0), 0)
}

function groupBy(arr, keyFn) {
  return arr.reduce((acc, item) => {
    const key = keyFn(item)
    acc[key] = (acc[key] || [])
    acc[key].push(item)
    return acc
  }, {})
}

function last12Months() {
  const result = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
    })
  }
  return result
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, color }) {
  return (
    <div className="glass-card p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-rl-muted text-xs mb-1">{label}</p>
        <p className="text-2xl font-bold text-rl-text leading-none">{value}</p>
        {sub && <p className="text-xs text-rl-muted mt-1">{sub}</p>}
      </div>
    </div>
  )
}

function SectionTitle({ children }) {
  return <h2 className="text-sm font-semibold text-rl-text mb-4">{children}</h2>
}

function HorizBar({ label, count, total, extra }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-rl-text truncate max-w-[60%]">{label}</span>
        <span className="text-rl-muted shrink-0 ml-2">{count} · {pct}%{extra ? ` · ${extra}` : ''}</span>
      </div>
      <div className="h-1.5 bg-rl-border rounded-full overflow-hidden">
        <div
          className="h-full bg-rl-purple/70 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-card px-3 py-2 text-xs">
      <p className="text-rl-muted mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-rl-text font-semibold">{p.value}</p>
      ))}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function Overview() {
  const { projects, teamMembers } = useApp()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // ── Aggregations ────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = projects.length
    const mrr = projects.reduce((s, p) => s + (Number(p.contractValue) || 0), 0)
    const complete = projects.filter(p => CORE_STEPS.every(s => (p.completedSteps || []).includes(s))).length
    const upsell = projects.filter(p => p.upsellPotential === true).length

    // Timeline últimos 12 meses
    const months = last12Months()
    const timeline = months.map(m => ({
      label: m.label,
      count: projects.filter(p => {
        const d = new Date(p.createdAt)
        return d.getFullYear() === m.year && d.getMonth() === m.month
      }).length,
    }))

    // Por businessType
    const typeGroups = groupBy(projects, p => p.businessType || 'Não informado')
    const byType = Object.entries(typeGroups)
      .map(([k, v]) => ({ label: k, count: v.length }))
      .sort((a, b) => b.count - a.count)

    // Por contractModel
    const modelGroups = groupBy(projects, p => p.contractModel || 'Não informado')
    const byModel = Object.entries(modelGroups).map(([k, v]) => ({
      label: k,
      count: v.length,
      mrr: v.reduce((s, p) => s + (Number(p.contractValue) || 0), 0),
    })).sort((a, b) => b.count - a.count)

    // Por segmento (top 8)
    const segGroups = groupBy(projects, p => p.segmento || 'Não informado')
    const bySegment = Object.entries(segGroups)
      .map(([k, v]) => ({ label: k, count: v.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)

    // Por membro da equipe
    const memberMap = {}
    projects.forEach(p => {
      const key = p.accountId || 'sem-responsável'
      if (!memberMap[key]) {
        memberMap[key] = { name: p.accountName || 'Sem responsável', count: 0, mrr: 0, id: key }
      }
      memberMap[key].count++
      memberMap[key].mrr += Number(p.contractValue) || 0
    })
    const byMember = Object.values(memberMap).sort((a, b) => b.count - a.count)

    // Maturidade digital
    const byMaturity = [1, 2, 3, 4, 5].map(n => ({
      nivel: String(n),
      count: projects.filter(p => p.digitalMaturity === n).length,
    }))

    // Serviços
    const allServices = projects.flatMap(p => p.services || [])
    const svcCount = {}
    allServices.forEach(s => { svcCount[s] = (svcCount[s] || 0) + 1 })
    const byService = Object.entries(svcCount)
      .map(([k, v]) => ({ name: k, count: v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)

    // Por status
    const statusGroups = groupBy(projects, p => p.status || 'unknown')
    const byStatus = Object.entries(statusGroups).map(([k, v]) => ({
      name: STATUS_LABELS[k] || k,
      value: v.length,
      color: STATUS_COLORS[k] || '#6B7280',
    }))

    return { total, mrr, complete, upsell, timeline, byType, byModel, bySegment, byMember, byMaturity, byService, byStatus }
  }, [projects])

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen bg-rl-bg">
      <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 min-w-0 overflow-y-auto">
        {/* ── Topbar ── */}
        <header className="sticky top-0 z-20 bg-rl-bg/90 border-b border-rl-border px-4 sm:px-6 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-rl-purple" />
            <h1 className="text-base font-bold text-rl-text">Visão Geral</h1>
          </div>
          <span className="ml-auto text-xs text-rl-muted">{stats.total} clientes</span>
        </header>

        <div className="p-4 sm:p-6 space-y-8 max-w-6xl mx-auto">

          {/* ── KPIs ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Total de Clientes"
              value={stats.total}
              icon={Users}
              color="bg-rl-purple/15 text-rl-purple"
            />
            <KpiCard
              label="MRR"
              value={fmtCurrency(stats.mrr)}
              sub="receita mensal recorrente"
              icon={DollarSign}
              color="bg-rl-green/15 text-rl-green"
            />
            <KpiCard
              label="Perfis Completos"
              value={stats.total > 0 ? `${Math.round((stats.complete / stats.total) * 100)}%` : '—'}
              sub={`${stats.complete} de ${stats.total}`}
              icon={CheckCircle2}
              color="bg-rl-cyan/15 text-rl-cyan"
            />
            <KpiCard
              label="Potencial de Upsell"
              value={stats.upsell}
              sub={stats.total > 0 ? `${Math.round((stats.upsell / stats.total) * 100)}% da base` : ''}
              icon={TrendingUp}
              color="bg-rl-gold/15 text-rl-gold"
            />
          </div>

          {/* ── Timeline ── */}
          <div className="glass-card p-5">
            <SectionTitle>Linha do Tempo de Entrada (últimos 12 meses)</SectionTitle>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats.timeline} barSize={20}>
                <XAxis dataKey="label" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} width={24} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(124,58,237,0.08)' }} />
                <Bar dataKey="count" name="Clientes" fill="#7C3AED" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ── Tipo de Negócio + Modelo de Contrato ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="glass-card p-5">
              <SectionTitle>Clientes por Tipo de Negócio</SectionTitle>
              <div className="space-y-3">
                {stats.byType.length > 0
                  ? stats.byType.map(row => (
                    <HorizBar key={row.label} label={row.label} count={row.count} total={stats.total} />
                  ))
                  : <p className="text-rl-muted text-xs">Nenhum dado disponível</p>
                }
              </div>
            </div>

            <div className="glass-card p-5">
              <SectionTitle>Clientes por Modelo de Contrato</SectionTitle>
              <div className="space-y-3">
                {stats.byModel.length > 0
                  ? stats.byModel.map(row => (
                    <HorizBar
                      key={row.label}
                      label={row.label}
                      count={row.count}
                      total={stats.total}
                      extra={fmtCurrency(row.mrr)}
                    />
                  ))
                  : <p className="text-rl-muted text-xs">Nenhum dado disponível</p>
                }
              </div>
            </div>
          </div>

          {/* ── Segmento + Equipe ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="glass-card p-5">
              <SectionTitle>Clientes por Segmento (top 8)</SectionTitle>
              <div className="space-y-3">
                {stats.bySegment.length > 0
                  ? stats.bySegment.map(row => (
                    <HorizBar key={row.label} label={row.label} count={row.count} total={stats.total} />
                  ))
                  : <p className="text-rl-muted text-xs">Nenhum dado disponível</p>
                }
              </div>
            </div>

            <div className="glass-card p-5">
              <SectionTitle>Distribuição por Equipe</SectionTitle>
              <div className="space-y-3">
                {stats.byMember.length > 0
                  ? stats.byMember.map((m, i) => {
                    const c = CREATOR_COLORS[hashId(m.id) % CREATOR_COLORS.length]
                    const parts = (m.name || '').trim().split(' ')
                    const initials = parts.slice(0, 2).map(w => w[0]?.toUpperCase()).join('')
                    return (
                      <div key={m.id} className="flex items-center gap-3">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0`}
                          style={{ backgroundColor: c.fill }}
                        >
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center text-xs mb-1">
                            <span className="text-rl-text truncate">{m.name}</span>
                            <span className="text-rl-muted shrink-0 ml-2">{m.count} · {fmtCurrency(m.mrr)}</span>
                          </div>
                          <div className="h-1.5 bg-rl-border rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${stats.total > 0 ? Math.round((m.count / stats.total) * 100) : 0}%`, backgroundColor: c.fill + 'AA' }}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })
                  : <p className="text-rl-muted text-xs">Nenhum dado disponível</p>
                }
              </div>
            </div>
          </div>

          {/* ── Maturidade Digital + Serviços ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="glass-card p-5">
              <SectionTitle>Maturidade Digital (1–5)</SectionTitle>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={stats.byMaturity} barSize={28}>
                  <XAxis dataKey="nivel" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} width={24} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(124,58,237,0.08)' }} />
                  <Bar dataKey="count" name="Clientes" fill="#06B6D4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="glass-card p-5">
              <SectionTitle>Serviços Mais Contratados</SectionTitle>
              {stats.byService.length > 0 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={stats.byService} layout="vertical" barSize={14}>
                    <XAxis type="number" allowDecimals={false} tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} width={90} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(124,58,237,0.08)' }} />
                    <Bar dataKey="count" name="Clientes" fill="#10B981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-rl-muted text-xs">Nenhum serviço cadastrado</p>
              )}
            </div>
          </div>

          {/* ── Distribuição por Status ── */}
          <div className="glass-card p-5">
            <SectionTitle>Distribuição por Status</SectionTitle>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <ResponsiveContainer width={200} height={160}>
                <PieChart>
                  <Pie
                    data={stats.byStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {stats.byStatus.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1">
                {stats.byStatus.map(s => (
                  <div key={s.name} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-rl-text">{s.name}</span>
                    <span className="text-rl-muted ml-auto">{s.value} clientes</span>
                  </div>
                ))}
                {stats.byStatus.length === 0 && (
                  <p className="text-rl-muted text-xs">Nenhum dado disponível</p>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
