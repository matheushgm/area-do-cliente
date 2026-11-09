// Busca de tarefa para relação, com o contexto de onde a tarefa de origem está (família e
// cliente) e o filtro "Só deste cliente", ligado por padrão quando a tarefa tem pasta.
// Usado pelo painel da tarefa (tarefaId) e pela tarefa nova (listaId, ainda sem id).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { buscarTarefasRelacao, contextoDaRelacao } from '../lib/buscaRelacao'

export const PLACEHOLDER_RELACAO = 'Título, link ou ID da tarefa'

export function useBuscaRelacao({ tarefaId = null, listaId = null } = {}) {
  const [ctx, setCtx] = useState(null)
  const [soCliente, setSoCliente] = useState(true)

  useEffect(() => {
    let vivo = true
    if (!supabase || (!tarefaId && !listaId)) { setCtx(null); return undefined } // eslint-disable-line react-hooks/set-state-in-effect
    contextoDaRelacao(supabase, { tarefaId, listaId }).then((c) => { if (vivo) setCtx(c) }).catch(() => {})
    return () => { vivo = false }
  }, [tarefaId, listaId])

  const filtrar = soCliente && !!ctx?.pastaId
  const buscar = useCallback(
    (q) => buscarTarefasRelacao(supabase, q, { ctx, soCliente: filtrar, excluirIds: [tarefaId] }),
    [ctx, filtrar, tarefaId],
  )
  const escopo = useMemo(
    () => (ctx?.pastaId ? { rotulo: 'Só deste cliente', ativo: soCliente, alternar: () => setSoCliente((v) => !v) } : null),
    [ctx?.pastaId, soCliente],
  )
  return { buscar, escopo, placeholder: PLACEHOLDER_RELACAO }
}
