// Mapeamento ClickUp → tabelas tarefas_* (compartilhado pela importação inicial
// em scripts/importar_clickup_tarefas.mjs e pela sincronização incremental em
// api/tarefas-sync.js). Sem dependências: só funções puras.

export const STATUSES_PADRAO = [
  { key: '💡 backlog', label: '💡 Backlog', cor: '#87909e', tipo: 'open', ordem: 0 },
  { key: 'a fazer', label: 'A fazer', cor: '#4466ff', tipo: 'custom', ordem: 1 },
  { key: 'em progresso', label: 'Em progresso', cor: '#b660e0', tipo: 'custom', ordem: 2 },
  { key: 'em revisão', label: 'Em revisão', cor: '#aa8d80', tipo: 'custom', ordem: 3 },
  { key: 'complete', label: 'Concluído', cor: '#008844', tipo: 'closed', ordem: 4 },
]

// Ids antigos do ClickUp de pessoas que têm perfil com outro id.
export const ALIAS_CLICKUP = { 106097500: 118083078, 118078442: 118083078 }

// Pasta do ClickUp → nome do projeto na Área do Cliente (quando o nome difere).
export const MAPA_PASTA_PROJETO = {
  'Grupo Aj': 'Grupo AJ', 'Óticas Brasil': 'Oticas Brasil', 'Go vendas': 'Govendas', 'Nectar Crm': 'Nectar Crm',
  'FLASH CAR AUTO CENTER': 'Flashcar', 'Boa noite Colchões': 'Boa Noite Colchões', 'Dr Ulyscélio': 'Ulyscélio',
  'Vital Centro de Saúde': 'Clínica Vital', 'Africa PET STORE': 'África Pet Care', 'Aliare /myFarm': 'Aliare',
  'Niko Kids': 'Niko Niko Kids', 'Dra. Laura': 'Dra. Laura Medeiros', 'revo360': 'Revo 360', 'Mitra LAB': 'Mitra',
  'Única Distribuidora': 'Única Distribuidora / Casa do Sindico', 'Multichat 360': 'Multichat360', 'Agência Fábula': 'Agência Fábulla',
  'MENNDEL & MELO ADVOCACIA': 'Meendel & Melo Advocacia', 'Gym Clean (RY COMERCIAL LTDA)': 'Gym Clean', 'GENIUS': 'Genius',
  'Boa Vida Stays': 'BOA VIDA INCORPORADORA LTDA', 'Dr Jorge Pinho': 'Dr. Jorge Pinho', 'Nomus ERP': 'Nomus ERP',
}

export const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/\b(ltda|s\.?a\.?|me|eireli)\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

export const ms = (v) => (v ? new Date(Number(v)).toISOString() : null)

export const rotuloStatus = (k) => (['complete', 'closed', 'done'].includes(k) ? 'Concluído' : k.charAt(0).toUpperCase() + k.slice(1))

export const mapStatuses = (arr) => (arr || []).map((s) => ({
  key: s.status, label: rotuloStatus(s.status), cor: s.color, tipo: s.type, ordem: Number(s.orderindex) || 0,
}))

/** Projeto da Área correspondente a uma pasta do ClickUp (ou null). */
export function projetoDaPasta(folder, projetos) {
  const porFolder = projetos.find((p) => p.clickup_folder_id && String(p.clickup_folder_id) === String(folder.id))
  if (porFolder) return porFolder
  const nome = folder.name.trim()
  if (MAPA_PASTA_PROJETO[nome]) {
    const p = projetos.find((x) => x.company_name.trim() === MAPA_PASTA_PROJETO[nome])
    if (p) return p
  }
  const n = norm(nome)
  const exato = projetos.find((p) => norm(p.company_name) === n)
  if (exato) return exato
  const cand = projetos.filter((p) => { const pn = norm(p.company_name); return pn && n && (pn.startsWith(n) || n.startsWith(pn)) })
  return cand.length === 1 ? cand[0] : null
}

const IGNORAR_CAMPOS = new Set(['Cliente', 'Tipo de tarefa', 'Dificuldade', 'Departamento'])

