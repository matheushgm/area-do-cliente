// Tarefas do projeto pro Modo Apresentação: todas as abertas + as concluídas
// desde `desde` (sem o limite de 150 do hub). Lê a réplica do ClickUp.
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const COLS = 'id,titulo,status,status_tipo,prioridade,responsaveis,responsaveis_extra,data_vencimento,data_conclusao,clickup_url,departamento,tags,created_at,parent_id,lista:tarefas_listas!inner(id,nome,pasta:tarefas_pastas!inner(project_id))'

export function useApresentacaoTarefas(projectId, desde) {
  const [abertas, setAbertas] = useState([])
  const [concluidas, setConcluidas] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)

  const carregar = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setErro(null)
    const base = () => supabase.from('tarefas_itens').select(COLS)
      .eq('lista.pasta.project_id', projectId).eq('arquivada', false).is('parent_id', null)
    const [a, c] = await Promise.all([
      base().neq('status_tipo', 'closed').order('data_vencimento', { ascending: true, nullsFirst: false }).limit(500),
      base().eq('status_tipo', 'closed').gte('data_conclusao', `${desde}T00:00:00-03:00`).order('data_conclusao', { ascending: false }).limit(500),
    ])
    const falha = a.error || c.error
    if (falha) setErro(falha.message)
    setAbertas(a.data || [])
    setConcluidas(c.data || [])
    setLoading(false)
  }, [projectId, desde])

  useEffect(() => { carregar() }, [carregar])
  return { abertas, concluidas, loading, erro, recarregar: carregar }
}

const ehCliente = (v) => String(v || '').trim().toLowerCase() === 'cliente'

/**
 * Tarefa aguardando o cliente: responsável é o usuário "Cliente" (perfil ou
 * usuário do ClickUp sem perfil), ou departamento "Cliente", ou tag "cliente".
 * `nomePorId` traduz os ids de perfil em responsaveis para nomes.
 */
export const dependeDoCliente = (t, nomePorId = new Map()) =>
  (t.responsaveis || []).some((id) => ehCliente(nomePorId.get(id)))
  || (t.responsaveis_extra || []).some((x) => ehCliente(x?.nome))
  || (t.departamento || []).some(ehCliente)
  || (t.tags || []).some(ehCliente)
