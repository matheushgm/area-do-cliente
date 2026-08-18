import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import {
  Plus, Save, AlertCircle, CheckCircle2, CalendarDays, DollarSign, FileDown, X,
  Link2, Check, BarChart3, DownloadCloud,
} from 'lucide-react'
import { exportCampaignPDF } from '../utils/exportPDF'
import { useApp } from '../context/AppContext'
import { useToast } from '../hooks/useToast'
import Toast from './UI/Toast'
import { AutoSaveIndicator } from '../hooks/useAutoSave.jsx'
import { useDashboardData } from '../hooks/useDashboardData'
import ProjectTrafficDashboard from './Resultados/ProjectTrafficDashboard'
import {
  fmtBRL, makeChannel, makeCampaign, makeAdAccount, deriveStages, stageSum, emptyStages,
  CHANNEL_OPTIONS,
  defaultEndDateISO, todayISO, getDaysBetween, getPeriodLabel,
} from './CampaignPlanner/campaignHelpers'
import ChannelRow from './CampaignPlanner/ChannelRow'
import {
  CHANNEL_KEY, pullMonthSpend, pullChannelPlan, pullChannelShare,
} from './CampaignPlanner/pullFromDashboard'
import { normStr } from '../lib/dashboardData'
import VideoGuide from './VideoGuide'

// ─── Constants ────────────────────────────────────────────────────────────────

const META_TAX = 0.13

// ─── Helpers ──────────────────────────────────────────────────────────────────

function newAccount(label = '') {
  return {
    id:            crypto.randomUUID(),
    name:          label,
    orcamentoTotal: 0,
    valorJaUsado:  0,
    channels:      [],
  }
}

/**
 * Migra o formato legado (plan com orcamentoTotal/channels na raiz)
 * para o novo formato com array de contas.
 */
