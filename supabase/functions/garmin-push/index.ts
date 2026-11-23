// ÉCRITE ET TESTÉE AVEC DES RÉPONSES SIMULÉES — NON DÉPLOYÉE. Réception des activités envoyées par Garmin (Starter, mode push).
// L'adresse configurée chez Garmin contient un secret : https://<projet>.supabase.co/functions/v1/garmin-push?token=<GARMIN_PUSH_SECRET> (TODO(garmin) : contrôle d'origine à confirmer).
import { createClient } from '@supabase/supabase-js'
import { env, makeDeps } from '../_garmin.ts'
import { handlePush } from '../../../shared/garmin/starter.ts'

Deno.serve(async (req) => {
  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
  const deps = {
    ...makeDeps(),
    async userByProviderId(id: string) {
      const { data } = await db.from('integrations').select('user_id').eq('provider', 'garmin').eq('provider_user_id', id).maybeSingle()
      return (data?.user_id as string | undefined) ?? null
    },
  }
  const cfg = { clientId: '', clientSecret: '', redirectUri: '', stateSecret: env('GARMIN_KEY_SECRET'), pushSecret: env('GARMIN_PUSH_SECRET') }
  const out = await handlePush(deps, cfg, { token: new URL(req.url).searchParams.get('token') ?? undefined, body: await req.json().catch(() => ({})) })
  return Response.json({ received: out.received }, { status: out.status })
})
