// Moteur de musculation : split, volumes, séries/reps/RIR, charges, cycle de 8 semaines.

import { EXERCISE_BY_ID, candidates } from './exercises'
import { applyFormat, defaultGroup, extraPartsSeconds, groupSeconds, pairOpposites, syncRoundsFromMembers } from './formats'
import type {
  Exercise, ExerciseGroup, Goal, GroupSpec, Level, Muscle, Pattern, Questionnaire, Session, SessionExercise, SetFormat, SplitKey, StrengthKind, Zone,
} from './types'
import { LOWER_MUSCLES } from './types'
import { MAX_WEEKLY_SETS } from './guardrails'
import { clamp, round, uid } from './utils'

// ------------------------------------------------------------------ splits

export const SPLIT_LABEL: Record<SplitKey, string> = {
  fullbody: 'Full body',
  fullbody3: 'Full body ×3',
  haut_bas_full: 'Haut / Bas / Full body',
  haut_bas: 'Haut / Bas ×2',
  haut_bas_ppj: 'Haut / Bas + Push / Pull / Jambes',
  ppj: 'Push / Pull / Jambes ×2',
  haut_bas2: 'Haut / Bas',
  ppj3: 'Push / Pull / Jambes',
  ppj4: 'Push / Pull / Jambes + Full body',
  muscle4: 'Split par muscle',
  muscle5: 'Split par muscle',
  muscle6: 'Split par muscle',
  push_pull_full: 'Push / Pull / Full body',
  push_pull: 'Push / Pull',
}

/** Explication courte de chaque formule, affichée à l'inscription. */
export const SPLIT_DESC: Record<SplitKey, string> = {
  fullbody: 'Tout le corps à chaque séance',
  fullbody3: 'Tout le corps, 3 fois par semaine',
  haut_bas_full: 'Une séance haut, une bas, une complète',
  haut_bas: 'Haut du corps et bas du corps en alternance',
  haut_bas_ppj: 'Haut, bas, puis push, pull et jambes',
  ppj: 'Pousser, tirer, jambes : deux fois chacun',
  haut_bas2: 'Une séance haut du corps, une séance bas du corps',
  ppj3: 'Pousser (pecs, épaules, triceps), tirer (dos, biceps), jambes',
  ppj4: 'Push, Pull, Jambes, plus une séance complète',
  muscle4: 'Pecs/triceps, dos/biceps, épaules/abdos, jambes',
  muscle5: 'Pecs, dos, jambes, épaules, bras : un groupe par séance',
  muscle6: 'Un groupe musculaire par séance, jambes deux fois',
  push_pull_full: 'Pousser, tirer, puis une séance complète sans jambes',
  push_pull: 'Pousser et tirer en alternance, sans jambes',
}

const SPLIT_KINDS: Record<SplitKey, (n: number) => StrengthKind[]> = {
  fullbody: (n) => Array(n).fill('fullbody'),
  fullbody3: () => ['fullbody', 'fullbody', 'fullbody'],
  haut_bas_full: () => ['haut', 'bas', 'fullbody'],
  haut_bas: () => ['haut', 'bas', 'haut', 'bas'],
  haut_bas_ppj: () => ['haut', 'bas', 'push', 'pull', 'jambes'],
  ppj: () => ['push', 'pull', 'jambes', 'push', 'pull', 'jambes'],
  haut_bas2: () => ['haut', 'bas'],
  ppj3: () => ['push', 'pull', 'jambes'],
  ppj4: () => ['push', 'pull', 'jambes', 'fullbody'],
  muscle4: () => ['pecs', 'dos', 'epaules', 'jambes'],
  muscle5: () => ['pecs', 'dos', 'jambes', 'epaules', 'bras'],
  muscle6: () => ['pecs', 'dos', 'jambes', 'epaules', 'bras', 'jambes'],
  push_pull_full: (n) => Array.from({ length: n }, (_, i) => (['push', 'pull', 'fullbody'] as StrengthKind[])[i % 3]),
  push_pull: (n) => Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 'push' : 'pull') as StrengthKind),
}

/** Sans quadriceps, ischios ni fessiers, il n'y a plus de « bas du corps » : on bascule sur des séances de haut du corps. */
export function isUpperOnly(excluded: Muscle[] | undefined): boolean {
  const ex = excluded ?? []
  return (['quadriceps', 'ischios', 'fessiers'] as Muscle[]).every((m) => ex.includes(m))
}

export function recommendedSplit(n: number, level: Level, upperOnly = false): SplitKey {
  if (upperOnly) return n <= 1 ? 'fullbody' : n === 2 ? 'push_pull' : 'push_pull_full'
  if (n <= 2) return 'fullbody'
  if (n === 3) return level === 'debutant' ? 'fullbody3' : 'haut_bas_full'
  if (n === 4) return 'haut_bas'
  if (n === 5) return 'haut_bas_ppj'
  return 'ppj'
}

