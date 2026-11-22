// Dados do portal que mais de uma tela usa (o Início e o próprio módulo): a Central de
// anúncios e as Solicitações. Ficam no Portal.jsx para trocar de aba sem buscar de novo.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { portalCentral, portalPedidos } from '../lib/portal'
import { montarCentral } from '../lib/portalCentral'

export function usePortalCentral(projectId, token, ligado) {
  const [bruto, setBruto] = useState(null)
  const [itensLocais, setItensLocais] = useState({}) // id → patch da decisão feita aqui
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(null)

  const recarregar = useCallback(async () => {
    if (!ligado || !token) return
    setCarregando(true); setErro(null)
    try { setBruto(await portalCentral(projectId, token)); setItensLocais({}) } catch (e) { setErro(e?.message || 'Não consegui carregar.') }
    setCarregando(false)
  }, [projectId, token, ligado])

  useEffect(() => { recarregar() }, [recarregar])

  const itens = useMemo(() => montarCentral(bruto || {}).map((it) => {
    const p = itensLocais[it.id]
    if (!p) return it
    return { ...it, ...p, conteudo: p.conteudo ?? it.conteudo, mes: (p.decididoEm || '').slice(0, 7) || it.mes }
  }), [bruto, itensLocais])

  const aplicarDecisao = useCallback((id, patch) => setItensLocais((x) => ({ ...x, [id]: patch })), [])
  return { itens, carregando: carregando || (ligado && !bruto && !erro), erro, recarregar, aplicarDecisao }
}

export function usePortalPedidos(projectId, token, ligado) {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const recarregar = useCallback(async () => {
    if (!ligado || !token) return
    setCarregando(true); setErro(null)
    try { setDados(await portalPedidos(projectId, token)) } catch (e) { setErro(e?.message || 'Não consegui carregar.') }
    setCarregando(false)
  }, [projectId, token, ligado])
  useEffect(() => { recarregar() }, [recarregar])
  return { pedidos: dados?.pedidos || [], podePedir: !!dados?.podePedir, prazos: dados?.prazos || {}, empresa: dados?.empresa || '', carregando: carregando || (ligado && !dados && !erro), erro, recarregar }
}
