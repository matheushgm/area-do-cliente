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
    build: {
      rollupOptions: {
        output: {
          // O split por rota o Rollup já faz sozinho a partir dos lazy() de
          // src/routes. Aqui só isolamos as dependências que mudam por upgrade
          // e não por feature: sem isso, todo deploy invalida no cache do
          // browser também o peso de react + router + supabase.
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            supabase: ['@supabase/supabase-js'],
          },
        },
      },
    },
  }
})
