// Formats de séance : séries différentes et parties enchaînées (brique A), groupes d'exercices (brique B),
// repos, ordre de passage, dernière performance, progression. TypeScript pur, sans interface.

import { exerciseOf, isTimed } from './exercises'
import { capLoad } from './guardrails'
import type {
  ExerciseGroup, GroupKind, GroupSpec, PlannedSet, Session, SessionExercise, SetFormat, SetLog, SetPart,
} from './types'
import { uid } from './utils'

// ------------------------------------------------------------------ séries prévues

/** Ce qu'il faut savoir d'un exercice pour lire ses séries (SessionExercise et TemplateExercise conviennent). */
export interface PlanSource {
  exerciseId?: string
  sets: number
  repMin: number
  repMax: number
  rir?: number
  plan?: PlannedSet[]
}

export const hasPlan = (e: Pick<PlanSource, 'plan'>): boolean => !!e.plan && e.plan.length > 0

/** Séries prévues d'un exercice : le détail s'il existe, sinon N séries identiques d'une seule partie. */
export function plannedSetsOf(e: PlanSource): PlannedSet[] {
  if (e.plan && e.plan.length) return e.plan
  const timed = e.exerciseId ? isTimed(e.exerciseId) : false
  return Array.from({ length: e.sets }, () => ({
    parts: [timed ? { seconds: e.repMin, ...(e.rir !== undefined ? { rir: e.rir } : {}) } : { reps: e.repMin, repMax: e.repMax, ...(e.rir !== undefined ? { rir: e.rir } : {}) }],
  }))
}

export const setCountOf = (e: PlanSource): number => (e.plan && e.plan.length ? e.plan.length : e.sets)

/** Nombre de parties de la série `n` (1-based). */
export const partCountOf = (e: PlanSource, n: number): number => plannedSetsOf(e)[n - 1]?.parts.length ?? 1

/** Les logs d'une partie (`part` absent = 0). */
export const partOf = (l: SetLog): number => l.part ?? 0
export const findLog = (logs: SetLog[], n: number, part = 0): SetLog | undefined => logs.find((l) => l.n === n && partOf(l) === part)

/** Une série est faite quand toutes ses parties sont saisies. */
export function isSetDone(e: PlanSource & { logs: SetLog[] }, n: number): boolean {
  const parts = partCountOf(e, n)
  for (let p = 0; p < parts; p++) if (!findLog(e.logs, n, p)) return false
  return true
}
export function doneSetsOf(e: PlanSource & { logs: SetLog[] }): number {
  let k = 0
  for (let n = 1; n <= setCountOf(e); n++) if (isSetDone(e, n)) k++
  return k
}

// ------------------------------------------------------------------ charges relatives

/** Charge relative : % de la référence, arrondi à 0,5 kg. */
export function relativeKg(refKg: number, pct: number): number {
  return Math.round((refKg * pct) / 100 * 2) / 2
}

/**
 * Référence d'une partie relative : la partie lourde de la même série (partie 0) ; pour la première partie d'une série
 * suivante, la première partie de la première série. La toute première partie n'a pas de référence : c'est elle.
 */
export function refPartOf(n: number, part: number): { n: number; part: number } | undefined {
  if (part > 0) return { n, part: 0 }
  if (n > 1) return { n: 1, part: 0 }
  return undefined
}

/** Charge à pré-remplir pour une partie : charge absolue prévue, sinon % de la référence saisie. `kgOf` lit la charge saisie ou affichée d'une autre partie. */
export function suggestedKg(
  e: PlanSource, n: number, part: number, kgOf: (n: number, part: number) => number | undefined,
): number | undefined {
  const p = plannedSetsOf(e)[n - 1]?.parts[part]
  if (!p) return undefined
  if (p.kg !== undefined) return p.kg
  if (p.pct === undefined) return undefined
  const ref = refPartOf(n, part)
  const refKg = ref ? kgOf(ref.n, ref.part) : undefined
  return refKg !== undefined && refKg > 0 ? relativeKg(refKg, p.pct) : undefined
}

// ------------------------------------------------------------------ formats prêts à l'emploi

