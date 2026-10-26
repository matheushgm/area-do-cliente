// Aba "Tarefas" do hub da página do cliente (HubCentro): a MESMA área de tarefas do
// VertaTask (AreaTarefas), travada na pasta ativa do cliente. Em cima, as listas da pasta
// (todas ou uma) e o atalho para abrir a pasta no VertaTask. Views, filtros, painel da
// tarefa e templates são os do VertaTask: mudou lá, muda aqui. A lista escolhida vai na URL
// (?lista=), junto com ?view= e ?tarefa= da área.
import { useCallback, useMemo, useRef, useState, useLayoutEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ExternalLink, Loader2, RefreshCw, FolderX } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../hooks/useToast'
import { useTarefas } from '../../hooks/useTarefas'
import { useVertaTask } from '../../hooks/useVertaTask'
import Toast from '../UI/Toast'
import { FOCO } from './Campos'
import AreaTarefas from './AreaTarefas'

const MARGEM_INFERIOR = 24 // a mesma do py-6 da página do cliente
const ALTURA_MIN = 480

/** Altura que leva o elemento do ponto onde ele começa na página até o fim da tela. */
function useAlturaAteOFim(ref) {
  const [altura, setAltura] = useState(null)
  useLayoutEffect(() => {
    const medir = () => {
      const el = ref.current
      if (!el) return
      const topo = el.getBoundingClientRect().top + window.scrollY
      setAltura(Math.max(ALTURA_MIN, Math.round(window.innerHeight - topo - MARGEM_INFERIOR)))
    }
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [ref])
  return altura
}

export default function TarefasDoCliente({ project }) {
  const { user, projects, teamMembers, squads } = useApp()
  const { toast, showToast } = useToast()
  const [params, setParams] = useSearchParams()
  const t = useTarefas(user)
  const vt = useVertaTask(user)
  const quadroRef = useRef(null)
  const altura = useAlturaAteOFim(quadroRef)

  // só pastas ativas chegam em t.pastas; clientes com pasta duplicada têm uma ativa só
  const pasta = useMemo(() => t.pastas.find((p) => p.project_id === project.id) || null, [t.pastas, project.id])
  const listas = useMemo(() => (pasta ? t.listas.filter((l) => l.pasta_id === pasta.id) : []), [t.listas, pasta])
  const listaParam = params.get('lista')
  const listaId = listas.some((l) => l.id === listaParam) ? listaParam : null
  const sel = useMemo(() => (listaId ? { tipo: 'lista', id: listaId } : pasta ? { tipo: 'pasta', id: pasta.id } : { tipo: 'nenhum' }), [listaId, pasta])

  const escolherLista = useCallback((id, tarefaId = null) => {
    const p = new URLSearchParams(params)
    if (id) p.set('lista', id); else p.delete('lista')
    if (tarefaId) p.set('tarefa', tarefaId)
    setParams(p)
  }, [params, setParams])
  // template aplicado em outra pasta: as tarefas não aparecem aqui, então abre no VertaTask
  const irParaLista = useCallback((id, tarefaId) => {
    if (listas.some((l) => l.id === id)) { escolherLista(id, tarefaId); return }
    window.open(`/tarefas?lista=${id}${tarefaId ? `&tarefa=${tarefaId}` : ''}`, '_blank', 'noopener')
  }, [listas, escolherLista])

  const pilula = (ativa) => `h-7 px-2.5 rounded-md text-[12.5px] whitespace-nowrap transition-colors ${ativa ? 'bg-ln-ink/[0.07] text-ln-t1 font-medium' : 'text-ln-t3 hover:text-ln-t1 hover:bg-ln-ink/[0.04]'} ${FOCO}`

  const cabecalho = (api) => (
    <header className="min-h-[52px] shrink-0 flex items-center justify-between gap-3 px-4 py-2 border-b border-ln-ink/[0.08]">
      <div className="flex items-center gap-1 min-w-0 overflow-x-auto" role="tablist" aria-label="Listas do cliente">
        <button type="button" role="tab" aria-selected={!listaId} onClick={() => escolherLista(null)} className={pilula(!listaId)}>Todas as listas</button>
        {listas.map((l) => (
          <button key={l.id} type="button" role="tab" aria-selected={listaId === l.id} onClick={() => escolherLista(l.id)} className={pilula(listaId === l.id)}>{l.nome}</button>
        ))}
        <span className="text-xs text-ln-t4 tabular whitespace-nowrap ml-2">{api.totalAbertas} abertas</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {t.carregando && <Loader2 className="w-3.5 h-3.5 animate-spin text-ln-t4" />}
        <button onClick={api.recarregar} className="ln-iconbtn" aria-label="Recarregar" title="Recarregar"><RefreshCw className="w-3.5 h-3.5" /></button>
        <Link to={`/tarefas?${listaId ? `lista=${listaId}` : `pasta=${pasta.id}`}`} className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs text-ln-t3 hover:text-ln-t1 hover:bg-ln-ink/[0.04] ${FOCO}`} title="Abrir esta pasta no VertaTask">
          VertaTask <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
    </header>
  )

  return (
    <div ref={quadroRef} style={{ height: altura ?? undefined }} className="ln vt h-[calc(100vh-200px)] rounded-2xl border border-ln-ink/[0.08] overflow-hidden bg-ln-panel flex">
      {t.loadingEstrutura ? (
        <div className="flex-1 flex items-center justify-center gap-2 text-[13px] text-ln-t4"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>
      ) : !pasta ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-6">
          <FolderX className="w-6 h-6 text-ln-t4" />
          <p className="text-[13px] text-ln-t1 font-medium">Este cliente ainda não tem pasta no VertaTask</p>
          <p className="text-xs text-ln-t4 max-w-sm">A pasta liga as tarefas ao cliente. Crie pela coluna de clientes do VertaTask ou peça a sincronização com o ClickUp.</p>
          <Link to="/tarefas" className="ln-primary mt-1">Abrir o VertaTask</Link>
        </div>
      ) : (
        <AreaTarefas
          t={t} vt={vt} sel={sel} user={user} projects={projects} teamMembers={teamMembers} squads={squads} showToast={showToast}
          cabecalho={cabecalho} onIrParaLista={irParaLista}
        />
      )}
      <Toast toast={toast} />
    </div>
  )
}
