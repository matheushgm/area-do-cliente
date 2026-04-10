import { useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  Rocket, TrendingUp, Award, CheckCircle2, ChevronRight,
  Star, MessageSquare, BarChart2, ThumbsUp, ThumbsDown,
  Minus, RotateCcw, Send, Clock,
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const MARCOS = [
  {
    id: 'marco1',
    num: '01',
    title: 'Pós-Onboarding',
    description: 'Após a primeira campanha ir ao ar',
    icon: Rocket,
    color: 'purple',
    tw: {
      text:   'text-rl-purple',
      bg:     'bg-rl-purple/10',
      border: 'border-rl-purple/25',
      badge:  'bg-rl-purple text-white',
      dot:    'bg-rl-purple',
      btn:    'bg-rl-purple hover:bg-rl-purple/90 text-white',
    },
  },
  {
    id: 'marco2',
    num: '02',
    title: 'Primeiros 3 Meses',
    description: '90 dias de parceria',
    icon: TrendingUp,
    color: 'blue',
    tw: {
      text:   'text-rl-blue',
      bg:     'bg-rl-blue/10',
      border: 'border-rl-blue/25',
      badge:  'bg-rl-blue text-white',
      dot:    'bg-rl-blue',
      btn:    'bg-rl-blue hover:bg-rl-blue/90 text-white',
    },
  },
  {
    id: 'marco3',
    num: '03',
    title: '6 Meses',
    description: 'Meio ano de parceria',
    icon: Award,
    color: 'gold',
    tw: {
      text:   'text-rl-gold',
      bg:     'bg-rl-gold/10',
      border: 'border-rl-gold/25',
      badge:  'bg-rl-gold text-rl-bg',
      dot:    'bg-rl-gold',
      btn:    'bg-rl-gold hover:bg-rl-gold/90 text-rl-bg',
    },
  },
]

const Q3_OPTIONS = ['Ruim', 'Regular', 'Bom', 'Excelente']
const Q4_OPTIONS = ['Sim, dentro do esperado', 'Parcialmente', 'Não, abaixo do esperado']
const Q5_OPTIONS = ['Sim, tenho clareza total', 'Às vezes fico com dúvidas', 'Não, sinto falta de mais transparência']

function getNPSCategory(score) {
  if (score <= 6) return { label: 'Detrator',  color: 'text-red-400',   bg: 'bg-red-400/10',   border: 'border-red-400/20',   Icon: ThumbsDown }
  if (score <= 8) return { label: 'Neutro',    color: 'text-rl-gold',   bg: 'bg-rl-gold/10',   border: 'border-rl-gold/20',   Icon: Minus      }
  return              { label: 'Promotor',  color: 'text-rl-green',  bg: 'bg-rl-green/10',  border: 'border-rl-green/20',  Icon: ThumbsUp   }
}

function getQ2Label(score) {
  if (score <= 6) return 'O que fez você dar essa nota? O que precisaria mudar para você se sentir bem atendido?'
  if (score <= 8) return 'O que está faltando para a nossa parceria ser excelente na sua visão?'
  return 'O que mais te surpreendeu positivamente na nossa parceria até agora?'
}

function getActionLabel(score) {
  if (score <= 6) return { text: 'Account manager entra em contato em até 24h para entender e reverter.', color: 'text-red-400', bg: 'bg-red-400/5', border: 'border-red-400/15' }
  if (score <= 8) return { text: 'Agendar alinhamento estratégico no próximo ciclo.', color: 'text-rl-gold', bg: 'bg-rl-gold/5', border: 'border-rl-gold/15' }
  return              { text: 'Solicitar depoimento ou case ao cliente.', color: 'text-rl-green', bg: 'bg-rl-green/5', border: 'border-rl-green/15' }
}

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

// ─── Radio Option ─────────────────────────────────────────────────────────────

function RadioOption({ label, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
        selected
          ? 'bg-rl-purple/10 border-rl-purple/40 text-rl-purple'
          : 'bg-rl-surface border-rl-border text-rl-muted hover:border-rl-muted/50 hover:text-rl-text'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
          selected ? 'border-rl-purple' : 'border-rl-border'
        }`}>
          {selected && <div className="w-2 h-2 rounded-full bg-rl-purple" />}
        </div>
        {label}
      </div>
    </button>
  )
}

// ─── NPS Form ─────────────────────────────────────────────────────────────────

function NPSForm({ marco, onSubmit, onCancel }) {
  const [step, setStep]   = useState(0)
  const [form, setForm]   = useState({ score: null, q2: '', q3: '', q4: '', q5: '', q6: '' })
  const [saving, setSaving] = useState(false)

  const category = form.score !== null ? getNPSCategory(form.score) : null
  const tw = marco.tw

  const canNext0 = form.score !== null
  const canNext1 = form.q2.trim().length > 0
  const canNext2 = form.q3 && form.q4 && form.q5

  const handleSubmit = async () => {
    setSaving(true)
    await onSubmit({ ...form, submittedAt: new Date().toISOString() })
    setSaving(false)
  }

  return (
    <div className="space-y-5">

      {/* Progress steps */}
      <div className="flex items-center gap-2">
        {['Nota', 'Diagnóstico', 'Avaliação', 'Encerramento'].map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold transition-all ${
              i < step  ? 'bg-rl-green text-white' :
              i === step ? `${tw.badge}` :
              'bg-rl-surface text-rl-muted border border-rl-border'
            }`}>
              {i < step ? '✓' : i + 1}
            </div>
            <span className={`text-[11px] font-medium hidden sm:block ${i === step ? tw.text : 'text-rl-muted'}`}>{s}</span>
            {i < 3 && <ChevronRight className="w-3 h-3 text-rl-border shrink-0" />}
          </div>
        ))}
      </div>

      {/* ── Step 0: Nota NPS ── */}
      {step === 0 && (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-rl-text mb-1">
              Em uma escala de 0 a 10, qual a probabilidade de você indicar a Revenue Lab para outro empresário?
            </p>
            <p className="text-xs text-rl-muted">0 = Jamais indicaria · 10 = Indicaria com certeza</p>
          </div>

          {/* Score buttons */}
          <div className="flex gap-1.5 flex-wrap">
            {[0,1,2,3,4,5,6,7,8,9,10].map((n) => {
              const c = getNPSCategory(n)
              const sel = form.score === n
              return (
                <button
                  key={n}
                  onClick={() => setForm(f => ({ ...f, score: n }))}
                  className={`w-10 h-10 rounded-xl text-sm font-bold transition-all border ${
                    sel
                      ? `${c.bg} ${c.border} ${c.color} shadow-sm scale-110`
                      : 'bg-rl-surface border-rl-border text-rl-muted hover:border-rl-muted/50 hover:text-rl-text'
                  }`}
                >
                  {n}
                </button>
              )
            })}
          </div>

          {/* Category feedback */}
          {category && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium ${category.bg} ${category.border} ${category.color}`}>
              <category.Icon className="w-4 h-4 shrink-0" />
              Nota {form.score} — {category.label}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={() => setStep(1)}
              disabled={!canNext0}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${tw.btn} disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              Próximo <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 1: Diagnóstico (condicional) ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className={`px-3 py-2 rounded-xl border text-xs font-medium ${getNPSCategory(form.score).bg} ${getNPSCategory(form.score).border} ${getNPSCategory(form.score).color}`}>
            Nota {form.score} — {category.label}
          </div>
          <div>
            <p className="text-sm font-semibold text-rl-text mb-3">{getQ2Label(form.score)}</p>
            <textarea
              value={form.q2}
              onChange={(e) => setForm(f => ({ ...f, q2: e.target.value }))}
              placeholder="Escreva sua resposta aqui..."
              rows={4}
              autoFocus
              className="input-field resize-none text-sm leading-relaxed w-full"
            />
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(0)} className="text-sm text-rl-muted hover:text-rl-text transition-colors flex items-center gap-1">
              <RotateCcw className="w-3.5 h-3.5" /> Voltar
            </button>
            <button
              onClick={() => setStep(2)}
              disabled={!canNext1}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${tw.btn} disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              Próximo <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Avaliação de áreas ── */}
      {step === 2 && (
        <div className="space-y-5">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-rl-text">Como você avalia a comunicação e o atendimento da equipe?</p>
            <div className="space-y-2">
              {Q3_OPTIONS.map((o) => (
                <RadioOption key={o} label={o} selected={form.q3 === o} onClick={() => setForm(f => ({ ...f, q3: o }))} />
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold text-rl-text">Os resultados das campanhas estão dentro do que foi combinado no início?</p>
            <div className="space-y-2">
              {Q4_OPTIONS.map((o) => (
                <RadioOption key={o} label={o} selected={form.q4 === o} onClick={() => setForm(f => ({ ...f, q4: o }))} />
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold text-rl-text">Você sente que entende o que está sendo feito e por quê?</p>
            <div className="space-y-2">
              {Q5_OPTIONS.map((o) => (
                <RadioOption key={o} label={o} selected={form.q5 === o} onClick={() => setForm(f => ({ ...f, q5: o }))} />
              ))}
            </div>
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="text-sm text-rl-muted hover:text-rl-text transition-colors flex items-center gap-1">
              <RotateCcw className="w-3.5 h-3.5" /> Voltar
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!canNext2}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${tw.btn} disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              Próximo <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Encerramento ── */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-rl-text mb-1">
              Tem algo que você gostaria que a gente soubesse e que não perguntamos aqui?
            </p>
            <p className="text-xs text-rl-muted mb-3">Campo opcional</p>
            <textarea
              value={form.q6}
              onChange={(e) => setForm(f => ({ ...f, q6: e.target.value }))}
              placeholder="Fique à vontade para comentar..."
              rows={4}
              autoFocus
              className="input-field resize-none text-sm leading-relaxed w-full"
            />
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="text-sm text-rl-muted hover:text-rl-text transition-colors flex items-center gap-1">
              <RotateCcw className="w-3.5 h-3.5" /> Voltar
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${tw.btn} disabled:opacity-60`}
            >
              {saving
                ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Salvando...</>
                : <><Send className="w-4 h-4" />Enviar NPS</>
              }
            </button>
          </div>
        </div>
      )}

      {/* Cancel */}
      <div className="pt-1 border-t border-rl-border/40">
        <button onClick={onCancel} className="text-xs text-rl-muted hover:text-rl-text transition-colors">
          Cancelar preenchimento
        </button>
      </div>
    </div>
  )
}

