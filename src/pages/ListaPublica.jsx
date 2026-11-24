// Página pública de uma lista (ou da pasta inteira de um cliente) do VertaTask: /lista/:token.
// Sem login. O link é criado pelo botão "Compartilhar" do cabeçalho do VertaTask
// (CompartilharLista) e os dados vêm de api/tarefas-publico.js, que só devolve título, status,
// responsáveis, datas e subtarefas. Duas abas: Em andamento (agrupada por status) e Concluídas.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ChevronRight, CornerDownRight, RefreshCw, Loader2, CheckCircle2, Link2Off } from 'lucide-react'
import { StatusIcon, Avatar, PrioridadeIcon } from '../components/Tarefas/Campos'
import { corDaPessoa, iniciais, fmtVencimentoClickUp, fmtDataNumerica, rotuloStatus } from '../lib/tarefas'
import { useI18n } from '../i18n'

const semAcento = (x) => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function pessoasDe(t, pessoas) {
  const out = []
  for (const id of t.responsaveis || []) {
    const p = pessoas[id]
    if (p) out.push({ id, nome: p.nome, iniciais: p.iniciais || iniciais(p.nome), cor: corDaPessoa(id), foto: p.foto })
  }
  for (const e of t.extras || []) out.push({ id: e.id, nome: e.nome, iniciais: iniciais(e.nome), cor: corDaPessoa(e.nome), foto: e.foto })
  return out
}

