import { iniciais } from './utils'
import { t as tr, idiomaAtual, localeAtual } from '../i18n'
import { rotuloTipoTarefa, rotuloDificuldade } from './tarefas'
// Funções puras do painel de capacidade do time (módulo Atividades).
// Recebem o que a action `carga` (ou `sugerir` sem horas) devolve por pessoa
// e devolvem o que a UI mostra: sinal de saúde, agregados do time, formatação.

export const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
export const DIAS_LONGO = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
export const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

// Nomes de dia e mês no idioma da tela. Em português ficam as listas acima
// (o formato de sempre); nos outros idiomas, o Intl.
function emPortugues() { return idiomaAtual() === 'pt' }
function intl(opcoes, dataUTC) {
  return new Intl.DateTimeFormat(localeAtual(), { ...opcoes, timeZone: 'UTC' }).format(dataUTC)
}
/** Dia da semana curto (0 = domingo): 'Seg' / 'Mon'. */
export function nomeDiaCurto(wd) {
  if (emPortugues()) return DIAS[wd]
  return intl({ weekday: 'short' }, new Date(Date.UTC(2023, 0, 1 + wd))) // 01/01/2023 foi domingo
}
/** Mês curto (0 = janeiro): 'set' / 'Sep'. */
export function nomeMesCurto(m0) {
  if (emPortugues()) return MESES[m0]
  return intl({ month: 'short' }, new Date(Date.UTC(2023, m0, 1)))
}

export function hojeISO() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
export function weekday(iso) {
  const [y, m, d] = String(iso).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}
/** '2026-09-17' → '17/09' (em inglês, '09/17') */
export function fmtCurta(iso) {
  if (!iso) return ''
  const [, m, d] = String(iso).split('-')
  return emPortugues() ? `${d}/${m}` : `${m}/${d}`
}
/** '2026-09-17' → 'qui 17/09' (em inglês, 'Thu 09/17') */
export function fmtDiaCurto(iso) {
  if (!iso) return ''
  const dia = nomeDiaCurto(weekday(iso))
  return `${emPortugues() ? dia.toLowerCase() : dia} ${fmtCurta(iso)}`
}
/** '2026-09-17' → 'quinta, 17/09/2026' (em inglês, 'Thursday, 09/17/2026') */
export function fmtLonga(iso) {
  if (!iso) return ''
  const [y, m, d] = String(iso).split('-')
  if (!emPortugues()) return intl({ weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }, new Date(Date.UTC(Number(y), Number(m) - 1, Number(d))))
  return `${DIAS_LONGO[weekday(iso)]}, ${d}/${m}/${y}`
}
/** 5.5 → '5,5h' (em inglês, '5.5h'); 6 → '6h'; 0.5 → '30 min' */
export function fmtHoras(h) {
  const n = Number(h) || 0
  if (n > 0 && n < 1) return `${Math.round(n * 60)} min`
  if (Number.isInteger(n)) return `${n}h`
  const txt = n.toFixed(1)
  return `${emPortugues() ? txt.replace('.', ',') : txt}h`
}

/**
 * Lê uma duração digitada e devolve horas: "45m", "45 min", "1h30", "1:30",
 * "1,5" ou "2". `unidade` ('h' | 'min') vale para número sem sufixo.
 */
