// Preview de DESENVOLVIMENTO do módulo Atividades, sem login.
// Rota /dev/atividades (registrada só quando import.meta.env.DEV).
//
// Injeta um AppContext fake (usuário admin, projetos, time, squads) e responde
// às chamadas de /api/atividades localmente, rodando o motor de agenda sobre
// tarefas reais do ClickUp gravadas em src/dev/fixtures/atividades.json
// (gerado por script, gitignored). Serve para iterar no visual do módulo com
// dados de verdade sem depender do Supabase Auth nem do vercel dev.
import { useEffect, useState } from 'react'
import { AppContext } from '../context/AppContext'
import Atividades from '../pages/Atividades'
import { supabase } from '../lib/supabase'
// O motor mora em api/, e o vercel dev sequestra qualquer URL /api/*; o plugin
// em vite.config.js entrega o mesmo arquivo como módulo virtual.
import { DEFAULT_CONFIG, planejarParaPessoa, resumirConcluida, hojeISO } from 'virtual:atividades-engine'

function mergeConfig(stored) {
  return {
    ...DEFAULT_CONFIG,
    ...(stored || {}),
    horas_por_tipo: { ...DEFAULT_CONFIG.horas_por_tipo, ...(stored?.horas_por_tipo || {}) },
    horas_por_dificuldade: { ...DEFAULT_CONFIG.horas_por_dificuldade, ...(stored?.horas_por_dificuldade || {}) },
    capacidade_por_pessoa: { ...(stored?.capacidade_por_pessoa || {}) },
  }
}

// Responde às actions da API com o motor rodando no browser.
function makeMock(fx) {
  const config = mergeConfig(fx.config)
  const historico = [...(fx.historico || [])]
  return async (action, payload = {}) => {
    await new Promise((r) => setTimeout(r, 250)) // latência de mentira, pra ver os loadings
    if (action === 'config') return { config }
    if (action === 'listas') {
      const listas = fx.listas?.[String(payload.folderId)] || fx.listas?.['90133132396'] || []
      return { listas }
    }
    if (action === 'sugerir' || action === 'carga') {
      const hoje = hojeISO()
      const ids = (payload.assignees || []).map(Number)
      const resumoCfg = { capacidade_padrao_horas_dia: config.capacidade_padrao_horas_dia, dias_atraso_maximo: config.dias_atraso_maximo, horizonte_dias_uteis: config.horizonte_dias_uteis }
      const pessoas = []
      const erros = []
      for (const id of ids) {
        const tasks = fx.tasksByAssignee?.[String(id)]
        if (!tasks) { erros.push({ clickupUserId: id, error: 'Pessoa fora da fixture', code: null }); continue }
        pessoas.push(planejarParaPessoa({
          clickupUserId: id,
          tasks,
          horas: action === 'carga' ? null : (payload.horas ?? null),
          naoAntesDe: payload.naoAntesDe || null,
          dataDesejada: payload.dataDesejada || null,
          config,
          hoje,
        }))
      }
      if (action === 'carga') return { hoje, geradoEm: new Date().toISOString(), pessoas, erros, config: resumoCfg }
      return { hoje, geradoEm: new Date().toISOString(), resultados: pessoas, erros, config: resumoCfg }
    }
    if (action === 'concluidas') {
      // fixture concluidas.json (tarefas fechadas nos últimos 7 dias, raw do ClickUp)
      const raw = fx.concluidas?.tasks || []
      const tarefas = raw.map((t) => resumirConcluida(t, config))
        .filter((t) => t && t.dia && t.dia >= payload.desde && t.dia <= payload.ate)
        .sort((a, b) => (b.concluidaEm || '').localeCompare(a.concluidaEm || ''))
      return { hoje: hojeISO(), desde: payload.desde, ate: payload.ate, geradoEm: new Date().toISOString(), total: tarefas.length, truncado: false, tarefas }
    }
    if (action === 'estimar') {
      for (const lista of Object.values(fx.tasksByAssignee || {})) {
        const t = lista.find((x) => x.id === payload.taskId)
        if (t) t.time_estimate = Math.round(Number(payload.horas) * 3600000)
      }
      return { ok: true, taskId: payload.taskId, horas: Number(payload.horas) }
    }
    if (action === 'criar') {
      const id = 'dev' + Math.random().toString(36).slice(2, 8)
      const registro = {
        id: crypto.randomUUID(), project_id: payload.projectId, titulo: payload.titulo, tipo_tarefa: payload.tipoTarefa,
        responsavel_profile_id: payload.responsavelProfileId, horas_estimadas: payload.horas, prioridade: payload.prioridade,
        data_sugerida: payload.dataSugerida, data_escolhida: payload.dataEscolhida, sobrecarga: !!payload.sobrecarga,
        clickup_task_url: `https://app.clickup.com/t/${id}`, aviso: null, created_at: new Date().toISOString(),
      }
      historico.unshift(registro)
      return { taskId: id, url: registro.clickup_task_url, aviso: null, registro }
    }
    throw new Error(`mock: ação ${action} não suportada`)
  }
}

