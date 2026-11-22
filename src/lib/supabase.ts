// Client Supabase. Sans variables d'environnement, l'app reste en mode local (démo, données sur l'appareil).
import { createClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

export const supabase = url && anon && /^https?:\/\//.test(url)
  ? createClient(url, anon, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
  : null

/** Vrai quand l'app est reliée à Supabase (comptes et données en ligne). */
export const REMOTE = supabase !== null
