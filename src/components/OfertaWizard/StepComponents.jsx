// ─────────────────────────────────────────────────────────────────────────────
// Componentes de cada passo do Wizard de Oferta Matadora.
// Cada step recebe { oferta, set, project } e edita ofertaData via set(field, val).
// A geração final (StepFinal) recebe callbacks da página.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { Plus, X, Sparkles, Loader2, CheckCircle2, Zap, AlertTriangle, Info, Pencil } from 'lucide-react'
import {
  DRIVERS, DRIVER_BY_ID, ATENCAO_OPTS, ESFORCO_OPTS, MEIO_OPTS,
  ESCASSEZ_TIPOS, URGENCIA_TIPOS, GARANTIA_TIPOS, uid, aiAssist, rotuloMeio,
} from './ofertaShared'
import { t, useI18n, localeAtual } from '../../i18n'
import {
  OM_QUESTIONS, computeOmDiagnosis, getVerdict,
} from '../Kickoff/KickoffOfertaMatadora'

// ─── UI helpers ─────────────────────────────────────────────────────────────
function Field({ label, emoji, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-rl-text">
        {emoji && <span className="mr-1.5">{emoji}</span>}{label}
      </label>
      {hint && <p className="text-xs text-rl-muted">{hint}</p>}
      {children}
    </div>
  )
}

function Example({ b2b, b2c }) {
  return (
    <div className="grid sm:grid-cols-2 gap-2 text-xs">
      <div className="rounded-lg bg-rl-purple/5 border border-rl-purple/15 p-2.5">
        <p className="font-semibold text-rl-purple mb-0.5">🏢 B2B</p>
        <p className="text-rl-muted leading-relaxed">{b2b}</p>
      </div>
      <div className="rounded-lg bg-rl-gold/5 border border-rl-gold/15 p-2.5">
        <p className="font-semibold text-rl-gold mb-0.5">🙋 B2C</p>
        <p className="text-rl-muted leading-relaxed">{b2c}</p>
      </div>
    </div>
  )
}

function AIButton({ onClick, loading, label }) {
  const { t } = useI18n()
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-rl-gold hover:text-rl-gold/80 transition-colors disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
      {loading ? t('ofertaPassos.gerando') : `💡 ${label || t('ofertaPassos.sugerirIa')}`}
    </button>
  )
}

function useAssist(project, oferta) {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)
  const run = async (kind) => {
    setLoading(true); setErr(null)
    try { return await aiAssist({ kind, project, oferta }) }
    catch (e) { setErr(e.message); return null }
    finally { setLoading(false) }
  }
  return { run, loading, err }
}

// Modo "uma pergunta por vez": `q` é o índice da pergunta do passo.
// Sem `q` (modo "tudo junto") o passo renderiza todas as perguntas.
function pick(items, q) {
  if (q == null) return items
  return items[Math.max(0, Math.min(q, items.length - 1))] ?? null
}
const isAll = (q) => q == null

function ChoiceCards({ options, value, onChange }) {
  return (
    <div className="grid sm:grid-cols-3 gap-2">
      {options.map((o) => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`text-left p-3 rounded-xl border transition-all ${
              active ? 'border-rl-gold bg-rl-gold/10' : 'border-rl-border hover:border-rl-gold/40'
            }`}
          >
            <p className="text-sm font-semibold text-rl-text">{o.label}</p>
            {o.hint && <p className="text-[11px] text-rl-muted mt-0.5 leading-snug">{o.hint}</p>}
          </button>
        )
      })}
    </div>
  )
}

