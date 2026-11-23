// Clé personnelle Garmin : chiffrement, liaison, synchro incrémentale, rappels, 401, 429 — avec des réponses Garmin simulées.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { decryptSecret, encryptSecret } from './crypto'
import { FIRST_SYNC_DAYS, handleLink, handleSync, syncAll, syncUser, type Deps, type Integration, type Notif } from './handlers'
import { BASE_URL, TOKEN_PATH, jwtExp, parseActivityList, parseSleep, parseSteps, typeFromKey, type Fetch } from './personal'
import type { GarminLink, HealthDay, ImportedRun } from './types'
import { stripWatchData } from './ai-filter'

const ZIP = new Uint8Array(readFileSync(new URL('../../scripts/fixtures/sortie-5km.zip', import.meta.url)))
const SECRET = btoa(String.fromCharCode(...new Uint8Array(32).map((_, i) => i + 1)))
const KEY = 'GARMIN-PERSONAL-KEY-ABCDEF123456'
const NOW = Date.parse('2026-11-23T10:00:00Z')

const b64url = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
const jwt = (expSec: number) => `${b64url({ alg: 'none' })}.${b64url({ exp: expSec })}.sig`

// ---------------------------------------------------------------- faux Garmin

interface Garmin {
  calls: { method: string; url: string; auth?: string }[]
  tokenStatus: number
  dataStatus: number | ((url: string) => number)
  validKey: string
  activities: { activityId: number; activityType: { typeKey: string }; startTimeLocal: string }[]
  fetch: Fetch
  tokens: number
}
function fakeGarmin(): Garmin {
  const g: Garmin = {
    calls: [], tokenStatus: 200, dataStatus: 200, validKey: KEY, tokens: 0,
    activities: [{ activityId: 12345678901, activityType: { typeKey: 'running' }, startTimeLocal: '2026-11-22 08:30:00' }],
    fetch: async (url, init) => {
      const auth = init?.headers?.Authorization
      g.calls.push({ method: init?.method ?? 'GET', url: url.replace(BASE_URL, ''), auth })
      const res = (status: number, body: unknown, bin?: Uint8Array) => ({
        ok: status >= 200 && status < 300, status,
        text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
        json: async () => body,
        arrayBuffer: async () => (bin ?? new Uint8Array()).slice().buffer as ArrayBuffer,
      })
      const path = url.replace(BASE_URL, '')
      if (path === TOKEN_PATH) {
        if (g.tokenStatus !== 200) return res(g.tokenStatus, '')
        if (auth !== `ApiKey ${g.validKey}`) return res(401, '')
        g.tokens++
        return res(200, jwt(Math.floor(NOW / 1000) + 24 * 3600 + g.tokens))
      }
      if (!auth?.startsWith('Bearer ')) return res(401, '')
      const st = typeof g.dataStatus === 'function' ? g.dataStatus(path) : g.dataStatus
      if (st !== 200) return res(st, '')
      if (path.startsWith('/activitylist-service/activities/search/activities')) return res(200, g.activities)
      if (path.startsWith('/download-service/files/activity/')) return res(200, '', ZIP)
      if (path.startsWith('/usersummary-service/stats/steps/daily/')) return res(200, [{ calendarDate: '2026-11-22', totalSteps: 8412 }, { calendarDate: '2026-11-23', totalSteps: 1200 }])
      if (path.startsWith('/sleep-service/sleep/dailySleepSummariesByDate')) return res(200, [{ calendarDate: '2026-11-23', sleepTimeSeconds: 25500, deepSleepSeconds: 5400, lightSleepSeconds: 14400, remSleepSeconds: 5700, sleepScores: { overall: { value: 81 } } }])
      return res(404, '')
    },
  }
  return g
}

// ---------------------------------------------------------------- fausse base

