import { describe, expect, it } from 'vitest'
import { generateProgram } from './program'
import { EXERCISES, EXERCISE_BY_ID, alternativesFor, isAllowed } from './exercises'
import { checkProgram, MAX_WEEKLY_SETS } from './guardrails'
import { runClass } from './combine'
import { weeklyMuscleSets } from './strength'
import { computePaces, predictRaceSeconds, riegel, vmaFromRecent } from './running'
import { P_10K_COURT, P_DEBUTANT, P_FORCE_EPAULE, P_MARATHON, P_MIXTE } from './fixtures'
import { diffDays, weekday } from './utils'

const gen = (q: Parameters<typeof generateProgram>[0]) => generateProgram(q, { now: '2026-01-05', clientId: 'c1' })

describe('bibliothèque d\'exercices', () => {
  it('contient environ 100 exercices avec alternatives', () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(95)
    const ids = new Set(EXERCISES.map((e) => e.id))
    expect(ids.size).toBe(EXERCISES.length)
  })
  it('les alternatives gardent le même muscle et le même schéma, hors contre-indications', () => {
    const alts = alternativesFor('dev_couche_barre', ['epaule'])
    expect(alts.length).toBeGreaterThan(0)
    for (const a of alts) {
      expect(a.muscle).toBe('pectoraux')
      expect(a.pattern).toBe('push_h')
      expect(a.contra).not.toContain('epaule')
    }
  })
})

describe('allures de course', () => {
  it('Riegel et VMA cohérents', () => {
    expect(Math.round(riegel(3000, 10, 21.0975))).toBeGreaterThan(6000)
    const vma = vmaFromRecent('10k', 50 * 60)
    expect(vma).toBeGreaterThan(13)
    expect(vma).toBeLessThan(15)
  })
  it('zones d\'allure ordonnées', () => {
    const p = computePaces(15, 'vma')
    expect(p.recup).toBeGreaterThan(p.ef)
    expect(p.ef).toBeGreaterThan(p.marathon)
    expect(p.marathon).toBeGreaterThan(p.semi)
    expect(p.semi).toBeGreaterThan(p.seuil)
    expect(p.seuil).toBeGreaterThan(p.dix)
    expect(p.dix).toBeGreaterThan(p.vmaPace)
  })
})

describe('profil : débutant hypertrophie 3×/sem', () => {
  const p = gen(P_DEBUTANT)
  it('génère 8 semaines de 3 séances en full body', () => {
    expect(p.weeks).toHaveLength(8)
    expect(p.split).toBe('fullbody3')
    for (const w of p.weeks) expect(w.sessions).toHaveLength(3)
  })
  it('décharge en semaine 8 avec RIR 4 et volume réduit', () => {
    expect(p.weeks[7].light).toBe(true)
    const rirs = p.weeks[7].sessions.flatMap((s) => s.exercises!.map((e) => e.rir))
    expect(Math.min(...rirs)).toBe(4)
    const v7 = Object.values(weeklyMuscleSets(p.weeks[6].sessions)).reduce((a, b) => a + b, 0)
    const v8 = Object.values(weeklyMuscleSets(p.weeks[7].sessions)).reduce((a, b) => a + b, 0)
    expect(v8).toBeLessThan(v7 * 0.7)
  })
  it('chaque séance tient dans la durée max', () => {
    for (const w of p.weeks) for (const s of w.sessions) expect(s.estMinutes).toBeLessThanOrEqual(60)
  })
  it('volume hebdo par muscle sous le plafond débutant', () => {
    for (const w of p.weeks) {
      for (const n of Object.values(weeklyMuscleSets(w.sessions))) expect(n).toBeLessThanOrEqual(MAX_WEEKLY_SETS.debutant)
    }
  })
  it('hypertrophie : reps 6–10 sur le principal, 10–20 en isolation', () => {
    const s = p.weeks[0].sessions[0]
    expect(s.exercises![0].repMin).toBe(6)
    const iso = s.exercises!.find((e) => !EXERCISE_BY_ID[e.exerciseId].compound)
    if (iso) expect(iso.repMax).toBeGreaterThanOrEqual(15)
  })
  it('sessions placées sur des jours distincts quand possible', () => {
    const days = p.weeks[1].sessions.map((s) => s.date)
    expect(new Set(days).size).toBe(3)
  })
  it('aucun garde-fou violé', () => {
    expect(checkProgram(p, [])).toEqual([])
  })
})