export const FORMAT_LABEL: Record<SetFormat, string> = {
  classique: 'Classique', pyramide: 'Pyramide', lourde: 'Série lourde + allégées', degressive: 'Dégressive', rest_pause: 'Rest-pause', combo: 'Combo',
}
export const FORMAT_HINT: Record<SetFormat, string> = {
  classique: 'N séries identiques.',
  pyramide: 'Les reps descendent (12, 10, 8, 6), la charge monte.',
  lourde: 'Une série lourde de 3 à 5 reps, puis des séries à −12,5 %.',
  degressive: 'La dernière série : 3 parties enchaînées, −20 % à chaque partie.',
  rest_pause: 'La dernière série : 3 parties à la même charge, 15 s de pause entre elles.',
  combo: 'Une rep lourde, puis tout de suite des reps plus légères (−20 %).',
}
export const FORMATS: SetFormat[] = ['classique', 'pyramide', 'lourde', 'degressive', 'rest_pause', 'combo']
/** Nombre de séries proposé quand on choisit un format. */
export const FORMAT_DEFAULT_SETS: Record<SetFormat, number> = { classique: 3, pyramide: 4, lourde: 4, degressive: 3, rest_pause: 3, combo: 3 }

export interface FormatBase { sets: number; repMin: number; repMax: number; rir?: number }
export interface FormatResult { format: SetFormat; sets: number; repMin: number; repMax: number; plan?: PlannedSet[] }

const PYRAMID_REPS = [12, 10, 8, 6]
const rirOf = (rir?: number) => (rir !== undefined ? { rir } : {})

/** Reps min / max d'un plan (pour garder `repMin` / `repMax` cohérents avec `sets`). */
export function repRangeOf(plan: PlannedSet[]): { repMin: number; repMax: number } {
  const all = plan.flatMap((s) => s.parts).filter((p) => p.reps !== undefined || p.seconds !== undefined)
  if (!all.length) return { repMin: 1, repMax: 1 }
  const lo = Math.min(...all.map((p) => p.reps ?? p.seconds ?? 1))
  const hi = Math.max(...all.map((p) => p.repMax ?? p.reps ?? p.seconds ?? 1))
  return { repMin: lo, repMax: hi }
}

/**
 * Préremplit la structure d'un format. Le client l'ajuste ensuite.
 * - Dégressive et rest-pause : les séries précédentes restent classiques, la dernière est enchaînée.
 * - Série lourde, combo, pyramide : toutes les séries.
 * Un format qui n'a pas de sens (trop peu de séries, exercice en durée) retombe sur « classique ».
 */
export function applyFormat(format: SetFormat, b: FormatBase, timed = false): FormatResult {
  const classic: FormatResult = { format: 'classique', sets: Math.max(1, b.sets), repMin: b.repMin, repMax: b.repMax }
  if (format === 'classique' || timed || b.sets < 1) return classic
  const sets = Math.max(1, b.sets)
  const simple = (): SetPart => ({ reps: b.repMin, repMax: b.repMax, ...rirOf(b.rir) })
  let plan: PlannedSet[]
  if (format === 'pyramide') {
    if (sets < 3) return classic
    plan = Array.from({ length: sets }, (_, i) => ({ parts: [{ reps: PYRAMID_REPS[Math.min(i, 3)], pct: 100 + 6 * Math.min(i, 3), ...rirOf(b.rir) }] }))
  } else if (format === 'lourde') {
    if (sets < 3) return classic
    plan = [
      { parts: [{ reps: 3, repMax: 5, pct: 100, ...rirOf(b.rir) }] },
      ...Array.from({ length: sets - 1 }, () => ({ parts: [{ reps: 6, repMax: 8, pct: 87.5, ...rirOf(b.rir) }] })),
    ]
  } else if (format === 'degressive') {
    if (sets < 3) return classic
    plan = [
      ...Array.from({ length: sets - 1 }, () => ({ parts: [simple()] })),
      { parts: [
        { ...simple(), pct: 100, restAfterSec: 0 },
        { ...simple(), pct: 80, restAfterSec: 0 },
        { ...simple(), pct: 60 },
      ] },
    ]
  } else if (format === 'rest_pause') {
    if (sets < 3) return classic
    plan = [
      ...Array.from({ length: sets - 1 }, () => ({ parts: [simple()] })),
      { parts: [
        { ...simple(), pct: 100, restAfterSec: 15 },
        { reps: Math.max(3, Math.round(b.repMin * 0.5)), pct: 100, restAfterSec: 15, ...rirOf(b.rir) },
        { reps: Math.max(2, Math.round(b.repMin * 0.35)), pct: 100, ...rirOf(b.rir) },
      ] },
    ]
  } else {
    plan = Array.from({ length: sets }, () => ({ parts: [
      { reps: 1, pct: 100, restAfterSec: 0, ...rirOf(b.rir) },
      { reps: 6, pct: 80, ...rirOf(b.rir) },
    ] }))
  }
  return { format, sets: plan.length, ...repRangeOf(plan), plan }
}

