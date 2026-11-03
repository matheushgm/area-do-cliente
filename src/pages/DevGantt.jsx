// Harness DEV (só import.meta.env.DEV): o GanttView de verdade com tarefas de uma fixture gitignored,
// em memória, sem login e sem tocar no banco nem no ClickUp. Mexer numa data passa pelo mesmo
// useCascata do VertaTask (pergunta antes de mover as seguintes); o painel é o TarefaPanel.
// `?fixture=boavida` lê src/dev/fixtures/tarefas-boavida.json (pasta de um cliente, com as relações
// reais de `tarefas_relacoes`); sem o parâmetro, a tarefas.json de sempre. `?x=N` multiplica as
// tarefas N vezes, para medir com o volume de "Todas".
import { useCallback, useMemo, useState } from 'react'
import GanttView from '../components/Tarefas/GanttView'
import TarefaPanel from '../components/Tarefas/TarefaPanel'
import EntregaPainel from '../components/Tarefas/EntregaPainel'
import { AlcaPainel, PAINEL_LARGURA } from '../components/Tarefas/AreaTarefas'
import { useConfirmar } from '../components/Tarefas/Confirmacao'
import Toast from '../components/UI/Toast'
import { useToast } from '../hooks/useToast'
import { useCascata } from '../hooks/useCascata'
import { statusDaLista, statusDasListas } from '../lib/tarefas'

const fixtures = import.meta.glob('../dev/fixtures/tarefas*.json', { eager: true, import: 'default' })
const params = new URLSearchParams(window.location.search)
const nomeFixture = params.get('fixture')
const fixture = fixtures[`../dev/fixtures/tarefas${nomeFixture ? `-${nomeFixture}` : ''}.json`] || { pastas: [], listas: [], itens: [], perfis: [], projetos: [], relacoes: [] }
const fator = Math.max(1, Number(params.get('x')) || 1)
const sufixo = (id, k) => (k ? `${id}~${k}` : id)
const base = fixture.itens.filter((i) => !i.arquivada)
const ITENS = Array.from({ length: fator }, (_, k) => base.map((i) => ({ ...i, id: sufixo(i.id, k), parent_id: i.parent_id ? sufixo(i.parent_id, k) : null, titulo: k ? `${i.titulo} #${k}` : i.titulo }))).flat()
const RELACOES = Array.from({ length: fator }, (_, k) => (fixture.relacoes || []).map((r) => ({ tarefa_id: sufixo(r.tarefa_id, k), relacionada_id: sufixo(r.relacionada_id, k), tipo: r.tipo }))).flat()
const STATUSES = statusDasListas(fixture.listas)
const LISTAS = new Map(fixture.listas.map((l) => [l.id, l]))
const MEMBROS = (fixture.perfis || []).map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, foto_url: p.foto_url }))
const MEMBROS_MAP = new Map(MEMBROS.map((m) => [m.id, m]))

