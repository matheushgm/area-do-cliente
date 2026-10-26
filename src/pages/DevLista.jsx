// Harness DEV (só import.meta.env.DEV): renderiza a ListaView com a fixture
// gitignored src/dev/fixtures/tarefas.json para conferir o visual sem login.
import { useState } from 'react'
import ListaView from '../components/Tarefas/ListaView'
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
  const listas = fixture.listas
  const pastaRL = fixture.pastas.find((p) => /revenue lab/i.test(p.nome)) || fixture.pastas[0] || { id: null, nome: '(sem fixture)' }
  const listasEscopo = listas.filter((l) => l.pasta_id === pastaRL.id)
  const ids = new Set(listasEscopo.map((l) => l.id))
  const itens = fixture.itens.filter((i) => ids.has(i.lista_id) && !i.arquivada)
  const topo = itens.filter((i) => !i.parent_id)
  const filhosDe = new Map(); for (const i of itens) if (i.parent_id) { if (!filhosDe.has(i.parent_id)) filhosDe.set(i.parent_id, []); filhosDe.get(i.parent_id).push(i) }
  const membros = fixture.perfis.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar }))
  const membrosMap = new Map(membros.map((m) => [m.id, m]))
  const statuses = statusDasListas(listasEscopo)
  const visiveis = filtrarItens(topo, { mostrarConcluidas: false })
  const grupos = agruparItens(visiveis, agrupar, { statuses, membrosMap, listasMap: new Map(listas.map((l) => [l.id, l])) })
  const ctx = {
    statuses, membros, membrosMap, itensMap: Object.fromEntries(itens.map((i) => [i.id, i])), listaPadraoId: listasEscopo[0]?.id, agrupar,
    contagemComentarios: {}, selecionadaId: abertaId, onAbrir: setAbertaId, onAtualizar: (id, patch) => console.log('atualizar', id, patch),
    onMudarStatus: (it, s) => console.log('status', it.id, s.key), onCriar: async (row) => { console.log('criar', row); return {} },
    listas, pastas: fixture.pastas, projetos: fixture.projetos.map((p) => ({ id: p.id, company_name: p.company_name })),
    ciclos: [{ id: 'c1', nome: 'Sprint 42' }],
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
      <div className="overflow-auto">
        <ListaView grupos={grupos} filhosDe={filhosDe} ctx={ctx} mostrarConcluidas={false} denso={denso} compacto={compacto} />
      </div>
    </div>
  )
}
