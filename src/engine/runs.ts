// Courses importées (montre Garmin, fichier .fit, saisie rapide) : rattachement à la séance prévue, lecture de l'allure par km,
// fréquence cardiaque par zones, pré-réponse du bilan. TypeScript pur, sans interface.

import { allSessions, findSession } from './adapt'
import { withExtraSession } from './libre'
import { isQuality } from './running'
import type { HealthDay, HrPoint, ImportedLap, ImportedRun, ImportedSplit, Program, RunBlock, RunReason, RunRespect, Session } from './types'
import { addDays, ageFrom, diffDays, fmtPace, mondayOf } from './utils'
import { isRunType } from '../../shared/garmin/types.ts'
import { runIdOf } from '../../shared/garmin/analysis.ts'

export { isRunType, runIdOf }

// ------------------------------------------------------------------ bilan : réponses

export const RUN_REASONS: { id: RunReason; label: string }[] = [
  { id: 'difficile', label: 'Trop difficile' },
  { id: 'fatigue', label: 'Fatigue / mauvais sommeil' },
  { id: 'douleur', label: 'Douleur ou gêne' },
  { id: 'temps', label: 'Manque de temps' },
  { id: 'motivation', label: 'Pas envie / motivation' },
  { id: 'malade', label: 'Malade' },
  { id: 'meteo', label: 'Météo / terrain' },
  { id: 'montre', label: 'Montre ou GPS en défaut' },
  { id: 'autre', label: 'Autre' },
]
export const RESPECT_LABEL: Record<RunRespect, string> = { oui: 'Oui', partiel: 'En partie', non: 'Non' }
export const reasonLabel = (r: RunReason): string => RUN_REASONS.find((x) => x.id === r)?.label ?? r

/** Repères de l'échelle d'effort perçu. */
export const RPE_ANCHORS: Record<number, string> = { 1: 'très facile', 3: 'facile', 5: 'moyen', 7: 'difficile', 9: 'très difficile', 10: 'maximal' }

// ------------------------------------------------------------------ séance de course

/** Séance de course à rattacher : jamais le renfo coureur (muscu), jamais une séance sautée. */
const isRunSession = (s: Session): boolean => s.sport === 'course' && s.kind !== 'renfo'
const isOpen = (s: Session): boolean => isRunSession(s) && s.status === 'prevue' && !s.runLog

/** Distance prévue (km). Une sortie libre n'en a pas : 0. */
export const plannedKm = (s: Session): number => s.run?.totalKm ?? 0

/** Allure cible principale (s/km) : le bloc qui pèse le plus dans la séance. */
export function targetPaceOf(s: Session): number | undefined {
  const blocks = (s.run?.blocks ?? []).filter((b) => b.paceSec)
  if (!blocks.length) return undefined
  const weight = (b: RunBlock) => (b.meters ?? (b.seconds && b.paceSec ? (b.seconds / b.paceSec) * 1000 : 0)) * (b.reps ?? 1)
  return [...blocks].sort((a, b) => weight(b) - weight(a))[0].paceSec
}

const halfDay = (startAt: string): 'am' | 'pm' => (Number(startAt.slice(11, 13)) < 13 ? 'am' : 'pm')

export interface Match { sessionId: string; /** Date d'origine si la séance a été déplacée (veille ou lendemain). */ movedFrom?: string }

/**
 * Séance à rattacher à une activité, ou `undefined` (→ sortie en plus).
 * 1. séance course du même jour, prévue, sans sortie : s'il y en a deux, la plus proche par le créneau puis par la distance ;
 * 2. sinon séance course prévue la veille ou le lendemain, si la distance est cohérente (±30 %) ;
 * 3. sinon rien. Le vélo, la marche, la muscu : jamais rattachés.
 */
