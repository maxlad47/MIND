import { generateProgram } from '../src/engine/program'
import { EXERCISE_BY_ID } from '../src/engine/exercises'
import { BASE_Q, P_MIXTE } from '../src/engine/fixtures'
import { describeBlock } from '../src/engine/running'
import { weeklyMuscleSets } from '../src/engine/strength'
const show = (name: string, q: any, wk: number) => {
  const p = generateProgram(q, { now: '2026-01-05' })
  const w = p.weeks[wk - 1]
  console.log(`\n===== ${name} — S${w.n} ${w.phase}${w.light ? ' (allégée)' : ''}`)
  for (const s of w.sessions) {
    const d = new Date(s.date + 'T00:00:00Z').toLocaleDateString('fr-FR', { weekday: 'short', timeZone: 'UTC' })
    if (s.run) console.log(` ${d} ${s.slot ?? ''} ${s.title} ${s.run.totalKm}km`)
    else console.log(` ${d} ${s.slot ?? ''} ${s.title} (${s.estMinutes}min, jambes:${s.legLoad})\n     ` + s.exercises!.map((e) => `${EXERCISE_BY_ID[e.exerciseId].name} ${e.sets}×${e.repMin}-${e.repMax}`).join('\n     '))
  }
  const sets = weeklyMuscleSets(w.sessions)
  console.log('  séries/muscle :', Object.entries(sets).map(([m, n]) => `${m} ${n}`).join(', '))
}
show('Camille (mixte, priorité course, 3 muscu)', { ...P_MIXTE, muscuSessions: 3, priority: 'course', availableDays: [0, 1, 2, 4, 5, 6] }, 3)
show('Muscu 4x intermédiaire hypertrophie 75min', { ...BASE_Q, programType: 'muscu', muscuSessions: 4, maxMinutes: 75, strength: { goal: 'hypertrophie', level: 'intermediaire', lifts: {} } }, 3)
show('Muscu 5x avancé 90min', { ...BASE_Q, programType: 'muscu', muscuSessions: 5, maxMinutes: 90, strength: { goal: 'hypertrophie', level: 'avance', lifts: {} } }, 4)
