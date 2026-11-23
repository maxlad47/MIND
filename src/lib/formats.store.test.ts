// Formats au niveau du store : saisie du combo 1 + 6 × 3, dernière performance partie par partie, groupes, diff modèle, ancien programme.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BASE_Q, P_DEBUTANT } from '@/engine/fixtures'
import { addDays } from '@/engine/utils'

const MON = '2026-03-02' // un lundi

async function fresh() {
  vi.resetModules()
  const mem = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) })
  vi.doMock('./supabase', () => ({ supabase: null, REMOTE: false }))
  const s = await import('./store')
  const libre = await import('@/engine/libre')
  const adapt = await import('@/engine/adapt')
  const f = await import('@/engine/formats')
  const ex = await import('@/engine/exercises')
  return { s, libre, adapt, f, ex }
}
type Ctx = Awaited<ReturnType<typeof fresh>>

/** Carnet libre avec une séance « Push » : développé couché en combo (1 + 6 × 3), puis un superset. */
function carnet(c: Ctx) {
  c.s.signUp('nina@test.fr', 'secret1', 'Nina')
  const me = c.s.currentUser()!
  const q = { ...BASE_Q, firstName: 'Nina', mode: 'libre' as const, programType: 'muscu' as const, startDate: MON }
  const prog = c.s.submitQuestionnaire(me.id, q, MON)
  const bench = Object.assign(c.libre.newTemplateExercise('dev_couche_barre'), c.f.applyFormat('combo', { sets: 3, repMin: 6, repMax: 10 }), { restSec: 150 })
  const row = c.libre.newTemplateExercise('rowing_barre')
  const curl = c.libre.newTemplateExercise('curl_halteres')
  const tpl = { ...c.libre.newTemplate('Push'), exercises: [bench, row, curl], groups: [{ ...c.f.defaultGroup('superset', [row.id, curl.id]), rounds: 3 }] }
  c.s.saveTemplate(prog.id, tpl)
  c.s.setPlanning(prog.id, { mode: 'fixe', days: ['x', null, null, null, null, null, null].map((x) => (x ? tpl.id : null)) })
  const p = c.s.programOf(c.s.getDB(), me.id)!
  const session = c.adapt.allSessions(p).filter((x) => x.templateId === tpl.id).sort((a, b) => a.date.localeCompare(b.date))[0]
  return { me, prog: p, session, tpl }
}