function valorCampo(f) {
  if (f.value === undefined || f.value === null || f.value === '') return undefined
  const opts = f.type_config?.options || []
  if (f.type === 'drop_down') {
    const o = opts.find((o) => o.id === f.value || o.orderindex === f.value || String(o.orderindex) === String(f.value))
    return (o?.name || o?.label || String(f.value)).trim()
  }
  if (f.type === 'labels') {
    const vals = Array.isArray(f.value) ? f.value : [f.value]
    return vals.map((v) => { const o = opts.find((o) => o.id === v); return (o?.label || o?.name || String(v)).trim() })
  }
  if (['attachment', 'list_relationship', 'automatic_progress', 'formula', 'progress', 'tasks'].includes(f.type)) return undefined
  if (typeof f.value === 'object') return undefined
  return f.value
}

/**
 * Converte uma tarefa do ClickUp na linha de tarefas_itens (sem id/parent_id,
 * que dependem do contexto de quem chama).
 * @param t tarefa do ClickUp (payload da API v2)
 * @param perfilDe (clickupUserId) → { id, name, disabled } | null
 */
export function mapTarefa(t, perfilDe) {
  const responsaveis = [], extras = []
  for (const a of t.assignees || []) {
    const p = perfilDe(a.id)
    if (p && !p.disabled) responsaveis.push(p.id)
    else {
      const nome = p?.name || a.username
      extras.push({ clickup_id: a.id, nome, iniciais: a.initials || nome.split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase(), cor: a.color || null })
    }
  }
  let tipo = null, dificuldade = null, departamento = []
  const campos = {}
  for (const f of t.custom_fields || []) {
    const nome = f.name.trim()
    const v = valorCampo(f)
    if (v === undefined) continue
    if (nome === 'Tipo de tarefa') tipo = String(v).trim()
    else if (nome === 'Dificuldade') dificuldade = String(v).trim()
    else if (nome === 'Departamento') departamento = Array.isArray(v) ? v : [v]
    else if (!IGNORAR_CAMPOS.has(nome)) campos[nome] = v
  }
  const criador = perfilDe(t.creator?.id)
  return {
    clickup_task_id: t.id,
    clickup_url: t.url,
    titulo: t.name || '(sem título)',
    descricao: t.markdown_description || t.description || null,
    status: t.status?.status || 'a fazer',
    status_tipo: t.status?.type === 'closed' ? 'closed' : t.status?.type === 'open' ? 'open' : 'custom',
    prioridade: t.priority?.priority || null,
    responsaveis,
    responsaveis_extra: extras,
    data_inicio: ms(t.start_date),
    data_vencimento: ms(t.due_date),
    data_conclusao: ms(t.date_done || t.date_closed),
    estimativa_min: t.time_estimate ? Math.round(t.time_estimate / 60000) : null,
    tipo_tarefa: tipo,
    dificuldade,
    departamento,
    campos,
    tags: (t.tags || []).map((x) => x.name),
    checklists: (t.checklists || []).map((c) => ({ id: c.id, nome: c.name, itens: (c.items || []).map((i) => ({ id: i.id, nome: i.name, feito: !!i.resolved })) })),
    posicao: Number(t.orderindex) || 0,
    arquivada: !!t.archived,
    criado_por: criador?.id || null,
    criador_nome: t.creator?.username || null,
    created_at: ms(t.date_created) || new Date().toISOString(),
    clickup_updated_at: ms(t.date_updated) || ms(t.date_created) || new Date().toISOString(),
  }
}

export function mapComentario(c, tarefaId, perfilDe) {
  const texto = (c.comment_text || '').trim()
  if (!texto) return null
  return {
    tarefa_id: tarefaId, clickup_comment_id: String(c.id), texto,
    autor_id: perfilDe(c.user?.id)?.id || null, autor_nome: c.user?.username || null,
    created_at: new Date(Number(c.date)).toISOString(),
  }
}

export function fazPerfilDe(perfis) {
  const m = new Map()
  for (const p of perfis) if (p.clickup_user_id) m.set(Number(p.clickup_user_id), p)
  return (cuId) => m.get(ALIAS_CLICKUP[cuId] || Number(cuId)) || null
}
