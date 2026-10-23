// Aplicar um template, em tela cheia: cliente, lista e data de início no topo e a prévia
// das tarefas como a lista de um cliente (ListaView), editável antes de criar. Cada
// célula ajusta só aquela tarefa (responsável, início, vencimento, prioridade, tipo,
// estimativa); o painel lateral edita nome, descrição e checklists; a lixeira tira a linha.
// Os ajustes ficam por cima do cálculo do template, então trocar a data ou o cliente
// recalcula o resto sem perder o que foi mexido à mão. Seleção + barra no rodapé editam,
// duplicam (a cópia é uma linha a mais, com id próprio) ou tiram várias de uma vez.
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Play, Loader2, AlertTriangle, Trash2, RotateCcw, Users, CalendarDays, CalendarClock, Flag, Shapes, Hourglass } from 'lucide-react'
import { itensDoTemplate, planejarAplicacao, proximoDiaUtil, perfilDoUsuarioCliente } from '../../lib/templates'
import { STATUSES_PADRAO, fmtEstimativa, novoId } from '../../lib/tarefas'
import { hojeISO } from '../../lib/vertatask'
import { DataCampo, ResponsavelCampo, PrioridadeCampo, TipoTarefaCampo, EstimativaCampo, Avatares, FOCO } from './Campos'
import { Secao, ListaSubtarefas, ListaRelacoes } from './SecoesTarefa'
import { Propriedade, Descricao, Checklists } from './TarefaPanel'
import ListaView from './ListaView'
import { PainelLateral } from './TemplateEditor'
import BarraSelecao, { BotaoBarra, ResponsaveisEmMassa, aplicarDiferenca } from './BarraSelecao'
import { DataInput } from './Calendario'

const nomeProjeto = (p) => p?.company_name || p?.companyName || ''

const COLUNAS = [
  { k: 'resp', label: 'Responsável', w: 130 },
  { k: 'ini', label: 'Início', w: 110, editavel: true },
  { k: 'venc', label: 'Vencimento', w: 120 },
  { k: 'prio', label: 'Prioridade', w: 120 },
  { k: 'tipo', label: 'Tipo de tarefa', w: 150 },
  { k: 'estim', label: 'Estimativa', w: 110 },
  { k: 'deps', label: 'Depende de', w: 110 },
  { k: 'aviso', label: 'Atenção', w: 200 },
]

