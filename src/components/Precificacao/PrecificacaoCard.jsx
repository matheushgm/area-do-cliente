import { Pencil, Trash2, Clock } from 'lucide-react'
import { fmtMoney } from '../Resultados/resultadosHelpers'
import { calcularServico, calcularProduto } from './precificacaoMath'

// Card compacto de um item salvo na lista de Precificação.
// Click no corpo do card → edita; click no lixo → exclui (com confirm).
export default function PrecificacaoCard({ item, mode, onEdit, onDelete }) {
  const result = mode === 'servicos' ? calcularServico(item) : calcularProduto(item)
  const updated = item.updatedAt
    ? new Date(item.updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    : null

  return (
    <div
      onClick={onEdit}
      className="group glass-card p-4 cursor-pointer hover:border-rl-purple/40 hover:shadow-glow transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-rl-text truncate">{item.nome || '— sem nome —'}</h4>
          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-rl-muted">
            <span>Custo: {fmtMoney(result.custoTotal)}</span>
            {updated && (
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" /> {updated}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit() }}
            className="p-1.5 rounded-lg text-rl-muted hover:text-rl-purple hover:bg-rl-purple/10 transition-all"
            title="Editar"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (window.confirm(`Excluir "${item.nome || 'este item'}"?`)) onDelete()
            }}
            className="p-1.5 rounded-lg text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition-all"
            title="Excluir"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Resultado destacado */}
      <div className="mt-3 pt-3 border-t border-rl-border/60 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-rl-muted font-bold mb-0.5">
            Preço de venda
          </p>
          <p className={`text-2xl font-black tabular-nums ${result.erro ? 'text-rl-red' : 'text-rl-green'}`}>
            {result.erro ? '—' : fmtMoney(result.precoVenda)}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px]">
          <span className="px-2 py-1 rounded-full bg-rl-purple/10 border border-rl-purple/30 text-rl-purple font-bold">
            Margem {Number(item.margemPct) || 0}%
          </span>
          <span className="px-2 py-1 rounded-full bg-rl-gold/10 border border-rl-gold/30 text-rl-gold font-bold">
            Imposto {Number(item.impostoPct) || 0}%
          </span>
        </div>
      </div>

      {result.erro && (
        <p className="mt-2 text-[10px] text-red-400 font-medium leading-snug">
          {result.erro}
        </p>
      )}
    </div>
  )
}
