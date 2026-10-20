// Pré-visualização de anexo em tela cheia (chat e tarefas): imagem, vídeo,
// áudio, PDF e texto abrem dentro da Área; o resto mostra um cartão com o
// botão de baixar. Setas/← → trocam de anexo, Esc fecha.
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Download, ChevronLeft, ChevronRight, ExternalLink, FileText, Loader2 } from 'lucide-react'
import { tipoDoAnexo, urlDoAnexo, nomeDoAnexo, fmtBytes } from '../../lib/anexos'

export default function AnexoPreview({ anexos = [], indice = 0, bucket, onFechar }) {
  const [i, setI] = useState(indice)
  const [url, setUrl] = useState(null)
  const [texto, setTexto] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const a = anexos[i]
  const tipo = tipoDoAnexo(a)

  useEffect(() => { setI(indice) }, [indice])
  useEffect(() => {
    let vivo = true
    setCarregando(true); setUrl(null); setTexto(null)
    ;(async () => {
      const u = await urlDoAnexo(a, bucket)
      if (!vivo) return
      setUrl(u)
      if (tipo === 'texto' && u) { try { const t = await (await fetch(u)).text(); if (vivo) setTexto(t.slice(0, 200000)) } catch { /* mostra o cartão */ } }
      setCarregando(false)
    })()
    return () => { vivo = false }
  }, [a, bucket, tipo])

  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onFechar() }
      if (e.key === 'ArrowRight' && i < anexos.length - 1) setI(i + 1)
      if (e.key === 'ArrowLeft' && i > 0) setI(i - 1)
    }
    document.addEventListener('keydown', h, true)
    return () => document.removeEventListener('keydown', h, true)
  }, [i, anexos.length, onFechar])

  if (!a) return null
  const nome = nomeDoAnexo(a)
  const corpo = carregando ? (
    <div className="flex items-center justify-center h-full text-white/70"><Loader2 className="w-6 h-6 animate-spin" /></div>
  ) : !url ? (
    <Cartao nome={nome} a={a} aviso="Não consegui gerar o link deste arquivo." />
  ) : tipo === 'imagem' ? (
    <img src={url} alt={nome} className="max-w-full max-h-full object-contain rounded-md shadow-2xl" />
  ) : tipo === 'video' ? (
    <video src={url} controls autoPlay className="max-w-full max-h-full rounded-md shadow-2xl" />
  ) : tipo === 'audio' ? (
    <div className="bg-white rounded-xl p-6 w-[min(520px,90vw)] shadow-2xl"><p className="text-sm font-medium mb-3 truncate">{nome}</p><audio src={url} controls autoPlay className="w-full" /></div>
  ) : tipo === 'pdf' ? (
    <iframe src={`${url}#toolbar=1`} title={nome} className="w-[min(1000px,94vw)] h-full bg-white rounded-md shadow-2xl" />
  ) : tipo === 'texto' && texto != null ? (
    <pre className="w-[min(900px,94vw)] h-full overflow-auto bg-white text-[12.5px] leading-5 text-gray-800 rounded-md p-4 shadow-2xl whitespace-pre-wrap">{texto}</pre>
  ) : (
    <Cartao nome={nome} a={a} url={url} />
  )

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/85 flex flex-col" onClick={onFechar} role="dialog" aria-modal="true" aria-label={`Pré-visualização de ${nome}`}>
      <div className="flex items-center gap-3 h-12 px-4 text-white shrink-0" onClick={(e) => e.stopPropagation()}>
        <FileText className="w-4 h-4 opacity-70 shrink-0" />
        <span className="text-sm font-medium truncate">{nome}</span>
        <span className="text-xs text-white/60 tabular">{fmtBytes(a.size)}</span>
        {anexos.length > 1 && <span className="text-xs text-white/60 tabular">{i + 1} / {anexos.length}</span>}
        <div className="flex-1" />
        {url && <a href={url} download={nome} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-white/10 hover:bg-white/20 text-xs"><Download className="w-3.5 h-3.5" /> Baixar</a>}
        {url && <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-white/10 hover:bg-white/20" title="Abrir em nova aba"><ExternalLink className="w-3.5 h-3.5" /></a>}
        <button type="button" onClick={onFechar} className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-white/10 hover:bg-white/20" aria-label="Fechar"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center px-14 pb-6" onClick={(e) => e.stopPropagation()}>
        {corpo}
      </div>
      {anexos.length > 1 && (
        <>
          <button type="button" disabled={i === 0} onClick={(e) => { e.stopPropagation(); setI(i - 1) }} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white inline-flex items-center justify-center" aria-label="Anterior"><ChevronLeft className="w-5 h-5" /></button>
          <button type="button" disabled={i === anexos.length - 1} onClick={(e) => { e.stopPropagation(); setI(i + 1) }} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white inline-flex items-center justify-center" aria-label="Próximo"><ChevronRight className="w-5 h-5" /></button>
        </>
      )}
    </div>,
    document.body,
  )
}

function Cartao({ nome, a, url, aviso }) {
  return (
    <div className="bg-white rounded-xl p-6 w-[min(460px,90vw)] text-center shadow-2xl">
      <FileText className="w-10 h-10 mx-auto text-gray-400" />
      <p className="mt-3 text-sm font-medium text-gray-900 truncate">{nome}</p>
      <p className="text-xs text-gray-500 mt-0.5">{fmtBytes(a.size)}{a.type ? ` · ${a.type}` : ''}</p>
      {aviso ? <p className="text-xs text-red-500 mt-3">{aviso}</p> : <p className="text-xs text-gray-500 mt-3">Este tipo de arquivo não tem pré-visualização.</p>}
      {url && <a href={url} download={nome} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-gray-900 text-white text-sm"><Download className="w-4 h-4" /> Baixar</a>}
    </div>
  )
}
