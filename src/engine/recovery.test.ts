import { describe, expect, it } from 'vitest'
import { healthDays, lastNight, rollingAvg, sleepStats, stepStats, trainingLinks, weekdayProfile, weekly } from './recovery'
import type { HealthDay, Session } from './types'
import { addDays } from './utils'

const C = 'c1'
const hd = (date: string, o: Partial<HealthDay>): HealthDay => ({ id: `${C}-${date}`, clientId: C, date, ...o })
const sess = (date: string, feeling?: number, status: Session['status'] = 'faite'): Session =>
  ({ id: `s-${date}`, weekN: 1, date, sport: 'muscu', kind: 'fullbody', title: 'Full', status, estMinutes: 60, feeling } as unknown as Session)

describe('récupération', () => {
  it('un jour sans donnée reste un trou, pas un zéro', () => {
    const days = healthDays([hd('2026-11-02', { steps: 5000 }), hd('2026-11-04', { sleepMinutes: 400 })], C, '2026-11-02', '2026-11-04')
    expect(days.map((d) => d.date)).toEqual(['2026-11-02', '2026-11-03', '2026-11-04'])
    expect(days[1].steps).toBeUndefined()
    expect(days[1].sleep).toBeUndefined()
    expect(days[0].sleep).toBeUndefined()
  })

  it('moyenne glissante : rien sous 3 valeurs, les trous ignorés', () => {
    expect(rollingAvg([400, undefined, 420, 440], 7)).toEqual([undefined, undefined, undefined, 420])
  })

  it('statistiques de sommeil : moyenne, nuits de 7 h, phases en %', () => {
    const days = healthDays([
      hd('2026-11-02', { sleepMinutes: 360, sleepScore: 60, sleepPhases: { deepMin: 60, lightMin: 200, remMin: 80, awakeMin: 20 } }),
      hd('2026-11-03', { sleepMinutes: 480, sleepScore: 90, sleepPhases: { deepMin: 90, lightMin: 250, remMin: 120, awakeMin: 20 } }),
      hd('2026-11-04', { sleepMinutes: 420 }),
    ], C, '2026-11-01', '2026-11-04')
    const s = sleepStats(days)
    expect(s.nights).toBe(3)
    expect(s.avg).toBe(420)
    expect(s.avgScore).toBe(75)
    expect(s.over7).toBe(2)
    expect(s.best?.date).toBe('2026-11-03')
    expect(s.worst?.date).toBe('2026-11-02')
    expect(s.spread).toBeCloseTo(49, 0)
    expect(s.phases!.deep + s.phases!.light + s.phases!.rem + s.phases!.awake).toBeCloseTo(100)
    expect(s.phases!.deep).toBeCloseTo((150 / 840) * 100)
  })

  it('pas : aujourd\'hui hors moyenne, série d\'objectif jusqu\'à hier (+ aujourd\'hui s\'il est atteint)', () => {
    const today = '2026-11-10'
    const h = [hd('2026-11-06', { steps: 4000 }), hd('2026-11-07', { steps: 11000 }), hd('2026-11-08', { steps: 10500 }), hd('2026-11-09', { steps: 12000 }), hd(today, { steps: 2000 })]
    const days = healthDays(h, C, '2026-11-04', today)
    const s = stepStats(days, today, 10000)
    expect(s.days).toBe(4)
    expect(s.avg).toBe(9375)
    expect(s.best?.date).toBe('2026-11-09')
    expect(s.goalDays).toBe(3)
    expect(s.streak).toBe(3)
    const s2 = stepStats(healthDays([...h.slice(0, 4), hd(today, { steps: 10200 })], C, '2026-11-04', today), today, 10000)
    expect(s2.streak).toBe(4)
    expect(stepStats(days, today).goalDays).toBe(0)
  })

  it('semaine type : la nuit est rangée au soir où elle commence', () => {
    // réveils les samedis 7 et 14 → nuits du vendredi
    const days = healthDays([hd('2026-11-07', { sleepMinutes: 500 }), hd('2026-11-14', { sleepMinutes: 520 }), hd('2026-11-09', { steps: 8000 }), hd('2026-11-16', { steps: 6000 })], C, '2026-11-02', '2026-11-20')
    const w = weekdayProfile(days, '2026-11-20')
    expect(w.sleep[4]).toBe(510)
    expect(w.sleep[5]).toBeUndefined()
    expect(w.steps[0]).toBe(7000)
  })

  it('moyennes par semaine', () => {
    const days = healthDays([hd('2026-11-02', { sleepMinutes: 400 }), hd('2026-11-03', { sleepMinutes: 440 }), hd('2026-11-09', { sleepMinutes: 300 })], C, '2026-11-02', '2026-11-10')
    expect(weekly(days, '2026-11-10')).toEqual([{ monday: '2026-11-02', sleep: 420, steps: undefined }, { monday: '2026-11-09', sleep: 300, steps: undefined }])
  })

  it('dernière nuit : la plus récente qui a du sommeil', () => {
    const h = [hd('2026-11-08', { sleepMinutes: 400 }), hd('2026-11-09', { steps: 300 })]
    expect(lastNight(h, C, '2026-11-09')?.date).toBe('2026-11-08')
  })

  it('liens avec l\'entraînement : seulement avec 3 valeurs par groupe', () => {
    const start = '2026-10-01', today = '2026-10-31'
    const h: HealthDay[] = [], s: Session[] = []
    for (let i = 0; i < 30; i++) {
      const d = addDays(start, i)
      const train = i % 2 === 0
      h.push(hd(d, { sleepMinutes: i % 4 === 0 ? 360 : 460, steps: train ? 12000 : 7000 }))
      if (train) s.push(sess(d, i % 4 === 0 ? 5 : 8))
    }
    s.push(sess(addDays(start, 1), 9, 'manquee'))
    const l = trainingLinks(healthDays(h, C, start, today), s, today)
    expect(l.feeling?.threshold).toBe(420)
    expect(l.feeling?.a.avg).toBe(5)
    expect(l.feeling?.b.avg).toBe(8)
    expect(l.steps?.a.avg).toBe(12000)
    expect(l.steps?.b.avg).toBe(7000)
    // la nuit après un jour de séance (i pair) tombe sur i + 1, toujours 460
    expect(l.sleepAfter?.a.avg).toBe(460)
    expect(trainingLinks(healthDays(h.slice(0, 4), C, start, addDays(start, 3)), s.slice(0, 2), today).feeling).toBeUndefined()
  })
})
