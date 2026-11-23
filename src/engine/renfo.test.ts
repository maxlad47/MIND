// Renfo coureur : contenu par phase, pliométrie et calendrier de course, placement, matériel, compléments en programme mixte.
import { describe, expect, it } from 'vitest'
import { exerciseOf } from './exercises'
import { BASE_Q, P_MARATHON, P_MIXTE } from './fixtures'
import { groupMembers } from './formats'
import { generateProgram } from './program'
import { buildRenfoSession, isPlyo, plyoAllowed, progressStep, renfoAllowed, renfoKitOf, renfoTemplates, type RenfoCtx } from './renfo'
import { runClass } from './combine'
import type { Program, Questionnaire, RenfoKit, Session } from './types'
import { addDays } from './utils'

const ctx = (o: Partial<RenfoCtx> = {}): RenfoCtx => ({ kit: 'nu', level: 'intermediaire', injuries: [], phase: 'Base', weekN: 1, light: false, ...o })
const ids = (s: Session) => s.exercises!.map((e) => e.exerciseId)
const withRenfo = (q: Questionnaire, perWeek: 1 | 2 = 1, kit: RenfoKit = 'nu'): Questionnaire => ({ ...q, run: { ...q.run, renfo: { perWeek, kit } } })
const gen = (q: Questionnaire): Program => generateProgram(q, { now: '2026-01-05' })
const renfoOf = (p: Program) => p.weeks.flatMap((w) => w.sessions).filter((s) => s.kind === 'renfo')

describe('contenu par phase', () => {
  it('base : gainage et force, sans pliométrie', () => {
    const s = buildRenfoSession(ctx({ phase: 'Base' }))!
    expect(ids(s).some(isPlyo)).toBe(false)
    const ex = ids(s).map(exerciseOf)
    expect(ex.some((e) => e.pattern === 'core')).toBe(true) // gainage
    expect(ex.some((e) => e.pattern === 'lunge')).toBe(true) // fentes, bulgare…
    expect(ids(s)).toContain('mollets_excentrique')
    expect(ex.some((e) => e.pattern === 'hip_thrust')).toBe(true) // pont fessier
  })
  it('base : le cercle de gainage inclut la Copenhague en alternance avec la planche latérale', () => {
    const seen = new Set([1, 2, 3, 4].flatMap((w) => ids(buildRenfoSession(ctx({ weekN: w }))!)))
    expect(seen.has('copenhague')).toBe(true)
    expect(seen.has('planche_laterale')).toBe(true)
  })
  it('développement : mêmes bases + 1 ou 2 exercices de pliométrie', () => {
    for (const w of [1, 2, 3, 5, 7]) {
      const s = buildRenfoSession(ctx({ phase: 'Développement', weekN: w }))!
      const plyo = ids(s).filter(isPlyo).length
      expect(plyo).toBeGreaterThanOrEqual(1)
      expect(plyo).toBeLessThanOrEqual(2)
      expect(ids(s)).toContain('mollets_excentrique')
    }
  })
  it('spécifique : entretien, moins de tours, la pliométrie est conservée', () => {
    for (const w of [3, 5, 7, 9]) {
      const dev = buildRenfoSession(ctx({ phase: 'Développement', weekN: w }))!
      const spe = buildRenfoSession(ctx({ phase: 'Spécifique', weekN: w }))!
      expect(ids(spe).filter(isPlyo).length).toBeGreaterThanOrEqual(1)
      expect(spe.groups![0].rounds).toBeLessThanOrEqual(dev.groups![0].rounds)
      expect(spe.groups![0].rounds).toBe(2)
    }
    expect(buildRenfoSession(ctx({ phase: 'Développement', weekN: 5 }))!.groups![0].rounds).toBeGreaterThan(2)
  })
  it('affûtage : volume divisé par deux', () => {
    const dev = buildRenfoSession(ctx({ phase: 'Développement', weekN: 5 }))!
    const aff = buildRenfoSession(ctx({ phase: 'Affûtage', weekN: 5, daysToRace: 20 }))!
    expect(aff.groups![0].rounds).toBeLessThanOrEqual(Math.ceil(dev.groups![0].rounds / 2))
    expect(aff.estMinutes).toBeLessThan(dev.estMinutes * 0.75)
  })
  it('c\'est un circuit de 20 à 30 minutes avec un échauffement de mobilité, 4 à 6 exercices, 2 à 4 tours', () => {
    const weeks = { Base: [1, 3, 5], 'Développement': [1, 3, 5, 7, 9], 'Spécifique': [5, 7, 9, 11] } as const
    for (const phase of ['Base', 'Développement', 'Spécifique'] as const) for (const weekN of weeks[phase]) {
      const s = buildRenfoSession(ctx({ phase, weekN }))!
      expect(s.estMinutes).toBeGreaterThanOrEqual(20)
      expect(s.estMinutes).toBeLessThanOrEqual(30)
      expect(s.exercises!.length).toBeGreaterThanOrEqual(4)
      expect(s.exercises!.length).toBeLessThanOrEqual(6)
      expect(s.groups![0].kind).toBe('circuit')
      expect(s.groups![0].rounds).toBeGreaterThanOrEqual(2)
      expect(s.groups![0].rounds).toBeLessThanOrEqual(4)
      expect(s.warmup).toMatch(/5 min de mobilité/)
      expect(s.kind).toBe('renfo')
      expect(s.sport).toBe('muscu')
    }
  })
})

