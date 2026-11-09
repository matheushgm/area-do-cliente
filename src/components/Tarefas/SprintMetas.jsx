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
import { useI18n } from '../../i18n'

function FormAtividade({ meta, linhas, membrosMap, opcoesLista, listaPadrao, onCriar, onFechar }) {
  const { t } = useI18n()
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
      <input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') onFechar() }} placeholder={t('sprints.metas.nomeAtividade')} aria-label={t('sprints.metas.nomeAtividade')} className="ln-input !h-8 flex-1 min-w-[200px]" />
      <select value={lista} onChange={(e) => setLista(e.target.value)} aria-label={t('sprints.metas.listaAtividade')} className={`ln-input !h-8 !w-[190px] text-xs ${lista ? '' : '!text-ln-t4'}`}>
        <option value="">{t('sprints.metas.qualLista')}</option>
        {opcoesLista.map((g) => <optgroup key={g.nome} label={g.nome}>{g.listas.map((l) => <option key={l.id} value={l.id}>{g.nome} · {l.nome}</option>)}</optgroup>)}
      </select>
      <select value={pessoa} onChange={(e) => setPessoa(e.target.value)} aria-label={t('sprints.metas.quemFaz')} className="ln-input !h-8 !w-[150px] text-xs">
        {linhas.map((l) => <option key={l.id} value={l.pessoa_id}>{membrosMap.get(l.pessoa_id)?.name}</option>)}
      </select>
      <button type="submit" disabled={!valido || salvando} className="ln-primary disabled:opacity-50"><Check className="w-3.5 h-3.5" /> {t('tarefaPainel.criar')}</button>
      <button type="button" onClick={onFechar} className="ln-iconbtn" aria-label={t('comum.fechar')}><X className="w-4 h-4" /></button>
    </form>
  )
}