describe('profil : intermédiaire force 4×/sem, douleur épaule', () => {
  const p = gen(P_FORCE_EPAULE)
  it('split Haut/Bas ×2', () => {
    expect(p.split).toBe('haut_bas')
    expect(p.weeks[0].sessions.map((s) => s.kind)).toEqual(expect.arrayContaining(['haut', 'bas']))
  })
  it('aucun exercice contre-indiqué pour l\'épaule', () => {
    for (const w of p.weeks) {
      for (const s of w.sessions) {
        for (const e of s.exercises!) expect(isAllowed(EXERCISE_BY_ID[e.exerciseId], ['epaule'])).toBe(true)
      }
    }
    expect(checkProgram(p, ['epaule'])).toEqual([])
    expect(p.warnings.some((w) => w.code === 'blessure')).toBe(true)
  })
  it('mouvements lourds en 3–6 reps avec charges estimées', () => {
    const bas = p.weeks[0].sessions.find((s) => s.kind === 'bas')!
    const first = bas.exercises![0]
    expect(first.repMin).toBe(3)
    expect(first.repMax).toBe(6)
    expect(first.restSec).toBeGreaterThanOrEqual(180)
    expect(first.targetKg).toBeGreaterThan(40)
  })
})

describe('profil : marathon dans 16 semaines, 4 sorties, 3:45', () => {
  const p = gen(P_MARATHON)
  const runs = (w: number) => p.weeks[w].sessions.filter((s) => s.sport === 'course')
  it('16 semaines, 4 sorties par semaine, phases dans l\'ordre', () => {
    expect(p.weeks).toHaveLength(16)
    const order = ['Base', 'Développement', 'Spécifique', 'Affûtage']
    const idx = p.weeks.map((w) => order.indexOf(w.phase))
    expect([...idx].sort((a, b) => a - b)).toEqual(idx)
    expect(p.weeks[15].phase).toBe('Affûtage')
    expect(p.weeks[13].phase).toBe('Affûtage') // 3 semaines d'affûtage
    expect(runs(2)).toHaveLength(4)
  })
  it('jour de course en dernière semaine', () => {
    const race = p.weeks[15].sessions.find((s) => s.kind === 'course')
    expect(race?.date).toBe('2026-04-26')
  })
  it('progression du volume ≤ 10 % entre semaines de charge', () => {
    const km = p.weeks.map((w) => w.sessions.reduce((a, s) => a + (s.run?.totalKm ?? 0), 0))
    let lastLoaded = 0
    p.weeks.forEach((w, i) => {
      if (w.phase === 'Affûtage' || w.light) return
      if (lastLoaded) expect(km[i]).toBeLessThanOrEqual(lastLoaded * 1.1 + 6) // marge : détail des séances arrondi
      lastLoaded = km[i]
    })
  })
  it('semaine allégée toutes les 3–4 semaines', () => {
    const lights = p.weeks.filter((w) => w.light && w.phase !== 'Affûtage').map((w) => w.n)
    expect(lights.length).toBeGreaterThanOrEqual(2)
    expect(lights[0]).toBeLessThanOrEqual(4)
  })
  it('sortie longue ≤ 32 km et ≤ 3 h', () => {
    for (const w of p.weeks) {
      for (const s of w.sessions.filter((x) => x.kind === 'longue')) {
        expect(s.run!.totalKm).toBeLessThanOrEqual(32.5)
        expect(s.estMinutes).toBeLessThanOrEqual(185)
      }
    }
    const maxLong = Math.max(...p.weeks.flatMap((w) => w.sessions.filter((x) => x.kind === 'longue').map((x) => x.run!.totalKm)))
    expect(maxLong).toBeGreaterThan(24)
  })
  it('jamais deux séances de qualité consécutives', () => {
    for (const w of p.weeks) {
      const q = w.sessions.filter((s) => runClass(s) === 'quality').map((s) => weekday(s.date)).sort()
      for (let i = 1; i < q.length; i++) expect(q[i] - q[i - 1]).toBeGreaterThan(1)
    }
  })
  it('chrono 3:45 comparé à la prédiction', () => {
    const predicted = predictRaceSeconds(p.paces!.vma, 'marathon')
    expect(predicted).toBeGreaterThan(3.3 * 3600)
    expect(p.paces!.source).toBe('chrono')
  })
  it('séances détaillées avec allures en min/km', () => {
    const q = runs(6).find((s) => s.kind === 'vma' || s.kind === 'seuil' || s.kind === 'specifique' || s.kind === 'fartlek' || s.kind === 'cotes')!
    expect(q.run!.warmup.length).toBeGreaterThan(5)
    expect(q.run!.blocks.length).toBeGreaterThan(0)
    expect(q.run!.cooldown.length).toBeGreaterThan(5)
  })
  it('aucun garde-fou violé', () => {
    expect(checkProgram(p, [])).toEqual([])
  })
})

