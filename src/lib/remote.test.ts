// Test de la synchronisation avec un faux serveur Supabase en mémoire (deux « appareils » : un client, un coach).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { P_MIXTE } from '@/engine/fixtures'
import { newTemplate, newTemplateExercise } from '@/engine/libre'
import { todayISO } from '@/engine/utils'

type Row = Record<string, any>
function makeServer() {
  const tables: Record<string, Map<string, Row>> = { profiles: new Map(), records: new Map(), inbox: new Map() }
  const users = new Map<string, { id: string; email: string; password: string; first: string }>()
  return { tables, users }
}
type Server = ReturnType<typeof makeServer>

function fakeClient(server: Server) {
  let current: string | null = null
  const q = (table: string) => {
    const t = server.tables[table]
    const filters: ((r: Row) => boolean)[] = []
    let op: 'select' | 'update' | 'delete' = 'select'
    let patch: Row = {}
    const api: any = {
      select: () => api,
      eq: (c: string, v: any) => { filters.push((r) => r[c] === v); return api },
      in: (c: string, v: any[]) => { filters.push((r) => v.includes(r[c])); return api },
      range: async () => ({ data: [...t.values()].filter((r) => filters.every((f) => f(r))), error: null }),
      update: (p: Row) => { op = 'update'; patch = p; return api },
      delete: () => { op = 'delete'; return api },
      upsert: async (rows: Row[]) => { for (const r of rows) t.set(r.id, { ...(t.get(r.id) ?? {}), ...r }); return { error: null } },
      insert: async (r: Row) => { if (t.has(r.id)) return { error: { code: '23505', message: 'dup' } }; t.set(r.id, r); return { error: null } },
      then: (res: any) => {
        for (const [k, r] of [...t]) if (filters.every((f) => f(r))) { if (op === 'update') t.set(k, { ...r, ...patch }); if (op === 'delete') t.delete(k) }
        res({ error: null })
      },
    }
    return api
  }
  return {
    from: q,
    channel: () => ({ on() { return this }, subscribe() { return this } }),
    removeChannel: async () => {},
    auth: {
      getSession: async () => ({ data: { session: current ? { user: { id: current } } : null } }),
      onAuthStateChange: () => ({}),
      signOut: async () => { current = null },
      signInWithPassword: async ({ email, password }: any) => {
        const u = [...server.users.values()].find((x) => x.email === email && x.password === password)
        if (!u) return { data: {}, error: { message: 'Invalid login credentials' } }
        current = u.id
        return { data: { user: { id: u.id }, session: {} }, error: null }
      },
      signUp: async ({ email, password, options }: any) => {
        const id = crypto.randomUUID()
        const first = options?.data?.first_name ?? ''
        server.users.set(id, { id, email, password, first })
        server.tables.profiles.set(id, {
          id, role: email === 'coach@test.fr' ? 'coach' : 'client', first_name: first || email.split('@')[0], email,
          reminder_time: '18:00:00', theme: 'auto', notifications: false, onboarded: false, created_at: new Date().toISOString(),
        })
        current = id
        return { data: { user: { id }, session: {} }, error: null }
      },
    },
  }
}

/** Un « appareil » = un localStorage + une instance neuve des modules. */
async function device(server: Server) {
  vi.resetModules()
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) })
  vi.stubGlobal('document', { addEventListener() {}, visibilityState: 'visible' })
  vi.stubGlobal('window', { addEventListener() {} })
  const client = fakeClient(server)
  vi.doMock('./supabase', () => ({ supabase: client, REMOTE: true }))
  const s = await import('./store')
  const r = await import('./remote')
  await r.initRemote()
  return { s, r }
}

