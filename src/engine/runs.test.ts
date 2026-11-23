// Courses importées : rattachement, tours de travail, allure par km, FC par zones, pré-réponse, règles du bilan.
import { describe, expect, it } from 'vitest'
import { allSessions, findSession, runReviewRules } from './adapt'
import { BASE_Q, P_MARATHON, P_MIXTE } from './fixtures'
import { attachRun, detachRun, enduranceTooIntense, extraIdOf, intervalBlocks, manualRun, matchImportedRun, needsReview, parseDuration, plannedMeasures, preAnswer, resolveMaxHr, sleepScoreFromMinutes, splitsSummary, targetPaceOf, timeInZones, workLaps, zoneOf } from './runs'
import { generateProgram } from './program'
import { newLibreProgram } from './libre'
import type { ImportedRun, Program, Session } from './types'
import { addDays, mondayOf } from './utils'
import { reduceHrSeries } from '../../shared/garmin/analysis.ts'

const START = '2026-01-05' // un lundi
const prog = (): Program => generateProgram({ ...P_MARATHON, startDate: START }, { clientId: 'c1', now: START })
const runsOf = (p: Program) => allSessions(p).filter((s) => s.sport === 'course' && s.kind !== 'renfo')
const run = (o: Partial<ImportedRun> & { startAt: string; km: number }): ImportedRun => ({
  id: 'ir-x', clientId: 'c1', source: 'garmin', externalId: 'garmin:1', seconds: Math.round(o.km * 330), avgPaceSec: 330, activityType: 'route', status: 'a_rattacher', ...o,
})