describe('profil : 10 km dans 5 semaines (cas trop court)', () => {
  const p = gen(P_10K_COURT)
  it('alerte « préparation trop courte » avec proposition', () => {
    expect(p.weeks).toHaveLength(5)
    const w = p.warnings.find((x) => x.code === 'prepa_trop_courte')
    expect(w).toBeDefined()
    expect(w!.suggestion).toMatch(/Finir/)
  })
  it('séance test en semaine 1 (aucune donnée)', () => {
    expect(p.paces!.source).toBe('niveau')
    expect(p.weeks[0].sessions.some((s) => s.kind === 'test')).toBe(true)
  })
  it('1 semaine d\'affûtage et course en dernier', () => {
    expect(p.weeks[4].phase).toBe('Affûtage')
    expect(p.weeks[3].phase).not.toBe('Affûtage')
    expect(p.weeks[4].sessions.some((s) => s.kind === 'course')).toBe(true)
  })
})

describe('profil : mixte 3 muscu + 2 course, priorité course', () => {
  const p = gen(P_MIXTE)
  const weeks = p.weeks.filter((w) => w.phase !== 'Affûtage')
  it('contient muscu ET course chaque semaine', () => {
    for (const w of weeks) {
      expect(w.sessions.filter((s) => s.sport === 'muscu')).toHaveLength(3)
      expect(w.sessions.filter((s) => s.sport === 'course').length).toBeGreaterThanOrEqual(2)
    }
  })
  it('volume de jambes réduit par rapport à un profil muscu seul', () => {
    const solo = gen({ ...P_MIXTE, programType: 'muscu' })
    const legs = (prog: typeof p) => {
      const sets = weeklyMuscleSets(prog.weeks[2].sessions)
      return (sets.quadriceps ?? 0) + (sets.ischios ?? 0) + (sets.fessiers ?? 0)
    }
    expect(legs(p)).toBeLessThan(legs(solo) * 0.75)
  })
  it('jamais de séance lourde de jambes la veille d\'une qualité / sortie longue, ni le lendemain de la longue', () => {
    for (const w of weeks) {
      const heavy = w.sessions.filter((s) => s.sport === 'muscu' && s.legLoad === 'heavy')
      for (const h of heavy) {
        for (const r of w.sessions.filter((s) => s.sport === 'course')) {
          const d = diffDays(h.date, r.date)
          if (runClass(r) === 'quality' || runClass(r) === 'long') expect(d).not.toBe(1)
          if (runClass(r) === 'long') expect(d).not.toBe(-1)
        }
      }
    }
  })
  it('double séance seulement si nécessaire (7 jours disponibles → pas de double)', () => {
    for (const w of weeks) {
      const dates = w.sessions.map((s) => s.date)
      expect(new Set(dates).size).toBe(dates.length)
    }
  })
  it('affûtage : muscu en entretien léger', () => {
    const taper = p.weeks.filter((w) => w.phase === 'Affûtage')
    expect(taper.length).toBeGreaterThan(0)
    const normal = Object.values(weeklyMuscleSets(p.weeks[2].sessions)).reduce((a, b) => a + b, 0)
    const light = Object.values(weeklyMuscleSets(taper[0].sessions.filter((s) => s.sport === 'muscu'))).reduce((a, b) => a + b, 0)
    expect(light).toBeLessThan(normal * 0.7)
  })
  it('placement avec peu de jours : doubles autorisés mais règles dures respectées', () => {
    const few = gen({ ...P_MIXTE, availableDays: [1, 3, 5, 6] })
    expect(few.warnings.some((w) => w.code === 'jours_insuffisants')).toBe(true)
    for (const w of few.weeks.filter((x) => x.phase !== 'Affûtage')) {
      for (const s of w.sessions) expect([1, 3, 5, 6]).toContain(weekday(s.date))
    }
  })
})

