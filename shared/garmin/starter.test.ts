// Accès Starter (préparé, désactivé) avec des réponses simulées.
import { describe, expect, it } from 'vitest'
import { buildAuthorizeUrl, codeChallengeOf, codeVerifierOf, handleCallback, handlePush, parseStarterActivity, signState, STARTER, verifyState, type StarterConfig } from './starter'
import type { Deps, Integration } from './handlers'
import type { ImportedRun } from './types'
import { decryptSecret } from './crypto'

const SECRET = btoa(String.fromCharCode(...new Uint8Array(32).fill(3)))
const cfg: StarterConfig = { clientId: 'cid', clientSecret: 'csec', redirectUri: 'https://x.test/cb', stateSecret: 'state-secret', pushSecret: 'push-secret' }

describe('OAuth Starter (simulé)', () => {
  it('state signé : retrouve l\'utilisateur, refuse une altération', async () => {
    const s = await signState('u1', cfg.stateSecret)
    expect(await verifyState(s, cfg.stateSecret)).toBe('u1')
    expect(await verifyState(s.replace('u1', 'u2'), cfg.stateSecret)).toBeNull()
    expect(await verifyState(s, 'autre-secret')).toBeNull()
    expect(await verifyState('n.importe.quoi', cfg.stateSecret)).toBeNull()
  })
  it('adresse d\'autorisation avec PKCE', async () => {
    const url = new URL(await buildAuthorizeUrl(cfg, 'u1'))
    expect(url.origin + url.pathname).toBe(STARTER.authorizeUrl)
    const state = url.searchParams.get('state')!
    expect(url.searchParams.get('code_challenge')).toBe(await codeChallengeOf(await codeVerifierOf(state, cfg.stateSecret)))
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
  })
  it('callback : jetons chiffrés, clé personnelle supprimée', async () => {
    const saved: { userId?: string; enc?: string; pid?: string } = {}
    const deleted: string[] = []
    const deps = { secret: SECRET, deleteIntegration: async (id: string) => { deleted.push(id) }, saveStarter: async (userId: string, enc: string, pid?: string) => Object.assign(saved, { userId, enc, pid }) } as unknown as Deps & { saveStarter(u: string, t: string, p?: string): Promise<void> }
    const state = await signState('u1', cfg.stateSecret)
    const post = async () => ({ ok: true, status: 200, json: async () => ({ access_token: 'AT', refresh_token: 'RT', user_id: 'garmin-u' }) })
    expect(await handleCallback(deps, cfg, post, { state, code: 'abc' })).toEqual({ status: 200, userId: 'u1' })
    expect(deleted).toEqual(['u1'])
    expect(saved.enc).not.toContain('AT')
    expect(JSON.parse(await decryptSecret(saved.enc!, SECRET))).toMatchObject({ access_token: 'AT' })
    expect((await handleCallback(deps, cfg, post, { state: 'x.y.z', code: 'abc' })).status).toBe(400)
    expect((await handleCallback(deps, cfg, async () => ({ ok: false, status: 400, json: async () => ({}) }), { state, code: 'abc' })).status).toBe(502)
  })
})

describe('réception push (simulée)', () => {
  const inserted = new Map<string, ImportedRun>()
  const deps = {
    userByProviderId: async (id: string) => (id === 'garmin-u' ? 'u1' : null),
    insertRunsIfMissing: async (runs: ImportedRun[]) => { for (const r of runs) if (!inserted.has(r.id)) inserted.set(r.id, r) },
  } as unknown as Deps & { userByProviderId(id: string): Promise<string | null> }
  const activity = { userId: 'garmin-u', activityId: 99, activityType: 'RUNNING', startTimeInSeconds: Date.parse('2026-11-22T07:30:00Z') / 1000, startTimeOffsetInSeconds: 3600, durationInSeconds: 1800, distanceInMeters: 6000, averageHeartRateInBeatsPerMinute: 150 }
  it('lit l\'activité', () => {
    expect(parseStarterActivity(activity)).toMatchObject({ externalId: 'garmin:99', startAt: '2026-11-22T08:30:00', km: 6, seconds: 1800, avgPaceSec: 300, avgHr: 150, activityType: 'route' })
    expect(() => parseStarterActivity({})).toThrow()
  })
  it('contrôle d\'origine', async () => {
    expect((await handlePush(deps, cfg, { token: 'faux', body: { activities: [activity] } })).status).toBe(401)
    expect((await handlePush(deps, cfg, { body: { activities: [activity] } })).status).toBe(401)
    expect(inserted.size).toBe(0)
  })
  it('idempotence : la même activité reçue deux fois ne crée qu\'un enregistrement ; utilisateur inconnu ignoré', async () => {
    await handlePush(deps, cfg, { token: 'push-secret', body: { activities: [activity, { ...activity, userId: 'inconnu', activityId: 5 }] } })
    await handlePush(deps, cfg, { token: 'push-secret', body: { activities: [activity] } })
    expect([...inserted.keys()]).toEqual(['ir-garmin-99'])
    expect(inserted.get('ir-garmin-99')).toMatchObject({ clientId: 'u1', source: 'garmin', status: 'a_rattacher' })
  })
})
