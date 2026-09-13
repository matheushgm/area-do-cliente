import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))

// Entrega api/_atividades_engine.js como módulo virtual para o preview de
// desenvolvimento (src/dev/AtividadesPreview.jsx). Precisa ser virtual porque o
// vercel dev intercepta qualquer URL /api/* e o browser não conseguiria baixar
// o arquivo pelo caminho real. Em produção esse import fica em código morto.
// O id resolvido é um caminho (inexistente) dentro de src/ de propósito: as
// rewrites do vercel.json mandam qualquer URL fora de /src, /api, /@vite e
// /node_modules para o index.html, então um id "/@id/virtual:..." não chegaria
// ao Vite pelo vercel dev.
const ENGINE_VIRTUAL_ID = path.join(here, 'src', 'dev', '__atividades_engine_virtual.js')
const engineVirtual = {
  name: 'atividades-engine-virtual',
  resolveId(id) { return id === 'virtual:atividades-engine' ? ENGINE_VIRTUAL_ID : null },
  load(id) {
    if (id !== ENGINE_VIRTUAL_ID) return null
    return readFileSync(path.join(here, 'api', '_atividades_engine.js'), 'utf8')
  },
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), engineVirtual],
    // Expõe SUPABASE_URL e SUPABASE_ANON_KEY ao browser sem expor SUPABASE_SERVICE_ROLE_KEY
    define: {
      'import.meta.env.SUPABASE_URL':      JSON.stringify(env.SUPABASE_URL      || ''),
      'import.meta.env.SUPABASE_ANON_KEY': JSON.stringify(env.SUPABASE_ANON_KEY || ''),
    },
  }
})
