import { supabase } from './supabase'

// Dispara o preenchimento dos Resultados a partir dos dados reais de Meta/Google
// (mesmo endpoint que o Vercel Cron chama nos dias 1, 8, 15 e 22).
//
// `month` é 1-12. Devolve o JSONB mesclado em `data` para o componente atualizar
// o estado local na hora, sem esperar recarregar a página.
export async function autofillResultados({ projectId, year, month }) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/resultados-autofill', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token || ''}`,
    },
    body: JSON.stringify({ projectId, year, month }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body?.detail || body?.error || `HTTP ${res.status}`)
  return body
}