// ─── NPS Result Card ──────────────────────────────────────────────────────────

function NPSResult({ data, marco, onReset }) {
  const cat    = getNPSCategory(data.score)
  const action = getActionLabel(data.score)
  const tw     = marco.tw

  return (
    <div className="space-y-4">
      {/* Score */}
      <div className="flex items-center gap-4">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black ${cat.bg} ${cat.border} border`}>
          <span className={cat.color}>{data.score}</span>
        </div>
        <div>
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border mb-1 ${cat.bg} ${cat.border} ${cat.color}`}>
            <cat.Icon className="w-3.5 h-3.5" />
            {cat.label}
          </div>
          <p className="text-xs text-rl-muted flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Preenchido em {fmtDate(data.submittedAt)}
          </p>
        </div>
      </div>

      {/* Action recommended */}
      <div className={`px-3 py-2.5 rounded-xl border text-xs leading-relaxed ${action.bg} ${action.border} ${action.color}`}>
        <span className="font-semibold">Ação recomendada: </span>{action.text}
      </div>

      {/* Answers */}
      <div className="space-y-3">
        {data.q2 && (
          <div className="glass-card p-3 space-y-1">
            <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wide flex items-center gap-1">
              <MessageSquare className="w-3 h-3" /> Diagnóstico
            </p>
            <p className="text-sm text-rl-text leading-relaxed">{data.q2}</p>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            { label: 'Comunicação', value: data.q3 },
            { label: 'Resultados', value: data.q4 },
            { label: 'Transparência', value: data.q5 },
          ].map(({ label, value }) => value && (
            <div key={label} className="glass-card p-3 space-y-1">
              <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wide">{label}</p>
              <p className="text-xs text-rl-text font-medium leading-snug">{value}</p>
            </div>
          ))}
        </div>
        {data.q6 && (
          <div className="glass-card p-3 space-y-1">
            <p className="text-[10px] font-bold text-rl-muted uppercase tracking-wide flex items-center gap-1">
              <Star className="w-3 h-3" /> Comentário adicional
            </p>
            <p className="text-sm text-rl-text leading-relaxed">{data.q6}</p>
          </div>
        )}
      </div>

      {/* Reset */}
      <button
        onClick={onReset}
        className="flex items-center gap-1.5 text-xs text-rl-muted hover:text-rl-text transition-colors"
      >
        <RotateCcw className="w-3.5 h-3.5" /> Refazer NPS deste marco
      </button>
    </div>
  )
}

