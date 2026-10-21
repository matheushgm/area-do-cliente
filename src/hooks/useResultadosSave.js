import { useState, useRef, useCallback, useEffect } from 'react'

// Salvamento dos formulários públicos de Resultados (/b2c/:token e /b2b/:token).
//
// Antes cada formulário tinha um debounce de 1,5 s e engolia o erro: se o cliente
// fechava a aba nesse intervalo, ou a rede caía, o dado se perdia sem aviso. Aqui:
//   - o autosave continua, mas existe `saveNow()` (botão "Salvar") que grava na hora;
//   - saídas da página (fechar, trocar de app no celular) disparam um flush com
//     `keepalive` e, se ainda houver algo não gravado, o navegador pergunta antes de sair;
//   - falha de rede/servidor vira estado `error` visível, com nova tentativa automática
//     e manual, em vez de voltar para "idle";
//   - uma gravação por vez: a seguinte espera a anterior, então uma resposta lenta
//     nunca sobrescreve uma mais nova.
//
// status: 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

const AUTOSAVE_MS = 1500
const RETRY_MS    = 8000

export default function useResultadosSave({ endpoint, token, bodyKey, pick, hasOpenEdit = false }) {
  const [status, setStatus]     = useState('idle')
  const [savedAt, setSavedAt]   = useState(null)

  const latestRef   = useRef(null)   // último estado completo ainda não gravado
  const timerRef    = useRef(null)
  const retryRef    = useRef(null)
  const inflightRef = useRef(false)
  const statusRef   = useRef('idle')
  const cfgRef      = useRef({ endpoint, token, bodyKey, pick })
  cfgRef.current = { endpoint, token, bodyKey, pick }
  // Linha aberta (campos digitados e ainda não confirmados) também conta como
  // "não salvo" no aviso de saída.
  const hasOpenEditRef = useRef(false)
  hasOpenEditRef.current = hasOpenEdit

  const setSt = (s) => { statusRef.current = s; setStatus(s) }

  const buildBody = () => {
    const { token: t, bodyKey: k, pick: p } = cfgRef.current
    return JSON.stringify({ token: t, [k]: p(latestRef.current) })
  }

  const flush = useCallback(async () => {
    clearTimeout(timerRef.current)
    clearTimeout(retryRef.current)
    if (inflightRef.current) return        // o fim da gravação em curso chama flush de novo
    if (!latestRef.current) return

    inflightRef.current = true
    setSt('saving')
    const sent = latestRef.current
    try {
      const res = await fetch(cfgRef.current.endpoint, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    buildBody(),
      })
      if (!res.ok) throw new Error(String(res.status))
      // Só limpa se ninguém editou durante a gravação.
      if (latestRef.current === sent) latestRef.current = null
      inflightRef.current = false
      if (latestRef.current) { flush(); return }
      setSavedAt(new Date())
      setSt('saved')
    } catch {
      inflightRef.current = false
      setSt('error')
      retryRef.current = setTimeout(flush, RETRY_MS)
    }
  }, [])

  // Chamado a cada edição confirmada pelo cliente (já com o estado completo novo).
  const schedule = useCallback((updated) => {
    latestRef.current = updated
    clearTimeout(timerRef.current)
    clearTimeout(retryRef.current)
    if (statusRef.current !== 'saving') setSt('dirty')
    timerRef.current = setTimeout(flush, AUTOSAVE_MS)
  }, [flush])

  // Botão "Salvar": grava já. Sem nada pendente, só confirma que está tudo salvo.
  const saveNow = useCallback(() => {
    if (latestRef.current) return flush()
    if (!inflightRef.current && statusRef.current !== 'saving') {
      setSavedAt(new Date())
      setSt('saved')
    }
  }, [flush])

  // Saída da página: grava com keepalive (sobrevive ao fechamento da aba).
  useEffect(() => {
    const keepalive = () => {
      if (!latestRef.current) return
      try {
        fetch(cfgRef.current.endpoint, {
          method:    'PATCH',
          headers:   { 'Content-Type': 'application/json' },
          body:      buildBody(),
          keepalive: true,
        })
      } catch { /* sem o que fazer: o beforeunload já avisou */ }
    }
    const onVisibility = () => { if (document.visibilityState === 'hidden') keepalive() }
    const onBeforeUnload = (e) => {
      const pending = latestRef.current || inflightRef.current || statusRef.current === 'error'
      if (!pending && !hasOpenEditRef.current) return
      keepalive()
      e.preventDefault()
      e.returnValue = ''
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', keepalive)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', keepalive)
      window.removeEventListener('beforeunload', onBeforeUnload)
      clearTimeout(timerRef.current)
      clearTimeout(retryRef.current)
    }
  }, [])

  return { status, savedAt, schedule, saveNow }
}
