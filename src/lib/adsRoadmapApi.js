// Client do ADS Roadmap (/api/ads-roadmap): tabelas por faixa lidas da página
// "Roadmap Ads" do ClickUp. Leva o JWT da sessão; o token do ClickUp fica no servidor.
import { apiFetch } from './api'

export function carregarRoadmapClickUp({ refresh = false } = {}) {
  return apiFetch(`/api/ads-roadmap${refresh ? '?refresh=1' : ''}`)
}
