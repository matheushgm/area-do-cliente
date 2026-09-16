// Preview de DESENVOLVIMENTO do módulo Tarefas, sem login.
// Rota /dev/tarefas (só quando import.meta.env.DEV). Injeta um AppContext
// fake e um hook de dados que roda sobre src/dev/fixtures/tarefas.json
// (dados reais exportados do Supabase, gitignored), com estado em memória.
import { useState, useEffect, useMemo, useCallback } from 'react'
import { AppContext } from '../context/AppContext'
import Tarefas from '../pages/Tarefas'
import { STATUSES_PADRAO, statusDaLista, statusInicial } from '../lib/tarefas'

let FX = null

function useTarefasFixture(user) {
  const [pastas, setPastas] = useState(FX.pastas)
  const [listas, setListas] = useState(FX.listas)
  const [itens, setItens] = useState(() => Object.fromEntries(FX.itens.map((i) => [i.id, i])))
  const [comentarios, setComentarios] = useState(() => {
    const m = {}
    for (const c of FX.comentarios) (m[c.tarefa_id] = m[c.tarefa_id] || []).push(c)
    return m
  })
  const listasMap = useMemo(() => new Map(listas.map((l) => [l.id, l])), [listas])
  const pastasMap = useMemo(() => new Map(pastas.map((p) => [p.id, p])), [pastas])
  const noop = useCallback(async () => {}, [])
  const criarTarefa = useCallback(async (payload) => {
    const lista = listasMap.get(payload.lista_id)
    const statuses = lista ? statusDaLista(lista) : STATUSES_PADRAO
    const st = (payload.status && statuses.find((s) => s.key === payload.status)) || statusInicial(statuses)
    const row = {
      id: crypto.randomUUID(), lista_id: payload.lista_id, parent_id: payload.parent_id || null, titulo: payload.titulo,
      descricao: null, status: st.key, status_tipo: st.tipo, prioridade: null, responsaveis: [], responsaveis_extra: [],
      data_inicio: null, data_vencimento: null, data_conclusao: null, estimativa_min: null, tipo_tarefa: null, dificuldade: null,
      departamento: [], campos: {}, tags: [], checklists: [], anexos: [], posicao: Date.now(), arquivada: false,
      criado_por: user?.id, criador_nome: user?.name, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
    setItens((p) => ({ ...p, [row.id]: row }))
    return { data: row }
  }, [listasMap, user])
  const atualizarTarefa = useCallback(async (id, patch) => { setItens((p) => ({ ...p, [id]: { ...p[id], ...patch } })); return { data: { id, ...patch } } }, [])
  const mudarStatus = useCallback((item, s) => atualizarTarefa(item.id, { status: s.key, status_tipo: s.tipo, data_conclusao: s.tipo === 'closed' ? new Date().toISOString() : null }), [atualizarTarefa])
  const excluirTarefa = useCallback(async (id) => { setItens((p) => { const n = { ...p }; delete n[id]; return n }); return {} }, [])
  const criarPasta = useCallback(async ({ nome }) => { const p = { id: crypto.randomUUID(), nome, project_id: null }; setPastas((x) => [...x, p]); const l = { id: crypto.randomUUID(), pasta_id: p.id, nome: 'Geral', statuses: STATUSES_PADRAO }; setListas((x) => [...x, l]); return { data: p } }, [])
  const atualizarPasta = useCallback(async (id, patch) => { setPastas((x) => x.map((p) => (p.id === id ? { ...p, ...patch } : p)).filter((p) => !p.arquivada)); return {} }, [])
  const criarLista = useCallback(async ({ pasta_id, nome }) => { const l = { id: crypto.randomUUID(), pasta_id, nome, statuses: STATUSES_PADRAO }; setListas((x) => [...x, l]); return { data: l } }, [])
  const atualizarLista = useCallback(async (id, patch) => { setListas((x) => x.map((l) => (l.id === id ? { ...l, ...patch } : l))); return {} }, [])
  const carregarComentarios = useCallback(async (id) => { setComentarios((p) => (p[id] ? p : { ...p, [id]: [] })); return [] }, [])
  const criarComentario = useCallback(async (id, texto) => { const c = { id: crypto.randomUUID(), tarefa_id: id, texto, autor_id: user?.id, autor_nome: user?.name, created_at: new Date().toISOString() }; setComentarios((p) => ({ ...p, [id]: [...(p[id] || []), c] })); return { data: c } }, [user])
  const excluirComentario = useCallback(async (id, cid) => { setComentarios((p) => ({ ...p, [id]: (p[id] || []).filter((c) => c.id !== cid) })); return {} }, [])
  return {
    pastas, listas, pastasMap, listasMap, loadingEstrutura: false, carregando: false, erro: null, itens, comentarios,
    carregarEstrutura: noop, carregarListas: noop, carregarMinhas: noop, carregarTarefa: async () => null,
    criarTarefa, atualizarTarefa, mudarStatus, excluirTarefa, criarPasta, atualizarPasta, criarLista, atualizarLista,
    carregarComentarios, criarComentario, excluirComentario,
  }
}

export default function TarefasPreview() {
  const [pronto, setPronto] = useState(false)
  const [erro, setErro] = useState(null)
  useEffect(() => {
    fetch('/src/dev/fixtures/tarefas.json').then((r) => { if (!r.ok) throw new Error(`fixture ${r.status}`); return r.json() })
      .then((d) => { FX = d; setPronto(true) })
      .catch((e) => setErro(`Sem fixture: ${e.message}.`))
  }, [])
  if (erro) return <div className="p-8 text-sm text-red-400">{erro}</div>
  if (!pronto) return <div className="p-8 text-sm text-rl-muted">Carregando fixture…</div>
  const teamMembers = FX.perfis.map((p) => ({ ...p, clickupUserId: p.clickup_user_id }))
  const projects = FX.projetos.map((p) => ({ id: p.id, companyName: p.company_name, company_name: p.company_name, status: p.status }))
  const admin = teamMembers.find((m) => m.email === 'matheus@revenuelab.com.br') || teamMembers.find((m) => m.role === 'admin') || teamMembers[0]
  const value = {
    user: { id: admin?.id, email: admin?.email, name: admin?.name || 'Dev', avatar: admin?.avatar || 'DV', role: 'admin' },
    login: async () => {}, logout: () => {}, loginWithGoogle: async () => {}, loadingAuth: false, authError: null,
    projects, squads: [], teamMembers, loadingProjects: false, isSupabaseReady: true,
    addProject: async () => {}, updateProject: async () => {}, deleteProject: async () => {},
    addSquad: async () => {}, updateSquad: async () => {}, deleteSquad: async () => {},
    tasks: [], loadingTasks: false, addTask: async () => {}, updateTask: async () => {}, deleteTask: async () => {},
  }
  return (
    <AppContext.Provider value={value}>
      <Tarefas tarefasHook={useTarefasFixture} />
    </AppContext.Provider>
  )
}