export function matchImportedRun(program: Program, run: Pick<ImportedRun, 'startAt' | 'km' | 'activityType'>): Match | undefined {
  if (!isRunType(run.activityType)) return undefined
  const date = run.startAt.slice(0, 10)
  const all = allSessions(program).filter(isOpen)
  const slot = halfDay(run.startAt)
  const rank = (s: Session) => (s.slot === slot ? 0 : s.slot ? 2 : 1)
  const same = all.filter((s) => s.date === date)
    .sort((a, b) => rank(a) - rank(b) || Math.abs(plannedKm(a) - run.km) - Math.abs(plannedKm(b) - run.km) || a.id.localeCompare(b.id))
  if (same.length) return { sessionId: same[0].id }
  const near = all.filter((s) => !s.extra && Math.abs(diffDays(s.date, date)) === 1 && plannedKm(s) > 0 && Math.abs(run.km - plannedKm(s)) <= plannedKm(s) * 0.3)
    .sort((a, b) => Math.abs(plannedKm(a) - run.km) - Math.abs(plannedKm(b) - run.km) || a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  return near.length ? { sessionId: near[0].id, movedFrom: near[0].date } : undefined
}

/** Déplace une séance à une autre date (même semaine ou non), comme `moveSession`. */
export function relocateSession(p: Program, s: Session, newDate: string): void {
  s.movedFrom = s.movedFrom ?? s.date
  s.date = newDate
  s.slot = undefined
  const wk = p.weeks.find((w) => w.startDate === mondayOf(newDate))
  if (wk && wk.n !== s.weekN) {
    const from = p.weeks.find((w) => w.n === s.weekN)
    if (from) from.sessions = from.sessions.filter((x) => x.id !== s.id)
    s.weekN = wk.n
    wk.sessions.push(s)
  }
}

export type AttachOutcome = 'rattachee' | 'deplacee' | 'en_plus' | 'ignoree'
export interface AttachResult { program: Program; outcome: AttachOutcome; sessionId?: string; movedFrom?: string; note?: string }

/** Identifiant de la séance « en plus » créée pour une activité : le même sur tous les appareils. */
export const extraIdOf = (runId: string): string => `sx-${runId}`

/** Remplit la séance avec l'activité : sortie faite, mesures, bilan encore vide. Déterministe (aucune heure courante). */
function fill(s: Session, run: ImportedRun): void {
  s.runLog = { km: run.km, seconds: run.seconds, feeling: 0, comment: '', source: run.source, at: run.startAt, importedRunId: run.id }
  s.status = 'faite'
  s.doneAt = run.startAt
  s.feeling = undefined
}

/**
 * Rattache une activité au programme. `forceSessionId` : le client est sur cette séance (« Fait comme prévu », saisie rapide, .fit).
 * Fonction pure et déterministe : deux appareils qui la rejouent obtiennent le même programme.
 */
export function attachRun(program: Program, run: ImportedRun, opts: { forceSessionId?: string; asExtra?: boolean; today?: string; history?: Session[] } = {}): AttachResult {
  if (!isRunType(run.activityType)) return { program, outcome: 'ignoree', note: 'Ce n\'est pas une course à pied.' }
  const p = structuredClone(program)
  const date = run.startAt.slice(0, 10)
  const forced = opts.forceSessionId ? findSession(p, opts.forceSessionId) : undefined
  const m: Match | undefined = opts.asExtra ? undefined : forced && isRunSession(forced) ? { sessionId: forced.id } : matchImportedRun(p, run)
  if (m) {
    const s = findSession(p, m.sessionId)!
    if (m.movedFrom) relocateSession(p, s, date)
    fill(s, run)
    return { program: p, outcome: m.movedFrom ? 'deplacee' : 'rattachee', sessionId: s.id, movedFrom: m.movedFrom }
  }
  const res = withExtraSession(p, opts.today ?? date, 'course', opts.history, { date, id: extraIdOf(run.id) })
  if (!res.sessionId) return { program, outcome: 'ignoree', note: 'Cette sortie est hors de ton programme.' }
  const out = res.program
  const s = findSession(out, res.sessionId)!
  s.title = 'Sortie en plus'
  s.run = { warmup: '', blocks: [], cooldown: '', totalKm: Math.round(run.km * 10) / 10, estMinutes: Math.round(run.seconds / 60) }
  s.estMinutes = s.run.estMinutes
  fill(s, run)
  return { program: out, outcome: 'en_plus', sessionId: s.id }
}

/** Défait un rattachement (correction « Ce n'est pas cette séance ») : la séance redevient prévue, la sortie en plus disparaît. */
export function detachRun(program: Program, run: ImportedRun): Program {
  const p = structuredClone(program)
  const s = run.matchedSessionId ? findSession(p, run.matchedSessionId) : undefined
  if (!s) return p
  if (s.id === extraIdOf(run.id)) {
    const w = p.weeks.find((x) => x.n === s.weekN)
    if (w) w.sessions = w.sessions.filter((x) => x.id !== s.id)
    return p
  }
  s.runLog = undefined
  s.status = 'prevue'
  s.doneAt = undefined
  s.feeling = undefined
  if (run.movedFromDate && s.date !== run.movedFromDate) {
    relocateSession(p, s, run.movedFromDate)
    s.movedFrom = undefined
  }
  return p
}

/** Les activités d'un client qui attendent un rattachement, de la plus ancienne à la plus récente. */
export const pendingRuns = (runs: ImportedRun[], clientId: string): ImportedRun[] =>
  runs.filter((r) => r.clientId === clientId && r.status === 'a_rattacher').sort((a, b) => a.startAt.localeCompare(b.startAt) || a.id.localeCompare(b.id))

// ------------------------------------------------------------------ « Fait comme prévu » et saisie rapide

/** Mesures de la séance prévue : distance du plan, durée estimée. */
export function plannedMeasures(s: Session): { km: number; seconds: number } {
  const km = plannedKm(s)
  return { km, seconds: Math.round((s.run?.estMinutes ?? s.estMinutes) * 60) }
}

/** Activité « saisie à la main » : distance + temps (l'allure est calculée). */
export function manualRun(o: { clientId: string; externalId: string; startAt: string; km: number; seconds: number }): ImportedRun {
  return {
    id: runIdOf(o.externalId), clientId: o.clientId, source: 'manuel', externalId: o.externalId, startAt: o.startAt,
    km: Math.round(o.km * 100) / 100, seconds: Math.round(o.seconds), avgPaceSec: Math.round(o.seconds / Math.max(o.km, 0.01)), activityType: 'route', status: 'a_rattacher',
  }
}

/** Parse « 52:30 », « 1:05:30 » ou « 52 » (minutes). */
export function parseDuration(str: string): number | undefined {
  const parts = str.trim().replace(',', '.').split(':').map(Number)
  if (!parts.length || parts.some((n) => !Number.isFinite(n) || n < 0) || parts.length > 3) return undefined
  const s = parts.length === 1 ? parts[0] * 60 : parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0] * 3600 + parts[1] * 60 + parts[2]
  return s > 0 ? Math.round(s) : undefined
}

