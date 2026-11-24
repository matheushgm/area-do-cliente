// Botão azul "Compartilhar" do cabeçalho do VertaTask: cria, copia e desativa o link público da
// lista aberta (ou da pasta inteira do cliente). O link abre /lista/:token sem login
// (src/pages/ListaPublica.jsx + api/tarefas-publico.js). Tabela tarefas_links_publicos (migration 138):
// um link ativo por lista/pasta; desativar corta o acesso na hora e criar de novo gera outro token.
import { useEffect, useRef, useState } from 'react'
import { Share2, Copy, Check, ExternalLink, Loader2, Globe } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Popover, FOCO } from './Campos'
import { useI18n } from '../../i18n'

export const urlListaPublica = (token) => `${window.location.origin}/lista/${token}`

export default function CompartilharLista({ listaId = null, pastaId = null, nome, user, avisar }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [link, setLink] = useState(undefined) // undefined = lendo; null = sem link
  const [ocupado, setOcupado] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const ref = useRef(null)
  const campo = listaId ? 'lista_id' : 'pasta_id'
  const alvo = listaId || pastaId

  useEffect(() => {
    if (!open || !alvo) return
    let vivo = true
    setLink(undefined)
    supabase.from('tarefas_links_publicos').select('id, token, acessos, ultimo_acesso_at, created_at').eq(campo, alvo).eq('ativo', true).maybeSingle()
      .then(({ data, error }) => { if (vivo) { if (error) avisar?.(error.message, 'error'); setLink(data || null) } })
    return () => { vivo = false }
  }, [open, alvo, campo, avisar])

  async function criar() {
    setOcupado(true)
    const { data, error } = await supabase.from('tarefas_links_publicos').insert({ [campo]: alvo, criado_por: user?.id || null }).select('id, token, acessos, ultimo_acesso_at, created_at').single()
    setOcupado(false)
    if (error) { avisar?.(error.message, 'error'); return }
    setLink(data)
    copiar(data.token)
  }
  async function desativar() {
    if (!link) return
    setOcupado(true)
    const { error } = await supabase.from('tarefas_links_publicos').update({ ativo: false, desativado_em: new Date().toISOString() }).eq('id', link.id)
    setOcupado(false)
    if (error) { avisar?.(error.message, 'error'); return }
    setLink(null)
    avisar?.(t('tarefas.compartilhar.desativado'))
  }
  function copiar(token) {
    navigator.clipboard?.writeText(urlListaPublica(token)).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1800) }).catch(() => {})
  }

  if (!alvo) return null
  return (
    <>
      <button
        ref={ref} type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="dialog" aria-expanded={open}
        className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-ln-accent text-white text-[12px] font-semibold shrink-0 hover:brightness-110 ${FOCO}`}
      >
        <Share2 className="w-3.5 h-3.5" /> {t('tarefas.compartilhar.botao')}
      </button>
      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={360} alturaMax={420}>
        <div className="p-4 flex flex-col gap-3" role="dialog" aria-label={t('tarefas.compartilhar.titulo')}>
          <div className="flex items-start gap-2.5">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-ln-accent/10 text-ln-accent shrink-0"><Globe className="w-4 h-4" /></span>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-ln-t1">{t('tarefas.compartilhar.titulo')}</p>
              <p className="text-[12px] text-ln-t3 leading-snug mt-0.5">{t(listaId ? 'tarefas.compartilhar.explicaLista' : 'tarefas.compartilhar.explicaPasta', { nome })}</p>
            </div>
          </div>
          {link === undefined && <div className="flex justify-center py-3 text-ln-t4"><Loader2 className="w-4 h-4 animate-spin" /></div>}
          {link === null && (
            <button type="button" onClick={criar} disabled={ocupado} className={`ln-primary h-9 justify-center ${FOCO}`}>
              {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : t('tarefas.compartilhar.criar')}
            </button>
          )}
          {link && (<>
            <div className="flex items-center gap-1.5">
              <input readOnly value={urlListaPublica(link.token)} onFocus={(e) => e.target.select()} className="ln-input h-9 flex-1 min-w-0 text-[12px]" aria-label={t('tarefas.compartilhar.link')} />
              <button type="button" onClick={() => copiar(link.token)} className={`ln-primary h-9 px-3 shrink-0 ${FOCO}`}>
                {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copiado ? t('tarefas.compartilhar.copiado') : t('tarefas.compartilhar.copiar')}
              </button>
            </div>
            <div className="flex items-center justify-between gap-2 text-[12px]">
              <a href={urlListaPublica(link.token)} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 text-ln-accent hover:underline rounded ${FOCO}`}>
                <ExternalLink className="w-3.5 h-3.5" /> {t('tarefas.compartilhar.abrir')}
              </a>
              <span className="text-ln-t4 tabular">{t('tarefas.compartilhar.acessos', { count: link.acessos || 0 })}</span>
            </div>
            <div className="border-t border-ln-ink/5 pt-3 flex items-center justify-between gap-2">
              <p className="text-[11px] text-ln-t4 leading-snug">{t('tarefas.compartilhar.semDetalhes')}</p>
              <button type="button" onClick={desativar} disabled={ocupado} className={`shrink-0 text-[12px] font-medium text-ln-red hover:underline rounded disabled:opacity-50 ${FOCO}`}>{t('tarefas.compartilhar.desativar')}</button>
            </div>
          </>)}
        </div>
      </Popover>
    </>
  )
}
