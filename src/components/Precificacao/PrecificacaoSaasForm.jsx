import { Wrench, Users, Infinity as InfinityIcon, Clock, CheckCircle2 } from 'lucide-react'
import MoneyInput from '../UI/MoneyInput'
import PercentInput from '../UI/PercentInput'
import { calcularSaas } from './precificacaoMath'
import { fmtMoney } from '../Resultados/resultadosHelpers'
import { useI18n } from '../../i18n'

// Formulário de inputs do modo SaaS.
// Recebe os values + onChange(field, val) do parent — não cuida de cálculo
// nem de persistência (essas responsabilidades ficam no PrecificacaoItemModal).
//
// Três decisões guiam o preenchimento:
//   1. Tem implantação? → custo hora-homem × horas + margem de onboarding.
//   2. Cobrança por usuário (seats) ou ilimitado (flat).
//   3. Tempo médio que o cliente fica ativo → projeta o LTV.
export default function PrecificacaoSaasForm({ values, onChange }) {
  const { t } = useI18n()
  const set = (field) => (v) => onChange(field, v)
  const calc = calcularSaas(values)

  const temImplantacao = !!values.temImplantacao
  const porUsuario = values.modeloCobranca === 'por_usuario'

  return (
    <div className="space-y-5">
      <Field label={t('precificacao.saas.nome')} hint={t('precificacao.saas.nomeAjuda')}>
        <input
          type="text"
          value={values.nome || ''}
          onChange={(e) => set('nome')(e.target.value)}
          placeholder={t('precificacao.saas.nomePlaceholder')}
          maxLength={80}
          className="input-field w-full"
        />
      </Field>

      {/* ── 1. Implantação / Onboarding ─────────────────────────────────── */}
      <Section icon={Wrench} title={t('precificacao.saas.secaoImplantacao')}>
        <ToggleRow
          label={t('precificacao.saas.temImplantacao')}
          hint={t('precificacao.saas.temImplantacaoAjuda')}
          value={temImplantacao}
          onChange={(v) => set('temImplantacao')(v)}
        />

        {temImplantacao && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={t('precificacao.saas.custoHora')} hint={t('precificacao.saas.custoHoraAjuda')}>
                <MoneyInput
                  value={values.custoHoraHomem}
                  onChange={set('custoHoraHomem')}
                  maxWidth="max-w-none"
                />
              </Field>
              <Field label={t('precificacao.saas.horasImplantacao')} hint={t('precificacao.saas.horasImplantacaoAjuda')}>
                <input
                  type="number"
                  min="0"
                  value={values.horasImplantacao ?? ''}
                  onChange={(e) => set('horasImplantacao')(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder={t('precificacao.campos.exemplo', { valor: 20 })}
                  className="input-field w-full"
                />
              </Field>
            </div>

            <Field label={t('precificacao.saas.margemImplantacao')} hint={t('precificacao.saas.margemImplantacaoAjuda')}>
              <PercentInput
                value={values.margemImplantacaoPct}
                onChange={set('margemImplantacaoPct')}
                placeholder={t('precificacao.campos.exemplo', { valor: 40 })}
                maxWidth="max-w-none"
              />
            </Field>

            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-rl-surface/50 border border-rl-border">
              <span className="text-[11px] uppercase tracking-wide text-rl-muted font-semibold">
                {t('precificacao.saas.custoImplantacao')}
              </span>
              <span className="text-sm font-bold text-rl-text tabular-nums">
                {fmtMoney(calc.custoImplantacao)}
              </span>
            </div>
          </div>
        )}
      </Section>

      {/* ── 2. Modelo de cobrança ───────────────────────────────────────── */}
      <Section icon={porUsuario ? Users : InfinityIcon} title={t('precificacao.saas.secaoCobranca')}>
        <Field label={t('precificacao.saas.comoCobra')} hint={t('precificacao.saas.comoCobraAjuda')}>
          <div className="grid grid-cols-2 gap-2">
            <ModeCard
              active={porUsuario}
              onClick={() => set('modeloCobranca')('por_usuario')}
              icon={Users}
              title={t('precificacao.saas.porUsuario')}
              desc={t('precificacao.saas.porUsuarioDesc')}
            />
            <ModeCard
              active={!porUsuario}
              onClick={() => set('modeloCobranca')('ilimitado')}
              icon={InfinityIcon}
              title={t('precificacao.saas.ilimitado')}
              desc={t('precificacao.saas.ilimitadoDesc')}
            />
          </div>
        </Field>

        <Field
          label={t('precificacao.saas.custoConta')}
          hint={t('precificacao.saas.custoContaAjuda')}
        >
          <MoneyInput
            value={values.custoMensalConta}
            onChange={set('custoMensalConta')}
            maxWidth="max-w-none"
          />
        </Field>

        {porUsuario && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={t('precificacao.saas.custoUsuario')} hint={t('precificacao.saas.custoUsuarioAjuda')}>
              <MoneyInput
                value={values.custoMensalUsuario}
                onChange={set('custoMensalUsuario')}
                maxWidth="max-w-none"
              />
            </Field>
            <Field label={t('precificacao.saas.numUsuarios')} hint={t('precificacao.saas.numUsuariosAjuda')}>
              <input
                type="number"
                min="1"
                value={values.numUsuarios ?? ''}
                onChange={(e) => set('numUsuarios')(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder={t('precificacao.campos.exemplo', { valor: 5 })}
                className="input-field w-full"
              />
            </Field>
          </div>
        )}
      </Section>

      {/* ── 3. Ciclo de vida + fiscais ──────────────────────────────────── */}
      <Section icon={Clock} title={t('precificacao.saas.secaoCiclo')}>
        <Field
          label={t('precificacao.saas.tempoAtivo')}
          hint={t('precificacao.saas.tempoAtivoAjuda')}
        >
          <input
            type="number"
            min="0"
            value={values.tempoMedioAtivoMeses ?? ''}
            onChange={(e) => set('tempoMedioAtivoMeses')(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder={t('precificacao.campos.exemplo', { valor: 24 })}
            className="input-field w-full"
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
            label={t('precificacao.saas.margemMensalidade')}
            hint={t('precificacao.saas.margemMensalidadeAjuda')}
          >
            <PercentInput
              value={values.margemPct}
              onChange={set('margemPct')}
              placeholder={t('precificacao.campos.exemplo', { valor: 30 })}
              maxWidth="max-w-none"
            />
          </Field>
        </div>
      </Section>
    </div>
  )
}

// ─── Subcomponentes ──────────────────────────────────────────────────────────
function Section({ icon: Icon, title, children }) {
  return (
    <div className="rounded-xl border border-rl-border bg-rl-surface/30 p-3.5 space-y-3">
      <p className="text-xs font-black text-rl-text uppercase tracking-wide flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 text-rl-gold" /> {title}
      </p>
      {children}
    </div>
  )
}

function ToggleRow({ label, hint, value, onChange }) {
  const { t } = useI18n()
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold transition-all ${
          value
            ? 'bg-rl-green/10 border-rl-green/40 text-rl-green'
            : 'bg-rl-surface border-rl-border text-rl-muted hover:text-rl-text'
        }`}
      >
        {value && <CheckCircle2 className="w-3.5 h-3.5" />} {t('precificacao.saas.simTem')}
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`flex-1 flex items-center justify-center px-3 py-2 rounded-lg border text-xs font-bold transition-all ${
          !value
            ? 'bg-rl-purple/10 border-rl-purple/40 text-rl-purple'
            : 'bg-rl-surface border-rl-border text-rl-muted hover:text-rl-text'
        }`}
      >
        {t('precificacao.saas.naoTem')}
      </button>
      {hint && <span className="sr-only">{`${label} — ${hint}`}</span>}
    </div>
  )
}

function ModeCard({ active, onClick, icon: Icon, title, desc }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-3 rounded-xl border transition-all ${
        active
          ? 'bg-rl-gold/10 border-rl-gold/40 shadow-sm'
          : 'bg-rl-surface border-rl-border hover:border-rl-gold/30'
      }`}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className={`w-3.5 h-3.5 ${active ? 'text-rl-gold' : 'text-rl-muted'}`} />
        <span className={`text-xs font-bold ${active ? 'text-rl-text' : 'text-rl-muted'}`}>{title}</span>
      </div>
      <p className="text-[10px] text-rl-muted leading-snug">{desc}</p>
    </button>
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
