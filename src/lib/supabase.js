import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = import.meta.env.SUPABASE_URL      || ''
const SUPABASE_ANON = import.meta.env.SUPABASE_ANON_KEY || ''

export const supabase = (SUPABASE_URL && SUPABASE_ANON)
  ? createClient(SUPABASE_URL, SUPABASE_ANON)
  : null

export const isSupabaseReady = !!(SUPABASE_URL && SUPABASE_ANON)

// ─── Storage helpers ──────────────────────────────────────────────────────────

/**
 * Faz upload de um File para o Supabase Storage e retorna a URL pública/assinada.
 * @param {string} bucket  - 'project-docs' | 'brand-media' | 'brand-logos' | 'attachments'
 * @param {string} path    - caminho dentro do bucket, ex: '{projectId}/logo.png'
 * @param {File}   file    - objeto File do browser
 * @returns {Promise<string|null>} URL do arquivo ou null em caso de erro
 */
export async function uploadFile(bucket, path, file) {
  if (!supabase) return null
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true })
  if (error) { console.error('[Storage] upload:', error.message); return null }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data?.publicUrl ?? null
}

/**
 * Remove um arquivo do Storage.
 * @param {string} bucket
 * @param {string} path
 */
export async function deleteFile(bucket, path) {
  if (!supabase) return
  const { error } = await supabase.storage.from(bucket).remove([path])
  if (error) console.error('[Storage] delete:', error.message)
}

/**
 * Gera uma URL assinada para download de arquivo privado (válida por 1h).
 * @param {string} bucket
 * @param {string} path
 * @returns {Promise<string|null>}
 */
export async function getSignedUrl(bucket, path) {
  if (!supabase) return null
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 3600)
  if (error) { console.error('[Storage] signed url:', error.message); return null }
  return data?.signedUrl ?? null
}
