import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  Star, ChevronRight, RotateCcw, Send, CheckCircle2,
  Rocket, TrendingUp, Award, Loader2, AlertCircle,
  User, Mail, Phone,
} from 'lucide-react'
import { useI18n, idiomaAtual } from '../i18n'
import { NPS_Q3_OPCOES, NPS_Q4_OPCOES, NPS_Q5_OPCOES, rotuloOpcaoNps } from '../lib/npsOpcoes'

// Texto traduzido com marcadores `{nome}` trocados por elementos (negrito etc.).
function comDestaque(texto, partes) {
  return texto.split(/\{(\w+)\}/g).map((p, i) => (i % 2 ? <span key={i}>{partes[p] ?? `{${p}}`}</span> : p))
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Os marcos vêm do servidor (nps_marcos, migration 080) — cada cliente tem a
// sua lista, de tamanho indeterminado. Cor e ícone são cíclicos por posição.
const MARCO_COLORS = ['#7C3AED', '#2563EB', '#D97706', '#059669']
const MARCO_ICONS  = [Rocket, TrendingUp, Award, Star]

const colorFor = (i) => MARCO_COLORS[i % MARCO_COLORS.length]
const iconFor  = (i) => MARCO_ICONS[i % MARCO_ICONS.length]

// Valor gravado em pt; a tela mostra o rótulo do idioma (nps.opcoes.*).
const Q3_OPTIONS = NPS_Q3_OPCOES
const Q4_OPTIONS = NPS_Q4_OPCOES
const Q5_OPTIONS = NPS_Q5_OPCOES

// Color zones for score numbers — no labels shown to the client
function getScoreZone(n) {
  if (n <= 6) return { bg: '#FEF2F2', border: '#FCA5A5', text: '#DC2626' }
  if (n <= 8) return { bg: '#FFF7ED', border: '#FED7AA', text: '#EA580C' }
  return              { bg: '#F0FDF4', border: '#86EFAC', text: '#16A34A' }
}

function getQ2Label(t, score) {
  if (score <= 6) return t('nps.q2.detrator')
  if (score <= 8) return t('nps.q2.neutro')
  return t('nps.q2.promotor')
}

// ─── Identity Gate ────────────────────────────────────────────────────────────

function IdentityGate({ companyName, onConfirm }) {
  const { t } = useI18n()
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [errors, setErrors] = useState({})

  const validate = () => {
    const e = {}
    if (!form.name.trim())  e.name  = t('formNps.erroNome')
    if (!form.email.trim()) e.email = t('formNps.erroEmail')
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = t('formNps.erroEmailInvalido')
    return e
  }

  const handleConfirm = () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    onConfirm({ name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() })
  }

  const field = (key) => ({
    value: form[key],
    onChange: (e) => {
      setForm(f => ({ ...f, [key]: e.target.value }))
      if (errors[key]) setErrors(er => ({ ...er, [key]: undefined }))
    },
  })

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header strip */}
      <div className="px-6 py-5 border-b border-gray-100" style={{ background: 'linear-gradient(135deg, #7C3AED08 0%, #2563EB08 100%)' }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
            <User className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-sm font-bold text-gray-900">{t('formNps.antesDeComecar')}</p>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed ml-11">
          {companyName
            ? comDestaque(t('formNps.informeDadosEmpresa'), { empresa: <strong className="text-gray-700">{companyName}</strong> })
            : t('formNps.informeDados')}
        </p>
      </div>

      <div className="px-6 py-6 space-y-4">
        {/* Name */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
            {t('formNps.nomeCompleto')} <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" />
            <input
              type="text"
              placeholder={t('formNps.seuNome')}
              autoFocus
              {...field('name')}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
              className={`w-full pl-10 pr-4 py-3 rounded-xl border bg-white text-sm text-gray-800 placeholder-gray-400 outline-none transition-all ${
                errors.name
                  ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100'
                  : 'border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'
              }`}
            />
          </div>
          {errors.name && <p className="text-xs text-red-500 mt-1 ml-0.5">{errors.name}</p>}
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
            {t('formNps.email')} <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" />
            <input
              type="email"
              placeholder={t('formNps.emailPlaceholder')}
              {...field('email')}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
              className={`w-full pl-10 pr-4 py-3 rounded-xl border bg-white text-sm text-gray-800 placeholder-gray-400 outline-none transition-all ${
                errors.email
                  ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100'
                  : 'border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'
              }`}
            />
          </div>
          {errors.email && <p className="text-xs text-red-500 mt-1 ml-0.5">{errors.email}</p>}
        </div>

        {/* Phone (optional) */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
            {t('formNps.telefone')} <span className="text-gray-400 font-normal normal-case">{t('formNps.opcional')}</span>
          </label>
          <div className="relative">
            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none" />
            <input
              type="tel"
              placeholder={t('formNps.telefonePlaceholder')}
              {...field('phone')}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 placeholder-gray-400 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        <button
          onClick={handleConfirm}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.98] mt-2"
          style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)' }}
        >
          {t('formNps.continuar')} <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Score Grid ───────────────────────────────────────────────────────────────

function ScoreGrid({ value, onChange }) {
  const { t } = useI18n()
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
        <span>{t('formNps.muitoImprovavel')}</span>
        <span>{t('formNps.muitoProvavel')}</span>
      </div>
      <div className="h-6 flex items-center justify-center">
        {value !== null && (
          <p className="text-sm text-gray-600 font-medium">
            {comDestaque(t('formNps.notaSelecionada'), { nota: <strong className="text-gray-800">{value}</strong> })}
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

function NPSForm({ accent, onSubmit }) {
  const { t } = useI18n()
  const [step, setStep]     = useState(0)
  const [form, setForm]     = useState({ score: null, q2: '', q3: '', q4: '', q5: '', q6: '' })
  const [saving, setSaving] = useState(false)

  const STEP_LABELS = [0, 1, 2, 3].map((i) => t(`formNps.passos.${i}`))
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
          {t('formNps.etapa', { n: step + 1, total: TOTAL })} <span className="text-gray-600 font-semibold">{STEP_LABELS[step]}</span>
        </p>
      </div>

      {/* ── Step 0 — Nota ── */}
      {step === 0 && (
        <div className="space-y-6">
          <p className="text-base font-semibold text-gray-800 leading-snug">
            {t('formNps.q1')}
          </p>
          <ScoreGrid value={form.score} onChange={(n) => setForm(f => ({ ...f, score: n }))} />
          <div className="flex justify-end">
            <button
              onClick={() => setStep(1)}
              disabled={form.score === null}
              className="flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-semibold text-white shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: accent }}
            >
              {t('formNps.proximo')} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 1 — Opinião ── */}
      {step === 1 && (
        <div className="space-y-4">
          {form.score !== null && (
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
              {t('formNps.notaEscolhida')} <strong className="ml-1 text-gray-800">{form.score}</strong>
            </span>
          )}
          <div>
            <p className="text-base font-semibold text-gray-800 leading-snug mb-3">
              {getQ2Label(t, form.score)}
            </p>
            <textarea
              value={form.q2}
              onChange={(e) => setForm(f => ({ ...f, q2: e.target.value }))}
              placeholder={t('formNps.respostaPlaceholder')}
              rows={5}
              autoFocus
              className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 placeholder-gray-400 outline-none resize-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all leading-relaxed"
            />
          </div>
          <div className="flex justify-between items-center pt-1">
            <button onClick={() => setStep(0)} className="text-sm text-gray-400 hover:text-gray-700 flex items-center gap-1.5 transition-colors">
              <RotateCcw className="w-3.5 h-3.5" /> {t('formNps.voltar')}
            </button>
            <button
              onClick={() => setStep(2)}
              disabled={!form.q2.trim()}
              className="flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-semibold text-white shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: accent }}
            >
              {t('formNps.proximo')} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2 — Avaliações ── */}
      {step === 2 && (
        <div className="space-y-7">
          <div className="space-y-3">
            <p className="text-base font-semibold text-gray-800 leading-snug">
              {t('formNps.q3')}
            </p>
            <div className="space-y-2">
              {Q3_OPTIONS.map((o) => (
                <RadioOpt key={o} label={rotuloOpcaoNps(o)} selected={form.q3 === o} onClick={() => setForm(f => ({ ...f, q3: o }))} />
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-base font-semibold text-gray-800 leading-snug">
              {t('formNps.q4')}
            </p>
            <div className="space-y-2">
              {Q4_OPTIONS.map((o) => (
                <RadioOpt key={o} label={rotuloOpcaoNps(o)} selected={form.q4 === o} onClick={() => setForm(f => ({ ...f, q4: o }))} />
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-base font-semibold text-gray-800 leading-snug">
              {t('formNps.q5')}
            </p>
            <div className="space-y-2">
              {Q5_OPTIONS.map((o) => (
                <RadioOpt key={o} label={rotuloOpcaoNps(o)} selected={form.q5 === o} onClick={() => setForm(f => ({ ...f, q5: o }))} />
              ))}
            </div>
          </div>
          <div className="flex justify-between items-center">
            <button onClick={() => setStep(1)} className="text-sm text-gray-400 hover:text-gray-700 flex items-center gap-1.5 transition-colors">
              <RotateCcw className="w-3.5 h-3.5" /> {t('formNps.voltar')}
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!form.q3 || !form.q4 || !form.q5}
              className="flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-semibold text-white shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: accent }}
            >
              {t('formNps.proximo')} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3 — Comentários ── */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <p className="text-base font-semibold text-gray-800 leading-snug mb-1">
              {t('formNps.q6')}
            </p>
            <p className="text-sm text-gray-400 mb-3">{t('formNps.q6Dica')}</p>
            <textarea
              value={form.q6}
              onChange={(e) => setForm(f => ({ ...f, q6: e.target.value }))}
              placeholder={t('formNps.q6Placeholder')}
              rows={5}
              autoFocus
              className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 placeholder-gray-400 outline-none resize-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all leading-relaxed"
            />
          </div>
          <div className="flex justify-between items-center pt-1">
            <button onClick={() => setStep(2)} className="text-sm text-gray-400 hover:text-gray-700 flex items-center gap-1.5 transition-colors">
              <RotateCcw className="w-3.5 h-3.5" /> {t('formNps.voltar')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-semibold text-white shadow-sm transition-all disabled:opacity-60"
              style={{ background: accent }}
            >
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('formNps.salvando')}</>
                : <><Send className="w-4 h-4" /> {t('formNps.enviar')}</>
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
  const { t } = useI18n()

  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)
  const [companyName, setCompanyName]   = useState('')
  const [identity, setIdentity]         = useState(null)       // null until gate passed
  const [activeMarco, setActiveMarco]   = useState(null)
  const [marcos, setMarcos]             = useState([])
  const [submittedMarcos, setSubmittedMarcos] = useState(new Set()) // session-level
  const [justSubmitted, setJustSubmitted]     = useState(null)      // marcoId flash

  // Link direto abre exatamente o marco pedido. Sem ele, só os elegíveis — a
  // data prevista já passou. Sem esse filtro, um cliente de 3 meses veria o
  // formulário de 12.
  const visibleMarcos = targetMarcoId
    ? marcos.filter(m => m.id === targetMarcoId)
    : marcos.filter(m => m.elegivel)

  const allDone = visibleMarcos.length > 0 && visibleMarcos.every(m => submittedMarcos.has(m.id))

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch(`/api/nps?token=${encodeURIComponent(token)}`, { headers: { 'X-Idioma': idiomaAtual() } })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || t('formNps.erroCarregar'))
        setCompanyName(data.companyName)
        const lista = data.marcos || []
        setMarcos(lista)

        const abrir = targetMarcoId
          ? lista.find(m => m.id === targetMarcoId)
          : lista.find(m => m.elegivel)
        if (abrir) setActiveMarco(abrir.id)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token, targetMarcoId])

  const handleIdentityConfirm = (data) => {
    setIdentity(data)
  }

  const handleSubmit = async (marcoId, formData) => {
    // Merge identity into submission
    const payload = { ...identity, ...formData }

    const res  = await fetch('/api/nps', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Idioma': idiomaAtual() },
      body:    JSON.stringify({ token, marcoId, data: payload }),
    })
    const body = await res.json()
    if (!res.ok) throw new Error(body.error || t('formNps.erroSalvar'))

    // Mark as submitted this session
    setSubmittedMarcos(prev => new Set([...prev, marcoId]))
    setJustSubmitted(marcoId)
    setActiveMarco(null)

    setTimeout(() => {
      setJustSubmitted(null)

      if (!targetMarcoId) {
        // Auto-open next unfilled marco
        const next = visibleMarcos.find(m => m.id !== marcoId && !submittedMarcos.has(m.id) && m.id !== marcoId)
        if (next) setActiveMarco(next.id)
      }
    }, 2500)
  }

  const targetMarco = targetMarcoId ? marcos.find(m => m.id === targetMarcoId) : null

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center [color-scheme:light]">
        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
      </div>
    )
  }

  // ── Error ──
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 [color-scheme:light]">
        <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-8 max-w-sm w-full text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-gray-700 font-semibold mb-1">{t('formNps.linkInvalido')}</p>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 py-12 px-4 [color-scheme:light]">
      <div className="max-w-xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="text-center pb-2">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg mx-auto mb-5">
            <Star className="w-7 h-7 text-white" />
          </div>
          <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-2">Revenue Lab</p>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('formNps.titulo')}</h1>
          {companyName && (
            <p className="text-sm text-gray-500 leading-relaxed max-w-sm mx-auto">
              {targetMarco
                ? comDestaque(t('formNps.introMarco'), { marco: <strong className="text-gray-700">{targetMarco.label}</strong>, empresa: <strong className="text-gray-700">{companyName}</strong> })
                : comDestaque(t('formNps.intro'), { empresa: <strong className="text-gray-700">{companyName}</strong> })
              }
            </p>
          )}
        </div>

        {/* ── Identity Gate (shown until filled) ── */}
        {!identity && (
          <IdentityGate companyName={companyName} onConfirm={handleIdentityConfirm} />
        )}

        {/* ── Content after identity confirmed ── */}
        {identity && (
          <>
            {/* Respondent pill */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl">
              <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                <User className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{identity.name}</p>
                <p className="text-xs text-gray-500 truncate">{identity.email}</p>
              </div>
            </div>

            {/* ── All done ── */}
            {allDone && (
              <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-10 text-center">
                <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  {targetMarcoId ? t('formNps.respostaRegistrada') : t('formNps.muitoObrigado')}
                </h2>
                <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">
                  {targetMarcoId
                    ? t('formNps.feedbackMarco')
                    : t('formNps.feedbackTodos')
                  }
                </p>
                {identity.name && (
                  <p className="text-xs text-gray-400 mt-3">
                    {comDestaque(t('formNps.avaliacaoDe'), { nome: <strong className="text-gray-600">{identity.name}</strong> })}
                  </p>
                )}
              </div>
            )}

            {/* ── Submitted toast ── */}
            {justSubmitted && (
              <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                <p className="text-sm font-medium text-green-700">
                  {comDestaque(t('formNps.marcoRegistrado'), { marco: <strong>{marcos.find(m => m.id === justSubmitted)?.label}</strong> })}
                </p>
              </div>
            )}

            {/* ── Nenhum marco disponível agora ── */}
            {visibleMarcos.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
                <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
                  <Star className="w-8 h-8 text-gray-300" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">{t('formNps.nadaAgora')}</h2>
                <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">
                  {t('formNps.nadaAgoraTexto')}
                </p>
              </div>
            )}

            {/* ── Marco cards ── */}
            {!allDone && visibleMarcos.map((marco, i) => {
              const Icon  = iconFor(i)
              const color = colorFor(i)
              const done  = submittedMarcos.has(marco.id)
              const open  = activeMarco === marco.id && !done

              return (
                <div
                  key={marco.id}
                  className={`bg-white rounded-2xl shadow-sm overflow-hidden transition-all duration-200 ${
                    done ? 'border border-green-100'
                    : open ? 'border-2 shadow-md'
                    : 'border border-gray-100'
                  }`}
                  style={open ? { borderColor: color } : {}}
                >
                  {/* Card header */}
                  <div
                    className="px-6 py-5 flex items-center justify-between gap-4"
                    style={{
                      background: done ? '#F0FDF4' : open ? color + '08' : '#F9FAFB',
                    }}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: done ? '#DCFCE7' : color + '18' }}
                      >
                        {done
                          ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                          : <Icon className="w-4.5 h-4.5" style={{ color }} />
                        }
                      </div>
                      <div className="min-w-0">
                        <p
                          className="text-[11px] font-bold uppercase tracking-wider mb-0.5"
                          style={{ color: done ? '#16A34A' : color }}
                        >
                          {t('formNps.marco', { n: String(i + 1).padStart(2, '0') })}
                          {done ? t('formNps.concluido') : ''}
                        </p>
                        <p className="text-sm font-semibold text-gray-900 truncate">{marco.label}</p>
                        {marco.descricao && <p className="text-xs text-gray-400">{marco.descricao}</p>}
                      </div>
                    </div>

                    {/* Right: done indicator */}
                    {done && (
                      <div className="shrink-0 text-right">
                        <CheckCircle2 className="w-6 h-6 text-green-400" />
                      </div>
                    )}
                    {!done && !open && (
                      <button
                        onClick={() => setActiveMarco(marco.id)}
                        className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 shadow-sm"
                        style={{ background: color }}
                      >
                        {t('formNps.responder')}
                      </button>
                    )}
                  </div>

                  {/* Form */}
                  {open && (
                    <div className="px-6 py-6 border-t border-gray-100">
                      <NPSForm
                        accent={color}
                        onSubmit={(data) => handleSubmit(marco.id, data)}
                      />
                    </div>
                  )}

                  {/* Done success banner */}
                  {done && (
                    <div className="px-6 py-4 border-t border-green-50">
                      <p className="text-xs text-green-600 font-medium flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        {t('formNps.marcoObrigado')}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 pb-6">
          {t('formNps.rodape')}
        </p>

      </div>
    </div>
  )
}
