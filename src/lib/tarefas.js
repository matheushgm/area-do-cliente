// Helpers puros do módulo Tarefas (réplica do ClickUp): statuses, prioridades,
// agrupamentos, formatação de datas e cores. Sem React, sem Supabase.

export const STATUSES_PADRAO = [
  { key: '💡 backlog',   label: '💡 Backlog',   cor: '#87909e', tipo: 'open',   ordem: 0 },
  { key: 'a fazer',      label: 'A fazer',      cor: '#4466ff', tipo: 'custom', ordem: 1 },
  { key: 'em progresso', label: 'Em progresso', cor: '#b660e0', tipo: 'custom', ordem: 2 },
  { key: 'em revisão',   label: 'Em revisão',   cor: '#aa8d80', tipo: 'custom', ordem: 3 },
  { key: 'complete',     label: 'Concluído',    cor: '#008844', tipo: 'closed', ordem: 4 },
]

export const PRIORIDADES = [
  { key: 'urgent', label: 'Urgente', cor: '#f50000' },
  { key: 'high',   label: 'Alta',    cor: '#ffcc00' },
  { key: 'normal', label: 'Normal',  cor: '#6fddff' },
  { key: 'low',    label: 'Baixa',   cor: '#d8d8d8' },
]

export const TIPOS_TAREFA = [
  { key: 'Criação de Arte Estática',     cor: '#5A6258' },
  { key: 'Criação de Landing Page',      cor: '#81B1FF' },
  { key: 'Relatório',                    cor: '#E784AD' },
  { key: 'Edição de vídeo',              cor: '#E194E7' },
  { key: 'Integração',                   cor: '#028421' },
  { key: 'Copy de anúncio',              cor: '#BCDD17' },
  { key: 'Copy de Landing Page',         cor: '#7750C8' },
  { key: 'Estratégia',                   cor: '#D378D4' },
  { key: 'Traqueamento',                 cor: '#A76160' },
  { key: 'Reunião',                      cor: '#aec0f5' },
  { key: 'Preenchimento de resultado',   cor: '#96c7f2' },
  { key: 'Otimização',                   cor: '#AF7E2E' },
  { key: 'Subir Criativo',               cor: '#b6b6ff' },
  { key: 'Criar Campanha',               cor: '#8dcec3' },
  { key: 'Gravação de vídeo',            cor: '#92ceac' },
  { key: 'Fotografia',                   cor: '#e9c162' },
  { key: 'Edição de fotografia',         cor: '#ffaa7d' },
  { key: 'Mídia Offline',                cor: '#6647f0' },
  { key: 'Motion design',                cor: '#3e63dd' },
  { key: 'Projeto de identidade visual', cor: '#0091ff' },
  { key: 'Branding (estratégia)',        cor: '#12a594' },
]

export const DIFICULDADES = [
  { key: 'Baixa',    cor: '#2ecd6f' },
  { key: 'Regular',  cor: '#81B1FF' },
  { key: 'Complexa', cor: '#f9d900' },
]

export const DEPARTAMENTOS = [
  'Account Manager', 'Gestor de tráfego', 'Estrategista', 'Copywriter', 'Designer',
  'Web Designer', 'Comercial', 'Tecnologia', 'Cliente',
]

export const AGRUPAMENTOS = [
  { value: 'status',      label: 'Status' },
  { value: 'vencimento',  label: 'Data de vencimento' },
  { value: 'responsavel', label: 'Responsável' },
  { value: 'prioridade',  label: 'Prioridade' },
  { value: 'lista',       label: 'Lista' },
  { value: 'nenhum',      label: 'Nenhum' },
]

export const COLUNAS_LISTA = [
  { key: 'status',       label: 'Status',              w: 150 },
  { key: 'responsavel',  label: 'Responsável',         w: 110 },
  { key: 'criada',       label: 'Data criada',         w: 110 },
  { key: 'vencimento',   label: 'Data de vencimento',  w: 150 },
  { key: 'prioridade',   label: 'Prioridade',          w: 120 },
  { key: 'dificuldade',  label: 'Dificuldade',         w: 120 },
  { key: 'tipo',         label: 'Tipo de tarefa',      w: 150 },
  { key: 'estimativa',   label: 'Estimativa de tempo', w: 150 },
  { key: 'conclusao',    label: 'Data de conclusão',   w: 140 },
]

// ─── Status ───────────────────────────────────────────────────────────────────

export function statusDaLista(lista) {
  const s = Array.isArray(lista?.statuses) && lista.statuses.length ? lista.statuses : STATUSES_PADRAO
  return [...s].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
}

/** União ordenada dos statuses de várias listas (visão de pasta). */
export function statusDasListas(listas) {
  const vistos = new Map()
  for (const l of listas) {
    for (const s of statusDaLista(l)) {
      if (!vistos.has(s.key)) vistos.set(s.key, { ...s })
    }
  }
  const arr = [...vistos.values()]
  // abertos primeiro, fechados por último, respeitando a ordem original
  return arr.sort((a, b) => {
    const ta = a.tipo === 'closed' ? 1 : 0
    const tb = b.tipo === 'closed' ? 1 : 0
    if (ta !== tb) return ta - tb
    return (a.ordem ?? 0) - (b.ordem ?? 0)
  })
}

