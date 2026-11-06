// Harness DEV (só import.meta.env.DEV): o módulo Sprints com dados em memória, sem login. A lógica é
// a mesma do app (useSprints com um `banco` falso), então dá para percorrer planejar, confirmar,
// delegar, concluir e transbordar. As RPCs reproduzem as das migrations 128 e 129.
// `?hoje=2026-11-13` simula outro dia.
import { useCallback, useMemo, useState } from 'react'
import SprintsView from '../components/Tarefas/SprintsView'
import Toast from '../components/UI/Toast'
import { useToast } from '../hooks/useToast'
import { useSprints } from '../hooks/useSprints'
import { useConfirmar } from '../components/Tarefas/Confirmacao'
import { STATUSES_PADRAO } from '../lib/tarefas'

const hojeSimulado = new URLSearchParams(window.location.search).get('hoje')
if (hojeSimulado) {
  // window.__hoje muda o dia sem recarregar (os dados são em memória e sumiriam)
  window.__hoje = hojeSimulado
  const RealDate = Date
  const alvo = () => new RealDate(`${window.__hoje}T12:00:00`).getTime()
  // eslint-disable-next-line no-global-assign
  Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [alvo()])) } static now() { return alvo() } }
}

const membros = [
  { id: 'p1', name: 'Bárbara Luiza', avatar: 'BL', clickup_user_id: 1 },
  { id: 'p2', name: 'Mario Marques', avatar: 'MM', clickup_user_id: 2 },
  { id: 'p3', name: 'André Tenório', avatar: 'AT', clickup_user_id: 3 },
  { id: 'p4', name: 'Victor Zampieri', avatar: 'VZ', clickup_user_id: 4 },
  { id: 'p5', name: 'Eduardo Moura', avatar: 'EM', clickup_user_id: 5 },
  { id: 'cli', name: 'Cliente', avatar: 'CL', clickup_user_id: 84048101 },
]
// como no banco: André e Bárbara estão nos dois squads
const squads = [
  { id: 'sq1', name: 'Caça ROI', emoji: '🏹', members: [{ profile_id: 'p4' }, { profile_id: 'p3' }, { profile_id: 'p1' }] },
  { id: 'sq2', name: 'Zero Churn', emoji: '🥶', members: [{ profile_id: 'p2' }, { profile_id: 'p1' }, { profile_id: 'p3' }] },
]
const projetos = [{ id: 'pr0', squad: 'sq1' }, { id: 'pr1', squad: 'sq1' }, { id: 'pr2', squad: 'sq2' }, { id: 'pr3', squad: 'sq2' }, { id: 'pr4', squad: 'sq1' }]
const membrosMap = new Map(membros.map((m) => [m.id, m]))
const pastas = ['Nomus', 'Grupo AJ', 'Bio Cosméticos', 'Cical Honda', 'TudoMed'].map((nome, i) => ({ id: `pa${i}`, nome, project_id: `pr${i}` }))
const listas = [
  ...pastas.map((p) => ({ id: `li-${p.id}`, nome: 'Geral', pasta_id: p.id, statuses: STATUSES_PADRAO })),
  { id: 'li-s30', nome: 'Sprint 30 (11/2 - 11/8)', pasta_id: 'pa-sprint', data_inicio: '2026-11-02T03:00:00+00:00', statuses: STATUSES_PADRAO },
]
const TIPOS = ['Criação de Arte Estática', 'Otimização', 'Relatório', 'Estratégia', 'Criar Campanha', 'Copy de anúncio', 'Reunião', null]
const NOMES = ['Subir criativos da semana', 'Relatório mensal do cliente', 'Otimizar campanha de fundo', 'Reunião de alinhamento', 'Copy dos estáticos', 'Criar campanha de remarketing', 'Ajustar LP de captura', 'Revisar públicos do Meta']

