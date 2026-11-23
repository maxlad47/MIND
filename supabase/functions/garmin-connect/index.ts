// ÉCRITE ET TESTÉE AVEC DES RÉPONSES SIMULÉES — NON DÉPLOYÉE (en attente de la réponse de Garmin pour l'accès Starter).
// Démarre la liaison OAuth : renvoie l'adresse d'autorisation Garmin. Voir shared/garmin/starter.ts (TODO(garmin)).
import { cors } from '../_cors.ts'
import { bearer, env, makeDeps } from '../_garmin.ts'
import { buildAuthorizeUrl } from '../../../shared/garmin/starter.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const user = await makeDeps().userFromJwt(bearer(req) ?? '')
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401, headers: cors })
  const url = await buildAuthorizeUrl({ clientId: env('GARMIN_CLIENT_ID'), clientSecret: env('GARMIN_CLIENT_SECRET'), redirectUri: env('GARMIN_REDIRECT_URI'), stateSecret: env('GARMIN_KEY_SECRET'), pushSecret: env('GARMIN_PUSH_SECRET') }, user.id)
  return Response.json({ redirectUrl: url }, { headers: cors })
})
