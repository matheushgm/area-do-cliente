import { useState, useMemo, useLayoutEffect, Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import AppSidebar, { lerRecolhida, definirRecolhida } from '../components/AppSidebar'
import RouteFallback from '../components/UI/RouteFallback'
import OtimizacoesBridge from '../components/OtimizacoesBridge'

// Rotas que usam o tema Fynix. `useMatches`/`handle` seria mais elegante, mas
// exige o data router (createBrowserRouter) — este app usa <BrowserRouter>.
// Precisa ser predicado, e não lista: `/cliente/:id` é dinâmico.
const usaFx = (pathname) => pathname === '/' || pathname.startsWith('/cliente/')

// Shell das páginas internas: monta a AppSidebar UMA vez em vez das 12 cópias
// que cada página mantinha.
//
// O <Suspense> fica aqui dentro, e não acima do layout, para a sidebar não
// desmontar (nem piscar) a cada troca de rota.
//
// `fx` é o tema Fynix (src/index.css): troca os tokens rl-* da subárvore. Vale
// para a home e para a página do cliente; as demais seguem o tema base.
export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { pathname } = useLocation()
  const fx = usaFx(pathname)
  const emCliente = pathname.startsWith('/cliente/')
  // VertaTask (lista/quadro/calendário) também pede a largura toda.
  const emTarefas = pathname === '/tarefas' || pathname.startsWith('/tarefas/')
  const recolheAuto = emCliente || emTarefas

  // Abrir a página de um cliente ou o VertaTask recolhe a sidebar, para dar a
  // largura toda ao conteúdo. Layout effect: recolhe antes da primeira
  // pintura, sem piscar a sidebar aberta. Ao sair (ou desmontar o shell)
  // devolve o que o usuário tinha, então a preferência global do botão/tecla
  // `[` não é sobrescrita. Trocar de seção dentro da mesma área
  // (`/cliente/:id/:secao`, `/tarefas/...`) não refaz o efeito, e por isso
  // reabrir a sidebar à mão vale até sair dela.
  useLayoutEffect(() => {
    if (!recolheAuto) return undefined
    const estavaRecolhida = lerRecolhida()
    if (!estavaRecolhida) definirRecolhida(true)
    return () => { if (!estavaRecolhida) definirRecolhida(false) }
  }, [recolheAuto])

  const outletContext = useMemo(
    () => ({ openSidebar: () => setSidebarOpen(true) }),
    [],
  )

  return (
    <div className={`${fx ? 'fx ' : ''}min-h-screen flex bg-gradient-dark`}>
      <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {/* O dashboard (iframe) aceita/recusa otimizações por aqui: ver o componente */}
      <OtimizacoesBridge />
      <Suspense fallback={<RouteFallback />}>
        <Outlet context={outletContext} />
      </Suspense>
    </div>
  )
}
