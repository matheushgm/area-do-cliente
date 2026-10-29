// Diálogo de confirmação do VertaTask, no lugar do window.confirm. Mesmo formato dos
// alertas de "Excluir cliente" (home) e "Ocultar conta" (Dashboard de Tráfego): centrado
// sobre fundo escuro, cabeçalho com ícone e título, texto do que acontece, o que vai ser
// afetado num quadro e o rodapé Cancelar + ação. Sem palavra para digitar.
//
// Uso: const [confirmar, dialogo] = useConfirmar()
//      if (!(await confirmar({ titulo, texto, itens, acao, perigo }))) return
//      ... e renderizar {dialogo} em algum lugar do componente.
import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Archive, Trash2, X } from 'lucide-react'
import { FOCO } from './Campos'

const MAX_ITENS = 3

export function ConfirmarDialog({ titulo, texto = null, rotuloItens = null, itens = [], acao, perigo = false, icone = null, onConfirmar, onCancelar }) {
  const cancelar = useRef(null)
  const confirmar = useRef(null)
  // `perigo` põe o foco no Cancelar: um Enter distraído não apaga nada
  useEffect(() => { (perigo ? cancelar : confirmar).current?.focus() }, [perigo])
  useEffect(() => {
    // na captura da janela: o Esc não chega no atalho que fecha o painel / limpa a seleção
    const h = (e) => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); onCancelar() } }
    window.addEventListener('keydown', h, true)
    return () => window.removeEventListener('keydown', h, true)
  }, [onCancelar])
  const Icone = icone || (perigo ? AlertTriangle : Archive)
  const BotaoIcone = perigo ? Trash2 : Icone
  const resto = itens.length - MAX_ITENS
  return createPortal(
    <div className="ln vt fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancelar} aria-hidden="true" />
      <div
        role="alertdialog" aria-modal="true" aria-labelledby="confirmar-titulo"
        className={`relative w-full max-w-[440px] rounded-xl border bg-ln-panel ${perigo ? 'border-ln-red/30' : 'border-ln-ink/[0.1]'}`}
        style={{ boxShadow: 'var(--ln-shadow-panel)' }}
      >
        <div className="flex items-start gap-3 px-5 pt-5">
          <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${perigo ? 'bg-ln-red/10 text-ln-red' : 'bg-ln-ink/[0.05] text-ln-t2'}`}>
            <Icone className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 id="confirmar-titulo" className="text-[15px] font-semibold text-ln-t1">{titulo}</h2>
            {texto && <p className="text-[13px] leading-relaxed text-ln-t3 mt-1">{texto}</p>}
          </div>
          <button type="button" onClick={onCancelar} className={`ln-iconbtn -mr-1.5 -mt-1 ${FOCO}`} aria-label="Fechar"><X className="w-4 h-4" /></button>
        </div>
        {itens.length > 0 && (
          <div className="mx-5 mt-4 rounded-lg border border-ln-ink/[0.08] bg-ln-ink/[0.02] px-3.5 py-2.5">
            {rotuloItens && <p className="text-[11px] text-ln-t4 mb-1">{rotuloItens}</p>}
            <ul className="space-y-0.5">
              {itens.slice(0, MAX_ITENS).map((t, i) => (
                <li key={i} className={`text-[13px] font-medium truncate ${perigo ? 'text-ln-red' : 'text-ln-t1'}`}>{t}</li>
              ))}
            </ul>
            {resto > 0 && <p className="text-xs text-ln-t4 mt-1">e mais {resto}</p>}
          </div>
        )}
        <div className="flex justify-end gap-2 px-5 py-4 mt-1">
          <button ref={cancelar} type="button" onClick={onCancelar} className={`inline-flex items-center h-8 px-3.5 rounded-md border border-ln-ink/[0.1] text-[13px] text-ln-t2 hover:bg-ln-ink/[0.04] ${FOCO}`}>Cancelar</button>
          <button
            ref={confirmar} type="button" onClick={onConfirmar}
            className={`inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md text-[13px] font-medium ${perigo ? 'bg-ln-red text-white hover:opacity-90' : 'ln-primary'} ${FOCO}`}
          >
            <BotaoIcone className="w-3.5 h-3.5" /> {acao}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Confirmação por promessa: `await confirmar({...})` devolve true/false. */
export function useConfirmar() {
  const [pedido, setPedido] = useState(null)
  const resolver = useRef(null)
  const confirmar = useCallback((opcoes) => new Promise((resolve) => {
    resolver.current?.(false) // pedido anterior ainda aberto conta como cancelado
    resolver.current = resolve
    setPedido(opcoes)
  }), [])
  const responder = useCallback((ok) => {
    resolver.current?.(ok)
    resolver.current = null
    setPedido(null)
  }, [])
  const cancelar = useCallback(() => responder(false), [responder])
  const dialogo = pedido ? <ConfirmarDialog {...pedido} onConfirmar={() => responder(true)} onCancelar={cancelar} /> : null
  return [confirmar, dialogo]
}

/** "1 tarefa" / "3 tarefas" e, se houver, " e 2 subtarefas". */
export function contarTarefas(n, nSubs = 0) {
  const t = n === 1 ? '1 tarefa' : `${n} tarefas`
  return nSubs ? `${t} e ${nSubs === 1 ? '1 subtarefa' : `${nSubs} subtarefas`}` : t
}