describe('rattachement automatique', () => {
  const p = prog()
  const first = runsOf(p).find((s) => s.kind === 'ef')!

  it('même jour : rattache à la séance de course prévue', () => {
    const m = matchImportedRun(p, run({ startAt: `${first.date}T08:10:00`, km: first.run!.totalKm }))
    expect(m).toEqual({ sessionId: first.id })
  })

  it('applique : séance faite, mesures, bilan encore à faire', () => {
    const r = run({ startAt: `${first.date}T08:10:00`, km: 8.2, seconds: 2700, avgPaceSec: 329 })
    const res = attachRun(p, r)
    const s = findSession(res.program, first.id)!
    expect(res.outcome).toBe('rattachee')
    expect(s.status).toBe('faite')
    expect(s.runLog).toMatchObject({ km: 8.2, seconds: 2700, source: 'garmin', feeling: 0, importedRunId: 'ir-x' })
    expect(needsReview(s)).toBe(true)
    expect(p.weeks.flatMap((w) => w.sessions).find((x) => x.id === first.id)!.status).toBe('prevue') // l'original n'est pas touché
  })

  it('matin et soir : la plus proche par le créneau, puis par la distance', () => {
    const q = structuredClone(p)
    const a = findSession(q, first.id)!
    const b: Session = { ...structuredClone(a), id: 'pm-run', slot: 'pm', title: 'Footing du soir', run: { ...a.run!, totalKm: 5 } }
    a.slot = 'am'; a.run!.totalKm = 10
    q.weeks.find((w) => w.n === a.weekN)!.sessions.push(b)
    expect(matchImportedRun(q, run({ startAt: `${a.date}T18:30:00`, km: 10 }))!.sessionId).toBe('pm-run') // créneau d'abord, même si la distance colle à l'autre
    expect(matchImportedRun(q, run({ startAt: `${a.date}T07:30:00`, km: 5 }))!.sessionId).toBe(a.id)
    // sans créneau : la distance départage
    a.slot = undefined; b.slot = undefined
    expect(matchImportedRun(q, run({ startAt: `${a.date}T09:00:00`, km: 5.2 }))!.sessionId).toBe('pm-run')
    expect(matchImportedRun(q, run({ startAt: `${a.date}T09:00:00`, km: 9.5 }))!.sessionId).toBe(a.id)
  })

  it('la veille ou le lendemain, distance cohérente (±30 %) : séance déplacée, movedFrom noté', () => {
    const q = structuredClone(p)
    for (const w of q.weeks) w.sessions = w.sessions.filter((x) => x.sport !== 'course' || x.id === first.id) // une seule séance de course autour
    const s = findSession(q, first.id)!
    const km = s.run!.totalKm
    const day = addDays(s.date, -1)
    // pas de séance de course ce jour-là
    expect(allSessions(q).some((x) => x.date === day && x.sport === 'course')).toBe(false)
    const m = matchImportedRun(q, run({ startAt: `${day}T08:00:00`, km: km * 1.2 }))
    expect(m).toEqual({ sessionId: s.id, movedFrom: s.date })
    const res = attachRun(q, run({ startAt: `${day}T08:00:00`, km: km * 1.2 }))
    const moved = findSession(res.program, s.id)!
    expect(res.outcome).toBe('deplacee')
    expect(moved.date).toBe(day)
    expect(moved.movedFrom).toBe(s.date)
    expect(moved.status).toBe('faite')
    // le lendemain aussi
    expect(matchImportedRun(q, run({ startAt: `${addDays(s.date, 1)}T08:00:00`, km: km * 0.8 }))).toEqual({ sessionId: s.id, movedFrom: s.date })
  })

  it('distance incohérente : sortie en plus, rien ne bouge', () => {
    const s = first
    const day = addDays(s.date, -1)
    const r = run({ startAt: `${day}T08:00:00`, km: s.run!.totalKm * 2 })
    expect(matchImportedRun(p, r)).toBeUndefined()
    const res = attachRun(p, r)
    expect(res.outcome).toBe('en_plus')
    const x = findSession(res.program, res.sessionId!)!
    expect(x).toMatchObject({ extra: true, status: 'faite', sport: 'course', date: day, title: 'Sortie en plus', id: extraIdOf('ir-x') })
    expect(x.run!.totalKm).toBeCloseTo(s.run!.totalKm * 2, 0)
    expect(findSession(res.program, s.id)!.status).toBe('prevue')
    expect(findSession(res.program, s.id)!.date).toBe(s.date)
  })

  it('vélo, marche, muscu : ignorés ; un renfo coureur n\'est jamais rattaché', () => {
    for (const t of ['velo', 'marche', 'muscu', 'autre'] as const) {
      const r = run({ startAt: `${first.date}T08:00:00`, km: 8, activityType: t })
      expect(matchImportedRun(p, r)).toBeUndefined()
      expect(attachRun(p, r).outcome).toBe('ignoree')
    }
    const mixte = generateProgram({ ...P_MIXTE, startDate: START, run: { ...P_MIXTE.run, renfo: { perWeek: 2, kit: 'salle' } } }, { clientId: 'c1', now: START })
    const renfo = allSessions(mixte).filter((s) => s.kind === 'renfo')
    for (const s of renfo) {
      const m = matchImportedRun(mixte, run({ startAt: `${s.date}T08:00:00`, km: 6 }))
      expect(m?.sessionId).not.toBe(s.id)
    }
    // une séance de renfo « course » ne reçoit rien non plus
    const fake = structuredClone(first); fake.kind = 'renfo'
    const q = structuredClone(p); const t = findSession(q, first.id)!; t.kind = 'renfo'
    expect(matchImportedRun(q, run({ startAt: `${first.date}T08:00:00`, km: 8 }))?.sessionId).not.toBe(first.id)
    void fake
  })

  it('une séance déjà faite ne reçoit pas une deuxième sortie : la suivante devient une sortie en plus', () => {
    const r1 = attachRun(p, run({ startAt: `${first.date}T08:00:00`, km: first.run!.totalKm }))
    const r2 = attachRun(r1.program, run({ id: 'ir-y', externalId: 'garmin:2', startAt: `${first.date}T19:00:00`, km: 4 }))
    expect(r2.outcome).toBe('en_plus')
  })

  it('déterminisme : rejouer sur un autre appareil donne exactement le même programme', () => {
    const r = run({ startAt: `${first.date}T08:10:00`, km: 8.2 })
    expect(attachRun(p, r)).toEqual(attachRun(structuredClone(p), structuredClone(r)))
    const far = run({ startAt: `${addDays(first.date, -1)}T08:10:00`, km: 30 })
    expect(attachRun(p, far)).toEqual(attachRun(structuredClone(p), structuredClone(far)))
  })

  it('correction : rattacher à une autre séance, puis annuler proprement', () => {
    const r = run({ startAt: `${first.date}T08:10:00`, km: first.run!.totalKm })
    const a = attachRun(p, r)
    const linked: ImportedRun = { ...r, status: 'rattachee', matchedSessionId: a.sessionId }
    const back = detachRun(a.program, linked)
    const s = findSession(back, first.id)!
    expect(s.status).toBe('prevue')
    expect(s.runLog).toBeUndefined()
    // sortie en plus annulée : la séance disparaît
    const far = run({ startAt: `${addDays(first.date, -1)}T08:10:00`, km: 30 })
    const e = attachRun(p, far)
    const gone = detachRun(e.program, { ...far, status: 'rattachee', matchedSessionId: e.sessionId })
    expect(findSession(gone, e.sessionId!)).toBeUndefined()
    // séance déplacée annulée : retrouve sa date
    const near = run({ startAt: `${addDays(first.date, -1)}T08:10:00`, km: first.run!.totalKm })
    const mv = attachRun(p, near)
    const un = detachRun(mv.program, { ...near, status: 'rattachee', matchedSessionId: mv.sessionId, movedFromDate: mv.movedFrom })
    expect(findSession(un, first.id)).toMatchObject({ date: first.date, status: 'prevue' })
  })

  it('course en mode libre : sortie en plus', () => {
    const libre = newLibreProgram({ ...BASE_Q, mode: 'libre', programType: 'muscu', startDate: START }, { clientId: 'c1', now: START })
    const r = run({ startAt: `${addDays(START, 2)}T08:10:00`, km: 7 })
    const res = attachRun(libre, r, { today: addDays(START, 3) })
    expect(res.outcome).toBe('en_plus')
    expect(findSession(res.program, res.sessionId!)).toMatchObject({ extra: true, status: 'faite', date: addDays(START, 2) })
  })

  it('hors programme : ignorée avec une raison', () => {
    const res = attachRun(p, run({ startAt: '2019-01-02T08:00:00', km: 7 }))
    expect(res.outcome).toBe('ignoree')
    expect(res.note).toMatch(/hors/)
  })

  it('forceSessionId : le client est sur cette séance', () => {
    const other = runsOf(p).filter((s) => s.id !== first.id).find((s) => s.kind === 'longue')!
    const res = attachRun(p, run({ startAt: `${first.date}T08:00:00`, km: 8 }), { forceSessionId: other.id })
    expect(findSession(res.program, other.id)!.status).toBe('faite')
    expect(findSession(res.program, first.id)!.status).toBe('prevue')
  })
})

