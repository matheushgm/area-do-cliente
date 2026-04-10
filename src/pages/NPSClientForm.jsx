import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {
  Star, ChevronRight, RotateCcw, Send, CheckCircle2,
  ThumbsUp, ThumbsDown, Minus, Rocket, TrendingUp, Award,
  Loader2, AlertCircle,
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const MARCOS = [
  { id: 'marco1', num: '01', title: 'Pós-Onboarding',    desc: 'Após a primeira campanha ir ao ar', icon: Rocket,    color: '#7C3AED' },
  { id: 'marco2', num: '02', title: 'Primeiros 3 Meses', desc: '90 dias de parceria',               icon: TrendingUp, color: '#2563EB' },
  { id: 'marco3', num: '03', title: '6 Meses',           desc: 'Meio ano de parceria',              icon: Award,     color: '#D97706' },
]

const Q3_OPTIONS = ['Ruim', 'Regular', 'Bom', 'Excelente']
const Q4_OPTIONS = ['Sim, dentro do esperado', 'Parcialmente', 'Não, abaixo do esperado']
const Q5_OPTIONS = ['Sim, tenho clareza total', 'Às vezes fico com dúvidas', 'Não, sinto falta de mais transparência']

function getNPSCategory(score) {
  if (score <= 6) return { label: 'Detrator',  color: '#EF4444', Icon: ThumbsDown }
  if (score <= 8) return { label: 'Neutro',    color: '#D97706', Icon: Minus      }
  return              { label: 'Promotor',  color: '#10B981', Icon: ThumbsUp   }
}

function getQ2Label(score) {
  if (score <= 6) return 'O que fez você dar essa nota? O que precisaria mudar para você se sentir bem atendido?'
  if (score <= 8) return 'O que está faltando para a nossa parceria ser excelente na sua visão?'
  return 'O que mais te surpreendeu positivamente na nossa parceria até agora?'
}

// ─── Score Button ─────────────────────────────────────────────────────────────

function ScoreBtn({ n, selected, onClick }) {
  const cat = getNPSCategory(n)
  return (
    <button
      onClick={onClick}
      style={selected ? { background: cat.color + '20', borderColor: cat.color, color: cat.color } : {}}
      className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl text-sm font-bold transition-all border
        ${selected ? 'scale-110 shadow-sm' : 'border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700 bg-white'}`}
    >
      {n}
    </button>
  )
}

// ─── Radio Opt ────────────────────────────────────────────────────────────────

function RadioOpt({ label, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
        selected ? 'bg-indigo-50 border-indigo-400 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${selected ? 'border-indigo-500' : 'border-gray-300'}`}>
          {selected && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
        </div>
        {label}
      </div>
    </button>
  )
}

// ─── NPS Form ─────────────────────────────────────────────────────────────────

function NPSForm({ marco, onSubmit }) {
  const [step, setStep]   = useState(0)
  const [form, setForm]   = useState({ score: null, q2: '', q3: '', q4: '', q5: '', q6: '' })
  const [saving, setSaving] = useState(false)

  const accentColor = marco.color
  const cat = form.score !== null ? getNPSCategory(form.score) : null

  const handleSubmit = async () => {
    setSaving(true)
    await onSubmit({ ...form, submittedAt: new Date().toISOString() })
    setSaving(false)
  }

  const steps = ['Nota', 'Diagnóstico', 'Avaliação', 'Encerramento']

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center gap-1.5">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
              ${i < step  ? 'bg-green-500 text-white' : i === step ? 'text-white' : 'bg-gray-100 text-gray-400'}`}
              style={i === step ? { background: accentColor } : {}}
            >
              {i < step ? '✓' : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${i === step ? 'text-gray-800' : 'text-gray-400'}`}>{s}</span>
            {i < steps.length - 1 && <div className="w-3 h-px bg-gray-200 shrink-0" />}
          </div>
        ))}
      </div>

      {/* Step 0 — Nota */}
      {step === 0 && (
        <div className="space-y-5">
          <div>
            <p className="font-semibold text-gray-800 leading-snug mb-1">
              Em uma escala de 0 a 10, qual a probabilidade de você indicar a Revenue Lab para outro empresário?
            </p>
            <p className="text-sm text-gray-500">0 = Jamais indicaria · 10 = Indicaria com certeza</p>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {[0,1,2,3,4,5,6,7,8,9,10].map((n) => (
              <ScoreBtn key={n} n={n} selected={form.score === n} onClick={() => setForm(f => ({ ...f, score: n }))} />
            ))}
          </div>
          {cat && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium"
              style={{ background: cat.color + '15', color: cat.color }}>
              <cat.Icon className="w-4 h-4 shrink-0" />
              Nota {form.score} — {cat.label}
            </div>
          )}
          <div className="flex justify-end">
            <button onClick={() => setStep(1)} disabled={form.score === null}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: accentColor }}>
              Próximo <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 1 — Diagnóstico */}
      {step === 1 && (
        <div className="space-y-4">
          {cat && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: cat.color + '15', color: cat.color }}>
              <cat.Icon className="w-3.5 h-3.5" /> Nota {form.score} — {cat.label}
            </div>
          )}
          <div>
            <p className="font-semibold text-gray-800 mb-3">{getQ2Label(form.score)}</p>
            <textarea value={form.q2} onChange={(e) => setForm(f => ({ ...f, q2: e.target.value }))}
              placeholder="Escreva sua resposta aqui..." rows={4} autoFocus
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 outline-none resize-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" />
          </div>
          <div className="flex justify-between items-center">
            <button onClick={() => setStep(0)} className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors">
              <RotateCcw className="w-3.5 h-3.5" /> Voltar
            </button>
            <button onClick={() => setStep(2)} disabled={!form.q2.trim()}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
              style={{ background: accentColor }}>
              Próximo <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2 — Avaliação */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="font-semibold text-gray-800">Como você avalia a comunicação e o atendimento da equipe?</p>
            <div className="space-y-2">
              {Q3_OPTIONS.map((o) => <RadioOpt key={o} label={o} selected={form.q3 === o} onClick={() => setForm(f => ({ ...f, q3: o }))} />)}
            </div>
          </div>
          <div className="space-y-3">
            <p className="font-semibold text-gray-800">Os resultados das campanhas estão dentro do que foi combinado no início?</p>
            <div className="space-y-2">
              {Q4_OPTIONS.map((o) => <RadioOpt key={o} label={o} selected={form.q4 === o} onClick={() => setForm(f => ({ ...f, q4: o }))} />)}
            </div>
          </div>
          <div className="space-y-3">
            <p className="font-semibold text-gray-800">Você sente que entende o que está sendo feito e por quê?</p>
            <div className="space-y-2">
              {Q5_OPTIONS.map((o) => <RadioOpt key={o} label={o} selected={form.q5 === o} onClick={() => setForm(f => ({ ...f, q5: o }))} />)}
            </div>
          </div>
          <div className="flex justify-between items-center">
            <button onClick={() => setStep(1)} className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors">
              <RotateCcw className="w-3.5 h-3.5" /> Voltar
            </button>
            <button onClick={() => setStep(3)} disabled={!form.q3 || !form.q4 || !form.q5}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
              style={{ background: accentColor }}>
              Próximo <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Encerramento */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <p className="font-semibold text-gray-800 mb-1">Tem algo que você gostaria que a gente soubesse e que não perguntamos aqui?</p>
            <p className="text-sm text-gray-500 mb-3">Campo opcional</p>
            <textarea value={form.q6} onChange={(e) => setForm(f => ({ ...f, q6: e.target.value }))}
              placeholder="Fique à vontade para comentar..." rows={4} autoFocus
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 outline-none resize-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all" />
          </div>
          <div className="flex justify-between items-center">
            <button onClick={() => setStep(2)} className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors">
              <RotateCcw className="w-3.5 h-3.5" /> Voltar
            </button>
            <button onClick={handleSubmit} disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
              style={{ background: accentColor }}>
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                : <><Send className="w-4 h-4" /> Enviar resposta</>
              }
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NPSClientForm() {
  const { token } = useParams()
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)
  const [companyName, setCompanyName]   = useState('')
  const [nps, setNps]                   = useState({})
  const [activeMarco, setActiveMarco]   = useState(null)
  const [submitted, setSubmitted]       = useState(null) // marcoId just submitted

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch(`/api/nps?token=${encodeURIComponent(token)}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erro ao carregar.')
        setCompanyName(data.companyName)
        setNps(data.nps || {})

        // Auto-open first unfilled marco
        const first = MARCOS.find((m) => !data.nps?.[m.id]?.submittedAt)
        if (first) setActiveMarco(first.id)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  const handleSubmit = async (marcoId, formData) => {
    const res  = await fetch('/api/nps', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token, marcoId, data: formData }),
    })
    const body = await res.json()
    if (!res.ok) throw new Error(body.error || 'Erro ao salvar.')

    const updated = { ...nps, [marcoId]: formData }
    setNps(updated)
    setSubmitted(marcoId)
    setActiveMarco(null)

    // Auto-open next unfilled after 2s
    setTimeout(() => {
      setSubmitted(null)
      const next = MARCOS.find((m) => !updated[m.id]?.submittedAt && m.id !== marcoId)
      if (next) setActiveMarco(next.id)
    }, 2500)
  }

  const allDone = MARCOS.every((m) => nps[m.id]?.submittedAt)

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
      </div>
    )
  }

  // ── Error ──
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-8 max-w-sm w-full text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-gray-700 font-semibold mb-1">Link inválido</p>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg mx-auto">
            <Star className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-indigo-600 uppercase tracking-wide mb-1">Revenue Lab</p>
            <h1 className="text-2xl font-bold text-gray-900">Pesquisa de Satisfação</h1>
            {companyName && (
              <p className="text-gray-500 mt-1">Sua opinião sobre a parceria com <strong className="text-gray-700">{companyName}</strong> é muito importante para nós.</p>
            )}
          </div>
        </div>

        {/* All done celebration */}
        {allDone && (
          <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Muito obrigado!</h2>
            <p className="text-gray-500">Todas as suas respostas foram registradas. Seu feedback é fundamental para continuarmos evoluindo a nossa parceria.</p>
          </div>
        )}

        {/* Just submitted toast */}
        {submitted && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
            <p className="text-sm font-medium text-green-700">Resposta do {MARCOS.find(m => m.id === submitted)?.title} registrada com sucesso!</p>
          </div>
        )}

        {/* Marco cards */}
        {MARCOS.map((marco) => {
          const Icon = marco.icon
          const done = !!nps[marco.id]?.submittedAt
          const open = activeMarco === marco.id && !done
          const cat  = done ? getNPSCategory(nps[marco.id].score) : null

          return (
            <div key={marco.id} className={`bg-white rounded-2xl shadow-sm overflow-hidden transition-all
              ${done ? 'border border-green-100' : open ? 'border-2' : 'border border-gray-100'}`}
              style={open ? { borderColor: marco.color } : {}}
            >
              {/* Card header */}
              <div className="px-6 py-4 flex items-center justify-between"
                style={{ background: done ? '#F0FDF4' : open ? marco.color + '10' : '#F9FAFB' }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: done ? '#DCFCE7' : marco.color + '20' }}>
                    {done
                      ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                      : <Icon className="w-4 h-4" style={{ color: marco.color }} />
                    }
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: done ? '#16A34A' : marco.color }}>
                      Marco {marco.num} {done && '· Concluído'}
                    </p>
                    <p className="text-sm font-semibold text-gray-800">{marco.title}</p>
                    <p className="text-xs text-gray-500">{marco.desc}</p>
                  </div>
                </div>
                {done && cat && (
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-black" style={{ color: cat.color }}>{nps[marco.id].score}</p>
                    <p className="text-xs font-bold" style={{ color: cat.color }}>{cat.label}</p>
                  </div>
                )}
                {!done && !open && (
                  <button onClick={() => setActiveMarco(marco.id)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                    style={{ background: marco.color }}>
                    Responder
                  </button>
                )}
              </div>

              {/* Form */}
              {open && (
                <div className="px-6 py-5 border-t border-gray-100">
                  <NPSForm
                    marco={marco}
                    onSubmit={(data) => handleSubmit(marco.id, data)}
                  />
                </div>
              )}

              {/* Done summary */}
              {done && (
                <div className="px-6 py-4 border-t border-green-50">
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    {[
                      { label: 'Comunicação', value: nps[marco.id].q3 },
                      { label: 'Resultados',  value: nps[marco.id].q4 },
                      { label: 'Clareza',     value: nps[marco.id].q5 },
                    ].map(({ label, value }) => value && (
                      <div key={label} className="bg-gray-50 rounded-xl p-2.5">
                        <p className="text-gray-400 font-semibold mb-0.5">{label}</p>
                        <p className="text-gray-700 font-medium leading-snug">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 pb-4">
          Revenue Lab · Seus dados são usados somente para melhorar a qualidade da nossa parceria.
        </p>
      </div>
    </div>
  )
}