/** Formules proposées selon le nombre de séances (et l'absence de jambes). */
export function splitOptions(n: number, upperOnly = false): SplitKey[] {
  if (upperOnly) return n <= 1 ? ['fullbody'] : n === 2 ? ['push_pull', 'fullbody'] : n === 3 ? ['push_pull_full', 'fullbody'] : ['push_pull_full', 'push_pull', 'fullbody']
  if (n <= 1) return ['fullbody']
  if (n === 2) return ['fullbody', 'haut_bas2']
  if (n === 3) return ['fullbody3', 'haut_bas_full', 'ppj3']
  if (n === 4) return ['haut_bas', 'ppj4', 'muscle4']
  if (n === 5) return ['haut_bas_ppj', 'muscle5']
  return ['ppj', 'muscle6']
}

export function resolveSplit(n: number, level: Level, preferred?: SplitKey, upperOnly = false): SplitKey {
  if (preferred && splitOptions(n, upperOnly).includes(preferred)) return preferred
  return recommendedSplit(n, level, upperOnly)
}

export function splitSessionKinds(split: SplitKey, n: number): StrengthKind[] {
  return SPLIT_KINDS[split](n)
}

// ------------------------------------------------------------------ gabarits de séance

interface Slot { m: Muscle; pats: Pattern[]; w?: number; minor?: boolean; must?: boolean }

const FB: Slot[] = [
  { m: 'quadriceps', pats: ['squat', 'lunge', 'leg_ext'] },
  { m: 'pectoraux', pats: ['push_h', 'push_inc', 'fly'] },
  { m: 'dos', pats: ['pull_h', 'pull_v'] },
  { m: 'ischios', pats: ['hinge', 'leg_curl'] },
  { m: 'epaules', pats: ['push_v', 'lat_raise', 'rear_delt'] },
  { m: 'biceps', pats: ['curl'], minor: true },
  { m: 'triceps', pats: ['tri_ext'], minor: true },
  { m: 'mollets', pats: ['calf'], minor: true },
  { m: 'abdos', pats: ['core'], minor: true },
]
const HAUT: Slot[] = [
  { m: 'pectoraux', pats: ['push_h', 'push_inc', 'fly'] },
  { m: 'dos', pats: ['pull_h', 'pull_v', 'shrug'] },
  { m: 'epaules', pats: ['push_v', 'lat_raise', 'rear_delt'] },
  { m: 'triceps', pats: ['tri_ext'], minor: true },
  { m: 'biceps', pats: ['curl'], minor: true },
]
const BAS: Slot[] = [
  { m: 'quadriceps', pats: ['squat', 'lunge', 'leg_ext'] },
  { m: 'ischios', pats: ['hinge', 'leg_curl'] },
  { m: 'fessiers', pats: ['hip_thrust', 'glute_iso'] },
  { m: 'mollets', pats: ['calf'], minor: true },
  { m: 'abdos', pats: ['core'], minor: true },
]
const PUSH: Slot[] = [
  { m: 'pectoraux', pats: ['push_h', 'push_inc', 'fly'] },
  { m: 'epaules', pats: ['push_v', 'lat_raise'] },
  { m: 'triceps', pats: ['tri_ext'], minor: true },
]
const PULL: Slot[] = [
  { m: 'dos', pats: ['pull_v', 'pull_h', 'shrug'] },
  { m: 'epaules', pats: ['rear_delt'], w: 0.5, minor: true, must: true },
  { m: 'biceps', pats: ['curl'], minor: true },
]

const PECS: Slot[] = [
  { m: 'pectoraux', pats: ['push_h', 'push_inc', 'fly'] },
  { m: 'triceps', pats: ['tri_ext'] },
  { m: 'epaules', pats: ['lat_raise'], w: 0.5, minor: true, must: true },
]
const DOS: Slot[] = [
  { m: 'dos', pats: ['pull_v', 'pull_h', 'shrug'] },
  { m: 'biceps', pats: ['curl'] },
  { m: 'epaules', pats: ['rear_delt'], w: 0.5, minor: true, must: true },
]
const EPAULES: Slot[] = [
  { m: 'epaules', pats: ['push_v', 'lat_raise', 'rear_delt'] },
  { m: 'abdos', pats: ['core'], minor: true },
]
const BRAS: Slot[] = [
  { m: 'biceps', pats: ['curl'] },
  { m: 'triceps', pats: ['tri_ext'] },
  { m: 'abdos', pats: ['core'], minor: true },
]

