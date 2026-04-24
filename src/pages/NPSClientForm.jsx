import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  Star, ChevronRight, RotateCcw, Send, CheckCircle2,
  Rocket, TrendingUp, Award, Loader2, AlertCircle, Lock,
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

const MARCOS = [
  { id: 'marco1', num: '01', title: 'Pós-Onboarding',    desc: 'Após a primeira campanha ir ao ar', icon: Rocket,     color: '#7C3AED' },
  { id: 'marco2', num: '02', title: 'Primeiros 3 Meses', desc: '90 dias de parceria',               icon: TrendingUp, color: '#2563EB' },
  { id: 'marco3', num: '03', title: '6 Meses',           desc: 'Meio ano de parceria',              icon: Award,      color: '#D97706' },
]

const Q3_OPTIONS = ['Ruim', 'Regular', 'Bom', 'Excelente']
const Q4_OPTIONS = ['Sim, dentro do esperado', 'Parcialmente', 'Não, abaixo do esperado']
const Q5_OPTIONS = ['Sim, tenho clareza total', 'Às vezes fico com dúvidas', 'Não, sinto falta de mais transparência']

// Color zones for score numbers — no labels shown to the client
function getScoreZone(n) {
  if (n <= 6) return { bg: '#FEF2F2', border: '#FCA5A5', text: '#DC2626' }
  if (n <= 8) return { bg: '#FFF7ED', border: '#FED7AA', text: '#EA580C' }
  return              { bg: '#F0FDF4', border: '#86EFAC', text: '#16A34A' }
}

function getQ2Label(score) {
  if (score <= 6) return 'O que fez você dar essa nota? O que precisaria mudar para você se sentir bem atendido?'
  if (score <= 8) return 'O que está faltando para a nossa parceria ser excelente na sua visão?'
  return 'O que mais te surpreendeu positivamente na nossa parceria até agora?'
}

// ─── Score Grid ───────────────────────────────────────────────────────────────

