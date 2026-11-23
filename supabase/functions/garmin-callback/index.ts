// ÉCRITE ET TESTÉE AVEC DES RÉPONSES SIMULÉES — NON DÉPLOYÉE. Retour d'autorisation OAuth Garmin (Starter) : voir shared/garmin/starter.ts.
import { createClient } from '@supabase/supabase-js'
import { env, makeDeps } from '../_garmin.ts'
import { handleCallback } from '../../../shared/garmin/starter.ts'

Deno.serve(async (req) => {
  const params = Object.fromEntries(new URL(req.url).searchParams)
  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
  const deps = {
    ...makeDeps(),
    async saveStarter(userId: string, tokensEnc: string, providerUserId?: string) {
      await db.from('integrations').upsert({ user_id: userId, provider: 'garmin', key_enc: tokensEnc, expires_at: '2099-12-31', status: 'liee', provider_user_id: providerUserId ?? null, updated_at: new Date().toISOString() })
    },
  }
  const post = (url: string, body: URLSearchParams) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body })
  const cfg = { clientId: env('GARMIN_CLIENT_ID'), clientSecret: env('GARMIN_CLIENT_SECRET'), redirectUri: env('GARMIN_REDIRECT_URI'), stateSecret: env('GARMIN_KEY_SECRET'), pushSecret: env('GARMIN_PUSH_SECRET') }
  const out = await handleCallback(deps, cfg, post, params)
  return new Response(out.status === 200 ? 'Montre liée. Tu peux fermer cette page et retourner dans MIND.' : 'La liaison a échoué. Retourne dans MIND et réessaie.', { status: out.status })
})
