// Adaptateur « clé API personnelle » Garmin (tier Personal) : lecture seule, en mode pull. Réseau injecté : testable sans Garmin.
//
// VÉRIFIÉ (client officiel github.com/garmin/connect-personal-api-python + pages developer.garmin.com, 2026-11-23) :
//   - base `https://personal.connectapi.garmin.com` ;
//   - jeton : POST /personalapitoken-service/personal-api/personal-api-key/token, en-tête `Authorization: ApiKey <clé>`,
//     réponse = le jeton brut (texte, pas du JSON), valable 24 h, pas de jeton de rafraîchissement ;
//   - appels de données : en-tête `Authorization: Bearer <jeton>` ;
//   - liste d'activités : GET /activitylist-service/activities/search/activities?start&limit&startDate&endDate (dates AAAA-MM-JJ) ;
//   - fichier de l'activité : GET /download-service/files/activity/{id} → ZIP contenant le .fit original ;
//   - pas : GET /usersummary-service/stats/steps/daily/{début}/{fin} ;
//   - sommeil : GET /sleep-service/sleep/dailySleepSummariesByDate?startDate&endDate.
// NON VÉRIFIÉ : les NOMS DE CHAMPS des réponses JSON (liste d'activités, pas, sommeil) et les limites d'appels ne sont pas publiés.
//   Les lecteurs ci-dessous sont donc tolérants (plusieurs noms plausibles) : chaque endroit est marqué TODO(garmin) et
//   le détail d'une activité vient du .fit (format normalisé), pas du JSON.
import { parseFitFile } from './fit.ts'
import type { ActivityType, HealthDay, RunData } from './types.ts'

export const BASE_URL = 'https://personal.connectapi.garmin.com'
export const TOKEN_PATH = '/personalapitoken-service/personal-api/personal-api-key/token'

export type Fetch = (url: string, init?: { method?: string; headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; text(): Promise<string>; json(): Promise<unknown>; arrayBuffer(): Promise<ArrayBuffer> }>

/** Erreur d'appel Garmin ; `status` 0 = réseau. */
export class GarminError extends Error {
  constructor(public status: number, message?: string) { super(message ?? `Garmin ${status}`) }
}
/** Arrêt « poli » : 429 ou erreur serveur. On réessaie au prochain tour, jamais en boucle. */
export const isRetryLater = (e: unknown): boolean => e instanceof GarminError && (e.status === 429 || e.status >= 500 || e.status === 0)
export const isUnauthorized = (e: unknown): boolean => e instanceof GarminError && e.status === 401

export interface Token { token: string; expiresAt: number }

/** Date d'expiration (secondes epoch) lue dans le JWT (sans vérifier la signature : c'est Garmin qui l'a émis, on ne s'en sert que pour la durée). */
export function jwtExp(jwt: string): number | undefined {
  try {
    const payload = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const exp = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '='))).exp
    return typeof exp === 'number' ? exp : undefined
  } catch { return undefined }
}

export async function requestToken(apiKey: string, fetcher: Fetch, now = Date.now()): Promise<Token> {
  let res
  try { res = await fetcher(BASE_URL + TOKEN_PATH, { method: 'POST', headers: { Accept: '*/*', Authorization: `ApiKey ${apiKey}` } }) } catch { throw new GarminError(0, 'Garmin injoignable') }
  if (!res.ok) throw new GarminError(res.status)
  const token = (await res.text()).trim()
  if (!token) throw new GarminError(502, 'Jeton vide')
  return { token, expiresAt: (jwtExp(token) ?? Math.floor(now / 1000) + 24 * 3600) * 1000 }
}

async function call(fetcher: Fetch, token: string, path: string, accept = 'application/json') {
  let res
  try { res = await fetcher(BASE_URL + path, { headers: { Authorization: `Bearer ${token}`, Accept: accept } }) } catch { throw new GarminError(0, 'Garmin injoignable') }
  if (!res.ok) throw new GarminError(res.status)
  return res
}

// ------------------------------------------------------------------ activités

export interface ActivityRef {
  /** Identifiant d'activité Garmin. */
  id: string
  /** Type tel que Garmin le donne, s'il est connu (sinon on le lit dans le .fit). */
  typeKey?: string
  /** Début local `YYYY-MM-DDTHH:MM:SS`, s'il est connu. */
  startLocal?: string
}

const pick = (o: Record<string, unknown>, keys: string[]): unknown => { for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k]; return undefined }

/** TODO(garmin) : noms de champs non publiés. On essaie `activityId`/`id`, `activityType.typeKey`/`activityType`, `startTimeLocal`. */
export function parseActivityList(json: unknown): ActivityRef[] {
  const list = Array.isArray(json) ? json : Array.isArray((json as { activities?: unknown })?.activities) ? (json as { activities: unknown[] }).activities : []
  const out: ActivityRef[] = []
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue
    const o = raw as Record<string, unknown>
    const id = pick(o, ['activityId', 'id', 'summaryId'])
    if (id === undefined) continue
    const t = pick(o, ['activityType', 'type'])
    const typeKey = typeof t === 'string' ? t : t && typeof t === 'object' ? (pick(t as Record<string, unknown>, ['typeKey', 'key', 'name']) as string | undefined) : undefined
    const st = pick(o, ['startTimeLocal', 'startLocal'])
    out.push({ id: String(id), typeKey, startLocal: typeof st === 'string' ? st.replace(' ', 'T').slice(0, 19) : undefined })
  }
  return out
}

