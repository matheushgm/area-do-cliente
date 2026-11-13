// ─────────────────────────────────────────────────────────────────────────────
// Passos do wizard guiado de Mecanismo Único.
// Cada passo = uma decisão por tela + micro-ensino + exemplo, no mesmo espírito
// do wizard de Oferta Matadora. Usados pela shell interna e pela página pública.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import {
  AlertTriangle, Check, Lightbulb, Trophy, Building2, User, ChevronDown, ChevronUp,
} from 'lucide-react'
import MarkdownBlock from '../Criativos/MarkdownBlock'
import { Label, Field, DynamicStringList, DynamicTable } from './Fields'
import {
  VILOES, TIPOS_PROVA, FORMATOS_NOME, TECNICAS,
  CRITERIOS_VALIDACAO, TESTE_AMIGO, EXEMPLOS_CONEXAO,
  countValidacao, vereditoValidacao,
} from './mecanismoUnicoData'
import { buildPitch } from './mecanismoShared'
import { useI18n } from '../../i18n'

// ─── Caixinhas de apoio ─────────────────────────────────────────────────────
function Ensino({ children }) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-xl bg-rl-purple/5 border border-rl-purple/25">
      <Lightbulb className="w-4 h-4 text-rl-purple mt-0.5 shrink-0" />
      <p className="text-xs text-rl-text leading-relaxed">{children}</p>
    </div>
  )
}

function Exemplo({ children }) {
  const { t } = useI18n()
  return (
    <div className="rounded-xl bg-rl-surface/50 border border-rl-border/60 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-rl-muted mb-1">{t('mecanismoPassos.wizard.exemplo')}</p>
      <p className="text-xs text-rl-subtle leading-relaxed italic">{children}</p>
    </div>
  )
}

