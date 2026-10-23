// PROTÓTIPO TEMPORÁRIO (só em DEV): views da pasta do cliente com a hierarquia do
// ClickUp. Linha 1 = abas (as 5 padrão + as salvas) e "+ Visualização"; linha 2 =
// agrupador e modo das subtarefas à esquerda e, à direita, Salvar visualização (botão
// dividido), busca, responsáveis, concluídas, configurações (sidebar) e "+ Tarefa ▾".
// Toda view tem um rascunho: mexer pela barra muda a tela na hora e acende o "Salvar
// visualização", que salva, salva como nova ou reverte; pela sidebar a mudança já fica
// salva. As 5 padrão são editáveis por qualquer pessoa, mas não podem ser excluídas; as
// salvas, só por quem criou.
// Filtros (ícone de funil, sidebar própria): campos com operador conforme o tipo, regras
// ligadas por E/OU dentro de grupos e grupos ligados por E/OU; salvos na visualização (como
// rascunho, igual à barra) e somados (E) com os filtros da barra.
// Subtarefas (como no ClickUp): Recolhidas (padrão) e Expandidas ficam sob o pai, e os
// filtros e o agrupamento olham só o pai; Separar trata cada subtarefa como uma tarefa
// (filtrada e agrupada pelos próprios campos, com "↳ pai" ao lado do título).
// Tudo em memória, nada grava no banco. Apagar este arquivo e a rota
// /dev/prototipo-views em appRoutes.jsx quando a versão definitiva entrar.
import { createElement, useEffect, useRef, useState } from 'react'
import {
  List, KanbanSquare, CalendarDays, Table2, GanttChart, Plus, EyeOff, Globe, Copy, Trash2, Check, X,
  Search, Layers, Users, CircleCheck, Settings, FlaskConical, Folder, ChevronDown, ChevronUp,
  Undo2, CopyPlus, Lock, ListTree, CornerDownRight, Lightbulb, ListFilter, Flag,
} from 'lucide-react'
import ListaView from '../components/Tarefas/ListaView'
import ModelosMenu from '../components/Tarefas/ModelosMenu'
import { Popover, FOCO } from '../components/Tarefas/Campos'
import { DataInput } from '../components/Tarefas/Calendario'
import { agruparItens, filtrarItens, statusDasListas, AGRUPAMENTOS, STATUSES_PADRAO, PRIORIDADES, TIPOS_TAREFA, DIFICULDADES, DEPARTAMENTOS } from '../lib/tarefas'

const fixtures = import.meta.glob('../dev/fixtures/tarefas.json', { eager: true, import: 'default' })
const fixture = fixtures['../dev/fixtures/tarefas.json'] || { pastas: [], listas: [], itens: [], perfis: [], projetos: [] }

const TIPOS = [
  { key: 'lista', label: 'Lista', icon: List },
  { key: 'quadro', label: 'Quadro', icon: KanbanSquare },
  { key: 'calendario', label: 'Calendário', icon: CalendarDays },
  { key: 'planilha', label: 'Planilha', icon: Table2 },
  { key: 'gantt', label: 'Gantt', icon: GanttChart },
]
const SUBTAREFAS = [
  { key: 'recolhidas', label: 'Recolhidas', extra: '(padrão)', desc: 'Sob a tarefa-pai, fechadas. Filtros e agrupamento olham só o pai.' },
  { key: 'expandidas', label: 'Expandidas', desc: 'Sob a tarefa-pai, já abertas. Filtros e agrupamento olham só o pai.' },
  { key: 'separar', label: 'Separar', desc: 'Cada subtarefa vira uma linha própria, filtrada e agrupada pelos campos dela. Use para filtrar subtarefas.' },
]
const iconeDe = (tipo) => TIPOS.find((t) => t.key === tipo)?.icon || List
const rotuloTipo = (tipo) => TIPOS.find((t) => t.key === tipo)?.label || tipo
const rotuloAgrupar = (v) => AGRUPAMENTOS.find((a) => a.value === v)?.label || v
const rotuloSub = (v) => SUBTAREFAS.find((s) => s.key === v)?.label || v
// config = o que a view guarda e o que o rascunho edita
const mesmos = (a, b) => a.length === b.length && a.every((x) => b.includes(x))
const igual = (a, b) => a.tipo === b.tipo && a.agrupar === b.agrupar && a.subtarefas === b.subtarefas && mesmos(a.responsaveis, b.responsaveis) && a.concluidas === b.concluidas && JSON.stringify(a.filtros) === JSON.stringify(b.filtros)
const CONFIG = { tipo: 'lista', agrupar: 'vencimento', subtarefas: 'recolhidas', responsaveis: [], concluidas: false, filtros: { op: 'e', grupos: [] } }
// Exemplo da imagem do ClickUp: (Prioridade é Urgente/Alta E Status é A fazer) OU (Vencimento é Ontem)
const FILTROS_EXEMPLO = { op: 'ou', grupos: [
  { id: 'g1', op: 'e', regras: [{ id: 'r1', campo: 'prioridade', operador: 'e', valor: ['urgent', 'high'] }, { id: 'r2', campo: 'status', operador: 'e', valor: ['a fazer'] }] },
  { id: 'g2', op: 'e', regras: [{ id: 'r3', campo: 'vencimento', operador: 'e', valor: 'ontem' }] },
] }
// Templates de exemplo para o menu da seta do "+ Tarefa"
const MODELOS = [
  { id: 'm1', nome: 'Criação de Landing Page', itens: [{ id: 'a', titulo: 'Briefing', subtarefas: [{ id: 'a1', titulo: 'Coletar referências' }] }, { id: 'b', titulo: 'Layout' }, { id: 'c', titulo: 'Desenvolvimento' }, { id: 'd', titulo: 'Publicação' }] },
  { id: 'm2', nome: 'Onboarding de cliente', itens: [{ id: 'a', titulo: 'Kickoff' }, { id: 'b', titulo: 'Acessos' }, { id: 'c', titulo: 'Raio-X' }] },
  { id: 'm3', nome: 'Subida de campanha Meta', itens: [{ id: 'a', titulo: 'Criativos' }, { id: 'b', titulo: 'Configurar campanha' }] },
]
const EU = 'p-eu' // no protótipo "você" é o dono das views abaixo

