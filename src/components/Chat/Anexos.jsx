// Anexos de uma mensagem do chat: imagens em miniatura (clique amplia), os
// demais como cartão com nome e tamanho. Abre o AnexoPreview.
import { useEffect, useState } from 'react'
import { FileText, Film, Music, FileSpreadsheet } from 'lucide-react'
import AnexoPreview from '../UI/AnexoPreview'
import { tipoDoAnexo, urlDoAnexo, nomeDoAnexo, fmtBytes } from '../../lib/anexos'

export const BUCKET_CHAT = 'chat-attachments'

function Miniatura({ a, onClick }) {
  const [url, setUrl] = useState(a.url || null)
  useEffect(() => { let vivo = true; if (!url) urlDoAnexo(a, BUCKET_CHAT).then((u) => { if (vivo) setUrl(u) }); return () => { vivo = false } }, [a, url])
  return (
    <button type="button" onClick={onClick} className="block rounded-lg overflow-hidden border border-ln-ink/[0.08] bg-ln-ink/[0.03] hover:opacity-90 max-w-[320px] max-h-[240px]" title={nomeDoAnexo(a)}>
      {url ? <img src={url} alt={nomeDoAnexo(a)} className="block max-w-[320px] max-h-[240px] object-cover" loading="lazy" /> : <div className="w-40 h-28" />}
    </button>
  )
}

const ICONE = { video: Film, audio: Music, planilha: FileSpreadsheet }
export default function Anexos({ anexos }) {
  const [aberto, setAberto] = useState(null)
  if (!Array.isArray(anexos) || !anexos.length) return null
  const imagens = anexos.map((a, i) => ({ a, i })).filter(({ a }) => tipoDoAnexo(a) === 'imagem')
  const outros = anexos.map((a, i) => ({ a, i })).filter(({ a }) => tipoDoAnexo(a) !== 'imagem')
  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      {imagens.length > 0 && <div className="flex flex-wrap gap-1.5">{imagens.map(({ a, i }) => <Miniatura key={a.path || a.url || i} a={a} onClick={() => setAberto(i)} />)}</div>}
      {outros.map(({ a, i }) => {
        const Icone = ICONE[tipoDoAnexo(a)] || FileText
        return (
          <button key={a.path || a.url || i} type="button" onClick={() => setAberto(i)} className="inline-flex items-center gap-2.5 h-11 px-3 rounded-lg border border-ln-ink/[0.08] bg-ln-card hover:bg-ln-ink/[0.03] max-w-[360px] text-left">
            <span className="w-8 h-8 rounded-md bg-ln-ink/[0.05] inline-flex items-center justify-center text-ln-t3 shrink-0"><Icone className="w-4 h-4" /></span>
            <span className="min-w-0"><span className="block text-[13px] text-ln-t1 truncate">{nomeDoAnexo(a)}</span><span className="block text-[11px] text-ln-t4">{fmtBytes(a.size)}{a.source === 'clickup' ? ' · ClickUp' : ''}</span></span>
          </button>
        )
      })}
      {aberto != null && <AnexoPreview anexos={anexos} indice={aberto} bucket={BUCKET_CHAT} onFechar={() => setAberto(null)} />}
    </div>
  )
}
