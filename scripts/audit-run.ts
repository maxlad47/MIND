import { generateProgram } from '../src/engine/program'
import { BASE_Q } from '../src/engine/fixtures'
import { isQuality } from '../src/engine/running'
import { runClass } from '../src/engine/combine'
import { addDays, weekday } from '../src/engine/utils'
import type { Questionnaire } from '../src/engine/types'

const issues = new Map<string, { n: number; example: string }>()
const flag = (k: string, ex: string) => { const c = issues.get(k) ?? { n: 0, example: ex }; c.n++; issues.set(k, c) }
let total = 0
for (const distance of ['10k', 'semi', 'marathon'] as const)
for (const level of ['debutant', 'intermediaire', 'avance'] as const)
for (const weeks of [6, 12, 16, 26])
for (const runs of [2, 3, 4, 6])
for (const maxMinutes of [45, 90] as const)
for (const withVma of [true, false])
for (const mode of ['course', 'mixte'] as const) {
  const raceD = addDays('2026-01-05', weeks * 7 - 1)
  const q: Questionnaire = { ...BASE_Q, programType: mode, runSessions: runs, muscuSessions: 3, maxMinutes, priority: 'equilibre',
    availableDays: runs + (mode === 'mixte' ? 3 : 0) > 5 ? [0, 1, 2, 3, 4, 5, 6] : [0, 2, 3, 5, 6], 
    run: { distance, raceDate: raceD, objective: 'finir', level, weeklyKm: level === 'debutant' ? 12 : level === 'intermediaire' ? 30 : 50, longestKm: level === 'debutant' ? 6 : level === 'intermediaire' ? 14 : 22, ...(withVma ? { vma: level === 'debutant' ? 12 : level === 'intermediaire' ? 14.5 : 17 } : {}) } }
  const p = generateProgram(q, { now: '2026-01-05' })
  total++
  const tag = `${distance}/${level}/${weeks}sem/${runs}x/${maxMinutes}min/${mode}/${withVma ? 'vma' : 'sans'}`
  p.weeks.forEach((w, wi) => {
    const rs = w.sessions.filter((s) => s.sport === 'course')
    const last = wi === p.weeks.length - 1
    if (!last && wi > 0 && rs.length !== runs) flag('nombre de sorties ≠ demandé', `${tag} S${w.n}: ${rs.length}`)
    for (const s of rs) {
      const km = s.run!.totalKm
      if (s.kind !== 'course' && km < 2.5) flag('sortie < 2,5 km', `${tag} S${w.n} ${s.title} ${km}km`)
      if (s.kind !== 'course' && s.kind !== 'longue' && s.estMinutes > maxMinutes) flag('sortie > durée max', `${tag} S${w.n} ${s.title} ${s.estMinutes}min`)
      if (s.date < p.startDate) flag('séance avant la date de début', `${tag} ${s.date}`)
      if (p.raceDate && s.date > p.raceDate) flag('séance après la course', `${tag} ${s.date}`)
      if (s.kind === 'longue' && s.estMinutes > 185) flag('sortie longue > 3 h', `${tag} S${w.n} ${s.estMinutes}min`)
      if (isQuality(s.kind) && s.kind !== 'test' && s.run!.blocks.length === 0) flag('séance de qualité sans corps', tag)
    }
    const L = rs.find((s) => s.kind === 'longue')
    if (L && w.phase !== 'Affûtage' && rs.some((s) => s.kind !== 'longue' && s.run!.totalKm > L.run!.totalKm + 0.5)) flag('une sortie plus longue que la sortie longue', `${tag} S${w.n} ${rs.map((s) => s.title + ' ' + s.run!.totalKm).join(' | ')}`)
    const q2 = rs.filter((s) => runClass(s) === 'quality').map((s) => weekday(s.date)).sort()
    for (let i = 1; i < q2.length; i++) if (q2[i] - q2[i - 1] === 1) flag('2 séances de qualité consécutives', `${tag} S${w.n}`)
  })
  const race = p.weeks.at(-1)!.sessions.find((s) => s.kind === 'course')
  if (!race) flag('pas de jour de course', tag)
  if (race && race.date !== p.raceDate) flag('jour de course mal placé', tag)
  if (p.warnings.some((x) => x.code === 'conflit_placement')) flag('conflit de placement non résolu', tag + ' ' + p.warnings.find((x) => x.code === 'conflit_placement')!.message)
  // volumes
  const km = p.weeks.map((w) => w.sessions.filter((s) => s.kind !== 'course').reduce((a, s) => a + (s.run?.totalKm ?? 0), 0))
  let lastLoaded = 0
  p.weeks.forEach((w, i) => {
    if (w.phase === 'Affûtage' || w.light) return
    if (lastLoaded && km[i] > lastLoaded * 1.12 + 3) flag('hausse de volume > ~10 %', `${tag} S${w.n}: ${lastLoaded.toFixed(1)} → ${km[i].toFixed(1)}`)
    lastLoaded = km[i]
  })
}
console.log('programmes de course générés :', total)
for (const [k, v] of [...issues.entries()].sort((a, b) => b[1].n - a[1].n)) console.log(`\n${v.n}× ${k}\n   ex: ${v.example.slice(0, 260)}`)
