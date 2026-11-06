// Módulo Sprints do VertaTask (?aba=sprints). Cada squad tem a sua sprint na semana, com as pessoas
// escolhidas para ela. A sprint começa pelas metas, cada meta é explodida em atividades e o % sai
// delas. Fechar conclui a semana, Planejar monta a próxima e Acompanhar mostra o andamento.
// Regras em src/lib/sprints.js, dados em useSprints.
// Na URL: ?aba=sprints&squad=<id>&sprint=<id>&pessoa=<id|time>&modo=planejar|acompanhar|fechar (sem pessoa = metas)
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, BookOpenCheck, Check, CheckCircle2, ChevronDown, Lock, Plus, Target, Trash2, Users, X, Loader2 } from 'lucide-react'
import { Avatar, FOCO, ItemMenu, Popover } from './Campos'
import { DataInput } from './Calendario'
import { BarraCarga, CartaoBurndown, TEXTO_CARGA, Tile, fmtPct } from './SprintComum'
import SprintMetas from './SprintMetas'
import SprintPlanejar from './SprintPlanejar'
import SprintAcompanhar from './SprintAcompanhar'
import SprintFechar from './SprintFechar'
import { deInputDate, pessoaDoPerfil } from '../../lib/tarefas'
import { hojeISO } from '../../lib/vertatask'
import {
  ROTULO_FASE_SPRINT, calcularBurndownSprint, classificarItem, diasUteisDoPeriodo, faseDaSprint, fmtMin, fmtPeriodo, modoPadrao,
  nTarefas, participantesDaSprint, pessoasPadraoDoSquad, planoDeFechamento, resumoDaPessoa, resumoDasMetas, resumoDoTime, sprintPadrao, sugerirSprint, velocidadeDaPessoa,
} from '../../lib/sprints'

const PREF_SQUAD = 'tarefas.sprints.squad'
const MODOS = [['fechar', 'Fechar'], ['planejar', 'Planejar'], ['acompanhar', 'Acompanhar']]
const ROTEIRO = [
  ['Resultado da semana', 'Em Fechar, meta por meta: quanto bateu, o que ficou aberto e o que entrou fora do plano. Depois a retro de cada pessoa.'],
  ['Concluir a sprint', 'Meta que não bateu continua na próxima ou encerra aqui. Cada atividade aberta vai junto ou volta para o backlog.'],
  ['Pessoas do squad', 'Na sprint nova, escolha quem compõe o squad naquela semana. Quem está nos dois squads tem uma capacidade só.'],
  ['Metas', 'Em Planejar, comece pelas grandes metas: o que precisa estar de pé até o fim da sprint, e como saber que foi batido.'],
  ['Atividades', 'Explode cada meta em atividades, escolhendo do backlog ou criando na hora. Olhe a carga de cada pessoa, pare na marca dos 85% e confirme.'],
]

function lerPref(chave, padrao) { try { return localStorage.getItem(chave) ?? padrao } catch { return padrao } }
function gravarPref(chave, v) { try { localStorage.setItem(chave, v) } catch { /* noop */ } }

function Roteiro({ onFechar }) {
  return (
    <section className="ln-card p-3 relative">
      {onFechar && <button type="button" onClick={onFechar} className="ln-iconbtn !w-6 !h-6 absolute top-2 right-2" aria-label="Fechar o roteiro"><X className="w-3.5 h-3.5" /></button>}
      <p className="text-[13px] font-semibold text-ln-t1">Roteiro da reunião de sexta <span className="font-normal text-ln-t4">até 2 horas</span></p>
      <ol className="mt-2 grid gap-x-4 gap-y-2 md:grid-cols-2 xl:grid-cols-5">
        {ROTEIRO.map(([t, d], i) => (
          <li key={t} className="text-xs text-ln-t3 leading-relaxed"><span className="font-semibold text-ln-t2">{i + 1}. {t}.</span> {d}</li>
        ))}
      </ol>
    </section>
  )
}

function FormNovaSprint({ inicial, membros, idsIniciais, onCriar, onCancelar, ocupado, nomeSquad }) {
  const [f, setF] = useState(inicial)
  const [ids, setIds] = useState(() => new Set(idsIniciais))
  const opcoes = useMemo(() => (membros || []).filter((m) => !m.disabled && m.name?.trim().toLowerCase() !== 'cliente').sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [membros])
  const valido = f.nome.trim() && f.inicio && f.fim && f.fim >= f.inicio && ids.size > 0
  const alternar = (id) => setIds((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (valido) onCriar({ ...f, ids: [...ids] }) }} className="ln-card p-3 flex flex-col gap-3">
      <div className="flex items-end gap-2 flex-wrap">
        <label className="flex flex-col gap-1 text-xs text-ln-t3">Nome<input className="ln-input !h-8 !w-[160px]" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></label>
        <label className="flex flex-col gap-1 text-xs text-ln-t3">Início<DataInput className="!h-8" value={f.inicio} onChange={(v) => setF({ ...f, inicio: v })} /></label>
        <label className="flex flex-col gap-1 text-xs text-ln-t3">Fim<DataInput className="!h-8" value={f.fim} onChange={(v) => setF({ ...f, fim: v })} /></label>
      </div>
      <fieldset>
        <legend className="text-xs text-ln-t3 mb-1.5">Quem compõe o {nomeSquad} nesta sprint</legend>
        <div className="flex flex-wrap gap-1.5">
          {opcoes.map((m) => {
            const marcado = ids.has(m.id)
            return (
              <button key={m.id} type="button" aria-pressed={marcado} onClick={() => alternar(m.id)} className={`inline-flex items-center gap-1.5 h-8 pl-1 pr-2.5 rounded-full text-xs ring-1 ring-inset transition-colors ${marcado ? 'bg-ln-accent/10 ring-ln-accent/40 text-ln-accent font-semibold' : 'ring-ln-line text-ln-t3 hover:bg-ln-ink/[0.04]'} ${FOCO}`}>
                <Avatar pessoa={pessoaDoPerfil(m)} size={22} className={marcado ? '' : 'opacity-50'} />{m.name}{marcado && <Check className="w-3 h-3" />}
              </button>
            )
          })}
        </div>
      </fieldset>
      <div className="flex items-center gap-2">
        <button type="submit" disabled={!valido || ocupado} className="ln-primary disabled:opacity-50"><Check className="w-3.5 h-3.5" /> Criar sprint</button>
        {onCancelar && <button type="button" onClick={onCancelar} className="ln-pill"><X className="w-3.5 h-3.5" /> Cancelar</button>}
        {!ids.size && <span className="text-xs text-ln-t4">Escolha ao menos uma pessoa.</span>}
      </div>
    </form>
  )
}

