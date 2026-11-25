// Menções (sino da sidebar): as notificações de quando alguém marca você com @.
// Duas categorias, cada uma com o seu `type` em `notifications` (migrations 043 e 139):
//   comentarios → 'tarefa_mencao' (comentário de tarefa do VertaTask ou vindo do ClickUp)
//   chat        → 'mention'       (mensagem ou resposta de thread no chat do VertaTask)
import { supabase } from './supabase'

export const CATEGORIAS = {
  comentarios: { tipos: ['tarefa_mencao'] },
  chat: { tipos: ['mention'] },
}
export const TIPOS_MENCAO = Object.values(CATEGORIAS).flatMap((c) => c.tipos)

export const categoriaDoTipo = (tipo) =>
  Object.keys(CATEGORIAS).find((k) => CATEGORIAS[k].tipos.includes(tipo)) || null

// Avisa o sino (e outras abas da mesma tela) que algo foi lido aqui, sem esperar o realtime.
export const EVENTO_MENCOES = 'mencoes-mudaram'
export function avisarMencoes() {
  try { window.dispatchEvent(new Event(EVENTO_MENCOES)) } catch { /* sem window (teste em Node) */ }
}

/**
 * Marca menções como lidas. Uma das chaves:
 *   { ids }       as notificações clicadas
 *   { categoria } todas as não lidas da categoria ("Marcar todas como lidas")
 *   { canalId }   as do chat daquele canal (abrir o canal = ver as menções)
 *   { tarefaId }  as dos comentários daquela tarefa (abrir a tarefa = ver os comentários)
 * A RLS de `notifications` só deixa mexer nas da própria pessoa.
 */
export async function marcarMencoesLidas({ ids, categoria, canalId, tarefaId } = {}) {
  if (!supabase) return
  let q = supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
  if (ids?.length) q = q.in('id', ids)
  else if (categoria) q = q.in('type', CATEGORIAS[categoria].tipos)
  else if (canalId) q = q.eq('type', 'mention').eq('data->>channel_id', canalId)
  else if (tarefaId) q = q.eq('type', 'tarefa_mencao').eq('data->>tarefa_id', tarefaId)
  else return
  const { error } = await q
  if (error) console.error('[menções]', error)
  else avisarMencoes()
}

// Texto da menção para a lista: @Nome_Sobrenome vira @Nome Sobrenome e o markdown sai
// (negrito, itálico, links, títulos, listas), numa linha só.
export function resumoDaMencao(texto = '') {
  return String(texto || '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(^|\s)@([\p{L}\p{N}.]+(?:_[\p{L}\p{N}.]+)+)/gu, (_, antes, slug) => `${antes}@${slug.replace(/_/g, ' ')}`)
    .replace(/[*_`~]+/g, '')
    .replace(/^\s*(#{1,6}|[-+>]|\d+\.)\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Destaque das menções num texto markdown que vai para o MarkdownView (comentário de tarefa):
// @Nome_Sobrenome de quem é do time vira **@Nome Sobrenome**.
export function destacarMencoes(texto, membros = []) {
  if (!texto || !texto.includes('@') || !membros.length) return texto
  const porSlug = new Map(membros.map((m) => [m.name?.trim().replace(/\s+/g, '_'), m]))
  return texto.replace(/(^|[^\w[*])@([\p{L}\p{N}_.]+)/gu, (tudo, antes, bruto) => {
    let slug = bruto
    let sufixo = ''
    while (slug && /[.,;:!?]$/.test(slug)) { sufixo = slug.slice(-1) + sufixo; slug = slug.slice(0, -1) }
    const m = porSlug.get(slug)
    return m ? `${antes}**@${m.name}**${sufixo}` : tudo
  })
}
