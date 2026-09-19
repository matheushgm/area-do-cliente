import { apiFetch } from './api'

// Dispara o preenchimento dos Resultados a partir dos dados reais de Meta/Google
// (mesmo endpoint que o Vercel Cron chama nos dias 1, 8, 15 e 22).
//
// `month` é 1-12. Devolve o JSONB mesclado em `data` para o componente atualizar
// o estado local na hora, sem esperar recarregar a página.
export function autofillResultados({ projectId, year, month }) {
  return apiFetch('/api/resultados-autofill', { body: { projectId, year, month } })
}
