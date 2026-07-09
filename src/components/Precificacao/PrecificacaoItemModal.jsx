import { useMemo, useState } from 'react'
import { X, Check, AlertTriangle, TrendingUp, Wrench, Repeat } from 'lucide-react'
import Modal from '../UI/Modal'
import PrecificacaoServicoForm from './PrecificacaoServicoForm'
import PrecificacaoProdutoForm from './PrecificacaoProdutoForm'
import PrecificacaoSaasForm from './PrecificacaoSaasForm'
import { calcularServico, calcularProduto, calcularSaas } from './precificacaoMath'
import { fmtMoney } from '../Resultados/resultadosHelpers'

// Defaults razoáveis pra novos itens (acelera o preenchimento)
const SERVICO_DEFAULTS = {
  nome: '',
  colaboradores:      [],   // preenchido no init (1 colaborador em branco)
  custosFixos:        '',
  impostoPct:         6,
  margemPct:          30,
}

// Garante que o item de serviço tenha `colaboradores` — migra itens antigos
// (campos flat de um único colaborador) pro novo formato de lista.
function normalizarServico(base) {
  let colabs = Array.isArray(base.colaboradores) ? base.colaboradores : []
  if (!colabs.length) {
    const temLegado = base.salarioMensal || base.horasDedicadas || base.cargaHorariaMensal
    colabs = [{
      id:                 crypto.randomUUID(),
      nome:               '',
      salarioMensal:      temLegado ? (base.salarioMensal ?? '') : '',
      encargosPct:        base.encargosPct ?? 75,
      cargaHorariaMensal: base.cargaHorariaMensal ?? 160,
      horasDedicadas:     temLegado ? (base.horasDedicadas ?? '') : '',
    }]
  }
  const next = { ...base, colaboradores: colabs }
  // Remove campos flat legados pra não persistir duplicado.
  delete next.salarioMensal
  delete next.encargosPct
  delete next.cargaHorariaMensal
  delete next.horasDedicadas
  return next
}

const PRODUTO_DEFAULTS = {
  nome: '',
  custoProduto:     '',
  custosAdicionais: '',
  impostoPct:       6,
  margemPct:        40,
}

const SAAS_DEFAULTS = {
  nome: '',
  // Implantação (cobrança única)
  temImplantacao:       true,
  custoHoraHomem:       '',
  horasImplantacao:     '',
  margemImplantacaoPct: 40,
  // Recorrência
  modeloCobranca:       'por_usuario',   // 'por_usuario' | 'ilimitado'
  numUsuarios:          5,
  custoMensalConta:     '',
  custoMensalUsuario:   '',
  // Ciclo de vida + fiscais
  tempoMedioAtivoMeses: 24,
  impostoPct:           6,
  margemPct:            30,
}

const DEFAULTS_BY_MODE = {
  servicos: SERVICO_DEFAULTS,
  produtos: PRODUTO_DEFAULTS,
  saas:     SAAS_DEFAULTS,
}

const CALC_BY_MODE = {
  servicos: calcularServico,
  produtos: calcularProduto,
  saas:     calcularSaas,
}

const LABEL_BY_MODE = {
  servicos: { singular: 'Serviço', title: 'Precificar serviço' },
  produtos: { singular: 'Produto', title: 'Precificar produto' },
  saas:     { singular: 'SaaS',    title: 'Precificar plano de SaaS' },
}

