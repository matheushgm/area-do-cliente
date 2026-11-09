// Aba Pages: documentos em markdown (briefs, playbooks, processos) ligados a um
// cliente. Lista em árvore à esquerda, editor/leitor à direita, com salvamento
// automático, bloqueio, arquivo e histórico de versões.
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { Plus, Search, FileText, ChevronRight, Lock, Unlock, Archive, Trash2, History, Bold, Italic, Heading2, List, ListChecks, Link2, Eye, Pencil, Globe, EyeOff, CornerDownRight, ArchiveRestore } from 'lucide-react'
import { fmtDataHora } from '../../lib/tarefas'
import { FOCO } from './Campos'
import { useI18n, t as tr } from '../../i18n'

function nomeProjeto(p) { return p?.company_name || p?.companyName || tr('paginas.semNome') }

function Item({ pg, nivel, filhosDe, ativaId, onAbrir, busca }) {
  const { t } = useI18n()
  const [aberto, setAberto] = useState(true)
  const filhos = (filhosDe.get(pg.id) || []).filter((f) => !f.arquivada)
  return (
    <div>
      <div className={`flex items-center gap-1 h-8 rounded-lg pr-2 text-[13px] ${ativaId === pg.id ? 'bg-ln-accent/10 text-ln-accent font-semibold' : 'text-ln-t2 hover:bg-ln-ink/[0.04]'}`} style={{ paddingLeft: 6 + nivel * 14 }}>
        <button type="button" onClick={() => setAberto((v) => !v)} className={`w-4 h-4 inline-flex items-center justify-center ${filhos.length ? '' : 'opacity-0 pointer-events-none'}`} aria-label={t('paginas.expandirSubpaginas')}><ChevronRight className={`w-3 h-3 transition-transform ${aberto || busca ? 'rotate-90' : ''}`} /></button>
        <button type="button" onClick={() => onAbrir(pg.id)} className={`flex-1 min-w-0 flex items-center gap-1.5 text-left ${FOCO}`}>
          <FileText className="w-3.5 h-3.5 shrink-0 text-ln-t4" /><span className="truncate">{pg.titulo || t('paginas.semTitulo')}</span>
          {pg.acesso === 'privada' && <EyeOff className="w-3 h-3 text-ln-t4 shrink-0" />}
          {pg.bloqueada && <Lock className="w-3 h-3 text-ln-t4 shrink-0" />}
        </button>
      </div>
      {(aberto || busca) && filhos.map((f) => <Item key={f.id} pg={f} nivel={nivel + 1} filhosDe={filhosDe} ativaId={ativaId} onAbrir={onAbrir} busca={busca} />)}
    </div>
  )
}

function inserir(el, antes, depois = '', padrao = '') {
  const ini = el.selectionStart, fim = el.selectionEnd
  const sel = el.value.slice(ini, fim) || padrao
  const novo = el.value.slice(0, ini) + antes + sel + depois + el.value.slice(fim)
  return { novo, cursor: ini + antes.length + sel.length + depois.length }
}

