// Tela principal da sprint do squad: as grandes metas, cada uma explodida em atividades, com a
// porcentagem saindo das atividades concluídas. Em Planejar dá para escrever a meta, escolher ou
// criar atividades; em Acompanhar só o andamento; em Fechar, a decisão do que continua.
import { useMemo, useState } from 'react'
import { Check, ChevronRight, CircleCheck, Flag, ListChecks, Plus, Target, Trash2, X, Lock, CornerDownRight } from 'lucide-react'
import { Avatar, FOCO } from './Campos'
import { BotaoDelegar, CampoTexto, LinhaTarefa, Tile } from './SprintComum'
import { DecisaoAtividade } from './SprintFechar'
import SprintBacklog from './SprintBacklog'
import { pessoaDoPerfil } from '../../lib/tarefas'
import { progressoDaMeta, resumoDasMetas, nTarefas } from '../../lib/sprints'

function FormAtividade({ meta, linhas, membrosMap, opcoesLista, listaPadrao, onCriar, onFechar }) {
  const [titulo, setTitulo] = useState('')
  const [lista, setLista] = useState(listaPadrao || '')
  const [pessoa, setPessoa] = useState(meta.responsavel_id && linhas.some((l) => l.pessoa_id === meta.responsavel_id) ? meta.responsavel_id : (linhas[0]?.pessoa_id || ''))
  const [salvando, setSalvando] = useState(false)
  const valido = titulo.trim() && lista && pessoa
  const criar = async (e) => {
    e.preventDefault()
    if (!valido || salvando) return
    setSalvando(true)
    const ok = await onCriar({ titulo: titulo.trim(), lista_id: lista, pessoa_id: pessoa })
    setSalvando(false)
    if (ok) setTitulo('') // fica aberto: explodir uma meta costuma ser várias atividades em seguida
  }
  return (
    <form onSubmit={criar} className="flex items-center gap-2 flex-wrap px-3 py-2 bg-ln-ink/[0.02] border-t border-ln-ink/[0.05]">
      <input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') onFechar() }} placeholder="Nome da atividade nova" aria-label="Nome da atividade nova" className="ln-input !h-8 flex-1 min-w-[200px]" />
      <select value={lista} onChange={(e) => setLista(e.target.value)} aria-label="Lista da atividade" className={`ln-input !h-8 !w-[190px] text-xs ${lista ? '' : '!text-ln-t4'}`}>
        <option value="">Em qual lista?</option>
        {opcoesLista.map((g) => <optgroup key={g.nome} label={g.nome}>{g.listas.map((l) => <option key={l.id} value={l.id}>{g.nome} · {l.nome}</option>)}</optgroup>)}
      </select>
      <select value={pessoa} onChange={(e) => setPessoa(e.target.value)} aria-label="Quem faz" className="ln-input !h-8 !w-[150px] text-xs">
        {linhas.map((l) => <option key={l.id} value={l.pessoa_id}>{membrosMap.get(l.pessoa_id)?.name}</option>)}
      </select>
      <button type="submit" disabled={!valido || salvando} className="ln-primary disabled:opacity-50"><Check className="w-3.5 h-3.5" /> Criar</button>
      <button type="button" onClick={onFechar} className="ln-iconbtn" aria-label="Fechar"><X className="w-4 h-4" /></button>
    </form>
  )
}