export function parseDuracao(texto, unidade = 'h') {
  const t = String(texto || '').trim().toLowerCase().replace(',', '.')
  if (!t) return null
  let m
  if ((m = t.match(/^(\d+(?:\.\d+)?)\s*h(?:\s*(\d{1,2})\s*(?:m|min)?)?$/))) return Number(m[1]) + (m[2] ? Number(m[2]) / 60 : 0)
  if ((m = t.match(/^(\d+):(\d{1,2})$/))) return Number(m[1]) + Number(m[2]) / 60
  if ((m = t.match(/^(\d+(?:\.\d+)?)\s*(m|min|minutos?)$/))) return Number(m[1]) / 60
  if ((m = t.match(/^(\d+(?:\.\d+)?)$/))) return unidade === 'min' ? Number(m[1]) / 60 : Number(m[1])
  return null
}
export function fmtPct(n) {
  return `${Math.round(Number(n) || 0)}%`
}
export function primeiroNome(nome) {
  return String(nome || '').split(' ')[0]
}
export { iniciais }
/** ISO timestamp → 'há 3 min' / 'há 2 h' (em inglês, '3 min ago') */
export function fmtRelativo(iso, agora = Date.now()) {
  if (!iso) return ''
  const diff = Math.max(0, agora - new Date(iso).getTime())
  const min = Math.round(diff / 60000)
  if (min < 1) return tr('atividades.relativo.agora')
  if (min < 60) return tr('atividades.relativo.min', { n: min })
  const h = Math.round(min / 60)
  if (h < 24) return tr('atividades.relativo.h', { n: h })
  const d = Math.round(h / 24)
  return tr('atividades.relativo.d', { n: d })
}
/** ISO timestamp → '14:02' */
export function fmtHora(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString(localeAtual(), { hour: '2-digit', minute: '2-digit' })
}
/** ISO timestamp → data curta no idioma da tela ('17/09/2026' / '9/17/2026'). */
export function fmtData(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(localeAtual())
}

/**
 * De onde vieram as horas da tarefa (`origem` do motor: 'estimativa',
 * 'tipo: X', 'dificuldade: X', 'padrão'). X é o valor do ClickUp, traduzido só na tela.
 */
export function rotuloOrigem(origem) {
  const o = String(origem || '')
  if (o === 'estimativa') return tr('atividades.origem.estimativa')
  if (o === 'padrão') return tr('atividades.origem.padrao')
  let m
  if ((m = o.match(/^tipo:\s*(.*)$/))) return tr('atividades.origem.tipo', { valor: rotuloTipoTarefa(m[1]) })
  if ((m = o.match(/^dificuldade:\s*(.*)$/))) return tr('atividades.origem.dificuldade', { valor: rotuloDificuldade(m[1]) })
  return o
}

// ─── Saúde por pessoa ────────────────────────────────────────────────────────

export const NIVEIS = {
  sobrecarregado: { ordem: 0, label: 'Sobrecarregado', dot: 'bg-ln-red', text: 'text-ln-red', bg: 'bg-ln-red/15', ring: 'ring-ln-red/40' },
  no_limite:      { ordem: 1, label: 'No limite',      dot: 'bg-ln-yellow', text: 'text-ln-yellow', bg: 'bg-ln-yellow/15', ring: 'ring-ln-yellow/40' },
  ok:             { ordem: 2, label: 'Ok',             dot: 'bg-ln-green', text: 'text-ln-green', bg: 'bg-ln-green/15', ring: 'ring-ln-green/40' },
  livre:          { ordem: 3, label: 'Livre',          dot: 'bg-ln-teal', text: 'text-ln-teal', bg: 'bg-ln-teal/15', ring: 'ring-ln-teal/40' },
  sem_leitura:    { ordem: 4, label: 'Sem leitura',    dot: 'bg-ln-t4', text: 'text-ln-t4', bg: 'bg-ln-ink/5', ring: 'ring-ln-ink/10' },
}
export const ORDEM_NIVEIS = Object.keys(NIVEIS).sort((a, b) => NIVEIS[a].ordem - NIVEIS[b].ordem)
/** Rótulo do nível no idioma da tela (o `label` de NIVEIS fica em português). */
export function rotuloNivel(nivel) {
  return NIVEIS[nivel] ? tr(`atividades.nivel.${nivel}`) : String(nivel || '')
}

/**
 * Texto da saúde no idioma da tela, montado do `motivo` que saudeDe guarda
 * (a mensagem de erro da API, quando há, vem como chegou).
 */
