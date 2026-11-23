// Mode libre au niveau du store : bascule MIND ↔ Libre, historique conservé, tâches quotidiennes, check-in, notifications du coach.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { P_DEBUTANT } from '@/engine/fixtures'
import { addDays, todayISO } from '@/engine/utils'

const MON = '2026-03-02' // un lundi

async function fresh() {
  vi.resetModules()
  const mem = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) })
  vi.doMock('./supabase', () => ({ supabase: null, REMOTE: false }))
  const s = await import('./store')
  const ex = await import('@/engine/exercises')
  const libre = await import('@/engine/libre')
  const adapt = await import('@/engine/adapt')
  return { s, ex, libre, adapt }
}
type Ctx = Awaited<ReturnType<typeof fresh>>

/** Un client avec un programme MIND dont la première séance de muscu est faite (une série saisie). */
function clientWithHistory({ s, adapt }: Ctx) {
  s.signUp('theo@test.fr', 'secret1', 'Théo')
  const me = s.currentUser()!
  const prog = s.submitQuestionnaire(me.id, { ...P_DEBUTANT, firstName: 'Théo', startDate: MON }, MON)
  const first = adapt.allSessions(prog).filter((x) => x.sport === 'muscu').sort((a, b) => a.date.localeCompare(b.date))[0]
  const ex = first.exercises![0]
  s.logSet(prog.id, first.id, ex.id, { n: 1, kg: 62.5, reps: 8, rir: 2, at: `${first.date}T10:00:00.000Z` })
  s.finishStrength(prog.id, first.id, 7, 40, first.date)
  return { me, prog, first, exerciseId: ex.exerciseId }
}

describe('mode libre : bascule et historique', () => {
  let c: Ctx
  beforeEach(async () => { c = await fresh() })

  it('MIND → Libre : un modèle par séance de la semaine, ancien programme archivé, historique retrouvé', () => {
    const { me, prog, first, exerciseId } = clientWithHistory(c)
    const created = c.s.switchToLibre(me.id, true, addDays(first.date, 1))!
    const d = c.s.getDB()
    expect(created.mode).toBe('libre')
    expect(c.s.programOf(d, me.id)!.id).toBe(created.id)
    expect(d.programs.find((p) => p.id === prog.id)!.status).toBe('archive')
    expect(created.libre!.templates.length).toBeGreaterThan(0)
    // « Dernière performance » retrouve la série saisie dans l'ancien programme
    const later = c.adapt.allSessions(created).filter((x) => x.exercises?.some((e) => e.exerciseId === exerciseId)).sort((a, b) => b.date.localeCompare(a.date))[0]
    expect(c.s.lastPerformance(d, me.id, exerciseId, later.id)).toMatchObject({ date: first.date, logs: [expect.objectContaining({ kg: 62.5, reps: 8 })] })
    // et la fiche du coach garde la dernière séance
    expect(c.s.summarizeClient(d, d.profiles.find((p) => p.id === me.id)!, addDays(first.date, 2)).lastDone).toBe(first.date)
    // le dernier questionnaire est en mode libre
    expect(c.s.questionnaireOf(d, me.id)!.mode).toBe('libre')
  })

  it('MIND → Libre « partir de zéro » : carnet vide', () => {
    const { me, first } = clientWithHistory(c)
    const created = c.s.switchToLibre(me.id, false, first.date)!
    expect(created.libre!.templates).toHaveLength(0)
    expect(c.adapt.allSessions(created)).toHaveLength(0)
  })

  it('Libre → MIND : le formulaire génère un nouveau programme, le carnet est archivé, l\'historique reste', () => {
    const { me, first, exerciseId } = clientWithHistory(c)
    const libre = c.s.switchToLibre(me.id, true, addDays(first.date, 1))!
    const q = c.s.questionnaireOf(c.s.getDB(), me.id)!
    const next = c.s.submitQuestionnaire(me.id, { ...q, mode: 'genere' }, addDays(first.date, 2))
    const d = c.s.getDB()
    expect(next.mode).not.toBe('libre')
    expect(c.s.programOf(d, me.id)!.id).toBe(next.id)
    expect(d.programs.find((p) => p.id === libre.id)!.status).toBe('archive')
    expect(d.programs.filter((p) => p.clientId === me.id)).toHaveLength(3)
    const some = c.adapt.allSessions(next).find((x) => x.exercises?.some((e) => e.exerciseId === exerciseId))
    if (some) expect(c.s.lastPerformance(d, me.id, exerciseId, some.id)?.logs[0].kg).toBe(62.5)
  })

  it('un client en mode libre qui modifie son formulaire garde ses séances et son planning', () => {
    const { me, first } = clientWithHistory(c)
    const libre = c.s.switchToLibre(me.id, true, first.date)!
    const q = c.s.questionnaireOf(c.s.getDB(), me.id)!
    const again = c.s.submitQuestionnaire(me.id, { ...q, injuryNote: 'Genou fragile' }, first.date)
    expect(again.id).toBe(libre.id)
    expect(again.libre!.templates).toEqual(libre.libre!.templates)
    expect(c.s.getDB().programs.filter((p) => p.clientId === me.id && p.status === 'actif')).toHaveLength(1)
  })
})

