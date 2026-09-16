import { corDe, iniciaisDe } from '../../lib/chat'

// Avatar redondo com iniciais na cor da pessoa (mesma cor sempre, por id).
export default function ChatAvatar({ pessoa, id, nome, size = 28, className = '', ring = false }) {
  const uid = pessoa?.id || id || ''
  const n = pessoa?.name || nome || '?'
  const fonte = Math.max(8, Math.round(size * 0.4))
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-semibold leading-none text-white shrink-0 select-none ${ring ? 'ring-2 ring-ln-bg' : ''} ${className}`}
      style={{ width: size, height: size, backgroundColor: corDe(uid || n), fontSize: fonte }}
      title={n}
      aria-label={n}
    >
      {iniciaisDe(n)}
    </span>
  )
}

export function AvatarStack({ ids = [], membrosMap, size = 18, max = 3 }) {
  const mostrar = ids.slice(0, max)
  const resto = ids.length - mostrar.length
  return (
    <span className="inline-flex items-center">
      {mostrar.map((id, i) => (
        <ChatAvatar key={id} pessoa={membrosMap.get(id)} id={id} size={size} ring className={i > 0 ? '-ml-1.5' : ''} />
      ))}
      {resto > 0 && (
        <span className="-ml-1.5 inline-flex items-center justify-center rounded-full bg-ln-level3 text-ln-t3 font-semibold ring-2 ring-ln-bg" style={{ width: size, height: size, fontSize: Math.max(8, size * 0.45) }}>+{resto}</span>
      )}
    </span>
  )
}
