// Página pública (sem login) com os leads de um "Banco de dados": /leads/:token.
// Somente leitura. O time gera o link na aba Planilha do Banco de dados
// (share_token em bancos_dados) e escolhe quais colunas o cliente vê.
// O cliente pode buscar, filtrar por período, ajustar a largura das colunas
// (salva no navegador dele) e abrir um lead para ver tudo sem corte.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Loader2, AlertCircle, Search, RefreshCw, WrapText, Columns3, X, Mail, Phone, ExternalLink,
} from 'lucide-react'
import { useColumnWidths, larguraPadrao } from '../hooks/useColumnWidths'
import ResizeHandle from '../components/UI/ResizeHandle'

const COL_DATA = '__data'
const REFRESH_MS = 60_000

const PERIODOS = [
  { id: 'todos', label: 'Todos' },
  { id: 'hoje',  label: 'Hoje' },
  { id: '7',     label: '7 dias' },
  { id: '30',    label: '30 dias' },
]

const fmtData = (iso) => (iso
  ? new Date(iso).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  : '')

const fmtHora = (iso) => (iso
  ? new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
  : '')

function inicioDoPeriodo(id) {
  if (id === 'todos') return null
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  if (id !== 'hoje') d.setDate(d.getDate() - (Number(id) - 1))
  return d.getTime()
}

const soDigitos = (s) => String(s || '').replace(/\D/g, '')

function lerWrap() {
  try { return localStorage.getItem('leads.wrap') === '1' } catch { return false }
}

