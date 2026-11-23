// Aviso "Desfazer" do VertaTask: aparece por 10 s depois de concluir, excluir, arquivar ou mudar
// (ou tirar) uma data, e põe a tarefa de volta como estava.
//
//   const [oferecerDesfazer, avisoDesfazer] = useDesfazer({ avisar })
//   oferecerDesfazer({ mensagem, desfazer, confirmar })   ·   no JSX: {avisoDesfazer(acima)}
//
// - `desfazer()`: volta ao estado anterior (chamado no clique em "Desfazer").
// - `confirmar()` (opcional): grava de fato quando o prazo acaba. Excluir e arquivar usam assim:
//   a tarefa some da tela na hora e só é apagada/arquivada no banco (e no ClickUp) depois dos
//   10 s, então desfazer não deixa rastro. Concluir e datas gravam na hora e desfazer regrava.
// Um aviso novo confirma na hora o que estava pendente no anterior; sair da tela também confirma.
import { useState, useRef, useCallback, useEffect } from 'react'
import { Undo2, X, Loader2 } from 'lucide-react'
import { useI18n } from '../../i18n'

export const PRAZO_DESFAZER_MS = 10_000

function AvisoDesfazer({ aviso, onDesfazer, onFechar, desfazendo, acima }) {
  const { t } = useI18n()
  const [restam, setRestam] = useState(Math.ceil(PRAZO_DESFAZER_MS / 1000))
  useEffect(() => {
    const fim = aviso.ate
    const passo = () => setRestam(Math.max(0, Math.ceil((fim - Date.now()) / 1000)))
    passo()
    const iv = setInterval(passo, 250)
    return () => clearInterval(iv)
  }, [aviso.ate])
  return (
    // a animação de entrada mexe no transform: a centralização fica no invólucro
    <div className={`fixed inset-x-0 ${acima ? 'bottom-24' : 'bottom-6'} z-[110] flex justify-center px-4 pointer-events-none`}>
    <div
      role="status" aria-live="polite"
      className="pointer-events-auto w-full max-w-[440px] overflow-hidden rounded-xl border border-ln-ink/10 bg-ln-panel shadow-2xl animate-slide-up"
    >
      <div className="flex items-center gap-3 pl-4 pr-2 py-2.5">
        <span className="flex-1 min-w-0 text-[13px] text-ln-t1 truncate" title={aviso.mensagem}>{aviso.mensagem}</span>
        <button
          type="button" onClick={onDesfazer} disabled={desfazendo}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-semibold text-ln-accent hover:bg-ln-accent/10 disabled:opacity-60 shrink-0"
        >
          {desfazendo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
          {t('tarefas.desfazer.botao')}
          <span className="tabular text-[11px] font-normal text-ln-t4 w-5 text-left">{restam}s</span>
        </button>
        <button type="button" onClick={onFechar} className="ln-iconbtn !w-7 !h-7 shrink-0" aria-label={t('comum.fechar')} title={t('comum.fechar')}>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="h-0.5 bg-ln-ink/5">
        <div key={aviso.id} className="h-full bg-ln-accent origin-left" style={{ animation: `desfazer-prazo ${PRAZO_DESFAZER_MS}ms linear forwards` }} />
      </div>
      <style>{'@keyframes desfazer-prazo { from { transform: scaleX(1) } to { transform: scaleX(0) } }'}</style>
    </div>
    </div>
  )
}

/** `avisar(msg, tipo)` mostra os erros no toast de sempre. O 2º valor é `renderAviso(acima)`; `acima` sobe o aviso (barra de seleção aberta). */
export function useDesfazer({ avisar } = {}) {
  const [aviso, setAviso] = useState(null) // { id, mensagem, ate }
  const [desfazendo, setDesfazendo] = useState(false)
  const atual = useRef(null) // { id, desfazer, confirmar, timer }
  // em ref: `encerrar` precisa ser estável, senão o efeito de saída confirmaria antes da hora
  const avisarRef = useRef(avisar)
  useEffect(() => { avisarRef.current = avisar }, [avisar])

  // tira o aviso da tela; `gravar` = roda o confirmar pendente (prazo acabou, aviso novo, saiu da tela)
  const encerrar = useCallback((gravar) => {
    const a = atual.current
    if (!a) return
    clearTimeout(a.timer)
    atual.current = null
    setAviso(null)
    if (gravar && a.confirmar) {
      const erro = (m) => avisarRef.current?.(m, 'error')
      Promise.resolve().then(a.confirmar).then((r) => { if (r?.error) erro(r.error) }).catch((e) => erro(String(e?.message || e)))
    }
  }, [])

  const oferecer = useCallback(({ mensagem, desfazer, confirmar = null }) => {
    encerrar(true)
    const id = Math.random().toString(36).slice(2)
    const timer = setTimeout(() => { if (atual.current?.id === id) encerrar(true) }, PRAZO_DESFAZER_MS)
    atual.current = { id, desfazer, confirmar, timer }
    setDesfazendo(false)
    setAviso({ id, mensagem, ate: Date.now() + PRAZO_DESFAZER_MS })
  }, [encerrar])

  const aoDesfazer = useCallback(async () => {
    const a = atual.current
    if (!a) return
    clearTimeout(a.timer)
    setDesfazendo(true)
    let r
    try { r = await a.desfazer() } catch (e) { r = { error: String(e?.message || e) } }
    if (atual.current?.id !== a.id) return // um aviso novo entrou enquanto desfazia
    atual.current = null
    setAviso(null)
    setDesfazendo(false)
    if (r?.error) avisarRef.current?.(r.error, 'error')
  }, [])

  // saiu da tela (trocou de módulo) com exclusão pendente: grava agora. Fechar a aba no meio
  // do prazo tenta gravar; se o navegador cortar a chamada, a tarefa só não é apagada.
  useEffect(() => {
    const aoSair = () => encerrar(true)
    window.addEventListener('pagehide', aoSair)
    return () => { window.removeEventListener('pagehide', aoSair); encerrar(true) }
  }, [encerrar])

  // função, para quem usa decidir `acima` no render (a seleção é calculada depois do hook)
  const renderAviso = (acima = false) => (aviso ? (
    <AvisoDesfazer aviso={aviso} desfazendo={desfazendo} acima={acima} onDesfazer={aoDesfazer} onFechar={() => encerrar(true)} />
  ) : null)
  return [oferecer, renderAviso]
}
