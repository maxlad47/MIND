// Test de fumée sous Deno (l'environnement des Edge Functions) : lecture .fit/.zip, chiffrement, liaison + synchro avec un faux Garmin.
// Lancer : npm run test:deno   (= npx deno test --config supabase/functions/deno.json --allow-read shared/garmin/deno-smoke.ts)
import { decryptSecret, encryptSecret } from './crypto.ts'
import { parseFitFile } from './fit.ts'
import { handleLink, type Deps, type Integration } from './handlers.ts'
import { BASE_URL, TOKEN_PATH } from './personal.ts'
import { stripWatchData } from './ai-filter.ts'

const ok = (c: unknown, m: string) => { if (!c) throw new Error('Échec : ' + m) }
const zip = Deno.readFileSync(new URL('../../scripts/fixtures/sortie-5km.zip', import.meta.url))
const secret = btoa(String.fromCharCode(...new Uint8Array(32).fill(9)))

Deno.test('lecture .zip sous Deno', async () => {
  const r = await parseFitFile(zip, 'sortie.zip')
  ok(r.km === 5 && r.seconds === 1630 && r.laps?.length === 5 && r.splits?.length === 5 && r.startAt === '2026-11-20T08:30:00', 'lecture FIT')
  ok(r.externalId === 'garmin:12345678901', 'id Garmin lu dans le nom du fichier du zip')
})

Deno.test('chiffrement sous Deno', async () => {
  const c = await encryptSecret('ma-cle-garmin', secret)
  ok(!c.includes('ma-cle-garmin') && (await decryptSecret(c, secret)) === 'ma-cle-garmin', 'AES-GCM')
})

Deno.test('liaison + première synchro sous Deno', async () => {
  const header = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '')
  const jwt = `${header({})}.${header({ exp: Math.floor(Date.now() / 1000) + 86400 })}.s`
  const store = new Map<string, Integration>(); const runs: string[] = []
  const res = (status: number, body: unknown, bin?: Uint8Array) => ({ ok: status < 300, status, text: async () => String(body), json: async () => body, arrayBuffer: async () => (bin ?? new Uint8Array()).slice().buffer as ArrayBuffer })
  const deps: Deps = {
    userFromJwt: async () => ({ id: 'u1', role: 'coach' }), getIntegration: async (id) => store.get(id) ?? null, saveIntegration: async (i) => { store.set(i.userId, i) },
    deleteIntegration: async () => {}, listIntegrations: async () => [], isAllowed: async () => true, setAllowed: async () => {},
    insertRunsIfMissing: async (r) => { runs.push(...r.map((x) => x.id)) }, existingRunIds: async () => new Set(), upsertHealth: async () => {}, writeLink: async () => {},
    coachIds: async () => [], firstName: async () => 'Léa', notify: async () => {}, secret,
    fetch: async (url, init) => {
      const p = url.replace(BASE_URL, '')
      if (p === TOKEN_PATH) return init?.headers?.Authorization === 'ApiKey CLE-DE-TEST-123' ? res(200, jwt) : res(401, '')
      if (p.startsWith('/activitylist-service')) return res(200, [{ activityId: 12345678901, activityType: { typeKey: 'running' }, startTimeLocal: '2026-11-22 08:30:00' }])
      if (p.startsWith('/download-service')) return res(200, '', zip)
      return res(200, [])
    },
    now: () => Date.now(),
  }
  ok((await handleLink(deps, 'x', { action: 'link', apiKey: 'MAUVAISE-CLE-123' })).status === 400, 'clé invalide refusée')
  const r = await handleLink(deps, 'x', { action: 'link', apiKey: 'CLE-DE-TEST-123' })
  ok(r.status === 200 && runs[0] === 'ir-garmin-12345678901', 'liaison et import')
  ok(!JSON.stringify([...store.values()]).includes('CLE-DE-TEST-123'), 'clé jamais en clair')
})

Deno.test('filtre IA', () => {
  ok(!JSON.stringify(stripWatchData({ a: 1, hrSeries: [1], b: { steps: 3, c: 2 } })).includes('hrSeries'), 'filtre')
})