// ─── Marco Card ───────────────────────────────────────────────────────────────

function MarcoCard({ marco, data, onSave, onReset }) {
  const [open, setOpen] = useState(false)
  const Icon = marco.icon
  const tw = marco.tw
  const done = !!data?.submittedAt

  return (
    <div className={`glass-card overflow-hidden border ${done ? 'border-rl-green/20' : tw.border}`}>
      {/* Header */}
      <div className={`px-5 py-4 flex items-center justify-between ${done ? 'bg-rl-green/5' : tw.bg}`}>
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${done ? 'bg-rl-green/10 border-rl-green/20' : `${tw.bg} ${tw.border}`}`}>
            {done
              ? <CheckCircle2 className="w-4.5 h-4.5 text-rl-green" />
              : <Icon className={`w-4 h-4 ${tw.text}`} />
            }
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${done ? 'text-rl-green' : tw.text}`}>
                Marco {marco.num}
              </span>
              {done && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rl-green/15 text-rl-green border border-rl-green/20">
                  Concluído
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-rl-text">{marco.title}</p>
            <p className="text-xs text-rl-muted">{marco.description}</p>
          </div>
        </div>
        {done && data?.score !== undefined && (
          <div className={`text-right shrink-0`}>
            <p className={`text-2xl font-black ${getNPSCategory(data.score).color}`}>{data.score}</p>
            <p className={`text-[10px] font-bold ${getNPSCategory(data.score).color}`}>{getNPSCategory(data.score).label}</p>
          </div>
        )}
        {!done && (
          <button
            onClick={() => setOpen((o) => !o)}
            className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tw.btn}`}
          >
            {open ? 'Fechar' : 'Preencher NPS'}
          </button>
        )}
      </div>

      {/* Body */}
      {(open || done) && (
        <div className="px-5 py-4">
          {done
            ? <NPSResult data={data} marco={marco} onReset={onReset} />
            : (
              <NPSForm
                marco={marco}
                onSubmit={async (formData) => {
                  await onSave(formData)
                  setOpen(false)
                }}
                onCancel={() => setOpen(false)}
              />
            )
          }
        </div>
      )}
    </div>
  )
}

// ─── NPS Summary Banner ───────────────────────────────────────────────────────

function NPSSummary({ nps }) {
  const filled = MARCOS.filter((m) => nps?.[m.id]?.submittedAt)
  if (filled.length === 0) return null

  const scores = filled.map((m) => nps[m.id].score)
  const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
  const promotores = scores.filter((s) => s >= 9).length
  const detratores = scores.filter((s) => s <= 6).length
  const npsScore = Math.round(((promotores - detratores) / scores.length) * 100)

  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 className="w-4 h-4 text-rl-purple" />
        <p className="text-sm font-semibold text-rl-text">Visão Geral do NPS</p>
        <span className="text-xs text-rl-muted ml-auto">{filled.length} de {MARCOS.length} marcos preenchidos</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="text-center">
          <p className="text-[10px] text-rl-muted mb-1">NPS Score</p>
          <p className={`text-2xl font-black ${npsScore >= 50 ? 'text-rl-green' : npsScore >= 0 ? 'text-rl-gold' : 'text-red-400'}`}>{npsScore > 0 ? `+${npsScore}` : npsScore}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-rl-muted mb-1">Média de notas</p>
          <p className="text-2xl font-black text-rl-text">{avg}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-rl-muted mb-1">Promotores</p>
          <p className="text-2xl font-black text-rl-green">{promotores}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-rl-muted mb-1">Detratores</p>
          <p className="text-2xl font-black text-red-400">{detratores}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NPSModule({ project }) {
  const { updateProject } = useApp()
  const nps = project.nps || {}

  const handleSave = async (marcoId, formData) => {
    const updated = { ...nps, [marcoId]: formData }
    updateProject(project.id, { nps: updated })
  }

  const handleReset = (marcoId) => {
    const updated = { ...nps, [marcoId]: null }
    updateProject(project.id, { nps: updated })
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-rl-text flex items-center gap-2">
          <Star className="w-5 h-5 text-rl-gold" />
          NPS — Satisfação do Cliente
        </h2>
        <p className="text-sm text-rl-muted mt-0.5">
          Acompanhe a satisfação do cliente em três momentos-chave da parceria
        </p>
      </div>

      {/* Summary */}
      <NPSSummary nps={nps} />

      {/* How it works */}
      <div className="glass-card p-4 space-y-3">
        <p className="text-xs font-bold text-rl-muted uppercase tracking-wide">Como usar as respostas</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-red-400/5 border border-red-400/15">
            <ThumbsDown className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-400">Nota 0–6 (Detrator)</p>
              <p className="text-rl-muted mt-0.5">Account manager entra em contato em até 24h para entender e reverter.</p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-rl-gold/5 border border-rl-gold/15">
            <Minus className="w-4 h-4 text-rl-gold shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rl-gold">Nota 7–8 (Neutro)</p>
              <p className="text-rl-muted mt-0.5">Agendar alinhamento estratégico no próximo ciclo.</p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-rl-green/5 border border-rl-green/15">
            <ThumbsUp className="w-4 h-4 text-rl-green shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rl-green">Nota 9–10 (Promotor)</p>
              <p className="text-rl-muted mt-0.5">Solicitar depoimento ou case ao cliente.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Marcos */}
      <div className="space-y-4">
        {MARCOS.map((marco) => (
          <MarcoCard
            key={marco.id}
            marco={marco}
            data={nps[marco.id] ?? null}
            onSave={(formData) => handleSave(marco.id, formData)}
            onReset={() => handleReset(marco.id)}
          />
        ))}
      </div>
    </div>
  )
}