function dia(n) { const d = new Date(); d.setDate(d.getDate() + n); return `${d.toISOString().slice(0, 10)}T07:00:00+00:00` }
function gerarTarefas() {
  const m = {}
  let k = 0
  for (const p of membros.slice(0, 5)) {
    for (const off of [-30, -20, -6, -3, -1, 0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, null, null]) {
      k++
      m[`t${k}`] = {
        id: `t${k}`, titulo: `${NOMES[k % NOMES.length]} #${k}`, lista_id: listas[k % pastas.length].id, parent_id: null,
        status: k % 5 === 0 ? 'em progresso' : 'a fazer', status_tipo: 'custom', prioridade: ['urgent', 'high', 'normal', 'low', null][k % 5],
        responsaveis: [p.id], data_vencimento: off == null ? null : dia(off), estimativa_min: k % 3 === 0 ? 60 + (k % 4) * 30 : null,
        tipo_tarefa: TIPOS[k % TIPOS.length], arquivada: false,
      }
    }
  }
  for (let i = 0; i < 12; i++) {
    k++
    m[`t${k}`] = { id: `t${k}`, titulo: `Sem dono: ${NOMES[i % NOMES.length]}`, lista_id: listas[i % pastas.length].id, parent_id: null, status: 'a fazer', status_tipo: 'custom', prioridade: null, responsaveis: [], data_vencimento: i % 2 ? dia(i) : null, estimativa_min: null, tipo_tarefa: null, arquivada: false }
  }
  return m
}

const CONFIG = {
  capacidade_padrao_horas_dia: 6, capacidade_por_pessoa: {}, horas_padrao_sem_estimativa: 1, dias_uteis: [1, 2, 3, 4, 5], feriados: [], dias_atraso_maximo: 14,
  horas_por_tipo: { 'Criação de Arte Estática': 0.5, Otimização: 0.5, Relatório: 0.5, Estratégia: 2.5, 'Criar Campanha': 2, 'Copy de anúncio': 0.5, Reunião: 1 },
  horas_por_dificuldade: { Complexa: 4, Regular: 2, Baixa: 1 },
}

function criarBanco() {
  const d = { tarefas_sprints: [], tarefas_sprint_pessoas: [], tarefas_sprint_itens: [], tarefas_sprint_metas: [] }
  const uid = () => crypto.randomUUID()
  const aviso = new Set()
  const avisar = () => aviso.forEach((f) => f())
  const banco = {
    d,
    lerConfig: async () => CONFIG,
    lerSprints: async () => ({ sprints: [...d.tarefas_sprints], pessoas: [...d.tarefas_sprint_pessoas], metas: [...d.tarefas_sprint_metas] }),
    lerItens: async (ids) => d.tarefas_sprint_itens.filter((i) => ids.includes(i.sprint_id)),
    inserir: async (tab, linhas) => {
      const novos = linhas.map((l) => ({ id: uid(), created_at: new Date().toISOString(), adicionada_em: new Date().toISOString(), ...l }))
      if (tab === 'tarefas_sprints' && novos.some((n) => d[tab].some((x) => x.numero === n.numero && x.squad_id === n.squad_id))) throw Object.assign(new Error('dup'), { code: '23505' })
      d[tab].push(...novos)
      return novos
    },
    atualizar: async (tab, id, patch) => { const i = d[tab].findIndex((x) => x.id === id); d[tab][i] = { ...d[tab][i], ...patch }; return d[tab][i] },
    apagar: async (tab, id) => {
      d[tab] = d[tab].filter((x) => x.id !== id)
      if (tab === 'tarefas_sprints') {
        d.tarefas_sprint_pessoas = d.tarefas_sprint_pessoas.filter((x) => x.sprint_id !== id)
        d.tarefas_sprint_itens = d.tarefas_sprint_itens.filter((x) => x.sprint_id !== id)
        d.tarefas_sprint_metas = d.tarefas_sprint_metas.filter((x) => x.sprint_id !== id)
      }
      if (tab === 'tarefas_sprint_metas') for (const i of d.tarefas_sprint_itens) if (i.meta_id === id) i.meta_id = null
    },
    rpc: async (nome, a) => {
      if (nome === 'tarefas_sprint_confirmar') {
        for (const x of a.p_itens) { const i = d.tarefas_sprint_itens.find((y) => y.id === x.id); if (i && !i.removida_em) Object.assign(i, { min_compromisso: x.min, fora_do_plano: false }) }
        Object.assign(d.tarefas_sprint_pessoas.find((p) => p.id === a.p_pessoa), { confirmada_em: new Date().toISOString() })
      } else if (nome === 'tarefas_sprint_reabrir') {
        const p = d.tarefas_sprint_pessoas.find((x) => x.id === a.p_pessoa)
        d.tarefas_sprint_itens = d.tarefas_sprint_itens.filter((i) => !(i.sprint_id === p.sprint_id && i.pessoa_id === p.pessoa_id && i.removida_em))
        for (const i of d.tarefas_sprint_itens) if (i.sprint_id === p.sprint_id && i.pessoa_id === p.pessoa_id) Object.assign(i, { min_compromisso: null, fora_do_plano: false })
        p.confirmada_em = null
      } else if (nome === 'tarefas_sprint_concluir') {
        for (const r of a.p_resultados) Object.assign(d.tarefas_sprint_itens.find((i) => i.id === r.id), { resultado: r.resultado })
        for (const m of a.p_metas) Object.assign(d.tarefas_sprint_metas.find((x) => x.id === m.id), m)
        for (const m of a.p_novas_metas) d.tarefas_sprint_metas.push({ ...m, posicao: Date.now() / 1000, created_at: new Date().toISOString() })
        for (const n of a.p_novos) {
          const j = d.tarefas_sprint_itens.find((i) => i.sprint_id === n.sprint_id && i.pessoa_id === n.pessoa_id && i.tarefa_id === n.tarefa_id)
          if (j) Object.assign(j, { origem: 'transbordo', removida_em: null, meta_id: n.meta_id || j.meta_id })
          else d.tarefas_sprint_itens.push({ id: uid(), origem: 'transbordo', adicionada_em: new Date().toISOString(), ...n })
        }
        for (const r of a.p_pessoas) Object.assign(d.tarefas_sprint_pessoas.find((p) => p.id === r.id), r)
        Object.assign(d.tarefas_sprints.find((s) => s.id === a.p_sprint), { concluida_em: new Date().toISOString() })
      }
      avisar()
    },
    assinar: (f) => { aviso.add(f); return () => aviso.delete(f) },
  }
  return banco
}
const banco = criarBanco()
const ESTAVEL = {
  listasMap: new Map(listas.map((l) => [l.id, l])),
  pastasMap: new Map(pastas.map((p) => [p.id, p])),
  carregarAbertas: () => {},
  carregarPorIds: () => {},
}

