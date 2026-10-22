// Botão "Templates" do cabeçalho de Tarefas: aplica um template na lista aberta
// (abre o painel de aplicação) ou leva ao construtor de templates.
import { useRef, useState } from 'react'
import { LayoutTemplate, Settings2 } from 'lucide-react'
import { Popover, FOCO } from './Campos'
import { itensDoTemplate, resumoDoTemplate } from '../../lib/templates'

export default function ModelosMenu({ modelos, onUsar, onGerenciar }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  return (
    <>
      <button ref={ref} type="button" onClick={() => setOpen((v) => !v)} className={`ln-pill ${FOCO}`} title="Criar tarefas a partir de um template">
        <LayoutTemplate className="w-3.5 h-3.5" /> Templates
      </button>
      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={300} align="right">
        <div className="p-1 max-h-[300px] overflow-y-auto">
          {modelos.length === 0 && <p className="px-2.5 py-3 text-xs text-ln-t4">Nenhum template ainda. Crie no construtor ou abra uma tarefa e use Salvar como template.</p>}
          {modelos.map((m) => {
            const n = resumoDoTemplate(itensDoTemplate(m)).total
            return (
              <button key={m.id} type="button" disabled={!n} onClick={() => { setOpen(false); onUsar(m) }} className="w-full flex items-center gap-2 h-8 px-2.5 rounded-md text-left text-[13px] text-ln-t2 hover:bg-ln-ink/5 disabled:opacity-50">
                <span className="truncate flex-1">{m.nome}</span>
                <span className="text-[11px] text-ln-t4 tabular shrink-0">{n} tarefa{n === 1 ? '' : 's'}</span>
              </button>
            )
          })}
        </div>
        <div className="border-t border-ln-ink/5 p-1">
          <button type="button" onClick={() => { setOpen(false); onGerenciar() }} className="w-full flex items-center gap-2 h-8 px-2.5 rounded-md text-[13px] text-ln-t2 hover:bg-ln-ink/5">
            <Settings2 className="w-3.5 h-3.5 text-ln-t4" /> Gerenciar templates
          </button>
        </div>
      </Popover>
    </>
  )
}