// ------------------------------------------------------------------ tours de travail

export interface WorkLap { index: number; lap: ImportedLap; targetPaceSec: number; slow: boolean }

/** Séance à intervalles : un bloc répété (ex. 10 × 400 m). */
export const intervalBlocks = (s: Session): RunBlock[] => (s.run?.blocks ?? []).filter((b) => (b.reps ?? 1) > 1 && b.paceSec)

/** Tours de travail : plus rapides que la récupération, face à l'allure cible. `slow` = plus de 5 % plus lent que la cible. */
export function workLaps(laps: ImportedLap[] | undefined, s: Session): WorkLap[] {
  const blocks = intervalBlocks(s)
  if (!laps || laps.length < 3 || !blocks.length) return []
  const target = Math.min(...blocks.map((b) => b.paceSec!))
  const slowest = Math.max(...laps.map((l) => l.avgPaceSec)), fastest = Math.min(...laps.map((l) => l.avgPaceSec))
  const threshold = Math.min(target * 1.15, (slowest + fastest) / 2) // en dessous = effort, au-dessus = récupération / échauffement
  return laps.map((lap, index) => ({ lap, index, targetPaceSec: target, slow: lap.avgPaceSec > target * 1.05 }))
    .filter((w) => w.lap.avgPaceSec <= threshold)
}

// ------------------------------------------------------------------ allure par km

const fullKm = (splits: ImportedSplit[]) => splits.filter((s) => s.km >= 0.95)
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

