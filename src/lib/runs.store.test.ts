// Courses importées au niveau du store : import idempotent, « Fait comme prévu » → bilan, saisie rapide, correction, alertes, règles proposées.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { P_MARATHON } from '@/engine/fixtures'
import { addDays } from '@/engine/utils'

const MON = '2026-01-05'

async function fresh() {
  vi.resetModules()
  const mem = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) })
  vi.doMock('./supabase', () => ({ supabase: null, REMOTE: false }))
  const s = await import('./store')
  const adapt = await import('@/engine/adapt')
  const runs = await import('@/engine/runs')
  return { s, adapt, runs }
}
type Ctx = Awaited<ReturnType<typeof fresh>>

function setup(c: Ctx) {
  c.s.signUp('lea@test.fr', 'secret1', 'Léa')
  const me = c.s.currentUser()!
  const prog = c.s.submitQuestionnaire(me.id, { ...P_MARATHON, firstName: 'Léa', startDate: MON }, MON)
  const coach = c.s.signUp('x@y.fr', 'secret1', 'Coach') // le 2e compte est un client : on ajoute un coach à la main
  void coach
  c.s.mutate((d) => { d.profiles.push({ id: 'coach-1', role: 'coach', firstName: 'Max', email: 'coach@mind.app', reminderTime: '18:00', theme: 'auto', notifications: false, createdAt: '', onboarded: true }); d.sessionUserId = me.id })
  return { me, prog: c.s.programOf(c.s.getDB(), me.id)! }
}
const courses = (c: Ctx, id: string) => c.adapt.allSessions(c.s.programOf(c.s.getDB(), id)!).filter((s) => s.sport === 'course')
const sess = (c: Ctx, me: { id: string }, sid: string) => c.adapt.findSession(c.s.programOf(c.s.getDB(), me.id)!, sid)!
const data = (startAt: string, km: number, o: object = {}) => ({ startAt, km, seconds: Math.round(km * 330), avgPaceSec: 330, activityType: 'route' as const, ...o })