/** `typeKey` Garmin → type MIND (course à pied seulement ; le reste est ignoré par le rattachement). */
export function typeFromKey(key?: string): ActivityType | undefined {
  if (!key) return undefined
  const k = key.toLowerCase()
  if (k.includes('treadmill')) return 'tapis'
  if (k.includes('trail')) return 'trail'
  if (k.includes('track')) return 'piste'
  if (k.includes('run')) return 'route'
  if (k.includes('cycl') || k.includes('bik')) return 'velo'
  if (k.includes('walk') || k.includes('hik')) return 'marche'
  if (k.includes('strength')) return 'muscu'
  return 'autre'
}

export async function listActivities(token: string, fetcher: Fetch, range: { startDate: string; endDate: string }, pageSize = 20, maxPages = 5): Promise<ActivityRef[]> {
  const all: ActivityRef[] = []
  for (let page = 0; page < maxPages; page++) { // séquentiel, jamais en parallèle
    const qs = new URLSearchParams({ start: String(page * pageSize), limit: String(pageSize), startDate: range.startDate, endDate: range.endDate })
    const list = parseActivityList(await (await call(fetcher, token, `/activitylist-service/activities/search/activities?${qs}`)).json())
    all.push(...list)
    if (list.length < pageSize) break
  }
  return all
}

/** Télécharge le fichier original (ZIP) de l'activité et le lit : tours, km par km, FC. */
export async function fetchActivity(token: string, fetcher: Fetch, ref: ActivityRef): Promise<RunData & { externalId: string }> {
  const res = await call(fetcher, token, `/download-service/files/activity/${encodeURIComponent(ref.id)}`, 'application/zip, application/x-zip-compressed, application/octet-stream')
  const bytes = new Uint8Array(await res.arrayBuffer())
  const data = await parseFitFile(bytes, `${ref.id}.zip`, { localStartAt: ref.startLocal })
  const t = typeFromKey(ref.typeKey)
  return { ...data, activityType: t ?? data.activityType, externalId: `garmin:${ref.id}` }
}

// ------------------------------------------------------------------ santé du jour

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const dateOf = (v: unknown): string | undefined => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : undefined)
const minutes = (sec: number | undefined) => (sec === undefined ? undefined : Math.round(sec / 60))

/** TODO(garmin) : noms de champs non publiés. Pas : `calendarDate` + `totalSteps`/`steps`. */
export function parseSteps(json: unknown): { date: string; steps: number }[] {
  const list = Array.isArray(json) ? json : []
  const out: { date: string; steps: number }[] = []
  for (const raw of list) {
    const o = (raw ?? {}) as Record<string, unknown>
    const date = dateOf(pick(o, ['calendarDate', 'date', 'startGMT']))
    const steps = num(pick(o, ['totalSteps', 'steps']))
    if (date && steps !== undefined) out.push({ date, steps })
  }
  return out
}

/** TODO(garmin) : noms de champs non publiés. Sommeil : `calendarDate`, `sleepTimeSeconds`, `deepSleepSeconds`… `sleepScores.overall.value`. */
export function parseSleep(json: unknown): Pick<HealthDay, 'date' | 'sleepMinutes' | 'sleepScore' | 'sleepPhases'>[] {
  const list = Array.isArray(json) ? json : Array.isArray((json as { dailySleepDTOs?: unknown })?.dailySleepDTOs) ? (json as { dailySleepDTOs: unknown[] }).dailySleepDTOs : []
  const out: Pick<HealthDay, 'date' | 'sleepMinutes' | 'sleepScore' | 'sleepPhases'>[] = []
  for (const raw of list) {
    const o = (raw ?? {}) as Record<string, unknown>
    const date = dateOf(pick(o, ['calendarDate', 'date']))
    const total = num(pick(o, ['sleepTimeSeconds', 'totalSleepSeconds', 'durationInSeconds']))
    if (!date || total === undefined) continue
    const scores = o.sleepScores as { overall?: { value?: unknown } } | undefined
    const phases = { deepMin: minutes(num(o.deepSleepSeconds)), lightMin: minutes(num(o.lightSleepSeconds)), remMin: minutes(num(o.remSleepSeconds)), awakeMin: minutes(num(o.awakeSleepSeconds)) }
    out.push({
      date, sleepMinutes: minutes(total), sleepScore: num(scores?.overall?.value ?? o.sleepScore),
      sleepPhases: Object.values(phases).some((v) => v !== undefined) ? phases : undefined,
    })
  }
  return out
}

export async function fetchHealth(token: string, fetcher: Fetch, clientId: string, range: { startDate: string; endDate: string }): Promise<HealthDay[]> {
  const steps = parseSteps(await (await call(fetcher, token, `/usersummary-service/stats/steps/daily/${range.startDate}/${range.endDate}`)).json())
  const sleep = parseSleep(await (await call(fetcher, token, `/sleep-service/sleep/dailySleepSummariesByDate?${new URLSearchParams(range)}`)).json())
  const byDate = new Map<string, HealthDay>()
  const get = (date: string) => byDate.get(date) ?? (byDate.set(date, { id: `${clientId}-${date}`, clientId, date }), byDate.get(date)!)
  for (const s of steps) get(s.date).steps = s.steps
  for (const s of sleep) Object.assign(get(s.date), { sleepMinutes: s.sleepMinutes, sleepScore: s.sleepScore, sleepPhases: s.sleepPhases })
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}
