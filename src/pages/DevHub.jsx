// Preview sem login da página do cliente (só em DEV): /dev/hub
// Injeta um projeto fictício, a timeline e o dash (fixture real de uma conta)
// e renderiza o ClientProfile com um AppContext falso.
import { useMemo } from 'react'
import { AppContext } from '../context/AppContext'
import ClientProfile from './ClientProfile'
// Fixture gitignored (dados reais de uma conta): import opcional, pra não quebrar o
// build da Vercel (clone limpo, sem o arquivo). Sem ela a aba Resultados/Sugestões fica vazia.
const fixtures = import.meta.glob('../dev/fixtures/hub_meta.json', { eager: true, import: 'default' })
const hubMeta = fixtures['../dev/fixtures/hub_meta.json'] || []

const PROJECT_ID = '00000000-0000-4000-8000-000000000001'
const SQUAD_ID = '00000000-0000-4000-8000-0000000000aa'
const P1 = '00000000-0000-4000-8000-0000000000b1'
const P2 = '00000000-0000-4000-8000-0000000000b2'

const project = {
  id: PROJECT_ID,
  companyName: 'Boa Noite Colchões e Estofados',
  businessType: 'b2c',
  segmento: 'Varejo de móveis e colchões',
  responsibleName: 'Leandro Martins',
  responsibleRole: 'CEO',
  contractDate: '2026-07-28',
  contractModel: 'assessoria',
  contractPaymentType: 'mensal',
  contractValue: 3002,
  createdAt: '2026-07-28T12:00:00Z',
  momento: 'aceleracao',
  riskLevel: 'em_risco',
  squad: SQUAD_ID,
  clickupFolderId: '90090000001',
  clickupListUrl: 'https://app.clickup.com/9009170774/v/f/90090000001',
  dashboardUrl: 'https://app.revenuelab.com.br/dashboard-teste',
  links: { website: 'https://www.boanoitecolchoes.com.br', instagram: 'https://instagram.com/boanoitecolchoes', googleDrive: 'https://drive.google.com/drive/folders/x', outros: [] },
  observacoes: 'Cliente pré-pago. Feirão de colchões toda última semana do mês.',
  kickoff: { completedAt: '2026-08-02' },
  personas: [{ nome: 'Casal jovem' }],
  produtos: [{ nome: 'Colchão mola ensacada', answers: { q1: 'sim' } }],
  ofertaData: { nome: 'Feirão' },
  roiResult: { ok: true },
  campaignPlan: { totalBudget: 4500, channels: [{ name: 'Meta Ads' }, { name: 'Google Ads' }] },
  debriefing: { ads: [{ id: 1, nome: 'AD001', status: 'finalizado' }, { id: 2, nome: 'AD002', status: 'em_andamento' }, { id: 3, nome: 'AD003', status: 'para_subir' }] },
  lpCentral: { lps: [{ id: 1, nome: 'LP Feirão', status: 'no_ar', url: 'https://lp.exemplo.com/feirao' }, { id: 2, nome: 'LP Poltrona', status: 'em_producao' }] },
  attachments: [{ id: 1, name: 'Contrato assinado.pdf' }, { id: 2, name: 'Logo.png' }],
  npsMarcos: [{ nome: '30 dias', respostas: [{ score: 9 }, { score: 8 }] }],
}

const squads = [{ id: SQUAD_ID, name: 'Caça ROI', emoji: '🏹', members: [{ profile_id: P1, role: 'Account Manager' }, { profile_id: P2, role: 'Gestor de Tráfego' }], department_assignments: { 'Gestor de tráfego': P2, 'Account Manager': P1 } }]
const teamMembers = [
  { id: P1, name: 'Matheus Martins', avatar: 'MM', clickup_user_id: 1, clickupUserId: 1 },
  { id: P2, name: 'Bárbara Luiza', avatar: 'BL', clickup_user_id: 2, clickupUserId: 2 },
]
const user = { id: P1, name: 'Matheus Martins', email: 'matheus@revenuelab.com.br', role: 'admin' }

