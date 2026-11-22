// Placement des séances dans la semaine et règles anti-conflit muscu / course.

import type { Session } from './types'
import { addDays, DAY_NAMES } from './utils'
import { isQuality } from './running'

type RunClass = 'long' | 'quality' | 'easy' | null

export function runClass(s: Session): RunClass {
  if (s.sport !== 'course') return null
  if (s.kind === 'longue') return 'long'
  if (isQuality(s.kind) || s.kind === 'course') return 'quality'
  return 'easy'
}
const heavyLegs = (s: Session) => s.sport === 'muscu' && s.legLoad === 'heavy'

export interface Item { s: Session; day: number }
export interface Carry { prevSundayLong?: boolean; nextMondayLong?: boolean; longDayChosen?: boolean }
/** Jours souhaités par sport et jour de la sortie longue (sous-ensembles des jours disponibles). */
export interface DayPrefs { muscu?: number[]; run?: number[]; longRun?: number }

export interface Evaluation { cost: number; messages: string[] }

/** Évalue un agencement (partiel ou complet). Coût ≥ 1000 = règle dure violée. */
export function evaluate(items: Item[], carry: Carry = {}): Evaluation {
  let cost = 0
  const msgs: string[] = []
  const byDay: Item[][] = Array.from({ length: 7 }, () => [])
  items.forEach((it) => byDay[it.day].push(it))
  const has = (d: number, f: (s: Session) => boolean) => d >= 0 && d < 7 && byDay[d].some((i) => f(i.s))

  for (let d = 0; d < 7; d++) {
    const here = byDay[d]
    if (!here.length) continue
    // doubles
    if (here.length > 2) { cost += 1000; msgs.push(`Trop de séances le ${DAY_NAMES[d]}.`) }
    if (here.length >= 2) {
      cost += 60
      const strengths = here.filter((i) => i.s.sport === 'muscu').length
      const runs = here.length - strengths
      if (strengths >= 2 || runs >= 2) cost += 300
      if (here.some((i) => runClass(i.s) === 'long')) cost += 150
      if (here.some((i) => heavyLegs(i.s)) && here.some((i) => runClass(i.s) === 'long')) {
        cost += 1000
        msgs.push(`Séance de jambes lourde et sortie longue le même jour (${DAY_NAMES[d]}).`)
      }
    }
    for (const { s } of here) {
      if (heavyLegs(s)) {
        // règles dures
        if (has(d + 1, (x) => runClass(x) === 'quality' || runClass(x) === 'long')) {
          cost += 1000
          msgs.push(`« ${s.title} » (jambes) le ${DAY_NAMES[d]} : séance de qualité ou sortie longue le lendemain.`)
        }
        if (d === 6 && carry.nextMondayLong) {
          cost += 1000
          msgs.push(`« ${s.title} » (jambes) le ${DAY_NAMES[d]} : la sortie longue est le lundi.`)
        }
        if (has(d - 1, (x) => runClass(x) === 'long') || (d === 0 && carry.prevSundayLong)) {
          cost += 1000
          msgs.push(`« ${s.title} » (jambes) le ${DAY_NAMES[d]} : lendemain de la sortie longue.`)
        }
        // préférences
        if (has(d, (x) => runClass(x) === 'quality')) cost -= 25
        else if (has(d, (x) => runClass(x) === 'easy')) cost -= 10
        if (has(d + 1, (x) => heavyLegs(x)) || has(d - 1, (x) => heavyLegs(x))) cost += 60
      }
      if (runClass(s) === 'quality' && has(d + 1, (x) => runClass(x) === 'quality')) {
        cost += 1000
        msgs.push(`Deux séances de qualité consécutives (${DAY_NAMES[d]} et ${DAY_NAMES[d + 1]}).`)
      }
      if (runClass(s) === 'quality' && has(d + 1, (x) => runClass(x) === 'long')) { cost += 400 }
      if (runClass(s) === 'long' && has(d + 1, (x) => runClass(x) === 'quality')) { cost += 400 }
      // pas d'endurance fondamentale collée à la sortie longue (la veille ou le lendemain) : on garde de la fraîcheur pour la longue
      if (runClass(s) === 'long') {
        for (const nd of [d - 1, d + 1]) {
          if (has(nd, (x) => x.kind === 'ef')) {
            cost += 350
            msgs.push(`Endurance fondamentale et sortie longue sur deux jours consécutifs (${DAY_NAMES[Math.min(d, nd)]} et ${DAY_NAMES[Math.max(d, nd)]}).`)
          } else if (has(nd, (x) => x.kind === 'recup')) cost += 60
        }
      }
      if (s.sport === 'muscu' && has(d + 1, (x) => x.sport === 'muscu' && x.kind === s.kind && x.id !== s.id)) cost += 40
      if (runClass(s) === 'long' && d < 5 && !carry.longDayChosen) cost += (5 - d) * 8
    }
  }
  // répartition : on évite d'enchaîner les jours chargés quand un jour de repos est possible
  for (let d = 0; d < 6; d++) if (byDay[d].length && byDay[d + 1].length) cost += 6
  return { cost, messages: [...new Set(msgs)] }
}

