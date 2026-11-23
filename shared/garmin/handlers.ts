// Liaison et synchronisation de la clé personnelle Garmin. Toute la logique est ici, avec des dépendances injectées
// (base de données, réseau, horloge, secret) : l'Edge Function n'est qu'un mince branchement, et les tests tournent sans Garmin ni Supabase.
import { decryptSecret, encryptSecret } from './crypto.ts'
import { fetchActivity, fetchHealth, GarminError, isRetryLater, isUnauthorized, listActivities, requestToken, typeFromKey, type Fetch } from './personal.ts'
import { runIdOf } from './analysis.ts'
import { isRunType, type GarminLink, type HealthDay, type ImportedRun } from './types.ts'

/** Ligne de la table `integrations` (inaccessible à l'API publique) : clé et jeton sont chiffrés. */
export interface Integration {
  userId: string
  provider: 'garmin_personal'
  keyEnc: string
  tokenEnc?: string
  /** Fin de validité du jeton (ms). */
  tokenExp?: number
  /** Date d'expiration de la clé, AAAA-MM-JJ. */
  expiresAt: string
  lastSync?: string
  status: 'liee' | 'a_renouveler'
  /** Rappels déjà envoyés : 'j10', 'j2'. */
  notified: string[]
}

export interface Notif { id: string; title: string; body: string; link?: string }

export interface Deps {
  /** Utilisateur du jeton de session Supabase, ou null. */
  userFromJwt(jwt: string): Promise<{ id: string; role: 'coach' | 'client' } | null>
  getIntegration(userId: string): Promise<Integration | null>
  saveIntegration(i: Integration): Promise<void>
  deleteIntegration(userId: string): Promise<void>
  listIntegrations(): Promise<Integration[]>
  isAllowed(userId: string): Promise<boolean>
  setAllowed(userId: string, allowed: boolean): Promise<void>
  /** Écrit les activités qui n'existent pas encore (jamais d'écrasement : le client a pu les rattacher). */
  insertRunsIfMissing(runs: ImportedRun[]): Promise<void>
  existingRunIds(clientId: string, ids: string[]): Promise<Set<string>>
  upsertHealth(days: HealthDay[]): Promise<void>
  writeLink(link: GarminLink): Promise<void>
  coachIds(): Promise<string[]>
  firstName(userId: string): Promise<string>
  /** Dépose une notification dans l'app ; sans doublon pour un même id. */
  notify(userId: string, n: Notif): Promise<void>
  secret: string
  fetch: Fetch
  now(): number
}

const DAY = 86400000
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const addDays = (iso: string, n: number) => isoDay(Date.parse(iso + 'T00:00:00Z') + n * DAY)
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY)
export const VALID_DURATIONS = [30, 90, 180, 365]
export const FIRST_SYNC_DAYS = 14
export const OPEN_SYNC_MIN_GAP_MS = 5 * 60 * 1000
const TOKEN_REUSE_MARGIN_MS = 60 * 60 * 1000

export interface Reply { status: number; body: Record<string, unknown> }
const reply = (status: number, error?: string, message?: string, extra: Record<string, unknown> = {}): Reply => ({ status, body: error ? { error, message, ...extra } : { ok: true, ...extra } })

const linkOf = (clientId: string, allowed: boolean, state: GarminLink['state'], i?: Integration, message?: string): GarminLink => ({
  id: clientId, clientId, allowed, state, expiresAt: i?.expiresAt, lastSyncAt: i?.lastSync, message,
})

// ------------------------------------------------------------------ liaison

export type LinkRequest =
  | { action: 'link'; apiKey: string; durationDays?: number }
  | { action: 'unlink' }
  | { action: 'allow'; clientId: string; allowed: boolean }