function ChipPessoa({ ativo, onClick, pessoa, resumo, modo }) {
  const texto = modo === 'planejar' ? `${fmtMin(resumo.totalMin)}/${fmtMin(resumo.capMin)}` : `${resumo.feitoTarefas}/${resumo.ativos.length}`
  return (
    <button type="button" onClick={onClick} aria-current={ativo || undefined} className={`inline-flex items-center gap-1.5 h-8 pl-1 pr-2 rounded-full text-xs whitespace-nowrap ring-1 ring-inset transition-colors ${ativo ? 'bg-ln-accent/10 ring-ln-accent/40 text-ln-accent font-semibold' : 'ring-ln-line text-ln-t2 hover:bg-ln-ink/[0.04]'} ${FOCO}`}>
      <Avatar pessoa={pessoa} size={22} />
      {pessoa.nome.split(' ')[0]}
      <span className={`tabular ${modo === 'planejar' ? TEXTO_CARGA[resumo.saude.nivel] : 'text-ln-t4'}`}>{texto}</span>
      {resumo.confirmada && <Lock className="w-3 h-3 text-ln-green" aria-label="Confirmada" />}
    </button>
  )
}

function AdicionarPessoa({ membros, onEscolher }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  if (!membros.length) return null
  return (
    <>
      <button ref={ref} type="button" onClick={() => setOpen((v) => !v)} className="ln-iconbtn !w-8 !h-8 !rounded-full ring-1 ring-inset ring-ln-line" aria-label="Colocar outra pessoa no squad nesta sprint" title="Colocar outra pessoa no squad nesta sprint"><Plus className="w-3.5 h-3.5" /></button>
      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={220}>
        <div className="p-1 overflow-y-auto">
          {membros.map((m) => <ItemMenu key={m.id} onClick={() => { setOpen(false); onEscolher(m) }}><Avatar pessoa={pessoaDoPerfil(m)} size={18} /><span className="truncate">{m.name}</span></ItemMenu>)}
        </div>
      </Popover>
    </>
  )
}

