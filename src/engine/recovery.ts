// Récupération : sommeil et pas venus de Garmin (un HealthDay par jour). Calculs purs pour la page « Récupération ».
// Convention Garmin : la nuit porte la date du RÉVEIL (la nuit du lundi au mardi est rangée au mardi).
import type { HealthDay, Session } from './types'
import { addDays, weekday } from './utils'

export type Phases = NonNullable<HealthDay['sleepPhases']>
/** Un jour du calendrier, avec ou sans données (un trou n'est jamais un zéro). */
export interface Day { date: string; steps?: number; sleep?: number; score?: number; phases?: Phases }

/** Tous les jours de `from` à `to` inclus, dans l'ordre. */
export function healthDays(health: HealthDay[], clientId: string, from: string, to: string): Day[] {
  const byDate = new Map(health.filter((h) => h.clientId === clientId).map((h) => [h.date, h]))
  const out: Day[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const h = byDate.get(d)
    out.push({ date: d, steps: h?.steps, sleep: h?.sleepMinutes || undefined, score: h?.sleepScore, phases: h?.sleepPhases })
  }
  return out
}

export const mean = (xs: (number | undefined)[]): number | undefined => {
  const v = xs.filter((x): x is number => typeof x === 'number' && Number.isFinite(x))
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined
}

/** Moyenne glissante sur `n` jours ; rien tant que la fenêtre a moins de 3 valeurs. */
export function rollingAvg(values: (number | undefined)[], n = 7): (number | undefined)[] {
  return values.map((_, i) => {
    const win = values.slice(Math.max(0, i - n + 1), i + 1).filter((x): x is number => x !== undefined)
    return win.length >= 3 ? win.reduce((a, b) => a + b, 0) / win.length : undefined
  })
}

/** Libellé du score de sommeil (barème Garmin). */
export function scoreLabel(score: number): string {
  return score >= 90 ? 'excellent' : score >= 80 ? 'bon' : score >= 60 ? 'moyen' : 'faible'
}

/** Dernière nuit connue (aujourd'hui si la montre l'a déjà envoyée, sinon la plus récente). */
export function lastNight(health: HealthDay[], clientId: string, today: string): HealthDay | undefined {
  return health.filter((h) => h.clientId === clientId && h.date <= today && h.sleepMinutes).sort((a, b) => b.date.localeCompare(a.date))[0]
}

export interface SleepStats {
  nights: number
  avg?: number
  avgScore?: number
  best?: Day
  worst?: Day
  /** Nuits de 7 h ou plus. */
  over7: number
  /** Écart-type de la durée, en minutes : plus il est petit, plus les nuits se ressemblent. */
  spread?: number
  /** Part moyenne de chaque phase, en % du temps passé au lit (somme = 100). */
  phases?: { deep: number; light: number; rem: number; awake: number }
}

export function sleepStats(days: Day[]): SleepStats {
  const n = days.filter((d) => d.sleep)
  const avg = mean(n.map((d) => d.sleep))
  const sorted = [...n].sort((a, b) => a.sleep! - b.sleep!)
  const spread = avg !== undefined && n.length >= 3 ? Math.sqrt(n.reduce((a, d) => a + (d.sleep! - avg) ** 2, 0) / n.length) : undefined
  const withPh = n.filter((d) => d.phases && (d.phases.deepMin ?? 0) + (d.phases.lightMin ?? 0) + (d.phases.remMin ?? 0) > 0)
  let phases: SleepStats['phases']
  if (withPh.length) {
    const sum = { deep: 0, light: 0, rem: 0, awake: 0 }
    for (const d of withPh) { sum.deep += d.phases!.deepMin ?? 0; sum.light += d.phases!.lightMin ?? 0; sum.rem += d.phases!.remMin ?? 0; sum.awake += d.phases!.awakeMin ?? 0 }
    const tot = sum.deep + sum.light + sum.rem + sum.awake
    phases = { deep: (sum.deep / tot) * 100, light: (sum.light / tot) * 100, rem: (sum.rem / tot) * 100, awake: (sum.awake / tot) * 100 }
  }
  return { nights: n.length, avg, avgScore: mean(n.map((d) => d.score)), best: sorted[sorted.length - 1], worst: sorted[0], over7: n.filter((d) => d.sleep! >= 420).length, spread, phases }
}

export interface StepStats {
  /** Jours complets avec des pas (aujourd'hui n'est pas compté : la journée n'est pas finie). */
  days: number
  avg?: number
  best?: Day
  /** Jours où l'objectif est atteint (aujourd'hui compris s'il l'est déjà). */
  goalDays: number
  /** Jours d'affilée avec l'objectif atteint, jusqu'à hier (+ aujourd'hui s'il est déjà atteint). */
  streak: number
}