export async function handleLink(deps: Deps, jwt: string | undefined, req: LinkRequest): Promise<Reply> {
  const user = jwt ? await deps.userFromJwt(jwt) : null
  if (!user) return reply(401, 'unauthorized', 'Connecte-toi pour continuer.')

  if (req.action === 'allow') {
    if (user.role !== 'coach') return reply(403, 'forbidden', 'Seul le coach peut autoriser la liaison.')
    await deps.setAllowed(req.clientId, !!req.allowed)
    const i = await deps.getIntegration(req.clientId)
    await deps.writeLink(linkOf(req.clientId, !!req.allowed, i ? (i.status === 'liee' ? 'liee' : 'a_renouveler') : 'non_liee', i ?? undefined))
    return reply(200)
  }

  const allowed = user.role === 'coach' || (await deps.isAllowed(user.id))

  if (req.action === 'unlink') {
    await deps.deleteIntegration(user.id) // la clé disparaît du serveur
    await deps.writeLink(linkOf(user.id, allowed, 'non_liee'))
    return reply(200)
  }

  if (!allowed) return reply(403, 'not_allowed', 'Ton coach n\'a pas encore activé la liaison Garmin pour ton compte.')
  const apiKey = typeof req.apiKey === 'string' ? req.apiKey.trim() : ''
  if (apiKey.length < 8 || apiKey.length > 512 || /\s/.test(apiKey)) return reply(400, 'invalid_key', 'Cette clé ne ressemble pas à une clé Garmin. Copie-la en entier, sans espace.')
  const days = VALID_DURATIONS.includes(Number(req.durationDays)) ? Number(req.durationDays) : 365

  let token
  try { token = await requestToken(apiKey, deps.fetch, deps.now()) } catch (e) {
    if (isUnauthorized(e) || (e instanceof GarminError && e.status >= 400 && e.status < 500 && e.status !== 429)) return reply(400, 'invalid_key', 'Garmin refuse cette clé. Vérifie qu\'elle est complète, qu\'elle n\'a pas expiré et que c\'est bien la dernière créée.')
    return reply(503, 'garmin_unavailable', 'Garmin ne répond pas pour le moment. Réessaie dans quelques minutes.')
  }

  const now = deps.now()
  const integration: Integration = {
    userId: user.id, provider: 'garmin_personal', keyEnc: await encryptSecret(apiKey, deps.secret),
    tokenEnc: await encryptSecret(token.token, deps.secret), tokenExp: token.expiresAt,
    expiresAt: addDays(isoDay(now), days), status: 'liee', notified: [],
  }
  await deps.saveIntegration(integration)
  await deps.writeLink(linkOf(user.id, allowed, 'liee', integration))
  const res = await syncUser(deps, integration) // première synchro tout de suite
  return reply(200, undefined, undefined, { expiresAt: integration.expiresAt, state: res.state, imported: res.imported })
}

// ------------------------------------------------------------------ synchronisation

export interface SyncResult { state: 'liee' | 'a_renouveler' | 'reessai' | 'ignoree'; imported: number; health: number }

async function renew(deps: Deps, i: Integration, why: string): Promise<SyncResult> {
  const next: Integration = { ...i, status: 'a_renouveler', tokenEnc: undefined, tokenExp: undefined }
  await deps.saveIntegration(next)
  const allowed = await deps.isAllowed(i.userId)
  await deps.writeLink(linkOf(i.userId, allowed, 'a_renouveler', next, why))
  const name = await deps.firstName(i.userId)
  await deps.notify(i.userId, { id: `n-garmin-renew-${i.userId}-${i.expiresAt}`, title: 'Ta clé Garmin est à renouveler', body: `${why} Crée-en une nouvelle dans Garmin Connect et colle-la dans MIND (Profil → Montre).`, link: '/app/profile' })
  for (const c of await deps.coachIds()) if (c !== i.userId) await deps.notify(c, { id: `n-garmin-renew-${i.userId}-${i.expiresAt}-${c}`, title: 'Clé Garmin à renouveler', body: `${name} doit renouveler sa clé Garmin : la synchro est arrêtée.`, link: `/coach/client/${i.userId}` })
  return { state: 'a_renouveler', imported: 0, health: 0 }
}

async function remind(deps: Deps, i: Integration, today: string): Promise<Integration> {
  const left = daysBetween(today, i.expiresAt)
  const due = left <= 2 ? 'j2' : left <= 10 ? 'j10' : undefined
  if (!due || i.notified.includes(due)) return i
  const date = i.expiresAt.split('-').reverse().join('/')
  const name = await deps.firstName(i.userId)
  await deps.notify(i.userId, { id: `n-garmin-${due}-${i.userId}-${i.expiresAt}`, title: 'Ta clé Garmin va expirer', body: `Ta clé Garmin expire le ${date} : crée-en une nouvelle et colle-la ici.`, link: '/app/profile' })
  for (const c of await deps.coachIds()) if (c !== i.userId) await deps.notify(c, { id: `n-garmin-${due}-${i.userId}-${i.expiresAt}-${c}`, title: 'Clé Garmin bientôt expirée', body: `La clé Garmin de ${name} expire le ${date}.`, link: `/coach/client/${i.userId}` })
  const next = { ...i, notified: [...new Set([...i.notified, due, ...(due === 'j2' ? ['j10'] : [])])] }
  await deps.saveIntegration(next)
  return next
}