describe('calendrier de course', () => {
  it('aucune pliométrie dans les 10 jours avant la course', () => {
    expect(plyoAllowed(11)).toBe(true)
    expect(plyoAllowed(10)).toBe(false)
    for (const days of [4, 5, 7, 10]) for (const phase of ['Développement', 'Spécifique', 'Affûtage'] as const) {
      expect(ids(buildRenfoSession(ctx({ phase, weekN: 7, daysToRace: days }))!).some(isPlyo)).toBe(false)
    }
    expect(ids(buildRenfoSession(ctx({ phase: 'Développement', weekN: 7, daysToRace: 30 }))!).some(isPlyo)).toBe(true)
  })
  it('pas de renfo dans les 3 derniers jours', () => {
    expect(renfoAllowed(4)).toBe(true)
    for (const d of [0, 1, 2, 3]) expect(buildRenfoSession(ctx({ phase: 'Affûtage', daysToRace: d }))).toBeNull()
    expect(buildRenfoSession(ctx({ phase: 'Affûtage', daysToRace: 4 }))).not.toBeNull()
  })
  it('dans un programme complet, aucune pliométrie à moins de 10 jours ni aucun renfo à moins de 4 jours de la course', () => {
    const p = gen(withRenfo(P_MARATHON, 2))
    const race = P_MARATHON.run.raceDate
    const list = renfoOf(p)
    expect(list.length).toBeGreaterThan(10)
    for (const s of list) {
      const left = (Date.parse(race) - Date.parse(s.date)) / 86400000
      expect(left).toBeGreaterThan(3)
      if (left <= 10) expect(s.exercises!.some((e) => isPlyo(e.exerciseId))).toBe(false)
    }
  })
})

