// Règles de génération des formats en mode « programme généré » : supersets, dégressives, séries lourdes, garde-fous, progression.
import { describe, expect, it } from 'vitest'
import { adjustLoadsAfterSession, allSessions } from './adapt'
import { exerciseOf } from './exercises'
import { BASE_Q, P_FORCE_EPAULE } from './fixtures'
import { groupMembers, isRoundsKind } from './formats'
import { generateProgram } from './program'
import type { Program, Questionnaire, Session } from './types'

const muscu = (q: Partial<Questionnaire>): Questionnaire => ({ ...BASE_Q, programType: 'muscu', ...q })
const hyper = (level: 'debutant' | 'intermediaire' | 'avance', o: Partial<Questionnaire> = {}) => muscu({ muscuSessions: 4, maxMinutes: 75, strength: { goal: 'hypertrophie', level, lifts: {} }, ...o })
const force = (level: 'debutant' | 'intermediaire' | 'avance', o: Partial<Questionnaire> = {}) =>
  muscu({ muscuSessions: 4, maxMinutes: 90, strength: { goal: 'force', level, lifts: { squat: { kg: 100, reps: 5 }, bench: { kg: 80, reps: 5 }, deadlift: { kg: 120, reps: 5 }, press: { kg: 50, reps: 5 } } }, ...o })
const gen = (q: Questionnaire): Program => generateProgram(q, { now: '2026-01-05' })
const week = (p: Program, n: number): Session[] => p.weeks[n - 1].sessions.filter((s) => s.sport === 'muscu')
const exs = (s: Session) => s.exercises ?? []
const isIso = (id: string) => { const e = exerciseOf(id); return !e.compound && !['core', 'calf', 'shrug'].includes(e.pattern) }

describe('séance courte : supersets d\'exercices opposés', () => {
  const short = muscu({ muscuSessions: 3, maxMinutes: 45, strength: { goal: 'hypertrophie', level: 'intermediaire', lifts: {} } })

  it('un volume qui ne tient pas dans 45 min est regroupé en supersets, durée recalculée et respectée', () => {
    const p = gen(short)
    const sessions = week(p, 1)
    const groups = sessions.flatMap((s) => s.groups ?? [])
    expect(groups.length).toBeGreaterThan(0)
    for (const s of sessions) expect(s.estMinutes).toBeLessThanOrEqual(45)
    for (const g of groups) {
      expect(g.kind).toBe('superset')
      expect(g.exerciseIds).toHaveLength(2)
    }
  })

  it('les deux exercices d\'un superset sont opposés, avec autant de séries que de tours', () => {
    const OPP: [string[], string[]][] = [[['push_h', 'push_inc', 'fly'], ['pull_h']], [['push_v'], ['pull_v']], [['curl'], ['tri_ext']], [['leg_ext'], ['leg_curl']]]
    for (const s of week(gen(short), 1)) {
      for (const g of s.groups ?? []) {
        const [a, b] = groupMembers(s, g).map((e) => exerciseOf(e.exerciseId))
        expect(OPP.some(([x, y]) => (x.includes(a.pattern) && y.includes(b.pattern)) || (y.includes(a.pattern) && x.includes(b.pattern)))).toBe(true)
        for (const e of groupMembers(s, g)) expect(e.sets).toBe(g.rounds)
      }
    }
  })

  it('jamais deux exercices lourds et techniques de jambes en superset (squat + soulevé de terre)', () => {
    for (const lvl of ['intermediaire', 'avance'] as const) {
      for (const split of [3, 4, 5]) {
        const p = gen(muscu({ muscuSessions: split, maxMinutes: 45, strength: { goal: 'hypertrophie', level: lvl, lifts: {} } }))
        for (const w of [1, 2, 5]) for (const s of week(p, w)) for (const g of s.groups ?? []) {
          const m = groupMembers(s, g).map((e) => exerciseOf(e.exerciseId))
          expect(m.every((e) => e.compound && ['quadriceps', 'ischios', 'fessiers'].includes(e.muscle))).toBe(false)
        }
      }
    }
  })

  it('séance de plus de 60 minutes : pas de superset', () => {
    for (const s of week(gen(hyper('intermediaire')), 1)) expect(s.groups).toBeUndefined()
  })

  it('débutant : séries classiques uniquement, ni groupe ni série détaillée, même en séance courte', () => {
    const p = gen({ ...short, strength: { goal: 'hypertrophie', level: 'debutant', lifts: {} } })
    for (const w of [1, 2, 3, 5]) for (const s of week(p, w)) {
      expect(s.groups).toBeUndefined()
      for (const e of exs(s)) { expect(e.plan).toBeUndefined(); expect(e.format).toBeUndefined() }
      expect(s.estMinutes).toBeLessThanOrEqual(45)
    }
  })
})

