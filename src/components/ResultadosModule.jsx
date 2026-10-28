import { useCallback, useEffect, useRef } from 'react'
import { BarChart3, Filter, Link2 } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import Toast from './UI/Toast'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { useDashboardData } from '../hooks/useDashboardData'
import ModelSelector from './Resultados/ModelSelector'
import B2BView from './Resultados/B2BResultados'
import B2CView from './Resultados/B2CResultados'
import ProjectTrafficDashboard from './Resultados/ProjectTrafficDashboard'
import ContasVinculadas from './Resultados/ContasVinculadas'

// ─── Main Export ───────────────────────────────────────────────────────────────
// Dois módulos do cliente que leem o mesmo dash (dash_insights via /api, escopado às
// contas vinculadas; o canal inteiro dava 504 na Edge):
//   trafego    → TrafegoModule: contas de anúncio vinculadas + Dashboard de Tráfego delas
//   resultados → ResultadosModule: Resultados do Funil (investimento/conversões da API + vendas)
// O id `resultados` é chave de project_shares.permissions (portal), por isso ficou com o funil,
// que é o que o portal já mostrava.
export default function ResultadosModule({ project, onIrParaTrafego }) {
  const dash = useDashboardData({ source: 'api', projectId: project.id })
  return <ResultadosConteudo project={project} dash={dash} onIrParaTrafego={onIrParaTrafego} />
}

export function TrafegoModule({ project }) {
  // Só contas e vínculos: os números quem desenha é o viewer do iframe, que lê os dele.
  // `canais`: em que canal cada conta vinculada tem dado (pílulas e iframe do viewer).
  const dash = useDashboardData({ source: 'api', projectId: project.id, linhas: false, canais: true })
  return <TrafegoConteudo project={project} dash={dash} />
}

function Cabecalho({ Icon, titulo, sub, children }) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-9 h-9 rounded-xl fx-soft flex items-center justify-center shrink-0"><Icon size={18} /></span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-rl-text leading-tight">{titulo}</h2>
          {sub && <p className="text-xs text-rl-muted">{sub}</p>}
        </div>
        {children?.[0]}
      </div>
      {children?.[1]}
    </div>
  )
}

// Os *Conteudo recebem o `dash` de fora. O preview /dev/resultados passa um dash
// fictício e `mock`: o viewer lê os CSVs de public/dash-teste/mock e não há releitura
// do Supabase (o projeto B2C do preview usa o id real da Boa Noite, por causa das lojas).
export function TrafegoConteudo({ project, dash, mock = false }) {
  const { toast, showToast } = useToast()
  return (
    <div className="space-y-4">
      <Cabecalho Icon={BarChart3} titulo="Resultados de Tráfego" sub="Dados reais das contas de anúncio vinculadas a este cliente" />
      <ContasVinculadas project={project} dash={dash} showToast={showToast} />
      <ProjectTrafficDashboard project={project} dash={dash} viewerExtra={mock ? '&mock=1' : ''} />
      <Toast toast={toast} />
    </div>
  )
}

export function ResultadosConteudo({ project, dash, mock = false, onIrParaTrafego }) {
  const { updateProject } = useApp()
  const semContas = !dash.loading && !Object.values(dash.accounts || {}).some((a) => a.projectId === project.id)

  const resultados = project.resultados || {}
  const modelo = resultados.modelo

  // `resultados` é tabela filha: não tem realtime e só é buscada uma vez no
  // login (ver CLAUDE.md). Se o cliente preenche pelo link público /b2b ou
  // /b2c depois disso, esta sessão fica com o dado velho até um F5. Busca a
  // versão mais recente direto do Supabase sempre que o módulo é aberto, para
  // não parecer que o preenchimento do cliente "sumiu".
  const syncedProjectRef = useRef(null)
  useEffect(() => {
    if (mock || !supabase || syncedProjectRef.current === project.id) return
    syncedProjectRef.current = project.id
    supabase
      .from('resultados')
      .select('data')
      .eq('project_id', project.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) return
        const fresh = data.data || {}
        if (JSON.stringify(fresh) !== JSON.stringify(resultados)) {
          updateProject(project.id, { resultados: fresh })
        }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id])

  const handleUpdate = (updated) => {
    updateProject(project.id, { resultados: updated })
  }

  const selectModel = (m) => {
    handleUpdate({ ...resultados, modelo: m })
  }

  // ── Token de compartilhamento ──────────────────────────────────────────────
  // Mesmo token usado pelo CRM público e pelo formulário B2C. Quando não
  // existe, geramos um UUID e persistimos no campo `clientShareToken` do
  // project; assim qualquer lugar do app pode chamar `getOrCreateShareToken()`
  // e receber um token válido na hora.
  const getOrCreateShareToken = useCallback(() => {
    if (project.clientShareToken) return project.clientShareToken
    const token = crypto.randomUUID()
    updateProject(project.id, { clientShareToken: token })
    return token
  }, [project.id, project.clientShareToken, updateProject])

  return (
    <div className="space-y-6">
        <Cabecalho Icon={Filter} titulo="Resultados de Funil" sub="Investimento e conversões da API somados às vendas lançadas pelo time ou pelo cliente">
          {modelo ? (
            <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${modelo === 'b2b' ? 'border-rl-blue/30 text-rl-blue bg-rl-blue/10' : 'border-rl-green/30 text-rl-green bg-rl-green/10'}`}>
              {modelo === 'b2b' ? 'B2B · Semanal' : 'B2C · Diário'}
            </span>
          ) : null}
          {modelo ? (
            <button onClick={() => handleUpdate({ ...resultados, modelo: null })} className="btn-secondary text-xs">
              Trocar modelo
            </button>
          ) : null}
        </Cabecalho>

        {semContas && (
          <div className="flex items-center gap-3 rounded-xl border border-rl-gold/30 bg-rl-gold/5 px-4 py-3 text-sm text-rl-text">
            <Link2 className="w-4 h-4 text-rl-gold shrink-0" />
            <span className="flex-1">Nenhuma conta de anúncio vinculada: investimento e leads não vêm da API e precisam ser lançados à mão.</span>
            {onIrParaTrafego && <button onClick={onIrParaTrafego} className="btn-secondary text-sm !py-1.5">Vincular contas</button>}
          </div>
        )}

        {!modelo && <ModelSelector onSelect={selectModel} />}

        {modelo === 'b2b' && (
          <B2BView
            resultados={resultados}
            onUpdate={handleUpdate}
            companyName={project.companyName}
            roiCalc={project.roiCalc}
            getOrCreateShareToken={getOrCreateShareToken}
            dash={dash}
            projectId={project.id}
          />
        )}

        {modelo === 'b2c' && (
          <B2CView
            resultados={resultados}
            onUpdate={handleUpdate}
            clientShareToken={project.clientShareToken}
            getOrCreateShareToken={getOrCreateShareToken}
            companyName={project.companyName}
            roiCalc={project.roiCalc}
            dash={dash}
            projectId={project.id}
          />
        )}
    </div>
  )
}