describe('progression', () => {
  it('toutes les 2 semaines : +1 tour, ou reps et durée en hausse (planche 30 s → 40 s → 50 s)', () => {
    expect(progressStep(1)).toBe(0)
    expect(progressStep(2)).toBe(0)
    expect(progressStep(3)).toBe(1)
    expect(progressStep(5)).toBe(2)
    const sec = (w: number) => buildRenfoSession(ctx({ phase: 'Base', weekN: w }))!.exercises!.find((e) => exerciseOf(e.exerciseId).unit === 'sec')!.repMin
    const early = sec(1)
    const late = sec(9)
    expect(late).toBeGreaterThan(early)
    const rounds = (w: number) => buildRenfoSession(ctx({ phase: 'Base', weekN: w }))!.groups![0].rounds
    expect(rounds(3)).toBeGreaterThanOrEqual(rounds(1))
  })
  it('une semaine allégée du plan allège aussi le renfo', () => {
    const normal = buildRenfoSession(ctx({ phase: 'Développement', weekN: 5 }))!
    const light = buildRenfoSession(ctx({ phase: 'Développement', weekN: 5, light: true }))!
    expect(light.groups![0].rounds).toBeLessThan(normal.groups![0].rounds)
  })
  it('dans un programme complet, les semaines allégées ont moins de tours', () => {
    const p = gen(withRenfo(P_MARATHON))
    const rounds = (w: Program['weeks'][number]) => w.sessions.find((s) => s.kind === 'renfo')?.groups?.[0].rounds
    const light = p.weeks.find((w) => w.light && w.phase === 'Développement')!
    const prev = p.weeks[light.n - 2]
    expect(rounds(light)).toBeLessThanOrEqual(rounds(prev)!)
  })
})

describe('matériel et zones contre-indiquées', () => {
  const RANK: Record<RenfoKit, number> = { nu: 0, elastique: 1, salle: 2 }
  it('chaque matériel ne propose que ses exercices', () => {
    for (const kit of ['nu', 'elastique', 'salle'] as const) for (const w of [1, 3, 5, 9]) for (const phase of ['Base', 'Développement', 'Spécifique'] as const) {
      for (const id of ids(buildRenfoSession(ctx({ kit, phase, weekN: w }))!)) expect(RANK[renfoKitOf(id)], `${kit} / ${id}`).toBeLessThanOrEqual(RANK[kit])
    }
  })
  it('à la maison, sans matériel : ni élastique, ni haltère, ni machine ; avec élastique : de l\'élastique ou des haltères', () => {
    const nu = [1, 2, 3, 4, 5, 6].flatMap((w) => ids(buildRenfoSession(ctx({ kit: 'nu', weekN: w }))!))
    expect(nu.every((i) => !['elastique', 'machine', 'barre', 'poulie', 'smith'].includes(exerciseOf(i).equipment))).toBe(true)
    expect(nu.some((i) => ['halteres'].includes(exerciseOf(i).equipment))).toBe(true) // fentes, bulgare : réalisés au poids du corps…
    const noted = [1, 2, 3, 4, 5, 6].flatMap((w) => buildRenfoSession(ctx({ kit: 'nu', weekN: w }))!.exercises!).filter((e) => exerciseOf(e.exerciseId).equipment === 'halteres')
    expect(noted.every((e) => /poids du corps/.test(e.note ?? ''))).toBe(true) // … et signalés comme tels
    const el = new Set([1, 2, 3, 4, 5, 6].flatMap((w) => ids(buildRenfoSession(ctx({ kit: 'elastique', weekN: w }))!).map((i) => exerciseOf(i).equipment)))
    expect(el.has('elastique') || el.has('halteres')).toBe(true)
  })
  it('zones contre-indiquées : aucun exercice qui les sollicite', () => {
    for (const zone of ['genou', 'cheville', 'hanche', 'epaule'] as const) for (const w of [1, 3, 5, 7]) {
      for (const phase of ['Base', 'Développement'] as const) {
        const s = buildRenfoSession(ctx({ injuries: [zone], phase, weekN: w }))!
        for (const id of ids(s)) expect(exerciseOf(id).contra, id).not.toContain(zone)
      }
    }
  })
  it('un débutant ne reçoit pas d\'exercice avancé', () => {
    for (const w of [1, 3, 5]) for (const id of ids(buildRenfoSession(ctx({ level: 'debutant', phase: 'Développement', weekN: w }))!)) expect(['debutant']).toContain(exerciseOf(id).level)
  })
})