export function textoSaude(saude) {
  const m = saude?.motivo
  if (!m) return saude?.texto || ''
  switch (m.tipo) {
    case 'semClickup': return tr('atividades.saude.semClickup')
    case 'erro': return m.erro || tr('atividades.saude.naoLeu')
    case 'zero': return tr('atividades.saude.zero')
    case 'sobrecarregado': {
      const partes = []
      if (m.diasEstourados) partes.push(tr('atividades.saude.diasEstourados', { count: m.diasEstourados }))
      if (m.horasAtrasadas) partes.push(tr('atividades.saude.horasAtrasadas', { horas: fmtHoras(m.horasAtrasadas) }))
      if (m.sobra > 0) partes.push(tr('atividades.saude.naoCabem60', { horas: fmtHoras(m.sobra) }))
      return tr('atividades.saude.naoCabeNada', { detalhe: partes.join(', ') || tr('atividades.saude.pctOcupado', { pct: m.ocupacao }) })
    }
    case 'no_limite': return tr('atividades.saude.noLimite')
    case 'ok': return m.proximoDiaLivre ? tr('atividades.saude.okComDia', { dia: fmtDiaCurto(m.proximoDiaLivre) }) : tr('atividades.saude.ok')
    case 'livre': return tr('atividades.saude.livre')
    default: return saude?.texto || ''
  }
}
function comTexto(s) { return { ...s, texto: textoSaude(s) } }

/**
 * Classifica uma pessoa. `p` é o objeto de planejarParaPessoa; `erro` é a
 * mensagem quando a leitura do ClickUp falhou; `semClickup` quando o perfil
 * não tem clickup_user_id.
 */
export function saudeDe(p, { erro = null, semClickup = false } = {}) {
  if (semClickup) return comTexto({ nivel: 'sem_leitura', score: -2, suspeito: false, motivo: { tipo: 'semClickup' } })
  if (erro || !p) return comTexto({ nivel: 'sem_leitura', score: -1, suspeito: false, motivo: { tipo: 'erro', erro: erro || null } })
  const t = p.totais || {}
  const cap = Number(p.capacidadeDia) || 6
  const ocupacao = Number(t.ocupacaoProximosDias) || 0
  const horasAtrasadas = Number(t.horasAtrasadas) || 0
  // dias estourados nos PRÓXIMOS 10 dias úteis (o total de 60 dias fica só informativo)
  const diasEstourados = (p.resumo || []).filter((d) => d.excedente > 0).length
  const alem = Number(t.alemDoHorizonte) || 0
  const sobra = Number(t.sobraFinal) || 0
  const score = Math.round(ocupacao + 15 * diasEstourados + 10 * (horasAtrasadas / cap) + (alem > 0 || sobra > 0 ? 50 : 0))

  if ((t.abertas || 0) === 0) {
    return comTexto({ nivel: 'livre', score: 0, suspeito: true, motivo: { tipo: 'zero' } })
  }
  if (ocupacao >= 100 || diasEstourados >= 3 || horasAtrasadas >= 2 * cap || alem > 0 || sobra > 0) {
    return comTexto({ nivel: 'sobrecarregado', score, suspeito: false, motivo: { tipo: 'sobrecarregado', diasEstourados, horasAtrasadas, sobra, ocupacao } })
  }
  if (ocupacao >= 75 || diasEstourados >= 1 || horasAtrasadas > cap) {
    return comTexto({ nivel: 'no_limite', score, suspeito: false, motivo: { tipo: 'no_limite' } })
  }
  if (ocupacao >= 40) {
    return comTexto({ nivel: 'ok', score, suspeito: false, motivo: { tipo: 'ok', proximoDiaLivre: p.proximoDiaLivre || null } })
  }
  return comTexto({ nivel: 'livre', score, suspeito: false, motivo: { tipo: 'livre' } })
}

// ─── Enriquecimento por pessoa (API + perfil) ────────────────────────────────

/** Departamentos de um perfil, a partir dos squads (department_assignments invertido + role). */
export function departamentosDe(profileId, squads = []) {
  const out = new Set()
  for (const s of squads || []) {
    const da = s.department_assignments || s.departmentAssignments || {}
    for (const [dep, pid] of Object.entries(da)) if (pid === profileId) out.add(dep === 'Automação / Integração' ? 'Tecnologia' : dep)
    for (const m of s.members || []) if (m.profile_id === profileId && m.role) out.add(m.role)
  }
  return Array.from(out)
}

/**
 * Junta o resultado da API com o perfil: nome, avatar, departamento, saúde e
 * derivados do resumo de 10 dias. `meta` = { profileId, nome, avatar, clickupId, departamentos }.
 */