export function acharStatus(statuses, key) {
  return statuses.find((s) => s.key === key) || { key, label: key, cor: '#87909e', tipo: 'custom' }
}

export function statusInicial(statuses) {
  return statuses.find((s) => s.tipo === 'open') || statuses[0] || STATUSES_PADRAO[0]
}

export function statusConcluido(statuses) {
  return statuses.find((s) => s.tipo === 'closed') || STATUSES_PADRAO[STATUSES_PADRAO.length - 1]
}

export function rotuloStatus(key) {
  if (!key) return ''
  if (key === 'complete' || key === 'closed' || key === 'concluido') return 'Concluído'
  return key.charAt(0).toUpperCase() + key.slice(1)
}

export function prioridade(key) {
  return PRIORIDADES.find((p) => p.key === key) || null
}

// ─── Datas ────────────────────────────────────────────────────────────────────

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export function paraData(v) {
  if (!v) return null
  const d = v instanceof Date ? v : new Date(v)
  return isNaN(d.getTime()) ? null : d
}

export function inicioDoDia(d = new Date()) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** "18/8/26" (formato da coluna de lista do ClickUp). */
export function fmtDataNumerica(v) {
  const d = paraData(v)
  if (!d) return ''
  return `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`
}

/** "30 set" no mesmo ano, senão "12/12/25" (formato dos cards do quadro). */
export function fmtDataCurta(v) {
  const d = paraData(v)
  if (!d) return ''
  const hoje = new Date()
  const dia = inicioDoDia(d).getTime()
  const h0 = inicioDoDia(hoje).getTime()
  if (dia === h0) return 'Hoje'
  if (dia === h0 + 86400000) return 'Amanhã'
  if (dia === h0 - 86400000) return 'Ontem'
  if (d.getFullYear() === hoje.getFullYear()) return `${d.getDate()} ${MESES[d.getMonth()]}`
  return fmtDataNumerica(d)
}

