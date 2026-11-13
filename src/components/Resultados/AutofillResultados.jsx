import { useState } from 'react'
import { Zap, Loader2 } from 'lucide-react'
import { autofillResultados } from '../../lib/autofillResultados'
import { useI18n } from '../../i18n'

// ─────────────────────────────────────────────────────────────────────────────
// Preenchimento dos Resultados a partir das contas de anúncio vinculadas.
//
// O mesmo endpoint roda sozinho pelo Vercel Cron nos dias 1, 8, 15 e 22 (fecha a
// semana anterior). Estes componentes são a versão manual — útil para puxar o
// mês na hora e para acompanhar a semana em curso (até hoje, dia parcial).
// ─────────────────────────────────────────────────────────────────────────────

// Selo nos cards preenchidos pela API.
export function AutoBadge({ entry }) {
  const { t, locale } = useI18n()
  if (entry?.fonte !== 'api') return null
  const quando = entry.atualizadoEm
    ? new Date(entry.atualizadoEm).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-rl-cyan bg-rl-cyan/10 border border-rl-cyan/25 rounded-full px-1.5 py-0.5"
      title={`${t('resultados.autofill.titulo')}${quando ? t('resultados.autofill.atualizadoEm', { quando }) : ''}${entry.parcial ? t('resultados.autofill.semanaEmCurso') : ''}`}
    >
      <Zap size={9} />
      {entry.parcial ? t('resultados.autofill.apiParcial') : t('resultados.fonte.api')}
    </span>
  )
}

// Botão "Puxar da API" — preenche o mês exibido e devolve o JSONB mesclado.
export function AutofillButton({ projectId, year, month, onFilled }) {
  const [state, setState] = useState('idle') // idle | loading | done | error
  const [msg, setMsg] = useState('')
  const { t } = useI18n()

  if (!projectId) return null

  const run = async () => {
    setState('loading')
    setMsg('')
    try {
      const res = await autofillResultados({ projectId, year, month: month + 1 })
      const mine = res.updated?.find(u => u.projectId === projectId)
      if (res.data && onFilled) onFilled(res.data)
      if (mine) {
        setState('done')
        setMsg(t('resultados.autofill.semanasPreenchidas', { count: mine.semanas.length }))
      } else {
        const why = res.skipped?.find(s => s.projectId === projectId)?.reason
        setState('done')
        setMsg(why ? t('resultados.autofill.nadaPreencher', { motivo: why }) : t('resultados.autofill.nadaMes'))
      }
      setTimeout(() => { setState('idle'); setMsg('') }, 4000)
    } catch (e) {
      setState('error')
      setMsg(e.message || t('resultados.autofill.falha'))
      setTimeout(() => { setState('idle'); setMsg('') }, 5000)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {msg && (
        <span className={`text-xs ${state === 'error' ? 'text-red-400' : 'text-rl-muted'}`}>{msg}</span>
      )}
      <button
        onClick={run}
        disabled={state === 'loading'}
        className="btn-secondary flex items-center gap-2 text-sm whitespace-nowrap disabled:opacity-60"
        title={t('resultados.autofill.botaoTitulo')}
      >
        {state === 'loading' ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
        {state === 'loading' ? t('resultados.autofill.puxando') : t('resultados.autofill.puxar')}
      </button>
    </div>
  )
}