describe('« Fait comme prévu » et saisie rapide', () => {
  const p = prog()
  const s = runsOf(p).find((x) => x.kind === 'ef')!
  it('prend distance et temps du plan', () => {
    const m = plannedMeasures(s)
    expect(m.km).toBe(s.run!.totalKm)
    expect(m.seconds).toBe(s.run!.estMinutes * 60)
  })
  it('saisie rapide : allure calculée', () => {
    const r = manualRun({ clientId: 'c1', externalId: 'manuel:x', startAt: `${s.date}T08:00:00`, km: 10, seconds: 3000 })
    expect(r.avgPaceSec).toBe(300)
    expect(r.source).toBe('manuel')
  })
  it('durées mm:ss, h:mm:ss, minutes seules', () => {
    expect(parseDuration('52:30')).toBe(3150)
    expect(parseDuration('1:05:30')).toBe(3930)
    expect(parseDuration('45')).toBe(2700)
    expect(parseDuration('abc')).toBeUndefined()
    expect(parseDuration('0')).toBeUndefined()
  })
})

// ---------------------------------------------------------------- séance à intervalles 10 × 400 m

const intervalSession = (): Session => ({
  id: 's-int', weekN: 3, date: '2026-01-20', sport: 'course', kind: 'vma', title: '10 × 400 m', status: 'prevue', estMinutes: 55,
  run: { warmup: '', cooldown: '', totalKm: 9, estMinutes: 55, blocks: [{ label: '10 × 400 m', meters: 400, reps: 10, paceSec: 240, recSec: 60 }] },
})
const lap = (meters: number, pace: number) => ({ meters, seconds: Math.round((meters / 1000) * pace), avgPaceSec: pace })
const lapsFor = (workPaces: number[]) => [lap(2000, 360), ...workPaces.flatMap((w) => [lap(400, w), lap(200, 420)]), lap(1500, 370)]

