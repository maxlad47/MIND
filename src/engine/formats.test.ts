// Formats de séance : séries différentes et parties enchaînées, groupes, ordre de passage, repos, dernière performance, progression.
import { describe, expect, it } from 'vitest'
import { nextLoad } from './adapt'
import { exerciseOf } from './exercises'
import {
  applyFormat, describeLastSet, describePlan, doneSetsOf, emomState, formatLabel, groupGuide, groupLogsBySet, groupStats, isSetDone, nextLoadPlan, normalizeGroups, pairOpposites,
  plannedSetsOf, relativeKg, restAfter, roundsProgress, sessionProgress, suggestedKg, amrapLeft, defaultGroup, groupMembers,
} from './formats'
import type { ExerciseGroup, Session, SessionExercise, SetLog } from './types'

const ex = (o: Partial<SessionExercise> & { id: string; exerciseId: string }): SessionExercise => ({ order: 0, sets: 3, repMin: 8, repMax: 10, rir: 2, restSec: 120, logs: [], ...o })
const log = (n: number, kg: number, reps: number, part?: number, rir = 2): SetLog => ({ n, kg, reps, rir, at: '2026-03-02T10:00:00.000Z', ...(part !== undefined ? { part } : {}) })
const sess = (exercises: SessionExercise[], groups?: ExerciseGroup[]): Session => ({
  id: 's1', weekN: 1, date: '2026-03-02', sport: 'muscu', kind: 'fullbody', title: 'Test', status: 'prevue', estMinutes: 60, exercises, ...(groups ? { groups } : {}),
})

describe('formats prêts à l\'emploi', () => {
  it('combo : 3 séries de « 1 rep lourde, puis 6 reps à −20 % » (le cas de référence)', () => {
    const r = applyFormat('combo', { sets: 3, repMin: 6, repMax: 10, rir: 2 })
    expect(r.format).toBe('combo')
    expect(r.sets).toBe(3)
    for (const set of r.plan!) {
      expect(set.parts).toHaveLength(2)
      expect(set.parts[0]).toMatchObject({ reps: 1, pct: 100, restAfterSec: 0 }) // enchaîné
      expect(set.parts[1]).toMatchObject({ reps: 6, pct: 80 })
    }
    expect(formatLabel({ plan: r.plan, format: r.format })).toBe('Combo · 1 + 6')
  })

  it('pyramide : reps qui descendent (12/10/8/6), charge qui monte', () => {
    const r = applyFormat('pyramide', { sets: 4, repMin: 8, repMax: 12 })
    expect(r.plan!.map((s) => s.parts[0].reps)).toEqual([12, 10, 8, 6])
    const pct = r.plan!.map((s) => s.parts[0].pct!)
    expect(pct).toEqual([...pct].sort((a, b) => a - b))
    expect(pct[3]).toBeGreaterThan(pct[0])
    expect(formatLabel({ plan: r.plan, format: r.format })).toBe('Pyramide · 12/10/8/6')
  })

  it('série lourde + séries allégées : 1 série de 3 à 5 reps, puis 3 séries à −10/−15 %', () => {
    const r = applyFormat('lourde', { sets: 4, repMin: 3, repMax: 6, rir: 2 })
    expect(r.plan).toHaveLength(4)
    expect(r.plan![0].parts[0]).toMatchObject({ reps: 3, repMax: 5, pct: 100 })
    for (const s of r.plan!.slice(1)) {
      expect(s.parts[0].pct).toBeGreaterThanOrEqual(85)
      expect(s.parts[0].pct).toBeLessThanOrEqual(90)
    }
  })

  it('dégressive : la dernière série = 3 parties enchaînées, −20 % à chaque partie', () => {
    const r = applyFormat('degressive', { sets: 3, repMin: 10, repMax: 15 })
    expect(r.plan!.slice(0, 2).every((s) => s.parts.length === 1)).toBe(true)
    const last = r.plan![2].parts
    expect(last.map((p) => p.pct)).toEqual([100, 80, 60])
    expect(last.slice(0, 2).every((p) => p.restAfterSec === 0)).toBe(true)
    expect(formatLabel({ plan: r.plan, format: r.format })).toBe('Dégressive · 3 parties')
  })

  it('rest-pause : 3 parties à la même charge, 15 s entre elles', () => {
    const r = applyFormat('rest_pause', { sets: 3, repMin: 8, repMax: 10 })
    const last = r.plan![2].parts
    expect(last).toHaveLength(3)
    expect(last.every((p) => p.pct === 100)).toBe(true)
    expect(last.slice(0, 2).map((p) => p.restAfterSec)).toEqual([15, 15])
  })

  it('classique, trop peu de séries ou exercice en durée : retombe sur N séries identiques, sans détail', () => {
    expect(applyFormat('classique', { sets: 3, repMin: 8, repMax: 10 }).plan).toBeUndefined()
    expect(applyFormat('degressive', { sets: 2, repMin: 8, repMax: 10 }).format).toBe('classique')
    expect(applyFormat('combo', { sets: 3, repMin: 30, repMax: 45 }, true).plan).toBeUndefined()
  })
})