describe('mode libre : tâches automatiques désactivées', () => {
  let c: Ctx
  beforeEach(async () => { c = await fresh() })

  it('runDailyJobs : séances manquées « manquées », rien de déplacé, aucune adaptation, fenêtre prolongée', () => {
    const { me, first } = clientWithHistory(c)
    const libre = c.s.switchToLibre(me.id, true, first.date)!
    const before = c.adapt.allSessions(libre).length
    const later = addDays(first.date, 21)
    c.s.runDailyJobs(later)
    const d = c.s.getDB()
    const p = c.s.programOf(d, me.id)!
    expect(d.adaptations.filter((a) => a.programId === p.id)).toHaveLength(0)
    const s = c.adapt.allSessions(p)
    expect(s.every((x) => !x.movedFrom && !x.lighten)).toBe(true)
    expect(s.filter((x) => x.date < later && x.status !== 'faite').every((x) => x.status === 'manquee')).toBe(true)
    expect(s.length).toBeGreaterThan(before)
    expect(p.weeks[p.weeks.length - 1].startDate >= addDays(later, 7 * 4 - 6)).toBe(true) // 4 semaines d'avance
    // un bilan de la semaine passée existe, sans suggestion qui touche à la structure
    expect(d.adaptations.filter((a) => a.kind === 'suggestion_ia')).toHaveLength(0)
  })

  it('check-in avec douleur : le coach est alerté, mais rien n\'est remplacé ni allégé automatiquement', () => {
    const { me, first } = clientWithHistory(c)
    const libre = c.s.switchToLibre(me.id, true, first.date)!
    const target = c.adapt.allSessions(libre).filter((x) => x.status === 'prevue').sort((a, b) => a.date.localeCompare(b.date))[0]
    const exBefore = JSON.stringify(target.exercises)
    // un coach existe
    c.s.signUp('coach@mind.app', 'secret1', 'Max')
    c.s.signIn('theo@test.fr', 'secret1')
    c.s.addCheckin({ clientId: me.id, sessionId: target.id, date: target.date, energy: 1, sleep: 1, soreness: 5, pain: true, painZone: 'epaule' }, target.date)
    const d = c.s.getDB()
    const after = c.adapt.allSessions(c.s.programOf(d, me.id)!).find((x) => x.id === target.id)!
    expect(JSON.stringify(after.exercises)).toBe(exBefore)
    expect(after.lighten).toBeUndefined()
    expect(d.adaptations.filter((a) => a.programId === libre.id)).toHaveLength(0)
    expect(d.notifications.some((n) => n.title === 'Douleur signalée')).toBe(true)
  })

  it('acceptAdaptation et startNextCycle ignorent un programme libre', () => {
    const { me, first } = clientWithHistory(c)
    const libre = c.s.switchToLibre(me.id, true, first.date)!
    c.s.startNextCycle(me.id)
    expect(c.s.getDB().programs.filter((p) => p.clientId === me.id)).toHaveLength(2) // pas de nouveau cycle
    c.s.addSuggestions([{ id: 'ad1', clientId: me.id, programId: libre.id, date: first.date, kind: 'suggestion_ia', status: 'propose', text: 'Alléger', payload: { type: 'scale_week', weekN: 1, factor: 0.5 } }])
    const sets = JSON.stringify(c.adapt.allSessions(libre).map((x) => x.exercises?.map((e) => e.sets)))
    c.s.acceptAdaptation('ad1', first.date)
    expect(JSON.stringify(c.adapt.allSessions(c.s.programOf(c.s.getDB(), me.id)!).map((x) => x.exercises?.map((e) => e.sets)))).toBe(sets)
  })
})

