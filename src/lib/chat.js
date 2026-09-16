// Helpers do Chat (modelo do ClickUp Chat): datas, menções, cores de avatar.

const CORES = ['#7b68ee', '#e0479e', '#08c7e0', '#f9a825', '#2ea44f', '#ff5722', '#4169e1', '#9c27b0', '#00897b', '#c2185b']

export function corDe(id = '') {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return CORES[h % CORES.length]
}

export function iniciaisDe(nome = '') {
  return nome.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?'
}

export function primeiroNome(nome = '') {
  return nome.trim().split(/\s+/)[0] || nome
}

export const slugDe = (nome = '') => nome.trim().replace(/\s+/g, '_')

const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

function inicioDoDia(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }

export function chaveDia(iso) { return inicioDoDia(iso).getTime() }

// "Hoje", "Ontem", "sexta-feira, setembro 11º" (igual ao ClickUp)
export function rotuloDia(iso) {
  const d = new Date(iso)
  const hoje = inicioDoDia(new Date())
  const dia = inicioDoDia(d)
  const diff = Math.round((hoje - dia) / 86400000)
  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Ontem'
  const base = `${DIAS[d.getDay()]}, ${MESES[d.getMonth()]} ${d.getDate()}º`
  return d.getFullYear() !== hoje.getFullYear() ? `${base} de ${d.getFullYear()}` : base
}

export function hora(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// "9:04" hoje, "Ontem às 10:49", "sexta-feira às 7:00", "12 ago às 9:30"
export function horaRelativa(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const hoje = inicioDoDia(new Date())
  const diff = Math.round((hoje - inicioDoDia(d)) / 86400000)
  const h = hora(iso)
  if (diff === 0) return h
  if (diff === 1) return `Ontem às ${h}`
  if (diff < 7) return `${DIAS[d.getDay()]} às ${h}`
  return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)} às ${h}`
}

export function ultimaResposta(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const diff = Math.round((inicioDoDia(new Date()) - inicioDoDia(d)) / 86400000)
  if (diff === 0) return `hoje às ${hora(iso)}`
  if (diff === 1) return `ontem às ${hora(iso)}`
  return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)} às ${hora(iso)}`
}

// Extrai ids mencionados no texto (@Nome_Sobrenome) a partir dos membros
export function extrairMencoes(texto, candidatos) {
  const ids = []
  for (const m of texto.matchAll(/@([\p{L}\p{N}_.]+)/gu)) {
    const achado = candidatos.find((c) => slugDe(c.name) === m[1])
    if (achado && !ids.includes(achado.id)) ids.push(achado.id)
  }
  return ids
}

// Troca @Nome_Sobrenome por link markdown especial [@Nome Sobrenome](mention:uuid)
// para o renderizador destacar a menção.
export function prepararMarkdown(texto, membros) {
  if (!texto) return ''
  if (!texto.includes('@')) return texto
  const porSlug = new Map(membros.map((m) => [slugDe(m.name), m]))
  return texto.replace(/(^|[^\w[])@([\p{L}\p{N}_.]+)/gu, (tudo, antes, slug) => {
    let s = slug
    // pontuação final não faz parte do nome
    let sufixo = ''
    while (s.length && /[.,;:!?]/.test(s[s.length - 1])) { sufixo = s[s.length - 1] + sufixo; s = s.slice(0, -1) }
    const m = porSlug.get(s)
    if (!m) return tudo
    return `${antes}[@${m.name}](mention:${m.id})${sufixo}`
  })
}

// Mesmo texto, sem markdown (prévia na sidebar / notificações)
export function textoPlano(texto = '') {
  return texto
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