const TEMPLATES: Record<StrengthKind, { title: string; slots: Slot[] }> = {
  pecs: { title: 'Pecs / Triceps', slots: PECS },
  dos: { title: 'Dos / Biceps', slots: DOS },
  epaules: { title: 'Épaules / Abdos', slots: EPAULES },
  bras: { title: 'Bras', slots: BRAS },
  fullbody: { title: 'Full body', slots: FB },
  haut: { title: 'Haut du corps', slots: HAUT },
  bas: { title: 'Bas du corps', slots: BAS },
  push: { title: 'Push', slots: PUSH },
  pull: { title: 'Pull', slots: PULL },
  jambes: { title: 'Jambes', slots: BAS },
  renfo: { title: 'Renfo coureur', slots: [] }, // séance construite par `renfo.ts`
}

// ------------------------------------------------------------------ volumes

/** Séries hebdo moyennes par muscle (milieu de fourchette), selon objectif et niveau. */
const WEEKLY_TARGET: Record<Goal, Record<Level, number>> = {
  hypertrophie: { debutant: 10, intermediaire: 14, avance: 18 },
  force: { debutant: 6, intermediaire: 10, avance: 13 },
  mixte: { debutant: 8, intermediaire: 12, avance: 15 },
}
/** Les petits muscles reçoivent du volume indirect des polyarticulaires. */
const MUSCLE_FACTOR: Record<Muscle, number> = {
  pectoraux: 1, dos: 1.1, epaules: 0.85, biceps: 0.6, triceps: 0.6,
  quadriceps: 1, ischios: 0.8, fessiers: 0.7, mollets: 0.6, abdos: 0.5,
}
/** Rampe de volume sur le cycle de 8 semaines (S8 = décharge). */
const RAMP = [0.85, 0.9, 0.95, 1, 1.05, 1.1, 1.1, 0.55]
const RIR_RAMP = [3, 3, 2, 2, 2, 1, 1, 4]

export function cyclePosition(weekN: number): number {
  return ((weekN - 1) % 8) + 1
}

export function weeklySetTarget(m: Muscle, goal: Goal, level: Level, cyclePos: number, legFactor = 1): number {
  const ramp = RAMP[cyclePos - 1]
  let t = WEEKLY_TARGET[goal][level] * MUSCLE_FACTOR[m] * ramp
  if (LOWER_MUSCLES.includes(m)) t *= legFactor
  return Math.min(Math.round(t), MAX_WEEKLY_SETS[level])
}

// ------------------------------------------------------------------ paramètres de charge

interface Scheme { repMin: number; repMax: number; restSec: number; kind: 'main' | 'compound' | 'iso' | 'small' }

function schemeFor(goal: Goal, ex: Exercise, isFirst: boolean, isBigLift: boolean): Scheme {
  const small = ex.pattern === 'lat_raise' || ex.pattern === 'rear_delt' || ex.pattern === 'calf' || ex.pattern === 'core'
  if (goal === 'hypertrophie') {
    if (ex.compound) return isFirst ? { repMin: 6, repMax: 10, restSec: 150, kind: 'main' } : { repMin: 8, repMax: 12, restSec: 120, kind: 'compound' }
    return small ? { repMin: 12, repMax: 20, restSec: 60, kind: 'small' } : { repMin: 10, repMax: 15, restSec: 75, kind: 'iso' }
  }
  if (goal === 'force') {
    if (isBigLift) return { repMin: 3, repMax: 6, restSec: 240, kind: 'main' }
    if (ex.compound) return { repMin: 5, repMax: 8, restSec: 150, kind: 'compound' }
    return { repMin: 6, repMax: 10, restSec: 120, kind: small ? 'small' : 'iso' }
  }
  // mixte : 1er exercice de la séance en force, le reste en hypertrophie
  if (isFirst && ex.compound) return { repMin: 3, repMax: 6, restSec: 210, kind: 'main' }
  if (ex.compound) return { repMin: 6, repMax: 10, restSec: 120, kind: 'compound' }
  return { repMin: 8, repMax: 15, restSec: small ? 60 : 75, kind: small ? 'small' : 'iso' }
}

const BIG_FOUR: Pattern[] = ['squat', 'push_h', 'hinge', 'push_v']

/** Préférences d'exercices pour la force (priorité aux mouvements de base). */
const FORCE_PREF: Partial<Record<Pattern, string[]>> = {
  squat: ['squat_barre', 'squat_avant', 'hack_squat', 'presse_cuisses'],
  push_h: ['dev_couche_barre', 'dev_couche_halteres', 'dev_couche_machine'],
  hinge: ['souleve_terre', 'trap_bar', 'rdl_barre', 'rdl_halteres'],
  push_v: ['dev_militaire_barre', 'dev_epaules_halteres', 'dev_epaules_machine'],
  pull_h: ['rowing_barre', 'rowing_t', 'rowing_haltere'],
  pull_v: ['tractions_pronation', 'tractions_supination', 'tirage_vertical'],
}

