// Ponte entre o dashboard de tráfego e a Central de Otimizações.
//
// O dashboard é um viewer HTML estático (public/dash-teste/viewer.html) que roda
// num iframe da mesma origem e não tem acesso ao que o app já sabe: o usuário,
// os projetos, os squads e quem tem ClickUp vinculado. Aceitar uma sugestão
// depende de tudo isso (cria a atividade no ClickUp do cliente, no responsável
// do squad), então o viewer chama estas funções em `window.parent` em vez de
// reimplementar o fluxo. Assim aceitar/recusar/reabrir no dashboard é o MESMO
// código da página /otimizacoes. Sem a ponte (viewer aberto direto, link
// compartilhado) o painel do dashboard fica só de leitura.
import { useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { linhaDecisao } from '../hooks/useSugestoesGlobais'
import { aceitarComTarefa, criarTarefaDaSugestao } from '../lib/aceitarSugestao'

// O que o painel precisa saber da tarefa criada (o resto fica no registro).
const resumoTarefa = (t, titulo) => (t ? { titulo, responsavel: t.responsavel, data: t.data, url: t.url, aviso: t.aviso || null } : null)

export default function OtimizacoesBridge() {
  const { user, projects, squads, teamMembers } = useApp()

  // Reregistra quando o contexto muda, assim a ponte sempre enxerga o valor novo.
  useEffect(() => {
    const projetoDe = (id) => (projects || []).find((p) => p.id === id)
    const ctxTarefa = () => ({ squads, teamMembers, user, config: null })

    async function gravar(sug, status, { motivo = null, extra = {} } = {}) {
      const row = linhaDecisao(sug, status, { projectId: sug.projectId, user, motivo, extra })
      const { data, error } = await supabase
        .from('projeto_sugestoes')
        .upsert(row, { onConflict: 'project_id,chave' })
        .select()
        .single()
      if (error) throw new Error(error.message)
      return data
    }

    const api = {
      versao: 1,

      /** Aceita: cria a atividade no ClickUp e grava a decisão (entra na fila da automação). */
      async aceitar(sug) {
        const { tarefa, erroTarefa, decisao } = await aceitarComTarefa({
          sug, projeto: projetoDe(sug.projectId), ctx: ctxTarefa(), gravarDecisao: gravar,
        })
        return { decisao, tarefa: resumoTarefa(tarefa, sug.titulo), erroTarefa }
      },

      /** Recusa com motivo (obrigatório, fica no histórico). */
      async recusar(sug, motivo) {
        if (!String(motivo || '').trim()) throw new Error('Informe o motivo da recusa.')
        return { decisao: await gravar(sug, 'recusada', { motivo: String(motivo).trim() }) }
      },

      /** Nova tentativa de criar a tarefa de uma decisão aceita que ficou sem ela. */
      async criarTarefa(decisao) {
        const sug = { ...(decisao.payload || {}), projectId: decisao.project_id, titulo: decisao.titulo || decisao.payload?.titulo }
        const tarefa = await criarTarefaDaSugestao({ sug, projeto: projetoDe(decisao.project_id), ...ctxTarefa() })
        const { data, error } = await supabase
          .from('projeto_sugestoes')
          .update({ clickup_task_id: tarefa.taskId, clickup_task_url: tarefa.url, atividade_id: tarefa.registro?.id || null, execucao_log: null })
          .eq('id', decisao.id)
          .select()
          .single()
        if (error) throw new Error(`${error.message} A tarefa foi criada no ClickUp: ${tarefa.url}`)
        return { decisao: data, tarefa: resumoTarefa(tarefa, sug.titulo) }
      },

      /** Apaga a decisão: a sugestão volta a aparecer se a regra ainda valer. */
      async reabrir(decisao) {
        const { error } = await supabase.from('projeto_sugestoes').delete().eq('id', decisao.id)
        if (error) throw new Error(error.message)
      },
    }

    window.__rlOtimizacoes = api
    return () => { if (window.__rlOtimizacoes === api) delete window.__rlOtimizacoes }
  }, [user, projects, squads, teamMembers])

  return null
}