describe('charges relatives', () => {
  it('arrondies à 0,5 kg', () => {
    expect(relativeKg(100, 80)).toBe(80)
    expect(relativeKg(102.5, 80)).toBe(82)
    expect(relativeKg(101, 80)).toBe(81) // 80,8 → 81
    expect(relativeKg(97.5, 80)).toBe(78)
    expect(relativeKg(67.5, 87.5)).toBe(59) // 59,06 → 59
    expect(relativeKg(61, 87.5)).toBe(53.5) // 53,375 → 53,5
  })

  it('combo : la partie légère se précalcule à partir de la partie lourde saisie', () => {
    const e = ex({ id: 'a', exerciseId: 'dev_couche_barre', ...applyFormat('combo', { sets: 3, repMin: 6, repMax: 10 }) })
    const typed: Record<string, number> = { '1.0': 100 }
    const kgOf = (n: number, p: number) => typed[`${n}.${p}`]
    expect(suggestedKg(e, 1, 1, kgOf)).toBe(80) // 100 kg × 80 %
    expect(suggestedKg(e, 1, 0, kgOf)).toBeUndefined() // la partie lourde est la référence
    typed['2.0'] = 102.5
    expect(suggestedKg(e, 2, 1, kgOf)).toBe(82) // chaque série suit sa propre partie lourde
  })

  it('une charge absolue prévue prime sur le pourcentage', () => {
    const e = ex({ id: 'a', exerciseId: 'dev_couche_barre', plan: [{ parts: [{ reps: 5, kg: 60 }, { reps: 5, kg: 50, pct: 80 }] }] })
    expect(suggestedKg(e, 1, 1, () => 100)).toBe(50)
  })
})

