// Harness DEV (só import.meta.env.DEV): renderiza a ListaView e o painel da tarefa com a
// fixture gitignored src/dev/fixtures/tarefas.json para conferir o visual sem login.
import { useState, useMemo } from 'react'
import ListaView from '../components/Tarefas/ListaView'
import TarefaPanel from '../components/Tarefas/TarefaPanel'
import NovaTarefaPanel from '../components/Tarefas/NovaTarefaPanel'
import BarraSelecao from '../components/Tarefas/BarraSelecao'
import { useConfirmar } from '../components/Tarefas/Confirmacao'
import { MenuContextoTarefa } from '../components/Tarefas/TarefaExtras'
import { AlcaPainel, PAINEL_LARGURA } from '../components/Tarefas/AreaTarefas'
import { agruparItens, filtrarItens, statusDasListas, AGRUPAMENTOS } from '../lib/tarefas'
// Fixture gitignored: via glob para o build da Vercel (clone limpo, sem a pasta) não quebrar.
const fixtures = import.meta.glob('../dev/fixtures/tarefas.json', { eager: true, import: 'default' })
const fixture = fixtures['../dev/fixtures/tarefas.json'] || { pastas: [], listas: [], itens: [], perfis: [], projetos: [] }

// Dados fixos, montados uma vez (como no app, os objetos das tarefas não mudam a cada render;
// senão as linhas memorizadas da ListaView redesenhariam sempre). `?x=N` multiplica as
// tarefas N vezes, para medir a lista com o volume de "Todas" (~900 de topo).
const listas = fixture.listas
const pastaRL = fixture.pastas.find((p) => /revenue lab/i.test(p.nome)) || fixture.pastas[0] || { id: null, nome: '(sem fixture)' }
const listasEscopo = listas.filter((l) => l.pasta_id === pastaRL.id)
const idsEscopo = new Set(listasEscopo.map((l) => l.id))
const base = fixture.itens.filter((i) => idsEscopo.has(i.lista_id) && !i.arquivada)
const fator = Math.max(1, Number(new URLSearchParams(window.location.search).get('x')) || 1)
const itens = Array.from({ length: fator }, (_, k) => (k ? base.map((i) => ({ ...i, id: `${i.id}~${k}`, parent_id: i.parent_id ? `${i.parent_id}~${k}` : null, titulo: `${i.titulo} #${k}` })) : base)).flat()
// um neto fictício (subtarefa de subtarefa) para a Hierarquia do painel ter dois níveis de pais
const subEx = itens.find((i) => i.parent_id)
if (subEx) itens.push({ ...subEx, id: 'dev-neto', parent_id: subEx.id, titulo: 'Neto de exemplo (DEV)', posicao: 0, clickup_task_id: null, clickup_url: null })
const topo = itens.filter((i) => !i.parent_id)
const filhosDe = new Map(); for (const i of itens) if (i.parent_id) { if (!filhosDe.has(i.parent_id)) filhosDe.set(i.parent_id, []); filhosDe.get(i.parent_id).push(i) }
const membros = fixture.perfis.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar }))
const membrosMap = new Map(membros.map((m) => [m.id, m]))
const statuses = statusDasListas(listasEscopo)
const itensMap = Object.fromEntries(itens.map((i) => [i.id, i]))
const projetos = fixture.projetos.map((p) => ({ id: p.id, company_name: p.company_name }))
const ciclos = [{ id: 'c1', nome: 'Sprint 42' }]

