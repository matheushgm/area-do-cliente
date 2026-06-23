import { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import MarkdownBlock from '../components/Criativos/MarkdownBlock'
import {
  PRODUTO_QS, ALL_QS, EMPTY_ANSWERS, PUBLIC_TOKEN,
  postRoteiro, streamRoteiro, splitScripts,
} from '../lib/roteirosExpress'
import {
  Clapperboard, ArrowLeft, ArrowRight, Loader2, CheckCircle2, Wand2, Lock,
  Package, Users, Sparkles, AlertTriangle, PenLine, Send,
} from 'lucide-react'

const CONTACT_STEP = ALL_QS.length // índice 10

export default function RoteirosExpressPublico() {
  const { token } = useParams()
  const tokenOk = token === PUBLIC_TOKEN

  const [answers, setAnswers] = useState(EMPTY_ANSWERS)
  const [nome, setNome] = useState('')
  const [contato, setContato] = useState('')
  const [website, setWebsite] = useState('') // honeypot (oculto)
  const [current, setCurrent] = useState(0)

  // 'form' | 'generating' | 'result' | 'error'
  const [status, setStatus] = useState('form')
  const [error, setError] = useState(null)
  const [respId, setRespId] = useState(null)
  const [scripts, setScripts] = useState([]) // [{ content, refineUsed }]
  const [streamingText, setStreamingText] = useState('')

  // refino
  const [refiningIdx, setRefiningIdx] = useState(null)
  const [refineNote, setRefineNote] = useState('')
  const [refineStream, setRefineStream] = useState('')
  const [busy, setBusy] = useState(false)

  const inputRef = useRef(null)

  const isContact = current === CONTACT_STEP
  const q = !isContact ? ALL_QS[current] : null
  const total = ALL_QS.length
  const progress = Math.round(((isContact ? total : current) / total) * 100)
  const section = q ? (PRODUTO_QS.some((x) => x.id === q.id) ? 'produto' : 'cliente') : null

  useEffect(() => {
    if (status !== 'form') return
    const t = setTimeout(() => inputRef.current?.focus(), 60)
    return () => clearTimeout(t)
  }, [current, status])

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

  // ── Finalizar → salva + gera os 2 roteiros ──────────────────────────────────
  async function finish() {
    setStatus('generating')
    setError(null)
    setStreamingText('')
    try {
      let id = respId
      if (!id) {
        const r = await postRoteiro('submit', { answers, nome, contato, website })
        id = r.id
        setRespId(id)
      }
      // Honeypot (bot): submit volta sem id — encerra sem gerar.
      if (!id) { setScripts([]); setStatus('result'); return }

      const full = await streamRoteiro('generate', { id }, setStreamingText)
      const sc = splitScripts(full)
      setScripts(sc)
      setStatus('result')
      postRoteiro('save-scripts', { id, scripts: sc }).catch(() => {})
    } catch (e) {
      setError(e.message || 'Não foi possível gerar agora.')
      setStatus('error')
    }
  }

  // ── Refinar 1 roteiro (1x) ──────────────────────────────────────────────────
  async function applyRefine(idx) {
    const note = refineNote.trim()
    if (!note || busy) return
    setBusy(true)
    setError(null)
    setRefineStream('')
    try {
      const full = await streamRoteiro('refine', { id: respId, index: idx, note }, setRefineStream)
      const updated = scripts.map((s, i) =>
        i === idx ? { content: full.replace(/—/g, '-').trim(), refineUsed: true } : s)
      setScripts(updated)
      setRefiningIdx(null); setRefineNote(''); setRefineStream('')
      postRoteiro('save-scripts', { id: respId, scripts: updated }).catch(() => {})
    } catch (e) {
      setError(e.message || 'Não foi possível refinar.')
    } finally {
      setBusy(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (isContact) finish()
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

  // ── Gerando ──────────────────────────────────────────────────────────────────
  if (status === 'generating') {
    return (
      <Shell>
        <div className="w-full max-w-xl">
          <div className="glass-card p-6 sm:p-8">
            <div className="flex items-center gap-2 text-rl-purple mb-4">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm font-bold">Criando seus 2 roteiros de vídeo...</span>
            </div>
            {streamingText
              ? <MarkdownBlock content={streamingText} />
              : <p className="text-sm text-rl-muted">Analisando seu público e montando os ganchos. Isso leva alguns segundos.</p>}
          </div>
        </div>
      </Shell>
    )
  }

  // ── Erro na geração ──────────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <Shell>
        <div className="glass-card p-8 text-center max-w-md w-full">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-rl-text mb-1">Tivemos um problema</h1>
          <p className="text-sm text-rl-muted mb-1">{error}</p>
          <p className="text-xs text-rl-muted mb-5">Suas respostas foram salvas. É só tentar de novo.</p>
          <button onClick={finish} className="btn-primary inline-flex items-center gap-2 text-sm px-5 py-2.5">
            <Sparkles className="w-4 h-4" /> Tentar novamente
          </button>
        </div>
      </Shell>
    )
  }

  // ── Resultado: 2 roteiros + refino ───────────────────────────────────────────
  if (status === 'result') {
    return (
      <Shell>
        <div className="w-full max-w-xl space-y-5">
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-rl-green/15 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-8 h-8 text-rl-green" />
            </div>
            <h1 className="text-2xl font-bold text-rl-text">Seus roteiros estão prontos! 🎉</h1>
            <p className="text-sm text-rl-muted mt-1">
              {scripts.length
                ? 'Use nos seus anúncios. Você pode refinar cada roteiro uma vez.'
                : 'Recebemos suas respostas. Nosso time vai cuidar do resto.'}
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {scripts.map((script, idx) => {
            const isRefiningThis = refiningIdx === idx
            const showStream = busy && isRefiningThis && refineStream
            return (
              <div key={idx} className="glass-card p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full text-rl-purple bg-rl-purple/10 border border-rl-purple/30">
                    <Clapperboard className="w-3 h-3" /> ROTEIRO {idx + 1}
                  </span>
                  {script.refineUsed ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-rl-green">
                      <CheckCircle2 className="w-3 h-3" /> Refinado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] text-rl-muted">
                      <Wand2 className="w-3 h-3" /> 1 refinamento disponível
                    </span>
                  )}
                </div>

                <MarkdownBlock content={showStream ? refineStream : script.content} />

                {!script.refineUsed && !busy && (
                  isRefiningThis ? (
                    <div className="rounded-xl border border-rl-purple/30 bg-rl-purple/5 p-3 space-y-2">
                      <label className="text-[11px] font-bold text-rl-text flex items-center gap-1.5">
                        <PenLine className="w-3.5 h-3.5 text-rl-purple" /> O que você quer ajustar?
                      </label>
                      <textarea autoFocus value={refineNote} onChange={(e) => setRefineNote(e.target.value)}
                        rows={3} placeholder="Ex.: deixe o gancho mais forte e fale do preço promocional."
                        className="input-field w-full text-sm resize-none" />
                      <p className="text-[10px] text-rl-muted">Você tem apenas <strong>1 refinamento</strong> neste roteiro.</p>
                      <div className="flex items-center gap-2">
                        <button onClick={() => applyRefine(idx)} disabled={!refineNote.trim()}
                          className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5 disabled:opacity-50">
                          <Send className="w-3.5 h-3.5" /> Aplicar
                        </button>
                        <button onClick={() => { setRefiningIdx(null); setRefineNote('') }}
                          className="text-xs px-3 py-1.5 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-text transition-all">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => { setRefiningIdx(idx); setRefineNote(''); setRefineStream('') }}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-rl-surface border border-rl-border text-rl-muted hover:text-rl-purple hover:border-rl-purple/40 transition-all">
                      <Wand2 className="w-3.5 h-3.5" /> Refinar este roteiro
                    </button>
                  )
                )}

                {script.refineUsed && (
                  <div className="flex items-center gap-1.5 text-[11px] text-rl-muted">
                    <Lock className="w-3 h-3" /> Refinamento já utilizado.
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Shell>
    )
  }

  // ── Wizard (form) ────────────────────────────────────────────────────────────
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
            <div className="h-full bg-gradient-rl rounded-full transition-all duration-500 ease-out"
              style={{ width: `${Math.max(progress, 6)}%` }} />
          </div>
        </div>

        <div key={current} className="glass-card p-6 sm:p-8 animate-slide-up">
          {!isContact ? (
            <>
              <label className="block text-xl sm:text-2xl font-bold text-rl-text leading-snug">{q.label}</label>
              {q.hint && <p className="text-sm text-rl-muted mt-2">{q.hint}</p>}
              <textarea ref={inputRef} value={currentValue}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                onKeyDown={handleKeyDown} rows={3} placeholder={q.ph}
                className="input-field w-full text-base mt-5 resize-none" />
            </>
          ) : (
            <>
              <label className="block text-xl sm:text-2xl font-bold text-rl-text leading-snug">Como podemos te identificar?</label>
              <p className="text-sm text-rl-muted mt-2">Opcional, mas ajuda a gente a falar com você.</p>
              <div className="space-y-3 mt-5">
                <input ref={inputRef} value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={handleKeyDown}
                  placeholder="Seu nome ou nome do negócio" className="input-field w-full text-base" />
                <input value={contato} onChange={(e) => setContato(e.target.value)} onKeyDown={handleKeyDown}
                  placeholder="WhatsApp ou e-mail (opcional)" className="input-field w-full text-base" />
              </div>
              <input type="text" tabIndex={-1} autoComplete="off" value={website}
                onChange={(e) => setWebsite(e.target.value)} className="hidden" aria-hidden="true" />
            </>
          )}

          {error && (
            <div className="flex items-start gap-2 mt-4 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 mt-6">
            <button onClick={back} disabled={current === 0}
              className="flex items-center gap-1.5 text-sm px-3 py-2.5 rounded-xl text-rl-muted hover:text-rl-text disabled:opacity-0 disabled:pointer-events-none transition-all">
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>

            {!isContact ? (
              <button onClick={next} disabled={!canAdvance}
                className="btn-primary flex items-center gap-2 text-sm px-6 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed">
                Continuar <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={finish}
                className="btn-primary flex items-center gap-2 text-sm px-6 py-2.5">
                <Sparkles className="w-4 h-4" /> Gerar meus roteiros
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-[11px] text-rl-muted mt-5">
          Ao finalizar, a IA cria 2 roteiros na hora. Dica: aperte Enter para avançar.
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