describe('saisie et dernière performance', () => {
  const combo = () => ex({ id: 'a', exerciseId: 'dev_couche_barre', ...applyFormat('combo', { sets: 3, repMin: 6, repMax: 10 }) })

  it('une série à parties n\'est faite que quand toutes ses parties sont saisies', () => {
    const e = combo()
    e.logs = [log(1, 100, 1, 0), log(1, 80, 6, 1), log(2, 100, 1, 0)]
    expect(isSetDone(e, 1)).toBe(true)
    expect(isSetDone(e, 2)).toBe(false)
    expect(doneSetsOf(e)).toBe(1)
  })

  it('combo 1 + 6 × 3 : « 1 × 100 kg + 6 × 80 kg » partie par partie', () => {
    const logs: SetLog[] = [1, 2, 3].flatMap((n) => [log(n, 100, 1, 0), log(n, 80, 6, 1)])
    const sets = groupLogsBySet(logs)
    expect(sets).toHaveLength(3)
    expect(describeLastSet(sets[0])).toBe('1 × 100 kg + 6 × 80 kg')
    expect(describeLastSet(sets[2])).toBe('1 × 100 kg + 6 × 80 kg')
  })

  it('une série classique garde son affichage « kg × reps »', () => {
    expect(describeLastSet(groupLogsBySet([log(1, 55, 8)])[0])).toBe('55 × 8')
    expect(describeLastSet({ n: 1, parts: [{ part: 0, kg: 0, reps: 0, seconds: 45 }] })).toBe('45 s')
  })

  it('describePlan : résumé des séries', () => {
    expect(describePlan(combo())).toBe('3 × (1 + 6 à −20 %)')
    expect(describePlan(ex({ id: 'b', exerciseId: 'curl_halteres', sets: 3, repMin: 8, repMax: 12 }))).toBe('3 × 8–12')
    expect(describePlan(applyFormat('lourde', { sets: 4, repMin: 3, repMax: 6 }))).toBe('3–5, puis 3 × 6–8 à −12,5 %')
    expect(describePlan(applyFormat('degressive', { sets: 3, repMin: 10, repMax: 15 }))).toBe('2 × 10–15, puis (10–15 + 10–15 à −20 % + 10–15 à −40 %)')
  })

  it('un exercice sans série détaillée se lit exactement comme avant', () => {
    const e = ex({ id: 'b', exerciseId: 'curl_halteres', sets: 3, repMin: 8, repMax: 12 })
    expect(plannedSetsOf(e)).toHaveLength(3)
    expect(plannedSetsOf(e)[0].parts).toEqual([{ reps: 8, repMax: 12, rir: 2 }])
    e.logs = [log(1, 10, 12), log(2, 10, 12)]
    expect(doneSetsOf(e)).toBe(2)
    expect(formatLabel(e)).toBeUndefined()
  })
})

describe('ordre de passage', () => {
  const a = ex({ id: 'a', exerciseId: 'dev_couche_barre', sets: 4 })
  const b = ex({ id: 'b', exerciseId: 'rowing_barre', sets: 4 })
  const sup: ExerciseGroup = { ...defaultGroup('superset', ['a', 'b'], 'g'), rounds: 4 }

  it('superset : « Superset · Tour 2/4 », A2 puis B2, puis repos', () => {
    const s = sess([a, b], [sup])
    expect(groupGuide(s, sup)).toEqual({ title: 'Superset · Tour 1/4', hint: 'A1 puis B1, puis repos' })
    a.logs = [log(1, 80, 8)]
    expect(groupGuide(s, sup).hint).toBe('B1, puis repos')
    b.logs = [log(1, 70, 10)]
    const g2 = groupGuide(s, sup)
    expect(g2.title).toBe('Superset · Tour 2/4')
    expect(g2.hint).toBe('A2 puis B2, puis repos')
    expect(roundsProgress(s, sup)).toMatchObject({ doneRounds: 1, next: { round: 2, index: 0, seId: 'a' }, complete: false })
    a.logs.push(log(2, 80, 8))
    expect(groupGuide(s, sup).hint).toBe('B2, puis repos')
    a.logs = []; b.logs = []
  })

  it('circuit : « Tour 2/3 · 3/5 Fentes arrière »', () => {
    const names = ['pompes', 'squat_goblet', 'fentes_arriere', 'planche', 'rowing_haltere']
    const members = names.map((n, i) => ex({ id: `c${i}`, exerciseId: n, sets: 3, repMin: 10, repMax: 10 }))
    const g: ExerciseGroup = { ...defaultGroup('circuit', members.map((m) => m.id), 'gc'), rounds: 3 }
    const s = sess(members, [g])
    for (const m of members) m.logs = [log(1, 0, 10)] // tour 1 fait
    members[0].logs.push(log(2, 0, 10)); members[1].logs.push(log(2, 0, 10)) // tour 2 : 2 exercices faits
    expect(groupGuide(s, g)).toEqual({ title: 'Circuit · Tour 2/3', hint: 'Tour 2/3 · 3/5 Fentes arrière' })
    for (const m of members) m.logs = [1, 2, 3].map((n) => log(n, 0, 10))
    expect(roundsProgress(s, g).complete).toBe(true)
  })

  it('EMOM : la minute en cours se déduit de l\'horodatage de départ', () => {
    const e1 = ex({ id: 'p', exerciseId: 'pogo', sets: 1, repMin: 20, repMax: 20 })
    const e2 = ex({ id: 'q', exerciseId: 'squat_jump', sets: 1, repMin: 10, repMax: 10 })
    const g: ExerciseGroup = { ...defaultGroup('emom', ['p', 'q'], 'ge'), durationMin: 12, startedAt: 1_000_000 }
    const s = sess([e1, e2], [g])
    expect(emomState(s, g, 1_000_000)).toMatchObject({ minute: 1, total: 12, secLeft: 60, seId: 'p', finished: false })
    expect(emomState(s, g, 1_000_000 + 3 * 60_000 + 15_000)).toMatchObject({ minute: 4, secLeft: 45, seId: 'q' }) // minute 4 : alternance → B
    expect(emomState(s, g, 1_000_000 + 12 * 60_000)).toMatchObject({ finished: true, secLeft: 0 })
    expect(emomState(s, { ...g, startedAt: undefined }, 5)).toBeUndefined()
  })

  it('AMRAP : décompte global depuis l\'horodatage', () => {
    const g: ExerciseGroup = { ...defaultGroup('amrap', ['x'], 'ga'), durationMin: 10, startedAt: 0 }
    expect(amrapLeft(g, 0)).toBe(600)
    expect(amrapLeft(g, 61_000)).toBe(539)
    expect(amrapLeft(g, 11 * 60_000)).toBe(0)
  })
})