// Galeria de exemplos com abas B2B / B2C — mostra a cadeia lógica completa
// (vilão → problema → fracasso) e a prova que a sustenta.
function ExemplosConexao() {
  const { t } = useI18n()
  const [aberto, setAberto] = useState(false)
  const [tipo, setTipo] = useState('b2b')
  const exemplos = EXEMPLOS_CONEXAO[tipo] || []

  const TAGS = [
    { id: 'b2b', label: 'B2B', hint: t('mecanismoPassos.wizard.b2bHint'), Icon: Building2 },
    { id: 'b2c', label: 'B2C', hint: t('mecanismoPassos.wizard.b2cHint'), Icon: User },
  ]

  // Fechado por padrão: o passo já é longo (conexão + prova) e os 10 exemplos
  // empurrariam os campos pra fora da tela.
  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-dashed border-rl-border text-rl-muted hover:text-rl-purple hover:border-rl-purple/40 transition-all"
      >
        <ChevronDown className="w-3.5 h-3.5" />
        {t('mecanismoPassos.wizard.verExemplos')}
      </button>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-[10px] font-bold uppercase tracking-wider text-rl-muted">{t('mecanismoPassos.wizard.exemplos')}</p>
        <div className="flex items-center gap-1 p-1 rounded-lg bg-rl-surface border border-rl-border">
          {TAGS.map((tag) => {
            const active = tipo === tag.id
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => setTipo(tag.id)}
                title={tag.hint}
                className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-md transition-all ${
                  active ? 'bg-rl-purple text-white' : 'text-rl-muted hover:text-rl-text'
                }`}
              >
                <tag.Icon className="w-3 h-3" /> {tag.label}
              </button>
            )
          })}
        </div>
        <span className="text-[10px] text-rl-muted">
          {tipo === 'b2b' ? t('mecanismoPassos.wizard.b2bDesc') : t('mecanismoPassos.wizard.b2cDesc')}
        </span>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-rl-muted hover:text-rl-text transition-colors"
        >
          <ChevronUp className="w-3 h-3" /> {t('mecanismoPassos.wizard.ocultar')}
        </button>
      </div>

      <div className="space-y-2">
        {exemplos.map((ex) => (
          <div key={ex.id} className="rounded-xl bg-rl-surface/50 border border-rl-border/60 p-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-rl-purple">{ex.segmento}</p>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] leading-snug">
              <span className="px-2 py-1 rounded-md bg-rl-red/10 border border-rl-red/25 text-rl-text">{ex.vilao}</span>
              <span className="text-rl-muted font-bold">→</span>
              <span className="px-2 py-1 rounded-md bg-rl-gold/10 border border-rl-gold/25 text-rl-text">{ex.problema}</span>
              <span className="text-rl-muted font-bold">→</span>
              <span className="px-2 py-1 rounded-md bg-rl-border/40 border border-rl-border text-rl-text">{ex.fracasso}</span>
            </div>
            <p className="text-[11px] text-rl-subtle italic leading-relaxed">
              <span className="not-italic font-bold text-rl-muted">{t('mecanismoPassos.wizard.prova')}</span>{ex.prova}
            </p>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-rl-muted leading-relaxed">
        {t('mecanismoPassos.wizard.provaReal')}
      </p>
    </div>
  )
}

// ─── Passo 0 — Concorrentes ─────────────────────────────────────────────────
export function StepConcorrentes({ data, set }) {
  const { t } = useI18n()
  return (
    <div className="space-y-4">
      <Ensino>
        {t('mecanismoPassos.wizard.concorrentesEnsino')}
      </Ensino>
      <DynamicTable
        title={t('mecanismoPassos.campos.seusConcorrentes')}
        hint={t('mecanismoPassos.wizard.concorrentesHint')}
        columns={[
          { id: 'nome',   label: t('mecanismoPassos.campos.concorrente'), placeholder: t('mecanismoPassos.campos.concorrentePh') },
          { id: 'oferta', label: t('mecanismoPassos.campos.oQueOferece'), placeholder: t('mecanismoPassos.campos.oQueOferecePh') },
        ]}
        rows={data.concorrentes}
        onChange={(rows) => set('concorrentes', rows)}
      />
      <Exemplo>
        {t('mecanismoPassos.wizard.concorrentesExemplo')}
      </Exemplo>
    </div>
  )
}

// ─── Passo 1 — Padrão do mercado ────────────────────────────────────────────
export function StepMercado({ data, set }) {
  const { t } = useI18n()
  return (
    <div className="space-y-4">
      <Ensino>
        {t('mecanismoPassos.wizard.mercadoEnsino')}
      </Ensino>
      <DynamicStringList
        title={t('mecanismoPassos.campos.padraoMercado')}
        hint={t('mecanismoPassos.wizard.mercadoHint')}
        placeholder={t('mecanismoPassos.campos.padraoMercadoPh')}
        items={data.padroesMercado}
        onChange={(items) => set('padroesMercado', items)}
      />
      <DynamicStringList
        title={t('mecanismoPassos.campos.promessasComuns')}
        hint={t('mecanismoPassos.campos.promessasComunsHint')}
        placeholder={t('mecanismoPassos.campos.promessasComunsPh')}
        items={data.promessasComuns}
        onChange={(items) => set('promessasComuns', items)}
      />
      <div className="flex items-start gap-2 p-3 rounded-xl bg-rl-gold/5 border border-rl-gold/30">
        <AlertTriangle className="w-4 h-4 text-rl-gold mt-0.5 shrink-0" />
        <p className="text-xs text-rl-text leading-snug">
          <strong>{t('mecanismoPassos.campos.alerta')}</strong> {t('mecanismoPassos.wizard.mercadoAlerta')}
        </p>
      </div>
    </div>
  )
}

// ─── Passo 2 — O que já tentou ──────────────────────────────────────────────
export function StepTentativas({ data, set }) {
  const { t } = useI18n()
  return (
    <div className="space-y-4">
      <Ensino>
        {t('mecanismoPassos.wizard.tentativasEnsino1')}<strong>{t('mecanismoPassos.wizard.tentativasEnsinoDele')}</strong>{t('mecanismoPassos.wizard.tentativasEnsino2')}
      </Ensino>
      <DynamicTable
        title={t('mecanismoPassos.campos.jaTentou')}
        hint=""
        columns={[
          { id: 'tentou',    label: t('mecanismoPassos.campos.oQueTentou'), placeholder: t('mecanismoPassos.campos.oQueTentouPh') },
          { id: 'resultado', label: t('mecanismoPassos.campos.resultado'), placeholder: t('mecanismoPassos.campos.resultadoPh') },
        ]}
        rows={data.tentativas}
        onChange={(rows) => set('tentativas', rows)}
      />
      <DynamicStringList
        title={t('mecanismoPassos.campos.porqueNaoFuncionou')}
        hint={t('mecanismoPassos.wizard.tentativasHint')}
        placeholder={t('mecanismoPassos.campos.porqueNaoFuncionouPh')}
        items={data.justificativas}
        onChange={(items) => set('justificativas', items)}
      />
      <Exemplo>
        {t('mecanismoPassos.wizard.tentativasExemplo')}
      </Exemplo>
    </div>
  )
}

// ─── Passo 3 — O vilão ──────────────────────────────────────────────────────
export function StepVilao({ data, set }) {
  const { t } = useI18n()
  const selected = new Set(data.viloes || [])

  function toggle(id) {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    set('viloes', [...next])
  }

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-xl bg-rl-red/5 border border-rl-red/30">
        <p className="text-xs text-rl-text">
          <strong>{t('mecanismoPassos.campos.regraDeOuro')}</strong> {t('mecanismoPassos.wizard.vilaoRegra')}
        </p>
      </div>

      <div>
        <Label>{t('mecanismoPassos.wizard.vilaoCandidatos')}</Label>
        <p className="text-[11px] text-rl-muted mb-2">{t('mecanismoPassos.campos.quemCulpar')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {VILOES.map((v) => {
            const checked = selected.has(v.id)
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => toggle(v.id)}
                className={`text-left px-3 py-2.5 rounded-xl border text-sm transition-all flex items-center gap-2 ${
                  checked
                    ? 'bg-rl-purple/10 border-rl-purple/50 text-rl-purple'
                    : 'bg-rl-surface border-rl-border text-rl-text hover:border-rl-purple/30'
                }`}
              >
                <div className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center ${
                  checked ? 'border-rl-purple bg-rl-purple' : 'border-rl-border'
                }`}>
                  {checked && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
                <span>{v.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label={t('mecanismoPassos.campos.vilaoPrincipal')}>
          <input
            type="text"
            value={data.vilaoPrincipal || ''}
            onChange={(e) => set('vilaoPrincipal', e.target.value)}
            placeholder={t('mecanismoPassos.campos.vilaoPrincipalPh')}
            className="input-field w-full"
          />
        </Field>
        <Field label={t('mecanismoPassos.campos.porqueVilao')}>
          <input
            type="text"
            value={data.vilaoJustificativa || ''}
            onChange={(e) => set('vilaoJustificativa', e.target.value)}
            placeholder={t('mecanismoPassos.campos.porqueVilaoPh')}
            className="input-field w-full"
          />
        </Field>
      </div>

      <Exemplo>
        {t('mecanismoPassos.wizard.vilaoExemplo')}
      </Exemplo>
    </div>
  )
}

// ─── Passo 4 — Conexão lógica + prova ───────────────────────────────────────
export function StepProva({ data, set, setNested }) {
  const { t } = useI18n()
  const provasSelected = new Set(data.provas || [])

  function toggleProva(id) {
    const next = new Set(provasSelected)
    next.has(id) ? next.delete(id) : next.add(id)
    set('provas', [...next])
  }

  return (
    <div className="space-y-5">
      <Ensino>
        {t('mecanismoPassos.wizard.provaEnsino')}
      </Ensino>

      <div>
        <Label>{t('mecanismoPassos.wizard.conexaoLogica')}</Label>
        <p className="text-[11px] text-rl-muted mb-2">
          {t('mecanismoPassos.campos.cadeia')}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            value={data.conexao?.vilao || ''}
            onChange={(e) => setNested('conexao', 'vilao', e.target.value)}
            placeholder={t('mecanismoPassos.campos.vilao')}
            className="input-field w-full"
          />
          <input
            type="text"
            value={data.conexao?.problema || ''}
            onChange={(e) => setNested('conexao', 'problema', e.target.value)}
            placeholder={t('mecanismoPassos.campos.problemaCausado')}
            className="input-field w-full"
          />
          <input
            type="text"
            value={data.conexao?.fracasso || ''}
            onChange={(e) => setNested('conexao', 'fracasso', e.target.value)}
            placeholder={t('mecanismoPassos.campos.fracassoFinal')}
            className="input-field w-full"
          />
        </div>
      </div>

      <div>
        <Label>{t('mecanismoPassos.wizard.aProva')}</Label>
        <p className="text-[11px] text-rl-muted mb-2">{t('mecanismoPassos.campos.qualProva')}</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
          {TIPOS_PROVA.map((p) => {
            const checked = provasSelected.has(p.id)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleProva(p.id)}
                className={`text-center px-2 py-2 rounded-lg border text-[11px] font-semibold transition-all ${
                  checked
                    ? 'bg-rl-purple/10 border-rl-purple/50 text-rl-purple'
                    : 'bg-rl-surface border-rl-border text-rl-muted hover:text-rl-text hover:border-rl-purple/30'
                }`}
              >
                {p.label}
              </button>
            )
          })}
        </div>
        <textarea
          value={data.provaTexto || ''}
          onChange={(e) => set('provaTexto', e.target.value)}
          rows={3}
          placeholder={t('mecanismoPassos.campos.provaPh')}
          className="input-field w-full resize-none"
        />
      </div>

      <div className="border-t border-rl-border/60 pt-4">
        <ExemplosConexao />
      </div>
    </div>
  )
}

