// Gera public/dash-teste/vendor/playbookSugestoes.js (e vendor/playbookTextos.js, vendor/dashCache.js) a partir do app
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
const IMPORT_TEXTOS = "from './playbookTextos'"
const src = readFileSync(origem, 'utf8')
if (!src.includes(IMPORT)) throw new Error(`sync-playbook-vendor: não achei ${IMPORT} em ${origem}`)
if (!src.includes(IMPORT_TEXTOS)) throw new Error(`sync-playbook-vendor: não achei ${IMPORT_TEXTOS} em ${origem}`)

const cabecalho = `// GERADO por scripts/sync-playbook-vendor.mjs a partir de src/lib/playbookSugestoes.js.
// NÃO EDITE AQUI: a alteração se perde na próxima geração. Edite o original.
`
const saida = cabecalho + src.replace(IMPORT, "from './dashboardData.js'").replace(IMPORT_TEXTOS, "from './playbookTextos.js'")

let atual = null
try { atual = readFileSync(destino, 'utf8') } catch { /* primeira geração */ }
if (atual !== saida) {
  writeFileSync(destino, saida)
  console.log('sync-playbook-vendor: vendor/playbookSugestoes.js atualizado')
}

// Textos das sugestões em pt/en (src/lib/playbookTextos.js): sem imports, vai como está.
// O idioma é lido do `rl_lang` do localStorage, que o viewer divide com o app (mesma origem).
const textosOrigem = join(raiz, 'src/lib/playbookTextos.js')
const textosDestino = join(raiz, 'public/dash-teste/vendor/playbookTextos.js')
const textosSrc = readFileSync(textosOrigem, 'utf8')
if (/^\s*import\s/m.test(textosSrc)) throw new Error('sync-playbook-vendor: playbookTextos.js não pode ter imports (o viewer não resolve src/)')
const textosSaida = cabecalho.replace('src/lib/playbookSugestoes.js', 'src/lib/playbookTextos.js') + textosSrc
let textosAtual = null
try { textosAtual = readFileSync(textosDestino, 'utf8') } catch { /* primeira geração */ }
if (textosAtual !== textosSaida) {
  writeFileSync(textosDestino, textosSaida)
  console.log('sync-playbook-vendor: vendor/playbookTextos.js atualizado')
}

// Cache local do dashboard (src/lib/dashCache.js): sem imports, vai como está.
// Mesma origem = mesmo IndexedDB, então o viewer e o app dividem as entradas.
const cacheOrigem = join(raiz, 'src/lib/dashCache.js')
const cacheDestino = join(raiz, 'public/dash-teste/vendor/dashCache.js')
const cacheSaida = cabecalho.replace('src/lib/playbookSugestoes.js', 'src/lib/dashCache.js') + readFileSync(cacheOrigem, 'utf8')
let cacheAtual = null
try { cacheAtual = readFileSync(cacheDestino, 'utf8') } catch { /* primeira geração */ }
if (cacheAtual !== cacheSaida) {
  writeFileSync(cacheDestino, cacheSaida)
  console.log('sync-playbook-vendor: vendor/dashCache.js atualizado')
}
