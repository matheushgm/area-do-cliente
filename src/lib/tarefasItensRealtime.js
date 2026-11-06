// Canal realtime de `tarefas_itens` compartilhado pelo módulo Atividades. A Capacidade do time e
// os dois relatórios de concluídas (aba e painel da pessoa) podem estar abertos ao mesmo tempo:
// todos ouvem o mesmo canal, criado no primeiro assinante e removido quando sai o último.
import { supabase } from './supabase'

const assinantes = new Set()
let canal = null
let conectouAntes = false

function avisar(metodo, valor) {
  for (const a of assinantes) {
    try { a[metodo]?.(valor) } catch (e) { console.warn('[Atividades] realtime:', e) }
  }
}

/**
 * @param {object} p
 * @param {(evento: {eventType: string, new: object, old: object}) => void} p.aoMudar
 * @param {() => void} [p.aoReconectar]  o realtime não reenvia o que passou com a conexão fora
 * @returns {() => void} cancela a assinatura
 */
export function assinarTarefasItens({ aoMudar, aoReconectar }) {
  const assinante = { aoMudar, aoReconectar }
  assinantes.add(assinante)
  if (!canal) {
    conectouAntes = false
    canal = supabase
      .channel('atividades-tarefas-itens')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tarefas_itens' }, (evento) => avisar('aoMudar', evento))
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return
        if (conectouAntes) avisar('aoReconectar')
        conectouAntes = true
      })
  }
  return () => {
    assinantes.delete(assinante)
    if (assinantes.size === 0 && canal) {
      supabase.removeChannel(canal)
      canal = null
    }
  }
}
