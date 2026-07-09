import { Wrench, Users, Infinity as InfinityIcon, Clock, CheckCircle2 } from 'lucide-react'
import MoneyInput from '../UI/MoneyInput'
import PercentInput from '../UI/PercentInput'
import { calcularSaas } from './precificacaoMath'
import { fmtMoney } from '../Resultados/resultadosHelpers'

// Formulário de inputs do modo SaaS.
// Recebe os values + onChange(field, val) do parent — não cuida de cálculo
// nem de persistência (essas responsabilidades ficam no PrecificacaoItemModal).
//
// Três decisões guiam o preenchimento:
//   1. Tem implantação? → custo hora-homem × horas + margem de onboarding.
//   2. Cobrança por usuário (seats) ou ilimitado (flat).
//   3. Tempo médio que o cliente fica ativo → projeta o LTV.
export default function PrecificacaoSaasForm({ values, onChange }) {
  const set = (field) => (v) => onChange(field, v)
  const calc = calcularSaas(values)

  const temImplantacao = !!values.temImplantacao
  const porUsuario = values.modeloCobranca === 'por_usuario'

  return (
    <div className="space-y-5">
      <Field label="Nome do plano / SaaS" hint="Como esse plano vai aparecer na lista.">
        <input
          type="text"
          value={values.nome || ''}
          onChange={(e) => set('nome')(e.target.value)}
          placeholder="Ex: Plano Pro — CRM"
          maxLength={80}
          className="input-field w-full"
        />
      </Field>

      {/* ── 1. Implantação / Onboarding ─────────────────────────────────── */}
      <Section icon={Wrench} title="1. Implantação (onboarding)">
        <ToggleRow
          label="Este SaaS tem implantação?"
          hint="Setup, integração, treinamento — cobrado uma vez no início."
          value={temImplantacao}
          onChange={(v) => set('temImplantacao')(v)}
        />

        {temImplantacao && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Custo hora-homem" hint="Quanto custa 1 hora da equipe que faz o onboarding.">
                <MoneyInput
                  value={values.custoHoraHomem}
                  onChange={set('custoHoraHomem')}
                  maxWidth="max-w-none"
                />
              </Field>
              <Field label="Horas de implantação" hint="Total de horas pra colocar 1 cliente no ar.">
                <input
                  type="number"
                  min="0"
                  value={values.horasImplantacao ?? ''}
                  onChange={(e) => set('horasImplantacao')(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Ex: 20"
                  className="input-field w-full"
                />
              </Field>
            </div>

            <Field label="Margem sobre a implantação (%)" hint="Lucro que você quer no setup, além de custo e imposto.">
              <PercentInput
                value={values.margemImplantacaoPct}
                onChange={set('margemImplantacaoPct')}
                placeholder="Ex: 40"
                maxWidth="max-w-none"
              />
            </Field>

            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-rl-surface/50 border border-rl-border">
              <span className="text-[11px] uppercase tracking-wide text-rl-muted font-semibold">
                Custo da implantação
              </span>
              <span className="text-sm font-bold text-rl-text tabular-nums">
                {fmtMoney(calc.custoImplantacao)}
              </span>
            </div>
          </div>
        )}
      </Section>

      {/* ── 2. Modelo de cobrança ───────────────────────────────────────── */}
      <Section icon={porUsuario ? Users : InfinityIcon} title="2. Cobrança recorrente">
        <Field label="Como cobra a mensalidade?" hint="Por usuário (seats) ou ilimitado (valor fixo por conta).">
          <div className="grid grid-cols-2 gap-2">
            <ModeCard
              active={porUsuario}
              onClick={() => set('modeloCobranca')('por_usuario')}
              icon={Users}
              title="Por usuário"
              desc="Preço por seat × nº de usuários"
            />
            <ModeCard
              active={!porUsuario}
              onClick={() => set('modeloCobranca')('ilimitado')}
              icon={InfinityIcon}
              title="Ilimitado"
              desc="Valor fixo por conta, sem limite de usuários"
            />
          </div>
        </Field>

        <Field
          label="Custo mensal fixo por conta"
          hint="Infra, servidor, licenças e suporte pra manter 1 cliente ativo por mês."
        >
          <MoneyInput
            value={values.custoMensalConta}
            onChange={set('custoMensalConta')}
            maxWidth="max-w-none"
          />
        </Field>

        {porUsuario && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Custo mensal por usuário" hint="Custo marginal de cada seat adicional (licença, storage...).">
              <MoneyInput
                value={values.custoMensalUsuario}
                onChange={set('custoMensalUsuario')}
                maxWidth="max-w-none"
              />
            </Field>
            <Field label="Nº de usuários do plano" hint="Quantidade de seats considerada pra este plano.">
              <input
                type="number"
                min="1"
                value={values.numUsuarios ?? ''}
                onChange={(e) => set('numUsuarios')(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Ex: 5"
                className="input-field w-full"
              />
            </Field>
          </div>
        )}
      </Section>

      {/* ── 3. Ciclo de vida + fiscais ──────────────────────────────────── */}
      <Section icon={Clock} title="3. Ciclo de vida & margem">
        <Field
          label="Tempo médio ativo (meses)"
          hint="Quanto tempo, em média, um cliente fica pagando antes de cancelar. Usado pra projetar o LTV."
        >
          <input
            type="number"
            min="0"
            value={values.tempoMedioAtivoMeses ?? ''}
            onChange={(e) => set('tempoMedioAtivoMeses')(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="Ex: 24"
            className="input-field w-full"
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
            label="Margem de lucro na mensalidade (%)"
            hint="Lucro líquido que sobra da mensalidade depois de custos e impostos."
          >
            <PercentInput
              value={values.margemPct}
              onChange={set('margemPct')}
              placeholder="Ex: 30"
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
        {value && <CheckCircle2 className="w-3.5 h-3.5" />} Sim, tem
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
        Não tem
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
