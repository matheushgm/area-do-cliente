// Capacidade no calendário de vencimento da tarefa nova (VertaTask). Regra pura: recebe a agenda
// dia a dia de cada responsável (action=disponibilidade de /api/atividades, a mesma agenda da
// Capacidade do time) e as horas da tarefa nova, e devolve a cor de cada dia e a data mais factível.
//
// Cores, por pessoa (com mais de um responsável vale a pior):
//   vermelho: o dia não tem mais tempo livre, ou a tarefa não cabe até esse dia
//             (o tempo livre somado de hoje até lá é menor que as horas dela)
//   amarelo:  cabe, mas o dia já está cheio (75% ou mais da capacidade ocupada)
//   verde:    cabe e o dia está tranquilo
// Mais factível = o primeiro dia verde para todos; sem verde no horizonte, o primeiro amarelo.
// Fim de semana, feriado, dias passados e além do horizonte (60 dias úteis) ficam sem cor.

export const NIVEIS = ['verde', 'amarelo', 'vermelho']
export const OCUPACAO_CHEIO = 0.75
const SEM_TEMPO_H = 0.25 // menos de 15 min livres = dia sem tempo

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
const r2 = (n) => Math.round(n * 100) / 100

/** Horas da tarefa nova: estimativa > tipo > dificuldade > padrão (mesma ordem do motor). */
export function horasDaNova({ estimativa_min: est, tipo_tarefa: tipo, dificuldade } = {}, config = {}) {
  const min = Number(est)
  if (Number.isFinite(min) && min > 0) return { horas: r2(min / 60), origem: 'estimativa' }
  const porTipo = config.horas_por_tipo || {}
  const kTipo = tipo ? Object.keys(porTipo).find((k) => norm(k) === norm(tipo)) : null
  if (kTipo) return { horas: Number(porTipo[kTipo]), origem: 'tipo' }
  const porDif = config.horas_por_dificuldade || {}
  const kDif = dificuldade ? Object.keys(porDif).find((k) => norm(k) === norm(dificuldade)) : null
  if (kDif) return { horas: Number(porDif[kDif]), origem: 'dificuldade' }
  return { horas: Number(config.horas_padrao_sem_estimativa ?? 1), origem: 'padrao' }
}

/** Cor de cada dia útil para UMA pessoa: Map data → { nivel, carga, capacidade, livre, faltam }. */
export function diasDaPessoa(dias, horas, hoje) {
  const out = new Map()
  let acumulado = 0
  for (const d of dias || []) {
    if (d.data < hoje) continue
    const cap = Number(d.capacidade) || 0
    const livre = Math.max(0, Number(d.livre) || 0)
    acumulado += livre
    const ocupacao = cap > 0 ? (Number(d.carga) || 0) / cap : 1
    const faltam = r2(Math.max(0, horas - acumulado))
    let nivel
    if (livre < SEM_TEMPO_H || faltam > 0) nivel = 'vermelho'
    else if (ocupacao >= OCUPACAO_CHEIO) nivel = 'amarelo'
    else nivel = 'verde'
    out.set(d.data, { nivel, carga: r2(Number(d.carga) || 0), capacidade: cap, livre: r2(livre), faltam, tarefas: d.tarefas || 0 })
  }
  return out
}

/**
 * pessoas = [{ nome, dias }] (dias da API). Devolve { porDia: Map data → { nivel, pessoas: [{ nome, ... }] },
 * sugerida, nivelSugerida }. Dia que falta na agenda de alguém (fora do horizonte) fica sem cor.
 */
export function capacidadeNoCalendario(pessoas, horas, hoje) {
  const lista = (pessoas || []).filter((p) => Array.isArray(p.dias) && p.dias.length)
  const porDia = new Map()
  if (!lista.length) return { porDia, sugerida: null, nivelSugerida: null }
  const mapas = lista.map((p) => ({ nome: p.nome, dias: diasDaPessoa(p.dias, horas, hoje) }))
  const datas = [...mapas[0].dias.keys()].filter((d) => mapas.every((m) => m.dias.has(d))).sort()
  for (const data of datas) {
    const itens = mapas.map((m) => ({ nome: m.nome, ...m.dias.get(data) }))
    const nivel = NIVEIS[Math.max(...itens.map((i) => NIVEIS.indexOf(i.nivel)))]
    porDia.set(data, { nivel, pessoas: itens })
  }
  const primeiro = (n) => datas.find((d) => porDia.get(d).nivel === n) || null
  const verde = primeiro('verde')
  const sugerida = verde || primeiro('amarelo')
  return { porDia, sugerida, nivelSugerida: sugerida ? porDia.get(sugerida).nivel : null }
}