// --- charges estimées à partir des 1RM
const LOAD_REF: Record<string, [lift: 'squat' | 'bench' | 'deadlift' | 'press', coef: number]> = {
  squat_barre: ['squat', 1], squat_avant: ['squat', 0.8], squat_smith: ['squat', 0.9], hack_squat: ['squat', 0.9],
  presse_cuisses: ['squat', 1.5], squat_goblet: ['squat', 0.3], fentes_arriere: ['squat', 0.3], bulgare: ['squat', 0.25],
  fentes_marchees: ['squat', 0.25],
  dev_couche_barre: ['bench', 1], dev_couche_halteres: ['bench', 0.38], dev_couche_machine: ['bench', 0.8],
  dev_couche_smith: ['bench', 0.9], dev_incline_barre: ['bench', 0.8], dev_incline_halteres: ['bench', 0.32],
  dev_incline_machine: ['bench', 0.7], dev_incline_smith: ['bench', 0.75], dev_couche_serre: ['bench', 0.8],
  rowing_barre: ['bench', 0.75], rowing_haltere: ['bench', 0.4], rowing_machine: ['bench', 0.7],
  rowing_poulie_basse: ['bench', 0.65], tirage_vertical: ['bench', 0.65], rowing_t: ['bench', 0.6],
  souleve_terre: ['deadlift', 1], trap_bar: ['deadlift', 1.05], rdl_barre: ['deadlift', 0.7], rdl_halteres: ['deadlift', 0.3],
  sdt_sumo: ['deadlift', 1],
  dev_militaire_barre: ['press', 1], dev_epaules_halteres: ['press', 0.38], dev_epaules_machine: ['press', 0.8],
  dev_militaire_smith: ['press', 0.9], arnold_press: ['press', 0.33],
}

export function epley(kg: number, reps: number): number {
  return reps <= 1 ? kg : kg * (1 + reps / 30)
}
/** Charge pour `reps` répétitions avec `rir` en réserve, à partir d'un 1RM. */
export function loadFor1RM(oneRm: number, reps: number, rir: number): number {
  return oneRm / (1 + (reps + rir) / 30)
}

export function estimate1RMs(lifts: Questionnaire['strength']['lifts']): Partial<Record<'squat' | 'bench' | 'deadlift' | 'press', number>> {
  const out: Partial<Record<'squat' | 'bench' | 'deadlift' | 'press', number>> = {}
  for (const k of ['squat', 'bench', 'deadlift', 'press'] as const) {
    const l = lifts[k]
    if (l && l.kg > 0 && l.reps > 0) out[k] = epley(l.kg, l.reps)
  }
  return out
}

export function targetKgFor(exId: string, rms: ReturnType<typeof estimate1RMs>, repMin: number, rir: number, level: Level): number | undefined {
  const ref = LOAD_REF[exId]
  if (!ref) return undefined
  const rm = rms[ref[0]]
  if (!rm) return undefined
  const safety = level === 'debutant' ? 0.9 : 1
  const kg = loadFor1RM(rm * ref[1], repMin, rir) * safety
  const step = EXERCISE_BY_ID[exId].equipment === 'halteres' ? 1 : 2.5
  return Math.max(step, round(kg, step))
}

// ------------------------------------------------------------------ construction d'une séance

export interface StrengthOpts {
  legFactor: number
  maintenance: boolean
  minLegRir: number
  injuries: Zone[]
  /** Semaine allégée du plan (course) : pas de dégressive. La semaine de décharge du cycle de muscu (S8) l'est toujours. */
  light: boolean
}
export const DEFAULT_OPTS: StrengthOpts = { legFactor: 1, maintenance: false, minLegRir: 0, injuries: [], light: false }

/** Durée estimée d'une séance : séries (parties enchaînées comprises), repos, et groupes (supersets, circuits, EMOM…). */
export function estimateSessionMinutes(exs: SessionExercise[], groups: GroupSpec[] = []): number {
  const inGroup = new Set(groups.flatMap((g) => g.exerciseIds))
  let sec = exs.filter((e) => !inGroup.has(e.id)).reduce((a, e) => a + e.sets * (40 + e.restSec) + 30 + extraPartsSeconds(e.plan), 0)
  for (const g of groups) sec += groupSeconds(g, exs.filter((e) => g.exerciseIds.includes(e.id)))
  return Math.round(sec / 60) + 8
}