describe('mode libre : modèles, exercices perso, coach', () => {
  let c: Ctx
  beforeEach(async () => { c = await fresh() })

  it('un exercice perso se résout partout (nom, muscle) et reste suivi ; les ids sont reconnaissables', () => {
    const { me, first } = clientWithHistory(c)
    const libre = c.s.switchToLibre(me.id, false, first.date)!
    const id = c.s.addCustomExercise(libre.id, 'Rowing Yates', 'dos')
    expect(id.startsWith('custom:')).toBe(true)
    expect(c.ex.EXERCISE_BY_ID[id].name).toBe('Rowing Yates')
    expect(c.ex.exerciseOf(id).muscle).toBe('dos')
    expect(c.s.customExercisesOf(c.s.getDB(), me.id).map((e) => e.id)).toContain(id)
    const t = c.libre.newTemplate('Dos')
    t.exercises = [c.libre.newTemplateExercise(id)]
    c.s.saveTemplate(libre.id, t)
    c.s.setPlanning(libre.id, { mode: 'fixe', days: [t.id, null, null, null, null, null, null] })
    const p = c.s.programOf(c.s.getDB(), me.id)!
    const session = c.adapt.allSessions(p).find((x) => x.templateId === t.id && x.status === 'prevue')!
    expect(session.exercises![0].exerciseId).toBe(id)
    // log + fin de séance : records, tonnage et « dernière performance » fonctionnent avec l'exercice perso
    c.s.logSet(p.id, session.id, session.exercises![0].id, { n: 1, kg: 40, reps: 10, rir: 2, at: new Date().toISOString() })
    const recap = c.s.finishStrength(p.id, session.id, 7, 30, session.date)
    expect(recap.tonnage).toBe(400)
    const next = c.adapt.allSessions(c.s.programOf(c.s.getDB(), me.id)!).find((x) => x.templateId === t.id && x.status === 'prevue')!
    expect(c.s.lastPerformance(c.s.getDB(), me.id, id, next.id)?.logs[0].kg).toBe(40)
  })

  it('le coach modifie une séance du client : le client reçoit « Max a modifié ta séance … »', () => {
    const { me, first } = clientWithHistory(c)
    const libre = c.s.switchToLibre(me.id, true, first.date)!
    const tpl = libre.libre!.templates[0]
    c.s.signUp('coach@mind.app', 'secret1', 'Max') // la session devient celle du coach
    c.s.saveTemplate(libre.id, { ...tpl, exercises: tpl.exercises.slice(0, -1) })
    const d = c.s.getDB()
    expect(d.notifications.some((n) => n.userId === me.id && n.title === `Max a modifié ta séance ${tpl.name}`)).toBe(true)
    c.s.setPlanning(libre.id, { mode: 'rotation', days: [0, 2], order: libre.libre!.templates.map((t) => t.id) })
    expect(c.s.getDB().notifications.some((n) => n.userId === me.id && n.title === 'Max a modifié ton planning')).toBe(true)
    // quand c'est le client lui-même, aucune notification
    c.s.signIn('theo@test.fr', 'secret1')
    const n0 = c.s.getDB().notifications.length
    c.s.saveTemplate(libre.id, { ...tpl, name: 'Renommée' })
    expect(c.s.getDB().notifications.length).toBe(n0)
  })

  it('supprimer un modèle le retire du planning ; l\'historique des séances faites reste', () => {
    const { me, first } = clientWithHistory(c)
    const libre = c.s.switchToLibre(me.id, true, first.date)!
    const tpl = libre.libre!.templates[0]
    c.s.deleteTemplate(libre.id, tpl.id)
    const p = c.s.programOf(c.s.getDB(), me.id)!
    expect(p.libre!.templates.find((t) => t.id === tpl.id)).toBeUndefined()
    expect(c.adapt.allSessions(p).some((x) => x.templateId === tpl.id && x.status === 'prevue')).toBe(false)
    expect(c.adapt.allSessions(c.s.getDB().programs.find((x) => x.id !== p.id && x.clientId === me.id)!).some((x) => x.status === 'faite')).toBe(true)
  })

  it('suggestions de charge : interrupteur stocké dans le programme, charges cibles seulement quand il est activé', () => {
    const { me, first } = clientWithHistory(c)
    const libre = c.s.switchToLibre(me.id, true, first.date)!
    const tplId = libre.libre!.templates[0].id
    const target = () => c.adapt.allSessions(c.s.programOf(c.s.getDB(), me.id)!).filter((x) => x.templateId === tplId && x.status === 'prevue' && !x.extra)
    const sess = target()[0]
    c.s.logSet(libre.id, sess.id, sess.exercises![0].id, { n: 1, kg: 70, reps: 12, rir: 2, at: new Date().toISOString() })
    c.s.finishStrength(libre.id, sess.id, 7, 30, sess.date)
    expect(target().every((x) => x.exercises!.every((e) => e.targetKg === undefined))).toBe(true) // désactivé par défaut
    c.s.setSuggestLoads(libre.id, true)
    expect(c.s.programOf(c.s.getDB(), me.id)!.libre!.suggestLoads).toBe(true)
    expect(target().some((x) => x.exercises!.some((e) => e.targetKg !== undefined && e.targetKg >= 70))).toBe(true)
    c.s.setSuggestLoads(libre.id, false)
    expect(target().every((x) => x.exercises!.every((e) => e.targetKg === undefined))).toBe(true)
  })

  it('séance en plus : datée d\'aujourd\'hui, comptée dans les stats, planning inchangé', () => {
    const { me, first } = clientWithHistory(c)
    const libre = c.s.switchToLibre(me.id, true, first.date)!
    const plan = () => JSON.stringify(c.adapt.allSessions(c.s.programOf(c.s.getDB(), me.id)!).filter((x) => !x.extra && x.status === 'prevue').map((x) => [x.date, x.templateId]))
    const before = plan()
    const id = c.s.addExtraSession(libre.id, { templateId: libre.libre!.templates[0].id }, first.date)
    const p = c.s.programOf(c.s.getDB(), me.id)!
    const extra = c.adapt.allSessions(p).find((x) => x.id === id)!
    expect(extra.extra).toBe(true)
    expect(extra.date).toBe(first.date)
    c.s.logSet(p.id, id, extra.exercises![0].id, { n: 1, kg: 50, reps: 8, rir: 2, at: new Date().toISOString() })
    c.s.finishStrength(p.id, id, 8, 30, first.date)
    expect(plan()).toBe(before)
    const week = p.weeks.find((w) => w.sessions.some((x) => x.id === id))!
    expect(c.adapt.weekStats(c.s.programOf(c.s.getDB(), me.id)!, week.n).done).toBeGreaterThanOrEqual(1)
  })
})

