// Seções do painel lateral que se repetem nos três lugares (tarefa, construtor de
// template e prévia de aplicação), para que Subtarefas e Relações tenham a mesma cara:
// `Secao` (título + extra), `ListaSubtarefas` (uma linha por subtarefa, abre ao clicar,
// "Adicionar subtarefa") e `ListaRelacoes` (rótulo + tarefa, remover no hover,
// "Adicionar relação" com tipo e busca). Só apresentação: os dados vêm de quem usa.
import { useEffect, useState } from 'react'
import { CornerDownRight, Link2, Search, X } from 'lucide-react'
import { AdicionarInline, FOCO } from './Campos'

export function Secao({ titulo, extra, children }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-1.5">
        <p className="ln-label !mb-0">{titulo}</p>
        {extra}
      </div>
      {children}
    </section>
  )
}

/** itens: [{ id, titulo, concluida }]; inicio/fim(item) = o que vai antes/depois do título. */
export function ListaSubtarefas({ itens, onAbrir, onAdicionar, inicio, fim }) {
  return (
    <div className="flex flex-col">
      {itens.map((s) => (
        <div key={s.id} role="button" tabIndex={0} onClick={() => onAbrir(s.id)} onKeyDown={(e) => { if (e.key === 'Enter') onAbrir(s.id) }} className={`ln-row-hover flex items-center gap-2 h-8 -mx-2 px-2 cursor-pointer ${FOCO}`}>
          <CornerDownRight className="w-3 h-3 text-ln-t4 shrink-0" />
          {inicio?.(s)}
          <span className={`text-[13px] flex-1 min-w-0 truncate ${s.concluida ? 'line-through text-ln-t4' : 'text-ln-t2'}`}>{s.titulo || 'Sem título'}</span>
          {fim && <span className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>{fim(s)}</span>}
        </div>
      ))}
      {!itens.length && !onAdicionar && <p className="text-xs text-ln-t4">Nenhuma subtarefa.</p>}
      {onAdicionar && <div className="-mx-2"><AdicionarInline placeholder="Adicionar subtarefa" onCriar={onAdicionar} /></div>}
    </div>
  )
}

/**
 * linhas: [{ key, rotulo, titulo, concluida, onAbrir?, onRemover? }].
 * Para adicionar: tipos [{ value, label }], buscar(q) → Promise<[{ id, titulo, status_tipo? }]>
 * (minBusca caracteres antes de buscar; 0 = mostra tudo ao abrir) e onAdicionar(tipo, alvo).
 */
// Ícones de bloqueio iguais aos do ClickUp: disco vermelho com traço ("Bloqueia") e triângulo
// amarelo com "!" ("Bloqueada por"). Os outros tipos ficam sem ícone.
function IconeRelacao({ rotulo }) {
  if (rotulo === 'Bloqueia') return (
    <svg viewBox="0 0 14 14" className="w-3.5 h-3.5 shrink-0 text-ln-red" aria-hidden="true">
      <circle cx="7" cy="7" r="7" fill="currentColor" />
      <rect x="3.5" y="6.1" width="7" height="1.8" rx="0.9" fill="#fff" />
    </svg>
  )
  if (rotulo === 'Bloqueada por') return (
    <svg viewBox="0 0 14 14" className="w-3.5 h-3.5 shrink-0 text-ln-yellow" aria-hidden="true">
      <path d="M6.13 1.5a1 1 0 0 1 1.74 0l5.6 9.75A1 1 0 0 1 12.6 12.75H1.4a1 1 0 0 1-.87-1.5Z" fill="currentColor" />
      <rect x="6.25" y="4.6" width="1.5" height="4.2" rx="0.75" fill="#1f1f1f" />
      <circle cx="7" cy="10.4" r="0.85" fill="#1f1f1f" />
    </svg>
  )
  return null
}

export function ListaRelacoes({ linhas, tipos, buscar, minBusca = 2, onAdicionar, placeholder = 'Buscar tarefa pelo título' }) {
  const [adicionando, setAdicionando] = useState(false)
  const [tipo, setTipo] = useState(tipos?.[0]?.value)
  const [q, setQ] = useState('')
  const [achados, setAchados] = useState([])

  useEffect(() => {
    if (!adicionando || q.trim().length < minBusca) { setAchados([]); return undefined }
    let vivo = true
    const h = setTimeout(async () => { const r = await buscar(q.trim()); if (vivo) setAchados(r || []) }, minBusca ? 250 : 0)
    return () => { vivo = false; clearTimeout(h) }
  }, [q, adicionando, minBusca]) // eslint-disable-line react-hooks/exhaustive-deps

  const fechar = () => { setAdicionando(false); setQ(''); setAchados([]) }
  async function escolher(alvo) {
    const ok = await onAdicionar(tipo, alvo)
    if (ok !== false) fechar()
  }

  return (
    <div className="flex flex-col">
      {linhas.map((r) => (
        <div key={r.key} className="group/rel flex items-center gap-2 h-8 -mx-2 px-2 rounded-lg hover:bg-ln-ink/[0.03]">
          <span className="text-[11px] text-ln-t4 w-[110px] shrink-0 inline-flex items-center gap-1.5"><IconeRelacao rotulo={r.rotulo} />{r.rotulo}</span>
          <button type="button" onClick={r.onAbrir} disabled={!r.onAbrir} className={`flex-1 min-w-0 truncate text-left text-[13px] hover:text-ln-accent disabled:hover:text-inherit ${r.concluida ? 'line-through text-ln-t4' : 'text-ln-t2'} ${FOCO}`}>{r.titulo || 'Tarefa removida'}</button>
          {r.onRemover && <button type="button" onClick={r.onRemover} className="ln-iconbtn !w-5 !h-5 opacity-0 group-hover/rel:opacity-100 focus-visible:opacity-100" aria-label="Remover relação"><X className="w-3 h-3" /></button>}
        </div>
      ))}
      {!onAdicionar ? null : adicionando ? (
        <div className="mt-1 flex flex-col gap-1.5">
          <div className="flex gap-1.5">
            <select className="ln-input !h-8 !w-[150px]" value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo de relação">
              {tipos.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <div className="ln-input !h-8 flex items-center gap-1.5 flex-1">
              <Search className="w-3.5 h-3.5 text-ln-t4" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="flex-1 min-w-0 bg-transparent outline-none text-xs" />
            </div>
            <button type="button" onClick={fechar} className="ln-iconbtn" aria-label="Cancelar"><X className="w-3.5 h-3.5" /></button>
          </div>
          {achados.map((a) => (
            <button key={a.id} type="button" onClick={() => escolher(a)} className="text-left text-[13px] px-2 h-8 rounded-md hover:bg-ln-ink/5 text-ln-t2 truncate">{a.titulo || 'Sem título'}</button>
          ))}
          {q.trim().length >= minBusca && !achados.length && <p className="px-2 text-xs text-ln-t4">Nada encontrado.</p>}
        </div>
      ) : (
        <button type="button" onClick={() => setAdicionando(true)} className={`self-start inline-flex items-center gap-1.5 h-7 px-2 -mx-2 rounded-md text-xs text-ln-t4 hover:text-ln-t2 hover:bg-ln-ink/[0.03] ${FOCO}`}><Link2 className="w-3.5 h-3.5" /> Adicionar relação</button>
      )}
      {!onAdicionar && !linhas.length && <p className="text-xs text-ln-t4">Nenhuma relação.</p>}
    </div>
  )
}