interface Built {
  /** Id stable de l'exercice de séance (les groupes s'y réfèrent). */
  seId?: string
  /** Format de série voulu (série lourde, dégressive…), appliqué quand la séance est assemblée. */
  fmt?: SetFormat
  ex: Exercise; sets: number; slotIdx: number; scheme: Scheme
  /** Priorité de suppression si la séance dépasse la durée max : 0 = saute en premier, 9 = jamais supprimé. */
  rank: number
  core: boolean
}

function distribute(total: number, parts: number): number[] {
  const base = Math.floor(total / parts)
  const rest = total - base * parts
  return Array.from({ length: parts }, (_, i) => base + (i < rest ? 1 : 0))
}

/** Une séance doit toujours garder au moins ce nombre d'exercices. */
const MIN_EXERCISES = 4

export interface StrengthCtx {
  goal: Goal
  level: Level
  split: SplitKey
  n: number
  maxMinutes: number
  rms: ReturnType<typeof estimate1RMs>
  excluded: Muscle[]
}

export function makeStrengthCtx(q: Questionnaire): StrengthCtx {
  const n = q.muscuSessions
  return {
    goal: q.strength.goal,
    level: q.strength.level,
    split: resolveSplit(n, q.strength.level, q.strength.split, isUpperOnly(q.excludedMuscles)),
    n,
    maxMinutes: q.maxMinutes,
    rms: estimate1RMs(q.strength.lifts),
    excluded: q.excludedMuscles ?? [],
  }
}