// ── Dados de exemplo: casos que mostram a diferença entre os três modos ──────────
const dia = (n) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(12, 0, 0, 0); return d.toISOString() }
function pessoasExemplo(membros) {
  const achar = (re, nome) => membros.find((m) => re.test(m.name)) || { id: `x-${nome}`, name: nome }
  return { andre: achar(/andr/i, 'André Tenório'), barbara: achar(/b[aá]rbara/i, 'Bárbara Luiza'), cliente: achar(/^cliente/i, 'Cliente') }
}
function montarExemplos({ andre, barbara, cliente }) {
  const t = (id, titulo, resp, venc, extra = {}) => ({
    id, titulo, lista_id: 'ex-geral', parent_id: null, status: 'a fazer', status_tipo: 'custom', responsaveis: [resp.id], responsaveis_extra: [],
    data_vencimento: dia(venc), created_at: dia(-10), prioridade: 'normal', tipo_tarefa: null, etiquetas: [], checklists: [], ...extra,
  })
  const feito = { status: 'complete', status_tipo: 'closed' }
  return [
    // Caso 1: pai da Bárbara com subtarefa ATRASADA do André e uma do Cliente
    t('lp', 'Criar landing page', barbara, 5, { tipo_tarefa: 'Criação de Landing Page', prioridade: 'high', departamento: ['Web Designer'], estimativa_min: 240, data_inicio: dia(-2) }),
    t('lp-1', 'Briefing da LP', andre, -1, { parent_id: 'lp', departamento: ['Account Manager'], estimativa_min: 60 }),
    t('lp-2', 'Layout desktop + mobile', barbara, 3, { parent_id: 'lp', departamento: ['Web Designer'], estimativa_min: 480 }),
    t('lp-3', 'Aprovar layout', cliente, 4, { parent_id: 'lp', departamento: ['Cliente'] }),
    t('lp-4', 'Coletar referências', barbara, -3, { parent_id: 'lp', ...feito }),
    // Caso 2: pai do André com subtarefa de outra pessoa
    t('meta', 'Subir campanha Meta', andre, 0, { tipo_tarefa: 'Criar Campanha', prioridade: 'urgent', departamento: ['Gestor de tráfego'], estimativa_min: 120, data_inicio: dia(-1) }),
    t('meta-1', 'Criativos da campanha', barbara, 1, { parent_id: 'meta', departamento: ['Designer'], estimativa_min: 180 }),
    t('meta-2', 'Configurar pixel', andre, -2, { parent_id: 'meta', departamento: ['Gestor de tráfego'], estimativa_min: 30, prioridade: 'high' }),
    // Caso 3: pai do Cliente com subtarefa do André que vence hoje
    t('copy', 'Revisar copy dos anúncios', cliente, 7, { departamento: ['Copywriter', 'Cliente'], estimativa_min: 90 }),
    t('copy-1', 'Ajustar headline', andre, 0, { parent_id: 'copy', departamento: ['Copywriter'] }),
    // Caso 4: tarefa sem subtarefas e uma concluída
    t('rel', 'Relatório semanal', andre, 2, { tipo_tarefa: 'Relatório', departamento: ['Account Manager'], estimativa_min: 60 }),
    t('kick', 'Kickoff com o cliente', andre, -6, feito),
  ]
}
const CENARIOS = [
  { id: 'c1', titulo: 'Filtrar André · Recolhidas', patch: { subtarefas: 'recolhidas', agrupar: 'vencimento', concluidas: false }, resp: 'andre',
    explica: 'Só aparecem as tarefas-pai do André (Subir campanha Meta, Relatório semanal). "Briefing da LP" e "Ajustar headline" são do André, mas ficam escondidas porque o pai é de outra pessoa: o filtro olha só o pai.' },
  { id: 'c2', titulo: 'Filtrar André · Expandidas', patch: { subtarefas: 'expandidas', agrupar: 'vencimento', concluidas: false }, resp: 'andre',
    explica: 'Os mesmos pais, já abertos. Em "Subir campanha Meta" aparece também "Criativos da campanha", que é da Bárbara: o filtro não se aplica a subtarefas.' },
  { id: 'c3', titulo: 'Filtrar André · Separar', patch: { subtarefas: 'separar', agrupar: 'vencimento', concluidas: false }, resp: 'andre',
    explica: 'Tudo que é do André, tarefa ou subtarefa: aparecem "Briefing da LP ↳ Criar landing page" (em atraso), "Configurar pixel" e "Ajustar headline". "Criativos da campanha" (Bárbara) sai.' },
  { id: 'c4', titulo: 'Agrupar por vencimento · Recolhidas × Separar', patch: { subtarefas: 'separar', agrupar: 'vencimento', concluidas: false }, resp: null,
    explica: 'Em Separar, "Briefing da LP" cai em "Em atraso" pela data dela, enquanto o pai "Criar landing page" fica no grupo da data dele. Troque para Recolhidas no chip ao lado do agrupador: a subtarefa volta para baixo do pai, no grupo do pai.' },
  { id: 'c5', titulo: 'Agrupar por responsável · Separar', patch: { subtarefas: 'separar', agrupar: 'responsavel', concluidas: false }, resp: null,
    explica: 'Cada pessoa vê o que é dela: "Aprovar layout" vai para o grupo do Cliente, mesmo estando dentro de uma tarefa da Bárbara.' },
  { id: 'c6', titulo: 'Concluídas', patch: { subtarefas: 'expandidas', agrupar: 'status', concluidas: false }, resp: null,
    explica: 'Com as concluídas escondidas, some "Coletar referências" (subtarefa concluída) e o contador ↳ continua contando todas. Ligue o ícone de concluídas na barra para ver as duas concluídas voltarem.' },
  { id: 'c7', titulo: 'Filtros agrupados (E/OU)', patch: { subtarefas: 'separar', agrupar: 'vencimento', concluidas: false, filtros: FILTROS_EXEMPLO }, resp: null, painel: 'filtros',
    explica: '(Prioridade é Urgente/Alta E Status é A fazer) OU (Vencimento é Ontem). Em Separar entram "Criar landing page" e "Subir campanha Meta" pelo 1º grupo, "Configurar pixel" também (alta, a fazer) e "Briefing da LP" pelo 2º. Troque o OU de fora por E: nada passa nos dois grupos ao mesmo tempo.' },
  { id: 'c8', titulo: 'Filtros + barra (somam)', patch: { subtarefas: 'separar', agrupar: 'vencimento', concluidas: false, filtros: FILTROS_EXEMPLO }, resp: 'andre', painel: 'filtros',
    explica: 'Os mesmos filtros da sidebar E o responsável André escolhido na barra: sobram só as do André ("Subir campanha Meta", "Configurar pixel" e "Briefing da LP"). O topo da sidebar mostra o que veio da barra.' },
]

