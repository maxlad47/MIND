// Liaison par clé personnelle Garmin : la clé arrive une seule fois (HTTPS), est testée, chiffrée, puis une première synchro démarre.
// Actions : { action: 'link', apiKey, durationDays } · { action: 'unlink' } · { action: 'allow', clientId, allowed } (coach seulement).
// La clé n'est jamais renvoyée au navigateur et n'est jamais écrite dans les logs : on ne journalise rien du corps de la requête.
import { cors } from '../_cors.ts'
import { bearer, makeDeps } from '../_garmin.ts'
import { handleLink, type LinkRequest } from '../../../shared/garmin/handlers.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: cors })
  try {
    const body = (await req.json()) as LinkRequest
    const out = await handleLink(makeDeps(), bearer(req), body)
    return Response.json(out.body, { status: out.status, headers: cors })
  } catch {
    return Response.json({ error: 'server', message: 'Une erreur est survenue. Réessaie dans un instant.' }, { status: 500, headers: cors })
  }
})
