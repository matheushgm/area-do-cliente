// ─────────────────────────────────────────────────────────────────────────────
// Página PÚBLICA do Wizard de Mecanismo Único — /mecanismo/:token
// O cliente preenche sozinho, sem login. Mesmo clientShareToken do briefing
// (/client/:token); dados salvos via /api/client-form (module 'mecanismo').
// Sem botões de IA (exigem login) — o refino fica com o time no painel interno.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import {
  Sparkles, Loader2, AlertTriangle, CheckCircle2, FileDown, Send, Cloud, CloudOff,
} from 'lucide-react'
import { hydrateMecanismo, computeFilledMap, STEP_META } from '../components/MecanismoUnico/mecanismoShared'
import MecanismoWizardShell from '../components/MecanismoUnico/MecanismoWizardShell'
import { StepPitchPreview } from '../components/MecanismoUnico/WizardSteps'
import { exportMecanismoUnicoPDF } from '../lib/mecanismoUnicoPDF'

// ─── Badge de autosave (mesmo espírito do OfertaMatadoraPublico) ────────────
function SaveBadge({ status }) {
  if (status === 'saving') return (
    <span className="flex items-center gap-1.5 text-xs text-rl-muted"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando...</span>
  )
  if (status === 'saved') return (
    <span className="flex items-center gap-1.5 text-xs text-green-400"><Cloud className="w-3.5 h-3.5" /> Salvo</span>
  )
  if (status === 'error') return (
    <span className="flex items-center gap-1.5 text-xs text-rl-red"><CloudOff className="w-3.5 h-3.5" /> Erro ao salvar</span>
  )
  return null
}

