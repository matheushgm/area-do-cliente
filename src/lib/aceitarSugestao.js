// Aceitar uma sugestão da central de Otimizações cria a atividade no ClickUp do
// cliente sem abrir modal. É o mesmo caminho do planejador (lista "Geral" da
// pasta, responsável pelo departamento no squad, data pela carga real do time),
// só que com os padrões da própria sugestão: tipo, horas, prioridade e o
// briefing em markdown (já com o caminho e o link do gerenciador).
import { sugerirAtividade, listarListasClickUp, criarAtividade } from './atividades'
import { hojeISO } from './atividadesCarga'
import { PRIORIDADE_CLICKUP } from './playbookSugestoes'
import { TIPO_PARA_DEPARTAMENTO } from '../hooks/usePlanejador'

// No squad da Área do Cliente o departamento de tecnologia ainda tem outro nome
const DEPARTAMENTO_ALIAS_SQUAD = { 'Tecnologia': 'Automação / Integração' }

// Listas "Geral" por pasta (uma chamada ao ClickUp por cliente, não por aceite)
const listasCache = new Map()
async function listaGeral(folderId, listaPadrao) {
  if (!listasCache.has(folderId)) {
    try {
      const r = await listarListasClickUp(folderId)
      listasCache.set(folderId, r?.listas || [])
    } catch (e) {
      if (listaPadrao) return listaPadrao
      throw e
    }
  }
  const ls = listasCache.get(folderId)
  const geral = ls.find((l) => l.name.trim().toLowerCase() === 'geral') || ls[0]
  return geral?.id || listaPadrao || null
}

// Responsável: quem o squad do cliente designou ao departamento do tipo; se o
// squad não define, quem está aceitando (desde que tenha ClickUp vinculado).
function escolherResponsavel({ departamento, projeto, squads, teamMembers, user }) {
  const comClickup = (teamMembers || []).filter((m) => Number(m.clickupUserId ?? m.clickup_user_id) > 0)
  const squad = (squads || []).find((s) => String(s.id) === String(projeto.squad))
  const asg = squad?.department_assignments || squad?.departmentAssignments || {}
  const profileId = asg[departamento] || asg[DEPARTAMENTO_ALIAS_SQUAD[departamento]] || null
  const membro = comClickup.find((m) => m.id === profileId) || comClickup.find((m) => m.id === user?.id) || null
  return membro
    ? { id: membro.id, nome: membro.name, clickupId: Number(membro.clickupUserId ?? membro.clickup_user_id), doSquad: membro.id === profileId }
    : null
}

/**
 * Cria a tarefa no ClickUp para a sugestão aceita.
 * @returns {Promise<{taskId:string,url:string,registro:object|null,aviso?:string,responsavel:string,data:string,titulo:string}>}
 * Lança Error com mensagem legível quando não dá pra criar (sem pasta, sem responsável…).
 */
export async function criarTarefaDaSugestao({ sug, projeto, squads, teamMembers, user, config }) {
  const folderId = projeto?.clickupFolderId || projeto?.clickup_folder_id
  if (!folderId) throw new Error('O cliente não tem pasta do ClickUp vinculada.')
  const listId = await listaGeral(folderId, projeto.clickupListId || projeto.clickup_list_id || null)
  if (!listId) throw new Error('A pasta do cliente no ClickUp não tem nenhuma lista.')

  const tipo = sug.tipo || 'Otimização'
  const departamento = TIPO_PARA_DEPARTAMENTO[tipo] || 'Gestor de tráfego'
  const resp = escolherResponsavel({ departamento, projeto, squads, teamMembers, user })
  if (!resp) throw new Error(`Ninguém com ClickUp vinculado para ${departamento} neste cliente. Defina o responsável no squad.`)

  const horas = Number(sug.horas ?? config?.horas_por_tipo?.[tipo] ?? 1)
  const calc = await sugerirAtividade({ assignees: [resp.clickupId], horas, naoAntesDe: hojeISO() })
  const res = calc?.resultados?.[0]
  const entrega = res?.sugestao?.entrega
  if (!res || !entrega) throw new Error(calc?.erros?.[0]?.error || 'Não consegui calcular a data de entrega.')

  const titulo = sug.titulo
  const r = await criarAtividade({
    projectId: projeto.id,
    clienteNome: (projeto.companyName || projeto.company_name || '').trim(),
    listId,
    titulo,
    descricao: sug.descricao || '',
    tipoTarefa: tipo,
    departamento,
    responsavelProfileId: resp.id,
    assigneeClickupId: resp.clickupId,
    horas,
    prioridade: PRIORIDADE_CLICKUP[sug.prioridade] || 'normal',
    dataInicio: res.sugestao?.inicio || null,
    dataSugerida: entrega,
    dataEscolhida: entrega,
    sobrecarga: false,
    horasExcedentes: null,
    justificativa: null,
    snapshot: { hoje: res.hoje, capacidadeDia: res.capacidadeDia, totais: res.totais, resumo: res.resumo, sugestao: res.sugestao },
  })
  return { ...r, titulo, responsavel: resp.nome, data: entrega }
}