describe('combo 1 + 6 × 3 : saisie et dernière performance', () => {
  let c: Ctx
  beforeEach(async () => { c = await fresh() })

  it('la séance issue du modèle garde le format, le détail des séries et le superset', () => {
    const { session } = carnet(c)
    const bench = session.exercises![0]
    expect(bench.format).toBe('combo')
    expect(bench.plan).toHaveLength(3)
    expect(bench.sets).toBe(3)
    expect(session.groups).toHaveLength(1)
    expect(session.groups![0].kind).toBe('superset')
    expect(c.f.formatLabel(bench)).toBe('Combo · 1 + 6')
  })

  it('saisie partie par partie, puis « 1 × 100 kg + 6 × 80 kg » à la séance suivante', () => {
    const { me, prog, session } = carnet(c)
    const bench = session.exercises![0]
    for (const n of [1, 2, 3]) {
      c.s.logSet(prog.id, session.id, bench.id, { n, part: 0, kg: 100, reps: 1, rir: 1, at: `${session.date}T10:00:00.000Z` })
      expect(c.f.isSetDone(c.s.getDB().programs[0].weeks.flatMap((w) => w.sessions).find((x) => x.id === session.id)!.exercises![0], n)).toBe(false) // une partie ne suffit pas
      c.s.logSet(prog.id, session.id, bench.id, { n, part: 1, kg: 80, reps: 6, rir: 2, at: `${session.date}T10:01:00.000Z` })
    }
    const done = c.adapt.findSession(c.s.getDB().programs[0], session.id)!
    expect(done.exercises![0].logs).toHaveLength(6)
    expect(c.f.doneSetsOf(done.exercises![0])).toBe(3)
    // fin de séance : tonnage de toutes les parties, séries comptées par série
    const recap = c.s.finishStrength(prog.id, session.id, 7, 45, session.date)
    expect(recap.tonnage).toBe(3 * (100 * 1 + 80 * 6))
    // la séance suivante affiche la dernière performance partie par partie
    const next = c.adapt.allSessions(c.s.programOf(c.s.getDB(), me.id)!).filter((x) => x.templateId === session.templateId && x.date > session.date && x.status === 'prevue')[0]
    const last = c.s.lastPerformance(c.s.getDB(), me.id, bench.exerciseId, next.id)!
    expect(last.date).toBe(session.date)
    expect(last.sets).toHaveLength(3)
    expect(c.f.describeLastSet(last.sets[0])).toBe('1 × 100 kg + 6 × 80 kg')
  })

  it('annuler une partie ne retire que cette partie ; annuler la série retire toutes ses parties', () => {
    const { prog, session } = carnet(c)
    const id = session.exercises![0].id
    const at = `${session.date}T10:00:00.000Z`
    c.s.logSet(prog.id, session.id, id, { n: 1, part: 0, kg: 100, reps: 1, rir: 1, at })
    c.s.logSet(prog.id, session.id, id, { n: 1, part: 1, kg: 80, reps: 6, rir: 2, at })
    c.s.unlogSet(prog.id, session.id, id, 1, 1)
    expect(c.adapt.findSession(c.s.getDB().programs[0], session.id)!.exercises![0].logs.map((l) => l.part)).toEqual([0])
    c.s.logSet(prog.id, session.id, id, { n: 1, part: 1, kg: 80, reps: 6, rir: 2, at })
    c.s.unlogSet(prog.id, session.id, id, 1)
    expect(c.adapt.findSession(c.s.getDB().programs[0], session.id)!.exercises![0].logs).toHaveLength(0)
  })

  it('la 1RM estimée prend la meilleure partie : la rep lourde d\'un combo compte pour un record', () => {
    const { me, prog, session } = carnet(c)
    const bench = session.exercises![0]
    // première séance : séries classiques à 80 kg × 6 (1RM ≈ 96)
    c.s.logSet(prog.id, session.id, bench.id, { n: 1, part: 0, kg: 80, reps: 6, rir: 2, at: `${session.date}T10:00:00.000Z` })
    c.s.finishStrength(prog.id, session.id, 7, 40, session.date)
    const next = c.adapt.allSessions(c.s.programOf(c.s.getDB(), me.id)!).filter((x) => x.templateId === session.templateId && x.status === 'prevue')[0]
    c.s.logSet(prog.id, next.id, next.exercises![0].id, { n: 1, part: 0, kg: 100, reps: 1, rir: 0, at: `${next.date}T10:00:00.000Z` }) // rep lourde : 1RM 100 > 96
    c.s.logSet(prog.id, next.id, next.exercises![0].id, { n: 1, part: 1, kg: 60, reps: 6, rir: 3, at: `${next.date}T10:01:00.000Z` })
    const r = c.s.finishStrength(prog.id, next.id, 8, 45, next.date)
    expect(r.prs.map((p) => p.exerciseId)).toContain('dev_couche_barre')
    expect(r.prs.find((p) => p.exerciseId === 'dev_couche_barre')).toMatchObject({ kg: 100, reps: 1 })
  })
})