interface Mem {
  integrations: Map<string, Integration>
  allowed: Map<string, boolean>
  runs: Map<string, ImportedRun>
  health: Map<string, HealthDay>
  links: Map<string, GarminLink>
  notifs: { userId: string; n: Notif }[]
}
function fakeDeps(g: Garmin, role: 'coach' | 'client' = 'client', now = () => NOW) {
  const mem: Mem = { integrations: new Map(), allowed: new Map(), runs: new Map(), health: new Map(), links: new Map(), notifs: [] }
  const deps: Deps = {
    userFromJwt: async (j) => (j === 'jwt-user' ? { id: 'u1', role } : j === 'jwt-coach' ? { id: 'coach', role: 'coach' } : null),
    getIntegration: async (id) => mem.integrations.get(id) ?? null,
    saveIntegration: async (i) => { mem.integrations.set(i.userId, structuredClone(i)) },
    deleteIntegration: async (id) => { mem.integrations.delete(id) },
    listIntegrations: async () => [...mem.integrations.values()].map((x) => structuredClone(x)),
    isAllowed: async (id) => mem.allowed.get(id) ?? false,
    setAllowed: async (id, a) => { mem.allowed.set(id, a) },
    insertRunsIfMissing: async (runs) => { for (const r of runs) if (!mem.runs.has(r.id)) mem.runs.set(r.id, structuredClone(r)) },
    existingRunIds: async (_c, ids) => new Set(ids.filter((id) => mem.runs.has(id))),
    upsertHealth: async (days) => { for (const d of days) mem.health.set(d.id, d) },
    writeLink: async (l) => { mem.links.set(l.clientId, l) },
    coachIds: async () => ['coach'],
    firstName: async (id) => (id === 'u1' ? 'Léa' : 'Max'),
    notify: async (userId, n) => { if (!mem.notifs.some((x) => x.userId === userId && x.n.id === n.id)) mem.notifs.push({ userId, n }) },
    secret: SECRET, fetch: g.fetch, now,
  }
  return { deps, mem }
}
const link = (deps: Deps, key = KEY, days?: number) => handleLink(deps, 'jwt-user', { action: 'link', apiKey: key, durationDays: days })
const listCalls = (g: Garmin) => g.calls.filter((c) => c.url.startsWith('/activitylist-service'))
const qs = (url: string, k: string) => new URL('http://x' + url).searchParams.get(k)

describe('chiffrement de la clé', () => {
  it('chiffre puis déchiffre, avec un IV différent à chaque fois', async () => {
    const a = await encryptSecret(KEY, SECRET), b = await encryptSecret(KEY, SECRET)
    expect(a).not.toBe(b)
    expect(a).not.toContain(KEY)
    expect(await decryptSecret(a, SECRET)).toBe(KEY)
    expect(await decryptSecret(b, SECRET)).toBe(KEY)
  })
  it('refuse un mauvais secret, une valeur altérée ou un secret de mauvaise taille', async () => {
    const a = await encryptSecret(KEY, SECRET)
    const other = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)))
    await expect(decryptSecret(a, other)).rejects.toBeDefined()
    const [v, iv, ct] = a.split('.')
    await expect(decryptSecret(`${v}.${iv}.${ct.slice(0, -4)}AAAA`, SECRET)).rejects.toBeDefined()
    await expect(decryptSecret('nimportequoi', SECRET)).rejects.toBeDefined()
    await expect(encryptSecret(KEY, btoa('trop court'))).rejects.toThrow(/32 octets/)
  })
})

