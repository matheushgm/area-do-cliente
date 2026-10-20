// Página pública (sem login) onde o cliente manda um pedido para o time: /pedido/:token.
// Cai na fila de Intake do VertaTask. Usa o client_share_token do projeto.
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, CheckCircle2, AlertCircle, Send } from 'lucide-react'

export default function PedidoPublico() {
  const { token } = useParams()
  const [empresa, setEmpresa] = useState(null)
  const [erro, setErro] = useState(null)
  const [f, setF] = useState({ titulo: '', descricao: '', contato: '' })
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  useEffect(() => {
    let vivo = true
    fetch(`/api/intake-publico?token=${encodeURIComponent(token)}`)
      .then(async (r) => { const j = await r.json().catch(() => ({})); if (!vivo) return; if (!r.ok) setErro(j.error || 'Link inválido.'); else setEmpresa(j.empresa || '') })
      .catch(() => vivo && setErro('Não consegui abrir esta página.'))
    return () => { vivo = false }
  }, [token])

  async function enviar(e) {
    e.preventDefault()
    setEnviando(true); setErro(null)
    try {
      const r = await fetch('/api/intake-publico', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, ...f }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) setErro(j.error || 'Não consegui enviar.'); else setEnviado(true)
    } catch { setErro('Sem conexão. Tente de novo.') }
    setEnviando(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-[#F8F9FC] text-[#0B0B14]" style={{ fontFamily: "'Manrope', system-ui, sans-serif" }}>
      <div className="w-full max-w-lg bg-white border border-[#E4E7F0] rounded-2xl p-7 shadow-sm">
        <img src="/vertatask-simbolo.png" alt="" className="w-8 h-8 mb-4" />
        {empresa === null && !erro ? <div className="py-10 flex justify-center text-[#767C8E]"><Loader2 className="w-5 h-5 animate-spin" /></div>
        : enviado ? (
          <div className="text-center py-6">
            <CheckCircle2 className="w-10 h-10 mx-auto text-[#1F8A5B] mb-3" />
            <h1 className="text-xl font-bold mb-1">Pedido enviado</h1>
            <p className="text-sm text-[#5A6072]">O time da Verta recebeu e vai responder por aqui ou pelo seu contato.</p>
            <button type="button" onClick={() => { setEnviado(false); setF({ titulo: '', descricao: '', contato: f.contato }) }} className="mt-5 text-sm font-semibold text-[#2A25F0]">Enviar outro pedido</button>
          </div>
        ) : empresa === null ? (
          <div className="text-center py-6"><AlertCircle className="w-9 h-9 mx-auto text-[#E2564B] mb-2" /><p className="text-sm">{erro}</p></div>
        ) : (
          <form onSubmit={enviar} className="flex flex-col gap-4">
            <div>
              <h1 className="text-xl font-bold" style={{ fontFamily: "'Sora', sans-serif" }}>O que você precisa{empresa ? `, ${empresa}` : ''}?</h1>
              <p className="text-sm text-[#5A6072] mt-1">Conte em poucas linhas. O pedido chega direto para o time que cuida da sua conta.</p>
            </div>
            <label className="text-xs font-semibold text-[#3D4254] flex flex-col gap-1">Resumo do pedido
              <input required minLength={4} maxLength={200} value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="Ex.: trocar o preço da promoção nos anúncios" className="h-10 px-3 rounded-lg border border-[#E4E7F0] text-sm font-normal outline-none focus:border-[#2A25F0] focus:ring-2 focus:ring-[#2A25F0]/25" />
            </label>
            <label className="text-xs font-semibold text-[#3D4254] flex flex-col gap-1">Detalhes (opcional)
              <textarea rows={5} maxLength={3000} value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} placeholder="Links, prazos, o que seria o pronto" className="px-3 py-2 rounded-lg border border-[#E4E7F0] text-sm font-normal outline-none focus:border-[#2A25F0] focus:ring-2 focus:ring-[#2A25F0]/25 resize-y" />
            </label>
            <label className="text-xs font-semibold text-[#3D4254] flex flex-col gap-1">Seu nome e WhatsApp ou e-mail
              <input maxLength={160} value={f.contato} onChange={(e) => setF({ ...f, contato: e.target.value })} placeholder="Para o time falar com você" className="h-10 px-3 rounded-lg border border-[#E4E7F0] text-sm font-normal outline-none focus:border-[#2A25F0] focus:ring-2 focus:ring-[#2A25F0]/25" />
            </label>
            {erro && <p className="text-sm text-[#E2564B]">{erro}</p>}
            <button type="submit" disabled={enviando} className="h-11 rounded-lg bg-[#2A25F0] hover:bg-[#1800DB] text-white font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60">
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar pedido
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
