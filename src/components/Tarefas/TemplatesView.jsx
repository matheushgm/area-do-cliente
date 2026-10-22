// Seção Templates do VertaTask: a lista dos templates (busca, novo, editar,
// duplicar, apagar, aplicar). O editor fica em TemplateEditor e a aplicação na
// lista de um cliente em AplicarTemplatePanel.
import { useMemo, useState } from 'react'
import { Plus, Search, LayoutTemplate, Copy, Trash2, Play, Clock3, ListTree } from 'lucide-react'
import { itensDoTemplate, resumoDoTemplate } from '../../lib/templates'
import { fmtEstimativa, fmtDataHora } from '../../lib/tarefas'
import { FOCO } from './Campos'

export default function TemplatesView({ modelos, membrosMap, onNovo, onAbrir, onAplicar, onDuplicar, onExcluir }) {
  const [busca, setBusca] = useState('')
  const linhas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return modelos
      .map((m) => ({ m, resumo: resumoDoTemplate(itensDoTemplate(m)) }))
      .filter(({ m }) => !q || `${m.nome} ${m.descricao || ''}`.toLowerCase().includes(q))
  }, [modelos, busca])

  return (
    <div className="p-4 sm:p-6 max-w-[1200px]">
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <div className="ln-input !h-9 !w-[280px] flex items-center gap-1.5">
          <Search className="w-3.5 h-3.5 text-ln-t4 shrink-0" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar template" aria-label="Buscar template" className="flex-1 min-w-0 bg-transparent outline-none text-[13px] text-ln-t1 placeholder:text-ln-t4" />
        </div>
        <span className="text-xs text-ln-t4 tabular">{modelos.length} template{modelos.length === 1 ? '' : 's'}</span>
        <button type="button" onClick={onNovo} className="ln-primary ml-auto"><Plus className="w-3.5 h-3.5" /> Novo template</button>
      </div>

      {modelos.length === 0 ? (
        <div className="ln-card p-10 text-center">
          <LayoutTemplate className="w-8 h-8 mx-auto text-ln-t4 opacity-60" />
          <p className="mt-3 text-sm font-semibold text-ln-t1">Nenhum template ainda</p>
          <p className="mt-1 text-[13px] text-ln-t3 max-w-md mx-auto">
            Monte a receita de uma entrega (por exemplo, criar uma landing page) com as tarefas, os prazos e quem faz cada uma, e aplique na lista de qualquer cliente.
            Também dá para abrir uma tarefa pronta e usar <b>Salvar como template</b>.
          </p>
          <button type="button" onClick={onNovo} className="ln-primary mt-4"><Plus className="w-3.5 h-3.5" /> Criar o primeiro</button>
        </div>
      ) : linhas.length === 0 ? (
        <p className="text-[13px] text-ln-t4 py-10">Nenhum template com esse nome.</p>
      ) : (
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {linhas.map(({ m, resumo }) => (
            <article key={m.id} className="ln-card p-4 flex flex-col gap-3 min-w-0">
              <button type="button" onClick={() => onAbrir(m.id)} className={`text-left min-w-0 rounded ${FOCO}`}>
                <h3 className="text-[15px] font-bold text-ln-t1 truncate vt-display">{m.nome}</h3>
                <p className={`text-xs mt-1 line-clamp-2 ${m.descricao ? 'text-ln-t3' : 'text-ln-t4'}`}>{m.descricao || 'Sem descrição'}</p>
              </button>
              <div className="flex items-center gap-3 text-xs text-ln-t3 tabular">
                <span className="inline-flex items-center gap-1"><ListTree className="w-3.5 h-3.5 text-ln-t4" />{resumo.total} tarefa{resumo.total === 1 ? '' : 's'}</span>
                {resumo.estimativaMin > 0 && <span className="inline-flex items-center gap-1"><Clock3 className="w-3.5 h-3.5 text-ln-t4" />{fmtEstimativa(resumo.estimativaMin)}</span>}
              </div>
              {resumo.departamentos.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {resumo.departamentos.map((d) => <span key={d} className="ln-pill !h-6 !text-[11px] !cursor-default">{d}</span>)}
                </div>
              )}
              <div className="flex items-center gap-1 mt-auto pt-1 border-t border-ln-ink/5">
                <span className="text-[11px] text-ln-t4 truncate mr-auto" title={m.dono_id && membrosMap.get(m.dono_id)?.name ? `Criado por ${membrosMap.get(m.dono_id).name}` : undefined}>
                  Editado {fmtDataHora(m.updated_at || m.created_at)}
                </span>
                <button type="button" onClick={() => onDuplicar(m)} className="ln-iconbtn" aria-label={`Duplicar ${m.nome}`} title="Duplicar"><Copy className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => onExcluir(m)} className="ln-iconbtn hover:!text-ln-red" aria-label={`Apagar ${m.nome}`} title="Apagar"><Trash2 className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => onAbrir(m.id)} className="ln-pill">Editar</button>
                <button type="button" onClick={() => onAplicar(m)} disabled={!resumo.total} className="ln-primary disabled:opacity-50" title={resumo.total ? 'Criar estas tarefas na lista de um cliente' : 'O template está vazio'}><Play className="w-3 h-3" /> Aplicar</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