export default function PrecificacaoItemModal({
  mode,        // 'servicos' | 'produtos' | 'saas'
  initial,     // item existente (edição) ou null (criação)
  onSave,
  onClose,
}) {
  const isServico = mode === 'servicos'
  const isSaas    = mode === 'saas'
  const defaults  = DEFAULTS_BY_MODE[mode] || PRODUTO_DEFAULTS
  const labels    = LABEL_BY_MODE[mode] || LABEL_BY_MODE.produtos
  const [values, setValues] = useState(() => {
    const base = { ...defaults, ...(initial || {}) }
    return isServico ? normalizarServico(base) : base
  })

  function set(field, val) {
    setValues((prev) => ({ ...prev, [field]: val }))
  }

  // Cálculo derivado — recalcula a cada mudança de input
  const calcFn = CALC_BY_MODE[mode] || calcularProduto
  const result = useMemo(() => calcFn(values), [values, calcFn])

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
            {labels.singular} · {initial ? 'editando' : 'novo item'}
          </p>
          <h3 className="text-lg font-black text-rl-text leading-tight">
            {labels.title}
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
        {isSaas
          ? <PrecificacaoSaasForm values={values} onChange={set} />
          : isServico
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
        ) : isSaas ? (
          <SaasPreviewBlock result={result} />
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

// ─── Preview SaaS ─────────────────────────────────────────────────────────────
function SaasPreviewBlock({ result }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-3.5 h-3.5 text-rl-green" />
        <p className="text-[10px] uppercase tracking-wider text-rl-subtle font-bold">
          Cálculo ao vivo
        </p>
      </div>

      {/* Headlines — mensalidade + implantação */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="p-4 rounded-xl bg-rl-green/8 border border-rl-green/30">
          <p className="text-[10px] uppercase tracking-wider text-rl-green font-bold mb-0.5 flex items-center gap-1">
            <Repeat className="w-3 h-3" /> Mensalidade recomendada
          </p>
          <p className="text-2xl font-black text-rl-green tabular-nums">
            {fmtMoney(result.mensalidade)}<span className="text-xs font-semibold text-rl-green/70">/mês</span>
          </p>
          {result.porUsuario && (
            <p className="text-[10px] text-rl-subtle mt-0.5">
              {fmtMoney(result.precoPorUsuario)}/usuário · {result.numUsuarios} seats
            </p>
          )}
          {!result.porUsuario && (
            <p className="text-[10px] text-rl-subtle mt-0.5">usuários ilimitados</p>
          )}
        </div>

        <div className={`p-4 rounded-xl border ${result.temImplantacao ? 'bg-rl-gold/8 border-rl-gold/30' : 'bg-rl-surface/40 border-rl-border'}`}>
          <p className="text-[10px] uppercase tracking-wider text-rl-gold font-bold mb-0.5 flex items-center gap-1">
            <Wrench className="w-3 h-3" /> Implantação (única)
          </p>
          {result.temImplantacao ? (
            <>
              <p className="text-2xl font-black text-rl-gold tabular-nums">
                {fmtMoney(result.precoImplantacao)}
              </p>
              <p className="text-[10px] text-rl-subtle mt-0.5">
                custo {fmtMoney(result.custoImplantacao)}
              </p>
            </>
          ) : (
            <p className="text-sm font-semibold text-rl-muted mt-1">Sem implantação</p>
          )}
        </div>
      </div>

      {/* Ciclo de vida — LTV */}
      <div className="p-3 rounded-xl bg-rl-purple/8 border border-rl-purple/25">
        <p className="text-[10px] uppercase tracking-wider text-rl-purple font-bold mb-2">
          Projeção no ciclo de vida ({result.mesesAtivo} {result.mesesAtivo === 1 ? 'mês' : 'meses'} ativo)
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <MiniCard label="Receita no ciclo (LTV)" value={fmtMoney(result.receitaCiclo)} colorClass="text-rl-purple" />
          <MiniCard label="Lucro no ciclo" value={fmtMoney(result.lucroCiclo)} colorClass="text-rl-green" />
          <MiniCard label="MRR" value={fmtMoney(result.mrr)} />
          <MiniCard label="ARR" value={fmtMoney(result.arr)} />
        </div>
      </div>

      {/* Breakdown mensal */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MiniCard label="Custo mensal" value={fmtMoney(result.custoRecorrente)} />
        <MiniCard label="Imposto/mês" value={fmtMoney(result.impostoReais)} colorClass="text-rl-red" />
        <MiniCard label="Margem/mês" value={fmtMoney(result.margemReais)} colorClass="text-rl-green" />
        <MiniCard label="Markup" value={`${result.markupPct.toFixed(0)}%`} colorClass="text-rl-purple" />
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