/** Une phrase de synthèse de l'allure par km. */
export function splitsSummary(splits: ImportedSplit[] | undefined, targetPaceSec?: number): string | undefined {
  const full = fullKm(splits ?? [])
  if (full.length < 3) return undefined
  const paces = full.map((s) => s.avgPaceSec)
  const k = Math.min(3, Math.floor(paces.length / 2))
  const head = avg(paces.slice(0, k)), rest = avg(paces.slice(k))
  const tailK = Math.min(3, Math.floor(paces.length / 3)) || 1
  const tail = avg(paces.slice(-tailK)), before = avg(paces.slice(0, -tailK))
  const fastStart = targetPaceSec ? head <= targetPaceSec * 0.95 && head < rest : head <= rest * 0.96
  if (fastStart) return `Départ trop rapide : km 1 à ${k} en ${fmtPace(head)}${targetPaceSec ? `, cible ${fmtPace(targetPaceSec)}` : ''}`
  if (tail - before >= 10) return `Fin difficile : les ${tailK} derniers km ${Math.round(tail - before)} s plus lents`
  const mean = avg(paces)
  const dev = Math.max(...paces.map((p) => Math.abs(p - mean)))
  if (dev <= 8) return `Régulier : ±${Math.round(dev)} s autour de ${fmtPace(mean)}`
  return `Allure irrégulière : de ${fmtPace(Math.min(...paces))} à ${fmtPace(Math.max(...paces))}`
}

// ------------------------------------------------------------------ fréquence cardiaque

/** Zones en % de la FC max : Z1 < 70, Z2 70–80, Z3 80–87, Z4 87–93, Z5 > 93. */
export const ZONE_UPPER = [70, 80, 87, 93] as const
export const ZONE_LABELS = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']

export function zoneOf(hr: number, maxHr: number): 1 | 2 | 3 | 4 | 5 {
  const pct = (hr / maxHr) * 100
  return pct < 70 ? 1 : pct < 80 ? 2 : pct < 87 ? 3 : pct <= 93 ? 4 : 5
}
/** Bornes en bpm de chaque zone (pour les bandes de fond du graphique). */
export const zoneBands = (maxHr: number): { zone: number; from: number; to: number }[] =>
  [0, ...ZONE_UPPER, 100 + 7].map((lo, i, a) => ({ zone: i + 1, from: Math.round((lo / 100) * maxHr), to: Math.round(((a[i + 1] ?? 107) / 100) * maxHr) })).slice(0, 5)

export interface ZoneTime { seconds: number[]; pct: number[]; total: number }
/** Temps passé dans chaque zone : chaque point compte jusqu'au suivant (10 s par défaut, 30 s au plus). */
export function timeInZones(series: HrPoint[] | undefined, maxHr: number): ZoneTime | undefined {
  if (!series || series.length < 2 || !maxHr) return undefined
  const seconds = [0, 0, 0, 0, 0]
  series.forEach((p, i) => {
    const dt = i < series.length - 1 ? Math.min(30, series[i + 1].t - p.t) : series.length > 1 ? Math.min(30, p.t - series[i - 1].t) : 10
    seconds[zoneOf(p.hr, maxHr) - 1] += Math.max(0, dt)
  })
  const total = seconds.reduce((a, b) => a + b, 0)
  return total ? { seconds, pct: seconds.map((s) => Math.round((s / total) * 100)), total } : undefined
}

export interface MaxHr { value: number; estimated: boolean; source: 'profil' | 'activites' | 'age' | 'defaut' }
/** FC max : celle du profil ; sinon la plus haute vue sur 6 mois ; sinon 220 − âge (« estimation »). */
export function resolveMaxHr(o: { profile?: number; runs: ImportedRun[]; birthDate?: string; today: string }): MaxHr {
  if (o.profile) return { value: o.profile, estimated: false, source: 'profil' }
  const since = addDays(o.today, -182)
  const seen = o.runs.filter((r) => r.status !== 'ignoree' && r.startAt.slice(0, 10) >= since)
    .map((r) => Math.max(r.maxHr ?? 0, ...(r.hrSeries ?? []).map((p) => p.hr))).filter((x) => x > 0)
  if (seen.length) return { value: Math.max(...seen), estimated: false, source: 'activites' }
  if (o.birthDate) return { value: 220 - ageFrom(o.birthDate, o.today), estimated: true, source: 'age' }
  return { value: 190, estimated: true, source: 'defaut' }
}