const hub = {
  otimizacoes: [
    { id: 'o1', project_id: PROJECT_ID, tipo: 'otimizacao', data: '2026-09-27', canal: 'meta', campanha: 'Concept-fundo-abo-whattsapp-tel6947', acao: 'Desliguei o AD "ad 01 - 06/06" e subi 3 criativos novos de mola ensacada', motivo: 'R$ 36 gastos em 7 dias sem conversão; CTR de link em 0%.', metricas_antes: { gasto: 36.49, conv: 0, ctr: 0 }, resultado: null, origem: 'sugestao', autor_nome: 'Bárbara Luiza', created_at: '2026-09-27T14:10:00Z' },
    { id: 'o2', project_id: PROJECT_ID, tipo: 'anotacao', data: '2026-09-25', acao: 'Cliente pediu pra segurar a verba do topo até o feirão', motivo: 'Vai concentrar tudo no WhatsApp na última semana do mês.', autor_nome: 'Matheus Martins', created_at: '2026-09-25T10:00:00Z' },
    { id: 'o3', project_id: PROJECT_ID, tipo: 'otimizacao', data: '2026-09-20', canal: 'meta', campanha: 'Boa_colchoes_Whatsapp_abo_lojas_tel1926', acao: 'Aumentei o orçamento do conjunto [colchões] de R$ 100 para R$ 120/dia', motivo: 'CPL de R$ 12 estável há 4 dias, bem abaixo da meta de R$ 40.', metricas_antes: { cpl: 12.09, conv: 70 }, resultado: 'CPL se manteve em R$ 14 com +18% de conversas', origem: 'manual', autor_nome: 'Bárbara Luiza', created_at: '2026-09-20T16:30:00Z' },
  ],
  sugestoesStatus: [
    { id: 's1', project_id: PROJECT_ID, chave: 'meta:ad_sem_conv:ad 01 - 06/06', status: 'aceita', titulo: 'Desligar o anúncio "ad 01 - 06/06" (R$ 36,49 sem conversão)', clickup_task_url: 'https://app.clickup.com/t/abc123', created_at: '2026-09-27T14:00:00Z' },
  ],
  planejadas: [
    { id: 'p1', project_id: PROJECT_ID, titulo: 'Desligar o anúncio "ad 01 - 06/06" (R$ 36,49 sem conversão)', descricao: 'Gerado a partir da sugestão do playbook.', tipo_tarefa: 'Otimização', responsavel_profile_id: P2, horas_estimadas: 0.5, data_escolhida: '2026-09-28', clickup_task_url: 'https://app.clickup.com/t/abc123', status: 'criada', created_at: '2026-09-27T14:00:00Z' },
  ],
  tarefas: [
    { id: 't1', titulo: 'Relatório semanal de tráfego', status: 'em andamento', status_tipo: 'custom', prioridade: 'normal', responsaveis: [P2], responsaveis_extra: [], data_vencimento: '2026-09-30T12:00:00Z', clickup_url: 'https://app.clickup.com/t/t1', created_at: '2026-09-26T09:00:00Z', lista: { nome: 'Geral' } },
    { id: 't2', titulo: 'Criar 3 artes do feirão de setembro', status: 'concluído', status_tipo: 'closed', prioridade: 'high', responsaveis: [], responsaveis_extra: [{ nome: 'Designer' }], data_vencimento: '2026-09-22T12:00:00Z', data_conclusao: '2026-09-22T18:00:00Z', clickup_url: 'https://app.clickup.com/t/t2', created_at: '2026-09-18T09:00:00Z', lista: { nome: 'Geral' } },
  ],
  atas: [
    { id: 'a1', title: 'Alinhamento mensal de setembro', meeting_date: '2026-09-15', next_actions: ['Subir LP do feirão até 25/09', 'Enviar relatório de agosto'], created_at: '2026-09-15T20:00:00Z' },
  ],
}

const dash = {
  raw: { meta: hubMeta, google: [] },
  accounts: { 'Boa Noite Colchões e Estofados': { projectId: PROJECT_ID, cplTarget: { value: 40, acName: 'Boa Noite Colchões e Estofados' } } },
  loading: false, error: null, reload: () => {},
}

if (typeof window !== 'undefined') window.__DEV_HUB = { hub, dash }

export default function DevHub() {
  const value = useMemo(() => ({
    user, projects: [project], squads, teamMembers,
    loadingProjects: false, loadingAuth: false, isSupabaseReady: true,
    updateProject: (id, patch) => console.log('[dev] updateProject', id, patch),
  }), [])
  return (
    <AppContext.Provider value={value}>
      <div className="fx min-h-screen bg-gradient-dark">
        <nav className="sticky top-0 z-50 border-b border-rl-border bg-rl-bg/80 backdrop-blur-xl">
          <div className="px-6 h-16 flex items-center gap-3">
            <img src="/verta/simbolo.png" alt="Verta" className="w-8 h-8 object-contain" />
            <span className="font-semibold text-rl-text">{project.companyName}</span>
            <span className="text-rl-border text-lg leading-none">|</span>
            <span className="text-rl-muted text-sm">{project.responsibleName}</span>
            <span className="ml-auto text-xs text-rl-gold">preview local (fixture)</span>
          </div>
        </nav>
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-6">
          <ClientProfile project={project} />
        </div>
      </div>
    </AppContext.Provider>
  )
}
