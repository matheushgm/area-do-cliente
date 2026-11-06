// Módulo Sprints do VertaTask (?aba=sprints). Uma sprint por semana e, dentro dela, uma sprint
// para cada pessoa. A tela segue a reunião de sexta: Fechar a semana que termina, Planejar a próxima
// pessoa por pessoa e Acompanhar durante a semana. Regras em src/lib/sprints.js, dados em useSprints.
// Na URL: ?aba=sprints&sprint=<id>&pessoa=<id|time>&modo=planejar|acompanhar|fechar
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, BookOpenCheck, Check, CheckCircle2, ChevronDown, Lock, Plus, Trash2, Users, X, Loader2 } from 'lucide-react'
import { Avatar, FOCO, ItemMenu, Popover } from './Campos'
import { DataInput } from './Calendario'
import { BarraCarga, CartaoBurndown, TEXTO_CARGA, Tile, fmtPct } from './SprintComum'
import SprintPlanejar from './SprintPlanejar'
import SprintAcompanhar from './SprintAcompanhar'
import SprintFechar from './SprintFechar'
import { pessoaDoPerfil } from '../../lib/tarefas'
import { hojeISO } from '../../lib/vertatask'
import {
  ROTULO_FASE_SPRINT, calcularBurndownSprint, faseDaSprint, fmtMin, fmtPeriodo, modoPadrao,
  nTarefas, participantesDaSprint, planoDeFechamento, resumoDaPessoa, resumoDoTime, sprintPadrao, sugerirSprint, velocidadeDaPessoa,
} from '../../lib/sprints'

const PREF_ROTEIRO = 'tarefas.sprints.roteiro'
const MODOS = [['fechar', 'Fechar'], ['planejar', 'Planejar'], ['acompanhar', 'Acompanhar']]
const ROTEIRO = [
  ['Resultado da semana', 'Em Fechar, pessoa por pessoa: o que foi combinado, o que saiu e o que entrou fora do plano.'],
  ['Retro de cada um', 'O que funcionou, o que travou e uma mudança para a semana seguinte. A mudança aparece no planejamento da próxima sprint.'],
  ['Concluir a sprint', 'Cada tarefa aberta vai para a próxima sprint ou volta para o backlog. A próxima já nasce com o transbordo dentro.'],
  ['Planejar a próxima', 'Em Planejar, o objetivo vem antes das tarefas. Comece pelo transbordo, depois atrasadas e o que vence na semana, e pare quando a barra encostar na marca dos 85%.'],
  ['Confirmar', 'Cada pessoa confirma a sua. O compromisso fica travado e tudo que entrar depois aparece como fora do plano, que é o número que mostra se a semana foi atropelada.'],
]

function lerRoteiro() { try { return localStorage.getItem(PREF_ROTEIRO) !== '0' } catch { return true } }
function gravarRoteiro(v) { try { localStorage.setItem(PREF_ROTEIRO, v ? '1' : '0') } catch { /* noop */ } }

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

function FormNovaSprint({ inicial, onCriar, onCancelar, ocupado }) {
  const [f, setF] = useState(inicial)
  const valido = f.nome.trim() && f.inicio && f.fim && f.fim >= f.inicio
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (valido) onCriar(f) }} className="ln-card p-3 flex items-end gap-2 flex-wrap">
      <label className="flex flex-col gap-1 text-xs text-ln-t3">Nome<input className="ln-input !h-8 !w-[160px]" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} autoFocus /></label>
      <label className="flex flex-col gap-1 text-xs text-ln-t3">Início<DataInput className="!h-8" value={f.inicio} onChange={(v) => setF({ ...f, inicio: v })} /></label>
      <label className="flex flex-col gap-1 text-xs text-ln-t3">Fim<DataInput className="!h-8" value={f.fim} onChange={(v) => setF({ ...f, fim: v })} /></label>
      <button type="submit" disabled={!valido || ocupado} className="ln-primary disabled:opacity-50"><Check className="w-3.5 h-3.5" /> Criar sprint</button>
      {onCancelar && <button type="button" onClick={onCancelar} className="ln-pill"><X className="w-3.5 h-3.5" /> Cancelar</button>}
    </form>
  )
}