const PRIORITY = (s: Session): number => {
  const rc = runClass(s)
  if (s.kind === 'course') return 0
  if (rc === 'long') return 1
  if (rc === 'quality') return 2
  if (heavyLegs(s)) return 3
  if (s.sport === 'muscu') return 4
  return 5
}

/** Jours possibles pour une séance : ceux choisis pour son sport (sinon tous les jours disponibles), la sortie longue sur son jour. */
export function daysFor(s: Session, allowed: number[], prefs: DayPrefs = {}): number[] {
  const own = s.sport === 'muscu' ? prefs.muscu : prefs.run
  const ok = (own ?? []).filter((d) => allowed.includes(d))
  const list = ok.length ? ok : allowed
  if (runClass(s) === 'long' && prefs.longRun !== undefined && allowed.includes(prefs.longRun)) return [prefs.longRun]
  return list
}

export interface PlaceResult { sessions: Session[]; conflicts: string[]; cost: number }

/**
 * Place les séances d'une semaine sur les jours autorisés (0 = lundi).
 * `fixed` : séances déjà positionnées (ex. jour de course) → [id, jour].
 */
export function placeWeek(
  sessions: Session[], weekStart: string, allowed: number[], fixed: Record<string, number> = {}, carry: Carry = {}, prefs: DayPrefs = {},
): PlaceResult {
  const days = allowed.length ? [...allowed].sort((a, b) => a - b) : [0, 1, 2, 3, 4, 5, 6]
  const order = [...sessions].sort((a, b) => PRIORITY(a) - PRIORITY(b))
  const WIDTH = 500
  let beam: { items: Item[]; cost: number }[] = [{ items: [], cost: 0 }]
  for (const s of order) {
    const next: { items: Item[]; cost: number }[] = []
    const choices = s.id in fixed ? [fixed[s.id]] : daysFor(s, days, prefs)
    for (const b of beam) {
      for (const d of choices) {
        const items = [...b.items, { s, day: d }]
        next.push({ items, cost: evaluate(items, carry).cost + Math.abs(items.length) * 0 })
      }
    }
    next.sort((a, b) => a.cost - b.cost)
    beam = next.slice(0, WIDTH)
  }
  const best = beam[0]
  const ev = evaluate(best.items, carry)
  const placed = best.items
    .map(({ s, day }) => ({ ...s, date: addDays(weekStart, day) }))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.sport === 'course' ? -1 : 1))
  // matin / soir pour les doubles
  const perDay: Record<string, Session[]> = {}
  placed.forEach((s) => (perDay[s.date] ||= []).push(s))
  Object.values(perDay).forEach((arr) => {
    if (arr.length >= 2) arr.forEach((s) => (s.slot = s.sport === 'course' ? 'am' : 'pm'))
    else arr[0].slot = undefined
  })
  return { sessions: placed, conflicts: ev.messages, cost: ev.cost }
}

/** Conflits d'une semaine déjà datée (utilisé lors du glisser-déposer). */
export function conflictsOfWeek(sessions: Session[], weekStart: string, carry: Carry = {}): string[] {
  const items = sessions
    .filter((s) => s.status !== 'sautee')
    .map((s) => ({ s, day: Math.round((Date.parse(s.date) - Date.parse(weekStart)) / 86400000) }))
    .filter((i) => i.day >= 0 && i.day < 7)
  return evaluate(items, carry).messages
}

/** Propose le meilleur jour de la semaine pour une séance, sans créer de conflit. */
export function bestDayFor(
  sessions: Session[], sessionId: string, weekStart: string, allowed: number[], carry: Carry = {}, notBefore?: string,
): number | null {
  const target = sessions.find((s) => s.id === sessionId)
  if (!target) return null
  const others = sessions
    .filter((s) => s.id !== sessionId && s.status !== 'sautee')
    .map((s) => ({ s, day: Math.round((Date.parse(s.date) - Date.parse(weekStart)) / 86400000) }))
  let best: { day: number; cost: number } | null = null
  for (const d of allowed) {
    if (notBefore && addDays(weekStart, d) < notBefore) continue
    const ev = evaluate([...others, { s: target, day: d }], carry)
    if (ev.cost >= 1000) continue
    if (!best || ev.cost < best.cost) best = { day: d, cost: ev.cost }
  }
  return best ? best.day : null
}