describe('groupes dans le store', () => {
  let c: Ctx
  beforeEach(async () => { c = await fresh() })

  it('« Tour N fait » valide d\'un coup les exercices du tour, sans exiger charges ni reps', () => {
    const { prog, session } = carnet(c)
    const g = session.groups![0]
    c.s.logRound(prog.id, session.id, g.id, 1)
    const s2 = c.adapt.findSession(c.s.getDB().programs[0], session.id)!
    const [row, curl] = c.f.groupMembers(s2, s2.groups![0])
    expect(row.logs).toHaveLength(1)
    expect(curl.logs).toHaveLength(1)
    expect(row.logs[0]).toMatchObject({ n: 1, kg: 0 })
    expect(c.f.roundsProgress(s2, s2.groups![0])).toMatchObject({ doneRounds: 1, next: { round: 2, index: 0 } })
    c.s.unlogRound(prog.id, session.id, g.id, 1)
    expect(c.f.roundsProgress(c.adapt.findSession(c.s.getDB().programs[0], session.id)!, g).doneRounds).toBe(0)
  })

  it('dégrouper garde les exercices ; retirer un exercice dissout un superset', () => {
    const { prog, session } = carnet(c)
    c.s.deleteGroup(prog.id, session.id, session.groups![0].id)
    let s2 = c.adapt.findSession(c.s.getDB().programs[0], session.id)!
    expect(s2.groups).toBeUndefined()
    expect(s2.exercises).toHaveLength(3)
    // recrée un groupe, puis retire un exercice
    c.s.createGroup(prog.id, session.id, c.f.defaultGroup('superset', [s2.exercises![1].id, s2.exercises![2].id]))
    s2 = c.adapt.findSession(c.s.getDB().programs[0], session.id)!
    expect(s2.groups).toHaveLength(1)
    c.s.removeExercise(prog.id, session.id, s2.exercises![2].id)
    expect(c.adapt.findSession(c.s.getDB().programs[0], session.id)!.groups).toBeUndefined()
  })

  it('EMOM : le départ est un horodatage, le résultat se saisit une fois', () => {
    const { prog, session } = carnet(c)
    const id = c.s.addExercise(prog.id, session.id, 'pogo')
    c.s.createGroup(prog.id, session.id, { ...c.f.defaultGroup('emom', [id]), durationMin: 8 })
    const g = c.adapt.findSession(c.s.getDB().programs[0], session.id)!.groups!.find((x) => x.kind === 'emom')!
    expect(g.startedAt).toBeUndefined()
    c.s.startGroup(prog.id, session.id, g.id, 1_000_000)
    c.s.finishGroup(prog.id, session.id, g.id, { minutesDone: 7 })
    const done = c.adapt.findSession(c.s.getDB().programs[0], session.id)!.groups!.find((x) => x.kind === 'emom')!
    expect(done.startedAt).toBe(1_000_000)
    expect(done.result).toMatchObject({ minutesDone: 7 })
    expect(c.f.sessionProgress(c.adapt.findSession(c.s.getDB().programs[0], session.id)!).done).toBe(1) // le bloc compte pour un
  })

  it('« Format » d\'un exercice de la séance : combo préremplie, retour au classique', () => {
    const { prog, session } = carnet(c)
    const curl = session.exercises![2].id
    c.s.setExerciseFormat(prog.id, session.id, session.exercises![1].id, 'combo') // dans un groupe → la structure du groupe l'emporte à la normalisation
    c.s.addExercise(prog.id, session.id, 'curl_marteau')
    const s2 = c.adapt.findSession(c.s.getDB().programs[0], session.id)!
    const added = s2.exercises!.at(-1)!
    c.s.setExerciseFormat(prog.id, session.id, added.id, 'degressive')
    const e = c.adapt.findSession(c.s.getDB().programs[0], session.id)!.exercises!.at(-1)!
    expect(e.format).toBe('degressive')
    expect(e.plan![e.plan!.length - 1].parts).toHaveLength(3)
    c.s.setExerciseFormat(prog.id, session.id, added.id, 'classique')
    expect(c.adapt.findSession(c.s.getDB().programs[0], session.id)!.exercises!.at(-1)!.plan).toBeUndefined()
    void curl
  })
})

describe('fin de séance du mode libre : « Tu as changé N choses »', () => {
  let c: Ctx
  beforeEach(async () => { c = await fresh() })

  it('changement de format, de groupe et de parties détectés ; les charges jamais', () => {
    const { prog, session, tpl } = carnet(c)
    const tplNow = () => c.s.getDB().programs[0].libre!.templates.find((t) => t.id === tpl.id)!
    const cur = () => c.adapt.findSession(c.s.getDB().programs[0], session.id)!
    expect(c.libre.diffSessionTemplate(cur(), tplNow())).toEqual([])
    // une charge saisie : aucun changement
    c.s.logSet(prog.id, session.id, cur().exercises![0].id, { n: 1, part: 0, kg: 100, reps: 1, rir: 1, at: `${session.date}T10:00:00.000Z` })
    expect(c.libre.diffSessionTemplate(cur(), tplNow())).toEqual([])
    // format : combo → dégressive
    c.s.setExerciseFormat(prog.id, session.id, cur().exercises![0].id, 'degressive')
    expect(c.libre.diffSessionTemplate(cur(), tplNow()).map((x) => x.kind)).toContain('format')
    // retour au combo : identique
    c.s.setExerciseFormat(prog.id, session.id, cur().exercises![0].id, 'combo')
    expect(c.libre.diffSessionTemplate(cur(), tplNow())).toEqual([])
    // partie modifiée (6 → 8 reps) : « séries modifiées »
    const plan = structuredClone(cur().exercises![0].plan!)
    plan[0].parts[1].reps = 8
    c.s.updateExercise(prog.id, session.id, cur().exercises![0].id, { plan })
    expect(c.libre.diffSessionTemplate(cur(), tplNow()).some((x) => x.kind === 'format' && /séries modifiées/.test(x.text))).toBe(true)
    // groupe : tours 3 → 4
    c.s.setExerciseFormat(prog.id, session.id, cur().exercises![0].id, 'combo')
    c.s.updateGroup(prog.id, session.id, cur().groups![0].id, { rounds: 4 })
    const d = c.libre.diffSessionTemplate(cur(), tplNow())
    expect(d.some((x) => x.kind === 'groupe' && /3 tours → 4 tours/.test(x.text))).toBe(true)
    // groupe défait : « groupe retiré »
    c.s.deleteGroup(prog.id, session.id, cur().groups![0].id)
    expect(c.libre.diffSessionTemplate(cur(), tplNow()).some((x) => x.kind === 'groupe' && /retiré/.test(x.text))).toBe(true)
    // les garder : le modèle reprend la structure (et jamais les charges)
    c.s.applySessionToTemplate(prog.id, session.id)
    expect(tplNow().groups).toBeUndefined()
    expect(c.libre.diffSessionTemplate(cur(), tplNow())).toEqual([])
    expect(JSON.stringify(tplNow())).not.toMatch(/"kg":100/)
  })

  it('« garder les changements » reprend un format et un groupe créés en séance', () => {
    const { prog, session, tpl } = carnet(c)
    const cur = () => c.adapt.findSession(c.s.getDB().programs[0], session.id)!
    c.s.setExerciseFormat(prog.id, session.id, cur().exercises![0].id, 'lourde')
    c.s.applySessionToTemplate(prog.id, session.id)
    const t = c.s.getDB().programs[0].libre!.templates.find((x) => x.id === tpl.id)!
    expect(t.exercises[0].format).toBe('lourde')
    expect(t.exercises[0].plan![0].parts[0]).toMatchObject({ reps: 3, repMax: 5 })
    expect(t.groups).toHaveLength(1)
    // les prochaines séances vierges suivent
    const later = c.adapt.allSessions(c.s.programOf(c.s.getDB(), prog.clientId)!).filter((x) => x.templateId === tpl.id && x.status === 'prevue' && x.date > session.date)
    expect(later.length).toBeGreaterThan(0)
    expect(later.every((x) => x.exercises![0].format === 'lourde')).toBe(true)
  })
})

