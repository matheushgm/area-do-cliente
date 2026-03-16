import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { ArrowLeft, Zap } from 'lucide-react'
import ClientProfile from './ClientProfile'

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { projects } = useApp()

  const project = projects.find((p) => String(p.id) === String(id))

  if (!project) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
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
    <div className="min-h-screen bg-gradient-dark">
      <nav className="sticky top-0 z-50 border-b border-rl-border bg-rl-bg/80 backdrop-blur-xl">
        <div className="px-6 h-16 flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            aria-label="Voltar ao dashboard"
            className="p-2 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all duration-150"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-rl flex items-center justify-center shadow-glow">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-rl-text">{project.companyName}</span>
            <span className="text-rl-border text-lg leading-none">|</span>
            <span className="text-rl-muted text-sm">{project.responsibleName}</span>
          </div>
        </div>
      </nav>

      <div className="max-w-screen-2xl mx-auto px-8 py-8">
        <ClientProfile project={project} />
      </div>
    </div>
  )
}