export default function DevGantt() {
  const [itens, setItens] = useState(() => Object.fromEntries(ITENS.map((i) => [i.id, i])))
  const [relacoes, setRelacoes] = useState(RELACOES)
  const [concluidas, setConcluidas] = useState(false)
  const [ordenar, setOrdenar] = useState(null) // o `ordenar` da view (rascunho no app)
  const [colunasGantt, setColunasGantt] = useState(null) // o `colunasGantt` da view
  const [abertaId, setAbertaId] = useState(null)
  const [larguraPainel, setLarguraPainel] = useState(PAINEL_LARGURA)
  const [confirmar, dialogo] = useConfirmar()
  const { toast, showToast } = useToast()

  const gravar = useCallback(async (id, patch) => {
    console.log('[gantt] gravar', id, patch)
    setItens((m) => ({ ...m, [id]: { ...m[id], ...patch } }))
    return {}
  }, [])
  const carregarGrafo = useCallback(async () => ({ itens: new Map(Object.entries(itens)), relacoes }), [itens, relacoes])
  const atualizar = useCascata({ carregarGrafo, gravar, confirmar, avisar: showToast })
  const mudarStatus = (it, s) => gravar(it.id, { status: s.key, status_tipo: s.tipo || 'custom', data_conclusao: s.tipo === 'closed' ? new Date().toISOString() : null })

  const lista = useMemo(() => Object.values(itens), [itens])
  const filhosDe = useMemo(() => {
    const m = new Map()
    for (const i of lista) if (i.parent_id) { if (!m.has(i.parent_id)) m.set(i.parent_id, []); m.get(i.parent_id).push(i) }
    return m
  }, [lista])
  const topo = lista.filter((i) => (!i.parent_id || !itens[i.parent_id]) && (concluidas || i.status_tipo !== 'closed'))
  const ctx = {
    statuses: STATUSES, statusesDe: (it) => (LISTAS.get(it.lista_id) ? statusDaLista(LISTAS.get(it.lista_id)) : STATUSES),
    membros: MEMBROS, membrosMap: MEMBROS_MAP, itensMap: itens, onAbrir: setAbertaId, onAtualizar: atualizar, onMudarStatus: mudarStatus,
    ordenar, onOrdenar: (o) => { console.log('[gantt] ordenar', o); setOrdenar(o) },
    colunasGantt, onColunasGantt: (c) => { console.log('[gantt] colunas', c); setColunasGantt(c) },
    listas: fixture.listas, pastas: fixture.pastas, projetos: fixture.projetos || [],
  }
  const aberta = abertaId ? itens[abertaId] : null
  const ancestrais = []
  for (let p = aberta?.parent_id; p && itens[p]; p = itens[p].parent_id) ancestrais.unshift(itens[p])

  return (
    <div className="ln vt h-screen flex flex-col bg-ln-bg text-ln-t1">
      {dialogo}
      <Toast toast={toast} />
      <header className="flex items-center gap-3 px-4 h-11 border-b border-ln-border shrink-0 text-xs text-ln-t3">
        <strong className="text-ln-t1">DevGantt</strong>
        <span>{fixture.pastas.map((p) => p.nome).join(' + ') || '(sem fixture)'} · {relacoes.length} relações{fator > 1 ? ` · x${fator}` : ''} · em memória</span>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={concluidas} onChange={(e) => setConcluidas(e.target.checked)} /> Concluídas</label>
      </header>
      <div className="relative flex-1 min-h-0">
        <GanttView
          itens={topo} filhosDe={filhosDe} ctx={ctx} mostrarConcluidas={concluidas} altura="100%" relacoes={relacoes} avisar={showToast}
          onCriarRelacao={async (de, para) => { setRelacoes((r) => [...r, { tarefa_id: de, relacionada_id: para, tipo: 'bloqueia' }]); return {} }}
          onApagarRelacao={async (de, para) => { setRelacoes((r) => r.filter((x) => !(x.tarefa_id === de && x.relacionada_id === para))); return {} }}
        />
        {aberta && (
          <aside className="absolute top-0 right-0 bottom-0 z-40 border-l border-ln-border bg-ln-panel overflow-y-auto shadow-xl" style={{ width: larguraPainel }} aria-label="Detalhe da tarefa">
            <AlcaPainel largura={larguraPainel} onLargura={setLarguraPainel} />
            <TarefaPanel
              key={aberta.id} item={aberta} subtarefas={filhosDe.get(aberta.id) || []} ancestrais={ancestrais}
              irmas={aberta.parent_id ? filhosDe.get(aberta.parent_id) : null} statuses={ctx.statusesDe(aberta)} membros={MEMBROS} membrosMap={MEMBROS_MAP}
              comentarios={[]} user={{ id: MEMBROS[0]?.id }} onAtualizar={atualizar} onMudarStatus={mudarStatus}
              onCriarSub={() => {}} onAbrir={setAbertaId} onComentar={() => {}} onExcluirComentario={() => {}}
              onCarregarComentarios={() => {}} onErro={(m) => showToast(m, 'error')} onFechar={() => setAbertaId(null)}
              entrega={<EntregaPainel item={aberta} carregarGrafo={carregarGrafo} gravar={gravar} confirmar={confirmar} avisar={showToast} />}
            />
          </aside>
        )}
      </div>
    </div>
  )
}
