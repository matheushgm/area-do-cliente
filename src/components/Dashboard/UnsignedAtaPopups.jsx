import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PropTypes from 'prop-types'
import { X, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'

// Popup amarelo no canto inferior direito do dashboard, com nome do cliente
// grande e mensagem de aviso. Re-aparece a cada 1h enquanto a ata não estiver
// totalmente assinada (AM + GT + Cliente). Persistência via localStorage por
// usuário + ata pra evitar spam quando o usuário fica na tela.

const POPUP_INTERVAL_MS = 60 * 60 * 1000 // 1 hora
const SCAN_LIMIT        = 20

function lsKey(userId, ataId) {
  return `ata_popup_seen:${userId}:${ataId}`
}

function isFullySigned(m) {
  const i = m.internal_signatures || {}
  return !!(i.account_manager && i.trafego && m.client_signature)
}

export default function UnsignedAtaPopups({ projects = [] }) {
  const { user } = useApp()
  const navigate = useNavigate()
  const [popups, setPopups] = useState([])

  const evaluate = useCallback(async () => {
    if (!supabase || !user?.id) return
    const { data, error } = await supabase
      .from('meeting_minutes')
      .select('id,project_id,title,internal_signatures,client_signature,created_at')
      .order('created_at', { ascending: false })
      .limit(SCAN_LIMIT)
    if (error || !Array.isArray(data)) return

    const unsigned = data.filter((m) => !isFullySigned(m))
    if (!unsigned.length) return

    const now = Date.now()
    const projectById = Object.fromEntries(projects.map((p) => [p.id, p]))

    const toShow = unsigned
      .filter((m) => {
        const last = localStorage.getItem(lsKey(user.id, m.id))
        if (!last) return true
        const lastN = parseInt(last, 10) || 0
        return now - lastN >= POPUP_INTERVAL_MS
      })
      .map((m) => ({
        id:          m.id,
        projectId:   m.project_id,
        title:       m.title,
        projectName: projectById[m.project_id]?.companyName
                  || projectById[m.project_id]?.company_name
                  || 'Cliente',
      }))

    if (!toShow.length) return

    // Marca como vistas AGORA pra não duplicar no próximo evaluate
    toShow.forEach((p) => localStorage.setItem(lsKey(user.id, p.id), String(now)))

    setPopups((prev) => {
      const existing = new Set(prev.map((p) => p.id))
      const fresh    = toShow.filter((p) => !existing.has(p.id))
      return [...prev, ...fresh]
    })
  }, [user?.id, projects])

  // Avalia ao montar + a cada 1h enquanto Dashboard estiver aberto
  useEffect(() => {
    evaluate()
    const interval = setInterval(evaluate, POPUP_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [evaluate])

  function dismiss(id) {
    setPopups((prev) => prev.filter((p) => p.id !== id))
  }

  function handleClick(popup) {
    dismiss(popup.id)
    navigate(`/project/${popup.projectId}`)
  }

  if (!popups.length) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none max-w-[calc(100vw-3rem)]">
      {popups.map((p) => (
        <AtaPopup
          key={p.id}
          popup={p}
          onClick={() => handleClick(p)}
          onDismiss={() => dismiss(p.id)}
        />
      ))}
    </div>
  )
}

UnsignedAtaPopups.propTypes = {
  projects: PropTypes.array,
}

// ─── Popup individual ─────────────────────────────────────────────────────────
function AtaPopup({ popup, onClick, onDismiss }) {
  return (
    <div
      role="alert"
      onClick={onClick}
      className="pointer-events-auto w-80 max-w-full rounded-2xl border-2 border-yellow-400 bg-yellow-50 shadow-2xl p-4 cursor-pointer hover:shadow-[0_20px_60px_-15px_rgba(234,179,8,0.45)] hover:-translate-y-0.5 transition-all relative animate-slide-up"
    >
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss() }}
        className="absolute top-2 right-2 p-1 rounded-lg text-yellow-700 hover:bg-yellow-100"
        aria-label="Fechar"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <div className="flex items-start gap-3 pr-4">
        <div className="w-11 h-11 rounded-xl bg-yellow-400/25 flex items-center justify-center shrink-0">
          <AlertCircle className="w-6 h-6 text-yellow-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider font-bold text-yellow-700 mb-0.5">
            Nova ata de reunião
          </p>
          <p className="text-xl font-black text-yellow-900 leading-tight truncate">
            {popup.projectName}
          </p>
          <p className="text-sm font-semibold text-yellow-800 mt-1.5 leading-snug">
            Existe uma nova ata de reunião pra você assinar.
          </p>
          {popup.title && (
            <p className="text-[11px] text-yellow-700/80 mt-1 truncate italic">
              &ldquo;{popup.title}&rdquo;
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

AtaPopup.propTypes = {
  popup: PropTypes.object.isRequired,
  onClick: PropTypes.func.isRequired,
  onDismiss: PropTypes.func.isRequired,
}