export default function PaginasView({ pg: hook, projetos, user, paginaId, onSelecionar, onToast }) {
  const { t } = useI18n()
  const { paginas, loading, filhosDe } = hook
  const [busca, setBusca] = useState('')
  const [fCliente, setFCliente] = useState('')
  const [verArquivadas, setVerArquivadas] = useState(false)
  const [aberta, setAberta] = useState(null) // linha completa
  const [titulo, setTitulo] = useState('')
  const [texto, setTexto] = useState('')
  const [modo, setModo] = useState('editar')
  const [salvo, setSalvo] = useState(true)
  const [versoes, setVersoes] = useState(null)
  const taRef = useRef(null)
  const sujo = useRef(false)

  const meta = useMemo(() => paginas.find((p) => p.id === paginaId) || null, [paginas, paginaId])
  const souDono = meta?.dono_id === user?.id
  const travada = !!meta?.bloqueada && !souDono

  // abre a página escolhida
  useEffect(() => {
    let vivo = true
    setVersoes(null); sujo.current = false
    if (!paginaId) { setAberta(null); return undefined }
    hook.abrir(paginaId).then((r) => {
      if (!vivo || !r) return
      setAberta(r); setTitulo(r.titulo); setTexto(r.conteudo); setSalvo(true)
      setModo(r.conteudo ? 'ler' : 'editar')
    })
    return () => { vivo = false }
  }, [paginaId]) // eslint-disable-line react-hooks/exhaustive-deps

  // salvamento automático (1,2 s depois de parar de digitar)
  useEffect(() => {
    if (!aberta || !sujo.current || travada) return undefined
    setSalvo(false)
    const h = setTimeout(async () => {
      const r = await hook.salvar(aberta.id, { titulo: titulo.trim() || t('paginas.semTitulo'), conteudo: texto })
      if (r.error) onToast(r.error, 'error'); else { sujo.current = false; setSalvo(true) }
    }, 1200)
    return () => clearTimeout(h)
  }, [titulo, texto]) // eslint-disable-line react-hooks/exhaustive-deps

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return paginas.filter((p) => (verArquivadas ? p.arquivada : !p.arquivada)
      && (!fCliente || p.project_id === fCliente)
      && (!q || (p.titulo || '').toLowerCase().includes(q)))
  }, [paginas, busca, fCliente, verArquivadas])
  const filtrando = !!(busca.trim() || fCliente || verArquivadas)
  const raizes = filtrando ? visiveis : (filhosDe.get('raiz') || []).filter((p) => !p.arquivada)

  async function nova(paiId = null) {
    const r = await hook.criar({ titulo: t('paginas.semTitulo'), project_id: fCliente || meta?.project_id || null, pai_id: paiId })
    if (r.error) { onToast(r.error, 'error'); return }
    onSelecionar(r.data.id)
  }
  const patch = useCallback(async (p) => {
    const r = await hook.salvar(aberta.id, p)
    if (r.error) onToast(r.error, 'error')
  }, [hook, aberta, onToast])
  const md = (fn) => { const el = taRef.current; if (!el || travada) return; const { novo, cursor } = fn(el); sujo.current = true; setTexto(novo); requestAnimationFrame(() => { el.focus(); el.setSelectionRange(cursor, cursor) }) }

  return (
    <div className="flex h-full min-h-0">
      <aside className="w-[300px] shrink-0 border-r border-ln-ink/[0.08] flex flex-col min-h-0 bg-ln-panel">
        <div className="p-3 flex flex-col gap-2 border-b border-ln-ink/5">
          <button type="button" onClick={() => nova()} className="ln-primary !h-9 justify-center"><Plus className="w-3.5 h-3.5" /> {t('paginas.nova')}</button>
          <div className="ln-input !h-8 flex items-center gap-1.5"><Search className="w-3.5 h-3.5 text-ln-t4" /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t('paginas.buscar')} className="flex-1 min-w-0 bg-transparent outline-none text-xs" /></div>
          <select className="ln-input !h-8" value={fCliente} onChange={(e) => setFCliente(e.target.value)} aria-label={t('paginas.cliente')}><option value="">{t('paginas.todosClientes')}</option>{projetos.map((p) => <option key={p.id} value={p.id}>{nomeProjeto(p)}</option>)}</select>
          <button type="button" onClick={() => setVerArquivadas((v) => !v)} className={`ln-pill self-start ${verArquivadas ? '!text-ln-accent' : ''}`}><Archive className="w-3.5 h-3.5" /> {verArquivadas ? t('paginas.vendoArquivadas') : t('paginas.verArquivadas')}</button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-2">
          {loading ? <p className="p-3 text-xs text-ln-t4">{t('comum.carregando')}</p> : raizes.length === 0 ? <p className="p-3 text-xs text-ln-t4">{filtrando ? t('paginas.nenhumaComFiltro') : t('paginas.nenhumaAinda')}</p>
            : raizes.map((p) => <Item key={p.id} pg={p} nivel={0} filhosDe={filtrando ? new Map() : filhosDe} ativaId={paginaId} onAbrir={onSelecionar} busca={filtrando} />)}
        </div>
      </aside>

      <section className="flex-1 min-w-0 flex flex-col min-h-0 bg-ln-bg">
        {!meta || !aberta ? (
          <div className="flex-1 flex items-center justify-center text-ln-t4 text-[13px] text-center px-6">
            <div><FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />{t('paginas.escolha')}</div>
          </div>
        ) : (
          <>
            <div className="shrink-0 px-6 pt-4 pb-2 border-b border-ln-ink/[0.08] bg-ln-panel">
              <input value={titulo} disabled={travada} onChange={(e) => { sujo.current = true; setTitulo(e.target.value) }} placeholder={t('paginas.semTitulo')} aria-label={t('paginas.tituloPagina')} className="w-full bg-transparent outline-none text-2xl font-bold text-ln-t1 vt-display" />
              <div className="flex items-center gap-2 flex-wrap mt-2">
                <select disabled={travada} className="ln-input !h-7 !w-auto !text-xs" value={meta.project_id || ''} onChange={(e) => patch({ project_id: e.target.value || null })} aria-label={t('paginas.cliente')}><option value="">{t('paginas.semCliente')}</option>{projetos.map((p) => <option key={p.id} value={p.id}>{nomeProjeto(p)}</option>)}</select>
                {souDono && <button type="button" onClick={() => patch({ acesso: meta.acesso === 'publica' ? 'privada' : 'publica' })} className="ln-pill" title={t('paginas.quemPodeVer')}>{meta.acesso === 'publica' ? <><Globe className="w-3.5 h-3.5" /> {t('paginas.doTime')}</> : <><EyeOff className="w-3.5 h-3.5" /> {t('paginas.soEu')}</>}</button>}
                {souDono && <button type="button" onClick={() => patch({ bloqueada: !meta.bloqueada })} className="ln-pill" title={t('paginas.bloqueadaTitle')}>{meta.bloqueada ? <><Lock className="w-3.5 h-3.5" /> {t('paginas.bloqueada')}</> : <><Unlock className="w-3.5 h-3.5" /> {t('paginas.desbloqueada')}</>}</button>}
                <button type="button" onClick={() => nova(meta.id)} className="ln-pill"><CornerDownRight className="w-3.5 h-3.5" /> {t('paginas.subpagina')}</button>
                <button type="button" onClick={async () => setVersoes(versoes ? null : await hook.versoes(meta.id))} className="ln-pill"><History className="w-3.5 h-3.5" /> {t('paginas.historico')}</button>
                {!travada && <button type="button" onClick={() => patch({ arquivada: !meta.arquivada })} className="ln-pill">{meta.arquivada ? <><ArchiveRestore className="w-3.5 h-3.5" /> {t('paginas.restaurar')}</> : <><Archive className="w-3.5 h-3.5" /> {t('paginas.arquivar')}</>}</button>}
                {souDono && <button type="button" onClick={async () => { if (window.confirm(t('paginas.confirmarExcluir'))) { const r = await hook.excluir(meta.id); if (r.error) onToast(r.error, 'error'); else onSelecionar(null) } }} className="ln-iconbtn hover:!text-ln-red" aria-label={t('paginas.excluir')} title={t('comum.excluir')}><Trash2 className="w-3.5 h-3.5" /></button>}
                <span className="ml-auto text-[11px] text-ln-t4">{travada ? t('paginas.bloqueadaPeloDono') : salvo ? t('paginas.salvoEm', { data: fmtDataHora(meta.updated_at) }) : t('comum.salvando')}</span>
              </div>
            </div>
            {versoes && (
              <div className="shrink-0 px-6 py-3 border-b border-ln-ink/[0.08] bg-ln-panel max-h-[200px] overflow-y-auto">
                <p className="ln-label">{t('paginas.versoesAnteriores')}</p>
                {!versoes.length && <p className="text-xs text-ln-t4">{t('paginas.semVersoes')}</p>}
                {versoes.map((v) => (
                  <div key={v.id} className="flex items-center gap-3 h-8 text-[13px] text-ln-t2">
                    <span className="tabular text-ln-t4 w-[130px]">{fmtDataHora(v.created_at)}</span>
                    <span className="flex-1 truncate">{v.titulo}</span>
                    {!travada && <button type="button" className="ln-pill" onClick={() => { sujo.current = true; setTitulo(v.titulo || ''); setTexto(v.conteudo || ''); setModo('editar'); setVersoes(null); onToast(t('paginas.versaoCarregada')) }}>{t('paginas.restaurar')}</button>}
                  </div>
                ))}
              </div>
            )}
            <div className="shrink-0 px-6 py-2 flex items-center gap-1 border-b border-ln-ink/5">
              <div className="flex items-center gap-1 mr-3">
                <button type="button" onClick={() => setModo('editar')} className={`ln-tab ${modo === 'editar' ? 'ln-tab-active' : ''}`}><Pencil className="w-3.5 h-3.5" /> {t('comum.editar')}</button>
                <button type="button" onClick={() => setModo('ler')} className={`ln-tab ${modo === 'ler' ? 'ln-tab-active' : ''}`}><Eye className="w-3.5 h-3.5" /> {t('paginas.ler')}</button>
              </div>
              {modo === 'editar' && !travada && (
                <>
                  <button type="button" className="ln-iconbtn" title={t('paginas.md.titulo')} aria-label={t('paginas.md.titulo')} onClick={() => md((el) => inserir(el, '\n## ', '\n', t('paginas.md.titulo')))}><Heading2 className="w-4 h-4" /></button>
                  <button type="button" className="ln-iconbtn" title={t('paginas.md.negrito')} aria-label={t('paginas.md.negrito')} onClick={() => md((el) => inserir(el, '**', '**', t('paginas.md.texto')))}><Bold className="w-4 h-4" /></button>
                  <button type="button" className="ln-iconbtn" title={t('paginas.md.italico')} aria-label={t('paginas.md.italico')} onClick={() => md((el) => inserir(el, '_', '_', t('paginas.md.texto')))}><Italic className="w-4 h-4" /></button>
                  <button type="button" className="ln-iconbtn" title={t('paginas.md.lista')} aria-label={t('paginas.md.lista')} onClick={() => md((el) => inserir(el, '\n- ', '', t('paginas.md.item')))}><List className="w-4 h-4" /></button>
                  <button type="button" className="ln-iconbtn" title={t('paginas.md.checklist')} aria-label={t('paginas.md.checklist')} onClick={() => md((el) => inserir(el, '\n- [ ] ', '', t('paginas.md.tarefa')))}><ListChecks className="w-4 h-4" /></button>
                  <button type="button" className="ln-iconbtn" title={t('paginas.md.link')} aria-label={t('paginas.md.link')} onClick={() => md((el) => inserir(el, '[', '](https://)', t('paginas.md.texto')))}><Link2 className="w-4 h-4" /></button>
                </>
              )}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
              <div className="max-w-3xl mx-auto">
                {modo === 'editar' ? (
                  <textarea ref={taRef} value={texto} disabled={travada} onChange={(e) => { sujo.current = true; setTexto(e.target.value) }} placeholder={t('paginas.placeholderTexto')} className="w-full min-h-[60vh] bg-transparent outline-none resize-none text-[15px] leading-relaxed text-ln-t2 font-[inherit]" />
                ) : texto.trim() ? (
                  <div className="prose-tarefa text-[15px] text-ln-t2 leading-relaxed"><ReactMarkdown>{texto}</ReactMarkdown></div>
                ) : <p className="text-ln-t4 text-sm">{t('paginas.vazia')}</p>}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