function CartaoMeta({ meta, prog, atividades, modo, fase, linhas, membrosMap, s, ctx, acoes, opcoesLista, pastas, metaAberta, onEscolher, continuaEm, veioDe }) {
  const { t } = useI18n()
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
    <article className={`ln-card !p-0 overflow-hidden ${metaAberta ? '!border-ln-accent/50 ring-1 ring-ln-accent/30' : ''}`} aria-label={t('sprints.metas.metaRotulo', { titulo: meta.titulo })}>
      <div className="px-3 pt-3 pb-2.5 flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <button type="button" onClick={() => setAberta((v) => !v)} className="ln-iconbtn !w-6 !h-6 mt-0.5 shrink-0" aria-expanded={aberta} aria-label={aberta ? t('sprints.metas.recolher') : t('sprints.metas.mostrar')}>
            <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-150 ${aberta ? 'rotate-90' : ''}`} />
          </button>
          <div className="flex-1 min-w-0">
            {editavel
              ? <CampoTexto valor={meta.titulo} onSalvar={(v) => { if (v) s.atualizarMeta(meta.id, { titulo: v }) }} rotulo={t('sprints.metas.nomeMeta')} className="!font-semibold !text-[14px] !border-transparent hover:!border-ln-line" />
              : <p className="text-[14px] font-semibold text-ln-t1 pt-0.5">{meta.titulo}</p>}
            {veioDe && <p className="text-[11px] text-ln-t4 flex items-center gap-1 mt-0.5"><CornerDownRight className="w-3 h-3" />{t('sprints.metas.continuaDa', { sprint: veioDe })}</p>}
          </div>
          <div className="text-right shrink-0">
            <p className={`text-xl font-semibold tabular tracking-tight leading-none ${prog.batida ? 'text-ln-green' : 'text-ln-t1'}`}>{prog.pct}%</p>
            <p className="text-[11px] text-ln-t4 tabular mt-1">{t('sprints.xDeY', { x: prog.feitas, y: prog.total })}</p>
          </div>
          {editavel && <button type="button" onClick={() => acoes.excluirMeta(meta, atividades.length)} className="ln-iconbtn !w-6 !h-6 mt-0.5 hover:!text-ln-red shrink-0" aria-label={t('sprints.metas.excluirNome', { titulo: meta.titulo })} title={t('sprints.metas.excluirMeta')}><Trash2 className="w-3.5 h-3.5" /></button>}
        </div>
        <div className="h-2 rounded-full bg-ln-ink/[0.07]" role="progressbar" aria-valuenow={prog.pct} aria-valuemin={0} aria-valuemax={100} aria-label={t('sprints.metas.andamentoDe', { titulo: meta.titulo })}>
          <div className={`h-full rounded-full transition-[width] duration-300 ${cor}`} style={{ width: `${Math.min(100, prog.pct)}%` }} />
        </div>
        {editavel ? (
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_170px_170px]">
            <CampoTexto valor={meta.descricao} onSalvar={(v) => s.atualizarMeta(meta.id, { descricao: v })} placeholder={t('sprints.metas.comoSaber')} className="!h-7 text-xs" />
            <select value={meta.responsavel_id || ''} onChange={(e) => s.atualizarMeta(meta.id, { responsavel_id: e.target.value || null })} aria-label={t('sprints.metas.donoMeta')} className="ln-input !h-7 text-xs">
              <option value="">{t('sprints.metas.semDono')}</option>
              {linhas.map((l) => <option key={l.id} value={l.pessoa_id}>{membrosMap.get(l.pessoa_id)?.name}</option>)}
            </select>
            <select value={meta.pasta_id || ''} onChange={(e) => s.atualizarMeta(meta.id, { pasta_id: e.target.value || null })} aria-label={t('sprints.metas.clienteMeta')} className="ln-input !h-7 text-xs">
              <option value="">{t('sprints.metas.semCliente')}</option>
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
            <span>{t('sprints.metas.naoBateuEssa')}</span>
            <span className="inline-flex rounded-md ring-1 ring-inset ring-ln-line overflow-hidden" role="group" aria-label={t('sprints.metas.oQueFazer')}>
              {[['continua', t('sprints.metas.continua')], ['encerra', t('sprints.metas.encerra')]].map(([k, r]) => (
                <button key={k} type="button" aria-pressed={(meta.decisao || 'continua') === k} onClick={() => s.atualizarMeta(meta.id, { decisao: k })} className={`h-6 px-2 text-[11px] whitespace-nowrap ${(meta.decisao || 'continua') === k ? 'bg-ln-accent/10 text-ln-accent font-semibold' : 'text-ln-t3 hover:bg-ln-ink/5'} ${FOCO}`}>{r}</button>
              ))}
            </span>
          </div>
        )}
        {concluida && (
          <p className={`text-xs inline-flex items-center gap-1 ${prog.batida ? 'text-ln-green' : 'text-ln-t3'}`}>
            {prog.batida ? <><CircleCheck className="w-3.5 h-3.5" /> {t('sprints.metas.batida')}</> : <><Flag className="w-3.5 h-3.5" /> {continuaEm ? t('sprints.metas.naoBateuContinuou', { sprint: continuaEm }) : t('sprints.metas.naoBateuEncerrada')}</>}
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
                  {c.transbordo && <span className="ln-pill !h-5 !px-1.5 text-[10px] shrink-0" title={t('sprints.transbordoDica')}>{t('sprints.transbordo')}</span>}
                  {c.fora && <span className="ln-pill !h-5 !px-1.5 text-[10px] !text-ln-orange shrink-0" title={t('sprints.foraDoPlanoDica')}>{t('sprints.tile.foraDoPlano')}</span>}
                  {m && <Avatar pessoa={pessoaDoPerfil(m)} size={20} />}
                </>}
                fim={emFechar && c.aberta ? <DecisaoAtividade item={c.item} onDecidir={s.decidirItem} /> : !concluida && modo !== 'fechar' && (
                  <span className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {c.tarefa && <BotaoDelegar pessoas={linhas.filter((p) => p.pessoa_id !== c.item.pessoa_id)} membrosMap={membrosMap} onEscolher={(dest) => acoes.delegar(c, linhas.find((l) => l.pessoa_id === c.item.pessoa_id), dest)} />}
                    <button type="button" onClick={() => s.vincularMeta(c.item, null)} className="ln-iconbtn !w-6 !h-6 hover:!text-ln-red" aria-label={t('sprints.metas.tirarNome', { titulo: c.titulo })} title={t('sprints.metas.tirarDaMeta')}><X className="w-3.5 h-3.5" /></button>
                  </span>
                )}
              />
            )
          })}
          {!atividades.length && <p className="px-3 py-3 text-[13px] text-ln-t4">{editavel ? t('sprints.metas.semAtividadeEditavel') : t('sprints.metas.semAtividade')}</p>}
          {editavel && (
            criando
              ? <FormAtividade meta={meta} linhas={linhas} membrosMap={membrosMap} opcoesLista={opcoesLista} listaPadrao={listaPadrao} onCriar={(campos) => acoes.criarAtividade(meta, campos)} onFechar={() => setCriando(false)} />
              : (
                <div className="flex items-center gap-1.5 px-3 py-2 border-t border-ln-ink/[0.05]">
                  <button type="button" onClick={() => onEscolher(metaAberta ? null : meta.id)} aria-pressed={metaAberta} className={`ln-pill ${metaAberta ? '!bg-ln-accent/10 !text-ln-accent' : ''}`}><ListChecks className="w-3.5 h-3.5" /> {t('sprints.metas.escolherAtividades')}</button>
                  <button type="button" onClick={() => setCriando(true)} className="ln-pill"><Plus className="w-3.5 h-3.5" /> {t('sprints.metas.criarAtividade')}</button>
                </div>
              )
          )}
        </div>
      )}
    </article>
  )
}

export default function SprintMetas({ sprint, fase, modo, metas, classificados, linhas, resumos, s, ctx, acoes, membrosMap, tarefasMap, idsNaSprint, idsTransbordo, opcoesLista, pastas, squadId, nomesSprints, topo = null }) {
  const { t, locale } = useI18n()
  const [nova, setNova] = useState('')
  const [metaAbertaId, setMetaAbertaId] = useState(null)
  const [pessoaPadrao, setPessoaPadrao] = useState(null)
  const metaAberta = metas.find((m) => m.id === metaAbertaId) || null
  const editavel = modo === 'planejar' && fase !== 'concluida'
  const r = useMemo(() => resumoDasMetas(metas, classificados), [metas, classificados])
  const semMeta = classificados.filter((c) => !c.removida && !c.antecipada && !c.item.meta_id)
  const naoConfirmadas = linhas.filter((l) => !resumos.get(l.pessoa_id)?.confirmada && resumos.get(l.pessoa_id)?.ativos.length)
  const membrosIds = useMemo(() => linhas.map((l) => l.pessoa_id), [linhas])
  const [anoFim, mesFim, diaFim] = sprint.fim.split('-').map(Number)
  const nomeFim = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit' }).format(new Date(anoFim, mesFim - 1, diaFim))

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
          <Tile k={t('sprints.metas.batidas')} v={`${r.batidas}/${r.metas}`} tom={r.metas && r.batidas === r.metas ? 'green' : undefined} />
          <Tile k={t('sprints.metas.andamento')} v={`${r.pct}%`} sub={t('sprints.xDeY', { x: r.feitas, y: r.total })} dica={t('sprints.metas.andamentoDica')} />
          <Tile k={t('sprints.metas.semMetaTile')} v={String(semMeta.length)} tom={semMeta.length ? 'yellow' : undefined} dica={t('sprints.metas.semMetaDica')} />
          <Tile k={t('sprints.tile.confirmadas')} v={`${linhas.length - linhas.filter((l) => !resumos.get(l.pessoa_id)?.confirmada).length}/${linhas.length}`} sub={t('sprints.metas.pessoas')} />
        </div>

        {editavel && (
          <form onSubmit={criar} className="ln-card p-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-ln-accent shrink-0" />
            <input value={nova} onChange={(e) => setNova(e.target.value)} placeholder={t('sprints.metas.qualMeta', { data: nomeFim })} aria-label={t('sprints.metas.novaMeta')} className="flex-1 min-w-0 bg-transparent outline-none text-[14px] text-ln-t1 placeholder:text-ln-t4" />
            <button type="submit" disabled={!nova.trim()} className="ln-primary disabled:opacity-50"><Plus className="w-3.5 h-3.5" /> {t('sprints.metas.adicionarMeta')}</button>
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
          <p className="py-8 text-center text-[13px] text-ln-t4">{editavel ? t('sprints.metas.vazioEditavel') : t('sprints.metas.vazio')}</p>
        )}

        {semMeta.length > 0 && (
          <section className="ln-card !p-0 overflow-hidden">
            <p className="px-3 h-9 flex items-center text-xs font-semibold text-ln-t2 border-b border-ln-ink/[0.05]">{t('sprints.metas.naSprintSemMeta')} <span className="ml-1.5 text-ln-t4 font-normal tabular">{semMeta.length}</span></p>
            {semMeta.map((c) => {
              const m = membrosMap.get(c.item.pessoa_id)
              return (
                <LinhaTarefa
                  key={c.item.id} tarefa={c.tarefa} titulo={c.titulo} ctx={ctx} editavel={fase !== 'concluida'}
                  etiqueta={m && <Avatar pessoa={pessoaDoPerfil(m)} size={20} />}
                  fim={fase !== 'concluida' && modo !== 'fechar' && metas.length > 0 && (
                    <select value="" onClick={(e) => e.stopPropagation()} onChange={(e) => { if (e.target.value) s.vincularMeta(c.item, e.target.value) }} aria-label={t('sprints.metas.porNome', { titulo: c.titulo })} className="ln-input !h-6 !w-[110px] !px-1 text-[11px] shrink-0">
                      <option value="">{t('sprints.metas.porNaMeta')}</option>
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
            <p className="text-[13px] text-ln-t2 flex-1 min-w-[220px]">{t('sprints.metas.confirmarTexto', { tarefas: nTarefas(naoConfirmadas.reduce((a, l) => a + (resumos.get(l.pessoa_id)?.ativos.length || 0), 0)) })}</p>
            <button type="button" onClick={acoes.confirmarSquad} className="ln-primary"><Lock className="w-3.5 h-3.5" /> {t('sprints.metas.confirmarSquad')}</button>
          </div>
        )}
      </div>

      {metaAberta && (
        <aside className="min-h-[420px] xl:min-h-0 flex flex-col border-t xl:border-t-0 border-ln-ink/[0.06] bg-ln-panel" aria-label={t('sprints.metas.escolherPara', { titulo: metaAberta.titulo })}>
          <div className="shrink-0 px-3 py-2.5 border-b border-ln-ink/[0.06] flex flex-col gap-1.5">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-ln-t4">{t('sprints.metas.escolhendoPara')}</p>
                <p className="text-[14px] font-semibold text-ln-t1 truncate" title={metaAberta.titulo}>{metaAberta.titulo}</p>
              </div>
              <button type="button" onClick={() => setMetaAbertaId(null)} className="ln-iconbtn" aria-label={t('sprints.metas.fecharLista')}><X className="w-4 h-4" /></button>
            </div>
            <label className="flex items-center gap-2 text-xs text-ln-t3">{t('sprints.metas.semNinguemVaiPara')}
              <select value={quemFaz || ''} onChange={(e) => setPessoaPadrao(e.target.value)} className="ln-input !h-7 !w-[170px] text-xs">
                {linhas.map((l) => <option key={l.id} value={l.pessoa_id}>{membrosMap.get(l.pessoa_id)?.name}</option>)}
              </select>
            </label>
          </div>
          <div className="flex-1 min-h-0">
            <SprintBacklog
              key={metaAberta.id} sprint={sprint} squadId={squadId} membrosIds={membrosIds} tarefasMap={tarefasMap}
              idsNaSprint={idsNaSprint} idsTransbordo={idsTransbordo} ctx={ctx} cfg={s.config} clienteInicial={clienteInicial}
              onAdd={(x) => acoes.adicionarNaMeta(metaAberta, [x], quemFaz)} onAddTodas={(ts) => acoes.adicionarNaMeta(metaAberta, ts, quemFaz)}
            />
          </div>
        </aside>
      )}
    </div>
  )
}
