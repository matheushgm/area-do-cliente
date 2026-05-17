import { useMemo, useState } from 'react'
import { X, Check, AlertTriangle, TrendingUp } from 'lucide-react'
import Modal from '../UI/Modal'
import PrecificacaoServicoForm from './PrecificacaoServicoForm'
import PrecificacaoProdutoForm from './PrecificacaoProdutoForm'
import { calcularServico, calcularProduto } from './precificacaoMath'
import { fmtMoney } from '../Resultados/resultadosHelpers'

// Defaults razoáveis pra novos itens (acelera o preenchimento)
const SERVICO_DEFAULTS = {
  nome: '',
  salarioMensal:      '',
  encargosPct:        75,
  cargaHorariaMensal: 160,
  horasDedicadas:     '',
  custosFixos:        '',
  impostoPct:         6,
  margemPct:          30,
}

const PRODUTO_DEFAULTS = {
  nome: '',
  custoProduto:     '',
  custosAdicionais: '',
  impostoPct:       6,
  margemPct:        40,
}

export default function PrecificacaoItemModal({
  mode,        // 'servicos' | 'produtos'
  initial,     // item existente (edição) ou null (criação)
  onSave,
  onClose,
}) {
  const isServico = mode === 'servicos'
  const defaults  = isServico ? SERVICO_DEFAULTS : PRODUTO_DEFAULTS
  const [values, setValues] = useState(() => ({ ...defaults, ...(initial || {}) }))

  function set(field, val) {
    setValues((prev) => ({ ...prev, [field]: val }))
  }

  // Cálculo derivado — recalcula a cada mudança de input
  const result = useMemo(() => {
    return isServico ? calcularServico(values) : calcularProduto(values)
  }, [values, isServico])

  const canSave =
    !!(values.nome || '').trim() &&
    !result.erro &&
    result.precoVenda > 0

  function handleSave() {
    if (!canSave) return
    const now = new Date().toISOString()
    const payload = {
      ...values,
      id: initial?.id || crypto.randomUUID(),
      createdAt: initial?.createdAt || now,
      updatedAt: now,
    }
    onSave(payload)
  }

  return (
    <Modal onClose={onClose} maxWidth="2xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4 pb-4 border-b border-rl-border">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-rl-muted font-bold mb-1">
            {isServico ? 'Serviço' : 'Produto'} · {initial ? 'editando' : 'novo item'}
          </p>
          <h3 className="text-lg font-black text-rl-text leading-tight">
            {isServico ? 'Precificar serviço' : 'Precificar produto'}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all shrink-0"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Form */}
      <div className="max-h-[55vh] overflow-y-auto pr-1">
        {isServico
          ? <PrecificacaoServicoForm values={values} onChange={set} />
          : <PrecificacaoProdutoForm values={values} onChange={set} />}
      </div>

      {/* Preview ao vivo */}
      <div className="mt-4 pt-4 border-t border-rl-border">
        {result.erro ? (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-400/10 border border-red-400/30">
            <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <p className="text-xs text-red-400 font-medium">{result.erro}</p>
          </div>
        ) : (
          <PreviewBlock result={result} isServico={isServico} />
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-rl-border flex items-center justify-end gap-2">
        <button
          onClick={onClose}
          className="text-xs px-4 py-2 rounded-xl bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl bg-rl-purple text-white font-semibold hover:bg-rl-purple/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Check className="w-3.5 h-3.5" /> {initial ? 'Salvar alterações' : 'Salvar item'}
        </button>
      </div>
    </Modal>
  )
}

// ─── Preview ──────────────────────────────────────────────────────────────────
function PreviewBlock({ result, isServico }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-3.5 h-3.5 text-rl-green" />
        <p className="text-[10px] uppercase tracking-wider text-rl-subtle font-bold">
          Cálculo ao vivo
        </p>
      </div>

      {/* Preço de venda — destaque */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-rl-green/8 border border-rl-green/30">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-rl-green font-bold mb-0.5">
            Preço de venda recomendado
          </p>
          <p className="text-[10px] text-rl-subtle">
            considera custo + imposto + margem desejada
          </p>
        </div>
        <p className="text-2xl font-black text-rl-green tabular-nums">
          {fmtMoney(result.precoVenda)}
        </p>
      </div>

      {/* Breakdown em grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {isServico && (
          <MiniCard label="Custo da hora" value={fmtMoney(result.custoHora)} />
        )}
        {isServico && (
          <MiniCard label="Custo mão de obra" value={fmtMoney(result.custoMaoObra)} />
        )}
        <MiniCard label="Custo total" value={fmtMoney(result.custoTotal)} />
        <MiniCard label="Imposto" value={fmtMoney(result.impostoReais)} colorClass="text-rl-red" />
        <MiniCard label="Margem (lucro)" value={fmtMoney(result.margemReais)} colorClass="text-rl-green" />
        <MiniCard label="Markup" value={`${result.markupPct.toFixed(0)}%`} colorClass="text-rl-purple" />
        <MiniCard label="Lucro líquido" value={fmtMoney(result.lucroLiquido)} colorClass="text-rl-green" />
      </div>
    </div>
  )
}

function MiniCard({ label, value, colorClass = 'text-rl-text' }) {
  return (
    <div className="bg-rl-surface/50 border border-rl-border rounded-lg p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-rl-muted font-semibold mb-0.5">
        {label}
      </p>
      <p className={`text-sm font-bold tabular-nums ${colorClass}`}>{value}</p>
    </div>
  )
}