describe('démo : Nina (mode libre)', () => {
  it('Nina est créée avec le seed : PPL 4×/semaine en rotation, 3 semaines d\'historique, un exercice perso ; ajoutée aussi à une démo déjà existante', async () => {
    const c = await fresh()
    const seed = await import('./seed')
    seed.ensureSeed()
    let d = c.s.getDB()
    const nina = d.profiles.find((p) => p.firstName === 'Nina')!
    expect(d.users.find((u) => u.email === 'nina@demo.mind')).toBeTruthy()
    const p = c.s.programOf(d, nina.id)!
    expect(p.mode).toBe('libre')
    expect(p.libre!.planning).toMatchObject({ mode: 'rotation', days: [0, 1, 3, 4] })
    expect(p.libre!.templates.map((t) => t.name)).toEqual(['Push', 'Pull', 'Legs'])
    expect(p.libre!.customExercises).toHaveLength(1)
    const done = c.adapt.allSessions(p).filter((s) => s.status === 'faite')
    expect(done.length).toBeGreaterThanOrEqual(10)
    // charges qui progressent : le développé couché de la dernière semaine est plus lourd que celui de la première
    const bench = done.filter((s) => s.exercises?.some((e) => e.exerciseId === 'dev_couche_barre')).sort((a, b) => a.date.localeCompare(b.date))
    const kg = (s: (typeof bench)[number]) => Math.max(...s.exercises!.find((e) => e.exerciseId === 'dev_couche_barre')!.logs.map((l) => l.kg))
    expect(kg(bench[bench.length - 1])).toBeGreaterThan(kg(bench[0]))
    // visible côté coach
    expect(c.s.clientsOf(d).some((x) => x.id === nina.id)).toBe(true)
    // démo créée avant le mode libre : Nina est ajoutée sans toucher au reste
    c.s.mutate((x) => { x.users = x.users.filter((u) => u.email !== 'nina@demo.mind'); x.profiles = x.profiles.filter((q) => q.id !== nina.id); x.programs = x.programs.filter((q) => q.clientId !== nina.id) })
    const others = c.s.getDB().profiles.length
    seed.ensureSeed()
    d = c.s.getDB()
    expect(d.profiles.length).toBe(others + 1)
    expect(d.profiles.filter((q) => q.firstName === 'Nina')).toHaveLength(1)
    seed.ensureSeed()
    expect(c.s.getDB().profiles.length).toBe(others + 1) // idempotent
  })
})

