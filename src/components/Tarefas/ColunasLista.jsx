// Editor das colunas da Lista: ordem (arrastar pela alça, ou ↑ ↓ com a alça em foco) e
// visível/oculta (olho). O Nome é fixo, primeiro e sempre visível. Usado na sidebar de
// configurações da view e no "+" do cabeçalho das colunas da Lista.
import { useState } from 'react'
import { GripVertical, Eye, EyeOff, Lock } from 'lucide-react'
import { colunasDaView, normalizarColunas } from '../../lib/viewsTarefas'
import { FOCO } from './Campos'

/** valor = config.colunas; onChange(colunas) recebe o novo { ordem, ocultas } (ou null = padrão). */
export default function EditorColunas({ valor, onChange }) {
  const cols = colunasDaView(valor)
  const [arrastando, setArrastando] = useState(null) // k da coluna em movimento
  const [sobre, setSobre] = useState(null) // índice onde ela vai cair

  const emitir = (lista) => onChange(normalizarColunas({ ordem: lista.map((c) => c.k), ocultas: lista.filter((c) => c.oculta).map((c) => c.k) }))
  const mover = (de, para) => {
    if (para < 0 || para >= cols.length || de === para) return
    const lista = [...cols]
    const [c] = lista.splice(de, 1)
    lista.splice(para, 0, c)
    emitir(lista)
  }
  const alternar = (k) => emitir(cols.map((c) => (c.k === k ? { ...c, oculta: !c.oculta } : c)))
  const nVisiveis = cols.filter((c) => !c.oculta).length
  const soltar = () => {
    if (arrastando !== null && sobre !== null) {
      const de = cols.findIndex((c) => c.k === arrastando)
      mover(de, sobre > de ? sobre - 1 : sobre)
    }
    setArrastando(null); setSobre(null)
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 h-8 px-2 text-[13px] text-ln-t3">
        <Lock className="w-3.5 h-3.5 text-ln-t4" /><span className="flex-1">Nome</span><span className="text-[11px] text-ln-t4">sempre visível</span>
      </div>
      <ul className="flex flex-col" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); soltar() }}>
        {cols.map((c, i) => (
          <li
            key={c.k}
            draggable
            onDragStart={(e) => { setArrastando(c.k); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', c.k) }}
            onDragOver={(e) => { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); setSobre(e.clientY < r.top + r.height / 2 ? i : i + 1) }}
            onDragEnd={() => { setArrastando(null); setSobre(null) }}
            className={`relative flex items-center gap-1.5 h-8 px-1 rounded-md ${arrastando === c.k ? 'opacity-40' : 'hover:bg-ln-ink/[0.04]'}`}
          >
            {arrastando && sobre === i && <span aria-hidden="true" className="absolute left-1 right-1 -top-px h-0.5 rounded bg-ln-accent" />}
            {arrastando && sobre === i + 1 && i === cols.length - 1 && <span aria-hidden="true" className="absolute left-1 right-1 -bottom-px h-0.5 rounded bg-ln-accent" />}
            <button
              type="button"
              onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); mover(i, i + (e.key === 'ArrowUp' ? -1 : 1)) } }}
              className={`inline-flex items-center justify-center w-5 h-6 rounded text-ln-t4 cursor-grab active:cursor-grabbing hover:text-ln-t2 ${FOCO}`}
              aria-label={`Mover ${c.label} (setas para cima e para baixo)`} title="Arraste para mudar a ordem"
            ><GripVertical className="w-3.5 h-3.5" /></button>
            <span className={`flex-1 truncate text-[13px] ${c.oculta ? 'text-ln-t4' : 'text-ln-t1'}`}>{c.label}</span>
            <button
              type="button" onClick={() => alternar(c.k)} disabled={!c.oculta && nVisiveis === 1}
              className={`inline-flex items-center justify-center w-7 h-6 rounded disabled:opacity-30 ${c.oculta ? 'text-ln-t4 hover:text-ln-t2' : 'text-ln-accent hover:bg-ln-accent/10'} ${FOCO}`}
              aria-pressed={!c.oculta} aria-label={c.oculta ? `Mostrar ${c.label}` : `Ocultar ${c.label}`} title={c.oculta ? 'Oculta: clique para mostrar' : 'Visível: clique para ocultar'}
            >{c.oculta ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}</button>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-2 pt-2 mt-1 border-t border-ln-ink/[0.06] px-1">
        <span className="text-[11px] text-ln-t4 tabular">{nVisiveis} de {cols.length} visíveis</span>
        <button type="button" onClick={() => onChange(null)} disabled={!normalizarColunas(valor)} className={`text-xs text-ln-accent hover:underline disabled:text-ln-t4 disabled:no-underline ${FOCO}`}>Restaurar padrão</button>
      </div>
    </div>
  )
}
