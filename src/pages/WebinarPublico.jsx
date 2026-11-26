import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Presentation, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import WebinarModule from '../components/Webinar/WebinarModule'
import { useI18n, idiomaAtual, t as tSolto } from '../i18n'

function SaveBadge({ status }) {
  const { t } = useI18n()
  if (status === 'saving') return (
    <span className="flex items-center gap-1.5 text-xs text-rl-muted">
      <Loader2 className="w-3 h-3 animate-spin" /> {t('ferramentasPublicas.salvando')}
    </span>
  )
  if (status === 'saved') return (
    <span className="flex items-center gap-1.5 text-xs text-rl-green">
      <CheckCircle2 className="w-3 h-3" /> {t('ferramentasPublicas.salvo')}
    </span>
  )
  if (status === 'error') return (
    <span className="flex items-center gap-1.5 text-xs text-red-400">
      <AlertTriangle className="w-3 h-3" /> {t('ferramentasPublicas.erroSalvar')}
    </span>
  )
  return null
}

export default function WebinarPublico() {
  const { token } = useParams()
  const { t } = useI18n()
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [company, setCompany]       = useState('')
  const [webinars, setWebinars]     = useState([])
  const [saveStatus, setSaveStatus] = useState('idle')
  const debounceRef = useRef(null)

  // ── Load ───────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch(`/api/webinar-public?token=${encodeURIComponent(token)}`, { headers: { 'X-Idioma': idiomaAtual() } })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || tSolto('ferramentasPublicas.erroCarregar'))
        setCompany(data.companyName || '')
        setWebinars(Array.isArray(data.webinars) ? data.webinars : [])
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  useEffect(() => () => clearTimeout(debounceRef.current), [])

  // ── Debounced save ─────────────────────────────────────────────────────
  const persist = useCallback((next) => {
    setWebinars(next)
    clearTimeout(debounceRef.current)
    setSaveStatus('saving')
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/webinar-public', {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-Idioma': idiomaAtual() },
          body:    JSON.stringify({ token, webinars: next }),
        })
        if (!res.ok) throw new Error()
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 2500)
      } catch {
        setSaveStatus('error')
      }
    }, 1000)
  }, [token])

  // O editor espera um "project" — no link público só precisamos do nome da
  // empresa (usado no PDF). Nada é gravado via AppContext aqui.
  const fakeProject = useMemo(
    () => ({ id: 'public', companyName: company, company_name: company, webinars }),
    [company, webinars]
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-rl-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-rl-purple animate-spin" />
          <p className="text-rl-muted text-sm">{t('ferramentasPublicas.carregando')}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-rl-bg flex items-center justify-center p-6">
        <div className="glass-card p-8 max-w-md w-full text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto" />
          <h2 className="text-lg font-bold text-rl-text">{t('ferramentasPublicas.linkInvalido')}</h2>
          <p className="text-sm text-rl-muted">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-rl-bg">
      {/* Header */}
      <div className="border-b border-rl-border bg-white/85 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-rl-purple/10 flex items-center justify-center shrink-0">
              <Presentation className="w-5 h-5 text-rl-purple" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-rl-muted font-bold">{t('ferramentasPublicas.webinar.eyebrow')}</p>
              <h1 className="text-base font-black text-rl-text leading-tight truncate">{company}</h1>
            </div>
          </div>
          <SaveBadge status={saveStatus} />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Instrução */}
        <div className="glass-card p-5 border-l-4 border-rl-purple/50">
          <p className="text-sm text-rl-text font-semibold mb-1">{t('ferramentasPublicas.comoPreencher')}</p>
          <p className="text-sm text-rl-muted leading-relaxed">
            {t('ferramentasPublicas.webinar.instrucaoAntes')}
            <strong>{t('ferramentasPublicas.webinar.instrucaoBotao')}</strong>
            {t('ferramentasPublicas.webinar.instrucaoDepois')}
          </p>
        </div>

        <WebinarModule
          project={fakeProject}
          webinars={webinars}
          onPersist={persist}
          publicMode
        />

        {/* Rodapé */}
        <div className="pt-2 pb-8 text-center">
          <p className="text-xs text-rl-muted">{t('ferramentasPublicas.salvoAuto')}</p>
          <p className="text-xs text-rl-muted/60 mt-1">{t('ferramentasPublicas.copyright', { ano: new Date().getFullYear() })}</p>
        </div>
      </div>
    </div>
  )
}
