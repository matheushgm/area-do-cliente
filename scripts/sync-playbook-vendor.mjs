// Gera public/dash-teste/vendor/playbookSugestoes.js a partir do motor do app
// (src/lib/playbookSugestoes.js). O viewer do dashboard é HTML estático em
// public/ e não passa pelo Vite, então não consegue importar de src/: ele usa
// esta cópia. Roda sozinha no `npm run dev` e no `npm run build` (pre-hooks),
// para a regra nunca divergir entre o dashboard e a Central de Otimizações.
// A única diferença é o caminho do import do dashboardData (a versão do viewer).
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const origem = join(raiz, 'src/lib/playbookSugestoes.js')
const destino = join(raiz, 'public/dash-teste/vendor/playbookSugestoes.js')

const IMPORT = "from './dashboardData'"
const src = readFileSync(origem, 'utf8')
if (!src.includes(IMPORT)) throw new Error(`sync-playbook-vendor: não achei ${IMPORT} em ${origem}`)

const cabecalho = `// GERADO por scripts/sync-playbook-vendor.mjs a partir de src/lib/playbookSugestoes.js.
// NÃO EDITE AQUI: a alteração se perde na próxima geração. Edite o original.
`
const saida = cabecalho + src.replace(IMPORT, "from './dashboardData.js'")

let atual = null
try { atual = readFileSync(destino, 'utf8') } catch { /* primeira geração */ }
if (atual !== saida) {
  writeFileSync(destino, saida)
  console.log('sync-playbook-vendor: vendor/playbookSugestoes.js atualizado')
}