describe('importer une activité', () => {
  let c: Ctx
  beforeEach(async () => { c = await fresh() })

  it('même activité reçue deux fois : un seul enregistrement, une seule séance faite', () => {
    const { me } = setup(c)
    const first = courses(c, me.id).find((s) => s.kind === 'ef')!
    const a = c.s.importRun(me.id, data(`${first.date}T08:00:00`, 8, { externalId: 'garmin:42' }), 'garmin', { today: first.date })
    const b = c.s.importRun(me.id, data(`${first.date}T08:00:00`, 8, { externalId: 'garmin:42' }), 'garmin', { today: first.date })
    expect(a.duplicate).toBe(false)
    expect(b.duplicate).toBe(true)
    expect(c.s.getDB().importedRuns).toHaveLength(1)
    expect(courses(c, me.id).filter((s) => s.runLog)).toHaveLength(1)
    expect(a.run).toMatchObject({ status: 'rattachee', matchedSessionId: first.id, id: 'ir-garmin-42' })
  })

  it('identique quelle que soit la méthode de liaison : un .fit avec l\'id Garmin ne double pas la synchro', () => {
    const { me } = setup(c)
    const first = courses(c, me.id).find((s) => s.kind === 'ef')!
    c.s.importRun(me.id, data(`${first.date}T08:00:00`, 8, { externalId: 'garmin:42' }), 'garmin', { today: first.date })
    const viaFit = c.s.importRun(me.id, data(`${first.date}T08:00:00`, 8, { externalId: 'garmin:42' }), 'fit', { today: first.date })
    expect(viaFit.duplicate).toBe(true)
    expect(c.s.getDB().importedRuns).toHaveLength(1)
  })

  it('la montre envoie une activité : à rattacher côté app, bilan « À compléter » + notification', () => {
    const { me } = setup(c)
    const first = courses(c, me.id).find((s) => s.kind === 'ef')!
    // comme le serveur : on écrit seulement l'ImportedRun
    c.s.mutate((d) => { d.importedRuns.push({ id: 'ir-garmin-7', clientId: me.id, source: 'garmin', externalId: 'garmin:7', status: 'a_rattacher', ...data(`${first.date}T08:00:00`, 10.2) }) })
    expect(c.s.attachPendingRuns(first.date)).toBe(1)
    expect(c.s.attachPendingRuns(first.date)).toBe(0) // idempotent
    const s = sess(c, me, first.id)
    expect(s.status).toBe('faite')
    expect(c.runs.needsReview(s)).toBe(true)
    const n = c.s.getDB().notifications.filter((x) => x.userId === me.id && x.title === 'À compléter')
    expect(n).toHaveLength(1)
    expect(n[0].body).toContain('10,2 km')
    expect(c.s.attachPendingRuns(first.date)).toBe(0)
    expect(c.s.getDB().notifications.filter((x) => x.title === 'À compléter')).toHaveLength(1)
  })

  it('un .fit sans id Garmin : dédoublonné par date, distance et durée', () => {
    const { me } = setup(c)
    const first = courses(c, me.id).find((s) => s.kind === 'ef')!
    const a = c.s.importRun(me.id, data(`${first.date}T08:00:00`, 8), 'fit', { today: first.date })
    const b = c.s.importRun(me.id, data(`${first.date}T08:00:00`, 8), 'fit', { today: first.date })
    expect(b.duplicate).toBe(true)
    expect(b.run.id).toBe(a.run.id)
  })

  it('vélo : ignoré, aucune séance touchée', () => {
    const { me } = setup(c)
    const first = courses(c, me.id).find((s) => s.kind === 'ef')!
    const r = c.s.importRun(me.id, data(`${first.date}T08:00:00`, 30, { activityType: 'velo' }), 'garmin', { externalId: 'garmin:9', today: first.date })
    expect(r.run.status).toBe('ignoree')
    expect(sess(c, me, first.id).status).toBe('prevue')
  })

  it('correction : vers une autre séance (le bilan suit), en sortie en plus, ou ignorée', () => {
    const { me } = setup(c)
    const [a, b] = courses(c, me.id).filter((s) => s.kind === 'ef' || s.kind === 'longue')
    const r = c.s.importRun(me.id, data(`${a.date}T08:00:00`, 8, { externalId: 'garmin:5' }), 'garmin', { today: a.date })
    c.s.completeRunReview(c.s.programOf(c.s.getDB(), me.id)!.id, a.id, { respected: 'oui', reasons: [], rpe: 5 }, a.date)
    c.s.correctRun(r.run.id, { sessionId: b.id }, a.date)
    expect(sess(c, me, a.id)).toMatchObject({ status: 'prevue' })
    expect(sess(c, me, a.id).runLog).toBeUndefined()
    expect(sess(c, me, b.id).runLog).toMatchObject({ km: 8, rpe: 5, respected: 'oui' })
    c.s.correctRun(r.run.id, 'extra', a.date)
    expect(sess(c, me, b.id).status).toBe('prevue')
    const extra = c.adapt.allSessions(c.s.programOf(c.s.getDB(), me.id)!).find((s) => s.id === c.runs.extraIdOf(r.run.id))!
    expect(extra).toMatchObject({ extra: true, status: 'faite' })
    expect(extra.runLog).toMatchObject({ rpe: 5 })
    c.s.correctRun(r.run.id, 'ignore', a.date)
    expect(c.s.getDB().importedRuns[0].status).toBe('ignoree')
    expect(c.adapt.allSessions(c.s.programOf(c.s.getDB(), me.id)!).find((s) => s.id === c.runs.extraIdOf(r.run.id))).toBeUndefined()
  })
})