/** Cible d'une partie : « 6 », « 8–12 », « 30 s », « 6 à −20 % », « 100 reps à 40 kg ». */
export const partText = (p: SetPart): string => {
  const t = p.seconds !== undefined ? `${p.seconds} s` : p.repMax !== undefined && p.reps !== undefined && p.repMax !== p.reps ? `${p.reps}–${p.repMax}` : `${p.reps ?? '?'}`
  if (p.kg !== undefined) return `${t} à ${String(p.kg).replace('.', ',')} kg`
  if (p.pct === undefined || p.pct === 100) return t
  const d = Math.round((p.pct - 100) * 10) / 10
  return `${t} à ${d > 0 ? '+' : '−'}${String(Math.abs(d)).replace('.', ',')} %`
}

/**
 * Résumé court des séries, par blocs de séries identiques : « 3 × 8–10 », « 3 × (1 + 6 à −20 %) »,
 * « 3–5, puis 2 × 6–8 à −12,5 % », « 2 × 10–15, puis (10–15 + 10–15 à −20 % + 10–15 à −40 %) ».
 */
export function describePlan(e: PlanSource): string {
  const text = (s: PlannedSet) => s.parts.map(partText).join(' + ')
  const runs: { t: string; n: number; multi: boolean }[] = []
  for (const s of plannedSetsOf(e)) {
    const t = text(s)
    const last = runs[runs.length - 1]
    if (last && last.t === t) last.n++
    else runs.push({ t, n: 1, multi: s.parts.length > 1 })
  }
  return runs.map((r) => {
    const body = r.multi && (r.n > 1 || runs.length > 1) ? `(${r.t})` : r.t
    return r.n > 1 ? `${r.n} × ${body}` : body
  }).join(', puis ')
}

/** Étiquette sous le nom de l'exercice : « Combo · 1 + 6 », « Dégressive · 3 parties ». Rien pour une série classique. */
export function formatLabel(e: Pick<SessionExercise, 'plan' | 'format'> & { exerciseId?: string }): string | undefined {
  if (!e.plan?.length || !e.format || e.format === 'classique') return undefined
  const maxParts = Math.max(...e.plan.map((s) => s.parts.length))
  switch (e.format) {
    case 'combo': return `Combo · ${e.plan[0].parts.map((p) => p.reps ?? p.seconds ?? '?').join(' + ')}`
    case 'degressive': return `Dégressive · ${maxParts} parties`
    case 'rest_pause': return `Rest-pause · ${maxParts} parties`
    case 'lourde': return `Série lourde · ${e.plan[0].parts[0].reps ?? '?'}–${e.plan[0].parts[0].repMax ?? e.plan[0].parts[0].reps} reps + allégées`
    case 'pyramide': return `Pyramide · ${e.plan.map((s) => s.parts[0].reps ?? '?').join('/')}`
    default: return undefined
  }
}

/** Change le nombre de séries en gardant la structure : on retire les dernières, ou on copie la dernière série prévue. */
export function resizeSets<T extends PlanSource & { plan?: PlannedSet[]; format?: SetFormat }>(e: T, n: number): void {
  const count = Math.max(1, Math.round(n))
  if (e.plan && e.plan.length) {
    if (count < e.plan.length) e.plan = e.plan.slice(0, count)
    else while (e.plan.length < count) e.plan = [...e.plan, structuredClone(e.plan[e.plan.length - 1])]
    e.sets = e.plan.length
    Object.assign(e, repRangeOf(e.plan))
  } else e.sets = count
}

/** Retire le détail des séries (retour à N séries identiques). */
export function clearPlan(e: { plan?: PlannedSet[]; format?: SetFormat }): void {
  delete e.plan
  delete e.format
}

// ------------------------------------------------------------------ groupes

