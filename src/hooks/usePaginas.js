// Pages do VertaTask: documentos em markdown ligados a um cliente, com
// subpáginas, bloqueio, arquivo e histórico de versões. RLS na migration 095.
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const COLS_LISTA = 'id,titulo,project_id,pai_id,acesso,dono_id,bloqueada,arquivada,posicao,created_at,updated_at'
const INTERVALO_VERSAO = 5 * 60 * 1000

export function usePaginas(user) {
  const [paginas, setPaginas] = useState([])
  const [loading, setLoading] = useState(true)
  const conteudos = useRef(new Map()) // id → { titulo, conteudo } da última versão gravada
  const ultimaVersao = useRef(new Map())

  const carregar = useCallback(async () => {
    if (!supabase) { setLoading(false); return }
    const { data, error } = await supabase.from('tarefas_paginas').select(COLS_LISTA).order('posicao').order('created_at', { ascending: false })
    if (error) console.error('Erro ao carregar pages:', error.message)
    setPaginas(data || [])
    setLoading(false)
  }, [])
  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    if (!supabase) return undefined
    const ch = supabase.channel('paginas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tarefas_paginas' }, ({ eventType, new: row, old }) => {
        setPaginas((prev) => {
          if (eventType === 'DELETE') return prev.filter((p) => p.id !== old.id)
          const { conteudo, ...lista } = row
          conteudos.current.set(row.id, { titulo: row.titulo, conteudo })
          const i = prev.findIndex((p) => p.id === row.id)
          if (i < 0) return [lista, ...prev]
          const n = [...prev]; n[i] = lista; return n
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const abrir = useCallback(async (id) => {
    const { data, error } = await supabase.from('tarefas_paginas').select('*').eq('id', id).maybeSingle()
    if (error || !data) return null
    conteudos.current.set(id, { titulo: data.titulo, conteudo: data.conteudo })
    return data
  }, [])

  const criar = useCallback(async ({ titulo = 'Sem título', project_id = null, pai_id = null, conteudo = '' }) => {
    const { data, error } = await supabase.from('tarefas_paginas').insert({ titulo, conteudo, project_id, pai_id, dono_id: user?.id, posicao: Date.now() }).select().single()
    if (error) return { error: error.message }
    const { conteudo: _c, ...lista } = data
    setPaginas((prev) => (prev.some((p) => p.id === data.id) ? prev : [lista, ...prev]))
    conteudos.current.set(data.id, { titulo: data.titulo, conteudo: data.conteudo })
    return { data }
  }, [user?.id])

  /** Grava; se mudou o texto e a última versão tem +5 min, guarda o texto anterior no histórico. */
  const salvar = useCallback(async (id, patch) => {
    const anterior = conteudos.current.get(id)
    const mudouTexto = anterior && (('conteudo' in patch && patch.conteudo !== anterior.conteudo) || ('titulo' in patch && patch.titulo !== anterior.titulo))
    if (mudouTexto && Date.now() - (ultimaVersao.current.get(id) || 0) > INTERVALO_VERSAO) {
      ultimaVersao.current.set(id, Date.now())
      await supabase.from('tarefas_paginas_versoes').insert({ pagina_id: id, titulo: anterior.titulo, conteudo: anterior.conteudo, autor_id: user?.id })
    }
    const { data, error } = await supabase.from('tarefas_paginas').update(patch).eq('id', id).select().single()
    if (error) return { error: error.message }
    conteudos.current.set(id, { titulo: data.titulo, conteudo: data.conteudo })
    const { conteudo: _c, ...lista } = data
    setPaginas((prev) => prev.map((p) => (p.id === id ? lista : p)))
    return { data }
  }, [user?.id])

  const excluir = useCallback(async (id) => {
    const { error } = await supabase.from('tarefas_paginas').delete().eq('id', id)
    if (error) return { error: error.message }
    setPaginas((prev) => prev.filter((p) => p.id !== id && p.pai_id !== id))
    return {}
  }, [])

  const versoes = useCallback(async (id) => {
    const { data } = await supabase.from('tarefas_paginas_versoes').select('*').eq('pagina_id', id).order('created_at', { ascending: false }).limit(30)
    return data || []
  }, [])

  const filhosDe = useMemo(() => {
    const m = new Map()
    for (const p of paginas) {
      const k = p.pai_id || 'raiz'
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(p)
    }
    return m
  }, [paginas])

  return { paginas, loading, filhosDe, abrir, criar, salvar, excluir, versoes, recarregar: carregar }
}