function CartaoConcluir({ sprint, fase, time, metas, onConcluir, ocupado }) {
  return (
    <div className="ln-card p-3 flex items-center gap-3 flex-wrap">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-ln-t1">{fase === 'concluida' ? `${sprint.nome} concluída` : `Concluir ${sprint.nome}`}</p>
        <p className="text-xs text-ln-t3 mt-0.5">
          {fase === 'concluida'
            ? `${metas.batidas} de ${metas.metas} metas batidas. O resultado está guardado e alimenta a média de entrega de cada pessoa.`
            : fase === 'ativa'
              ? 'A sprint ainda não terminou. Concluir agora congela o % das metas, e o que for entregue depois disso não conta nesta sprint.'
              : `${time.abertas === 1 ? '1 tarefa aberta segue' : `${time.abertas} tarefas abertas seguem`} a decisão de cada uma: próxima sprint ou backlog.`}
        </p>
      </div>
      {fase !== 'concluida' && (
        <button type="button" onClick={onConcluir} disabled={ocupado} className="ln-primary disabled:opacity-50">
          {ocupado ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Concluir sprint
        </button>
      )}
    </div>
  )
}

/** Visão do time: uma linha por pessoa do squad. */
function VisaoTime({ sprint, fase, modo, linhas, resumos, time, membrosMap, s, sprintsDoSquad, onPessoa, config, topo }) {
  const todas = useMemo(() => linhas.flatMap((l) => resumos.get(l.pessoa_id)?.lista || []), [linhas, resumos])
  const bd = useMemo(() => calcularBurndownSprint(sprint, todas, config), [sprint, todas, config])
  return (
    <div className="h-full overflow-y-auto p-3 flex flex-col gap-3">
      {topo}
      {modo === 'planejar' && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
          <Tile k="Planejado neste squad" v={fmtMin(time.planejadoMin)} sub={nTarefas(time.ativos)} />
          <Tile k="Confirmadas" v={`${time.confirmadas}/${linhas.length}`} tom={linhas.length && time.confirmadas === linhas.length ? 'green' : undefined} />
          <Tile k="Horas pelo tipo" v={String(time.semEstimativa)} sub="sem estimativa" dica="Tarefas sem estimativa contam as horas do tipo de tarefa, como na Capacidade do time" />
        </div>
      )}
      {modo === 'acompanhar' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
            <Tile k="Combinado" v={fmtMin(time.compromissoMin)} sub={nTarefas(time.compromissoTarefas)} />
            <Tile k="Entregue" v={fmtMin(time.feitoMin)} sub={nTarefas(time.feitoTarefas)} tom={time.feitoTarefas ? 'green' : undefined} />
            <Tile k="Falta" v={fmtMin(time.restanteMin)} sub={nTarefas(time.abertas)} />
            <Tile k="Fora do plano" v={fmtMin(time.foraMin)} sub={nTarefas(time.foras)} tom={time.foras ? 'yellow' : undefined} />
            <Tile k="Do combinado, saiu" v={fmtPct(time.sayDo)} />
          </div>
          <CartaoBurndown bd={bd} nome={`${sprint.nome}, time`} />
        </>
      )}
      <div className="ln-card !p-0 overflow-x-auto">
        <table className="w-full text-[13px] min-w-[760px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-ln-t4 border-b border-ln-ink/[0.06]">
              <th scope="col" className="font-medium py-2 px-3">Pessoa</th>
              {modo === 'planejar' && <th scope="col" className="font-medium py-2 px-2 w-[240px]">Carga da semana</th>}
              <th scope="col" className="font-medium py-2 px-2 text-right">Em metas</th>
              {modo !== 'planejar' && <th scope="col" className="font-medium py-2 px-2 text-right">Combinado</th>}
              {modo !== 'planejar' && <th scope="col" className="font-medium py-2 px-2 text-right">Entregue</th>}
              {modo !== 'planejar' && <th scope="col" className="font-medium py-2 px-2 text-right">Saiu</th>}
              {modo !== 'planejar' && <th scope="col" className="font-medium py-2 px-2 text-right">Fora do plano</th>}
              {modo !== 'planejar' && <th scope="col" className="font-medium py-2 px-2 text-right">Abertas</th>}
              {modo === 'planejar' && <th scope="col" className="font-medium py-2 px-2 text-right">Média entregue</th>}
              <th scope="col" className="font-medium py-2 px-3 text-right">{modo === 'fechar' ? 'Retro' : 'Situação'}</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const r = resumos.get(l.pessoa_id)
              const m = membrosMap.get(l.pessoa_id)
              if (!r || !m) return null
              const vel = velocidadeDaPessoa(sprintsDoSquad, s.pessoas, l.pessoa_id, sprint.inicio)
              return (
                <tr key={l.id} onClick={() => onPessoa(l.pessoa_id)} className="border-b border-ln-ink/[0.04] last:border-0 cursor-pointer ln-row-hover">
                  <td className="py-2 px-3">
                    <span className={`inline-flex items-center gap-2 whitespace-nowrap text-ln-t1 font-medium rounded ${FOCO}`}><Avatar pessoa={pessoaDoPerfil(m)} size={22} />{m.name}</span>
                    {l.riscos && <p className="text-[11px] text-ln-t3 truncate max-w-[320px] flex items-center gap-1 mt-0.5" title={l.riscos}><AlertTriangle className="w-3 h-3 text-ln-yellow shrink-0" />{l.riscos}</p>}
                  </td>
                  {modo === 'planejar' && (
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-[80px]"><BarraCarga saude={r.saude} altura={6} /></div>
                        <span className={`text-xs tabular whitespace-nowrap ${TEXTO_CARGA[r.saude.nivel]}`} title={r.outrosMin ? `Inclui ${fmtMin(r.outrosMin)} no outro squad` : undefined}>{fmtMin(r.totalMin)}<span className="text-ln-t4"> / {fmtMin(r.capMin)}</span></span>
                      </div>
                    </td>
                  )}
                  <td className={`py-2 px-2 text-right tabular ${r.semMeta ? 'text-ln-yellow' : 'text-ln-t2'}`}>{r.ativos.length - r.semMeta}/{r.ativos.length}</td>
                  {modo !== 'planejar' && <td className="py-2 px-2 text-right tabular text-ln-t2">{fmtMin(r.compromissoMin)}</td>}
                  {modo !== 'planejar' && <td className="py-2 px-2 text-right tabular text-ln-t2">{fmtMin(r.feitoMin)}</td>}
                  {modo !== 'planejar' && <td className="py-2 px-2 text-right tabular text-ln-t2">{fmtPct(r.sayDo)}</td>}
                  {modo !== 'planejar' && <td className={`py-2 px-2 text-right tabular ${r.foras.length ? 'text-ln-yellow' : 'text-ln-t4'}`}>{fmtMin(r.foraMin)}</td>}
                  {modo !== 'planejar' && <td className="py-2 px-2 text-right tabular text-ln-t2">{r.abertas.length}</td>}
                  {modo === 'planejar' && <td className="py-2 px-2 text-right tabular text-ln-t3">{vel ? fmtMin(vel.mediaEntregueMin) : '-'}</td>}
                  <td className="py-2 px-3 text-right whitespace-nowrap">
                    {modo === 'fechar'
                      ? (l.retro_mudanca ? <span className="text-xs text-ln-green">Feita</span> : <span className="text-xs text-ln-t4">Falta</span>)
                      : (r.confirmada ? <span className="inline-flex items-center gap-1 text-xs text-ln-green"><Lock className="w-3 h-3" />Confirmada</span> : <span className="text-xs text-ln-t4">{r.ativos.length ? 'Rascunho' : 'Vazia'}</span>)}
                  </td>
                </tr>
              )
            })}
            {!linhas.length && <tr><td colSpan={8} className="py-8 text-center text-ln-t4">Ninguém nesta sprint ainda.</td></tr>}
          </tbody>
        </table>
      </div>
      {fase === 'futura' && !linhas.length && <p className="text-xs text-ln-t4">Use o + ao lado das pessoas para compor o squad.</p>}
    </div>
  )
}