describe('compatibilité : un ancien programme, sans les nouveaux champs, fonctionne comme avant', () => {
  let c: Ctx
  beforeEach(async () => { c = await fresh() })

  it('programme enregistré avant les formats : séries classiques, aucune structure en plus', () => {
    c.s.signUp('old@test.fr', 'secret1', 'Old')
    const me = c.s.currentUser()!
    const prog = c.s.submitQuestionnaire(me.id, { ...P_DEBUTANT, firstName: 'Old', startDate: MON }, MON)
    // simule un enregistrement d'avant : on retire tout ce que les formats ont ajouté
    const raw = JSON.parse(JSON.stringify(prog)) as typeof prog
    for (const s of c.adapt.allSessions(raw)) {
      delete s.groups; delete s.warmup
      for (const e of s.exercises ?? []) { delete e.plan; delete e.format; delete e.renfo }
    }
    const first = c.adapt.allSessions(raw).filter((x) => x.sport === 'muscu')[0]
    const e = first.exercises![0]
    expect(c.f.plannedSetsOf(e)).toHaveLength(e.sets)
    expect(c.f.setCountOf(e)).toBe(e.sets)
    expect(c.f.formatLabel(e)).toBeUndefined()
    expect(c.f.groupOf(first, e.id)).toBeUndefined()
    expect(c.f.restAfter(first, e, 1, 0)).toMatchObject({ sec: e.restSec, chain: false })
    // un SetLog ancien (sans part ni seconds) est lu comme la partie 0
    e.logs = [{ n: 1, kg: 60, reps: 8, rir: 2, at: `${first.date}T10:00:00.000Z` }]
    expect(c.f.isSetDone(e, 1)).toBe(true)
    expect(c.f.sessionProgress(first)).toEqual({ done: 1, total: first.exercises!.reduce((a, x) => a + x.sets, 0) })
    expect(c.f.nextLoadPlan(e)).toBeNull() // la double progression habituelle s'applique
    expect(c.adapt.nextLoad(e)).not.toBeNull()
    // il se charge dans le store et se termine sans erreur
    c.s.replaceProgram(raw)
    const done = c.s.finishStrength(raw.id, first.id, 7, 40, first.date)
    expect(done.sets).toBe(1)
    expect(done.tonnage).toBe(480)
    // un modèle ancien (sans groupes ni plan) se compare à sa séance
    const tpl = { id: 't', name: 'Old', exercises: [{ id: 'te1', exerciseId: e.exerciseId, sets: e.sets, repMin: e.repMin, repMax: e.repMax, restSec: e.restSec }] }
    expect(c.libre.diffSessionTemplate({ ...first, exercises: [{ ...e, id: 's.te1' }] }, tpl)).toEqual([])
    void addDays
  })
})
