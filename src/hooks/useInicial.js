import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { hojeSP, somaDias, inicioDoMes } from '../lib/inicial'

// Dados da página Inicial. Lê direto do Supabase com o token de quem está logado
// (as tabelas são do time: dash_daily, dashboard_accounts, metas, planos, ROI e
// sugestões). As contas dos quadrantes ficam em `src/lib/inicial.js`.
//
// O rollup `dash_daily` do mês tem ~7 mil linhas (uma por canal, conta, dia e
// campanha); o Supabase devolve no máximo 1000 por resposta, então a leitura
// conta as linhas e pede as páginas em paralelo.

const PAGINA = 1000
const COLS_DASH = 'channel,account,day,campaign,spend,conv,clicks,lpv'

async function lerDashDaily(desde) {
  const base = () => supabase.from('dash_daily').select(COLS_DASH, { count: 'exact' }).gte('day', desde)
    .order('day').order('channel').order('account').order('campaign')
  const primeira = await base().range(0, PAGINA - 1)
  if (primeira.error) throw primeira.error
  const total = primeira.count ?? primeira.data.length
  const resto = []
  for (let off = PAGINA; off < total; off += PAGINA) resto.push(base().range(off, off + PAGINA - 1))
  const paginas = await Promise.all(resto)
  const linhas = [...primeira.data]
  for (const p of paginas) { if (p.error) throw p.error; linhas.push(...p.data) }
  return linhas
}

// Mais recente por projeto (as listas vêm ordenadas por created_at desc).
function maisRecente(rows) {
  const m = new Map()
  for (const r of rows || []) if (!m.has(r.project_id)) m.set(r.project_id, r)
  return m
}

export function useInicial() {
  const [estado, setEstado] = useState({ loading: true, error: null, dados: null, atualizadoEm: null })
  const vivo = useRef(true)

  const carregar = useCallback(async () => {
    setEstado((e) => ({ ...e, loading: true, error: null }))
    try {
      // Harness DEV (/dev/inicial): dados de uma fixture, sem login nem banco.
      const dev = import.meta.env.DEV && typeof window !== 'undefined' ? window.__DEV_INICIAL : null
      if (dev) {
        setEstado({ loading: false, error: null, atualizadoEm: new Date(), dados: dev })
        return
      }
      const hoje = hojeSP()
      const [contas, metas, planos, rois, sugestoes, criticas] = await Promise.all([
        supabase.from('dashboard_accounts_public').select('account_name,project_id,hidden'),
        supabase.from('cpl_targets_public').select('project_id,cpl_target'),
        supabase.from('campaign_plans').select('project_id,answers,created_at').order('created_at', { ascending: false }),
        supabase.from('roi_calculators').select('project_id,media_orcamento,created_at').order('created_at', { ascending: false }),
        supabase.from('projeto_sugestoes')
          .select('id,project_id,titulo,canal,conta,campanha,conjunto,anuncio,decidida_por,decidida_em,executada_em,execucao_log')
          .eq('execucao_status', 'executada')
          .gte('executada_em', somaDias(hoje, -30))
          .order('executada_em', { ascending: false })
          .limit(400),
        supabase.from('projeto_sugestoes').select('id', { count: 'exact', head: true }).eq('status', 'critica'),
      ])
      for (const r of [contas, metas, planos, rois, sugestoes]) if (r.error) throw r.error

      // Janela do dash: o mês que fechou ontem, 15 dias para o CPL e o início do
      // Planejamento de Campanhas que esteja valendo (pode ter começado no mês passado).
      const ontem = somaDias(hoje, -1)
      let desde = [inicioDoMes(ontem), somaDias(hoje, -15)].sort()[0]
      const planoDe = maisRecente(planos.data)
      const limite = somaDias(hoje, -70)
      for (const p of planoDe.values()) {
        const ini = String(p.answers?.startDate || '').slice(0, 10)
        const fim = String(p.answers?.endDate || '').slice(0, 10)
        if (fim < hoje) continue // vencido: o pace usa a Calculadora de ROI
        if (/^\d{4}-\d{2}-\d{2}$/.test(ini) && ini < desde && ini >= limite) desde = ini
      }
      const linhas = await lerDashDaily(desde)
      if (!vivo.current) return
      setEstado({
        loading: false,
        error: null,
        atualizadoEm: new Date(),
        dados: {
          hoje,
          linhas,
          contas: contas.data || [],
          metas: metas.data || [],
          planoDe,
          roiDe: maisRecente(rois.data),
          sugestoes: sugestoes.data || [],
          criticas: criticas.count || 0,
        },
      })
    } catch (e) {
      if (vivo.current) setEstado((s) => ({ ...s, loading: false, error: e.message || String(e) }))
    }
  }, [])

  useEffect(() => {
    vivo.current = true
    carregar()
    return () => { vivo.current = false }
  }, [carregar])

  return { ...estado, recarregar: carregar }
}