export function enriquecerPessoa(p, meta, { erro = null, hoje = null } = {}) {
  const semClickup = !meta?.clickupId
  const saude = saudeDe(p, { erro, semClickup })
  const resumo = p?.resumo || []
  const cap = Number(p?.capacidadeDia) || 6
  const dia0 = resumo[0] || null
  const hojeReal = hoje || p?.hoje || hojeISO()
  const horasProx = Number(p?.totais?.horasProximosDias) || 0
  // pico de data: um dia concentra mais de 40% das horas dos 10 dias
  const pico = resumo.reduce((m, d) => (d.cargaOriginal > (m?.cargaOriginal || 0) ? d : m), null)
  const picoDeData = pico && horasProx > 0 && pico.cargaOriginal / horasProx > 0.4 && resumo.length > 3 ? pico.data : null
  const media = (arr) => (arr.length ? arr.reduce((s, d) => s + d.carga / (d.capacidade || cap), 0) / arr.length : 0)
  const tendencia = media(resumo.slice(5, 10)) - media(resumo.slice(0, 5)) // >0 = piora
  const semEst = p?.totais?.semEstimativa || { tarefas: 0, horas: 0 }
  const fila = Number(p?.totais?.consideradas) || 0
  return {
    ...meta,
    api: p || null,
    erro: erro || null,
    saude,
    capacidadeDia: cap,
    hoje: hojeReal,
    totais: p?.totais || null,
    resumo,
    filaProxima: p?.filaProxima || [],
    zumbis: p?.zumbis || [],
    semData: p?.semData || [],
    porPasta: p?.porPasta || [],
    porStatus: p?.porStatus || {},
    proximoDiaLivre: p?.proximoDiaLivre || null,
    // derivados
    diaHoje: dia0?.data === hojeReal ? dia0 : null,     // null em fim de semana
    proximoDia: dia0,                                    // primeiro dia útil da agenda
    diasEstourados10d: resumo.filter((d) => d.excedente > 0).length,
    picoDeData,
    tendencia,
    spark: resumo.map((d) => (d.capacidade ? d.carga / d.capacidade : 0)),
    pctSemEstimativa: fila > 0 ? Math.round((semEst.tarefas / fila) * 100) : 0,
  }
}

/** Dia (item do resumo) que a UI deve mostrar na coluna "Hoje" ou no dia selecionado. */
export function diaDe(pessoa, diaSelecionado) {
  if (!pessoa?.resumo?.length) return null
  if (diaSelecionado) return pessoa.resumo.find((d) => d.data === diaSelecionado) || null
  return pessoa.proximoDia
}

// ─── Agregados do time ───────────────────────────────────────────────────────

export function kpisDoTime(pessoas) {
  const lidas = pessoas.filter((p) => p.api)
  const soma = (f) => lidas.reduce((s, p) => s + (Number(f(p)) || 0), 0)
  const horas = soma((p) => p.totais.horasProximosDias)
  const cap = soma((p) => p.totais.capacidadeProximosDias)
  const porNivel = {}
  for (const p of pessoas) porNivel[p.saude.nivel] = (porNivel[p.saude.nivel] || 0) + 1
  const calor = calorDoTime(pessoas)
  const critico = calor.reduce((m, d) => (d.pct > (m?.pct ?? -1) ? d : m), null)
  return {
    lidas: lidas.length,
    total: pessoas.length,
    ocupacao: cap > 0 ? Math.round((horas / cap) * 100) : 0,
    horas: Math.round(horas * 10) / 10,
    capacidade: Math.round(cap * 10) / 10,
    porNivel,
    sobrecarregados: pessoas.filter((p) => p.saude.nivel === 'sobrecarregado'),
    atrasadas: soma((p) => p.totais.atrasadas),
    horasAtrasadas: Math.round(soma((p) => p.totais.horasAtrasadas) * 10) / 10,
    zumbis: soma((p) => p.totais.zumbis),
    semData: soma((p) => p.totais.semData),
    alemDoHorizonte: Math.round(soma((p) => p.totais.alemDoHorizonte) * 10) / 10,
    sobraFinal: Math.round(soma((p) => p.totais.sobraFinal) * 10) / 10,
    semEstimativa: soma((p) => p.totais.semEstimativa?.tarefas),
    fila: soma((p) => p.totais.consideradas),
    critico,
  }
}

