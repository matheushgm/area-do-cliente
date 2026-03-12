import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = import.meta.env.SUPABASE_URL      || ''
const SUPABASE_ANON = import.meta.env.SUPABASE_ANON_KEY || ''

export const supabase = (SUPABASE_URL && SUPABASE_ANON)
  ? createClient(SUPABASE_URL, SUPABASE_ANON)
  : null

export const isSupabaseReady = !!(SUPABASE_URL && SUPABASE_ANON)