function ScoreGrid({ value, onChange }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-11 gap-1.5">
        {[0,1,2,3,4,5,6,7,8,9,10].map((n) => {
          const zone = getScoreZone(n)
          const sel  = value === n
          return (
            <button
              key={n}
              onClick={() => onChange(n)}
              className={`h-11 rounded-xl text-sm font-bold transition-all border-2 ${
                sel
                  ? 'shadow-md scale-105'
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
              }`}
              style={sel ? { background: zone.bg, borderColor: zone.border, color: zone.text } : {}}
            >
              {n}
            </button>
          )
        })}
      </div>
      <div className="flex justify-between text-xs text-gray-400 px-0.5">
        <span>← Muito improvável</span>
        <span>Muito provável →</span>
      </div>
      <div className="h-6 flex items-center justify-center">
        {value !== null && (
          <p className="text-sm text-gray-600 font-medium">
            Nota <strong className="text-gray-800">{value}</strong> selecionada
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Radio Option ─────────────────────────────────────────────────────────────

function RadioOpt({ label, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3.5 rounded-xl border text-sm font-medium transition-all ${
        selected
          ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
          selected ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'
        }`}>
          {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
        </div>
        {label}
      </div>
    </button>
  )
}

// ─── NPS Form ─────────────────────────────────────────────────────────────────

function NPSForm({ marco, onSubmit }) {
  const [step, setStep]     = useState(0)
  const [form, setForm]     = useState({ score: null, q2: '', q3: '', q4: '', q5: '', q6: '' })
  const [saving, setSaving] = useState(false)

  const accent      = marco.color
  const STEP_LABELS = ['Sua nota', 'Sua opinião', 'Avaliações', 'Comentários']
  const TOTAL       = STEP_LABELS.length

  const handleSubmit = async () => {
    setSaving(true)
    await onSubmit({ ...form, submittedAt: new Date().toISOString() })
    setSaving(false)
  }

  return (
    <div className="space-y-7">

      {/* ── Progress bar ── */}
      <div className="space-y-1.5">
        <div className="flex gap-1.5">
          {Array.from({ length: TOTAL }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                i < step ? 'bg-green-400' : i === step ? '' : 'bg-gray-200'
              }`}
              style={i === step ? { background: accent } : {}}
            />
          ))}
        </div>
        <p className="text-xs text-gray-400 font-medium">
          Etapa {step + 1} de {TOTAL} — <span className="text-gray-600 font-semibold">{STEP_LABELS[step]}</span>
        </p>
      </div>

      {/* ── Step 0 — Nota ── */}
      {step === 0 && (
        <div className="space-y-6">
          <p className="text-base font-semibold text-gray-800 leading-snug">
            Em uma escala de 0 a 10, qual a probabilidade de você indicar a Revenue Lab para outro empresário?
          </p>
          <ScoreGrid value={form.score} onChange={(n) => setForm(f => ({ ...f, score: n }))} />
          <div className="flex justify-end">
            <button
              onClick={() => setStep(1)}
              disabled={form.score === null}
              className="flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-semibold text-white shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: accent }}
            >
              Próximo <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 1 — Opinião ── */}
      {step === 1 && (
        <div className="space-y-4">
          {form.score !== null && (
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
              Nota selecionada: <strong className="ml-1 text-gray-800">{form.score}</strong>
            </span>
          )}
          <div>
            <p className="text-base font-semibold text-gray-800 leading-snug mb-3">
              {getQ2Label(form.score)}
            </p>
            <textarea
              value={form.q2}
              onChange={(e) => setForm(f => ({ ...f, q2: e.target.value }))}
              placeholder="Escreva sua resposta aqui..."
              rows={5}
              autoFocus
              className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 outline-none resize-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all leading-relaxed"
            />
          </div>
          <div className="flex justify-between items-center pt-1">
            <button onClick={() => setStep(0)} className="text-sm text-gray-400 hover:text-gray-700 flex items-center gap-1.5 transition-colors">
              <RotateCcw className="w-3.5 h-3.5" /> Voltar
            </button>
            <button
              onClick={() => setStep(2)}
              disabled={!form.q2.trim()}
              className="flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-semibold text-white shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: accent }}
            >
              Próximo <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2 — Avaliações ── */}
      {step === 2 && (
        <div className="space-y-7">
          <div className="space-y-3">
            <p className="text-base font-semibold text-gray-800 leading-snug">
              Como você avalia a comunicação e o atendimento da equipe?
            </p>
            <div className="space-y-2">
              {Q3_OPTIONS.map((o) => (
                <RadioOpt key={o} label={o} selected={form.q3 === o} onClick={() => setForm(f => ({ ...f, q3: o }))} />
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-base font-semibold text-gray-800 leading-snug">
              Os resultados das campanhas estão dentro do que foi combinado no início?
            </p>
            <div className="space-y-2">
              {Q4_OPTIONS.map((o) => (
                <RadioOpt key={o} label={o} selected={form.q4 === o} onClick={() => setForm(f => ({ ...f, q4: o }))} />
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-base font-semibold text-gray-800 leading-snug">
              Você sente que entende o que está sendo feito e por quê?
            </p>
            <div className="space-y-2">
              {Q5_OPTIONS.map((o) => (
                <RadioOpt key={o} label={o} selected={form.q5 === o} onClick={() => setForm(f => ({ ...f, q5: o }))} />
              ))}
            </div>
          </div>
          <div className="flex justify-between items-center">
            <button onClick={() => setStep(1)} className="text-sm text-gray-400 hover:text-gray-700 flex items-center gap-1.5 transition-colors">
              <RotateCcw className="w-3.5 h-3.5" /> Voltar
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!form.q3 || !form.q4 || !form.q5}
              className="flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-semibold text-white shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: accent }}
            >
              Próximo <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3 — Comentários ── */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <p className="text-base font-semibold text-gray-800 leading-snug mb-1">
              Tem algo que você gostaria que a gente soubesse e que não perguntamos aqui?
            </p>
            <p className="text-sm text-gray-400 mb-3">Campo opcional — fique à vontade para comentar.</p>
            <textarea
              value={form.q6}
              onChange={(e) => setForm(f => ({ ...f, q6: e.target.value }))}
              placeholder="Seus comentários são muito bem-vindos..."
              rows={5}
              autoFocus
              className="w-full px-4 py-3.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 outline-none resize-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all leading-relaxed"
            />
          </div>
          <div className="flex justify-between items-center pt-1">
            <button onClick={() => setStep(2)} className="text-sm text-gray-400 hover:text-gray-700 flex items-center gap-1.5 transition-colors">
              <RotateCcw className="w-3.5 h-3.5" /> Voltar
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-semibold text-white shadow-sm transition-all disabled:opacity-60"
              style={{ background: accent }}
            >
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
  const [searchParams] = useSearchParams()
  const targetMarcoId = searchParams.get('marco')

  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [companyName, setCompanyName] = useState('')
  const [nps, setNps]                 = useState({})
  const [activeMarco, setActiveMarco] = useState(null)
  const [submitted, setSubmitted]     = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch(`/api/nps?token=${encodeURIComponent(token)}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erro ao carregar.')
        setCompanyName(data.companyName)
        setNps(data.nps || {})

        if (targetMarcoId) {
          const tIdx     = MARCOS.findIndex(m => m.id === targetMarcoId)
          const prev     = tIdx > 0 ? MARCOS[tIdx - 1] : null
          const prevDone = !prev || !!data.nps?.[prev.id]?.submittedAt
          const thisDone = !!data.nps?.[targetMarcoId]?.submittedAt
          if (!thisDone && prevDone) setActiveMarco(targetMarcoId)
        } else {
          const first = MARCOS.find((m, i) => {
            if (data.nps?.[m.id]?.submittedAt) return false
            if (i === 0) return true
            return !!data.nps?.[MARCOS[i - 1].id]?.submittedAt
          })
          if (first) setActiveMarco(first.id)
        }
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token, targetMarcoId])

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

    if (!targetMarcoId) {
      setTimeout(() => {
        setSubmitted(null)
        const next = MARCOS.find((m, i) => {
          if (updated[m.id]?.submittedAt) return false
          if (i === 0) return true
          return !!updated[MARCOS[i - 1].id]?.submittedAt
        })
        if (next) setActiveMarco(next.id)
      }, 2500)
    } else {
      setTimeout(() => setSubmitted(null), 3000)
    }
  }

  const visibleMarcos = targetMarcoId
    ? MARCOS.filter(m => m.id === targetMarcoId)
    : MARCOS

  const allDone = targetMarcoId
    ? !!nps[targetMarcoId]?.submittedAt
    : MARCOS.every(m => nps[m.id]?.submittedAt)

  const targetMarco = targetMarcoId ? MARCOS.find(m => m.id === targetMarcoId) : null

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 py-12 px-4">
      <div className="max-w-xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="text-center pb-2">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg mx-auto mb-5">
            <Star className="w-7 h-7 text-white" />
          </div>
          <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-2">Revenue Lab</p>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Pesquisa de Satisfação</h1>
          {companyName && (
            <p className="text-sm text-gray-500 leading-relaxed max-w-sm mx-auto">
              {targetMarco
                ? <>Olá! Gostaríamos da sua avaliação sobre o <strong className="text-gray-700">Marco {targetMarco.num} — {targetMarco.title}</strong> da parceria com <strong className="text-gray-700">{companyName}</strong>.</>
                : <>Sua opinião sobre a parceria com <strong className="text-gray-700">{companyName}</strong> é muito importante para nós.</>
              }
            </p>
          )}
        </div>

        {/* ── All done ── */}
        {allDone && (
          <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-10 text-center">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {targetMarcoId ? 'Resposta registrada!' : 'Muito obrigado!'}
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">
              {targetMarcoId
                ? 'Seu feedback foi registrado com sucesso. Obrigado por avaliar nossa parceria!'
                : 'Todas as suas respostas foram registradas. Seu feedback é fundamental para continuarmos evoluindo.'
              }
            </p>
          </div>
        )}

        {/* ── Submitted toast ── */}
        {submitted && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
            <p className="text-sm font-medium text-green-700">
              Resposta do <strong>{MARCOS.find(m => m.id === submitted)?.title}</strong> registrada com sucesso!
            </p>
          </div>
        )}

        {/* ── Marco cards ── */}
        {!allDone && visibleMarcos.map((marco) => {
          const Icon     = marco.icon
          const done     = !!nps[marco.id]?.submittedAt
          const open     = activeMarco === marco.id && !done
          const marcoIdx = MARCOS.findIndex(m => m.id === marco.id)
          const prevMarco = marcoIdx > 0 ? MARCOS[marcoIdx - 1] : null
          const locked   = !done && !!prevMarco && !nps[prevMarco.id]?.submittedAt

          return (
            <div
              key={marco.id}
              className={`bg-white rounded-2xl shadow-sm overflow-hidden transition-all duration-200 ${
                done   ? 'border border-green-100'
                : locked ? 'border border-gray-100 opacity-70'
                : open   ? 'border-2 shadow-md'
                : 'border border-gray-100'
              }`}
              style={open && !locked ? { borderColor: marco.color } : {}}
            >
              {/* Card header */}
              <div
                className="px-6 py-5 flex items-center justify-between gap-4"
                style={{
                  background: done   ? '#F0FDF4'
                    : locked ? '#FAFAFA'
                    : open   ? marco.color + '08'
                    : '#F9FAFB',
                }}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: done ? '#DCFCE7' : locked ? '#F3F4F6' : marco.color + '18' }}
                  >
                    {done
                      ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                      : locked
                        ? <Lock className="w-4 h-4 text-gray-400" />
                        : <Icon className="w-4.5 h-4.5" style={{ color: marco.color }} />
                    }
                  </div>
                  <div className="min-w-0">
                    <p
                      className="text-[11px] font-bold uppercase tracking-wider mb-0.5"
                      style={{ color: done ? '#16A34A' : locked ? '#9CA3AF' : marco.color }}
                    >
                      Marco {marco.num}
                      {done   ? ' · Concluído'   : ''}
                      {locked ? ' · Aguardando'  : ''}
                    </p>
                    <p className="text-sm font-semibold text-gray-900 truncate">{marco.title}</p>
                    <p className="text-xs text-gray-400">{marco.desc}</p>
                  </div>
                </div>

                {/* Right: done shows score number only (no category label) */}
                {done && nps[marco.id]?.score !== undefined && (
                  <div className="shrink-0 text-right">
                    <p className="text-3xl font-black text-gray-800 leading-none">{nps[marco.id].score}</p>
                    <p className="text-[10px] text-gray-400 font-medium mt-0.5">sua nota</p>
                  </div>
                )}
                {!done && !open && !locked && (
                  <button
                    onClick={() => setActiveMarco(marco.id)}
                    className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 shadow-sm"
                    style={{ background: marco.color }}
                  >
                    Responder
                  </button>
                )}
              </div>

              {/* Locked explanation */}
              {locked && (
                <div className="px-6 py-4 border-t border-gray-100">
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Complete o{' '}
                    <strong className="text-gray-600">
                      Marco {MARCOS[marcoIdx - 1].num} — {MARCOS[marcoIdx - 1].title}
                    </strong>{' '}
                    primeiro para liberar este.
                  </p>
                </div>
              )}

              {/* Form */}
              {open && !locked && (
                <div className="px-6 py-6 border-t border-gray-100">
                  <NPSForm
                    marco={marco}
                    onSubmit={(data) => handleSubmit(marco.id, data)}
                  />
                </div>
              )}

              {/* Done answers summary */}
              {done && (
                <div className="px-6 py-4 border-t border-green-50 space-y-3">
                  {nps[marco.id]?.q2 && (
                    <div className="bg-gray-50 rounded-xl px-4 py-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Sua opinião</p>
                      <p className="text-sm text-gray-700 leading-relaxed">{nps[marco.id].q2}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      { label: 'Comunicação', value: nps[marco.id]?.q3 },
                      { label: 'Resultados',  value: nps[marco.id]?.q4 },
                      { label: 'Clareza',     value: nps[marco.id]?.q5 },
                    ].filter(({ value }) => value).map(({ label, value }) => (
                      <div key={label} className="bg-gray-50 rounded-xl px-3 py-2.5">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
                        <p className="text-xs text-gray-700 font-medium leading-snug">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 pb-6">
          Revenue Lab · Seus dados são usados somente para melhorar a qualidade da nossa parceria.
        </p>

      </div>
    </div>
  )
}
