// Harness DEV (só import.meta.env.DEV): renderiza a ListaView e o painel da tarefa com a
// fixture gitignored src/dev/fixtures/tarefas.json para conferir o visual sem login.
import { useState } from 'react'
import ListaView from '../components/Tarefas/ListaView'
import TarefaPanel from '../components/Tarefas/TarefaPanel'
import { AlcaPainel, PAINEL_LARGURA } from '../components/Tarefas/AreaTarefas'
import { agruparItens, filtrarItens, statusDasListas, AGRUPAMENTOS } from '../lib/tarefas'
// Fixture gitignored: via glob para o build da Vercel (clone limpo, sem a pasta) não quebrar.
const fixtures = import.meta.glob('../dev/fixtures/tarefas.json', { eager: true, import: 'default' })
const fixture = fixtures['../dev/fixtures/tarefas.json'] || { pastas: [], listas: [], itens: [], perfis: [], projetos: [] }

export default function DevLista() {
  const [agrupar, setAgrupar] = useState('vencimento')
  const [compacto, setCompacto] = useState(false)
  const [denso, setDenso] = useState(false)
  const [abertaId, setAbertaId] = useState(null)
  const [colunas, setColunas] = useState(null)
  const [larguraNome, setLarguraNome] = useState(null)
  const [larguraPainel, setLarguraPainel] = useState(PAINEL_LARGURA)
  const listas = fixture.listas
  const pastaRL = fixture.pastas.find((p) => /revenue lab/i.test(p.nome)) || fixture.pastas[0] || { id: null, nome: '(sem fixture)' }
  const listasEscopo = listas.filter((l) => l.pasta_id === pastaRL.id)
  const ids = new Set(listasEscopo.map((l) => l.id))
  const itens = fixture.itens.filter((i) => ids.has(i.lista_id) && !i.arquivada)
  // um neto fictício (subtarefa de subtarefa) para a Hierarquia do painel ter dois níveis de pais
  const sub = itens.find((i) => i.parent_id)
  if (sub) itens.push({ ...sub, id: 'dev-neto', parent_id: sub.id, titulo: 'Neto de exemplo (DEV)', posicao: 0, clickup_task_id: null, clickup_url: null })
  const topo = itens.filter((i) => !i.parent_id)
  const filhosDe = new Map(); for (const i of itens) if (i.parent_id) { if (!filhosDe.has(i.parent_id)) filhosDe.set(i.parent_id, []); filhosDe.get(i.parent_id).push(i) }
  const membros = fixture.perfis.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar }))
  const membrosMap = new Map(membros.map((m) => [m.id, m]))
  const statuses = statusDasListas(listasEscopo)
  const visiveis = filtrarItens(topo, { mostrarConcluidas: false })
  const grupos = agruparItens(visiveis, agrupar, { statuses, membrosMap, listasMap: new Map(listas.map((l) => [l.id, l])) })
  const itensMap = Object.fromEntries(itens.map((i) => [i.id, i]))
  const aberta = abertaId ? itensMap[abertaId] : null
  const ancestrais = []
  for (let p = aberta?.parent_id; p && itensMap[p]; p = itensMap[p].parent_id) ancestrais.unshift(itensMap[p])
  const ctx = {
    statuses, membros, membrosMap, itensMap: Object.fromEntries(itens.map((i) => [i.id, i])), listaPadraoId: listasEscopo[0]?.id, agrupar,
    contagemComentarios: {}, selecionadaId: abertaId, onAbrir: setAbertaId, onAtualizar: (id, patch) => console.log('atualizar', id, patch),
    onMudarStatus: (it, s) => console.log('status', it.id, s.key), onCriar: async (row) => { console.log('criar', row); return {} },
    listas, pastas: fixture.pastas, projetos: fixture.projetos.map((p) => ({ id: p.id, company_name: p.company_name })),
    ciclos: [{ id: 'c1', nome: 'Sprint 42' }],
    larguraNome, onLarguraNome: (w) => { console.log('larguraNome', w); setLarguraNome(w) },
    colunas, onColunas: (c) => { console.log('colunas', c); setColunas(c) },
  }
  return (
    <div className="ln vt min-h-screen bg-ln-bg">
      <div className="flex items-center gap-3 h-11 px-4 border-b border-ln-line text-xs text-ln-t3">
        <strong className="text-ln-t1">DevLista</strong> · {pastaRL.nome} · {visiveis.length} abertas
        <select value={agrupar} onChange={(e) => setAgrupar(e.target.value)} className="ln-pill">{AGRUPAMENTOS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</select>
        <label className="flex items-center gap-1"><input type="checkbox" checked={compacto} onChange={(e) => setCompacto(e.target.checked)} /> compacto</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={denso} onChange={(e) => setDenso(e.target.checked)} /> denso</label>
      </div>
      <div className="flex">
        <div className="flex-1 min-w-0 overflow-auto">
          <ListaView grupos={grupos} filhosDe={filhosDe} ctx={ctx} mostrarConcluidas={false} denso={denso} compacto={compacto} />
        </div>
        {aberta && (
          <aside className="relative shrink-0 border-l border-ln-line bg-ln-panel" style={{ width: larguraPainel }} aria-label="Detalhe da tarefa">
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