export const GROUP_LABEL: Record<GroupKind, string> = { superset: 'Superset', triset: 'Triset', circuit: 'Circuit', emom: 'EMOM', amrap: 'AMRAP', chrono: 'Chrono' }
export const GROUP_HINT: Record<GroupKind, string> = {
  superset: '2 exercices enchaînés, puis un repos.',
  triset: '3 exercices enchaînés, puis un repos.',
  circuit: 'N exercices, N tours.',
  emom: 'Chaque minute, un exercice ou une alternance.',
  amrap: 'Le maximum de tours dans le temps imparti.',
  chrono: 'Pour le temps : finir le travail le plus vite possible.',
}
export const GROUP_KINDS: GroupKind[] = ['superset', 'triset', 'circuit', 'emom', 'amrap', 'chrono']
export const GROUP_COLOR: Record<GroupKind, string> = {
  superset: '#0A84FF', triset: '#5E5CE6', circuit: '#30B0C7', emom: '#FF9F0A', amrap: '#FF453A', chrono: '#BF5AF2',
}
/** Superset et triset ont un nombre d'exercices fixe ; les autres en ont au moins 2 (1 pour EMOM, AMRAP et chrono). */
export const GROUP_SIZE: Record<GroupKind, { min: number; max: number }> = {
  superset: { min: 2, max: 2 }, triset: { min: 3, max: 3 }, circuit: { min: 2, max: 8 }, emom: { min: 1, max: 6 }, amrap: { min: 1, max: 8 }, chrono: { min: 1, max: 8 },
}
/** Superset, triset et circuit : un tour = tous les exercices ; chaque série saisie est un tour. */
export const isRoundsKind = (k: GroupKind): boolean => k === 'superset' || k === 'triset' || k === 'circuit'
/** EMOM, AMRAP, chrono : un seul résultat pour tout le groupe. */
export const isTimedKind = (k: GroupKind): boolean => !isRoundsKind(k)

export const letterOf = (i: number): string => String.fromCharCode(65 + i)

/** Valeurs par défaut d'un groupe, que le client ajuste ensuite. */
export function defaultGroup(kind: GroupKind, exerciseIds: string[], id = uid('g')): GroupSpec {
  const base = { id, kind, exerciseIds }
  switch (kind) {
    case 'superset': return { ...base, rounds: 3, restBetweenSec: 10, restAfterRoundSec: 90 }
    case 'triset': return { ...base, rounds: 3, restBetweenSec: 10, restAfterRoundSec: 120 }
    case 'circuit': return { ...base, rounds: 3, restBetweenSec: 20, restAfterRoundSec: 90 }
    case 'emom': return { ...base, rounds: 1, restBetweenSec: 0, restAfterRoundSec: 0, durationMin: 12 }
    case 'amrap': return { ...base, rounds: 1, restBetweenSec: 0, restAfterRoundSec: 0, durationMin: 10 }
    default: return { ...base, rounds: 3, restBetweenSec: 0, restAfterRoundSec: 0 }
  }
}

export const groupOf = (s: Pick<Session, 'groups'>, exerciseSeId: string): ExerciseGroup | undefined =>
  s.groups?.find((g) => g.exerciseIds.includes(exerciseSeId))

/** Exercices d'un groupe, dans l'ordre de passage (les exercices disparus sont ignorés). */
export function groupMembers<E extends { id: string }>(s: { exercises?: E[] }, g: GroupSpec): E[] {
  return g.exerciseIds.map((id) => s.exercises?.find((e) => e.id === id)).filter((e): e is E => !!e)
}

/** Fourchette de reps (ou de secondes) de départ d'un exercice. */
export function nominalReps(exerciseId: string): { repMin: number; repMax: number } {
  if (isTimed(exerciseId)) return { repMin: 30, repMax: 45 }
  return exerciseOf(exerciseId).compound ? { repMin: 6, repMax: 10 } : { repMin: 10, repMax: 15 }
}

/**
 * Valeurs préremplies d'un exercice qui entre dans un groupe : circuit, EMOM, AMRAP et chrono se font à reps fixes
 * (au moins 8 pour un exercice en répétitions). Superset et triset gardent leur fourchette.
 */
export function applyGroupDefaults(kind: GroupKind, members: { exerciseId: string; repMin: number; repMax: number }[]): void {
  if (kind === 'superset' || kind === 'triset') return
  for (const e of members) {
    const reps = isTimed(e.exerciseId) ? e.repMin : Math.max(8, e.repMin)
    e.repMin = reps
    e.repMax = reps
  }
}

