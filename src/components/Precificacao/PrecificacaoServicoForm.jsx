import MoneyInput from '../UI/MoneyInput'
import PercentInput from '../UI/PercentInput'

// Formulário de inputs do modo serviço.
// Recebe os values + onChange(field, val) do parent — não cuida de cálculo
// nem de persistência (essas responsabilidades ficam no PrecificacaoItemModal).
export default function PrecificacaoServicoForm({ values, onChange }) {
  const set = (field) => (v) => onChange(field, v)

  return (
    <div className="space-y-4">
      <Field
        label="Nome do serviço"
        hint="Como esse serviço vai aparecer na lista."
      >
        <input
          type="text"
          value={values.nome || ''}
          onChange={(e) => set('nome')(e.target.value)}
          placeholder="Ex: Tráfego pago — pacote mensal"
          maxLength={80}
          className="input-field w-full"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field
          label="Salário mensal do colaborador"
          hint="Bruto, antes dos encargos."
        >
          <MoneyInput
            value={values.salarioMensal}
            onChange={set('salarioMensal')}
            maxWidth="max-w-none"
          />
        </Field>

        <Field
          label="Encargos trabalhistas (%)"
          hint="INSS, FGTS, férias, 13º — típico 70-100%."
        >
          <PercentInput
            value={values.encargosPct}
            onChange={set('encargosPct')}
            placeholder="Ex: 75"
            max={200}
            maxWidth="max-w-none"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field
          label="Carga horária mensal"
          hint="Horas trabalhadas no mês (padrão 160h)."
        >
          <input
            type="number"
            min="1"
            value={values.cargaHorariaMensal ?? ''}
            onChange={(e) => set('cargaHorariaMensal')(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="Ex: 160"
            className="input-field w-full"
          />
        </Field>

        <Field
          label="Horas dedicadas a este serviço"
          hint="Total de horas que vão ser gastas neste pacote."
        >
          <input
            type="number"
            min="0"
            value={values.horasDedicadas ?? ''}
            onChange={(e) => set('horasDedicadas')(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="Ex: 20"
            className="input-field w-full"
          />
        </Field>
      </div>

      <Field
        label="Custos fixos rateados (opcional)"
        hint="Ferramentas, aluguel, software — o que mais entra neste serviço além de mão de obra."
      >
        <MoneyInput
          value={values.custosFixos}
          onChange={set('custosFixos')}
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
            placeholder="Ex: 30"
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