describe('liaison', () => {
  it('clé invalide refusée, rien n\'est enregistré', async () => {
    const g = fakeGarmin()
    const { deps, mem } = fakeDeps(g)
    mem.allowed.set('u1', true)
    const r = await link(deps, 'MAUVAISE-CLE-123456')
    expect(r.status).toBe(400)
    expect(r.body.error).toBe('invalid_key')
    expect(mem.integrations.size).toBe(0)
    expect(mem.links.size).toBe(0)
    expect((await link(deps, 'x y')).body.error).toBe('invalid_key')
    expect((await link(deps, 'court')).status).toBe(400)
  })

  it('client non autorisé par le coach : refusé, Garmin n\'est même pas appelé', async () => {
    const g = fakeGarmin()
    const { deps, mem } = fakeDeps(g)
    const r = await link(deps)
    expect(r.status).toBe(403)
    expect(r.body.error).toBe('not_allowed')
    expect(g.calls).toHaveLength(0)
    expect(mem.integrations.size).toBe(0)
  })

  it('non connecté : 401', async () => {
    const { deps } = fakeDeps(fakeGarmin())
    expect((await handleLink(deps, undefined, { action: 'link', apiKey: KEY })).status).toBe(401)
    expect((await handleLink(deps, 'jwt-inconnu', { action: 'link', apiKey: KEY })).status).toBe(401)
  })

  it('le coach autorise un client ; un client ne peut pas s\'autoriser lui-même', async () => {
    const { deps, mem } = fakeDeps(fakeGarmin())
    const self = await handleLink(deps, 'jwt-user', { action: 'allow', clientId: 'u1', allowed: true })
    expect(self.status).toBe(403)
    expect(mem.allowed.get('u1')).toBeUndefined()
    expect((await handleLink(deps, 'jwt-coach', { action: 'allow', clientId: 'u1', allowed: true })).status).toBe(200)
    expect(mem.allowed.get('u1')).toBe(true)
    expect(mem.links.get('u1')).toMatchObject({ allowed: true, state: 'non_liee' })
    expect((await link(deps)).status).toBe(200)
  })

  it('le compte coach y a toujours droit', async () => {
    const g = fakeGarmin()
    const { deps } = fakeDeps(g, 'coach')
    expect((await link(deps)).status).toBe(200)
  })

  it('clé valide : chiffrée, jamais en clair, statut sans secret, expiration calculée, première synchro tout de suite', async () => {
    const g = fakeGarmin()
    const { deps, mem } = fakeDeps(g)
    mem.allowed.set('u1', true)
    const r = await link(deps, KEY, 365)
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ expiresAt: '2027-11-23', state: 'liee', imported: 1 })
    const i = mem.integrations.get('u1')!
    expect(i.keyEnc).not.toContain(KEY)
    expect(await decryptSecret(i.keyEnc, SECRET)).toBe(KEY)
    expect(i.tokenEnc).toBeDefined()
    // aucune trace de la clé dans le statut, les activités, la santé ni la réponse
    const everything = JSON.stringify([...mem.links.values(), [...mem.runs.values()], [...mem.health.values()], r.body, mem.notifs])
    expect(everything).not.toContain(KEY)
    expect(mem.links.get('u1')).toMatchObject({ state: 'liee', expiresAt: '2027-11-23', allowed: true })
    expect(Object.keys(mem.links.get('u1')!)).not.toContain('keyEnc')
    // durée choisie : 30, 90, 180 jours ; valeur absurde → 1 an
    mem.integrations.clear()
    await link(deps, KEY, 90)
    expect(mem.integrations.get('u1')!.expiresAt).toBe('2027-02-21')
    mem.integrations.clear()
    await link(deps, KEY, 7)
    expect(mem.integrations.get('u1')!.expiresAt).toBe('2027-11-23')
  })

  it('délier : la clé disparaît du serveur', async () => {
    const g = fakeGarmin()
    const { deps, mem } = fakeDeps(g)
    mem.allowed.set('u1', true)
    await link(deps)
    expect((await handleLink(deps, 'jwt-user', { action: 'unlink' })).status).toBe(200)
    expect(mem.integrations.size).toBe(0)
    expect(mem.links.get('u1')!.state).toBe('non_liee')
  })

  it('Garmin en panne pendant la liaison : message clair, rien d\'enregistré', async () => {
    const g = fakeGarmin(); g.tokenStatus = 503
    const { deps, mem } = fakeDeps(g)
    mem.allowed.set('u1', true)
    const r = await link(deps)
    expect(r.status).toBe(503)
    expect(mem.integrations.size).toBe(0)
  })
})