export default function MecanismoUnicoPublico() {
  const { token } = useParams()
  const [state, setState] = useState('loading')   // loading | ready | invalid
  const [errorMsg, setErrorMsg] = useState(null)
  const [companyName, setCompanyName] = useState('')
  const [data, setData] = useState(null)
  const [saveStatus, setSaveStatus] = useState('idle')
  const [submitted, setSubmitted] = useState(false)
  const timer = useRef(null)
  const latest = useRef(null)

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`/api/client-form?token=${encodeURIComponent(token)}`)
        const body = await res.json()
        if (!alive) return
        if (!res.ok) {
          setErrorMsg(body?.error || 'Link inválido ou expirado.')
          setState('invalid')
          return
        }
        setCompanyName(body.companyName || '')
        const hydrated = hydrateMecanismo(body.mecanismoUnico)
        setData(hydrated)
        latest.current = hydrated
        setState('ready')
      } catch {
        if (!alive) return
        setErrorMsg('Não foi possível carregar o formulário. Tente novamente.')
        setState('invalid')
      }
    })()
    return () => { alive = false }
  }, [token])

  // ── Persistência (debounce 900ms) ─────────────────────────────────────────
  const persist = useCallback(async (payload) => {
    setSaveStatus('saving')
    try {
      const res = await fetch('/api/client-form', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, module: 'mecanismo', data: { mecanismoUnico: payload } }),
      })
      setSaveStatus(res.ok ? 'saved' : 'error')
    } catch {
      setSaveStatus('error')
    }
  }, [token])

  const scheduleSave = useCallback((next) => {
    latest.current = next
    clearTimeout(timer.current)
    timer.current = setTimeout(() => persist(latest.current), 900)
  }, [persist])

  const set = useCallback((field, val) => {
    setData((prev) => {
      const next = { ...prev, [field]: val, updatedAt: new Date().toISOString() }
      scheduleSave(next)
      return next
    })
  }, [scheduleSave])

  const setNested = useCallback((parent, field, val) => {
    setData((prev) => {
      const next = {
        ...prev,
        [parent]: { ...(prev[parent] || {}), [field]: val },
        updatedAt: new Date().toISOString(),
      }
      scheduleSave(next)
      return next
    })
  }, [scheduleSave])

  // ── Envio final ───────────────────────────────────────────────────────────
  const submit = async () => {
    clearTimeout(timer.current)
    await persist(latest.current)
    // GTM (mesmo padrão dos outros forms públicos)
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({ event: 'form_submit', form_name: 'mecanismo_unico', company: companyName, token })
    setSubmitted(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Estados de carregamento/erro ──────────────────────────────────────────
  if (state === 'loading') return (
    <div className="min-h-screen bg-rl-dark flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-rl-purple animate-spin" />
    </div>
  )
  if (state === 'invalid') return (
    <div className="min-h-screen bg-rl-dark flex items-center justify-center px-6">
      <div className="glass-card p-8 max-w-md text-center space-y-3">
        <AlertTriangle className="w-10 h-10 text-red-400 mx-auto" />
        <h2 className="text-lg font-bold text-rl-text">Link inválido</h2>
        <p className="text-sm text-rl-muted">{errorMsg}</p>
      </div>
    </div>
  )

  const totalSteps = STEP_META.length - 1  // não conta a tela final
  const filledMap = computeFilledMap(data)
  const filledCount = Object.entries(filledMap).filter(([id, v]) => v && id !== 'final').length

  return (
    <div className="min-h-screen bg-rl-dark">
      {/* Header sticky */}
      <div className="border-b border-rl-border bg-rl-surface/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-rl-muted font-medium uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-rl-purple" /> Construtor de Mecanismo Único
            </p>
            <h1 className="text-lg font-bold text-rl-text">{companyName}</h1>
          </div>
          <SaveBadge status={saveStatus} />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {submitted ? (
          /* ── Tela de agradecimento ── */
          <div className="glass-card p-10 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
            <h2 className="text-xl font-bold text-rl-text">Mecanismo enviado com sucesso! 🎉</h2>
            <p className="text-sm text-rl-muted max-w-md mx-auto leading-relaxed">
              O time da Revenue Lab vai revisar o que você construiu e lapidar o pitch final.
              Você pode baixar uma cópia em PDF das suas respostas.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => exportMecanismoUnicoPDF({ project: { companyName }, mecanismoUnico: data })}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <FileDown className="w-4 h-4" /> Baixar minhas respostas (PDF)
              </button>
              <button onClick={() => setSubmitted(false)} className="text-sm text-rl-muted hover:text-rl-text px-3 py-2">
                Continuar editando
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Instrução */}
            <div className="glass-card p-5 border-l-4 border-rl-purple">
              <p className="text-sm text-rl-text font-medium mb-1">Como funciona</p>
              <p className="text-sm text-rl-muted leading-relaxed">
                Este é o passo-a-passo para descobrir o &ldquo;por que ISSO vai funcionar pra
                mim&rdquo; que separa você de todos os concorrentes. Avance um passo por vez,
                cada tela tem exemplos pra te guiar. As respostas são salvas automaticamente:
                você pode parar e voltar depois pelo mesmo link.
              </p>
            </div>

            <MecanismoWizardShell
              data={data}
              set={set}
              setNested={setNested}
              finalContent={
                <div className="space-y-4">
                  <p className="text-sm text-rl-muted">
                    Você preencheu <b className="text-rl-text">{filledCount} de {totalSteps} passos</b>.
                    Revise o que quiser na trilha acima e, quando estiver pronto, envie para a
                    Revenue Lab: nosso time vai lapidar e gerar a versão final.
                  </p>
                  <StepPitchPreview data={data} />
                  <div className="glass-card p-5 border border-rl-purple/20 text-center space-y-3">
                    <Send className="w-8 h-8 text-rl-purple mx-auto" />
                    <p className="text-sm text-rl-text font-semibold">Tudo pronto?</p>
                    <button
                      onClick={submit}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-sm bg-rl-purple text-white hover:opacity-90 transition-opacity"
                    >
                      <Send className="w-4 h-4" /> Enviar para a Revenue Lab
                    </button>
                    <button
                      onClick={() => exportMecanismoUnicoPDF({ project: { companyName }, mecanismoUnico: data })}
                      className="text-xs text-rl-muted hover:text-rl-text"
                    >
                      Baixar cópia em PDF
                    </button>
                  </div>
                </div>
              }
              finalFooter={null}
            />
          </>
        )}
      </div>
    </div>
  )
}
