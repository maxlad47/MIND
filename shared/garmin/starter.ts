// Accès officiel Garmin « Starter » (OAuth) — PRÉPARÉ ET DÉSACTIVÉ : la demande d'accès est en attente de réponse de Garmin.
// Écrit et testé avec des réponses simulées ; les Edge Functions garmin-connect, garmin-callback et garmin-push ne sont PAS déployées,
// et l'écran « Lier ma montre Garmin » reste masqué tant que VITE_GARMIN_ENABLED n'est pas à « true ».
//
// Tout ce qui n'est pas vérifié est marqué TODO(garmin) : à relire dans la documentation fournie par Garmin avec l'accès,
// AVANT de déployer. En particulier les adresses OAuth, les portées, la forme des notifications et leur contrôle d'origine.
import { runIdOf } from './analysis.ts'
import { encryptSecret } from './crypto.ts'
import type { Deps } from './handlers.ts'
import type { RunProvider } from './provider.ts'
import { typeFromKey } from './personal.ts'
import { isRunType, type ImportedRun, type RunData } from './types.ts'

// TODO(garmin) : adresses et portées OAuth2 non vérifiées (à confirmer dans la documentation reçue avec l'accès Starter).
export const STARTER = {
  authorizeUrl: 'https://connect.garmin.com/oauth2Confirm',
  tokenUrl: 'https://diauth.garmin.com/di-oauth2-service/oauth/token',
}

export interface StarterConfig { clientId: string; clientSecret: string; redirectUri: string; stateSecret: string; pushSecret: string }

const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
async function hmac(secret: string, msg: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg)))
}

/** `state` sans stockage : `userId.aléa.signature`. Le callback le vérifie et en déduit l'utilisateur. */
export async function signState(userId: string, secret: string): Promise<string> {
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(12)))
  return `${userId}.${nonce}.${b64url(await hmac(secret, `${userId}.${nonce}`))}`
}
export async function verifyState(state: string, secret: string): Promise<string | null> {
  const [userId, nonce, sig] = state.split('.')
  if (!userId || !nonce || !sig) return null
  return b64url(await hmac(secret, `${userId}.${nonce}`)) === sig ? userId : null
}
/** PKCE : le vérificateur se déduit du `state` (jamais stocké). */
export const codeVerifierOf = async (state: string, secret: string) => b64url(await hmac(secret, `pkce.${state}`))
export async function codeChallengeOf(verifier: string): Promise<string> {
  return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))
}

export async function buildAuthorizeUrl(cfg: StarterConfig, userId: string): Promise<string> {
  const state = await signState(userId, cfg.stateSecret)
  const challenge = await codeChallengeOf(await codeVerifierOf(state, cfg.stateSecret))
  const q = new URLSearchParams({ response_type: 'code', client_id: cfg.clientId, redirect_uri: cfg.redirectUri, state, code_challenge: challenge, code_challenge_method: 'S256' })
  return `${STARTER.authorizeUrl}?${q}`
}

type Post = (url: string, body: URLSearchParams) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>

/** Retour d'autorisation : échange le code contre les jetons (chiffrés), supprime la clé personnelle éventuelle (le dédoublonnage par id Garmin évite tout double import). */
export async function handleCallback(deps: Deps & { saveStarter(userId: string, tokensEnc: string, providerUserId?: string): Promise<void> }, cfg: StarterConfig, post: Post, params: Record<string, string>): Promise<{ status: number; userId?: string }> {
  const userId = params.state ? await verifyState(params.state, cfg.stateSecret) : null
  if (!userId || !params.code) return { status: 400 }
  const body = new URLSearchParams({ grant_type: 'authorization_code', code: params.code, client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: cfg.redirectUri, code_verifier: await codeVerifierOf(params.state, cfg.stateSecret) })
  const res = await post(STARTER.tokenUrl, body)
  if (!res.ok) return { status: 502 }
  const tokens = (await res.json()) as { access_token?: string; refresh_token?: string; user_id?: string }
  if (!tokens.access_token) return { status: 502 }
  await deps.deleteIntegration(userId) // la clé personnelle est supprimée
  await deps.saveStarter(userId, await encryptSecret(JSON.stringify(tokens), deps.secret), tokens.user_id)
  return { status: 200, userId }
}

/**
 * TODO(garmin) : forme exacte des notifications « activités » non vérifiée. Champs attendus (à confirmer) :
 * summaryId, activityId, activityType, startTimeInSeconds, startTimeOffsetInSeconds, durationInSeconds, distanceInMeters,
 * averageHeartRateInBeatsPerMinute, maxHeartRateInBeatsPerMinute, totalElevationGainInMeters.
 */
export function parseStarterActivity(payload: unknown): RunData & { externalId: string } {
  const o = (payload ?? {}) as Record<string, unknown>
  const num = (k: string) => (typeof o[k] === 'number' ? (o[k] as number) : undefined)
  const id = o.activityId ?? o.summaryId
  const start = num('startTimeInSeconds')
  if (id === undefined || start === undefined) throw new Error('Activité Garmin illisible.')
  const local = new Date((start + (num('startTimeOffsetInSeconds') ?? 0)) * 1000).toISOString().slice(0, 19)
  const km = Math.round(((num('distanceInMeters') ?? 0) / 1000) * 1000) / 1000
  const seconds = Math.round(num('durationInSeconds') ?? 0)
  return {
    externalId: `garmin:${id}`, startAt: local, km, seconds, avgPaceSec: km > 0 ? Math.round(seconds / km) : 0,
    avgHr: num('averageHeartRateInBeatsPerMinute'), maxHr: num('maxHeartRateInBeatsPerMinute'), elevationGain: num('totalElevationGainInMeters'),
    activityType: typeFromKey(typeof o.activityType === 'string' ? o.activityType : undefined) ?? 'autre',
  }
}

/** Réception des activités envoyées par Garmin (mode push) : contrôle de l'origine, puis écriture sans doublon. */
export async function handlePush(
  deps: Deps & { userByProviderId(providerUserId: string): Promise<string | null> }, cfg: StarterConfig, req: { token?: string; body: unknown },
): Promise<{ status: number; received: number }> {
  // TODO(garmin) : Garmin ne signe pas (à confirmer) : on protège l'adresse par un secret dans l'URL configurée chez Garmin.
  if (!req.token || req.token !== cfg.pushSecret) return { status: 401, received: 0 }
  const list = ((req.body as { activities?: unknown[] })?.activities ?? []) as Record<string, unknown>[]
  const runs: ImportedRun[] = []
  for (const a of list) {
    const userId = typeof a.userId === 'string' ? await deps.userByProviderId(a.userId) : null
    if (!userId) continue
    try {
      const d = parseStarterActivity(a)
      runs.push({ ...d, id: runIdOf(d.externalId), clientId: userId, source: 'garmin', externalId: d.externalId, status: isRunType(d.activityType) ? 'a_rattacher' : 'ignoree' })
    } catch { /* activité illisible : ignorée */ }
  }
  if (runs.length) await deps.insertRunsIfMissing(runs) // idempotent : un id déjà reçu n'est jamais réécrit
  return { status: 200, received: runs.length }
}

export const starterProvider = (deps: Deps, cfg: StarterConfig): RunProvider => ({
  id: 'garmin',
  connect: async (userId) => ({ redirectUrl: await buildAuthorizeUrl(cfg, userId) }),
  disconnect: async (userId) => { await deps.deleteIntegration(userId) },
  parseActivity: async (payload) => parseStarterActivity(payload),
})