export default function BancoDadosPublico() {
  const { token } = useParams()
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [busca, setBusca] = useState('')
  const [periodo, setPeriodo] = useState('todos')
  const [wrap, setWrap] = useState(lerWrap)
  const [aberto, setAberto] = useState(null)

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true)
    try {
      const r = await fetch(`/api/banco-dados-public?t=${encodeURIComponent(token)}`)
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { if (!silencioso) setErro(j.error || 'Não consegui abrir este link.'); return }
      setErro(null)
      setDados(j)
    } catch {
      if (!silencioso) setErro('Sem conexão. Tente de novo.')
    } finally {
      if (!silencioso) setCarregando(false)
    }
  }, [token])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === 'visible') carregar(true) }, REFRESH_MS)
    return () => clearInterval(id)
  }, [carregar])

  useEffect(() => {
    if (dados?.nome) document.title = `${dados.nome}${dados.empresa ? ` · ${dados.empresa}` : ''}`
  }, [dados?.nome, dados?.empresa])

  const campos = useMemo(() => dados?.campos || [], [dados])

  const defaults = useMemo(() => {
    const o = { [COL_DATA]: 160 }
    for (const c of campos) o[c.key] = larguraPadrao(c)
    return o
  }, [campos])
  const { widths, total, startResize, resetCol, reset, customizado } = useColumnWidths(`leads.cols.${token}`, defaults)

  const registros = useMemo(() => {
    const desde = inicioDoPeriodo(periodo)
    const q = busca.trim().toLowerCase()
    return (dados?.registros || []).filter((r) => {
      if (desde && new Date(r.created_at).getTime() < desde) return false
      if (q && !Object.values(r.dados || {}).some((v) => String(v).toLowerCase().includes(q))) return false
      return true
    })
  }, [dados, busca, periodo])

  const toggleWrap = () => setWrap((w) => {
    try { localStorage.setItem('leads.wrap', w ? '0' : '1') } catch { /* modo privado */ }
    return !w
  })

  useEffect(() => {
    if (!aberto) return
    const onKey = (e) => { if (e.key === 'Escape') setAberto(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [aberto])

  const shell = 'min-h-screen bg-[#F8F9FC] text-[#0B0B14]'
  const font = { fontFamily: "'Manrope', system-ui, sans-serif" }

  if (!dados) {
    return (
      <div className={`${shell} flex items-center justify-center px-4`} style={font}>
        {erro ? (
          <div className="bg-white border border-[#E4E7F0] rounded-2xl p-8 max-w-sm text-center">
            <AlertCircle className="w-9 h-9 mx-auto text-[#E2564B] mb-3" />
            <p className="text-sm text-[#3D4254]">{erro}</p>
          </div>
        ) : (
          <Loader2 className="w-6 h-6 animate-spin text-[#767C8E]" />
        )}
      </div>
    )
  }

  const cols = [{ key: COL_DATA, label: 'Recebido em' }, ...campos]
  const cell = wrap ? 'whitespace-pre-wrap break-words' : 'truncate'

  return (
    <div className={shell} style={font}>
      <header className="bg-white border-b border-[#E4E7F0]">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 flex items-center gap-4 flex-wrap">
          <img src="/verta/logo-azul.png" alt="Verta" className="h-6 w-auto object-contain" />
          <div className="h-6 w-px bg-[#E4E7F0] hidden sm:block" />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold leading-tight truncate" style={{ fontFamily: "'Sora', sans-serif" }}>{dados.nome}</h1>
            {dados.empresa && <p className="text-xs text-[#767C8E] truncate">{dados.empresa}</p>}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums leading-none text-[#2A25F0]">{registros.length}</p>
            <p className="text-[11px] text-[#767C8E] mt-1">{registros.length === 1 ? 'lead' : 'leads'}{periodo !== 'todos' || busca ? ' no filtro' : ''}</p>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-[#767C8E] absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, e-mail, telefone…"
              className="w-full h-10 bg-white border border-[#E4E7F0] rounded-lg pl-9 pr-3 text-sm outline-none focus:border-[#2A25F0] focus:ring-2 focus:ring-[#2A25F0]/20" />
          </div>
          <div className="flex items-center bg-white border border-[#E4E7F0] rounded-lg p-0.5">
            {PERIODOS.map((p) => (
              <button key={p.id} onClick={() => setPeriodo(p.id)}
                className={`h-8 px-3 rounded-md text-xs font-semibold transition-colors ${
                  periodo === p.id ? 'bg-[#2A25F0] text-white' : 'text-[#5A6072] hover:text-[#0B0B14]'
                }`}>{p.label}</button>
            ))}
          </div>
          <button onClick={toggleWrap} title="Mostrar o texto inteiro em cada célula"
            className={`h-10 px-3 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 ${
              wrap ? 'border-[#2A25F0] text-[#2A25F0] bg-[#2A25F0]/5' : 'border-[#E4E7F0] bg-white text-[#5A6072] hover:text-[#0B0B14]'
            }`}>
            <WrapText className="w-4 h-4" /> Texto completo
          </button>
          {customizado && (
            <button onClick={reset} title="Voltar todas as colunas à largura padrão"
              className="h-10 px-3 rounded-lg border border-[#E4E7F0] bg-white text-xs font-semibold text-[#5A6072] hover:text-[#0B0B14] inline-flex items-center gap-1.5">
              <Columns3 className="w-4 h-4" /> Largura padrão
            </button>
          )}
          <button onClick={() => carregar()} disabled={carregando} title="Atualizar"
            className="h-10 w-10 rounded-lg border border-[#E4E7F0] bg-white text-[#5A6072] hover:text-[#0B0B14] inline-flex items-center justify-center disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="bg-white border border-[#E4E7F0] rounded-xl overflow-auto max-h-[calc(100vh-190px)]">
          <table className="text-sm border-collapse" style={{ width: total, minWidth: '100%', tableLayout: 'fixed' }}>
            <colgroup>
              {cols.map((c) => <col key={c.key} style={{ width: widths[c.key] }} />)}
            </colgroup>
            <thead className="sticky top-0 z-10 bg-[#F3F5FA]">
              <tr className="text-[#767C8E]">
                {cols.map((c) => (
                  <th key={c.key} className="relative text-left font-semibold px-3 py-2.5 text-[11px] uppercase tracking-wide border-b border-[#E4E7F0]">
                    <span className="block truncate pr-1">{c.label}</span>
                    <ResizeHandle onPointerDown={(e) => startResize(c.key, e)} onDoubleClick={() => resetCol(c.key)} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {registros.length === 0 ? (
                <tr><td colSpan={cols.length} className="px-3 py-12 text-center text-[#767C8E]">
                  {dados.registros?.length ? 'Nenhum lead com esse filtro.' : 'Nenhum lead ainda. Eles aparecem aqui assim que chegam.'}
                </td></tr>
              ) : registros.map((r) => (
                <tr key={r.id} onClick={() => setAberto(r)}
                  className="border-b border-[#EEF0F5] last:border-0 hover:bg-[#2A25F0]/[0.04] cursor-pointer align-top">
                  <td className={`px-3 py-2 text-xs leading-5 text-[#767C8E] tabular-nums ${wrap ? '' : 'whitespace-nowrap overflow-hidden text-ellipsis'}`}>{fmtData(r.created_at)}</td>
                  {campos.map((c) => {
                    const v = r.dados?.[c.key] || ''
                    return (
                      <td key={c.key} title={wrap ? undefined : v} className={`px-3 py-2 text-[#1E2230] ${cell}`}>
                        {v || <span className="text-[#C3C7D3]">—</span>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-[#767C8E] text-center">
          Arraste a borda de uma coluna para mudar a largura · clique num lead para ver tudo · atualizado às {fmtHora(dados.atualizadoEm)}
        </p>
      </main>

      {aberto && <LeadDrawer lead={aberto} campos={campos} onClose={() => setAberto(null)} />}
    </div>
  )
}

function LeadDrawer({ lead, campos, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-[#0B0B14]/30" onClick={onClose} />
      <aside className="relative w-full max-w-md h-full bg-white shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-[#E4E7F0] px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-[#767C8E] font-semibold">Lead</p>
            <p className="text-sm text-[#3D4254] tabular-nums">{fmtData(lead.created_at)}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-[#F3F5FA] inline-flex items-center justify-center text-[#5A6072]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <dl className="px-5 py-4 space-y-4">
          {campos.map((c) => {
            const v = lead.dados?.[c.key] || ''
            return (
              <div key={c.key}>
                <dt className="text-[11px] uppercase tracking-wide text-[#767C8E] font-semibold">{c.label}</dt>
                <dd className="mt-1 text-sm text-[#0B0B14] whitespace-pre-wrap break-words">
                  {v ? <Valor campo={c} valor={v} /> : <span className="text-[#C3C7D3]">—</span>}
                </dd>
              </div>
            )
          })}
        </dl>
      </aside>
    </div>
  )
}

function Valor({ campo, valor }) {
  const link = 'inline-flex items-center gap-1.5 text-[#2A25F0] hover:underline break-all'
  if (campo.type === 'email') {
    return <a href={`mailto:${valor}`} className={link}><Mail className="w-3.5 h-3.5 shrink-0" />{valor}</a>
  }
  if (campo.type === 'phone' && soDigitos(valor).length >= 10) {
    const d = soDigitos(valor)
    return (
      <a href={`https://wa.me/${d.length <= 11 ? `55${d}` : d}`} target="_blank" rel="noreferrer" className={link}>
        <Phone className="w-3.5 h-3.5 shrink-0" />{valor}
      </a>
    )
  }
  if (/^https?:\/\//i.test(valor)) {
    return <a href={valor} target="_blank" rel="noreferrer" className={link}><ExternalLink className="w-3.5 h-3.5 shrink-0" />{valor}</a>
  }
  return valor
}