// ─── Passo 5 — O que é diferente ────────────────────────────────────────────
export function StepDiferente({ data, set }) {
  const { t } = useI18n()
  return (
    <div className="space-y-4">
      <Ensino>
        {t('mecanismoPassos.wizard.diferenteEnsino')}
      </Ensino>
      <DynamicTable
        title={t('mecanismoPassos.wizard.diferenteTitulo')}
        hint={t('mecanismoPassos.campos.completeDiferente')}
        columns={[
          { id: 'deles', label: t('mecanismoPassos.campos.diferenteDe'), placeholder: t('mecanismoPassos.campos.diferenteDePh') },
          { id: 'voce',  label: t('mecanismoPassos.campos.eu'), placeholder: t('mecanismoPassos.campos.euPh') },
        ]}
        rows={data.diferentes}
        onChange={(rows) => set('diferentes', rows)}
      />
      <Exemplo>
        {t('mecanismoPassos.wizard.diferenteExemplo')}
      </Exemplo>
    </div>
  )
}

// ─── Passo 6 — Nome do mecanismo ────────────────────────────────────────────
export function StepNome({ data, set }) {
  const { t } = useI18n()
  return (
    <div className="space-y-4">
      <Ensino>
        {t('mecanismoPassos.wizard.nomeEnsino')}
      </Ensino>

      <div>
        <Label>{t('mecanismoPassos.wizard.escolhaFormato')}</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 mt-2">
          {FORMATOS_NOME.map((f) => {
            const active = data.formatoNome === f.id
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => set('formatoNome', active ? '' : f.id)}
                className={`text-left px-3 py-2 rounded-xl border text-xs transition-all ${
                  active
                    ? 'bg-rl-purple/10 border-rl-purple/50 text-rl-purple'
                    : 'bg-rl-surface border-rl-border text-rl-text hover:border-rl-purple/30'
                }`}
              >
                <div className="font-bold">{f.label}</div>
                <div className="text-[10px] text-rl-muted">{t('mecanismoPassos.campos.exemploCurto', { texto: f.exemplo })}</div>
              </button>
            )
          })}
        </div>
        <Field label={t('mecanismoPassos.campos.nomeFinal')}>
          <input
            type="text"
            value={data.nomeMecanismo || ''}
            onChange={(e) => set('nomeMecanismo', e.target.value)}
            placeholder={t('mecanismoPassos.campos.nomeFinalPh')}
            className="input-field w-full"
            maxLength={80}
          />
        </Field>
      </div>

      {data.nomeMecanismo?.trim() && (
        <div className="rounded-xl bg-rl-gold/5 border border-rl-gold/30 p-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-rl-gold mb-1">{t('mecanismoPassos.wizard.seuMecanismo')}</p>
          <p className="text-lg font-black text-rl-text">{data.nomeMecanismo}</p>
        </div>
      )}
    </div>
  )
}

