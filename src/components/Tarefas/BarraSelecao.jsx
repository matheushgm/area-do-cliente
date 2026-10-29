// Barra flutuante de seleção (rodapé), como a do ClickUp: "N selecionadas ×", os campos
// para editar todas de uma vez, Duplicar, Arquivar e Excluir. Os campos são os mesmos editores das
// células (Campos.jsx etc.) com o gatilho trocado por `BotaoBarra` via `render`.
// Usada pela lista de tarefas, pelo editor de template e pela prévia de aplicação.
import { X, Copy, Trash2, Loader2, Archive } from 'lucide-react'
import { ResponsavelCampo } from './Campos'
import { DepartamentoCampo } from './TarefaPanel'

/** Gatilho visual de um campo da barra (ícone + rótulo). */
export function BotaoBarra({ icon: Icon, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[13px] text-ln-t2 hover:bg-ln-ink/[0.06] hover:text-ln-t1 whitespace-nowrap">
      {Icon && <Icon className="w-3.5 h-3.5 text-ln-t3" />}{children}
    </span>
  )
}

/** O que entrou e o que saiu entre duas listas (adicionar/remover em massa). */
export function diferenca(antes, depois) {
  const a = new Set(antes), d = new Set(depois)
  return { entrou: [...d].filter((x) => !a.has(x)), saiu: [...a].filter((x) => !d.has(x)) }
}
const comuns = (listas) => (listas.length ? listas.reduce((acc, l) => acc.filter((x) => (l || []).includes(x)), [...(listas[0] || [])]) : [])
/** Aplica a diferença numa lista: tira o que saiu e acrescenta o que entrou. */
export const aplicarDiferenca = (lista, { entrou, saiu }) => [...new Set([...(lista || []).filter((x) => !saiu.includes(x)), ...entrou])]

/** Responsáveis de várias tarefas: marcado = está em todas; marcar/desmarcar põe/tira de todas. */
export function ResponsaveisEmMassa({ listas, membros, membrosMap, icon, onAplicar }) {
  const atuais = comuns(listas)
  return (
    <ResponsavelCampo
      item={{ responsaveis: atuais, responsaveis_extra: [] }} membros={membros} membrosMap={membrosMap}
      onChange={(ids) => onAplicar(diferenca(atuais, ids))}
      render={<BotaoBarra icon={icon}>Responsáveis</BotaoBarra>}
    />
  )
}

/** Departamentos de várias tarefas, com a mesma regra dos responsáveis. */
export function DepartamentosEmMassa({ listas, icon, onAplicar }) {
  const atuais = comuns(listas)
  return (
    <DepartamentoCampo
      valor={atuais} onChange={(v) => onAplicar(diferenca(atuais, v))}
      render={<BotaoBarra icon={icon}>Departamento</BotaoBarra>}
    />
  )
}

export default function BarraSelecao({ n, rotulo = 'tarefa', onLimpar, children, onDuplicar, onArquivar, onExcluir, ocupado = false }) {
  if (!n) return null
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[35] max-w-[calc(100%-2rem)]" role="toolbar" aria-label="Ações para as selecionadas">
      <div className="flex items-center gap-1 p-1.5 rounded-xl border border-ln-ink/[0.1] bg-ln-panel overflow-x-auto scroll-hide" style={{ boxShadow: 'var(--ln-shadow-panel)' }}>
        <span className="inline-flex items-center gap-2 h-8 pl-3 pr-1.5 mr-1 rounded-lg border border-ln-ink/[0.1] text-[13px] text-ln-t1 whitespace-nowrap tabular">
          {ocupado && <Loader2 className="w-3.5 h-3.5 animate-spin text-ln-t3" />}
          {n} {rotulo}{n === 1 ? '' : 's'} selecionada{n === 1 ? '' : 's'}
          <button type="button" onClick={onLimpar} className="ln-iconbtn !w-6 !h-6" aria-label="Limpar seleção" title="Limpar seleção (Esc)"><X className="w-3.5 h-3.5" /></button>
        </span>
        <span className={`flex items-center gap-0.5 ${ocupado ? 'pointer-events-none opacity-60' : ''}`}>{children}</span>
        <span className="w-px h-5 bg-ln-line mx-1 shrink-0" />
        {onDuplicar && (
          <button type="button" onClick={onDuplicar} disabled={ocupado} className="rounded-lg disabled:opacity-50" title="Duplicar as selecionadas">
            <BotaoBarra icon={Copy}>Duplicar</BotaoBarra>
          </button>
        )}
        {onArquivar && (
          <button type="button" onClick={onArquivar} disabled={ocupado} className="rounded-lg disabled:opacity-50" title="Arquivar as selecionadas">
            <BotaoBarra icon={Archive}>Arquivar</BotaoBarra>
          </button>
        )}
        {onExcluir && (
          <button type="button" onClick={onExcluir} disabled={ocupado} className="ln-iconbtn !w-8 !h-8 hover:!text-ln-red disabled:opacity-50" aria-label="Excluir as selecionadas" title="Excluir as selecionadas">
            <Trash2 className="w-4 h-4 text-ln-red" />
          </button>
        )}
      </div>
    </div>
  )
}
