// Página pública (sem login) onde o cliente manda um pedido para o time: /pedido/:token.
// Três etapas: tipo do pedido → detalhes (campos do tipo + prazo e contato) → revisão.
// Tipos e campos em src/lib/pedidoTipos.js (os mesmos que o servidor valida). Link do Drive
// é conferido na hora pelo servidor (aberto para "qualquer pessoa com o link"?).
// Cai na fila de Intake do VertaTask. Usa o client_share_token do projeto.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Loader2, CheckCircle2, AlertCircle, AlertTriangle, Send, ArrowLeft, ArrowRight, Check, Info, Lock, RefreshCw, Pencil, Clock,
  Image, Clapperboard, LayoutTemplate, Megaphone, Wallet, MessageCircle, PenLine,
} from 'lucide-react'
import {
  TIPOS_PEDIDO, TIPOS_PEDIDO_MAP, GRUPOS_PEDIDO, CAMPOS_FINAIS, camposVisiveis, validarPedido, montarPedido, lerLinkDrive, valorDe, telefoneTexto,
} from '../lib/pedidoTipos'

const ICONES = { criativo_estatico: Image, criativo_video: Clapperboard, landing_page: LayoutTemplate, nova_campanha: Megaphone, orcamento: Wallet, whatsapp: MessageCircle, outras: PenLine }
const ETAPAS = ['Tipo', 'Detalhes', 'Revisão']

const lerLS = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null') } catch { return null } }
const gravarLS = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)) } catch { /* modo privado */ } }
const hoje = () => new Date().toLocaleDateString('sv-SE')

