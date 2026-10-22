// Regras puras do VertaTask: ciclos (datas, burndown).
// Datas de ciclo são 'YYYY-MM-DD' em horário local, sem fuso.

const DIA = 86400000

export function paraDiaLocal(s) {
  if (!s) return null
  const [a, b, c] = String(s).slice(0, 10).split('-').map(Number)
  return new Date(a, b - 1, c)
}

export function paraISODia(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function hojeISO() { return paraISODia(new Date()) }

export function somarDias(iso, n) {
  const d = paraDiaLocal(iso)
  d.setDate(d.getDate() + n)
  return paraISODia(d)
}

export function diasEntre(a, b) {
  return Math.round((paraDiaLocal(b) - paraDiaLocal(a)) / DIA)
}

export function fmtDiaMes(iso) {
  const d = paraDiaLocal(iso)
  return d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` : ''
}

/** 'atual' | 'proximo' | 'passado' */
export function faseDoCiclo(c, hoje = hojeISO()) {
  if (hoje < c.inicio) return 'proximo'
  if (hoje > c.fim) return 'passado'
  return 'atual'
}

export const ROTULO_FASE = { atual: 'Atual', proximo: 'Próximo', passado: 'Encerrado' }

/** Ciclo a abrir por padrão: o atual, senão o próximo mais perto, senão o último. */
export function cicloPadrao(ciclos, hoje = hojeISO()) {
  if (!ciclos.length) return null
  const atual = ciclos.find((c) => faseDoCiclo(c, hoje) === 'atual')
  if (atual) return atual
  const futuros = ciclos.filter((c) => c.inicio > hoje).sort((a, b) => a.inicio.localeCompare(b.inicio))
  if (futuros.length) return futuros[0]
  return [...ciclos].sort((a, b) => b.fim.localeCompare(a.fim))[0]
}

/** Sugestão para o "Novo ciclo": começa na próxima segunda e dura 14 dias. */
export function sugerirCiclo(ciclos) {
  const ultimoFim = ciclos.reduce((m, c) => (c.fim > m ? c.fim : m), '')
  let inicio
  if (ultimoFim && ultimoFim >= hojeISO()) inicio = somarDias(ultimoFim, 1)
  else {
    const d = new Date()
    const dias = (8 - d.getDay()) % 7 || 7 // próxima segunda
    d.setDate(d.getDate() + dias)
    inicio = paraISODia(d)
  }
  return { nome: `Ciclo ${ciclos.length + 1}`, inicio, fim: somarDias(inicio, 13) }
}

/** Peso de uma tarefa na unidade escolhida: 'tarefas' (1) ou 'horas' (estimativa). */
export function pesoDaTarefa(item, unidade) {
  if (unidade === 'horas') return (item.estimativa_min || 0) / 60
  return 1
}

/**
 * Burndown do ciclo. itens = tarefas de topo do ciclo (qualquer status).
 * Devolve { total, feito, dias, ideal[], real[], hojeIdx, semEstimativa }.
 * real tem um ponto por dia até hoje (ou até o fim, se já encerrou).
 */
export function calcularBurndown(ciclo, itens, unidade = 'tarefas', hoje = hojeISO()) {
  const dias = diasEntre(ciclo.inicio, ciclo.fim) + 1
  const peso = (it) => pesoDaTarefa(it, unidade)
  const total = itens.reduce((a, it) => a + peso(it), 0)
  const feito = itens.filter((it) => it.status_tipo === 'closed').reduce((a, it) => a + peso(it), 0)
  const hojeIdx = Math.min(dias - 1, diasEntre(ciclo.inicio, hoje))
  const ideal = Array.from({ length: dias }, (_, i) => (dias > 1 ? total * (1 - i / (dias - 1)) : 0))
  const real = []
  for (let i = 0; i <= hojeIdx; i++) {
    const limite = somarDias(ciclo.inicio, i)
    const concl = itens
      .filter((it) => it.status_tipo === 'closed' && it.data_conclusao && String(it.data_conclusao).slice(0, 10) <= limite)
      .reduce((a, it) => a + peso(it), 0)
    real.push(total - concl)
  }
  // concluída sem data_conclusao entra no último ponto, para a linha fechar com o painel
  const semData = itens.filter((it) => it.status_tipo === 'closed' && !it.data_conclusao).reduce((a, it) => a + peso(it), 0)
  if (semData && real.length) real[real.length - 1] = Math.max(0, real[real.length - 1] - semData)
  const semEstimativa = itens.filter((it) => !it.estimativa_min).length
  return { total, feito, dias, ideal, real, hojeIdx, semEstimativa }
}

export function fmtHoras(h) {
  if (!h) return '0h'
  return h >= 10 ? `${Math.round(h)}h` : `${Math.round(h * 10) / 10}h`.replace('.', ',')
}

export const ORIGENS_INTAKE = ['Cliente', 'Aprovação de anúncios', 'Central de Otimizações', 'Playbook', 'Interno', 'Manual']
