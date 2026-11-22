import { generateProgram } from '../src/engine/program'
import { P_MARATHON } from '../src/engine/fixtures'
const p = generateProgram(P_MARATHON, { now: '2026-01-05' })
for (const w of p.weeks) {
  const km = w.sessions.reduce((a, s) => a + (s.run?.totalKm ?? 0), 0)
  const l = w.sessions.find((s) => s.kind === 'longue')
  console.log(`S${w.n} ${w.phase}${w.light ? '*' : ''} ${km.toFixed(1)}km long=${l?.run?.totalKm ?? '-'}`)
}