/**
 * Remet les groupes d'une séance en cohérence après un ajout, un retrait ou un remplacement d'exercice :
 * - les exercices disparus sortent du groupe ; un groupe qui n'a plus assez d'exercices est dissous (un triset à 2 devient un superset) ;
 * - un exercice n'appartient qu'à un seul groupe ; il perd son détail de séries (un groupe impose sa propre structure) ;
 * - superset, triset, circuit : chaque exercice a autant de séries que de tours ; EMOM, AMRAP, chrono : une seule série.
 */
export function normalizeGroups<E extends { id: string; sets: number; plan?: PlannedSet[]; format?: SetFormat }, G extends GroupSpec>(s: { exercises?: E[]; groups?: G[] }): void {
  if (!s.groups?.length) { delete s.groups; return }
  const used = new Set<string>()
  const out: G[] = []
  for (const g of s.groups) {
    const ids = g.exerciseIds.filter((id) => !used.has(id) && s.exercises?.some((e) => e.id === id))
    let kind = g.kind
    if (kind === 'triset' && ids.length === 2) kind = 'superset'
    const min = GROUP_SIZE[kind].min
    if (ids.length < min || (kind === 'superset' && ids.length !== 2) || (kind === 'triset' && ids.length !== 3)) continue
    ids.forEach((id) => used.add(id))
    out.push({ ...g, kind, exerciseIds: ids })
  }
  for (const g of out) {
    for (const e of groupMembers(s, g)) {
      clearPlan(e)
      e.sets = isRoundsKind(g.kind) ? Math.max(1, g.rounds) : 1
    }
  }
  if (out.length) s.groups = out
  else delete s.groups
}

/** Les changements de séries d'un exercice de groupe se répercutent sur le nombre de tours (le plus petit gagne). */
export function syncRoundsFromMembers<E extends { id: string; sets: number; plan?: PlannedSet[]; format?: SetFormat }, G extends GroupSpec>(s: { exercises?: E[]; groups?: G[] }): void {
  for (const g of s.groups ?? []) {
    if (!isRoundsKind(g.kind)) continue
    const m = groupMembers(s, g)
    if (m.length) g.rounds = Math.max(1, Math.min(...m.map((e) => e.sets)))
  }
  normalizeGroups(s)
}

// ------------------------------------------------------------------ ordre de passage

export interface RoundsProgress {
  rounds: number
  doneRounds: number
  /** Prochaine saisie attendue : le tour (1-based) et la position dans le tour (0-based). */
  next?: { round: number; index: number; seId: string }
  complete: boolean
}

export function roundsProgress(s: Pick<Session, 'exercises'>, g: GroupSpec): RoundsProgress {
  const members = groupMembers(s, g)
  let doneRounds = 0
  let next: RoundsProgress['next']
  for (let r = 1; r <= g.rounds; r++) {
    let all = true
    members.forEach((e, i) => {
      if (!findLog(e.logs, r, 0)) { all = false; if (!next) next = { round: r, index: i, seId: e.id } }
    })
    if (all && members.length) doneRounds++
  }
  return { rounds: g.rounds, doneRounds, next, complete: !next && members.length > 0 }
}

/** « Superset · Tour 2/4 » + « A2 puis B2, puis repos » ; circuit : « Tour 2/3 · 3/5 Fentes arrière ». */
export function groupGuide(s: Pick<Session, 'exercises'>, g: GroupSpec): { title: string; hint: string } {
  const members = groupMembers(s, g)
  if (!isRoundsKind(g.kind)) return { title: GROUP_LABEL[g.kind], hint: '' }
  const p = roundsProgress(s, g)
  if (p.complete || !p.next) return { title: `${GROUP_LABEL[g.kind]} · ${g.rounds} tour${g.rounds > 1 ? 's' : ''} faits`, hint: 'Groupe terminé' }
  const { round, index } = p.next
  if (g.kind === 'circuit') {
    return { title: `Circuit · Tour ${round}/${g.rounds}`, hint: `Tour ${round}/${g.rounds} · ${index + 1}/${members.length} ${exerciseOf(members[index].exerciseId).name}` }
  }
  const rest = members.slice(index).map((_, j) => `${letterOf(index + j)}${round}`)
  return { title: `${GROUP_LABEL[g.kind]} · Tour ${round}/${g.rounds}`, hint: `${rest.join(' puis ')}, puis repos` }
}