export function stepStats(days: Day[], today: string, goal?: number): StepStats {
  const full = days.filter((d) => d.date < today && d.steps !== undefined)
  const best = [...full].sort((a, b) => b.steps! - a.steps!)[0]
  const reached = (d?: Day) => !!goal && d?.steps !== undefined && d.steps >= goal
  const goalDays = days.filter((d) => d.date <= today && reached(d)).length
  let streak = 0
  if (goal) {
    const byDate = new Map(days.map((d) => [d.date, d]))
    for (let d = addDays(today, -1); reached(byDate.get(d)); d = addDays(d, -1)) streak++
    if (reached(byDate.get(today))) streak++
  }
  return { days: full.length, avg: mean(full.map((d) => d.steps)), best, goalDays, streak }
}

/** Moyennes par semaine (lundi), pour les longues périodes. */
export function weekly(days: Day[], today: string): { monday: string; sleep?: number; steps?: number }[] {
  const m = new Map<string, Day[]>()
  for (const d of days) {
    const k = addDays(d.date, -weekday(d.date))
    if (!m.has(k)) m.set(k, [])
    m.get(k)!.push(d)
  }
  return [...m.entries()].map(([monday, ds]) => ({ monday, sleep: mean(ds.map((d) => d.sleep)), steps: mean(ds.filter((d) => d.date < today).map((d) => d.steps)) }))
}

/**
 * Semaine type, index 0 = lundi. Le sommeil est rangé au soir où la nuit commence (« la nuit du vendredi » = réveil samedi),
 * les pas au jour même. Moins de 2 valeurs pour un jour : rien.
 */
export function weekdayProfile(days: Day[], today: string): { sleep: (number | undefined)[]; steps: (number | undefined)[] } {
  const sl: number[][] = Array.from({ length: 7 }, () => []), st: number[][] = Array.from({ length: 7 }, () => [])
  for (const d of days) {
    if (d.sleep) sl[weekday(addDays(d.date, -1))].push(d.sleep)
    if (d.steps !== undefined && d.date < today) st[weekday(d.date)].push(d.steps)
  }
  const avg2 = (xs: number[]) => (xs.length >= 2 ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined)
  return { sleep: sl.map(avg2), steps: st.map(avg2) }
}

export interface Pair { a: { avg: number; n: number }; b: { avg: number; n: number } }
export interface TrainingLinks {
  /** Ressenti des séances après une nuit courte (a) ou normale (b). `threshold` = limite en minutes. */
  feeling?: Pair & { threshold: number }
  /** Nuit qui suit un jour de séance (a) ou un jour de repos (b). */
  sleepAfter?: Pair
  /** Pas les jours de séance (a) ou de repos (b). */
  steps?: Pair
}

/** Ressenti 1-10 d'une séance faite (0 / absent = pas donné). */
export const feelingOf = (s: Session): number | undefined => (s.runLog ? (s.runLog.feeling || undefined) : s.feeling || undefined)

const MIN_N = 3
function pair(a: number[], b: number[]): Pair | undefined {
  if (a.length < MIN_N || b.length < MIN_N) return undefined
  return { a: { avg: mean(a)!, n: a.length }, b: { avg: mean(b)!, n: b.length } }
}

/** Ce que les données disent du lien entre sommeil, pas et séances (seulement quand il y a assez de jours dans chaque groupe). */
export function trainingLinks(days: Day[], sessions: Session[], today: string): TrainingLinks {
  const byDate = new Map(days.map((d) => [d.date, d]))
  const done = sessions.filter((s) => s.status === 'faite' && byDate.has(s.date))
  const trainDays = new Set(done.map((s) => s.date))
  const out: TrainingLinks = {}

  // ressenti selon la nuit d'avant (la nuit est rangée à la date du réveil = le jour de la séance)
  const rated = done.map((s) => ({ f: feelingOf(s), sleep: byDate.get(s.date)?.sleep })).filter((x): x is { f: number; sleep: number } => !!x.f && !!x.sleep)
  const split = (t: number) => pair(rated.filter((x) => x.sleep < t).map((x) => x.f), rated.filter((x) => x.sleep >= t).map((x) => x.f))
  let threshold = 420
  let fp = split(threshold)
  if (!fp && rated.length >= 2 * MIN_N) {
    const med = [...rated].sort((x, y) => x.sleep - y.sleep)[Math.floor(rated.length / 2)].sleep
    threshold = Math.round(med / 15) * 15
    fp = split(threshold)
  }
  if (fp) out.feeling = { ...fp, threshold }

  // nuit suivante : la nuit après le jour D est rangée à D + 1
  const after = days.filter((d) => d.date < today).map((d) => ({ train: trainDays.has(d.date), sleep: byDate.get(addDays(d.date, 1))?.sleep })).filter((x): x is { train: boolean; sleep: number } => !!x.sleep)
  out.sleepAfter = pair(after.filter((x) => x.train).map((x) => x.sleep), after.filter((x) => !x.train).map((x) => x.sleep))

  const st = days.filter((d) => d.date < today && d.steps !== undefined)
  out.steps = pair(st.filter((d) => trainDays.has(d.date)).map((d) => d.steps!), st.filter((d) => !trainDays.has(d.date)).map((d) => d.steps!))
  return out
}