describe('repos selon la position', () => {
  const combo = ex({ id: 'c', exerciseId: 'dev_couche_barre', restSec: 150, ...applyFormat('combo', { sets: 3, repMin: 6, repMax: 10 }) })
  const rp = ex({ id: 'r', exerciseId: 'curl_halteres', restSec: 75, ...applyFormat('rest_pause', { sets: 3, repMin: 10, repMax: 12 }) })
  const classic = ex({ id: 'k', exerciseId: 'squat_barre', restSec: 180 })

  it('partie enchaînée : pas de minuteur, un signal « Enchaîne »', () => {
    const s = sess([combo])
    expect(restAfter(s, combo, 1, 0)).toMatchObject({ sec: 0, chain: true })
  })
  it('dernière partie d\'une série : le repos de l\'exercice', () => {
    const s = sess([combo])
    expect(restAfter(s, combo, 1, 1)).toEqual({ sec: 150, chain: false, label: 'Repos' })
  })
  it('rest-pause : 15 s entre les parties, puis le repos de l\'exercice', () => {
    const s = sess([rp])
    expect(restAfter(s, rp, 3, 0)).toMatchObject({ sec: 15, chain: false })
    expect(restAfter(s, rp, 3, 1)).toMatchObject({ sec: 15 })
    expect(restAfter(s, rp, 3, 2)).toMatchObject({ sec: 75 })
  })
  it('série classique : restSec de l\'exercice', () => {
    expect(restAfter(sess([classic]), classic, 2, 0)).toMatchObject({ sec: 180 })
  })
  it('superset : repos entre exercices après A, repos entre tours après B, repos après le groupe au dernier tour', () => {
    const a = ex({ id: 'a', exerciseId: 'dev_couche_barre', sets: 3 })
    const b = ex({ id: 'b', exerciseId: 'rowing_barre', sets: 3 })
    const g: ExerciseGroup = { ...defaultGroup('superset', ['a', 'b'], 'g'), rounds: 3, restBetweenSec: 10, restAfterRoundSec: 90 }
    const s = sess([a, b], [g])
    expect(restAfter(s, a, 1, 0)).toMatchObject({ sec: 10, label: 'Repos entre exercices' })
    expect(restAfter(s, b, 1, 0)).toMatchObject({ sec: 90, label: 'Repos entre les tours' })
    expect(restAfter(s, b, 3, 0)).toMatchObject({ sec: 90, label: 'Repos après le groupe' })
    const g0 = { ...g, restBetweenSec: 0 }
    expect(restAfter(sess([a, b], [g0]), a, 2, 0)).toMatchObject({ sec: 0, chain: true, label: 'Enchaîne B2' })
  })
  it('EMOM, AMRAP, chrono : aucun minuteur', () => {
    const a = ex({ id: 'a', exerciseId: 'pogo', sets: 1 })
    for (const kind of ['emom', 'amrap', 'chrono'] as const) expect(restAfter(sess([a], [defaultGroup(kind, ['a'], 'g')]), a, 1, 0)).toBeNull()
  })
})

