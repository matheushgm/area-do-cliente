// Upload de arquivos do pedido (portal do cliente). Cada arquivo pede ao servidor uma URL
// assinada (api/intake-publico.js, acao 'upload') e sobe direto para o Storage, com
// progresso. O valor do campo é a lista { path, name, size, mime }; enquanto sobe, a entrada
// tem `subindo: true` e o formulário não deixa revisar.
import { useRef, useState } from 'react'
import { UploadCloud, FileText, Image as ImageIcon, Film, X, Loader2, AlertCircle } from 'lucide-react'

const LIMITE = 50 * 1024 * 1024
const MAX = 20

function tamanho(n) {
  if (!n && n !== 0) return ''
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`
  return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0).replace('.', ',')} MB`
}

function Icone({ mime }) {
  if (/^image\//.test(mime || '')) return <ImageIcon className="w-4 h-4" />
  if (/^video\//.test(mime || '')) return <Film className="w-4 h-4" />
  return <FileText className="w-4 h-4" />
}

function subir(url, file, onProgresso) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('content-type', file.type || 'application/octet-stream')
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgresso(e.loaded / e.total) }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Falhou (${xhr.status})`)))
    xhr.onerror = () => reject(new Error('Sem conexão'))
    xhr.send(file)
  })
}

export default function CampoArquivos({ valor = [], onChange, enviarArquivo }) {
  const input = useRef(null)
  const [arrastando, setArrastando] = useState(false)
  const [progresso, setProgresso] = useState({}) // uid → 0..1
  const [erros, setErros] = useState([]) // [{ name, msg }]
  // a lista muda enquanto vários arquivos sobem: sempre a partir da versão mais nova
  const atual = useRef(valor)
  atual.current = valor
  const mudar = (fn) => { const prox = fn(atual.current); atual.current = prox; onChange(prox) }

  async function adicionar(files) {
    const lista = [...files]
    const novosErros = []
    const espaco = MAX - atual.current.length
    if (lista.length > espaco) novosErros.push({ name: `${lista.length - espaco} arquivo(s)`, msg: `Até ${MAX} arquivos por pedido.` })
    const aceitos = lista.slice(0, Math.max(0, espaco)).filter((f) => {
      if (f.size > LIMITE) { novosErros.push({ name: f.name, msg: 'Passa de 50 MB. Mande pelo link do Drive.' }); return false }
      return true
    })
    setErros(novosErros)
    const entradas = aceitos.map((f) => ({ uid: crypto.randomUUID(), name: f.name, size: f.size, mime: f.type || null, subindo: true, file: f }))
    if (!entradas.length) return
    mudar((v) => [...v, ...entradas.map(({ file, ...e }) => e)]) // eslint-disable-line no-unused-vars
    await Promise.all(entradas.map(async (e) => {
      try {
        const { path, url } = await enviarArquivo(e.file)
        await subir(url, e.file, (p) => setProgresso((x) => ({ ...x, [e.uid]: p })))
        mudar((v) => v.map((a) => (a.uid === e.uid ? { path, name: e.name, size: e.size, mime: e.mime, uid: e.uid } : a)))
      } catch (err) {
        mudar((v) => v.filter((a) => a.uid !== e.uid))
        setErros((x) => [...x, { name: e.name, msg: err?.message || 'Não subiu.' }])
      }
    }))
  }

  function tirar(uid) { mudar((v) => v.filter((a) => (a.uid || a.path) !== uid)) }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setArrastando(true) }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastando(false); if (e.dataTransfer.files?.length) adicionar(e.dataTransfer.files) }}
        className={`w-full rounded-xl border-2 border-dashed px-4 py-6 flex flex-col items-center gap-1.5 text-center transition ${arrastando ? 'border-[#2A25F0] bg-[#2A25F0]/[0.06]' : 'border-[#D7DAE5] bg-white hover:border-[#B9BCF7]'}`}
      >
        <UploadCloud className="w-7 h-7 text-[#2A25F0]" />
        <span className="text-sm font-semibold text-[#0B0B14]">Arraste os arquivos aqui ou clique para escolher</span>
        <span className="text-xs text-[#767C8E]">Imagens, vídeos ou PDF, até 50 MB cada</span>
      </button>
      <input ref={input} type="file" multiple className="hidden" accept="image/*,video/*,application/pdf,.zip,.psd,.ai,.svg" onChange={(e) => { if (e.target.files?.length) adicionar(e.target.files); e.target.value = '' }} />

      {valor.length > 0 && (
        <ul className="rounded-xl border border-[#E4E7F0] bg-white divide-y divide-[#EEF0F5]">
          {valor.map((a) => {
            const id = a.uid || a.path
            const p = progresso[a.uid]
            return (
              <li key={id} className="px-3 py-2.5 flex items-center gap-3">
                <span className="w-8 h-8 shrink-0 rounded-lg bg-[#2A25F0]/[0.08] text-[#2A25F0] inline-flex items-center justify-center"><Icone mime={a.mime} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-[#0B0B14] truncate">{a.name}</span>
                  {a.subindo ? (
                    <span className="mt-1 block h-1.5 rounded-full bg-[#EEF0F5] overflow-hidden"><span className="block h-full bg-[#2A25F0] transition-[width]" style={{ width: `${Math.round((p || 0.03) * 100)}%` }} /></span>
                  ) : (
                    <span className="block text-xs text-[#767C8E]">{tamanho(a.size)} · enviado</span>
                  )}
                </span>
                {a.subindo
                  ? <Loader2 className="w-4 h-4 animate-spin text-[#767C8E] shrink-0" />
                  : <button type="button" onClick={() => tirar(id)} className="p-1.5 rounded-lg text-[#767C8E] hover:text-[#E2564B] hover:bg-[#E2564B]/10 shrink-0" aria-label={`Tirar ${a.name}`}><X className="w-4 h-4" /></button>}
              </li>
            )
          })}
        </ul>
      )}
      {erros.map((e, i) => (
        <p key={i} className="text-xs text-[#C2392F] inline-flex items-start gap-1.5"><AlertCircle className="w-3.5 h-3.5 mt-px shrink-0" /><span><b>{e.name}</b>: {e.msg}</span></p>
      ))}
    </div>
  )
}
