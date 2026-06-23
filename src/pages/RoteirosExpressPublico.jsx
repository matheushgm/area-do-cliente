import { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {
  PRODUTO_QS, ALL_QS, EMPTY_ANSWERS, PUBLIC_TOKEN,
} from '../lib/roteirosExpress'
import {
  Clapperboard, ArrowLeft, ArrowRight, Loader2, CheckCircle2,
  Package, Users, Sparkles, AlertTriangle,
} from 'lucide-react'

// Passos = 10 perguntas + 1 passo de contato (opcional).
const CONTACT_STEP = ALL_QS.length // índice 10

export default function RoteirosExpressPublico() {
  const { token } = useParams()
  const tokenOk = token === PUBLIC_TOKEN

  const [answers, setAnswers] = useState(EMPTY_ANSWERS)
  const [nome, setNome] = useState('')
  const [contato, setContato] = useState('')
  const [website, setWebsite] = useState('') // honeypot (oculto)
  const [current, setCurrent] = useState(0)
  const [status, setStatus] = useState('form') // 'form' | 'sending' | 'done'
  const [error, setError] = useState(null)

  const inputRef = useRef(null)

  const isContact = current === CONTACT_STEP
  const q = !isContact ? ALL_QS[current] : null
  const total = ALL_QS.length
  const progress = Math.round(((isContact ? total : current) / total) * 100)
  const section = q ? (PRODUTO_QS.some((x) => x.id === q.id) ? 'produto' : 'cliente') : null

  // Foca o campo a cada troca de passo.
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 60)
    return () => clearTimeout(t)
  }, [current])

  const currentValue = isContact ? '' : (answers[q.id] || '')
  const canAdvance = isContact ? true : !!currentValue.trim()

  function next() {
    if (!isContact && !currentValue.trim()) return
    setError(null)
    if (current < CONTACT_STEP) setCurrent((c) => c + 1)
  }

  function back() {
    setError(null)
    if (current > 0) setCurrent((c) => c - 1)
  }

  async function submit() {
    setStatus('sending')
    setError(null)
    try {
      const res = await fetch('/api/roteiros-express', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: PUBLIC_TOKEN, answers, nome, contato, website }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Não foi possível enviar. Tente novamente.')
      setStatus('done')
    } catch (e) {
      setError(e.message)
      setStatus('form')
    }
  }

  function handleKeyDown(e) {
    // Enter avança (Shift+Enter quebra linha no textarea).
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (isContact) submit()
      else if (canAdvance) next()
    }
  }

  // ── Link inválido ────────────────────────────────────────────────────────────
  if (!tokenOk) {
    return (
      <Shell>
        <div className="glass-card p-8 text-center max-w-md w-full">
          <AlertTriangle className="w-10 h-10 text-rl-gold mx-auto mb-3" />
          <h1 className="text-lg font-bold text-rl-text mb-1">Link inválido</h1>
          <p className="text-sm text-rl-muted">Confira o endereço com quem te enviou o convite.</p>
        </div>
      </Shell>
    )
  }

  // ── Tela de sucesso ──────────────────────────────────────────────────────────
  if (status === 'done') {
    return (
      <Shell>
        <div className="glass-card p-8 sm:p-10 text-center max-w-md w-full animate-slide-up">
          <div className="w-16 h-16 rounded-full bg-rl-green/15 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-9 h-9 text-rl-green" />
          </div>
          <h1 className="text-2xl font-bold text-rl-text mb-2">Recebemos suas respostas! 🎉</h1>
          <p className="text-sm text-rl-muted leading-relaxed">
            A partir delas, nosso time vai montar <strong className="text-rl-text">2 roteiros de vídeo</strong> sob medida
            para os seus anúncios. Pode fechar esta página.
          </p>
        </div>
      </Shell>
    )
  }

  // ── Wizard ───────────────────────────────────────────────────────────────────
  return (
    <Shell>
      <div className="w-full max-w-xl">
        {/* Progresso */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-rl-purple">
              {section === 'produto' && <><Package className="w-3.5 h-3.5" /> Sobre o produto</>}
              {section === 'cliente' && <><Users className="w-3.5 h-3.5" /> Sobre o cliente</>}
              {isContact && <><Sparkles className="w-3.5 h-3.5" /> Quase lá</>}
            </span>
            <span className="text-[11px] font-semibold text-rl-muted tabular-nums">
              {isContact ? `${total} de ${total}` : `${current + 1} de ${total}`}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-rl-surface overflow-hidden">
            <div
              className="h-full bg-gradient-rl rounded-full transition-all duration-500 ease-out"
              style={{ width: `${Math.max(progress, 6)}%` }}
            />
          </div>
        </div>

        {/* Cartão da pergunta (re-anima a cada passo via key) */}
        <div key={current} className="glass-card p-6 sm:p-8 animate-slide-up">
          {!isContact ? (
            <>
              <label className="block text-xl sm:text-2xl font-bold text-rl-text leading-snug">
                {q.label}
              </label>
              {q.hint && <p className="text-sm text-rl-muted mt-2">{q.hint}</p>}
              <textarea
                ref={inputRef}
                value={currentValue}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                onKeyDown={handleKeyDown}
                rows={3}
                placeholder={q.ph}
                className="input-field w-full text-base mt-5 resize-none"
              />
            </>
          ) : (
            <>
              <label className="block text-xl sm:text-2xl font-bold text-rl-text leading-snug">
                Como podemos te identificar?
              </label>
              <p className="text-sm text-rl-muted mt-2">Opcional, mas ajuda a gente a falar com você.</p>
              <div className="space-y-3 mt-5">
                <input
                  ref={inputRef}
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Seu nome ou nome do negócio"
                  className="input-field w-full text-base"
                />
                <input
                  value={contato}
                  onChange={(e) => setContato(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="WhatsApp ou e-mail (opcional)"
                  className="input-field w-full text-base"
                />
              </div>
              {/* Honeypot anti-bot (oculto para humanos) */}
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="hidden"
                aria-hidden="true"
              />
            </>
          )}

          {error && (
            <div className="flex items-start gap-2 mt-4 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Navegação */}
          <div className="flex items-center justify-between gap-3 mt-6">
            <button
              onClick={back}
              disabled={current === 0 || status === 'sending'}
              className="flex items-center gap-1.5 text-sm px-3 py-2.5 rounded-xl text-rl-muted hover:text-rl-text disabled:opacity-0 disabled:pointer-events-none transition-all"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>

            {!isContact ? (
              <button
                onClick={next}
                disabled={!canAdvance}
                className="btn-primary flex items-center gap-2 text-sm px-6 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continuar <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={status === 'sending'}
                className="btn-primary flex items-center gap-2 text-sm px-6 py-2.5 disabled:opacity-60"
              >
                {status === 'sending'
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                  : <><Sparkles className="w-4 h-4" /> Enviar respostas</>}
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-[11px] text-rl-muted mt-5">
          Leva menos de 2 minutos. Dica: aperte Enter para avançar.
        </p>
      </div>
    </Shell>
  )
}

// ─── Casca pública (logo + fundo) ─────────────────────────────────────────────
function Shell({ children }) {
  return (
    <div className="min-h-screen bg-gradient-dark flex flex-col items-center justify-center px-4 py-10">
      <div className="flex items-center gap-2.5 mb-8">
        <img src="/logo-revenue-azul-2024.png" alt="Revenue Lab" className="h-8 w-auto object-contain" />
        <div className="flex items-center gap-1.5 text-rl-muted">
          <Clapperboard className="w-4 h-4 text-rl-purple" />
          <span className="text-sm font-semibold text-rl-text">Roteiros Express</span>
        </div>
      </div>
      {children}
    </div>
  )
}
