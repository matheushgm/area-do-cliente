// Client do ADS Roadmap (/api/ads-roadmap): tabelas por faixa lidas da página
// "Roadmap Ads" do ClickUp. Leva o JWT da sessão; o token do ClickUp fica no servidor.
import { supabase } from './supabase'

export async function carregarRoadmapClickUp({ refresh = false } = {}) {
  if (!supabase) throw new Error('Supabase não configurado.')
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData?.session?.access_token
  if (!accessToken) throw new Error('Sessão expirada. Faça login de novo.')

  const res = await fetch(`/api/ads-roadmap${refresh ? '?refresh=1' : ''}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch {
    throw new Error('A API não respondeu JSON (rode com `vercel dev` pra ter as rotas /api).')
  }
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`)
  return data
}