function initAccounts(campaignPlan) {
  if (!campaignPlan) return [newAccount('Conta Principal')]

  // Já está no novo formato
  if (Array.isArray(campaignPlan.accounts) && campaignPlan.accounts.length > 0) {
    return campaignPlan.accounts.map((a) => ({
      ...a,
      channels: (a.channels || []).map((ch) => ({ ...ch, expanded: true })),
    }))
  }

  // Formato legado → wrap na primeira conta
  return [{
    id:             crypto.randomUUID(),
    name:           'Conta Principal',
    orcamentoTotal: campaignPlan.orcamentoTotal ?? campaignPlan.totalBudget ?? 0,
    valorJaUsado:   campaignPlan.valorJaUsado || 0,
    channels:       (campaignPlan.channels || []).map((ch) => ({ ...ch, expanded: true })),
  }]
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CampaignPlanner({ project, onSave }) {
  const { updateProject } = useApp()
  const { toast, showToast } = useToast()
  const isMounted = useRef(false)
  const [copied, setCopied] = useState(false)

  // Mesma fonte usada pelo módulo Resultados (dash_insights via /api) — dá pra
  // ver o gasto real das contas vinculadas antes de preencher o orçamento à mão.
  const dash = useDashboardData({ source: 'api' })

  const [accounts,  setAccounts]  = useState(() => initAccounts(project.campaignPlan))
  const [activeIdx, setActiveIdx] = useState(0)
  const [startDate, setStartDate] = useState(() => project.campaignPlan?.startDate || todayISO())
  const [endDate,   setEndDate]   = useState(() => project.campaignPlan?.endDate   || defaultEndDateISO())

  // Conta ativa
  const account = accounts[activeIdx] ?? accounts[0]

  // ── Shortcuts para a conta ativa ──────────────────────────────────────────

  const orcamentoTotal = account.orcamentoTotal
  const valorJaUsado   = account.valorJaUsado
  const channels       = account.channels

  const setOrcamentoTotal = useCallback((val) => {
    setAccounts((prev) => prev.map((a, i) => i === activeIdx ? { ...a, orcamentoTotal: val } : a))
  }, [activeIdx])

  const setValorJaUsado = useCallback((val) => {
    setAccounts((prev) => prev.map((a, i) => i === activeIdx ? { ...a, valorJaUsado: val } : a))
  }, [activeIdx])

  const setChannels = useCallback((updater) => {
    setAccounts((prev) => prev.map((a, i) => {
      if (i !== activeIdx) return a
      const next = typeof updater === 'function' ? updater(a.channels) : updater
      return { ...a, channels: next }
    }))
  }, [activeIdx])

  const budgetDisponivel = Math.max(0, orcamentoTotal - valorJaUsado)

  // ── Derived ────────────────────────────────────────────────────────────────

  const daysLeft     = useMemo(() => getDaysBetween(startDate, endDate),  [startDate, endDate])
  const monthLabel   = useMemo(() => getPeriodLabel(startDate, endDate),  [startDate, endDate])
  const minEndDate   = useMemo(() => {
    const t = todayISO()
    return startDate && startDate > t ? startDate : t
  }, [startDate])

  const derived = useMemo(() => {
    return channels.map((ch) => {
      const isMeta        = ch.name === 'Meta Ads'
      const chMonBruto    = budgetDisponivel * (ch.percentage / 100)
      const chMonEfetivo  = isMeta ? chMonBruto * (1 - META_TAX) : chMonBruto
      const chDay         = chMonEfetivo / daysLeft
      // Canal subdividido por conta de anúncio: a verba do canal passa pela
      // conta antes de chegar no funil. Sem subdivisão, vai direto pro funil.
      const adAccounts = (ch.adAccounts || []).map((ac) => {
        const acMon = chMonEfetivo * ((ac.percentage || 0) / 100)
        return {
          ...ac,
          monthly: acMon,
          daily:   acMon / daysLeft,
          stages:  deriveStages(ac.stages, acMon, daysLeft),
        }
      })
      return {
        ...ch,
        monthly: chMonEfetivo,
        monthlyBruto: chMonBruto,
        isMeta,
        daily: chDay,
        stages: deriveStages(ch.stages, chMonEfetivo, daysLeft),
        adAccounts,
      }
    })
  }, [channels, budgetDisponivel, daysLeft])

  const validation = useMemo(() => {
    const chSum = channels.reduce((s, ch) => s + (ch.percentage || 0), 0)
    // Um erro por bloco que precisa fechar 100%: a divisão entre contas do canal
    // e o funil de cada conta (ou o funil do canal, quando não é subdividido).
    const stageErrors = []
    channels.forEach((ch) => {
      const subs = ch.adAccounts || []
      if (subs.length) {
        const accSum = subs.reduce((s, a) => s + (a.percentage || 0), 0)
        stageErrors.push({
          id: `${ch.id}:contas`, channelId: ch.id, kind: 'accounts',
          name: `${ch.name} · divisão entre contas`, sum: accSum, valid: accSum === 100,
        })
        subs.forEach((a) => {
          const sum = stageSum(a.stages)
          stageErrors.push({
            id: `${ch.id}:${a.id}`, channelId: ch.id, kind: 'stages',
            name: `${ch.name} · ${a.name || 'conta sem nome'}`, sum, valid: sum === 100,
          })
        })
      } else {
        const sum = stageSum(ch.stages)
        stageErrors.push({
          id: ch.id, channelId: ch.id, kind: 'stages',
          name: ch.name, sum, valid: sum === 100,
        })
      }
    })
    return {
      chSum,
      chValid: chSum === 100 || channels.length === 0,
      stageErrors,
      allValid: (chSum === 100 || channels.length === 0) && stageErrors.every((e) => e.valid),
    }
  }, [channels])

  // ── Channel Updaters ───────────────────────────────────────────────────────

  const updateChannel = useCallback((id, patch) => {
    setChannels((prev) => prev.map((ch) => ch.id === id ? { ...ch, ...patch } : ch))
  }, [setChannels])

  // Todas as edições de etapa/campanha passam por aqui: quando `accountId` vem
  // preenchido, mexe no funil daquela conta de anúncio; senão, no funil do canal.
  const patchStages = useCallback((channelId, accountId, updater) => {
    setChannels((prev) => prev.map((ch) => {
      if (ch.id !== channelId) return ch
      if (!accountId) return { ...ch, stages: updater(ch.stages) }
      return {
        ...ch,
        adAccounts: (ch.adAccounts || []).map((a) => (
          a.id === accountId ? { ...a, stages: updater(a.stages) } : a
        )),
      }
    }))
  }, [setChannels])

  const updateStage = useCallback((channelId, stageKey, patch, accountId) => {
    patchStages(channelId, accountId, (stages) => ({
      ...stages,
      [stageKey]: { ...stages[stageKey], ...patch },
    }))
  }, [patchStages])

  const patchCampaigns = useCallback((channelId, stageKey, accountId, updater) => {
    patchStages(channelId, accountId, (stages) => ({
      ...stages,
      [stageKey]: { ...stages[stageKey], campaigns: updater(stages[stageKey].campaigns) },
    }))
  }, [patchStages])

  const addCampaign = useCallback((channelId, stageKey, accountId) => {
    patchCampaigns(channelId, stageKey, accountId, (camps) => [...camps, makeCampaign()])
  }, [patchCampaigns])

  const updateCampaign = useCallback((channelId, stageKey, campaignId, patch, accountId) => {
    patchCampaigns(channelId, stageKey, accountId, (camps) => (
      camps.map((c) => c.id === campaignId ? { ...c, ...patch } : c)
    ))
  }, [patchCampaigns])

  const deleteCampaign = useCallback((channelId, stageKey, campaignId, accountId) => {
    patchCampaigns(channelId, stageKey, accountId, (camps) => camps.filter((c) => c.id !== campaignId))
  }, [patchCampaigns])

  const addChannel = useCallback(() => {
    const usedNames    = channels.map((ch) => ch.name)
    const nextName     = CHANNEL_OPTIONS.find((n) => !usedNames.includes(n)) || CHANNEL_OPTIONS[0]
    const usedPct      = channels.reduce((s, ch) => s + (ch.percentage || 0), 0)
    const suggestedPct = Math.max(0, 100 - usedPct)
    const newCh        = makeChannel(nextName)
    newCh.percentage   = suggestedPct
    setChannels((prev) => [...prev, newCh])
  }, [channels, setChannels])

  const deleteChannel = useCallback((id) => {
    setChannels((prev) => prev.filter((ch) => ch.id !== id))
  }, [setChannels])

  // ── Contas de anúncio dentro do canal ──────────────────────────────────────

  const updateAdAccount = useCallback((channelId, accountId, patch) => {
    setChannels((prev) => prev.map((ch) => (
      ch.id === channelId
        ? { ...ch, adAccounts: (ch.adAccounts || []).map((a) => a.id === accountId ? { ...a, ...patch } : a) }
        : ch
    )))
  }, [setChannels])

  // Primeira conta adicionada num canal ainda não subdividido herda o funil que
  // estava na raiz, para não jogar fora o que já tinha sido preenchido.
  const addAdAccount = useCallback((channelId) => {
    setChannels((prev) => prev.map((ch) => {
      if (ch.id !== channelId) return ch
      const subs  = ch.adAccounts || []
      const nova  = makeAdAccount('')
      if (subs.length === 0) {
        nova.percentage = 100
        nova.stages     = ch.stages
        return { ...ch, adAccounts: [nova], stages: emptyStages() }
      }
      const usado = subs.reduce((s, a) => s + (a.percentage || 0), 0)
      nova.percentage = Math.max(0, 100 - usado)
      return { ...ch, adAccounts: [...subs, nova] }
    }))
  }, [setChannels])

  // Remover a última conta desfaz a subdivisão e devolve o funil dela para a
  // raiz do canal, senão o planejamento do canal ficaria vazio.
  const deleteAdAccount = useCallback((channelId, accountId) => {
    setChannels((prev) => prev.map((ch) => {
      if (ch.id !== channelId) return ch
      const subs = (ch.adAccounts || []).filter((a) => a.id !== accountId)
      if (subs.length > 0) return { ...ch, adAccounts: subs }
      const removida = (ch.adAccounts || []).find((a) => a.id === accountId)
      return { ...ch, adAccounts: [], stages: removida?.stages ?? ch.stages }
    }))
  }, [setChannels])

  // ── Puxar dados reais das contas vinculadas ────────────────────────────────
  // Contas de anúncio (dashboard_accounts) apontadas para este projeto.
  const projectAccountNames = useMemo(() => {
    const s = new Set()
    Object.entries(dash.accounts).forEach(([name, a]) => {
      if (a.projectId === project.id) s.add(name)
    })
    return s
  }, [dash.accounts, project.id])

  // Se a aba de conta do planner tiver o mesmo nome de uma conta de anúncio
  // vinculada, o "Puxar dados" fica escopado só nela; senão usa todas as contas
  // do cliente (é o mesmo total que o card "Total Investido" mostra acima).
  const pullNames = useMemo(() => {
    const match = [...projectAccountNames].find((n) => normStr(n) === normStr(account.name))
    return match ? new Set([match]) : projectAccountNames
  }, [projectAccountNames, account.name])

  const pullScopeLabel = useMemo(() => {
    if (pullNames.size === 0) return 'nenhuma conta vinculada'
    if (pullNames.size === 1) return [...pullNames][0]
    return `${pullNames.size} contas do cliente`
  }, [pullNames])

  const canPull = !dash.loading && !dash.error && pullNames.size > 0

  function pullGuard() {
    if (dash.loading) { showToast('Ainda carregando os dados de tráfego…', 'error'); return false }
    if (dash.error)   { showToast('Erro ao carregar tráfego: ' + dash.error, 'error'); return false }
    if (!pullNames.size) {
      showToast('Vincule uma conta de anúncio a este cliente na seção acima', 'error')
      return false
    }
    return true
  }

  // Orçamento: gasto do mês → "Já Utilizado"; período → hoje até o fim do mês.
  function handlePullBudget() {
    if (!pullGuard()) return
    const { total, per } = pullMonthSpend(dash.raw, pullNames)
    setValorJaUsado(total)
    setStartDate(todayISO())
    setEndDate(defaultEndDateISO())
    if (total === 0) {
      showToast(`Sem gasto no mês para ${pullScopeLabel}. Datas atualizadas.`, 'error')
      return
    }
    showToast(
      `Já utilizado: ${fmtBRL(total)} (Meta ${fmtBRL(per.meta)} + Google ${fmtBRL(per.google)})`
    )
  }

  // Canal: campanhas ativas + proporção de verba como está hoje.
  function handlePullChannel(channelId) {
    if (!pullGuard()) return
    const ch = channels.find((c) => c.id === channelId)
    if (!ch) return
    if (!CHANNEL_KEY[ch.name]) {
      showToast(`${ch.name} não tem dados no dashboard (só Meta e Google Ads)`, 'error')
      return
    }
    const plan = pullChannelPlan(dash.raw, ch.name, pullNames)
    if (!plan) {
      showToast(`Nenhuma campanha ativa de ${ch.name} em ${pullScopeLabel}`, 'error')
      return
    }
    const share = pullChannelShare(dash.raw, pullNames, channels.map((c) => c.name), ch.name)
    // Uma conta com campanha ativa → funil direto no canal. Mais de uma → o
    // canal é subdividido por conta de anúncio, cada uma com sua fatia.
    updateChannel(channelId, plan.mode === 'accounts'
      ? { percentage: share ?? ch.percentage, adAccounts: plan.adAccounts, stages: emptyStages(), expanded: true }
      : { percentage: share ?? ch.percentage, adAccounts: [], stages: plan.stages, expanded: true }
    )
    const n = plan.activeCount
    const parts = [`${n} campanha${n === 1 ? '' : 's'} ativa${n === 1 ? '' : 's'}`]
    if (plan.mode === 'accounts') parts.push(`${plan.adAccounts.length} contas`)
    if (share != null) parts.push(`${share}% da verba`)
    if (plan.unmatched > 0) parts.push(`${plan.unmatched} sem marcador de funil no nome → topo`)
    showToast(`${ch.name}: ${parts.join(' · ')}`)
  }

  // ── Account Updaters ───────────────────────────────────────────────────────

  const addAccount = () => {
    const next = newAccount(`Conta ${accounts.length + 1}`)
    setAccounts((prev) => [...prev, next])
    setActiveIdx(accounts.length)
  }

  const removeAccount = (idx) => {
    if (accounts.length === 1) return
    setAccounts((prev) => prev.filter((_, i) => i !== idx))
    setActiveIdx((prev) => Math.min(prev, accounts.length - 2))
  }

  const renameAccount = (idx, name) => {
    setAccounts((prev) => prev.map((a, i) => i === idx ? { ...a, name } : a))
  }

  // ── Auto-save ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return }
    const cleanAccounts = accounts.map((a) => ({
      ...a,
      channels: a.channels.map(({ expanded, ...rest }) => rest),
    }))
    updateProject(project.id, {
      campaignPlan: {
        id:      project.campaignPlan?.id,
        accounts: cleanAccounts,
        startDate,
        endDate,
        // Backward compat: first account fields at root for older readers
        orcamentoTotal: cleanAccounts[0]?.orcamentoTotal ?? 0,
        valorJaUsado:   cleanAccounts[0]?.valorJaUsado   ?? 0,
        totalBudget:    Math.max(0, (cleanAccounts[0]?.orcamentoTotal ?? 0) - (cleanAccounts[0]?.valorJaUsado ?? 0)),
        channels:       cleanAccounts[0]?.channels ?? [],
      },
    })
  }, [accounts, startDate, endDate])

  // ── Save ───────────────────────────────────────────────────────────────────

  function handleSave() {
    const cleanAccounts = accounts.map((a) => ({
      ...a,
      channels: a.channels.map(({ expanded, ...rest }) => rest),
    }))
    onSave({
      id:      project.campaignPlan?.id,
      accounts: cleanAccounts,
      startDate,
      endDate,
      orcamentoTotal: cleanAccounts[0]?.orcamentoTotal ?? 0,
      valorJaUsado:   cleanAccounts[0]?.valorJaUsado   ?? 0,
      totalBudget:    Math.max(0, (cleanAccounts[0]?.orcamentoTotal ?? 0) - (cleanAccounts[0]?.valorJaUsado ?? 0)),
      channels:       cleanAccounts[0]?.channels ?? [],
    })
  }

  // ── Link público (somente leitura) ─────────────────────────────────────────
  // Mesmo client_share_token usado por Precificação/CRM/Matriz de Objeções.
  function getOrCreateShareToken() {
    if (project.clientShareToken) return project.clientShareToken
    const token = crypto.randomUUID()
    updateProject(project.id, { clientShareToken: token })
    return token
  }

  function handleShare() {
    const token = getOrCreateShareToken()
    if (!token) return
    const url = `${window.location.origin}/campanhas/${token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
      showToast('Link copiado pro clipboard!')
    }).catch(() => showToast('Link: ' + url))
  }

  // ── Computed ───────────────────────────────────────────────────────────────

  const channelSum       = validation.chSum
  const channelRemaining = 100 - channelSum
  const usedChannelNames = channels.map((ch) => ch.name)
  const canAddChannel    = channels.length < CHANNEL_OPTIONS.length
  const totalBudget      = budgetDisponivel

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      <VideoGuide videoId="EOl-qgj4-fY" label="Como preencher o módulo de Campanhas" />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-rl-text flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-rl-green" />
            Planejamento de Campanhas
          </h2>
          <p className="text-sm text-rl-muted mt-0.5">
            Distribua o orçamento por canal, etapa do funil e campanhas individuais
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <AutoSaveIndicator />
          <button
            onClick={handleShare}
            className={`btn-secondary flex items-center gap-2 text-sm ${
              copied ? 'text-rl-green border-rl-green/30' : ''
            }`}
            title="Cria/copia o link somente leitura do planejamento pro cliente"
          >
            {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
            {copied ? 'Copiado!' : 'Link'}
          </button>
          <button
            onClick={() => exportCampaignPDF({ totalBudget, channels: channels.map(({ expanded, ...rest }) => rest) }, project)}
            disabled={channels.length === 0 || totalBudget === 0}
            className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            title="Exportar PDF"
          >
            <FileDown className="w-4 h-4" />
            PDF
          </button>
        </div>
      </div>

      {/* Account Tabs */}
      <div className="flex gap-2 flex-wrap items-center">
        {accounts.map((a, i) => (
          <div key={a.id} className="flex items-center gap-1">
            <button
              onClick={() => setActiveIdx(i)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeIdx === i
                  ? 'bg-gradient-rl text-white shadow-glow'
                  : 'bg-rl-surface text-rl-muted hover:text-rl-text'
              }`}
            >
              {a.name || `Conta ${i + 1}`}
            </button>
            {accounts.length > 1 && (
              <button
                onClick={() => removeAccount(i)}
                className="p-1 rounded text-rl-muted/50 hover:text-red-400 transition-colors"
                title="Remover conta"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={addAccount}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-rl-muted hover:text-rl-text border border-dashed border-rl-border hover:border-rl-green/40 transition-all"
        >
          <Plus className="w-3 h-3" /> Nova Conta
        </button>
      </div>

      {/* Account name input */}
      <div className="glass-card px-4 py-3 flex items-center gap-3">
        <label className="text-xs text-rl-muted shrink-0">Nome da conta</label>
        <input
          type="text"
          value={account.name}
          onChange={(e) => renameAccount(activeIdx, e.target.value)}
          placeholder={`Conta ${activeIdx + 1}`}
          className="input-field py-1.5 text-sm flex-1"
        />
      </div>

      {/* Contas de anúncio vinculadas + resultados reais — mesmo componente do módulo Resultados */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rl-purple/10 flex items-center justify-center shrink-0">
            <BarChart3 size={18} className="text-rl-purple" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-rl-text leading-tight">Resultados de Tráfego</h2>
            <p className="text-xs text-rl-muted">Dados reais das contas de anúncio vinculadas a este projeto</p>
          </div>
        </div>
        <ProjectTrafficDashboard project={project} dash={dash} />
      </section>

      {/* Budget + date info */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          {/* Orçamento Total */}
          <div className="flex-1">
            <label className="label-field">Orçamento Total do Mês</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rl-muted text-sm pointer-events-none">R$</span>
              <input
                type="number"
                min={0}
                value={orcamentoTotal}
                onChange={(e) => setOrcamentoTotal(parseFloat(e.target.value) || 0)}
                className="input-field pl-10 w-full"
                placeholder="0"
              />
            </div>
          </div>

          {/* Já Utilizado */}
          <div className="flex-1">
            <label className="label-field">Já Utilizado</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-rl-muted text-sm pointer-events-none">R$</span>
              <input
                type="number"
                min={0}
                value={valorJaUsado}
                onChange={(e) => setValorJaUsado(parseFloat(e.target.value) || 0)}
                className="input-field pl-10 w-full"
                placeholder="0"
              />
            </div>
          </div>

          {/* Date info — editável (início + fim) */}
          <div className="flex-1 sm:flex-none sm:min-w-[280px]">
            <label className="label-field flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-rl-green" />
              Período do Planejamento
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <input
                  id="campaign-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    const v = e.target.value || todayISO()
                    setStartDate(v)
                    // Se a data final ficou anterior à nova de início, empurra
                    if (endDate && v > endDate) setEndDate(v)
                  }}
                  className="input-field w-full"
                  aria-label="Data de início"
                />
                <p className="text-[10px] text-rl-muted mt-1 pl-1">Início</p>
              </div>
              <div>
                <input
                  id="campaign-end-date"
                  type="date"
                  value={endDate}
                  min={minEndDate}
                  onChange={(e) => setEndDate(e.target.value || defaultEndDateISO())}
                  className="input-field w-full"
                  aria-label="Data final"
                />
                <p className="text-[10px] text-rl-muted mt-1 pl-1">Fim</p>
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 bg-rl-green/10 border border-rl-green/20 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-rl-green">
                {monthLabel}
              </span>
              <span className="text-[11px] text-rl-muted">
                {daysLeft} {daysLeft === 1 ? 'dia' : 'dias'}
              </span>
            </div>
          </div>
        </div>

        {/* Puxar dados reais (gasto do mês + período) */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handlePullBudget}
            disabled={!canPull}
            className="btn-secondary flex items-center gap-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            title="Preenche 'Já Utilizado' com o gasto do mês (Meta + Google) e ajusta o período de hoje até o fim do mês"
          >
            <DownloadCloud className="w-4 h-4" />
            Puxar dados
          </button>
          <p className="text-[11px] text-rl-muted">
            {dash.loading
              ? 'Carregando dados de tráfego…'
              : pullNames.size === 0
                ? 'Vincule uma conta de anúncio na seção acima para puxar o gasto real'
                : `Gasto do mês de ${pullScopeLabel} → Já Utilizado · período de hoje até o fim do mês`}
          </p>
        </div>

        {/* Disponível para investir */}
        <div className="flex items-center justify-between rounded-xl bg-rl-surface border border-rl-border px-4 py-3">
          <div>
            <p className="text-xs text-rl-muted">Disponível para investir</p>
            <p className="text-[10px] text-rl-muted/60 mt-0.5">
              {fmtBRL(orcamentoTotal)} − {fmtBRL(valorJaUsado)}
            </p>
          </div>
          <p className={`text-lg font-bold ${budgetDisponivel > 0 ? 'text-rl-green' : 'text-red-400'}`}>
            {fmtBRL(budgetDisponivel)}
          </p>
        </div>
      </div>

      {/* Channels section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-rl-text">Canais</p>
          {channels.length > 0 && (
            <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border ${
              validation.chValid
                ? 'bg-rl-green/10 border-rl-green/20 text-rl-green'
                : 'bg-rl-gold/10 border-rl-gold/20 text-rl-gold'
            }`}>
              {validation.chValid
                ? <><CheckCircle2 className="w-3.5 h-3.5" /> 100% distribuído</>
                : <><AlertCircle className="w-3.5 h-3.5" /> Restante: {channelRemaining}%</>
              }
            </div>
          )}
        </div>

        {channels.length === 0 && (
          <div className="glass-card p-8 text-center">
            <DollarSign className="w-8 h-8 text-rl-muted/40 mx-auto mb-2" />
            <p className="text-sm text-rl-muted">Nenhum canal adicionado ainda</p>
            <p className="text-xs text-rl-muted/60 mt-1">
              Clique em "+ Adicionar Canal" para começar a distribuir o orçamento
            </p>
          </div>
        )}

        {derived.map((ch, idx) => (
          <ChannelRow
            key={ch.id}
            channel={channels[idx]}
            derived={ch}
            daysLeft={daysLeft}
            validation={validation}
            usedNames={usedChannelNames.filter((n) => n !== ch.name)}
            budgetDisponivel={budgetDisponivel}
            canPull={canPull && !!CHANNEL_KEY[ch.name]}
            onPull={() => handlePullChannel(ch.id)}
            onUpdate={(patch) => updateChannel(ch.id, patch)}
            onDelete={() => deleteChannel(ch.id)}
            onUpdateStage={(stageKey, patch, accountId) => updateStage(ch.id, stageKey, patch, accountId)}
            onAddCampaign={(stageKey, accountId) => addCampaign(ch.id, stageKey, accountId)}
            onUpdateCampaign={(stageKey, campId, patch, accountId) => updateCampaign(ch.id, stageKey, campId, patch, accountId)}
            onDeleteCampaign={(stageKey, campId, accountId) => deleteCampaign(ch.id, stageKey, campId, accountId)}
            onUpdateAdAccount={(accountId, patch) => updateAdAccount(ch.id, accountId, patch)}
            onAddAdAccount={() => addAdAccount(ch.id)}
            onDeleteAdAccount={(accountId) => deleteAdAccount(ch.id, accountId)}
          />
        ))}

        <button
          onClick={addChannel}
          disabled={!canAddChannel}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-rl-border text-rl-muted hover:border-rl-purple/40 hover:text-rl-text transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">
            {canAddChannel ? 'Adicionar Canal' : 'Todos os canais já adicionados'}
          </span>
        </button>
      </div>

      {/* Global validation warning */}
      {!validation.allValid && channels.length > 0 && (
        <div className="flex items-start gap-2 bg-rl-gold/10 border border-rl-gold/20 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-rl-gold shrink-0 mt-0.5" />
          <div className="text-xs text-rl-gold space-y-0.5">
            {!validation.chValid && (
              <p>A distribuição total dos canais deve somar 100% (atual: {channelSum}%).</p>
            )}
            {validation.stageErrors
              .filter((e) => !e.valid && channels.find((ch) => ch.id === e.channelId)?.percentage > 0)
              .map((e) => (
                <p key={e.id}>
                  {e.name}: {e.kind === 'accounts' ? 'divisão entre as contas' : 'distribuição do funil'} soma {e.sum}% (deve ser 100%).
                </p>
              ))}
          </div>
        </div>
      )}

      {/* Save button */}
      <div className="flex justify-end pt-2">
        <button onClick={handleSave} className="btn-primary flex items-center gap-2">
          <Save className="w-4 h-4" />
          Salvar Planejamento
        </button>
      </div>

      <Toast toast={toast} />
    </div>
  )
}