/** Un tour de synchro pour un compte. Appels séquentiels ; `429` ou erreur serveur : on s'arrête et on réessaie au tour suivant (sans boucle). */
export async function syncUser(deps: Deps, integration: Integration): Promise<SyncResult> {
  let i = integration
  if (i.status === 'a_renouveler') return { state: 'a_renouveler', imported: 0, health: 0 }
  const now = deps.now()
  const today = isoDay(now)
  if (i.expiresAt < today) return renew(deps, i, 'Ta clé Garmin a expiré.')
  i = await remind(deps, i, today)

  const apiKey = await decryptSecret(i.keyEnc, deps.secret)
  const freshToken = async (): Promise<string | 'renew' | 'later'> => {
    try {
      const t = await requestToken(apiKey, deps.fetch, deps.now())
      i = { ...i, tokenEnc: await encryptSecret(t.token, deps.secret), tokenExp: t.expiresAt }
      await deps.saveIntegration(i)
      return t.token
    } catch (e) { return isUnauthorized(e) ? 'renew' : 'later' }
  }
  let token: string
  if (i.tokenEnc && (i.tokenExp ?? 0) > now + TOKEN_REUSE_MARGIN_MS) token = await decryptSecret(i.tokenEnc, deps.secret)
  else {
    const t = await freshToken()
    if (t === 'renew') return renew(deps, i, 'Garmin a refusé ta clé (expirée ou remplacée).')
    if (t === 'later') return { state: 'reessai', imported: 0, health: 0 }
    token = t
  }

  /** Appel avec un seul nouvel essai de jeton sur 401 ; jamais d'autre nouvelle tentative. */
  let renewed = false
  const guard = async <T>(fn: (tk: string) => Promise<T>): Promise<{ ok: true; v: T } | { ok: false; res: SyncResult }> => {
    try { return { ok: true, v: await fn(token) } } catch (e) {
      if (isUnauthorized(e) && !renewed) {
        renewed = true
        const t = await freshToken()
        if (t === 'renew') return { ok: false, res: await renew(deps, i, 'Garmin a refusé ta clé (expirée ou remplacée).') }
        if (t === 'later') return { ok: false, res: { state: 'reessai', imported: 0, health: 0 } }
        token = t
        return guard(fn)
      }
      if (isUnauthorized(e)) return { ok: false, res: await renew(deps, i, 'Garmin a refusé ta clé (expirée ou remplacée).') }
      if (isRetryLater(e)) return { ok: false, res: { state: 'reessai', imported: 0, health: 0 } }
      throw e
    }
  }

  const startDate = i.lastSync ? addDays(i.lastSync.slice(0, 10), -1) : addDays(today, -FIRST_SYNC_DAYS)
  const range = { startDate, endDate: today }
  let imported = 0, health = 0
  const allowed = await deps.isAllowed(i.userId)

  const list = await guard((tk) => listActivities(tk, deps.fetch, range))
  if (!list.ok) return list.res
  const wanted = list.v.filter((a) => { const t = typeFromKey(a.typeKey); return t === undefined || isRunType(t) }) // type connu et pas de la course : on ne télécharge rien
  const known = await deps.existingRunIds(i.userId, wanted.map((a) => runIdOf(`garmin:${a.id}`)))
  for (const ref of wanted) {
    if (known.has(runIdOf(`garmin:${ref.id}`))) continue // déjà reçue : on ne retélécharge pas
    const got = await guard((tk) => fetchActivity(tk, deps.fetch, ref))
    if (!got.ok) return got.res
    const d = got.v
    const run: ImportedRun = {
      ...d, id: runIdOf(d.externalId), clientId: i.userId, source: 'garmin', externalId: d.externalId,
      status: isRunType(d.activityType) ? 'a_rattacher' : 'ignoree', note: isRunType(d.activityType) ? undefined : 'Ce n\'est pas une course à pied.',
    }
    await deps.insertRunsIfMissing([run])
    imported++
  }

  // santé du jour : un échec ici (point d'accès non vérifié) ne bloque pas les courses
  let message: string | undefined
  try {
    const h = await guard((tk) => fetchHealth(tk, deps.fetch, i.userId, range))
    if (!h.ok) { if (h.res.state === 'a_renouveler') return h.res; message = 'Pas et sommeil momentanément indisponibles.' } else { await deps.upsertHealth(h.v); health = h.v.length }
  } catch { message = 'Pas et sommeil momentanément indisponibles.' }

  i = { ...i, lastSync: new Date(now).toISOString(), status: 'liee' }
  await deps.saveIntegration(i)
  await deps.writeLink(linkOf(i.userId, allowed, 'liee', i, message))
  return { state: 'liee', imported, health }
}

/** Tâche planifiée (toutes les 30 minutes) : tous les comptes liés, l'un après l'autre. Une erreur sur un compte ne bloque pas les autres. */
export async function syncAll(deps: Deps): Promise<{ users: number; imported: number; failed: number }> {
  const all = (await deps.listIntegrations()).filter((x) => x.status === 'liee')
  let imported = 0, failed = 0
  for (const i of all) {
    try { imported += (await syncUser(deps, i)).imported } catch { failed++ }
  }
  return { users: all.length, imported, failed }
}

/** Synchro demandée par le client : bouton « Synchroniser » (toujours) ou ouverture de l'app (au plus une fois toutes les 5 minutes). */
export async function handleSync(deps: Deps, jwt: string | undefined, reason: 'open' | 'manual' = 'manual'): Promise<Reply> {
  const user = jwt ? await deps.userFromJwt(jwt) : null
  if (!user) return reply(401, 'unauthorized', 'Connecte-toi pour continuer.')
  const i = await deps.getIntegration(user.id)
  if (!i) return reply(404, 'not_linked', 'Aucune montre liée.')
  if (reason === 'open' && i.lastSync && deps.now() - Date.parse(i.lastSync) < OPEN_SYNC_MIN_GAP_MS) return reply(200, undefined, undefined, { skipped: true })
  const res = await syncUser(deps, i)
  return reply(200, undefined, undefined, { ...res })
}
