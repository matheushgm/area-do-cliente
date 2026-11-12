// Página pública (sem login) do formulário da vaga: /vaga/:cargo[?ref=<candidato_id>].
// Primeira etapa do processo seletivo; a resposta vira a triagem do candidato na Contratação.
// Perguntas e régua em src/lib/triagemVaga.js (o servidor, api/vaga-publica.js, recalcula).
// Com ?ref= (link mandado pelo WhatsApp a partir do perfil) a resposta cai no candidato certo.
import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Loader2, CheckCircle2, AlertCircle, Send, Check, MapPin } from 'lucide-react'
import { CAMPOS_CONTATO, triagemDoCargo, validarRespostas } from '../lib/triagemVaga'

const lerLS = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null') } catch { return null } }
const gravarLS = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)) } catch { /* modo privado */ } }

function mascaraTelefone(s) {
  const d = String(s || '').replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}
const mascaraDinheiro = (s) => {
  const n = Number(String(s || '').replace(/\D/g, '').slice(0, 7))
  return n ? n.toLocaleString('pt-BR') : ''
}

const inputCls = (erro) => `w-full rounded-lg border bg-white px-3 text-base sm:text-sm text-[#0B0B14] placeholder:text-[#9AA0B2] outline-none transition focus:border-[#2A25F0] focus:ring-2 focus:ring-[#2A25F0]/20 ${erro ? 'border-[#E2564B]' : 'border-[#E4E7F0]'}`