export default function DevPrototipoViews() {
  const pastaFx = fixture.pastas.find((p) => /revenue lab/i.test(p.nome)) || fixture.pastas[0] || { id: null, nome: 'Revenue Lab' }
  const listasFx = fixture.listas.filter((l) => l.pasta_id === pastaFx.id)
  const membros = fixture.perfis.length ? fixture.perfis.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar })) : []
  const pessoas = pessoasExemplo(membros)
  const membrosTodos = [...membros, ...Object.values(pessoas).filter((p) => !membros.some((m) => m.id === p.id))]
  const membrosMap = new Map(membrosTodos.map((m) => [m.id, m]))
  // responsaveis = [] significa todos; com gente, mostra quem é de qualquer um deles
  const nomesDe = (ids) => (ids.length ? ids.map((id) => membrosMap.get(id)?.name || '—').join(', ') : 'Todos')

  const [fonte, setFonte] = useState('exemplos') // 'exemplos' | 'fixture'
  const [cenario, setCenario] = useState(null)
  const [views, setViews] = useState(() => [
    ...TIPOS.map((t) => ({ id: `padrao-${t.key}`, nome: t.label, padrao: true, acesso: 'publica', dono: null, config: { ...CONFIG, tipo: t.key, agrupar: t.key === 'lista' ? 'vencimento' : 'status' } })),
    { id: 'v1', nome: 'Tudo do André', acesso: 'publica', dono: EU, config: { ...CONFIG, subtarefas: 'separar', responsaveis: [pessoas.andre.id] } },
    { id: 'v2', nome: 'Criativos da semana', acesso: 'privada', dono: EU, config: { ...CONFIG, tipo: 'quadro', agrupar: 'status' } },
    { id: 'v4', nome: 'Urgentes ou de ontem', acesso: 'publica', dono: EU, config: { ...CONFIG, subtarefas: 'separar', filtros: FILTROS_EXEMPLO } },
    { id: 'v3', nome: 'Por responsável', acesso: 'publica', dono: 'outra-pessoa', config: { ...CONFIG, agrupar: 'responsavel', subtarefas: 'separar', concluidas: true } },
  ])
  const [ativaId, setAtivaId] = useState('padrao-lista')
  const ativa = views.find((v) => v.id === ativaId) || views[0]
  const [rascunho, setRascunho] = useState(ativa.config)
  const [busca, setBusca] = useState('')
  const [painel, setPainel] = useState(null) // null | 'config' | 'nova'
  const [aviso, setAviso] = useState('')

  const podeEditar = ativa.padrao || ativa.dono === EU
  const alterada = !igual(ativa.config, rascunho)
  const avisar = (txt) => { setAviso(txt); setTimeout(() => setAviso(''), 2200) }
  const mudarView = (id, patch) => setViews((p) => p.map((v) => (v.id === id ? { ...v, ...patch } : v)))

  function abrir(v) { setAtivaId(v.id); setRascunho(v.config); setCenario(null); if (painel === 'nova') setPainel(null) }
  // Mexer no rascunho muda só a tela; vale para todos depois de salvar
  const editar = (patch) => setRascunho((r) => ({ ...r, ...patch }))
  // Pela sidebar a mudança já vale: grava na view (levando junto o que estava pendente na barra)
  function editarNaSidebar(patch) {
    const novo = { ...rascunho, ...patch }
    setRascunho(novo)
    if (podeEditar) mudarView(ativa.id, { config: novo })
  }
  function salvar() { if (!podeEditar || !alterada) return; mudarView(ativa.id, { config: rascunho }); avisar(`"${ativa.nome}" salva`) }
  function reverter() { setRascunho(ativa.config); avisar('Alterações revertidas') }
  function criar({ nome, publica }) {
    const v = { id: `v${Date.now()}`, nome, acesso: publica ? 'publica' : 'privada', dono: EU, config: rascunho }
    setViews((p) => [...p, v]); setAtivaId(v.id); setRascunho(v.config); setPainel('config'); avisar(`Visualização "${nome}" criada`)
  }
  function duplicar() {
    const c = { ...ativa, id: `v${Date.now()}`, nome: `${ativa.nome} (cópia)`, padrao: false, dono: EU, acesso: 'publica', config: rascunho }
    setViews((p) => [...p, c]); setAtivaId(c.id); setRascunho(c.config); avisar('Visualização duplicada')
  }
  function excluir() { setViews((p) => p.filter((x) => x.id !== ativa.id)); setPainel(null); abrir(views[0]); avisar('Visualização excluída') }
  function aplicarCenario(c) {
    setFonte('exemplos'); setBusca(''); setCenario(c.id)
    const lista = views.find((v) => v.id === 'padrao-lista')
    setAtivaId(lista.id)
    setRascunho({ ...lista.config, filtros: CONFIG.filtros, ...c.patch, tipo: 'lista', responsaveis: c.resp ? [pessoas[c.resp].id] : [] })
    setPainel(c.painel || null)
  }

  // Ctrl+Enter salva, como no ClickUp
  useEffect(() => {
    const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); salvar() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ── Itens: exemplos (casos) ou a pasta da fixture ──
  const exemplos = fonte === 'exemplos'
  const itens = exemplos ? montarExemplos(pessoas) : fixture.itens.filter((i) => listasFx.some((l) => l.id === i.lista_id) && !i.arquivada)
  const itensMap = Object.fromEntries(itens.map((i) => [i.id, i]))
  const statuses = exemplos ? STATUSES_PADRAO : statusDasListas(listasFx)
  const passa = (it) => !rascunho.responsaveis.length || rascunho.responsaveis.some((id) => (it.responsaveis || []).includes(id))
  const separar = rascunho.subtarefas === 'separar'
  // Recolhidas/Expandidas: filtra e agrupa só os pais; as subtarefas vêm junto do pai.
  // Separar: cada tarefa e subtarefa é avaliada e agrupada sozinha, sem hierarquia.
  const base = separar ? itens : itens.filter((i) => !i.parent_id)
  // filtros da barra (busca, responsáveis, concluídas) E filtros avançados da sidebar
  const visiveis = filtrarItens(base, { busca, mostrarConcluidas: rascunho.concluidas }).filter(passa).filter((it) => passaFiltros(it, rascunho.filtros))
  const nFiltros = contarRegras(rascunho.filtros)
  const filtrosAlterados = JSON.stringify(rascunho.filtros) !== JSON.stringify(ativa.config.filtros)
  const barra = [
    rascunho.responsaveis.length && `Responsáveis: ${nomesDe(rascunho.responsaveis)}`,
    !rascunho.concluidas && 'Sem concluídas',
    busca.trim() && `Nome contém “${busca.trim()}”`,
  ].filter(Boolean)
  const filhosDe = new Map()
  if (!separar) for (const i of itens) if (i.parent_id) { if (!filhosDe.has(i.parent_id)) filhosDe.set(i.parent_id, []); filhosDe.get(i.parent_id).push(i) }
  const grupos = agruparItens(visiveis, rascunho.agrupar, { statuses, membrosMap, listasMap: new Map(fixture.listas.map((l) => [l.id, l])) })
  const ctx = {
    statuses, membros: membrosTodos, membrosMap, itensMap, listaPadraoId: listasFx[0]?.id, agrupar: rascunho.agrupar,
    contagemComentarios: {}, selecionadaId: null, onAbrir: () => {}, onAtualizar: () => {}, onMudarStatus: () => {}, onCriar: async () => ({}),
    listas: fixture.listas, pastas: fixture.pastas, projetos: fixture.projetos.map((p) => ({ id: p.id, company_name: p.company_name })), ciclos: [],
    expandirTudo: rascunho.subtarefas === 'expandidas',
    rotuloPai: separar ? (it) => (it.parent_id && itensMap[it.parent_id] ? (
      <span className="inline-flex items-center gap-1 ml-1.5 min-w-0 text-[11px] text-ln-t4" title={`Subtarefa de ${itensMap[it.parent_id].titulo}`}>
        <CornerDownRight className="w-3 h-3 shrink-0" /><span className="truncate max-w-[200px]">{itensMap[it.parent_id].titulo}</span>
      </span>
    ) : null) : undefined,
  }
  const padrao = views.filter((v) => v.padrao), salvas = views.filter((v) => !v.padrao)
  const cen = CENARIOS.find((c) => c.id === cenario)

  return (
    <div className="ln vt h-screen flex flex-col bg-ln-bg">
      <div className="shrink-0 flex items-center gap-2 h-9 px-4 bg-ln-yellow/15 text-ln-t2 text-xs border-b border-ln-yellow/30">
        <FlaskConical className="w-3.5 h-3.5 text-ln-yellow" />
        <strong>Protótipo temporário</strong> · views da pasta do cliente · nada é gravado
        <span className="ml-auto flex items-center gap-1">
          Dados:
          {[['exemplos', 'Casos de exemplo'], ['fixture', `${pastaFx.nome} (real)`]].map(([k, l]) => (
            <button key={k} onClick={() => { setFonte(k); setCenario(null) }} className={`h-6 px-2 rounded-md ${fonte === k ? 'bg-ln-yellow/25 text-ln-t1 font-medium' : 'hover:bg-ln-yellow/15'}`}>{l}</button>
          ))}
        </span>
      </div>

      {/* Cenários guiados */}
      {exemplos && (
        <div className="shrink-0 px-4 py-2.5 border-b border-ln-ink/[0.08] bg-ln-panel flex flex-col gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Lightbulb className="w-3.5 h-3.5 text-ln-yellow shrink-0" />
            <span className="text-xs font-medium text-ln-t2 mr-1">Experimente:</span>
            {CENARIOS.map((c) => (
              <button key={c.id} onClick={() => aplicarCenario(c)} className={`h-7 px-2.5 rounded-full text-xs border ${cenario === c.id ? 'border-ln-accent/50 bg-ln-accent/10 text-ln-accent' : 'border-ln-ink/10 text-ln-t2 hover:bg-ln-ink/5'} ${FOCO}`}>{c.titulo}</button>
            ))}
          </div>
          {cen && <p className="text-[12.5px] text-ln-t2 leading-relaxed pl-5">{cen.explica}</p>}
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col bg-ln-panel">
        <header className="h-12 shrink-0 flex items-center gap-2 px-4 text-[14px]">
          <span className="text-ln-t3">Clientes</span><span className="text-ln-t4">/</span>
          <Folder className="w-4 h-4 text-ln-accent" /><strong className="text-ln-t1">{exemplos ? 'Cliente Exemplo' : pastaFx.nome}</strong>
          <span className="text-xs text-ln-t4 tabular ml-2">{visiveis.length} {separar ? 'linhas' : 'tarefas'}</span>
        </header>

        {/* Linha 1: abas */}
        <div className="h-10 shrink-0 flex items-end gap-0.5 px-3 border-b border-ln-ink/[0.08] overflow-x-auto scroll-hide">
          {[...padrao, null, ...salvas].map((v) => (v === null
            ? <span key="sep" className="w-px h-4 bg-ln-line mx-1.5 mb-2.5 shrink-0" />
            : (
              <Aba key={v.id} icone={iconeDe(v.id === ativa.id ? rascunho.tipo : v.config.tipo)} ativa={v.id === ativa.id} onClick={() => abrir(v)}
                extra={<>{v.id === ativa.id && alterada && <i className="w-1.5 h-1.5 rounded-full bg-ln-orange" title="Alterações não salvas" />}{v.acesso === 'privada' && <EyeOff className="w-3 h-3 text-ln-t4" />}</>}>
                {v.nome}
              </Aba>
            )))}
          <button onClick={() => setPainel('nova')} className={`shrink-0 inline-flex items-center gap-1.5 h-9 px-2.5 mb-px text-[13px] font-medium text-ln-t3 hover:text-ln-t1 ${FOCO}`}>
            <Plus className="w-3.5 h-3.5" /> Visualização
          </button>
        </div>

        {/* Linha 2: agrupador + subtarefas | salvar + filtros + configurações + tarefa */}
        <div className="h-11 shrink-0 flex items-center justify-between gap-3 px-3 border-b border-ln-ink/5">
          <div className="flex items-center gap-1.5">
            <MenuAgrupar valor={rascunho.agrupar} onChange={(agrupar) => editar({ agrupar })} />
            <MenuSubtarefas valor={rascunho.subtarefas} onChange={(subtarefas) => editar({ subtarefas })} />
          </div>
          <div className="flex items-center gap-1">
            {alterada && (
              <BotaoSalvar podeEditar={podeEditar} onSalvar={salvar} onNova={() => setPainel('nova')} onReverter={reverter} />
            )}
            <BuscaIcone valor={busca} onChange={setBusca} />
            <IconeBtn ativo={nFiltros > 0 || painel === 'filtros'} onClick={() => setPainel((p) => (p === 'filtros' ? null : 'filtros'))} titulo={nFiltros ? `Filtros: ${nFiltros} condição(ões)` : 'Filtros'}>
              <span className="relative inline-flex"><ListFilter className="w-4 h-4" />{filtrosAlterados && <i className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-ln-orange" />}</span>
              {nFiltros > 0 && <span className="text-xs font-semibold tabular">{nFiltros}</span>}
            </IconeBtn>
            <MenuResponsavel valor={rascunho.responsaveis} membros={membrosTodos} nomesDe={nomesDe} onChange={(responsaveis) => editar({ responsaveis })} />
            <IconeBtn ativo={rascunho.concluidas} onClick={() => editar({ concluidas: !rascunho.concluidas })} titulo={rascunho.concluidas ? 'Esconder concluídas' : 'Mostrar concluídas'}><CircleCheck className="w-4 h-4" /></IconeBtn>
            <span className="w-px h-5 bg-ln-line mx-1" />
            <IconeBtn ativo={painel === 'config'} onClick={() => setPainel((p) => (p === 'config' ? null : 'config'))} titulo="Configurações da visualização"><Settings className="w-4 h-4" /></IconeBtn>
            <span className="inline-flex items-stretch ml-1">
              <button onClick={() => avisar('Nova tarefa (no protótipo não cria)')} className={`ln-primary !h-8 !rounded-r-none ${FOCO}`} title="Nova tarefa (C)"><Plus className="w-3.5 h-3.5" /> Tarefa</button>
              <ModelosMenu
                modelos={MODELOS} titulo="Criar a partir de um template"
                onUsar={(m) => avisar(`Abriria "Aplicar ${m.nome}" nesta pasta`)} onGerenciar={() => avisar('Abriria o construtor de templates')}
                classeBotao="ln-primary !h-8 !px-1.5 !rounded-l-none border-l border-white/25" render={<ChevronDown className="w-3.5 h-3.5" />}
              />
            </span>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex">
          <div className="flex-1 min-w-0 overflow-auto">
            {rascunho.tipo === 'lista'
              ? <ListaView key={`${fonte}-${rascunho.subtarefas}`} grupos={grupos} filhosDe={filhosDe} ctx={ctx} mostrarConcluidas={rascunho.concluidas} />
              : (
                <div className="h-full grid place-items-center text-center px-6">
                  <div className="flex flex-col items-center gap-2 text-ln-t3">
                    {createElement(iconeDe(rascunho.tipo), { className: 'w-8 h-8 text-ln-t4' })}
                    <p className="text-sm text-ln-t2">Aqui entraria a visualização <strong>{rotuloTipo(rascunho.tipo)}</strong> com os filtros de “{ativa.nome}”.</p>
                    <p className="text-xs text-ln-t4">No protótipo só a Lista é desenhada com dados.</p>
                  </div>
                </div>
              )}
          </div>
          {painel && (
            <aside className={`${painel === 'filtros' ? 'w-[600px]' : 'w-[340px]'} shrink-0 border-l border-ln-ink/[0.08] bg-ln-panel flex flex-col min-h-0`}>
              {painel === 'filtros' ? (
                <PainelFiltros
                  filtros={rascunho.filtros} onChange={(filtros) => editar({ filtros })} ctx={{ statuses, membros: membrosTodos }}
                  barra={barra} total={base.length} mostrando={visiveis.length} alterados={filtrosAlterados} podeEditar={podeEditar}
                  onSalvar={salvar} onReverter={() => setRascunho((r) => ({ ...r, filtros: ativa.config.filtros }))} onFechar={() => setPainel(null)}
                />
              ) : painel === 'nova'
                ? <PainelNova rascunho={rascunho} nomesDe={nomesDe} origem={ativa.nome} onCriar={criar} onFechar={() => setPainel(null)} />
                : <PainelConfig
                    key={ativa.id} v={ativa} rascunho={rascunho} podeEditar={podeEditar} alterada={alterada} membros={membrosTodos}
                    onEditar={editarNaSidebar} onMeta={(patch) => mudarView(ativa.id, patch)}
                    onDuplicar={duplicar} onExcluir={excluir} onFechar={() => setPainel(null)} nFiltros={contarRegras(ativa.config.filtros)} onAbrirFiltros={() => setPainel('filtros')}
                  />}
            </aside>
          )}
        </div>
      </div>

      {aviso && <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 ln-card px-3 py-2 text-[13px] text-ln-t1 flex items-center gap-2"><Check className="w-3.5 h-3.5 text-ln-green" />{aviso}</div>}
    </div>
  )
}

// ─── Barra ────────────────────────────────────────────────────────────────────

/** Chip "Subtarefas" ao lado do agrupador (como o "Separar" do ClickUp). */
function MenuSubtarefas({ valor, onChange }) {
  const ref = useRef(null)
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <button ref={ref} onClick={() => setAberto((x) => !x)} className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[12.5px] font-medium bg-ln-accent/10 text-ln-accent ring-1 ring-inset ring-ln-accent/25 hover:bg-ln-accent/15 ${FOCO}`} title="Mostrar subtarefas">
        <ListTree className="w-3.5 h-3.5" /> {rotuloSub(valor)} <ChevronDown className="w-3 h-3 opacity-70" />
      </button>
      <Popover anchorRef={ref} open={aberto} onClose={() => setAberto(false)} width={300}>
        <div className="p-1">
          <p className="px-2.5 pt-1.5 pb-1 text-[11px] text-ln-t4">Mostrar subtarefas</p>
          <OpcoesSubtarefas valor={valor} onChange={(v) => { setAberto(false); onChange(v) }} />
        </div>
      </Popover>
    </>
  )
}

function OpcoesSubtarefas({ valor, onChange }) {
  return SUBTAREFAS.map((s) => (
    <button key={s.key} onClick={() => onChange(s.key)} className={`w-full flex items-start gap-2 px-2.5 py-2 rounded-md text-left hover:bg-ln-ink/5 ${FOCO}`}>
      <span className="flex-1 min-w-0">
        <span className={`block text-[13px] ${valor === s.key ? 'text-ln-t1 font-medium' : 'text-ln-t2'}`}>{s.label} {s.extra && <span className="text-ln-t4 font-normal">{s.extra}</span>}</span>
        <span className="block text-[11px] text-ln-t4 leading-snug mt-0.5">{s.desc}</span>
      </span>
      {valor === s.key && <Check className="w-3.5 h-3.5 mt-0.5 text-ln-accent shrink-0" />}
    </button>
  ))
}


function Aba({ icone, ativa, onClick, extra, children }) {
  return (
    <button onClick={onClick} className={`shrink-0 inline-flex items-center gap-1.5 h-9 px-2.5 -mb-px border-b-2 text-[13px] font-medium whitespace-nowrap transition-colors ${ativa ? 'border-ln-t1 text-ln-t1' : 'border-transparent text-ln-t3 hover:text-ln-t1'} ${FOCO}`}>
      {createElement(icone, { className: `w-3.5 h-3.5 ${ativa ? 'text-ln-accent' : ''}` })}
      <span className="max-w-[180px] truncate">{children}</span>
      {extra}
    </button>
  )
}

function IconeBtn({ ativo, onClick, titulo, children, refBtn }) {
  return (
    <button ref={refBtn} onClick={onClick} title={titulo} aria-label={titulo} aria-pressed={ativo}
      className={`inline-flex items-center justify-center gap-1 h-8 min-w-8 px-1.5 rounded-md transition-colors ${ativo ? 'bg-ln-accent/10 text-ln-accent' : 'text-ln-t3 hover:text-ln-t1 hover:bg-ln-ink/5'} ${FOCO}`}>
      {children}
    </button>
  )
}

function ItemSalvar({ icone, onClick, fechar, atalho, children, desabilitado }) {
  return (
    <button disabled={desabilitado} onClick={() => { fechar(); onClick() }} className="w-full flex items-center gap-2.5 h-9 px-2.5 rounded-md text-[13px] text-ln-t1 hover:bg-ln-ink/5 disabled:opacity-40 disabled:hover:bg-transparent">
      {createElement(icone, { className: 'w-4 h-4 text-ln-t3' })}<span className="flex-1 text-left">{children}</span>
      {atalho && <span className="text-[11px] text-ln-t4">{atalho}</span>}
    </button>
  )
}

/** Botão dividido do ClickUp: "Salvar visualização" + menu (nova, reverter). */
function BotaoSalvar({ podeEditar, onSalvar, onNova, onReverter }) {
  const ref = useRef(null)
  const [aberto, setAberto] = useState(false)
  const fechar = () => setAberto(false)
  return (
    <span className="inline-flex items-center mr-1 rounded-md ring-1 ring-inset ring-ln-orange/40 bg-ln-orange/10 text-ln-orange">
      <button onClick={podeEditar ? onSalvar : onNova} className={`h-7 pl-2.5 pr-2 text-xs font-medium rounded-l-md hover:bg-ln-orange/15 ${FOCO}`} title={podeEditar ? 'Salvar visualização (Ctrl+Enter)' : 'Só quem criou pode salvar esta visualização'}>
        {podeEditar ? 'Salvar visualização' : 'Salvar como nova'}
      </button>
      <span className="w-px h-4 bg-ln-orange/30" />
      <button ref={ref} onClick={() => setAberto((x) => !x)} className={`h-7 px-1.5 rounded-r-md hover:bg-ln-orange/15 ${FOCO}`} aria-label="Mais opções de salvar">
        {aberto ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      <Popover anchorRef={ref} open={aberto} onClose={() => setAberto(false)} width={290} align="right">
        <div className="p-1.5">
          <ItemSalvar fechar={fechar} icone={CircleCheck} onClick={onSalvar} atalho="Ctrl ⏎" desabilitado={!podeEditar}>Salvar visualização</ItemSalvar>
          <ItemSalvar fechar={fechar} icone={CopyPlus} onClick={onNova}>Salvar como nova visualização</ItemSalvar>
          <div className="border-t border-ln-ink/[0.06] my-1" />
          <ItemSalvar fechar={fechar} icone={Undo2} onClick={onReverter}>Reverter alterações</ItemSalvar>
        </div>
      </Popover>
    </span>
  )
}

function MenuAgrupar({ valor, onChange }) {
  const ref = useRef(null)
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <button ref={ref} onClick={() => setAberto((x) => !x)} className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[12.5px] font-medium bg-ln-accent/10 text-ln-accent ring-1 ring-inset ring-ln-accent/25 hover:bg-ln-accent/15 ${FOCO}`} title="Agrupar">
        <Layers className="w-3.5 h-3.5" /> {rotuloAgrupar(valor)} <ChevronDown className="w-3 h-3 opacity-70" />
      </button>
      <Popover anchorRef={ref} open={aberto} onClose={() => setAberto(false)} width={210}>
        <ListaAgrupar valor={valor} onChange={(v) => { setAberto(false); onChange(v) }} />
      </Popover>
    </>
  )
}

function ListaAgrupar({ valor, onChange }) {
  return (
    <div className="p-1">
      <p className="px-2.5 pt-1.5 pb-1 text-[11px] text-ln-t4">Agrupar por</p>
      {AGRUPAMENTOS.map((a) => (
        <button key={a.value} onClick={() => onChange(a.value)} className={`w-full flex items-center h-8 px-2.5 rounded-md text-[13px] hover:bg-ln-ink/5 ${a.value === valor ? 'text-ln-t1' : 'text-ln-t2'}`}>
          {a.label}{a.value === valor && <Check className="w-3.5 h-3.5 ml-auto text-ln-accent" />}
        </button>
      ))}
    </div>
  )
}

function BuscaIcone({ valor, onChange }) {
  const [aberta, setAberta] = useState(false)
  if (aberta || valor) {
    return (
      <div className="ln-input !h-8 !w-[180px] flex items-center gap-1.5">
        <Search className="w-3.5 h-3.5 text-ln-t4 shrink-0" />
        <input autoFocus value={valor} onChange={(e) => onChange(e.target.value)} onBlur={() => !valor && setAberta(false)} onKeyDown={(e) => { if (e.key === 'Escape') { onChange(''); setAberta(false) } }} placeholder="Buscar pelo nome" className="flex-1 min-w-0 bg-transparent outline-none text-xs text-ln-t1 placeholder:text-ln-t4" />
        {valor && <button onClick={() => { onChange(''); setAberta(false) }} className="text-ln-t4 hover:text-ln-t2" aria-label="Limpar busca"><X className="w-3 h-3" /></button>}
      </div>
    )
  }
  return <IconeBtn onClick={() => setAberta(true)} titulo="Buscar tarefa pelo nome"><Search className="w-4 h-4" /></IconeBtn>
}

/** Seleção múltipla: marcar/desmarcar não fecha o menu; nenhum marcado = todos. */
function ListaResponsaveis({ valor, membros, onChange }) {
  const alternar = (id) => onChange(valor.includes(id) ? valor.filter((x) => x !== id) : [...valor, id])
  return (
    <div className="flex flex-col min-h-0">
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
        <span className="text-[11px] font-medium text-ln-t4">{valor.length ? `${valor.length} selecionado${valor.length === 1 ? '' : 's'}` : 'Todos os responsáveis'}</span>
        {valor.length > 0 && <button onClick={() => onChange([])} className="text-[11px] text-ln-accent hover:underline">Limpar</button>}
      </div>
      <div className="p-1 overflow-y-auto">
        {membros.map((m) => {
          const marcado = valor.includes(m.id)
          return (
            <button key={m.id} role="menuitemcheckbox" aria-checked={marcado} onClick={() => alternar(m.id)} className={`w-full flex items-center gap-2.5 h-8 px-2.5 rounded-md text-[13px] hover:bg-ln-ink/5 ${marcado ? 'text-ln-t1' : 'text-ln-t2'}`}>
              <span className={`w-4 h-4 rounded grid place-items-center shrink-0 border ${marcado ? 'bg-ln-accent border-ln-accent text-white' : 'border-ln-ink/25'}`}>{marcado && <Check className="w-3 h-3" />}</span>
              <span className="truncate">{m.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function MenuResponsavel({ valor, membros, nomesDe, onChange }) {
  const ref = useRef(null)
  const [aberto, setAberto] = useState(false)
  const ativo = valor.length > 0
  const primeiro = ativo ? (membros.find((m) => m.id === valor[0])?.name || '').split(' ')[0] : ''
  return (
    <>
      <IconeBtn refBtn={ref} ativo={ativo} onClick={() => setAberto((x) => !x)} titulo={ativo ? `Responsáveis: ${nomesDe(valor)}` : 'Filtrar por responsável'}>
        <Users className="w-4 h-4" />{ativo && <span className="text-xs font-medium max-w-[110px] truncate">{primeiro}{valor.length > 1 ? ` +${valor.length - 1}` : ''}</span>}
      </IconeBtn>
      <Popover anchorRef={ref} open={aberto} onClose={() => setAberto(false)} width={260} align="right">
        <ListaResponsaveis valor={valor} membros={membros} onChange={onChange} />
      </Popover>
    </>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function CabecalhoPainel({ titulo, onFechar }) {
  return (
    <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-ln-ink/[0.06]">
      <span className="flex items-center gap-2 text-[13px] font-semibold text-ln-t1"><Settings className="w-4 h-4 text-ln-t3" />{titulo}</span>
      <button onClick={onFechar} className="ln-iconbtn !w-7 !h-7" aria-label="Fechar"><X className="w-4 h-4" /></button>
    </div>
  )
}

function Bloco({ titulo, children, extra }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between"><p className="text-[11px] font-semibold uppercase tracking-wide text-ln-t4">{titulo}</p>{extra}</div>
      {children}
    </section>
  )
}

/** Linha "rótulo · valor" que abre um popover para editar (filtros na sidebar). */
function CampoEditavel({ rotulo, valor, desabilitado, largura = 230, children }) {
  const ref = useRef(null)
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <button ref={ref} disabled={desabilitado} onClick={() => setAberto((x) => !x)} className={`flex items-center justify-between gap-3 h-9 px-3 rounded-lg border border-ln-ink/[0.08] text-[13px] enabled:hover:bg-ln-ink/[0.03] disabled:opacity-70 ${FOCO}`}>
        <span className="text-ln-t3">{rotulo}</span>
        <span className="flex items-center gap-1 text-ln-t1 min-w-0"><span className="truncate">{valor}</span>{!desabilitado && <ChevronDown className="w-3 h-3 text-ln-t4 shrink-0" />}</span>
      </button>
      <Popover anchorRef={ref} open={aberto} onClose={() => setAberto(false)} width={largura} align="right">
        {children(() => setAberto(false))}
      </Popover>
    </>
  )
}

function EscolhaTipo({ valor, onChange, desabilitado }) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {TIPOS.map(({ key, label, icon }) => (
        <button key={key} disabled={desabilitado && valor !== key} onClick={() => onChange(key)} className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-[12px] transition-colors disabled:opacity-40 ${valor === key ? 'border-ln-accent/50 bg-ln-accent/10 text-ln-accent' : 'border-ln-ink/[0.08] text-ln-t2 enabled:hover:bg-ln-ink/[0.04]'}`}>
          {createElement(icon, { className: 'w-4 h-4' })}{label}
        </button>
      ))}
    </div>
  )
}

function EscolhaAcesso({ publica, onChange, desabilitado }) {
  return (
    <div className="flex flex-col gap-1">
      {[[true, Globe, 'Compartilhada com o time', 'Todo mundo vê esta aba na pasta'], [false, EyeOff, 'Só para mim', 'Só você vê esta aba']].map(([v, Icone, t, d]) => (
        <button key={t} disabled={desabilitado} onClick={() => onChange(v)} className={`flex items-start gap-2.5 p-2 rounded-lg border text-left disabled:cursor-default ${publica === v ? 'border-ln-accent/50 bg-ln-accent/[0.06]' : 'border-ln-ink/[0.08] enabled:hover:bg-ln-ink/[0.03] disabled:opacity-50'}`}>
          <Icone className={`w-4 h-4 mt-0.5 ${publica === v ? 'text-ln-accent' : 'text-ln-t3'}`} />
          <span className="flex flex-col"><span className="text-[13px] text-ln-t1">{t}</span><span className="text-[11px] text-ln-t4">{d}</span></span>
        </button>
      ))}
    </div>
  )
}

function Filtros({ r, membros, onEditar }) {
  const nomes = (ids) => (ids.length ? ids.map((id) => membros.find((m) => m.id === id)?.name || '—').join(', ') : 'Todos')
  return (
    <div className="flex flex-col gap-1.5">
      <CampoEditavel rotulo="Agrupar por" valor={rotuloAgrupar(r.agrupar)} largura={210}>
        {(fechar) => <ListaAgrupar valor={r.agrupar} onChange={(agrupar) => { fechar(); onEditar({ agrupar }) }} />}
      </CampoEditavel>
      <CampoEditavel rotulo="Responsáveis" valor={nomes(r.responsaveis)} largura={260}>
        {() => <ListaResponsaveis valor={r.responsaveis} membros={membros} onChange={(responsaveis) => onEditar({ responsaveis })} />}
      </CampoEditavel>
      <button onClick={() => onEditar({ concluidas: !r.concluidas })} className={`flex items-center justify-between h-9 px-3 rounded-lg border border-ln-ink/[0.08] text-[13px] hover:bg-ln-ink/[0.03] ${FOCO}`}>
        <span className="text-ln-t3">Mostrar concluídas</span>
        <span className={`w-8 h-[18px] rounded-full p-0.5 transition-colors ${r.concluidas ? 'bg-ln-accent' : 'bg-ln-ink/15'}`}><span className={`block w-3.5 h-3.5 rounded-full bg-white transition-transform ${r.concluidas ? 'translate-x-3.5' : ''}`} /></span>
      </button>
    </div>
  )
}

function PainelConfig({ v, rascunho, podeEditar, membros, onEditar, onMeta, onDuplicar, onExcluir, onFechar, nFiltros, onAbrirFiltros }) {
  const [nome, setNome] = useState(v.nome)
  const [confirmar, setConfirmar] = useState(false)
  const salvarNome = () => { if (nome.trim() && nome.trim() !== v.nome) onMeta({ nome: nome.trim() }); else setNome(v.nome) }
  return (
    <>
      <CabecalhoPainel titulo="Configurações da visualização" onFechar={onFechar} />
      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-5">
        {v.padrao && <p className="flex items-start gap-2 text-xs text-ln-t3 bg-ln-ink/[0.04] rounded-lg px-3 py-2"><Lock className="w-3.5 h-3.5 mt-px shrink-0" />Visualização padrão da pasta: qualquer pessoa do time ajusta, mas ela não pode ser excluída.</p>}
        {!podeEditar && <p className="text-xs text-ln-t3 bg-ln-ink/[0.04] rounded-lg px-3 py-2">Criada por outra pessoa. Você pode mexer nos filtros para olhar (só na sua tela); para guardar, use “Salvar como nova visualização” na barra.</p>}

        <Bloco titulo="Nome">
          <input value={nome} disabled={!podeEditar} onChange={(e) => setNome(e.target.value)} onBlur={salvarNome} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} className="ln-input !h-9 w-full disabled:opacity-70" />
        </Bloco>
        <Bloco titulo="Visualização">
          <EscolhaTipo valor={rascunho.tipo} onChange={(tipo) => onEditar({ tipo })} desabilitado={v.padrao} />
          {v.padrao && <p className="text-[11px] text-ln-t4">Nas padrão o tipo é fixo; para outro tipo, crie uma visualização.</p>}
        </Bloco>
        <Bloco titulo="Subtarefas">
          <div className="rounded-lg border border-ln-ink/[0.08] p-1"><OpcoesSubtarefas valor={rascunho.subtarefas} onChange={(subtarefas) => onEditar({ subtarefas })} /></div>
        </Bloco>
        <Bloco titulo="Agrupamento e filtros">
          <Filtros r={rascunho} membros={membros} onEditar={onEditar} />
          <button onClick={onAbrirFiltros} className={`flex items-center justify-between h-9 px-3 rounded-lg border border-ln-ink/[0.08] text-[13px] hover:bg-ln-ink/[0.03] ${FOCO}`}>
            <span className="flex items-center gap-2 text-ln-t3"><ListFilter className="w-3.5 h-3.5" />Filtros avançados</span>
            <span className="text-ln-t1">{nFiltros ? `${nFiltros} condição${nFiltros === 1 ? '' : 'ões'}` : 'Nenhum'} <span className="text-ln-accent ml-1">Editar</span></span>
          </button>
          {podeEditar && <p className="text-[11px] text-ln-t4">O que você muda aqui já fica salvo na visualização.</p>}
        </Bloco>
        {!v.padrao && <Bloco titulo="Quem vê"><EscolhaAcesso publica={v.acesso === 'publica'} onChange={(p) => onMeta({ acesso: p ? 'publica' : 'privada' })} desabilitado={!podeEditar} /></Bloco>}
      </div>
      <div className="shrink-0 p-3 border-t border-ln-ink/[0.06] flex items-center gap-1.5">
        <button onClick={onDuplicar} className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] text-ln-t2 hover:bg-ln-ink/5 ${FOCO}`}><Copy className="w-3.5 h-3.5" /> Duplicar</button>
        {!v.padrao && podeEditar && (confirmar
          ? <span className="ml-auto flex items-center gap-1.5 text-xs text-ln-t3">Excluir para todos?<button onClick={() => setConfirmar(false)} className="ln-pill">Não</button><button onClick={onExcluir} className="h-7 px-2.5 rounded-md text-xs font-medium bg-ln-red text-white">Excluir</button></span>
          : <button onClick={() => setConfirmar(true)} className={`ml-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] text-ln-red hover:bg-ln-red/10 ${FOCO}`}><Trash2 className="w-3.5 h-3.5" /> Excluir</button>)}
      </div>
    </>
  )
}

function PainelNova({ rascunho, nomesDe, origem, onCriar, onFechar }) {
  const [nome, setNome] = useState('')
  const [publica, setPublica] = useState(true)
  const ok = nome.trim().length > 0
  return (
    <>
      <CabecalhoPainel titulo="Nova visualização" onFechar={onFechar} />
      <form className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); if (ok) onCriar({ nome: nome.trim(), publica }) }}>
        <p className="text-xs text-ln-t3 bg-ln-ink/[0.04] rounded-lg px-3 py-2">Parte do que está na tela em <strong className="text-ln-t2">{origem}</strong>. “{origem}” continua como estava.</p>
        <Bloco titulo="Nome"><input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Atrasadas do design" className="ln-input !h-9 w-full" /></Bloco>
        <Bloco titulo="Leva">
          <dl className="grid grid-cols-[110px_1fr] gap-y-1.5 text-[13px]">
            <dt className="text-ln-t3">Visualização</dt><dd className="text-ln-t1">{rotuloTipo(rascunho.tipo)}</dd>
            <dt className="text-ln-t3">Agrupar por</dt><dd className="text-ln-t1">{rotuloAgrupar(rascunho.agrupar)}</dd>
            <dt className="text-ln-t3">Subtarefas</dt><dd className="text-ln-t1">{rotuloSub(rascunho.subtarefas)}</dd>
            <dt className="text-ln-t3">Responsável</dt><dd className="text-ln-t1 truncate">{nomesDe(rascunho.responsaveis)}</dd>
            <dt className="text-ln-t3">Concluídas</dt><dd className="text-ln-t1">{rascunho.concluidas ? 'Mostrar' : 'Esconder'}</dd>
            <dt className="text-ln-t3">Filtros</dt><dd className="text-ln-t1">{contarRegras(rascunho.filtros) ? `${contarRegras(rascunho.filtros)} condição(ões)` : 'Nenhum'}</dd>
          </dl>
        </Bloco>
        <Bloco titulo="Quem vê"><EscolhaAcesso publica={publica} onChange={setPublica} /></Bloco>
        <div className="mt-auto flex justify-end gap-1.5">
          <button type="button" onClick={onFechar} className="ln-pill">Cancelar</button>
          <button type="submit" disabled={!ok} className="ln-primary !h-8 disabled:opacity-50">Criar visualização</button>
        </div>
      </form>
    </>
  )
}

// ─── Filtros avançados ────────────────────────────────────────────────────────
// Modelo salvo na visualização: { op: 'e'|'ou', grupos: [{ id, op, regras: [{ id, campo, operador, valor }] }] }.
// Dentro de um grupo as regras se ligam pelo op do grupo; os grupos, pelo op de fora.
// Regra incompleta (sem campo ou sem valor) é ignorada até ser completada. O resultado
// soma (E) com os filtros da barra: busca, responsáveis e concluídas.

const FILTROS_VAZIOS = { op: 'e', grupos: [] }
const CAMPOS_FILTRO = [
  { key: 'status', label: 'Status', tipo: 'opcao' },
  { key: 'prioridade', label: 'Prioridade', tipo: 'opcao', vazio: true },
  { key: 'responsaveis', label: 'Responsáveis', tipo: 'multi' },
  { key: 'vencimento', label: 'Data de vencimento', tipo: 'data', atrasada: true },
  { key: 'inicio', label: 'Data de início', tipo: 'data' },
  { key: 'criada', label: 'Data de criação', tipo: 'data' },
  { key: 'tipo', label: 'Tipo de tarefa', tipo: 'opcao', vazio: true },
  { key: 'dificuldade', label: 'Dificuldade', tipo: 'opcao', vazio: true },
  { key: 'departamento', label: 'Departamento', tipo: 'multi' },
  { key: 'estimativa', label: 'Estimativa (horas)', tipo: 'numero' },
  { key: 'nome', label: 'Nome', tipo: 'texto' },
]
const OPERADORES = {
  opcao: [['e', 'é'], ['nao_e', 'não é'], ['definido', 'está definido'], ['vazio', 'não está definido']],
  multi: [['qualquer', 'contém qualquer'], ['todos', 'contém todos'], ['nenhum', 'não contém'], ['definido', 'tem algum'], ['vazio', 'está vazio']],
  data: [['e', 'é'], ['antes', 'antes de'], ['depois', 'depois de'], ['atrasada', 'está atrasada'], ['definido', 'está definida'], ['vazio', 'não está definida']],
  numero: [['maior', 'maior que'], ['menor', 'menor que'], ['igual', 'igual a'], ['definido', 'está definida'], ['vazio', 'não está definida']],
  texto: [['contem', 'contém'], ['nao_contem', 'não contém']],
}
const SEM_VALOR = new Set(['definido', 'vazio', 'atrasada'])
const PERIODOS = [
  ['hoje', 'Hoje'], ['ontem', 'Ontem'], ['amanha', 'Amanhã'], ['esta_semana', 'Esta semana'], ['semana_passada', 'Semana passada'],
  ['proxima_semana', 'Próxima semana'], ['ultimos_7', 'Últimos 7 dias'], ['proximos_7', 'Próximos 7 dias'], ['este_mes', 'Este mês'],
]
const campoDe = (k) => CAMPOS_FILTRO.find((c) => c.key === k)
const operadoresDe = (c) => (c ? OPERADORES[c.tipo].filter(([k]) => (k !== 'atrasada' || c.atrasada) && (!['definido', 'vazio'].includes(k) || c.tipo !== 'opcao' || c.vazio)) : [])
const idLocal = () => Math.random().toString(36).slice(2, 9)
const novaRegra = () => ({ id: idLocal(), campo: '', operador: '', valor: null })

function regraCompleta(r) {
  if (!r.campo || !r.operador) return false
  if (SEM_VALOR.has(r.operador)) return true
  return Array.isArray(r.valor) ? r.valor.length > 0 : r.valor !== null && r.valor !== undefined && String(r.valor).trim() !== ''
}
const contarRegras = (f) => (f?.grupos || []).reduce((n, g) => n + g.regras.filter(regraCompleta).length, 0)

const DIA = 86400000
function intervalo(periodo) {
  const h = new Date(); h.setHours(0, 0, 0, 0)
  const h0 = h.getTime()
  const seg = h0 - ((h.getDay() + 6) % 7) * DIA // semana de segunda a domingo
  const r = {
    hoje: [h0, h0 + DIA], ontem: [h0 - DIA, h0], amanha: [h0 + DIA, h0 + 2 * DIA],
    esta_semana: [seg, seg + 7 * DIA], semana_passada: [seg - 7 * DIA, seg], proxima_semana: [seg + 7 * DIA, seg + 14 * DIA],
    ultimos_7: [h0 - 6 * DIA, h0 + DIA], proximos_7: [h0, h0 + 7 * DIA],
    este_mes: [new Date(h.getFullYear(), h.getMonth(), 1).getTime(), new Date(h.getFullYear(), h.getMonth() + 1, 1).getTime()],
  }
  return r[periodo] || [0, 0]
}
function valorDe(it, campo) {
  switch (campo) {
    case 'status': return it.status
    case 'prioridade': return it.prioridade
    case 'responsaveis': return it.responsaveis || []
    case 'vencimento': return it.data_vencimento
    case 'inicio': return it.data_inicio
    case 'criada': return it.created_at
    case 'tipo': return it.tipo_tarefa
    case 'dificuldade': return it.dificuldade
    case 'departamento': return it.departamento || []
    case 'estimativa': return it.estimativa_min ? it.estimativa_min / 60 : null
    case 'nome': return it.titulo || ''
    default: return null
  }
}
function avaliarRegra(it, r) {
  const c = campoDe(r.campo)
  const v = valorDe(it, r.campo)
  const op = r.operador
  if (c.tipo === 'opcao') {
    if (op === 'definido') return !!v
    if (op === 'vazio') return !v
    return op === 'e' ? r.valor.includes(v) : !r.valor.includes(v)
  }
  if (c.tipo === 'multi') {
    if (op === 'definido') return v.length > 0
    if (op === 'vazio') return v.length === 0
    if (op === 'qualquer') return r.valor.some((x) => v.includes(x))
    if (op === 'todos') return r.valor.every((x) => v.includes(x))
    return !r.valor.some((x) => v.includes(x))
  }
  if (c.tipo === 'data') {
    const d = v ? new Date(v) : null
    if (op === 'definido') return !!d
    if (op === 'vazio') return !d
    if (!d) return false
    const dia = new Date(d).setHours(0, 0, 0, 0)
    if (op === 'atrasada') return dia < new Date().setHours(0, 0, 0, 0) && it.status_tipo !== 'closed'
    if (op === 'e') { const [a, b] = intervalo(r.valor); return dia >= a && dia < b }
    const [y, m, dd] = String(r.valor).split('-').map(Number)
    const ref = new Date(y, m - 1, dd).getTime()
    return op === 'antes' ? dia < ref : dia > ref
  }
  if (c.tipo === 'numero') {
    if (op === 'definido') return v != null
    if (op === 'vazio') return v == null
    if (v == null) return false
    const n = Number(r.valor)
    return op === 'maior' ? v > n : op === 'menor' ? v < n : v === n
  }
  const tem = String(v).toLowerCase().includes(String(r.valor).trim().toLowerCase())
  return op === 'contem' ? tem : !tem
}
/** true se o item passa nos filtros avançados (grupos e regras incompletos são ignorados). */
function passaFiltros(it, f) {
  const resultados = (f?.grupos || []).map((g) => {
    const regras = g.regras.filter(regraCompleta)
    if (!regras.length) return null
    return g.op === 'ou' ? regras.some((r) => avaliarRegra(it, r)) : regras.every((r) => avaliarRegra(it, r))
  }).filter((x) => x !== null)
  if (!resultados.length) return true
  return f.op === 'ou' ? resultados.some(Boolean) : resultados.every(Boolean)
}

/** Opções de valor de cada campo (com cor quando houver). */
function opcoesDe(campo, { statuses, membros }) {
  switch (campo) {
    case 'status': return statuses.map((s) => ({ value: s.key, label: s.label, cor: s.cor }))
    case 'prioridade': return PRIORIDADES.map((p) => ({ value: p.key, label: p.label, cor: p.cor, bandeira: true }))
    case 'responsaveis': return membros.map((m) => ({ value: m.id, label: m.name }))
    case 'tipo': return TIPOS_TAREFA.map((t) => ({ value: t.key.trim(), label: t.key.trim(), cor: t.cor }))
    case 'dificuldade': return DIFICULDADES.map((d) => ({ value: d.key, label: d.key, cor: d.cor }))
    case 'departamento': return DEPARTAMENTOS.map((d) => ({ value: d, label: d }))
    default: return []
  }
}

function Marcador({ op, cor, bandeira }) {
  if (bandeira) return <Flag className="w-3.5 h-3.5 shrink-0" style={{ color: cor }} fill={cor} />
  if (cor) return <i className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: cor }} />
  return op ? <Users className="w-3.5 h-3.5 text-ln-t4 shrink-0" /> : null
}

function SeletorOpcoes({ opcoes, valor, onChange, pessoas }) {
  const ref = useRef(null)
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const sel = opcoes.filter((o) => valor.includes(o.value))
  const visiveis = opcoes.filter((o) => o.label.toLowerCase().includes(busca.toLowerCase()))
  const alternar = (v) => onChange(valor.includes(v) ? valor.filter((x) => x !== v) : [...valor, v])
  return (
    <>
      <button ref={ref} onClick={() => setAberto((x) => !x)} className={`ln-input !h-8 flex-1 min-w-[120px] flex items-center gap-1.5 text-left text-[12.5px] ${!sel.length ? '!border-dashed !border-ln-orange/60' : ''} ${aberto ? '!border-ln-accent' : ''}`}>
        {sel.length ? (
          <span className="flex items-center gap-1.5 min-w-0 flex-1">
            {sel.slice(0, 2).map((o) => <span key={o.value} className="inline-flex items-center gap-1 min-w-0"><Marcador op={pessoas} cor={o.cor} bandeira={o.bandeira} /><span className="truncate text-ln-t1">{o.label}</span></span>)}
            {sel.length > 2 && <span className="text-ln-t4 shrink-0">+{sel.length - 2}</span>}
          </span>
        ) : <span className="flex-1 text-ln-t4">Escolha…</span>}
        <ChevronDown className="w-3 h-3 text-ln-t4 shrink-0" />
      </button>
      <Popover anchorRef={ref} open={aberto} onClose={() => { setAberto(false); setBusca('') }} width={250} align="right">
        {opcoes.length > 6 && (
          <div className="flex items-center gap-2 h-9 px-3 border-b border-ln-ink/5"><Search className="w-3.5 h-3.5 text-ln-t4" /><input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" className="flex-1 bg-transparent outline-none text-[13px] text-ln-t1 placeholder:text-ln-t4" /></div>
        )}
        <div className="p-1 overflow-y-auto">
          {visiveis.map((o) => {
            const marcado = valor.includes(o.value)
            return (
              <button key={o.value} role="menuitemcheckbox" aria-checked={marcado} onClick={() => alternar(o.value)} className={`w-full flex items-center gap-2.5 h-8 px-2.5 rounded-md text-[13px] hover:bg-ln-ink/5 ${marcado ? 'text-ln-t1' : 'text-ln-t2'}`}>
                <span className={`w-4 h-4 rounded grid place-items-center shrink-0 border ${marcado ? 'bg-ln-accent border-ln-accent text-white' : 'border-ln-ink/25'}`}>{marcado && <Check className="w-3 h-3" />}</span>
                <Marcador op={pessoas} cor={o.cor} bandeira={o.bandeira} /><span className="truncate">{o.label}</span>
              </button>
            )
          })}
          {!visiveis.length && <p className="px-2.5 py-2 text-xs text-ln-t4">Nada encontrado.</p>}
        </div>
      </Popover>
    </>
  )
}

function ValorRegra({ r, campo, ctx, onChange }) {
  if (!campo || !r.operador) return <span className="ln-input !h-8 flex-1 min-w-[120px] flex items-center text-[12.5px] text-ln-t4 opacity-60">—</span>
  if (SEM_VALOR.has(r.operador)) return <span className="flex-1 min-w-[120px]" />
  const incompleto = !regraCompleta(r) ? '!border-dashed !border-ln-orange/60' : ''
  if (campo.tipo === 'opcao' || campo.tipo === 'multi') return <SeletorOpcoes opcoes={opcoesDe(campo.key, ctx)} valor={r.valor || []} onChange={onChange} pessoas={campo.key === 'responsaveis'} />
  if (campo.tipo === 'data' && r.operador === 'e') {
    return (
      <select value={r.valor || ''} onChange={(e) => onChange(e.target.value)} className={`ln-input !h-8 flex-1 min-w-[120px] !text-[12.5px] ${incompleto}`}>
        <option value="" disabled>Escolha o período…</option>
        {PERIODOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
    )
  }
  if (campo.tipo === 'data') return <DataInput value={r.valor || ''} onChange={onChange} placeholder="Escolha a data" className={`!h-8 flex-1 min-w-[120px] !text-[12.5px] ${incompleto}`} />
  return (
    <input value={r.valor ?? ''} onChange={(e) => onChange(e.target.value)} type={campo.tipo === 'numero' ? 'number' : 'text'} min="0" step="0.5"
      placeholder={campo.tipo === 'numero' ? 'Horas' : 'Texto'} className={`ln-input !h-8 flex-1 min-w-[120px] !text-[12.5px] ${incompleto}`} />
  )
}

// classes literais (o Tailwind não enxerga nome de classe montado em tempo de execução)
const LARG_CONECTOR = { grupo: ['w-[56px]', '!w-[56px]'], regra: ['w-[52px]', '!w-[52px]'] }
/** indice 0 = "Onde"; 1 = seletor E/OU (vale para todo o nível); 2+ = repete o E/OU em texto, como no ClickUp. */
function Conector({ indice, valor, onChange, nivel = 'grupo' }) {
  const [larg, largSel] = LARG_CONECTOR[nivel]
  if (indice !== 1) {
    return <span className={`${larg} block shrink-0 text-right pr-2 text-[12px] ${indice === 0 ? 'text-ln-t3' : 'text-ln-t4 font-medium'}`}>{indice === 0 ? 'Onde' : valor === 'ou' ? 'OU' : 'E'}</span>
  }
  return (
    <select value={valor} onChange={(e) => onChange(e.target.value)} className={`ln-input !h-8 ${largSel} shrink-0 !px-2 !text-[12px] font-medium`} aria-label="Ligar com E ou OU">
      <option value="e">E</option><option value="ou">OU</option>
    </select>
  )
}

function RegraFiltro({ r, ctx, indice, opGrupo, onOpGrupo, onChange, onRemover, focar, onFocado }) {
  const campo = campoDe(r.campo)
  const campoRef = useRef(null)
  // condição recém-criada: rola até ela (pode nascer abaixo da área visível) e foca o campo
  useEffect(() => {
    if (!focar) return
    campoRef.current?.scrollIntoView({ block: 'nearest' })
    campoRef.current?.focus({ preventScroll: true })
    onFocado()
  }, [focar]) // eslint-disable-line react-hooks/exhaustive-deps
  const ops = operadoresDe(campo)
  const incompleta = !regraCompleta(r)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 flex-wrap">
        <Conector indice={indice} valor={opGrupo} onChange={onOpGrupo} nivel="regra" />
        <select ref={campoRef} value={r.campo} onChange={(e) => { const c = campoDe(e.target.value); onChange({ campo: c.key, operador: operadoresDe(c)[0][0], valor: null }) }}
          className={`ln-input !h-8 !w-[136px] shrink-0 !text-[12.5px] ${!r.campo ? '!border-dashed !border-ln-orange/60 text-ln-t4' : ''}`} aria-label="Campo">
          <option value="" disabled>Escolha o campo…</option>
          {CAMPOS_FILTRO.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <select value={r.operador} disabled={!campo} onChange={(e) => onChange({ operador: e.target.value, valor: campo.tipo === 'opcao' || campo.tipo === 'multi' ? r.valor : null })}
          className="ln-input !h-8 !w-[112px] shrink-0 !text-[12.5px] disabled:opacity-50" aria-label="Condição">
          {!campo && <option value="">—</option>}
          {ops.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <ValorRegra r={r} campo={campo} ctx={ctx} onChange={(valor) => onChange({ valor })} />
        <button onClick={onRemover} className="ln-iconbtn !w-7 !h-7 shrink-0 hover:!text-ln-red" aria-label="Remover condição" title="Remover condição"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
      {incompleta && <p className="pl-[58px] text-[11px] text-ln-orange">{!r.campo ? 'Escolha um campo.' : 'Escolha um valor.'} Enquanto isso, esta condição não filtra nada.</p>}
    </div>
  )
}

function PainelFiltros({ filtros, onChange, ctx, barra, total, mostrando, alterados, podeEditar, onSalvar, onReverter, onFechar }) {
  const n = contarRegras(filtros)
  const [focar, setFocar] = useState(null) // id da condição recém-criada
  const mudar = (fn) => { const f = structuredClone(filtros); fn(f); onChange(f) }
  const addGrupo = () => { const r = novaRegra(); setFocar(r.id); mudar((f) => { f.grupos.push({ id: idLocal(), op: 'e', regras: [r] }) }) }
  const addRegra = (gi) => { const r = novaRegra(); setFocar(r.id); mudar((f) => { f.grupos[gi].regras.push(r) }) }
  return (
    <>
      <div className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-ln-ink/[0.06]">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-ln-t1">
          <ListFilter className="w-4 h-4 text-ln-t3" />Filtros
          {n > 0 && <span className="h-5 min-w-5 px-1.5 rounded-full bg-ln-accent/15 text-ln-accent text-[11px] tabular grid place-items-center">{n}</span>}
        </span>
        <span className="flex items-center gap-2">
          <span className="text-[11px] text-ln-t4 tabular">{mostrando} de {total}</span>
          <button onClick={onFechar} className="ln-iconbtn !w-7 !h-7" aria-label="Fechar filtros"><X className="w-4 h-4" /></button>
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3">
        {barra.length > 0 && (
          <div className="rounded-lg bg-ln-ink/[0.035] px-3 py-2 flex flex-col gap-1.5">
            <span className="text-[11px] text-ln-t3">Somam com os filtros da barra:</span>
            <span className="flex flex-wrap gap-1">{barra.map((b) => <span key={b} className="h-6 px-2 rounded-md bg-ln-panel border border-ln-ink/[0.08] text-[11.5px] text-ln-t2 inline-flex items-center">{b}</span>)}</span>
          </div>
        )}

        {filtros.grupos.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-2 py-10 px-6">
            <span className="w-10 h-10 rounded-full bg-ln-ink/[0.05] grid place-items-center"><ListFilter className="w-5 h-5 text-ln-t3" /></span>
            <p className="text-[13px] text-ln-t1 font-medium">Nenhum filtro nesta visualização</p>
            <p className="text-xs text-ln-t4 leading-relaxed">Combine campos com E/OU e agrupe condições, como “prioridade alta E status a fazer” OU “vence ontem”. Os filtros ficam salvos com a visualização.</p>
            <button onClick={addGrupo} className="ln-primary !h-8 mt-1"><Plus className="w-3.5 h-3.5" /> Adicionar filtro</button>
          </div>
        ) : filtros.grupos.map((g, gi) => (
          <div key={g.id} className="flex items-start gap-1.5">
            <div className="pt-2.5"><Conector indice={gi} valor={filtros.op} onChange={(op) => mudar((f) => { f.op = op })} /></div>
            <div className="flex-1 min-w-0 rounded-lg border border-ln-ink/[0.08] bg-ln-ink/[0.025] p-2.5 flex flex-col gap-2">
              {g.regras.map((r, ri) => (
                <RegraFiltro
                  key={r.id} r={r} ctx={ctx} indice={ri} opGrupo={g.op} focar={focar === r.id} onFocado={() => setFocar(null)}
                  onOpGrupo={(op) => mudar((f) => { f.grupos[gi].op = op })}
                  onChange={(patch) => mudar((f) => { Object.assign(f.grupos[gi].regras[ri], patch) })}
                  onRemover={() => mudar((f) => { f.grupos[gi].regras.splice(ri, 1); if (!f.grupos[gi].regras.length) f.grupos.splice(gi, 1) })}
                />
              ))}
              <button onClick={() => addRegra(gi)} className={`self-start inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-xs text-ln-t3 hover:text-ln-t1 hover:bg-ln-ink/5 ${FOCO}`}>
                <Plus className="w-3 h-3" /> Adicionar filtro agrupado
              </button>
            </div>
          </div>
        ))}

        {filtros.grupos.length > 0 && mostrando === 0 && (
          <p className="text-xs text-ln-t3 bg-ln-orange/10 rounded-lg px-3 py-2">Nenhuma tarefa passa nesses filtros. Troque um “E” por “OU” ou remova uma condição.</p>
        )}
      </div>

      {filtros.grupos.length > 0 && (
        <div className="shrink-0 border-t border-ln-ink/[0.06]">
          {alterados && (
            <div className="flex items-center gap-1.5 px-4 py-2 bg-ln-orange/[0.06] text-[11.5px] text-ln-t2 border-b border-ln-ink/[0.06]">
              <i className="w-1.5 h-1.5 rounded-full bg-ln-orange shrink-0" /><span className="flex-1">Filtros diferentes dos salvos na visualização</span>
              <button onClick={onReverter} className="h-6 px-2 rounded-md hover:bg-ln-ink/5 text-ln-t3">Reverter</button>
              {podeEditar && <button onClick={onSalvar} className="h-6 px-2 rounded-md bg-ln-orange/15 text-ln-orange font-medium hover:bg-ln-orange/20">Salvar</button>}
            </div>
          )}
          <div className="p-3 flex items-center justify-between">
            <button onClick={addGrupo} className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-ln-ink/[0.1] text-[13px] text-ln-t2 hover:bg-ln-ink/5 ${FOCO}`}><Plus className="w-3.5 h-3.5" /> Adicionar filtro</button>
            <button onClick={() => onChange(FILTROS_VAZIOS)} className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-ln-red/40 text-[13px] text-ln-red hover:bg-ln-red/10 ${FOCO}`}>Apagar tudo</button>
          </div>
        </div>
      )}
    </>
  )
}