describe('synchronisation', () => {
  const linked = async (g: Garmin, now = () => NOW) => {
    const env = fakeDeps(g, 'client', now)
    env.mem.allowed.set('u1', true)
    await link(env.deps)
    return env
  }

  it('première synchro : 14 derniers jours, activité complète (tours, km par km, FC), jeton demandé avec « ApiKey », données avec « Bearer »', async () => {
    const g = fakeGarmin()
    const { mem } = await linked(g)
    const list = listCalls(g)[0]
    expect(qs(list.url, 'startDate')).toBe('2026-11-09')
    expect(qs(list.url, 'endDate')).toBe('2026-11-23')
    expect(FIRST_SYNC_DAYS).toBe(14)
    const tok = g.calls.find((c) => c.url === TOKEN_PATH)!
    expect(tok).toMatchObject({ method: 'POST', auth: `ApiKey ${KEY}` })
    expect(list.auth!.startsWith('Bearer ')).toBe(true)
    const run = [...mem.runs.values()][0]
    expect(run).toMatchObject({
      id: 'ir-garmin-12345678901', clientId: 'u1', source: 'garmin', externalId: 'garmin:12345678901', status: 'a_rattacher', activityType: 'route', km: 5, seconds: 1630, startAt: '2026-11-22T08:30:00', avgHr: 150,
    })
    expect(run.laps).toHaveLength(5)
    expect(run.splits).toHaveLength(5)
    expect(run.hrSeries!.length).toBeGreaterThan(100)
  })

  it('santé du jour : pas et sommeil', async () => {
    const g = fakeGarmin()
    const { mem } = await linked(g)
    expect(mem.health.get('u1-2026-11-22')).toMatchObject({ steps: 8412, clientId: 'u1' })
    expect(mem.health.get('u1-2026-11-23')).toMatchObject({ steps: 1200, sleepMinutes: 425, sleepScore: 81, sleepPhases: { deepMin: 90, lightMin: 240, remMin: 95 } })
  })

  it('synchro incrémentale : depuis la dernière synchro, sans doublon, sans retélécharger', async () => {
    const g = fakeGarmin()
    let t = NOW
    const { deps, mem } = await linked(g, () => t)
    t += 30 * 60 * 1000
    g.activities.push({ activityId: 777, activityType: { typeKey: 'running' }, startTimeLocal: '2026-11-23 07:00:00' })
    g.calls.length = 0
    const r = await syncUser(deps, mem.integrations.get('u1')!)
    expect(r).toMatchObject({ state: 'liee', imported: 1 })
    expect(qs(listCalls(g)[0].url, 'startDate')).toBe('2026-11-22') // veille de la dernière synchro
    expect(g.calls.filter((c) => c.url.startsWith('/download-service'))).toHaveLength(1) // seulement la nouvelle
    expect(g.calls.filter((c) => c.url.includes('/12345678901'))).toHaveLength(0)
    expect(mem.runs.size).toBe(2)
    // relancer : rien de nouveau
    t += 30 * 60 * 1000
    g.calls.length = 0
    expect((await syncUser(deps, mem.integrations.get('u1')!)).imported).toBe(0)
    expect(mem.runs.size).toBe(2)
    expect(g.calls.filter((c) => c.url.startsWith('/download-service'))).toHaveLength(0)
  })

  it('une activité déjà rattachée par le client n\'est jamais écrasée', async () => {
    const g = fakeGarmin()
    const { deps, mem } = await linked(g)
    const r = mem.runs.get('ir-garmin-12345678901')!
    r.status = 'rattachee'; r.matchedSessionId = 's1'
    await deps.insertRunsIfMissing([{ ...r, status: 'a_rattacher', matchedSessionId: undefined }])
    expect(mem.runs.get('ir-garmin-12345678901')).toMatchObject({ status: 'rattachee', matchedSessionId: 's1' })
  })

  it('vélo : pas téléchargé, pas écrit ; type inconnu : lu dans le .fit', async () => {
    const g = fakeGarmin()
    g.activities = [
      { activityId: 1, activityType: { typeKey: 'cycling' }, startTimeLocal: '2026-11-22 10:00:00' },
      { activityId: 2, activityType: { typeKey: 'lap_swimming' }, startTimeLocal: '2026-11-22 11:00:00' },
      { activityId: 3, activityType: { typeKey: 'treadmill_running' }, startTimeLocal: '2026-11-22 12:00:00' },
    ]
    const { mem } = await linked(g)
    expect([...mem.runs.keys()]).toEqual(['ir-garmin-3'])
    expect(g.calls.filter((c) => c.url.startsWith('/download-service'))).toHaveLength(1)
    expect(mem.runs.get('ir-garmin-3')!.activityType).toBe('tapis')
  })

  it('429 : arrêt immédiat pour ce compte, pas de nouvelle tentative, dernière synchro inchangée', async () => {
    const g = fakeGarmin()
    const { deps, mem } = await linked(g)
    const before = mem.integrations.get('u1')!.lastSync
    g.activities.push({ activityId: 888, activityType: { typeKey: 'running' }, startTimeLocal: '2026-11-23 07:00:00' })
    g.dataStatus = 429
    g.calls.length = 0
    const r = await syncUser(deps, { ...mem.integrations.get('u1')!, lastSync: new Date(NOW - 3600_000).toISOString() })
    expect(r.state).toBe('reessai')
    expect(g.calls.filter((c) => c.url !== TOKEN_PATH)).toHaveLength(1) // une seule requête, aucune boucle
    expect(mem.integrations.get('u1')!.lastSync).toBe(before)
    expect(mem.integrations.get('u1')!.status).toBe('liee')
    // une erreur serveur aussi
    g.dataStatus = 503; g.calls.length = 0
    expect((await syncUser(deps, mem.integrations.get('u1')!)).state).toBe('reessai')
    expect(g.calls.filter((c) => c.url !== TOKEN_PATH)).toHaveLength(1)
    // au tour suivant, ça repart
    g.dataStatus = 200
    expect((await syncUser(deps, mem.integrations.get('u1')!)).state).toBe('liee')
    expect(mem.runs.has('ir-garmin-888')).toBe(true)
  })

  it('429 au milieu : ce qui est déjà écrit reste, le reste attend le tour suivant', async () => {
    const g = fakeGarmin()
    g.activities = [1, 2, 3].map((n) => ({ activityId: n, activityType: { typeKey: 'running' }, startTimeLocal: '2026-11-22 08:00:00' }))
    g.dataStatus = (url) => (url.includes('/download-service/files/activity/2') ? 429 : 200)
    const { deps, mem } = await linked(g)
    expect([...mem.runs.keys()]).toEqual(['ir-garmin-1'])
    g.dataStatus = 200
    await syncUser(deps, mem.integrations.get('u1')!)
    expect([...mem.runs.keys()].sort()).toEqual(['ir-garmin-1', 'ir-garmin-2', 'ir-garmin-3'])
  })

  it('401 sur les données : nouveau jeton une seule fois, puis ça passe', async () => {
    const g = fakeGarmin()
    const { deps, mem } = await linked(g)
    const tokens = g.tokens
    let first = true
    g.dataStatus = () => { if (first) { first = false; return 401 } return 200 }
    g.activities.push({ activityId: 5, activityType: { typeKey: 'running' }, startTimeLocal: '2026-11-23 07:00:00' })
    const r = await syncUser(deps, mem.integrations.get('u1')!)
    expect(r.state).toBe('liee')
    expect(g.tokens).toBe(tokens + 1)
    expect(mem.runs.has('ir-garmin-5')).toBe(true)
  })

  it('401 sur la clé : « à renouveler », synchro arrêtée, client ET coach prévenus, plus aucun appel', async () => {
    const g = fakeGarmin()
    const { deps, mem } = await linked(g)
    g.validKey = 'AUTRE-CLE-GARMIN-123456' // l'ancienne est invalidée
    g.dataStatus = 401
    const r = await syncUser(deps, mem.integrations.get('u1')!)
    expect(r.state).toBe('a_renouveler')
    expect(mem.integrations.get('u1')!.status).toBe('a_renouveler')
    expect(mem.links.get('u1')).toMatchObject({ state: 'a_renouveler' })
    expect(mem.notifs.some((x) => x.userId === 'u1' && /renouveler/i.test(x.n.title))).toBe(true)
    expect(mem.notifs.some((x) => x.userId === 'coach' && /renouveler/i.test(x.n.title))).toBe(true)
    g.calls.length = 0
    expect((await syncUser(deps, mem.integrations.get('u1')!)).state).toBe('a_renouveler')
    expect(g.calls).toHaveLength(0)
    expect((await syncAll(deps)).users).toBe(0)
    // se relier avec une nouvelle clé relance tout
    const key2 = 'AUTRE-CLE-GARMIN-123456'
    g.dataStatus = 200
    expect((await handleLink(deps, 'jwt-user', { action: 'link', apiKey: key2 })).status).toBe(200)
    expect(mem.integrations.get('u1')!.status).toBe('liee')
  })

  it('clé expirée : « à renouveler » sans même appeler Garmin', async () => {
    const g = fakeGarmin()
    let t = NOW
    const { deps, mem } = await linked(g, () => t)
    t = Date.parse('2027-12-01T10:00:00Z')
    g.calls.length = 0
    expect((await syncUser(deps, mem.integrations.get('u1')!)).state).toBe('a_renouveler')
    expect(g.calls).toHaveLength(0)
    expect(mem.notifs.filter((x) => x.userId === 'u1')).toHaveLength(1)
  })

  it('rappels J-10 puis J-2, une seule fois chacun, au client et au coach', async () => {
    const g = fakeGarmin()
    let t = NOW
    const { deps, mem } = await linked(g, () => t)
    const expires = mem.integrations.get('u1')!.expiresAt // 2027-11-23
    const at = (d: number) => Date.parse(expires + 'T10:00:00Z') - d * 86400000
    t = at(11)
    await syncUser(deps, mem.integrations.get('u1')!)
    expect(mem.notifs).toHaveLength(0)
    t = at(10)
    await syncUser(deps, mem.integrations.get('u1')!)
    const j10 = mem.notifs.filter((x) => x.n.title === 'Ta clé Garmin va expirer')
    expect(j10).toHaveLength(1)
    expect(j10[0].n.body).toBe('Ta clé Garmin expire le 23/11/2027 : crée-en une nouvelle et colle-la ici.')
    expect(mem.notifs.some((x) => x.userId === 'coach' && x.n.title === 'Clé Garmin bientôt expirée')).toBe(true)
    t = at(9); await syncUser(deps, mem.integrations.get('u1')!)
    t = at(5); await syncUser(deps, mem.integrations.get('u1')!)
    expect(mem.notifs.filter((x) => x.userId === 'u1')).toHaveLength(1) // pas de doublon
    t = at(2)
    await syncUser(deps, mem.integrations.get('u1')!)
    expect(mem.notifs.filter((x) => x.userId === 'u1')).toHaveLength(2)
    t = at(1); await syncUser(deps, mem.integrations.get('u1')!)
    expect(mem.notifs.filter((x) => x.userId === 'u1')).toHaveLength(2)
    expect(mem.integrations.get('u1')!.status).toBe('liee')
  })

  it('le jeton est réutilisé tant qu\'il est valide, redemandé quand il reste moins d\'une heure', async () => {
    const g = fakeGarmin()
    let t = NOW
    const { deps, mem } = await linked(g, () => t)
    expect(g.tokens).toBe(1)
    t += 30 * 60 * 1000
    await syncUser(deps, mem.integrations.get('u1')!)
    expect(g.tokens).toBe(1)
    t = NOW + 23.5 * 3600 * 1000
    await syncUser(deps, mem.integrations.get('u1')!)
    expect(g.tokens).toBe(2)
  })

  it('santé indisponible (point d\'accès différent) : les courses passent quand même, message sans bloquer', async () => {
    const g = fakeGarmin()
    g.dataStatus = (url) => (url.startsWith('/sleep-service') ? 404 : 200)
    const { mem } = await linked(g)
    expect(mem.runs.size).toBe(1)
    expect(mem.links.get('u1')).toMatchObject({ state: 'liee', message: expect.stringMatching(/indisponibles/) })
  })

  it('tâche planifiée : tous les comptes, une erreur n\'arrête pas les autres', async () => {
    const g = fakeGarmin()
    const { deps, mem } = await linked(g)
    mem.integrations.set('bad', { ...mem.integrations.get('u1')!, userId: 'bad', keyEnc: 'v1.cassé.cassé' })
    const r = await syncAll(deps)
    expect(r).toMatchObject({ users: 2, failed: 1 })
  })

  it('bouton « Synchroniser » et ouverture de l\'app (au plus 1 fois / 5 min)', async () => {
    const g = fakeGarmin()
    let t = NOW
    const { deps } = await linked(g, () => t)
    t += 60_000
    expect((await handleSync(deps, 'jwt-user', 'open')).body.skipped).toBe(true)
    expect((await handleSync(deps, 'jwt-user', 'manual')).body.skipped).toBeUndefined()
    t += 6 * 60_000
    expect((await handleSync(deps, 'jwt-user', 'open')).body.skipped).toBeUndefined()
    expect((await handleSync(deps, undefined)).status).toBe(401)
    const empty = fakeDeps(fakeGarmin())
    expect((await handleSync(empty.deps, 'jwt-user')).status).toBe(404)
  })
})

