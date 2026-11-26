// Timer do VertaTask (tabela tarefas_tempo, migration 145): formatação e as contas do dashboard
// de horas. Regras puras, sem Supabase.

/** Segundos de uma entrada; a que está rodando conta até `agora`. */
export function segundosDaEntrada(e, agora = Date.now()) {
  if (!e) return 0
  if (e.fim) return Math.max(0, Number.isFinite(e.segundos) ? e.segundos : Math.floor((new Date(e.fim) - new Date(e.inicio)) / 1000))
  return Math.max(0, Math.floor((agora - new Date(e.inicio).getTime()) / 1000))
}

/** Relógio do timer rodando: 0:07:05, 1:20:00. */
export function fmtRelogio(seg) {
  const s = Math.max(0, Math.floor(seg || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

/** Duração para leitura: 45s, 12min, 1h 05min, 32h. */
export function fmtDuracao(seg) {
  const s = Math.max(0, Math.round(seg || 0))
  if (s < 60) return `${s}s`
  const totalMin = Math.round(s / 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (!h) return `${m}min`
  if (h >= 100 || !m) return `${h}h`
  return `${h}h ${String(m).padStart(2, '0')}min`
}

/** Horas decimais com 1 casa (eixo e totais do dashboard): 12,5 h. */
export function fmtHoras(seg) {
  const h = (seg || 0) / 3600
  return `${h.toLocaleString('pt-BR', { maximumFractionDigits: h < 10 ? 1 : 0, minimumFractionDigits: 0 })} h`
}

/** "1h30", "90", "1:30", "45m", "2h" → segundos (null se não entendeu). Número puro = minutos. */
export function lerDuracao(txt) {
  const v = String(txt || '').trim().toLowerCase().replace(',', '.')
  if (!v) return null
  let m = v.match(/^(\d+):(\d{1,2})$/)
  if (m) return (Number(m[1]) * 60 + Number(m[2])) * 60
  m = v.match(/^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+)\s*(?:m|min)?)?$/)
  if (m && (m[1] || m[2])) {
    const horas = m[1] ? Number(m[1]) : 0
    const min = m[2] ? Number(m[2]) : 0
    // "90" (sem h) = minutos; "1.5h" = horas
    const seg = Math.round(horas * 3600 + min * 60)
    return seg > 0 ? seg : null
  }
  return null
}

// ── Períodos do dashboard ────────────────────────────────────────────────────

const inicioDoDia = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const somaDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }

export const PERIODOS = ['hoje', 'semana', '7d', '30d', 'mes', 'mesPassado']

/** [início, fim) do período, no fuso do navegador. Semana começa na segunda. */
export function intervaloDoPeriodo(periodo, hoje = new Date()) {
  const h = inicioDoDia(hoje)
  switch (periodo) {
    case 'hoje': return [h, somaDias(h, 1)]
    case 'semana': { const dow = (h.getDay() + 6) % 7; const ini = somaDias(h, -dow); return [ini, somaDias(ini, 7)] }
    case '7d': return [somaDias(h, -6), somaDias(h, 1)]
    case 'mes': return [new Date(h.getFullYear(), h.getMonth(), 1), new Date(h.getFullYear(), h.getMonth() + 1, 1)]
    case 'mesPassado': return [new Date(h.getFullYear(), h.getMonth() - 1, 1), new Date(h.getFullYear(), h.getMonth(), 1)]
    case '30d':
    default: return [somaDias(h, -29), somaDias(h, 1)]
  }
}

/** Dias (chave AAAA-MM-DD local) entre início e fim. */
export function diasDoIntervalo(ini, fim) {
  const out = []
  for (let d = inicioDoDia(ini); d < fim; d = somaDias(d, 1)) out.push(chaveDia(d))
  return out
}

export function chaveDia(d) {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

/**
 * Quebra uma entrada pelos dias que ela atravessa (timer que passou da meia-noite conta em cada
 * dia a parte dele) e recorta no intervalo. Devolve [{ dia, seg }].
 */
export function partesPorDia(e, ini, fim, agora = Date.now()) {
  const a = Math.max(new Date(e.inicio).getTime(), ini.getTime())
  const b = Math.min(e.fim ? new Date(e.fim).getTime() : agora, fim.getTime())
  if (!(b > a)) return []
  const out = []
  for (let cur = a; cur < b;) {
    const fimDia = somaDias(inicioDoDia(cur), 1).getTime()
    const ate = Math.min(fimDia, b)
    out.push({ dia: chaveDia(cur), seg: Math.floor((ate - cur) / 1000) })
    cur = ate
  }
  return out
}

/**
 * Agrega as entradas do período.
 * `tarefas`: Map id → tarefa (o que a RLS devolveu; tarefa da lista pessoal de outra pessoa não
 * vem, e cai em "privada"). `tipoDe(tarefa)` e `clienteDe(tarefa)` resolvem as chaves.
 */
export function agregarHoras(entradas, { ini, fim, tarefas, tipoDe, clienteDe, agora = Date.now() }) {
  const total = { seg: 0 }
  const porDia = new Map()
  const porPessoa = new Map()
  const porTipo = new Map()
  const porCliente = new Map()
  const porTarefa = new Map()
  const somar = (m, k, seg, extra) => {
    const cur = m.get(k) || { chave: k, seg: 0, ...extra }
    cur.seg += seg
    m.set(k, cur)
    return cur
  }
  for (const e of entradas) {
    const partes = partesPorDia(e, ini, fim, agora)
    if (!partes.length) continue
    const seg = partes.reduce((s, p) => s + p.seg, 0)
    const tarefa = tarefas.get(e.tarefa_id) || null
    const privada = !tarefa
    total.seg += seg
    for (const p of partes) {
      const d = porDia.get(p.dia) || { chave: p.dia, seg: 0, porPessoa: new Map() }
      d.seg += p.seg
      d.porPessoa.set(e.user_id, (d.porPessoa.get(e.user_id) || 0) + p.seg)
      porDia.set(p.dia, d)
    }
    const pessoa = somar(porPessoa, e.user_id, seg, { tarefas: new Set() })
    pessoa.tarefas.add(e.tarefa_id)
    somar(porTipo, privada ? '__privada' : (tipoDe(tarefa) || '__sem'), seg)
    somar(porCliente, privada ? '__privada' : (clienteDe(tarefa) || '__sem'), seg)
    const t = somar(porTarefa, e.tarefa_id, seg, { tarefa, privada, pessoas: new Map(), rodando: false })
    t.pessoas.set(e.user_id, (t.pessoas.get(e.user_id) || 0) + seg)
    if (!e.fim) t.rodando = true
  }
  const ordenar = (m) => [...m.values()].sort((a, b) => b.seg - a.seg)
  return {
    total: total.seg,
    porDia,
    porPessoa: ordenar(porPessoa),
    porTipo: ordenar(porTipo),
    porCliente: ordenar(porCliente),
    porTarefa: ordenar(porTarefa),
  }
}