describe('progression des séries détaillées', () => {
  const target = (id: string, exerciseId: string, rir = 2) => ex({ id, exerciseId, rir, restSec: 150, ...applyFormat('combo', { sets: 3, repMin: 6, repMax: 10, rir }) })

  it('combo : toutes les parties atteignent leurs reps avec le RIR visé → +2,5 kg sur la partie lourde', () => {
    const e = target('a', 'dev_couche_barre')
    e.logs = [1, 2, 3].flatMap((n) => [log(n, 100, 1, 0, 2), log(n, 80, 6, 1, 2)])
    expect(nextLoadPlan(e)).toMatchObject({ kg: 100, next: 102.5, verdict: 'monter' })
    expect(nextLoad(e)).toMatchObject({ next: 102.5 }) // le moteur utilise cette règle, pas la double progression
  })
  it('+1 kg sur haltères ou isolation', () => {
    const e = target('a', 'curl_halteres')
    e.logs = [1, 2, 3].flatMap((n) => [log(n, 14, 1, 0, 2), log(n, 11, 6, 1, 2)])
    expect(nextLoadPlan(e)!.next).toBe(15)
  })
  it('une partie en dessous de la cible : on garde la charge', () => {
    const e = target('a', 'dev_couche_barre')
    e.logs = [1, 2, 3].flatMap((n) => [log(n, 100, 1, 0, 2), log(n, 80, n === 2 ? 5 : 6, 1, 2)])
    expect(nextLoadPlan(e)).toMatchObject({ next: 100, verdict: 'maintenir' })
  })
  it('une série non terminée (partie manquante) : on garde la charge', () => {
    const e = target('a', 'dev_couche_barre')
    e.logs = [log(1, 100, 1, 0), log(1, 80, 6, 1), log(2, 100, 1, 0)]
    expect(nextLoadPlan(e)!.verdict).toBe('maintenir')
  })
  it('la double progression reste réservée aux séries classiques', () => {
    const e = ex({ id: 'k', exerciseId: 'squat_barre', sets: 3, repMin: 6, repMax: 8, rir: 2 })
    e.logs = [1, 2, 3].map((n) => log(n, 100, 8, undefined, 2))
    expect(nextLoad(e)!.verdict).toBe('monter')
    expect(nextLoadPlan(e)).toBeNull()
  })
})

