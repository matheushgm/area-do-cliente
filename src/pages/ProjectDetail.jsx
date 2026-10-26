import { useCallback } from 'react'
import { useParams, useNavigate, Navigate, useOutletContext } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { Loader2 } from 'lucide-react'
import { sectionFromSlug, slugFromSection } from '../lib/clientSections'
import { cliente } from '../routes/paths'
import ClientProfile from './ClientProfile'

export default function ProjectDetail() {
  const { id, secao } = useParams()
  const navigate = useNavigate()
  const { openSidebar } = useOutletContext()
  const { projects, loadingProjects, loadingAuth } = useApp()

  const project = projects.find((p) => String(p.id) === String(id))

  // null = slug inexistente na URL. O hub mora na raiz (`/cliente/:id`), então
  // o slug vazio devolve a seção padrão.
  const section = sectionFromSlug(secao)

  const handleSectionChange = useCallback((next) => {
    const slug = slugFromSection(next)
    navigate(cliente(id, slug))
  }, [id, navigate])

  // Ao dar refresh, os projetos ainda estão carregando da nuvem — mostramos
  // loading em vez de "não encontrado" (que aparecia num flash de race condition).
  if (!project && (loadingProjects || loadingAuth)) {
    return (
      <div className="flex-1 min-w-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-rl-muted">
          <Loader2 className="w-8 h-8 animate-spin text-rl-purple" />
          <p className="text-sm">Carregando projeto...</p>
        </div>
      </div>
    )
  }

  // Seção inexistente na URL cai no hub em vez de renderizar um painel vazio.
  if (project && section === null) {
    return <Navigate to={cliente(id)} replace />
  }

  if (!project) {
    return (
      <div className="flex-1 min-w-0 flex items-center justify-center">
        <div className="text-center">
          <p className="text-rl-muted text-lg">Projeto não encontrado.</p>
          <button onClick={() => navigate('/')} className="btn-primary mt-4">
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      {/* Sem barra superior: voltar e menu ficam no topo da coluna do cliente (ClientProfile). */}
      {/* min-w-0 + w-full: como item do flex em coluna do Layout, sem isso o bloco cresce até
          a largura mínima do conteúdo (3 colunas) e estoura a tela em vez de encolher. */}
      <div className="w-full min-w-0 px-4 sm:px-6 2xl:px-8 py-6">
        <ClientProfile
          project={project}
          section={section}
          onSectionChange={handleSectionChange}
          onVoltar={() => navigate('/')}
          onAbrirMenu={openSidebar}
        />
      </div>
    </div>
  )
}