// ------------------------------------------------------------------ EMOM, AMRAP, chrono

export interface EmomState {
  /** Minute en cours (1-based) ; au-delà de la durée, `finished`. */
  minute: number
  total: number
  /** Secondes restantes dans la minute en cours. */
  secLeft: number
  seId: string
  finished: boolean
}

/** Position dans un EMOM : tout se déduit de l'horodatage de départ, donc juste après un verrouillage d'écran ou un rechargement. */
export function emomState(s: Pick<Session, 'exercises'>, g: GroupSpec & { startedAt?: number }, now: number): EmomState | undefined {
  const members = groupMembers(s, g)
  if (g.startedAt === undefined || !members.length) return undefined
  const total = g.durationMin ?? 10
  const elapsed = Math.max(0, Math.floor((now - g.startedAt) / 1000))
  const minute = Math.min(total, Math.floor(elapsed / 60) + 1)
  const finished = elapsed >= total * 60
  const m = members[(minute - 1) % members.length]
  return { minute, total, secLeft: finished ? 0 : 60 - (elapsed % 60), seId: m.id, finished }
}

/** Secondes restantes d'un AMRAP (jusqu'à 0). */
export function amrapLeft(g: GroupSpec & { startedAt?: number }, now: number): number | undefined {
  if (g.startedAt === undefined) return undefined
  return Math.max(0, (g.durationMin ?? 10) * 60 - Math.floor((now - g.startedAt) / 1000))
}
/** Secondes écoulées d'un chrono. */
export function chronoElapsed(g: { startedAt?: number }, now: number): number | undefined {
  return g.startedAt === undefined ? undefined : Math.max(0, Math.floor((now - g.startedAt) / 1000))
}

/** Cible d'un exercice de groupe pour l'affichage : « ×20 » ou « 30 s ». */
export function targetOf(e: Pick<SessionExercise, 'exerciseId' | 'repMin' | 'repMax' | 'plan'>): string {
  const sec = isTimed(e.exerciseId)
  const side = exerciseOf(e.exerciseId).perSide ? ' / côté' : ''
  const p = e.plan?.[0]?.parts[0]
  if (sec) return `${p?.seconds ?? e.repMin} s${side}`
  const lo = p?.reps ?? e.repMin
  const hi = p?.repMax ?? e.repMax
  return `×${lo === hi || hi === undefined ? lo : `${lo}–${hi}`}${side}`
}

// ------------------------------------------------------------------ repos

export interface RestSpec {
  /** Durée du repos ; 0 avec `chain` = « Enchaîne » (pas de minuteur). */
  sec: number
  chain: boolean
  label: string
}

/**
 * Repos à lancer quand la partie `part` de la série `n` de l'exercice `e` est validée :
 *  - entre deux parties d'une série : le `restAfterSec` de la partie (0 = enchaîné) ;
 *  - dans un superset / triset / circuit : le repos entre exercices, puis le repos entre tours (et après le groupe) ;
 *  - sinon le `restSec` de l'exercice.
 * `null` : pas de minuteur (EMOM, AMRAP, chrono : le temps est déjà cadencé).
 */
export function restAfter(s: Pick<Session, 'exercises' | 'groups'>, e: SessionExercise, n: number, part: number): RestSpec | null {
  const g = groupOf(s, e.id)
  if (g && isTimedKind(g.kind)) return null
  const parts = partCountOf(e, n)
  if (part < parts - 1) {
    const sec = plannedSetsOf(e)[n - 1]?.parts[part]?.restAfterSec ?? 0
    return sec > 0 ? { sec, chain: false, label: 'Repos entre les parties' } : { sec: 0, chain: true, label: 'Enchaîne la partie suivante' }
  }
  if (g) {
    const members = groupMembers(s, g)
    const idx = members.findIndex((m) => m.id === e.id)
    if (idx < members.length - 1) {
      return g.restBetweenSec > 0
        ? { sec: g.restBetweenSec, chain: false, label: 'Repos entre exercices' }
        : { sec: 0, chain: true, label: `Enchaîne ${letterOf(idx + 1)}${n}` }
    }
    if (g.restAfterRoundSec <= 0) return null
    return { sec: g.restAfterRoundSec, chain: false, label: n >= g.rounds ? 'Repos après le groupe' : 'Repos entre les tours' }
  }
  return e.restSec > 0 ? { sec: e.restSec, chain: false, label: 'Repos' } : null
}

