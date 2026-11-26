// Distances prescrites au km entier : pas d'EF de 4,7 km.
import { describe, expect, it } from 'vitest'
import { allSessions, applyScale } from './adapt'
import { P_10K_COURT, P_MARATHON, P_MIXTE } from './fixtures'
import { generateProgram } from './program'
import { roundRunPlan, scaleRun } from './running'
import type { Program, RunPlan } from './types'

const START = '2026-01-05'
const gen = (q: typeof P_MARATHON): Program => generateProgram({ ...q, startDate: START }, { clientId: 'c1', now: START })
const runs = (p: Program) => allSessions(p).filter((s) => s.sport === 'course' && s.kind !== 'course' && s.run)
const whole = (x: number) => Number.isInteger(x)

describe('km ronds', () => {
  for (const [name, q] of [['marathon', P_MARATHON], ['10 km court', P_10K_COURT], ['mixte semi', P_MIXTE]] as const) {
    it(`${name} : toutes les sorties au km entier`, () => {
      const p = gen(q)
      const bad = runs(p).filter((s) => !whole(s.run!.totalKm) || s.run!.blocks.some((b) => b.meters && !(b.reps && b.reps > 1) && b.meters % 1000 !== 0))
      expect(bad.map((s) => `${s.kind} ${s.run!.totalKm}`)).toEqual([])
      // footing et sortie longue : le total est la somme des parties
      for (const s of runs(p).filter((x) => ['ef', 'recup', 'longue'].includes(x.kind)))
        expect(s.run!.blocks.reduce((a, b) => a + (b.meters ?? 0), 0) / 1000).toBe(s.run!.totalKm)
    })
  }

  it('la sortie longue reste la plus longue de la semaine', () => {
    for (const w of gen(P_MARATHON).weeks.filter((x) => x.phase !== 'Affûtage')) {
      const r = w.sessions.filter((s) => s.sport === 'course' && s.run)
      const long = r.find((s) => s.kind === 'longue')
      if (long) expect(long.run!.totalKm).toBeGreaterThan(Math.max(0, ...r.filter((s) => s.kind !== 'longue').map((s) => s.run!.totalKm)))
    }
  })

  it('arrondi au plus proche : 4,7 → 5 km, 4,3 → 4 km ; partie à allure arrondie aussi', () => {
    const ef = (km: number): RunPlan => ({ warmup: '', cooldown: '', blocks: [{ label: 'EF', meters: km * 1000, paceSec: 360 }], totalKm: km, estMinutes: 0 })
    const a = ef(4.7); expect(roundRunPlan(a)).toBe(true); expect([a.totalKm, a.blocks[0].meters]).toEqual([5, 5000])
    const b = ef(4.3); roundRunPlan(b); expect(b.totalKm).toBe(4)
    expect(roundRunPlan(b)).toBe(false) // idempotent
    const long: RunPlan = { warmup: '', cooldown: '', blocks: [{ label: 'Facile', meters: 11600, paceSec: 360 }, { label: 'Allure', meters: 6300, paceSec: 300 }], totalKm: 17.9, estMinutes: 0 }
    roundRunPlan(long)
    expect(long.blocks.map((x) => x.meters)).toEqual([12000, 6000])
    expect(long.totalKm).toBe(18)
  })

  it('allègement : répétitions entières (libellé à jour), distances rondes', () => {
    const vma: RunPlan = { warmup: '', cooldown: '', blocks: [{ label: '10 × 400 m', meters: 400, reps: 10, paceSec: 240, recSec: 60 }], totalKm: 9, estMinutes: 50 }
    scaleRun(vma, 0.8)
    expect(vma.blocks[0]).toMatchObject({ meters: 400, reps: 8, label: '8 × 400 m' })
    expect(whole(vma.totalKm)).toBe(true)
    const p = applyScale(gen(P_MARATHON), 3, 0.85)
    const w = p.weeks.find((x) => x.n === 3)!
    for (const s of w.sessions.filter((x) => x.sport === 'course' && x.run && x.kind !== 'course')) expect(whole(s.run!.totalKm)).toBe(true)
  })
})