describe('tours de travail', () => {
  const s = intervalSession()
  it('détecte les tours rapides, pas la récup ni l\'échauffement', () => {
    expect(intervalBlocks(s)).toHaveLength(1)
    const wl = workLaps(lapsFor(Array(10).fill(238)), s)
    expect(wl).toHaveLength(10)
    expect(wl.every((w) => !w.slow)).toBe(true)
    expect(wl[0].lap.meters).toBe(400)
  })
  it('marque les tours trop lents (> 5 % de la cible)', () => {
    const wl = workLaps(lapsFor([238, 240, 262, 239, 241, 255, 240, 238, 239, 240]), s)
    expect(wl.filter((w) => w.slow).map((w) => w.index)).toEqual([4, 10].map((_, i) => wl[[2, 5][i]].index))
    expect(wl.filter((w) => w.slow)).toHaveLength(2)
  })
  it('pas d\'intervalles prévus ou pas de tours : rien', () => {
    expect(workLaps(lapsFor([240]), { ...s, run: { ...s.run!, blocks: [{ label: 'EF', meters: 9000, paceSec: 330 }] } })).toEqual([])
    expect(workLaps(undefined, s)).toEqual([])
    expect(workLaps([lap(1000, 300)], s)).toEqual([])
  })
  it('pré-réponse « en partie respectée (2 tours sur 10 trop lents) »', () => {
    const r = run({ startAt: '2026-01-20T18:00:00', km: 9, laps: lapsFor([238, 240, 262, 239, 241, 255, 240, 238, 239, 240]) })
    const pre = preAnswer(r, s)!
    expect(pre.respected).toBe('partiel')
    expect(pre.text).toBe("D'après ta montre : en partie respectée (2 tours sur 10 trop lents)")
    expect(preAnswer(run({ startAt: '2026-01-20T18:00:00', km: 9, laps: lapsFor(Array(10).fill(239)) }), s)!.respected).toBe('oui')
    expect(preAnswer(run({ startAt: '2026-01-20T18:00:00', km: 5, laps: lapsFor([240, 240, 240, 240]) }), s)!.respected).toBe('non')
  })
})

describe('allure par km : phrases de synthèse', () => {
  const sp = (...p: number[]) => p.map((avgPaceSec) => ({ km: 1, seconds: avgPaceSec, avgPaceSec }))
  it('départ trop rapide', () => {
    expect(splitsSummary(sp(305, 305, 305, 335, 340, 340, 345, 340), 330)).toBe('Départ trop rapide : km 1 à 3 en 5:05, cible 5:30')
  })
  it('fin difficile', () => {
    expect(splitsSummary(sp(330, 328, 332, 330, 329, 331, 345, 346, 344), 330)).toBe('Fin difficile : les 3 derniers km 15 s plus lents')
  })
  it('régulier', () => {
    expect(splitsSummary(sp(330, 326, 334, 328, 332, 330), 330)).toBe('Régulier : ±4 s autour de 5:30')
  })
  it('irrégulier, et trop court pour conclure', () => {
    expect(splitsSummary(sp(300, 360, 310, 355, 305, 350), 330)).toMatch(/^Allure irrégulière/)
    expect(splitsSummary(sp(330, 330), 330)).toBeUndefined()
    expect(splitsSummary(undefined)).toBeUndefined()
  })
  it('dernier km partiel ignoré dans la synthèse', () => {
    const s = [...sp(330, 330, 330), { km: 0.2, seconds: 100, avgPaceSec: 500 }]
    expect(splitsSummary(s, 330)).toMatch(/^Régulier/)
  })
  it('pré-réponse sortie longue : départ trop rapide', () => {
    const longue: Session = { ...intervalSession(), kind: 'longue', run: { warmup: '', cooldown: '', totalKm: 8, estMinutes: 45, blocks: [{ label: 'Sortie longue', meters: 8000, paceSec: 330 }] } }
    const r = run({ startAt: '2026-01-20T09:00:00', km: 8, avgPaceSec: 320, splits: sp(300, 300, 305, 330, 335, 340, 340, 345) })
    const pre = preAnswer(r, longue)!
    expect(pre.respected).toBe('partiel')
    expect(pre.text).toContain('départ trop rapide')
  })
})