export default function DevLista() {
  const [agrupar, setAgrupar] = useState('vencimento')
  const [compacto, setCompacto] = useState(false)
  const [abertaId, setAbertaId] = useState(null)
  const [nova, setNova] = useState(false)
  const [colunas, setColunas] = useState(null)
  const [larguraNome, setLarguraNome] = useState(null)
  const [larguraPainel, setLarguraPainel] = useState(PAINEL_LARGURA)
  const [selecionadas, setSelecionadas] = useState(() => new Set())
  const [confirmar, dialogoConfirmar] = useConfirmar()
  const [menu, setMenu] = useState(null)
  const [renomeandoId, setRenomeandoId] = useState(null)
  const log = (acao) => (it) => console.log(acao, it.id)
  const acoesDev = {
    copiarLink: log('copiarLink'), abrirClickup: log('abrirClickup'), duplicar: log('duplicar'),
    salvarTemplate: log('salvarTemplate'), historico: log('historico'),
    renomear: (it) => setRenomeandoId(it.id),
    arquivar: async (it) => { if (await confirmar({ titulo: 'Arquivar esta tarefa?', texto: 'Saem das listas do VertaTask e ficam arquivadas no ClickUp. Nada é apagado.', rotuloItens: 'Tarefa a ser arquivada', itens: [it.titulo], acao: 'Arquivar' })) console.log('arquivar', it.id) },
    excluir: async (it) => { if (await confirmar({ perigo: true, titulo: 'Excluir esta tarefa?', texto: 'A exclusão também acontece no ClickUp e não pode ser desfeita.', rotuloItens: 'Tarefa a ser excluída', itens: [it.titulo], acao: 'Excluir' })) console.log('excluir', it.id) },
  }
  const selecao = useMemo(() => ({
    ids: selecionadas,
    alternar: (id) => setSelecionadas((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n }),
    definir: (ids, marcar) => setSelecionadas((p) => { const n = new Set(p); for (const id of ids) { if (marcar) n.add(id); else n.delete(id) } return n }),
  }), [selecionadas])
  const visiveis = filtrarItens(topo, { mostrarConcluidas: false })
  const grupos = agruparItens(visiveis, agrupar, { statuses, membrosMap, listasMap: new Map(listas.map((l) => [l.id, l])) })
  const aberta = abertaId ? itensMap[abertaId] : null
  const ancestrais = []
  for (let p = aberta?.parent_id; p && itensMap[p]; p = itensMap[p].parent_id) ancestrais.unshift(itensMap[p])
  const ctx = {
    statuses, membros, membrosMap, itensMap, listaPadraoId: listasEscopo[0]?.id, agrupar,
    contagemComentarios: {}, selecionadaId: abertaId, onAbrir: setAbertaId, onAtualizar: (id, patch) => console.log('atualizar', id, patch),
    onMudarStatus: (it, s) => console.log('status', it.id, s.key), onCriar: async (row) => { console.log('criar', row); return {} },
    listas, pastas: fixture.pastas, projetos, ciclos, selecao,
    larguraNome, onLarguraNome: (w) => { console.log('larguraNome', w); setLarguraNome(w) },
    colunas, onColunas: (c) => { console.log('colunas', c); setColunas(c) },
    onMenuTarefa: (item, x, y) => setMenu({ item, x, y }), renomeandoId, onFimRenomear: () => setRenomeandoId(null),
  }
  return (
    <div className="ln vt h-screen bg-ln-bg">
      {dialogoConfirmar}
      {menu && <MenuContextoTarefa key={`${menu.x}:${menu.y}`} menu={menu} user={{ id: membros[0]?.id }} acoes={acoesDev} onFechar={() => setMenu(null)} />}
      <div className="flex items-center gap-3 h-11 px-4 border-b border-ln-line text-xs text-ln-t3">
        <strong className="text-ln-t1">DevLista</strong> · {pastaRL.nome} · {visiveis.length} abertas · <span data-dev-selecionadas>{selecionadas.size}</span> selecionadas
        <select value={agrupar} onChange={(e) => setAgrupar(e.target.value)} className="ln-pill">{AGRUPAMENTOS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</select>
        <label className="flex items-center gap-1"><input type="checkbox" checked={compacto} onChange={(e) => setCompacto(e.target.checked)} /> compacto</label>
        <button type="button" onClick={() => { setAbertaId(null); setNova(true) }} className="ln-primary">+ Tarefa</button>
      </div>
      <div className="flex h-[calc(100vh-44px)]">
        <div className="relative flex-1 min-w-0 flex">
          <div className="flex-1 min-w-0 overflow-auto" data-dev-rolagem>
            <ListaView grupos={grupos} filhosDe={filhosDe} ctx={ctx} mostrarConcluidas={false} compacto={compacto} />
          </div>
          <BarraSelecao
            n={selecionadas.size} onLimpar={() => setSelecionadas(new Set())}
            onDuplicar={() => console.log('duplicar', [...selecionadas])}
            onArquivar={async () => { if (await confirmar({ titulo: `Arquivar ${selecionadas.size} tarefas?`, texto: 'Saem das listas do VertaTask e ficam arquivadas no ClickUp. Nada é apagado.', rotuloItens: 'Tarefas a serem arquivadas', itens: [...selecionadas].map((id) => itensMap[id]?.titulo), acao: 'Arquivar' })) console.log('arquivar', [...selecionadas]) }}
            onExcluir={async () => { if (await confirmar({ perigo: true, titulo: `Excluir ${selecionadas.size} tarefas?`, texto: 'A exclusão também acontece no ClickUp e não pode ser desfeita.', rotuloItens: 'Tarefas a serem excluídas', itens: [...selecionadas].map((id) => itensMap[id]?.titulo), acao: 'Excluir' })) console.log('excluir', [...selecionadas]) }}
          />
        </div>
        {nova && !aberta && (
          <aside className="relative shrink-0 border-l border-ln-line bg-ln-panel flex flex-col" style={{ width: larguraPainel }} aria-label="Nova tarefa">
            <NovaTarefaPanel
              grupos={fixture.pastas.map((p) => ({ pasta: p, listas: listas.filter((l) => l.pasta_id === p.id) })).filter((g) => g.listas.length)} listasMap={new Map(listas.map((l) => [l.id, l]))} inicial={{ lista_id: null, responsaveis: [] }}
              membros={membros} membrosMap={membrosMap} onCancelar={() => setNova(false)}
              onCriar={async (p) => { console.log('criar', JSON.stringify(p)); setNova(false); return { data: {} } }}
            />
          </aside>
        )}
        {aberta && (
          <aside className="relative shrink-0 border-l border-ln-line bg-ln-panel overflow-y-auto" style={{ width: larguraPainel }} aria-label="Detalhe da tarefa">
            <AlcaPainel largura={larguraPainel} onLargura={setLarguraPainel} />
            <TarefaPanel
              key={aberta.id} item={aberta} subtarefas={filhosDe.get(aberta.id) || []} ancestrais={ancestrais}
              irmas={aberta.parent_id ? filhosDe.get(aberta.parent_id) : null} statuses={statuses} membros={membros} membrosMap={membrosMap}
              comentarios={[]} user={{ id: membros[0]?.id }} onAtualizar={ctx.onAtualizar} onMudarStatus={ctx.onMudarStatus}
              onCriarSub={(pai, t) => console.log('criar sub', pai.id, t)} onAbrir={setAbertaId} onComentar={() => {}} onExcluirComentario={() => {}}
              onCarregarComentarios={() => {}} onErro={(m) => console.log('erro', m)}
            />
          </aside>
        )}
      </div>
    </div>
  )
}
