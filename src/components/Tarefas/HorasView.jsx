// Aba Horas (?aba=horas): dashboard do timer das tarefas (tarefas_tempo, migration 145).
// Horas por dia, por tipo de atividade, por pessoa, por cliente e por atividade, com filtros
// (período, pessoa, cliente, tipo) e CSV. As tarefas vêm com a RLS de quem olha: tarefa da lista
// pessoal de outra pessoa não vem, e as horas dela aparecem como "Lista pessoal (privada)".
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Download, X, Lock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { TIPOS_TAREFA, rotuloTipoTarefa, pessoaDoPerfil } from '../../lib/tarefas'
import { PERIODOS, intervaloDoPeriodo, diasDoIntervalo, agregarHoras, fmtDuracao, fmtHoras, partesPorDia } from '../../lib/tempo'
import { useAoMudarTempo, useAgora } from '../../hooks/useTimer'
import { Avatar, FOCO } from './Campos'
import { useI18n } from '../../i18n'

const LOTE = 1000
const COR_TIPO = new Map(TIPOS_TAREFA.map((x) => [x.key, x.cor]))

async function lerEntradas(ini, fim) {
  const out = []
  for (let de = 0; ; de += LOTE) {
    const { data, error } = await supabase.from('tarefas_tempo').select('*')
      .lt('inicio', fim.toISOString())
      .or(`fim.is.null,fim.gt.${ini.toISOString()}`)
      .order('inicio', { ascending: true }).order('id', { ascending: true })
      .range(de, de + LOTE - 1)
    if (error) throw error
    out.push(...(data || []))
    if (!data || data.length < LOTE) return out
  }
}

async function lerTarefas(ids) {
  const mapa = new Map()
  const campos = 'id, titulo, lista_id, parent_id, tipo_tarefa, estimativa_min, status_tipo'
  const buscar = async (lista) => {
    for (let i = 0; i < lista.length; i += 200) {
      const { data, error } = await supabase.from('tarefas_itens').select(campos).in('id', lista.slice(i, i + 200))
      if (error) throw error
      for (const r of data || []) mapa.set(r.id, r)
    }
  }
  await buscar(ids)
  // subtarefa sem tipo herda o da mãe
  const pais = [...new Set([...mapa.values()].filter((r) => !r.tipo_tarefa && r.parent_id && !mapa.has(r.parent_id)).map((r) => r.parent_id))]
  if (pais.length) await buscar(pais)
  return mapa
}

function Tile({ k, v, sub }) {
  return (
    <div className="ln-card px-4 py-3 min-w-0">
      <p className="text-[11px] uppercase tracking-wider text-ln-t4 font-bold">{k}</p>
      <p className="text-2xl font-bold tabular vt-display text-ln-t1">{v}</p>
      {sub && <p className="text-[11px] text-ln-t4 mt-0.5">{sub}</p>}
    </div>
  )
}