function ChipPessoa({ ativo, onClick, pessoa, resumo, modo }) {
  const texto = modo === 'planejar' ? `${fmtMin(resumo.planejadoMin)}/${fmtMin(resumo.capMin)}` : `${resumo.feitoTarefas}/${resumo.ativos.length}`
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
      <button ref={ref} type="button" onClick={() => setOpen((v) => !v)} className="ln-iconbtn !w-8 !h-8 !rounded-full ring-1 ring-inset ring-ln-line" aria-label="Colocar outra pessoa na sprint" title="Colocar outra pessoa na sprint"><Plus className="w-3.5 h-3.5" /></button>
      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={220}>
        <div className="p-1 overflow-y-auto">
          {membros.map((m) => <ItemMenu key={m.id} onClick={() => { setOpen(false); onEscolher(m) }}><Avatar pessoa={pessoaDoPerfil(m)} size={18} /><span className="truncate">{m.name}</span></ItemMenu>)}
        </div>
      </Popover>
    </>
  )
}

/** Visão do time: a mesa da reunião, com uma linha por pessoa. */
function VisaoTime({ sprint, fase, modo, linhas, resumos, time, membrosMap, s, onPessoa, config, onConcluir, concluindo }) {
  const todas = useMemo(() => linhas.flatMap((l) => resumos.get(l.pessoa_id)?.lista || []), [linhas, resumos])
  const bd = useMemo(() => calcularBurndownSprint(sprint, todas, config), [sprint, todas, config])
  const faltando = linhas.length - time.confirmadas
  return (
    <div className="h-full overflow-y-auto p-3 flex flex-col gap-3">
      {modo === 'planejar' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <Tile k="Capacidade do time" v={fmtMin(time.capMin)} sub={`${linhas.length} pessoas`} />
          <Tile k="Planejado" v={fmtMin(time.planejadoMin)} sub={`${fmtPct(time.saude.pct)}`} tom={time.saude.nivel === 'passou' ? 'red' : time.saude.nivel === 'justa' ? 'yellow' : undefined} />
          <Tile k="Confirmadas" v={`${time.confirmadas}/${linhas.length}`} tom={!faltando && linhas.length ? 'green' : undefined} />
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
      {modo === 'fechar' && (
        <div className="ln-card p-3 flex items-center gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-ln-t1">{fase === 'concluida' ? `${sprint.nome} concluída` : `Concluir ${sprint.nome}`}</p>
            <p className="text-xs text-ln-t3 mt-0.5">
              {fase === 'concluida'
                ? 'O resultado desta semana está guardado e alimenta a média de entrega de cada pessoa.'
                : fase === 'ativa'
                  ? 'A sprint vai até o fim da semana. Concluir agora congela o resultado, e o que for entregue depois disso não conta nesta sprint.'
                  : `${time.abertas === 1 ? '1 tarefa aberta segue' : `${time.abertas} tarefas abertas seguem`} a decisão tomada em cada pessoa: próxima sprint ou backlog.`}
            </p>
          </div>
          {fase !== 'concluida' && (
            <button type="button" onClick={onConcluir} disabled={concluindo} className="ln-primary disabled:opacity-50">
              {concluindo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Concluir sprint
            </button>
          )}
        </div>
      )}
      <div className="ln-card !p-0 overflow-x-auto">
        <table className="w-full text-[13px] min-w-[860px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-ln-t4 border-b border-ln-ink/[0.06]">
              <th scope="col" className="font-medium py-2 px-3">Pessoa</th>
              <th scope="col" className="font-medium py-2 px-2">Objetivo</th>
              {modo === 'planejar' && <th scope="col" className="font-medium py-2 px-2 w-[220px]">Carga</th>}
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
              const vel = velocidadeDaPessoa(s.sprints, s.pessoas, l.pessoa_id, sprint.inicio)
              return (
                <tr key={l.id} onClick={() => onPessoa(l.pessoa_id)} className="border-b border-ln-ink/[0.04] last:border-0 cursor-pointer ln-row-hover">
                  <td className="py-2 px-3"><button type="button" onClick={() => onPessoa(l.pessoa_id)} className={`inline-flex items-center gap-2 whitespace-nowrap text-ln-t1 font-medium rounded ${FOCO}`}><Avatar pessoa={pessoaDoPerfil(m)} size={22} />{m.name}</button></td>
                  <td className="py-2 px-2 max-w-[320px]">
                    <p className={`truncate ${l.objetivo ? 'text-ln-t2' : 'text-ln-t4'}`} title={l.objetivo || ''}>{l.objetivo || 'Sem objetivo'}</p>
                    {l.riscos && <p className="text-[11px] text-ln-t3 truncate flex items-center gap-1" title={l.riscos}><AlertTriangle className="w-3 h-3 text-ln-yellow shrink-0" />{l.riscos}</p>}
                  </td>
                  {modo === 'planejar' && (
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-[80px]"><BarraCarga saude={r.saude} altura={6} /></div>
                        <span className={`text-xs tabular whitespace-nowrap ${TEXTO_CARGA[r.saude.nivel]}`}>{fmtMin(r.planejadoMin)}<span className="text-ln-t4"> / {fmtMin(r.capMin)}</span></span>
                      </div>
                    </td>
                  )}
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
    </div>
  )
}

export default function SprintsView({ s, t, membros, membrosMap, onAbrirTarefa, tarefaAbertaId, onToast, confirmar }) {
  const [params, setParams] = useSearchParams()
  const [roteiro, setRoteiro] = useState(lerRoteiro)
  const [roteiroNaPessoa, setRoteiroNaPessoa] = useState(false) // na pessoa ele só abre quando pedem: o backlog precisa da altura
  const [criando, setCriando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const hoje = hojeISO()

  const ordenadas = useMemo(() => [...s.sprints].sort((a, b) => a.inicio.localeCompare(b.inicio)), [s.sprints])
  const sprint = useMemo(() => ordenadas.find((x) => x.id === params.get('sprint')) || sprintPadrao(ordenadas, hoje), [ordenadas, params, hoje])
  const idx = sprint ? ordenadas.findIndex((x) => x.id === sprint.id) : -1
  const anterior = idx > 0 ? ordenadas[idx - 1] : null
  const proxima = idx >= 0 && idx < ordenadas.length - 1 ? ordenadas[idx + 1] : null
  const fase = faseDaSprint(sprint, hoje)
  const modoUrl = params.get('modo')
  const modo = MODOS.some(([k]) => k === modoUrl) ? modoUrl : modoPadrao(fase)
  const pessoaSel = params.get('pessoa') || 'time'

  const ir = (patch) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) { if (v) p.set(k, v); else p.delete(k) }
    p.delete('tarefa')
    setParams(p, { replace: true })
  }

  // Carrega a sprint aberta e a anterior (o transbordo vem dela) e as tarefas que elas citam.
  const { carregarItens } = s
  const idsSprints = useMemo(() => [sprint?.id, anterior?.id].filter(Boolean), [sprint?.id, anterior?.id])
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
  const resumos = useMemo(() => {
    const m = new Map()
    if (!sprint) return m
    for (const l of linhas) m.set(l.pessoa_id, resumoDaPessoa(l, itensDaSprint.filter((i) => i.pessoa_id === l.pessoa_id), tarefasMap, sprint, s.config))
    return m
  }, [linhas, itensDaSprint, tarefasMap, sprint, s.config])
  const time = useMemo(() => resumoDoTime([...resumos.values()]), [resumos])
  const linhaSel = pessoaSel === 'time' ? null : linhas.find((l) => l.pessoa_id === pessoaSel) || null
  const sugestao = useMemo(() => sugerirSprint(s.sprints, t.listas, hoje), [s.sprints, t.listas, hoje])

  const ctx = useMemo(() => ({
    itens: tarefasMap, listasMap: t.listasMap, config: s.config, onAbrirTarefa, tarefaAbertaId,
    clienteDe: (tarefa) => {
      const l = t.listasMap.get(tarefa.lista_id)
      return (l && t.pastasMap.get(l.pasta_id)?.nome) || l?.nome || ''
    },
    onStatus: async (tarefa, st) => { const r = await t.mudarStatus(tarefa, st); if (r?.error) onToast(r.error, 'error') },
    onEstimativa: async (tarefa, v) => { const r = await t.atualizarTarefa(tarefa.id, { estimativa_min: v }); if (r?.error) onToast(r.error, 'error') },
  }), [tarefasMap, t, s.config, onAbrirTarefa, tarefaAbertaId, onToast])

  // ── Ações ────────────────────────────────────────────────────────────────
  const atribuir = async (tarefa, pessoaId) => {
    const resp = tarefa.responsaveis || []
    if (resp.includes(pessoaId)) return
    const r = await t.atualizarTarefa(tarefa.id, { responsaveis: [...resp, pessoaId] })
    if (r?.error) onToast(r.error, 'error')
  }
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
      const a = await s.adicionarTarefas(sprint.id, para, [c.tarefa], { origem: c.item.origem })
      if (a.error) { onToast(a.error, 'error'); return }
      const resp = (c.tarefa.responsaveis || []).filter((id) => id !== de.pessoa_id)
      const u = await t.atualizarTarefa(c.tarefa.id, { responsaveis: resp.includes(para.pessoa_id) ? resp : [...resp, para.pessoa_id] })
      if (u?.error) onToast(u.error, 'error')
      else onToast(`Passou para ${membrosMap.get(para.pessoa_id)?.name?.split(' ')[0] || 'outra pessoa'}`)
    },
    confirmarPessoa: async (linha, resumo) => {
      const avisos = []
      if (!linha.objetivo?.trim()) avisos.push('Está sem objetivo da semana')
      if (resumo.saude.nivel === 'passou') avisos.push(`Passou da capacidade: ${fmtMin(resumo.planejadoMin)} de ${fmtMin(resumo.capMin)}`)
      else if (resumo.saude.nivel === 'justa') avisos.push(`Sem folga para imprevisto: ${fmtMin(resumo.planejadoMin)} de ${fmtMin(resumo.capMin)}`)
      if (resumo.semEstimativa) avisos.push(`${resumo.semEstimativa} sem estimativa, contando as horas pelo tipo de tarefa`)
      const nome = membrosMap.get(linha.pessoa_id)?.name || 'pessoa'
      const ok = await confirmar({
        titulo: `Confirmar a sprint de ${nome}?`, acao: 'Confirmar', icone: Lock,
        texto: `${fmtMin(resumo.planejadoMin)} em ${nTarefas(resumo.ativos.length)} viram o compromisso da semana. O que entrar depois fica marcado como fora do plano.`,
        ...(avisos.length ? { rotuloItens: 'Vale olhar antes', itens: avisos } : {}),
      })
      if (!ok) return
      const r = await s.confirmarPessoa(linha, resumo.ativos.map((c) => ({ id: c.item.id, min: c.min })))
      if (r.error) onToast(r.error, 'error'); else onToast(`Sprint de ${nome.split(' ')[0]} confirmada`)
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
    const anteriores = sprint ? (s.pessoasPorSprint.get(ordenadas[ordenadas.length - 1]?.id) || []) : []
    const numero = /(\d+)/.exec(f.nome)?.[1] ? Number(/(\d+)/.exec(f.nome)[1]) : f.numero
    const r = await s.criarSprint({ ...f, numero, membros, cfg: s.config, anteriores })
    setOcupado(false)
    if (r.error) { onToast(r.error, 'error'); return }
    setCriando(false)
    ir({ sprint: r.data.id, modo: 'planejar', pessoa: null })
  }

  const excluir = async () => {
    const n = itensDaSprint.length
    const ok = await confirmar({
      perigo: true, titulo: `Excluir ${sprint.nome}?`, acao: 'Excluir',
      texto: `As tarefas continuam onde estão, só saem da sprint${n ? ` (${n})` : ''}. O objetivo e a retro de cada pessoa são apagados.`,
    })
    if (!ok) return
    const r = await s.excluirSprint(sprint.id)
    if (r.error) onToast(r.error, 'error'); else { onToast('Sprint excluída'); ir({ sprint: null, modo: null, pessoa: null }) }
  }

  const concluir = async () => {
    const previa = planoDeFechamento({ sprint, proxima, pessoas: linhas, itens: itensDaSprint, tarefas: tarefasMap, cfg: s.config, proximasPessoas: [] })
    const destino = proxima?.nome || sugestao.nome
    const semRetro = linhas.filter((l) => !l.retro_mudanca?.trim()).map((l) => membrosMap.get(l.pessoa_id)?.name?.split(' ')[0]).filter(Boolean)
    const itens = [
      `${previa.transbordo === 1 ? '1 tarefa vai' : `${previa.transbordo} tarefas vão`} para a ${destino}`,
      `${previa.devolvidas === 1 ? '1 volta' : `${previa.devolvidas} voltam`} ao backlog`,
      ...(semRetro.length ? [`Retro sem a mudança combinada: ${semRetro.join(', ')}`] : []),
    ]
    const ok = await confirmar({
      titulo: `Concluir ${sprint.nome}?`, acao: 'Concluir', icone: CheckCircle2,
      texto: `Entregue: ${fmtMin(time.feitoMin)} de ${fmtMin(time.compromissoMin)} combinadas. O resultado fica guardado e não muda mais.`,
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
    const r = await s.adicionarPessoa(sprint.id, linha)
    if (r.error) onToast(r.error, 'error'); else ir({ pessoa: m.id })
  }
  const foraDaSprint = useMemo(() => (membros || []).filter((m) => !m.disabled && m.name?.trim().toLowerCase() !== 'cliente' && !linhas.some((l) => l.pessoa_id === m.id)), [membros, linhas])

  // ── Tela ─────────────────────────────────────────────────────────────────
  if (s.loading) return <div className="flex items-center justify-center py-20 text-ln-t4 text-[13px] gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando sprints…</div>

  if (!sprint) {
    return (
      <div className="h-full overflow-y-auto p-3 flex flex-col gap-3">
        <div className="ln-card p-5 max-w-2xl">
          <p className="text-[15px] font-semibold text-ln-t1 flex items-center gap-2"><BookOpenCheck className="w-4 h-4 text-ln-accent" /> Primeira sprint do VertaTask</p>
          <p className="text-[13px] text-ln-t3 mt-1 mb-3">A numeração continua a da pasta Sprint do ClickUp. O time ativo entra automaticamente, cada pessoa com a sua sprint, e a capacidade vem da mesma configuração da Capacidade do time.</p>
          <FormNovaSprint inicial={sugestao} onCriar={criar} ocupado={ocupado} />
          {s.erro && <p className="text-xs text-ln-red mt-2">{s.erro}</p>}
        </div>
        <Roteiro />
      </div>
    )
  }

  const verRoteiro = linhaSel ? roteiroNaPessoa : roteiro
  const alternarRoteiro = () => {
    if (linhaSel) setRoteiroNaPessoa((v) => !v)
    else { gravarRoteiro(!roteiro); setRoteiro(!roteiro) }
  }
  const modosVisiveis = MODOS.filter(([k]) => !(fase === 'concluida' && k === 'planejar') && !(fase === 'futura' && k === 'fechar'))
  const visiveis = ordenadas.slice(-6)

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="shrink-0 px-3 pt-3 pb-2 flex flex-col gap-2 border-b border-ln-ink/[0.06]">
        <div className="flex items-center gap-1.5 flex-wrap">
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
                <button key={k} type="button" aria-pressed={modo === k} onClick={() => ir({ modo: k })} className={`h-7 px-3 rounded-md text-xs font-medium transition-colors ${modo === k ? 'bg-ln-accent text-white' : 'text-ln-t2 hover:bg-ln-ink/5'} ${FOCO}`}>{r}</button>
              ))}
            </div>
          </div>
        </div>
        {criando && <FormNovaSprint inicial={sugestao} onCriar={criar} onCancelar={() => setCriando(false)} ocupado={ocupado} />}
        {verRoteiro && <Roteiro onFechar={alternarRoteiro} />}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <button type="button" onClick={() => ir({ pessoa: null })} aria-current={!linhaSel || undefined} className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full text-xs whitespace-nowrap ring-1 ring-inset ${!linhaSel ? 'bg-ln-accent/10 ring-ln-accent/40 text-ln-accent font-semibold' : 'ring-ln-line text-ln-t2 hover:bg-ln-ink/[0.04]'} ${FOCO}`}><Users className="w-3.5 h-3.5" /> Time</button>
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
        {!linhaSel ? (
          <VisaoTime sprint={sprint} fase={fase} modo={modo} linhas={linhas} resumos={resumos} time={time} membrosMap={membrosMap} s={s} config={s.config} onPessoa={(id) => ir({ pessoa: id })} onConcluir={concluir} concluindo={ocupado} />
        ) : modo === 'planejar' ? (
          <SprintPlanejar
            key={linhaSel.id} sprint={sprint} anterior={anterior} fase={fase} linha={linhaSel} resumo={resumos.get(linhaSel.pessoa_id)}
            tarefasMap={tarefasMap} itensAnterior={itensAnterior} pessoasSprint={linhas} s={s} ctx={ctx} acoes={acoes} membrosMap={membrosMap}
            somenteLeitura={fase === 'concluida'}
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