describe('fréquence cardiaque', () => {
  it('zones en % de la FC max', () => {
    expect([100, 126, 150, 160, 170, 180].map((h) => zoneOf(h, 180))).toEqual([1, 2, 3, 4, 5, 5])
    expect(zoneOf(125, 180)).toBe(1) // 69,4 %
    expect(zoneOf(126, 180)).toBe(2) // 70 %
    expect(zoneOf(144, 180)).toBe(3) // 80 %
    expect(zoneOf(167, 180)).toBe(4) // 92,8 %
    expect(zoneOf(168, 180)).toBe(5) // 93,3 % : au-dessus de 93 %
  })
  it('temps par zone', () => {
    const series = Array.from({ length: 60 }, (_, i) => ({ t: i * 10, hr: i < 30 ? 120 : 150 })) // 5 min Z1, 5 min Z3 (FC max 180)
    const z = timeInZones(series, 180)!
    expect(z.seconds[0]).toBeGreaterThanOrEqual(290)
    expect(z.pct[0]).toBe(50)
    expect(z.pct[2]).toBe(50)
    expect(z.total).toBeCloseTo(600, -1)
    expect(timeInZones([], 180)).toBeUndefined()
    expect(timeInZones(undefined, 180)).toBeUndefined()
  })
  it('réduction de la série : un point toutes les 10 s', () => {
    const raw = Array.from({ length: 3600 }, (_, t) => ({ t, hr: 140 }))
    expect(reduceHrSeries(raw, 10)).toHaveLength(360)
  })
  it('FC max par défaut : profil, sinon la plus haute des 6 derniers mois, sinon 220 − âge (estimation)', () => {
    const today = '2026-11-23'
    const mk = (d: string, max: number): ImportedRun => run({ id: d, startAt: `${d}T08:00:00`, km: 5, maxHr: max })
    expect(resolveMaxHr({ profile: 185, runs: [mk('2026-11-01', 190)], birthDate: '1990-01-01', today })).toMatchObject({ value: 185, estimated: false, source: 'profil' })
    expect(resolveMaxHr({ runs: [mk('2026-11-01', 183), mk('2026-09-01', 191), mk('2025-01-01', 199)], birthDate: '1990-01-01', today })).toMatchObject({ value: 191, estimated: false, source: 'activites' })
    expect(resolveMaxHr({ runs: [mk('2025-01-01', 199)], birthDate: '1990-01-01', today })).toMatchObject({ value: 220 - 36, estimated: true, source: 'age' })
    expect(resolveMaxHr({ runs: [{ ...mk('2026-11-01', 200), status: 'ignoree' }], birthDate: '1990-01-01', today }).source).toBe('age')
    expect(resolveMaxHr({ runs: [], today }).estimated).toBe(true)
    // la série seule compte aussi
    expect(resolveMaxHr({ runs: [run({ startAt: '2026-11-10T08:00:00', km: 5, hrSeries: [{ t: 0, hr: 120 }, { t: 10, hr: 188 }] })], today }).value).toBe(188)
  })
  it('alerte « endurance trop intense » : EF ou récup avec plus de 20 % au-dessus de Z2', () => {
    const ef: Session = { ...intervalSession(), kind: 'ef', run: { warmup: '', cooldown: '', totalKm: 8, estMinutes: 45, blocks: [{ label: 'EF', meters: 8000, paceSec: 340 }] } }
    // FC max 180 : 66 % en Z2 (130), 34 % en Z4 (160)
    const series = Array.from({ length: 100 }, (_, i) => ({ t: i * 10, hr: i < 66 ? 130 : 160 }))
    const r = run({ startAt: '2026-01-20T09:00:00', km: 8, hrSeries: series })
    expect(enduranceTooIntense(r, ef, 180)).toEqual({ pct: 34 })
    expect(preAnswer(r, ef, 180)!.text).toContain('endurance trop intense : 34 % du temps au-dessus de Z2')
    // sortie longue ou fractionné : pas concerné
    expect(enduranceTooIntense(r, { ...ef, kind: 'longue' }, 180)).toBeUndefined()
    // 15 % seulement : pas d'alerte
    const calm = Array.from({ length: 100 }, (_, i) => ({ t: i * 10, hr: i < 85 ? 130 : 160 }))
    expect(enduranceTooIntense(run({ startAt: '2026-01-20T09:00:00', km: 8, hrSeries: calm }), ef, 180)).toBeUndefined()
    // récup aussi, et sans FC : rien
    expect(enduranceTooIntense(r, { ...ef, kind: 'recup' }, 180)).toBeDefined()
    expect(enduranceTooIntense(run({ startAt: '2026-01-20T09:00:00', km: 8 }), ef, 180)).toBeUndefined()
  })
  it('allure cible : le bloc qui pèse le plus', () => {
    expect(targetPaceOf(intervalSession())).toBe(240)
    expect(targetPaceOf({ ...intervalSession(), run: undefined })).toBeUndefined()
  })
})