// ─── Passo 7 — Por que funciona ─────────────────────────────────────────────
export function StepPorque({ data, setNested }) {
  const { t } = useI18n()
  return (
    <div className="space-y-4">
      <Ensino>
        {t('mecanismoPassos.wizard.porqueEnsino')}
      </Ensino>
      <div className="space-y-3">
        {TECNICAS.map((tc) => (
          <div key={tc.id}>
            <p className="text-[11px] font-bold text-rl-text mb-1">{tc.label}</p>
            <textarea
              value={(data.tecnicas || {})[tc.id] || ''}
              onChange={(e) => setNested('tecnicas', tc.id, e.target.value)}
              rows={2}
              placeholder={tc.placeholder}
              className="input-field w-full resize-none"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Passo 8 — Montagem do pitch ────────────────────────────────────────────
export function StepMontagem({ data, set, setNested }) {
  const { t } = useI18n()
  return (
    <div className="space-y-5">
      <Ensino>
        {t('mecanismoPassos.wizard.montagemEnsino')}
      </Ensino>

      <div className="space-y-3">
        <Field label={t('mecanismoPassos.campos.euAjudo')}>
          <textarea
            value={data.euAjudo || ''}
            onChange={(e) => set('euAjudo', e.target.value)}
            rows={2}
            placeholder={t('mecanismoPassos.campos.euAjudoPh')}
            className="input-field w-full resize-none"
          />
        </Field>
        <Field label={t('mecanismoPassos.campos.aConseguir')}>
          <textarea
            value={data.aConseguir || ''}
            onChange={(e) => set('aConseguir', e.target.value)}
            rows={2}
            placeholder={t('mecanismoPassos.campos.aConseguirPh')}
            className="input-field w-full resize-none"
          />
        </Field>
        <Field label={t('mecanismoPassos.campos.atravesDo')}>
          <input
            type="text"
            value={data.atravesDo || data.nomeMecanismo || ''}
            onChange={(e) => set('atravesDo', e.target.value)}
            placeholder={data.nomeMecanismo || t('mecanismoPassos.campos.atravesDoPh')}
            className="input-field w-full"
          />
        </Field>
      </div>

      <div className="border-t border-rl-border/60 pt-4">
        <Label>{t('mecanismoPassos.campos.parte1')}</Label>
        <div className="space-y-2 mt-2">
          <textarea
            value={data.porqueFalhou?.problema || ''}
            onChange={(e) => setNested('porqueFalhou', 'problema', e.target.value)}
            rows={2}
            placeholder={t('mecanismoPassos.campos.falhouProblemaPh')}
            className="input-field w-full resize-none"
          />
          <textarea
            value={data.porqueFalhou?.razao || ''}
            onChange={(e) => setNested('porqueFalhou', 'razao', e.target.value)}
            rows={2}
            placeholder={t('mecanismoPassos.campos.falhouRazaoPh')}
            className="input-field w-full resize-none"
          />
          <textarea
            value={data.porqueFalhou?.prova || ''}
            onChange={(e) => setNested('porqueFalhou', 'prova', e.target.value)}
            rows={2}
            placeholder={t('mecanismoPassos.campos.falhouProvaPh')}
            className="input-field w-full resize-none"
          />
        </div>
      </div>

      <div className="border-t border-rl-border/60 pt-4">
        <Label>{t('mecanismoPassos.campos.parte2')}</Label>
        <div className="space-y-2 mt-2">
          <textarea
            value={data.porqueFunciona?.explicacao || ''}
            onChange={(e) => setNested('porqueFunciona', 'explicacao', e.target.value)}
            rows={2}
            placeholder={t('mecanismoPassos.campos.funcionaExplicacaoPh')}
            className="input-field w-full resize-none"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <textarea
              value={data.porqueFunciona?.diferente || ''}
              onChange={(e) => setNested('porqueFunciona', 'diferente', e.target.value)}
              rows={2}
              placeholder={t('mecanismoPassos.campos.funcionaDiferentePh')}
              className="input-field w-full resize-none"
            />
            <textarea
              value={data.porqueFunciona?.voce || ''}
              onChange={(e) => setNested('porqueFunciona', 'voce', e.target.value)}
              rows={2}
              placeholder={t('mecanismoPassos.campos.funcionaVocePh')}
              className="input-field w-full resize-none"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-rl-border/60 pt-4">
        <Label>{t('mecanismoPassos.campos.promessaFinal')}</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
          <Field label={t('mecanismoPassos.campos.prazo')}>
            <input
              type="text"
              value={data.promessaPrazo || ''}
              onChange={(e) => set('promessaPrazo', e.target.value)}
              placeholder={t('mecanismoPassos.campos.prazoPh')}
              className="input-field w-full"
            />
          </Field>
          <Field label={t('mecanismoPassos.campos.resultadoPromessa')}>
            <input
              type="text"
              value={data.promessaResultado || ''}
              onChange={(e) => set('promessaResultado', e.target.value)}
              placeholder={t('mecanismoPassos.campos.resultadoPromessaPh')}
              className="input-field w-full"
            />
          </Field>
        </div>
      </div>
    </div>
  )
}

// ─── Passo 9 — Validação ────────────────────────────────────────────────────
export function StepValidacao({ data, set }) {
  const { t } = useI18n()
  const count = countValidacao(data.validacao)
  const veredito = vereditoValidacao(data.validacao)

  function setCriterio(id, val) {
    set('validacao', { ...(data.validacao || {}), [id]: val })
  }

  return (
    <div className="space-y-5">
      <Ensino>
        {t('mecanismoPassos.wizard.validacaoEnsino')}
      </Ensino>

      <div className="space-y-2">
        {CRITERIOS_VALIDACAO.map((c, i) => {
          const cur = (data.validacao || {})[c.id]
          return (
            <div key={c.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-rl-surface/40 border border-rl-border/60">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-rl-text">
                  {i + 1}. {c.label} <span className="text-rl-muted font-normal">— {c.desc}</span>
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setCriterio(c.id, cur === 'sim' ? '' : 'sim')}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${
                    cur === 'sim'
                      ? 'bg-rl-green/15 border border-rl-green/40 text-rl-green'
                      : 'bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text'
                  }`}
                >
                  {t('mecanismoPassos.campos.sim')}
                </button>
                <button
                  type="button"
                  onClick={() => setCriterio(c.id, cur === 'nao' ? '' : 'nao')}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${
                    cur === 'nao'
                      ? 'bg-rl-red/15 border border-rl-red/40 text-rl-red'
                      : 'bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text'
                  }`}
                >
                  {t('mecanismoPassos.campos.nao')}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div
        className="rounded-xl p-4 border-l-4"
        style={{ background: `${veredito.color}10`, borderLeftColor: veredito.color }}
      >
        <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: veredito.color }}>
          {t('mecanismoPassos.campos.veredito', { count })}
        </p>
        <p className="text-sm font-bold" style={{ color: veredito.color }}>{veredito.label}</p>
      </div>

      <div>
        <Label>{t('mecanismoPassos.campos.testeAmigo')}</Label>
        <p className="text-[11px] text-rl-muted mb-2">
          {t('mecanismoPassos.campos.testeAmigoHint')}
        </p>
        <div className="space-y-2">
          {TESTE_AMIGO.map((ta) => {
            const active = data.testeAmigo === ta.id
            return (
              <button
                key={ta.id}
                type="button"
                onClick={() => set('testeAmigo', active ? '' : ta.id)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-center justify-between ${
                  active
                    ? ta.id === 'aprovado'
                      ? 'bg-rl-green/10 border-rl-green/50 text-rl-green'
                      : 'bg-rl-red/10 border-rl-red/50 text-rl-red'
                    : 'bg-rl-surface border-rl-border text-rl-text hover:border-rl-purple/30'
                }`}
              >
                <span className="text-sm">{ta.label}</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                  active
                    ? ta.id === 'aprovado' ? 'text-rl-green' : 'text-rl-red'
                    : 'text-rl-muted'
                }`}>
                  → {ta.resultado}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Passo final — pitch montado ────────────────────────────────────────────
export function StepPitchPreview({ data }) {
  const { t } = useI18n()
  const pitch = buildPitch(data)
  if (!pitch) {
    return (
      <p className="text-sm text-rl-muted text-center py-8 italic">
        {t('mecanismoPassos.wizard.semPitch')}
      </p>
    )
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Trophy className="w-4 h-4 text-rl-gold" />
        <h4 className="text-sm font-bold text-rl-text">{t('mecanismoPassos.wizard.seuPitch')}</h4>
      </div>
      <div className="rounded-xl bg-rl-surface/50 border border-rl-border p-4">
        <MarkdownBlock content={pitch} />
      </div>
    </div>
  )
}