export function fmtDataHora(v) {
  const d = paraData(v)
  if (!d) return ''
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Valor para <input type="date"> (yyyy-mm-dd, fuso local). */
export function paraInputDate(v) {
  const d = paraData(v)
  if (!d) return ''
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${dd}`
}

/** yyyy-mm-dd → ISO ao meio-dia local (evita virar o dia anterior em UTC). */
export function deInputDate(s) {
  if (!s) return null
  const d = new Date(`${s}T12:00:00`)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

export function estaAtrasada(item) {
  if (!item?.data_vencimento || item.status_tipo === 'closed') return false
  const d = paraData(item.data_vencimento)
  return d && inicioDoDia(d).getTime() < inicioDoDia().getTime()
}

export function corDaData(item) {
  if (!item?.data_vencimento) return ''
  if (item.status_tipo === 'closed') return 'text-rl-muted'
  const d = inicioDoDia(paraData(item.data_vencimento)).getTime()
  const h = inicioDoDia().getTime()
  if (d < h) return 'text-red-500'
  if (d === h) return 'text-rl-green'
  return 'text-rl-subtle'
}

export function fmtEstimativa(min) {
  if (!min || min <= 0) return ''
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

/** "1h30", "90m", "2h", "1.5h", "45" (minutos) → minutos. */
export function parseEstimativa(txt) {
  const s = String(txt || '').trim().toLowerCase().replace(',', '.')
  if (!s) return null
  let total = 0
  const h = s.match(/(\d+(?:\.\d+)?)\s*h/)
  const m = s.match(/(\d+)\s*m/)
  if (h) total += parseFloat(h[1]) * 60
  if (m) total += parseInt(m[1], 10)
  if (!h && !m) {
    const n = parseFloat(s)
    if (isNaN(n)) return null
    total = n
  }
  return Math.round(total) || null
}

// ─── Pessoas ──────────────────────────────────────────────────────────────────

const PALETA = ['#7b68ee', '#e93d82', '#0091ff', '#30a46c', '#ffc53d', '#f57c01', '#3e63dd', '#b660e0', '#00b8cc', '#e5484d']

export function corDaPessoa(id, corFixa) {
  if (corFixa) return corFixa
  const s = String(id || '')
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return PALETA[h % PALETA.length]
}

export function iniciais(nome) {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean)
  if (!partes.length) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

/** Lista unificada de pessoas de uma tarefa: perfis mapeados + extras do ClickUp. */
export function pessoasDaTarefa(item, membrosMap) {
  const out = []
  for (const id of item?.responsaveis || []) {
    const m = membrosMap.get(id)
    if (m) out.push({ id, nome: m.name, iniciais: m.avatar || iniciais(m.name), cor: corDaPessoa(id) })
  }
  for (const e of item?.responsaveis_extra || []) {
    out.push({ id: `cu:${e.clickup_id}`, nome: e.nome, iniciais: e.iniciais || iniciais(e.nome), cor: e.cor || corDaPessoa(e.nome), extra: true })
  }
  return out
}

// ─── Agrupamento ─────────────────────────────────────────────────────────────

const BUCKETS_VENC = [
  { key: 'atrasado',  label: 'Atrasado',                 cor: '#e5484d' },
  { key: 'hoje',      label: 'Hoje',                     cor: '#30a46c' },
  { key: 'amanha',    label: 'Amanhã',                   cor: '#ffc53d' },
  { key: 'semana',    label: 'Esta semana',              cor: '#0091ff' },
  { key: 'proxima',   label: 'Próxima semana',           cor: '#3e63dd' },
  { key: 'futuro',    label: 'Futuro',                   cor: '#7b68ee' },
  { key: 'semdata',   label: 'Sem data de vencimento',   cor: '#87909e' },
  { key: 'concluida', label: 'Concluído',                cor: '#008844' },
]

function bucketVencimento(item) {
  if (item.status_tipo === 'closed') return 'concluida'
  const d = paraData(item.data_vencimento)
  if (!d) return 'semdata'
  const dia = inicioDoDia(d).getTime()
  const hoje = inicioDoDia()
  const h0 = hoje.getTime()
  if (dia < h0) return 'atrasado'
  if (dia === h0) return 'hoje'
  if (dia === h0 + 86400000) return 'amanha'
  // semana = até domingo
  const dow = hoje.getDay() // 0 dom
  const fimSemana = h0 + (7 - dow) * 86400000 // próximo domingo (exclusivo)
  if (dia < fimSemana) return 'semana'
  if (dia < fimSemana + 7 * 86400000) return 'proxima'
  return 'futuro'
}

/**
 * Agrupa as tarefas de topo (sem parent) em seções. Devolve
 * [{ key, label, cor, itens }] já na ordem de exibição.
 */
export function agruparItens(itens, modo, { statuses = [], membrosMap = new Map(), listasMap = new Map() } = {}) {
  const grupos = new Map()
  const push = (key, label, cor, item) => {
    if (!grupos.has(key)) grupos.set(key, { key, label, cor, itens: [] })
    grupos.get(key).itens.push(item)
  }

  for (const it of itens) {
    switch (modo) {
      case 'status': {
        const s = acharStatus(statuses, it.status)
        push(s.key, s.label || rotuloStatus(s.key), s.cor, it)
        break
      }
      case 'vencimento': {
        const b = BUCKETS_VENC.find((x) => x.key === bucketVencimento(it))
        push(b.key, b.label, b.cor, it)
        break
      }
      case 'responsavel': {
        const pessoas = pessoasDaTarefa(it, membrosMap)
        if (!pessoas.length) push('nenhum', 'Sem responsável', '#87909e', it)
        else pessoas.forEach((p) => push(p.id, p.nome, p.cor, it))
        break
      }
      case 'prioridade': {
        const p = prioridade(it.prioridade)
        if (p) push(p.key, p.label, p.cor, it)
        else push('nenhuma', 'Sem prioridade', '#87909e', it)
        break
      }
      case 'lista': {
        const l = listasMap.get(it.lista_id)
        push(it.lista_id, l?.nome || 'Lista', '#7b68ee', it)
        break
      }
      default:
        push('todas', 'Tarefas', '#87909e', it)
    }
  }

  const ordem = (key) => {
    if (modo === 'status') { const i = statuses.findIndex((s) => s.key === key); return i < 0 ? 999 : i }
    if (modo === 'vencimento') return BUCKETS_VENC.findIndex((b) => b.key === key)
    if (modo === 'prioridade') { const i = PRIORIDADES.findIndex((p) => p.key === key); return i < 0 ? 999 : i }
    if (modo === 'responsavel') return key === 'nenhum' ? 999 : 0
    return 0
  }
  return [...grupos.values()].sort((a, b) => ordem(a.key) - ordem(b.key) || a.label.localeCompare(b.label))
}

/** Ordenação padrão dentro de um grupo: posição (ordem do ClickUp) e depois criação. */
export function ordenarItens(itens) {
  return [...itens].sort((a, b) => {
    const pa = Number(a.posicao) || 0
    const pb = Number(b.posicao) || 0
    if (pa !== pb) return pa - pb
    return new Date(a.created_at) - new Date(b.created_at)
  })
}

export function filtrarItens(itens, { busca = '', responsavel = 'todos', mostrarConcluidas = false, userId = null } = {}) {
  const q = busca.trim().toLowerCase()
  return itens.filter((it) => {
    if (!mostrarConcluidas && it.status_tipo === 'closed') return false
    if (responsavel === 'eu' && !(it.responsaveis || []).includes(userId)) return false
    if (responsavel !== 'todos' && responsavel !== 'eu' && !(it.responsaveis || []).includes(responsavel)) return false
    if (q && !String(it.titulo || '').toLowerCase().includes(q)) return false
    return true
  })
}

/** Texto do bloco de descrição em markdown com fallback amigável. */
export function descricaoVazia(txt) {
  return !String(txt || '').replace(/\s+/g, '').length
}

export function progressoChecklists(checklists) {
  let total = 0, feitos = 0
  for (const c of checklists || []) for (const i of c.itens || []) { total++; if (i.feito) feitos++ }
  return { total, feitos }
}

export function novoId() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}
