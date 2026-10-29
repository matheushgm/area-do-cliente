// Template ainda não salvo ("Novo template", "Salvar como template" de uma tarefa,
// "Duplicar"): fica aqui até o Salvar do construtor, que é o único que grava em
// tarefas_modelos. Abre em /tarefas?aba=templates&template=novo. Mora no
// sessionStorage para sobreviver a um F5 e para a aba Tarefas da página do cliente
// conseguir mandar o rascunho para o /tarefas; sem storage, fica só na memória.

export const ID_RASCUNHO_TEMPLATE = 'novo'
const CHAVE = 'tarefas.rascunhoTemplate'
let memoria = null

export function guardarRascunhoTemplate({ nome = 'Novo template', descricao = null, itens = [] } = {}) {
  // `chave` muda a cada rascunho novo: o construtor remonta mesmo com a mesma URL
  memoria = { nome, descricao, itens, chave: Date.now() }
  try { sessionStorage.setItem(CHAVE, JSON.stringify(memoria)) } catch { /* sem storage: fica na memória */ }
  return memoria
}

export function lerRascunhoTemplate() {
  try {
    const s = sessionStorage.getItem(CHAVE)
    if (s) return JSON.parse(s)
  } catch { /* storage bloqueado ou JSON quebrado */ }
  return memoria
}

export function limparRascunhoTemplate() {
  memoria = null
  try { sessionStorage.removeItem(CHAVE) } catch { /* sem storage */ }
}

export const urlRascunhoTemplate = () => `/tarefas?aba=templates&template=${ID_RASCUNHO_TEMPLATE}`
