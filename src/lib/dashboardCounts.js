import { entryDate } from './utils'

// Régua de "cliente novo" e contagem da lista de clientes. Mora aqui porque
// Dashboard e AppSidebar precisam do MESMO número — antes a sidebar recebia
// `counts` por prop e, nas 11 páginas que não são o Dashboard, chegava `{}`
// (os contadores apareciam zerados).

// Mesma janela dos 90 dias de onboarding usada na barra de progresso.
export const NEW_CLIENT_WINDOW_DAYS = 90

export function isNewClient(p, cutoff) {
  const d = entryDate(p)
  return !!d && d.getTime() >= cutoff
}

// Squads marcados como "Em teste" ficam fora de todas as agregações e da
// listagem da home — a visualização deles é o /relatorio-squads.
export function baseProjectsOf(projects, squads) {
  const testSquadIds = new Set((squads || []).filter((s) => s.isTest).map((s) => String(s.id)))
  if (testSquadIds.size === 0) return projects || []
  return (projects || []).filter((p) => !p.squad || !testSquadIds.has(String(p.squad)))
}

// Os três contadores que a sidebar mostra. O Dashboard calcula os seus
// (squads, risks, momentos…) por cima do mesmo `baseProjects`.
export function sidebarCounts(baseProjects, cutoff = Date.now() - NEW_CLIENT_WINDOW_DAYS * 86400000) {
  const ativos = baseProjects.filter((p) => p.momento !== 'churn')
  return {
    all: ativos.length,
    churn: baseProjects.length - ativos.length,
    novos: ativos.filter((p) => isNewClient(p, cutoff)).length,
  }
}
