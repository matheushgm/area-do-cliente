import { Plus, Trash2, Users } from 'lucide-react'
import MoneyInput from '../UI/MoneyInput'
import PercentInput from '../UI/PercentInput'
import { calcularServico } from './precificacaoMath'
import { fmtMoney } from '../Resultados/resultadosHelpers'
import { useI18n } from '../../i18n'

// Colaborador em branco com defaults razoáveis (encargos 75%, carga 160h).
function blankColaborador() {
  return {
    id:                 crypto.randomUUID(),
    nome:               '',
    salarioMensal:      '',
    encargosPct:        75,
    cargaHorariaMensal: 160,
    horasDedicadas:     '',
  }
}

// Formulário de inputs do modo serviço.
// Recebe os values + onChange(field, val) do parent — não cuida de cálculo
// nem de persistência (essas responsabilidades ficam no PrecificacaoItemModal).
// A mão de obra é composta por N colaboradores, cada um custeado à parte.
export default function PrecificacaoServicoForm({ values, onChange }) {
  const { t } = useI18n()
  const set = (field) => (v) => onChange(field, v)

  const colaboradores = Array.isArray(values.colaboradores) ? values.colaboradores : []

  // Custo de mão de obra por colaborador (mesma engine do cálculo final),
  // pra mostrar o valor de cada um separadamente na hora do preenchimento.
  const calc = calcularServico(values)
  const custoPorColab = Object.fromEntries(
    (calc.colaboradores || []).map((c) => [c.id, c.custoMaoObra])
  )

  function updateColab(id, field, val) {
    onChange(
      'colaboradores',
      colaboradores.map((c) => (c.id === id ? { ...c, [field]: val } : c))
    )
  }
  function addColab() {
    onChange('colaboradores', [...colaboradores, blankColaborador()])
  }
  function removeColab(id) {
    onChange('colaboradores', colaboradores.filter((c) => c.id !== id))
  }

  return (
    <div className="space-y-4">
      <Field
        label={t('precificacao.servico.nome')}
        hint={t('precificacao.servico.nomeAjuda')}
      >
        <input
          type="text"
          value={values.nome || ''}
          onChange={(e) => set('nome')(e.target.value)}
          placeholder={t('precificacao.servico.nomePlaceholder')}
          maxLength={80}
          className="input-field w-full"
        />
      </Field>

      {/* Colaboradores — lista repetível */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-bold text-rl-text uppercase tracking-wide flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-rl-gold" /> {t('precificacao.servico.colaboradores')}
          </label>
          <span className="text-[11px] text-rl-muted">
            {t('precificacao.servico.contagemColab', { count: colaboradores.length })}
          </span>
        </div>
        <p className="text-[11px] text-rl-muted mb-2">
          {t('precificacao.servico.colaboradoresAjuda')}
        </p>

        <div className="space-y-3">
          {colaboradores.map((c, idx) => (
            <div
              key={c.id}
              className="rounded-xl border border-rl-border bg-rl-surface/40 p-3 space-y-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-rl-muted shrink-0">
                  #{idx + 1}
                </span>
                <input
                  type="text"
                  value={c.nome || ''}
                  onChange={(e) => updateColab(c.id, 'nome', e.target.value)}
                  placeholder={t('precificacao.servico.nomeColabPlaceholder')}
                  maxLength={80}
                  className="input-field w-full text-sm"
                />
                {colaboradores.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeColab(c.id)}
                    className="p-1.5 rounded-lg text-rl-muted hover:text-red-400 hover:bg-red-400/10 transition-all shrink-0"
                    title={t('precificacao.servico.removerColab')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label={t('precificacao.servico.salario')} hint={t('precificacao.servico.salarioAjuda')}>
                  <MoneyInput
                    value={c.salarioMensal}
                    onChange={(v) => updateColab(c.id, 'salarioMensal', v)}
                    maxWidth="max-w-none"
                  />
                </Field>
                <Field label={t('precificacao.servico.encargos')} hint={t('precificacao.servico.encargosAjuda')}>
                  <PercentInput
                    value={c.encargosPct}
                    onChange={(v) => updateColab(c.id, 'encargosPct', v)}
                    placeholder={t('precificacao.campos.exemplo', { valor: 75 })}
                    max={200}
                    maxWidth="max-w-none"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label={t('precificacao.servico.carga')} hint={t('precificacao.servico.cargaAjuda')}>
                  <input
                    type="number"
                    min="1"
                    value={c.cargaHorariaMensal ?? ''}
                    onChange={(e) => updateColab(c.id, 'cargaHorariaMensal', e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder={t('precificacao.campos.exemplo', { valor: 160 })}
                    className="input-field w-full"
                  />
                </Field>
                <Field label={t('precificacao.servico.horas')} hint={t('precificacao.servico.horasAjuda')}>
                  <input
                    type="number"
                    min="0"
                    value={c.horasDedicadas ?? ''}
                    onChange={(e) => updateColab(c.id, 'horasDedicadas', e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder={t('precificacao.campos.exemplo', { valor: 20 })}
                    className="input-field w-full"
                  />
                </Field>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-rl-border/60">
                <span className="text-[10px] uppercase tracking-wide text-rl-muted font-semibold">
                  {t('precificacao.servico.custoColab')}
                </span>
                <span className="text-sm font-bold text-rl-text tabular-nums">
                  {fmtMoney(custoPorColab[c.id] || 0)}
                </span>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addColab}
          className="mt-2 w-full flex items-center justify-center gap-1.5 text-sm font-semibold px-3 py-2.5 rounded-xl border border-dashed border-rl-border text-rl-muted hover:text-rl-gold hover:border-rl-gold/40 transition-all"
        >
          <Plus className="w-4 h-4" /> {t('precificacao.servico.adicionarColab')}
        </button>
      </div>

      <Field
        label={t('precificacao.servico.fixos')}
        hint={t('precificacao.servico.fixosAjuda')}
      >
        <MoneyInput
          value={values.custosFixos}
          onChange={set('custosFixos')}
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
            placeholder={t('precificacao.campos.exemplo', { valor: 30 })}
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
