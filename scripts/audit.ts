import { generateProgram } from '../src/engine/program'
import { EXERCISE_BY_ID } from '../src/engine/exercises'
import { BASE_Q } from '../src/engine/fixtures'
import type { Questionnaire, Session } from '../src/engine/types'
import { LOWER_MUSCLES } from '../src/engine/types'

const issues = new Map<string, { n: number; example: string }>()
const flag = (k: string, ex: string) => { const c = issues.get(k) ?? { n: 0, example: ex }; c.n++; issues.set(k, c) }
const sets = (s: Session, f: (m: string, compound: boolean) => boolean) => (s.exercises ?? []).filter((e) => f(EXERCISE_BY_ID[e.exerciseId].muscle, EXERCISE_BY_ID[e.exerciseId].compound)).reduce((a, e) => a + e.sets, 0)
const desc = (s: Session) => `${s.title} [${(s.exercises ?? []).map((e) => `${EXERCISE_BY_ID[e.exerciseId].name} ${e.sets}x`).join(' ; ')}]`

let total = 0
for (const goal of ['hypertrophie', 'force', 'mixte'] as const)
for (const level of ['debutant', 'intermediaire', 'avance'] as const)
for (const n of [1, 2, 3, 4, 5, 6])
for (const maxMinutes of [45, 60, 75, 90] as const)
for (const mode of ['muscu', 'mixte-course', 'mixte-equi', 'mixte-muscu'] as const) {
  const q: Questionnaire = { ...BASE_Q, programType: mode === 'muscu' ? 'muscu' : 'mixte', muscuSessions: n, runSessions: 3, maxMinutes,
    priority: mode === 'mixte-course' ? 'course' : mode === 'mixte-muscu' ? 'muscu' : 'equilibre',
    strength: { goal, level, lifts: {} }, run: { ...BASE_Q.run, distance: 'semi', raceDate: '2026-03-29', level: 'intermediaire', vma: 15 } }
  const p = generateProgram(q, { now: '2026-01-05' })
  total++
  const tag = `${goal}/${level}/${n}x/${maxMinutes}min/${mode}`
  p.weeks.forEach((w) => {
    const muscu = w.sessions.filter((s) => s.sport === 'muscu')
    for (const s of muscu) {
      const ex = s.exercises ?? []
      const legCompound = sets(s, (m, c) => LOWER_MUSCLES.includes(m as never) && c)
      const legAll = sets(s, (m) => LOWER_MUSCLES.includes(m as never))
      const coreSets = sets(s, (m) => m === 'abdos')
      const totalSets = ex.reduce((a, e) => a + e.sets, 0)
      const upper = sets(s, (m) => !LOWER_MUSCLES.includes(m as never) && m !== 'abdos')
      if (/Bas|Jambes/.test(s.title) && legCompound === 0) flag('BAS/JAMBES sans exercice polyarticulaire de jambes', tag + ' ' + desc(s))
      if (/Bas|Jambes/.test(s.title) && legAll < 6 && !w.light) flag('BAS/JAMBES avec < 6 séries de jambes', tag + ' ' + desc(s))
      if (/Haut|Push|Pull/.test(s.title) && upper < 6 && !w.light) flag('HAUT/PUSH/PULL avec < 6 séries', tag + ' ' + desc(s))
      if (/Full body/.test(s.title) && (legAll === 0 || upper === 0)) flag('FULL BODY sans jambes ou sans haut', tag + ' ' + desc(s))
      if (coreSets > 0 && coreSets >= totalSets * 0.5) flag('séance dominée par les abdos', tag + ' ' + desc(s))
      if (ex.length < 3 && !w.light) flag('séance avec < 3 exercices', tag + ' ' + desc(s))
      if (totalSets < 8 && !w.light && w.phase !== 'Affûtage') flag('séance avec < 8 séries', tag + ' ' + desc(s))
      if (s.estMinutes > maxMinutes) flag('dépasse la durée max', tag + ' ' + desc(s))
      const ids = ex.map((e) => e.exerciseId)
      if (new Set(ids).size !== ids.length) flag('exercice en double dans la séance', tag + ' ' + desc(s))
      const pats = ex.filter((e) => EXERCISE_BY_ID[e.exerciseId].compound).map((e) => EXERCISE_BY_ID[e.exerciseId].pattern)
      if (new Set(pats).size < pats.length - 1) flag('3+ polyarticulaires du même schéma', tag + ' ' + desc(s))
      if (coreSets > 4) flag('> 4 séries d\'abdos', tag + ' ' + desc(s))
    }
    // couverture hebdo (semaine normale)
    if (!w.light && w.phase !== 'Affûtage' && n >= 3 && w.n === 3) {
      const m = new Set(muscu.flatMap((s) => (s.exercises ?? []).map((e) => EXERCISE_BY_ID[e.exerciseId].muscle)))
      for (const need of ['pectoraux', 'dos', 'epaules', 'quadriceps', 'ischios']) if (!m.has(need as never)) flag(`muscle ${need} jamais travaillé de la semaine`, tag)
    }
  })
}
console.log('programmes générés :', total)
for (const [k, v] of [...issues.entries()].sort((a, b) => b[1].n - a[1].n)) console.log(`\n${v.n}× ${k}\n   ex: ${v.example.slice(0, 330)}`)