// ------------------------------------------------------------------ dernière performance

export interface LastSet { n: number; parts: { part: number; kg: number; reps: number; seconds?: number }[] }

/** Regroupe des logs par série, partie par partie. */
export function groupLogsBySet(logs: SetLog[]): LastSet[] {
  const by = new Map<number, LastSet>()
  for (const l of [...logs].sort((a, b) => a.n - b.n || partOf(a) - partOf(b))) {
    const cur = by.get(l.n) ?? { n: l.n, parts: [] }
    cur.parts.push({ part: partOf(l), kg: l.kg, reps: l.reps, ...(l.seconds !== undefined ? { seconds: l.seconds } : {}) })
    by.set(l.n, cur)
  }
  return [...by.values()]
}

const fmt = (x: number) => String(Math.round(x * 10) / 10).replace('.', ',')

/** « 1 × 100 kg + 6 × 80 kg » pour une série à parties ; « 55 × 8 » pour une série classique ; « 30 s » pour une durée. */
export function describeLastSet(ls: LastSet): string {
  if (ls.parts.length === 1) {
    const p = ls.parts[0]
    if (p.seconds !== undefined) return p.kg > 0 ? `${p.seconds} s · ${fmt(p.kg)} kg` : `${p.seconds} s`
    return `${fmt(p.kg)} × ${p.reps}`
  }
  return ls.parts.map((p) => (p.seconds !== undefined ? `${p.seconds} s` : p.kg > 0 ? `${p.reps} × ${fmt(p.kg)} kg` : `${p.reps} reps`)).join(' + ')
}

// ------------------------------------------------------------------ progression

/** Les reps (et le RIR) d'une partie atteignent-ils la cible ? Pas de progression pour une durée. */
function partReached(p: SetPart, l: SetLog, targetRir: number): boolean {
  if (p.reps === undefined) return false
  const goal = p.repMax ?? p.reps
  const rir = p.rir ?? targetRir
  return l.reps >= goal && l.rir <= rir + 1
}

export interface PlanLoad { kg: number; next: number; verdict: 'monter' | 'maintenir'; why: string }

/**
 * Progression d'un exercice à séries détaillées (série lourde, combo, dégressive, pyramide…) : si TOUTES les parties
 * atteignent leurs reps cibles avec le RIR visé, +2,5 kg sur la partie lourde (+1 kg sur haltères ou isolation).
 * Les parties relatives suivent toutes seules. La double progression automatique reste réservée aux séries classiques.
 */
export function nextLoadPlan(e: SessionExercise): PlanLoad | null {
  if (!e.plan?.length || !e.logs.length) return null
  const kg = Math.max(...e.logs.map((l) => l.kg))
  const all = e.plan.every((set, i) => set.parts.every((p, j) => {
    const l = findLog(e.logs, i + 1, j)
    return !!l && partReached(p, l, e.rir)
  }))
  const ex = exerciseOf(e.exerciseId)
  const inc = ex.equipment === 'halteres' || !ex.compound ? 1 : 2.5
  if (!all || kg <= 0) return { kg, next: kg, verdict: 'maintenir', why: '' }
  const next = Math.round(capLoad(kg, kg + inc) * 2) / 2
  return { kg, next, verdict: 'monter', why: 'toutes les parties ont atteint leurs reps cibles' }
}

// ------------------------------------------------------------------ regroupement automatique en supersets (génération)

export interface PairItem { id: string; pattern: string; muscle: string; compound: boolean; sets: number }

const OPPOSITES: [string[], string[]][] = [
  [['push_h', 'push_inc', 'fly'], ['pull_h']], // poussée / tirage horizontal
  [['push_v'], ['pull_v']], // poussée / tirage vertical
  [['curl'], ['tri_ext']], // biceps / triceps
  [['leg_ext'], ['leg_curl']], // extension / flexion de jambe
]
const LOWER = ['quadriceps', 'ischios', 'fessiers', 'mollets']

/**
 * Paires d'exercices opposés pour des supersets. Jamais deux exercices lourds et techniques de jambes ensemble
 * (squat + soulevé de terre), jamais plus d'une série d'écart entre les deux exercices d'une paire.
 */
