import { useCallback } from 'react'
import { useParams, useNavigate, Navigate, useOutletContext } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { ArrowLeft, Loader2, Menu } from 'lucide-react'
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
      <nav className="sticky top-0 z-40 border-b border-rl-border bg-rl-bg/80 backdrop-blur-xl">
        <div className="px-4 sm:px-6 h-16 flex items-center gap-2 sm:gap-4">
          {/* Hambúrguer: no mobile a sidebar é drawer e quem abre é o layout. */}
          <button
            onClick={openSidebar}
            aria-label="Abrir menu de navegação"
            className="lg:hidden p-2 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all"
          >
            <Menu className="w-5 h-5" />
          </button>
          <button
            onClick={() => navigate('/')}
            aria-label="Voltar à lista de clientes"
            className="p-2 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all duration-150"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-semibold text-rl-text truncate">{project.companyName}</span>
            <span className="text-rl-border text-lg leading-none">|</span>
            <span className="text-rl-muted text-sm">{project.responsibleName}</span>
          </div>
        </div>
      </nav>

      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-6">
        <ClientProfile
          project={project}
          section={section}
          onSectionChange={handleSectionChange}
        />
      </div>
    </div>
  )
}
