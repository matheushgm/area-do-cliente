import MoneyInput from '../UI/MoneyInput'
import PercentInput from '../UI/PercentInput'
import { useI18n } from '../../i18n'

// Formulário de inputs do modo produto.
// Recebe os values + onChange(field, val) do parent — não cuida de cálculo
// nem de persistência (essas responsabilidades ficam no PrecificacaoItemModal).
export default function PrecificacaoProdutoForm({ values, onChange }) {
  const { t } = useI18n()
  const set = (field) => (v) => onChange(field, v)

  return (
    <div className="space-y-4">
      <Field
        label={t('precificacao.produto.nome')}
        hint={t('precificacao.produto.nomeAjuda')}
      >
        <input
          type="text"
          value={values.nome || ''}
          onChange={(e) => set('nome')(e.target.value)}
          placeholder={t('precificacao.produto.nomePlaceholder')}
          maxLength={80}
          className="input-field w-full"
        />
      </Field>

      <Field
        label={t('precificacao.produto.custo')}
        hint={t('precificacao.produto.custoAjuda')}
      >
        <MoneyInput
          value={values.custoProduto}
          onChange={set('custoProduto')}
          maxWidth="max-w-none"
        />
      </Field>

      <Field
        label={t('precificacao.produto.adicionais')}
        hint={t('precificacao.produto.adicionaisAjuda')}
      >
        <MoneyInput
          value={values.custosAdicionais}
          onChange={set('custosAdicionais')}
          maxWidth="max-w-none"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field
          label={t('precificacao.campos.imposto')}
          hint={t('precificacao.campos.impostoAjuda')}
        >
          <PercentInput
            value={values.impostoPct}
            onChange={set('impostoPct')}
            placeholder={t('precificacao.campos.exemplo', { valor: 6 })}
            maxWidth="max-w-none"
          />
        </Field>

        <Field
          label={t('precificacao.campos.margem')}
          hint={t('precificacao.campos.margemAjuda')}
        >
          <PercentInput
            value={values.margemPct}
            onChange={set('margemPct')}
            placeholder={t('precificacao.campos.exemplo', { valor: 40 })}
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
