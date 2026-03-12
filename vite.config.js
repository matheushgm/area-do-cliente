import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    // Expõe SUPABASE_URL e SUPABASE_ANON_KEY ao browser sem expor SUPABASE_SERVICE_ROLE_KEY
    define: {
      'import.meta.env.SUPABASE_URL':      JSON.stringify(env.SUPABASE_URL      || ''),
      'import.meta.env.SUPABASE_ANON_KEY': JSON.stringify(env.SUPABASE_ANON_KEY || ''),
    },
  }
})