export default function AplicarTemplateView({ template, pastas, listas, projetos, squads, membros, membrosMap, listaInicialId, onAplicar, onCancelar }) {
  const listaInicial = listas.find((l) => l.id === listaInicialId)
  const pastasAtivas = useMemo(() => pastas.filter((p) => !p.arquivada).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [pastas])
  const [pastaId, setPastaId] = useState(listaInicial?.pasta_id || '')
  const [listaId, setListaId] = useState(listaInicial?.id || '')
  const [dataInicio, setDataInicio] = useState(() => proximoDiaUtil(hojeISO()))
  const [edicoes, setEdicoes] = useState({}) // { idDoItem: patch }
  const [removidos, setRemovidos] = useState(() => new Set())
  const [copias, setCopias] = useState([]) // [{ id, pai, posicao, snap }]: linhas duplicadas aqui
  const [selecionadas, setSelecionadas] = useState(() => new Set())
  const [selId, setSelId] = useState(null)
  const [aplicando, setAplicando] = useState(null) // { feitas, total }

  const listasDaPasta = useMemo(() => listas.filter((l) => l.pasta_id === pastaId && !l.arquivada), [listas, pastaId])
  const escolherPasta = (id) => {
    setPastaId(id)
    const ls = listas.filter((l) => l.pasta_id === id && !l.arquivada)
    setListaId((ls.find((l) => l.nome === 'Geral') || ls[0])?.id || '')
  }

  const pasta = pastas.find((p) => p.id === pastaId)
  const projeto = projetos.find((p) => p.id === pasta?.project_id)
  const squad = (squads || []).find((s) => s.id === projeto?.squad)
  const cliente = nomeProjeto(projeto) || pasta?.nome || ''
  const usuarioClienteId = useMemo(() => perfilDoUsuarioCliente(membros), [membros])
  const ativos = useMemo(() => new Set(membrosMap.keys()), [membrosMap]) // membrosMap = só perfis ativos
  const itens = useMemo(() => itensDoTemplate(template), [template])
  const calculado = useMemo(
    () => planejarAplicacao(itens, { dataInicio, squad, cliente, usuarioClienteId, ativos }),
    [itens, dataInicio, squad, cliente, usuarioClienteId, ativos],
  )

  // linhas no formato de tarefa (o que a ListaView lê), com os ajustes por cima. A ordem é
  // a posição: as do template de 10 em 10, as cópias logo depois da origem.
  const linhas = useMemo(() => {
    const base = calculado.map((l, i) => ({
      id: l.item.id, parent_id: l.paiId, posicao: i * 10, lista_id: listaId || 'previa', status: 'a fazer', status_tipo: 'open',
      titulo: l.titulo, descricao: l.descricao, responsaveis: l.responsaveis, responsaveis_extra: [],
      data_inicio: l.data_inicio, data_vencimento: l.data_vencimento,
      prioridade: l.item.prioridade, tipo_tarefa: l.item.tipo_tarefa, estimativa_min: l.item.estimativa_min,
      checklists: l.item.checklists, depende_de: l.item.depende_de, avisoRegra: l.aviso, _linha: l,
      ...(edicoes[l.item.id] || {}),
    }))
    const extras = copias.map((c) => ({
      ...c.snap, id: c.id, parent_id: c.pai, posicao: c.posicao, depende_de: [], _copia: true,
      _linha: { ...c.snap._linha, paiId: c.pai, item: { ...c.snap._linha.item, id: c.id, depende_de: [] } },
      ...(edicoes[c.id] || {}),
    }))
    const todas = [...base, ...extras]
    const fora = new Set(removidos)
    for (const r of todas) if (r.parent_id && fora.has(r.parent_id)) fora.add(r.id)
    return todas.filter((r) => !fora.has(r.id))
  }, [calculado, removidos, edicoes, listaId, copias])
  const porId = useMemo(() => new Map(linhas.map((r) => [r.id, r])), [linhas])
  const titulosPorId = useMemo(() => new Map(calculado.map((l) => [l.item.id, l.titulo])), [calculado])

  const editar = (id, patch) => setEdicoes((e) => ({ ...e, [id]: { ...(e[id] || {}), ...patch } }))
  const remover = (id) => { setRemovidos((s) => new Set(s).add(id)); if (selId === id) setSelId(null) }
  const nAjustes = Object.keys(edicoes).length

  // ── Seleção e ações em massa ──
  const linhasSel = linhas.filter((r) => selecionadas.has(r.id))
  const raizesSel = linhasSel.filter((r) => !(r.parent_id && selecionadas.has(r.parent_id)))
  const selecao = {
    ids: selecionadas,
    alternar: (id) => setSelecionadas((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n }),
    definir: (ids, marcar) => setSelecionadas((s) => { const n = new Set(s); for (const id of ids) { if (marcar) n.add(id); else n.delete(id) } return n }),
  }
  const editarSel = (fn) => setEdicoes((e) => {
    const n = { ...e }
    for (const r of linhasSel) n[r.id] = { ...(n[r.id] || {}), ...(typeof fn === 'function' ? fn(r) : fn) }
    return n
  })
  const duplicarSel = () => {
    const novas = []
    for (const r of raizesSel) {
      const id = novoId()
      novas.push({ id, pai: r.parent_id, posicao: r.posicao + 5 + novas.length * 0.01, snap: r })
      // tarefa de topo leva as subtarefas junto
      if (!r.parent_id) for (const f of linhas.filter((x) => x.parent_id === r.id)) novas.push({ id: novoId(), pai: id, posicao: f.posicao, snap: f })
    }
    setCopias((c) => [...c, ...novas])
    setSelecionadas(new Set())
  }
  const removerSel = () => {
    setRemovidos((s) => { const n = new Set(s); for (const r of raizesSel) n.add(r.id); return n })
    if (selId && selecionadas.has(selId)) setSelId(null)
    setSelecionadas(new Set())
  }

  useEffect(() => {
    const h = (e) => {
      const el = document.activeElement
      if (e.key !== 'Escape' || (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable))) return
      if (selId) setSelId(null); else setSelecionadas(new Set())
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [selId])

  const semResp = linhas.filter((r) => !r.responsaveis.length).length
  const minutos = linhas.reduce((a, r) => a + (r.estimativa_min || 0), 0)
  const pronto = !!listaId && !!dataInicio && linhas.length > 0 && !aplicando

  async function aplicar() {
    // o que a aplicação grava: a linha calculada com os ajustes desta tela, na ordem da
    // lista e com cada pai antes das subtarefas (a criação depende disso)
    const ordem = (a, b) => a.posicao - b.posicao
    const ordenadas = linhas.filter((r) => !r.parent_id).sort(ordem).flatMap((t) => [t, ...linhas.filter((x) => x.parent_id === t.id).sort(ordem)])
    const plano = ordenadas.map((r) => ({
      ...r._linha, paiId: r.parent_id,
      titulo: r.titulo, descricao: r.descricao, responsaveis: r.responsaveis,
      data_inicio: r.data_inicio, data_vencimento: r.data_vencimento,
      item: { ...r._linha.item, id: r.id, prioridade: r.prioridade, tipo_tarefa: r.tipo_tarefa, estimativa_min: r.estimativa_min, checklists: r.checklists, depende_de: r.depende_de.filter((d) => porId.has(d)) },
    }))
    setAplicando({ feitas: 0, total: plano.length })
    const res = await onAplicar({ listaId, plano, onProgresso: (feitas) => setAplicando({ feitas, total: plano.length }) })
    setAplicando(null)
    if (res?.error) return
  }

  const topo = linhas.filter((r) => !r.parent_id)
  const grupos = [{ key: 'previa', label: cliente ? `Tarefas para ${cliente}` : 'Tarefas que serão criadas', cor: '#2A25F0', itens: topo }]
  const filhosDe = new Map(topo.map((r) => [r.id, linhas.filter((x) => x.parent_id === r.id)]))
  const ctx = {
    statuses: STATUSES_PADRAO, membros, membrosMap, itensMap: {}, listaPadraoId: null, agrupar: 'nenhum',
    contagemComentarios: {}, selecionadaId: selId, semStatus: true, expandirTudo: true, acoesHover: false, simples: true, selecao,
    onAbrir: (id) => setSelId(id),
    onAtualizar: (id, patch) => editar(id, patch),
    onMudarStatus: () => {},
    onCriar: () => Promise.resolve({}),
    renderCelula: (k, r) => {
      if (k === 'ini') return <DataCampo valor={r.data_inicio} placeholder="" onChange={(v) => editar(r.id, { data_inicio: v })} render={<span className={`text-[13px] tabular whitespace-nowrap ${r.data_inicio ? 'text-ln-t2' : 'text-ln-t4 pl-1'}`}>{r.data_inicio ? new Date(r.data_inicio).toLocaleDateString('pt-BR', { day: 'numeric', month: 'numeric', year: '2-digit' }) : '–'}</span>} />
      if (k === 'deps') {
        const deps = r.depende_de.filter((d) => porId.has(d))
        return deps.length
          ? <span className="text-[13px] text-ln-t3 truncate" title={deps.map((d) => titulosPorId.get(d)).join('\n')}>após {deps.length} tarefa{deps.length === 1 ? '' : 's'}</span>
          : <span className="text-[13px] text-ln-t4 pl-1">–</span>
      }
      if (k === 'aviso') {
        return !r.responsaveis.length && r.avisoRegra
          ? <span className="inline-flex items-center gap-1 text-xs text-ln-orange min-w-0" title={r.avisoRegra}><AlertTriangle className="w-3 h-3 shrink-0" /><span className="truncate">{r.avisoRegra}</span></span>
          : <span />
      }
      return undefined
    },
    acaoLinha: (r) => (
      <button type="button" onClick={() => remover(r.id)} className="ln-iconbtn !w-6 !h-6 opacity-0 group-hover/linha:opacity-100 focus-visible:opacity-100 hover:!text-ln-red" aria-label={`Não criar ${r.titulo}`} title={r.parent_id ? 'Não criar esta subtarefa' : 'Não criar esta tarefa (e as subtarefas)'}><Trash2 className="w-3.5 h-3.5" /></button>
    ),
  }
  const sel = selId ? porId.get(selId) : null

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 px-4 sm:px-6 pt-3 pb-3 border-b border-ln-ink/[0.08] bg-ln-panel">
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={onCancelar} disabled={!!aplicando} className={`inline-flex items-center gap-1 text-xs text-ln-t3 hover:text-ln-t1 rounded ${FOCO}`}><ArrowLeft className="w-3 h-3" /> Voltar</button>
          <span className="flex-1" />
          {aplicando && <span className="text-xs text-ln-t3 tabular inline-flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Criando {aplicando.feitas} de {aplicando.total}…</span>}
          <button type="button" onClick={onCancelar} disabled={!!aplicando} className="ln-pill">Cancelar</button>
          <button type="button" onClick={aplicar} disabled={!pronto} className="ln-primary disabled:opacity-50"><Play className="w-3 h-3" /> Criar {linhas.length} tarefa{linhas.length === 1 ? '' : 's'}</button>
        </div>
        <h2 className="mt-2 text-2xl font-bold text-ln-t1 vt-display truncate">Aplicar “{template.nome}”</h2>
        <div className="mt-3 flex items-end gap-3 flex-wrap">
          <label className="grid gap-1 text-xs text-ln-t3 w-[260px] max-w-full">Cliente
            <select className="ln-input !h-9" value={pastaId} onChange={(e) => escolherPasta(e.target.value)}>
              <option value="">Escolha o cliente</option>
              {pastasAtivas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-ln-t3 w-[200px] max-w-full">Lista
            <select className="ln-input !h-9" value={listaId} onChange={(e) => setListaId(e.target.value)} disabled={!pastaId}>
              {!listasDaPasta.length && <option value="">{pastaId ? 'Pasta sem lista' : '—'}</option>}
              {listasDaPasta.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-ln-t3 w-[170px]">Data de início
            <DataInput className="!h-9" value={dataInicio} onChange={(v) => v && setDataInicio(v)} aria-label="Data de início" />
          </label>
          <div className="flex items-center gap-3 flex-wrap text-xs text-ln-t3 pb-2">
            {pastaId && (squad ? <span>Squad <b className="text-ln-t2">{squad.emoji} {squad.name}</b></span> : <span className="text-ln-orange">Cliente sem squad</span>)}
            <span className="tabular">{linhas.length} tarefa{linhas.length === 1 ? '' : 's'}{minutos ? ` · ${fmtEstimativa(minutos)}` : ''}</span>
            {pastaId && semResp > 0 && <span className="text-ln-orange inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {semResp} sem responsável</span>}
            {nAjustes > 0 && <button type="button" onClick={() => setEdicoes({})} className="inline-flex items-center gap-1 text-ln-t3 hover:text-ln-t1"><RotateCcw className="w-3 h-3" /> desfazer {nAjustes} ajuste{nAjustes === 1 ? '' : 's'}</button>}
            {removidos.size > 0 && <button type="button" onClick={() => setRemovidos(new Set())} className="inline-flex items-center gap-1 text-ln-t3 hover:text-ln-t1"><RotateCcw className="w-3 h-3" /> trazer de volta {removidos.size} removida{removidos.size === 1 ? '' : 's'}</button>}
            {copias.length > 0 && <button type="button" onClick={() => setCopias([])} className="inline-flex items-center gap-1 text-ln-t3 hover:text-ln-t1"><RotateCcw className="w-3 h-3" /> desfazer {copias.length} cópia{copias.length === 1 ? '' : 's'}</button>}
          </div>
        </div>
        <p className="mt-1 text-[11px] text-ln-t4">Clique numa célula para ajustar só aquela tarefa, ou na linha para editar nome, descrição e checklists. Fim de semana conta como o próximo dia útil.</p>
      </div>

      <div className="relative flex-1 min-h-0 flex">
        <div className="flex-1 min-w-0 overflow-auto bg-ln-panel">
          <ListaView grupos={grupos} filhosDe={filhosDe} ctx={ctx} mostrarConcluidas colunas={COLUNAS}
            vazio={<p className="text-[13px] text-ln-t4 py-16 text-center">Todas as tarefas foram tiradas. Use “trazer de volta” no topo.</p>} />
        </div>

        <BarraSelecao n={linhasSel.length} onLimpar={() => setSelecionadas(new Set())} onDuplicar={duplicarSel} onExcluir={removerSel}>
          <ResponsaveisEmMassa listas={linhasSel.map((r) => r.responsaveis)} membros={membros} membrosMap={membrosMap} icon={Users}
            onAplicar={(d) => editarSel((r) => ({ responsaveis: aplicarDiferenca(r.responsaveis, d) }))} />
          <DataCampo valor={null} onChange={(v) => editarSel({ data_inicio: v })} render={<BotaoBarra icon={CalendarDays}>Início</BotaoBarra>} />
          <DataCampo valor={null} onChange={(v) => editarSel({ data_vencimento: v })} render={<BotaoBarra icon={CalendarClock}>Vencimento</BotaoBarra>} />
          <PrioridadeCampo valor={null} onChange={(v) => editarSel({ prioridade: v })} render={<BotaoBarra icon={Flag}>Prioridade</BotaoBarra>} />
          <TipoTarefaCampo valor={null} onChange={(v) => editarSel({ tipo_tarefa: v })} render={<BotaoBarra icon={Shapes}>Tipo</BotaoBarra>} />
          <EstimativaCampo valor={null} onChange={(v) => editarSel({ estimativa_min: v })} render={<BotaoBarra icon={Hourglass}>Estimativa</BotaoBarra>} />
        </BarraSelecao>

        {sel && (
          <PainelLateral label="Tarefa da prévia" titulo={sel.parent_id ? 'Subtarefa que será criada' : 'Tarefa que será criada'} onFechar={() => setSelId(null)}
            acoes={<button type="button" onClick={() => remover(sel.id)} className="ln-iconbtn hover:!text-ln-red" aria-label="Não criar" title="Não criar esta tarefa"><Trash2 className="w-3.5 h-3.5" /></button>}>
            <div className="flex flex-col gap-5">
              <input
                value={sel.titulo} onChange={(e) => editar(sel.id, { titulo: e.target.value })} aria-label="Nome da tarefa"
                className="w-full bg-transparent text-xl font-semibold tracking-[-0.01em] text-ln-t1 outline-none rounded-md -mx-1 px-1 hover:bg-ln-ink/[0.03] focus:bg-ln-ink/[0.04]"
              />
              <section>
                <p className="ln-label">Propriedades</p>
                <dl className="mt-1.5 flex flex-col gap-0.5">
                  <Propriedade label="Responsáveis"><ResponsavelCampo item={sel} membros={membros} membrosMap={membrosMap} comNome onChange={(ids) => editar(sel.id, { responsaveis: ids })} /></Propriedade>
                  <Propriedade label="Início"><DataCampo valor={sel.data_inicio} placeholder="definir" onChange={(v) => editar(sel.id, { data_inicio: v })} /></Propriedade>
                  <Propriedade label="Vencimento"><DataCampo valor={sel.data_vencimento} item={sel} placeholder="definir" onChange={(v) => editar(sel.id, { data_vencimento: v })} /></Propriedade>
                  <Propriedade label="Prioridade"><PrioridadeCampo valor={sel.prioridade} onChange={(v) => editar(sel.id, { prioridade: v })} /></Propriedade>
                  <Propriedade label="Tipo"><TipoTarefaCampo valor={sel.tipo_tarefa} onChange={(v) => editar(sel.id, { tipo_tarefa: v })} /></Propriedade>
                  <Propriedade label="Estimativa"><EstimativaCampo valor={sel.estimativa_min} onChange={(v) => editar(sel.id, { estimativa_min: v })} /></Propriedade>
                </dl>
                {!sel.responsaveis.length && sel.avisoRegra && <p className="mt-2 text-[11px] text-ln-orange flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {sel.avisoRegra}</p>}
              </section>
              <Secao titulo="Descrição">
                <Descricao key={sel.id} valor={sel.descricao} onSalvar={(v) => editar(sel.id, { descricao: v })} />
              </Secao>
              {!sel.parent_id && (() => {
                const subs = linhas.filter((x) => x.parent_id === sel.id).sort((a, b) => a.posicao - b.posicao)
                return (
                  <Secao titulo="Subtarefas" extra={subs.length > 0 && <span className="text-[11px] text-ln-t4 tabular">{subs.length}</span>}>
                    <ListaSubtarefas
                      itens={subs} onAbrir={(id) => setSelId(id)}
                      fim={(x) => (<>
                        <DataCampo valor={x.data_vencimento} item={x} formato="curta" placeholder="" onChange={(v) => editar(x.id, { data_vencimento: v })} />
                        <Avatares item={x} membrosMap={membrosMap} size={16} max={2} vazio={false} />
                      </>)}
                    />
                  </Secao>
                )
              })()}
              <Secao titulo="Relações">
                <ListaRelacoes
                  linhas={[
                    ...sel.depende_de.filter((d) => porId.has(d)).map((d) => ({
                      key: `por-${d}`, rotulo: 'Bloqueada por', titulo: porId.get(d).titulo, onAbrir: () => setSelId(d),
                      onRemover: () => editar(sel.id, { depende_de: sel.depende_de.filter((x) => x !== d) }),
                    })),
                    ...linhas.filter((x) => x.depende_de.includes(sel.id)).map((x) => ({
                      key: `bloqueia-${x.id}`, rotulo: 'Bloqueia', titulo: x.titulo, onAbrir: () => setSelId(x.id),
                      onRemover: () => editar(x.id, { depende_de: x.depende_de.filter((d) => d !== sel.id) }),
                    })),
                  ]}
                  tipos={[{ value: 'bloqueada', label: 'Bloqueada por' }, { value: 'bloqueia', label: 'Bloqueia' }]}
                  minBusca={0} placeholder="Buscar tarefa da prévia"
                  buscar={async (q) => linhas.filter((x) => x.id !== sel.id && x.parent_id !== sel.id && (!q || (x.titulo || '').toLowerCase().includes(q.toLowerCase())))}
                  onAdicionar={(tipo, alvo) => {
                    if (tipo === 'bloqueada') editar(sel.id, { depende_de: [...new Set([...sel.depende_de, alvo.id])] })
                    else editar(alvo.id, { depende_de: [...new Set([...(porId.get(alvo.id)?.depende_de || []), sel.id])] })
                  }}
                />
              </Secao>
              <Secao titulo="Checklists">
                <Checklists checklists={sel.checklists || []} onChange={(v) => editar(sel.id, { checklists: v })} />
              </Secao>
            </div>
          </PainelLateral>
        )}
      </div>
    </div>
  )
}