describe('pré-réponse sans données détaillées', () => {
  it('distance seule : respectée / en partie / pas respectée', () => {
    const ef: Session = { ...intervalSession(), kind: 'ef', run: { warmup: '', cooldown: '', totalKm: 10, estMinutes: 55, blocks: [{ label: 'EF', meters: 10000, paceSec: 330 }] } }
    expect(preAnswer(run({ startAt: '2026-01-20T09:00:00', km: 10, avgPaceSec: 330 }), ef)!.respected).toBe('oui')
    expect(preAnswer(run({ startAt: '2026-01-20T09:00:00', km: 7.5, avgPaceSec: 330 }), ef)!.respected).toBe('partiel')
    expect(preAnswer(run({ startAt: '2026-01-20T09:00:00', km: 4, avgPaceSec: 330 }), ef)!.respected).toBe('non')
    expect(preAnswer(run({ startAt: '2026-01-20T09:00:00', km: 10, avgPaceSec: 380 }), ef)!.respected).toBe('partiel')
  })
})

describe('sommeil → check-in', () => {
  it('nuit Garmin → note de 1 à 5', () => {
    expect([4 * 60, 5.5 * 60, 6.5 * 60, 7.5 * 60, 8.5 * 60].map(sleepScoreFromMinutes)).toEqual([1, 2, 3, 4, 5])
  })
})

// ---------------------------------------------------------------- les quatre règles d'adaptation

