import { useCallback, useEffect, useState } from 'react'
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
  const { projects, loadingProjects, loadingAuth, carregarDetalhe } = useApp()

  const project = projects.find((p) => String(p.id) === String(id))
  const completo = !!project?._completo

  // A lista do AppContext traz só as colunas leves; o resto do cliente (colunas
  // pesadas e tabelas filhas) é buscado aqui. Os módulos só montam com o projeto
  // completo: salvar a partir de um projeto incompleto apagaria o que não veio.
  // A busca começa já no primeiro render, em paralelo com a lista.
  // A falha vale para o par cliente + tentativa: outro cliente ou "Tentar de novo"
  // voltam ao carregando sem precisar limpar estado.
  const [tentativa, setTentativa] = useState(0)
  const [falha, setFalha] = useState(null)
  const falhou = falha === `${id}:${tentativa}`
  useEffect(() => {
    if (completo || loadingAuth) return
    let vivo = true
    carregarDetalhe(id).then((full) => { if (vivo && !full) setFalha(`${id}:${tentativa}`) })
    return () => { vivo = false }
  }, [id, completo, loadingAuth, carregarDetalhe, tentativa])

  // null = slug inexistente na URL. O hub mora na raiz (`/cliente/:id`), então
  // o slug vazio devolve a seção padrão.
  const section = sectionFromSlug(secao)

  const handleSectionChange = useCallback((next) => {
    const slug = slugFromSection(next)
    navigate(cliente(id, slug))
  }, [id, navigate])

  // Projeto existe mas o detalhe não veio (rede, permissão): oferece tentar de novo.
  if (project && !completo && falhou) {
    return (
      <div className="flex-1 min-w-0 flex items-center justify-center">
        <div className="text-center">
          <p className="text-rl-muted">Não foi possível carregar este cliente.</p>
          <button onClick={() => setTentativa((n) => n + 1)} className="btn-primary mt-4">
            Tentar de novo
          </button>
        </div>
      </div>
    )
  }

  // Ao dar refresh, os projetos ainda estão carregando da nuvem — mostramos
  // loading em vez de "não encontrado" (que aparecia num flash de race condition).
  // Também enquanto o detalhe do cliente não chegou.
  if ((!project && (loadingProjects || loadingAuth)) || (project && !completo)) {
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