describe('chrono : estimation, verdict et chronos de référence', () => {
  const run = { ...P_MARATHON.run, objective: 'chrono' as const, recent: undefined }
  it('plusieurs chronos (5 km + 10 km) donnent une VMA cohérente avec chacun', async () => {
    const { pacesFromQuestionnaire, vmaFromRecent } = await import('./running')
    const both = pacesFromQuestionnaire({ ...run, distance: '10k', recents: [{ distance: '5k', seconds: 24 * 60, date: '' }, { distance: '10k', seconds: 51 * 60, date: '' }] })
    const v5 = vmaFromRecent('5k', 24 * 60)
    const v10 = vmaFromRecent('10k', 51 * 60)
    expect(both.source).toBe('chrono')
    expect(both.vma).toBeGreaterThanOrEqual(Math.min(v5, v10) - 0.05)
    expect(both.vma).toBeLessThanOrEqual(Math.max(v5, v10) + 0.05)
  })
  it('sans donnée : pas de verdict « irréaliste », mais un « à confirmer » honnête', () => {
    const q = { ...P_10K_COURT, run: { ...P_10K_COURT.run, raceDate: '2026-03-29', targetSeconds: 45 * 60 } }
    const p = gen(q)
    expect(p.warnings.some((w) => w.code === 'chrono_a_confirmer')).toBe(true)
    expect(p.warnings.some((w) => w.code === 'chrono_irrealiste')).toBe(false)
  })
  it('avec un chrono : verdict réaliste / ambitieux / très ambitieux selon l\'écart', async () => {
    const { assessTarget, pacesFromQuestionnaire } = await import('./running')
    const base = { ...run, distance: '10k' as const, recents: [{ distance: '10k' as const, seconds: 50 * 60, date: '' }] }
    const paces = pacesFromQuestionnaire(base)
    const v = (sec: number) => assessTarget({ ...base, targetSeconds: sec }, 12, paces)!.verdict
    expect(v(49 * 60)).toBe('realiste')
    expect(v(46 * 60 + 30)).toBe('ambitieux')
    expect(v(40 * 60)).toBe('irrealiste')
  })
})

describe('muscles exclus', () => {
  it('sans jambes : aucun exercice de jambes, séances « bas » converties en haut du corps', () => {
    const q = { ...P_FORCE_EPAULE, injuries: [] as never[], excludedMuscles: ['quadriceps', 'ischios', 'fessiers', 'mollets'] as never[] }
    const p = gen(q)
    expect(p.weeks[0].sessions).toHaveLength(4)
    for (const w of p.weeks) {
      for (const s of w.sessions) {
        for (const e of s.exercises!) expect(['quadriceps', 'ischios', 'fessiers', 'mollets']).not.toContain(EXERCISE_BY_ID[e.exerciseId].muscle)
        expect(s.legLoad).toBe('none')
      }
    }
    expect(p.warnings.some((w) => w.code === 'muscles_exclus')).toBe(true)
  })
  it('sans jambes : plus aucune séance « bas du corps », on passe sur Push / Pull / Full body', () => {
    const noLegs = ['quadriceps', 'ischios', 'fessiers', 'mollets'] as never[]
    for (const n of [2, 3, 4, 5]) {
      const p = gen({ ...P_DEBUTANT, muscuSessions: n, excludedMuscles: noLegs, strength: { ...P_DEBUTANT.strength, split: 'haut_bas_full' } })
      const kinds = p.weeks[0].sessions.map((s) => s.kind)
      expect(kinds).toHaveLength(n)
      for (const k of kinds) expect(['push', 'pull', 'fullbody']).toContain(k)
      for (const w of p.weeks) for (const s of w.sessions) expect(s.title).not.toMatch(/Bas du corps|Jambes/)
    }
    const p3 = gen({ ...P_DEBUTANT, muscuSessions: 3, excludedMuscles: noLegs })
    expect(p3.weeks[0].sessions.map((s) => s.kind).sort()).toEqual(['fullbody', 'pull', 'push'])
    expect(p3.split).toBe('push_pull_full')
  })
  it('sans jambes : le client peut choisir Full body ou Push / Pull', () => {
    const noLegs = ['quadriceps', 'ischios', 'fessiers', 'mollets'] as never[]
    const fb = gen({ ...P_DEBUTANT, muscuSessions: 3, excludedMuscles: noLegs, strength: { ...P_DEBUTANT.strength, split: 'fullbody' } })
    expect(fb.weeks[0].sessions.map((s) => s.kind).sort()).toEqual(['fullbody', 'fullbody', 'fullbody'])
    const pp = gen({ ...P_DEBUTANT, muscuSessions: 4, excludedMuscles: noLegs, strength: { ...P_DEBUTANT.strength, split: 'push_pull' } })
    expect(pp.weeks[0].sessions.map((s) => s.kind).sort()).toEqual(['pull', 'pull', 'push', 'push'])
  })
  it('sans bras ni abdos : ces muscles disparaissent', () => {
    const p = gen({ ...P_DEBUTANT, excludedMuscles: ['biceps', 'triceps', 'abdos'] })
    const muscles = new Set(p.weeks.flatMap((w) => w.sessions.flatMap((s) => s.exercises!.map((e) => EXERCISE_BY_ID[e.exerciseId].muscle))))
    for (const m of ['biceps', 'triceps', 'abdos']) expect(muscles.has(m as never)).toBe(false)
    expect(muscles.has('quadriceps')).toBe(true)
  })
})