describe('placement (course seule)', () => {
  const p = gen(withRenfo(P_MARATHON, 1))
  const all = p.weeks.flatMap((w) => w.sessions)
  const nextDay = (s: Session) => all.filter((x) => x.date === addDays(s.date, 1) && x.status !== 'sautee')

  it('jamais la veille de la sortie longue, ni la veille d\'une séance de qualité', () => {
    for (const s of renfoOf(p)) for (const x of nextDay(s)) expect(['long', 'quality']).not.toContain(runClass(x))
  })
  it('après une séance de qualité le même jour, ou un jour sans course', () => {
    const list = renfoOf(p)
    expect(list.length).toBeGreaterThan(10)
    for (const s of list) {
      const same = all.filter((x) => x.date === s.date && x.sport === 'course')
      // même jour : jamais une sortie longue ; de préférence une séance de qualité
      expect(same.some((x) => runClass(x) === 'long')).toBe(false)
    }
    const afterQuality = list.filter((s) => all.some((x) => x.date === s.date && runClass(x) === 'quality')).length
    const free = list.filter((s) => !all.some((x) => x.date === s.date && x.sport === 'course')).length
    expect(afterQuality + free).toBeGreaterThanOrEqual(Math.round(list.length * 0.8))
  })
  it('à la semaine, 2 séances de renfo ne tombent pas la même semaine le même jour', () => {
    const two = gen(withRenfo(P_MARATHON, 2))
    for (const w of two.weeks) {
      const r = w.sessions.filter((s) => s.kind === 'renfo')
      expect(new Set(r.map((s) => s.date)).size).toBe(r.length)
    }
  })
  it('si la semaine ne le permet pas : la séance saute, avec un PlanWarning', () => {
    // 2 jours seulement, la sortie longue le dimanche et une séance de qualité le samedi : aucun jour possible sans enfreindre une règle
    const tight = gen(withRenfo({ ...P_MARATHON, runSessions: 2, availableDays: [5, 6], dayPrefs: { run: [5, 6], longRun: 6 } }, 2))
    const days = tight.weeks.flatMap((w) => w.sessions)
    for (const s of days.filter((x) => x.kind === 'renfo')) for (const x of days.filter((y) => y.date === addDays(s.date, 1))) expect(['long', 'quality']).not.toContain(runClass(x))
    expect(tight.warnings.some((w) => w.code === 'renfo_placement')).toBe(true)
  })
  it('sans renfo demandé (programme existant) : aucun renfo', () => {
    expect(renfoOf(gen(P_MARATHON))).toHaveLength(0)
    expect(renfoOf(gen({ ...P_MARATHON, run: { ...P_MARATHON.run, renfo: { perWeek: 0, kit: 'nu' } } }))).toHaveLength(0)
  })
  it('la durée du renfo compte dans la semaine', () => {
    const w = p.weeks[3]
    const total = w.sessions.reduce((a, s) => a + s.estMinutes, 0)
    expect(total).toBeGreaterThan(w.sessions.filter((s) => s.kind !== 'renfo').reduce((a, s) => a + s.estMinutes, 0))
  })
})

