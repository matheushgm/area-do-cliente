// Harness DEV (só import.meta.env.DEV): a página Inicial sem login, com os dados da
// fixture gitignored src/dev/fixtures/inicial.json (mesmo formato de `dados` do
// useInicial, com `planoDe`/`roiDe` em listas e `projetosDev` no lugar do AppContext).
// O useInicial lê window.__DEV_INICIAL, preenchido aqui ao carregar o módulo.
import Inicial from './Inicial'

// Via glob para o build da Vercel (clone limpo, sem a pasta) não quebrar.
const fixtures = import.meta.glob('../dev/fixtures/inicial.json', { eager: true, import: 'default' })
const fixture = fixtures['../dev/fixtures/inicial.json'] || null

if (fixture && typeof window !== 'undefined') {
  window.__DEV_INICIAL = { ...fixture, planoDe: new Map(fixture.planoDe || []), roiDe: new Map(fixture.roiDe || []) }
}

export default function DevInicial() {
  if (!fixture) return <p style={{ padding: 24 }}>Sem fixture: gere src/dev/fixtures/inicial.json.</p>
  return <div className="min-h-screen flex"><Inicial /></div>
}
