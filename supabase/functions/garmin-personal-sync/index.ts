// Synchronisation Garmin (clé personnelle). Trois déclencheurs :
//   - la tâche planifiée toutes les 30 minutes (en-tête Authorization = clé service_role) → tous les comptes liés ;
//   - l'ouverture de l'app : { reason: 'open' }, au plus une fois toutes les 5 minutes par utilisateur ;
//   - le bouton « Synchroniser » : { reason: 'manual' }.
import { cors } from '../_cors.ts'
import { bearer, env, makeDeps } from '../_garmin.ts'
import { handleSync, syncAll } from '../../../shared/garmin/handlers.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const token = bearer(req)
    const deps = makeDeps()
    if (token && token === env('SUPABASE_SERVICE_ROLE_KEY')) return Response.json(await syncAll(deps), { headers: cors })
    const body = await req.json().catch(() => ({})) as { reason?: 'open' | 'manual' }
    const out = await handleSync(deps, token, body.reason === 'open' ? 'open' : 'manual')
    return Response.json(out.body, { status: out.status, headers: cors })
  } catch {
    return Response.json({ error: 'server', message: 'Synchronisation impossible pour le moment.' }, { status: 500, headers: cors })
  }
})