// Stub mínimo do supabase.from() para as tabelas que a página lê direto.
function patchSupabase(fx, getHistorico) {
  if (!supabase) return () => {}
  const original = supabase.from.bind(supabase)
  supabase.from = (table) => {
    if (table !== 'atividades_planejadas' && table !== 'atividades_config') return original(table)
    const rows = () => (table === 'atividades_config' ? [{ config: fx.config }] : getHistorico())
    const chain = {
      select: () => chain, order: () => chain, limit: () => chain, eq: () => chain,
      maybeSingle: async () => ({ data: rows()[0] || null, error: null }),
      upsert: async () => ({ error: null }),
      then: (res) => Promise.resolve({ data: rows(), error: null }).then(res),
    }
    return chain
  }
  return () => { supabase.from = original }
}

export default function AtividadesPreview() {
  const [fx, setFx] = useState(null)
  const [erro, setErro] = useState(null)

  // O mock e o patch entram ANTES de setFx: os efeitos da página (que já
  // leem histórico e config) rodam antes dos efeitos deste componente pai.
  useEffect(() => {
    let restore = () => {}
    let cancelado = false
    Promise.all([
      fetch('/src/dev/fixtures/atividades.json').then((r) => { if (!r.ok) throw new Error(`fixture ${r.status}`); return r.json() }),
      // opcional: sem ela o relatório de concluídas fica vazio
      fetch('/src/dev/fixtures/concluidas.json').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([data, concluidas]) => {
        if (cancelado) return
        data.concluidas = concluidas
        window.__atividadesMock = makeMock(data)
        restore = patchSupabase(data, () => data.historico || [])
        setFx(data)
      })
      .catch((e) => { if (!cancelado) setErro(`Sem fixture: ${e.message}. Gere com o script gen_fixtures.mjs (ver CLAUDE.md).`) })
    return () => { cancelado = true; delete window.__atividadesMock; restore() }
  }, [])

  if (erro) return <div className="p-8 text-sm text-red-400">{erro}</div>
  if (!fx) return <div className="p-8 text-sm text-rl-muted">Carregando fixture…</div>

  const teamMembers = (fx.profiles || []).map((p) => ({ ...p, clickupUserId: p.clickup_user_id }))
  const projects = (fx.projects || []).map((p) => ({
    id: p.id, companyName: p.company_name, company_name: p.company_name,
    clickupFolderId: p.clickup_folder_id, clickupListId: p.clickup_list_id, squad: p.squad, status: p.status,
  }))
  const admin = teamMembers.find((m) => m.role === 'admin') || teamMembers[0]
  const value = {
    user: { id: admin?.id, email: admin?.email, name: admin?.name || 'Dev', avatar: admin?.avatar || 'DV', role: 'admin' },
    login: async () => {}, logout: () => {}, loginWithGoogle: async () => {},
    loadingAuth: false, authError: null,
    projects, squads: fx.squads || [], teamMembers,
    loadingProjects: false, isSupabaseReady: true,
    addProject: async () => {}, updateProject: async () => {}, deleteProject: async () => {},
    addSquad: async () => {}, updateSquad: async () => {}, deleteSquad: async () => {},
    tasks: [], loadingTasks: false, addTask: async () => {}, updateTask: async () => {}, deleteTask: async () => {},
  }
  return (
    <AppContext.Provider value={value}>
      <Atividades />
    </AppContext.Provider>
  )
}
