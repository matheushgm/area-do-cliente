// Seletor inline de Cycle / Module no painel da tarefa (mesmo padrão dos
// demais campos: botão que abre um Popover com a lista de opções).
import { useState, useRef } from 'react'
import { Check, X } from 'lucide-react'
import { Popover, FOCO } from './Campos'

export default function RelacaoCampo({ valor, opcoes, onChange, vazio = 'nenhum', cor = '#7b68ee' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const atual = opcoes.find((o) => o.id === valor)
  return (
    <>
      <button ref={ref} type="button" onClick={() => setOpen((v) => !v)} className={`inline-flex items-center max-w-full rounded-md ${FOCO}`}>
        {atual ? (
          <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full ring-1 ring-inset ring-ln-line text-xs text-ln-t3 max-w-full" title={atual.rotulo}>
            <i className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cor }} />
            <span className="truncate">{atual.rotulo}</span>
          </span>
        ) : <span className="text-xs text-ln-t4">{vazio}</span>}
      </button>
      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={260}>
        <div className="p-1 overflow-y-auto">
          {opcoes.length === 0 && <p className="px-2.5 py-2 text-xs text-ln-t4">Nada criado ainda.</p>}
          {opcoes.map((o) => (
            <button key={o.id} type="button" onClick={() => { setOpen(false); onChange(o.id) }} className={`w-full flex items-center gap-2 h-8 px-2.5 rounded-md text-[13px] hover:bg-ln-ink/5 ${o.id === valor ? 'text-ln-t1' : 'text-ln-t2'}`}>
              <i className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cor }} />
              <span className="truncate">{o.rotulo}</span>
              {o.sub && <span className="text-[11px] text-ln-t4 ml-auto shrink-0">{o.sub}</span>}
              {o.id === valor && <Check className="w-3.5 h-3.5 ml-1 text-ln-accent shrink-0" />}
            </button>
          ))}
          {valor && (
            <>
              <div className="border-t border-ln-ink/5 my-1" />
              <button type="button" onClick={() => { setOpen(false); onChange(null) }} className="w-full flex items-center gap-2 h-8 px-2.5 rounded-md text-[13px] text-ln-t2 hover:bg-ln-ink/5">
                <X className="w-3.5 h-3.5 text-ln-t4" /> Limpar
              </button>
            </>
          )}
        </div>
      </Popover>
    </>
  )
}