function Pessoas({ tarefa, pessoas }) {
  const lista = pessoasDe(tarefa, pessoas)
  if (!lista.length) return <span className="text-ln-t4 text-xs">-</span>
  return (
    <span className="inline-flex -space-x-1.5" title={lista.map((p) => p.nome).join(', ')}>
      {lista.slice(0, 3).map((p) => <Avatar key={p.id} pessoa={p} size={22} />)}
      {lista.length > 3 && <span className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-full bg-ln-ink/10 text-[10px] text-ln-t3 ring-2 ring-ln-panel">+{lista.length - 3}</span>}
    </span>
  )
}

/** Uma tarefa (com as subtarefas recolhíveis). */
function Linha({ tarefa, subs, statusesDe, pessoas, nomeLista, concluidas }) {
  const { t } = useI18n()
  const [aberta, setAberta] = useState(false)
  const feitas = subs.filter((s) => s.tipo === 'closed').length
  const fechada = tarefa.tipo === 'closed'
  const venc = fmtVencimentoClickUp(tarefa.vencimento, { status_tipo: tarefa.tipo })
  return (
    <li className="border-b border-ln-line/70 last:border-b-0">
      <div className="flex items-center gap-2.5 px-3 sm:px-4 py-2.5 min-h-[44px]">
        <span className="inline-flex items-center justify-center w-4 shrink-0">
          {subs.length > 0 && (
            <button type="button" onClick={() => setAberta((v) => !v)} className="ln-iconbtn !w-5 !h-5" aria-expanded={aberta} aria-label={aberta ? t('listaPublica.recolher') : t('listaPublica.verSubtarefas')}>
              <ChevronRight className={`w-3.5 h-3.5 transition-transform ${aberta ? 'rotate-90' : ''}`} />
            </button>
          )}
        </span>
        <StatusIcon status={tarefa.status} statuses={statusesDe(tarefa)} className="shrink-0" />
        <div className="flex-1 min-w-0">
          <p className={`text-[14px] leading-snug ${fechada ? 'text-ln-t3 line-through decoration-ln-t4/60' : 'text-ln-t1'}`}>{tarefa.titulo}</p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-[12px] text-ln-t4">
            {nomeLista && <span className="truncate max-w-[220px]">{nomeLista}</span>}
            {subs.length > 0 && <button type="button" onClick={() => setAberta((v) => !v)} className="inline-flex items-center gap-1 hover:text-ln-t2"><CornerDownRight className="w-3 h-3" />{t('listaPublica.subtarefasFeitas', { feitas, total: subs.length })}</button>}
            {concluidas && tarefa.conclusao && <span>{t('listaPublica.concluidaEm', { data: fmtDataNumerica(tarefa.conclusao) })}</span>}
            {!concluidas && venc.texto && <span className={`sm:hidden ${venc.classe}`}>{venc.texto}</span>}
          </p>
        </div>
        {!concluidas && <span className={`hidden sm:inline w-20 text-right text-[13px] tabular ${venc.classe}`}>{venc.texto || <span className="text-ln-t4">-</span>}</span>}
        {tarefa.prioridade && !fechada && <span className="hidden sm:inline-flex"><PrioridadeIcon valor={tarefa.prioridade} /></span>}
        <span className="w-[76px] flex justify-end shrink-0"><Pessoas tarefa={tarefa} pessoas={pessoas} /></span>
      </div>
      {aberta && subs.length > 0 && (
        <ul className="pb-2">
          {subs.map((s) => {
            const v = fmtVencimentoClickUp(s.vencimento, { status_tipo: s.tipo })
            return (
              <li key={s.id} className="flex items-center gap-2.5 pl-12 sm:pl-14 pr-3 sm:pr-4 py-1.5">
                <StatusIcon status={s.status} statuses={statusesDe(s)} size={14} className="shrink-0" />
                <span className={`flex-1 min-w-0 text-[13px] ${s.tipo === 'closed' ? 'text-ln-t4 line-through decoration-ln-t4/60' : 'text-ln-t2'}`}>{s.titulo}</span>
                {s.tipo !== 'closed' && v.texto && <span className={`hidden sm:inline text-[12px] tabular ${v.classe}`}>{v.texto}</span>}
                <span className="w-[76px] flex justify-end shrink-0"><Pessoas tarefa={s} pessoas={pessoas} /></span>
              </li>
            )
          })}
        </ul>
      )}
    </li>
  )
}

export default function ListaPublica() {
  const { token } = useParams()
  const { t } = useI18n()
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [aba, setAba] = useState('andamento')
  const [listaFiltro, setListaFiltro] = useState(null)
  const [busca, setBusca] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const r = await fetch(`/api/tarefas-publico?token=${encodeURIComponent(token || '')}`)
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErro(j.error || t('listaPublica.erro')); setDados(null) } else { setDados(j); setErro('') }
    } catch {
      setErro(t('listaPublica.erro'))
    } finally {
      setCarregando(false)
    }
  }, [token, t])
  useEffect(() => { carregar() }, [carregar])

  const titulo = dados ? (dados.alvo === 'lista' ? dados.listas[0]?.nome : t('listaPublica.tarefasDe', { cliente: dados.cliente || '' })) : ''
  useEffect(() => { if (titulo) document.title = dados?.alvo === 'lista' && dados?.cliente ? `${titulo} · ${dados.cliente}` : titulo }, [titulo, dados?.alvo, dados?.cliente])

  const listasMap = useMemo(() => new Map((dados?.listas || []).map((l) => [l.id, l])), [dados])
  const statusesDe = useCallback((tarefa) => listasMap.get(tarefa.lista)?.statuses || [], [listasMap])

  // todas as tarefas juntas, com as subtarefas por pai (abertas e concluídas)
  const { topoAbertas, topoConcluidas, filhos } = useMemo(() => {
    const todas = [...(dados?.abertas || []), ...(dados?.concluidas || [])]
    const ids = new Set(todas.map((x) => x.id))
    const filhos = new Map()
    for (const x of todas) if (x.pai && ids.has(x.pai)) { if (!filhos.has(x.pai)) filhos.set(x.pai, []); filhos.get(x.pai).push(x) }
    for (const arr of filhos.values()) arr.sort((a, b) => (a.criada || '').localeCompare(b.criada || ''))
    // subtarefa cujo pai não veio (pai concluído além do limite) aparece solta
    const topo = (x) => !x.pai || !ids.has(x.pai)
    const q = semAcento(busca.trim())
    const passa = (x) => (!listaFiltro || x.lista === listaFiltro) && (!q || semAcento(x.titulo).includes(q) || (filhos.get(x.id) || []).some((s) => semAcento(s.titulo).includes(q)))
    return {
      topoAbertas: (dados?.abertas || []).filter((x) => topo(x) && passa(x)),
      topoConcluidas: (dados?.concluidas || []).filter((x) => topo(x) && passa(x)),
      filhos,
    }
  }, [dados, listaFiltro, busca])

  // Em andamento agrupada por status, na ordem do status (abertos primeiro)
  const grupos = useMemo(() => {
    const porStatus = new Map()
    for (const x of topoAbertas) {
      const s = statusesDe(x).find((st) => st.key === x.status) || { key: x.status, label: x.status, cor: '#87909e', ordem: 99 }
      const k = semAcento(s.key)
      if (!porStatus.has(k)) porStatus.set(k, { status: s, itens: [] })
      porStatus.get(k).itens.push(x)
    }
    // dentro do status, pelo vencimento (sem data no fim), como o cliente lê um cronograma
    const venc = (x) => x.vencimento || '9999'
    for (const g of porStatus.values()) g.itens.sort((a, b) => venc(a).localeCompare(venc(b)) || (a.posicao ?? 0) - (b.posicao ?? 0))
    return [...porStatus.values()].sort((a, b) => (a.status.ordem ?? 99) - (b.status.ordem ?? 99))
  }, [topoAbertas, statusesDe])

  const total = topoAbertas.length + topoConcluidas.length
  const pct = total ? Math.round((topoConcluidas.length / total) * 100) : 0
  const varias = (dados?.listas || []).length > 1
  const nomeLista = (x) => (varias && !listaFiltro ? listasMap.get(x.lista)?.nome : null)

  return (
    <div className="ln vt min-h-screen bg-ln-bg text-ln-t1">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-10">
        <header className="flex items-start justify-between gap-4 mb-6">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold tracking-wide text-ln-accent uppercase">{dados?.alvo === 'lista' && dados?.cliente ? dados.cliente : t('listaPublica.acompanhamento')}</p>
            <h1 className="mt-1 text-2xl sm:text-[28px] font-bold leading-tight text-ln-t1 break-words" style={{ fontFamily: 'Sora, Manrope, sans-serif' }}>{titulo || (erro ? t('listaPublica.titulo') : '')}</h1>
            {dados && <p className="mt-1.5 text-[13px] text-ln-t3">{t('listaPublica.subtitulo')}</p>}
          </div>
          {dados && (
            <button type="button" onClick={carregar} disabled={carregando} className="ln-iconbtn shrink-0 mt-1" title={t('listaPublica.atualizar')} aria-label={t('listaPublica.atualizar')}>
              {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </button>
          )}
        </header>

        {carregando && !dados && !erro && <div className="flex justify-center py-24 text-ln-t4"><Loader2 className="w-5 h-5 animate-spin" /></div>}

        {erro && (
          <div className="ln-card p-8 text-center">
            <Link2Off className="w-6 h-6 mx-auto text-ln-t4" />
            <p className="mt-3 text-[15px] text-ln-t1 font-medium">{erro}</p>
            <p className="mt-1 text-[13px] text-ln-t3">{t('listaPublica.pecaOutro')}</p>
          </div>
        )}

        {dados && (<>
          <section className="ln-card p-4 sm:p-5 mb-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex gap-6">
                <div><p className="text-[12px] text-ln-t3">{t('listaPublica.emAndamento')}</p><p className="text-2xl font-bold tabular">{topoAbertas.length}</p></div>
                <div><p className="text-[12px] text-ln-t3">{t('listaPublica.concluidas')}</p><p className="text-2xl font-bold tabular text-ln-green">{topoConcluidas.length}</p></div>
              </div>
              <p className="text-[13px] text-ln-t3 tabular">{t('listaPublica.pctConcluido', { pct })}</p>
            </div>
            <div className="mt-3 h-2 rounded-full bg-ln-ink/[0.07] overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-ln-green transition-all" style={{ width: `${pct}%` }} />
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="inline-flex rounded-lg bg-ln-ink/[0.05] p-0.5" role="tablist">
              {[['andamento', t('listaPublica.emAndamento'), topoAbertas.length], ['concluidas', t('listaPublica.concluidas'), topoConcluidas.length]].map(([k, rot, n]) => (
                <button key={k} type="button" role="tab" aria-selected={aba === k} onClick={() => setAba(k)} className={`h-8 px-3 rounded-md text-[13px] font-medium ${aba === k ? 'bg-ln-panel text-ln-t1 shadow-sm' : 'text-ln-t3 hover:text-ln-t1'}`}>
                  {rot} <span className="tabular text-ln-t4">{n}</span>
                </button>
              ))}
            </div>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t('listaPublica.buscar')} className="ln-input h-9 flex-1 min-w-[160px] sm:max-w-[260px] sm:ml-auto" />
          </div>

          {varias && (
            <div className="flex gap-1.5 mb-4 -mx-4 px-4 overflow-x-auto sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible [&>button]:shrink-0 [&>button]:whitespace-nowrap">
              <button type="button" onClick={() => setListaFiltro(null)} className={`ln-pill ${!listaFiltro ? '!bg-ln-accent !text-white' : ''}`}>{t('listaPublica.todasListas')}</button>
              {dados.listas.map((l) => <button key={l.id} type="button" onClick={() => setListaFiltro(l.id)} className={`ln-pill ${listaFiltro === l.id ? '!bg-ln-accent !text-white' : ''}`}>{l.nome}</button>)}
            </div>
          )}

          {aba === 'andamento' && (
            grupos.length ? grupos.map((g) => (
              <section key={g.status.key} className="ln-card mb-4 overflow-hidden">
                <h2 className="flex items-center gap-2 px-4 py-2.5 border-b border-ln-line/70">
                  <span className="inline-flex items-center h-[22px] px-2 rounded-md text-[11px] font-semibold uppercase tracking-wide text-white" style={{ backgroundColor: g.status.cor || '#87909e' }}>{rotuloStatus(g.status.label || g.status.key)}</span>
                  <span className="text-[12px] text-ln-t4 tabular">{g.itens.length}</span>
                </h2>
                <ul>{g.itens.map((x) => <Linha key={x.id} tarefa={x} subs={filhos.get(x.id) || []} statusesDe={statusesDe} pessoas={dados.pessoas} nomeLista={nomeLista(x)} />)}</ul>
              </section>
            )) : <Vazio texto={t('listaPublica.nadaAndamento')} />
          )}

          {aba === 'concluidas' && (
            topoConcluidas.length ? (
              <section className="ln-card overflow-hidden">
                <ul>{topoConcluidas.map((x) => <Linha key={x.id} tarefa={x} subs={filhos.get(x.id) || []} statusesDe={statusesDe} pessoas={dados.pessoas} nomeLista={nomeLista(x)} concluidas />)}</ul>
                {dados.concluidas.length >= dados.limiteConcluidas && <p className="px-4 py-2.5 text-[12px] text-ln-t4 border-t border-ln-line/70">{t('listaPublica.limite', { n: dados.limiteConcluidas })}</p>}
              </section>
            ) : <Vazio texto={t('listaPublica.nadaConcluido')} />
          )}

          <footer className="mt-8 text-center text-[12px] text-ln-t4">{t('listaPublica.rodape')}</footer>
        </>)}
      </div>
    </div>
  )
}

function Vazio({ texto }) {
  return (
    <div className="ln-card py-12 text-center text-[13px] text-ln-t3">
      <CheckCircle2 className="w-5 h-5 mx-auto mb-2 text-ln-t4" />
      {texto}
    </div>
  )
}