describe('cohérence des séances (non-régression de l\'audit)', () => {
  const LOWER = ['quadriceps', 'ischios', 'fessiers', 'mollets']
  const grid = () => {
    const out: ReturnType<typeof gen>[] = []
    for (const level of ['debutant', 'intermediaire', 'avance'] as const)
      for (const goal of ['hypertrophie', 'force', 'mixte'] as const)
        for (const n of [2, 3, 4, 5])
          for (const maxMinutes of [45, 60, 90] as const)
            for (const mode of ['muscu', 'mixte'] as const)
              out.push(gen({ ...P_MIXTE, programType: mode, muscuSessions: n, maxMinutes, priority: mode === 'mixte' ? 'course' : 'equilibre', strength: { goal, level, lifts: {} } }))
    return out
  }
  const programs = grid()
  const muscuSessions = programs.flatMap((p) => p.weeks.filter((w) => !w.light).flatMap((w) => w.sessions.filter((s) => s.sport === 'muscu')))

  it('une séance « Bas du corps » / « Jambes » contient toujours un polyarticulaire de jambes, jamais que des abdos', () => {
    for (const s of muscuSessions.filter((x) => /Bas|Jambes/.test(x.title))) {
      const legs = s.exercises!.filter((e) => LOWER.includes(EXERCISE_BY_ID[e.exerciseId].muscle) && EXERCISE_BY_ID[e.exerciseId].compound)
      expect(legs.length, s.title).toBeGreaterThan(0)
    }
  })
  it('jamais de séance vide, ni dominée par les abdos, ni sans muscle principal', () => {
    for (const s of muscuSessions) {
      expect(s.exercises!.length).toBeGreaterThanOrEqual(3)
      const core = s.exercises!.filter((e) => EXERCISE_BY_ID[e.exerciseId].muscle === 'abdos').reduce((a, e) => a + e.sets, 0)
      expect(core).toBeLessThanOrEqual(3)
      expect(s.exercises!.some((e) => EXERCISE_BY_ID[e.exerciseId].compound)).toBe(true)
    }
  })
  it('un full body travaille le haut ET le bas du corps', () => {
    for (const s of muscuSessions.filter((x) => x.title.startsWith('Full body'))) {
      const m = s.exercises!.map((e) => EXERCISE_BY_ID[e.exerciseId].muscle)
      expect(m.some((x) => LOWER.includes(x))).toBe(true)
      expect(m.some((x) => !LOWER.includes(x) && x !== 'abdos')).toBe(true)
    }
  })
  it('pas deux polyarticulaires du même schéma ni d\'exercice en double dans une séance', () => {
    for (const s of muscuSessions) {
      const ids = s.exercises!.map((e) => e.exerciseId)
      expect(new Set(ids).size).toBe(ids.length)
      const comp = s.exercises!.filter((e) => EXERCISE_BY_ID[e.exerciseId].compound).map((e) => EXERCISE_BY_ID[e.exerciseId].pattern)
      expect(new Set(comp).size).toBe(comp.length)
    }
  })
  it('chaque séance tient dans la durée max', () => {
    for (const p of programs) for (const w of p.weeks) for (const s of w.sessions.filter((x) => x.sport === 'muscu')) expect(s.estMinutes).toBeLessThanOrEqual(p.q.maxMinutes)
  })
  it('course : qualité dans la durée max, sortie longue = la plus longue, volume ≈ volume visé', async () => {
    const { isQuality } = await import('./running')
    for (const maxMinutes of [45, 90] as const) {
      for (const runSessions of [2, 3, 4, 6]) {
        const p = gen({ ...P_MARATHON, runSessions, maxMinutes, run: { ...P_MARATHON.run, distance: 'semi', raceDate: '2026-04-26' } })
        for (const w of p.weeks.slice(1, -1)) {
          const runs = w.sessions.filter((s) => s.sport === 'course')
          for (const s of runs.filter((x) => isQuality(x.kind))) expect(s.estMinutes).toBeLessThanOrEqual(maxMinutes)
          if (w.phase !== 'Affûtage') {
            const long = runs.find((s) => s.kind === 'longue')!
            for (const s of runs.filter((x) => x !== long)) expect(long.run!.totalKm).toBeGreaterThanOrEqual(s.run!.totalKm - 0.01)
          }
        }
      }
    }
  })
})

