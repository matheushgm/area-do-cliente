// Seção Templates do VertaTask: os templates na mesma lista das tarefas de um cliente
// (ListaView), um por linha, com busca e "Novo template". Clicar abre o construtor
// (TemplateEditor); o Aplicar da linha abre a tela de aplicação (AplicarTemplateView).
import { useMemo, useState } from 'react'
import { Plus, Search, Play, Copy, Trash2 } from 'lucide-react'
import { itensDoTemplate, resumoDoTemplate } from '../../lib/templates'
import { fmtEstimativa, fmtDataNumerica, STATUSES_PADRAO } from '../../lib/tarefas'
import ListaView from './ListaView'

const COLUNAS = [
  { k: 'acoes', label: '', w: 160 },
  { k: 'ntar', label: 'Tarefas', w: 90 },
  { k: 'horas', label: 'Estimativa', w: 100 },
  { k: 'deptos', label: 'Departamentos', w: 300 },
  { k: 'editado', label: 'Editado em', w: 110 },
]

export default function TemplatesView({ modelos, membrosMap, onNovo, onAbrir, onAplicar, onDuplicar, onExcluir }) {
  const [busca, setBusca] = useState('')
  const linhas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return modelos
      .filter((m) => !q || `${m.nome} ${m.descricao || ''}`.toLowerCase().includes(q))
      .map((m, i) => ({
        id: m.id, titulo: m.nome, descricao: m.descricao, posicao: i, lista_id: 'templates', status: 'a fazer', status_tipo: 'open',
        checklists: [], responsaveis: [], _modelo: m, _resumo: resumoDoTemplate(itensDoTemplate(m)),
      }))
  }, [modelos, busca])

  const ctx = {
    statuses: STATUSES_PADRAO, membros: [], membrosMap, itensMap: {}, listaPadraoId: null, agrupar: 'nenhum',
    contagemComentarios: {}, selecionadaId: null, semStatus: true, acoesHover: false,
    onAbrir, onAtualizar: () => {}, onMudarStatus: () => {}, onCriar: () => Promise.resolve({}),
    renderCelula: (k, r) => {
      const res = r._resumo
      switch (k) {
        case 'ntar': return <span className="text-[13px] text-ln-t2 tabular">{res.total}</span>
        case 'horas': return <span className={`text-[13px] tabular ${res.estimativaMin ? 'text-ln-t2' : 'text-ln-t4 pl-1'}`}>{res.estimativaMin ? fmtEstimativa(res.estimativaMin) : '–'}</span>
        case 'deptos': return res.departamentos.length
          ? <span className="flex gap-1 min-w-0 overflow-hidden" title={res.departamentos.join(', ')}>{res.departamentos.map((d) => <span key={d} className="inline-flex items-center h-[22px] px-2 rounded-md text-xs text-ln-t2 bg-ln-level2 whitespace-nowrap">{d}</span>)}</span>
          : <span className="text-[13px] text-ln-t4 pl-1">–</span>
        case 'editado': return <span className="text-[13px] text-ln-t3 tabular">{fmtDataNumerica(r._modelo.updated_at || r._modelo.created_at)}</span>
        case 'acoes': return (
          <span className="flex items-center gap-1">
            <button type="button" onClick={() => onAplicar(r._modelo)} disabled={!res.total} className="ln-pill !h-6 disabled:opacity-50" title={res.total ? 'Criar estas tarefas na lista de um cliente' : 'O template está vazio'}><Play className="w-3 h-3" /> Aplicar</button>
            <button type="button" onClick={() => onDuplicar(r._modelo)} className="ln-iconbtn !w-6 !h-6 opacity-0 group-hover/linha:opacity-100 focus-visible:opacity-100" aria-label={`Duplicar ${r.titulo}`} title="Duplicar"><Copy className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={() => onExcluir(r._modelo)} className="ln-iconbtn !w-6 !h-6 opacity-0 group-hover/linha:opacity-100 focus-visible:opacity-100 hover:!text-ln-red" aria-label={`Apagar ${r.titulo}`} title="Apagar"><Trash2 className="w-3.5 h-3.5" /></button>
          </span>
        )
        default: return undefined
      }
    },
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="h-11 shrink-0 flex items-center gap-2 px-3 border-b border-ln-ink/5 bg-ln-panel">
        <div className="ln-input !h-7 !w-[220px] flex items-center gap-1.5">
          <Search className="w-3.5 h-3.5 text-ln-t4 shrink-0" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar template" aria-label="Buscar template" className="flex-1 min-w-0 bg-transparent outline-none text-xs text-ln-t1 placeholder:text-ln-t4" />
        </div>
        <span className="text-xs text-ln-t4 tabular">{modelos.length} template{modelos.length === 1 ? '' : 's'}</span>
        <button type="button" onClick={onNovo} className="ln-primary ml-auto"><Plus className="w-3.5 h-3.5" /> Novo template</button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto bg-ln-panel">
        <ListaView
          grupos={linhas.length ? [{ key: 'templates', label: 'Templates', cor: '#2A25F0', itens: linhas }] : []}
          filhosDe={new Map()} ctx={ctx} mostrarConcluidas colunas={COLUNAS}
          vazio={(
            <div className="py-16 text-center px-6">
              <p className="text-[13px] text-ln-t2 font-semibold">{modelos.length ? 'Nenhum template com esse nome' : 'Nenhum template ainda'}</p>
              {!modelos.length && (
                <p className="mt-1 text-[13px] text-ln-t4 max-w-md mx-auto">
                  Monte a receita de uma entrega (por exemplo, criar uma landing page) com as tarefas, os prazos e quem faz cada uma, e aplique na lista de qualquer cliente.
                  Também dá para abrir uma tarefa pronta e usar <b>Salvar como template</b>.
                </p>
              )}
              {!modelos.length && <button type="button" onClick={onNovo} className="ln-primary mt-4"><Plus className="w-3.5 h-3.5" /> Criar o primeiro</button>}
            </div>
          )}
        />
      </div>
    </div>
  )
}
