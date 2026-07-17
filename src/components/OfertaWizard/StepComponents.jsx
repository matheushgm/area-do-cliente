// ─────────────────────────────────────────────────────────────────────────────
// Componentes de cada passo do Wizard de Oferta Matadora.
// Cada step recebe { oferta, set, project } e edita ofertaData via set(field, val).
// A geração final (StepFinal) recebe callbacks da página.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { Plus, X, Sparkles, Loader2, CheckCircle2, Zap, AlertTriangle, Info } from 'lucide-react'
import {
  DRIVERS, DRIVER_BY_ID, ATENCAO_OPTS, ESFORCO_OPTS, MEIO_OPTS,
  ESCASSEZ_TIPOS, URGENCIA_TIPOS, GARANTIA_TIPOS, uid, aiAssist,
} from './ofertaShared'
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

function AIButton({ onClick, loading, label = 'Sugerir com IA' }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-rl-gold hover:text-rl-gold/80 transition-colors disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
      {loading ? 'Gerando...' : `💡 ${label}`}
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
export function StepDiagnostico({ oferta, set }) {
  const answers = oferta.diagnostico?.answers || {}
  const diag = computeOmDiagnosis(answers)

  const answer = (qid, val) => {
    const next = { ...answers, [qid]: val }
    set('diagnostico', { answers: next, ...computeOmDiagnosis(next) })
  }

  const verdict = getVerdict(diag.totalScore)
  const answeredAll = diag.answeredCount === OM_QUESTIONS.length

  return (
    <div className="space-y-5">
      <p className="text-sm text-rl-muted">
        Antes de construir, vamos checar se o cenário favorece uma oferta agressiva. Responda as 6 perguntas.
      </p>

      {/* B2B / B2C */}
      <Field label="Seu cliente é:" emoji="🎯" hint="Isso ajusta as dicas ao longo do wizard.">
        <div className="grid grid-cols-2 gap-2">
          {[{ v: 'b2b', l: '🏢 Empresa (B2B)' }, { v: 'b2c', l: '🙋 Consumidor (B2C)' }].map((t) => (
            <button
              key={t.v}
              onClick={() => set('tipoCliente', t.v)}
              className={`p-3 rounded-xl border text-sm font-semibold transition-all ${
                oferta.tipoCliente === t.v ? 'border-rl-gold bg-rl-gold/10 text-rl-text' : 'border-rl-border text-rl-muted hover:border-rl-gold/40'
              }`}
            >{t.l}</button>
          ))}
        </div>
      </Field>

      {/* Perguntas */}
      {OM_QUESTIONS.map((q) => (
        <div key={q.id} className="glass-card p-4 space-y-2">
          <p className="text-sm font-medium text-rl-text">{q.label}</p>
          {q.hint && <p className="text-xs text-rl-muted">{q.hint}</p>}
          <div className="space-y-1.5 pt-1">
            {q.options.map((o) => (
              <button
                key={o.value}
                onClick={() => answer(q.id, o.value)}
                className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-all ${
                  answers[q.id] === o.value ? 'border-rl-gold bg-rl-gold/10 text-rl-text' : 'border-rl-border text-rl-muted hover:border-rl-gold/40'
                }`}
              >{o.label}</button>
            ))}
          </div>
        </div>
      ))}

      {/* Veredito */}
      {answeredAll && (
        <div className="glass-card p-4 border" style={{ borderColor: verdict.color + '55' }}>
          <p className="text-sm font-bold" style={{ color: verdict.color }}>
            {verdict.emoji} {verdict.label} · {diag.totalScore}/100
          </p>
          <p className="text-xs text-rl-muted mt-1 leading-relaxed">{verdict.desc}</p>
          {verdict.id === 'nao_cabe' && (
            <p className="text-[11px] text-rl-muted mt-2 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Você pode construir mesmo assim, mas considere autoridade/conteúdo antes de escalar.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Passo 1: Sonho ─────────────────────────────────────────────────────────
export function StepSonho({ oferta, set, project }) {
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
      <p className="text-sm text-rl-muted">Venda a <b>transformação</b>, não o produto. E lembre: as pessoas compram <b>status</b> — como serão vistas pelos outros.</p>
      <div className="flex justify-end"><AIButton onClick={suggest} loading={loading} label="Refinar meu sonho" /></div>
      {err && <ErrLine msg={err} />}
      <Field label="Onde seu cliente está HOJE (a dor)?" emoji="😣">
        <textarea rows={2} value={oferta.dorAtual} onChange={(e) => set('dorAtual', e.target.value)} className="input-field resize-none text-sm" placeholder="Ex: perde negócios por não saber o próprio custo de aquisição" />
      </Field>
      <Field label="Onde ele quer chegar (o sonho)?" emoji="✨">
        <textarea rows={2} value={oferta.resultadoSonho} onChange={(e) => set('resultadoSonho', e.target.value)} className="input-field resize-none text-sm" placeholder="Ex: máquina de aquisição previsível, R$X/mês com margem" />
      </Field>
      <Field label="Como ele será visto pelos outros depois?" emoji="👑">
        <input type="text" value={oferta.statusGanho} onChange={(e) => set('statusGanho', e.target.value)} className="input-field text-sm" placeholder="Ex: o dono que 'destravou' o crescimento" />
      </Field>
      <Example b2b="dor='não sabe o CAC' → sonho='aquisição previsível' → status='destravou o crescimento'" b2c="dor='acorda com dor nas costas' → sonho='dormir a noite toda' → status='resolveu e recomenda'" />
    </div>
  )
}

// ─── Passo 2: Problemas (4 drivers) ─────────────────────────────────────────
export function StepProblemas({ oferta, set, project }) {
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
      <p className="text-sm text-rl-muted">Liste tudo que passa na cabeça do cliente <b>antes, durante e depois</b> da compra. Cada objeção vira um bônus ou uma garantia depois. Mire 8+.</p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-rl-muted">{problemas.length} objeções</span>
        <AIButton onClick={suggest} loading={loading} label="Sugerir objeções do meu público" />
      </div>
      {err && <ErrLine msg={err} />}
      <div className="grid md:grid-cols-2 gap-3">
        {DRIVERS.map((d) => (
          <div key={d.id} className="glass-card p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
              <p className="text-sm font-semibold text-rl-text">{d.label}</p>
            </div>
            <p className="text-[11px] text-rl-muted">{d.hint}</p>
            {problemas.filter((p) => p.driver === d.id).map((p) => (
              <div key={p.id} className="flex items-center gap-1.5">
                <input value={p.texto} onChange={(e) => update(p.id, e.target.value)} placeholder="Objeção..." className="input-field flex-1 py-1.5 text-xs" />
                <button onClick={() => remove(p.id)} className="p-1 text-rl-muted hover:text-rl-red shrink-0"><X className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            <button onClick={() => add(d.id)} className="flex items-center gap-1 text-xs text-rl-purple hover:text-rl-purple/80">
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Passo 3: Soluções ──────────────────────────────────────────────────────
export function StepSolucoes({ oferta, set, project }) {
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
  if (!problemas.length) return <EmptyHint text="Volte ao passo anterior e liste ao menos alguns problemas." />
  return (
    <div className="space-y-4">
      <p className="text-sm text-rl-muted">Para cada travamento, responda: o que eu preciso <b>mostrar/entregar</b> pra resolver? Comece com "Como...".</p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-rl-muted">{done} de {problemas.length} resolvidos</span>
        <AIButton onClick={suggest} loading={loading} label="Sugerir soluções" />
      </div>
      {err && <ErrLine msg={err} />}
      <div className="space-y-2">
        {problemas.map((p) => (
          <div key={p.id} className="glass-card p-3 space-y-1.5">
            <p className="text-xs text-rl-muted flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: DRIVER_BY_ID[p.driver]?.color }} />
              {p.texto || '(objeção sem texto)'}
            </p>
            <input value={getSol(p.id)?.comoResolve || ''} onChange={(e) => setSol(p.id, e.target.value)} placeholder="Como..." className="input-field text-sm" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Passo 4: Entrega ───────────────────────────────────────────────────────
export function StepEntrega({ oferta, set }) {
  const e = oferta.entrega || {}
  const setE = (k, v) => set('entrega', { ...e, [k]: v })
  const toggleMeio = (m) => {
    const cur = e.meio || []
    setE('meio', cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m])
  }
  return (
    <div className="space-y-5">
      <p className="text-sm text-rl-muted">Quanto menos esforço pro cliente (DFY) e quanto mais "um-para-muitos", maior a margem. Escolha o ponto que você entrega bem.</p>
      <Field label="Nível de atenção" emoji="👥"><ChoiceCards options={ATENCAO_OPTS} value={e.atencao} onChange={(v) => setE('atencao', v)} /></Field>
      <Field label="Nível de esforço do cliente" emoji="🛠️"><ChoiceCards options={ESFORCO_OPTS} value={e.esforcoModelo} onChange={(v) => setE('esforcoModelo', v)} /></Field>
      <Field label="Meio de entrega" emoji="📡" hint="Selecione um ou mais.">
        <div className="flex flex-wrap gap-2">
          {MEIO_OPTS.map((m) => {
            const active = (e.meio || []).includes(m)
            return (
              <button key={m} onClick={() => toggleMeio(m)} className={`px-3 py-1.5 rounded-full text-xs border transition-all ${active ? 'border-rl-gold bg-rl-gold/10 text-rl-text' : 'border-rl-border text-rl-muted hover:border-rl-gold/40'}`}>{m}</button>
            )
          })}
        </div>
      </Field>
      <Example b2b="1 a 1 + DFY + Zoom/relatório (consultoria high-ticket)" b2c="Um-para-muitos + DWY + app/vídeo (programa escalável)" />
    </div>
  )
}

// ─── Passo 5: Núcleo + Stack + Preço ────────────────────────────────────────
export function StepNucleo({ oferta, set, project }) {
  const { run, loading, err } = useAssist(project, oferta)
  const stack = oferta.itensStack || []
  const addItem = (tipo = 'bonus') => set('itensStack', [...stack, { id: uid(), nome: '', tipo, valor: '' }])
  const updItem = (id, patch) => set('itensStack', stack.map((i) => (i.id === id ? { ...i, ...patch } : i)))
  const rmItem = (id) => set('itensStack', stack.filter((i) => i.id !== id))
  const total = stack.reduce((s, i) => s + (Number(i.valor) || 0), 0)
  const preco = Number(oferta.preco) || 0
  const ratio = preco > 0 ? total / preco : 0
  const suggest = async () => {
    const r = await run('stack')
    if (Array.isArray(r)) {
      const mapped = r.filter((x) => x?.nome).map((x) => ({ id: uid(), nome: x.nome, tipo: x.tipo === 'nucleo' ? 'nucleo' : 'bonus', valor: x.valor || '' }))
      set('itensStack', [...stack, ...mapped])
      const nuc = mapped.find((m) => m.tipo === 'nucleo')
      if (nuc && !oferta.nucleo) set('nucleo', nuc.nome)
    }
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-rl-muted">Some o valor de cada peça. A meta é o valor percebido ser <b>~10x o preço</b>. Nunca dê desconto — adicione peça.</p>
      <Field label="Entrega PRINCIPAL (núcleo)" emoji="🎯">
        <input value={oferta.nucleo} onChange={(e) => set('nucleo', e.target.value)} className="input-field text-sm" placeholder="Ex: financeiro completo rodando (a pagar/receber, conciliação, DRE)" />
      </Field>

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-rl-text">📦 Itens da oferta (com valor)</p>
        <AIButton onClick={suggest} loading={loading} label="Montar o stack" />
      </div>
      {err && <ErrLine msg={err} />}
      <div className="space-y-2">
        {stack.map((i) => (
          <div key={i.id} className="flex items-center gap-1.5">
            <select value={i.tipo} onChange={(ev) => updItem(i.id, { tipo: ev.target.value })} className="input-field py-1.5 text-xs w-24 shrink-0">
              <option value="nucleo">Núcleo</option>
              <option value="bonus">Bônus</option>
            </select>
            <input value={i.nome} onChange={(ev) => updItem(i.id, { nome: ev.target.value })} placeholder="Nome sedutor da peça" className="input-field flex-1 py-1.5 text-xs" />
            <div className="flex items-center gap-0.5 shrink-0">
              <span className="text-[11px] text-rl-muted">R$</span>
              <input type="number" value={i.valor} onChange={(ev) => updItem(i.id, { valor: ev.target.value })} placeholder="0" className="input-field py-1.5 text-xs w-20" />
            </div>
            <button onClick={() => rmItem(i.id)} className="p-1 text-rl-muted hover:text-rl-red shrink-0"><X className="w-3.5 h-3.5" /></button>
          </div>
        ))}
        <button onClick={() => addItem()} className="flex items-center gap-1 text-xs text-rl-purple hover:text-rl-purple/80"><Plus className="w-3.5 h-3.5" /> Adicionar item</button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Preço final (R$)" emoji="💰">
          <input type="number" value={oferta.preco} onChange={(e) => set('preco', e.target.value)} className="input-field text-sm" placeholder="Ex: 1997" />
        </Field>
        <Field label="1ª vitória (velocidade)" emoji="⚡">
          <input value={oferta.velocidade} onChange={(e) => set('velocidade', e.target.value)} className="input-field text-sm" placeholder="Ex: primeiro resultado em 7 dias" />
        </Field>
      </div>
      <Field label="Esforço mínimo do cliente" emoji="🤝" hint="O que ele precisa fazer — minimize ao máximo.">
        <textarea rows={2} value={oferta.esforcoMinimo} onChange={(e) => set('esforcoMinimo', e.target.value)} className="input-field resize-none text-sm" placeholder="Ex: você só dá acesso; nós cuidamos de tudo" />
      </Field>

      {(total > 0 || preco > 0) && (
        <div className={`rounded-xl p-3 text-sm border ${ratio >= 10 ? 'border-green-500/40 bg-green-500/5' : ratio >= 3 ? 'border-rl-gold/40 bg-rl-gold/5' : 'border-rl-red/40 bg-rl-red/5'}`}>
          <p className="text-rl-text font-semibold">Valor total R$ {total.toLocaleString('pt-BR')} · Preço R$ {preco.toLocaleString('pt-BR')}
            {ratio > 0 && <> · <b>{ratio.toFixed(1)}x</b></>}</p>
          <p className="text-xs text-rl-muted mt-0.5">
            {ratio >= 10 ? '✅ Excelente — valor ~10x o preço.' : ratio >= 3 ? '⚠️ Ok, mas empilhe mais valor pra chegar a 10x.' : ratio > 0 ? '❌ Discrepância fraca — aumente o valor percebido.' : 'Defina preço e valores pra ver a razão.'}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Passo 6: Escassez + Urgência ───────────────────────────────────────────
export function StepEscassez({ oferta, set }) {
  const pickEsc = (t) => {
    set('escassezTipo', t.value)
    if (t.tpl && !oferta.escassez) set('escassez', t.tpl)
  }
  const pickUrg = (t) => {
    set('urgenciaTipo', t.value)
    if (t.tpl && !oferta.urgencia) set('urgencia', t.tpl)
  }
  return (
    <div className="space-y-5">
      <p className="text-sm text-rl-muted"><b>Escassez</b> = quantidade limitada. <b>Urgência</b> = prazo. Use uma de cada. Tem que ser <b>real</b> — deadline falso queima credibilidade.</p>
      <Field label="Escassez" emoji="🔒">
        <div className="flex flex-wrap gap-2 mb-2">
          {ESCASSEZ_TIPOS.map((t) => (
            <button key={t.value} onClick={() => pickEsc(t)} className={`px-3 py-1.5 rounded-full text-xs border transition-all ${oferta.escassezTipo === t.value ? 'border-rl-gold bg-rl-gold/10 text-rl-text' : 'border-rl-border text-rl-muted hover:border-rl-gold/40'}`}>{t.label}</button>
          ))}
        </div>
        <input value={oferta.escassez} onChange={(e) => set('escassez', e.target.value)} className="input-field text-sm" placeholder="Frase final de escassez" />
      </Field>
      <Field label="Urgência" emoji="⏳">
        <div className="flex flex-wrap gap-2 mb-2">
          {URGENCIA_TIPOS.map((t) => (
            <button key={t.value} onClick={() => pickUrg(t)} className={`px-3 py-1.5 rounded-full text-xs border transition-all ${oferta.urgenciaTipo === t.value ? 'border-rl-gold bg-rl-gold/10 text-rl-text' : 'border-rl-border text-rl-muted hover:border-rl-gold/40'}`}>{t.label}</button>
          ))}
        </div>
        <input value={oferta.urgencia} onChange={(e) => set('urgencia', e.target.value)} className="input-field text-sm" placeholder="Frase final de urgência" />
      </Field>
      <Example b2b="'5 vagas/mês, restam 2' + 'implantação grátis fechando este mês'" b2c="'lote de 8 unidades' + 'Semana do Sono até domingo'" />
    </div>
  )
}

// ─── Passo 7: Bônus ─────────────────────────────────────────────────────────
export function StepBonus({ oferta, set, project }) {
  const { run, loading, err } = useAssist(project, oferta)
  const bonus = oferta.bonus?.length ? oferta.bonus : ['']
  const add = () => bonus.length < 10 && set('bonus', [...bonus, ''])
  const upd = (i, v) => { const n = [...bonus]; n[i] = v; set('bonus', n) }
  const rm = (i) => set('bonus', bonus.filter((_, idx) => idx !== i))
  const suggest = async () => {
    const r = await run('stack')
    if (Array.isArray(r)) {
      const novos = r.filter((x) => x?.tipo === 'bonus' && x?.nome).map((x) => `${x.nome}${x.valor ? ` — R$ ${x.valor}` : ''}`)
      const base = bonus.filter((b) => b.trim())
      set('bonus', [...base, ...novos].slice(0, 10))
    }
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-rl-muted">Cada bônus resolve <b>UMA objeção</b>. Ferramentas e checklists valem mais que treinamentos. A soma dos bônus deve valer mais que o produto principal. Nunca desconto — bônus.</p>
      <div className="flex justify-end"><AIButton onClick={suggest} loading={loading} label="Sugerir bônus" /></div>
      {err && <ErrLine msg={err} />}
      <div className="space-y-2">
        {bonus.map((b, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[11px] text-rl-muted w-4 text-right shrink-0">{i + 1}.</span>
            <input value={b} onChange={(e) => upd(i, e.target.value)} placeholder="Ex: Régua de Cobrança Automática — R$ 1.500 (recupera inadimplência)" className="input-field flex-1 py-2 text-sm" />
            {bonus.length > 1 && <button onClick={() => rm(i)} className="p-1.5 text-rl-muted hover:text-rl-red shrink-0"><X className="w-3.5 h-3.5" /></button>}
          </div>
        ))}
        {bonus.length < 10 && <button onClick={add} className="flex items-center gap-1.5 text-xs text-rl-purple hover:text-rl-purple/80"><Plus className="w-3.5 h-3.5" /> Adicionar bônus ({bonus.length}/10)</button>}
      </div>
    </div>
  )
}

// ─── Passo 8: Garantia ──────────────────────────────────────────────────────
export function StepGarantia({ oferta, set, project }) {
  const { run, loading, err } = useAssist(project, oferta)
  const b2b = oferta.tipoCliente === 'b2b'
  const pick = (t) => {
    set('garantiaTipo', t.value)
    const tpl = b2b ? t.tplB2b : t.tplB2c
    if (tpl && !oferta.garantia) set('garantia', tpl)
  }
  const suggest = async () => {
    const r = await run('garantia')
    if (r?.garantia) set('garantia', r.garantia)
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-rl-muted">A maior objeção é o <b>risco</b>. Garantia com "dentes" tem o "ou o quê" (Z): <i>"Se você não [X] em [Y], então [Z]"</i>.</p>
      <div className="grid sm:grid-cols-2 gap-2">
        {GARANTIA_TIPOS.map((t) => {
          const active = oferta.garantiaTipo === t.value
          return (
            <button key={t.value} onClick={() => pick(t)} className={`text-left p-3 rounded-xl border transition-all ${active ? 'border-rl-gold bg-rl-gold/10' : 'border-rl-border hover:border-rl-gold/40'}`}>
              <p className="text-sm font-semibold text-rl-text">{t.label}</p>
              <p className="text-[11px] text-rl-muted mt-0.5 leading-snug">{t.dica}</p>
            </button>
          )
        })}
      </div>
      <div className="flex justify-end"><AIButton onClick={suggest} loading={loading} label="Escrever minha garantia" /></div>
      {err && <ErrLine msg={err} />}
      <textarea rows={3} value={oferta.garantia} onChange={(e) => set('garantia', e.target.value)} className="input-field resize-none text-sm" placeholder="Ex: 20 clientes em 30 dias, ou devolvo seu dinheiro + o que você gastou em anúncios." />
    </div>
  )
}

// ─── Passo 9: Nome (M-A-G-I-C) ──────────────────────────────────────────────
const MAGIC = [
  { k: 'magnet', l: 'M · Magnet (motivo)', ph: 'Grátis / 88% OFF / Inauguração' },
  { k: 'avatar', l: 'A · Avatar', ph: 'Donos de Restaurante / Mães de [bairro]' },
  { k: 'goal', l: 'G · Goal (meta)', ph: 'Dobre o Faturamento / Sem Dor nas Costas' },
  { k: 'interval', l: 'I · Interval (prazo)', ph: '30 Dias / 6 Semanas' },
  { k: 'container', l: 'C · Container', ph: 'Sistema / Método / Desafio / Blueprint' },
]
export function StepNome({ oferta, set, project }) {
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
      <p className="text-sm text-rl-muted">Use 3 a 5 blocos. Curto e punchy vence. <span className="text-rl-gold">⚠️ meta + prazo juntos podem ser barrados por plataforma.</span></p>
      <div className="grid sm:grid-cols-2 gap-3">
        {MAGIC.map((m) => (
          <Field key={m.k} label={m.l}>
            <input value={nb[m.k] || ''} onChange={(e) => setNB(m.k, e.target.value)} placeholder={m.ph} className="input-field text-sm" />
          </Field>
        ))}
      </div>
      {preview && (
        <div className="rounded-xl border border-rl-gold/30 bg-rl-gold/5 p-3">
          <p className="text-[11px] text-rl-muted">Prévia:</p>
          <p className="text-sm font-semibold text-rl-text">{preview}</p>
          <button onClick={() => set('nome', preview)} className="text-xs text-rl-gold hover:text-rl-gold/80 mt-1">Usar como nome →</button>
        </div>
      )}
      <div className="flex justify-end"><AIButton onClick={suggest} loading={loading} label="Sugerir 5 nomes" /></div>
      {err && <ErrLine msg={err} />}
      {sugs.length > 0 && (
        <div className="space-y-1.5">
          {sugs.map((s, i) => (
            <button key={i} onClick={() => set('nome', s)} className="w-full text-left px-3 py-2 rounded-lg border border-rl-border hover:border-rl-gold/40 text-xs text-rl-text transition-all">{s}</button>
          ))}
        </div>
      )}
      <Field label="Nome final da oferta" emoji="🏷️">
        <input value={oferta.nome} onChange={(e) => set('nome', e.target.value)} className="input-field text-sm" placeholder="Ex: Sistema Caixa Blindado — Financeiro Organizado em 30 Dias" />
      </Field>
    </div>
  )
}

// ─── Passo final: gerar ─────────────────────────────────────────────────────
export function StepFinal({ onGenerate, loading, error, generatedOffer }) {
  return (
    <div className="space-y-4">
      <div className="glass-card p-5 border border-rl-gold/20">
        <div className="flex items-center gap-2 mb-2"><Sparkles className="w-4 h-4 text-rl-gold" /><p className="text-sm font-semibold text-rl-text">Gerar as 3 versões da oferta</p></div>
        <p className="text-xs text-rl-muted mb-4">A IA vai consolidar tudo que você preencheu em 3 Grandes Ofertas Matadoras (com pitch), usando a metodologia $100M Offers.</p>
        <button onClick={onGenerate} disabled={loading} className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-sm bg-gradient-gold text-white disabled:opacity-50 hover:opacity-90 transition-opacity">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando oferta...</> : <><Sparkles className="w-4 h-4" /> Gerar Oferta Matadora</>}
        </button>
      </div>
      {error && <ErrLine msg={error} />}
      {generatedOffer && (
        <div className="glass-card p-5 border border-rl-gold/20">
          <div className="flex items-center gap-2 mb-4"><CheckCircle2 className="w-4 h-4 text-rl-gold" /><p className="text-sm font-semibold text-rl-text">Oferta Matadora Gerada</p></div>
          <OfertaResult text={generatedOffer} />
        </div>
      )}
      {!generatedOffer && !error && (
        <div className="glass-card p-8 text-center">
          <Zap className="w-8 h-8 text-rl-muted/30 mx-auto mb-3" />
          <p className="text-rl-muted text-sm">Clique em "Gerar Oferta Matadora" para criar suas 3 GOMs completas.</p>
        </div>
      )}
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
        if (/^\s*(Valor total:|Preço:)/.test(line)) return <p key={i} className="text-xs font-semibold text-rl-text leading-relaxed ml-6">{t}</p>
        if (t === '') return <div key={i} className="h-1" />
        return <p key={i} className="text-xs text-rl-muted leading-relaxed">{t.replace(/\*\*(.*?)\*\*/g, '$1')}</p>
      })}
    </div>
  )
}