// ─── Passo 0: Diagnóstico ───────────────────────────────────────────────────
export function StepDiagnostico({ oferta, set, q, avancar }) {
  const { t } = useI18n()
  const answers = oferta.diagnostico?.answers || {}
  const diag = computeOmDiagnosis(answers)

  const answer = (qid, val) => {
    const next = { ...answers, [qid]: val }
    set('diagnostico', { answers: next, ...computeOmDiagnosis(next) })
    avancar?.()
  }

  const verdict = getVerdict(diag.totalScore)
  const answeredAll = diag.answeredCount === OM_QUESTIONS.length

  const tipo = (
    <Field key="tipo" label={t('ofertaPassos.diagnostico.seuCliente')} emoji="🎯" hint={t('ofertaPassos.diagnostico.seuClienteDica')}>
      <div className="grid grid-cols-2 gap-2">
        {[{ v: 'b2b', l: `🏢 ${t('ofertaPassos.diagnostico.b2b')}` }, { v: 'b2c', l: `🙋 ${t('ofertaPassos.diagnostico.b2c')}` }].map((tp) => (
          <button
            key={tp.v}
            onClick={() => { set('tipoCliente', tp.v); avancar?.() }}
            className={`p-3 rounded-xl border text-sm font-semibold transition-all ${
              oferta.tipoCliente === tp.v ? 'border-rl-gold bg-rl-gold/10 text-rl-text' : 'border-rl-border text-rl-muted hover:border-rl-gold/40'
            }`}
          >{tp.l}</button>
        ))}
      </div>
    </Field>
  )

  const perguntas = OM_QUESTIONS.map((qq) => (
    <div key={qq.id} className="glass-card p-4 space-y-2">
      <p className="text-sm font-medium text-rl-text">{qq.label}</p>
      {qq.hint && <p className="text-xs text-rl-muted">{qq.hint}</p>}
      <div className="space-y-1.5 pt-1">
        {qq.options.map((o) => (
          <button
            key={o.value}
            onClick={() => answer(qq.id, o.value)}
            className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-all ${
              answers[qq.id] === o.value ? 'border-rl-gold bg-rl-gold/10 text-rl-text' : 'border-rl-border text-rl-muted hover:border-rl-gold/40'
            }`}
          >{o.label}</button>
        ))}
      </div>
    </div>
  ))

  return (
    <div className="space-y-5">
      <p className="text-sm text-rl-muted">
        {t('ofertaPassos.diagnostico.intro')}
      </p>

      {pick([tipo, ...perguntas], q)}

      {/* Veredito (no modo uma por vez, só na última pergunta) */}
      {answeredAll && (isAll(q) || q === OM_QUESTIONS.length) && (
        <div className="glass-card p-4 border" style={{ borderColor: verdict.color + '55' }}>
          <p className="text-sm font-bold" style={{ color: verdict.color }}>
            {verdict.emoji} {verdict.label} · {diag.totalScore}/100
          </p>
          <p className="text-xs text-rl-muted mt-1 leading-relaxed">{verdict.desc}</p>
          {verdict.id === 'nao_cabe' && (
            <p className="text-[11px] text-rl-muted mt-2 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {t('ofertaPassos.diagnostico.naoCabe')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Passo 1: Sonho ─────────────────────────────────────────────────────────
export function StepSonho({ oferta, set, project, publicMode, q }) {
  const { t } = useI18n()
  const { run, loading, err } = useAssist(project, oferta)
  const suggest = async () => {
    const r = await run('sonho')
    if (r) {
      if (r.dorAtual) set('dorAtual', r.dorAtual)
      if (r.resultadoSonho) set('resultadoSonho', r.resultadoSonho)
      if (r.statusGanho) set('statusGanho', r.statusGanho)
    }
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-rl-muted">{t('ofertaPassos.sonho.intro1')}<b>{t('ofertaPassos.sonho.intro2')}</b>{t('ofertaPassos.sonho.intro3')}<b>{t('ofertaPassos.sonho.intro4')}</b>{t('ofertaPassos.sonho.intro5')}</p>
      {!publicMode && <div className="flex justify-end"><AIButton onClick={suggest} loading={loading} label={t('ofertaPassos.sonho.ia')} /></div>}
      {err && <ErrLine msg={err} />}
      {pick([
        <Field key="dor" label={t('ofertaPassos.sonho.dor')} emoji="😣">
          <textarea rows={isAll(q) ? 2 : 4} value={oferta.dorAtual} onChange={(e) => set('dorAtual', e.target.value)} className="input-field resize-none text-sm" placeholder={t('ofertaPassos.sonho.dorPh')} />
        </Field>,
        <Field key="sonho" label={t('ofertaPassos.sonho.sonho')} emoji="✨">
          <textarea rows={isAll(q) ? 2 : 4} value={oferta.resultadoSonho} onChange={(e) => set('resultadoSonho', e.target.value)} className="input-field resize-none text-sm" placeholder={t('ofertaPassos.sonho.sonhoPh')} />
        </Field>,
        <Field key="status" label={t('ofertaPassos.sonho.status')} emoji="👑">
          <input type="text" value={oferta.statusGanho} onChange={(e) => set('statusGanho', e.target.value)} className="input-field text-sm" placeholder={t('ofertaPassos.sonho.statusPh')} />
        </Field>,
      ], q)}
      <Example b2b={t('ofertaPassos.sonho.exB2b')} b2c={t('ofertaPassos.sonho.exB2c')} />
    </div>
  )
}

// ─── Passo 2: Problemas (4 drivers) ─────────────────────────────────────────
export function StepProblemas({ oferta, set, project, publicMode, q }) {
  const { t } = useI18n()
  const { run, loading, err } = useAssist(project, oferta)
  const problemas = oferta.problemas || []
  const add = (driver) => set('problemas', [...problemas, { id: uid(), texto: '', driver }])
  const update = (id, texto) => set('problemas', problemas.map((p) => (p.id === id ? { ...p, texto } : p)))
  const remove = (id) => set('problemas', problemas.filter((p) => p.id !== id))
  const suggest = async () => {
    const r = await run('problemas')
    if (Array.isArray(r)) {
      const mapped = r.filter((x) => x?.texto).map((x) => ({ id: uid(), texto: x.texto, driver: DRIVER_BY_ID[x.driver] ? x.driver : 'valor' }))
      set('problemas', [...problemas, ...mapped])
    }
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-rl-muted">{t('ofertaPassos.problemas.intro1')}<b>{t('ofertaPassos.problemas.intro2')}</b>{t('ofertaPassos.problemas.intro3')}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-rl-muted">{t('ofertaPassos.problemas.contagem', { count: problemas.length })}</span>
        {!publicMode && <AIButton onClick={suggest} loading={loading} label={t('ofertaPassos.problemas.ia')} />}
      </div>
      {err && <ErrLine msg={err} />}
      <div className={isAll(q) ? 'grid md:grid-cols-2 gap-3' : 'space-y-3'}>
        {pick(DRIVERS.map((d) => (
          <div key={d.id} className="glass-card p-3 space-y-2">
            {!isAll(q) && <p className="text-sm font-medium text-rl-text">{t('ofertaPassos.problemas.pergunta', { tipo: d.label })}</p>}
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
              <p className="text-sm font-semibold text-rl-text">{d.label}</p>
            </div>
            <p className="text-[11px] text-rl-muted">{d.hint}</p>
            {problemas.filter((p) => p.driver === d.id).map((p) => (
              <div key={p.id} className="flex items-center gap-1.5">
                <input value={p.texto} onChange={(e) => update(p.id, e.target.value)} placeholder={t('ofertaPassos.problemas.objecaoPh')} className={`input-field flex-1 ${isAll(q) ? 'py-1.5 text-xs' : 'py-2 text-sm'}`} />
                <button onClick={() => remove(p.id)} className="p-1 text-rl-muted hover:text-rl-red shrink-0"><X className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            <button onClick={() => add(d.id)} className="flex items-center gap-1 text-xs text-rl-purple hover:text-rl-purple/80">
              <Plus className="w-3.5 h-3.5" /> {t('comum.adicionar')}
            </button>
          </div>
        )), q)}
      </div>
    </div>
  )
}

// ─── Passo 3: Soluções ──────────────────────────────────────────────────────
export function StepSolucoes({ oferta, set, project, publicMode, q }) {
  const { t } = useI18n()
  const { run, loading, err } = useAssist(project, oferta)
  const problemas = oferta.problemas || []
  const solucoes = oferta.solucoes || []
  const getSol = (pid) => solucoes.find((s) => s.problemaId === pid)
  const setSol = (pid, comoResolve) => {
    const exists = getSol(pid)
    if (exists) set('solucoes', solucoes.map((s) => (s.problemaId === pid ? { ...s, comoResolve } : s)))
    else set('solucoes', [...solucoes, { id: uid(), problemaId: pid, comoResolve }])
  }
  const suggest = async () => {
    const r = await run('solucoes')
    if (Array.isArray(r)) {
      const next = [...solucoes]
      r.forEach((x) => {
        if (!x?.id || !x?.comoResolve) return
        const i = next.findIndex((s) => s.problemaId === x.id)
        if (i >= 0) next[i] = { ...next[i], comoResolve: x.comoResolve }
        else next.push({ id: uid(), problemaId: x.id, comoResolve: x.comoResolve })
      })
      set('solucoes', next)
    }
  }
  const done = problemas.filter((p) => getSol(p.id)?.comoResolve?.trim()).length
  if (!problemas.length) return <EmptyHint text={t('ofertaPassos.solucoes.vazio')} />
  return (
    <div className="space-y-4">
      <p className="text-sm text-rl-muted">{t('ofertaPassos.solucoes.intro1')}<b>{t('ofertaPassos.solucoes.intro2')}</b>{t('ofertaPassos.solucoes.intro3')}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-rl-muted">{t('ofertaPassos.solucoes.resolvidos', { feitos: done, total: problemas.length })}</span>
        {!publicMode && <AIButton onClick={suggest} loading={loading} label={t('ofertaPassos.solucoes.ia')} />}
      </div>
      {err && <ErrLine msg={err} />}
      <div className="space-y-2">
        {pick(problemas.map((p) => (
          <div key={p.id} className="glass-card p-3 space-y-1.5">
            {!isAll(q) && <p className="text-[11px] uppercase tracking-wide text-rl-muted">{t('ofertaPassos.solucoes.objecao')} · {DRIVER_BY_ID[p.driver]?.label}</p>}
            <p className={`${isAll(q) ? 'text-xs text-rl-muted' : 'text-sm font-medium text-rl-text'} flex items-center gap-1.5`}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: DRIVER_BY_ID[p.driver]?.color }} />
              {p.texto || t('ofertaPassos.objecaoSemTexto')}
            </p>
            <input value={getSol(p.id)?.comoResolve || ''} onChange={(e) => setSol(p.id, e.target.value)} placeholder={t('ofertaPassos.solucoes.comoPh')} className="input-field text-sm" />
          </div>
        )), q)}
      </div>
    </div>
  )
}

// ─── Passo 4: Entrega ───────────────────────────────────────────────────────
export function StepEntrega({ oferta, set, q }) {
  const { t } = useI18n()
  const e = oferta.entrega || {}
  const setE = (k, v) => set('entrega', { ...e, [k]: v })
  const toggleMeio = (m) => {
    const cur = e.meio || []
    setE('meio', cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m])
  }
  return (
    <div className="space-y-5">
      <p className="text-sm text-rl-muted">{t('ofertaPassos.entrega.intro')}</p>
      {pick([
        <Field key="atencao" label={t('ofertaPassos.entrega.atencao')} emoji="👥"><ChoiceCards options={ATENCAO_OPTS} value={e.atencao} onChange={(v) => setE('atencao', v)} /></Field>,
        <Field key="esforco" label={t('ofertaPassos.entrega.esforco')} emoji="🛠️"><ChoiceCards options={ESFORCO_OPTS} value={e.esforcoModelo} onChange={(v) => setE('esforcoModelo', v)} /></Field>,
        <Field key="meio" label={t('ofertaPassos.entrega.meio')} emoji="📡" hint={t('ofertaPassos.entrega.meioDica')}>
          <div className="flex flex-wrap gap-2">
            {MEIO_OPTS.map((m) => {
              const active = (e.meio || []).includes(m)
              return (
                <button key={m} onClick={() => toggleMeio(m)} className={`px-3 py-1.5 rounded-full text-xs border transition-all ${active ? 'border-rl-gold bg-rl-gold/10 text-rl-text' : 'border-rl-border text-rl-muted hover:border-rl-gold/40'}`}>{rotuloMeio(m)}</button>
              )
            })}
          </div>
        </Field>,
      ], q)}
      <Example b2b={t('ofertaPassos.entrega.exB2b')} b2c={t('ofertaPassos.entrega.exB2c')} />
    </div>
  )
}

// ─── Passo 5: Núcleo + Stack + Preço ────────────────────────────────────────
export function StepNucleo({ oferta, set, project, publicMode, q }) {
  const { t, locale } = useI18n()
  const { run, loading, err } = useAssist(project, oferta)
  const stack = oferta.itensStack || []
  const addItem = () => set('itensStack', [...stack, { id: uid(), nome: '', tipo: 'entrega', valor: '' }])
  const updItem = (id, patch) => set('itensStack', stack.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  const rmItem = (id) => set('itensStack', stack.filter((i) => i.id !== id))
  const total = stack.reduce((s, i) => s + (Number(i.valor) || 0), 0)
  const preco = Number(oferta.preco) || 0
  const ratio = preco > 0 ? total / preco : 0
  const suggest = async () => {
    const r = await run('stack')
    if (Array.isArray(r)) {
      const mapped = r.filter((x) => x?.nome).map((x) => ({ id: uid(), nome: x.nome, tipo: 'entrega', valor: x.valor || '' }))
      set('itensStack', [...stack, ...mapped])
    }
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-rl-muted">{t('ofertaPassos.nucleo.intro1')}<b>{t('ofertaPassos.nucleo.intro2')}</b>{t('ofertaPassos.nucleo.intro3')}</p>
      {pick([
      <Field key="nucleo" label={t('ofertaPassos.nucleo.nucleo')} emoji="🎯">
        <input value={oferta.nucleo} onChange={(e) => set('nucleo', e.target.value)} className="input-field text-sm" placeholder={t('ofertaPassos.nucleo.nucleoPh')} />
      </Field>,

      <div key="stack" className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-rl-text">📦 {t('ofertaPassos.nucleo.entregas')}</p>
        {!publicMode && <AIButton onClick={suggest} loading={loading} label={t('ofertaPassos.nucleo.ia')} />}
      </div>
      <p className="text-xs text-rl-muted">{t('ofertaPassos.nucleo.entregasDica')}</p>
      {err && <ErrLine msg={err} />}
      <div className="space-y-2">
        {stack.map((i, idx) => (
          <div key={i.id} className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-rl-muted w-20 shrink-0">{t('ofertaPassos.nucleo.entregaN', { n: idx + 1 })}</span>
            <input value={i.nome} onChange={(ev) => updItem(i.id, { nome: ev.target.value })} placeholder={t('ofertaPassos.nucleo.entregaPh')} className="input-field flex-1 py-1.5 text-xs" />
            <div className="flex items-center gap-0.5 shrink-0">
              <span className="text-[11px] text-rl-muted">R$</span>
              <input type="number" value={i.valor} onChange={(ev) => updItem(i.id, { valor: ev.target.value })} placeholder="0" className="input-field py-1.5 text-xs w-20" />
            </div>
            <button onClick={() => rmItem(i.id)} className="p-1 text-rl-muted hover:text-rl-red shrink-0"><X className="w-3.5 h-3.5" /></button>
          </div>
        ))}
        <button onClick={() => addItem()} className="flex items-center gap-1 text-xs text-rl-purple hover:text-rl-purple/80"><Plus className="w-3.5 h-3.5" /> {t('ofertaPassos.nucleo.adicionarEntrega')}</button>
      </div>
      </div>,

        <Field key="preco" label={t('ofertaPassos.nucleo.preco')} emoji="💰">
          <input type="number" value={oferta.preco} onChange={(e) => set('preco', e.target.value)} className="input-field text-sm" placeholder={t('ofertaPassos.nucleo.precoPh')} />
        </Field>,
        <Field key="velocidade" label={t('ofertaPassos.nucleo.velocidade')} emoji="⚡">
          <input value={oferta.velocidade} onChange={(e) => set('velocidade', e.target.value)} className="input-field text-sm" placeholder={t('ofertaPassos.nucleo.velocidadePh')} />
        </Field>,
      <Field key="esforco" label={t('ofertaPassos.nucleo.esforco')} emoji="🤝" hint={t('ofertaPassos.nucleo.esforcoDica')}>
        <textarea rows={2} value={oferta.esforcoMinimo} onChange={(e) => set('esforcoMinimo', e.target.value)} className="input-field resize-none text-sm" placeholder={t('ofertaPassos.nucleo.esforcoPh')} />
      </Field>,
      ], q)}

      {(total > 0 || preco > 0) && (isAll(q) || q === 1 || q === 2) && (
        <div className={`rounded-xl p-3 text-sm border ${ratio >= 10 ? 'border-green-500/40 bg-green-500/5' : ratio >= 3 ? 'border-rl-gold/40 bg-rl-gold/5' : 'border-rl-red/40 bg-rl-red/5'}`}>
          <p className="text-rl-text font-semibold">{t('ofertaPassos.nucleo.razao', { total: total.toLocaleString(locale), preco: preco.toLocaleString(locale) })}
            {ratio > 0 && <> · <b>{ratio.toFixed(1)}x</b></>}</p>
          <p className="text-xs text-rl-muted mt-0.5">
            {ratio >= 10 ? t('ofertaPassos.nucleo.razaoOtima') : ratio >= 3 ? t('ofertaPassos.nucleo.razaoOk') : ratio > 0 ? t('ofertaPassos.nucleo.razaoFraca') : t('ofertaPassos.nucleo.razaoVazia')}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Passo 6: Escassez + Urgência ───────────────────────────────────────────
export function StepEscassez({ oferta, set, q }) {
  const { t } = useI18n()
  const pickEsc = (tp) => {
    set('escassezTipo', tp.value)
    if (tp.tpl && !oferta.escassez) set('escassez', tp.tpl)
  }
  const pickUrg = (tp) => {
    set('urgenciaTipo', tp.value)
    if (tp.tpl && !oferta.urgencia) set('urgencia', tp.tpl)
  }
  return (
    <div className="space-y-5">
      <p className="text-sm text-rl-muted"><b>{t('ofertaPassos.escassez.escassez')}</b>{t('ofertaPassos.escassez.intro1')}<b>{t('ofertaPassos.escassez.urgencia')}</b>{t('ofertaPassos.escassez.intro2')}<b>{t('ofertaPassos.escassez.intro3')}</b>{t('ofertaPassos.escassez.intro4')}</p>
      {pick([
      <Field key="escassez" label={t('ofertaPassos.escassez.escassez')} emoji="🔒">
        <div className="flex flex-wrap gap-2 mb-2">
          {ESCASSEZ_TIPOS.map((tp) => (
            <button key={tp.value} onClick={() => pickEsc(tp)} className={`px-3 py-1.5 rounded-full text-xs border transition-all ${oferta.escassezTipo === tp.value ? 'border-rl-gold bg-rl-gold/10 text-rl-text' : 'border-rl-border text-rl-muted hover:border-rl-gold/40'}`}>{tp.label}</button>
          ))}
        </div>
        <input value={oferta.escassez} onChange={(e) => set('escassez', e.target.value)} className="input-field text-sm" placeholder={t('ofertaPassos.escassez.escassezPh')} />
      </Field>,
      <Field key="urgencia" label={t('ofertaPassos.escassez.urgencia')} emoji="⏳">
        <div className="flex flex-wrap gap-2 mb-2">
          {URGENCIA_TIPOS.map((tp) => (
            <button key={tp.value} onClick={() => pickUrg(tp)} className={`px-3 py-1.5 rounded-full text-xs border transition-all ${oferta.urgenciaTipo === tp.value ? 'border-rl-gold bg-rl-gold/10 text-rl-text' : 'border-rl-border text-rl-muted hover:border-rl-gold/40'}`}>{tp.label}</button>
          ))}
        </div>
        <input value={oferta.urgencia} onChange={(e) => set('urgencia', e.target.value)} className="input-field text-sm" placeholder={t('ofertaPassos.escassez.urgenciaPh')} />
      </Field>,
      ], q)}
      <Example b2b={t('ofertaPassos.escassez.exB2b')} b2c={t('ofertaPassos.escassez.exB2c')} />
    </div>
  )
}

// ─── Passo 7: Bônus ─────────────────────────────────────────────────────────
export function StepBonus({ oferta, set, project, publicMode }) {
  const { t } = useI18n()
  const { run, loading, err } = useAssist(project, oferta)
  const bonus = oferta.bonus?.length ? oferta.bonus : ['']
  const add = () => bonus.length < 10 && set('bonus', [...bonus, ''])
  const upd = (i, v) => { const n = [...bonus]; n[i] = v; set('bonus', n) }
  const rm = (i) => set('bonus', bonus.filter((_, idx) => idx !== i))
  const suggest = async () => {
    const r = await run('bonus')
    if (Array.isArray(r)) {
      const novos = r.filter((x) => x?.nome).map((x) => `${x.nome}${x.valor ? ` — R$ ${x.valor}` : ''}`)
      const base = bonus.filter((b) => b.trim())
      set('bonus', [...base, ...novos].slice(0, 10))
    }
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-rl-muted">{t('ofertaPassos.bonus.intro1')}<b>{t('ofertaPassos.bonus.intro2')}</b>{t('ofertaPassos.bonus.intro3')}</p>
      {!publicMode && <div className="flex justify-end"><AIButton onClick={suggest} loading={loading} label={t('ofertaPassos.bonus.ia')} /></div>}
      {err && <ErrLine msg={err} />}
      <div className="space-y-2">
        {bonus.map((b, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[11px] text-rl-muted w-4 text-right shrink-0">{i + 1}.</span>
            <input value={b} onChange={(e) => upd(i, e.target.value)} placeholder={t('ofertaPassos.bonus.ph')} className="input-field flex-1 py-2 text-sm" />
            {bonus.length > 1 && <button onClick={() => rm(i)} className="p-1.5 text-rl-muted hover:text-rl-red shrink-0"><X className="w-3.5 h-3.5" /></button>}
          </div>
        ))}
        {bonus.length < 10 && <button onClick={add} className="flex items-center gap-1.5 text-xs text-rl-purple hover:text-rl-purple/80"><Plus className="w-3.5 h-3.5" /> {t('ofertaPassos.bonus.adicionar', { n: bonus.length })}</button>}
      </div>
    </div>
  )
}

// ─── Passo 8: Garantia ──────────────────────────────────────────────────────
export function StepGarantia({ oferta, set, project, publicMode, q }) {
  const { t } = useI18n()
  const { run, loading, err } = useAssist(project, oferta)
  const b2b = oferta.tipoCliente === 'b2b'
  const pickTipo = (tp) => {
    set('garantiaTipo', tp.value)
    const tpl = b2b ? tp.tplB2b : tp.tplB2c
    if (tpl && !oferta.garantia) set('garantia', tpl)
  }
  const suggest = async () => {
    const r = await run('garantia')
    if (r?.garantia) set('garantia', r.garantia)
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-rl-muted">{t('ofertaPassos.garantia.intro1')}<b>{t('ofertaPassos.garantia.intro2')}</b>{t('ofertaPassos.garantia.intro3')}<i>{t('ofertaPassos.garantia.intro4')}</i>.</p>
      {pick([
      <Field key="tipo" label={t('ofertaPassos.garantia.tipo')} emoji="🛡️">
      <div className="grid sm:grid-cols-2 gap-2">
        {GARANTIA_TIPOS.map((tp) => {
          const active = oferta.garantiaTipo === tp.value
          return (
            <button key={tp.value} onClick={() => pickTipo(tp)} className={`text-left p-3 rounded-xl border transition-all ${active ? 'border-rl-gold bg-rl-gold/10' : 'border-rl-border hover:border-rl-gold/40'}`}>
              <p className="text-sm font-semibold text-rl-text">{tp.label}</p>
              <p className="text-[11px] text-rl-muted mt-0.5 leading-snug">{tp.dica}</p>
            </button>
          )
        })}
      </div>
      </Field>,
      <div key="texto" className="space-y-2">
      {!publicMode && <div className="flex justify-end"><AIButton onClick={suggest} loading={loading} label={t('ofertaPassos.garantia.ia')} /></div>}
      {err && <ErrLine msg={err} />}
      <Field label={t('ofertaPassos.garantia.texto')} emoji="✍️">
        <textarea rows={3} value={oferta.garantia} onChange={(e) => set('garantia', e.target.value)} className="input-field resize-none text-sm" placeholder={t('ofertaPassos.garantia.textoPh')} />
      </Field>
      </div>,
      ], q)}
    </div>
  )
}

// ─── Passo 9: Nome (M-A-G-I-C) ──────────────────────────────────────────────
// Rótulo e placeholder de cada bloco: ofertaPassos.nome.magic.<k>.{l,ph}
const MAGIC = ['magnet', 'avatar', 'goal', 'interval', 'container'].map((k) => ({
  k,
  get l() { return t(`ofertaPassos.nome.magic.${k}.l`) },
  get ph() { return t(`ofertaPassos.nome.magic.${k}.ph`) },
}))

// Exemplos estáticos de nomes por tipo de negócio (hover no passo de nome).
// Os nomes moram em ofertaPassos.nome.exemplos.<tipo> (5 por tipo).
const NOMES_EXEMPLO = {
  b2b: { icon: '🏢', label: 'B2B' },
  b2c: { icon: '🙋', label: 'B2C' },
}

function NomeExemplos({ onPick }) {
  const { t } = useI18n()
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-rl-muted">{t('ofertaPassos.nome.inspiracao')}</span>
      {['b2b', 'b2c'].map((tipo) => {
        const ex = NOMES_EXEMPLO[tipo]
        const nomes = [0, 1, 2, 3, 4].map((i) => t(`ofertaPassos.nome.exemplos.${tipo}.${i}`))
        return (
          <div key={tipo} className="relative group">
            <button
              type="button"
              className="flex items-center gap-1 px-2 py-1 rounded-lg border border-rl-border text-xs text-rl-muted hover:border-rl-gold/40 hover:text-rl-text transition-all"
            >
              <span>{ex.icon}</span> {ex.label}
            </button>
            {/* pt-1 = ponte de hover (sem dead zone entre botão e popover) */}
            <div className="absolute left-0 top-full pt-1 w-72 z-20 hidden group-hover:block">
              <div className="glass-card p-2 space-y-0.5 border border-rl-gold/20 shadow-glow">
                <p className="text-[10px] uppercase tracking-wide text-rl-gold font-semibold px-1 pb-0.5">
                  {t('ofertaPassos.nome.exemplosTitulo', { tipo: ex.label })}
                </p>
                {nomes.map((n, i) => (
                  <button
                    key={i}
                    onClick={() => onPick(n)}
                    className="w-full text-left px-2 py-1.5 rounded-md text-xs text-rl-text hover:bg-rl-gold/10 transition-all"
                    title={t('ofertaPassos.nome.usarEste')}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function StepNome({ oferta, set, project, publicMode, q }) {
  const { t } = useI18n()
  const { run, loading, err } = useAssist(project, oferta)
  const [sugs, setSugs] = useState([])
  const nb = oferta.nomeBlocks || {}
  const setNB = (k, v) => set('nomeBlocks', { ...nb, [k]: v })
  const preview = MAGIC.map((m) => nb[m.k]).filter(Boolean).join(' ').trim()
  const suggest = async () => {
    const r = await run('nomes')
    if (Array.isArray(r)) setSugs(r.filter((x) => typeof x === 'string'))
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-rl-muted">{t('ofertaPassos.nome.intro')} <span className="text-rl-gold">⚠️ {t('ofertaPassos.nome.aviso')}</span></p>
      {isAll(q) && <NomeExemplos onPick={(n) => set('nome', n)} />}
      {pick([
      <div key="blocos" className="space-y-4">
      {!isAll(q) && <p className="text-sm font-medium text-rl-text">🧩 {t('ofertaPassos.nome.monte')}</p>}
      <div className="grid sm:grid-cols-2 gap-3">
        {MAGIC.map((m) => (
          <Field key={m.k} label={m.l}>
            <input value={nb[m.k] || ''} onChange={(e) => setNB(m.k, e.target.value)} placeholder={m.ph} className="input-field text-sm" />
          </Field>
        ))}
      </div>
      {preview && (
        <div className="rounded-xl border border-rl-gold/30 bg-rl-gold/5 p-3">
          <p className="text-[11px] text-rl-muted">{t('ofertaPassos.nome.previa')}</p>
          <p className="text-sm font-semibold text-rl-text">{preview}</p>
          <button onClick={() => set('nome', preview)} className="text-xs text-rl-gold hover:text-rl-gold/80 mt-1">{t('ofertaPassos.nome.usarComoNome')} →</button>
        </div>
      )}
      </div>,
      <div key="final" className="space-y-4">
      {!isAll(q) && <NomeExemplos onPick={(n) => set('nome', n)} />}
      {!publicMode && <div className="flex justify-end"><AIButton onClick={suggest} loading={loading} label={t('ofertaPassos.nome.ia')} /></div>}
      {err && <ErrLine msg={err} />}
      {sugs.length > 0 && (
        <div className="space-y-1.5">
          {sugs.map((s, i) => (
            <button key={i} onClick={() => set('nome', s)} className="w-full text-left px-3 py-2 rounded-lg border border-rl-border hover:border-rl-gold/40 text-xs text-rl-text transition-all">{s}</button>
          ))}
        </div>
      )}
      <Field label={t('ofertaPassos.nome.nomeFinal')} emoji="🏷️">
        <input value={oferta.nome} onChange={(e) => set('nome', e.target.value)} className="input-field text-sm" placeholder={t('ofertaPassos.nome.nomeFinalPh')} />
      </Field>
      </div>,
      ], q)}
    </div>
  )
}

// ─── Passo final: gerar ─────────────────────────────────────────────────────
export function StepFinal({ onGenerate, loading, error, generatedOffer }) {
  const { t } = useI18n()
  return (
    <div className="space-y-4">
      <div className="glass-card p-5 border border-rl-gold/20">
        <div className="flex items-center gap-2 mb-2"><Sparkles className="w-4 h-4 text-rl-gold" /><p className="text-sm font-semibold text-rl-text">{t('ofertaPassos.final.titulo')}</p></div>
        <p className="text-xs text-rl-muted mb-4">{t('ofertaPassos.final.descricao')}</p>
        <button onClick={onGenerate} disabled={loading} className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-sm bg-gradient-gold text-white disabled:opacity-50 hover:opacity-90 transition-opacity">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('ofertaPassos.final.gerando')}</> : <><Sparkles className="w-4 h-4" /> {t('ofertaPassos.final.gerar')}</>}
        </button>
      </div>
      {error && <ErrLine msg={error} />}
      {generatedOffer && (
        <div className="glass-card p-5 border border-rl-gold/20">
          <div className="flex items-center gap-2 mb-4"><CheckCircle2 className="w-4 h-4 text-rl-gold" /><p className="text-sm font-semibold text-rl-text">{t('ofertaPassos.final.gerada')}</p></div>
          <OfertaResult text={generatedOffer} />
        </div>
      )}
      {!generatedOffer && !error && (
        <div className="glass-card p-8 text-center">
          <Zap className="w-8 h-8 text-rl-muted/30 mx-auto mb-3" />
          <p className="text-rl-muted text-sm">{t('ofertaPassos.final.vazio')}</p>
        </div>
      )}
    </div>
  )
}

// ─── Modo "uma pergunta por vez": contagem e prévia de cada passo ───────────
// A ordem aqui precisa bater com a ordem do pick([...], q) de cada Step.
export function questionCount(stepId, oferta) {
  switch (stepId) {
    case 'diagnostico': return 1 + OM_QUESTIONS.length
    case 'sonho': return 3
    case 'problemas': return DRIVERS.length
    case 'solucoes': return Math.max(1, (oferta.problemas || []).length)
    case 'entrega': return 3
    case 'nucleo': return 5
    case 'escassez': return 2
    case 'bonus': return 1
    case 'garantia': return 2
    case 'nome': return 2
    default: return 0
  }
}

const brl = (v) => `R$ ${(Number(v) || 0).toLocaleString(localeAtual())}`
const labelOf = (opts, v) => opts.find((o) => o.value === v)?.label || ''
const txt = (v) => (typeof v === 'string' ? v.trim() : v)

// Linhas da prévia: { q, label, value }; value é texto, lista de textos ou vazio.
// q = pergunta que o botão "Editar" abre (null = sem edição, ex.: veredito).
// Chamada no render do StepReview (que assina o idioma), então o `t` solto basta.
export function reviewItems(stepId, oferta) {
  const L = (k, vars) => t(`ofertaPassos.revisao.${k}`, vars)
  switch (stepId) {
    case 'diagnostico': {
      const answers = oferta.diagnostico?.answers || {}
      const diag = computeOmDiagnosis(answers)
      const rows = [
        { q: 0, label: L('seuCliente'), value: { b2b: t('ofertaPassos.diagnostico.b2b'), b2c: t('ofertaPassos.diagnostico.b2c') }[oferta.tipoCliente] || '' },
        ...OM_QUESTIONS.map((qq, i) => ({ q: i + 1, label: qq.label, value: labelOf(qq.options, answers[qq.id]) })),
      ]
      if (diag.answeredCount === OM_QUESTIONS.length) {
        const v = getVerdict(diag.totalScore)
        rows.push({ q: null, label: L('veredito'), value: `${v.emoji} ${v.label} · ${diag.totalScore}/100` })
      }
      return rows
    }
    case 'sonho':
      return [
        { q: 0, label: L('dor'), value: txt(oferta.dorAtual) },
        { q: 1, label: L('sonho'), value: txt(oferta.resultadoSonho) },
        { q: 2, label: L('status'), value: txt(oferta.statusGanho) },
      ]
    case 'problemas':
      return DRIVERS.map((d, i) => ({
        q: i, label: d.label, color: d.color,
        value: (oferta.problemas || []).filter((p) => p.driver === d.id && p.texto?.trim()).map((p) => p.texto.trim()),
      }))
    case 'solucoes': {
      const sol = oferta.solucoes || []
      return (oferta.problemas || []).map((p, i) => ({
        q: i, label: p.texto?.trim() || t('ofertaPassos.objecaoSemTexto'), color: DRIVER_BY_ID[p.driver]?.color,
        value: txt(sol.find((s) => s.problemaId === p.id)?.comoResolve),
      }))
    }
    case 'entrega': {
      const e = oferta.entrega || {}
      return [
        { q: 0, label: t('ofertaPassos.entrega.atencao'), value: labelOf(ATENCAO_OPTS, e.atencao) },
        { q: 1, label: t('ofertaPassos.entrega.esforco'), value: labelOf(ESFORCO_OPTS, e.esforcoModelo) },
        { q: 2, label: t('ofertaPassos.entrega.meio'), value: (e.meio || []).map(rotuloMeio).join(', ') },
      ]
    }
    case 'nucleo': {
      const stack = (oferta.itensStack || []).filter((i) => i.nome?.trim())
      const total = (oferta.itensStack || []).reduce((s, i) => s + (Number(i.valor) || 0), 0)
      const preco = Number(oferta.preco) || 0
      const ratio = preco > 0 && total > 0 ? ` · ${L('valorTotal', { total: brl(total), x: (total / preco).toFixed(1) })}` : ''
      return [
        { q: 0, label: L('nucleo'), value: txt(oferta.nucleo) },
        { q: 1, label: L('entregas'), value: stack.map((i) => (i.valor ? `${i.nome.trim()} (${brl(i.valor)})` : i.nome.trim())) },
        { q: 2, label: L('preco'), value: preco > 0 ? `${brl(preco)}${ratio}` : '' },
        { q: 3, label: t('ofertaPassos.nucleo.velocidade'), value: txt(oferta.velocidade) },
        { q: 4, label: t('ofertaPassos.nucleo.esforco'), value: txt(oferta.esforcoMinimo) },
      ]
    }
    case 'escassez': {
      const esc = labelOf(ESCASSEZ_TIPOS, oferta.escassezTipo)
      const urg = labelOf(URGENCIA_TIPOS, oferta.urgenciaTipo)
      return [
        { q: 0, label: esc ? `${t('ofertaPassos.escassez.escassez')} · ${esc}` : t('ofertaPassos.escassez.escassez'), value: txt(oferta.escassez) },
        { q: 1, label: urg ? `${t('ofertaPassos.escassez.urgencia')} · ${urg}` : t('ofertaPassos.escassez.urgencia'), value: txt(oferta.urgencia) },
      ]
    }
    case 'bonus':
      return [{ q: 0, label: L('bonus'), value: (oferta.bonus || []).map((b) => b.trim()).filter(Boolean) }]
    case 'garantia':
      return [
        { q: 0, label: L('tipoGarantia'), value: labelOf(GARANTIA_TIPOS, oferta.garantiaTipo) },
        { q: 1, label: t('ofertaPassos.garantia.texto'), value: txt(oferta.garantia) },
      ]
    case 'nome': {
      const nb = oferta.nomeBlocks || {}
      return [
        { q: 0, label: L('blocosMagic'), value: MAGIC.filter((m) => nb[m.k]?.trim()).map((m) => `${m.l}: ${nb[m.k].trim()}`) },
        { q: 1, label: t('ofertaPassos.nome.nomeFinal'), value: txt(oferta.nome) },
      ]
    }
    default: return []
  }
}

const isEmptyValue = (v) => (Array.isArray(v) ? v.length === 0 : !v)

export function StepReview({ stepId, title, oferta, onEdit }) {
  const { t } = useI18n()
  const rows = reviewItems(stepId, oferta)
  const editaveis = rows.filter((r) => r.q != null)
  const respondidas = editaveis.filter((r) => !isEmptyValue(r.value)).length

  if (!rows.length) {
    return <EmptyHint text={t('ofertaPassos.revisao.vazio')} />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-rl-muted">
          {t('ofertaPassos.revisao.intro1')}<b className="text-rl-text">{title}</b>{t('ofertaPassos.revisao.intro2')}
        </p>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
          respondidas === editaveis.length ? 'bg-green-500/10 text-green-600' : 'bg-rl-gold/10 text-rl-gold'
        }`}>
          {t('ofertaPassos.revisao.respondidas', { feitas: respondidas, total: editaveis.length })}
        </span>
      </div>

      <div className="rounded-xl border border-rl-border divide-y divide-rl-border overflow-hidden">
        {rows.map((r, i) => {
          const vazio = isEmptyValue(r.value)
          return (
            <div key={i} className="flex items-start gap-3 p-3 sm:p-4">
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-xs text-rl-muted flex items-center gap-1.5">
                  {r.color && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: r.color }} />}
                  {r.label}
                </p>
                {vazio ? (
                  <p className="text-sm italic text-rl-muted/70">{t('ofertaPassos.revisao.naoRespondida')}</p>
                ) : Array.isArray(r.value) ? (
                  <ul className="space-y-0.5">
                    {r.value.map((v, j) => (
                      <li key={j} className="text-sm text-rl-text flex gap-1.5"><span className="text-rl-muted">•</span><span className="break-words">{v}</span></li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-rl-text whitespace-pre-wrap break-words">{r.value}</p>
                )}
              </div>
              {r.q != null && (
                <button
                  onClick={() => onEdit(r.q)}
                  className="shrink-0 flex items-center gap-1 text-xs text-rl-purple hover:text-rl-purple/80 px-2 py-1 rounded-lg hover:bg-rl-purple/5"
                >
                  <Pencil className="w-3.5 h-3.5" /> {vazio ? t('ofertaPassos.revisao.responder') : t('comum.editar')}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Utilitários visuais ────────────────────────────────────────────────────
function ErrLine({ msg }) {
  return (
    <div className="flex items-start gap-2 text-rl-red text-xs"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /><p>{msg}</p></div>
  )
}
function EmptyHint({ text }) {
  return <div className="glass-card p-6 text-center text-sm text-rl-muted">{text}</div>
}

// ─── Render da oferta gerada (movido da página antiga) ──────────────────────
export function OfertaResult({ text }) {
  const lines = String(text).split('\n')
  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        const t = line.trim()
        if (/^━+$/.test(t)) return <div key={i} className="border-t-2 border-rl-gold/40 my-3" />
        if (/^GOM #\d+/.test(t)) return <p key={i} className="text-base font-bold text-rl-gold mt-1 mb-0">{t}</p>
        if (/^─+$/.test(t)) return <div key={i} className="border-t border-rl-border/60 my-1 ml-4" />
        if (/^[📛🎯📦🛡️⚡💬🎁🔥🗣️✨💡🤝]\s/.test(t)) return <p key={i} className="text-sm font-semibold text-rl-text mt-3 mb-1">{t}</p>
        if (t.startsWith('• ')) return <p key={i} className="text-xs text-rl-muted leading-relaxed ml-2 font-mono">{t}</p>
        if (/^\s*(Valor total:|Preço:|Total value:|Price:)/.test(line)) return <p key={i} className="text-xs font-semibold text-rl-text leading-relaxed ml-6">{t}</p>
        if (t === '') return <div key={i} className="h-1" />
        return <p key={i} className="text-xs text-rl-muted leading-relaxed">{t.replace(/\*\*(.*?)\*\*/g, '$1')}</p>
      })}
    </div>
  )
}