describe('lecteurs de réponses Garmin (champs non publiés : lecture tolérante)', () => {
  it('JWT, liste d\'activités, types', () => {
    expect(jwtExp(jwt(1234567890))).toBe(1234567890)
    expect(jwtExp('pas-un-jwt')).toBeUndefined()
    expect(parseActivityList([{ activityId: 1, activityType: { typeKey: 'running' }, startTimeLocal: '2026-11-22 08:30:00' }, { id: 2 }, {}, null])).toEqual([
      { id: '1', typeKey: 'running', startLocal: '2026-11-22T08:30:00' }, { id: '2', typeKey: undefined, startLocal: undefined },
    ])
    expect(parseActivityList({ activities: [{ activityId: 9 }] })).toHaveLength(1)
    expect(parseActivityList('oups')).toEqual([])
    expect(['running', 'trail_running', 'treadmill_running', 'track_running', 'cycling', 'walking', 'strength_training', 'yoga', undefined].map(typeFromKey)).toEqual(['route', 'trail', 'tapis', 'piste', 'velo', 'marche', 'muscu', 'autre', undefined])
  })
  it('pas et sommeil', () => {
    expect(parseSteps([{ calendarDate: '2026-11-22', totalSteps: 100 }, { date: '2026-11-23', steps: 5 }, { calendarDate: 'x' }, null])).toEqual([{ date: '2026-11-22', steps: 100 }, { date: '2026-11-23', steps: 5 }])
    expect(parseSleep([{ calendarDate: '2026-11-23', sleepTimeSeconds: 3600 * 7 }, { calendarDate: '2026-11-24' }])).toEqual([{ date: '2026-11-23', sleepMinutes: 420, sleepScore: undefined, sleepPhases: undefined }])
    expect(parseSleep({ dailySleepDTOs: [{ calendarDate: '2026-11-23', sleepTimeSeconds: 600 }] })).toHaveLength(1)
  })
})