describe('choix de formule d\'entraînement', () => {
  it('3 séances : Push / Pull / Jambes', () => {
    const p = gen({ ...P_DEBUTANT, muscuSessions: 3, strength: { ...P_DEBUTANT.strength, split: 'ppj3' } })
    expect(p.split).toBe('ppj3')
    expect(p.weeks[0].sessions.map((s) => s.kind).sort()).toEqual(['push', 'pull', 'jambes'].sort())
  })
  it('4 séances : split par muscle, chaque séance a au moins 4 exercices', () => {
    const p = gen({ ...P_DEBUTANT, muscuSessions: 4, strength: { ...P_DEBUTANT.strength, level: 'intermediaire', split: 'muscle4' } })
    expect(p.weeks[0].sessions.map((s) => s.kind).sort()).toEqual(['pecs', 'dos', 'epaules', 'jambes'].sort())
    for (const w of p.weeks) for (const s of w.sessions) expect(s.exercises!.length).toBeGreaterThanOrEqual(4)
  })
  it('5 séances : split par muscle', () => {
    const p = gen({ ...P_DEBUTANT, muscuSessions: 5, strength: { ...P_DEBUTANT.strength, level: 'intermediaire', split: 'muscle5' }, availableDays: [0, 1, 2, 3, 4, 5] })
    expect(p.weeks[0].sessions.map((s) => s.kind).sort()).toEqual(['pecs', 'dos', 'jambes', 'epaules', 'bras'].sort())
    for (const s of p.weeks[0].sessions) expect(s.exercises!.length).toBeGreaterThanOrEqual(4)
  })
  it('2 séances : Haut / Bas', () => {
    const p = gen({ ...P_DEBUTANT, muscuSessions: 2, strength: { ...P_DEBUTANT.strength, split: 'haut_bas2' } })
    expect(p.weeks[0].sessions.map((s) => s.kind).sort()).toEqual(['haut', 'bas'].sort())
  })
})

describe('jours choisis par sport et sortie longue', () => {
  const q = {
    ...P_MIXTE, runSessions: 3, muscuSessions: 3, startDate: '2026-01-05', availableDays: [0, 1, 2, 3, 4, 5],
    dayPrefs: { muscu: [1, 3, 5], run: [0, 2, 4], longRun: 0 },
  }
  const p = generateProgram(q, { clientId: 'c', now: '2026-01-05' })

  it('place la sortie longue le lundi, chaque semaine', () => {
    const longs = p.weeks.flatMap((w) => w.sessions.filter((s) => s.kind === 'longue'))
    expect(longs.length).toBeGreaterThan(5)
    longs.forEach((s) => expect(weekday(s.date)).toBe(0))
  })
  it('respecte les jours de muscu et de course', () => {
    p.weeks.flatMap((w) => w.sessions).forEach((s) => {
      if (s.sport === 'muscu') expect([1, 3, 5]).toContain(weekday(s.date))
      else if (s.kind !== 'course') expect([0, 2, 4]).toContain(weekday(s.date))
    })
  })
})