describe('règles du bilan (toujours proposées)', () => {
  const TODAY = '2026-02-20'
  /** Programme dont certaines séances (par type) reçoivent un bilan à une date donnée. */
  const withReviews = (specs: { kind: string; daysAgo: number; rpe?: number; reasons?: string[]; respected?: 'oui' | 'partiel' | 'non' }[]): Program => {
    const p = generateProgram({ ...P_MARATHON, startDate: START }, { clientId: 'c1', now: START })
    const pool = allSessions(p).filter((s) => s.sport === 'course' && s.run && s.run.blocks.length)
    const used = new Set<string>()
    for (const sp of specs) {
      const s = pool.find((x) => !used.has(x.id) && (sp.kind === 'quality' ? ['vma', 'seuil', 'specifique', 'fartlek', 'cotes'].includes(x.kind) : x.kind === sp.kind))!
      used.add(s.id)
      s.date = addDays(TODAY, -sp.daysAgo)
      s.status = 'faite'
      s.runLog = { km: 8, seconds: 2700, feeling: sp.rpe ?? 5, comment: '', source: 'garmin', at: s.date, importedRunId: 'x' + s.id, respected: sp.respected ?? 'oui', reasons: (sp.reasons ?? []) as never, rpe: sp.rpe }
    }
    return p
  }

  it('« trop difficile » ou RPE ≥ 9 sur la qualité, deux fois en 14 jours : allures à la baisse proposées', () => {
    const r = runReviewRules(withReviews([{ kind: 'quality', daysAgo: 12, rpe: 9 }, { kind: 'quality', daysAgo: 3, reasons: ['difficile'], respected: 'partiel', rpe: 8 }]), TODAY)
    expect(r.slower).toBeDefined()
    expect(r.slower!.vma).toBeLessThan(P_MARATHON.run.vma ?? 99)
    expect(r.slower!.text).toMatch(/VMA/)
  })
  it('une seule fois, ou hors fenêtre de 14 jours : rien', () => {
    expect(runReviewRules(withReviews([{ kind: 'quality', daysAgo: 3, rpe: 9 }]), TODAY).slower).toBeUndefined()
    expect(runReviewRules(withReviews([{ kind: 'quality', daysAgo: 20, rpe: 9 }, { kind: 'quality', daysAgo: 3, rpe: 9 }]), TODAY).slower).toBeUndefined()
    expect(runReviewRules(withReviews([{ kind: 'ef', daysAgo: 12, rpe: 9 }, { kind: 'ef', daysAgo: 3, rpe: 9 }]), TODAY).slower).toBeUndefined() // pas une séance de qualité
  })
  it('« pas envie » trois fois en 21 jours : alerte coach « motivation en baisse »', () => {
    const three = withReviews([{ kind: 'ef', daysAgo: 18, reasons: ['motivation'], respected: 'non' }, { kind: 'ef', daysAgo: 10, reasons: ['motivation'], respected: 'partiel' }, { kind: 'longue', daysAgo: 2, reasons: ['motivation'], respected: 'non' }])
    expect(runReviewRules(three, TODAY).coachAlerts[0].text).toMatch(/Motivation en baisse/)
    const two = withReviews([{ kind: 'ef', daysAgo: 10, reasons: ['motivation'], respected: 'partiel' }, { kind: 'longue', daysAgo: 2, reasons: ['motivation'], respected: 'non' }])
    expect(runReviewRules(two, TODAY).coachAlerts).toEqual([])
    const old = withReviews([{ kind: 'ef', daysAgo: 30, reasons: ['motivation'], respected: 'non' }, { kind: 'ef', daysAgo: 10, reasons: ['motivation'] , respected: 'non' }, { kind: 'longue', daysAgo: 2, reasons: ['motivation'], respected: 'non' }])
    expect(runReviewRules(old, TODAY).coachAlerts).toEqual([])
  })
  it('RPE ≤ 3 sur une longue ou la qualité, deux fois de suite, respectée : hausse prudente proposée', () => {
    const p = withReviews([{ kind: 'longue', daysAgo: 9, rpe: 3 }, { kind: 'quality', daysAgo: 2, rpe: 2 }])
    const r = runReviewRules(p, TODAY)
    expect(r.faster).toBeDefined()
    expect(r.faster!.vma).toBeGreaterThan(p.paces!.vma)
    expect(r.faster!.vma).toBeLessThanOrEqual(p.paces!.vma * 1.03)
  })
  it('hausse : pas si une des deux n\'est pas respectée, ni si pas de suite', () => {
    expect(runReviewRules(withReviews([{ kind: 'longue', daysAgo: 9, rpe: 3 }, { kind: 'quality', daysAgo: 2, rpe: 2, respected: 'partiel' }]), TODAY).faster).toBeUndefined()
    expect(runReviewRules(withReviews([{ kind: 'longue', daysAgo: 9, rpe: 3 }, { kind: 'quality', daysAgo: 2, rpe: 6 }]), TODAY).faster).toBeUndefined()
    expect(runReviewRules(withReviews([{ kind: 'quality', daysAgo: 2, rpe: 2 }]), TODAY).faster).toBeUndefined()
  })
  it('course en mode libre (sans allures) : aucune règle d\'allure, seulement les alertes coach', () => {
    const libre = newLibreProgram({ ...BASE_Q, mode: 'libre', programType: 'muscu', startDate: START }, { clientId: 'c1', now: START })
    const w = libre.weeks[0]
    const reviewed = [10, 5, 2].map((n, i): Session => ({
      id: `sx-${i}`, weekN: w.n, date: addDays(TODAY, -n), sport: 'course', kind: 'ef', title: 'Sortie en plus', status: 'faite', estMinutes: 40, extra: true,
      run: { warmup: '', blocks: [], cooldown: '', totalKm: 8, estMinutes: 40 },
      runLog: { km: 8, seconds: 2700, feeling: 9, comment: '', source: 'garmin', at: '', importedRunId: 'x', respected: 'non', reasons: ['motivation', 'difficile'], rpe: 9 },
    }))
    libre.weeks = [{ ...w, sessions: reviewed }]
    const r = runReviewRules(libre, TODAY)
    expect(r.slower).toBeUndefined()
    expect(r.faster).toBeUndefined()
    expect(r.coachAlerts).toHaveLength(1)
  })
  it('sorties libres d\'un programme MIND : exclues des règles d\'allure', () => {
    const p = withReviews([{ kind: 'quality', daysAgo: 12, rpe: 9 }, { kind: 'quality', daysAgo: 3, rpe: 9 }])
    allSessions(p).filter((s) => s.runLog?.rpe === 9).forEach((s) => { s.extra = true })
    expect(runReviewRules(p, TODAY).slower).toBeUndefined()
  })
})

void mondayOf