describe('groupes : cohérence', () => {
  it('un groupe qui perd un exercice est dissous ; un triset à 2 devient un superset', () => {
    const [a, b, c] = ['a', 'b', 'c'].map((id) => ex({ id, exerciseId: 'curl_halteres' }))
    const s = sess([a, b, c], [{ ...defaultGroup('triset', ['a', 'b', 'c'], 'g'), rounds: 4 }])
    s.exercises = s.exercises!.filter((e) => e.id !== 'c')
    normalizeGroups(s)
    expect(s.groups![0].kind).toBe('superset')
    expect(groupMembers(s, s.groups![0])).toHaveLength(2)
    expect(a.sets).toBe(4) // autant de séries que de tours
    s.exercises = [a]
    normalizeGroups(s)
    expect(s.groups).toBeUndefined()
  })
  it('un exercice de groupe perd son détail de séries', () => {
    const a = ex({ id: 'a', exerciseId: 'dev_couche_barre', ...applyFormat('combo', { sets: 3, repMin: 6, repMax: 10 }) })
    const b = ex({ id: 'b', exerciseId: 'rowing_barre' })
    const s = sess([a, b], [defaultGroup('superset', ['a', 'b'], 'g')])
    normalizeGroups(s)
    expect(a.plan).toBeUndefined()
    expect(a.format).toBeUndefined()
  })
  it('regroupement automatique : jamais squat + soulevé de terre, jamais plus d\'une série d\'écart', () => {
    const pairs = pairOpposites([
      { id: 'sq', pattern: 'squat', muscle: 'quadriceps', compound: true, sets: 4 },
      { id: 'sdt', pattern: 'hinge', muscle: 'ischios', compound: true, sets: 4 },
      { id: 'dc', pattern: 'push_h', muscle: 'pectoraux', compound: true, sets: 3 },
      { id: 'row', pattern: 'pull_h', muscle: 'dos', compound: true, sets: 3 },
      { id: 'dm', pattern: 'push_v', muscle: 'epaules', compound: true, sets: 3 },
      { id: 'tir', pattern: 'pull_v', muscle: 'dos', compound: true, sets: 5 }, // trop d'écart avec le développé militaire
      { id: 'leg', pattern: 'leg_ext', muscle: 'quadriceps', compound: false, sets: 3 },
      { id: 'curl_l', pattern: 'leg_curl', muscle: 'ischios', compound: false, sets: 3 },
    ])
    expect(pairs).toContainEqual(['dc', 'row'])
    expect(pairs).toContainEqual(['leg', 'curl_l'])
    expect(pairs.some((p) => p.includes('sq') || p.includes('sdt'))).toBe(false)
    expect(pairs.some((p) => p.includes('dm'))).toBe(false)
  })
})

describe('avancement et statistiques', () => {
  it('avancement : une série à parties compte pour une, un EMOM pour un bloc', () => {
    const c = ex({ id: 'c', exerciseId: 'dev_couche_barre', ...applyFormat('combo', { sets: 3, repMin: 6, repMax: 10 }) })
    c.logs = [log(1, 100, 1, 0), log(1, 80, 6, 1), log(2, 100, 1, 0)]
    const p = ex({ id: 'p', exerciseId: 'pogo', sets: 1 })
    const g: ExerciseGroup = defaultGroup('emom', ['p'], 'g')
    expect(sessionProgress(sess([c, p], [g]))).toEqual({ done: 1, total: 4 })
    g.result = { minutesDone: 12, at: 'x' }
    expect(sessionProgress(sess([c, p], [g]))).toEqual({ done: 2, total: 4 })
  })
  it('circuits et AMRAP : comptés à part, sans toucher au tonnage', () => {
    const m = ['pompes', 'squat_goblet'].map((x, i) => ex({ id: `m${i}`, exerciseId: x, sets: 3, repMin: 10, repMax: 10 }))
    m.forEach((e) => (e.logs = [1, 2].map((n) => log(n, 0, 10))))
    const circuit: ExerciseGroup = { ...defaultGroup('circuit', ['m0', 'm1'], 'gc'), rounds: 3 }
    const amrap: ExerciseGroup = { ...defaultGroup('amrap', ['z'], 'ga'), result: { rounds: 5, extraReps: 8, at: 'x' } }
    const st = groupStats([sess(m, [circuit]), sess([ex({ id: 'z', exerciseId: 'pogo', sets: 1 })], [amrap])])
    expect(st.circuitRounds).toBe(2)
    expect(st.amrap).toEqual({ count: 1, totalRounds: 5, bestRounds: 5 })
    expect(m.flatMap((e) => e.logs).reduce((a, l) => a + l.kg * l.reps, 0)).toBe(0)
  })
  it('exercices en durée et unilatéraux', () => {
    expect(exerciseOf('planche').unit).toBe('sec')
    expect(exerciseOf('fentes_arriere').perSide).toBe(true)
    expect(exerciseOf('copenhague')).toMatchObject({ unit: 'sec', perSide: true, renfo: true })
    expect(exerciseOf('monster_walk').equipment).toBe('elastique')
  })
})
