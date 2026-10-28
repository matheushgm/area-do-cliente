import { useEffect, useState } from 'react'
import { getSignedUrls } from '../lib/supabase'

// URLs assinadas dos logos (bucket privado `brand-logos`) pedidas em lote e
// guardadas por 50 min no módulo, para a lista de clientes não assinar uma por
// linha nem repetir o pedido a cada visita à home. A URL vale 1 h.
const VALIDADE_MS = 50 * 60 * 1000
const cache = new Map() // path → { url, ate }

function doCache(path) {
  const c = cache.get(path)
  return c && c.ate > Date.now() ? c.url : null
}

export function useLogosAssinados(paths) {
  const chave = [...new Set(paths.filter(Boolean))].sort().join('|')
  const [, setVersao] = useState(0)

  useEffect(() => {
    const faltam = chave ? chave.split('|').filter(p => !doCache(p)) : []
    if (!faltam.length) return
    let vivo = true
    getSignedUrls('brand-logos', faltam).then(urls => {
      const ate = Date.now() + VALIDADE_MS
      for (const p of faltam) cache.set(p, { url: urls[p] || null, ate })
      if (vivo) setVersao(v => v + 1)
    })
    return () => { vivo = false }
  }, [chave])

  return doCache
}