describe('pas d\'IA : aucune donnée de montre vers Claude', () => {
  const payload = {
    weekN: 3, stats: { planned: 4, done: 3, km: 25 },
    importedRuns: [{ id: 'ir-1', km: 10, hrSeries: [{ t: 0, hr: 120 }] }],
    health: [{ steps: 8000, sleepMinutes: 400 }],
    sessions: [
      { id: 's1', runLog: { km: 10, source: 'garmin', rpe: 5, laps: [{ meters: 1000 }] }, title: 'EF' },
      { id: 's2', runLog: { km: 8, source: 'manuel' }, title: 'Footing' },
      { id: 's3', runLog: { km: 8, source: 'fit' } },
    ],
    nested: { avgHr: 150, maxHr: 180, steps: 3, keep: 'ok', list: [{ source: 'garmin', km: 1 }, { source: 'manuel', km: 2 }] },
  }
  it('retire activités, tours, FC, santé, et tout objet venu de la montre', () => {
    const out = JSON.stringify(stripWatchData(payload))
    for (const k of ['importedRuns', 'hrSeries', 'health', 'steps', 'sleepMinutes', 'laps', 'avgHr', 'maxHr', 'garmin', 'fit']) expect(out).not.toContain(k)
    expect(out).toContain('"weekN":3')
    expect(out).toContain('Footing')
    expect(out).toContain('"keep":"ok"')
    expect(out).toContain('"source":"manuel"')
  })
  it('ne modifie pas l\'entrée', () => {
    const copy = structuredClone(payload)
    stripWatchData(payload)
    expect(payload).toEqual(copy)
  })
  it('handleAI applique le filtre avant tout appel (point unique)', async () => {
    const { handleAI } = await import('../ai-core')
    const seen: string[] = []
    const real = globalThis.fetch
    globalThis.fetch = (async (_u: string, init: { body: string }) => { seen.push(init.body); return { ok: true, json: async () => ({ content: [{ type: 'text', text: '{"summary":"ok","suggestions":[]}' }] }) } }) as unknown as typeof fetch
    try {
      const r = await handleAI('weekly', payload, 'sk-test')
      expect(r.status).toBe(200)
      expect(seen).toHaveLength(1)
      for (const k of ['importedRuns', 'hrSeries', 'health', 'sleepMinutes', 'garmin']) expect(seen[0]).not.toContain(k)
      expect(seen[0]).toContain('weekN')
    } finally { globalThis.fetch = real }
  })
})