export function pairOpposites(items: PairItem[]): [string, string][] {
  const used = new Set<string>()
  const out: [string, string][] = []
  for (const [as, bs] of OPPOSITES) {
    for (const a of items) {
      if (used.has(a.id) || !as.includes(a.pattern)) continue
      const b = items.find((x) => !used.has(x.id) && x.id !== a.id && bs.includes(x.pattern) && Math.abs(x.sets - a.sets) <= 1
        && !(a.compound && x.compound && LOWER.includes(a.muscle) && LOWER.includes(x.muscle)))
      if (!b) continue
      used.add(a.id); used.add(b.id)
      out.push([a.id, b.id])
    }
  }
  return out
}

/** Durée d'un groupe, en secondes (pour l'estimation de la durée d'une séance). */
export function groupSeconds(g: GroupSpec, members: { restSec?: number }[]): number {
  const n = Math.max(1, members.length)
  if (g.kind === 'emom' || g.kind === 'amrap') return (g.durationMin ?? 10) * 60 + 30
  if (g.kind === 'chrono') return g.rounds * n * 45 + 30
  return g.rounds * (n * 40 + (n - 1) * g.restBetweenSec + g.restAfterRoundSec) + 30 * n
}

/** Durée supplémentaire due aux parties enchaînées d'un exercice à séries détaillées (secondes). */
export function extraPartsSeconds(plan: PlannedSet[] | undefined): number {
  if (!plan) return 0
  return plan.reduce((a, s) => a + s.parts.slice(0, -1).reduce((b, p) => b + 20 + (p.restAfterSec ?? 0), 0), 0)
}

// ------------------------------------------------------------------ avancement d'une séance

/**
 * Avancement d'une séance de muscu : séries faites / prévues (une série à parties n'est faite que quand toutes ses parties le sont).
 * Un EMOM, un AMRAP ou un chrono compte pour un bloc, fait quand son résultat est saisi.
 */
export function sessionProgress(s: Pick<Session, 'exercises' | 'groups'>): { done: number; total: number } {
  const timed = new Set((s.groups ?? []).filter((g) => isTimedKind(g.kind)).flatMap((g) => g.exerciseIds))
  let done = 0
  let total = 0
  for (const e of s.exercises ?? []) {
    if (timed.has(e.id)) continue
    total += setCountOf(e)
    done += doneSetsOf(e)
  }
  for (const g of s.groups ?? []) {
    if (!isTimedKind(g.kind)) continue
    total += 1
    done += g.result ? 1 : 0
  }
  return { done, total }
}

// ------------------------------------------------------------------ statistiques des groupes

export interface GroupStats {
  /** Tours de circuit et de superset / triset terminés. */
  circuitRounds: number
  supersetRounds: number
  amrap: { count: number; totalRounds: number; bestRounds: number }
  emom: { count: number; minutes: number }
  chrono: { count: number; bestSeconds?: number }
}

/**
 * Tours de circuit, AMRAP, EMOM et chronos d'une liste de séances faites. Ils ne touchent jamais au tonnage :
 * un AMRAP ou un EMOM n'a pas de charge, et les tours d'un circuit comptent par leurs exercices (charges facultatives).
 */
export function groupStats(sessions: Pick<Session, 'exercises' | 'groups'>[]): GroupStats {
  const out: GroupStats = { circuitRounds: 0, supersetRounds: 0, amrap: { count: 0, totalRounds: 0, bestRounds: 0 }, emom: { count: 0, minutes: 0 }, chrono: { count: 0 } }
  for (const s of sessions) {
    for (const g of s.groups ?? []) {
      if (g.kind === 'circuit') out.circuitRounds += roundsProgress(s, g).doneRounds
      else if (g.kind === 'superset' || g.kind === 'triset') out.supersetRounds += roundsProgress(s, g).doneRounds
      else if (g.result) {
        if (g.kind === 'amrap') { const r = g.result.rounds ?? 0; out.amrap.count++; out.amrap.totalRounds += r; out.amrap.bestRounds = Math.max(out.amrap.bestRounds, r) }
        else if (g.kind === 'emom') { out.emom.count++; out.emom.minutes += g.result.minutesDone ?? g.durationMin ?? 0 }
        else if (g.kind === 'chrono' && g.result.seconds) { out.chrono.count++; out.chrono.bestSeconds = Math.min(out.chrono.bestSeconds ?? Infinity, g.result.seconds) }
      }
    }
  }
  return out
}