describe('synchronisation en ligne', () => {
  let server: Server
  beforeEach(() => { server = makeServer() })

  it('le programme d\'un client arrive chez le coach, et le commentaire du coach chez le client', async () => {
    const coach0 = await device(server)
    expect((await coach0.r.remoteSignUp('coach@test.fr', 'secret1', 'Max')).ok).toBe(true)
    expect(coach0.s.currentUser()?.role).toBe('coach')
    await coach0.r.remoteSignOut()

    // client : crée son compte et son programme
    const cli = await device(server)
    expect((await cli.r.remoteSignUp('frere@test.fr', 'secret1', 'Théo')).ok).toBe(true)
    const me = cli.s.currentUser()!
    expect(me.role).toBe('client')
    const prog = cli.s.submitQuestionnaire(me.id, { ...P_MIXTE, firstName: 'Théo' }, '2026-01-05')
    await cli.r.pushNow()
    expect(server.tables.records.has(`p:${prog.id}`)).toBe(true)
    expect(server.tables.profiles.get(me.id)!.onboarded).toBe(true)
    // le coach (qui n'a pas de session ici) reçoit une notification de nouveau programme
    expect([...server.tables.inbox.values()].length).toBe(1)

    // coach : sur son appareil, il voit le client et son programme
    const coach = await device(server)
    expect((await coach.r.remoteSignIn('coach@test.fr', 'secret1')).ok).toBe(true)
    const db = coach.s.getDB()
    expect(db.profiles.some((p) => p.id === me.id)).toBe(true)
    expect(db.programs.find((p) => p.id === prog.id)?.weeks.length).toBe(prog.weeks.length)
    expect(db.notifications.some((n) => n.title === 'Nouveau programme')).toBe(true)

    // le coach commente une séance : le client reçoit le commentaire et la notification
    const sessionId = prog.weeks[0].sessions[0].id
    coach.s.addComment(sessionId, me.id, 'Beau boulot, monte de 2,5 kg !')
    await coach.r.pushNow()
    expect(server.tables.records.get([...server.tables.records.keys()].find((k) => k.startsWith('c:'))!)!.client_id).toBe(me.id)
    expect([...server.tables.inbox.values()].some((r) => r.user_id === me.id)).toBe(true)

    const cli2 = await device(server)
    expect((await cli2.r.remoteSignIn('frere@test.fr', 'secret1')).ok).toBe(true)
    const db2 = cli2.s.getDB()
    expect(db2.comments.length).toBe(1)
    expect(db2.notifications.some((n) => n.userId === me.id && n.title.includes('a commenté'))).toBe(true)
    expect(db2.programs[0].id).toBe(prog.id)
  })

  it('mode libre : séances modèles et planning voyagent avec le programme (aucun nouveau « kind », aucune migration SQL)', async () => {
    const coach0 = await device(server)
    await coach0.r.remoteSignUp('coach@test.fr', 'secret1', 'Max')
    await coach0.r.remoteSignOut()

    const cli = await device(server)
    await cli.r.remoteSignUp('nina@test.fr', 'secret1', 'Nina')
    const me = cli.s.currentUser()!
    const today = todayISO()
    const prog = cli.s.submitQuestionnaire(me.id, { ...P_MIXTE, firstName: 'Nina', mode: 'libre' }, today)
    expect(prog.mode).toBe('libre')
    const push = newTemplate('Push')
    push.exercises = [newTemplateExercise('dev_couche_barre')]
    cli.s.saveTemplate(prog.id, push)
    cli.s.setPlanning(prog.id, { mode: 'rotation', days: [0, 1, 2, 3, 4, 5, 6], order: [push.id] })
    const custom = cli.s.addCustomExercise(prog.id, 'Curl marteau poulie', 'biceps')
    await cli.r.pushNow()
    // tout vit dans l'enregistrement du programme : les seuls « kind » envoyés sont ceux qui existaient déjà
    const kinds = new Set([...server.tables.records.keys()].map((k) => k.split(':')[0]))
    expect([...kinds].every((k) => ['q', 'p', 'ck', 'ad', 'ed', 'c', 'pr', 'an', 'dr'].includes(k))).toBe(true)
    const saved = server.tables.records.get(`p:${prog.id}`)!.data as any
    expect(saved.libre.templates[0].name).toBe('Push')
    expect(saved.libre.customExercises[0].id).toBe(custom)

    // le coach voit le client en mode libre, avec ses modèles
    const coach = await device(server)
    await coach.r.remoteSignIn('coach@test.fr', 'secret1')
    const seen = coach.s.getDB().programs.find((p) => p.id === prog.id)!
    expect(seen.mode).toBe('libre')
    expect(seen.libre!.templates.map((t) => t.name)).toEqual(['Push'])
    // l'exercice perso se résout chez le coach comme chez le client
    expect((await import('@/engine/exercises')).exerciseOf(custom).name).toBe('Curl marteau poulie')

    // le coach modifie la séance : le client la reçoit, avec la notification
    coach.s.saveTemplate(prog.id, { ...seen.libre!.templates[0], name: 'Push lourd' })
    await coach.r.pushNow()
    const cli2 = await device(server)
    await cli2.r.remoteSignIn('nina@test.fr', 'secret1')
    const db2 = cli2.s.getDB()
    expect(db2.programs.find((p) => p.id === prog.id)!.libre!.templates[0].name).toBe('Push lourd')
    expect(db2.notifications.some((n) => n.userId === me.id && n.title === 'Max a modifié ta séance Push lourd')).toBe(true)
  })

  it('une modification faite hors ligne n\'est pas perdue au rechargement', async () => {
    const d = await device(server)
    await d.r.remoteSignUp('copine@test.fr', 'secret1', 'Léa')
    const me = d.s.currentUser()!
    const prog = d.s.submitQuestionnaire(me.id, { ...P_MIXTE, firstName: 'Léa' }, '2026-01-05')
    await d.r.pushNow()
    const sid = prog.weeks[0].sessions.find((s) => s.sport === 'muscu')!
    const se = sid.exercises![0]
    // le réseau tombe : la saisie reste locale
    const real = server.tables.records.set.bind(server.tables.records)
    server.tables.records.set = () => { throw new Error('hors ligne') }
    d.s.logSet(prog.id, sid.id, se.id, { n: 1, kg: 77.5, reps: 8, rir: 2, at: new Date().toISOString() })
    await d.r.pushNow()
    server.tables.records.set = real
    // l'app est rouverte avec le serveur encore sans la saisie : la version locale gagne et part au serveur
    await d.r.pushNow()
    const saved = server.tables.records.get(`p:${prog.id}`)!.data
    expect(JSON.stringify(saved)).toContain('77.5')
  })
})