/** Linha de calor: para cada um dos 10 dias úteis, ocupação do time e quem estoura. */
export function calorDoTime(pessoas) {
  const lidas = pessoas.filter((p) => p.api && p.resumo?.length)
  if (!lidas.length) return []
  const n = Math.max(...lidas.map((p) => p.resumo.length))
  const out = []
  for (let i = 0; i < n; i++) {
    let carga = 0, cap = 0
    const estouram = []
    let data = null
    for (const p of lidas) {
      const d = p.resumo[i]
      if (!d) continue
      data = data || d.data
      carga += d.carga
      cap += d.capacidade
      if (d.excedente > 0) estouram.push(p.nome)
    }
    out.push({ i, data, pct: cap > 0 ? Math.round((carga / cap) * 100) : 0, carga: Math.round(carga * 10) / 10, capacidade: cap, estouram })
  }
  return out
}

/** Classe de cor de uma célula/percentual de ocupação. */
export function tomOcupacao(pct) {
  if (pct >= 100) return { text: 'text-ln-red', bg: 'bg-ln-red/15', bar: 'bg-ln-red' }
  if (pct >= 90) return { text: 'text-ln-yellow', bg: 'bg-ln-yellow/15', bar: 'bg-ln-yellow' }
  if (pct >= 70) return { text: 'text-ln-green', bg: 'bg-ln-green/15', bar: 'bg-ln-green' }
  return { text: 'text-ln-t3', bg: 'bg-ln-ink/[0.03]', bar: 'bg-ln-brand/70' }
}

/** Agrupa e ordena as pessoas para a tabela. agrupar: 'saude' | 'departamento' | 'nenhum'. */
export function agruparPessoas(pessoas, agrupar = 'saude', filtroNivel = null) {
  const lista = filtroNivel ? pessoas.filter((p) => p.saude.nivel === filtroNivel) : pessoas
  const ordenar = (arr) => [...arr].sort((a, b) => (b.saude.score - a.saude.score) || a.nome.localeCompare(b.nome, 'pt-BR'))
  if (agrupar === 'nenhum') return [{ id: 'todos', label: null, pessoas: ordenar(lista) }]
  if (agrupar === 'departamento') {
    const map = new Map()
    for (const p of lista) {
      const k = p.departamentos?.[0] || 'Sem departamento'
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(p)
    }
    // o id fica em português; só o rótulo do grupo sem departamento se traduz
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')).map(([k, v]) => ({ id: k, label: k === 'Sem departamento' ? tr('atividades.semDepartamento') : k, pessoas: ordenar(v) }))
  }
  return ORDEM_NIVEIS
    .map((nivel) => ({ id: nivel, label: rotuloNivel(nivel), nivel, pessoas: ordenar(lista.filter((p) => p.saude.nivel === nivel)) }))
    .filter((g) => g.pessoas.length > 0)
}

/** Chave curta estilo Linear para uma atividade planejada (ATV-1F3A). */
export function chaveAtividade(id) {
  return `ATV-${String(id || '').replace(/-/g, '').slice(0, 4).toUpperCase()}`
}

/** Semana (segunda) de uma data ISO, para agrupar a lista de atividades. */
export function inicioDaSemana(iso) {
  if (!iso) return null
  const wd = weekday(iso)
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d - ((wd + 6) % 7)))
  return dt.toISOString().slice(0, 10)
}
export function rotuloSemana(inicioISO, hoje = hojeISO()) {
  if (!inicioISO) return tr('atividades.semana.semData')
  const h = inicioDaSemana(hoje)
  if (inicioISO === h) return tr('atividades.semana.esta')
  const [y, m, d] = inicioISO.split('-').map(Number)
  const prox = new Date(Date.UTC(y, m - 1, d + 7)).toISOString().slice(0, 10)
  const ant = new Date(Date.UTC(y, m - 1, d - 7)).toISOString().slice(0, 10)
  if (h === ant) return tr('atividades.semana.proxima')
  if (h === prox) return tr('atividades.semana.passada')
  if (inicioISO < h) return tr('atividades.semana.dePassada', { data: fmtCurta(inicioISO) })
  return tr('atividades.semana.de', { data: fmtCurta(inicioISO) })
}
