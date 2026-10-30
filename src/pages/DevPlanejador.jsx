// Preview sem login do Planejamento de Campanhas (só em DEV): /dev/planejador
// Plano fictício com Meta (4 frentes no fundo) e Google (busca), para conferir a
// leitura dos canais sem abrir um cliente de verdade. Edições ficam em memória.
import { useEffect, useMemo, useState } from 'react'
import { AppContext } from '../context/AppContext'
import CampaignPlanner from '../components/CampaignPlanner'

const camp = (name, percentage, extra = {}) => ({ id: crypto.randomUUID(), name, percentage, startDate: null, endDate: null, ...extra })

const PLANO = {
  startDate: null,
  endDate: null,
  accounts: [{
    id: 'conta-1',
    name: 'Conta Principal',
    orcamentoTotal: 15000,
    valorJaUsado: 6549.12,
    channels: [
      {
        id: 'ch-meta', name: 'Meta Ads', percentage: 70, expanded: true,
        stages: {
          topo:  { percentage: 25, campaigns: [camp('[TOPO] Influencers - Pedro', 60), camp('[TOPO] Visita ao perfil', 40)] },
          meio:  { percentage: 0, campaigns: [] },
          fundo: { percentage: 75, campaigns: [
            camp('[FUNDO] Galaxy', 25), camp('[FUNDO] Salão de Festa', 25),
            camp('[FUNDO] Bar', 20), camp('[FUNDO] GellZone', 15),
            camp('[FUNDO][RMKT] 60D Geral', 15, { startDate: '2026-11-02', endDate: '2026-11-05' }),
          ] },
        },
      },
      {
        id: 'ch-google', name: 'Google Ads', percentage: 30, expanded: true,
        stages: {
          topo:  { percentage: 0, campaigns: [] },
          meio:  { percentage: 20, campaigns: [camp('[PMAX] Lojas', 100)] },
          fundo: { percentage: 70, campaigns: [camp('[SEARCH] Restaurante com parque infantil', 100)] },
        },
      },
    ],
  }],
}

export default function DevPlanejador() {
  const [tema, setTema] = useState(() => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'))
  useEffect(() => { document.documentElement.classList.toggle('dark', tema === 'dark') }, [tema])

  const project = useMemo(() => ({ id: 'dev-planejador', companyName: 'Universo Park (fictício)', campaignPlan: PLANO, clientShareToken: 'token-de-teste' }), [])
  const contexto = useMemo(() => ({
    user: { id: 'dev', name: 'Preview', role: 'admin' }, projects: [project], squads: [], teamMembers: [],
    loadingProjects: false, loadingAuth: false, isSupabaseReady: true,
    updateProject: (pid, patch) => console.log('[dev] updateProject', pid, patch),
  }), [project])

  return (
    <AppContext.Provider value={contexto}>
      <div className="fx min-h-screen bg-rl-bg">
        <div className="sticky top-0 z-40 flex items-center gap-3 px-6 py-2.5 border-b border-rl-border bg-rl-card/90 backdrop-blur">
          <span className="text-xs font-semibold text-rl-gold">preview local · dados fictícios</span>
          <button onClick={() => setTema(tema === 'dark' ? 'light' : 'dark')} className="text-xs text-rl-muted hover:text-rl-text">
            {tema === 'dark' ? 'Claro' : 'Escuro'}
          </button>
        </div>
        <div className="max-w-6xl mx-auto p-6">
          <CampaignPlanner project={project} onSave={() => {}} />
        </div>
      </div>
    </AppContext.Provider>
  )
}