// máscara do telefone enquanto digita: (62) 99999-8888
function mascaraTelefone(s) {
  const d = String(s || '').replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

const inputCls = (erro) => `w-full rounded-lg border bg-white px-3 text-base sm:text-sm text-[#0B0B14] placeholder:text-[#9AA0B2] outline-none transition focus:border-[#2A25F0] focus:ring-2 focus:ring-[#2A25F0]/20 ${erro ? 'border-[#E2564B]' : 'border-[#E4E7F0]'}`

// ── Campos ───────────────────────────────────────────────────────────────────

function Opcoes({ campo, valor, multi, onChange, erro }) {
  const marcado = (v) => (multi ? (valor || []).includes(v) : valor === v)
  const alternar = (v) => {
    if (multi) {
      const atual = valor || []
      // "Vocês decidem" não convive com as outras escolhas
      if (v === 'decidam') return onChange(atual.includes(v) ? [] : [v])
      return onChange(atual.includes(v) ? atual.filter((x) => x !== v) : [...atual.filter((x) => x !== 'decidam'), v])
    }
    onChange(valor === v && !valorDe(campo.obrigatorio) ? '' : v)
  }
  const comDesc = campo.opcoes.some((o) => o.desc)
  return (
    <div role={multi ? 'group' : 'radiogroup'} className={comDesc ? 'grid gap-2 sm:grid-cols-2' : 'flex flex-wrap gap-2'}>
      {campo.opcoes.map((o) => {
        const on = marcado(o.v)
        return (
          <button
            key={o.v} type="button" role={multi ? 'checkbox' : 'radio'} aria-checked={on} onClick={() => alternar(o.v)}
            className={`text-left rounded-lg border transition flex items-start gap-2.5 ${comDesc ? 'px-3.5 py-3' : 'px-3.5 h-10 items-center'} ${on ? 'border-[#2A25F0] bg-[#2A25F0]/[0.06] ring-1 ring-[#2A25F0]' : `${erro ? 'border-[#E2564B]/60' : 'border-[#E4E7F0]'} bg-white hover:border-[#B9BCF7]`}`}
          >
            <span className={`mt-px shrink-0 w-4 h-4 inline-flex items-center justify-center border ${multi ? 'rounded' : 'rounded-full'} ${on ? 'bg-[#2A25F0] border-[#2A25F0] text-white' : 'border-[#C9CDDA] bg-white'}`}>
              {on && (multi ? <Check className="w-3 h-3" strokeWidth={3} /> : <span className="w-1.5 h-1.5 rounded-full bg-white" />)}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[#0B0B14] leading-tight">{o.label}</span>
              {o.desc && <span className="block text-xs text-[#767C8E] mt-0.5">{o.desc}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function StatusDrive({ st, onConferir }) {
  if (!st) return null
  if (st.estado === 'conferindo') return <p className="text-xs text-[#5A6072] inline-flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Conferindo se o link está aberto…</p>
  if (st.estado === 'ok') return <p className="text-xs font-semibold text-[#1F8A5B] inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Link aberto{st.nome ? `: ${st.nome}` : ''}</p>
  if (st.estado === 'incerto') return <p className="text-xs text-[#8a6a14] inline-flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Não consegui conferir agora. Pode seguir, o time confere depois.</p>
  const fechado = st.estado === 'fechado'
  return (
    <div className="rounded-lg border border-[#E2564B]/30 bg-[#E2564B]/[0.05] px-3 py-2.5 text-xs text-[#3D4254]">
      <p className="font-semibold text-[#C2392F] inline-flex items-center gap-1.5">{fechado ? <Lock className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}{fechado ? 'Esse link está fechado: o time não vai conseguir abrir.' : 'Não achei nada nesse link. Confira se copiou inteiro.'}</p>
      {fechado && <p className="mt-1">No Drive, clique com o botão direito na pasta ou no arquivo, depois em <b>Compartilhar</b>. Em <b>Acesso geral</b>, troque &quot;Restrito&quot; por <b>Qualquer pessoa com o link</b>.</p>}
      <button type="button" onClick={onConferir} className="mt-2 inline-flex items-center gap-1.5 font-semibold text-[#2A25F0]"><RefreshCw className="w-3.5 h-3.5" /> Já liberei, conferir de novo</button>
    </div>
  )
}

function Campo({ campo, r, set, erro, driveSt, conferirDrive }) {
  const label = valorDe(campo.label, r)
  const ajuda = valorDe(campo.ajuda, r)
  const placeholder = valorDe(campo.placeholder, r)
  const obrig = valorDe(campo.obrigatorio, r)
  const v = r[campo.k]
  const id = `f-${campo.k}`

  if (campo.tipo === 'aviso') {
    return <div className="rounded-lg bg-[#2A25F0]/[0.06] border border-[#2A25F0]/15 px-3.5 py-3 text-[13px] text-[#3D4254] flex gap-2.5"><Info className="w-4 h-4 text-[#2A25F0] shrink-0 mt-0.5" /><p>{label}</p></div>
  }
  if (campo.tipo === 'check') {
    return (
      <button type="button" role="checkbox" aria-checked={!!v} onClick={() => set(campo.k, !v)} className={`text-left rounded-lg border px-3.5 py-3 flex items-start gap-2.5 transition ${v ? 'border-[#E2564B] bg-[#E2564B]/[0.05]' : 'border-[#E4E7F0] bg-white hover:border-[#C9CDDA]'}`}>
        <span className={`mt-px shrink-0 w-4 h-4 rounded inline-flex items-center justify-center border ${v ? 'bg-[#E2564B] border-[#E2564B] text-white' : 'border-[#C9CDDA] bg-white'}`}>{v && <Check className="w-3 h-3" strokeWidth={3} />}</span>
        <span className="text-sm font-semibold text-[#3D4254]">{label}</span>
      </button>
    )
  }

  let controle
  switch (campo.tipo) {
    case 'textarea':
      controle = <textarea id={id} rows={campo.linhas || 4} maxLength={3000} value={v || ''} onChange={(e) => set(campo.k, e.target.value)} placeholder={placeholder} className={`${inputCls(erro)} py-2.5 resize-y`} />
      break
    case 'escolha':
    case 'multi':
      controle = <Opcoes campo={campo} valor={v} multi={campo.tipo === 'multi'} onChange={(x) => set(campo.k, x)} erro={erro} />
      break
    case 'numero':
      controle = <input id={id} type="number" inputMode="numeric" min={campo.min} max={campo.max} value={v || ''} onChange={(e) => set(campo.k, e.target.value)} placeholder={placeholder} className={`${inputCls(erro)} h-11 sm:h-10 !w-28`} />
      break
    case 'dinheiro': {
      const per = r[`${campo.k}_periodo`] || 'mes'
      controle = (
        <div className="flex flex-wrap items-center gap-2">
          <div className={`flex items-center h-11 sm:h-10 rounded-lg border bg-white focus-within:border-[#2A25F0] focus-within:ring-2 focus-within:ring-[#2A25F0]/20 ${erro ? 'border-[#E2564B]' : 'border-[#E4E7F0]'}`}>
            <span className="pl-3 pr-1 text-sm font-semibold text-[#767C8E]">R$</span>
            <input id={id} inputMode="decimal" value={v || ''} onChange={(e) => set(campo.k, e.target.value.replace(/[^\d.,]/g, ''))} placeholder="0" className="w-32 h-full pr-3 bg-transparent outline-none text-base sm:text-sm" />
          </div>
          <div className="inline-flex rounded-lg border border-[#E4E7F0] bg-white p-0.5" role="radiogroup" aria-label="Período">
            {[['mes', 'por mês'], ['dia', 'por dia']].map(([k, rot]) => (
              <button key={k} type="button" role="radio" aria-checked={per === k} onClick={() => set(`${campo.k}_periodo`, k)} className={`h-9 sm:h-8 px-3 rounded-md text-sm font-semibold transition ${per === k ? 'bg-[#2A25F0] text-white' : 'text-[#5A6072] hover:text-[#0B0B14]'}`}>{rot}</button>
            ))}
          </div>
        </div>
      )
      break
    }
    case 'data':
      controle = <input id={id} type="date" min={campo.k === 'fim' && r.inicio ? r.inicio : hoje()} value={v || ''} onChange={(e) => set(campo.k, e.target.value)} className={`${inputCls(erro)} h-11 sm:h-10 !w-48`} />
      break
    case 'telefone':
      controle = <input id={id} type="tel" inputMode="tel" autoComplete="tel" value={v || ''} onChange={(e) => set(campo.k, mascaraTelefone(e.target.value))} placeholder={placeholder || '(00) 00000-0000'} className={`${inputCls(erro)} h-11 sm:h-10 !w-56`} />
      break
    case 'link':
    case 'drive':
      controle = (
        <input
          id={id} type="url" inputMode="url" autoComplete="off" value={v || ''} onChange={(e) => set(campo.k, e.target.value.trim())}
          onBlur={() => campo.tipo === 'drive' && conferirDrive(campo.k, v)}
          placeholder={placeholder || (campo.tipo === 'drive' ? 'https://drive.google.com/…' : 'https://')} className={`${inputCls(erro)} h-11 sm:h-10`}
        />
      )
      break
    default:
      controle = <input id={id} type="text" maxLength={campo.max || 200} autoComplete={campo.k === 'nome' ? 'name' : 'off'} value={v || ''} onChange={(e) => set(campo.k, e.target.value)} placeholder={placeholder} className={`${inputCls(erro)} h-11 sm:h-10`} />
  }

  return (
    <div className="flex flex-col gap-1.5" data-campo={campo.k}>
      <label htmlFor={id} className="text-[13px] font-semibold text-[#3D4254]">
        {label}{!obrig && !/opcional/i.test(label) && campo.tipo !== 'escolha' && campo.tipo !== 'multi' ? <span className="font-normal text-[#9AA0B2]"> (opcional)</span> : null}
      </label>
      {controle}
      {campo.tipo === 'drive' && !lerLinkDrive(v) && !campo.aceitaOutros && <p className="text-xs text-[#767C8E]">No Drive, clique em Compartilhar e deixe o acesso como &quot;Qualquer pessoa com o link&quot;. A gente confere assim que você colar.</p>}
      {campo.tipo === 'drive' && lerLinkDrive(v) && <StatusDrive st={driveSt} onConferir={() => conferirDrive(campo.k, v, true)} />}
      {ajuda && <p className="text-xs text-[#767C8E]">{ajuda}</p>}
      {erro && <p className="text-xs font-semibold text-[#E2564B]">{erro}</p>}
    </div>
  )
}

// ── Página ───────────────────────────────────────────────────────────────────

export default function PedidoPublico() {
  const { token } = useParams()
  const chaveRascunho = `pedido.rascunho.${token}`
  const [info, setInfo] = useState(null) // { empresa, prazos }
  const [erroLink, setErroLink] = useState(null)
  // rascunho deste link: sai da página e volta sem perder o que escreveu
  const [rascunho] = useState(() => { const x = lerLS(chaveRascunho); return x?.tipo && TIPOS_PEDIDO_MAP[x.tipo] ? x : null })
  const [etapa, setEtapa] = useState(rascunho ? Math.min(rascunho.etapa || 0, 1) : 0)
  const [tipoId, setTipoId] = useState(rascunho?.tipo || null)
  const [r, setR] = useState(rascunho?.respostas || {})
  const [erros, setErros] = useState({})
  const [drive, setDrive] = useState({}) // { campo: { url, estado, nome } }
  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState(null)
  const [enviado, setEnviado] = useState(null) // { titulo }
  const topo = useRef(null)
  const tipo = tipoId ? TIPOS_PEDIDO_MAP[tipoId] : null

  useEffect(() => {
    let vivo = true
    fetch(`/api/intake-publico?token=${encodeURIComponent(token)}`)
      .then(async (res) => { const j = await res.json().catch(() => ({})); if (!vivo) return; if (!res.ok) setErroLink(j.error || 'Link inválido.'); else setInfo({ empresa: j.empresa || '', prazos: j.prazos || {} }) })
      .catch(() => vivo && setErroLink('Não consegui abrir esta página.'))
    return () => { vivo = false }
  }, [token])

  useEffect(() => {
    if (enviado) return
    gravarLS(chaveRascunho, tipoId ? { tipo: tipoId, respostas: r, etapa } : null)
  }, [chaveRascunho, tipoId, r, etapa, enviado])

  useEffect(() => { topo.current?.scrollIntoView({ block: 'start' }) }, [etapa, enviado])

  const set = useCallback((k, v) => {
    setR((x) => ({ ...x, [k]: v }))
    setErros((e) => (e[k] ? { ...e, [k]: undefined } : e))
  }, [])

  // Pergunta ao servidor se o link do Drive abre sem login. Uma conferência por URL (cache de
  // promessas): colar, sair do campo e revisar não repetem a chamada; "conferir de novo" força.
  const cacheDrive = useRef({})
  const conferirDrive = useCallback((k, url, forcar = false) => {
    if (!lerLinkDrive(url)) return Promise.resolve(null)
    if (forcar || !cacheDrive.current[url]) {
      cacheDrive.current[url] = fetch(`/api/intake-publico?token=${encodeURIComponent(token)}&drive=${encodeURIComponent(url)}`)
        .then(async (res) => {
          const j = await res.json().catch(() => ({}))
          if (!res.ok) return { estado: 'incerto' }
          if (j.publico === true) return { estado: 'ok', nome: j.nome }
          if (j.publico === false) return { estado: j.existe === false ? 'inexistente' : 'fechado' }
          return { estado: 'incerto' }
        })
        .catch(() => ({ estado: 'incerto' }))
    }
    setDrive((d) => (!forcar && d[k]?.url === url ? d : { ...d, [k]: { url, estado: 'conferindo' } }))
    return cacheDrive.current[url].then((res) => {
      const st = { url, ...res }
      setDrive((d) => (d[k]?.url === url ? { ...d, [k]: st } : d))
      if (st.estado === 'ok' || st.estado === 'incerto') setErros((e) => (e[k] ? { ...e, [k]: undefined } : e))
      return st
    })
  }, [token])

  // confere sozinho pouco depois de colar o link
  const camposDrive = useMemo(() => (tipo ? camposVisiveis(tipo, r).filter((c) => c.tipo === 'drive') : []), [tipo, r])
  const assinaturaDrive = camposDrive.map((c) => `${c.k}=${r[c.k] || ''}`).join('|')
  useEffect(() => {
    const h = setTimeout(() => { for (const c of camposDrive) if (lerLinkDrive(r[c.k])) conferirDrive(c.k, r[c.k]) }, 700)
    return () => clearTimeout(h)
  }, [assinaturaDrive]) // eslint-disable-line react-hooks/exhaustive-deps

  const driveParaValidar = useMemo(() => Object.fromEntries(Object.entries(drive)
    .filter(([k, st]) => st.url === r[k])
    .map(([k, st]) => [k, { publico: st.estado === 'ok' ? true : st.estado === 'fechado' || st.estado === 'inexistente' ? false : null, existe: st.estado !== 'inexistente', nome: st.nome }])), [drive, r])

  function escolherTipo(id) {
    if (id !== tipoId) {
      const salvo = lerLS('pedido.contato') || {}
      setR({ nome: salvo.nome || '', contato: salvo.contato || '' })
      setErros({}); setDrive({})
    }
    setTipoId(id); setEtapa(1)
  }

  async function revisar() {
    // espera a conferência dos links que ainda não foram conferidos
    const pend = camposDrive.filter((c) => lerLinkDrive(r[c.k]) && (drive[c.k]?.url !== r[c.k] || drive[c.k]?.estado === 'conferindo'))
    const res = await Promise.all(pend.map((c) => conferirDrive(c.k, r[c.k]).then((st) => [c.k, st])))
    const dv = { ...driveParaValidar }
    for (const [k, st] of res) if (st) dv[k] = { publico: st.estado === 'ok' ? true : st.estado === 'incerto' ? null : false, existe: st.estado !== 'inexistente' }
    const e = validarPedido(tipo, r, { drive: dv })
    setErros(e)
    const primeiro = [...camposVisiveis(tipo, r)].find((c) => e[c.k]) || (e.fim && { k: 'fim' }) || (e.contato && { k: 'contato' })
    if (primeiro) { document.querySelector(`[data-campo="${primeiro.k}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return }
    setEtapa(2)
  }

  async function enviar() {
    setEnviando(true); setErroEnvio(null)
    try {
      const res = await fetch('/api/intake-publico', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, tipo: tipoId, respostas: r }) })
      const j = await res.json().catch(() => ({}))
      if (res.ok) {
        gravarLS('pedido.contato', { nome: r.nome, contato: r.contato })
        gravarLS(chaveRascunho, null)
        setEnviado({ titulo: j.titulo || '' })
      } else if (j.erros) {
        setErros(j.erros); setEtapa(1)
        if (Object.keys(j.erros).some((k) => camposDrive.some((c) => c.k === k))) camposDrive.forEach((c) => conferirDrive(c.k, r[c.k], true))
      } else setErroEnvio(j.error || 'Não consegui enviar.')
    } catch { setErroEnvio('Sem conexão. Tente de novo.') }
    setEnviando(false)
  }

  function novoPedido() {
    setEnviado(null); setTipoId(null); setR({}); setErros({}); setDrive({}); setEtapa(0)
  }

  const resumo = useMemo(() => (tipo && etapa === 2 ? montarPedido(tipo, r, { drive: driveParaValidar }) : null), [tipo, r, etapa, driveParaValidar])
  const prazoDias = tipo && info?.prazos?.[tipo.id]
  const camposTipo = tipo ? camposVisiveis(tipo, r, { finais: false }) : []
  const camposFinais = tipo ? CAMPOS_FINAIS.filter((c) => !c.quando || c.quando(r)) : []
  const Icone = tipo ? ICONES[tipo.id] : null

  return (
    <div className="min-h-screen bg-[#F8F9FC] text-[#0B0B14]" style={{ fontFamily: "'Manrope', system-ui, sans-serif", colorScheme: 'light' }}>
      <div ref={topo} className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">
        <header className="flex items-center gap-2.5 mb-6">
          <img src="/vertatask-simbolo.png" alt="" className="w-7 h-7" />
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2A25F0]">Pedidos para a Verta</p>
            {info?.empresa && <p className="text-sm text-[#5A6072] truncate">{info.empresa}</p>}
          </div>
          {info && !enviado && (
            <ol className="ml-auto hidden sm:flex items-center gap-1.5 text-xs" aria-label="Etapas">
              {ETAPAS.map((nome, i) => (
                <li key={nome} className={`flex items-center gap-1.5 ${i <= etapa ? 'text-[#0B0B14] font-semibold' : 'text-[#9AA0B2]'}`}>
                  <span className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-[11px] ${i < etapa ? 'bg-[#2A25F0] text-white' : i === etapa ? 'border-2 border-[#2A25F0] text-[#2A25F0]' : 'border border-[#C9CDDA]'}`}>{i < etapa ? <Check className="w-3 h-3" strokeWidth={3} /> : i + 1}</span>
                  {nome}{i < ETAPAS.length - 1 && <span className="w-4 h-px bg-[#D7DAE5] ml-0.5" />}
                </li>
              ))}
            </ol>
          )}
          {info && !enviado && <p className="sm:hidden ml-auto text-xs font-semibold text-[#767C8E]">Etapa {etapa + 1} de 3</p>}
        </header>

        {!info && !erroLink ? (
          <div className="py-24 flex justify-center text-[#767C8E]"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : erroLink ? (
          <div className="bg-white border border-[#E4E7F0] rounded-2xl p-8 text-center"><AlertCircle className="w-9 h-9 mx-auto text-[#E2564B] mb-2" /><p className="text-sm">{erroLink}</p></div>
        ) : enviado ? (
          <div className="bg-white border border-[#E4E7F0] rounded-2xl p-8 text-center shadow-sm">
            <CheckCircle2 className="w-11 h-11 mx-auto text-[#1F8A5B] mb-3" />
            <h1 className="text-xl font-bold" style={{ fontFamily: "'Sora', sans-serif" }}>Pedido enviado</h1>
            {enviado.titulo && <p className="mt-2 text-sm font-semibold text-[#3D4254]">{enviado.titulo}</p>}
            <p className="mt-2 text-sm text-[#5A6072] max-w-md mx-auto">O time da Verta recebeu e já tem tudo o que precisa para começar. Se faltar algum detalhe, a gente fala com você em {/@/.test(r.contato || '') ? r.contato : telefoneTexto(r.contato)}.</p>
            <button type="button" onClick={novoPedido} className="mt-6 h-11 px-5 rounded-lg border border-[#E4E7F0] bg-white text-sm font-semibold text-[#2A25F0] hover:border-[#B9BCF7]">Fazer outro pedido</button>
          </div>
        ) : etapa === 0 || !tipo ? (
          <>
            <h1 className="text-2xl font-bold leading-tight" style={{ fontFamily: "'Sora', sans-serif" }}>O que você precisa{info.empresa ? `, ${info.empresa}` : ''}?</h1>
            <p className="text-sm text-[#5A6072] mt-1.5 mb-6">Escolha o tipo de pedido. Cada um pergunta só o que o time precisa para começar sem voltar com dúvida.</p>
            {GRUPOS_PEDIDO.map((g) => (
              <section key={g.id} className="mb-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#767C8E] mb-2">{g.nome}</p>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {TIPOS_PEDIDO.filter((t) => t.grupo === g.id).map((t) => {
                    const Ic = ICONES[t.id]
                    return (
                      <button key={t.id} type="button" onClick={() => escolherTipo(t.id)} className="group text-left bg-white border border-[#E4E7F0] rounded-xl px-4 py-3.5 flex items-center gap-3 transition hover:border-[#2A25F0] hover:shadow-[0_2px_12px_rgba(42,37,240,0.08)]">
                        <span className="w-10 h-10 shrink-0 rounded-lg bg-[#2A25F0]/[0.08] text-[#2A25F0] inline-flex items-center justify-center"><Ic className="w-5 h-5" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-bold text-[#0B0B14]">{t.nome}</span>
                          <span className="block text-[13px] text-[#767C8E] leading-snug">{t.resumo}</span>
                        </span>
                        <ArrowRight className="w-4 h-4 text-[#C9CDDA] group-hover:text-[#2A25F0] shrink-0" />
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
          </>
        ) : etapa === 1 ? (
          <>
            <button type="button" onClick={() => setEtapa(0)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#5A6072] hover:text-[#0B0B14] mb-3"><ArrowLeft className="w-4 h-4" /> Trocar o tipo</button>
            <div className="flex items-center gap-3 mb-1">
              <span className="w-10 h-10 shrink-0 rounded-lg bg-[#2A25F0] text-white inline-flex items-center justify-center"><Icone className="w-5 h-5" /></span>
              <h1 className="text-2xl font-bold leading-tight" style={{ fontFamily: "'Sora', sans-serif" }}>{tipo.nome}</h1>
            </div>
            <p className="text-sm text-[#5A6072] mb-5">{tipo.resumo}.</p>
            {prazoDias && tipo.prazoMsg?.(prazoDias, r) && <p className="mb-4 rounded-lg bg-white border border-[#E4E7F0] px-3.5 py-2.5 text-[13px] text-[#3D4254] flex gap-2"><Clock className="w-4 h-4 text-[#2A25F0] shrink-0 mt-0.5" />{tipo.prazoMsg(prazoDias, r)}</p>}

            <div className="bg-white border border-[#E4E7F0] rounded-2xl p-5 sm:p-6 flex flex-col gap-5">
              {camposTipo.map((c) => <Campo key={c.k} campo={c} r={r} set={set} erro={erros[c.k]} driveSt={drive[c.k]?.url === r[c.k] ? drive[c.k] : null} conferirDrive={conferirDrive} />)}
            </div>

            <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#767C8E] mt-7 mb-2">Prazo e contato</h2>
            <div className="bg-white border border-[#E4E7F0] rounded-2xl p-5 sm:p-6 flex flex-col gap-5">
              {camposFinais.map((c) => <Campo key={c.k} campo={c} r={r} set={set} erro={erros[c.k]} driveSt={null} conferirDrive={conferirDrive} />)}
            </div>

            {Object.values(erros).some(Boolean) && <p className="mt-4 text-sm font-semibold text-[#E2564B]">Faltou alguma coisa. Os campos em vermelho mostram o quê.</p>}
            <button type="button" onClick={revisar} disabled={Object.values(drive).some((d) => d.estado === 'conferindo')} className="mt-5 w-full h-12 rounded-lg bg-[#2A25F0] hover:bg-[#1800DB] text-white font-semibold text-[15px] inline-flex items-center justify-center gap-2 disabled:opacity-60">
              {Object.values(drive).some((d) => d.estado === 'conferindo') ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Revisar pedido <ArrowRight className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setEtapa(1)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#5A6072] hover:text-[#0B0B14] mb-3"><ArrowLeft className="w-4 h-4" /> Voltar e editar</button>
            <h1 className="text-2xl font-bold leading-tight" style={{ fontFamily: "'Sora', sans-serif" }}>Confere se está tudo certo</h1>
            <p className="text-sm text-[#5A6072] mt-1.5 mb-5">É isso que o time vai receber.</p>
            <div className="bg-white border border-[#E4E7F0] rounded-2xl overflow-hidden">
              <div className="px-5 sm:px-6 py-4 border-b border-[#EEF0F5] flex items-center gap-3">
                <span className="w-9 h-9 shrink-0 rounded-lg bg-[#2A25F0]/[0.08] text-[#2A25F0] inline-flex items-center justify-center"><Icone className="w-[18px] h-[18px]" /></span>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#2A25F0]">{tipo.nome}</p>
                  <p className="text-[15px] font-bold text-[#0B0B14] leading-snug">{resumo.titulo}</p>
                </div>
                {r.urgente && <span className="ml-auto shrink-0 text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-[#E2564B]/10 text-[#C2392F]">Urgente</span>}
              </div>
              <dl className="divide-y divide-[#EEF0F5]">
                {resumo.itens.filter((i) => i.k !== 'urgente').map((i) => (
                  <div key={i.k} className="px-5 sm:px-6 py-3 grid gap-0.5 sm:grid-cols-[170px_1fr] sm:gap-4">
                    <dt className="text-xs font-semibold text-[#767C8E] sm:pt-0.5">{i.label}</dt>
                    <dd className="text-sm text-[#0B0B14] whitespace-pre-line break-words min-w-0">
                      {i.tipo === 'link' || i.tipo === 'drive' ? <a href={i.valor} target="_blank" rel="noreferrer" className="text-[#2A25F0] underline underline-offset-2 break-all">{i.valor}</a> : i.tipo === 'telefone' ? telefoneTexto(i.valor) : i.valor}
                      {i.drive?.publico === true && <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-[#1F8A5B]"><CheckCircle2 className="w-3.5 h-3.5" /> Link aberto{i.drive.nome ? `: ${i.drive.nome}` : ''}</span>}
                      {i.drive && i.drive.publico == null && <span className="mt-1 flex items-center gap-1 text-xs text-[#8a6a14]"><AlertTriangle className="w-3.5 h-3.5" /> O time confere o acesso depois</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            {erroEnvio && <p className="mt-4 text-sm font-semibold text-[#E2564B]">{erroEnvio}</p>}
            <div className="mt-5 flex flex-col-reverse sm:flex-row gap-2.5">
              <button type="button" onClick={() => setEtapa(1)} className="h-12 sm:w-auto px-5 rounded-lg border border-[#E4E7F0] bg-white text-sm font-semibold text-[#3D4254] inline-flex items-center justify-center gap-2 hover:border-[#B9BCF7]"><Pencil className="w-4 h-4" /> Editar</button>
              <button type="button" onClick={enviar} disabled={enviando} className="flex-1 h-12 rounded-lg bg-[#2A25F0] hover:bg-[#1800DB] text-white font-semibold text-[15px] inline-flex items-center justify-center gap-2 disabled:opacity-60">
                {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar pedido
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