function CartaoMeta({ meta, prog, atividades, modo, fase, linhas, membrosMap, s, ctx, acoes, opcoesLista, pastas, metaAberta, onEscolher, continuaEm, veioDe }) {
  const [aberta, setAberta] = useState(true)
  const [criando, setCriando] = useState(false)
  const editavel = modo === 'planejar' && fase !== 'concluida'
  const emFechar = modo === 'fechar' && fase !== 'concluida'
  const concluida = fase === 'concluida'
  const dono = meta.responsavel_id ? membrosMap.get(meta.responsavel_id) : null
  const cor = prog.batida ? 'bg-ln-green' : emFechar || concluida ? 'bg-ln-yellow' : 'bg-ln-accent'
  const listaPadrao = useMemo(() => {
    const g = opcoesLista.find((x) => x.pastaId === meta.pasta_id)
    return g ? (g.listas.find((l) => l.nome === 'Geral') || g.listas[0])?.id : ''
  }, [opcoesLista, meta.pasta_id])
  return (
    <article className={`ln-card !p-0 overflow-hidden ${metaAberta ? '!border-ln-accent/50 ring-1 ring-ln-accent/30' : ''}`} aria-label={`Meta: ${meta.titulo}`}>
      <div className="px-3 pt-3 pb-2.5 flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <button type="button" onClick={() => setAberta((v) => !v)} className="ln-iconbtn !w-6 !h-6 mt-0.5 shrink-0" aria-expanded={aberta} aria-label={aberta ? 'Recolher atividades' : 'Mostrar atividades'}>
            <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-150 ${aberta ? 'rotate-90' : ''}`} />
          </button>
          <div className="flex-1 min-w-0">
            {editavel
              ? <CampoTexto valor={meta.titulo} onSalvar={(v) => { if (v) s.atualizarMeta(meta.id, { titulo: v }) }} rotulo="Nome da meta" className="!font-semibold !text-[14px] !border-transparent hover:!border-ln-line" />
              : <p className="text-[14px] font-semibold text-ln-t1 pt-0.5">{meta.titulo}</p>}
            {veioDe && <p className="text-[11px] text-ln-t4 flex items-center gap-1 mt-0.5"><CornerDownRight className="w-3 h-3" />Continua da {veioDe}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className={`text-xl font-semibold tabular tracking-tight leading-none ${prog.batida ? 'text-ln-green' : 'text-ln-t1'}`}>{prog.pct}%</p>
            <p className="text-[11px] text-ln-t4 tabular mt-1">{prog.feitas} de {prog.total}</p>
          </div>
          {editavel && <button type="button" onClick={() => acoes.excluirMeta(meta, atividades.length)} className="ln-iconbtn !w-6 !h-6 mt-0.5 hover:!text-ln-red shrink-0" aria-label={`Excluir a meta ${meta.titulo}`} title="Excluir meta"><Trash2 className="w-3.5 h-3.5" /></button>}
        </div>
        <div className="h-2 rounded-full bg-ln-ink/[0.07]" role="progressbar" aria-valuenow={prog.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Andamento de ${meta.titulo}`}>
          <div className={`h-full rounded-full transition-[width] duration-300 ${cor}`} style={{ width: `${Math.min(100, prog.pct)}%` }} />
        </div>
        {editavel ? (
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_170px_170px]">
            <CampoTexto valor={meta.descricao} onSalvar={(v) => s.atualizarMeta(meta.id, { descricao: v })} placeholder="Como saber que a meta foi batida" className="!h-7 text-xs" />
            <select value={meta.responsavel_id || ''} onChange={(e) => s.atualizarMeta(meta.id, { responsavel_id: e.target.value || null })} aria-label="Dono da meta" className="ln-input !h-7 text-xs">
              <option value="">Sem dono</option>
              {linhas.map((l) => <option key={l.id} value={l.pessoa_id}>{membrosMap.get(l.pessoa_id)?.name}</option>)}
            </select>
            <select value={meta.pasta_id || ''} onChange={(e) => s.atualizarMeta(meta.id, { pasta_id: e.target.value || null })} aria-label="Cliente da meta" className="ln-input !h-7 text-xs">
              <option value="">Sem cliente</option>
              {pastas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
        ) : (meta.descricao || dono) && (
          <p className="text-xs text-ln-t3 flex items-center gap-2 flex-wrap">
            {dono && <span className="inline-flex items-center gap-1"><Avatar pessoa={pessoaDoPerfil(dono)} size={16} />{dono.name.split(' ')[0]}</span>}
            {meta.descricao && <span>{meta.descricao}</span>}
          </p>
        )}
        {emFechar && !prog.batida && (
          <div className="flex items-center gap-2 flex-wrap text-xs text-ln-t3">
            <span>Não bateu. Essa meta:</span>
            <span className="inline-flex rounded-md ring-1 ring-inset ring-ln-line overflow-hidden" role="group" aria-label="O que fazer com a meta">
              {[['continua', 'Continua na próxima sprint'], ['encerra', 'Encerra aqui']].map(([k, r]) => (
                <button key={k} type="button" aria-pressed={(meta.decisao || 'continua') === k} onClick={() => s.atualizarMeta(meta.id, { decisao: k })} className={`h-6 px-2 text-[11px] whitespace-nowrap ${(meta.decisao || 'continua') === k ? 'bg-ln-accent/10 text-ln-accent font-semibold' : 'text-ln-t3 hover:bg-ln-ink/5'} ${FOCO}`}>{r}</button>
              ))}
            </span>
          </div>
        )}
        {concluida && (
          <p className={`text-xs inline-flex items-center gap-1 ${prog.batida ? 'text-ln-green' : 'text-ln-t3'}`}>
            {prog.batida ? <><CircleCheck className="w-3.5 h-3.5" /> Meta batida</> : <><Flag className="w-3.5 h-3.5" /> Não bateu{continuaEm ? `, continuou na ${continuaEm}` : ', encerrada'}</>}
          </p>
        )}
      </div>

      {aberta && (
        <div className="border-t border-ln-ink/[0.05]">
          {atividades.map((c) => {
            const m = membrosMap.get(c.item.pessoa_id)
            return (
              <LinhaTarefa
                key={c.item.id} tarefa={c.tarefa} titulo={c.titulo} ctx={ctx} editavel={!concluida}
                etiqueta={<>
                  {c.transbordo && <span className="ln-pill !h-5 !px-1.5 text-[10px] shrink-0" title="Veio aberta da sprint anterior">Transbordo</span>}
                  {c.fora && <span className="ln-pill !h-5 !px-1.5 text-[10px] !text-ln-orange shrink-0" title="Entrou depois de confirmar a sprint">Fora do plano</span>}
                  {m && <Avatar pessoa={pessoaDoPerfil(m)} size={20} />}
                </>}
                fim={emFechar && c.aberta ? <DecisaoAtividade item={c.item} onDecidir={s.decidirItem} /> : !concluida && modo !== 'fechar' && (
                  <span className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {c.tarefa && <BotaoDelegar pessoas={linhas.filter((p) => p.pessoa_id !== c.item.pessoa_id)} membrosMap={membrosMap} onEscolher={(dest) => acoes.delegar(c, linhas.find((l) => l.pessoa_id === c.item.pessoa_id), dest)} />}
                    <button type="button" onClick={() => s.vincularMeta(c.item, null)} className="ln-iconbtn !w-6 !h-6 hover:!text-ln-red" aria-label={`Tirar ${c.titulo} da meta`} title="Tirar da meta (continua na sprint)"><X className="w-3.5 h-3.5" /></button>
                  </span>
                )}
              />
            )
          })}
          {!atividades.length && <p className="px-3 py-3 text-[13px] text-ln-t4">{editavel ? 'Nenhuma atividade ainda. Sem atividade, a meta fica em 0%.' : 'Nenhuma atividade nesta meta.'}</p>}
          {editavel && (
            criando
              ? <FormAtividade meta={meta} linhas={linhas} membrosMap={membrosMap} opcoesLista={opcoesLista} listaPadrao={listaPadrao} onCriar={(campos) => acoes.criarAtividade(meta, campos)} onFechar={() => setCriando(false)} />
              : (
                <div className="flex items-center gap-1.5 px-3 py-2 border-t border-ln-ink/[0.05]">
                  <button type="button" onClick={() => onEscolher(metaAberta ? null : meta.id)} aria-pressed={metaAberta} className={`ln-pill ${metaAberta ? '!bg-ln-accent/10 !text-ln-accent' : ''}`}><ListChecks className="w-3.5 h-3.5" /> Escolher atividades</button>
                  <button type="button" onClick={() => setCriando(true)} className="ln-pill"><Plus className="w-3.5 h-3.5" /> Criar atividade</button>
                </div>
              )
          )}
        </div>
      )}
    </article>
  )
}

