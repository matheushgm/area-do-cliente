import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PropTypes from 'prop-types'
import { FileText, Calendar, ChevronRight, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const SIGN_DOTS = [
  { id: 'account_manager', short: 'AM', color: '#7C3AED' },
  { id: 'trafego',         short: 'GT', color: '#2563EB' },
  { id: 'client',          short: 'CL', color: '#059669' },
]

function fmtRelative(iso) {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 0) return 'agora'
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `há ${d}d`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

// Widget que lista as 5 atas mais recentes que o usuário enxerga.
// RLS já filtra pelo squad — basta um SELECT com order DESC.
export default function RecentMinutesWidget({ projects = [] }) {
  const navigate = useNavigate()
  const [minutes, setMinutes] = useState([])
  const [loading, setLoading] = useState(true)

  const projectById = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p])),
    [projects]
  )

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    let cancelled = false
    supabase
      .from('meeting_minutes')
      .select('id,project_id,title,meeting_date,internal_signatures,client_signature,created_at')
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) { console.warn('[RecentMinutesWidget]', error.message); setLoading(false); return }
        setMinutes(data || [])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  if (loading) return null
  if (!minutes.length) return null

  return (
    <div className="glass-card p-5 animate-slide-up" style={{ animationDelay: '0.1s' }}>
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-4 h-4 text-rl-purple" />
        <h2 className="text-sm font-bold text-rl-text">Atas de reunião recentes</h2>
        <span className="text-[10px] text-rl-muted ml-auto">últimas 5</span>
      </div>
      <ul className="space-y-2">
        {minutes.map((m) => {
          const p = projectById[m.project_id]
          const projectName = p?.companyName || p?.company_name || 'Cliente'
          const isNew = Date.now() - new Date(m.created_at).getTime() < 24 * 3600 * 1000
          const status = {
            account_manager: !!m.internal_signatures?.account_manager,
            trafego:         !!m.internal_signatures?.trafego,
            client:          !!m.client_signature,
          }
          const allSigned = status.account_manager && status.trafego && status.client
          return (
            <li key={m.id}>
              <button
                onClick={() => navigate(`/project/${m.project_id}`)}
                className="w-full text-left flex items-center gap-3 p-3 rounded-xl bg-rl-surface/40 border border-rl-border hover:border-rl-purple/40 hover:bg-rl-surface transition-all group"
              >
                <div className="flex flex-col items-center gap-0.5 shrink-0 w-12">
                  <span className="text-[10px] font-bold text-rl-muted uppercase">
                    {new Date(m.meeting_date + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}
                  </span>
                  <span className="text-base font-black text-rl-text leading-none">
                    {new Date(m.meeting_date + 'T00:00:00').getDate()}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-rl-text truncate group-hover:text-rl-purple transition">
                      {m.title}
                    </p>
                    {isNew && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-rl-gold/15 text-rl-gold border border-rl-gold/30">
                        Novo
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-rl-muted">
                    <span className="truncate">{projectName}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {fmtRelative(m.created_at)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {allSigned ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rl-green">
                      <CheckCircle2 className="w-3 h-3" /> Completa
                    </span>
                  ) : (
                    SIGN_DOTS.map((d) => {
                      const ok = status[d.id]
                      return (
                        <span
                          key={d.id}
                          className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[8px] font-bold ${
                            ok ? 'text-white' : 'text-rl-muted bg-rl-surface border border-rl-border'
                          }`}
                          style={ok ? { background: d.color } : undefined}
                          title={`${d.short}: ${ok ? 'assinado' : 'pendente'}`}
                        >
                          {d.short}
                        </span>
                      )
                    })
                  )}
                  <ChevronRight className="w-4 h-4 text-rl-muted group-hover:text-rl-purple group-hover:translate-x-0.5 transition-all ml-1" />
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

RecentMinutesWidget.propTypes = {
  projects: PropTypes.array,
}