describe('programme mixte : compléments de coureur dans les séances de muscu', () => {
  const q = withRenfo({ ...P_MIXTE, maxMinutes: 75 }, 2, 'salle')
  const p = gen(q)

  it('pas de séance de renfo à part', () => {
    expect(renfoOf(p)).toHaveLength(0)
  })
  it('2 ou 3 exercices de coureur ajoutés à la fin de séances de muscu, de préférence bas du corps puis full body', () => {
    const w = p.weeks[2]
    const withExtras = w.sessions.filter((s) => s.exercises?.some((e) => e.renfo))
    expect(withExtras.length).toBeGreaterThanOrEqual(1)
    expect(withExtras.length).toBeLessThanOrEqual(2)
    for (const s of withExtras) {
      const extras = s.exercises!.filter((e) => e.renfo)
      expect(extras.length).toBeGreaterThanOrEqual(2)
      expect(extras.length).toBeLessThanOrEqual(3)
      // en fin de séance
      expect(s.exercises!.slice(-extras.length).every((e) => e.renfo)).toBe(true)
    }
    expect(withExtras.some((s) => ['bas', 'jambes', 'fullbody'].includes(s.kind))).toBe(true)
    const ex = withExtras.flatMap((s) => s.exercises!.filter((e) => e.renfo).map((e) => e.exerciseId))
    expect(ex.some((i) => exerciseOf(i).pattern === 'calf')).toBe(true) // mollets en excentrique
    expect(ex.some((i) => ['copenhague', 'planche_laterale'].includes(i))).toBe(true) // gainage latéral
  })
  it('un exercice unilatéral est ajouté seulement si la séance n\'en a pas', () => {
    for (const w of p.weeks.slice(0, 6)) for (const s of w.sessions.filter((x) => x.exercises?.some((e) => e.renfo))) {
      const base = s.exercises!.filter((e) => !e.renfo)
      const baseUni = base.some((e) => exerciseOf(e.exerciseId).perSide && !['core', 'curl', 'pull_h', 'pull_v'].includes(exerciseOf(e.exerciseId).pattern))
      const extraUni = s.exercises!.filter((e) => e.renfo && exerciseOf(e.exerciseId).perSide && ['lunge', 'hip_thrust'].includes(exerciseOf(e.exerciseId).pattern))
      if (baseUni) expect(extraUni).toHaveLength(0)
    }
  })
  it('jamais au-delà de maxMinutes, durée recalculée', () => {
    for (const lim of [45, 60, 75, 90] as const) {
      const pp = gen(withRenfo({ ...P_MIXTE, maxMinutes: lim }, 2, 'salle'))
      for (const w of pp.weeks) for (const s of w.sessions.filter((x) => x.sport === 'muscu')) expect(s.estMinutes).toBeLessThanOrEqual(lim)
    }
  })
  it('filtre matériel : sans matériel, que des exercices au poids du corps', () => {
    const nu = gen(withRenfo(P_MIXTE, 2, 'nu'))
    for (const w of nu.weeks) for (const s of w.sessions) for (const e of s.exercises?.filter((x) => x.renfo) ?? []) expect(renfoKitOf(e.exerciseId)).toBe('nu')
  })
  it('à moins de 3 jours de la course, plus de compléments', () => {
    const race = q.run.raceDate
    for (const w of p.weeks) for (const s of w.sessions) if (s.exercises?.some((e) => e.renfo)) expect((Date.parse(race) - Date.parse(s.date)) / 86400000).toBeGreaterThan(3)
  })
  it('les règles anti-conflit muscu / course s\'appliquent toujours (jambes lourdes jamais la veille d\'une sortie longue)', () => {
    const all = p.weeks.flatMap((w) => w.sessions)
    for (const s of all.filter((x) => x.sport === 'muscu' && x.legLoad === 'heavy')) for (const x of all.filter((y) => y.date === addDays(s.date, 1))) expect(runClass(x)).not.toBe('long')
  })
  it('programme existant : aucun complément', () => {
    for (const w of gen(P_MIXTE).weeks) for (const s of w.sessions) expect(s.exercises?.some((e) => e.renfo) ?? false).toBe(false)
  })
})

describe('modèles « Renfo coureur » toutes prêtes (course en mode libre)', () => {
  it('deux modèles : sans matériel, et avec élastique', () => {
    const t = renfoTemplates()
    expect(t.map((x) => x.name)).toEqual(['Renfo coureur · sans matériel', 'Renfo coureur · avec élastique'])
    for (const x of t) {
      expect(x.exercises.length).toBeGreaterThanOrEqual(4)
      expect(x.groups![0].kind).toBe('circuit')
      expect(groupMembers(x, x.groups![0])).toHaveLength(x.exercises.length)
    }
    expect(t[0].exercises.every((e) => renfoKitOf(e.exerciseId) === 'nu')).toBe(true)
    expect(t[1].exercises.some((e) => ['elastique', 'halteres'].includes(exerciseOf(e.exerciseId).equipment))).toBe(true)
  })
  it('BASE_Q reste inchangé : pas de renfo par défaut', () => {
    expect(BASE_Q.run.renfo).toBeUndefined()
  })
})