export default function DevSprints() {
  const { toast, showToast } = useToast()
  const [confirmar, dialogo] = useConfirmar()
  const [itens, setItens] = useState(gerarTarefas)
  const [aberta, setAberta] = useState(null)
  const s = useSprints({ id: 'p1' }, { banco })
  const atualizarTarefa = useCallback(async (id, patch) => { setItens((p) => ({ ...p, [id]: { ...p[id], ...patch } })); return {} }, [])
  const mudarStatus = useCallback((item, st) => atualizarTarefa(item.id, { status: st.key, status_tipo: st.tipo || 'custom', data_conclusao: st.tipo === 'closed' ? new Date().toISOString() : null }), [atualizarTarefa])
  const criarTarefa = useCallback(async (payload) => {
    const data = { id: crypto.randomUUID(), status: 'a fazer', status_tipo: 'custom', parent_id: null, arquivada: false, ...payload }
    setItens((p) => ({ ...p, [data.id]: data }))
    return { data }
  }, [])
  const t = useMemo(() => ({ ...ESTAVEL, itens, listas, pastas, atualizarTarefa, mudarStatus, criarTarefa }), [itens, atualizarTarefa, mudarStatus, criarTarefa])
  return (
    <div className="ln vt h-screen flex flex-col bg-ln-bg">
      {dialogo}
      <div className="px-3 py-1.5 text-[11px] text-ln-t4 border-b border-ln-ink/5">/dev/sprints · dados em memória{aberta ? ` · clicou na tarefa ${aberta}` : ''}</div>
      <div className="flex-1 min-h-0">
        <SprintsView s={s} t={t} squads={squads} projetos={projetos} user={{ id: 'p1' }} membros={membros} membrosMap={membrosMap} onAbrirTarefa={setAberta} tarefaAbertaId={aberta} onToast={showToast} confirmar={confirmar} />
      </div>
      <Toast toast={toast} />
    </div>
  )
}