/** EF ou récupération : plus de 20 % du temps en Z3 ou au-dessus. */
export function enduranceTooIntense(run: ImportedRun, s: Session, maxHr: number): { pct: number } | undefined {
  if (s.kind !== 'ef' && s.kind !== 'recup') return undefined
  const z = timeInZones(run.hrSeries, maxHr)
  if (!z) return undefined
  const above = 100 - z.pct[0] - z.pct[1]
  return above > 20 ? { pct: above } : undefined
}

// ------------------------------------------------------------------ pré-réponse du bilan

export interface PreAnswer { respected: RunRespect; text: string }

/** Ce que MIND déduit de la montre, en suggestion : le client garde toujours le dernier mot. */
export function preAnswer(run: ImportedRun, s: Session, maxHr?: number): PreAnswer | undefined {
  const plan = plannedKm(s)
  const target = targetPaceOf(s)
  const wl = workLaps(run.laps, s)
  const planned = intervalBlocks(s).reduce((a, b) => a + (b.reps ?? 1), 0)
  if (wl.length && planned) {
    const slow = wl.filter((w) => w.slow).length
    const missing = Math.max(0, planned - wl.length)
    if (wl.length < planned * 0.7) return { respected: 'non', text: `D'après ta montre : pas respectée (${wl.length} tours de travail sur ${planned})` }
    if (slow || missing) {
      const bits = [slow ? `${slow} tour${slow > 1 ? 's' : ''} sur ${wl.length} trop lent${slow > 1 ? 's' : ''}` : '', missing ? `${missing} tour${missing > 1 ? 's' : ''} en moins` : ''].filter(Boolean)
      return { respected: 'partiel', text: `D'après ta montre : en partie respectée (${bits.join(', ')})` }
    }
    return { respected: 'oui', text: 'D\'après ta montre : respectée (tous les tours dans l\'allure)' }
  }
  const intense = maxHr ? enduranceTooIntense(run, s, maxHr) : undefined
  if (plan > 0) {
    const ratio = run.km / plan
    if (ratio < 0.6) return { respected: 'non', text: `D'après ta montre : pas respectée (${run.km.toFixed(1).replace('.', ',')} km sur ${plan.toFixed(1).replace('.', ',')} prévus)` }
    if (ratio < 0.9) return { respected: 'partiel', text: `D'après ta montre : en partie respectée (${run.km.toFixed(1).replace('.', ',')} km sur ${plan.toFixed(1).replace('.', ',')} prévus)` }
  }
  if (intense) return { respected: 'partiel', text: `D'après ta montre : en partie respectée (endurance trop intense : ${intense.pct} % du temps au-dessus de Z2)` }
  if (target && plan > 0 && run.avgPaceSec > target * 1.08) return { respected: 'partiel', text: `D'après ta montre : en partie respectée (allure ${Math.round(run.avgPaceSec - target)} s/km plus lente que prévu)` }
  if (target && s.kind === 'longue') {
    const sum = splitsSummary(run.splits, target)
    if (sum && /^(Départ|Fin)/.test(sum)) return { respected: 'partiel', text: `D'après ta montre : en partie respectée (${sum.charAt(0).toLowerCase()}${sum.slice(1)})` }
  }
  return plan > 0 || target ? { respected: 'oui', text: 'D\'après ta montre : respectée' } : undefined
}

// ------------------------------------------------------------------ santé du jour

/** Nuit Garmin → question « sommeil » du check-in (1 à 5). */
export function sleepScoreFromMinutes(minutes: number): 1 | 2 | 3 | 4 | 5 {
  const h = minutes / 60
  return h < 5 ? 1 : h < 6 ? 2 : h < 7 ? 3 : h < 8 ? 4 : 5
}
export const healthOn = (health: HealthDay[], clientId: string, date: string): HealthDay | undefined => health.find((h) => h.clientId === clientId && h.date === date)
export const fmtSleep = (minutes: number): string => `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`
export const fmtSteps = (n: number): string => n.toLocaleString('fr-FR').replace(/ /g, ' ')

/** Séances de qualité, pour les règles du bilan. */
export const isQualityRun = (s: Session): boolean => s.sport === 'course' && s.kind !== 'course' && isQuality(s.kind)

/** Sorties à compléter : importées, bilan pas encore rempli. */
export const needsReview = (s: Session): boolean => !!s.runLog?.importedRunId && s.runLog.respected === undefined && s.status === 'faite'