describe('muscu libre + course MIND (store)', () => {
  let c: Ctx
  beforeEach(async () => { c = await fresh() })
  const race = '2026-06-14'
  const hybridQ = (firstName: string) => ({
    ...P_DEBUTANT, firstName, mode: 'libre' as const, programType: 'mixte' as const, runSessions: 3, startDate: MON, availableDays: [1, 3, 5], dayPrefs: { run: [1, 3, 5], longRun: 5 },
    run: { distance: '10k' as const, raceDate: race, objective: 'finir' as const, level: 'intermediaire' as const, weeklyKm: 20, longestKm: 10, vma: 15 },
  })
  function hybrid() {
    c.s.signUp('lea@test.fr', 'secret1', 'Léa')
    const me = c.s.currentUser()!
    const p = c.s.submitQuestionnaire(me.id, hybridQ('Léa'), MON)
    const t = c.libre.newTemplate('Push')
    t.exercises = [c.libre.newTemplateExercise('dev_couche_barre')]
    c.s.saveTemplate(p.id, t)
    c.s.setPlanning(p.id, { mode: 'fixe', days: [t.id, null, null, null, null, null, null] })
    return { me, id: p.id }
  }
  const prog = (me: { id: string }) => c.s.programOf(c.s.getDB(), me.id)!

  it('le formulaire libre avec course crée un carnet libre + un plan de course MIND', () => {
    const { me } = hybrid()
    const p = prog(me)
    expect(p.mode).toBe('libre')
    expect(p.type).toBe('mixte')
    expect(c.adapt.allSessions(p).some((s) => s.sport === 'course')).toBe(true)
    expect(c.adapt.allSessions(p).filter((s) => s.sport === 'muscu').every((s) => s.templateId)).toBe(true)
  })

  it('séance de course manquée : le moteur la déplace (adaptation) ; la muscu libre manquée n\'est jamais déplacée', () => {
    const { me } = hybrid()
    const key = c.adapt.allSessions(prog(me)).find((s) => s.sport === 'course' && (s.kind === 'longue' || ['vma', 'seuil', 'cotes', 'fartlek'].includes(s.kind)))!
    c.s.runDailyJobs(addDays(key.date, 1))
    const d = c.s.getDB()
    const p = c.s.programOf(d, me.id)!
    const adapts = d.adaptations.filter((a) => a.programId === p.id)
    expect(adapts.length).toBeGreaterThan(0)
    expect(adapts.every((a) => a.kind === 'deplacee' || a.kind === 'sautee')).toBe(true)
    expect(c.adapt.allSessions(p).filter((s) => s.sport === 'muscu').every((s) => !s.movedFrom)).toBe(true)
  })

  it('check-in avec douleur : la course est allégée, la muscu libre reste intacte', () => {
    const { me } = hybrid()
    const runS = c.adapt.allSessions(prog(me)).filter((s) => s.sport === 'course' && s.status === 'prevue')[1]
    const muscuS = c.adapt.allSessions(prog(me)).find((s) => s.sport === 'muscu' && s.status === 'prevue')!
    const muscuBefore = JSON.stringify(muscuS.exercises)
    c.s.addCheckin({ clientId: me.id, sessionId: muscuS.id, date: muscuS.date, energy: 1, sleep: 1, soreness: 5, pain: false }, muscuS.date)
    c.s.addCheckin({ clientId: me.id, sessionId: runS.id, date: runS.date, energy: 1, sleep: 1, soreness: 5, pain: false }, runS.date)
    const after = c.adapt.allSessions(prog(me))
    expect(JSON.stringify(after.find((s) => s.id === muscuS.id)!.exercises)).toBe(muscuBefore)
    expect(after.find((s) => s.id === muscuS.id)!.lighten).toBeUndefined()
    expect(after.find((s) => s.id === runS.id)!.lighten).toBe(true)
  })

  it('suggestion d\'allures acceptée ; suggestion de structure (alléger la semaine) refusée', () => {
    const { me, id } = hybrid()
    const p = prog(me)
    const firstRun = c.adapt.allSessions(p).find((s) => s.sport === 'course' && s.status === 'prevue' && s.run!.blocks.some((b) => b.paceSec))!
    const pace = firstRun.run!.blocks.find((b) => b.paceSec)!.paceSec!
    c.s.addSuggestions([
      { id: 'a1', clientId: me.id, programId: id, date: MON, kind: 'allures', status: 'propose', text: 'VMA', payload: { vma: p.paces!.vma + 1 } },
      { id: 'a2', clientId: me.id, programId: id, date: MON, kind: 'suggestion_ia', status: 'propose', text: 'Alléger', payload: { type: 'scale_week', weekN: 1, factor: 0.5 } },
    ])
    const setsBefore = JSON.stringify(c.adapt.allSessions(p).filter((s) => s.sport === 'muscu').map((s) => s.exercises?.map((e) => e.sets)))
    c.s.acceptAdaptation('a1', MON)
    c.s.acceptAdaptation('a2', MON)
    const after = prog(me)
    expect(c.adapt.allSessions(after).find((s) => s.id === firstRun.id)!.run!.blocks.find((b) => b.paceSec)!.paceSec).toBeLessThan(pace)
    expect(JSON.stringify(c.adapt.allSessions(after).filter((s) => s.sport === 'muscu').map((s) => s.exercises?.map((e) => e.sets)))).toBe(setsBefore)
    expect(c.s.getDB().adaptations.find((a) => a.id === 'a2')!.status).toBe('refuse')
  })

  it('modifier le formulaire régénère le plan de course sans toucher aux séances libres ni au planning', () => {
    const T = todayISO() // une seule horloge : les actions du store utilisent la date du jour
    c.s.signUp('lea2@test.fr', 'secret1', 'Léa')
    const me = c.s.currentUser()!
    const q0 = { ...hybridQ('Léa'), startDate: T, run: { ...hybridQ('Léa').run, raceDate: addDays(T, 84) } }
    const id = c.s.submitQuestionnaire(me.id, q0, T).id
    const t = c.libre.newTemplate('Push')
    t.exercises = [c.libre.newTemplateExercise('dev_couche_barre')]
    c.s.saveTemplate(id, t)
    c.s.setPlanning(id, { mode: 'fixe', days: [t.id, null, null, null, null, null, null] })
    const before = prog(me)
    const muscuBefore = JSON.stringify(c.adapt.allSessions(before).filter((s) => s.sport === 'muscu').map((s) => [s.date, s.title]))
    const q = { ...c.s.questionnaireOf(c.s.getDB(), me.id)!, run: { ...before.q.run, distance: 'semi' as const, raceDate: addDays(T, 112) } }
    c.s.submitQuestionnaire(me.id, q, T)
    const after = prog(me)
    expect(after.id).toBe(id)
    expect(after.raceDistance).toBe('semi')
    expect(after.raceDate).toBe(addDays(T, 112))
    expect(JSON.stringify(c.adapt.allSessions(after).filter((s) => s.sport === 'muscu').map((s) => [s.date, s.title]))).toBe(muscuBefore)
    expect(after.libre!.templates).toEqual(before.libre!.templates)
    // retirer la course
    c.s.submitQuestionnaire(me.id, { ...q, programType: 'muscu' }, T)
    const none = prog(me)
    expect(none.type).toBe('muscu')
    expect(c.adapt.allSessions(none).filter((s) => s.sport === 'course' && s.status === 'prevue')).toHaveLength(0)
    expect(JSON.stringify(c.adapt.allSessions(none).filter((s) => s.sport === 'muscu').map((s) => [s.date, s.title]))).toBe(muscuBefore)
  })

  it('MIND mixte → libre garde le plan de course ; un programme de course seule ne peut pas passer en libre', () => {
    c.s.signUp('max@test.fr', 'secret1', 'Max')
    const me = c.s.currentUser()!
    const g = c.s.submitQuestionnaire(me.id, { ...hybridQ('Max'), mode: 'genere' }, MON)
    expect(g.type).toBe('mixte')
    const libre = c.s.switchToLibre(me.id, true, MON)!
    expect(libre.type).toBe('mixte')
    expect(c.adapt.allSessions(libre).some((s) => s.sport === 'course' && s.status === 'prevue')).toBe(true)
    expect(libre.libre!.templates.length).toBeGreaterThan(0)

    c.s.signUp('run@test.fr', 'secret1', 'Rémi')
    const r = c.s.currentUser()!
    const runOnly = c.s.submitQuestionnaire(r.id, { ...hybridQ('Rémi'), mode: 'genere', programType: 'course' }, MON)
    expect(runOnly.type).toBe('course')
    expect(c.s.switchToLibre(r.id, true, MON)).toBeUndefined()
    expect(c.s.programOf(c.s.getDB(), r.id)!.id).toBe(runOnly.id)
  })

  it('muscu MIND + course libre : une sortie libre se saisit, sans rien décaler ; jamais comptée comme manquée', () => {
    c.s.signUp('paul@test.fr', 'secret1', 'Paul')
    const me = c.s.currentUser()!
    const g = c.s.submitQuestionnaire(me.id, { ...P_DEBUTANT, firstName: 'Paul', startDate: MON }, MON)
    expect(g.type).toBe('muscu')
    const planned = () => JSON.stringify(c.adapt.allSessions(c.s.programOf(c.s.getDB(), me.id)!).filter((s) => !s.extra).map((s) => [s.date, s.title, s.status]))
    const before = planned()
    const id = c.s.addExtraSession(g.id, 'course', MON)
    expect(id).not.toBe('')
    expect(c.s.addExtraSession(g.id, 'vide', MON)).toBe('') // seule la sortie libre existe hors mode libre
    const p = c.s.programOf(c.s.getDB(), me.id)!
    c.s.logRun(p.id, id, { km: 6, seconds: 2100, feeling: 6, comment: '' }, MON)
    expect(c.adapt.allSessions(c.s.programOf(c.s.getDB(), me.id)!).find((s) => s.id === id)!.runLog!.km).toBe(6)
    expect(planned()).toBe(before)
    // une sortie libre jamais commencée disparaît le lendemain
    const id2 = c.s.addExtraSession(g.id, 'course', addDays(MON, 1))
    c.s.runDailyJobs(addDays(MON, 3))
    const after = c.adapt.allSessions(c.s.programOf(c.s.getDB(), me.id)!)
    expect(after.find((s) => s.id === id2)).toBeUndefined()
    expect(after.find((s) => s.id === id)!.status).toBe('faite')
  })
})
