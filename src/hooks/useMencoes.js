// Dados do sino de menções: as últimas menções de cada categoria e quantas não foram lidas.
// Assina `notifications` da pessoa (INSERT e UPDATE) e relê ao voltar para a aba, ao
// reconectar e quando outra tela marca algo como lido (EVENTO_MENCOES).
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { CATEGORIAS, TIPOS_MENCAO, EVENTO_MENCOES } from '../lib/mencoes'

const LIMITE = 40
const VAZIO = { comentarios: [], chat: [] }

export function useMencoes(userId) {
  const [itens, setItens] = useState(VAZIO)
  const [naoLidas, setNaoLidas] = useState({ comentarios: 0, chat: 0 })
  const [carregando, setCarregando] = useState(true)
  const timer = useRef(null)
  const vivo = useRef(true)

  const ler = useCallback(async () => {
    if (!supabase || !userId) return
    const cats = Object.keys(CATEGORIAS)
    const [listas, contagens] = await Promise.all([
      Promise.all(cats.map((k) => supabase.from('notifications')
        .select('id, type, title, body, link, data, read_at, created_at')
        .eq('user_id', userId).in('type', CATEGORIAS[k].tipos)
        .order('created_at', { ascending: false }).limit(LIMITE))),
      Promise.all(cats.map((k) => supabase.from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId).in('type', CATEGORIAS[k].tipos).is('read_at', null))),
    ])
    if (!vivo.current) return
    const novos = {}
    const nl = {}
    cats.forEach((k, i) => {
      if (listas[i].error) console.error('[menções]', listas[i].error)
      novos[k] = listas[i].data || []
      nl[k] = contagens[i].count || 0
    })
    setItens(novos)
    setNaoLidas(nl)
    setCarregando(false)
  }, [userId])

  // Várias mudanças seguidas (marcar todas, uma rajada de menções) = uma releitura.
  const agendar = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(ler, 250)
  }, [ler])

  useEffect(() => {
    vivo.current = true
    if (!supabase || !userId) return undefined
    ler()
    let jaConectou = false
    const ch = supabase
      .channel(`mencoes-${userId}-${Math.random().toString(36).slice(2, 8)}`) // nome único: a sidebar do celular monta outra instância
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, ({ new: row, old }) => {
        const tipo = row?.type || old?.type
        if (!tipo || TIPOS_MENCAO.includes(tipo)) agendar()
      })
      .subscribe((status) => {
        // O realtime não reenvia o que passou com a conexão caída: relê ao voltar.
        if (status === 'SUBSCRIBED') { if (jaConectou) agendar(); jaConectou = true }
      })
    const aoVoltar = () => { if (document.visibilityState === 'visible') agendar() }
    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener('online', aoVoltar)
    window.addEventListener(EVENTO_MENCOES, agendar)
    return () => {
      vivo.current = false
      clearTimeout(timer.current)
      supabase.removeChannel(ch)
      document.removeEventListener('visibilitychange', aoVoltar)
      window.removeEventListener('online', aoVoltar)
      window.removeEventListener(EVENTO_MENCOES, agendar)
    }
  }, [userId, ler, agendar])

  // Otimista: tira o ponto na hora ({ ids } ou { categoria }); a releitura confirma.
  const marcarLocal = useCallback(({ ids, categoria }) => {
    const agora = new Date().toISOString()
    const alvo = (m, k) => !m.read_at && (categoria ? k === categoria : ids?.includes(m.id))
    setNaoLidas((prev) => {
      const n = { ...prev }
      for (const k of Object.keys(itens)) {
        n[k] = categoria === k ? 0 : Math.max(0, prev[k] - itens[k].filter((m) => alvo(m, k)).length)
      }
      return n
    })
    setItens((prev) => {
      const n = {}
      for (const k of Object.keys(prev)) n[k] = prev[k].map((m) => (alvo(m, k) ? { ...m, read_at: agora } : m))
      return n
    })
  }, [itens])

  return { itens, naoLidas, total: naoLidas.comentarios + naoLidas.chat, carregando, recarregar: ler, marcarLocal }
}