export default function SprintsView({ s, t, squads, projetos, membros, membrosMap, user, onAbrirTarefa, tarefaAbertaId, onToast, confirmar }) {
  const [params, setParams] = useSearchParams()
  const [roteiro, setRoteiro] = useState(null) // null = sozinho: aberto só enquanto a sprint não tem meta
  const [criando, setCriando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const hoje = hojeISO()

  // ── Squad ────────────────────────────────────────────────────────────────
  const squadsAtivos = useMemo(() => (squads || []).filter((x) => !x.isTest && !x.is_test), [squads])
  const squad = useMemo(() => {
    const achar = (id) => squadsAtivos.find((x) => x.id === id)
    return achar(params.get('squad')) || achar(lerPref(PREF_SQUAD, null))
      || squadsAtivos.find((x) => (x.members || []).some((m) => m.profile_id === user?.id)) || squadsAtivos[0] || null
  }, [squadsAtivos, params, user?.id])
  useEffect(() => { if (squad) gravarPref(PREF_SQUAD, squad.id) }, [squad])

  const ordenadas = useMemo(() => s.sprints.filter((x) => x.squad_id === squad?.id).sort((a, b) => a.inicio.localeCompare(b.inicio)), [s.sprints, squad?.id])
  const sprint = useMemo(() => ordenadas.find((x) => x.id === params.get('sprint')) || sprintPadrao(ordenadas, hoje), [ordenadas, params, hoje])
  const idx = sprint ? ordenadas.findIndex((x) => x.id === sprint.id) : -1
  const anterior = idx > 0 ? ordenadas[idx - 1] : null
  const proxima = idx >= 0 && idx < ordenadas.length - 1 ? ordenadas[idx + 1] : null
  const fase = faseDaSprint(sprint, hoje)
  const modoUrl = params.get('modo')
  const modo = MODOS.some(([k]) => k === modoUrl) && !(fase === 'concluida' && modoUrl === 'planejar') && !(fase === 'futura' && modoUrl === 'fechar') ? modoUrl : modoPadrao(fase)
  const pessoaParam = params.get('pessoa')

  const ir = (patch) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) { if (v) p.set(k, v); else p.delete(k) }
    p.delete('tarefa')
    setParams(p, { replace: true })
  }

  // sprints dos outros squads na mesma semana: quem está nos dois tem uma capacidade só
  const outrasDaSemana = useMemo(() => (sprint ? s.sprints.filter((x) => x.squad_id !== sprint.squad_id && x.inicio <= sprint.fim && x.fim >= sprint.inicio) : []), [s.sprints, sprint])

  // Carrega a sprint aberta, a anterior (o transbordo vem dela), as da mesma semana e as tarefas citadas.
  const { carregarItens } = s
  const idsSprints = useMemo(() => [sprint?.id, anterior?.id, ...outrasDaSemana.map((x) => x.id)].filter(Boolean), [sprint?.id, anterior?.id, outrasDaSemana])
  useEffect(() => { carregarItens(idsSprints) }, [carregarItens, idsSprints])
  const { carregarAbertas, carregarPorIds, itens: tarefasMap } = t
  useEffect(() => { carregarAbertas() }, [carregarAbertas])
  const pedidas = useRef(new Set())
  useEffect(() => {
    const faltam = s.itens.map((i) => i.tarefa_id).filter((id) => !tarefasMap[id] && !pedidas.current.has(id))
    if (!faltam.length) return
    for (const id of faltam) pedidas.current.add(id)
    carregarPorIds(faltam)
  }, [s.itens, tarefasMap, carregarPorIds])

  const linhas = useMemo(() => {
    const ls = sprint ? (s.pessoasPorSprint.get(sprint.id) || []) : []
    return [...ls].sort((a, b) => (membrosMap.get(a.pessoa_id)?.name || '').localeCompare(membrosMap.get(b.pessoa_id)?.name || '', 'pt-BR'))
  }, [sprint, s.pessoasPorSprint, membrosMap])
  const itensDaSprint = useMemo(() => s.itens.filter((i) => i.sprint_id === sprint?.id), [s.itens, sprint?.id])
  const itensAnterior = useMemo(() => s.itens.filter((i) => i.sprint_id === anterior?.id), [s.itens, anterior?.id])
  const metas = useMemo(() => s.metas.filter((m) => m.sprint_id === sprint?.id), [s.metas, sprint?.id])

  // carga de cada pessoa nos outros squads, na mesma semana
  const outros = useMemo(() => {
    const m = new Map()
    for (const o of outrasDaSemana) {
      const nomeSq = squadsAtivos.find((x) => x.id === o.squad_id)?.name || 'outro squad'
      for (const l of s.pessoasPorSprint.get(o.id) || []) {
        if (!m.has(l.pessoa_id)) m.set(l.pessoa_id, { min: 0, nomes: [], linhas: [] })
        const e = m.get(l.pessoa_id)
        e.linhas.push(l)
        if (!e.nomes.includes(nomeSq)) e.nomes.push(nomeSq)
      }
      for (const i of s.itens) {
        if (i.sprint_id !== o.id || !m.has(i.pessoa_id)) continue
        const c = classificarItem(i, tarefasMap[i.tarefa_id], o, s.config)
        if (!c.removida && !c.antecipada) m.get(i.pessoa_id).min += c.min
      }
    }
    return m
  }, [outrasDaSemana, s.pessoasPorSprint, s.itens, tarefasMap, s.config, squadsAtivos])

  const resumos = useMemo(() => {
    const m = new Map()
    if (!sprint) return m
    for (const l of linhas) m.set(l.pessoa_id, resumoDaPessoa(l, itensDaSprint.filter((i) => i.pessoa_id === l.pessoa_id), tarefasMap, sprint, s.config, outros.get(l.pessoa_id)?.min || 0))
    return m
  }, [linhas, itensDaSprint, tarefasMap, sprint, s.config, outros])
  const time = useMemo(() => {
    const r = resumoDoTime([...resumos.values()])
    r.ativos = [...resumos.values()].reduce((a, x) => a + x.ativos.length, 0)
    return r
  }, [resumos])
  const classificados = useMemo(() => [...resumos.values()].flatMap((r) => r.lista), [resumos])
  const resumoMetas = useMemo(() => resumoDasMetas(metas, classificados), [metas, classificados])
  const verTime = pessoaParam === 'time'
  const linhaSel = pessoaParam && !verTime ? linhas.find((l) => l.pessoa_id === pessoaParam) || null : null
  const sugestao = useMemo(() => sugerirSprint(ordenadas, t.listas, hoje, s.sprints), [ordenadas, t.listas, hoje, s.sprints])
  const nomesSprints = useMemo(() => new Map(s.sprints.map((x) => [x.id, x.nome])), [s.sprints])

  // o que já está na sprint não aparece para escolher; o transbordo é o aberto da sprint anterior
  const idsNaSprint = useMemo(() => new Set(itensDaSprint.filter((i) => !i.removida_em).map((i) => i.tarefa_id)), [itensDaSprint])
  const idsTransbordo = useMemo(() => new Set(itensAnterior.filter((i) => !i.removida_em && (!i.resultado || i.resultado === 'transbordou')).map((i) => i.tarefa_id)), [itensAnterior])

  // squad de uma tarefa: lista → pasta → projeto do cliente
  const squadPorPasta = useMemo(() => {
    const doProjeto = new Map((projetos || []).map((p) => [p.id, p.squad || null]))
    return new Map(t.pastas.map((p) => [p.id, p.project_id ? doProjeto.get(p.project_id) || null : null]))
  }, [projetos, t.pastas])
  const pastasOrdenadas = useMemo(() => [...t.pastas].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [t.pastas])
  const squadAtualId = squad?.id
  const todasListas = t.listas
  const opcoesLista = useMemo(() => {
    const grupos = pastasOrdenadas.map((p) => ({ pastaId: p.id, nome: p.nome, doSquad: squadPorPasta.get(p.id) === squadAtualId, listas: todasListas.filter((l) => l.pasta_id === p.id) })).filter((g) => g.listas.length)
    return [...grupos.filter((g) => g.doSquad), ...grupos.filter((g) => !g.doSquad)]
  }, [pastasOrdenadas, squadPorPasta, squadAtualId, todasListas])

  const ctx = useMemo(() => ({
    itens: tarefasMap, listasMap: t.listasMap, config: s.config, onAbrirTarefa, tarefaAbertaId,
    clienteDe: (tarefa) => {
      const l = t.listasMap.get(tarefa.lista_id)
      return (l && t.pastasMap.get(l.pasta_id)?.nome) || l?.nome || ''
    },
    squadDe: (tarefa) => squadPorPasta.get(t.listasMap.get(tarefa.lista_id)?.pasta_id) || null,
    onStatus: async (tarefa, st) => { const r = await t.mudarStatus(tarefa, st); if (r?.error) onToast(r.error, 'error') },
    onEstimativa: async (tarefa, v) => { const r = await t.atualizarTarefa(tarefa.id, { estimativa_min: v }); if (r?.error) onToast(r.error, 'error') },
  }), [tarefasMap, t, s.config, onAbrirTarefa, tarefaAbertaId, onToast, squadPorPasta])

  // ── Ações ────────────────────────────────────────────────────────────────
  const atribuir = async (tarefa, pessoaId) => {
    const resp = tarefa.responsaveis || []
    if (resp.includes(pessoaId)) return
    const r = await t.atualizarTarefa(tarefa.id, { responsaveis: [...resp, pessoaId] })
    if (r?.error) onToast(r.error, 'error')
  }
  const confirmarLinha = (linha, resumo) => s.confirmarPessoa(linha, resumo.ativos.map((c) => ({ id: c.item.id, min: c.min })))
  const acoes = {
    // tarefa de fora da pessoa entra na sprint e ela passa a ser responsável também (segue para o ClickUp)
    adicionar: async (linha, tarefas) => {
      const r = await s.adicionarTarefas(sprint.id, linha, tarefas)
      if (r.error) { onToast(r.error, 'error'); return }
      for (const x of tarefas) await atribuir(x, linha.pessoa_id)
      if (tarefas.length > 1) onToast(`${nTarefas(tarefas.length)} na sprint`)
    },
    remover: async (c, linha) => {
      const r = await s.removerItem(c.item, linha)
      if (r.error) onToast(r.error, 'error')
    },
    delegar: async (c, de, para) => {
      const r = await s.removerItem(c.item, de)
      if (r.error) { onToast(r.error, 'error'); return }
      const a = await s.adicionarTarefas(sprint.id, para, [c.tarefa], { origem: c.item.origem, metaId: c.item.meta_id })
      if (a.error) { onToast(a.error, 'error'); return }
      const resp = (c.tarefa.responsaveis || []).filter((id) => id !== de.pessoa_id)
      const u = await t.atualizarTarefa(c.tarefa.id, { responsaveis: resp.includes(para.pessoa_id) ? resp : [...resp, para.pessoa_id] })
      if (u?.error) onToast(u.error, 'error')
      else onToast(`Passou para ${membrosMap.get(para.pessoa_id)?.name?.split(' ')[0] || 'outra pessoa'}`)
    },
    // quem já é responsável e está no squad fica com a tarefa; sem ninguém do squad, vai para quem foi escolhido
    adicionarNaMeta: async (meta, tarefas, quemFaz) => {
      const porPessoa = new Map()
      for (const x of tarefas) {
        const dono = (x.responsaveis || []).find((id) => linhas.some((l) => l.pessoa_id === id)) || quemFaz
        if (!porPessoa.has(dono)) porPessoa.set(dono, [])
        porPessoa.get(dono).push(x)
      }
      for (const [pessoaId, lista] of porPessoa) {
        const linha = linhas.find((l) => l.pessoa_id === pessoaId)
        if (!linha) { onToast('Coloque alguém no squad antes de escolher atividades', 'error'); return }
        const r = await s.adicionarTarefas(sprint.id, linha, lista, { metaId: meta.id })
        if (r.error) { onToast(r.error, 'error'); return }
        for (const x of lista) await atribuir(x, pessoaId)
      }
      if (tarefas.length > 1) onToast(`${nTarefas(tarefas.length)} na meta`)
    },
    // vence no último dia útil da sprint; muda na própria tarefa se precisar. Segue para o ClickUp.
    criarAtividade: async (meta, { titulo, lista_id, pessoa_id }) => {
      const dias = diasUteisDoPeriodo(sprint.inicio, sprint.fim, s.config)
      const venc = dias[dias.length - 1] || sprint.fim
      const r = await t.criarTarefa({ lista_id, titulo, responsaveis: [pessoa_id], data_vencimento: deInputDate(venc) })
      if (r.error) { onToast(r.error, 'error'); return false }
      const linha = linhas.find((l) => l.pessoa_id === pessoa_id)
      const a = await s.adicionarTarefas(sprint.id, linha, [r.data], { metaId: meta.id })
      if (a.error) { onToast(a.error, 'error'); return false }
      return true
    },
    criarMeta: async (titulo) => {
      const r = await s.criarMeta(sprint.id, { titulo })
      if (r.error) { onToast(r.error, 'error'); return false }
      return true
    },
    excluirMeta: async (meta, n) => {
      const ok = await confirmar({
        perigo: true, titulo: 'Excluir esta meta?', acao: 'Excluir', itens: [meta.titulo], rotuloItens: 'Meta a ser excluída',
        texto: n ? `As ${n === 1 ? 'tarefa continua' : `${n} tarefas continuam`} na sprint, só ficam sem meta.` : 'Ela ainda não tem atividades.',
      })
      if (!ok) return
      const r = await s.excluirMeta(meta.id)
      if (r.error) onToast(r.error, 'error')
    },
    // capacidade é da pessoa na semana: vale também para a linha dela no outro squad
    capacidade: (linha, patch) => {
      s.atualizarPessoa(linha.id, patch)
      for (const o of outros.get(linha.pessoa_id)?.linhas || []) s.atualizarPessoa(o.id, patch)
    },
    confirmarPessoa: async (linha, resumo) => {
      const avisos = []
      if (resumo.semMeta) avisos.push(`${resumo.semMeta === 1 ? '1 tarefa não ajuda' : `${resumo.semMeta} tarefas não ajudam`} a bater nenhuma meta`)
      if (resumo.saude.nivel === 'passou') avisos.push(`Passou da capacidade: ${fmtMin(resumo.totalMin)} de ${fmtMin(resumo.capMin)}`)
      else if (resumo.saude.nivel === 'justa') avisos.push(`Sem folga para imprevisto: ${fmtMin(resumo.totalMin)} de ${fmtMin(resumo.capMin)}`)
      if (resumo.semEstimativa) avisos.push(`${resumo.semEstimativa} sem estimativa, contando as horas pelo tipo de tarefa`)
      const nome = membrosMap.get(linha.pessoa_id)?.name || 'pessoa'
      const ok = await confirmar({
        titulo: `Confirmar a sprint de ${nome}?`, acao: 'Confirmar', icone: Lock,
        texto: `${fmtMin(resumo.planejadoMin)} em ${nTarefas(resumo.ativos.length)} viram o compromisso da semana. O que entrar depois fica marcado como fora do plano.`,
        ...(avisos.length ? { rotuloItens: 'Vale olhar antes', itens: avisos } : {}),
      })
      if (!ok) return
      const r = await confirmarLinha(linha, resumo)
      if (r.error) onToast(r.error, 'error'); else onToast(`Sprint de ${nome.split(' ')[0]} confirmada`)
    },
    confirmarSquad: async () => {
      const faltam = linhas.filter((l) => !resumos.get(l.pessoa_id)?.confirmada && resumos.get(l.pessoa_id)?.ativos.length)
      const passaram = faltam.filter((l) => resumos.get(l.pessoa_id).saude.nivel === 'passou').map((l) => membrosMap.get(l.pessoa_id)?.name?.split(' ')[0]).filter(Boolean)
      const avisos = []
      if (time.semMeta) avisos.push(`${time.semMeta === 1 ? '1 tarefa não ajuda' : `${time.semMeta} tarefas não ajudam`} a bater nenhuma meta`)
      if (passaram.length) avisos.push(`Passou da capacidade: ${passaram.join(', ')}`)
      const vazias = metas.filter((m) => !classificados.some((c) => c.item.meta_id === m.id && !c.removida)).length
      if (vazias) avisos.push(`${vazias === 1 ? '1 meta sem atividade' : `${vazias} metas sem atividade`}`)
      const ok = await confirmar({
        titulo: `Confirmar a sprint do ${squad?.name}?`, acao: 'Confirmar', icone: Lock,
        texto: `${faltam.length === 1 ? '1 pessoa confirma' : `${faltam.length} pessoas confirmam`} o compromisso da semana. O que entrar depois fica marcado como fora do plano.`,
        ...(avisos.length ? { rotuloItens: 'Vale olhar antes', itens: avisos } : {}),
      })
      if (!ok) return
      for (const l of faltam) {
        const r = await confirmarLinha(l, resumos.get(l.pessoa_id))
        if (r.error) { onToast(r.error, 'error'); return }
      }
      onToast('Sprint do squad confirmada')
    },
    reabrirPessoa: async (linha) => {
      const r = await s.reabrirPessoa(linha)
      if (r.error) onToast(r.error, 'error'); else onToast('Planejamento reaberto')
    },
    removerPessoa: async (linha) => {
      const r = await s.removerPessoa(linha)
      if (r.error) onToast(r.error, 'error')
      else ir({ pessoa: null })
    },
  }

  const criar = async (f) => {
    setOcupado(true)
    const numero = /(\d+)/.exec(f.nome)?.[1] ? Number(/(\d+)/.exec(f.nome)[1]) : f.numero
    const r = await s.criarSprint({ ...f, squad_id: squad.id, numero, membros, cfg: s.config })
    setOcupado(false)
    if (r.error) { onToast(r.error, 'error'); return }
    setCriando(false)
    ir({ sprint: r.data.id, modo: 'planejar', pessoa: null })
  }

  const excluir = async () => {
    const n = itensDaSprint.length
    const ok = await confirmar({
      perigo: true, titulo: `Excluir ${sprint.nome} do ${squad?.name}?`, acao: 'Excluir',
      texto: `As tarefas continuam onde estão${n ? `, só saem da sprint (${n})` : ''}. As metas e a retro de cada pessoa são apagadas.`,
    })
    if (!ok) return
    const r = await s.excluirSprint(sprint.id)
    if (r.error) onToast(r.error, 'error'); else { onToast('Sprint excluída'); ir({ sprint: null, modo: null, pessoa: null }) }
  }

  const concluir = async () => {
    const previa = planoDeFechamento({ sprint, proxima: proxima || { id: 'previa' }, pessoas: linhas, itens: itensDaSprint, tarefas: tarefasMap, metas, cfg: s.config, proximasPessoas: [], novoId: () => 'previa' })
    const destino = proxima?.nome || sugestao.nome
    const semRetro = linhas.filter((l) => !l.retro_mudanca?.trim()).map((l) => membrosMap.get(l.pessoa_id)?.name?.split(' ')[0]).filter(Boolean)
    const itens = [
      ...(metas.length ? [`${previa.batidas} de ${metas.length} metas batidas, ${previa.novasMetas.length} ${previa.novasMetas.length === 1 ? 'continua' : 'continuam'} na ${destino}`] : []),
      `${previa.transbordo === 1 ? '1 tarefa vai' : `${previa.transbordo} tarefas vão`} para a ${destino}, ${previa.devolvidas === 1 ? '1 volta' : `${previa.devolvidas} voltam`} ao backlog`,
      ...(semRetro.length ? [`Retro sem a mudança combinada: ${semRetro.join(', ')}`] : []),
    ]
    const ok = await confirmar({
      titulo: `Concluir ${sprint.nome} do ${squad?.name}?`, acao: 'Concluir', icone: CheckCircle2,
      texto: `Andamento das metas: ${resumoMetas.pct}%. Entregue: ${fmtMin(time.feitoMin)} de ${fmtMin(time.compromissoMin)} combinadas. O resultado fica guardado e não muda mais.`,
      rotuloItens: 'O que acontece', itens,
    })
    if (!ok) return
    setOcupado(true)
    const r = await s.concluirSprint({ sprint, proxima, sugestao, tarefas: tarefasMap, membros, cfg: s.config, itensDaSprint })
    setOcupado(false)
    if (r.error) { onToast(r.error, 'error'); return }
    onToast(`${sprint.nome} concluída`)
    ir({ sprint: r.data.proxima.id, modo: 'planejar', pessoa: null })
  }

  const adicionarPessoa = async (m) => {
    const [linha] = participantesDaSprint({ membros: [m], inicio: sprint.inicio, fim: sprint.fim, cfg: s.config })
    if (!linha) { onToast('Esse perfil não entra em sprint', 'error'); return }
    // quem já está no outro squad na semana mantém a mesma capacidade
    const noOutro = outros.get(m.id)?.linhas[0]
    const r = await s.adicionarPessoa(sprint.id, noOutro ? { ...linha, dias_disponiveis: noOutro.dias_disponiveis, horas_dia: noOutro.horas_dia } : linha)
    if (r.error) onToast(r.error, 'error')
  }
  const foraDaSprint = useMemo(() => (membros || []).filter((m) => !m.disabled && m.name?.trim().toLowerCase() !== 'cliente' && !linhas.some((l) => l.pessoa_id === m.id)), [membros, linhas])

  // ── Tela ─────────────────────────────────────────────────────────────────
  const barraSquads = squadsAtivos.length > 0 && (
    <div className="inline-flex rounded-lg ring-1 ring-inset ring-ln-line p-0.5" role="group" aria-label="Squad">
      {squadsAtivos.map((q) => (
        <button key={q.id} type="button" aria-pressed={q.id === squad?.id} onClick={() => { setCriando(false); ir({ squad: q.id, sprint: null, pessoa: null, modo: null }) }} className={`h-7 px-3 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${q.id === squad?.id ? 'bg-ln-accent text-white' : 'text-ln-t2 hover:bg-ln-ink/5'} ${FOCO}`}>
          {q.emoji ? `${q.emoji} ` : ''}{q.name}
        </button>
      ))}
    </div>
  )
  const idsPadrao = pessoasPadraoDoSquad(squad, ordenadas.length ? (s.pessoasPorSprint.get(ordenadas[ordenadas.length - 1].id) || []) : [])

  if (s.loading) return <div className="flex items-center justify-center py-20 text-ln-t4 text-[13px] gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando sprints…</div>
  if (!squad) return <p className="py-20 text-center text-[13px] text-ln-t4">Nenhum squad cadastrado. Crie um em Usuários, na aba Equipes.</p>

  if (!sprint) {
    return (
      <div className="h-full overflow-y-auto p-3 flex flex-col gap-3">
        <div>{barraSquads}</div>
        <div className="ln-card p-5 max-w-3xl flex flex-col gap-3">
          <div>
            <p className="text-[15px] font-semibold text-ln-t1 flex items-center gap-2"><BookOpenCheck className="w-4 h-4 text-ln-accent" /> Primeira sprint do {squad.name}</p>
            <p className="text-[13px] text-ln-t3 mt-1">A numeração continua a da pasta Sprint do ClickUp, a mesma para os dois squads. Depois de criar, a sprint começa pelas metas.</p>
          </div>
          <FormNovaSprint key={squad.id} inicial={sugestao} membros={membros} idsIniciais={idsPadrao} onCriar={criar} ocupado={ocupado} nomeSquad={squad.name} />
          {s.erro && <p className="text-xs text-ln-red">{s.erro}</p>}
        </div>
        <Roteiro />
      </div>
    )
  }

  const verMetas = !verTime && !linhaSel
  const verRoteiro = roteiro ?? (verMetas && !metas.length)
  const alternarRoteiro = () => setRoteiro(!verRoteiro)
  const modosVisiveis = MODOS.filter(([k]) => !(fase === 'concluida' && k === 'planejar') && !(fase === 'futura' && k === 'fechar'))
  const visiveis = ordenadas.slice(-6)
  const chipAtivo = (ativo) => `inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full text-xs whitespace-nowrap ring-1 ring-inset ${ativo ? 'bg-ln-accent/10 ring-ln-accent/40 text-ln-accent font-semibold' : 'ring-ln-line text-ln-t2 hover:bg-ln-ink/[0.04]'} ${FOCO}`
  const cartaoConcluir = modo === 'fechar' ? <CartaoConcluir sprint={sprint} fase={fase} time={time} metas={resumoMetas} onConcluir={concluir} ocupado={ocupado} /> : null

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="shrink-0 px-3 pt-3 pb-2 flex flex-col gap-2 border-b border-ln-ink/[0.06]">
        <div className="flex items-center gap-1.5 flex-wrap">
          {barraSquads}
          {visiveis.map((x) => (
            <button key={x.id} type="button" onClick={() => ir({ sprint: x.id, modo: null })} aria-current={x.id === sprint.id || undefined} className={`ln-tab ${x.id === sprint.id ? 'ln-tab-active' : ''} ${FOCO}`}>
              {x.concluida_em && <CheckCircle2 className="w-3 h-3 text-ln-green" aria-label="Concluída" />}{x.nome} <span className="text-ln-t4 font-normal">{fmtPeriodo(x)}</span>
            </button>
          ))}
          {!criando && <button type="button" onClick={() => setCriando(true)} className="ln-pill"><Plus className="w-3.5 h-3.5" /> Nova sprint</button>}
          <span className={`ln-pill !h-6 text-[11px] ${fase === 'ativa' ? '!text-ln-green' : fase === 'encerrada' ? '!text-ln-yellow' : ''}`}>{ROTULO_FASE_SPRINT[fase]}</span>
          {fase === 'futura' && (
            <button type="button" onClick={excluir} className="ln-iconbtn !w-7 !h-7 hover:!text-ln-red" aria-label={`Excluir ${sprint.nome}`} title="Excluir esta sprint"><Trash2 className="w-3.5 h-3.5" /></button>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <button type="button" onClick={alternarRoteiro} aria-expanded={verRoteiro} className="ln-pill"><BookOpenCheck className="w-3.5 h-3.5" /> Roteiro <ChevronDown className={`w-3 h-3 transition-transform ${verRoteiro ? 'rotate-180' : ''}`} /></button>
            <div className="inline-flex rounded-lg ring-1 ring-inset ring-ln-line p-0.5" role="group" aria-label="Etapa da sprint">
              {modosVisiveis.map(([k, r]) => (
                <button key={k} type="button" aria-pressed={modo === k} onClick={() => ir({ modo: k })} className={`h-7 px-3 rounded-md text-xs font-medium transition-colors ${modo === k ? 'bg-ln-ink/[0.08] text-ln-t1' : 'text-ln-t3 hover:bg-ln-ink/5'} ${FOCO}`}>{r}</button>
              ))}
            </div>
          </div>
        </div>
        {criando && <FormNovaSprint key={sugestao.inicio} inicial={sugestao} membros={membros} idsIniciais={idsPadrao} onCriar={criar} onCancelar={() => setCriando(false)} ocupado={ocupado} nomeSquad={squad.name} />}
        {verRoteiro && <Roteiro onFechar={alternarRoteiro} />}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <button type="button" onClick={() => ir({ pessoa: null })} aria-current={verMetas || undefined} className={chipAtivo(verMetas)}><Target className="w-3.5 h-3.5" /> Metas <span className="tabular text-ln-t4 font-normal">{resumoMetas.pct}%</span></button>
          <button type="button" onClick={() => ir({ pessoa: 'time' })} aria-current={verTime || undefined} className={chipAtivo(verTime)}><Users className="w-3.5 h-3.5" /> Time</button>
          <span className="w-px h-5 bg-ln-ink/10 mx-0.5 shrink-0" aria-hidden="true" />
          {linhas.map((l) => {
            const m = membrosMap.get(l.pessoa_id)
            const r = resumos.get(l.pessoa_id)
            if (!m || !r) return null
            return <ChipPessoa key={l.id} ativo={linhaSel?.id === l.id} onClick={() => ir({ pessoa: l.pessoa_id })} pessoa={pessoaDoPerfil(m)} resumo={r} modo={modo} />
          })}
          {fase !== 'concluida' && <AdicionarPessoa membros={foraDaSprint} onEscolher={adicionarPessoa} />}
        </div>
        {s.erro && <p className="text-xs text-ln-red">{s.erro}</p>}
      </div>

      <div className="flex-1 min-h-0">
        {verMetas ? (
          <SprintMetas
            key={sprint.id} sprint={sprint} fase={fase} modo={modo} metas={metas} classificados={classificados} linhas={linhas} resumos={resumos}
            s={s} ctx={ctx} acoes={acoes} membrosMap={membrosMap} tarefasMap={tarefasMap} idsNaSprint={idsNaSprint} idsTransbordo={idsTransbordo}
            opcoesLista={opcoesLista} pastas={pastasOrdenadas} squadId={squad.id} nomesSprints={nomesSprints} topo={cartaoConcluir}
          />
        ) : verTime ? (
          <VisaoTime sprint={sprint} fase={fase} modo={modo} linhas={linhas} resumos={resumos} time={time} membrosMap={membrosMap} s={s} sprintsDoSquad={ordenadas} config={s.config} onPessoa={(id) => ir({ pessoa: id })} topo={cartaoConcluir} />
        ) : modo === 'planejar' ? (
          <SprintPlanejar
            key={linhaSel.id} sprint={sprint} anterior={anterior} fase={fase} linha={linhaSel} resumo={resumos.get(linhaSel.pessoa_id)} tarefasMap={tarefasMap}
            idsNaSprint={idsNaSprint} idsTransbordo={idsTransbordo} outros={outros.get(linhaSel.pessoa_id)} pessoasSprint={linhas} metas={metas} sprintsDoSquad={ordenadas} squadId={squad.id}
            s={s} ctx={ctx} acoes={acoes} membrosMap={membrosMap} somenteLeitura={fase === 'concluida'}
          />
        ) : modo === 'fechar' ? (
          <SprintFechar key={linhaSel.id} fase={fase} linha={linhaSel} resumo={resumos.get(linhaSel.pessoa_id)} s={s} ctx={ctx} membrosMap={membrosMap} />
        ) : (
          <SprintAcompanhar key={linhaSel.id} sprint={sprint} fase={fase} linha={linhaSel} resumo={resumos.get(linhaSel.pessoa_id)} ctx={ctx} membrosMap={membrosMap} config={s.config} />
        )}
      </div>
    </div>
  )
}
