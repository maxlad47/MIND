import { generateProgram } from '../src/engine/program'
import { BASE_Q } from '../src/engine/fixtures'
import { describeBlock } from '../src/engine/running'
import { fmtPace } from '../src/engine/utils'
const q = { ...BASE_Q, programType: 'course' as const, runSessions: 4, maxMinutes: 75 as const, availableDays: [0, 1, 3, 4, 5, 6],
  run: { distance: '10k' as const, raceDate: '2026-03-15', objective: 'chrono' as const, targetSeconds: 50 * 60, level: 'intermediaire' as const, weeklyKm: 25, longestKm: 12, recents: [{ distance: '10k' as const, seconds: 52 * 60, date: '' }] } }
const p = generateProgram(q, { now: '2026-01-05' })
console.log('VMA', p.paces!.vma, '| EF', fmtPace(p.paces!.ef), '| seuil', fmtPace(p.paces!.seuil), '| 10k', fmtPace(p.paces!.dix), '| VMA', fmtPace(p.paces!.vmaPace), '| avert.', p.warnings.map((w) => w.code).join(','))
for (const w of p.weeks) {
  const km = w.sessions.reduce((a, s) => a + (s.run?.totalKm ?? 0), 0)
  console.log(`S${w.n} ${w.phase}${w.light ? '*' : ''} ${km.toFixed(0)}km`)
  for (const s of w.sessions) console.log(`   ${s.title.padEnd(26)} ${String(s.run!.totalKm).padStart(5)}km  ${s.run!.blocks.map(describeBlock).join(' + ')}`)
}
