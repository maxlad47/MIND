import { generateProgram } from '../src/engine/program'
import { P_MARATHON, P_FORCE_EPAULE, P_MIXTE, P_DEBUTANT } from '../src/engine/fixtures'
import { EXERCISE_BY_ID } from '../src/engine/exercises'
import { describeBlock } from '../src/engine/running'
const show = (name: string, q: any, weeks: number[]) => {
  const p = generateProgram(q, { now: '2026-01-05' })
  console.log('\n=====', name, p.warnings.map(w => w.code))
  for (const n of weeks) {
    const w = p.weeks[n - 1]
    console.log(`-- S${w.n} ${w.phase}${w.light ? ' (allégée)' : ''}`)
    for (const s of w.sessions) {
      if (s.run) console.log(`  ${s.date} ${s.slot ?? ''} ${s.title} ${s.run.totalKm}km ${s.estMinutes}min | ${s.run.blocks.map(describeBlock).join(' + ')}`)
      else console.log(`  ${s.date} ${s.slot ?? ''} ${s.title} ${s.estMinutes}min leg=${s.legLoad} | ` + s.exercises!.map(e => `${EXERCISE_BY_ID[e.exerciseId].name} ${e.sets}x${e.repMin}-${e.repMax} RIR${e.rir}${e.targetKg ? ' @' + e.targetKg : ''}`).join(' ; '))
    }
  }
}
show('MARATHON', P_MARATHON, [1, 4, 8, 12, 14, 16])
show('FORCE EPAULE', P_FORCE_EPAULE, [1, 8])
show('MIXTE', P_MIXTE, [3])
show('DEBUTANT', P_DEBUTANT, [1])