export default function SprintMetas({ sprint, fase, modo, metas, classificados, linhas, resumos, s, ctx, acoes, membrosMap, tarefasMap, idsNaSprint, idsTransbordo, opcoesLista, pastas, squadId, nomesSprints, topo = null }) {
  const [nova, setNova] = useState('')
  const [metaAbertaId, setMetaAbertaId] = useState(null)
  const [pessoaPadrao, setPessoaPadrao] = useState(null)
  const metaAberta = metas.find((m) => m.id === metaAbertaId) || null
  const editavel = modo === 'planejar' && fase !== 'concluida'
  const r = useMemo(() => resumoDasMetas(metas, classificados), [metas, classificados])
  const semMeta = classificados.filter((c) => !c.removida && !c.antecipada && !c.item.meta_id)
  const naoConfirmadas = linhas.filter((l) => !resumos.get(l.pessoa_id)?.confirmada && resumos.get(l.pessoa_id)?.ativos.length)
  const membrosIds = useMemo(() => linhas.map((l) => l.pessoa_id), [linhas])
  const nomeFim = sprint.fim.split('-').reverse().slice(0, 2).join('/')

  const criar = async (e) => {
    e.preventDefault()
    if (!nova.trim()) return
    const ok = await acoes.criarMeta(nova.trim())
    if (ok) setNova('')
  }
  const quemFaz = pessoaPadrao && membrosIds.includes(pessoaPadrao) ? pessoaPadrao : (metaAberta?.responsavel_id && membrosIds.includes(metaAberta.responsavel_id) ? metaAberta.responsavel_id : membrosIds[0])
  const clienteInicial = metaAberta?.pasta_id ? pastas.find((p) => p.id === metaAberta.pasta_id)?.nome || '' : ''
  const continuaEm = (m) => {
    const filha = s.metas.find((x) => x.continua_de === m.id)
    return filha ? nomesSprints.get(filha.sprint_id) : null
  }
  const veioDe = (m) => {
    if (!m.continua_de) return null
    const mae = s.metas.find((x) => x.id === m.continua_de)
    return mae ? nomesSprints.get(mae.sprint_id) : null
  }

  return (
    <div className={`h-full min-h-0 grid grid-cols-1 ${metaAberta ? 'xl:grid-cols-2 xl:divide-x divide-ln-ink/[0.06]' : ''} overflow-y-auto xl:overflow-hidden`}>
      <div className="min-h-0 xl:overflow-y-auto p-3 flex flex-col gap-3">
        {topo}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <Tile k="Metas batidas" v={`${r.batidas}/${r.metas}`} tom={r.metas && r.batidas === r.metas ? 'green' : undefined} />
          <Tile k="Andamento das metas" v={`${r.pct}%`} sub={`${r.feitas} de ${r.total}`} dica="Atividades concluídas sobre o total de atividades das metas" />
          <Tile k="Atividades sem meta" v={String(semMeta.length)} tom={semMeta.length ? 'yellow' : undefined} dica="Tarefas que estão na sprint mas não ajudam a bater nenhuma meta" />
          <Tile k="Confirmadas" v={`${linhas.length - linhas.filter((l) => !resumos.get(l.pessoa_id)?.confirmada).length}/${linhas.length}`} sub="pessoas" />
        </div>

        {editavel && (
          <form onSubmit={criar} className="ln-card p-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-ln-accent shrink-0" />
            <input value={nova} onChange={(e) => setNova(e.target.value)} placeholder={`Qual meta o squad precisa bater até ${nomeFim}?`} aria-label="Nova meta" className="flex-1 min-w-0 bg-transparent outline-none text-[14px] text-ln-t1 placeholder:text-ln-t4" />
            <button type="submit" disabled={!nova.trim()} className="ln-primary disabled:opacity-50"><Plus className="w-3.5 h-3.5" /> Adicionar meta</button>
          </form>
        )}

        {metas.map((m) => (
          <CartaoMeta
            key={m.id} meta={m} prog={progressoDaMeta(m, classificados)} modo={modo} fase={fase}
            atividades={classificados.filter((c) => c.item.meta_id === m.id && !c.removida && !c.antecipada)}
            linhas={linhas} membrosMap={membrosMap} s={s} ctx={ctx} acoes={acoes} opcoesLista={opcoesLista} pastas={pastas}
            metaAberta={metaAbertaId === m.id} onEscolher={setMetaAbertaId}
            continuaEm={continuaEm(m)} veioDe={veioDe(m)}
          />
        ))}
        {!metas.length && (
          <p className="py-8 text-center text-[13px] text-ln-t4">{editavel ? 'A sprint começa aqui: escreva as grandes metas e depois explode cada uma em atividades.' : 'Nenhuma meta nesta sprint.'}</p>
        )}

        {semMeta.length > 0 && (
          <section className="ln-card !p-0 overflow-hidden">
            <p className="px-3 h-9 flex items-center text-xs font-semibold text-ln-t2 border-b border-ln-ink/[0.05]">Na sprint, sem meta <span className="ml-1.5 text-ln-t4 font-normal tabular">{semMeta.length}</span></p>
            {semMeta.map((c) => {
              const m = membrosMap.get(c.item.pessoa_id)
              return (
                <LinhaTarefa
                  key={c.item.id} tarefa={c.tarefa} titulo={c.titulo} ctx={ctx} editavel={fase !== 'concluida'}
                  etiqueta={m && <Avatar pessoa={pessoaDoPerfil(m)} size={20} />}
                  fim={fase !== 'concluida' && modo !== 'fechar' && metas.length > 0 && (
                    <select value="" onClick={(e) => e.stopPropagation()} onChange={(e) => { if (e.target.value) s.vincularMeta(c.item, e.target.value) }} aria-label={`Pôr ${c.titulo} numa meta`} className="ln-input !h-6 !w-[110px] !px-1 text-[11px] shrink-0">
                      <option value="">Pôr na meta</option>
                      {metas.map((x) => <option key={x.id} value={x.id}>{x.titulo}</option>)}
                    </select>
                  )}
                />
              )
            })}
          </section>
        )}

        {editavel && naoConfirmadas.length > 0 && metas.length > 0 && (
          <div className="ln-card p-3 flex items-center gap-3 flex-wrap">
            <p className="text-[13px] text-ln-t2 flex-1 min-w-[220px]">Metas e atividades fechadas? Confirmar trava o compromisso de {nTarefas(naoConfirmadas.reduce((a, l) => a + (resumos.get(l.pessoa_id)?.ativos.length || 0), 0))}. O que entrar depois aparece como fora do plano.</p>
            <button type="button" onClick={acoes.confirmarSquad} className="ln-primary"><Lock className="w-3.5 h-3.5" /> Confirmar sprint do squad</button>
          </div>
        )}
      </div>

      {metaAberta && (
        <aside className="min-h-[420px] xl:min-h-0 flex flex-col border-t xl:border-t-0 border-ln-ink/[0.06] bg-ln-panel" aria-label={`Escolher atividades para ${metaAberta.titulo}`}>
          <div className="shrink-0 px-3 py-2.5 border-b border-ln-ink/[0.06] flex flex-col gap-1.5">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-ln-t4">Escolhendo atividades para</p>
                <p className="text-[14px] font-semibold text-ln-t1 truncate" title={metaAberta.titulo}>{metaAberta.titulo}</p>
              </div>
              <button type="button" onClick={() => setMetaAbertaId(null)} className="ln-iconbtn" aria-label="Fechar a lista de tarefas"><X className="w-4 h-4" /></button>
            </div>
            <label className="flex items-center gap-2 text-xs text-ln-t3">Tarefa sem ninguém do squad vai para
              <select value={quemFaz || ''} onChange={(e) => setPessoaPadrao(e.target.value)} className="ln-input !h-7 !w-[170px] text-xs">
                {linhas.map((l) => <option key={l.id} value={l.pessoa_id}>{membrosMap.get(l.pessoa_id)?.name}</option>)}
              </select>
            </label>
          </div>
          <div className="flex-1 min-h-0">
            <SprintBacklog
              key={metaAberta.id} sprint={sprint} squadId={squadId} membrosIds={membrosIds} tarefasMap={tarefasMap}
              idsNaSprint={idsNaSprint} idsTransbordo={idsTransbordo} ctx={ctx} cfg={s.config} clienteInicial={clienteInicial}
              onAdd={(t) => acoes.adicionarNaMeta(metaAberta, [t], quemFaz)} onAddTodas={(ts) => acoes.adicionarNaMeta(metaAberta, ts, quemFaz)}
            />
          </div>
        </aside>
      )}
    </div>
  )
}
