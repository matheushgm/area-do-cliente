import { useState, useEffect, useMemo, useCallback, createContext, useContext } from 'react'
import { useOutletContext, useParams, useNavigate } from 'react-router-dom'
import {
  FlaskConical, Plus, Menu, Zap, ArrowLeft, Play, Pause, Square, RotateCcw,
  Trash2, Pencil, ExternalLink, Copy, Check, Loader2, Trophy, Archive, Info, X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { useI18n } from '../i18n'
import Modal from '../components/UI/Modal'
import Toast from '../components/UI/Toast'
import { useToast } from '../hooks/useToast'
import {
  STATUS_AB, SLOTS_PADRAO, MIN_VISITAS, MIN_CONVERSOES,
  analisar, trechoScript, linkPrevia, fmtChance,
  listarTestes, carregarTeste, criarTeste, atualizarTeste, excluirTeste,
  salvarVariante, salvarPesos, arquivarVariante, declararVencedor,
} from '../lib/testesAB'

// /testes-ab (lista) e /testes-ab/:id (detalhe). Os dados moram nas tabelas
// ab_* (migration 141); as LPs falam com /api/ab pelo kit public/ab.js.

// Banco e caminho base vêm de um contexto: o app usa o Supabase de verdade e o
// harness /dev/testes-ab (só em DEV) passa um banco em memória, sem login.
export const AmbienteAB = createContext({ banco: supabase, base: '/testes-ab' })
const useAmbiente = () => useContext(AmbienteAB)

const COR_STATUS = {
  rodando: 'bg-rl-green/10 text-rl-green',
  rascunho: 'bg-rl-surface text-rl-muted border border-rl-border',
  pausado: 'bg-rl-gold/10 text-rl-gold',
  encerrado: 'bg-rl-purple/10 text-rl-purple',
}

const pct = (n, casas = 2) => `${(n * 100).toFixed(casas).replace('.', ',')}%`
const num = (n, locale) => Number(n || 0).toLocaleString(locale)
const dominio = (url) => { try { return new URL(url).host + new URL(url).pathname.replace(/\/$/, '') } catch { return url || '' } }

function StatusPill({ status }) {
  const { t } = useI18n()
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${COR_STATUS[status] || ''}`}>
      {status === 'rodando' && <span className="w-1.5 h-1.5 rounded-full bg-rl-green animate-pulse" />}
      {t(`testesAB.status.${status}`)}
    </span>
  )
}

function textoVeredito(t, a, teste) {
  const vencedor = teste?.vencedor_id && teste.variantes.find((v) => v.id === teste.vencedor_id)
  if (vencedor) return t('testesAB.veredito.vencedor', { nome: vencedor.nome })
  if (a.veredito === 'variante_vence') return t('testesAB.veredito.variante_vence', { nome: a.melhor.nome, chance: fmtChance(a.melhor.chance) })
  return t(`testesAB.veredito.${a.veredito}`)
}

function Casca({ children }) {
  const { openSidebar } = useOutletContext() || {}
  const { t } = useI18n()
  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 border-b border-rl-border bg-rl-bg/90 backdrop-blur-xl">
        <button onClick={() => openSidebar?.()} aria-label={t('testesAB.abrirMenu')} className="p-2 rounded-lg text-rl-muted hover:text-rl-text hover:bg-rl-surface transition-all">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-rl flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-rl-text text-sm">{t('testesAB.titulo')}</span>
        </div>
      </div>
      <main className="flex-1 px-4 sm:px-6 py-8">
        <div className="max-w-6xl mx-auto space-y-6">{children}</div>
      </main>
    </div>
  )
}

export default function TestesAB() {
  const { id } = useParams()
  return <Casca>{id ? <DetalheTeste id={id} /> : <ListaTestes />}</Casca>
}

// ─── Lista ───────────────────────────────────────────────────────────────────
function ListaTestes() {
  const { banco: supabase, base } = useAmbiente()
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const { projects } = useApp()
  const [testes, setTestes] = useState(null)
  const [erro, setErro] = useState(null)
  const [filtro, setFiltro] = useState('todos')
  const [cliente, setCliente] = useState('')
  const [novo, setNovo] = useState(false)

  const nomeCliente = useMemo(() => Object.fromEntries((projects || []).map((p) => [p.id, p.companyName || p.company_name])), [projects])

  useEffect(() => {
    let vivo = true
    listarTestes(supabase)
      .then((d) => vivo && setTestes(d))
      .catch((e) => vivo && setErro(e.message))
    return () => { vivo = false }
  }, [supabase])

  const analisados = useMemo(() => (testes || []).map((tt) => ({ ...tt, a: analisar(tt.variantes, tt.resumo) })), [testes])
  const contagem = useMemo(() => {
    const c = { todos: analisados.length }
    for (const s of STATUS_AB) c[s] = analisados.filter((x) => x.status === s).length
    return c
  }, [analisados])
  const clientesComTeste = useMemo(() => [...new Set(analisados.map((x) => x.project_id).filter(Boolean))], [analisados])
  const visiveis = analisados.filter((x) => (filtro === 'todos' || x.status === filtro) && (!cliente || x.project_id === cliente))

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-2xl bg-rl-purple/10 flex items-center justify-center">
          <FlaskConical className="w-5 h-5 text-rl-purple" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-rl-text">{t('testesAB.titulo')}</h1>
          <p className="text-sm text-rl-muted">{t('testesAB.subtitulo')}</p>
        </div>
        <button onClick={() => setNovo(true)} className="btn-primary !px-4 !py-2.5 text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> {t('testesAB.novoTeste')}
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {['todos', ...STATUS_AB].map((s) => (
          <button
            key={s}
            onClick={() => setFiltro(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filtro === s ? 'bg-rl-purple text-white' : 'bg-rl-surface text-rl-subtle hover:text-rl-text border border-rl-border'}`}
          >
            {s === 'todos' ? t('testesAB.filtros.todos') : t(`testesAB.status.${s}`)} <span className="opacity-70">{contagem[s] || 0}</span>
          </button>
        ))}
        <select value={cliente} onChange={(e) => setCliente(e.target.value)} className="input-field !w-auto !py-1.5 !px-3 text-xs ml-auto">
          <option value="">{t('testesAB.todosClientes')}</option>
          {clientesComTeste.map((pid) => <option key={pid} value={pid}>{nomeCliente[pid] || pid}</option>)}
        </select>
      </div>

      {erro && <p className="text-sm text-rl-red">{t('testesAB.erroCarregar', { msg: erro })}</p>}
      {!testes && !erro && <p className="text-sm text-rl-muted flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{t('testesAB.carregando')}</p>}
      {testes && !visiveis.length && (
        <div className="glass-card p-10 text-center text-sm text-rl-muted">{testes.length ? t('testesAB.vazioFiltro') : t('testesAB.vazio')}</div>
      )}

      {!!visiveis.length && (
        <div className="glass-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-rl-muted border-b border-rl-border">
                <th className="text-left font-medium px-4 py-3">{t('testesAB.col.teste')}</th>
                <th className="text-left font-medium px-3 py-3 whitespace-nowrap">{t('testesAB.col.cliente')}</th>
                <th className="text-left font-medium px-3 py-3 whitespace-nowrap">{t('testesAB.col.status')}</th>
                <th className="text-right font-medium px-3 py-3 whitespace-nowrap">{t('testesAB.col.variantes')}</th>
                <th className="text-right font-medium px-3 py-3 whitespace-nowrap">{t('testesAB.col.visitas')}</th>
                <th className="text-right font-medium px-3 py-3 whitespace-nowrap">{t('testesAB.col.conversoes')}</th>
                <th className="text-right font-medium px-3 py-3 whitespace-nowrap">{t('testesAB.col.taxa')}</th>
                <th className="text-left font-medium px-4 py-3">{t('testesAB.col.situacao')}</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((x) => (
                <tr key={x.id} onClick={() => navigate(`${base}/${x.id}`)} className="border-b border-rl-border last:border-0 hover:bg-rl-surface/60 cursor-pointer">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-rl-text">{x.nome}</div>
                    <div className="text-[11px] text-rl-muted truncate max-w-[280px]">{t(`testesAB.tiposCurto.${x.tipo}`)} · {dominio(x.url)}</div>
                  </td>
                  <td className="px-3 py-3 text-rl-subtle whitespace-nowrap">{nomeCliente[x.project_id] || t('testesAB.semCliente')}</td>
                  <td className="px-3 py-3"><StatusPill status={x.status} /></td>
                  <td className="px-3 py-3 text-right tabular-nums">{x.variantes.filter((v) => !v.arquivada).length}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{num(x.a.totais.visitas, locale)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{num(x.a.totais.conversoes, locale)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{pct(x.a.totais.taxa)}</td>
                  <td className="px-4 py-3 text-xs text-rl-subtle">{x.status === 'rascunho' ? '-' : textoVeredito(t, x.a, x)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {novo && <TesteModal onClose={() => setNovo(false)} onSalvo={(tt) => navigate(`${base}/${tt.id}`)} />}
    </>
  )
}

// ─── Criar / editar teste ────────────────────────────────────────────────────
function TesteModal({ teste, onClose, onSalvo }) {
  const { banco: supabase } = useAmbiente()
  const { t } = useI18n()
  const { projects, user } = useApp()
  const [f, setF] = useState({
    nome: teste?.nome || '',
    project_id: teste?.project_id || '',
    url: teste?.url || '',
    tipo: teste?.tipo || 'texto',
    conversao: teste?.conversao || 'todas',
    descricao: teste?.descricao || '',
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)
  const clientes = useMemo(
    () => [...(projects || [])].sort((a, b) => String(a.companyName || '').localeCompare(String(b.companyName || ''))),
    [projects],
  )
  const set = (k) => (e) => setF((o) => ({ ...o, [k]: e.target.value }))

  async function salvar(e) {
    e.preventDefault()
    if (!f.nome.trim()) return setErro(t('testesAB.form.nomeObrigatorio'))
    setSalvando(true)
    setErro(null)
    const dados = { ...f, nome: f.nome.trim(), url: f.url.trim() || null, project_id: f.project_id || null, descricao: f.descricao.trim() || null }
    try {
      if (teste) {
        await atualizarTeste(supabase, teste.id, dados)
        onSalvo({ ...teste, ...dados })
      } else {
        onSalvo(await criarTeste(supabase, dados, user?.id))
      }
    } catch (err) {
      setErro(err.message)
      setSalvando(false)
    }
  }

  return (
    <Modal onClose={onClose} maxWidth="lg">
      <form onSubmit={salvar} className="space-y-4">
        <h2 className="text-lg font-bold text-rl-text">{teste ? t('testesAB.form.tituloEditar') : t('testesAB.form.tituloNovo')}</h2>
        <Campo rotulo={t('testesAB.form.nome')}>
          <input autoFocus className="input-field" value={f.nome} onChange={set('nome')} placeholder={t('testesAB.form.nomePh')} />
        </Campo>
        <div className="grid sm:grid-cols-2 gap-4">
          <Campo rotulo={t('testesAB.form.cliente')}>
            <select className="input-field" value={f.project_id} onChange={set('project_id')}>
              <option value="">{t('testesAB.semCliente')}</option>
              {clientes.map((p) => <option key={p.id} value={p.id}>{p.companyName || p.company_name}</option>)}
            </select>
          </Campo>
          <Campo rotulo={t('testesAB.form.conversao')}>
            <select className="input-field" value={f.conversao} onChange={set('conversao')}>
              {['todas', 'lead', 'clique'].map((c) => <option key={c} value={c}>{t(`testesAB.conversoes.${c}`)}</option>)}
            </select>
          </Campo>
        </div>
        <Campo rotulo={t('testesAB.form.url')}>
          <input className="input-field" type="url" value={f.url} onChange={set('url')} placeholder={t('testesAB.form.urlPh')} />
        </Campo>
        <Campo rotulo={t('testesAB.form.tipo')}>
          <div className="grid sm:grid-cols-2 gap-2">
            {['texto', 'pagina'].map((tp) => (
              <button
                type="button"
                key={tp}
                disabled={!!teste && teste.status !== 'rascunho'}
                onClick={() => setF((o) => ({ ...o, tipo: tp }))}
                className={`text-left px-3 py-2.5 rounded-xl border text-sm transition-colors disabled:opacity-50 ${f.tipo === tp ? 'border-rl-purple bg-rl-purple/10 text-rl-text' : 'border-rl-border bg-rl-surface text-rl-subtle'}`}
              >
                {t(`testesAB.tipos.${tp}`)}
              </button>
            ))}
          </div>
        </Campo>
        <Campo rotulo={t('testesAB.form.descricao')}>
          <textarea className="input-field min-h-[72px]" value={f.descricao} onChange={set('descricao')} placeholder={t('testesAB.form.descricaoPh')} />
        </Campo>
        {erro && <p className="text-sm text-rl-red">{erro}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary !px-4 !py-2 text-sm">{t('testesAB.form.cancelar')}</button>
          <button type="submit" disabled={salvando} className="btn-primary !px-4 !py-2 text-sm flex items-center gap-2">
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            {teste ? t('testesAB.form.salvar') : t('testesAB.form.criar')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function Campo({ rotulo, ajuda, children }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-rl-subtle">{rotulo}</span>
      {children}
      {ajuda && <span className="block text-[11px] text-rl-muted">{ajuda}</span>}
    </label>
  )
}

// ─── Detalhe ─────────────────────────────────────────────────────────────────
function DetalheTeste({ id }) {
  const { banco: supabase, base } = useAmbiente()
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const { projects } = useApp()
  const { toast, showToast } = useToast()
  const [teste, setTeste] = useState(undefined)
  const [erro, setErro] = useState(null)
  const [editando, setEditando] = useState(false)
  const [variacao, setVariacao] = useState(null) // {} = nova, objeto = editar
  const [ajustesPeso, setAjustesPeso] = useState({}) // rascunho da exibição, por variante
  const [ocupado, setOcupado] = useState(false)

  const recarregar = useCallback(async () => {
    try {
      const d = await carregarTeste(supabase, id)
      setTeste(d)
      setErro(null)
    } catch (e) {
      setErro(e.message)
    }
  }, [id, supabase])

  useEffect(() => { recarregar() }, [recarregar])
  useEffect(() => {
    if (teste?.status !== 'rodando') return undefined
    const tm = setInterval(recarregar, 30000)
    return () => clearInterval(tm)
  }, [teste?.status, recarregar])

  // Exibição editada fica num rascunho por cima do que está gravado até
  // "Salvar exibição"; a releitura de 30 s não apaga o que a pessoa digitou.
  const pesos = useMemo(() => {
    const gravado = Object.fromEntries((teste?.variantes || []).filter((v) => !v.arquivada).map((v) => [v.id, v.peso]))
    for (const [k, v] of Object.entries(ajustesPeso)) if (k in gravado) gravado[k] = v
    return gravado
  }, [teste, ajustesPeso])
  const setPesos = (fn) => setAjustesPeso((aj) => fn({ ...pesos, ...aj }))

  const a = useMemo(() => (teste ? analisar(teste.variantes.filter((v) => !v.arquivada), teste.resumo) : null), [teste])
  const nomeCliente = useMemo(() => {
    const p = (projects || []).find((x) => x.id === teste?.project_id)
    return p ? p.companyName || p.company_name : null
  }, [projects, teste?.project_id])

  if (teste === undefined && !erro) return <p className="text-sm text-rl-muted flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{t('testesAB.carregando')}</p>
  if (!teste) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate(base)} className="btn-ghost !px-2 text-sm flex items-center gap-1"><ArrowLeft className="w-4 h-4" />{t('testesAB.detalhe.voltar')}</button>
        <p className="text-sm text-rl-muted">{erro ? t('testesAB.detalhe.erro', { msg: erro }) : t('testesAB.detalhe.naoEncontrado')}</p>
      </div>
    )
  }

  const ativas = teste.variantes.filter((v) => !v.arquivada)
  const totalPeso = Object.values(pesos).reduce((s, p) => s + (Number(p) || 0), 0)
  const pesosMudaram = ativas.some((v) => Number(pesos[v.id]) !== v.peso)
  const podeIniciar = totalPeso === 100 && ativas.some((v) => !v.original && Number(pesos[v.id]) > 0)
  const vencedor = teste.variantes.find((v) => v.id === teste.vencedor_id)

  async function acao(fn, msgOk) {
    setOcupado(true)
    try {
      await fn()
      setAjustesPeso({})
      await recarregar()
      if (msgOk) showToast(msgOk)
    } catch (e) {
      showToast(t('testesAB.detalhe.erro', { msg: e.message }), 'error')
    }
    setOcupado(false)
  }

  const mudarStatus = (status, extra = {}) => acao(() => atualizarTeste(supabase, teste.id, { status, ...extra }), t('testesAB.detalhe.salvo'))

  async function iniciar() {
    if (!podeIniciar) return showToast(t('testesAB.detalhe.iniciarRequisitos'), 'error', 5000)
    await acao(async () => {
      if (pesosMudaram) await salvarPesos(supabase, Object.fromEntries(Object.entries(pesos).map(([k, v]) => [k, Number(v) || 0])))
      await atualizarTeste(supabase, teste.id, { status: 'rodando', iniciado_em: teste.iniciado_em || new Date().toISOString() })
    }, t('testesAB.detalhe.salvo'))
  }

  function encerrar() {
    if (!window.confirm(t('testesAB.detalhe.confirmarEncerrar'))) return
    mudarStatus('encerrado', { encerrado_em: new Date().toISOString() })
  }

  async function excluir() {
    if (!window.confirm(t('testesAB.detalhe.confirmarExcluir', { nome: teste.nome }))) return
    setOcupado(true)
    try {
      await excluirTeste(supabase, teste.id)
      navigate(base)
    } catch (e) {
      showToast(t('testesAB.detalhe.erro', { msg: e.message }), 'error')
      setOcupado(false)
    }
  }

  function guardarPesos() {
    if (totalPeso !== 100) return showToast(t('testesAB.detalhe.pesosDevemSomar', { total: totalPeso }), 'error')
    acao(() => salvarPesos(supabase, Object.fromEntries(Object.entries(pesos).map(([k, v]) => [k, Number(v) || 0]))), t('testesAB.detalhe.pesosSalvos'))
  }

  let mensagem
  if (teste.status === 'rascunho') mensagem = t('testesAB.detalhe.msg.rascunho')
  else if (teste.status === 'pausado') mensagem = t('testesAB.detalhe.msg.pausado')
  else if (teste.status === 'encerrado') mensagem = vencedor ? t('testesAB.detalhe.msg.encerradoVencedor', { nome: vencedor.nome }) : t('testesAB.detalhe.msg.encerrado')
  else if (a.veredito === 'variante_vence') {
    mensagem = t('testesAB.detalhe.msg.variante_vence', {
      nome: a.melhor.nome,
      chance: fmtChance(a.melhor.chance),
      lift: a.melhor.lift == null ? '' : `${a.melhor.lift >= 0 ? '+' : ''}${pct(a.melhor.lift, 0)}`,
    })
  } else mensagem = t(`testesAB.detalhe.msg.${a.veredito}`)

  return (
    <>
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => navigate(base)} aria-label={t('testesAB.detalhe.voltar')} className="p-2 rounded-lg border border-rl-border bg-rl-card text-rl-subtle hover:text-rl-text">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-xl font-bold text-rl-text">{teste.nome}</h1>
        <StatusPill status={teste.status} />
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {teste.status === 'rascunho' && (
            <button disabled={ocupado} onClick={iniciar} className="btn-primary !px-4 !py-2 text-sm flex items-center gap-2"><Play className="w-4 h-4" />{t('testesAB.detalhe.iniciar')}</button>
          )}
          {teste.status === 'rodando' && (
            <button disabled={ocupado} onClick={() => mudarStatus('pausado')} className="btn-secondary !px-4 !py-2 text-sm flex items-center gap-2"><Pause className="w-4 h-4" />{t('testesAB.detalhe.pausar')}</button>
          )}
          {teste.status === 'pausado' && (
            <button disabled={ocupado} onClick={() => mudarStatus('rodando')} className="btn-primary !px-4 !py-2 text-sm flex items-center gap-2"><Play className="w-4 h-4" />{t('testesAB.detalhe.retomar')}</button>
          )}
          {(teste.status === 'rodando' || teste.status === 'pausado') && (
            <button disabled={ocupado} onClick={encerrar} className="btn-secondary !px-4 !py-2 text-sm flex items-center gap-2"><Square className="w-4 h-4" />{t('testesAB.detalhe.encerrar')}</button>
          )}
          {teste.status === 'encerrado' && (
            <button disabled={ocupado} onClick={() => mudarStatus('pausado', { vencedor_id: null, encerrado_em: null })} className="btn-secondary !px-4 !py-2 text-sm flex items-center gap-2"><RotateCcw className="w-4 h-4" />{t('testesAB.detalhe.reabrir')}</button>
          )}
          <button disabled={ocupado} onClick={excluir} title={t('testesAB.detalhe.excluir')} aria-label={t('testesAB.detalhe.excluir')} className="p-2.5 rounded-xl border border-rl-border text-rl-muted hover:text-rl-red hover:border-rl-red/40">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Experimento + relevância */}
      <div className="glass-card grid md:grid-cols-[1fr_360px]">
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-rl-text">{t('testesAB.detalhe.experimento')}</h2>
            <button onClick={() => setEditando(true)} className="text-xs text-rl-subtle hover:text-rl-text flex items-center gap-1"><Pencil className="w-3.5 h-3.5" />{t('testesAB.detalhe.editar')}</button>
          </div>
          <dl className="grid grid-cols-[110px_1fr] gap-y-2 text-sm">
            <dt className="text-rl-muted">{t('testesAB.detalhe.nome')}:</dt><dd className="text-rl-text">{teste.nome}</dd>
            <dt className="text-rl-muted">{t('testesAB.detalhe.descricao')}:</dt><dd className="text-rl-text whitespace-pre-wrap">{teste.descricao || '-'}</dd>
            <dt className="text-rl-muted">{t('testesAB.detalhe.url')}:</dt>
            <dd className="min-w-0">{teste.url ? <a href={teste.url} target="_blank" rel="noopener noreferrer" className="text-rl-text underline underline-offset-2 break-all">{teste.url}</a> : '-'}</dd>
            <dt className="text-rl-muted">{t('testesAB.detalhe.cliente')}:</dt><dd className="text-rl-text">{nomeCliente || t('testesAB.semCliente')}</dd>
            <dt className="text-rl-muted">{t('testesAB.detalhe.tipo')}:</dt><dd className="text-rl-text">{t(`testesAB.tipos.${teste.tipo}`)}</dd>
            <dt className="text-rl-muted">{t('testesAB.detalhe.conversao')}:</dt><dd className="text-rl-text">{t(`testesAB.conversoes.${teste.conversao}`)}</dd>
          </dl>
        </div>
        <div className="p-5 border-t md:border-t-0 md:border-l border-rl-border space-y-3">
          <h2 className="text-sm font-bold text-rl-text flex items-center gap-1.5">
            {t('testesAB.detalhe.relevancia')}
            <span title={t('testesAB.detalhe.relevanciaAjuda', { visitas: MIN_VISITAS, conv: MIN_CONVERSOES })}><Info className="w-3.5 h-3.5 text-rl-muted" /></span>
          </h2>
          <div className="h-2.5 rounded-full bg-rl-surface overflow-hidden">
            <div className={`h-full rounded-full ${a.minimoAtingido ? 'bg-rl-green' : 'bg-rl-purple'}`} style={{ width: `${Math.round(a.progresso * 100)}%` }} />
          </div>
          <p className="text-[11px] text-rl-muted">{t('testesAB.detalhe.relevanciaProgresso', { atual: Math.round(a.progresso * 100) })}</p>
          <p className="text-sm text-rl-subtle">{mensagem}</p>
          {teste.status === 'rodando' && <p className="text-[11px] text-rl-muted">{t('testesAB.detalhe.atualizado')}</p>}
        </div>
      </div>

      {/* Variações */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-rl-text">{t('testesAB.detalhe.variacoes')}</h2>
          {teste.status !== 'encerrado' && (
            <button onClick={() => setVariacao({})} className="btn-secondary !px-4 !py-2 text-sm flex items-center gap-2"><Plus className="w-4 h-4" />{t('testesAB.detalhe.adicionarVariacao')}</button>
          )}
        </div>
        <div className="glass-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-rl-muted border-b border-rl-border">
                <th className="text-left font-medium px-4 py-3">{t('testesAB.col.hipotese')}</th>
                <th className="text-right font-medium px-3 py-3 whitespace-nowrap">{t('testesAB.col.taxa')}</th>
                <th className="text-right font-medium px-3 py-3 whitespace-nowrap">{t('testesAB.col.visitas')}</th>
                <th className="text-right font-medium px-3 py-3 whitespace-nowrap">{t('testesAB.col.impressoes')}</th>
                <th className="text-right font-medium px-3 py-3 whitespace-nowrap">{t('testesAB.col.conversoes')}</th>
                <th className="text-right font-medium px-3 py-3 whitespace-nowrap">{t('testesAB.col.chance')}</th>
                <th className="text-left font-medium px-3 py-3 whitespace-nowrap">{t('testesAB.col.exibicao')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {a.linhas.map((v) => {
                const previa = linkPrevia(teste.tipo === 'pagina' && !v.original ? v.url : teste.url, v.id)
                const venceu = teste.vencedor_id === v.id
                return (
                  <tr key={v.id} className="border-b border-rl-border align-top">
                    <td className="px-4 py-3 min-w-[240px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-rl-text">{v.nome}</span>
                        {v.original && <span className="px-1.5 py-0.5 rounded-md bg-rl-green/10 text-rl-green text-[10px] font-semibold">{t('testesAB.detalhe.atual')}</span>}
                        {venceu && <span className="px-1.5 py-0.5 rounded-md bg-rl-gold/15 text-rl-gold text-[10px] font-semibold flex items-center gap-1"><Trophy className="w-3 h-3" />{t('testesAB.detalhe.vencedor')}</span>}
                      </div>
                      {v.hipotese && <p className="text-xs text-rl-muted mt-0.5">{v.hipotese}</p>}
                      {!v.original && teste.tipo === 'texto' && Object.entries(v.conteudo || {}).filter(([, txt]) => txt).map(([slot, txt]) => (
                        <p key={slot} className="text-xs text-rl-subtle mt-1 line-clamp-2"><span className="text-rl-muted">{slot}:</span> {txt}</p>
                      ))}
                      {!v.original && teste.tipo === 'pagina' && v.url && <p className="text-xs text-rl-subtle mt-1 break-all">{v.url}</p>}
                      {previa && (
                        <a href={previa} target="_blank" rel="noopener noreferrer" title={t('testesAB.detalhe.previaAjuda')} className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-rl-purple hover:underline">
                          <ExternalLink className="w-3 h-3" />{t('testesAB.detalhe.previa')}
                        </a>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums font-semibold text-rl-text">{pct(v.taxa)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{num(v.visitas, locale)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{num(v.impressoes, locale)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {num(v.conversoes, locale)}
                      {v.conversoes > 0 && <div className="text-[10px] text-rl-muted whitespace-nowrap">{t('testesAB.detalhe.leadsCliques', { lead: v.conversoesLead, clique: v.conversoesClique })}</div>}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {v.chance == null ? '-' : (
                        <span className={v.chance >= 0.95 ? 'text-rl-green font-semibold' : v.chance <= 0.05 ? 'text-rl-red' : 'text-rl-subtle'}>{fmtChance(v.chance)}</span>
                      )}
                      {v.lift != null && v.visitas > 0 && <div className="text-[10px] text-rl-muted">{v.lift >= 0 ? '+' : ''}{pct(v.lift, 0)}</div>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <input
                          type="number" min={0} max={100}
                          disabled={teste.status === 'encerrado'}
                          value={pesos[v.id] ?? 0}
                          onChange={(e) => setPesos((p) => ({ ...p, [v.id]: e.target.value === '' ? '' : Math.max(0, Math.min(100, Math.round(Number(e.target.value)))) }))}
                          className="w-16 px-2 py-1.5 rounded-lg border border-rl-border bg-rl-card text-sm text-center tabular-nums outline-none focus:border-rl-purple"
                        />
                        <span className="text-rl-muted text-xs">%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setVariacao(v)} className="px-2.5 py-1.5 rounded-lg border border-rl-border text-xs text-rl-subtle hover:text-rl-text flex items-center gap-1">
                          <Pencil className="w-3.5 h-3.5" />{t('testesAB.detalhe.editarVariacao')}
                        </button>
                        {teste.status !== 'encerrado' && teste.status !== 'rascunho' && (
                          <button
                            title={t('testesAB.detalhe.declararVencedor')}
                            aria-label={t('testesAB.detalhe.declararVencedor')}
                            onClick={() => window.confirm(t('testesAB.detalhe.confirmarVencedor', { nome: v.nome })) && acao(() => declararVencedor(supabase, teste, v.id), t('testesAB.detalhe.salvo'))}
                            className="p-1.5 rounded-lg text-rl-muted hover:text-rl-gold"
                          >
                            <Trophy className="w-4 h-4" />
                          </button>
                        )}
                        {!v.original && teste.status !== 'encerrado' && (
                          <button
                            title={t('testesAB.detalhe.arquivar')}
                            aria-label={t('testesAB.detalhe.arquivar')}
                            onClick={() => window.confirm(t('testesAB.detalhe.confirmarArquivar', { nome: v.nome })) && acao(() => arquivarVariante(supabase, v.id), t('testesAB.detalhe.salvo'))}
                            className="p-1.5 rounded-lg text-rl-muted hover:text-rl-red"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              <tr className="bg-rl-surface/60 text-xs text-rl-muted">
                <td className="px-4 py-3">{t('testesAB.col.totais')}</td>
                <td className="px-3 py-3 text-right tabular-nums">{pct(a.totais.taxa)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{num(a.totais.visitas, locale)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{num(a.totais.impressoes, locale)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{num(a.totais.conversoes, locale)}</td>
                <td className="px-3 py-3" />
                <td className={`px-3 py-3 font-semibold tabular-nums ${totalPeso === 100 ? 'text-rl-green' : 'text-rl-red'}`}>{totalPeso}%</td>
                <td className="px-4 py-3" />
              </tr>
            </tbody>
          </table>
        </div>
        {pesosMudaram && teste.status !== 'encerrado' && (
          <div className="flex items-center justify-end gap-3 flex-wrap">
            <span className={`text-xs ${totalPeso === 100 ? 'text-rl-muted' : 'text-rl-red'}`}>
              {totalPeso === 100 ? (teste.status === 'rodando' ? t('testesAB.detalhe.pesosAvisoRodando') : '') : t('testesAB.detalhe.pesosDevemSomar', { total: totalPeso })}
            </span>
            <button disabled={ocupado || totalPeso !== 100} onClick={guardarPesos} className="btn-primary !px-4 !py-2 text-sm disabled:opacity-50">{t('testesAB.detalhe.salvarPesos')}</button>
          </div>
        )}
      </div>

      <Instalacao teste={teste} />

      {editando && <TesteModal teste={teste} onClose={() => setEditando(false)} onSalvo={() => { setEditando(false); recarregar(); showToast(t('testesAB.detalhe.salvo')) }} />}
      {variacao && (
        <VariacaoModal
          teste={teste}
          variacao={variacao.id ? variacao : null}
          onClose={() => setVariacao(null)}
          onSalvo={() => { setVariacao(null); recarregar(); showToast(t('testesAB.detalhe.salvo')) }}
        />
      )}
      <Toast toast={toast} />
    </>
  )
}

// ─── Instalação ──────────────────────────────────────────────────────────────
function Instalacao({ teste }) {
  const { t } = useI18n()
  const [copiado, setCopiado] = useState(false)
  const trecho = trechoScript(teste.slug)
  const slots = [...new Set(teste.variantes.flatMap((v) => Object.keys(v.conteudo || {}).filter((k) => v.conteudo[k])))]

  function copiar() {
    navigator.clipboard?.writeText(trecho).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  return (
    <div className="glass-card p-5 space-y-3">
      <h2 className="text-sm font-bold text-rl-text">{t('testesAB.instalacao.titulo')}</h2>
      <ol className="space-y-3 text-sm text-rl-subtle list-decimal pl-5">
        <li className="space-y-2">
          <span>{t('testesAB.instalacao.passo1')}</span>
          <div className="flex items-stretch gap-2">
            <code className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-rl-surface border border-rl-border text-xs text-rl-text font-mono break-all">{trecho}</code>
            <button onClick={copiar} className="btn-secondary !px-3 !py-2 text-xs flex items-center gap-1.5 shrink-0">
              {copiado ? <Check className="w-3.5 h-3.5 text-rl-green" /> : <Copy className="w-3.5 h-3.5" />}
              {copiado ? t('testesAB.instalacao.copiado') : t('testesAB.instalacao.copiar')}
            </button>
          </div>
        </li>
        <li>
          {teste.tipo === 'texto' ? t('testesAB.instalacao.passo2Texto') : t('testesAB.instalacao.passo2Pagina')}
          {teste.tipo === 'texto' && !!slots.length && (
            <div className="mt-2 flex items-center gap-1.5 flex-wrap text-xs">
              <span className="text-rl-muted">{t('testesAB.instalacao.campos')}:</span>
              {slots.map((s) => <code key={s} className="px-1.5 py-0.5 rounded bg-rl-surface border border-rl-border text-rl-text">data-ab=&quot;{s}&quot;</code>)}
            </div>
          )}
        </li>
        <li>{t('testesAB.instalacao.passo3')}</li>
      </ol>
    </div>
  )
}

// ─── Variação ────────────────────────────────────────────────────────────────
function VariacaoModal({ teste, variacao, onClose, onSalvo }) {
  const { banco: supabase } = useAmbiente()
  const { t } = useI18n()
  const original = !!variacao?.original
  const slotsDoTeste = useMemo(() => {
    const usados = teste.variantes.flatMap((v) => Object.keys(v.conteudo || {}))
    return [...new Set([...SLOTS_PADRAO, ...usados])]
  }, [teste])
  const [nome, setNome] = useState(variacao?.nome || '')
  const [hipotese, setHipotese] = useState(variacao?.hipotese || '')
  const [conteudo, setConteudo] = useState(variacao?.conteudo || {})
  const [slots, setSlots] = useState(slotsDoTeste)
  const [url, setUrl] = useState(variacao?.url || '')
  const [novoSlot, setNovoSlot] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)

  function adicionarSlot() {
    const s = novoSlot.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-')
    if (!s || slots.includes(s)) return
    setSlots((x) => [...x, s])
    setNovoSlot('')
  }

  async function salvar(e) {
    e.preventDefault()
    if (!nome.trim()) return setErro(t('testesAB.variacao.nomeObrigatorio'))
    setSalvando(true)
    setErro(null)
    const limpo = Object.fromEntries(Object.entries(conteudo).map(([k, v]) => [k, String(v || '').trim()]).filter(([, v]) => v))
    try {
      await salvarVariante(supabase, {
        id: variacao?.id,
        experimento_id: teste.id,
        nome: nome.trim(),
        hipotese: hipotese.trim(),
        conteudo: original ? {} : limpo,
        url: original ? null : url.trim(),
        ...(variacao ? {} : { peso: 0, ordem: teste.variantes.length }),
      })
      onSalvo()
    } catch (err) {
      setErro(err.message)
      setSalvando(false)
    }
  }

  return (
    <Modal onClose={onClose} maxWidth="2xl">
      <form onSubmit={salvar} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-rl-text">{variacao ? t('testesAB.variacao.tituloEditar') : t('testesAB.variacao.tituloNova')}</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-rl-muted hover:text-rl-text"><X className="w-4 h-4" /></button>
        </div>
        <Campo rotulo={t('testesAB.variacao.nome')}>
          <input autoFocus className="input-field" value={nome} onChange={(e) => setNome(e.target.value)} placeholder={t('testesAB.variacao.nomePh')} />
        </Campo>
        <Campo rotulo={t('testesAB.variacao.hipotese')}>
          <textarea className="input-field min-h-[60px]" value={hipotese} onChange={(e) => setHipotese(e.target.value)} placeholder={t('testesAB.variacao.hipotesePh')} />
        </Campo>

        {original && <p className="text-xs text-rl-muted">{t('testesAB.variacao.originalAviso')}</p>}

        {!original && teste.tipo === 'pagina' && (
          <Campo rotulo={t('testesAB.variacao.url')}>
            <input className="input-field" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
          </Campo>
        )}

        {!original && teste.tipo === 'texto' && (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold text-rl-subtle">{t('testesAB.variacao.conteudo')}</p>
              <p className="text-[11px] text-rl-muted">{t('testesAB.variacao.conteudoAjuda')}</p>
            </div>
            {slots.map((s) => (
              <Campo key={s} rotulo={<code className="text-rl-text">data-ab=&quot;{s}&quot;</code>}>
                <textarea
                  className="input-field min-h-[56px]"
                  value={conteudo[s] || ''}
                  onChange={(e) => setConteudo((c) => ({ ...c, [s]: e.target.value }))}
                />
              </Campo>
            ))}
            <div className="flex items-center gap-2">
              <input className="input-field !py-2" value={novoSlot} onChange={(e) => setNovoSlot(e.target.value)} placeholder={t('testesAB.variacao.novoCampoPh')}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarSlot() } }} />
              <button type="button" onClick={adicionarSlot} className="btn-secondary !px-3 !py-2 text-xs shrink-0">{t('testesAB.variacao.adicionarCampo')}</button>
            </div>
          </div>
        )}

        {erro && <p className="text-sm text-rl-red">{erro}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary !px-4 !py-2 text-sm">{t('testesAB.form.cancelar')}</button>
          <button type="submit" disabled={salvando} className="btn-primary !px-4 !py-2 text-sm flex items-center gap-2">
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('testesAB.variacao.salvar')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
