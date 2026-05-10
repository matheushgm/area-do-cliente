import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { AtSign, X } from 'lucide-react'

// Toast popup global mostrado quando uma nova notificação chega via realtime.
// Empilha múltiplas notificações; cada uma auto-dismiss em 8s.
export default function NotificationCenter() {
  const { user } = useApp()
  const navigate = useNavigate()
  const [popups, setPopups] = useState([]) // [{ id, title, body, link }]

  function dismiss(id) {
    setPopups((prev) => prev.filter((p) => p.id !== id))
  }

  async function handleClick(popup) {
    dismiss(popup.id)
    // Marca como lida
    if (supabase) {
      await supabase.from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', popup.id)
    }
    if (popup.link) navigate(popup.link)
  }

  useEffect(() => {
    if (!supabase || !user?.id) return
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        ({ new: row }) => {
          setPopups((prev) => [...prev, {
            id: row.id,
            title: row.title || 'Nova notificação',
            body: row.body || '',
            link: row.link,
          }])
          // Auto-dismiss em 8s
          setTimeout(() => dismiss(row.id), 8000)
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  if (popups.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)]">
      {popups.map((p) => (
        <button
          key={p.id}
          onClick={() => handleClick(p)}
          className="group flex items-start gap-3 bg-rl-card border border-rl-purple/40 rounded-xl px-4 py-3 shadow-2xl text-left hover:border-rl-purple animate-slide-up cursor-pointer w-full"
        >
          <div className="w-8 h-8 rounded-full bg-rl-purple/20 flex items-center justify-center shrink-0">
            <AtSign className="w-4 h-4 text-rl-purple" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-rl-text leading-tight truncate">{p.title}</p>
            {p.body && <p className="text-xs text-rl-muted mt-0.5 line-clamp-2">{p.body}</p>}
          </div>
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => { e.stopPropagation(); dismiss(p.id) }}
            className="p-1 rounded text-rl-muted hover:text-rl-text shrink-0"
            aria-label="Fechar"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        </button>
      ))}
    </div>
  )
}
