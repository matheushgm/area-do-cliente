import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, RefreshCw, AlertTriangle, Radio } from 'lucide-react'
import AppSidebar from '../components/AppSidebar'
import WorkloadBoard from '../components/Workload/WorkloadBoard'
import WeekRadar from '../components/Workload/WeekRadar'
import PersonModal from '../components/Workload/PersonModal'
import Toast from '../components/UI/Toast'
import { useToast } from '../hooks/useToast'
import { useWorkloadData } from '../hooks/useWorkloadData'

// Relógio que avança sozinho: mantém o "há X min" correto sem recarregar e
// evita ler Date.now() durante o render (impuro — o valor mudaria a cada
// re-render sem que nada tivesse mudado de fato).
function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

function relativeTime(iso, now) {
  if (!iso) return 'nunca'
  const diff = now - new Date(iso).getTime()
  if (diff < 60_000) return 'agora mesmo'
  const min = Math.floor(diff / 60_000)
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  return `há ${Math.floor(h / 24)}d`
}

export default function WorkloadDashboard() {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [person, setPerson] = useState(null)
  const { toast, showToast } = useToast()
  const { workload, syncState, loading, syncing, error, syncNow } = useWorkloadData()
  const now = useNow()

  const handleSync = async (mode) => {
    const res = await syncNow(mode)
    if (res.ok) {
      showToast(
        `Sync ${res.mode === 'full' ? 'completo' : 'incremental'}: ${res.written} tarefa(s) atualizada(s)` +
        (res.reconciled ? `, ${res.reconciled} fechada(s)` : '')
      )
    } else {
      showToast(res.error || 'Falha no sync', 'error')
    }
  }

  const staleMin = syncState?.last_synced_at
    ? (now - new Date(syncState.last_synced_at).getTime()) / 60_000
    : Infinity

  return (
    <div className="min-h-screen flex bg-gradient-dark">
      <AppSidebar
        filter="workload"
        setFilter={() => navigate('/')}
        counts={{}}
        activeAccounts={[]}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 border-b border-rl-border bg-rl-bg/90 backdrop-blur-xl">
          <button onClick={() => setSidebarOpen(true)} aria-label="Abrir menu de navegação" className="p-2 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold text-rl-text text-sm">Capacidade do Time</span>
        </div>

        <div className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-[1400px] w-full mx-auto">
          <header className="flex items-start justify-between flex-wrap gap-4 mb-6">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-rl-muted font-semibold">
                ClickUp · workspace Revenue Lab
              </p>
              <h1 className="text-2xl font-bold text-rl-text mt-1">Capacidade do time</h1>
              <div className="flex items-center gap-2 mt-1.5 text-[11px] text-rl-muted">
                <Radio className="w-3 h-3 text-rl-green" />
                <span>
                  atualização em tempo real via webhook · última reconciliação {relativeTime(syncState?.last_synced_at, now)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSync('incremental')}
                disabled={syncing}
                className="btn-secondary !px-4 !py-2 !text-sm inline-flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                Atualizar agora
              </button>
              <button
                onClick={() => handleSync('full')}
                disabled={syncing}
                title="Repuxa todas as tarefas abertas e reconcilia o cache (~8 requisições ao ClickUp)"
                className="btn-ghost !px-3 !py-2 !text-sm disabled:opacity-50"
              >
                Sync completo
              </button>
            </div>
          </header>

          {syncState?.last_error && (
            <div className="glass-card border-rl-red/30 bg-rl-red/5 px-4 py-3 mb-4 flex gap-3">
              <AlertTriangle className="w-4 h-4 text-rl-red shrink-0 mt-0.5" />
              <div className="text-[12px] text-rl-subtle">
                <b className="text-rl-text">Último sync falhou:</b> {syncState.last_error}
              </div>
            </div>
          )}

          {staleMin > 120 && !loading && (
            <div className="glass-card border-rl-gold/30 bg-rl-gold/5 px-4 py-3 mb-4 flex gap-3">
              <AlertTriangle className="w-4 h-4 text-rl-gold shrink-0 mt-0.5" />
              <div className="text-[12px] text-rl-subtle">
                Sem reconciliação {relativeTime(syncState?.last_synced_at, now)}. O webhook pode estar suspenso no
                ClickUp — rode um <b className="text-rl-text">sync completo</b> e confira o registro do webhook.
              </div>
            </div>
          )}

          {error && (
            <div className="glass-card border-rl-red/30 bg-rl-red/5 px-4 py-3 mb-4 text-[12px] text-rl-red">
              {error}
            </div>
          )}

          {loading ? (
            <div className="glass-card px-4 py-16 text-center text-sm text-rl-muted">Carregando tarefas…</div>
          ) : (
            <>
              <WorkloadBoard workload={workload} onSelectPerson={setPerson} />
              <WeekRadar workload={workload} />
            </>
          )}
        </div>
      </div>

      {person && <PersonModal person={person} onClose={() => setPerson(null)} />}
      <Toast toast={toast} />
    </div>
  )
}