describe('hypertrophie : dégressive sur la dernière série d\'isolations', () => {
  it('intermédiaire et avancé : 1 ou 2 isolations par séance, dernière série en 3 parties', () => {
    for (const lvl of ['intermediaire', 'avance'] as const) {
      const p = gen(hyper(lvl))
      const sessions = week(p, 1)
      expect(sessions.some((s) => exs(s).some((e) => e.format === 'degressive'))).toBe(true)
      for (const s of sessions) {
        const dg = exs(s).filter((e) => e.format === 'degressive')
        expect(dg.length).toBeLessThanOrEqual(2)
        for (const e of dg) {
          expect(isIso(e.exerciseId)).toBe(true) // jamais sur un polyarticulaire lourd
          expect(e.plan!.slice(0, -1).every((set) => set.parts.length === 1)).toBe(true)
          expect(e.plan![e.plan!.length - 1].parts.map((x) => x.pct)).toEqual([100, 80, 60])
          expect(e.sets).toBe(e.plan!.length)
        }
      }
    }
  })

  it('jamais pendant la semaine de décharge, ni en semaine allégée du plan', () => {
    const p = gen(hyper('intermediaire'))
    for (const s of week(p, 8)) for (const e of exs(s)) expect(e.plan).toBeUndefined()
    // programme mixte : la semaine allégée du plan de course n'a aucune dégressive
    const mixte = gen({ ...hyper('intermediaire'), programType: 'mixte', runSessions: 3, priority: 'equilibre', run: { ...BASE_Q.run, distance: 'semi', raceDate: '2026-04-26', level: 'intermediaire', weeklyKm: 30, longestKm: 14 } })
    const light = mixte.weeks.filter((w) => w.light && w.phase !== 'Affûtage')
    expect(light.length).toBeGreaterThan(0)
    for (const w of light) for (const s of w.sessions.filter((x) => x.sport === 'muscu')) for (const e of exs(s)) expect(e.format).not.toBe('degressive')
  })

  it('débutant : aucune dégressive', () => {
    const p = gen(hyper('debutant'))
    for (const w of [1, 2, 3, 4, 5]) for (const s of week(p, w)) for (const e of exs(s)) { expect(e.plan).toBeUndefined(); expect(e.format).toBeUndefined() }
  })

  it('pas de dégressive en force', () => {
    const p = gen(force('intermediaire'))
    for (const s of week(p, 1)) for (const e of exs(s)) expect(e.format).not.toBe('degressive')
  })
})

describe('force : série lourde + séries allégées', () => {
  it('intermédiaire et avancé : l\'exercice principal de chaque séance passe en série lourde, une seule fois', () => {
    for (const lvl of ['intermediaire', 'avance'] as const) {
      const p = gen(force(lvl))
      for (const s of week(p, 1)) {
        const heavy = exs(s).filter((e) => e.format === 'lourde')
        expect(heavy.length).toBeLessThanOrEqual(1)
        expect(exs(s)[0].format === 'lourde' || exs(s).every((e) => !e.plan)).toBe(true)
      }
      const first = week(p, 1)[0]
      const main = exs(first)[0]
      expect(main.format).toBe('lourde')
      expect(main.plan![0].parts[0]).toMatchObject({ reps: 3, repMax: 5, pct: 100 })
      expect(main.plan!.slice(1).every((set) => set.parts[0].pct! >= 85 && set.parts[0].pct! <= 90)).toBe(true)
      expect(main.repMin).toBe(3) // la fourchette nominale de l'exercice reste lisible
      expect(main.targetKg).toBeGreaterThan(40)
    }
  })

  it('débutant : séries classiques', () => {
    const p = gen(force('debutant'))
    for (const w of [1, 2, 3]) for (const s of week(p, w)) for (const e of exs(s)) expect(e.plan).toBeUndefined()
  })

  it('les zones contre-indiquées restent respectées avec les formats', () => {
    const p = gen(P_FORCE_EPAULE)
    for (const w of p.weeks.slice(0, 8)) for (const s of w.sessions) for (const e of exs(s)) expect(exerciseOf(e.exerciseId).contra).not.toContain('epaule')
  })
})

describe('EMOM, AMRAP et chrono ne sont jamais générés', () => {
  it('sur tous les profils, niveaux et objectifs', () => {
    for (const goal of ['hypertrophie', 'force', 'mixte'] as const) for (const level of ['debutant', 'intermediaire', 'avance'] as const) for (const maxMinutes of [45, 60, 90] as const) {
      const p = gen(muscu({ muscuSessions: 4, maxMinutes, strength: { goal, level, lifts: {} } }))
      for (const w of p.weeks) for (const s of w.sessions) for (const g of s.groups ?? []) expect(['superset']).toContain(g.kind)
    }
    expect(isRoundsKind('superset')).toBe(true)
  })
})

describe('progression des séries détaillées en génération', () => {
  it('série lourde réussie à toutes les parties : +2,5 kg proposés sur les séances futures', () => {
    const p = gen(force('intermediaire'))
    const first = week(p, 1)[0]
    const e = exs(first)[0]
    expect(e.format).toBe('lourde')
    // toutes les parties atteignent leurs reps cibles avec le RIR visé
    e.logs = e.plan!.map((set, i) => ({ n: i + 1, kg: 100, reps: set.parts[0].repMax ?? set.parts[0].reps!, rir: e.rir, at: '2026-01-05T10:00:00.000Z' }))
    first.status = 'faite'
    const res = adjustLoadsAfterSession(p, first.id, first.date)
    const future = allSessions(res.program).filter((s) => s.date > first.date && s.status === 'prevue').flatMap(exs).filter((x) => x.exerciseId === e.exerciseId)
    expect(future.length).toBeGreaterThan(0)
    expect(future.every((x) => x.targetKg === 102.5)).toBe(true)
    expect(res.adaptations.some((a) => /102,5/.test(a.text))).toBe(true)
  })
  it('une partie manquée : la charge ne monte pas', () => {
    const p = gen(force('intermediaire'))
    const first = week(p, 1)[0]
    const e = exs(first)[0]
    e.logs = e.plan!.map((set, i) => ({ n: i + 1, kg: 100, reps: i === 2 ? 3 : (set.parts[0].repMax ?? set.parts[0].reps!), rir: e.rir, at: '2026-01-05T10:00:00.000Z' }))
    first.status = 'faite'
    const res = adjustLoadsAfterSession(p, first.id, first.date)
    expect(res.adaptations.some((a) => a.kind === 'charge' && /augmentée/.test(a.text) && a.text.includes(exerciseOf(e.exerciseId).name))).toBe(false)
  })
})