/** Construit les séances de musculation d'une semaine (sans date). */
export function buildStrengthWeek(ctx: StrengthCtx, weekN: number, opts: Partial<StrengthOpts> = {}): Session[] {
  const o = { ...DEFAULT_OPTS, ...opts }
  const pos = cyclePosition(weekN)
  const excluded = new Set<Muscle>(ctx.excluded)
  const slotsOf = (k: StrengthKind) => TEMPLATES[k].slots.filter((sl) => !excluded.has(sl.m))
  // une séance dont tous les muscles sont exclus (ex. « Bas du corps » sans jambes) devient une séance de haut du corps
  const kinds = splitSessionKinds(ctx.split, ctx.n)
    .map((k) => (slotsOf(k).length ? k : slotsOf('haut').length ? 'haut' : slotsOf('bas').length ? 'bas' : null))
    .filter((k): k is StrengthKind => k !== null)
  const injuries = o.injuries

  // 1) volume hebdo visé par muscle, réparti sur les séances où il apparaît
  const occurrences: Record<string, number[]> = {}
  kinds.forEach((k, i) => {
    for (const s of slotsOf(k)) (occurrences[s.m] ||= []).push(i)
  })
  const target: Record<string, number> = {}
  for (const m of Object.keys(occurrences) as Muscle[]) {
    let t = weeklySetTarget(m, ctx.goal, ctx.level, pos, o.legFactor)
    if (o.maintenance) t = Math.round(t * 0.5)
    if (ctx.n <= 2) t = Math.round(t * 0.75)
    target[m] = t
  }

  const kindCount: Record<string, number> = {}
  const kindTotal: Record<string, number> = {}
  kinds.forEach((k) => (kindTotal[k] = (kindTotal[k] ?? 0) + 1))
  const usedInWeek = new Set<string>()
  const weeklySets: Partial<Record<Muscle, number>> = {}
  const sessions: Session[] = []

  kinds.forEach((kind, sIdx) => {
    const tpl = TEMPLATES[kind]
    const built: Built[] = []
    const usedHere = new Set<string>()
    const compoundPatterns = new Set<Pattern>()

    /** Choisit le e-ième exercice d'un slot : schémas décalés selon l'occurrence, sans doublon ni contre-indication. */
    const pick = (slot: Slot, e: number, oi: number): Exercise | undefined => {
      const rot = Math.min(slot.pats.length, 2)
      const rotated = slot.pats.map((_, i) => slot.pats[(i + (oi % rot)) % slot.pats.length])
      const first = rotated[e % rotated.length]
      for (const pat of [first, ...rotated.filter((x) => x !== first)]) {
        if (pat === 'shrug' && ctx.level !== 'avance') continue
        let cands = candidates(pat, slot.m, injuries, ctx.level)
        if (ctx.goal === 'force' && FORCE_PREF[pat]) {
          const pref = FORCE_PREF[pat]!
          const rank = (id: string) => (pref.indexOf(id) < 0 ? 99 : pref.indexOf(id))
          cands = [...cands].sort((a, b) => rank(a.id) - rank(b.id))
        }
        // jamais deux polyarticulaires du même schéma dans la même séance
        cands = cands.filter((c) => !usedHere.has(c.id) && !(c.compound && compoundPatterns.has(c.pattern)))
        if (!cands.length) continue
        const fresh = cands.filter((c) => !usedInWeek.has(c.id))
        const chosen = fresh.length && (oi > 0 || e > 0) ? fresh[0] : cands[0]
        usedHere.add(chosen.id)
        if (chosen.compound) compoundPatterns.add(chosen.pattern)
        return chosen
      }
      return undefined
    }

    slotsOf(kind).forEach((slot, slotIdx) => {
      const occ = occurrences[slot.m]
      const oi = occ.indexOf(sIdx)
      const weights = occ.map((si) => slotsOf(kinds[si]).find((x) => x.m === slot.m)?.w ?? 1)
      const wsum = weights.reduce((a, b) => a + b, 0)
      let sets = distribute(Math.round(target[slot.m]), occ.length)[oi]
      if (weights.some((w) => w !== 1)) sets = Math.round((target[slot.m] * weights[oi]) / wsum)
      const minor = !!slot.minor
      const isCore = slot.m === 'abdos'
      // Un muscle principal de la séance n'est JAMAIS supprimé faute de volume : au minimum 2 séries.
      if (sets < 2) {
        if (minor && !slot.must) return
        sets = 2
      }
      if (isCore) sets = Math.min(sets, 3)
      // séances dédiées (Haut, Bas, Push, Pull, Jambes) : plusieurs exercices par muscle (ex. tirage vertical + horizontal)
      const maxPer = kind === 'fullbody' ? (ctx.goal === 'force' ? 5 : 4) : ctx.goal === 'force' ? 4 : 3
      const nEx = isCore ? 1 : minor ? clamp(Math.ceil(sets / 4), 1, 2) : clamp(Math.ceil(sets / maxPer), 1, 3)
      const perEx = distribute(sets, nEx)
      for (let e = 0; e < nEx; e++) {
        const chosen = pick(slot, e, oi)
        if (!chosen) continue
        const rank = isCore ? 0 : minor ? 1 : !chosen.compound && slot.m === 'epaules' ? 2 : e > 0 ? 3 : !chosen.compound ? 4 : 9
        built.push({ ex: chosen, sets: perEx[e], slotIdx, scheme: { repMin: 0, repMax: 0, restSec: 0, kind: 'iso' }, rank, core: isCore })
      }
    })

    // 1 bis) une séance reste une vraie séance : assez d'exercices et de séries, sans dépasser le plafond hebdo par muscle
    // entretien léger (affûtage) : peu d'exercices, 2 séries maximum chacun
    const minEx = o.maintenance ? 3 : MIN_EXERCISES
    const floorSets = Math.round((ctx.maxMinutes <= 45 ? 9 : 12) * (o.maintenance ? 0.5 : RAMP[pos - 1] >= 0.85 ? 1 : 0.6))
    const muscleTotal = (m: Muscle) => (weeklySets[m] ?? 0) + built.filter((b) => b.ex.muscle === m).reduce((a, b) => a + b.sets, 0)
    const cap = MAX_WEEKLY_SETS[ctx.level]
    const slots = slotsOf(kind)
    // (a) assez d'exercices : on ajoute un 2e exercice aux muscles principaux de la séance
    for (const slot of slots.filter((x) => !x.minor)) {
      if (built.length >= minEx) break
      const have = built.filter((b) => b.slotIdx === slots.indexOf(slot)).length
      const extra = have ? pick(slot, have, occurrences[slot.m].indexOf(sIdx)) : undefined
      if (extra && muscleTotal(slot.m) + 2 <= cap) {
        built.push({ ex: extra, sets: 2, slotIdx: slots.indexOf(slot), scheme: { repMin: 0, repMax: 0, restSec: 0, kind: 'iso' }, rank: 3, core: false })
      }
    }
    // (b) assez de séries : on monte les exercices principaux, un par un
    const maxSetsPerEx = ctx.goal === 'force' ? 5 : 4
    let topGuard = 0
    while (!o.maintenance && built.reduce((a, b) => a + b.sets, 0) < floorSets && topGuard++ < 40) {
      const cand = built.filter((b) => !b.core && b.rank >= 3 && b.sets < maxSetsPerEx && muscleTotal(b.ex.muscle) < cap).sort((x, y) => x.sets - y.sets)[0]
        ?? built.filter((b) => !b.core && b.rank <= 2 && b.rank >= 1 && b.sets < 3 && muscleTotal(b.ex.muscle) < cap).sort((x, y) => x.sets - y.sets)[0]
      if (!cand) break
      cand.sets += 1
    }

    // 2) tri : polyarticulaires d'abord (dans l'ordre des muscles du gabarit), abdos en dernier
    built.sort((a, b) => Number(b.ex.compound) - Number(a.ex.compound) || Number(a.core) - Number(b.core) || a.slotIdx - b.slotIdx)

    // 3) schéma (reps, repos) selon l'objectif
    const bigSeen = new Set<Pattern>()
    built.forEach((b, i) => {
      const isBig = ctx.goal === 'force' && b.ex.compound && BIG_FOUR.includes(b.ex.pattern) && !bigSeen.has(b.ex.pattern)
      if (isBig) bigSeen.add(b.ex.pattern)
      b.scheme = schemeFor(ctx.goal, b.ex, i === 0, isBig)
    })

    built.forEach((b) => { b.seId ??= uid('se') })
    let restScale = 1
    let pairs: [Built, Built][] = []
    const groupsNow = (): GroupSpec[] => pairs.filter(([a, b]) => built.includes(a) && built.includes(b)).map(([a, b]) => ({
      ...defaultGroup('superset', [a.seId!, b.seId!], `g_${a.seId}`),
      rounds: Math.max(1, Math.min(a.sets, b.sets)), restBetweenSec: 15,
      restAfterRoundSec: Math.max(45, Math.round((Math.max(a.scheme.restSec, b.scheme.restSec) * restScale * 0.75) / 5) * 5),
    }))
    const toExercises = (): SessionExercise[] =>
      built.map((b, i) => {
        const iso = !b.ex.compound
        let rir = RIR_RAMP[pos - 1]
        if (pos < 8) {
          if (ctx.goal === 'hypertrophie' && iso) rir = Math.max(0, rir - 1)
          if (ctx.level === 'debutant') rir = Math.max(rir, 2)
          if (ctx.goal === 'force') rir = clamp(rir, 1, 3)
        }
        if (o.maintenance) rir = Math.max(rir, 3)
        if (LOWER_MUSCLES.includes(b.ex.muscle)) rir = Math.max(rir, o.minLegRir)
        // exercice en durée (planche…) : la cible est en secondes
        const timed = b.ex.unit === 'sec'
        const e: SessionExercise = {
          id: b.seId!, exerciseId: b.ex.id, order: i, sets: b.sets,
          repMin: timed ? 30 : b.scheme.repMin, repMax: timed ? 45 : b.scheme.repMax, rir, restSec: Math.max(45, Math.round((b.scheme.restSec * restScale) / 5) * 5),
          targetKg: targetKgFor(b.ex.id, ctx.rms, b.scheme.repMin, rir, ctx.level), logs: [],
        }
        if (b.fmt && !timed) {
          const r = applyFormat(b.fmt, { sets: b.sets, repMin: e.repMin, repMax: e.repMax, rir })
          if (r.plan) { e.plan = r.plan; e.format = r.format; e.sets = r.sets } // repMin / repMax gardent la fourchette nominale de l'exercice
        }
        return e
      })

    // 4) tenir dans la durée max, dans cet ordre : abdos → séries des petits muscles → petits muscles →
    //    2es exercices et isolations → séries en trop → repos raccourcis. Les polyarticulaires principaux restent.
    const lastIdx = (pred: (b: Built) => boolean) => { for (let i = built.length - 1; i >= 0; i--) if (pred(built[i])) return i; return -1 }
    // pas plus d'exercices que la durée ne le permet raisonnablement
    const maxEx = o.maintenance ? 5 : ctx.maxMinutes <= 45 ? 6 : ctx.maxMinutes <= 60 ? 7 : ctx.maxMinutes <= 75 ? 8 : 9
    if (o.maintenance) built.forEach((b) => { b.sets = Math.min(b.sets, 2) })
    let capGuard = 0
    while (built.length > maxEx && capGuard++ < 20) {
      const drop = [0, 1, 2, 3, 4].map((r) => lastIdx((b) => b.rank === r)).find((i) => i >= 0)
      if (drop === undefined) break
      built.splice(drop, 1)
    }
    // 3 bis) séance courte dont le volume ne tient pas : exercices opposés en supersets (jamais chez le débutant ni en entretien)
    const canFormat = ctx.level !== 'debutant' && !o.maintenance
    if (canFormat && ctx.maxMinutes <= 60 && estimateSessionMinutes(toExercises()) > ctx.maxMinutes) {
      pairs = pairOpposites(built.map((b) => ({ id: b.seId!, pattern: b.ex.pattern, muscle: b.ex.muscle, compound: b.ex.compound, sets: b.sets })))
        .map(([x, y]) => [built.find((b) => b.seId === x)!, built.find((b) => b.seId === y)!] as [Built, Built])
      for (const [a, b] of pairs) { const k = Math.max(1, Math.min(a.sets, b.sets)); a.sets = k; b.sets = k }
    }
    // 3 ter) formats de série : série lourde + séries allégées (force), dégressive sur la dernière série d'1 ou 2 isolations (hypertrophie)
    const paired = new Set(pairs.flat())
    if (canFormat) {
      if (ctx.goal === 'force') {
        const main = built.find((b) => b.scheme.kind === 'main' && b.ex.compound && b.ex.unit !== 'sec' && !paired.has(b) && b.sets >= 3)
        if (main) main.fmt = 'lourde'
      } else if (ctx.goal === 'hypertrophie' && pos !== 8 && !o.light) {
        const isos = built.filter((b) => !b.ex.compound && !['core', 'calf', 'shrug'].includes(b.ex.pattern) && b.ex.unit !== 'sec' && !paired.has(b) && b.sets >= 3).reverse()
        const picked: Built[] = []
        for (const b of isos) if (!picked.some((x) => x.ex.muscle === b.ex.muscle)) picked.push(b)
        for (const b of picked.slice(0, isos.length >= 3 ? 2 : 1)) b.fmt = 'degressive'
      }
    }
    let guard = 0
    while (estimateSessionMinutes(toExercises(), groupsNow()) > ctx.maxMinutes && guard++ < 300) {
      const n = built.length
      let i: number
      if (n > minEx && (i = lastIdx((b) => b.core)) >= 0) { built.splice(i, 1); continue }
      if ((i = lastIdx((b) => b.rank <= 2 && b.sets > 2)) >= 0) { built[i].sets -= 1; continue }
      if (n > minEx && (i = lastIdx((b) => b.rank <= 2)) >= 0) { built.splice(i, 1); continue }
      if ((i = lastIdx((b) => b.rank >= 3 && b.rank < 9 && b.sets > 2)) >= 0) { built[i].sets -= 1; continue }
      if (n > minEx && (i = lastIdx((b) => b.rank >= 3 && b.rank < 9)) >= 0) { built.splice(i, 1); continue }
      if ((i = lastIdx((b) => b.sets > 3)) >= 0) { built[i].sets -= 1; continue }
      if ((i = lastIdx((b) => b.sets > 2)) >= 0) { built[i].sets -= 1; continue }
      if (restScale > 0.55) { restScale -= 0.15; continue }
      break
    }
    const groups = groupsNow()
    // les deux exercices d'un superset font le même nombre de tours
    for (const g of groups) for (const b of built) if (g.exerciseIds.includes(b.seId!)) b.sets = g.rounds
    const exs = toExercises()
    built.forEach((b) => { usedInWeek.add(b.ex.id); weeklySets[b.ex.muscle] = (weeklySets[b.ex.muscle] ?? 0) + b.sets })

    // 5) titre, charge de jambes
    kindCount[kind] = (kindCount[kind] ?? 0) + 1
    const suffix = kindTotal[kind] > 1 ? ` ${String.fromCharCode(64 + kindCount[kind])}` : ''
    const legSets = exs.filter((e) => LOWER_MUSCLES.includes(EXERCISE_BY_ID[e.exerciseId].muscle) && EXERCISE_BY_ID[e.exerciseId].muscle !== 'mollets')
      .reduce((a, e) => a + e.sets, 0)
    sessions.push({
      id: uid('s'), weekN, date: '', sport: 'muscu', kind, title: tpl.title + suffix, status: 'prevue',
      estMinutes: estimateSessionMinutes(exs, groups), exercises: exs, ...(groups.length ? { groups: groups as ExerciseGroup[] } : {}),
      legLoad: legSets >= 6 ? 'heavy' : legSets >= 3 ? 'light' : 'none',
    })
  })

  // garde-fou : jamais plus de séries par muscle et par semaine que le plafond du niveau
  const capW = MAX_WEEKLY_SETS[ctx.level]
  for (const m of Object.keys(weeklySets) as Muscle[]) {
    let guardW = 0
    while ((weeklySets[m] ?? 0) > capW && guardW++ < 60) {
      const all = sessions.flatMap((s) => s.exercises ?? []).filter((e) => EXERCISE_BY_ID[e.exerciseId].muscle === m && e.sets > 2)
      const biggest = all.sort((a, b) => b.sets - a.sets)[0]
      if (!biggest) break
      biggest.sets -= 1
      weeklySets[m] = (weeklySets[m] ?? 0) - 1
    }
  }
  // le garde-fou ci-dessus a pu retirer une série à un seul exercice d'un superset : les tours suivent le plus petit
  for (const s of sessions) { syncRoundsFromMembers(s); s.estMinutes = estimateSessionMinutes(s.exercises ?? [], s.groups) }
  return sessions
}

/** Séries directes par muscle sur une liste de séances. */
export function weeklyMuscleSets(sessions: Session[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const s of sessions) {
    for (const e of s.exercises ?? []) {
      const m = EXERCISE_BY_ID[e.exerciseId]?.muscle
      if (m) out[m] = (out[m] ?? 0) + e.sets
    }
  }
  return out
}