function Opcoes({ p, valor, onChange, erro }) {
  const multi = p.tipo === 'multi'
  const marcado = (v) => (multi ? (valor || []).includes(v) : valor === v)
  const alternar = (v) => {
    if (!multi) return onChange(v)
    const atual = valor || []
    onChange(atual.includes(v) ? atual.filter((x) => x !== v) : [...atual, v])
  }
  return (
    <div role={multi ? 'group' : 'radiogroup'} className="grid gap-2 sm:grid-cols-2">
      {p.opcoes.map((o) => {
        const on = marcado(o.v)
        return (
          <button key={o.v} type="button" role={multi ? 'checkbox' : 'radio'} aria-checked={on} onClick={() => alternar(o.v)}
            className={`text-left rounded-lg border transition flex items-center gap-2.5 px-3.5 min-h-10 py-2 ${on ? 'border-[#2A25F0] bg-[#2A25F0]/[0.06] ring-1 ring-[#2A25F0]' : `${erro ? 'border-[#E2564B]/60' : 'border-[#E4E7F0]'} bg-white hover:border-[#B9BCF7]`}`}>
            <span className={`shrink-0 w-4 h-4 inline-flex items-center justify-center border ${multi ? 'rounded' : 'rounded-full'} ${on ? 'bg-[#2A25F0] border-[#2A25F0] text-white' : 'border-[#C9CDDA] bg-white'}`}>
              {on && (multi ? <Check className="w-3 h-3" strokeWidth={3} /> : <span className="w-1.5 h-1.5 rounded-full bg-white" />)}
            </span>
            <span className="text-sm text-[#0B0B14]">{o.r}</span>
          </button>
        )
      })}
    </div>
  )
}

function Campo({ id, rotulo, ajuda, obrigatorio, erro, children }) {
  return (
    <div id={`campo-${id}`} className="space-y-2 scroll-mt-6">
      <label htmlFor={id} className="block text-sm font-semibold text-[#0B0B14]">
        {rotulo}{obrigatorio && <span className="text-[#E2564B]"> *</span>}
      </label>
      {ajuda && <p className="text-xs text-[#767C8E] -mt-1">{ajuda}</p>}
      {children}
      {erro && <p className="text-xs text-[#E2564B] flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> {erro}</p>}
    </div>
  )
}

export default function VagaPublica() {
  const { cargo } = useParams()
  const [params] = useSearchParams()
  const ref = params.get('ref') || ''
  const triagem = triagemDoCargo(cargo)
  const chave = `vaga.rascunho.${cargo}`
  const [info, setInfo] = useState(null)
  const [r, setR] = useState(() => lerLS(chave) || {})
  const [erros, setErros] = useState({})
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erroGeral, setErroGeral] = useState('')
  const [site, setSite] = useState('')

  useEffect(() => {
    document.title = triagem ? `${triagem.titulo} · Verta` : 'Vaga · Verta'
    if (!triagem) return
    fetch(`/api/vaga-publica?cargo=${encodeURIComponent(cargo)}${ref ? `&ref=${encodeURIComponent(ref)}` : ''}`)
      .then((x) => x.json())
      .then((d) => {
        setInfo(d)
        if (d?.nome) setR((atual) => (atual.nome ? atual : { ...atual, nome: d.nome }))
      })
      .catch(() => setInfo({}))
  }, [cargo, ref, triagem])

  useEffect(() => { if (!enviado) gravarLS(chave, r) }, [r, chave, enviado])

  const set = (k, v) => {
    setR((x) => ({ ...x, [k]: v }))
    if (erros[k]) setErros((e) => { const n = { ...e }; delete n[k]; return n })
  }

  const respondidas = useMemo(() => {
    if (!triagem) return [0, 0]
    const todos = [...CAMPOS_CONTATO.filter((c) => c.obrigatorio), ...triagem.perguntas.filter((p) => p.obrigatorio)]
    const ok = todos.filter((c) => { const v = r[c.k]; return v != null && v !== '' && !(Array.isArray(v) && !v.length) }).length
    return [ok, todos.length]
  }, [r, triagem])

  async function enviar(e) {
    e.preventDefault()
    setErroGeral('')
    const respostas = { ...r, pretensao: r.pretensao ? String(r.pretensao).replace(/\D/g, '') : '' }
    const errs = validarRespostas(triagem, { ...respostas, email: (respostas.email || '').trim().toLowerCase() })
    if (Object.keys(errs).length) {
      setErros(errs)
      document.getElementById(`campo-${Object.keys(errs)[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    setEnviando(true)
    try {
      const res = await fetch('/api/vaga-publica', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cargo, ref: ref || undefined, respostas, site }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (d.erros) setErros(d.erros)
        setErroGeral(d.error || 'Não consegui enviar agora. Tente de novo.')
      } else {
        setEnviado(true)
        gravarLS(chave, null)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    } catch {
      setErroGeral('Sem conexão. Confira a internet e tente de novo.')
    }
    setEnviando(false)
  }

  const tituloFonte = { fontFamily: "'Sora', sans-serif" }

  return (
    <div className="min-h-screen bg-[#F8F9FC] text-[#0B0B14]" style={{ fontFamily: "'Manrope', system-ui, sans-serif", colorScheme: 'light' }}>
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">
        <header className="flex items-center gap-2.5 mb-6">
          <img src="/vertatask-simbolo.png" alt="" className="w-7 h-7" />
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2A25F0]">Processo seletivo Verta</p>
          {triagem && !enviado && <p className="ml-auto text-xs font-semibold text-[#767C8E] tabular-nums">{respondidas[0]} de {respondidas[1]}</p>}
        </header>

        {!triagem ? (
          <div className="bg-white border border-[#E4E7F0] rounded-2xl p-8 text-center"><AlertCircle className="w-9 h-9 mx-auto text-[#E2564B] mb-2" /><p className="text-sm">Esta vaga não existe ou já foi encerrada.</p></div>
        ) : enviado ? (
          <div className="bg-white border border-[#E4E7F0] rounded-2xl p-8 text-center shadow-sm">
            <CheckCircle2 className="w-11 h-11 mx-auto text-[#1F8A5B] mb-3" />
            <h1 className="text-xl font-bold" style={tituloFonte}>Respostas enviadas</h1>
            <p className="mt-2 text-sm text-[#5A6072] max-w-md mx-auto">
              Obrigado{r.nome ? `, ${r.nome.trim().split(/\s+/)[0]}` : ''}. Agora é só avisar no WhatsApp que você respondeu. Se o seu perfil seguir para a próxima etapa, a gente marca uma conversa.
            </p>
          </div>
        ) : !info ? (
          <div className="py-24 flex justify-center text-[#767C8E]"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          <form onSubmit={enviar} noValidate className="space-y-5">
            <section className="bg-white border border-[#E4E7F0] rounded-2xl p-5 sm:p-7 shadow-sm">
              <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight leading-tight" style={tituloFonte}>{triagem.titulo}</h1>
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#2A25F0]"><MapPin className="w-4 h-4" /> {triagem.local}</p>
              <p className="mt-3 text-sm text-[#5A6072] leading-relaxed">{triagem.intro}</p>
              {info.respondido && <p className="mt-3 text-xs rounded-lg bg-[#FFF6E5] border border-[#F2D49B] text-[#7A5410] px-3 py-2">Você já respondeu este formulário. Se enviar de novo, ficam valendo as respostas novas.</p>}
            </section>

            <section className="bg-white border border-[#E4E7F0] rounded-2xl p-5 sm:p-7 shadow-sm space-y-5">
              <h2 className="text-base font-bold" style={tituloFonte}>Seus dados</h2>
              {CAMPOS_CONTATO.map((c) => (
                <Campo key={c.k} id={c.k} rotulo={c.rotulo} ajuda={c.ajuda} obrigatorio={c.obrigatorio} erro={erros[c.k]}>
                  <input id={c.k} className={`${inputCls(erros[c.k])} h-11`}
                    type={c.tipo === 'email' ? 'email' : c.tipo === 'telefone' ? 'tel' : 'text'}
                    inputMode={c.tipo === 'telefone' ? 'tel' : c.tipo === 'email' ? 'email' : undefined}
                    autoComplete={{ nome: 'name', email: 'email', telefone: 'tel', cidade: 'address-level2' }[c.k] || 'off'}
                    placeholder={c.tipo === 'telefone' ? '(62) 99999-8888' : ''}
                    value={r[c.k] || ''}
                    onChange={(e) => set(c.k, c.tipo === 'telefone' ? mascaraTelefone(e.target.value) : e.target.value)} />
                </Campo>
              ))}
            </section>

            <section className="bg-white border border-[#E4E7F0] rounded-2xl p-5 sm:p-7 shadow-sm space-y-6">
              <h2 className="text-base font-bold" style={tituloFonte}>Sua experiência</h2>
              {triagem.perguntas.map((p) => (
                <Campo key={p.k} id={p.k} rotulo={p.rotulo} ajuda={p.ajuda || (p.tipo === 'multi' ? 'Pode marcar mais de uma.' : null)} obrigatorio={p.obrigatorio} erro={erros[p.k]}>
                  {p.tipo === 'opcao' || p.tipo === 'multi' ? (
                    <Opcoes p={p} valor={r[p.k]} erro={erros[p.k]} onChange={(v) => set(p.k, v)} />
                  ) : p.tipo === 'textarea' ? (
                    <>
                      <textarea id={p.k} className={`${inputCls(erros[p.k])} py-2.5 min-h-[120px]`} maxLength={p.max} value={r[p.k] || ''} onChange={(e) => set(p.k, e.target.value)} />
                      <p className="text-[11px] text-[#9AA0B2] text-right tabular-nums">{(r[p.k] || '').length} / {p.max}</p>
                    </>
                  ) : p.tipo === 'dinheiro' ? (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#767C8E]">R$</span>
                      <input id={p.k} inputMode="numeric" className={`${inputCls(erros[p.k])} h-11 pl-9`} placeholder="3.000"
                        value={mascaraDinheiro(r[p.k])} onChange={(e) => set(p.k, e.target.value.replace(/\D/g, ''))} />
                    </div>
                  ) : (
                    <input id={p.k} className={`${inputCls(erros[p.k])} h-11`} value={r[p.k] || ''} onChange={(e) => set(p.k, e.target.value)} />
                  )}
                </Campo>
              ))}
              {/* Campo escondido contra robô: gente não vê, não preenche. */}
              <input type="text" name="site" tabIndex={-1} autoComplete="off" aria-hidden="true" value={site} onChange={(e) => setSite(e.target.value)}
                className="absolute -left-[9999px] w-px h-px opacity-0" />
            </section>

            {erroGeral && <p className="text-sm text-[#E2564B] flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> {erroGeral}</p>}
            <button type="submit" disabled={enviando}
              className="w-full h-12 rounded-xl bg-[#2A25F0] text-white text-sm font-bold inline-flex items-center justify-center gap-2 hover:bg-[#1F1BC4] disabled:opacity-60 transition">
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar respostas
            </button>
            <p className="text-[11px] text-center text-[#9AA0B2]">Seus dados são usados só neste processo seletivo da Verta.</p>
          </form>
        )}
      </div>
    </div>
  )
}
