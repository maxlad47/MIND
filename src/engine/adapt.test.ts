import { describe, expect, it } from 'vitest'
import { generateProgram } from './program'
import { adjustLoadsAfterSession, allSessions, applyCheckin, handleMissed, judgeExercise, scalePaces, undoAdaptation, applyScale } from './adapt'
import { EXERCISE_BY_ID } from './exercises'
import { P_FORCE_EPAULE, P_MARATHON, P_MIXTE } from './fixtures'
import { isQuality } from './running'
import { addDays } from './utils'

const gen = (q: Parameters<typeof generateProgram>[0]) => generateProgram(q, { now: '2026-01-05', clientId: 'c1' })

describe('séance manquée', () => {
  it('reprogramme une séance de qualité sur un jour libre sans conflit, sans jamais cumuler', () => {
    const p = gen(P_MARATHON)
    const q = p.weeks[1].sessions.find((s) => isQuality(s.kind))!
    const today = addDays(q.date, 1) // le lendemain : la séance est manquée
    const res = handleMissed(p, today, [0, 1, 2, 3, 4, 5, 6])
    const moved = allSessions(res.program).find((s) => s.id === q.id)!
    expect(['prevue', 'sautee']).toContain(moved.status)
    if (moved.status === 'prevue') {
      expect(moved.date >= today).toBe(true)
      const sameDay = allSessions(res.program).filter((s) => s.date === moved.date && s.status === 'prevue')
      expect(sameDay).toHaveLength(1)
      expect(res.adaptations.some((a) => a.kind === 'deplacee')).toBe(true)
    }
    expect(res.adaptations.length).toBeGreaterThan(0)
  })
  it('annule une adaptation en restaurant la séance', () => {
    const p = gen(P_MARATHON)
    const q = p.weeks[1].sessions.find((s) => isQuality(s.kind))!
    const res = handleMissed(p, addDays(q.date, 1), [0, 1, 2, 3, 4, 5, 6])
    const a = res.adaptations.find((x) => x.undo?.sessions.some((s) => s.id === q.id))!
    const back = undoAdaptation(res.program, a)
    expect(allSessions(back).find((s) => s.id === q.id)!.date).toBe(q.date)
  })
})

describe('charges selon RIR', () => {
  it('toutes les séries au haut de la fourchette → on monte', () => {
    expect(judgeExercise([{ reps: 10, rir: 2 }, { reps: 10, rir: 2 }], 6, 10, 2, false)).toBe('monter')
  })
  it('séries nettement plus faciles → montée plus forte', () => {
    expect(judgeExercise([{ reps: 10, rir: 4 }, { reps: 10, rir: 4 }], 6, 10, 2, false)).toBe('monter_plus')
  })
  it('échec → charge maintenue, puis −5 % après deux échecs', () => {
    const hard = [{ reps: 4, rir: 0 }, { reps: 4, rir: 0 }]
    expect(judgeExercise(hard, 6, 10, 2, false)).toBe('maintenir')
    expect(judgeExercise(hard, 6, 10, 2, true)).toBe('baisser')
  })
  it('met à jour la charge des séances futures, sans dépasser +10 %', () => {
    const p = gen(P_FORCE_EPAULE)
    const first = allSessions(p).sort((a, b) => a.date.localeCompare(b.date))[0]
    // double progression : un exercice à séries classiques (la série lourde du premier exercice a sa propre règle, voir generation.test.ts)
    const e = first.exercises!.find((x) => !x.plan && x.targetKg)!
    const kg = e.targetKg!
    first.status = 'faite'
    e.logs = Array.from({ length: e.sets }, (_, i) => ({ n: i + 1, kg, reps: e.repMax, rir: e.rir + 3, at: '' }))
    const res = adjustLoadsAfterSession(p, first.id, first.date)
    const future = allSessions(res.program).filter((s) => s.date > first.date).flatMap((s) => s.exercises ?? []).find((x) => x.exerciseId === e.exerciseId)
    expect(future!.targetKg).toBeGreaterThan(kg)
    expect(future!.targetKg!).toBeLessThanOrEqual(Math.max(kg * 1.1, kg + 2.5) + 0.5)
    expect(res.adaptations.some((a) => a.kind === 'charge')).toBe(true)
  })
})

describe('allures', () => {
  it('une VMA plus haute accélère toutes les allures futures et reste annulable', () => {
    const p = gen(P_MARATHON)
    const res = scalePaces(p, p.paces!.vma + 1, '2026-01-05')
    const before = allSessions(p).find((s) => s.kind === 'ef')!.run!.blocks[0].paceSec!
    const after = allSessions(res.program).find((s) => s.id === allSessions(p).find((x) => x.kind === 'ef')!.id)!.run!.blocks[0].paceSec!
    expect(after).toBeLessThan(before)
    const back = undoAdaptation(res.program, res.adaptations[0])
    expect(back.paces!.vma).toBeCloseTo(p.paces!.vma, 5)
  })
})

describe('fatigue et douleur', () => {
  const p = gen(P_MIXTE)
  const muscu = allSessions(p).find((s) => s.sport === 'muscu')!
  it('score bas → séance allégée de 30 %', () => {
    const res = applyCheckin(p, muscu.id, { id: 'k', clientId: 'c1', date: muscu.date, energy: 1, sleep: 2, soreness: 5, pain: false }, muscu.date)
    const s = allSessions(res.program).find((x) => x.id === muscu.id)!
    expect(s.lighten).toBe(true)
    const before = muscu.exercises!.reduce((a, e) => a + e.sets, 0)
    const after = s.exercises!.reduce((a, e) => a + e.sets, 0)
    expect(after).toBeLessThan(before * 0.85)
    expect(res.notifyCoach).toBe(false)
  })
  it('douleur → exercices de la zone remplacés et coach notifié', () => {
    const withShoulder = allSessions(p).find((s) => s.exercises?.some((e) => EXERCISE_BY_ID[e.exerciseId].contra.includes('epaule')))!
    const res = applyCheckin(p, withShoulder.id, { id: 'k', clientId: 'c1', date: withShoulder.date, energy: 4, sleep: 4, soreness: 2, pain: true, painZone: 'epaule' }, withShoulder.date)
    const s = allSessions(res.program).find((x) => x.id === withShoulder.id)!
    for (const e of s.exercises!) expect(EXERCISE_BY_ID[e.exerciseId].contra).not.toContain('epaule')
    expect(res.notifyCoach).toBe(true)
  })
  it('séance de qualité transformée en endurance quand la forme est basse', () => {
    const q = allSessions(p).find((s) => isQuality(s.kind) && s.kind !== 'course')!
    const res = applyCheckin(p, q.id, { id: 'k', clientId: 'c1', date: q.date, energy: 1, sleep: 1, soreness: 5, pain: false }, q.date)
    expect(allSessions(res.program).find((x) => x.id === q.id)!.kind).toBe('ef')
  })
})

describe('suggestions', () => {
  it('réduit le volume d\'une semaine de 20 %', () => {
    const p = gen(P_MARATHON)
    const w = p.weeks[3]
    const km = (prog: typeof p) => prog.weeks[3].sessions.reduce((a, s) => a + (s.run?.totalKm ?? 0), 0)
    const next = applyScale(p, w.n, 0.8)
    expect(km(next)).toBeLessThan(km(p) * 0.9)
  })
})
