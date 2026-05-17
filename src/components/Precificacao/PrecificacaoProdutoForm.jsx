import MoneyInput from '../UI/MoneyInput'
import PercentInput from '../UI/PercentInput'

// Formulário de inputs do modo produto.
// Recebe os values + onChange(field, val) do parent — não cuida de cálculo
// nem de persistência (essas responsabilidades ficam no PrecificacaoItemModal).
export default function PrecificacaoProdutoForm({ values, onChange }) {
  const set = (field) => (v) => onChange(field, v)

  return (
    <div className="space-y-4">
      <Field
        label="Nome do produto"
        hint="Como esse produto vai aparecer na lista."
      >
        <input
          type="text"
          value={values.nome || ''}
          onChange={(e) => set('nome')(e.target.value)}
          placeholder="Ex: Camiseta de algodão XG"
          maxLength={80}
          className="input-field w-full"
        />
      </Field>

      <Field
        label="Custo de aquisição do produto"
        hint="Quanto foi pago ao fornecedor por unidade (sem frete, embalagem, etc)."
      >
        <MoneyInput
          value={values.custoProduto}
          onChange={set('custoProduto')}
          maxWidth="max-w-none"
        />
      </Field>

      <Field
        label="Custos adicionais (opcional)"
        hint="Frete, embalagem, etiquetas, taxas — tudo que vai junto ao custo unitário."
      >
        <MoneyInput
          value={values.custosAdicionais}
          onChange={set('custosAdicionais')}
          maxWidth="max-w-none"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field
          label="Imposto sobre o faturamento (%)"
          hint="Ex: Simples Nacional 6%/11%/15,5% — sobre o preço de venda."
        >
          <PercentInput
            value={values.impostoPct}
            onChange={set('impostoPct')}
            placeholder="Ex: 6"
            maxWidth="max-w-none"
          />
        </Field>

        <Field
          label="Margem de lucro desejada (%)"
          hint="Lucro líquido que sobra depois de custos e impostos."
        >
          <PercentInput
            value={values.margemPct}
            onChange={set('margemPct')}
            placeholder="Ex: 40"
            maxWidth="max-w-none"
          />
        </Field>
      </div>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="text-xs font-bold text-rl-text uppercase tracking-wide mb-1 block">
        {label}
      </label>
      {hint && <p className="text-[11px] text-rl-muted mb-1.5">{hint}</p>}
      {children}
    </div>
  )
}
