// Harness DEV (só import.meta.env.DEV): construtor de templates do VertaTask com
// dados em memória, para conferir lista, editor e aplicação sem login nem banco.
// "Criar N tarefas" só registra o plano no console (window.__plano).
import { useState } from 'react'
import TemplatesView from '../components/Tarefas/TemplatesView'
import TemplateEditor from '../components/Tarefas/TemplateEditor'
import AplicarTemplateView from '../components/Tarefas/AplicarTemplateView'
import { novoItem, clonarItens, itensDoTemplate } from '../lib/templates'

const P1 = 'p-ana', P2 = 'p-bruno', P3 = 'p-carla', P4 = 'p-davi'
const membros = [
  { id: P1, name: 'Ana Account' }, { id: P2, name: 'Bruno Designer' }, { id: P3, name: 'Carla Tráfego' }, { id: P4, name: 'Davi Dev' },
  { id: 'p-cliente', name: 'Cliente', clickup_user_id: 84048101 },
]
const membrosMap = new Map(membros.map((m) => [m.id, m]))
const squads = [{ id: 'sq1', name: 'Caça ROI', emoji: '🏹', department_assignments: { 'Account Manager': P1, Designer: P2, 'Gestor de tráfego': P3, 'Automação / Integração': P4 } }]
const projetos = [{ id: 'pr1', company_name: 'Reserva Beach Villas', squad: 'sq1' }, { id: 'pr2', company_name: 'Cliente sem squad', squad: null }]
const pastas = [{ id: 'f1', nome: 'Reserva Beach Villas', project_id: 'pr1' }, { id: 'f2', nome: 'Cliente sem squad', project_id: 'pr2' }]
const listas = [{ id: 'l1', pasta_id: 'f1', nome: 'Geral' }, { id: 'l2', pasta_id: 'f1', nome: 'Landing pages' }, { id: 'l3', pasta_id: 'f2', nome: 'Geral' }]

function lp() {
  const briefing = novoItem({ titulo: 'Briefing da LP de {cliente}', departamento: ['Account Manager'], vencimento_dia: 0, estimativa_min: 60, prioridade: 'high' })
  const design = novoItem({ titulo: 'Layout desktop + mobile', departamento: ['Designer'], inicio_dia: 1, vencimento_dia: 3, estimativa_min: 360, tipo_tarefa: 'Criação de Landing Page', depende_de: [briefing.id] })
  const aprovar = novoItem({ titulo: 'Aprovar layout com o cliente', departamento: ['Cliente'], vencimento_dia: 4 })
  const dev = novoItem({ titulo: 'Montar LP e integrar formulário', departamento: ['Tecnologia', 'Designer', 'Gestor de tráfego'], vencimento_dia: 5, estimativa_min: 300 })
  dev.subtarefas = [novoItem({ titulo: 'Apontar o domínio', departamento: ['Tecnologia'], vencimento_dia: 5 }), novoItem({ titulo: 'Conferir traqueamento', departamento: ['Gestor de tráfego'], vencimento_dia: 6 })]
  dev.depende_de = [design.id]
  return [briefing, design, aprovar, dev]
}

export default function DevTemplates() {
  const [modelos, setModelos] = useState(() => [
    { id: 't1', nome: 'Criação de Landing Page', descricao: 'Do briefing à página no ar', itens: lp(), updated_at: new Date().toISOString() },
    { id: 't2', nome: 'Legado (payload)', payload: { titulo: 'Tarefa antiga', departamento: ['Designer'], subtarefas: ['Passo 1', 'Passo 2'] }, itens: [], created_at: new Date().toISOString() },
  ])
  const [abertoId, setAbertoId] = useState(null)
  const [aplicando, setAplicando] = useState(null)
  const aberto = modelos.find((m) => m.id === abertoId)
  const etiquetas = [{ id: 'e1', nome: 'Urgente cliente', cor: '#E2564B' }]

  return (
    <div className="ln vt h-screen flex bg-ln-bg">
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="h-11 shrink-0 flex items-center gap-2 px-4 border-b border-ln-line text-xs text-ln-t3"><strong className="text-ln-t1">DevTemplates</strong> · dados em memória</div>
        <div className="flex-1 min-h-0 overflow-hidden">
          {aplicando ? (
            <AplicarTemplateView
              template={aplicando} listaInicialId="l1" pastas={pastas} listas={listas} projetos={projetos} squads={squads}
              membros={membros} membrosMap={membrosMap}
              onAplicar={async ({ listaId, plano }) => { console.log('aplicar', listaId, plano); window.__plano = plano; setAplicando(null); return {} }}
              onCancelar={() => setAplicando(null)}
            />
          ) : aberto ? (
            <TemplateEditor
              key={aberto.id} template={aberto} membros={membros} membrosMap={membrosMap} etiquetas={etiquetas} onCriarEtiqueta={async () => ({})}
              onSalvar={async (patch) => { setModelos((ms) => ms.map((m) => (m.id === aberto.id ? { ...m, ...patch, updated_at: new Date().toISOString() } : m))); return {} }}
              onVoltar={() => setAbertoId(null)} onAplicar={(tpl) => setAplicando(tpl)}
              onDuplicar={(m) => setModelos((ms) => [...ms, { ...m, id: `t${Date.now()}`, nome: `${m.nome} (cópia)`, itens: clonarItens(itensDoTemplate(m)) }])}
              onExcluir={(m) => { setModelos((ms) => ms.filter((x) => x.id !== m.id)); setAbertoId(null) }}
            />
          ) : (
            <TemplatesView
              modelos={modelos} membrosMap={membrosMap} onAbrir={setAbertoId} onAplicar={setAplicando}
              onNovo={() => { const id = `t${Date.now()}`; setModelos((ms) => [...ms, { id, nome: 'Novo template', itens: [] }]); setAbertoId(id) }}
              onDuplicar={(m) => setModelos((ms) => [...ms, { ...m, id: `t${Date.now()}`, nome: `${m.nome} (cópia)`, itens: clonarItens(itensDoTemplate(m)) }])}
              onExcluir={(m) => setModelos((ms) => ms.filter((x) => x.id !== m.id))}
            />
          )}
        </div>
      </div>
    </div>
  )
}