function Cartao({ titulo, children, className = '', extra }) {
  return (
    <section className={`ln-card p-4 min-w-0 ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-3"><h3 className="text-[13px] font-bold text-ln-t1">{titulo}</h3>{extra}</div>
      {children}
    </section>
  )
}

/** Barras horizontais clicáveis (o clique filtra o dashboard por aquela linha). */
function BarrasHoras({ linhas, total, ativo, onFiltrar, vazio }) {
  const { t } = useI18n()
  const max = Math.max(1, ...linhas.map((l) => l.seg))
  if (!linhas.length) return <p className="text-xs text-ln-t4">{vazio}</p>
  return (
    <div className="flex flex-col gap-1">
      {linhas.map((l) => {
        const sel = ativo === l.chave
        return (
          <button
            key={l.chave} type="button" onClick={() => onFiltrar?.(sel ? null : l.chave)} title={t('horas.dash.pctTotal', { pct: total ? Math.round((l.seg / total) * 100) : 0 })}
            className={`flex items-center gap-2 text-[13px] text-left rounded-md px-1.5 -mx-1.5 py-1 ${sel ? 'bg-ln-accent/10' : 'hover:bg-ln-ink/[0.03]'} ${FOCO}`}
          >
            <span className="w-[150px] shrink-0 truncate text-ln-t2 inline-flex items-center gap-1.5">{l.icone}{l.rotulo}</span>
            <span className="flex-1 h-2.5 rounded-full bg-ln-ink/[0.06] overflow-hidden"><i className="block h-full rounded-full" style={{ width: `${(l.seg / max) * 100}%`, backgroundColor: l.cor || 'rgb(var(--ln-accent))' }} /></span>
            <span className="w-[68px] text-right tabular text-ln-t3 text-xs">{fmtDuracao(l.seg)}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Colunas por dia (SVG), com as horas de cada pessoa no título da coluna. */
function ColunasDia({ dias, porDia, nomeDe }) {
  const { t } = useI18n()
  const W = 760, H = 190, L = 34, B = 22, T = 10, R = 6
  const max = Math.max(3600, ...dias.map((d) => porDia.get(d)?.seg || 0))
  const topoH = Math.ceil(max / 3600)
  const larg = (W - L - R) / Math.max(1, dias.length)
  const y = (seg) => T + (H - T - B) * (1 - seg / (topoH * 3600))
  const passo = Math.max(1, Math.ceil(dias.length / 10))
  const marcas = [0, Math.round(topoH / 2), topoH].filter((v, i, a) => a.indexOf(v) === i)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={t('horas.dash.porDia')}>
      {marcas.map((h) => (
        <g key={h}>
          <line x1={L} x2={W - R} y1={y(h * 3600)} y2={y(h * 3600)} stroke="rgb(var(--ln-ink) / 0.08)" />
          <text x={L - 5} y={y(h * 3600) + 3} textAnchor="end" fontSize="10" fill="rgb(var(--ln-ink) / 0.45)">{h}h</text>
        </g>
      ))}
      {dias.map((d, i) => {
        const v = porDia.get(d)
        const seg = v?.seg || 0
        const [, mm, dd] = d.split('-')
        const fimDeSemana = [0, 6].includes(new Date(`${d}T12:00:00`).getDay())
        const x = L + i * larg
        const detalhe = v ? [...v.porPessoa.entries()].sort((a, b) => b[1] - a[1]).map(([id, s]) => `${nomeDe(id)}: ${fmtDuracao(s)}`).join('\n') : ''
        return (
          <g key={d}>
            <title>{`${dd}/${mm}: ${fmtDuracao(seg)}${detalhe ? `\n${detalhe}` : ''}`}</title>
            <rect x={x} y={T} width={larg} height={H - T - B} fill="transparent" />
            {seg > 0 && <rect x={x + larg * 0.18} y={y(seg)} width={larg * 0.64} height={Math.max(1, H - B - y(seg))} rx={Math.min(3, larg * 0.2)} fill={fimDeSemana ? 'rgb(var(--ln-accent) / 0.45)' : 'rgb(var(--ln-accent))'} />}
            {(i % passo === 0 || i === dias.length - 1) && <text x={x + larg / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="rgb(var(--ln-ink) / 0.45)">{`${dd}/${mm}`}</text>}
          </g>
        )
      })}
    </svg>
  )
}

function diasUteisAteHoje(ini, fim) {
  const ate = Math.min(fim.getTime(), Date.now())
  let n = 0
  for (const d = new Date(ini); d.getTime() < ate; d.setDate(d.getDate() + 1)) if (![0, 6].includes(d.getDay())) n += 1
  return Math.max(1, n)
}

function baixarCsv(nome, linhas) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = linhas.map((l) => l.map(esc).join(';')).join('\n')
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url; a.download = nome; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function HorasView({ membros = [], membrosMap = new Map(), pastasMap = new Map(), listasMap = new Map(), onAbrirTarefa }) {
  const { t } = useI18n()
  const [periodo, setPeriodo] = useState(() => { try { return localStorage.getItem('tarefas.horas.periodo') || 'semana' } catch { return 'semana' } })
  const [filtro, setFiltro] = useState({ pessoa: null, cliente: null, tipo: null })
  const [dados, setDados] = useState(null) // { entradas, tarefas }
  const [erro, setErro] = useState(null)
  const [limite, setLimite] = useState(30)
  const [ini, fim] = useMemo(() => intervaloDoPeriodo(periodo), [periodo])
  const requisicao = useRef(0)

  useEffect(() => { try { localStorage.setItem('tarefas.horas.periodo', periodo) } catch { /* noop */ } }, [periodo])

  const carregar = useCallback(async ({ silencioso = false } = {}) => {
    const n = ++requisicao.current
    if (!silencioso) { setDados(null); setErro(null) }
    try {
      const entradas = await lerEntradas(ini, fim)
      const tarefas = await lerTarefas([...new Set(entradas.map((e) => e.tarefa_id))])
      if (n === requisicao.current) setDados({ entradas, tarefas })
    } catch (e) {
      if (n === requisicao.current) setErro(e.message)
    }
  }, [ini, fim])
  useEffect(() => { carregar() }, [carregar])

  // alguém iniciou/parou/registrou tempo: relê em silêncio (agrupado, no máximo a cada 3 s)
  const espera = useRef(null)
  const aoMudar = useCallback(() => {
    clearTimeout(espera.current)
    espera.current = setTimeout(() => carregar({ silencioso: true }), 3000)
  }, [carregar])
  useAoMudarTempo(aoMudar)
  useEffect(() => () => clearTimeout(espera.current), [])

  const rodando = !!dados?.entradas.some((e) => !e.fim)
  // timers rodando: os números andam (a cada 30 s basta para o dashboard)
  const relogio = useAgora(rodando)
  const agora = useMemo(() => Math.floor(relogio / 30000) * 30000, [relogio])

  const nomeDe = useCallback((id) => membrosMap.get(id)?.name || '?', [membrosMap])
  const tipoDe = useCallback((tarefa) => tarefa.tipo_tarefa || (tarefa.parent_id ? dados?.tarefas.get(tarefa.parent_id)?.tipo_tarefa : null) || null, [dados])
  const clienteDe = useCallback((tarefa) => {
    const l = listasMap.get(tarefa.lista_id)
    if (l?.dono_id) return '__pessoal'
    return l?.pasta_id || null
  }, [listasMap])

  const filtradas = useMemo(() => {
    if (!dados) return []
    return dados.entradas.filter((e) => {
      if (filtro.pessoa && e.user_id !== filtro.pessoa) return false
      if (!filtro.cliente && !filtro.tipo) return true
      const tarefa = dados.tarefas.get(e.tarefa_id)
      const cli = tarefa ? (clienteDe(tarefa) || '__sem') : '__privada'
      const tipo = tarefa ? (tipoDe(tarefa) || '__sem') : '__privada'
      if (filtro.cliente && cli !== filtro.cliente) return false
      if (filtro.tipo && tipo !== filtro.tipo) return false
      return true
    })
  }, [dados, filtro, clienteDe, tipoDe])

  const ag = useMemo(() => (dados ? agregarHoras(filtradas, { ini, fim, tarefas: dados.tarefas, tipoDe, clienteDe, agora }) : null), [dados, filtradas, ini, fim, tipoDe, clienteDe, agora])
  const dias = useMemo(() => diasDoIntervalo(ini, fim), [ini, fim])

  const rotuloCliente = (k) => (k === '__privada' ? t('horas.dash.privada') : k === '__pessoal' ? t('horas.dash.pessoal') : k === '__sem' ? t('horas.dash.semCliente') : pastasMap.get(k)?.nome || t('horas.dash.semCliente'))
  const rotuloTipo = (k) => (k === '__privada' ? t('horas.dash.privada') : k === '__sem' ? t('horas.dash.semTipo') : rotuloTipoTarefa(k))
  const pessoaDe = (id) => { const m = membrosMap.get(id); return m ? pessoaDoPerfil(m) : { id, nome: '?', iniciais: '?', cor: '#87909e' } }

  const exportar = () => {
    if (!dados) return
    const linhas = [['Data', 'Pessoa', 'Cliente', 'Tipo de atividade', 'Atividade', 'Início', 'Fim', 'Minutos', 'Origem', 'Nota']]
    for (const e of filtradas) {
      const tarefa = dados.tarefas.get(e.tarefa_id)
      const seg = partesPorDia(e, ini, fim, agora).reduce((s, p) => s + p.seg, 0)
      if (!seg) continue
      linhas.push([
        new Date(e.inicio).toLocaleDateString('pt-BR'), nomeDe(e.user_id),
        tarefa ? rotuloCliente(clienteDe(tarefa) || '__sem') : rotuloCliente('__privada'),
        tarefa ? rotuloTipo(tipoDe(tarefa) || '__sem') : rotuloTipo('__privada'),
        tarefa ? tarefa.titulo : t('horas.dash.privada'),
        new Date(e.inicio).toLocaleString('pt-BR'), e.fim ? new Date(e.fim).toLocaleString('pt-BR') : '',
        Math.round(seg / 60), e.origem, e.nota || '',
      ])
    }
    baixarCsv(`horas-${periodo}.csv`, linhas)
  }

  const chipFiltro = (chave, rotulo) => filtro[chave] && (
    <button type="button" onClick={() => setFiltro((f) => ({ ...f, [chave]: null }))} className="ln-pill !h-7 inline-flex items-center gap-1" title={t('horas.dash.limparFiltro')}>
      {rotulo}<X className="w-3 h-3" />
    </button>
  )

  return (
    <div className="p-5 flex flex-col gap-4 max-w-6xl">
      <div className="flex items-center gap-1.5 flex-wrap">
        {PERIODOS.map((p) => <button key={p} type="button" onClick={() => { setPeriodo(p); setLimite(30) }} className={`ln-tab ${periodo === p ? 'ln-tab-active' : ''}`}>{t(`horas.dash.periodo.${p}`)}</button>)}
        <select value={filtro.pessoa || ''} onChange={(e) => setFiltro((f) => ({ ...f, pessoa: e.target.value || null }))} className="ln-input !h-8 !w-auto !text-xs ml-2" aria-label={t('horas.dash.todasPessoas')}>
          <option value="">{t('horas.dash.todasPessoas')}</option>
          {[...membros].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR')).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        {chipFiltro('cliente', filtro.cliente && rotuloCliente(filtro.cliente))}
        {chipFiltro('tipo', filtro.tipo && rotuloTipo(filtro.tipo))}
        <button type="button" onClick={exportar} disabled={!ag?.total} className="ln-pill !h-8 inline-flex items-center gap-1.5 ml-auto disabled:opacity-50"><Download className="w-3.5 h-3.5" />{t('horas.dash.exportar')}</button>
      </div>

      {erro && <p className="text-[13px] text-ln-red">{t('horas.dash.erro', { erro })}</p>}
      {!dados && !erro && <div className="py-16 flex flex-col items-center gap-2 text-ln-t4 text-xs"><Loader2 className="w-4 h-4 animate-spin" />{t('horas.dash.carregando')}</div>}

      {ag && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Tile k={t('horas.dash.kpi.total')} v={fmtHoras(ag.total)} sub={fmtDuracao(ag.total)} />
            <Tile k={t('horas.dash.kpi.atividades')} v={ag.porTarefa.length} />
            <Tile k={t('horas.dash.kpi.mediaDia')} v={fmtHoras(ag.total / diasUteisAteHoje(ini, fim))} />
            <Tile k={t('horas.dash.kpi.pessoas')} v={ag.porPessoa.length} />
            <Tile k={t('horas.dash.kpi.rodandoAgora')} v={filtradas.filter((e) => !e.fim).length} />
          </div>

          {!ag.total ? (
            <div className="ln-card p-10 text-center text-[13px] text-ln-t4">{t('horas.dash.vazio')}</div>
          ) : (
            <>
              <Cartao titulo={t('horas.dash.porDia')}><ColunasDia dias={dias} porDia={ag.porDia} nomeDe={nomeDe} /></Cartao>
              <div className="grid gap-4 lg:grid-cols-2">
                <Cartao titulo={t('horas.dash.porTipo')}>
                  <BarrasHoras
                    total={ag.total} ativo={filtro.tipo} onFiltrar={(k) => setFiltro((f) => ({ ...f, tipo: k }))}
                    linhas={ag.porTipo.map((l) => ({ ...l, rotulo: rotuloTipo(l.chave), cor: COR_TIPO.get(l.chave) || (l.chave.startsWith('__') ? '#C2C6D2' : undefined) }))}
                  />
                </Cartao>
                <Cartao titulo={t('horas.dash.porPessoa')}>
                  <BarrasHoras
                    total={ag.total} ativo={filtro.pessoa} onFiltrar={(k) => setFiltro((f) => ({ ...f, pessoa: k }))}
                    linhas={ag.porPessoa.map((l) => ({ ...l, rotulo: nomeDe(l.chave), icone: <Avatar pessoa={pessoaDe(l.chave)} size={16} />, cor: pessoaDe(l.chave).cor }))}
                  />
                </Cartao>
                <Cartao titulo={t('horas.dash.porCliente')} className="lg:col-span-2">
                  <BarrasHoras
                    total={ag.total} ativo={filtro.cliente} onFiltrar={(k) => setFiltro((f) => ({ ...f, cliente: k }))}
                    linhas={ag.porCliente.map((l) => ({ ...l, rotulo: rotuloCliente(l.chave), icone: l.chave === '__pessoal' || l.chave === '__privada' ? <Lock className="w-3 h-3 text-ln-t4" /> : null, cor: l.chave.startsWith('__') ? '#9AA0B2' : undefined }))}
                  />
                </Cartao>
              </div>

              <Cartao titulo={t('horas.dash.atividades')}>
                <div className="overflow-x-auto -mx-4">
                  <table className="w-full text-[13px] min-w-[720px]">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-ln-t4">
                        <th className="font-bold px-4 pb-2">{t('horas.dash.col.atividade')}</th>
                        <th className="font-bold px-2 pb-2">{t('horas.dash.col.tipo')}</th>
                        <th className="font-bold px-2 pb-2">{t('horas.dash.col.cliente')}</th>
                        <th className="font-bold px-2 pb-2">{t('horas.dash.col.pessoas')}</th>
                        <th className="font-bold px-2 pb-2 text-right">{t('horas.dash.col.estimado')}</th>
                        <th className="font-bold px-2 pb-2 text-right">{t('horas.dash.col.real')}</th>
                        <th className="font-bold px-4 pb-2 text-right">{t('horas.dash.col.desvio')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ag.porTarefa.slice(0, limite).map((l) => {
                        const tarefa = l.tarefa
                        const tipo = tarefa ? tipoDe(tarefa) : null
                        const est = tarefa?.estimativa_min ? tarefa.estimativa_min * 60 : null
                        const desvio = est ? Math.round((l.seg / est) * 100) : null
                        return (
                          <tr key={l.chave} className="border-t border-ln-ink/[0.06]">
                            <td className="px-4 py-2 max-w-[320px]">
                              {tarefa ? (
                                <button type="button" onClick={() => onAbrirTarefa?.(tarefa.id)} className={`truncate max-w-full text-left text-ln-t1 hover:text-ln-accent hover:underline rounded ${FOCO}`}>
                                  {l.rodando && <span className="inline-block w-1.5 h-1.5 rounded-full bg-ln-red mr-1.5 align-middle" />}{tarefa.titulo}
                                </button>
                              ) : <span className="inline-flex items-center gap-1 text-ln-t4"><Lock className="w-3 h-3" />{t('horas.dash.privada')}</span>}
                            </td>
                            <td className="px-2 py-2">
                              {tipo ? <span className="inline-flex items-center h-5 px-2 rounded-full text-[11px] font-medium text-white whitespace-nowrap" style={{ backgroundColor: COR_TIPO.get(tipo) || '#87909e' }}>{rotuloTipo(tipo)}</span> : <span className="text-ln-t4">-</span>}
                            </td>
                            <td className="px-2 py-2 text-ln-t3 truncate max-w-[160px]">{tarefa ? rotuloCliente(clienteDe(tarefa) || '__sem') : '-'}</td>
                            <td className="px-2 py-2">
                              <span className="inline-flex items-center -space-x-1.5">
                                {[...l.pessoas.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id, s]) => <span key={id} title={`${nomeDe(id)}: ${fmtDuracao(s)}`}><Avatar pessoa={pessoaDe(id)} size={18} /></span>)}
                              </span>
                            </td>
                            <td className="px-2 py-2 text-right tabular text-ln-t3">{est ? fmtDuracao(est) : '-'}</td>
                            <td className="px-2 py-2 text-right tabular text-ln-t1 font-semibold">{fmtDuracao(l.seg)}</td>
                            <td className={`px-4 py-2 text-right tabular ${desvio == null ? 'text-ln-t4' : desvio > 120 ? 'text-ln-red' : desvio < 80 ? 'text-ln-green' : 'text-ln-t2'}`}>{desvio == null ? '-' : `${desvio}%`}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {ag.porTarefa.length > limite && (
                  <button type="button" onClick={() => setLimite((n) => n + 50)} className="mt-2 text-xs text-ln-accent hover:underline">{t('horas.dash.mostrarMais', { n: ag.porTarefa.length - limite })}</button>
                )}
              </Cartao>
            </>
          )}
        </>
      )}
    </div>
  )
}