describe('« Fait comme prévu » et saisie rapide → bilan', () => {
  let c: Ctx
  beforeEach(async () => { c = await fresh() })

  it('Fait comme prévu : mesures du plan, bilan à remplir, puis tout est rempli', () => {
    const { me, prog } = setup(c)
    const s0 = courses(c, me.id).find((s) => s.kind === 'ef')!
    const out = c.s.logPlannedRun(prog.id, s0.id, s0.date)!
    expect(out.sessionId).toBe(s0.id)
    const s = sess(c, me, s0.id)
    expect(s.status).toBe('faite')
    expect(s.runLog).toMatchObject({ km: s0.run!.totalKm, seconds: s0.run!.estMinutes * 60, source: 'manuel', feeling: 0 })
    expect(c.runs.needsReview(s)).toBe(true)
    expect(c.s.logPlannedRun(prog.id, s0.id, s0.date)!.duplicate).toBe(true)
    c.s.completeRunReview(prog.id, s0.id, { respected: 'oui', reasons: ['meteo'], rpe: 6 }, s0.date)
    const done = sess(c, me, s0.id)
    expect(done.runLog).toMatchObject({ respected: 'oui', reasons: [], rpe: 6, feeling: 6 }) // « oui » : pas de raisons
    expect(done.feeling).toBe(6)
    expect(c.runs.needsReview(done)).toBe(false)
  })

  it('saisie rapide : allure calculée', () => {
    const { me, prog } = setup(c)
    const s0 = courses(c, me.id).find((s) => s.kind === 'ef')!
    const out = c.s.logQuickRun(prog.id, s0.id, 10, 3000, s0.date)!
    expect(out.run).toMatchObject({ km: 10, seconds: 3000, avgPaceSec: 300 })
    expect(c.s.logQuickRun(prog.id, s0.id, 0, 3000, s0.date)).toBeUndefined()
  })

  it('« En partie » + douleur : alerte coach immédiate et douleur visible sur la fiche', () => {
    const { me, prog } = setup(c)
    const s0 = courses(c, me.id).find((s) => s.kind === 'ef')!
    c.s.logPlannedRun(prog.id, s0.id, s0.date)
    c.s.completeRunReview(prog.id, s0.id, { respected: 'partiel', reasons: ['douleur', 'fatigue'], rpe: 7, painZone: 'genou' }, s0.date)
    const ck = c.s.getDB().checkins.find((x) => x.pain)!
    expect(ck).toMatchObject({ clientId: me.id, painZone: 'genou' })
    const n = c.s.getDB().notifications.filter((x) => x.userId === 'coach-1' && x.title === 'Douleur signalée')
    expect(n).toHaveLength(1)
    expect(n[0].body).toContain('genou')
    expect(sess(c, me, s0.id).runLog).toMatchObject({ painZone: 'genou', reasons: ['douleur', 'fatigue'] })
    // revalider le bilan ne double pas l'alerte
    c.s.completeRunReview(prog.id, s0.id, { respected: 'partiel', reasons: ['douleur'], rpe: 7, painZone: 'genou' }, s0.date)
    expect(c.s.getDB().notifications.filter((x) => x.title === 'Douleur signalée')).toHaveLength(1)
    expect(c.s.getDB().checkins.filter((x) => x.pain)).toHaveLength(1)
  })

  it('autre : le texte libre est gardé, sinon écarté', () => {
    const { me, prog } = setup(c)
    const s0 = courses(c, me.id).find((s) => s.kind === 'ef')!
    c.s.logPlannedRun(prog.id, s0.id, s0.date)
    c.s.completeRunReview(prog.id, s0.id, { respected: 'non', reasons: ['autre'], reasonNote: ' Garde d\'enfants ', rpe: 3 }, s0.date)
    expect(sess(c, me, s0.id).runLog!.reasonNote).toBe('Garde d\'enfants')
  })

  it('« trop difficile » deux fois sur la qualité : allures proposées, jamais appliquées', () => {
    const { me, prog } = setup(c)
    const q = courses(c, me.id).filter((s) => ['vma', 'seuil', 'specifique', 'fartlek', 'cotes'].includes(s.kind)).slice(0, 2)
    const vma0 = c.s.programOf(c.s.getDB(), me.id)!.paces!.vma
    q.forEach((s, i) => { c.s.logPlannedRun(prog.id, s.id, s.date); c.s.completeRunReview(prog.id, s.id, { respected: 'partiel', reasons: ['difficile'], rpe: 9 }, addDays(s.date, i)) })
    const ads = c.s.getDB().adaptations.filter((a) => a.kind === 'allures' && a.status === 'propose')
    expect(ads).toHaveLength(1)
    expect((ads[0].payload as { vma: number }).vma).toBeLessThan(vma0)
    expect(c.s.programOf(c.s.getDB(), me.id)!.paces!.vma).toBe(vma0) // rien d'appliqué tout seul
    // accepter applique
    c.s.acceptAdaptation(ads[0].id)
    expect(c.s.programOf(c.s.getDB(), me.id)!.paces!.vma).toBeLessThan(vma0)
  })

  it('« pas envie » trois fois : alerte coach motivation en baisse', () => {
    const { me, prog } = setup(c)
    const list = courses(c, me.id).filter((s) => s.kind === 'ef').slice(0, 3)
    list.forEach((s) => { c.s.logPlannedRun(prog.id, s.id, s.date); c.s.completeRunReview(prog.id, s.id, { respected: 'non', reasons: ['motivation'], rpe: 2 }, list[2].date) })
    const n = c.s.getDB().notifications.filter((x) => x.userId === 'coach-1' && x.title === 'Motivation en baisse')
    expect(n).toHaveLength(1)
  })
})

describe('réglages et migration', () => {
  it('FC max du client', async () => {
    const c = await fresh()
    const { me } = setup(c)
    c.s.setMaxHr(me.id, 186)
    expect(c.s.maxHrSettingOf(c.s.getDB(), me.id)).toBe(186)
    c.s.setMaxHr(me.id, undefined)
    expect(c.s.maxHrSettingOf(c.s.getDB(), me.id)).toBeUndefined()
  })
  it('un RunLog ancien (sans bilan ni importedRunId) fonctionne comme avant', async () => {
    const c = await fresh()
    const { me, prog } = setup(c)
    const s0 = courses(c, me.id).find((s) => s.kind === 'ef')!
    c.s.logRun(prog.id, s0.id, { km: 8, seconds: 2700, feeling: 5, comment: '' }, s0.date)
    const s = sess(c, me, s0.id)
    expect(s.status).toBe('faite')
    expect(c.runs.needsReview(s)).toBe(false)
  })
})
