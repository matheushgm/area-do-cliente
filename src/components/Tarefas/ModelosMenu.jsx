// Botão "Modelos" do cabeçalho: cria uma tarefa (com subtarefas, checklist e etiquetas)
// a partir de um modelo guardado, ou apaga modelos.
import { useRef, useState } from 'react'
import { LayoutTemplate, Trash2 } from 'lucide-react'
import { Popover, FOCO } from './Campos'

export default function ModelosMenu({ modelos, onUsar, onExcluir }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  return (
    <>
      <button ref={ref} type="button" onClick={() => setOpen((v) => !v)} className={`ln-pill ${FOCO}`} title="Criar uma tarefa a partir de um modelo">
        <LayoutTemplate className="w-3.5 h-3.5" /> Modelos
      </button>
      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={280} align="right">
        <div className="p-1 max-h-[300px] overflow-y-auto">
          {modelos.length === 0 && <p className="px-2.5 py-3 text-xs text-ln-t4">Nenhum modelo ainda. Abra uma tarefa e use Salvar como modelo.</p>}
          {modelos.map((m) => (
            <div key={m.id} className="group/mod flex items-center rounded-md hover:bg-ln-ink/5">
              <button type="button" onClick={() => { setOpen(false); onUsar(m) }} className="flex-1 min-w-0 text-left h-8 px-2.5 text-[13px] text-ln-t2 truncate">{m.nome}</button>
              <button type="button" onClick={() => onExcluir(m)} className="ln-iconbtn !w-6 !h-6 mr-1 opacity-0 group-hover/mod:opacity-100 focus-visible:opacity-100 hover:!text-ln-red" aria-label={`Apagar o modelo ${m.nome}`}><Trash2 className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
      </Popover>
    </>
  )
}
